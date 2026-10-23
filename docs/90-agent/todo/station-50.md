---
label: station
title: 通知不消失、Editing 刪不掉
description: 站內通知面板：已讀不消失、Editing 列無法刪除、過期 taken tune 請求永遠顯示
state: decision
link: assets/station/station.js
---

來源：使用者看 bell-panel mockup 時說（2026-10-23）：「通知的功能一般來說讀取完成就要消失這樣，而不是一直亮著，應該要可以刪除的。有些可能很早就編輯完成了但是沒有收尾，這個如果有問題要記錄到 TODO。」現況：assets/station/station.js:2487 noteHtml 讓 status==='edit' 的列沒有 × 按鈕；「清掉通知」(data-note-clear) 只清非 edit 列，且 station.js:2555 只在有非 edit 列時才顯示。Editing 列來自 assets/station/station.js:2478 floatNotes，把每個 session tune 佇列中 status==='taken' 的項目列為「編輯中」；scripts/tune.js:221 wait 把請求標成 taken，只有 tune.js done 才會結案，所以沒結案的請求永遠顯示（使用者見過 v8-q1-integ 兩次、v8-machine-card、quick-q-push）。docs/90-agent/judgements/2026-10-22-tune-queue-unreceived.md 提議 tune.js drop <id>，尚未實作。應改成：開啟面板即視為已讀，已讀通知不再亮、badge 數不計已讀；每一列都可刪除，包括 Editing 列；過期的 taken 請求可以被 drop 或自動老化。需要決定：已讀後是否仍留在列表內、老化門檻多久。完成標準：測試證明 Editing 列可以從面板移除，被 drop 的過期 taken 請求不再渲染；badge 數不含已讀通知。與 tune-7（區塊發光不停）不同，那條只管外框發光。
