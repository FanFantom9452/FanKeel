---
label: station
title: 修改手機版（/m）的設計
description: 使用者想修改站台手機頁（/m）的設計，具體要改什麼尚待與使用者決定。
state: decision
link: assets/station/mobile.js
---

來源：使用者於 2026-10-25 的 TODO 盤點期間提出「幫我新增一個 TODO 不要放在這次任務，我希望可以修改 MOBILE 設計部分」，所以刻意不併入當次任務。先前的 station-40「手機版待調整」已於 2026-10-22 完成（4d9ccc55），這是新的一輪修改，不是它的延續。要變成什麼：一版修訂後的站台手機頁設計，程式在 assets/station/mobile.js，樣式在 assets/station/mobile.css，網址為 /m。具體要改哪些地方使用者尚未說明，需先與使用者確認，建議走設計階段並先做 mockup 讓使用者挑選。2026-10-25 補充：使用者要求做這筆時先參考 https://github.com/FanFantom9452/VoiceLedger 的做法，並回答「為什麼這邊不能用 PWA、真的像 APP 那樣的設計」。注意 /m 其實已經有 PWA 的基本件：lib/mobile.js 的 manifest() 宣告 display: standalone，scripts/station.js 提供 /m/manifest.webmanifest 與 /sw.js，assets/station/mobile.js 註冊 service worker。所以要查的是落差在哪：安裝來源（http://127.0.0.1 無法安裝，Tailscale 的 https 網址才行）、iOS 需要的 apple-mobile-web-app 標記與圖示、以及版面本身像不像 app（底部導覽、全螢幕、safe-area），再拿 VoiceLedger 的 manifest、service worker 與版面逐項比對。完成的標準：使用者確認的修改項目都已落在 mobile.js 與 mobile.css，/m 頁面在手機尺寸下實際看過，且測試通過、已發版。
