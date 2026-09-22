---
status: decision
last_verified: 2026-09-23
---

# 清 TODO：三個決定與 Ready 11 項落地 — 決策紀錄

design 見 [../archive/2026-09-22-todo-cleanup-design.md](../archive/2026-09-22-todo-cleanup-design.md)，
plan 見 [../archive/2026-09-22-todo-cleanup.md](../archive/2026-09-22-todo-cleanup.md)（已落地封存）。

## 一、定案

| 問題 | 定案 | 為什麼 |
|---|---|---|
| design.mockup 在受控 design 站怎麼辦 | `rulesFor` 濾掉這條規則，不補 implementer | `agentsFor('design')` 只有 reader 與 reviewer，沒有能寫頁的 agent；等真的有前端任務落在受控 design 下再補 |
| build/verify 十來個接縫現在修不修 | 先記錄不修，決定本身從 `## Needs a decision` 搬進 `## Waiting` | 都還沒真的發生過事故，比照專案既有「等一次事故再動手」的慣例 |
| lock 測試複測怎麼處理 | 放寬子行程持鎖時間，300ms 改 150ms | 證據指向並行負載下時序過緊而非 pid 重用——這把鎖只看 mtime，兩次紅掉的 commit 都沒碰到鎖碼或測試本身 |

## 二、落地範圍

Ready 11 項全部落地，含 survey 階段發現的兩處歪敘述：Ready#5 的連結指錯檔案（`scripts/spend.js` 沒有
`quotaLimits`，真正查過 `windows.js`／`roundings.js`／`basis.js` 後確認那個「13 筆定錨 100%」的方法從未
真的實作過），Ready#4 的歪引用其實是 4 條不是 3 條。13 個 build task 全部落地，全套 1774 個測試綠。

verify 階段用一個 Workflow（13 個 task 各一組 verifier→adversary，共 26 個 dispatch）逐條核對，adversary
抓到 8 組證據表本身的瑕疵，其中兩個是真的驗證缺口而不只是寫法問題：Task 3 的設計準則（lock 測試整套連跑
3 次不紅）從未真的用整套跑過，Task 6 的設計準則（渲染後人眼核對，不只是 unit test 綠）也沒被滿足——
兩者都在 verify 階段由這個 session 直接補上（整套跑 3 次、用 Playwright 對真實程式碼與真實 CSS 渲染
「依版本」圖例並截圖核對）。另外還在 verify 階段抓到一個跨 task 的回歸：Task 1 讓 `rulesFor` 在受控
design 站濾掉 `design.mockup` 規則，但 `tests/brief.test.js` 一個既有測試斷言看得到這條規則，只有跑
全套才會紅——Task 1 自己的審查只跑了 `tests/stages.test.js`。

audit 階段抓到一處文件沒跟上：`docs/subagents.md` 還寫著「session record 不存 `stage.agents`」，但
Task 9 已經讓它存了；三對文件的 pair-read（`collisions.md`×`subagents.md`、`registry.md`×`station.md`、
`registry.md`×`subagents.md`）找到這一處，其餘兩對確認一致。

## 三、沒做的

- build/verify 的十來個接縫（`AskUserQuestion`/`Edit` 缺口、插話會起第二個 brain、profile 中途翻轉、
  accounting、claims、commit 位置）都還沒修，記在 `TODO.md` 的 `## Waiting` → `### build/verify 接縫一次`，
  等其中一個真的發生再處理。
- `scripts/ctx.js` 的 `isAgentFile` 簡化（改用 `summarise` 是否為 null 判斷）查過後判斷不可行——會把混了
  主線與 sidechain 的檔案誤判成 agent 檔——維持現有實作；同一批的 `woken` fixture 也還沒補。
- 這次沒跑 audit 的程式碼半邊（三個 `fankeel-reviewer` 依 lens 過全樹找可刪的東西）：範圍跟這個窄任務不
  成比例，且 13 個 build task 各自的審查都已經做過自己那份 diff 的 Cuts 檢查，留給下一次獨立的
  `/fankeel-audit`。
