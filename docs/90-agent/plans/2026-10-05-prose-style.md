---
status: design-intent
last_verified: 2026-10-05
---

# Prose style Implementation Plan

**Goal:** 新增 profile key `prose.style`（`writer`、`plain`、`sepia`、`custom`，內建 `writer`），把所選風格的規則文字注入站 agent 與 writer 的 brief，並把六版範例存成報告頁。
**Architecture:** 規則文字與選擇邏輯集中在新檔 `lib/prose.js`；`lib/profile.js` 只多一個 key，`scripts/task.js profile set` 借 `lib/prose.js` 印出字數；`lib/render.js` 的 `renderBrief` 在 brain brief（build 除外）與 writer brief 各加一段。兩項機械檢查（`lib/plain.js` 的句長與裸代號）不動。
**Tech Stack:** Node.js，只用內建模組，`node --test`；`package.json` 沒有任何 dependency，這次也不加。
**Spec:** [2026-10-05-prose-style-design.md](2026-10-05-prose-style-design.md)

## Global Constraints

- `.fankeel/map.md`：`lib/` 是邏輯，"nothing here reaches into scripts/ or hooks/"——所以 `lib/prose.js` 不 require `scripts/input-check.js`，token 估算由呼叫端傳進來。
- `.fankeel/map.md`：hooks "exit 0 on every path and leave the work to lib/"。
- `.fankeel/map.md`：`docs/90-agent/reports` 的角色是 report，寫一次就不再改；`docs/90-agent/reference` 與 `docs/01-guide` 是 reference。
- `.fankeel/map.md`：索引是 `docs/README.md`，新頁要在那裡有一列。
- `package.json`：`"test": "node --test"`，沒有 dependency。
- `tests/brief.test.js:129,369,398,532,567,676,684`：每個 brain brief 必須少於 10,000 字元。量到 build 的 brief 已到 9,948 字元（只剩 52），survey 5,397、design 6,454、plan 6,451、land 5,695；verify 與 audit 沒有測試量過。
- `tests/profile-table.test.js:13`：`docs/01-guide/profile.md` 的 key 表格必須等於重新產生的結果（`node scripts/profile-table.js`）。
- `lib/profile.js:522-526`：新 key 加在 `KEYS` literal 之後，像 `quota.calibrated` 那樣，因為 `docs/01-guide/profile.md` 與 `subagents.md` 以行號引用 `lib/profile.js`。
- `lib/profile.js:77`：`WIZARD_KEYS` 在 literal 之後就算好，所以之後加的 key 不進站頁精靈；`tests/profile.test.js:385` 斷言精靈拿到每個有 `values` 的 key，要為 `prose.style` 開例外。
- `tests/tmp.js`：每個測試的暫存目錄都從這裡拿。
- 測試裡跑 hook 或 `task.js` 時，`CLAUDE_CONFIG_DIR` 指向暫存目錄（`tests/brief.test.js:48-54`、`tests/profile.test.js:398-399`），不讀這台機器的真檔。
- `docs/90-agent/reference/plain-language.md`：給人看的中文一句不超過 160 欄（中文字一個算兩欄），hex 前面寫 commit 或 session，不寫 `Task N` 這種代號。

## Risks

- build 的 brain brief 只剩 52 字元，放不下任何風格文字 — Task 3 — 所以 build 不注入，Task 3 的測試確認 build 的 brief 沒有這段、且仍少於 10,000。這和 spec「站 agent 的 brief」不同，gate 讓使用者決定。
- verify 與 audit 的 brain brief 沒有量過，加上 1,200 字的 custom 規則可能超過 10,000 — Task 3 — 它的測試對 build 以外每一站都用 1,200 字的 `.fankeel/prose.md` 量一次；哪一站超過，就停下來回報，不要自己縮短 brief。
- `plain-language.md:9` 這句可能被其他頁或測試引用 — Task 1 — 先 grep 那句話，只有 99-archive、plans 與 `.fankeel/build/` 的引用可以不管。
- 六版範例在 `.fankeel/build/`，那是 gitignored，worktree 裡沒有 — Task 4 — 從主樹的絕對路徑讀。

## Task 1: `lib/prose.js` — 三段風格規則與選擇邏輯

**Files:**
- Modify: `lib/prose.js` — 新檔：`STYLES`、`NAMES`、`SUGGESTED`、`MAX`、`styleFor`、`briefLines`、`costLines`
- Modify: `docs/90-agent/reference/plain-language.md` — 第 9 行的範圍句改寫，`source_of_truth` 加 `lib/prose.js`
- Test: `tests/prose.test.js`

