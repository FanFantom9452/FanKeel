---
label: context
title: 引用的 usage 被當成真的
description: usedFrom 與 droppedFrom 會比對到工具結果裡引用的 usage 與 compactMetadata；context 行報假數字，子代理的預算 hook 誤擋
state: ready
link: lib/context.js
---

來源：2026-10-12 compact 任務。三個現象同一個原因。第一，主 session 的 context 行整個任務都說 1.1M tokens dropped to compaction so far，那是 lib/context.js 檔頭註解裡的範例 cumulativeDroppedTokens 1120198，session 讀過那個檔之後，工具結果裡的字被 DROPPED 樣式比對到；後來又出現 402k in play，那是 tests/context.test.js 的 usage(ctx.BUSY)。第二，build 的 implementer 在子代理自己回報約 47k tokens 時被 hooks/budget.js 拒絕繼續用工具。第三，reviewer 回報被擋在 652k，652364 正是 tests/render.test.js 上限測試 fixture 的 2 加 2362 加 650000。原因：lib/context.js:57-58 的 DROPPED 與 USAGE 樣式刻意容許引號前有反斜線（因為真的 compactMetadata 在磁碟上是跳脫過的），而 usedFrom 與 droppedFrom 取尾端最後一筆比對，不分那一筆是 transcript 列自己的欄位，還是某個工具結果或訊息內文裡引用的文字。影響：context 行與交接建議可能是假的；hooks/budget.js 會在子代理讀到含大數字的檔案時把它擋在 HARD，本次任務因此多跑了三輪 fixer，一個 reviewer 沒審完。要變成：usage 只認 transcript 列本身的 message.usage（未跳脫、該列是 assistant），壓縮紀錄只認 subtype 為 compact_boundary 的 system 列裡的 compactMetadata；引用在工具結果或內文裡的一律不算。完成條件：有測試用一個 transcript，裡面的工具結果引用了更大的 usage 與 cumulativeDroppedTokens，inspect 仍回真的數字；hooks/budget.js 對讀過 tests/render.test.js 的子代理不會誤擋，有測試釘住。
