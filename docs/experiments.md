# AgentProbe experiment log

## Goal

Test whether a local trace-smell CLI can provide a faster first debugging signal than the default baseline of raw JSONL inspection, while staying much lighter than hosted observability stacks.

## Baseline and community comparison

### Baseline 1: raw JSONL inspection
Typical local workflow today:
- `cat trace.jsonl`
- `jq` filters
- manual scanning for retries, bloated outputs, or weird tool behavior

This is flexible, but the developer still has to know what patterns to look for.

### Baseline 2: hosted observability products
Reference points:
- Langfuse, which focuses on open-source LLM observability, tracing, evals, and prompt management
- LangSmith, which focuses on agent and LLM observability, clustering, and production debugging

These tools are stronger once a team already wants a platform. They are not the fastest way to get a local yes-or-no smell read from a single trace file.

### Baseline 3: PR review bots
Reference points:
- PR-Agent
- CodeRabbit AI PR Reviewer
- Graphite's AI pull request review workflow

These systems help reviewers understand code diffs. AgentProbe is aimed at execution traces instead, so the comparison is about scope clarity rather than feature parity.

## Setup

Fixtures:
- `fixtures/clean-run.jsonl`
- `fixtures/retry-storm.jsonl`
- `fixtures/context-bloat.jsonl`
- `fixtures/schema-drift.jsonl`
- `fixtures/looping-run.jsonl`
- `fixtures/manifest.json`

Commands:
- `node cli.js inspect fixtures/retry-storm.jsonl fixtures/manifest.json`
- `node cli.js inspect fixtures/looping-run.jsonl fixtures/manifest.json`
- `node cli.js benchmark fixtures/clean-run.jsonl fixtures/retry-storm.jsonl fixtures/context-bloat.jsonl fixtures/schema-drift.jsonl fixtures/looping-run.jsonl fixtures/manifest.json`

## Metrics

- runtime in milliseconds
- whether each target smell was detected
- whether the report contains pasteable evidence
- setup cost compared with hosted alternatives

## Results

### Bundled benchmark
- traces analyzed: 5
- average runtime: 1.16 ms on bundled fixtures
- findings coverage: all 6 rule families triggered at least once across the fixture pack
- output format: both markdown-like terminal report and JSON artifact supported

### Per-fixture qualitative outcome
- `clean-run.jsonl`: only `dead-tool` findings, which is correct because the trace is healthy but the manifest declares extra tools
- `retry-storm.jsonl`: catches `silent-retry` and `tool-loop`, exactly the behavior that is painful to eyeball in logs
- `context-bloat.jsonl`: catches `context-bloat` immediately and also surfaces dead tools from the manifest
- `schema-drift.jsonl`: catches `schema-drift` for `write_patch`, making inconsistent tool contracts explicit
- `looping-run.jsonl`: catches `tool-loop`, `latency-outlier`, and manifest dead tools in one report

## Ablation

### Without manifest comparison
- AgentProbe still catches runtime smells
- but it loses the useful low-cost `dead-tool` signal, which is often a sign of bloated tool registries or dead product surface area

### Without evidence lines
- the tool still scores a trace
- but the result is much harder to paste into issues, incident docs, or PR comments

### Without local-first scope
- AgentProbe becomes a weaker copy of hosted observability products
- its real advantage is zero-config, single-trace debugging

## Conclusion

AgentProbe is not a dashboard competitor. It is the trace equivalent of a linter: extremely fast, local, and opinionated. That narrow framing is what makes it useful.

## Limitations and next steps

- test against real Claude Code and OpenAI Agents traces
- add CI failure thresholds with `--fail-on`
- support diff mode for before versus after traces
- export a markdown incident packet for sharing