**Interfaces:**
- Consumes: none
- Produces: `STYLES: { writer: string, plain: string, sepia: string }`；`NAMES: ['writer', 'plain', 'sepia', 'custom']`；`SUGGESTED: 450`；`MAX: 1200`；`length(text) -> number`（Unicode 字元數）；`customFile(projectRoot) -> string`；`styleFor(values, projectRoot) -> { style: string, text: string, note: string|null }`；`briefLines(values, projectRoot, audience: string) -> string[]`；`costLines(projectRoot, style: string, estimate: (text) => number) -> string[]`

**Dispatch:** implementer, sonnet — 程式碼都在這裡，照抄加測試。

1. Write the failing test. Create `tests/prose.test.js`:

In `tests/prose.test.js`, the whole file:

```js
'use strict';

// docs/90-agent/plans/2026-10-05-prose-style-design.md: the style a stage
// agent and a writer write in, chosen by `prose.style`.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');
const prose = require('../lib/prose.js');

function project(text) {
    const d = tmp('fankeel-prose-');
    if (text !== undefined) {
        fs.mkdirSync(path.join(d, '.fankeel'), { recursive: true });
        fs.writeFileSync(path.join(d, '.fankeel', 'prose.md'), text);
    }
    return d;
}

test('no prose.style means writer', () => {
    const s = prose.styleFor({}, project());
    assert.equal(s.style, 'writer');
    assert.equal(s.text, prose.STYLES.writer);
    assert.equal(s.note, null);
    assert.equal(prose.styleFor(undefined, project()).style, 'writer');
});

test('a built-in name picks its own rules', () => {
    for (const name of ['writer', 'plain', 'sepia']) {
        const s = prose.styleFor({ 'prose.style': name }, project());
        assert.equal(s.style, name);
        assert.equal(s.text, prose.STYLES[name]);
    }
    assert.notEqual(prose.STYLES.sepia, prose.STYLES.writer);
});

test('custom reads .fankeel/prose.md whole', () => {
    const s = prose.styleFor({ 'prose.style': 'custom' }, project('Write like a field manual.\nNo jokes.\n'));
    assert.equal(s.style, 'custom');
    assert.equal(s.text, 'Write like a field manual.\nNo jokes.');
    assert.equal(s.note, null);
});

test('custom falls back to writer, with a note, when the file is missing, empty or over MAX', () => {
    const missing = prose.styleFor({ 'prose.style': 'custom' }, project());
    assert.equal(missing.style, 'writer');
    assert.equal(missing.text, prose.STYLES.writer);
    assert.match(missing.note, /\.fankeel\/prose\.md is missing or empty — using writer/);
    assert.equal(prose.styleFor({ 'prose.style': 'custom' }, project('  \n')).style, 'writer');
    const over = prose.styleFor({ 'prose.style': 'custom' }, project('字'.repeat(prose.MAX + 1)));
    assert.equal(over.style, 'writer');
    assert.match(over.note, new RegExp((prose.MAX + 1) + ' characters, over ' + prose.MAX + ' — using writer'));
    assert.equal(prose.styleFor({ 'prose.style': 'custom' }, project('字'.repeat(prose.MAX))).style, 'custom');
});

test('every built-in style fits under SUGGESTED, and SUGGESTED under MAX', () => {
    for (const name of Object.keys(prose.STYLES)) {
        assert.ok(prose.length(prose.STYLES[name]) <= prose.SUGGESTED, name + ' is ' + prose.length(prose.STYLES[name]));
    }
    assert.ok(prose.SUGGESTED < prose.MAX);
    assert.deepEqual(prose.NAMES, ['writer', 'plain', 'sepia', 'custom']);
});

test('briefLines names the style and carries its rules, indented', () => {
    const lines = prose.briefLines({ 'prose.style': 'sepia' }, project(), 'the page you write');
    assert.equal(lines[0], '  - Prose style `sepia` (profile `prose.style`), for the page you write:');
    assert.equal(lines[1], '      ' + prose.STYLES.sepia);
    const fallback = prose.briefLines({ 'prose.style': 'custom' }, project(), 'x');
    assert.match(fallback[fallback.length - 1], /^ {6}\(\.fankeel\/prose\.md is missing or empty — using writer\)$/);
});

test('costLines says the size against SUGGESTED and MAX, and warns only over SUGGESTED', () => {
    const est = (t) => Math.ceil(prose.length(t) / 4);
    const big = prose.costLines(project('x'.repeat(prose.SUGGESTED + 10)), 'custom', est);
    assert.match(big[0], new RegExp('^' + (prose.SUGGESTED + 10) + ' characters, ~\\d+ tok'));
    assert.match(big[0], new RegExp('suggested ' + prose.SUGGESTED + ', ceiling ' + prose.MAX + '$'));
    assert.match(big[1], /this is a warning, not a refusal/);
    assert.equal(prose.costLines(project(), 'sepia', est).length, 1);
    const missing = prose.costLines(project(), 'custom', est);
    assert.match(missing[0], /missing or empty — using writer/);
});
```

