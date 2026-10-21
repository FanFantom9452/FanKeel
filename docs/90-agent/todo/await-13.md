---
label: await
title: await 不默默略過 questions
description: 交接檔已出現但 gate 還沒寫完或不合格時，await 整行不印也不說
state: done
link: scripts/await.js
done:
  at: 2026-10-21
  sha: 2b491589
  disposition: done
  session: 198a8e58-f383-465a-8b51-3d93fb0706f6
---

來源：2026-10-21 TODO 全表盤點的 verify。build close 第一次交接時，await 印了 handoff 和 page: 行，卻沒有 questions: 行；同一個檔案稍後用 readGate 讀得出合格的 gate。原因是 awaitState 只看交接檔的修改時間，fs.watch 在檔案剛建立、gate 區塊還沒寫進去時就回報，questionsLine 讀到 null 或 invalid 時默默回傳空字串。要做成：gate 讀不到時稍等再讀一次，仍然讀不到就印一行說明沒有可直接照抄的 questions，請主控自己讀檔。完成條件：有一個測試，交接檔先寫報告、稍後才補 gate 時，await 印出 questions: 行或那行說明，不會什麼都不印。

## 完成紀錄

await 遇到交接檔沒有可用的 questions 時印一行原因，不再默默略過。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-21-198a8e58)

- commit 2b491589
- commit 4bc29837
