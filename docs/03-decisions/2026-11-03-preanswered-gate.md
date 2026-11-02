---
status: decision
last_verified: 2026-11-03
---

# 先問完、剩下自己跑：單一 task 的預答 gate（11-03）

一句話：plan 站結束（沒有 plan 的路線是 design 站結束）時一次問完後面幾站的 gate，答案只存在這個 task 的紀錄上；之後那幾站照寫報告，由 `hooks/gate.js` 帶答案放行並標 `preanswered`，push、刪除、land 的 merge、啟動外部程式四類動作照樣停下等人。

依 [2026-10-19 不讓常備答案代答 gate](2026-10-19-no-unattended-gate.md) 第 29 行「有具體案例再開新條目重議」重議，案例與經過在 [gate-22](../90-agent/todo/gate-22.md)。

## 決定

- `node scripts/task.js preanswer <stage>=<label>... --session <id>` 把 `preanswer = { answers, stops, at }` 寫進這個 session 的紀錄；`task` 與 `down` 清掉，profile 沒有對應的鍵。
- 在 plan gate 選了 option one 之後、進下一站之前另問一題 `預答`（`lib/stages.js` 的 `preanswerRule`，進站時由 `task.js` 印一次），不併進 gate 本身。
- 已預答的 gate：只有一題、是這站的 gate，而且預答對上 option one 或暫停選項時，`hooks/gate.js` 走 station 已有的 allow + `updatedInput.answers` 路徑帶答案過，紀錄寫 `preanswered[<stage>] = { label, at }`。對上其他選項、題數不只一題、或對不上，都照常問。
- 預答期間 `lib/guard.js` 的 `preanswerStop` 對四類 shell 指令回 `ask`：push（`git push`）、刪除（`rm`、`del`、`Remove-Item`、`git branch -d/-D`、`git reset --hard`、`land.js clean`）、land 的 merge（`git merge`、`land.js merge`、`gh pr merge`）、啟動外部程式（`Start-Process`、`start`、`-ComObject`、Office 與其他 GUI 程式）。類別清單是 `registry.PREANSWER_STOPS`。
- 「spec 與 plan 沒列的手段」不做機械檢查，由進站規則承擔：要用就在站中另問 AskUserQuestion 等人，那種問題不會被預答。

## 為什麼

10-19 拒絕的是 profile 上的常備答案：它跨 task、沒人看過就代答，而且 gate 的去重、逐字複製檢查與 resume 都假設 gate 一定被問。這次不同的地方有三個。答案是使用者在同一個 task 的 plan gate 上、看過 plan 之後親口給的，不跨 task。gate 照樣被問，只是 hook 帶著答案：去重、逐字複製與 resume 走的都是 station 已在用的同一條路，不需要「沒問」的分支。報告照寫，使用者回來時每一站的報告與答案都在。

10-21 夜的案例說明不設形狀也會發生：使用者說「GATE 自己判斷」，controller 用 note 代答了三站，還以 COM 開了 Word 119 次。只允許 option one 通過，是因為 option one 是這站自己根據證據推薦的路；預答落在別的選項，表示報告和預先的答案不一致，正是要人看的時候。暫停選項例外，因為停下永遠安全。

第四類不做機械檢查，是因為允許清單會在這個 task 沒見過的每一條指令都停下，無人值守的跑法一晚會停很多次；事故真正用到的手段（COM、Office）已經由第三類攔下。

host 是否真的接受「allow + answers、不顯示問題」沒有驗過。若 host 仍把問題顯示出來，使用者回來答就好，不會誤過；紀錄上的 `preanswered` 只代表 hook 帶了答案。

## 放棄了什麼

- profile 常備答案：維持 10-19 的拒絕，跨 task 的代答仍不做。
- 把預答題併進 plan gate：stage agent 寫的 gate 要改格式，控制站的逐字複製也要跟著改；另問一題兩邊都不用動。
- 第四類用允許清單機械攔下：一晚停太多次，等於沒有無人值守。
- 只檢查刪除被 git 追蹤的檔：要從指令裡解析路徑再問 git，hook 的成本與誤判都高；一律問，代價是多按一次鍵。
- station 另列預答清單：報告本來就在 gate 頁上。
