---
status: design-intent
---

# ponytail 收錄 Implementation Plan

**Goal:** 把 ponytail 的 review、audit 的程式碼那一半與 ladder 寫成 fankeel 自己的，拔掉 `has('ponytail')`，刪除 `lib/plugins.js`。

**Architecture:** `agents/fankeel-reviewer.md` 新增 `## Cuts` 一節，把五個刪減標籤定義一次；build 模板的 Part 4 與 audit 的三個 lens 都指向它。audit 的注入規則以固定句取代 `{{PONYTAIL}}` render token，`lib/render.js` 不再讀外掛清單。ladder 只寫在 design skill。`docs-check` 對 report 的路徑比照 decision 處理，因為刪檔會讓一份 report 被標成 `gone`。

**Tech Stack:** Node.js，`node --test`，零執行期相依。

**Spec:** [2026-09-12-ponytail-absorb-design.md](2026-09-12-ponytail-absorb-design.md)

## Global Constraints

從 `CONTRIBUTING.md`、`package.json`、`docs/development.md`、`.fankeel/map.md` 與測試套件取得，值照抄：

- 測試指令是 `npm test`，展開為 `node --test`。`package.json` 沒有 `dependencies` 也沒有 `devDependencies`，**不得新增任何相依**。
- `lib/*.js` 是純函式，不得引用 `scripts/` 或 `hooks/`（`CONTRIBUTING.md:28`）。
- 每個 export 的名字都要有 importer；新檔要先 `git add` 才會被 `tests/source.test.js` 看見（`CONTRIBUTING.md:32`）。本計畫不新增檔案，`lib/plugins.js` 以 `git rm` 刪除。
- 測試要暫存目錄一律經由 `tests/tmp.js` 的 `tmp(prefix)`，不得自行 `mkdtempSync`。
- 每個 stage 的注入上限：`tests/render.test.js:530` 的 `assert.ok(size < 2400, ...)`。
- `skills/registry.json` 是生成的：改了 `lib/stages.js` 的規則就跑 `node scripts/stage-registry.js`，否則 `tests/stage-registry.test.js:21` 的 `skills/registry.json is exactly what regenerating it produces` 紅。audit 的 `prompt_byte_budget` 是 2500，今天的 `prompt_bytes` 是 2424。
- agent 檔：`tests/agents.test.js` 要求 frontmatter 的 `name` 等於檔名、`tools` 是非空 list、`model` 有值；`fankeel-reviewer` 不得列 `Edit`、`Write`、`NotebookEdit`。
- 文件歸檔照 `.fankeel/map.md`：`docs` 是 reference、`docs/plans` 是 plan、`docs/decisions` 是 decision、`docs/reports` 是 report、`docs/archive` 是 archive。**新增或改名的頁面要在同一個 change 補上 `docs/README.md` 的索引列**（`CONTRIBUTING.md:33`）。
- decision、report、archive 是有日期的紀錄，內容不改。decision 可以加一行 `*(Superseded <date>: <what>)*` 註記，原句不動（先例：`docs/plans/2026-09-08-ready-and-station-serve.md:549`）。
- `docs-check` 對 reference 與 report 檢查路徑是否存在（`scripts/docs-check.js:282`），對 reference 檢查 `name()` 形式的符號（`scripts/docs-check.js:351-358`），並檢查帶引文的 `path:line`。今天 exit 0。`todo-check` 今天 exit 0，25 條。
- 版號一律跑 `scripts/version.js`，本計畫不動版號。
- 縮排照各檔現狀：`lib/`、`scripts/`、`tests/agents.test.js`、`tests/source.test.js` 四格；`tests/route.test.js`、`tests/stages.test.js`、`tests/render.test.js`、`tests/skills.test.js`、`tests/docs-check.test.js` 兩格。
- commit 訊息照 git log 的樣子：`type: subject`，英文小寫，一段 body，最後一行 `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`。派出去的 implementer 不 commit，由 parent 做。
- 基準是 `4b3cd56`，`ℹ pass 1426 / ℹ fail 0`，存於 `.fankeel/build/2026-09-12-ponytail-absorb/baseline-test.txt`。Task 1 刪四個測試，Task 2、4、5、6 各加一個，收尾預期 `ℹ pass 1426 / ℹ fail 0`；數字不同時要能說出差在哪。

## File structure

| 檔案 | 負責什麼 |
|---|---|
| `lib/stages.js` | 每個 stage 的規則。:352 是 audit 的雙週規則，:436-443 是 `RENDER_TOKENS` |
| `lib/render.js` | 把規則渲染成注入。:20 require `lib/plugins.js`，:96-110 是 `ponytailLine`，:133 傳值，:383 export |
| `lib/plugins.js` | 讀 `installed_plugins.json`。唯一 production caller 是 `lib/render.js`，本計畫刪除 |
| `skills/registry.json` | 由 `scripts/stage-registry.js` 生成 |
| `agents/fankeel-reviewer.md` | 唯讀 reviewer 的系統提示。新增 `## Cuts` |
| `skills/fankeel-build/SKILL.md` | :280-310 是 per-task reviewer 的模板 |
| `skills/fankeel-audit/SKILL.md` | :176-179 是程式碼那一半 |
| `skills/fankeel/SKILL.md` | :482 與 :510-516 是程式碼那一半的摘要 |
| `skills/fankeel-design/SKILL.md` | :64-70 是第 2 步 |
| `skills/fankeel-land/SKILL.md` | :187-190 是解除安裝那段 |
| `lib/live.js`、`scripts/docs-audit.js` | 各有一句點名 ponytail 的註解 |
| `scripts/docs-check.js` | :266-282 是依 role 決定要不要檢查路徑 |
| `docs/pipeline.md`、`docs/subagents.md`、`docs/improvement-brief.md` | reference 頁 |
| `docs/decisions/fankeel-shell.md` | 論證外掛偵測的 decision |
| `TODO.md`、`docs/README.md` | 索引 |

