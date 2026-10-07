---
status: design-intent
---

# TODO 全表盤點（10-07）：review 檢查寫進 build skill Implementation Plan

**Goal:** 把 2026-10-06 那個 task 被 verify 退回 build 五次、每次由 controller 手加在 prompt 裡的五項 review 檢查，寫成 `skills/fankeel-build/SKILL.md` 的通用規則，各附日期與事件，讓下一個 task 沿用。
**Architecture:** 只有一個 task。五項分放在它們會被執行的地方：「會推翻 verify 列的缺口當場修」放進 task loop 第 6 步（修正回合）；「新欄位每個顯示面都有讀者」「新字串走 i18n」「盤點整個 repo 每個顯示處、每處標記都有經呼叫端渲染且移除就轉紅的測試」放進第 5 步 reviewer 範本的 Part 3；「稱為本次之前就有的 docs-check 列先在基準 commit 上核對」放進收尾的 docs-check 段。`tests/skills.test.js` 加一個測試釘住這五句的位置，並在 `docs/README.md` 補本計畫的索引列。條目 build-5 記在本 task 的 registry `todo` 欄，由 land 關，本計畫不關。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組，`package.json` 沒有 dependencies），`node --test`，fankeel 0.99.0。
**Spec:** [survey.md](../../../.fankeel/build/task-20261007T031053/survey.md)

## Global Constraints

