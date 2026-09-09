---
status: design-intent
last_verified: 2026-09-09
---

# `/fankeel-ask` Implementation Plan

**Goal:** 注入區塊裡不再有任何一行提到 `fankeel-judge`；要不要花 Fable 的錢，改由使用者打一個指令決定。

**Architecture:** 刪掉 `lib/stages.js` 四個 stage 上的 `JUDGE_RULE` 與它展開的 `{{JUDGE}}` token，刪掉 `lib/profile.js` 的 `judge.enabled` 鍵，新增第九個 skill `skills/fankeel-ask/SKILL.md` 作為唯一入口。`scripts/judge.js` 與 `agents/fankeel-judge.md` 完全不動 —— 有問題的是觸發方式，不是判官本身。

**Tech Stack:** Node（`node --test`，`package.json` 無任何 dependencies）；skill 是純 markdown；`scripts/version.js` 用 `skillFiles()` 找 skill，第九個自動納入版本一致性檢查。

**Spec:** [2026-09-09-fankeel-ask-design.md](2026-09-09-fankeel-ask-design.md)

## Global Constraints

從專案本身取得，不是憑記憶：

- **沒有 `CLAUDE.md` 也沒有 `AGENTS.md`。** `CONTRIBUTING.md` 是慣例寫下來的地方，它自己第一段這樣說。
- **`lib/` 是純邏輯，不得反向依賴。** `CONTRIBUTING.md` 的擁有權表：「Nothing in `lib/` reaches into `scripts/` or `hooks/` — only the other direction.」
- **skill 要薄。** 同表：「Do not copy routing tables, domain rules, or shared conventions out of the skill that owns them and into a wrapper.」新 skill 擁有判官的操作說明，主 skill 只留一句指路。
- **測試用 `node --test`，新檔要先 `git add`。** `tests/source.test.js:18` 讀的是 `git ls-files`，未追蹤的新檔它看不到。
- **注入上限 2400 字元。** `lib/stages.js:105` 的註解與 `tests/render.test.js:553` 的斷言（`assert.ok(size < 2400, ...)`）。這次是淨減，不會逼近上限。
- **版本號由 `scripts/version.js` 寫。** `CONTRIBUTING.md`：「Run it to move the number. It is what keeps ten files in agreement; hand-editing any one of them is how they stop agreeing.」第九個 skill 之後是十一處，這次不動版本號，留給 land。
- **文件歸檔照 `.fankeel/map.md`。** 新頁面在同一次改動裡拿到索引列（`CONTRIBUTING.md` 文件那一列）。
- **`docs/decisions/` 與 `docs/reports/` 記錄時點，不因程式改動而改。** `docs/documents.md:19` 的角色表。

## File structure

| 檔案 | 責任 |
|---|---|
| `lib/stages.js` | 每個 stage 注入哪些規則。這次少一條。 |
| `lib/render.js` | 把規則的 token 換成實際路徑。少一個 token。 |
| `lib/profile.js` | profile 的鍵表與合併。少一個鍵。 |
| `skills/fankeel-ask/SKILL.md` | **新**：判官的唯一入口與操作說明。 |
| `skills/fankeel/SKILL.md` | 主 skill。判官那一節搬走，留一句指路。 |
| `README.md` | 使用者讀的判準：什麼時候值得叫 Fable。 |
| `docs/pipeline.md` `docs/subagents.md` `docs/documents.md` | 三頁 current reference 裡被這次改動弄假的段落。 |
| `docs/README.md` `TODO.md` | 索引列與一條 Waiting。 |

## Task 1: 刪掉判官規則與 `{{JUDGE}}` token

**Files:**
- Modify: `lib/stages.js` — 刪 `JUDGE_RULE` 常數、它上方的註解、四個 `when: [JUDGE_RULE]` 條目、token 表的 `judge` 項
- Modify: `lib/render.js` — 刪 `SCRIPTS` 的 `judge` 項
- Test: `tests/stages.test.js`
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: none
- Produces: none —— 純刪除，`rulesFor(stage, tokens, values)` 與 `render({...})` 的簽章都不變

**Dispatch:** implementer, sonnet

步驟：

1. 先寫失敗的測試。在 `tests/stages.test.js` 末尾加一條，斷言 builtin 層（不傳第三個參數）四個 stage 都不含判官那一行：

   在 `tests/stages.test.js`，新增一條 test：

   ```js
   test('no stage advertises the judge in the builtin layer', () => {
       for (const stage of ['survey', 'design', 'plan', 'build']) {
           const rules = rulesFor(stage, TOKENS);
           assert.ok(!rules.some((r) => /fankeel-judge/.test(r)),
               stage + ' still names fankeel-judge');
       }
   });
   ```

   `TOKENS` 用該檔既有的 token 夾具；若名稱不同，沿用檔案裡其他 `rulesFor` 呼叫用的那一個。
