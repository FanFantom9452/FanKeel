---
label: station
title: Tailscale 設定警告指向解法
description: 三處 Tailscale 設定警告與 /fankeel-phone 拒絕訊息補上管理頁網址與設定指南路徑
state: done
link: lib/tailscale.js
done:
  at: 2026-10-23
  sha: 36b60aed
  disposition: done
  session: 6bedeb94-1482-4af2-8d8f-049b6d29c923
---

來源：docs/90-agent/judgements/2026-10-22-phone-reach.md 的判斷（Tailscale 仍是手機唯一的傳輸方式），以及 2026-10-22 的 gate 回答「build，並開 Tailscale 引導 TODO」。該判斷建議另開一張 TODO，用三個一行修正讓設定警告直接指向解法。應改成：(1) lib/tailscale.js:32 的 MagicDNS/HTTPS 警告加上管理頁 https://login.tailscale.com/admin/dns 與指南 docs/01-guide/tailscale-setup.md，手機遠端卡片原樣顯示；(2) scripts/task.js:1248 的 station.remote --confirm 拒絕字串加上指南路徑；(3) /fankeel-phone（skills/fankeel-phone、scripts/phone.js）在 station.remote 關閉或卡片有警告時，印出該警告與指南路徑並以非零碼結束，不再靜默失敗。完成的標準：每個警告字串都含指南路徑；第 1、2 項各有測試斷言該字串；/fankeel-phone 的拒絕路徑有測試。注意：第 3 項會動到 mobile-session 任務新增的 scripts/phone.js，請在該任務落地之後再做。

## 完成紀錄

警告與手機拒絕都指向設定指南的絕對路徑，遠端關著時 attach 結束碼為 1. 詳見 [任務紀錄](../records/2026-10.md#r-2026-10-22-6bedeb94)

- commit 9e50b414
- commit 36b60aed
