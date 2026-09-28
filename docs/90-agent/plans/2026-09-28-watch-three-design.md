---
status: design-intent
---

# Watch 三條提前做 — design

2026-09-28。survey 把 TODO.md `## Watch` 的十條分成三類；使用者選了拆開：這個 task
做三條不必等事件的小工作，worktree 隔離另開 architectural task。

## 1. 放行規則探測

- 用 headless 兩組對照量 `Edit(/.fankeel/build/**)` 有沒有被讀到：A 組帶 `.claude/settings.local.json`（`--setting-sources project,local`），B 組不帶（`--setting-sources project`），每組讓一個 sonnet subagent 往 `.fankeel/build/probe-<n>/` Write 一個檔，各跑 5 次，兩組交替。
- 結果以 `modelUsage` 與 transcript 裡的 permission 結果為準，不用 `duration_ms`。
- 兩組都全成功時，結論寫成「本機現在重現不出 no verdict，規則效果仍無法證明」，不寫成「規則有效」。
- 結果寫成 `docs/90-agent/reports/2026-09-28-allow-rule-probe.md`，並改寫 `docs/90-agent/reference/subagents.md` 715 行那一段的最後一句狀態。

## 2. 本地判斷模型試跑

- `ollama pull moondream`，給它十張 station 截圖：五張正常、五張故意弄壞（CSS 不載入、版面重疊、空白頁），問「這畫面正常嗎」。弄壞的五張就是對照組。
- 記錄每張的答案、耗時，以及對照組抓到幾張。
- UI-TARS 只試能不能在本機跑起來、回一次動作；跑不起來就照實寫，不追。
- 結果寫成 `docs/90-agent/reports/2026-09-28-local-judge-trial.md`；TODO 的 Watch 條目依結果改寫或移除。

## 3. guard 測試的 deadPid

- `tests/guard.test.js` 的 `deadPid()` 改成：取得 pid 之後用 `process.kill(pid, 0)` 確認已經不存在；還活著就重取，最多 20 次，超過就丟錯。
- 另外加一個測試：餵一個第一個候選就是活 pid（`process.pid`）的產生器，斷言 helper 會跳過它。這條在舊寫法下會紅。

## 4. TODO.md

- 移除 `### 下一個前端任務` 與它的條目。
- `### implementer 互相蓋檔` 的條目移到 `## Needs a decision`，拿掉 `###` 與 `if:`。
- 第 1、2、3 條做完的 Watch 條目，由交付該條的 task 一起移除或改寫。
- 另外五條（語言、平台、wizard-motion、五個 task 以上、graphify）不動。