由 `node scripts/map.js`（exit 0；594 份 markdown、14 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- Skill 要保持精簡，不把別的 skill 擁有的規則複製進來（`CONTRIBUTING.md:16`）。這次加的是 build 自己的 review 規則，不碰其他 skill。
- 測試：`node --test`（`package.json` 的 `"test": "node --test"`）。實作者只跑 `node --test tests/skills.test.js tests/agents.test.js`，不跑全套；全套由 `build close` 跑。
- `tests/agents.test.js:122-127` 以 `'Part 2 —'`、`'Part 3 —'`、`'Part 4 —'` 切 reviewer 範本，Part 3 必須仍含 `makes false` 與 `page:line`；新加的文字要放在 Part 3 原文之後、`Part 4 —` 之前，不另開 `Part` 標題。
- `tests/skills.test.js` 用 `read('fankeel-build')`（第 16 行定義）讀 skill；skill 的 `description` 少於 500 字元（`tests/skills.test.js:82`），本計畫不改 frontmatter。
- 新頁要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md:20`）。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）：`skills/fankeel-build/SKILL.md` 781 行、`tests/skills.test.js` 1413 行，都在上限內。
- 縮排跟著檔案走：`tests/skills.test.js` 兩格；skill 的 reviewer 範本在 fence 裡，續行縮五格，與 Part 2、Part 3 原文相同。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit 改，不用 heredoc 或 sed（heredoc 吃反斜線）。
- skill 新文字不寫 `path:line`，事件以 commit sha 引用，避免 docs-check 的行號漂移；commit 寫成 `commit <sha>`，session id 寫成 `session <id>`。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完回報要提交的路徑與訊息。每則 commit 訊息最後一行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Risks

- `node scripts/docs-check.js` 在本計畫開始前就 exit 1（`docs/90-agent/todo/inject-3.md:20` 一句 217 欄太長，另有若干 quote 提醒）— Task 1 — 實作者改完後跑一次，只看有沒有點名 `skills/fankeel-build/SKILL.md` 或 `docs/README.md` 的新列；舊的那一列不是本 task 的，不修。
- 插入的段落會讓 skill 第 467 行之後的行號下移；本計畫寫成時，archive、reports、decisions 以外沒有任何頁面引用 `fankeel-build/SKILL.md` 第 467 行之後的行號（grep 結果為空）— Task 1 — 同上，docs-check 若出現 `moved` 指向這個 skill，回報而不自行改別頁。
- 第 4 項「盤點整個 repo」與 Part 2 既有的選擇器表格有重疊：Part 2 談事件處理器的分支，第 4 項談顯示值的標記 — Task 1 — 插入文字明寫「each mark the change adds」，不重述 Part 2 的選擇器規則。

## Coverage

| promise | task |
|---|---|
| (1) review 找到會推翻 verify 列的缺口當場修，不延後到 gate | Task 1 |
| (2) 新加的資料欄位在每個顯示面都有讀者 | Task 1 |
| (3) 新字串走 i18n，不寫死 | Task 1 |
| (4) 盤點整個 repo 每個顯示被改動值的地方（頁面與 CLI 都算），不限一個檔，每處標記都有經呼叫端渲染、移除就轉紅的測試 | Task 1 |
| (5) 稱為「本次之前就有」的 docs-check 列，先在基準 commit 上核對 | Task 1 |
| 各附日期與事件，比照該段既有寫法 | Task 1 |
| 完成條件：五項寫進 skill；skills-check 與全套測試通過 | Task 1（skills-check 與相關測試）；全套由 `build close` |

## Task 1: 五項 review 檢查寫進 build skill

**Files:**
- Modify: `skills/fankeel-build/SKILL.md` — 第 6 步加一段、reviewer 範本 Part 3 加一段、docs-check 收尾段加一段
- Modify: `docs/README.md` — 10-05 盤點計畫那列之後補本計畫的索引列
- Test: `tests/skills.test.js` — 檔尾加一個測試

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 計畫帶著要插入的全文，照抄加一個測試。

1. 先寫會紅的測試。在 `tests/skills.test.js` 檔尾（最後一個 `test(...)` 之後，空一行）加入：

   `tests/skills.test.js`，檔尾：

   ```js
   // docs/90-agent/plans/2026-10-07-review-checks-in-build.md Task 1.
   // On 2026-10-06 verify sent one task back to build five times, and each time
   // the controller added a review check to the build prompt by hand; it lived
   // only for that round. Each check is pinned to the step that runs it.
   test('build review carries the five checks verify kept sending back on 2026-10-06', () => {
     const build = read('fankeel-build');
     const step6 = /\n6\. Fix rounds[\s\S]*?\n7\. /.exec(build);
     assert.ok(step6, 'step 6 of the build loop is not where this test looks for it');
     assert.match(step6[0].replace(/\s+/g, ' '), /A finding that would defeat a verify row is fixed in this task, now\./);
     const part3 = /\n {3}Part 3 —[\s\S]*?\n {3}Part 4 —/.exec(build);
     assert.ok(part3, 'Part 3 of the review template is not where this test looks for it');
     const p3 = part3[0].replace(/\s+/g, ' ');
     assert.match(p3, /not the changed file alone/);
     assert.match(p3, /reads the new field/);
     assert.match(p3, /string table for translation/);
     assert.match(p3, /goes red when the mark is removed/);
     const close = /\n\*\*Then docs-check, at close\.\*\*[\s\S]*?\n## /.exec(build);
     assert.ok(close, 'the docs-check close is not where this test looks for it');
     assert.match(close[0].replace(/\s+/g, ' '), /checked on the build's first BASE/);
   });
   ```

2. 跑 `node --test tests/skills.test.js`，看新測試失敗（第一個 `assert.match` 紅，訊息裡有 `fixed in this task, now`）。

3. 在 `skills/fankeel-build/SKILL.md` 第 6 步，找到這兩行：

   ```text
   6. Fix rounds are bounded at **five**. A finding you overrule is a ruling, not a
      silence.
   ```

   在它之後、`When the fifth round ends with findings still open` 那段之前，空一行插入（`skills/fankeel-build/SKILL.md`，第 6 步）：

   ```md
      **A finding that would defeat a verify row is fixed in this task, now.**
      When a reviewer's finding — or one the parent sees in its return — names
      something verify will test this task against (a mark missing from a
      display, a test that stays green when its branch is removed, a citation
      off by a line), it goes into this task's next fix round. It is never
      written up as a note for the gate, a ruling, or a later task while
      rounds remain: verify finds it again, and the work comes back to this
      loop as a defeated row at the cost of a whole verify pass. (2026-10-06:
      the task that prices an unknown model id from its family, commit
      dde0f1fb, came back from verify five times; each time the controller
      added one review check to the build prompt by hand, this one among
      them, and each lived only for that round.)
   ```

4. 在 `skills/fankeel-build/SKILL.md` 第 5 步的 reviewer 範本裡，找到 Part 3 的最後一行：

   ```text
        flag) as `page:line`.
   ```

   在它之後、以 `Part 4 — cuts` 開頭的那行之前插入（`skills/fankeel-build/SKILL.md`，reviewer 範本 Part 3，續行縮五格）：

   ```md
        Then, where the diff adds a data field or changes a value a person
        sees, three more, over the whole repository and not the changed
        file alone: (a) every surface that shows the record reads the new
        field — grep its name across lib/, scripts/, hooks/ and assets/ and
        name each page and CLI output that shows the record but never
        reads it; (b) every new string a person reads goes through the
        project's string table for translation, never written into a
        render as a literal; (c) list every place a page or a CLI prints
        the changed value, and for each mark the change adds there, the
        test that renders it through its caller and goes red when the mark
        is removed. A surface with no reader, a literal string, or a place
        with no such test is a finding. (2026-10-06: the estimated mark on
        family-priced spend reached the station page, the spend bucket
        table, the quota calibration line and the stage curve one verify
        return at a time — commits f25995cc, 02b1e174, 83f7710b, 2b5951df,
        7b17034d, 05dd0250; f25995cc also gave day and loop rows a new
        estimated field, and 7b17034d replaced a hard-coded "est." with
        the page's string table.)
   ```

5. 在 `skills/fankeel-build/SKILL.md` 的 `**Then docs-check, at close.**` 段，找到三個 tier 的最後一項的結尾：

   ```text
      a historical citation in a write-once page (a decision, an archive, a
      report) is recorded as a ruling with `ledger.js ruling`, never edited to
      turn the check green.
   ```

   在它之後、以 `The` 加上 docs-check 行說明開頭的那段（「The `docs-check:` line of the output says what came of it.」）之前，空一行插入（`skills/fankeel-build/SKILL.md`，docs-check 收尾段）：

   ```md
   A finding the report would call older than this build — not this build's
   to fix — is checked on the build's first BASE before it is called that:
   open the citing page and its target with `git show <BASE>:<path>` at the
   cited line, and only a citation broken there too may be reported as
   earlier. One that held at BASE is this build's, and goes to the tiers
   above. (2026-10-06: the controller added this check to the build prompt
   by hand on one of the same five returns from verify.)
   ```

6. 在 `docs/README.md` 找到這一列：

   ```text
   | TODO 全表盤點（10-05）的 plan：壓縮重試最多三次的測試、`/fankeel` 頁面寫不出來時 station 行說出來、兩處 timeout 與行號小錯、brain 選模型改放 Watch | [plans/2026-10-05-todo-patrol-ready-three.md](90-agent/plans/2026-10-05-todo-patrol-ready-three.md) — *design-intent, 繁體中文* |
   ```

   在它下一行加入（`docs/README.md`，緊接上一列）：

   ```md
   | TODO 全表盤點（10-07）的 plan：把 verify 五次退回時手加在 prompt 的五項 review 檢查寫進 build skill | [plans/2026-10-07-review-checks-in-build.md](90-agent/plans/2026-10-07-review-checks-in-build.md) — *design-intent, 繁體中文* |
   ```

7. 跑 `node --test tests/skills.test.js tests/agents.test.js`，全過；跑 `node scripts/skills-check.js`，exit 0；跑 `node scripts/docs-check.js`，確認沒有新列點名 `skills/fankeel-build/SKILL.md` 或 `docs/README.md`（舊的 `inject-3.md` 那列不是本 task 的）。

8. 不 commit。回報三個路徑：`skills/fankeel-build/SKILL.md`、`docs/README.md`、`tests/skills.test.js`；新測試的 mutation 行寫成 `build review carries the five checks … — red when: 刪掉第 6 步插入段的粗體首句`；建議的訊息：

   ```text
   docs: write verify's five review checks into the build skill

   - skills/fankeel-build/SKILL.md: step 6 fixes a finding that would defeat a verify row now; review Part 3 walks every display for readers, i18n and caller-rendered marks; docs-check close checks "older" rows at BASE
   - tests/skills.test.js: pins each check to the step that runs it
   - docs/README.md: index row for the plan

   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   ```