2. Run it and watch it fail:

```
node --test tests/prose.test.js
```

Expected: `Cannot find module '../lib/prose.js'`.

3. Write the minimal implementation. Create `lib/prose.js`:

In `lib/prose.js`, the whole file:

```js
'use strict';

// The style a stage agent and a writer write in for a person: the rules
// injected into their briefs, chosen by the profile's `prose.style`. The two
// mechanical checks every style keeps — sentence width and bare codes — are
// lib/plain.js's and do not live here.
// docs/90-agent/plans/2026-10-05-prose-style-design.md.

const fs = require('node:fs');
const path = require('node:path');

// `writer` is agents/fankeel-writer.md's own `## Every section`; `plain` is
// docs/90-agent/reference/plain-language.md's five rules; `sepia` is
// rewritten from sepia's references/professional-pass.md checks 6-9 and
// style-pass.md §5, never read from sepia at run time, since not every
// machine has sepia installed.
const STYLES = {
    writer: 'Conclusion first, then why. Every section says what it does, why it is this way, and gives one example the reader can copy. Length follows the stakes: a setting that can lose work gets a paragraph, a cosmetic one a line. Say what a term means the first time it appears, and keep the connectives. Use a list or a table only for things that really enumerate; everything else is paragraphs.',
    plain: 'One sentence says one thing: two things are two sentences. The result first, then the reason. Name who did what: a person, an agent or a program is the subject. No code stands where a name should be. Short sentences, active voice, one fixed word for one thing, after ASD-STE100 controlled English. Number the steps of a procedure.',
    sepia: 'Vary sentence length: break up a run of sentences of similar length, but do not shorten them all, since a paragraph of only short sentences reads as machine-made too. Use a list or a table only for items that really enumerate; a first, second, third paragraph becomes a real list or an argued paragraph. Take a stance where a judgement is needed. End when the content ends, with no closing restatement. Adapted from sepia.',
};
const NAMES = ['writer', 'plain', 'sepia', 'custom'];

// SUGGESTED is the longest built-in rounded up (sepia, 422); a custom text
// over it is warned about when set, never refused. Over MAX the brief falls
// back to writer: the design and plan brain briefs keep about 3,500
// characters of room under SubagentStart's 10,000 (tests/brief.test.js).
const SUGGESTED = 450;
const MAX = 1200;
const CUSTOM_FILE = ['.fankeel', 'prose.md'];

function length(text) {
    return [...String(text)].length;
}

function customFile(projectRoot) {
    return path.join(projectRoot, ...CUSTOM_FILE);
}

// trim() also drops a leading byte-order mark.
function styleFor(values, projectRoot) {
    const want = values && typeof values['prose.style'] === 'string' ? values['prose.style'] : 'writer';
    if (want !== 'custom') {
        const name = Object.prototype.hasOwnProperty.call(STYLES, want) ? want : 'writer';
        return { style: name, text: STYLES[name], note: null };
    }
    let text = '';
    try { text = fs.readFileSync(customFile(projectRoot), 'utf8').trim(); } catch (e) { /* missing reads as empty */ }
    if (!text) return { style: 'writer', text: STYLES.writer, note: '.fankeel/prose.md is missing or empty — using writer' };
    if (length(text) > MAX) return { style: 'writer', text: STYLES.writer, note: '.fankeel/prose.md is ' + length(text) + ' characters, over ' + MAX + ' — using writer' };
    return { style: 'custom', text, note: null };
}

// The brief's lines: one naming the style, then the rules a line each,
// indented under it, then the fallback's reason when there is one.
function briefLines(values, projectRoot, audience) {
    const s = styleFor(values, projectRoot);
    const lines = ['  - Prose style `' + s.style + '` (profile `prose.style`), for ' + audience + ':'];
    for (const l of s.text.split(/\r?\n/)) if (l.trim()) lines.push('      ' + l.trim());
    if (s.note) lines.push('      (' + s.note + ')');
    return lines;
}

// What `task.js profile set prose.style` prints under its head line, the
// fallback's note first. `estimate` is scripts/input-check.js's
// estimateTokens, passed in because lib/ does not reach into scripts/.
function costLines(projectRoot, style, estimate) {
    const s = styleFor({ 'prose.style': style }, projectRoot);
    const n = length(s.text);
    const lines = [];
    if (s.note) lines.push(s.note);
    lines.push(n + ' characters, ~' + estimate(s.text) + ' tok in every stage agent\'s brief but build\'s, and every writer\'s; suggested ' + SUGGESTED + ', ceiling ' + MAX);
    if (s.style === 'custom' && n > SUGGESTED) lines.push('over the suggested ' + SUGGESTED + ' — set anyway; this is a warning, not a refusal');
    return lines;
}

