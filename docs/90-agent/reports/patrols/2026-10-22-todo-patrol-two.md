---
status: decision
last_verified: 2026-10-22
---

# TODO 全表盤點（10-22 第二次）：四條結案，五頁看了兩頁定稿

一句話：34 條全部給了處置，station 兩個小尾巴收掉，每個 export 都被 import 的檢查進了快速測試並認得 vm 載入，使用者逐頁看 mockup，四條結案、七條新開。

任務紀錄在 [2026-10 月紀錄](../../records/2026-10.md)。計畫封存在 `docs/99-archive/2026-10-22-patrol-two.md`。

## 做了什麼

- 「station 文件長句與過時測試名」結案：使用者指南三句超過 160 欄的長句拆開，Pane 測試名改成描述計數鈕（afbfdc29）；station-serve 那個偶發失敗查不出原因，斷言訊息改成會說出是沒 join 上還是 roots.json 沒寫到，另開 Watch 盯著（a1c23d33）。
- 「source.test 認得 vm 載入」結案：使用者在 survey 關卡選了兩個都做。檢查改成整棵樹只建一次 import 索引，從約 16 秒降到約 0.2 秒，拿掉 `@slow` 進快速測試；用 vm 沙箱載入的檔也算被 import（2cadb776）。
- 「station 改版剩下的頁」結案：session 頁的關卡連結與派工小點，實作早已改好，這輪只把 mockup 對齊。使用者逐頁看了五頁，plan 關卡頁與花費頁定稿，文件、設定、手機三頁開成 Ready 由使用者之後逐頁調（a600d646）。專案頁標「需新收資料」的四項，使用者在 plan 關卡決定都不收，已從 mockup 拿掉。
- 「兩組循序派工實跑一次」結案：三個真實 task 的 build 交接檔編號都連續遞增，沒有撞名，不必改碼。
- 使用者在 plan 站回報 gate 頁每 5 秒重畫、摺疊點不開，記成 Ready 條目（92b7f373）。

## 沒做什麼

- 新的 vm 對照測試有一條斷言永遠不會失敗，vm 讀法也把測試檔裡任何 `.name` 都算成用到；build 收尾審查找到，使用者在 build 關卡選了先進 verify，記成 Ready 條目（c2d17e39）。verify 想用突變確認 vm 判斷有作用，派工被權限擋下，沒做成。
- verify 的快速測試 12 條紅：11 條是瀏覽器與 promo 測試（那次沒設 `FANKEEL_BROWSER`），1 條是另一個 station-serve 測試，單獨重跑即綠。land 用設了瀏覽器路徑的整套重跑。
- 「station 遠端的手機實測」使用者選擇留著等有空，維持 Needs a decision。
- 「各站交接改帶事實檔」使用者決定下一輪另開 architectural 任務。
- 這輪沒有升版。同一個 checkout 裡另一個 session 的 station 遠端功能直接 commit 在 main 上、還在 verify，此時升版會把它沒驗完的改動一起裝進外掛。
- 其餘 Blocked 與 Watch 的條件都還沒發生。
