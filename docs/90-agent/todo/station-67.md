---
label: station
title: 手機對話送出的圖片顯示成路徑
description: 手機對話送圖後氣泡顯示 [圖片] 路徑文字而非縮圖
state: done
link: assets/station/mobile.js
done:
  at: 2026-10-30
  sha: 7ce2cdc0
  disposition: done
  session: f32cbb68-198e-4410-9efc-b4cd7088988d
---

來源：2026-10-30 TODO 巡視時，使用者在手機看 station /m 的截圖，說「留到Todo」。現況：mobile.js:1696-1710 的 say() 會送出「[圖片] <path>」行；mobile.js:752-766 的 bubble() 把使用者文字畫成 <p class="bub">esc(text)</p>，沒有圖片分支；mobile.css:102 的 .bub 有 overflow-wrap:anywhere，窄氣泡裡路徑每幾個字就斷行，很難看。尚未確認：station 有沒有路由能把 uploads/ 的檔案送回來。目標：上傳的圖片在氣泡中顯示成縮圖，不顯示路徑。完成標準：氣泡出現縮圖、看不到路徑文字，並有測試證明。

## 完成紀錄

手機對話送出的圖片顯示成路徑：改由 GET /phone/img 畫成縮圖，配對電腦走前綴。詳見 [任務紀錄](docs/90-agent/records/2026-10.md#r-2026-10-30-f32cbb68)

- commit 6a9eb6c4
- commit 7ce2cdc0
- commit b946fa8f
- commit fbde136e
- commit ad041627
