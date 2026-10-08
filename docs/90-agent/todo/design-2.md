---
label: design
title: design class 其餘是架構任務
description: design class：mockup 已落地，其餘是另一個 architectural 任務；計畫的三份必讀來源已不存在，內容多半已併進簡報 — [簡報 §4.1](docs/90-agent/reference/improvement-brief.md#41-design-階段的-mockup-步驟前端任務).
state: watch
link: docs/90-agent/reference/improvement-brief.md#41-design-階段的-mockup-步驟前端任務
group: 下一個前端任務
timing: if: 下一個前端任務出現
stamp: 2026-09-26
---

來源：根目錄 TODO.md 第 156 行的條目（2026-09-26 記），改成逐條的 todo 檔。

要做成：design class：mockup 已落地，其餘是另一個 architectural 任務；計畫的三份必讀來源已不存在，內容多半已併進簡報

完成條件：條目所述的事做完，或查證後確認不必做；結果與證據（指令輸出、commit sha 或不做的理由）寫回這個檔案的正文，再用 todo.js done 結案。

## 為什麼還開著

這條來自 2026-09-09 caveman.zip 讀進來之後的 design-class prompt（`docs/90-agent/plans/2026-09-09-design-class-prompt.md`）。它要四項交付物：`design` class 的定義、軸鎖定檔格式、路由表、stage skill 增修。我在 2026-10-09 查了：只有 mockup 步驟落地（`skills/fankeel-design/SKILL.md` 第 3 步、`agents/fankeel-mockup.md`、`lib/stages.js` 的 `design.mockup` 條件）；`skills/fankeel-survey/SKILL.md` 的 class 表仍只有 spike、bounded、architectural 三個，沒有 `design` class，也找不到軸鎖定檔或路由表。所以其餘部分仍是另一個 architectural 任務，不是已經做完。該任務要等下一個前端任務出現，用真實的前端需求回答 prompt 的三個設計問題，再寫進 survey 的 class 表與 `task.js` 的 class 驗證。完成條件是 `design` 成為 `task.js` 接受的 class，且軸鎖定檔格式有一份被某次前端任務實際用過的範例；若使用者決定 mockup 步驟已夠用，就以 `todo.js done` 結案並寫下不做的理由。