module.exports = { STYLES, NAMES, SUGGESTED, MAX, length, customFile, styleFor, briefLines, costLines };
```

4. Run it and watch it pass:

```
node --test tests/prose.test.js
```

5. Rewrite the scope sentence. First check nobody quotes it:

```
grep -rn "寫給使用者看的中文照這頁寫" docs lib tests hooks scripts skills agents
```

Only the reference page itself and the plans directory may match. Then change the page's frontmatter line `source_of_truth: lib/plain.js` to `source_of_truth: lib/plain.js, lib/prose.js`, and in `docs/90-agent/reference/plain-language.md` replace line 9 with:

```md
這頁的五條規則是 profile 的 `prose.style` 設成 `plain` 時的寫法，規則文字在 `lib/prose.js` 的 `STYLES.plain`。其中句長（第 2 條）和不用代號（第 4 條）由程式檢查，不論選哪種風格都適用：主 session 對使用者說的話、gate 的提問與選項、guide 目錄的頁面、TODO 條目的完成紀錄。
```

6. Run `node scripts/docs-check.js` and confirm it reports nothing new for `plain-language.md`.

7. Commit: `feat(prose): three prose styles and the custom fallback in lib/prose.js`.

## Task 2: profile key `prose.style` and what `profile set` prints

**Files:**
- Modify: `lib/profile.js:522-526` — `KEYS['prose.style']`，加在 `quota.calibrated` 之後
- Modify: `scripts/task.js:1104-1137` — `profile set prose.style` 多印 `costLines`
- Modify: `docs/01-guide/profile.md` — 重新產生 key 表格，加一段說明
- Read: `lib/prose.js` — `costLines`、`STYLES`、`SUGGESTED`
- Read: `scripts/profile-table.js` — 重新產生表格的指令
- Test: `tests/prose-profile.test.js`
- Test: `tests/profile.test.js` — 第 385 行的精靈斷言為 `prose.style` 開例外

**Interfaces:**
- Consumes: Task 1 的 `costLines(projectRoot, style, estimate)`、`STYLES`、`SUGGESTED`、`NAMES`
- Produces: `profile.KEYS['prose.style'] = { values: ['writer', 'plain', 'sepia', 'custom'], builtin: 'writer', desc }`；`profile.read(...).values['prose.style']` 沒設時是 `'writer'`

**Dispatch:** implementer, sonnet — 程式碼都在這裡，照抄加測試。

1. Write the failing test:

In `tests/prose-profile.test.js`, the whole file:

```js
'use strict';

// `prose.style`: a choice like `guard`, set with `task.js profile set`, which
// prints what the chosen rules cost a brief.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const profile = require('../lib/profile.js');
const prose = require('../lib/prose.js');

const TASK = path.join(__dirname, '..', 'scripts', 'task.js');

function cli(d, ...args) {
    const cfg = path.join(d, 'cfg');
    return execFileSync(process.execPath, [TASK, ...args, '--root', d, '--claude-dir', cfg],
        { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
}

test('prose.style is writer by default and takes the four names', () => {
    const d = tmp('fankeel-prose-profile-');
    assert.equal(profile.read(d, null).values['prose.style'], 'writer');
    assert.deepEqual(profile.KEYS['prose.style'].values, prose.NAMES);
    assert.equal(profile.parseValue('prose.style', ' Sepia ').value, 'sepia');
    assert.equal(profile.parseValue('prose.style', 'fancy').error, 'prose.style is one of: writer, plain, sepia, custom');
});

test('prose.style is set at the command line, not in the station wizard', () => {
    assert.equal(Object.prototype.hasOwnProperty.call(profile.WIZARD_KEYS, 'prose.style'), false);
    assert.ok(profile.profileTable().find((r) => r[0] === '`prose.style`'), 'no table row');
});

test('profile set prose.style prints the size of the rules it picked', () => {
    const d = tmp('fankeel-prose-profile-');
    const sepia = cli(d, 'profile', 'set', 'prose.style', 'sepia');
    assert.match(sepia, new RegExp('^' + prose.length(prose.STYLES.sepia) + ' characters, ~\\d+ tok', 'm'));
    assert.doesNotMatch(sepia, /warning/);
    const missing = cli(d, 'profile', 'set', 'prose.style', 'custom');
    assert.match(missing, /missing or empty — using writer/);
    fs.writeFileSync(path.join(d, '.fankeel', 'prose.md'), 'y'.repeat(prose.SUGGESTED + 50));
    const over = cli(d, 'profile', 'set', 'prose.style', 'custom');
    assert.match(over, new RegExp('^' + (prose.SUGGESTED + 50) + ' characters', 'm'));
    assert.match(over, /this is a warning, not a refusal/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(d, '.fankeel', 'profile.json'), 'utf8'))['prose.style'], 'custom');
});
```

2. Run it and watch it fail:

```
node --test tests/prose-profile.test.js
```

Expected: the first test fails, `undefined` against `'writer'`.

3. Add the key. In `lib/profile.js`, right after the `KEYS['quota.calibrated'] = ...` line (line 526), add:

```js

