---
label: guard
title: 引號內 git commit 誤判為寫入
description: guard 的寫入判斷沒有先去掉引號內文字，task.js note 的內容含 git commit 就被擋
state: done
link: lib/guard.js
done:
  at: 2026-10-21
  sha: b6fb4133
  disposition: done
  session: 9f451488-d5a6-4838-8cfc-9a451fd4f0e1
---

來源：2026-10-21 TODO 全表盤點（session b7a7d8d4）land 站的 retro 讀完整段對話後列為 backlog，使用者在 land gate 選「全記成 TODO」。

這次在 plan 站把 task.js note 和其他指令串在同一行，note 的引號內文字提到 git commit，lib/guard.js 的 writesFiles 依 WRITE_PATTERNS 比對整行指令，把它當成寫入而拒絕；只好把 note 單獨執行。

要做成：writesFiles 先把引號內的文字拿掉再比對 WRITE_PATTERNS，引號外真正的 git commit 仍要擋。

完成條件：測試涵蓋「引號內含 git commit 的 task.js note 放行」與「引號外的 git commit 照擋」兩種情況，並在受控站實際串接一次 note 不被拒。

受控站實測（2026-10-21）：引號內 git commit 的 note 串接放行，引號外的 git commit 照擋。

## 結案說明

這件事已在 04660fad、3af4befa、b6fb4133 完成（lib/guard.js、tests/guard-quoted.test.js），本條已結案。

## 完成紀錄

guard 不再把引號內的 git commit 誤判為寫入：只有 fankeel 認得的筆記指令（task.js、ledger.js、todo.js 的文字動詞）會先忽略引號內文字再比對，其他指令一律讀整行，引號外真正的 git commit 照擋。改動在 lib/guard.js，tests/guard-quoted.test.js 涵蓋放行與照擋兩種情況以及審查者提出的繞過寫法；受控站的實際串接已在 2026-10-21 實測通過。

- commit 04660fad
- commit 3af4befa
- commit b6fb4133