## Task 1: audit 規則的固定句，刪除 `lib/plugins.js`

**Files:**
- Modify: `lib/stages.js` — :352 的 `{{PONYTAIL}}` 換成固定句；:436-443 的註解與 `RENDER_TOKENS`
- Modify: `lib/render.js` — :20 的 require、:96-111 的註解與 `ponytailLine`、:133 的 `ponytail:` 值、:383 的 export
- Modify: `lib/plugins.js` — 整檔以 `git rm` 刪除
- Modify: `skills/registry.json` — 以 `node scripts/stage-registry.js` 重新產生
- Test: `tests/stages.test.js`
- Test: `tests/route.test.js`
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: none
- Produces: audit 規則裡的固定句 `Code half: three reviewers by lens, cuts only.`，Task 7 的文件引用它

**Dispatch:** implementer, sonnet — 計畫已帶著每一處程式碼；抄寫加測試。

步驟：

1. 先改測試。在 `tests/stages.test.js`，把 :100-102 這三行：

```js
// line by line. Most of that list was already here in one form or another, and
// the delegation is deliberate where it is not: over-engineering is ponytail's
// subject, and the audit rules name it rather than restating it.
```

換成（`tests/stages.test.js`）：

```js
// line by line. Most of that list was already here in one form or another, and
// over-engineering is the one subject left out on purpose: audit's code half
// owns it, and these rules name it rather than restating it.
```

2. 同一個檔 `tests/stages.test.js`，把 :228-231：

```js
  // The code half is named through a token now, because whether it can be named
  // at all depends on the machine. The wording either branch produces is checked
  // in tests/route.test.js against a manifest with and without ponytail in it.
  assert.match(text, /\{\{ponytail\}\}/);
```

換成（`tests/stages.test.js`；`text` 在這個測試裡已經 `toLowerCase()` 過）：

```js
  // The code half is a fixed sentence: nothing about it depends on the machine.
  assert.match(text, /code half: three reviewers by lens, cuts only\./);
```

3. 同一個檔 `tests/stages.test.js`，把 :323-331：

```js
// `land` used to carry "run /ponytail-audit if the change was large enough",
// which is the audit stage's own rule arriving one stage late.
test('no stage repeats another stage tool', () => {
  // Case-insensitive on the negative side: the audit rule carries the token
  // `{{PONYTAIL}}` now, and a `land` rule that grew one would slip past a
  // lowercase-only check.
  assert.doesNotMatch(byName('land').rules.join(' '), /ponytail/i);
  assert.match(byName('audit').rules.join(' '), /\{\{PONYTAIL\}\}/);
});
```

換成（`tests/stages.test.js`）：

```js
// `land` used to carry "run the code audit if the change was large enough",
// which is the audit stage's own rule arriving one stage late.
test('no stage repeats another stage tool', () => {
  // Case-insensitive on the negative side, so a `land` rule that grew the
  // sentence in another case would not slip past.
  assert.doesNotMatch(byName('land').rules.join(' '), /code half/i);
  assert.match(byName('audit').rules.join(' '), /Code half: three reviewers by lens, cuts only\./);
});
```

4. 跑 `node --test tests/stages.test.js`，看它失敗：`the discipline covers the captured requirements` 與 `no stage repeats another stage tool` 兩個紅。

5. 在 `lib/stages.js`，:352 整行換成：

```js
            'Every fortnight, `node {{DOCS_AUDIT}}` runs the deep pass, one reader per pair, then offers cleanup. Code half: three reviewers by lens, cuts only.',
```

6. 同一個檔 `lib/stages.js`，把 :436-443：

```js
// Filled by `lib/render.js` rather than by a path, because both depend on
// something only the running machine knows: which stage comes next on this
// task's route, and which of the plugins `audit` can call on is installed.
const RENDER_TOKENS = {
    next: '{{NEXT}}',
    ponytail: '{{PONYTAIL}}',
    profileLand: '{{PROFILE_LAND}}',
};
```

換成（`lib/stages.js`）：

```js
// Filled by `lib/render.js` rather than by a path, because both depend on
// something only the running session knows: which stage comes next on this
// task's route, and what the project's profile answered for `land`.
const RENDER_TOKENS = {
    next: '{{NEXT}}',
    profileLand: '{{PROFILE_LAND}}',
};
```

7. 在 `lib/render.js`：刪掉 :20 的 `const { has } = require('./plugins.js');`；刪掉 :96 的 `// The code half of the fortnightly pass belongs to a plugin, and the rule said` 起、到 :110 的 `    : 'Nothing installed here does the code half; say so rather than skipping it.');` 為止，連同後面那一行空行；:133 裡的 `Object.assign({ next, ponytail: ponytailLine(), profileLand: profileLib.landClause(values || {}) }, SCRIPTS)` 改成 `Object.assign({ next, profileLand: profileLib.landClause(values || {}) }, SCRIPTS)`。行號以刪除前為準，由下往上刪。

