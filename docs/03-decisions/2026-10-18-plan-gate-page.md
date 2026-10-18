---
status: decision
last_verified: 2026-10-18
---

# plan gate 附 station 計畫頁（10-18）

一句話：停在 plan gate 時，`scripts/await.js` 在 station 開著的情況下多印一行 `page: <url>#/s/<id>/plan`，controller 先把它開在瀏覽器 pane 裡再問 gate；session 頁多一個「計畫」tab，把 plan 的派工組畫成一欄欄任務卡，每張卡寫出它要等哪幾個前面的 task、為什麼。

這是「gate 附 station 頁」的第一刀。設計與計畫在 [2026-10-18-plan-gate-page-design.md](../99-archive/2026-10-18-plan-gate-page-design.md) 與 [2026-10-18-plan-gate-page.md](../99-archive/2026-10-18-plan-gate-page.md)。

## 決定

- 視覺化交給 station，不讓 agent 每次從頭寫 HTML：使用者留在 Claude Desktop 回答，看東西到 station 頁。
- 依賴關係只有一個來源：`lib/plantasks.js` 的 `conflict` 擋下哪一對，卡片上就有哪一條「等」線，`lib/detail.js` 的 `waitsOf` 只負責說出共用的是哪個檔或哪個名稱。
- 邊不畫成線。真的 plan 一份可以有幾十條邊，改成每張卡列出等誰，滑鼠移上去或聚焦時把相關的卡標亮，Esc 清掉。
- plan 從專案 `docs.json` 的 `role: plan` bucket 找，沒有 bucket 時才退回 `docs/plans/`，跟 `lib/render.js` 一樣。
- 回答仍在 Desktop。station 的 gate 持有（`gate.station`）是「先在 station 等 N 秒，逾時再交給 Desktop」，做不到兩邊同時等、先答先贏。
- 渲染器自己寫，不採用 answer-me-with-html。

## 為什麼

使用者在 plan gate 被問「要不要照這 N 個 task 進 build」時，看不到那 N 個 task 是什麼，要等進了 build 看 pane 才知道。把 plan 攤在 station 頁上，回答前就看得到。

## 放棄了什麼

- Desktop 與 station 同時作答、先答先贏：`hooks/gate.js` 的持有是 PreToolUse 同步等待，AskUserQuestion 顯示之後沒有辦法從外部收回它。
- 用線畫出依賴圖：邊太密，畫出來看不懂。
- 引入 answer-me-with-html 的 DSL：看過效果，使用者決定自己寫。
- 這一刀不做其他四道 gate 的頁、結案頁和白話版、retro。

## 還沒驗的

- 在 Claude Desktop 裡，controller 在問題之前開的 pane 會出現在問題前面還是後面，這次沒有在真的 plan gate 上看到。
- station 的 `body { min-width: 1000px }` 讓約 800px 寬的 pane 要左右捲動，這次沒改。
