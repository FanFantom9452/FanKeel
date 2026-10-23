---
status: decision
last_verified: 2026-10-24
---

# station 留 vanilla，拆成 classic script 模組（10-24）

一句話：station 的前端維持手寫的 classic script 加 `window.FK_*` 全域、零依賴、無 build；`station.js` 要拆成只管路由、draw/diff、輪詢、事件與 loc/esc 的外殼，其餘畫面各成一個模組，模組清單只寫在 `assets/station/index.html` 一處。

判斷記錄在 [../90-agent/judgements/2026-10-23-station-skeleton-stack.md](../90-agent/judgements/2026-10-23-station-skeleton-stack.md)（Q2），第一段的計畫在 [../90-agent/plans/2026-10-24-station-modules-skeleton-tune.md](../90-agent/plans/2026-10-24-station-modules-skeleton-tune.md)。

## 決定

- 每個畫面是一個 classic script，沿用既有模組的 CJS guard：瀏覽器裡掛在 `window.FK_*`，node 測試 `require` 同一個檔。
- `VIEWS.*` 全部只走模組，`OLD.*` 後備拿掉；只有後備在畫的舊儀表板、舊專案頁與舊 TODO 面板刪掉，不搬。
- `index.html` 是唯一手寫的模組清單；`lib/station.js` 的 `MODULES` 與 `scripts/station.js` 的 `STATIC` 從它讀出，`tests/station-module-lists.test.js` 斷言三者一致。
- vm 測試經 `tests/station-src.js` 依 `index.html` 的順序載入全部腳本，跟瀏覽器看到的一樣。
- 其餘畫面（文件、設定、天數、列表、focus 頁、詳情面板與派工）一段一段搬成模組，直到 `station.js` 約 1,500 行；每一段一份計畫。

## 為什麼

伺服器是 `node:http`、零依賴、無 build（`scripts/station.js`、`package.json`），使用者要的「本地快速啟動」已經是這樣。55 個測試用 `node:vm` 在假 `window` 上跑 classic script，42 個測試 `require` 同一個檔，`station.js serve` 停掉時頁面還能用 file:// 打開；ESM 在 vm 與 file:// 都會壞，框架要 build 或 CDN。頁面每 3 秒從 `window.STATION` 整頁重畫，沒有逐鍵的響應式需求，框架換不到東西。真正的問題是 7,003 行的單一檔，拆模組就解決。

## 放棄了什麼

- ESM（`type="module"`）：vm 測試與 file:// 形式都會壞。
- Preact／htm、Lit、Svelte 之類的框架：要引入依賴或 build，換來的響應式更新這個頁面用不到。
- 三份各自手寫的模組清單：每加一個模組要改三處，漏一處就是 404 或寫出的頁少一個檔。
- 把舊後備畫面也搬成模組：瀏覽器裡已經沒有路由會畫它們，搬過去只是把死碼換個地方放。