// docs/90-agent/plans/2026-10-05-prose-style-design.md: the style a stage
// agent and a writer write in for a person, its rules in lib/prose.js. Added
// after the literal for `quota.calibrated`'s reason — the line numbers other
// pages cite stay put — which also keeps it off the station wizard: it is set
// with `task.js profile set`, which prints what the rules cost.
KEYS['prose.style'] = { values: ['writer', 'plain', 'sepia', 'custom'], builtin: 'writer', desc: '站 agent 與 writer 寫給人看的文字用哪種風格：writer 先結論再附例子、plain 白話短句、sepia 長短句交錯、custom 讀 .fankeel/prose.md' };
```

4. Keep the wizard test true. In `tests/profile.test.js`, line 385 reads:

```
    assert.deepEqual(wizard, Object.keys(profile.KEYS).filter((k) => profile.KEYS[k].values.length > 0));
```

Replace that line, in `tests/profile.test.js`, with:

```js
    // `prose.style` offers a choice but is added after the literal, off the
    // wizard: `task.js profile set` prints what its rules cost, and the wizard cannot.
    assert.deepEqual(wizard, Object.keys(profile.KEYS).filter((k) => profile.KEYS[k].values.length > 0 && k !== 'prose.style'));
```

5. Print the cost. In `scripts/task.js`, inside `if (verb === 'set')`, directly above the `if (key.startsWith('prompt.')) {` line (line 1119), add:

```js
        if (key === 'prose.style') {
            // What the chosen rules cost each brief they join, said when set; a
            // custom text over the suggestion is a warning, never a refusal.
            return [head].concat(require('../lib/prose.js').costLines(projectRoot, out.value, estimateTokens)).join('\n');
        }
```

6. Regenerate the table and add the paragraph:

```
node scripts/profile-table.js
```

Then in `docs/01-guide/profile.md`, after the code block that ends with `node <plugin>/scripts/task.js profile set language 繁體中文` and its closing fence, add this paragraph and its example:

```md
`prose.style` 決定站 agent 和 writer 寫給人看的文字用哪種風格，內建 `writer`。`writer` 先講結論再講原因，每一節附一個可以照抄的例子。`plain` 是[中文受控規則](../90-agent/reference/plain-language.md)的白話短句。`sepia` 讓長句和短句交錯，規則改寫自 sepia 外掛的專業文體檢查。三種都不合用時，設成 `custom`，再把自己的規則寫進專案的 `.fankeel/prose.md`，整個檔案就是規則。設定時，指令會印出規則有幾個字、約多少 token，並和建議的 450 字比較；超過只警告。超過 1200 字的上限時，brief 改用 `writer`，檔案不存在時也一樣。build 站的 agent 不注入風格，因為它的 brief 已經貼近 10,000 字元的上限；它派出去的 writer 仍然照風格寫。不論選哪一種，句子不超過 160 欄和不用裸代號這兩項檢查都照舊擋 gate。例：
```

followed by a plain fence holding:

```
node <plugin>/scripts/task.js profile set prose.style sepia
node <plugin>/scripts/task.js profile set prose.style custom
```

7. Run it and watch it pass, with the table and wizard checks beside it:

```
node --test tests/prose-profile.test.js tests/profile-table.test.js tests/profile.test.js
```

8. Commit: `feat(profile): prose.style picks the prose rules, and profile set prints their size`.

## Task 3: inject the style into the stage-agent and writer briefs

**Files:**
- Modify: `lib/render.js` — `renderBrainBrief` 在 `language` 那行之後加風格（build 除外）；`renderBrief` 的一般分支對 `fankeel-writer` 加風格
- Modify: `hooks/brief.js:20-21` — 開頭註解補上 writer 也有自己的一段
- Read: `lib/prose.js` — `briefLines`、`STYLES`、`MAX`
- Read: `lib/profile.js` — Task 2 加的 `KEYS['prose.style']`，hook 層的測試靠它
- Read: `tests/brief.test.js` — `seed`、`seedProfile`、`run`、`start`、`contextOf` 的寫法，照抄
- Test: `tests/prose-brief.test.js`

**Interfaces:**
- Consumes: Task 1 的 `briefLines(values, projectRoot, audience)`、`STYLES`、`MAX`；Task 2 的 `KEYS['prose.style']`（hook 層的測試靠 `profile.read` 讀到它）
- Produces: none

**Dispatch:** implementer, sonnet — 程式碼都在這裡；verify 與 audit 的 brief 大小是未知數，但測試會量，超過就停下回報。

1. Write the failing test:

In `tests/prose-brief.test.js`, the whole file:

```js
'use strict';

// The chosen prose style reaches the stage agent's brief (every stage but
// build, whose brief sits 52 characters under SubagentStart's 10,000) and the
// writer's, and nobody else's.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const mkTmp = require('./tmp.js');
const { renderBrief } = require('../lib/render.js');
const prose = require('../lib/prose.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'brief.js');
const SESSION = 'aaaaaaaa-0000-4000-8000-000000000001';
const STAGES = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];

function seed(root, over) {
    const dir = path.join(root, '.fankeel', 'sessions');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, SESSION + '.json'), JSON.stringify(Object.assign({
        task: 'rework the colour ramp',
        claims: ['statusline.ps1', 'statusline.sh'],
        stage: 'build',
        active: true,
        started: '2026-09-19T09:30:12.345Z',
        updated: new Date().toISOString(),
    }, over), null, 2) + '\n');
}

