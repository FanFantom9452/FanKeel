---
label: docs
title: 兩處 timeout 與行號小錯
description: station.md 第 56 至 57 行把 5 秒說成除 SessionEnd 外每個 hook 的值，但 gate.js 是 605 秒；注入冷啟動報告第 15 行 4107ms 引到第 46 行，實際在 summary.txt 第 89 行
state: done
link: docs/90-agent/reference/station.md
done:
  at: 2026-10-05
  sha: e5a41d0a
  disposition: done
  session: 822c6ede-cb35-4882-9af1-67b400e6b5f0
---

來源：2026-10-05 複驗報告（verify-2.md）。第一處是舊句，1cd963ba 只重排了它，plugin.json 的 gate.js 是 605 秒，只改成講 inject hook 的 5 秒即可。第二處是 docs/90-agent/reports/2026-10-05-inject-cold-start.md 第 15 行，4107ms 應引 after/summary.txt:89。兩處都是純文字，不影響結論。完成條件：兩句改正，docs-check 與測試仍過。注意報告頁若屬寫一次的角色頁，先確認能不能改。

## 完成紀錄

station.md 的五秒逾時改成只屬於 inject hook，表格現為五列，與文中五種情形一致；冷啟動報告補上寫入最大值 4107ms 所在的行號。兩處都對照 plugin.json 與 after/summary.txt 讀過為真。

- commit 537a352e
- commit df29229c