8. 同一個檔 `lib/render.js`，:383 的 export 那行改成：

```js
module.exports = { render, renderInit, renderResume, renderCarry, renderBrief, RETURN_RULES, SCRIPTS, PLUGIN_ROOT, PLUGIN_MARK, SURVEY_SCRIPT, TODO_CHECK_SCRIPT };
```

9. `git rm lib/plugins.js`。

10. 在 `tests/route.test.js`：先刪 :192-241，也就是從 `// --- plugin detection ------------------------------------------------------` 起，到 `the audit rule names ponytail only where ponytail is installed` 那個測試的 `});` 與它後面的空行為止（四個測試）；再刪 :17-18 的 `const plugins = require('../lib/plugins.js');` 與 `const render = require('../lib/render.js');`——`grep -n "render\." tests/route.test.js` 今天只印 :237-239，刪完以後 `render` 在這個檔裡沒有用處。

11. 在 `tests/render.test.js`，把 :611-612：

```js
// about cutting what the ask does not require, nor `audit`, which delegates
// over-engineering to ponytail.
```

換成（`tests/render.test.js`）：

```js
// about cutting what the ask does not require, nor `audit`, whose code half
// reviews for over-engineering.
```

12. 重新產生 registry 並看 audit 的大小，第二行必須印出不大於 `2424` 的數字：

```
node scripts/stage-registry.js
node -e "console.log(require('./skills/registry.json').stages.find((s) => s.name === 'audit').prompt_bytes)"
```

13. 產出物檢查。渲染 audit 階段的注入，必須印 `ok`。改之前，在裝著 ponytail 的機器上它印 `FAIL`；印 `NO AUDIT RULES` 表示沒有渲染到 audit 的規則，這個檢查就不算數：

```
node -e "const { render } = require('./lib/render.js'); const now = new Date().toISOString(); const t = render({ mine: { sessionId: 'aaaaaaaa-0000-0000-0000-000000000000', data: { task: 't', stage: 'audit', class: 'architectural', route: ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'], active: true, started: now, updated: now } }, others: [], now: Date.now(), root: process.cwd(), launch: process.cwd() }); console.log(!t.includes('deep pass') ? 'NO AUDIT RULES' : /\{\{|ponytail/i.test(t) ? 'FAIL' : 'ok')"
```

14. 跑 `node --test tests/stages.test.js tests/route.test.js tests/render.test.js tests/stage-registry.test.js tests/source.test.js`，全綠；再跑 `npm test`。

15. 回報 mutation 行：把 `lib/stages.js:352` 的固定句改回 `{{PONYTAIL}}`，`the discipline covers the captured requirements` 與 `no stage repeats another stage tool` 轉紅。

16. Commit（parent 做）：`refactor: the audit rule stops reading the plugin manifest`。

## Task 2: reviewer 的 `## Cuts`，build 模板的 Part 4

**Files:**
- Modify: `agents/fankeel-reviewer.md` — frontmatter 的 `description` 與 `last_verified`，新增 `## Cuts`，改寫 `## Return`
- Modify: `skills/fankeel-build/SKILL.md` — :304-309 模板加 Part 4，改寫 RETURN
- Test: `tests/agents.test.js`
- Read: `docs/decisions/fankeel-shell.md` — `## One caller is not evidence on its own`，`## Cuts` 連到它，不改

**Interfaces:**
- Consumes: none
- Produces: `agents/fankeel-reviewer.md` 的 `## Cuts` 一節與五個標籤 `delete:`、`stdlib:`、`native:`、`yagni:`、`shrink:`，Task 3 引用

**Dispatch:** implementer, sonnet — 計畫已帶著全文；抄寫加一個測試。

步驟：

1. 先寫失敗的測試。在 `tests/agents.test.js` 檔尾加上：

```js
// The five cut tags are defined here once. Build's Part 4 and audit's code
// half both point at this section rather than restating it, so a tag that
// went missing here would go missing from both.
test('the reviewer carries the cut tags build and audit ask for', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reviewer.md'), 'utf8');
    assert.match(text, /^## Cuts$/m);
    for (const tag of ['delete:', 'stdlib:', 'native:', 'yagni:', 'shrink:']) {
        assert.ok(text.includes('`' + tag + '`'), 'the reviewer does not define ' + tag);
    }
    assert.match(text, /net: -<N> lines possible\./);
    const build = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-build', 'SKILL.md'), 'utf8');
    assert.match(build, /Part 4 — cuts/);
});
```

2. 跑 `node --test tests/agents.test.js`，看新測試紅。

3. 在 `agents/fankeel-reviewer.md`，frontmatter 的 `description:` 那行換成：

```md
description: Read-only reviewer for the plan review, build's per-task review, verify's adversary and audit's code half — reads a diff, a brief, an evidence table or the whole tree against what it was supposed to prove, and returns only what it defeats and, when asked, what could be cut. Cannot call Edit, Write or NotebookEdit.
```

`last_verified: 2026-09-11` 改成 `last_verified: 2026-09-12`。

4. 同一個檔 `agents/fankeel-reviewer.md`，在 `## Refusals` 那節之後、`## Return` 之前插入：

