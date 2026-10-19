---
label: station
title: 壓縮與過期重寫的花費標示
description: 對話時間軸要在每個壓縮點與 cache 過期重寫處顯示 context 大小、cache write 金額與觸發原因。
state: decision
link: docs/90-agent/judgements/2026-10-19-weekly-token-composition.md
---

來源:連結的 judgement。對話 tab(docs/90-agent/reference/station.md、lib/conversation.js)已顯示壓縮斷點與摘要,但沒有每次壓縮前後的花費,也沒標出 1h TTL 過期造成的整段 cache 重寫。要做:在對話時間軸上,每個壓縮點與每次過期重寫處顯示當下 context 大小、那一回合的 cache write 金額,並能看出觸發原因(自動、手動、away)。完成的標準:在一個有多次壓縮的 session 上,頁面每個斷點都有金額,加總對得上 lib/usage.js 算出的該 session 總額。
