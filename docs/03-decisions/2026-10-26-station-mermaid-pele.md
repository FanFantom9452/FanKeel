---
status: decision
last_verified: 2026-10-26
---

# station 用 pele 畫 Mermaid，Chartroom 留給任務的板（10-26）

一句話：文件閱讀框與 gate 頁裡的 ```` ```mermaid ```` 圍欄，由 vendored 的 pele 1.10.0（`assets/station/vendor/pele.js`）在瀏覽器畫成可拖拉、縮放的圖，gate 上還能點 node 標記、寫進答案框；Chartroom 不取代 Mermaid，只繼續畫任務的 `.board`。

判斷記錄在 [../90-agent/judgements/2026-10-25-mermaid-renderers-vs-chartroom.md](../90-agent/judgements/2026-10-25-mermaid-renderers-vs-chartroom.md)。

## 決定

- station 加一個共用模組 `assets/station/diagram.js`（`FK_DIAGRAM`）：`docs-page.js` 與 gate 頁遇到 mermaid 圍欄就交給它畫；畫不出來的圖退回原始碼並標出錯誤行，不擋住其他圖。
- pele 以版本加 sha256 釘住、檔案提交進 repo，沒有 build、沒有 dependency，由 `/station/vendor/pele.js` 提供。
- gate 上點 node 會把「標記：<id>「<label>」、…」寫進答案框；`gate.station` 開著（本專案 300 秒）時，按選項就直接把該選項當答案送出。
- [監控站掛 Chartroom 白板（10-07）](2026-10-07-station-chartroom.md) 說白板要取代 Mermaid，這一條方向反過來：人讀的文件與 gate 照舊寫 Mermaid，station 負責畫。

## 為什麼

使用者要的是：gate 留下的文件能用 Mermaid 解釋框架關係，在 station 上直接看到圖、能拖拉縮放，回答時能標記 node。Mermaid 是 AI 本來就會寫、GitHub 也會畫的格式，Chartroom 的 `.board` 兩者都不是。2026-10-25 的判斷原本選「不變」，留了一個翻盤條件——station 的文件頁必須畫 Mermaid——使用者在 survey gate 上正好說了這一點。pele 零依賴、同步回傳 SVG、自帶縮放平移，符合 station 留 vanilla 的決定（[2026-10-24](2026-10-24-station-vanilla-modules.md)）。

## 放棄了什麼

- 官方 mermaid.js：要載入大量依賴、非同步，與 station 無 build 的做法不合。
- 讓 Chartroom 取代 Mermaid：AI 與人得改寫另一種格式，GitHub 上也看不到。
- 真瀏覽器驗證還沒做：圖的行為只在假 DOM 上測過，標記→送出→`hooks/gate.js` 從沒在真 gate 上跑過，記在 TODO「station 圖需要真瀏覽器驗證」。
- pele 是 705KB 的壓縮檔，只能靠版本與 sha256 信任；標籤含 `<img onerror>` 這類輸入沒實際探測過。