```md
## Cuts

When the brief asks for cuts — build's Part 4, or one lens of audit's code
half — read for what could be deleted, not for what is wrong. One line per
cut:

`path:line: <tag> <what to cut>. <what replaces it>.`

| tag | cuts | replaced by |
|---|---|---|
| `delete:` | dead code, flexibility nobody uses, a speculative feature | nothing |
| `stdlib:` | a hand-rolled thing the standard library ships | that function, named |
| `native:` | a dependency, or code, doing what the platform already does | that feature, named |
| `yagni:` | an abstraction with one implementation, config nobody sets, a layer with one caller | inlining it |
| `shrink:` | the same logic in more lines than it needs | the shorter form, shown |

End with `net: -<N> lines possible.`, or the single word `lean` when nothing
can go. A smoke test or an `assert` self-check is never a cut. A module with
one caller is a `yagni:` only when folding it would neither move a dependency
the caller does not otherwise have nor put a unit test behind a process spawn —
[docs/decisions/fankeel-shell.md](../docs/decisions/fankeel-shell.md), under
*One caller is not evidence on its own*. Correctness, security and performance
are never cuts; they belong to the parts of the brief that ask for them.

```

5. 同一個檔 `agents/fankeel-reviewer.md`，`## Return` 底下那段換成：

```md
Only what you defeat, and why — one line per finding, most serious first, or
the single word `clean`. When the brief asks for cuts, they follow in the
`## Cuts` format, ending with its `net:` line or `lean`. Every line you return
stays in the parent's context for the rest of the session.
```

6. 在 `skills/fankeel-build/SKILL.md`，:304-305 的 Part 3 兩行後面緊接著（不空行）加上：

```md
   Part 4 — cuts, over the lines this diff added and no others, in the
     format of the `## Cuts` section of your agent file. A cut is a finding.
```

7. 同一個檔 `skills/fankeel-build/SKILL.md`，把 RETURN 那段（:307-309）：

```md
   RETURN, and nothing else: one line per finding as `path:line — <the
   problem>`, most serious first, or the single word `clean`. Every line you
   return stays in a long-running parent context for the rest of the session.
```

換成（`skills/fankeel-build/SKILL.md`）：

```md
   RETURN, and nothing else: one line per finding as `path:line — <the
   problem>`, most serious first, then Part 4's cuts and their `net:` line —
   or the single word `clean` when Parts 1-3 found nothing and Part 4 found
   nothing to cut. Every line you return stays in a long-running parent
   context for the rest of the session.
```

8. 跑 `node --test tests/agents.test.js tests/skills.test.js`，全綠（`tests/skills.test.js` 的 `KNOWN_LEDGER_PARAGRAPHS` 列著 `   Part 1 — against the brief and the coverage rows, in this`；Part 4 接在同一段裡，段首不變）。

9. 回報 mutation 行：刪掉 `## Cuts` 表格的 `shrink:` 那一列，`the reviewer carries the cut tags build and audit ask for` 轉紅。

10. Commit（parent 做）：`feat: the reviewer defines five cut tags, and build's review asks for them`。

## Task 3: audit 的程式碼那一半是三個 reviewer lens

**Files:**
- Modify: `skills/fankeel-audit/SKILL.md` — :176-179 整段換掉
- Modify: `skills/fankeel/SKILL.md` — :482 一行、:510-516 的表格
- Test: `tests/skills.test.js`
- Read: `agents/fankeel-reviewer.md` — Task 2 寫的 `## Cuts`，這裡的文字指向它，不改

**Interfaces:**
- Consumes: `## Cuts` 與五個標籤（Task 2）
- Produces: none

**Dispatch:** implementer, sonnet — 計畫已帶著全文；抄寫加一條斷言。

步驟：

1. 先改測試。在 `tests/skills.test.js`，:107 這行：

```js
  assert.match(text, /ponytail-audit/, 'the code half goes unmentioned');
```

換成（`tests/skills.test.js`）：

```js
  assert.match(text, /three `fankeel-reviewer`/, 'the code half goes unmentioned');
  assert.match(text, /## Cuts/, 'the code half names no cut format');
```

2. 跑 `node --test tests/skills.test.js`，看 `the audit skill runs both scanners and ends at the gate` 紅。

3. 在 `skills/fankeel-audit/SKILL.md`，把 :176-179：

```md
If `/ponytail-audit` is installed, it is the code half of the same fortnightly
pass — orphan files, over-engineering, abstractions nobody uses. Offer it
alongside. If it is not installed, say so plainly rather than quietly skipping
the code half.
```

換成（`skills/fankeel-audit/SKILL.md`）：

```md
The code half of the same fortnightly pass is three `fankeel-reviewer`
dispatches, each over the whole tree, each asked for cuts only in the format
of the `## Cuts` section of its agent file, one lens apiece: what nothing
needs (`delete:`, `yagni:`), what something else already does (`stdlib:`,
`native:`), and what fewer lines would do (`shrink:`). By lens, never by
directory — a reviewer holding a third of the tree cannot see the caller in
another third, which is [docs/subagents.md](../../docs/subagents.md)'s case
against slicing. Rank what comes back by its `net:` line and offer it at the
gate beside the documentation findings; never apply a cut unasked.
```

4. 在 `skills/fankeel/SKILL.md`，:482 這行：

```md
The documentation half of the pass whose code half is `/ponytail-audit`, and the
```

換成兩行（`skills/fankeel/SKILL.md`；:483 的 `same cadence: ...` 不動，接在後面）：

```md
The documentation half of the pass whose code half is three `fankeel-reviewer`
lenses asking for cuts, and the
```

5. 同一個檔 `skills/fankeel/SKILL.md`，把 :510-516：

```md
For the *code* half, use what is installed:

