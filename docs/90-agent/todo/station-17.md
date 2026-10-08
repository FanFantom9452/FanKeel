---
label: station
title: 壓縮後 station 還原紀錄嗎
description: 一個 session 被自動壓縮過後，station 的詳情面板是否仍正確算出整段紀錄：花費、context 曲線、turn 數與派工
state: ready
---

來源：2026-10-08 使用者在 session 49e93c6c-9f31-4839-8e3f-ef6adff80a17 中問「現在已經有自動壓縮機制的話，我們 station 有辦法正常還原所有紀錄嗎？」

現況（reader 2026-10-08 讀到的）：station 的詳情由 `lib/detail.js` 的 extract 讀主 transcript，用 usage.entriesOf 與 usage.summarise（`lib/detail.js:598-601`）。子 agent 由 usage.agentFiles 讀 subagents 目錄（`lib/usage.js:181-195`）。`lib/detail.js` 與 `lib/usage.js` 都沒有處理 compact_boundary 或 isCompactSummary，每一行都當一般紀錄。

只有 `lib/conversation.js` 會把壓縮點標成 compact 與 summary 兩種 turn（`lib/conversation.js:51-57`、`lib/conversation.js:67-71`）。它是已完成項目「對話全文匯出與閱讀」做的匯出工具，station 沒有用它。`lib/context.js` 也讀 compactMetadata，但 `lib/detail.js` 只從它匯入 BUSY。

transcript 只增不減，壓縮前的行還留在檔案裡（`lib/conversation.js:4-6` 的註解）。所以原始資料應該都在；要查的是面板算出來的值對不對。

測試案例：session 49e93c6c-9f31-4839-8e3f-ef6adff80a17 的 transcript（在 ~/.claude/projects/F--ymlab-fankeel/ 底下）有 4 行 compact_boundary、4 行 isCompactSummary。

要變成什麼：在這個 session 上，拿 station 面板的花費、context 曲線、turn 數、派工清單，和直接從 transcript 重算的值逐項比對。要特別看三件事：壓縮摘要那一行有沒有被算成一個使用者 turn；context 曲線在壓縮點有沒有正確掉下來；壓縮前的派工是不是都還列得出來。

完成的標準：每一項都對得上，或者對不上的已經列成修正；面板要不要在壓縮點加標記，由使用者決定。
