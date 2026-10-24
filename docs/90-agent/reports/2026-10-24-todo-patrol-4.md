---
status: decision
last_verified: 2026-10-24
---

# TODO 全表盤點第四輪（10-24）：做了什麼、沒做什麼

一句話：焦點頁搬成 `FK_FOCUS` 模組（`focus-page.js`），station.js 只留 `focusBoot`，舊焦點頁與 41 條 `focus.*` 字串刪掉；station.css 約 381 行 `.wz`、`.dsx` 死樣式刪掉；ZeroTier、WireGuard 與 Tailscale 的比較寫進遠端條目；gate 頁摺疊結案。

一份計畫：[2026-10-24-todo-patrol-4.md](../../99-archive/2026-10-24-todo-patrol-4.md)（5 個任務）。

## 盤點

Ready 4 條。使用者在盤點 gate 的決定：「station 留 vanilla、拆完模組」與「station.css 的死樣式」進計畫；「gate 頁重畫，摺疊點不開」確認已修好（fb23c781），在 land 結案；「設定頁待調整」這輪不做；「Tailscale 以外的遠端方案」繼續比較 VPN，只下結論。這輪新開條目「CSS 死碼掃描器」（55202f57）。

## 做了什麼

- 任務 1：`FK_FOCUS` 模組放在 station.js 的副本旁邊（f2e44aef）。
- 任務 2：station.js 只留 `focusBoot`，舊焦點頁與 41 條 `focus.*` 字串刪掉（bfa9b36d）。
- 任務 3：參考文件與 gate 框架的註解改指向 `focus-page.js`（659e30a4），引文修正（9df130df）。
- 任務 4：station.css 刪掉 381 行 `.wz`、`.dsx` 規則（6b5c7307）。
- 任務 5：ZeroTier、WireGuard 與 Tailscale 的比較接在遠端條目後面（d9dad1e6）。查證過的網頁事實：ZeroTier 免費 Personal 方案自 2026-08-04 起 10 台裝置、1 個網路；兩者都有官方 iOS／Android app；兩者都不替 station 提供 HTTPS；綁 0.0.0.0 會破壞 Host 檢查、Secure cookie 與 secure context 的假設。
- 收尾修補（383319ff）。

## 沒做什麼

- 只搬了焦點頁；days 與 list 因與圖表 tooltip 監聽、明細面板共用狀態而留在檔內。station.js 現為 5553 行，「station 留 vanilla、拆完模組」的 1,500 行目標仍未達成。
- 「設定頁待調整」維持 Ready。
- 遠端方案只有比較結論，沒有動手實作。

## 驗證

- 快速套件 5254 過 0 失敗；build 收尾時有一個 notify 測試不穩定地失敗過一次，重跑通過。
- 瀏覽器檢查：正在跑的 station 伺服器是 build 之前啟動的，送出舊 HTML（focus-page.js 404、頁面空白）；重啟後 /plan 與 /gate 都畫得出來，5 秒重畫後穩定，沒有新的 console 錯誤。
- 沒在瀏覽器檢查 gate 頁的摺疊：verify 階段沒有可摺疊的區塊會出現（13 個測試涵蓋）。
