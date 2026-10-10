---
status: decision
last_verified: 2026-10-07
---

# TODO 全表盤點（10-07）：定了什麼、沒做什麼

一句話：這一輪盤點把全套測試並行時的固定暫存路徑收掉、補上前後兩段用量比對、讓受控階段當場寫下被要求的 TODO，並留下 Pane 與 station 頁共用一道 gate 的草稿；brief-3、compact-2 的一項確認與並行測試的三次全綠條件沒有做。

計畫在 [2026-10-07-todo-patrol-seven.md](../../../99-archive/2026-10-07-todo-patrol-seven.md)。

## 做了什麼

- test-5：sensitive 與 render 兩組測試改用各自的暫存目錄。README 寫明一次只跑一套全套測試，因為並行時剩下的失敗都是受時間上限約束的測試，那些上限是產品預算，不放寬。
- spend-4：`scripts/usage-compare.js` 與 `lib/compare.js` 可以把兩段日期的用量依 session 逐一比對。
- compact-2：compact 的文件改寫成模組可用，判準是觸發方式為手動，加上 fankeel compact 的 log 行。
- station-13：拆掉兩個 shots-v3 的 junction，它們指向的目標沒有動。
- 受控階段的規則：被要求的 TODO 當回合就寫下。派 fankeel-reader 查有沒有重複，再派 implementer 寫入，全程守在 2400 字元的注入上限內。todo-5 仍開著，要等一次真實的受控階段證明分類器不會擋 `todo.js new` 才能結案。
- gate-7：寫了 Pane 與 station 頁共用一道 gate 的草稿。gate-7 仍開著，要等 design 被核准。
- 白板方向：決策頁已經寫好，見 [2026-10-07-station-chartroom.md](../../../03-decisions/2026-10-07-station-chartroom.md)。

## 沒做什麼

- brief-3（經 spawn 傳子代理 brief）沒有動。
- compact-2 裡「build 代理的報告在壓縮期間會不會送達」這項確認一直沒有做成。
- 並行測試的完成條件是三次同時全綠，這個條件沒有達成，改成寫進文件說明。

## 為什麼

- 並行失敗的來源有兩類：固定暫存路徑互踩，與受時間上限約束的測試。前者可以修，後者的上限是產品預算，放寬它等於改產品，所以只在 README 說明。
- todo-5、gate-7 與 brief-3 都缺一個本輪無法取得的證明或核准，所以保持開著，不當作做完。