function seedProfile(root, values) {
    fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify(values, null, 2) + '\n');
}

function brief(root, agentType) {
    const out = execFileSync(process.execPath, [HOOK], {
        input: JSON.stringify({ session_id: SESSION, cwd: root, hook_event_name: 'SubagentStart', agent_id: 'agt_01', agent_type: agentType }),
        encoding: 'utf8',
        env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: mkTmp('fankeel-cfg-') }),
    });
    return JSON.parse(out).hookSpecificOutput.additionalContext;
}

const mine = (stage) => ({ sessionId: SESSION, data: { task: 't', stage, active: true, started: '2026-09-19T09:30:12.345Z', claims: [] } });
const prof = (values) => ({ values: Object.assign({ 'stage.agents': STAGES.slice(), 'dispatch.floor': 'sonnet' }, values), sources: {}, unreadable: [] });

test('a writer\'s brief carries writer\'s rules when prose.style is unset', () => {
    const root = mkTmp('fankeel-prose-brief-');
    const text = renderBrief({ mine: mine('build'), agentType: 'fankeel:fankeel-writer', root, profile: prof({}) });
    assert.ok(text.includes('  - Prose style `writer` (profile `prose.style`), for the page you write:'), text);
    assert.ok(text.includes(prose.STYLES.writer));
});

test('sepia replaces writer, in the stage agent\'s brief and the writer\'s', () => {
    const root = mkTmp('fankeel-prose-brief-');
    for (const type of ['fankeel:fankeel-writer', 'fankeel:fankeel-brain']) {
        const text = renderBrief({ mine: mine('plan'), agentType: type, root, profile: prof({ 'prose.style': 'sepia' }) });
        assert.ok(text.includes(prose.STYLES.sepia), type);
        assert.ok(!text.includes(prose.STYLES.writer), type);
    }
});

test('custom carries .fankeel/prose.md, and falls back to writer with a line when it is over MAX', () => {
    const root = mkTmp('fankeel-prose-brief-');
    fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'prose.md'), 'Write like a field manual.\n');
    const own = renderBrief({ mine: mine('design'), agentType: 'fankeel:fankeel-brain', root, profile: prof({ 'prose.style': 'custom' }) });
    assert.ok(own.includes('      Write like a field manual.'), own);
    fs.writeFileSync(path.join(root, '.fankeel', 'prose.md'), 'z'.repeat(prose.MAX + 1));
    const over = renderBrief({ mine: mine('design'), agentType: 'fankeel:fankeel-brain', root, profile: prof({ 'prose.style': 'custom' }) });
    assert.ok(over.includes(prose.STYLES.writer));
    assert.ok(over.includes('over ' + prose.MAX + ' — using writer'));
});

test('nobody else gets the style, and neither does the build stage agent', () => {
    const root = mkTmp('fankeel-prose-brief-');
    for (const type of ['fankeel:fankeel-reader', 'fankeel:fankeel-reviewer', 'fankeel:fankeel-implementer']) {
        assert.ok(!renderBrief({ mine: mine('plan'), agentType: type, root, profile: prof({}) }).includes('(profile `prose.style`)'), type);
    }
    assert.ok(!renderBrief({ mine: mine('build'), agentType: 'fankeel:fankeel-brain', root, profile: prof({}) }).includes('(profile `prose.style`)'));
});

test('the writer\'s SubagentStart brief carries the profile\'s style', () => {
    const root = mkTmp('fankeel-prose-hook-');
    seedProfile(root, { 'prose.style': 'sepia' });
    seed(root);
    assert.ok(brief(root, 'fankeel:fankeel-writer').includes(prose.STYLES.sepia));
});

