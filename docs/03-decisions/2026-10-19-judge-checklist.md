---
status: decision
last_verified: 2026-10-19
---

# 判官先列清單、讀者一次派出（10-19）

一句話：`fankeel-judge` 不再自己讀檔，也不再只把超過 300 行的檔交給讀者；它先列出要查的每一行（`checklist:`），把讀者一次派出——每則回應最多四位，相關的檔交給同一位——讀完寫一段 `## Summary` 長文，目標三輪收尾。

設計與計畫在 [2026-10-18-judge-checklist.md](../99-archive/2026-10-18-judge-checklist.md)；它取代了先前「超過 300 行派讀者」的 [2026-10-18-judge-readers.md](../99-archive/2026-10-18-judge-readers.md)。量測在 [reports/2026-10-18-judge-checklist.md](../90-agent/reports/2026-10-18-judge-checklist.md)。

## 決定

- 判官第一輪只列清單、派讀者；第二輪抽查每位讀者一處；第三輪寫判斷。三輪是目標，不是硬上限。
- 讀者用 `fankeel:fankeel-reader`，模型是 sonnet 或 opus，由判官依那一行要不要推理決定。
- 一則回應最多四位讀者，跟 `hooks/dispatch-gate.js` 的 `dispatch.inflight`（預設四）一致；相關的檔給同一位讀者，不留到下一輪。
- 判官的簡報略過兩條回傳規則：「最後一則訊息只放發現」（它的 Summary 本來就長）與「不准派 subagent」（它要派讀者）。
- 回傳六欄加 `checklist:`，長度放在 `## Summary`，六欄不灌水。

## 為什麼

使用者要的是架構級的問題一次讀齊：判官逐檔自己讀或逐輪補派讀者，輪數多、主控等得久。先列清單再一次派出，把輪數壓到三輪，成本暫不考慮。

## 放棄了什麼

- 300 行門檻：在 379 行的檔上，判官本身 token 反升 55%，讀者還另外花錢，門檻划不來。
- 用 Workflow 一次派齊：subagent 沒有 Workflow 工具，只能在同一則回應放多個 Agent 呼叫。
- 一條清單一位讀者：會超過 dispatch-gate 的四位上限，第五位起要問使用者。
- 省錢：判官加讀者約是自己讀的 2.1 倍，這一輪照使用者的話不管成本。

## 還沒驗的

- 每種做法只量了一次，而且量的是 general-purpose agent，不是安裝後的判官。
- dispatch-gate 會不會攔到 subagent 自己的 Agent 呼叫，沒有實測。
- 量測時發現 `hooks/guard.js` 在父 session 沒有作用中紀錄時，會在唯讀檢查之前就放行；這不屬本任務，未處理。