| | |
|---|---|
| ponytail installed | `/ponytail-audit` for the repository, `/ponytail-review` for a diff. Its scope is over-engineering only — it says nothing about documents. |
| graphify or codegraph installed | query the graph rather than grepping. |
| none of them | say so plainly and read the diff yourself. Do not pretend a check ran. |
```

換成（`skills/fankeel/SKILL.md`）：

```md
For the *code* half:

| | |
|---|---|
| always | three `fankeel-reviewer` lenses over the whole tree, cuts only — the fankeel-audit skill names them. Its scope is over-engineering only — it says nothing about documents. |
| graphify or codegraph installed | query the graph rather than grepping. |
```

6. 跑 `node --test tests/skills.test.js`，全綠；再跑 `node scripts/skills-check.js`，exit 0。

7. 回報 mutation 行：把 `skills/fankeel-audit/SKILL.md` 的 `three \`fankeel-reviewer\`` 改成 `two \`fankeel-reviewer\``，`the audit skill runs both scanners and ends at the gate` 轉紅。

8. Commit（parent 做）：`feat: audit's code half is three reviewer lenses over the whole tree`。

## Task 4: design skill 的 ladder

**Files:**
- Modify: `skills/fankeel-design/SKILL.md` — :70 之後加五階
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — 一段 Edit 加一個測試，派工的系統提示比工作本身貴。

步驟：

1. 先寫失敗的測試。在 `tests/skills.test.js`，`the audit skill runs both scanners and ends at the gate` 那個測試的 `});` 後面加上：

```js
// The ladder in design's step 2. Order is the rule: the first rung that holds
// is where the design stops, so a rung moved below another is a changed rule.
test('the design skill carries the ladder, first rung first', () => {
  const text = read('fankeel-design');
  let at = -1;
  for (const rung of ['It need not exist', 'The standard library already does it', 'The platform does it natively', 'A dependency does it', 'Then the fewest lines that work']) {
    const i = text.indexOf(rung);
    assert.ok(i > at, rung + ' is missing, or sits above the rung before it');
    at = i;
  }
});
```

2. 跑 `node --test tests/skills.test.js`，看新測試紅。

3. 在 `skills/fankeel-design/SKILL.md`，:68-70 的 `Cut ruthlessly: ...` 那段之後、`### 3. The mockup — frontend work only` 之前，插入：

```md

Before anything is added, stop at the first rung that holds:

1. It need not exist — the ask does not require it.
2. The standard library already does it.
3. The platform does it natively.
4. A dependency does it — one the project already has before a new one.
5. Then the fewest lines that work.
```

4. 跑 `node --test tests/skills.test.js`，全綠。

5. 回報 mutation 行：把第 2 與第 3 階對調，`the design skill carries the ladder, first rung first` 轉紅。

6. Commit：`docs: the design skill carries the five-rung ladder`。

## Task 5: 沒有 shipped 檔點名 ponytail

**Files:**
- Modify: `lib/live.js` — :34 拿掉 `ponytail:` 前綴
- Modify: `scripts/docs-audit.js` — :14-16 的註解
- Modify: `skills/fankeel-land/SKILL.md` — :187-190 那段
- Test: `tests/source.test.js`
- Read: `lib/render.js` — Task 1 已拿掉 ponytail；新測試掃它，不改
- Read: `lib/stages.js` — 同上
- Read: `skills/fankeel-audit/SKILL.md` — Task 3 已拿掉 ponytail；新測試掃它，不改
- Read: `skills/fankeel/SKILL.md` — 同上

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 三句註解與一個測試，計畫已帶著全文。

步驟：

1. 先寫失敗的測試。在 `tests/source.test.js` 檔尾加上：

```js
// Three of ponytail's skills became fankeel's own on 2026-09-12 — the
// reviewer's `## Cuts`, audit's three lenses, design's ladder — and the
// module that read the install manifest to pick one sentence went with them.
// A name that grows back in a comment is the coupling returning as prose
// first. The length check is the control: an empty scan would pass too.
test('no shipped file names ponytail', () => {
    const shipped = ['lib', 'scripts', 'hooks', 'agents', 'skills', 'output-styles', 'assets', '.claude-plugin']
        .flatMap((dir) => tracked(dir));
    assert.ok(shipped.length > 50, 'git ls-files found ' + shipped.length + ' files to scan');
    const naming = shipped.filter((rel) => /ponytail/i.test(fs.readFileSync(path.join(ROOT, rel), 'utf8')));
    assert.deepEqual(naming, []);
});
```

2. 跑 `node --test tests/source.test.js`，看新測試紅，`naming` 恰好是 `lib/live.js`、`scripts/docs-audit.js`、`skills/fankeel-land/SKILL.md` 三個（Task 1 與 Task 3 已落地的前提下）。多出任何一個都停下來回報，不要順手改。

3. 在 `lib/live.js`，:34 的 `// ponytail: pid reuse is the ceiling. \`procStart\` on each entry is the field that` 改成 `// Pid reuse is the ceiling. \`procStart\` on each entry is the field that`。

4. 在 `scripts/docs-audit.js`，把 :14-16：

```js
// It is the documentation half of the fortnightly pass whose code half is
// `/ponytail-audit`. Same cadence, same bargain: you do not run it on a typo fix,
// and you do not skip it for a quarter.
```

換成（`scripts/docs-audit.js`）：

