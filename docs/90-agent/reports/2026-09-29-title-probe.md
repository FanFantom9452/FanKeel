---
status: current
last_verified: 2026-09-29
source_of_truth: 本頁是兩次量測的記錄，不隨程式碼更新；量測檔是 .fankeel/build/task-20260929T090942/probe/stream.jsonl 與 stream2.jsonl；機制以 hooks/title.js 為準
---

# PreToolUse 回傳的 updatedInput.description 會不會生效 — 2026-09-29 的量測

`hooks/title.js` 要在每次 Agent／Task 派工時，由 hook 把 `description` 改寫成帶前綴的字串，而不是讓模型自己寫。這一頁記錄的是：hook 只回 `updatedInput.description`，改寫有沒有被套用，以及回不回 `permissionDecision` 有沒有差別。

## 方法

Claude Code 2.1.284，兩次 headless `claude -p`，各掛一支一次性 PreToolUse（`Agent|Task`）hook，回傳 `updatedInput.description = 'REWRITTEN ' + original`。模型派工時寫的 `description` 是 `orig-title`。

- 第一次：hook 同時回 `permissionDecision: 'allow'`。
- 第二次：hook 不回 `permissionDecision`。

## 結果

兩次都一樣：

- 模型自己的 tool_use 保留原本的 `orig-title`。
- `background_tasks_changed`、`task_started`、工具結果、`agent-*.meta.json` 帶的都是 `REWRITTEN orig-title`。

所以不回 `permissionDecision` 也會套用改寫，`hooks/title.js` 因此不回 `permissionDecision`。

另外：每個 subagent transcript 的每一行都有頂層的 `"effort"` 欄位，站台可以從 subagent 自己的 transcript 讀到它實際的 effort。

## 沒量到的

- 各只跑一次，n=1，沒有重複。
- 互動模式下，transcript 那一列顯示的是原本的還是改寫後的標題，沒量。
- 只量了 2.1.284，別的版本沒跑。
