---
status: decision
last_verified: 2026-10-07
---

# 監控站掛 Chartroom 白板（10-07）：方向與寫入規則

一句話：白板不是每個專案常駐的一塊板，而是 AI 有東西要給人看時才拿出來的溝通面，目標是取代 Mermaid 在 AI 與人溝通上的位置；Chartroom 整個併進 fankeel、裝好就能用；白板的寫入照監控站既有的 nonce 規則，不開例外。這頁記使用者在 2026-10-07 TODO 全表盤點 plan gate 上的回答；怎麼做另開 design。

## 背景

2026-10-06 的 spike（session 6247abb4）照 `scripts/station.js` 的寫法，用 CommonJS 的 require(esm) 載入 Chartroom 的 createHandler，剝掉 /chartroom 前綴再轉交，九項全過，監控站原本的路由與 404 不受影響。Chartroom 是只用 React 與 Vite 的白板，createHandler 一次只管一塊板（第一個參數就是 .board 檔的路徑）；它的 POST 擋 Origin 對不上 Host 的請求、只收 application/json，所有請求先過 loopback Host 清單，沒有 nonce。監控站的每個 POST 都要表單欄位 nonce 等於這次 serve 印出的值（`scripts/station.js`）。fankeel 沒有 build 步驟，也沒有任何 dependency。plan gate 原本問的是三件事：每個專案的白板檔放哪、寫入不帶 nonce 怎麼處理、建好的頁面從哪來。

## 1. 白板什麼時候出現

使用者的回答：「白板功能是必要才拿出來 或是 AI 要呈現甚麼之類的才拿出來 你去參考這個 https://github.com/QingYunA/answer-me-with-html.git 我希望白板專攻 取代 MERMAID 就是取代他和人類溝通的地位 同時做出一個讓人類更好閱讀 根據大架構更好繪製圖的設計」

所以「每個專案的白板檔放哪」這個問法不成立：白板跟著一次要給人看的內容出現，不是每個專案常駐一塊。它要取代的是 AI 現在用 Mermaid 畫給人看的那些圖，所以要比 Mermaid 好讀，也要能照大架構來畫。板檔放哪、什麼時候清掉，由下一份 design 參考 answer-me-with-html 的做法再定。

## 2. 寫入怎麼驗

使用者的回答：「你先看前一題目答案後決定」。

裁定：白板的寫入走監控站既有的規則——每個 POST 帶這次 serve 印出的 nonce——不為白板開例外。理由是第 3 項：Chartroom 併進 fankeel 之後，前端就是 fankeel 自己的程式碼，可以改成照監控站的方式送 nonce；原本考慮開例外，是因為前端在別的 repo、改不動。程式碼都在同一處，就沒有理由維持兩套防跨來源寫入的規矩。

## 3. 頁面從哪來

使用者的回答：「我希望整個合併到 FANKEEL 這邊可以直接用」。

裁定：Chartroom 的伺服器與頁面併進 fankeel，裝好 fankeel 就能用，不另裝 Chartroom、不引用它的安裝路徑。fankeel 現在沒有 build 步驟、沒有 dependency，Chartroom 卻用 React 與 Vite，所以「怎麼併進來還維持這兩點」——例如提交建好的頁面，或改寫成不需要 build 的版本——是下一份 design 第一個要回答的問題。

## 接下來

另開 design：先讀 answer-me-with-html 怎麼在需要時產生給人看的頁面，再定白板何時出現、板檔放哪、怎麼併進 fankeel。算完成的樣子：AI 要把架構或流程畫給人看時，用白板而不是 Mermaid，人在監控站裡打開就能看、能拖。

## 後續（10-26）

「白板取代 Mermaid」這個方向已由 [station 用 pele 畫 Mermaid（10-26）](2026-10-26-station-mermaid-pele.md) 反過來：station 照舊畫 Mermaid，Chartroom 只畫任務的板。
