---
label: station
title: 刪 nav.js 的舊 live 死碼
description: 第四份計畫把十個只剩測試與匯出在用的舊 live 函式照搬進 nav.js，之後要連同它們的匯出、轉發和只測它們的斷言一起刪掉
state: blocked
link: assets/station/station.js
group: station 外殼拆完
timing: after: 第四份 station-shell 計畫的 Task 2 把左欄搬進 nav.js
stamp: 2026-10-29
---

來源：station-52 的計畫階段（2026-10-28）。docs/90-agent/plans/2026-10-28-station-shell-4.md 的 Task 2 把左欄搬進 nav.js，同時照搬 liveRail、saFamily、saShort、liveSubsHtml、liveLane、liveGate、liveRun、liveMaybe、liveIdle、nowHtml。這十個函式沒有執行期的呼叫者，只剩測試與 module.exports 在用。當時不刪，是因為刪它們要改 station.js 的 module.exports，超出那個任務能改的行號範圍；計畫說好在 land 記成 TODO。

應該變成：這十個函式從 nav.js 刪掉，station.js 裡它們的一行轉發和 module.exports 項目一起拿掉，只測它們的斷言（station-live-head、station-live-maybe、station-view、station-waiting 等測試裡的）刪除或改測仍在用的函式，連帶沒人讀的 i18n 鍵與 css 規則也清掉。做法照 chart.js 那次（adb7a8d0、b3e4b0ab）。

完成的標準：grep 這十個名字在 assets/、lib/、scripts/、tests/ 都找不到；npm test 全綠；docs-check 沒有新的失效引用。
