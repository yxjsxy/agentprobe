# AgentProbe

Inspect a local agent trace for repeated calls, rapid retries, excessive output, input-shape drift, unused tools, and latency outliers. Reports include a health score and evidence identifiers for each finding.

## Core idea

Point AgentProbe at a JSONL trace and it will:
- compute a health score
- emit a ranked smell list
- attach concrete evidence lines
- optionally compare called tools against a manifest of declared tools
- benchmark the runtime across bundled fixtures

## Requirements

Node.js 18 or newer and Git. These commands use Node built-ins; no hosted service or API key is needed.

## Quick start

```bash
git clone https://github.com/yxjsxy/agentprobe.git
cd agentprobe
node cli.js inspect fixtures/retry-storm.jsonl fixtures/manifest.json
node cli.js json fixtures/looping-run.jsonl fixtures/manifest.json
node cli.js benchmark fixtures/clean-run.jsonl fixtures/retry-storm.jsonl fixtures/context-bloat.jsonl fixtures/schema-drift.jsonl fixtures/looping-run.jsonl fixtures/manifest.json
```

## Use your own data

Use JSONL with one tool-call object per line. The rules read fields such as `tool`, `input`, `output`, `error`, `timestamp_ms`, `duration_ms`, and optional `id`. Pass an optional manifest containing declared tools to enable unused-tool findings. The bundled fixtures demonstrate the supported format.

## Read the results

`inspect` prints a readable report; `json` emits structured findings; `benchmark` measures analysis time over the provided traces. Scores rank heuristic findings, not task success or root cause. Unsupported trace formats need an adapter.

## Rule set

- `tool-loop`: same tool plus same input repeated at least three times inside 60 seconds
- `silent-retry`: an errored call is retried with identical input inside 2 seconds
- `context-bloat`: a tool emits more than 20 KB of output
- `schema-drift`: the same tool appears with inconsistent input key layouts
- `dead-tool`: a tool is declared in the manifest but never called
- `latency-outlier`: p99 latency is at least 5x p50

## Limitations

- JSONL schema is intentionally simple for v0.1
- no hosted ingestion or UI
- rules are heuristic, not semantic root-cause analysis
- manifest-based dead-tool detection assumes you provide a tool list file

## Examples and evaluation

The bundled `fixtures/` provide reproducible examples. See [experiment notes](docs/experiments.md) for the historical benchmark setup and its limits; those fixture results are not guarantees for other inputs.
