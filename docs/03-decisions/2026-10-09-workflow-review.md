---
status: decision
last_verified: 2026-10-09
---

# 工作流評審（10-09）：定了什麼、沒做什麼

一句話：外部評審的六條建議全做，用同一個原則——能由腳本查的出口條件改成腳本拒絕，prompt 只留判斷；站 agent 層縮回只交 survey，等 build 與 verify 的對照量測再決定去留。

評審原文在 [reports/2026-10-09-workflow-review.md](../90-agent/reports/2026-10-09-workflow-review.md)。design 在 [2026-10-09-workflow-review-design.md](../99-archive/2026-10-09-workflow-review-design.md)，計畫在 [2026-10-09-workflow-review.md](../99-archive/2026-10-09-workflow-review.md)。

## 做了什麼

- 整體設計不換骨架。七站本來就是一條完整的開發流程，缺的是規則放的位置。可查的規則從散文搬進會拒絕的腳本，判斷留給 prompt。
- 站 agent 層縮回 survey：本 repo 的 `stage.agents` 只剩 `survey`。對照腳本 `ab.sh` 與它的測試備好，判定規則寫在腳本開頭。受控臂的主控峰值 context 要低 30% 以上、花費不超過 1.1 倍，才把 build 與 verify 加回。
- reviewer 模板的三件機械事交給 `scripts/review-check.js` 與 `lib/reviewcheck.js`：選擇器對測試、新測試的 mutation 行、引用對行號。build skill 的 Part 2 改成兩句，10-01 的事故記錄搬成 report。
- 引用的形狀搬進 `lib/refs.js`。docs-check 與 review-check 共用它，不複製。
- brief 不再溢出：`BRIEF_MAX` 一個常數，超過時從最舊的 context fact 起裁，留一行指向 `context.md`。brain brief 裡的 root 路徑改成相對，長度不再隨 root 位置變。worktree 那行留絕對，因為 `commit.js` 以 repo 頂端解析 `into`。
- land 的全套綠燈由腳本守：`scripts/suite.js` 把結果記成 `suite.json`。`task.js land` 沒有綠燈紀錄，或紀錄之後有 `.md` 以外的改動，就拒絕記錄整合。land skill 第一節與 land 規則點名它。
- 決策頁只寫現行決定：docs-check 對 decision 頁的 `Superseded`／`已取代` 段報 finding。`fankeel-shell.md` 與 `2026-09-27-todo-clear.md` 依此改寫。
- todo-check 報 `no reason`：未完成條目的 body 不足就列出。十七條條目補上理由或關閉，其中九條關閉。
- `sessions.js --breakdowns` 數一週實跑裡站下來的任務，含「別人 land 之後才站下來」的那種。
- `profile.md` 加兩句：本 repo 自 10-09 起只交 survey，等這次量測。

## 沒做什麼

- Task 18 的實跑對照約 $60，build gate 沒有核准花費，沒跑。記成 `stage-agents-17`；`stage-agents-5`、`-8`、`-15`、`-16` 等它的結果。
- 四頁落後 10-09 之前的 plain.js、station.js、eval.js 改動，沒有在這裡重讀。記成 `docs-4`。
- 這條分支有七個 commit 訊息不合形：五個主旨與條列連在一行，兩個主旨超過 60 字元。build 時裁定不改寫歷史，留給使用者在 land 決定。
- `brief-2` 的根因由 `BRIEF_MAX` 消失，條目在 land 關閉。`brief-4`、`tests-5`、`foreign-1` 是過程中新開的條目，各自帶著理由。

## 為什麼

- 六條建議的共同根因有兩個。機械檢查寫成了散文，而散文會被略讀。站 agent 層唯一的對照量測只量了 survey，結果打平；build 與 verify 占長任務花費六成以上，卻沒量過。
- 縮回再量，比現在拆掉便宜，也比繼續全開可逆。
- 用腳本拒絕而不是規則提醒，是因為 land 的綠燈、decision 頁不追加、TODO 要有理由，這三件在 10-09 之前都被略過至少一次。腳本跑過就有紀錄，散文沒有。
- brief 的 worktree 行留絕對，是 verify 的 adversary 抓到的：第一輪把它改相對，`commit.js` 會解析錯；第二輪改回，第三輪補了會紅的測試。
