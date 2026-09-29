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

## Spike 2026-09-29 — updatedInput.subagent_type

Scratch project `.fankeel/build/2026-09-29-ready-four/spike-rewrite/project/` with a `.claude/agents/fankeel-reader.md` (model haiku, effort low, marker SPIKE-REWRITE-MARKER) and a scratch PreToolUse hook `rewrite.js` on `Agent|Task` that returns `updatedInput.subagent_type: fankeel-reader` for `fankeel:fankeel-reader` and logs every call to `hook.log`. Headless `claude -p`, `--setting-sources project`, dispatching `fankeel:fankeel-reader`; the scratch hook is added with `--settings ../hooks.json`.

- Arm 0 (control), `--plugin-dir F:/ymlab/fankeel`, no scratch hook: `session d7f1b4c6-b0c0-4bca-9eb5-153916407ff5`. Model `claude-sonnet-5-5`, marker absent, `agentType` `fankeel:fankeel-reader`. Transcript: `C:/Users/Owner/.claude/projects/F--ymlab-fankeel--fankeel-build-2026-09-29-ready-four-spike-rewrite-project/d7f1b4c6-b0c0-4bca-9eb5-153916407ff5/subagents/agent-af85044ea0d8c02c0.jsonl`
- Arm 1, `--plugin-dir F:/ymlab/fankeel --settings ../hooks.json`: `session 9b97aa3c-0ceb-4ccb-8eba-a781c9784386`. Model `claude-sonnet-5-5`, marker absent, `agentType` `fankeel:fankeel-reader`. `hook.log` has the `fankeel:fankeel-reader` line, so the scratch hook ran; the plugin's own `hooks/title.js` also answers on `Agent|Task` (description became `sonnet 5.5 · medium: spike`) and its `updatedInput` replaced the scratch one. Transcript: `C:/Users/Owner/.claude/projects/F--ymlab-fankeel--fankeel-build-2026-09-29-ready-four-spike-rewrite-project/9b97aa3c-0ceb-4ccb-8eba-a781c9784386/subagents/agent-a9232c7b0471f459d.jsonl`
- Arm 2, `--plugin-dir ../plugin-notitle --settings ../hooks.json` (plugin copy without the title hook): `session 9f937542-5010-4761-9019-246e54799a6f`. Model `claude-haiku-4-5-20251001`, marker present, `agentType` `fankeel-reader`, description stayed `spike`. Transcript: `C:/Users/Owner/.claude/projects/F--ymlab-fankeel--fankeel-build-2026-09-29-ready-four-spike-rewrite-project/9f937542-5010-4761-9019-246e54799a6f/subagents/agent-a1e00aace25de6541.jsonl`

Two PreToolUse hooks that both return `updatedInput` do not merge: arm 1 kept only the plugin's output. So the swap must live inside `hooks/title.js` itself, in the same `updatedInput` that sets the description; a second hook's output is dropped when title.js also answers.

Verdict: honoured

## 實跑 2026-09-29 — 真的 title hook

`live.js`（scratch，gitignored）用 `profile.write` 把 `agent.fankeel-reader.model` 設成 `haiku`，再由 `syncAgent` 產生 `.claude/agents/fankeel-reader.md`（輸出 `"state":"written"`，檔內 `model: haiku`、`generated_by: fankeel 0.84.0`）。Arm 3 用真的 plugin 與 `hooks/title.js`：`claude -p`、`--setting-sources project --plugin-dir F:/ymlab/fankeel`，沒有 `--settings`，派工時寫 `subagent_type: fankeel:fankeel-reader`。

- Arm 3: `session ea1675bb-4efa-4196-b04a-b59ee4f48e46`。`message.model` `claude-haiku-4-5-20251001`，`agentType` `fankeel-reader`；stream 裡 task_started 的 description 是 `haiku · medium: live`。Transcript: `C:/Users/Owner/.claude/projects/F--ymlab-fankeel--claude-worktrees-agent-aa7d7d978ea3ade7c--fankeel-build-2026-09-29-ready-four-spike-rewrite-project/ea1675bb-4efa-4196-b04a-b59ee4f48e46/subagents/agent-ac9c688343fc94a8a.jsonl`

Live: haiku
