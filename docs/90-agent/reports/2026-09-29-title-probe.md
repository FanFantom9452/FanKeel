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

## Live

2026-09-29，`hooks/title.js` 在 `05f3a30a..425d4939` 之後的工作樹上，用使用者執行的一次 headless `claude -p --plugin-dir F:/ymlab/fankeel --setting-sources project` 派兩個 agent，description 只寫標題。session `b9df5b6f-069c-4940-a59c-9c1f6499c86c`。

| agent | 模型送出的 description | `meta.json` description | transcript `message.model` | transcript `effort` | agent 檔 `effort:` | 相符 |
|---|---|---|---|---|---|---|
| `fankeel:fankeel-reader` | `read the README` | `sonnet 5.5 · medium: read the README` | `claude-sonnet-5-5` | `medium` | `medium` | 是 |
| `general-purpose` | `count hooks` | `opus 5.5 · inherit: count hooks` | `claude-opus-5-5`（主 session 同） | `medium` | 無，寫 `inherit` | 是 |

`inherit` 那一列實際跑的 effort 是 `medium`，和主 session 各行的 `effort` 相同。互動畫面那一列仍沒量：這次是 headless，沒有畫面。

## `CLAUDE_CODE_SUBAGENT_MODEL` 和 agent 檔 `model:` 誰優先 — 2026-09-29 的量測

文件記載的順序是：呼叫時的 `model` > agent 檔的 `model:` > `CLAUDE_CODE_SUBAGENT_MODEL` > 主模型。這一節量的是中間兩者。

方法：Claude Code 2.1.284，一次 headless probe，環境變數設 `haiku`，派一個 `fankeel:fankeel-reader`（agent 檔釘 `model: sonnet`），派工時不帶 `model`：

```
CLAUDE_CODE_SUBAGENT_MODEL=haiku claude -p --output-format stream-json --verbose --max-budget-usd 1 --settings F:/ymlab/fankeel/.fankeel/build/task-20260929T090942/probe/settings.json --plugin-dir F:/ymlab/fankeel "Dispatch exactly one Agent with subagent_type fankeel:fankeel-reader and description 'say ok', ..."
```

結果：`stream.jsonl` 的 `modelUsage` 只有兩個模型，`claude-opus-5-5`（主 session）和 `claude-sonnet-5-5`（subagent），沒有 haiku。環境變數是 `haiku`、agent 檔是 `sonnet`，實際跑的是 `sonnet`，所以 agent 檔的 `model:` 勝過 `CLAUDE_CODE_SUBAGENT_MODEL`，和文件記載的順序一致，沒有矛盾。

證據：`F:/ymlab/fankeel/.fankeel/build/task-20260929T090942/probe2/stream.jsonl`（session `260c2b0a-f965-44ed-84c9-1ecff0b68758`）。

沒量到的：n=1；沒有量「呼叫時的 `model` 勝過 agent 檔」那一格；沒有單獨驗證 haiku 環境變數在沒有 agent 檔 `model:` 時會生效（那一格是文件記載，未量測）；只量了 2.1.284。
