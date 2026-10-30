---
label: station
title: 任務卡換算週用量與 5H 額度
description: 站台任務卡在美元旁顯示約佔週用量與 5H 額度的百分比，重疊時以 API 價格推估並標為估算
state: blocked
link: assets/station/sessions-page.js
group: 花費頁折線圖先 land
timing: after: 花費頁折線圖 land
stamp: 2026-10-30
---

來源：使用者 2026-10-30 在「weekly 每日量開關、面向篩選、製作成本」任務中提出，原話「之後折線圖花費那個好了之後 那個任務卡可以換算這個任務花費多少周用量等等這樣 或是5H額度這樣 但如果多任務同時開重疊 就要用 API 價格推估之類的? 之後要做個量測表」。要變成什麼：站台任務卡（assets/station/sessions-page.js 的 spendIn/usd）在美元旁顯示「約佔週用量 X%／5H Y%」；換算共用 lib/quota.js 的每點美元，抽成一個 quotaShare(usd, window) → { weekPct, fiveHourPct, estimated }，週報結尾的製作成本區塊也呼叫它；多任務時間重疊時，額度讀數只量得到整台機器，改以 API 價格推估並標為估算；另做一張量測表比對推估與實際額度變化。依賴：花費頁 5h/7d 折線圖（docs/90-agent/plans/2026-10-30-spend-quota-design.md）先 land，沿用它定義的折線資料。完成條件：任務卡顯示兩個百分比且估算有標記；量測表至少一週資料；有測試釘住 quotaShare 的換算與 MIN_POINTS 不足時回傳空值。
