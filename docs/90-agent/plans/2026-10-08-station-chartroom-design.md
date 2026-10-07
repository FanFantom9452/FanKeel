---
status: design-intent
last_verified: 2026-10-08
---

# 監控站在 /chartroom/<專案>/ 開架構白板

session ddb6de22-2417-4ca8-841e-e83e171bd823 的 design，來源是 TODO「監控站掛 Chartroom？」（docs/90-agent/todo/station-15.md）。這頁是要做的事，不是現狀。

一句話：監控站的 handler 在 nonce 檢查之前，把 `/chartroom/<專案>/` 開頭的請求剝掉前綴，交給該專案懶建的 Chartroom `createHandler`；Chartroom 從機器 profile 的 `station.chartroom` 指到的安裝路徑載入，用它自己的 `dist/app`，板子固定在 `<專案>/.fankeel/architecture.board`。

為什麼是這樣：spike（Chartroom/.fankeel/build/spike/mount.cjs）已經用同一種寫法、在 CommonJS 裡以 `require(esm)` 載入 `createHandler` 並剝前綴轉交，9 項全過，監控站自己的路由和 404 不受影響。剩下的只有 TODO 要求的三筆裁定，與監控站怎麼找到 Chartroom、怎麼讓人點得到。

## 1. 三筆裁定

- 板子位置：每個專案一塊，固定在 `<專案根>/.fankeel/architecture.board`，跟 `.fankeel/profile.json` 一樣提交進該專案的 git。沒有這個檔的專案不開白板：連結不出現，路由回 404 並說出應該放在哪個路徑。監控站不替人建檔，因為在 GET 上寫檔是副作用。
- nonce 的例外：`/chartroom/` 底下的請求不走監控站的 `formOf()` nonce 檢查，改由 Chartroom 自己的防護負責——它先擋非 loopback 的 Host（防 DNS rebinding），POST 再擋 Origin 對不上 Host 的請求與非 `application/json` 的寫入（handler.js:131、:200）。跨站網頁送不出不經 preflight 的 JSON POST，所以這套防護擋得住 nonce 要擋的那件事；而 AI 用 CLI 或 curl 送 `POST /api/ops` 時手上本來就沒有 nonce。例外寫在 scripts/station.js 轉交處的註解裡，參考頁同步改。
- dist 的來源：引用 Chartroom 安裝路徑底下它自己 build 出的 `dist/app`，fankeel 不帶進來、也不新增 build 步驟。`createHandler` 本來就以 Chartroom 的套件根解析 `staticDir`（handler.js:10、:100），所以只要找到 Chartroom 的根就好；`dist/app` 不存在時，Chartroom 自己回 404「先跑 npm run build」。

## 2. 監控站怎麼找到 Chartroom

- lib/profile.js 新增一個自由文字鍵 `station.chartroom`：Chartroom 套件根的絕對路徑，放在機器 profile（`<configDir>/fankeel/profile.json`），因為安裝位置是這台機器的事，不是某個專案的事。例：`node scripts/task.js profile set station.chartroom F:/ymlab/Latex/production/Chartroom --default`。
- 沒設這個鍵時一切照舊：`/chartroom/` 一律走監控站原本的 404，頁面上不出現白板連結。
- 設了但 `<根>/src/server/handler.js` 載入失敗時，路由回 500 並說出路徑與錯誤，不讓整個監控站掛掉。

## 3. 路由與生命週期

- `/chartroom/<專案>/…` 的 `<專案>` 是註冊根目錄的資料夾名稱（basename）。兩個根同名時回 409，列出兩個路徑，不猜。
- 每個專案的 `createHandler` 在第一次請求時才建，存在一個以根路徑為鍵的 Map；監控站 `close()` 時對每一個呼叫 `close()`。
- 轉交放在 handler 裡 `formOf` 之前、任何 POST 處理之前，`req.url` 剝掉 `/chartroom/<專案>` 後交出去，空字串補成 `/`。

## 4. 頁面上的入口

- lib/station.js 收集專案時多帶一個 `board` 布林值（`.fankeel/architecture.board` 存在與否），`serialize()` 一併送出。
- assets/station/station.js 的專案頁卡片（`registryNote`）在 `board` 為真且機器 profile 設了 `station.chartroom` 時，多一行「架構白板：開啟」，連到 `/chartroom/<專案>/`，在新分頁開。

## 5. 文件

- docs/90-agent/reference/station.md 在 `serve` 那段寫明 `/chartroom/` 路由、它不驗 nonce 的理由，以及 `station.chartroom` 鍵。
- 交付的那個任務刪掉 docs/90-agent/todo/station-15.md 這則 TODO。

## 6. 怎樣算完成

- 新測試 tests/station-chartroom.test.js 現在失敗、完成後通過。它用一個假的 Chartroom 套件（暫存目錄裡的 `src/server/handler.js`，ESM，`createHandler` 回一個會記下 `req.url` 與 `close()` 次數的 handler），驗證：剝前綴後轉交；不帶 nonce 的 POST 抵達假 handler；未知專案與鍵未設都是 404；同名專案 409；監控站 `close()` 讓每個建過的 handler 各 `close()` 一次。
- 產物那一行：渲染出來的專案頁上那條白板連結，其 href 用 GET 打回監控站要得到 200 且內容含 `<div id="app"`——連結與它指向的頁面出自同一個根目錄，兩者要對得上。這一行要真的 Chartroom 與 build 好的 `dist/app`，機器上沒有時 verify 要明說跳過。

## 不做的事

不替專案建板子、不在監控站裡加 build 步驟、不把 Chartroom 列進 fankeel 的依賴、不統一兩套 POST 防護的程式碼。發光與變更卡是 Chartroom 現有的行為，這裡只負責把它的頁面與 SSE 原樣轉交。
