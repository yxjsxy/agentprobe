# AgentProbe Roadmap

## 当前状态：🚧 活跃开发中
- 项目定位：本地 agent trace smell detector，帮开发者在接入 Langfuse / LangSmith 之前先拿到第一份健康诊断
- 完成度：39%
- 当前状态：MVP 已可运行，包含 6 条 smell 规则、JSONL fixture、benchmark、实验日志和 harness gate

## 项目介绍
AgentProbe 面向已经有 agent trace、但还没有轻量本地诊断工具的开发者。它不替代完整 observability 平台，而是解决更前面的那一步：先把一份 trace 快速判成“健康”还是“明显有味道”。

## 已实现功能
- JSONL trace 解析
- health score 输出
- tool-loop 检测
- silent-retry 检测
- context-bloat 检测
- schema-drift 检测
- dead-tool 检测
- latency-outlier 检测
- JSON 输出
- benchmark 命令
- README + docs/experiments.md
- harness gate

## 未实现功能

### P0
- Claude Code trace adapter
- fail-on threshold for CI

### P1
- markdown incident pack export
- before vs after diff mode
- OpenAI Agents trace adapter

### P2
- hosted dashboard
- GitHub Action
- rule plugin system

## 技术栈
- Node.js
- 零依赖 CLI

## 运行方式
- `node cli.js inspect fixtures/retry-storm.jsonl fixtures/manifest.json`
- `node cli.js json fixtures/looping-run.jsonl fixtures/manifest.json`
- `node cli.js benchmark fixtures/clean-run.jsonl fixtures/retry-storm.jsonl fixtures/context-bloat.jsonl fixtures/schema-drift.jsonl fixtures/looping-run.jsonl fixtures/manifest.json`

## 验收
- `bash ~/.openclaw/workspace/scripts/coding_harness.sh gates/agentprobe-mvp.sh 3`
