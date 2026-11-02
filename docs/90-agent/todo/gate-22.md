---
label: gate
title: 先問完、剩下自己跑
description: plan 或 design 結束時一次預答後面幾站的 gate（只對這個 task），之後 verify／land 照寫報告但標已預答；不可逆動作、啟動外部程式、spec 沒列的手段仍硬停
state: decision
link: hooks/gate.js
---

來源：docs/90-agent/judgements/2026-11-02-pstack-video-summary.md。判官原選 A（blast-radius lens，見 verify-5），使用者答「過夜／離開時仍要跑的案子常發生」，依 judge.js answered 改走 B：照 docs/03-decisions/2026-10-19-no-unattended-gate.md:29「有具體案例再開新條目重議」重開 gate-13 的問題。

具體案例（2026-10-21 夜，SBIR/ProjectWorkspace）：使用者在 session 36c3211f 與 49735261 說「我要先睡覺了 GATE 自己判斷」。controller 用 task.js note 記「survey gate 自判通過」「build gate 自判通過」「controller 代答 verify gate：進 land」，沒有任何規則限制它；36c3211f 的 101-agent 全讀 workflow 寫了 32 支 .ps1（.fankeel/build/scan/deep/scripts/），以 COM 開 `Word.Application` 119 次、ADODB／ADOX 約 50 次，49735261 開 `PowerPoint.Application` 轉 PNG。spec 與 plan 都沒要求這些手段，使用者醒來看到 Office／Visual Basic 視窗。所以「自判 gate」已經在發生，只是沒有形狀。

使用者要的形狀（2026-11-02）：不一定真的睡覺，而是「先確定完問題後，剩下自己跑完」。pstack 的對應（docs/90-agent/judgements/2026-10-18-cursor-plugins-pstack.md:133、:139）：multi-phase-plan 交回後等一次 go；autonomous-run 先定可檢驗的結束謂詞，每輪最小改動→驗證→commit 或丟棄；Orchestrate 的 gates.md 停住的問題附預設答案；babysit／shipping 絕不 merge，每 PR 一個獨立 verifier。

要決定的：
- 預答在哪一站問：plan 結束（有 plan 時）或 design 結束，一次問完 verify 與 land 的選項，存進這個 task（不是 profile，不跨 task）。
- 已預答的 gate 怎麼過 hooks/gate.js：報告照寫、gate 記成 `preanswered`，回來時 station 列出每一站的預答與報告讓使用者一次看。
- 硬停清單：push、刪除、land 的 merge（是否也停）、啟動外部程式（COM、Office、GUI）、spec 與 plan 沒列的手段或新的檔案類型。
- 與 10-19 決定的去重、handoff 逐字複製、resume 三條流程怎麼共存。

完成的樣子：使用者選定上述四點，另開 design 任務改 hooks/gate.js 與其測試；或決定不做，把理由補進 2026-10-19 決策紀錄後關閉本條。