test('a MAX-long custom style keeps every stage agent\'s brief under 10,000 characters', (t) => {
    for (const stage of STAGES) {
        const root = mkTmp('fankeel-prose-size-');
        seedProfile(root, { 'stage.agents': [stage], 'prose.style': 'custom' });
        fs.writeFileSync(path.join(root, '.fankeel', 'prose.md'), '字'.repeat(prose.MAX));
        seed(root, { stage });
        const text = brief(root, 'fankeel:fankeel-brain');
        t.diagnostic(stage + ' brain brief ' + text.length + ' chars');
        assert.ok(text.length < 10000, stage + ' brain brief is ' + text.length + ' chars');
    }
});
```

2. Run it and watch it fail:

```
node --test tests/prose-brief.test.js
```

Expected: the first three fail (no `Prose style` line); the last one passes or names a stage over 10,000 — if verify or audit is over, stop here and report the stage and its length, do not shorten the brief.

3. Write the minimal implementation. In `lib/render.js`, beside the other `require` lines at the top, add:

```js
const prose = require('./prose.js');
```

In `lib/render.js`, in `renderBrainBrief`, directly after the line `if (language) lines.push(...)` (line 547), add:

```js
    // The prose style the user picked (profile `prose.style`). Not on build:
    // its brief sits 52 characters under SubagentStart's 10,000, and the pages
    // it has written go through a writer, which gets the style below.
    if (stage !== 'build') for (const l of prose.briefLines(profile && profile.values, projectRootOf(root, data), 'your report and every gate string')) lines.push(l);
```

In `lib/render.js`, in `renderBrief`, directly after the `if (type === 'fankeel-judge') lines.push(...)` line (line 695), add:

```js
    // A writer writes a page a person reads, in the style the profile picked.
    if (type === 'fankeel-writer') for (const l of prose.briefLines(profile && profile.values, projectRootOf(root, data), 'the page you write')) lines.push(l);
```

4. Keep the hook's header true. In `hooks/brief.js`, replace lines 20-21:

```js
// The agent type is passed through, and two types get lines of their own in
// lib/render.js: fankeel-judge, and fankeel-writer, which gets the profile's
// `prose.style` rules.
```

5. Run it and watch it pass, with the existing brief tests beside it:

```
node --test tests/prose-brief.test.js tests/brief.test.js tests/render.test.js
```

The `t.diagnostic` lines give each stage's size; paste them into your return.

6. Commit: `feat(brief): stage agents and writers get the prose style`.

## Task 4: report page with the six versions and their sentence lengths

**Files:**
- Modify: `docs/90-agent/reports/2026-10-05-prose-styles.md` — 新的報告頁
- Modify: `docs/README.md` — 報告區加一列索引
- Read: `F:/ymlab/fankeel/.fankeel/build/task-20261005T062336/design.md` — 六版範例在第 18–113 行；這個檔案 gitignored，worktree 裡沒有，從主樹讀
- Read: `lib/plain.js` — `longSentences(text, 0)` 回傳每一句和它的欄寬
- Test: `docs/90-agent/reports/2026-10-05-prose-styles.md`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 搬文字加跑一條量測指令。

1. Write the page skeleton. In `docs/90-agent/reports/2026-10-05-prose-styles.md`:

```md
---
status: current
last_verified: 2026-10-05
---

# 三種文字風格的對照範例（2026-10-05）

## 結論

（步驟 3 量完再寫：三到五句，先說哪一版句長最平均、哪一版長短差最多，再說這對選 `prose.style` 的意思。）

## 怎麼量

題目是「Express 的 middleware 是什麼？為什麼順序重要？」。A 是 `writer`，B 是 `plain`，C 是 `sepia`，各有中文與英文一版。量法是 `lib/plain.js` 的 `longSentences(text, 0)`：它照 `SPLIT` 切句，回傳每一句的欄寬，中文字一個算兩欄。清單的每一項算一句，程式碼區塊不算。

## 六版
```

Under `## 六版`, add six `### ` headings — `### A writer 中文`, `### A writer English`, `### B plain 中文`, `### B plain English`, `### C sepia 中文`, `### C sepia English`. The source is the main tree's `.fankeel/build/task-20261005T062336/design.md`, section `## 附錄` from line 18: its headings `### A　writer` (line 22), `### B　plain` (line 54) and `### C　sepia` (line 80) — with a full-width space — each hold a Chinese blockquote, then a blank line, then an English blockquote. Copy each blockquote verbatim under its heading. A writer's English version says "(same code block as above)": copy it as it stands.

2. Measure, from the worktree root, after the six versions are on the page:

