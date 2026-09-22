---
status: current
---

# 站首頁：左側功能列、設定精靈與即時互動圖表

2026-09-23，session `41b7580b`。設計與計畫已封存：
`docs/archive/2026-09-23-station-home-design.md`、`docs/archive/2026-09-23-station-home.md`；
ledger 與所有證據在 `.fankeel/build/2026-09-23-station-home/`（不提交）。

## 定了什麼

- 首頁照 09-23 核可的 mockup 拆成左側功能列加六個 hash view：`#/` 現在、`#/days`、`#/sessions`、`#/projects`、`#/docs`、`#/settings`；清單與比較移進功能列。
- profile 只在 `#/settings` 的七步精靈設定：全部按鈕、沒有 `<select>`，profile 卡、三張 preset 卡、「套用機器預設」鈕與日細節面板都拿掉。寫入仍走 `POST /profile`，多一個只接受 `^#/[a-z]*$` 的 `back` 讓 303 回到設定頁。
- `design.skill` 的按鈕放在精靈第 3 步，只在 `design.mockup` 開著時出現。
- CSS 名稱不和既有規則撞：功能列用 `.sidenav`（`.rail` 是路線條），精靈的規則全部在 `.wz` 底下。

## build 中途加進來的

- 使用者要「專業互動儀表板」：近 30 天每一段可 hover，跟著滑鼠的資訊卡（`segTip`）、同模型高亮、參考線、圖例 hover 與點擊固定。參考的 lieflat-charts 其實也只用原生 `<title>`，卡片是這裡自己做的。成為計畫的 Task 5，逐塊調整順延為 Task 6。
- 逐塊調整第一例：列出三點觀察（精靈預設 scope、四個模型都是灰階、空 registry 卡），使用者判定都可以，未改；紀錄在 build 目錄的 `blocks.md`。

## build／verify 抓到的

- 整套跑出單檔測不到的紅：Task 2 讓 `station-shell` 與 `station-live-page` 紅三條（計畫漏列檔案，ruling 補進）；Task 5 讓 `station-live` 紅七條（`draw()` 每次都碰資訊卡，改成只在 hover 過才收）。
- 全分支審查抓到 3 秒重讀會留下舊內容的資訊卡；那次的修正改成直接隱藏。
- **verify 在瀏覽器裡量到的**：隱藏的修正讓游標停著不動時，卡片、高亮、參考線每 3 秒被清掉一次。1796 個單元測試全綠也看不到，因為 hover 在 `module.exports` guard 以下、沒有 DOM 測試。用 Playwright 對同一段 mousemove 後隔 3.5 秒再量，先紅後綠；修法是記住游標所在（`chartAt`），重讀後用新資料重畫（`chartRestore`、`chartPlace`）。
- 文件：`station.js` 每插一段，`docs/station.md` 的行號引用就移位，三次共 15 條，都由 `docs-check` 列出新行號後修正。

## 沒做的

- hover 互動仍沒有 DOM 測試；證據是 build 目錄的 `hover-evidence.md`。
- `blocks.md` 的三點觀察。
- 同一輪使用者提出、記進 `TODO.md` 的三條：資安審查、前端渲染審查、開發方法討論。
