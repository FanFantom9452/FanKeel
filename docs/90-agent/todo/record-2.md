---
label: record
title: 跨機回顧：專案卡與來源分級
description: 別人的對話包經 ZIP 送來時，附上專案卡、記下來源，retro-all 按分析面向決定一項發現能不能算數，而不是整份降權。
state: done
done:
  at: 2026-11-03
  sha: 9f1c9505
  disposition: done
  session: f86aee7a-16c4-4112-b257-261ff65fe0ec
---

使用者原話：「我們的 SKILL 應該要假設 使用者電腦是獨立的 需要跨網路 跨電腦設備 給我們資料 所以我才需要 ZIP 包」。2026-11-03 又說：對方的專案在做什麼我不知道，參考權重應比較低；自己的專案都知道在做什麼，權重可以高一些。

retro-all 要看的面向（使用者列的）：架構理解有沒有疏漏、哪裡鬼打牆、哪些工作能平行卻沒平行，以及其他工作流程可改進的地方。

2026-11-03 對話裡提出、使用者同意寫進這裡的設計方向（未經 design 階段）：

- 權重不按「誰送來的」，按「這項發現要不要懂那個專案」。鬼打牆、可平行未平行、關卡或驗證被跳過、工具故障，看對話就能判斷，任何來源都算數；只有「架構理解疏漏」要知道專案原貌才能查證。
- 送出端：ZIP 多附一張專案卡 project.md，取自 map.md、CLAUDE.md 重點、這次任務的路線與任務紀錄，同樣經過敏感字遮蔽；匯出時多一個勾選「附上專案地圖」，預設不勾。
- 接收端：import 時每個對話包記下來源（local 或 imported）、有沒有專案卡、送出端的 fankeel 版本（舊版的問題可能已修好）。
- retro agent 回報的每一項標上面向；架構面向的發現只在有專案卡或是本機專案時算數，否則列為 unverified:，不計入「兩個以上 bundle」的 recurring 門檻。

原本這條要補的接收缺口，仍然要做：

- scripts/record.js 的 import 只收有 manifest.json 的 export ZIP；只含 `<date>-<id8>.jsonl.gz` 加 `retro.md` 的非正式 ZIP 會被拒絕。
- retro、retro-all 及需要查舊 session 的分析，預設對話紀錄在本機 ~/.claude/projects；找不到時沒有「請使用者給 ZIP、讀匯入的對話包」的路徑。scripts/conversation.js --bundle 已能讀 .jsonl.gz。
- .fankeel/imports/ 不在 .fankeel/.gitignore，匯入的未遮蔽對話包可能被誤 commit。

實例：2026-11-02 Plane/ClickUp 前端改版（session e8d01398）在另一台電腦；使用者手動把 ZIP 解壓到 .fankeel/imports/informal-2026-11-02-plane-clickup/ 後，conversation.js --bundle 可讀。那個資料夾不要 commit。

尚缺（完成條件）：

- 開一個任務從 design 做，定案上面的設計方向。
- 匯出 ZIP 可選附專案卡，import 記下來源與有無專案卡。
- retro 與 retro-all 依面向決定發現算不算數。
- import 接受非正式 ZIP，或另有收件指令；相關 skill 寫明本機找不到對話時請使用者給 ZIP。
- .fankeel/imports/ 加進 gitignore。

## 完成紀錄

跨機回顧會分開本機與他人匯入的對話、帶上專案卡、替每條發現標上面向，非正式 ZIP 也能匯入。詳見 [任務紀錄](../records/2026-11.md#r-2026-11-03-f86aee7a)

- commit ed47b287
- commit c7b96173
- commit f2bf11cb
- commit ecba5507
- commit 44f0a445
- commit 01f61881
- commit 9f1c9505
