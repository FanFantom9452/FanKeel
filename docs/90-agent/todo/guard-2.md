---
label: guard
title: 引號內 git commit 誤判為寫入
description: guard 的寫入判斷沒有先去掉引號內文字，task.js note 的內容含 git commit 就被擋
state: ready
link: lib/guard.js
---

來源：2026-10-21 TODO 全表盤點（session b7a7d8d4）land 站的 retro 讀完整段對話後列為 backlog，使用者在 land gate 選「全記成 TODO」。

這次在 plan 站把 task.js note 和其他指令串在同一行，note 的引號內文字提到 git commit，lib/guard.js 的 writesFiles 依 WRITE_PATTERNS 比對整行指令，把它當成寫入而拒絕；只好把 note 單獨執行。

要做成：writesFiles 先把引號內的文字拿掉再比對 WRITE_PATTERNS，引號外真正的 git commit 仍要擋。

完成條件：測試涵蓋「引號內含 git commit 的 task.js note 放行」與「引號外的 git commit 照擋」兩種情況，並在受控站實際串接一次 note 不被拒。

## 為什麼還開著

retro 只列成 backlog，這次 land 沒有改程式；guard 是受控站的安全邊界，放寬比對要有測試同時證明沒放掉真正的寫入，屬於要單獨規劃與驗證的一件事。
