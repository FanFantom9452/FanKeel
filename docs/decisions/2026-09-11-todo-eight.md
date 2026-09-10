---
status: current
last_verified: 2026-09-11
source_of_truth: lib/render.js, agents/fankeel-verifier.md, evals/, tests/resume.test.js, tests/skills.test.js
---

# TODO 八條一次清 — 決策

使用者的問題是「處理 TODO，要 FABLE 處理的走 `fankeel-ask`」。`## Ready` 一條與
`## Needs a decision` 七條。七題一次全部送 `fankeel-judge`，這份記的是每個答案為
什麼是那個、建到一半被推翻了什麼，以及 verify 與 audit 各自撈回來什麼。

## 七個判斷，四個說不要做

- **`renderResume` 加長度斷言，上限 2600。** 判斷 1。實際量到的最壞是
  `bounded@design` 與 `bounded@land` 並列 2545，55 字元的餘裕。fixture 用的是
  `docs/pipeline.md:199` 自己那句 35 字元的 task 行——量測用比頁面短的 fixture，
  等於讓那一頁引用它自己的條目產不出來的數字。
- **四個例外 eval case 的首跑產物，搬進版本控制。** 判斷 2。它們一直在
  `.fankeel/build/2026-09-10-todo-ten/`，而 `.fankeel/.gitignore:3` 讓任何掃 git
  的 survey 都看不到；09-10 那次 survey 因此結論「這個 repo 裡不存在」，是錯的。
- **不做整個外掛的總 prompt 預算欄位。** 判斷 3。
- **不做「節」粒度的條件載入。** 判斷 4。理由在
  `docs/judgements/2026-09-10-section-loading.md`：plan-only 的文字不是連續的節，
  拆出去等於讓 plan 讀者自己合併兩個檔的步驟。
- **不採用 16 行的極簡 pattern skill。** 判斷 5。
- **guard 對 shell 的沉默升格成明說的設計。** 判斷 6。`docs/collisions.md` 現在
  寫出操作者自己要下的 `permissions.deny` 那一步，並逐字保留判斷的但書：沒有人
  在 `defaultMode: "auto"` 或 bypassPermissions 底下驗過它。
- **verify 的 per-row 驗證者拿到自己的 agent 檔。** 判斷 7。`fankeel-verifier`
  是四支裡唯一持有 `Write` 的——它要把證據列寫進檔給 Workflow 的 join。這不是比
  另外三支寬鬆：`Write` 被 `guard.js` 的 PreToolUse 攔，而四支都有的 `Bash`
  沒有任何 hook 攔。

## 同一個錯誤在同一份證據上犯了三次

`headless transcript 裡派 subagent 的工具叫什麼`，這支分支答錯兩次才答對。

`15daa59`（09-10）讀 eval JSON 裡子 session 的 system-init `tools` 陣列，看到
`Task` 沒有 `Agent`，把三顆 grader 改成 `Task`。這支分支的 build 又讀了同一個
陣列，記了一條裁決推翻判斷 2，把 Task 4 的正確修正還原。整支分支的審查抓到之後
`fc937c6` 改回 `Agent`。

那個陣列是**這支 CLI 註冊了哪些工具**，不是一次派工被記成什麼，而
`type: tool_used` grade 的是後者。五次跑動印出的是同一份 29 個名字、逐字相同，
連 `allowed_tools` 裡根本沒有 `Task` 的 `stage-skip-said` 那一次也一樣；
`scripts/eval.js:113` 確實把清單傳成 `--allowedTools`，陣列不動。

三個 `prompt.md` 的 `allowed_tools` 最後照計畫改回 `Agent`——`596eb21` 建檔時就是
`Agent`，`15daa59` 用同一套錯誤推理把它們翻成 `Task`，而 `fc937c6` 把 grader 翻
回來卻沒碰它們。沒有論據能分開兩者。

## verify 撈回七條，其中一條是我整個 build 沒跑那支檢查

`node scripts/docs-audit.js` 在這支分支上是**紅的**：新增的兩頁計畫沒有索引列。
整個 build 我跑的是 `node --test`、`docs-check`、`todo-check` 三支，從沒跑過
`docs-audit`，而它是唯一抓得到這件事的。

其餘六條都是這次改動自己造出來的孤兒：`docs/sources.md` 的檔案數、兩處
「`fankeel-reviewer` 是唯一不傳 model 的派遣」（`fankeel-verifier` 是第二個）、
`tests/skills.test.js` 註解把判斷 4 的四個區域寫成三個、`provenance.txt` 沒指名
grader 改動實際落在哪兩個 commit，以及計畫承諾 `TODO.md` 連到存證目錄——那個做
不到，`docs/reports/` 是 `scripts/todo-check.js:84` 的 `STALE_ROLES` 之一，條目會
被拒收，缺的是裁決不是連結。

## audit 找到的，與對手打掉的

`docs/sources.md:19` 的「behind three of those **reports**」正確數字是四：六個存證
目錄裡只有四個背著報告，`route-typo` 背 eval case、`exception-cases` 背判斷。它從
`haiku-pair` 在 09-09 落地就錯了，與這支分支無關。

三處兩頁講同一個機制而兩邊都不讓路，進 `## Ready`。`source_of_truth` 沒有任何東西
在驗證——五頁在裡面寫散文，25 個 `.js` 被兩頁以上 reference 頁同時宣告——進
`## Needs a decision`。

對手打掉我四條數字：覆蓋率 15 其實 19、五個 source-of-truth 其中一個該丟（
`docs/pipeline.md:4-7` 的 frontmatter 已經點名 `skills/fankeel-survey/SKILL.md`，
而 `scripts/docs-audit.js:423-426` 說那就是讓路）、31 其實 25、第一條是四不是六。

## 這次沒做，而且是刻意的

Task 7（verify 與 build 的 rationale 拆分）一個檔都沒動。判斷 5 的翻案條件是「模型
從 plugin cache 讀 SKILL.md 時會不會跟著相對連結去讀 `rationale.md`」，而
implementer 查遍決策記錄、判斷、`TODO.md`、報告與 `git log --all --grep=rationale`
的二十二個 commit，沒有任何驗證紀錄。沒驗就把理由搬過去，等於在賭它會被讀到。

`fankeel-verifier` 這個 session 自己派不到——agent 檔在行程啟動時載入，而這個檔是
本分支才建的。第一次 Workflow 十七個 agent 全部以 `agent type not found` 失敗，零
token。同一件事這個 repo 在 `fankeel-reviewer` 上已經記過一次，改用
`fankeel-reader` 頂替。
