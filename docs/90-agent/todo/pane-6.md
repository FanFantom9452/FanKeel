---
label: pane
title: Pane 新配色真機沒看過
description: 10-13 改完的安靜版配色、route 行與拿掉兩塊，還沒在 Claude Desktop 或終端上看過一次
state: ready
link: hooks/pane-status.ts
---

來源：2026-10-13「Pane 配色與右欄資訊重新規劃」任務收尾時，使用者同意真機這一項留成 TODO。那個任務照配色比較頁的 B 欄改了 hooks/pane-status.ts：任務標題下面多一行寫出站名的 route（走完的站綠、目前站粗體、未到的站灰），tasks、context、notes 的標題與色條共用灰 #8a8a8a，「這個 session」與「用量額度」兩塊拿掉。比較頁是用等寬字重畫的示意，不是 Pane 本身，所以實際觀感沒有人確認過。要做的：更新安裝的 plugin 之後開一個新的 fankeel 任務，在 Claude Desktop 看 Pane：route 行有沒有畫出來、三種站分不分得出來、灰色標題在深色底與淺色底上讀不讀得清楚、欄位窄的時候 route 有沒有在站與站之間換行。完成條件：使用者看過一次並說可以，或者說出要改哪裡，另開任務去改。決定紀錄在 docs/03-decisions/2026-10-13-pane-colour.md。