2. 跑 `node --test tests/stages.test.js`，看它紅 —— 今天四個 stage 都含那一行。
3. 刪 `lib/stages.js` 的 `JUDGE_RULE`（`:140`）與 `:132-139` 的註解，四個 `when: [JUDGE_RULE]`（`:234 :262 :289 :314`），以及 `:436` 的 `judge: '{{JUDGE}}'`。四個 stage 其他的 `when` 條目一個都不動。
4. 刪 `lib/render.js:46` `SCRIPTS` 的 `judge: named('judge.js')`。
5. 刪 `tests/stages.test.js` 的 `:188 :693-695 :702-703 :712` 五處 `judge.enabled` 斷言與註解，`tests/render.test.js:206` 的 `{{JUDGE}}` 註解與斷言。
6. `tests/render.test.js:544-545` 的 profile 夾具去掉 `'judge.enabled'` 那兩個欄位（`values` 與 `sources` 各一）。
7. artefact 檢查，兩層同源。在 `tests/render.test.js` 的 `for (const stage of NAMES)` 迴圈裡，`assert.ok(size < 2400, ...)` 那一行之後，加兩行 —— 渲染出來的區塊不含判官，同一個 stage 的 `rulesFor()` 也不含：

   在 `tests/render.test.js`，`assert.ok(size < 2400, ...)` 之後：

   ```js
   assert.ok(!/fankeel-judge/.test(out), stage + ' injection still names fankeel-judge');
   assert.ok(!/fankeel-judge/.test(rulesFor(stage).join(' ')), stage + ' rules still name fankeel-judge');
   ```

   今天 `survey`、`design`、`plan`、`build` 四個 stage 兩層都含，所以這兩行現在紅。兩層同源：規則表與渲染結果對同一件事各答一次，只有一層改掉就會被抓到。
8. 跑 `node --test tests/render.test.js`，把 `t.diagnostic` 印出的七個 stage 字元數記下來 —— 改動前一次、改動後一次，兩組都貼進回報。設計要求「字元數比改前少」。**不要把數字寫成斷言**：這個檔案自己的註解記著三次手寫數字過期的經過，而過期的數字會擋掉正當的加行。
9. 跑 `node --test tests/stages.test.js tests/render.test.js`，全綠。
10. 跑整套 `npm test`。若有測試在斷言 token 表的完整性而紅，那就是設計裡列的「未驗證」那一條，修它並在回報裡說明。

## Task 2: 刪掉 profile 的 `judge.enabled`

**Files:**
- Modify: `lib/profile.js` — `KEYS` 與 summary 的鍵清單
- Test: `tests/profile.test.js`

**Interfaces:**
- Consumes: none
- Produces: none —— `judge.model` 留在 `KEYS` 裡，內建值仍是 `fable`

**Dispatch:** implementer, sonnet

步驟：

1. 先寫失敗的測試。在 `tests/profile.test.js` 加一條，斷言鍵表不再有它：

   在 `tests/profile.test.js`，新增一條 test：

   ```js
   test('judge.enabled is gone; judge.model stays', () => {
       const { values } = profile.read({ projectRoot: fresh(), configDir: null });
       assert.equal(values['judge.enabled'], undefined);
       assert.equal(values['judge.model'], 'fable');
   });
   ```

   `profile.read` 的參數形狀照該檔既有的呼叫寫；重點是斷言的兩行。
2. 跑 `node --test tests/profile.test.js`，看它紅。
3. 刪 `lib/profile.js:22` 的 `'judge.enabled'` 條目，與 `:146` 鍵清單裡的同一個字串。
4. 跑 `node --test tests/profile.test.js`，綠。
5. 跑 `node scripts/task.js profile show`，確認輸出少了那一列、`judge.model fable builtin` 還在，把那一段輸出貼進回報。

## Task 3: 新 skill `skills/fankeel-ask/SKILL.md`

**Files:**
- Modify: `skills/fankeel-ask/SKILL.md` — 新檔，判官的唯一入口
- Read: `skills/fankeel-audit/SKILL.md` — frontmatter 欄位順序與語氣的樣板
- Read: `scripts/judge.js` — `record` 接受的旗標與它拒絕的條件

**Interfaces:**
- Consumes: none
- Produces: `skills/fankeel-ask/SKILL.md`，以及指令名 `/fankeel-ask`，Task 4 至 6 的文字會提到這個名字（名字由設計決定，不等這個 task 產出）

**Dispatch:** in-session —— 這是這次任務的產物本身，語氣、長度與另外八個 skill 的一致性沒有辦法寫進 task 讓別人照抄

步驟：

