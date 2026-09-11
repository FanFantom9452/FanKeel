---
status: current
last_verified: 2026-09-11
source_of_truth: TODO.md, docs/improvement-brief.md, docs/judgements/2026-09-11-todo-split.md
---

# 09-11 的五個方向拆進 TODO — 決策

使用者在 `/fankeel-ask` 裡一次提了五個方向——caveman 與 ponytail 去依賴、原生 memory
的清理、主 session 堆疊太快、station 看不到單一 session 的細節——加上一個前提：文件
必須最新，code 不能是唯一來源。要的是把它們連同原本 `## Ready` 的七條與
`## Needs a decision` 的一條拆成 TODO，相近的放一起。這份記的是拆法怎麼來的、design
gate 上核准了哪些和判斷不同的地方，以及 review 與 verify 各自撈回來什麼。

## 一個判斷，四處偏離

拆法問了一次 `fankeel-judge`，歸檔成判斷 8（`docs/judgements/2026-09-11-todo-split.md`）。
它的答案：分群靠同一個 heading 底下相鄰排列，加〔群組〕前綴，不動 `todo-check` 的三個
heading；細節寫進 `docs/improvement-brief.md` 新的第六部；caveman 的取捨放
Needs a decision，caveman 解耦與 ponytail 的兩條放 Waiting，`lifts when` 指向前一條落地。

design gate 上使用者核准的草稿有四處和判斷不同。這裡是它們在 repository 裡唯一的紀錄：

1. **drift 另立一條。** 判斷 8 的 `not in this task:` 把「文件必須最新、code 不是唯一
   來源」列為前提、不是待辦。草稿另立了〔audit〕那一條，因為 `scripts/docs-audit.js`
   的 drift 只會指向頁面過期，這是一個可以改的行為，不只是前提。
2. **judge 的空答案另立一條。** 見下一節。
3. **archive 桶是 4 份，不是 14 份。** 判斷說 archive 桶有 14 份還掛
   `status: design-intent`；`grep -l` 實測是 4 份，條目寫 4。
4. **既有的 Ready 與 Needs a decision 條目也加前綴。** 判斷建議既有條目原文不動，
   使用者要全部分群。既有的 20 條 Waiting 不加：其中三條加了會超過 200 字，而且那一區
   的戳記代表「有人讀過」，加前綴不算讀過。

前兩次 design gate 使用者都選了「留在 design」。第三次把 20 條原文寫進
`.fankeel/build/todo-split/draft.md`，在選項裡點名那個檔，才一次核准。

## 第一次歸檔是空的

`judge.js record` 要求答案從 stdin 餵進去，不能重打。第一次是從背景 agent 的
`tasks/*.output` 抽——那個檔是 0 bytes——抽到空字串，`record` 照樣歸檔、exit 0，判決檔的
`## Answer` 底下什麼都沒有。發現的時機是 head 和 tail 什麼都沒印出來的那一刻。壞紀錄在
任何 commit 之前刪掉，改從 `subagents/agent-<id>.jsonl` 抽，`cmp` 對過原文才留下。原因與
修法是 Ready 的〔judge〕那一條。

## review 與 verify 撈回來的

| 誰 | 撈到什麼 | 修在 |
|---|---|---|
| build 自己 | 第六部新加的 7 條 `path:line` 沒有同行引文，`docs-check` 不驗它們的行號——正是 Ready 第一條在追的那種缺陷 | `38a8693` 提交前補上 |
| 簡報那一列的 review | §6.2 把 `1239ca79` 的三次倒退寫成三趟 verify 與 build 來回，其實有一次是 audit→build | `f29965c` |
| TODO 那一列的 review | README 的索引列寫「六個方向」，第六部寫五個 | `f29965c` |
| verify 的文件 reader | `docs/README.md` 說簡報只有「三個使用者方向，各一條 TODO」 | `e7f762b` |
| verify 的 adversary | drift 那一條與判斷 8 的 `not in this task:` 矛盾，repository 裡沒有地方對帳 | `e7f762b` 補一句，`e58c588` 改說核准在 design gate，並指向這份紀錄 |
| `e7f762b` 的 review | 那一句讀起來像是判斷 8 核准的；README 說 09-08 的三個方向都在 TODO，但 §4.2、§4.3 已在 09-09 關掉 | `e58c588` |

`scripts/todo-check.js:202`（`target.split('#')[0]`）會丟掉連結的 `#` 片段，所以新的五個
anchor 沒有東西驗。這次用一支一次性的檢查（`.fankeel/build/todo-split/anchors.js`）跑出
紅綠：舊簡報配新 TODO，缺 5 個、exit 1；新簡報配新 TODO，缺 0 個、exit 0。

## 這次沒做

- caveman、ponytail、memory、session、station 的分析本身。這次的交付是條目，分析是那些
  條目自己的工作。
- `###` 分群的實作。〔todo〕那一條只立決定，`todo-check.js` 與 `INIT` 都沒動。
- 把 `.fankeel/build/ask/measure-sessions.js` 升成 `scripts/`。等〔station〕那一條定案再說。
- `judge.js record` 把 brief 的第一行直接當索引列的標題，這次是手動改成「判斷 8：…」的；
  還沒有列成條目。
