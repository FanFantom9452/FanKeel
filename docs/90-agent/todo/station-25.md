---
label: station
title: 站上 gate 選項點下去要有回應
description: ASKING gate 的選項點下去沒有任何回應，實際上正在送出；要先 disable 並設逾時
state: ready
---

來源：使用者 2026-10-14 在站上頁面回答 ASKING gate 時提出，點下選項後畫面看起來沒有反應，但其實請求正在送出。

現況：assets/station/station.js:5030 的 [data-gop] 點擊處理（選項在 :2423 附近渲染成 .gc 內的 .gops）呼叫 gatePost（:5571）；:5580 以 fetch('answer', {method:'POST'}) 送到 scripts/station.js:623 的 /answer，該處在 :665 呼叫 handoff.writeAnswer 並回 answered N question(s)。gatePost 不會 disable 或標示按鈕處理中，也沒有 AbortController 或逾時，只在回應回來或網路錯誤時才寫 .gend（5582-5587，「送不出去：serve 還在跑嗎？」）。同檔 5055-5067 的整表單「送出答案」處理有同樣缺口。現有唯一的逾時是伺服端 gate 倒數（data-until、tickGates :5591）與 hook 的 gate.station 等待（.fankeel/profile.json 內 60 秒）。

要改成：點下去時，該 gate 內每個 .gop 與「送出答案」按鈕都 disable，並在 .gend 顯示處理中狀態（例如「送出中…」）。以 AbortController 設逾時（建議 10 秒，遠小於 gate.station 的 60 秒）。逾時或錯誤時重新啟用按鈕，並在 .gend 說明尚未確認送達、可以再按一次。成功時維持 disabled。選項點擊與整表單兩條路徑都要套用。

完成的標準：tests/ 下有測試涵蓋送出期間 disabled、逾時後重新啟用、錯誤後重新啟用，並實際打開真的站上頁面看過。
