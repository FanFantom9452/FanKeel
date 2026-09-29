---
status: current
last_verified: 2026-09-29
source_of_truth: 本頁是一次量測的記錄，不隨程式碼更新；機制以 lib/title.js 為準
---

# 只設 CLAUDE_CODE_SUBAGENT_MODEL 的對照量測 — 2026-09-29

`lib/title.js` 把 `CLAUDE_CODE_SUBAGENT_MODEL` 排在 agent 檔 `model:` 之後、session 模型之前（[title-probe](2026-09-29-title-probe.md) 量過一次，且是和 agent 檔並存的情況）。這頁補只設這個變數、agent 檔沒有 `model:` 的對照。

## 方法

Claude Code 2.1.284，兩次 headless `claude -p`，`--setting-sources project`，專案裡只有一個沒有 `model:` 的 `plain` agent。第一次不設變數，第二次設 `CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5`。模型讀自 subagent 自己的 transcript。

## 結果

| 臂 | session id | subagent transcript 的 `message.model` |
|---|---|---|
| 不設變數 | a9f7d278-4ce7-4b1f-ba5b-c94134201df4 | claude-opus-5-5 |
| 設變數 | 1d56df46-3a13-4864-9c66-315bfacbebb4 | claude-haiku-4-5-20251001 |

## 沒量到的

- 各只跑一次，n=1。
- 只量了 agent 檔沒有 `model:` 的情況；有 `model:` 時的順序是 [title-probe](2026-09-29-title-probe.md) 量的。
- 只量了 2.1.284。
