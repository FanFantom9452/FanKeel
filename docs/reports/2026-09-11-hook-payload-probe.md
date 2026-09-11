---
status: current
last_verified: 2026-09-11
source_of_truth: 本頁是一次量測的記錄，不隨程式碼更新；機制以 hooks/size.js 與
  hooks/guard.js 為準
---

# hook payload 帶不帶 `tool_response` 與 `agent_type` — 2026-09-11 的量測

第 6 節的 `hooks/size.js`（大輸出提醒）要讀 PostToolUse 的 `tool_response`，第 10 節的
`hooks/guard.js` Bash|PowerShell matcher 要讀 subagent 內的 `agent_type`——官方 hooks
文件都提到，但本機從沒實際觀察過。這一頁是那次觀察，跑一次就不再更新。

## 方法

一支一次性 hook（不進 repo）掛在 PostToolUse 與 PreToolUse，兩邊都不設 matcher，把每次
觸發的事件名、工具名、payload 最上層的鍵，以及 `agent_id`／`agent_type`（有才印）各
append 一行 JSON。一次 headless `claude -p` turn（Claude Code 2.1.268——那個 session 自己的 transcript 有 22 行帶
`version` 欄，全部是這個值）：主 session 跑一句
Bash，再派一個 `subagent_type: fankeel-reader` 的 Agent，讓它自己也跑一個工具呼叫。

指令多帶了四個 plan 沒寫的旗標，理由各記在 build 的 ledger 裡：`--model sonnet`（探測只看
payload 的鍵）、`--setting-sources project`（不讓已安裝的 fankeel 0.62.0 與 caveman 跟
`--plugin-dir` 那份一起載入）、`--allowedTools "Bash(echo probe-bash)"`（headless 不給
權限就拒絕 Bash，那一句就不會觸發 PostToolUse）、`--output-format json`（花費照原樣貼）。

`probe-log.jsonl` 全部六行，照原樣抄錄：

```text
{"event":"PreToolUse","tool":"Bash","keys":["cwd","effort","hook_event_name","permission_mode","prompt_id","session_id","tool_input","tool_name","tool_use_id","transcript_path"]}
{"event":"PreToolUse","tool":"Agent","keys":["cwd","effort","hook_event_name","permission_mode","prompt_id","session_id","tool_input","tool_name","tool_use_id","transcript_path"]}
{"event":"PostToolUse","tool":"Agent","keys":["cwd","duration_ms","effort","hook_event_name","permission_mode","prompt_id","session_id","tool_input","tool_name","tool_response","tool_use_id","transcript_path"]}
{"event":"PostToolUse","tool":"Bash","keys":["cwd","duration_ms","effort","hook_event_name","permission_mode","prompt_id","session_id","tool_input","tool_name","tool_response","tool_use_id","transcript_path"]}
{"event":"PreToolUse","tool":"Read","keys":["agent_id","agent_type","cwd","effort","hook_event_name","permission_mode","prompt_id","session_id","tool_input","tool_name","tool_use_id","transcript_path"],"agent_id":"ac6eaa5dd76c964ae","agent_type":"fankeel:fankeel-reader"}
{"event":"PostToolUse","tool":"Read","keys":["agent_id","agent_type","cwd","duration_ms","effort","hook_event_name","permission_mode","prompt_id","session_id","tool_input","tool_name","tool_response","tool_use_id","transcript_path"],"agent_id":"ac6eaa5dd76c964ae","agent_type":"fankeel:fankeel-reader"}
```

那次 turn 的 `--output-format json` 輸出裡：`is_error` false，`permission_denials` 是空陣列，
`modelUsage` 的鍵是 `claude-haiku-4-5-20251001` 與 `claude-sonnet-5`，`total_cost_usd` 是
`0.10801419999999999`。

## 這一次定下來的

| 欄位 | 結果 |
|---|---|
| `tool_response`（主 session 自己的 `Bash` 呼叫，`PostToolUse`，無 `agent_id`） | PRESENT |
| `agent_type`（`agent_id` 有值的那幾行） | PRESENT，值是 `fankeel:fankeel-reader` |

兩件連帶看到的事：`tool_response` 在主 session 的 `Agent` 與 subagent 內的 `Read` 的
`PostToolUse` 也有；`agent_type` 帶外掛前綴，不是裸名 `fankeel-reader`。

## 這一次沒有定下來的

- 只跑了一次，兩個欄位都沒有重跑驗證是否穩定。
- `tool_response` 的形狀沒有看，只看了它在不在；`hooks/size.js` 要從裡面量字元數，讀法
  以那支 hook 的測試為準。
- 沒有觸發 `PowerShell` 工具；`hooks/guard.js` 的 `Bash|PowerShell` matcher 在 PowerShell
  那一半的 payload 沒有被觀察到。
- `--setting-sources project` 之下只載入了一份 fankeel；使用者設定裡的外掛也載入時，
  `agent_type` 的前綴會不會不同沒有量。

## 出處

- 探測腳本與 settings 檔：`.fankeel/build/2026-09-11-backlog-all/hook-probe/`（gitignored，
  不在這個 repository 的版本控制裡）。
- session id `629a7c60-c654-48d9-8529-875386686e52`；`claude -p` 的完整 JSON 輸出同樣只在
  上面那個目錄，上面的表格是從 `probe-log.jsonl` 抄錄的結論。
