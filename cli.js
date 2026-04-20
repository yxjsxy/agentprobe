#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function readJsonl(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL at ${file}:${index + 1}`);
      }
    });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function bytesFor(value) {
  if (value === undefined || value === null) return 0;
  return Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value));
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[index];
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function fingerprint(call) {
  return `${call.tool}::${JSON.stringify(call.input || {})}`;
}

function detectToolLoops(calls) {
  const findings = [];
  for (let index = 0; index < calls.length; index += 1) {
    const seed = calls[index];
    const group = [seed];
    for (let cursor = index + 1; cursor < calls.length; cursor += 1) {
      const candidate = calls[cursor];
      if (fingerprint(candidate) !== fingerprint(seed)) continue;
      if ((candidate.timestamp_ms - seed.timestamp_ms) > 60000) continue;
      group.push(candidate);
    }
    if (group.length >= 3) {
      findings.push({
        rule: 'tool-loop',
        severity: 'high',
        summary: `${seed.tool} repeated ${group.length} times with identical input inside 60s`,
        evidence: group.map((item) => item.id || `${item.tool}@${item.timestamp_ms}`).slice(0, 4),
      });
    }
  }
  return dedupeFindings(findings);
}

function detectSilentRetries(calls) {
  const findings = [];
  for (let index = 0; index < calls.length - 1; index += 1) {
    const current = calls[index];
    const next = calls[index + 1];
    if (!current.error) continue;
    if (fingerprint(current) !== fingerprint(next)) continue;
    if ((next.timestamp_ms - current.timestamp_ms) > 2000) continue;
    findings.push({
      rule: 'silent-retry',
      severity: 'medium',
      summary: `${current.tool} retried ${next.timestamp_ms - current.timestamp_ms}ms after an error with identical input`,
      evidence: [current.id || `${current.tool}@${current.timestamp_ms}`, next.id || `${next.tool}@${next.timestamp_ms}`],
    });
  }
  return dedupeFindings(findings);
}

function detectContextBloat(calls) {
  return calls
    .filter((call) => bytesFor(call.output) > 20000)
    .map((call) => ({
      rule: 'context-bloat',
      severity: 'medium',
      summary: `${call.tool} emitted ${bytesFor(call.output)} bytes of output`,
      evidence: [call.id || `${call.tool}@${call.timestamp_ms}`],
    }));
}

function detectSchemaDrift(calls) {
  const byTool = new Map();
  for (const call of calls) {
    const keys = Object.keys(call.input || {}).sort();
    const signature = keys.join(',');
    if (!byTool.has(call.tool)) byTool.set(call.tool, new Set());
    byTool.get(call.tool).add(signature);
  }
  return [...byTool.entries()]
    .filter(([, signatures]) => signatures.size > 1)
    .map(([tool, signatures]) => ({
      rule: 'schema-drift',
      severity: 'medium',
      summary: `${tool} appeared with ${signatures.size} different input key layouts`,
      evidence: [...signatures].map((item) => item || '(empty input)'),
    }));
}

function detectDeadTools(calls, manifest) {
  if (!manifest || !Array.isArray(manifest.tools)) return [];
  const used = new Set(calls.map((call) => call.tool));
  return manifest.tools
    .filter((tool) => !used.has(tool))
    .map((tool) => ({
      rule: 'dead-tool',
      severity: 'low',
      summary: `${tool} is declared in the manifest but never called`,
      evidence: [tool],
    }));
}

function detectLatencyOutliers(calls) {
  const durations = calls.map((call) => call.duration_ms).filter((value) => typeof value === 'number').sort((a, b) => a - b);
  if (durations.length < 5) return [];
  const p50 = percentile(durations, 0.5);
  const p99 = percentile(durations, 0.99);
  if (p50 === 0 || p99 < p50 * 5) return [];
  return [{
    rule: 'latency-outlier',
    severity: 'medium',
    summary: `p99 latency ${formatNumber(p99)}ms is ${formatNumber(p99 / p50)}x p50 ${formatNumber(p50)}ms`,
    evidence: [`p50=${formatNumber(p50)}ms`, `p99=${formatNumber(p99)}ms`],
  }];
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((item) => {
    const key = `${item.rule}:${item.summary}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function analyze(traceFile, manifestFile) {
  const calls = readJsonl(traceFile);
  const manifest = manifestFile ? readJson(manifestFile) : null;
  const findings = [
    ...detectToolLoops(calls),
    ...detectSilentRetries(calls),
    ...detectContextBloat(calls),
    ...detectSchemaDrift(calls),
    ...detectDeadTools(calls, manifest),
    ...detectLatencyOutliers(calls),
  ].sort((left, right) => left.rule.localeCompare(right.rule));

  const score = Math.max(0, 100 - findings.reduce((sum, finding) => {
    const weight = finding.severity === 'high' ? 20 : finding.severity === 'medium' ? 12 : 6;
    return sum + weight;
  }, 0));

  return {
    trace: path.basename(traceFile),
    calls: calls.length,
    score,
    findings,
  };
}

function renderInspect(result) {
  const findingLines = result.findings.length
    ? result.findings.map((finding) => `- [${finding.severity}] ${finding.rule}: ${finding.summary}\n  evidence: ${finding.evidence.join(' | ')}`).join('\n')
    : '- no smells detected';

  return `# AgentProbe Report\n\n## Trace\n- ${result.trace}\n- calls: ${result.calls}\n- health score: ${result.score}/100\n\n## Findings\n${findingLines}\n`;
}

function renderJson(result) {
  return JSON.stringify(result, null, 2);
}

function benchmark(traceFiles, manifestFile) {
  const rows = traceFiles.map((traceFile) => {
    const started = process.hrtime.bigint();
    const result = analyze(traceFile, manifestFile);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    return {
      trace: path.basename(traceFile),
      calls: result.calls,
      score: result.score,
      findings: result.findings.length,
      elapsedMs,
    };
  });

  const avgMs = rows.reduce((sum, row) => sum + row.elapsedMs, 0) / rows.length;
  return `# AgentProbe Benchmark\n\n## Summary\n- traces analyzed: ${rows.length}\n- average runtime: ${avgMs.toFixed(2)} ms\n\n## Per trace\n${rows.map((row) => `- ${row.trace}: ${row.calls} calls, ${row.findings} findings, score ${row.score}, runtime ${row.elapsedMs.toFixed(2)} ms`).join('\n')}\n`;
}

const [, , command, ...args] = process.argv;
if (!command) {
  console.error('Usage: node cli.js <inspect|json|benchmark> <trace-file> [manifest.json]');
  process.exit(1);
}

if (command === 'inspect') {
  const [traceFile, manifestFile] = args;
  if (!traceFile) {
    console.error('Usage: node cli.js inspect <trace-file> [manifest.json]');
    process.exit(1);
  }
  process.stdout.write(renderInspect(analyze(traceFile, manifestFile)));
} else if (command === 'json') {
  const [traceFile, manifestFile] = args;
  if (!traceFile) {
    console.error('Usage: node cli.js json <trace-file> [manifest.json]');
    process.exit(1);
  }
  process.stdout.write(renderJson(analyze(traceFile, manifestFile)));
} else if (command === 'benchmark') {
  if (args.length < 2) {
    console.error('Usage: node cli.js benchmark <trace-file> [more-traces...] <manifest.json>');
    process.exit(1);
  }
  const manifestFile = args[args.length - 1];
  const traceFiles = args.slice(0, -1);
  process.stdout.write(benchmark(traceFiles, manifestFile));
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
