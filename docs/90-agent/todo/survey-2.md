---
label: survey
title: graphify 接為查詢工具
description: graphify 可接為查詢工具；獨立實測未穩定省錢，接之前先解決它的 PreToolUse hook 擋 Read 與 guard 衝突、Windows 上 hook 靜默失效（其 issue #140） — [scripts/survey.js](scripts/survey.js).
state: watch
link: scripts/survey.js
group: 程式碼大到要查結構
timing: if: 某個專案的程式碼大到 grep 加 read 找不到跨檔關係
stamp: 2026-09-29
---

來源：2163ed9b（2026-09-27，graphify／orbit 分析的七條）把這行放進 TODO.md：graphify 可接為查詢工具，但獨立實測未穩定省錢，接之前要先解決它的 PreToolUse hook 擋 Read 與 guard 衝突，以及 Windows 上 hook 靜默失效（其 issue #140）。

要做成：程式碼大到 grep 加 read 找不到跨檔關係時，把 graphify 接成 [scripts/survey.js](scripts/survey.js) 可呼叫的查詢工具，先排除上述兩個衝突。

完成條件：在一個真實的大專案上，接了 graphify 的 survey 比不接的省 token，且 hook 在 Windows 上確實觸發、不與 guard 衝突。