```js
// It is the documentation half of the fortnightly pass whose code half is
// three `fankeel-reviewer` lenses asking for cuts. Same cadence, same bargain:
// you do not run it on a typo fix, and you do not skip it for a quarter.
```

5. 在 `skills/fankeel-land/SKILL.md`，把 :187-190：

```md
**Neither is uninstalling a plugin this session decoupled from.** Removing
caveman or ponytail after their code has been unhooked is the user's own
command, offered here rather than run — say what was decoupled and that it
can now be removed, and stop there.
```

換成（`skills/fankeel-land/SKILL.md`）：

```md
**Neither is uninstalling a plugin this session decoupled from.** Removing
one after its code has been unhooked is the user's own command, offered
here rather than run — say what was decoupled and that it can now be
removed, and stop there.
```

6. 跑 `node --test tests/source.test.js tests/skills.test.js`，全綠。

7. 回報 mutation 行：把 `ponytail:` 放回 `lib/live.js:34`，`no shipped file names ponytail` 轉紅。

8. Commit（parent 做）：`test: no shipped file names ponytail`。

## Task 6: `docs-check` 把 report 的路徑當歷史讀

**Files:**
- Modify: `scripts/docs-check.js` — :266-272 與 :279 的註解，:282 的條件
- Test: `tests/docs-check.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 一個條件、一段註解、一個帶對照組的測試。

步驟：

1. 先寫失敗的測試。在 `tests/docs-check.test.js`，`a plan-role page with a moved citation is silent` 那個測試的 `});` 後面加上：

```js
// A report is a dated snapshot and names the files that existed on its day.
// The reference page beside it is the control: the same path must still be
// reported there, or the report's silence would prove nothing.
test('a report naming a file since deleted is silent, and a reference page is not', () => {
  const dir = tmp('fankeel-report-gone-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs', 'reports'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'),
    JSON.stringify({ buckets: [{ path: 'docs/reports', role: 'report' }, { path: 'docs', role: 'reference' }] }));
  fs.writeFileSync(path.join(dir, 'lib', 'kept.js'), 'a\n');
  fs.writeFileSync(path.join(dir, 'docs', 'reports', 'r.md'), 'read `lib/gone.js` that day\n');
  fs.writeFileSync(path.join(dir, 'docs', 'page.md'), 'see `lib/gone.js`\n');

  const gone = scan(dir).findings.filter((f) => f.tag === 'gone').map((f) => f.file.replace(/\\/g, '/'));
  assert.deepEqual(gone, ['docs/page.md']);
});
```

2. 跑 `node --test tests/docs-check.test.js`，看新測試紅，而且紅的原因是 `gone` 裡多了 report 那個檔。若 `gone` 是空的，fixture 沒有被讀成預期的 bucket，停下來回報。

3. 在 `scripts/docs-check.js`，把 :266-272：

```js
            // Never for a plan or a decision, and for opposite reasons that
            // land in the same place. A plan names files that do not exist yet;
            // a decision names files that existed when it was written. Neither
            // is a broken reference, and both were reported as one on the first
            // real run — a month-old plan for `shared/repositories.py` that was
            // never built, and this repository's own decision record for naming
            // a `.fankeel/memory/` that was considered and rejected.
```

上面是舊的七行。

換成（`scripts/docs-check.js`）：

```js
            // Never for a plan, a decision or a report, and for opposite reasons
            // that land in the same place. A plan names files that do not exist
            // yet; a decision or a report names files that existed when it was
            // written. None of them is a broken reference. The plan and the
            // decision were reported as one on the first real run — a month-old
            // plan for `shared/repositories.py` that was never built, and this
            // repository's own decision record for naming a `.fankeel/memory/`
            // that was considered and rejected — and the report on 2026-09-12,
            // when a review from 2026-09-02 named a module deleted that day.
```

4. 同一個檔 `scripts/docs-check.js`，`// Links are still checked in all three.` 改成 `// Links are still checked in all four.`；:282 的條件改成：

```js
            if (role !== 'plan' && role !== 'decision' && role !== 'report' && role !== 'fixture' && roots.has(ref.split('/')[0])) {
```

5. 跑 `node --test tests/docs-check.test.js`，全綠；再跑 `node scripts/docs-check.js`，exit 0。

6. 回報 mutation 行：拿掉 `role !== 'report' &&`，`a report naming a file since deleted is silent, and a reference page is not` 轉紅。

7. Commit（parent 做）：`fix: docs-check reads a report's paths as history, as it does a decision's`。

## Task 7: 文件跟上，兩條 TODO 關閉

**Files:**
- Modify: `docs/pipeline.md` — :357-358、:922-924、:975-977，`last_verified`
- Modify: `docs/subagents.md` — :368-370，`last_verified`
- Modify: `docs/improvement-brief.md` — §6.5 的內文，`last_verified`
- Modify: `docs/decisions/fankeel-shell.md` — :330 之後加一行註記
- Modify: `TODO.md` — :74 與 :120 兩條刪除
- Modify: `docs/README.md` — :64 之後補兩列索引
- Read: `lib/stages.js` — Task 1 的固定句，不改
- Read: `skills/fankeel-audit/SKILL.md` — Task 3 的 lens 寫法，不改
- Read: `scripts/docs-check.js` — Task 6 的改動決定這裡的 `docs-check` 會不會綠，不改
- Read: `hooks/inject.js` — subagents 頁的新例子說它是 `lib/dirty.js` 唯一的 production caller，不改

**Interfaces:**
- Consumes: 固定句 `Code half: three reviewers by lens, cuts only.`（Task 1）
- Produces: none

