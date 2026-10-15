---
label: profile
title: --project 指錯目錄要拒絕
description: --project 指向不存在的目錄時應拒絕
state: ready
---

來源 — 2026-10-15 init 快速設定任務 verify 站的 adversary 發現 `task.js profile preset <name> --project <不存在的目錄>` 與既有的 `profile set --project` 一樣，經 projectRootFor 退回 registry 根目錄，exit 0 並把設定寫進根目錄的 .fankeel/profile.json；init 現在一個指令寫五個鍵，打錯字的代價變大。要變成什麼 — `--project` 指向不存在的目錄時拒絕並 exit 非 0，profile set 與 profile preset 同一處檢查；另補 `profile preset` 不帶名稱的測試。完成條件 — 兩個測試：不存在的 --project 被拒且不寫任何檔、無名稱 exit 1。
