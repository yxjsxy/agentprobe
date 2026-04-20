#!/usr/bin/env bash
set -euo pipefail
# GATE_LEVEL: P0
# GATE_VERIFY: agentprobe must detect the expected smells on bundled fixtures and emit benchmark output

cd /Users/karlkarl/Documents/vibe_coding/agentprobe

node cli.js json fixtures/retry-storm.jsonl fixtures/manifest.json > .harness-retry.json
node cli.js json fixtures/context-bloat.jsonl fixtures/manifest.json > .harness-bloat.json
node cli.js json fixtures/schema-drift.jsonl fixtures/manifest.json > .harness-schema.json
node cli.js json fixtures/looping-run.jsonl fixtures/manifest.json > .harness-loop.json
node cli.js benchmark fixtures/clean-run.jsonl fixtures/retry-storm.jsonl fixtures/context-bloat.jsonl fixtures/schema-drift.jsonl fixtures/looping-run.jsonl fixtures/manifest.json > .harness-benchmark.md

grep -q '"rule": "silent-retry"' .harness-retry.json
grep -q '"rule": "tool-loop"' .harness-retry.json
grep -q '"rule": "context-bloat"' .harness-bloat.json
grep -q '"rule": "schema-drift"' .harness-schema.json
grep -q '"rule": "latency-outlier"' .harness-loop.json
grep -q '"rule": "tool-loop"' .harness-loop.json
grep -q 'average runtime' .harness-benchmark.md
grep -q 'looping-run.jsonl' .harness-benchmark.md

test -s .harness-retry.json
test -s .harness-bloat.json
test -s .harness-schema.json
test -s .harness-loop.json
test -s .harness-benchmark.md

echo 'AgentProbe MVP gate passed'
