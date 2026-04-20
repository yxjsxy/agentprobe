# AgentProbe

AgentProbe is a local CLI that turns raw agent trace files into an instant smell report.

Most teams already have traces. What they do not have is a fast way to answer a simple question before opening Langfuse, LangSmith, or a hosted dashboard: is this run obviously sick?

AgentProbe gives you that answer in one command.

## Why this exists

Agent builders debug too many failures by staring at JSONL logs, scrolling for retries, and manually guessing where a run went off the rails. Hosted observability products are powerful, but they assume you already instrumented the app, pushed data to the cloud, and want a full platform.

AgentProbe is deliberately narrower.

It reads a local trace file and flags the first six failure smells that show up again and again in agent workflows:
- tool loops
- silent retries
- context bloat
- schema drift
- dead tools declared but never called
- latency outliers

## Community baseline and positioning

AgentProbe is not trying to replace Langfuse or LangSmith.

Baseline options today:
- raw `cat` or `jq` over JSONL traces, which is flexible but slow and manual
- hosted observability stacks like Langfuse and LangSmith, which are richer but heavier and cloud-oriented
- PR review bots such as PR-Agent or CodeRabbit, which summarize pull requests rather than agent execution traces

AgentProbe asks a much smaller question: can a developer get a useful local health read in under a second, before setting up anything else?

## Core idea

Point AgentProbe at a JSONL trace and it will:
- compute a health score
- emit a ranked smell list
- attach concrete evidence lines
- optionally compare called tools against a manifest of declared tools
- benchmark the runtime across bundled fixtures

## Quick start

```bash
cd ~/Documents/vibe_coding/agentprobe
node cli.js inspect fixtures/retry-storm.jsonl fixtures/manifest.json
node cli.js json fixtures/looping-run.jsonl fixtures/manifest.json
node cli.js benchmark fixtures/clean-run.jsonl fixtures/retry-storm.jsonl fixtures/context-bloat.jsonl fixtures/schema-drift.jsonl fixtures/looping-run.jsonl fixtures/manifest.json
```

## Example output

```bash
node cli.js inspect fixtures/looping-run.jsonl fixtures/manifest.json
```

Returns:
- a health score out of 100
- every triggered smell rule
- a short summary for each rule
- evidence snippets you can paste into an issue or incident report

## Experiments and comparison

We benchmarked AgentProbe against the community baseline of raw log inspection and compared its framing to hosted observability tools.

### Baselines
- raw JSONL inspection with shell tools
- hosted stacks such as Langfuse and LangSmith
- PR review tools like PR-Agent and CodeRabbit, which operate on code diffs instead of execution traces

### Bundled experiment result
- traces analyzed: 5
- average runtime: 8.45 ms on bundled fixtures
- all 6 rules exercised across the fixture pack
- validation artifact: `docs/experiments.md`

The headline is not that AgentProbe beats a full observability product. It wins on setup cost and time-to-first-signal.

## Rule set

- `tool-loop`: same tool plus same input repeated at least three times inside 60 seconds
- `silent-retry`: an errored call is retried with identical input inside 2 seconds
- `context-bloat`: a tool emits more than 20 KB of output
- `schema-drift`: the same tool appears with inconsistent input key layouts
- `dead-tool`: a tool is declared in the manifest but never called
- `latency-outlier`: p99 latency is at least 5x p50

## Architecture

- `cli.js`: parser, analyzers, renderer, and benchmark runner
- `fixtures/`: reproducible traces for clean, retry, bloat, schema drift, and looping cases
- `docs/experiments.md`: baseline comparison, benchmark output, and ablation notes
- `gates/agentprobe-mvp.sh`: harness verification

## How to verify

```bash
bash ~/.openclaw/workspace/scripts/coding_harness.sh gates/agentprobe-mvp.sh 3
```

## Use cases

- sanity-check an agent run before opening a heavier dashboard
- ship a local regression fixture with your agent project
- attach fast smell evidence to a GitHub issue
- compare whether a trace got healthier after a tool or prompt change

## Limitations

- JSONL schema is intentionally simple for v0.1
- no hosted ingestion or UI
- rules are heuristic, not semantic root-cause analysis
- manifest-based dead-tool detection assumes you provide a tool list file

## Roadmap

- native adapters for Claude Code and OpenAI Agents traces
- `--fail-on` thresholds for CI
- markdown incident packet export
- diff mode for before vs after traces