```
node -e "const fs=require('fs');const {longSentences}=require('./lib/plain.js');const page=fs.readFileSync('docs/90-agent/reports/2026-10-05-prose-styles.md','utf8');for(const sec of page.split(/^### /m).slice(1)){const name=sec.split('\n')[0];let code=false;const text=sec.split('\n').filter(l=>l.startsWith('>')).map(l=>l.replace(/^>\s?/,'')).filter(l=>{if(l.startsWith('\`\`\`')){code=!code;return false}return !code}).join('\n');const w=longSentences(text,0).map(s=>s.width);const mean=w.reduce((a,b)=>a+b,0)/w.length;const sd=Math.sqrt(w.reduce((a,b)=>a+(b-mean)**2,0)/w.length);console.log('| '+name+' | '+w.length+' | '+Math.max(...w)+' | '+mean.toFixed(1)+' | '+sd.toFixed(1)+' |')}"
```

3. Add a `## 量測` section between `## 怎麼量` and `## 六版`: the table header `| 版本 | 句數 | 最長（欄） | 平均（欄） | 標準差（欄） |` and `|---|---|---|---|---|`, then the six lines the command printed, pasted from the run, then one line `量測時的 HEAD：` followed by `git rev-parse HEAD` in backticks with its output pasted, and the command itself in a plain fence. Then fill `## 結論` from those numbers only; every sentence at most 160 columns.

4. Index it. In `docs/README.md`, directly after the inject-timing report's row, add:

```md
| 同一題 Express middleware 用 `writer`、`plain`、`sepia` 三種風格寫成中英文六版，並用 `lib/plain.js` 量每版的句數、最長句與句長標準差：`prose.style` 選風格時的對照 | [reports/2026-10-05-prose-styles.md](90-agent/reports/2026-10-05-prose-styles.md) — *a dated snapshot, 繁體中文* |
```

5. Test: run `node scripts/docs-check.js` and confirm nothing it reports names `2026-10-05-prose-styles.md` or `docs/README.md`.

6. Commit: `docs(reports): six prose-style versions with their sentence lengths`.

## Coverage

| promise | task |
|---|---|
| 新增 profile key `prose.style`，值是 `writer`、`plain`、`sepia` 或 `custom`，內建 `writer`。 | Task 2 |
| 所選風格的規則文字會注入站 agent 的 brief 和 writer 的 brief。 | Task 3（build 的站 agent 除外，見 Risks） |
| 兩項機械檢查不分風格，照舊擋下：句子不超過 160 欄，以及不用裸代號。 | struck — 不改程式，`lib/plain.js` 原樣不動；Task 1 只改說明頁 |
| 底線不能換。`lib/plain.js` 的 `proseProblem` 照舊檢查每個 gate | struck — 現狀，不需要工作 |
| 風格可以換。風格只是一段注入的規則文字。 | Task 1 |
| `writer`：預設。這是 `agents/fankeel-writer.md` 現行的寫法 | Task 1 |
| `plain`：`docs/90-agent/reference/plain-language.md` 的五條規則。 | Task 1 |
| `sepia`：取自 sepia 的 `professional-pass.md` 與 `style-pass.md` §5。 | Task 1 |
| `prose.style custom` 讀專案的 `.fankeel/prose.md`，整個檔案就是規則文字。 | Task 1、Task 2 |
| 建議值和硬上限由 plan 量出來再寫死。 | Task 1（`SUGGESTED` 450，最長的內建 sepia 422 字元；`MAX` 1200） |
| 站 agent：`lib/render.js` 的 `renderBrief` 加一行，寫法和第 545–547 行的 `language` 那行一樣。 | Task 3 |
| writer：`hooks/brief.js` 現在只給 `fankeel-brain` brief（第 122 行）。 | Task 3 — 讀過後更正：`hooks/brief.js` 對每種 agent 都呼叫 `renderBrief`，writer 拿的是 `lib/render.js:673-698` 的一般 brief，所以改在 `lib/render.js`，`hooks/brief.js` 只改註解 |
| 主 session 每輪的區塊不注入。 | struck — 刻意不做，沒有工作 |
| 新增 `docs/90-agent/reports/2026-10-05-prose-styles.md`：Express middleware 的中英文六版 | Task 4 |
| `docs/90-agent/reference/plain-language.md:9` 現在說「寫給使用者看的中文照這頁寫」。 | Task 1 |
| `docs/01-guide/profile.md` 的 key 表格是產生的，會自動多一列。 | Task 2 |
| 沒設 `prose.style` 時，brief 含 `writer` 的規則文字。 | Task 3 |
| 設成 `sepia` 時，brief 含 `sepia` 的規則文字，不含 `writer` 的。 | Task 3 |
| 設成 `custom` 且有 `.fankeel/prose.md` 時，brief 含檔案內容。 | Task 1、Task 3 |
| 三段內建規則都不超過 `SUGGESTED`。 | Task 1 |
| `profile set prose.style` 遇到未知的值會拒絕。 | Task 2 |
| writer 的 SubagentStart brief 含所選風格。 | Task 3 |
