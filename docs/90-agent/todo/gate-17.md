---
label: gate
title: 提問時也查 gate 選項數
description: `hooks/gate.js` 只在 header 等於 stage 名時才擋，控制者少抄選項會被放行
state: done
link: hooks/gate.js
done:
  at: 2026-10-21
  sha: 7bbed31f
  disposition: done
  session: 198a8e58-f383-465a-8b51-3d93fb0706f6
---

來源：2026-10-21 TODO 全表盤點的 verify。第二次 build 關卡問出去時只有兩個選項，檔案裡的 gate 卻有三個，hook 只記下 miss 就放行。原因是 hooks/gate.js 的 looksLikeAttempt 只在 header 等於 stage 名時成立，這個 gate 的 header 是「build 完成」；thinGate 的三選項檢查在受控階段也不跑。要做成：受控階段控制者問的題目跟交接檔的 gate 不一致時，不論 header 寫什麼都擋下，並說要照抄 questions。完成條件：有一個測試，header 不是 stage 名、控制者少抄一個選項時被拒絕。

## 完成紀錄

gate hook 把檔案 gate 的第一個標題也當成作答，少抄選項會被擋下。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-21-198a8e58)

- commit 7bbed31f
- commit 44f6eb39
