---
label: station
title: 壓縮與過期重寫的花費標示
description: 對話時間軸要在每個壓縮點與 cache 過期重寫處顯示 context 大小、cache write 金額與觸發原因。
state: done
link: assets/station/station.js
done:
  at: 2026-10-20
  sha: 057eb146
  disposition: done
  session: 45487ab9-c8fc-44c7-a0db-d46d41bb4796
---

來源:連結的 judgement。對話 tab(docs/90-agent/reference/station.md、lib/conversation.js)已顯示壓縮斷點與摘要,但沒有每次壓縮前後的花費,也沒標出 1h TTL 過期造成的整段 cache 重寫。要做:在對話時間軸上,每個壓縮點與每次過期重寫處顯示當下 context 大小、那一回合的 cache write 金額,並能看出觸發原因(自動、手動、away)。完成的標準:在一個有多次壓縮的 session 上,頁面每個斷點都有金額,加總對得上 lib/usage.js 算出的該 session 總額。

## 完成紀錄

對話分頁畫出每次壓縮和 cache 重寫的花費。 詳見[任務紀錄](../records/2026-10.md#r-2026-10-19-45487ab9)

- commit 057eb146
- commit 515eb0a4
- commit c7ef90dc
- commit fcb589dc
- commit 4e8d888d
