---
label: record
title: 接收他機送來的對話包 ZIP
description: skill 應假設使用者電腦是獨立的、資料經網路以 ZIP 送來；目前沒有 manifest.json 的 ZIP 無法接收。
state: ready
---

使用者原話：「我們的 SKILL 應該要假設 使用者電腦是獨立的 需要跨網路 跨電腦設備 給我們資料 所以我才需要 ZIP 包」。

現況與缺口：

- scripts/record.js 的 import（約 504 行附近）只收有 manifest.json 的 export ZIP；只含 `<date>-<id8>.jsonl.gz` 加 `retro.md` 的非正式 ZIP 會被拒絕。
- retro、retro-all 及需要查舊 session 的分析，預設對話紀錄在本機 ~/.claude/projects；找不到時沒有「請使用者給 ZIP、讀匯入的對話包」的路徑。scripts/conversation.js --bundle 已能讀 .jsonl.gz。
- .fankeel/imports/ 不在 .fankeel/.gitignore，匯入的未遮蔽對話包可能被誤 commit。

實例：2026-11-02 Plane/ClickUp 前端改版（session e8d01398）在另一台電腦；使用者手動把 ZIP 解壓到 .fankeel/imports/informal-2026-11-02-plane-clickup/ 後，conversation.js --bundle 可讀。那個資料夾不要 commit。

尚缺（完成條件）：

- import 接受非正式 ZIP，或另有收件指令。
- 相關 skill 寫明本機找不到對話時，請使用者給 ZIP。
- .fankeel/imports/ 加進 gitignore。
