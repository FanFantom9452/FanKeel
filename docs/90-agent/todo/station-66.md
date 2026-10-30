---
label: station
title: 手機 gate 頁不顯示任務圖
description: 手機 /m 的 gate 頁沒有 mermaid 圖，無法從手機標記節點
state: done
link: lib/mobile.js
done:
  at: 2026-10-30
  sha: 538b9c3b
  disposition: done
  session: f32cbb68-198e-4410-9efc-b4cd7088988d
---

來源：2026-10-30 TODO 巡視時，使用者在手機看 station /m 的截圖，說「留到Todo」。現況：lib/mobile.js:286-293 讓 /m 只載入 station.css、mobile.css、mobile.js，沒有 diagram.js / gate-frame.js；mobile.js 用自己的 prose() 畫報告並有摺疊按鈕（mobile.js:761），完全沒有 mermaid。所以在手機上無法標記節點，「station 圖需要真瀏覽器驗證」那條的第二步也依賴這點。目標：手機 gate 頁要顯示報告裡的 mermaid 任務圖，點節點會把「標記：」那一行加進回答。完成標準：手機 gate 顯示 mermaid 圖，點節點後答案欄出現標記行，並有測試證明。

## 完成紀錄

手機 gate 頁不顯示任務圖：phone.json 帶 diagrams，手機 gate 畫圖並可標記節點。詳見 [任務紀錄](docs/90-agent/records/2026-10.md#r-2026-10-30-f32cbb68)

- commit e73700e9
- commit 538b9c3b
