---
label: upgrade
title: 升級技能要不要補步驟
description: fankeel-upgrade 不讀版本號，只依專案檔案判斷待辦，目前只有 TODO 搬遷一步；0.80.0 的專案升到現版時 profile 欄位、docs.json 等沒有對應步驟 — [scripts/upgrade.js](scripts/upgrade.js).
state: decision
link: scripts/upgrade.js
---

來源：2026-10-15 第二次 TODO 盤點，使用者問：假設別人的 skill 版本是 0.80.0，之後要換到現在這版，升級技能要不要順便升級。survey 讀 scripts/upgrade.js:4-16 得到的結論是：fankeel-upgrade 不看版本號，而是讀專案自己的檔案決定哪些步驟待辦，目前只有 TODO 從 TODO.md 搬到 todo 資料夾這一類；外掛本身的 skill 與 agent 隨外掛更新，不是專案要搬的東西。所以 0.80.0 的專案升級時，profile 新欄位、docs.json 的新角色與 audience 等都沒有步驟處理。這是看程式得到的結論，沒有在真的 0.80.0 專案上跑過。要做成：先列出 0.80.0 到現版之間專案檔案格式的每一項變動，決定哪些需要升級步驟、哪些讀舊格式就夠，再決定要不要補。完成條件：使用者做出決定，並把結果寫進本條或拆成 Ready 條目。