1. 建目錄與檔案，frontmatter 照 `skills/fankeel-audit/SKILL.md` 的欄位順序：`name`、`description`、`argument-hint`、`version`（與其他八個同號）、`status: current`、`last_verified: 2026-09-09`、`source_of_truth: scripts/judge.js`。
2. 內文寫四件事，順序不可換：寫 brief → 派 `subagent_type: fankeel-judge`、model 讀 profile 的 `judge.model`（永不繼承）→ `node <plugin>/scripts/judge.js record` 用 stdin 餵答案 → 一句話說接受了什麼判斷，回到原本的 stage。
3. 寫明語意是**強制中斷**：它打斷當下的 stage，不開閘門，閘門仍在 stage 結束時由使用者開。
4. 寫明 brief 的路徑 `.fankeel/build/ask/<n>-<slug>-brief.md`，並說它在 `.fankeel/.gitignore` 的 `build/` 之內，所以不新增被忽略的名字。
5. 寫明沒有 active 任務時 `judge.js record` 會拒絕（`scripts/judge.js` 的 `No active entry`），skill 不自己再擋一次。
6. `git add skills/fankeel-ask/SKILL.md` —— `tests/source.test.js` 讀 `git ls-files`，沒 add 的新檔它看不到。
7. 跑 `node scripts/skills-check.js`，必須 exit 0。
8. 跑它的 control：暫時把內文裡的 `<plugin>/scripts/judge.js` 改成一個不存在的檔名，再跑一次，必須 exit 1 並印出 `missing-script: skills/fankeel-ask/SKILL.md:<行> …`；把兩次的輸出都貼進回報，然後改回來。

   **不要用「拿掉 judge.js 引用」當 control。** 那個不會失敗：`judge.js` 不在 `REQUIRED_CORE` 裡，`unnamed-script` 是只報不失敗的那一類，而 `skills/fankeel/SKILL.md` 在 Task 4 之前還點名著它。一個永遠綠的 control 等於沒有 control。

## Task 4: 主 skill 的判官那一節換成一句指路

**Files:**
- Modify: `skills/fankeel/SKILL.md` — 刪 `### The judge` 整節，換一句指向 `/fankeel-ask`

**Interfaces:**
- Consumes: none —— 指令名 `/fankeel-ask` 由設計固定，不等任何 task 產出
- Produces: none

**Dispatch:** implementer, sonnet

步驟：

1. 刪 `skills/fankeel/SKILL.md:1010-1036` 的 `### The judge` 整節（標題連同它下面的五個項目符號）。
2. 在原位置留一句：判官由使用者呼叫 `/fankeel-ask`，操作說明在那個 skill 裡。一句，不複製步驟 —— `CONTRIBUTING.md` 要求 wrapper 不得複製擁有者的規則。
3. `:35` 的目錄樹（`judgements/` 那一行）與 `:393-395` 的閘門點名判斷檔那一段**留著**：那兩處講的是歸檔與閘門，不是觸發。
4. 跑 `node scripts/skills-check.js`，exit 0。
5. 跑 `npm test`，綠。

## Task 5: 三頁 current reference

**Files:**
- Modify: `docs/pipeline.md` — `:325-334` 的 `when` 條款範例
- Modify: `docs/subagents.md` — `:44-71` 的判官段落
- Modify: `docs/documents.md` — `:128` 的 `build/<plan>/` 那一列

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

步驟：

1. `docs/pipeline.md:325-334`：那段用判官當 `when` 條款的範例。判官的例子刪掉，改用同段已經提到的 `land.archivePlan` 兩個 `when` 條目當唯一範例。段落的論點（`when` 有兩種形狀）不變。
2. `docs/subagents.md:44-71`：改寫觸發方式 —— 不再是四個 stage 的條件規則，而是使用者呼叫 `/fankeel-ask`。同段的其餘部分不動：brief 那一行（`lib/render.js` 的 `renderBrief` 給判官的「answer once」）、`record` 的用法、歸檔格式。刪掉 `(lib/stages.js:118-140, JUDGE_RULE)` 這個已經不存在的引用。
3. `docs/documents.md:128`：`build/<plan>/` 那一列補上 `build/ask/`，因為 brief 不再只出現在有 plan 的任務裡。
4. 跑 `node scripts/docs-check.js`，exit 0 —— 它會抓到指向不存在行號的引用。

## Task 6: README 的 Fable 判準

**Files:**
- Modify: `README.md` — 什麼時候值得叫 Fable，與 `/fankeel-ask` 一行

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session —— 判準是這次對話裡談出來的取捨（Fable 每 token 是 Opus 的兩倍，所以只有單次有界呼叫划算），沒有第二個人能從 repo 重寫出來

步驟：

