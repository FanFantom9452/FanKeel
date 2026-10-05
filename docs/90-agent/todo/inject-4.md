---
label: inject
title: 注入改函式 hook 加節流
description: 每輪注入都起一個新 node，hook 有五秒逾時；改成行程內函式 hook 並對重複寫頁面節流，免掉逾時風險
state: done
link: hooks/inject.js
done:
  at: 2026-10-05
  sha: b7d5157d
  disposition: done
  session: 0461c799-7295-4d36-91f0-66f97a2d97fa
---

來源：2026-10-05 注入計時那個 session 的討論，使用者提到改用行程內的函式 hook，並對注入加節流。現況：UserPromptSubmit 每輪都啟動一個新的 node 行程，載入 hooks 與 lib 約 50 毫秒，之後同步跑 station 的 write，hook 有五秒逾時。節流的意思是短時間內重複的 prompt 不重寫整頁。要先決定：Claude Code 的函式 hook 是否可用於這個 plugin、事件名稱與逾時規則是否查證過、節流的間隔取多少、頁面舊了使用者看不看得出來。完成條件：決定寫進一頁文件，選了就做並附前後耗時對照。

## 完成紀錄

這件事決定不做：注入不改成行程內的函式 hook，因為那就是 2026-10-03 擱置的 mod 路線，旗標與每個 session 的啟用條件都還沒變。節流的想法併進 inject-3「注入先開 server」，原因是慢的是同步寫頁面，不是啟動 node。理由寫在決策頁 docs/03-decisions/2026-10-05-inject-gate-mod.md。

- commit c07554c8
- commit 50426a92
- commit 658f53d6
- commit 079f3b08
