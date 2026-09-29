---
status: design-intent
last_verified: 2026-09-29
---

# 派工標題的前綴由腳本算，不讓 LLM 寫

session cfff73c6-897b-4dd2-bfff-5114b4b943ad 的 design。它描述要做成的樣子，不是現在的樣子。

動機：session 7a23b26a 的三個 agent 標題寫「sonnet 5」，transcript 的 `message.model` 全是
`claude-sonnet-5-5`。規則（`lib/render.js:516`）叫 LLM 從環境區塊推版本，而別名 `sonnet`
在 09-29 當天從 `claude-sonnet-5` 換成 `claude-sonnet-5-5`，推出來的版本是舊的。

## 已量到的

- 2026-09-29，Claude Code 2.1.284，headless：PreToolUse(`Agent|Task`) 回傳 `permissionDecision: allow`
  加 `updatedInput.description = 'REWRITTEN ' + 原文`。模型自己的 tool_use 仍是原文；
  `background_tasks_changed`、`task_started`、tool result 與 `agent-*.meta.json` 都是改寫後的。
  證據：`.fankeel/build/task-20260929T090942/probe/stream.jsonl`（gitignored）。
- subagent transcript 每筆都記實際的 `"effort"`（例：`"effort":"medium"`），是 effort 的真值。
- 官方文件（sub-agents、model-config，09-29 由 claude-code-guide 讀）：Agent 工具沒有
  effort 參數；模型順序是呼叫的 `model` > agent 檔 `model:` > `CLAUDE_CODE_SUBAGENT_MODEL` > 主 session；
  Sonnet 5.5 與 Opus 5.5 預設 effort 是 medium；插件更新會裝到新目錄，改安裝那份會消失。

## 1. 前綴的算法 — `lib/title.js`

- 模型別名依序取：`tool_input.model`；`subagent_type` 對到的 agent 檔 frontmatter `model:`
  （`fankeel:<name>` → 本插件 `agents/<name>.md`；其他名稱 → 專案 `.claude/agents/<name>.md`，
  再 `~/.claude/agents/<name>.md`）；`CLAUDE_CODE_SUBAGENT_MODEL`；都沒有（或寫 `inherit`）就是
  inherit，取主 session transcript（`transcript_path`）最後一筆 assistant 的 `message.model`。
- 版本不猜：從 model id 用一條通用規則解析 `claude-<family>-<major>[-<minor>]`（`claude-sonnet-5-5`
  → `sonnet 5.5`，`claude-haiku-5-5` → `haiku 5.5`），不放任何版本表或家族清單。別名沒有 id 時，
  到本專案的 subagent transcript（`~/.claude/projects/<proj>/*/subagents/agent-*.jsonl`）依 mtime
  由新到舊找，取**最新一筆**同家族的 `message.model`；找不到就只寫別名，不寫版本。
- effort 取 agent 檔的 `effort:`，沒有就寫 `inherit`。
- 前綴格式 `<alias>[ <version>] · <effort>`，接在標題前面，以 `: ` 分隔。

## 2. 前綴由 hook 寫進去 — `hooks/title.js`

- 新的 PreToolUse hook，matcher `Agent|Task`，與 `hooks/guard.js` 並列。不看 registry，
  沒有進行中的任務也照樣補前綴。
- 用 `updatedInput` 把 description 換成「前綴: 標題」。description 開頭已經是前綴形狀的
  （`<字母>[ <數字>] · <字母>: `）先剝掉再補，所以 LLM 寫錯的前綴不會留下來。
- 任何讀檔或解析失敗都不輸出任何東西，派工照原樣進行；hook 絕不擋派工。

## 3. 規則只叫 LLM 寫標題

- `lib/render.js:516` 改成更短的一句：description 只寫標題，模型、版本、effort 由 hook 補。
- 同步 `agents/fankeel-brain.md:37`、`skills/fankeel/SKILL.md:1069`、
  `docs/90-agent/reference/subagents.md:268`：刪掉「從環境區塊讀版本」和 `sonnet 5 ·` 範例。
- Workflow `agent()` 的 `label` 沒有 hook 能補：規則改成只寫別名和 effort，不寫版本。

## 4. station 顯示實際跑的模型和 effort

- `lib/usage.js` 的 subagent 列（今天取 meta 的 `model` 別名）加上該 agent transcript 最後一筆
  assistant 的 `message.model` 與 `effort`。
- station 的 subagent 列，模型 chip 顯示 `sonnet 5.5`（用第 1 節同一個解析規則），旁邊加 effort；
  transcript 還沒寫任何一筆時退回 meta 的別名。

## 5. effort 預設值定案，臨時覆寫另開

- `docs/90-agent/reference/model-choice.md` 的 (c) 記為定案：依官方文件，Sonnet 5.5 與 Opus 5.5
  預設 medium，agent 檔的 `effort:` 維持現狀。
- TODO `model-1` 拿掉 (c)；`station-3` 改寫成新的一筆：臨時拉高 effort 要產生到 `.claude/agents/`
  的覆寫檔，先實測它能不能蓋過 `fankeel:` 的 agent。

## 驗收

- `tests/title.test.js`：固定 agent 檔 + 假 transcript → 前綴正確；沒有 transcript → 只寫別名；
  `tool_input.model` 蓋過 frontmatter；`claude-haiku-5-5` 不改程式就解析成 `haiku 5.5`；
  既有前綴被剝掉重算。每條配一個會紅的變異。
- 產出物：真派一個 `fankeel:fankeel-reader`、一個 `general-purpose`，各自 `meta.json` 的 description
  前綴要等於同一個 agent transcript 的 `message.model` 解析結果與 `effort`。
- `npm test`、`docs-check` 全綠；發版 0.84.0，發之前 promo30 的 session 要已收工。

## 未驗證

- `updatedInput` 不帶 `permissionDecision` 時是否仍然生效。帶 `allow` 會跳過 Agent 的權限確認，
  所以 build 先用 probe 量不帶的版本；不生效才帶 `allow`，並寫明理由。
- 互動畫面上那一行 Agent 呼叫顯示哪一個 description。