**Dispatch:** implementer, sonnet — 全是照抄的文字替換，驗證靠兩支腳本。

步驟：

1. 先看它失敗。跑 `node scripts/docs-check.js`：Task 1 刪掉了 plugins 模組，所以它 exit 1，至少列出 subagents 頁點名那個已刪的模組，以及簡報 §6.5 有三處引文已不在原處。把輸出存進本計畫的 build 目錄，檔名 task7-docs-check-before.txt。

2. 在 `docs/pipeline.md`，:358 的 `` `{{NEXT}}`, `{{PONYTAIL}}`, and `{{PROFILE_LAND}}`, which `land`'s own rules `` 改成 `` `{{NEXT}}` and `{{PROFILE_LAND}}`, which `land`'s own rules ``。

3. 同一個檔 `docs/pipeline.md`，把 :922-924：

```md
replaced last month, and finding those costs a reading session — so the deep pass
runs on the cadence `/ponytail-audit` runs on, and is the documentation half of
the same fortnight.
```

換成（`docs/pipeline.md`）：

```md
replaced last month, and finding those costs a reading session — so the deep pass
runs fortnightly, and is the documentation half of a pass whose code half is
three `fankeel-reviewer` lenses asking for cuts.
```

4. 同一個檔 `docs/pipeline.md`，把 :975-977：

```md
For the code half, `audit` uses what is installed — `/ponytail-audit` if ponytail
is there, a graph query if graphify or codegraph is — and says plainly when none
of them are rather than implying a check ran.
```

換成（`docs/pipeline.md`）：

```md
For the code half, `audit` sends three `fankeel-reviewer` lenses over the whole
tree, cuts only — the fankeel-audit skill names them — and adds a graph query
where graphify or codegraph is installed.
```

frontmatter 的 `last_verified: 2026-09-11` 改成 `last_verified: 2026-09-12`。

5. 在 `docs/subagents.md`，把 :368-370：

```md
this repository: `lib/plugins.js` has exactly one production caller, and a reader
holding only `scripts/` and `hooks/` would have reported none — seeing it takes
`lib/`, `scripts/` and `hooks/` at once.
```

換成（`docs/subagents.md`；`grep -rln "dirty\.js'" lib scripts hooks` 今天只印 `hooks/inject.js`）：

```md
this repository: `lib/dirty.js` has exactly one production caller,
`hooks/inject.js`, and a reader holding only `lib/` would have reported none —
seeing it takes `lib/` and `hooks/` at once.
```

frontmatter 的 `last_verified: 2026-09-11` 改成 `last_verified: 2026-09-12`。

6. 在 `docs/improvement-brief.md`，`### 6.5 ponytail 去依賴` 標題底下，從 `**裝著的是 4.9.0**` 那段起、到 `要不要改名。` 為止（`---` 之前），整段換成：

```md
**2026-09-12 落地。** 盤點時裝著的是 4.9.0：6 個 skill 各配一個 command、3 個
hook；SessionStart 與 SubagentStart 各注入約 5 KB 的整套規則，進到 fankeel 每一個
subagent。

收了三項，都改寫成 fankeel 自己的：`ponytail-review` 成為
`agents/fankeel-reviewer.md` 的 `## Cuts` 一節，build 模板的 Part 4 引用它；
`ponytail-audit` 的程式碼那一半成為 fankeel-audit 的三個 reviewer lens；ladder 寫進
`skills/fankeel-design/SKILL.md` 第 2 步。

不收 `ponytail-debt`（全 repo 只有一個債務標記，前綴已拿掉）、`ponytail-gain`、
`ponytail-help` 與三個 hook。讀外掛清單的那個 lib 模組，連同 audit 規則裡的 render
token，一起刪除。解除安裝由使用者自己跑。
```

frontmatter 的 `last_verified: 2026-09-11` 改成 `last_verified: 2026-09-12`。

7. 在 `docs/decisions/fankeel-shell.md`，:330 的 `that copying would not have helped.` 之後（`## One caller is not evidence on its own` 之前），加上：

