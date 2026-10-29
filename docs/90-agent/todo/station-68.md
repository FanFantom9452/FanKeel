---
label: station
title: 手機對話送出後輸入框不清空
description: 上一句還在等時再送出，輸入框內容被重畫塞回來
state: ready
link: assets/station/mobile.js
---

來源：2026-10-30 TODO 巡視時，使用者在手機看 station /m 的截圖，說「還會不能顯示 聊天這邊送出也不會清空」。現況：mobile.js:1696-1710 的 say() 先設 st.ui.draft=text，只在 act() 成功的回呼裡才清掉；上一句還在等（提示「上一句還在等這回合跑完」，cmp.waiting 見 mobile.js:39、:888）時，重畫又把 draft 放回輸入框。目標：訊息一排進佇列，輸入框就立刻清空。完成標準：有測試證明排隊中的訊息送出後輸入框是空的，且重畫不會把舊文字放回來。