1. 在 `README.md` 既有的指令／腳本表旁邊，加 `/fankeel-ask` 一行。
2. 加一小段判準，寫給使用者讀：哪一類問題值得叫（跨子系統的取捨、判斷型而非查找型、答錯的代價高），哪一類不值得（查得到答案的、範圍已經定死的、只是想要第二意見）。
3. 明說這段是給人讀的，不進注入區塊 —— 進去就變回廣告。
4. 跑 `node scripts/docs-check.js`，exit 0；再跑 `node scripts/map.js --print`，確認 `read first:` 與目錄樹仍然是從 `README.md` 抬出來的 —— 這個檔是 map 的路標來源，改壞了 map 會少一整張樹。

## Task 7: 索引列與一條 Waiting

**Files:**
- Modify: `docs/README.md` — 這份 plan 與它的設計兩列索引
- Modify: `TODO.md` — `## Waiting` 一條

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

步驟：

1. `docs/README.md` 的 plans 區加兩列：`docs/plans/2026-09-09-fankeel-ask-design.md` 與 `docs/plans/2026-09-09-fankeel-ask.md`，照該表既有的格式（路徑、一句話、`design-intent, 繁體中文`）。
2. `docs/README.md:54-55,83,108-111` 不動 —— 那些是 archive 與 decision 頁的索引摘要，記錄的是當時的做法；`## Judgements` 那一段改動後仍然為真。
3. `TODO.md` 的 `## Waiting` 加一條：`judge.js record` 要不要驗證這個 session 底下真的有 `fankeel-judge` 的 subagent transcript，連到 `scripts/judge.js`，結尾 `lifts when: 看到一次宣稱派了卻沒派的歸檔. 09-09.`
4. 跑 `node scripts/todo-check.js`，exit 0 —— 它會抓沒有 `lifts when:` 或沒有日期戳的 Waiting 條目。
5. 跑 `node scripts/docs-check.js`，exit 0。

## Coverage

| promise | task |
|---|---|
| `lib/stages.js:140` 的 `JUDGE_RULE` 常數與 `:132-139` 的註解整段刪除。 | Task 1 |
| `lib/stages.js` 的 `:234 :262 :289 :314` 四個 `when: [JUDGE_RULE]` 條目刪除 | Task 1 |
| `lib/stages.js:436` 的 `judge: '{{JUDGE}}'` token 與 `lib/render.js:46` `SCRIPTS` 的 `judge` 項一併刪除 | Task 1 |
| `lib/profile.js:22` 的 `judge.enabled` 從 `KEYS` 刪除。 | Task 2 |
| `lib/profile.js:146` 的 summary 清單去掉這個鍵；`judge.model` 留著 | Task 2 |
| 不提供替代開關。觸發權在使用者手上，不想派就不要打那個指令；一個只會讓使用者 | Task 2 —— 由「不新增任何開關」滿足，`profile show` 的輸出是證據 |
| 新檔 `skills/fankeel-ask/SKILL.md`，frontmatter 帶 `name`、`description`、`version` | Task 3 |
| 語意是**強制中斷**：在 stage 進行到一半被叫，它打斷當下的工作，派出去，把回來 | Task 3 |
| 四個步驟，順序不可換：寫 brief → 派 `subagent_type: fankeel-judge`、model 讀 | Task 3 |
| brief 寫在 `.fankeel/build/ask/<n>-<slug>-brief.md`。 | Task 3 |
| 沒有 active 任務時不需要自己擋：`judge.js record` 本來就會拒絕 | Task 3 |
| 「什麼時候值得叫 Fable」的判準寫進 `README.md`，不進任何模型每次都讀得到的 | Task 6 |
| `README.md` 同時新增 `/fankeel-ask` 一行，放在既有的腳本／指令表旁邊。 | Task 6 |
| `skills/fankeel/SKILL.md:1010-1036` 的 `### The judge` 整節刪除 | Task 4 |
| `docs/pipeline.md:325-334` 的 `when` 條款範例改用 `land.archivePlan` 那一組 | Task 5 |
| `docs/subagents.md:44-71` 的 judge 段改寫觸發方式 | Task 5 |
| `docs/documents.md:128` 的 `build/<plan>/` 那一列補上 `build/ask/` | Task 5、Task 7（`docs/README.md` 的索引列） |
| `tests/stages.test.js` 的 `:188 :693-695 :702-703 :712` 五處 `judge.enabled` 斷言刪除 | Task 1 |
| `tests/render.test.js` 的 `:206 :539-545` fixture 去掉 `judge.enabled` | Task 1 |
| `tests/profile.test.js` 新增一條：`KEYS` 不含 `judge.enabled`。 | Task 2 |
| artefact 那一列：`render()` 對 `build` 算出的注入區塊，`fankeel-judge` 字串 | Task 1 步驟 7-8 —— 渲染結果與 `rulesFor()` 兩層各斷言一次，字元數改前改後各記一次 |
| `node scripts/skills-check.js` exit 0。它的 control 是可失敗的 | Task 3 |