```md

*(Superseded 2026-09-12: ponytail's review and audit became fankeel's own —
the reviewer's `## Cuts` and fankeel-audit's three lenses — and `lib/plugins.js`
was deleted with the render token it fed. See
[the brief, §6.5](../improvement-brief.md#65-ponytail-去依賴).)*
```

8. 在 `TODO.md`，先刪 :120（`〔ponytail〕解耦 \`has('ponytail')\`` 那條）與它後面的空行，再刪 :74（`〔ponytail〕深度分析` 那條）與它後面的空行。

9. 在 `docs/README.md`，:64（design-class-prompt 那列）之後加兩列：

```md
| Why three of ponytail's six skills became fankeel's own — the reviewer's `## Cuts`, audit's code half as three lenses, the ladder in design — and the rest was unhooked | [plans/2026-09-12-ponytail-absorb-design.md](plans/2026-09-12-ponytail-absorb-design.md) — *design-intent, 繁體中文* |
| The seven tasks that did it, from the audit rule's fixed sentence to the test that no shipped file names the plugin | [plans/2026-09-12-ponytail-absorb.md](plans/2026-09-12-ponytail-absorb.md) — *design-intent, 繁體中文* |
```

10. 跑 `node scripts/docs-check.js`，exit 0；`node scripts/todo-check.js`，exit 0 且 `23 entries`；`node scripts/docs-audit.js`，兩份 2026-09-12 的 plan 不出現在 index 那一節。最後跑全套 `npm test`，不接管線、以 exit code 為準：七個 task 都落地後預期 `ℹ pass 1426` 與 `ℹ fail 0`，數字不同時說出差在哪。

11. Commit（parent 做）：`docs: the pages catch up with the absorb, and two TODO entries close`。

## Coverage

| promise | task |
|---|---|
| `lib/render.js` 不再讀外掛清單：`ponytailLine`（:108-110）、`has` 的 require（:20）、`rulesFor` 傳入的 `ponytail`（:133）與 export（:383）一起拿掉，:97-107 的註解隨之刪除。 | Task 1 |
| `lib/plugins.js` 刪除：`lib/render.js` 是它唯一的 production caller，拿掉後沒有人用。 | Task 1 |
| `lib/stages.js:352` 的 audit 規則以固定句取代 `{{PONYTAIL}}`：`Code half: three reviewers by lens, cuts only.`，比它取代的 fallback 句短；`RENDER_TOKENS`（:441）拿掉 `ponytail`。 | Task 1 |
| 註解與散文不再點名外掛：`lib/live.js:34` 拿掉 `ponytail:` 前綴；`scripts/docs-audit.js:15` 改說程式碼那一半是三個 reviewer lens；`skills/fankeel-land/SKILL.md:188` 改成不點名。 | Task 5 |
| 測試跟著改：`tests/route.test.js` 裡 `plugins.has` 與 `ponytailLine` 的測試（:17-18 的 require，:192-240）刪除；`tests/stages.test.js:100-102,227-230,323-331` 改斷言固定句；`tests/render.test.js:611-612` 的註解改寫。 | Task 1 |
| `agents/fankeel-reviewer.md` 新增 `## Cuts` 一節：五個標籤 `delete:`、`stdlib:`、`native:`、`yagni:`、`shrink:`；格式 `path:line: <tag> <要刪的>. <取代它的>.`；結尾 `net: -<N> lines possible.`，沒得刪就回 `lean`；一個 smoke test 或 assert 自檢永遠不算刪減項。description 補一句它也做 audit 的程式碼那一半。 | Task 2 |
| `skills/fankeel-build/SKILL.md` 的 reviewer 模板（:293-310）加 Part 4：只看這個 diff 新增的行，照 agent 檔 `## Cuts` 的格式回報；刪減項和其他 finding 一樣進 fix row。 | Task 2 |
| `skills/fankeel-audit/SKILL.md:176-179` 改寫：每兩週那一輪派三個 `fankeel-reviewer`，各掃整棵樹、各帶一個 lens、只做 `## Cuts`——沒人需要的（`delete:`、`yagni:`）、別的東西已經在做的（`stdlib:`、`native:`）、可以更短的（`shrink:`）。 | Task 3 |
| `skills/fankeel/SKILL.md:482` 與 :510-516 的程式碼那一半：ponytail 那一列換成 fankeel 自己的三個 lens；`none of them` 那列拿掉，graphify / codegraph 那列保留。 | Task 3 |
| `tests/skills.test.js:107` 改成斷言 audit skill 寫著三個 `fankeel-reviewer` 與 `## Cuts`，不再斷言 `ponytail-audit`。 | Task 3 |
| `skills/fankeel-design/SKILL.md` 第 2 步加五階，停在第一個成立的：它不必存在 → 標準函式庫 → 平台原生 → 依賴（先用專案已有的）→ 最少行數。 | Task 4 |
| reference 頁跟上：`docs/pipeline.md:357,921-923,975-977`、`docs/subagents.md:366-368`。 | Task 7 |
| `docs/improvement-brief.md` §6.5 改寫成已落地、收了哪三項，不留指向已刪程式碼的 `path:line`。 | Task 7 |
| `docs/decisions/fankeel-shell.md` 論證外掛偵測那一節末尾加一行 `*(Superseded 2026-09-12: …)*` 註記，不改原句：決策記錄記的是當時。 | Task 7 |
| `scripts/docs-check.js` 不再對 report 檢查路徑是否存在，理由和 decision 相同：report 是有日期的快照，它點名的是當天存在的檔。 | Task 6 |
| `TODO.md:74` 與 `TODO.md:120` 兩條 ponytail 條目關閉；`docs/README.md` 補這份設計與它的 plan 的索引列。 | Task 7 |
| `skills/registry.json` 用 `scripts/stage-registry.js` 重新產生。 | Task 1 |
| 新測試放在 `tests/source.test.js`：git 追蹤的 `lib/`、`scripts/`、`hooks/`、`agents/`、`skills/`、`output-styles/`、`assets/`、`.claude-plugin/` 檔案都不含 `/ponytail/i`。 | Task 5 |
| `tests/skills.test.js` 的 audit 斷言改寫後，現在紅，做完綠。 | Task 3 |
| 產出物：audit 階段渲染出的注入不含 `{{`、不含 `ponytail`；`skills/registry.json` 裡 audit 的 `prompt_bytes` 不大於現在的 2424。 | Task 1 |
| 全套 `npm test` 綠；`docs-check` 與 `todo-check` exit 0。 | Task 7 |
| 不收 `ponytail-debt`、`ponytail-gain`、`ponytail-help`，也不收三個 hook。 | struck — design 決定不做，沒有 task |
| 不解除安裝 ponytail：land 時提出指令，由使用者自己跑。 | struck — 屬於 land，不是 task |
