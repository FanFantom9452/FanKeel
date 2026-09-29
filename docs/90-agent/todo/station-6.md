---
label: station
title: 單次拉高 effort 與蓋掉模型
description: effort 已在 8 個 agent 檔釘死；使用者要蓋掉模型或臨時拉高 effort，只能從 profile 產生 .claude/agents/ 覆寫檔。先實測同名檔能否蓋過 fankeel: 的 agent，guard／brief 要認得新名稱
state: ready
link: docs/90-agent/reference/model-choice.md
---

## Spike 2026-09-29

Scratch project `.fankeel/build/task-20260929T122234/spike-effort/` with a `.claude/agents/fankeel-reader.md` (model haiku, effort low, marker SPIKE-OVERRIDE-MARKER); the plugin's own file is sonnet, medium. Headless `claude -p`, default permission mode, `--setting-sources project --plugin-dir F:/ymlab/fankeel`; no denial, no `--allowedTools` needed.

- `subagent_type: fankeel-reader` (bare): the project file ran. Model `claude-haiku-4-5-20251001`, marker present. Transcript: `C:/Users/Owner/.claude/projects/F--ymlab-fankeel--fankeel-build-task-20260929T122234-spike-effort/ba65a179-947f-4b07-9f23-62841331321a/subagents/agent-a706b717ea55a28fb.jsonl`
- `subagent_type: fankeel:fankeel-reader` (prefixed): the plugin file ran. Model `claude-sonnet-5-5`, marker absent. Transcript: `C:/Users/Owner/.claude/projects/F--ymlab-fankeel--fankeel-build-task-20260929T122234-spike-effort/4ce3cd14-a796-4ca4-9e57-49d72351dad5/subagents/agent-a8ec75ae6f8917ddd.jsonl`

Follows: a same-name project file does not override the plugin agent, it sits beside it and answers only the bare name, so a generated `.claude/agents/` file is enough only if the dispatching skills call the bare name; every skill that dispatches `fankeel:fankeel-reader` keeps the plugin's model and effort, so the entry stays `ready` with the guard and brief naming the bare spelling as the work.
