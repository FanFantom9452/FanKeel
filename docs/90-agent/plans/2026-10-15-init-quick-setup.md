---
status: design-intent
last_verified: 2026-10-15
---

# Init quick setup Implementation Plan

**Goal:** fankeel-init asks the development habits first and writes a preset with one command, then one gate decides whether the docs half runs, and the station wizard's 省 context option writes what `PRESETS.lean` writes.
**Architecture:** `lib/profile.js` gains `applyPreset(file, name, history)`, which writes `PRESETS[name].set` key by key through the existing `write` and `unset`; `scripts/task.js` `cmdProfile` gains a `preset` verb that, for `balanced` on a project file, passes `suggest()`'s values so `land.integration` and `land.push` come from history. `skills/fankeel-init/SKILL.md` is reordered: scout, habits, gate, then the six docs steps and close. The wizard's habit card changes one value and its blurb; the guide says so.
**Tech Stack:** Node v24.21.0 (`node --test`), no dependencies; the station page is ES5 (`var`, no arrow functions) loaded by node in tests through `global.window = { STATION: {} }`.
**Spec:** 2026-10-15-init-quick-setup-design.md

## Global Constraints

Generated 2026-10-15 from `node scripts/map.js --print`, `package.json`, the files below and the tests. The repository has no `CLAUDE.md`.

- `package.json` declares no dependency and `"test": "node --test"`. Add no dependency.
- `lib/*.js` and `scripts/task.js`: `'use strict'`, four-space indent, semicolons, single quotes. `assets/station/station.js` and `assets/station/i18n.js`: four-space indent, ES5 inside the IIFE (`var`, `function`), every user-facing string through `loc('<key>', '<zh default>')`.
- `tests/profile.test.js` and `tests/station-wizard.test.js`: four-space indent. `tests/init-skill.test.js`: two-space indent. All `'use strict'`, `node:test` and `node:assert/strict`; scratch directories come from `tests/tmp.js` (`tmp('fankeel-profile-')`), never `os.tmpdir()` directly.
- `profile.write(file, key, raw)` and `profile.unset(file, key)` (`lib/profile.js:345`, `lib/profile.js:469`) are the only writers of a profile file; `unset` never creates a file. A preset row whose value is `null` is cleared, never written as `null`.
- `PRESETS` (`lib/profile.js:449-465`) is unchanged by every task: `tests/profile.test.js:356-364` pins all three `set` objects, and `tests/profile-table.test.js:13` fails if `PRESETS.balanced` moves without regenerating `docs/01-guide/profile.md`'s table.
- `suggest(projectRoot, registryRoot)` returns `land.push` as a boolean and `land.integration` as a string; `write` takes the raw string, so a history value is passed through `String()`.
- `fail(message)` in `scripts/task.js:186` writes to stdout and exits 1.
- `READ_CAP` is 1500 lines and `FILE_CAP` is 3 Modify entries a task (`lib/plantasks.js`). `scripts/task.js` is 1673 lines and `assets/station/station.js` 5893, so both are listed as ranges.
- `tests/init-skill.test.js:72` requires `scripts/compact-window.js` in the init skill's `source_of_truth:`; `tests/skills.test.js:82` caps every skill `description:` under 500 characters; `tests/skills.test.js` `classify()` fails a skill line naming a `task.js` flag the script does not accept (`--project` and `--default` are accepted). No byte budget applies to `skills/fankeel-init/SKILL.md` — `skills/registry.json` lists the seven stage skills only.
- The wizard's step order is `WIZ_STEPS` (`assets/station/station.js:1964-2017`): land 收尾, class 任務大小, front 前端, agents context, guard 撞檔, model 模型, station 監控站, answer 答 gate.
- `tests/station-wizard.test.js:43` asserts the 省 context habit is pre-picked for `survey,build,verify` on disk; Task 3 changes that assertion, because existing `profile.json` files are read as they are and no habit card writes three stages after it.
- Pages under `docs/01-guide/` are written in Traditional Chinese, full sentences.
- A commit is `<type>: <sentence>` then one `- <what changed> — <paths>` line per change, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- An implementer runs only its own test file. The session that dispatched it runs `node --test` before committing; on this machine that needs `FANKEEL_BROWSER` set to chrome.exe's full path or 14 render tests fail on Edge.

## Risks

- After Task 3 the wizard's agents step has two habit pills that write the same value: 省 context (H2) and 全部交出去 (H3) both set `stage.agents: all`. `wizLoad` pre-picks the first match, so 全部交出去 is never shown as picked. — Task 3 — keeps both as the user ruled; this plan does not remove or relabel 全部交出去, and the user can strike it at the plan gate.
- The old first gate asked twice before writing `init.skip true` (先跳過, then a second gate saying what skipping costs). Design §3 has one question, so the cost moves into 先不要's description and the second confirmation goes, along with `tests/init-skill.test.js:31-37`. — Task 2 — its test pins the cost sentence inside the 先不要 option.
- `profile preset balanced --default` writes the machine file, which is no one repository's habit. Ruled here: history is read only when the target is a project file; with `--default` the preset's own `merge` / `false` are written. — Task 1 — its unit test passes no history for the machine path, and the guide says so; the user can overturn it at the plan gate.
- `applyPreset` writes key by key, so a file that stops parsing mid-run would leave a half-applied preset. `write` and `unset` both refuse an unreadable file before touching it, and the first key hits that refusal, so in practice nothing is written. — Task 1 — returns the refusal on the first key.
- `scripts/task.js` (1673 lines) and `assets/station/station.js` (5893 lines) exceed `READ_CAP`. — Tasks 1 and 3 — Modify entries name `scripts/task.js:1118-1630` and `assets/station/station.js:1985-1995`; nothing outside those spans changes.
- `docs/01-guide/profile.md` line 61 is one paragraph of several thousand characters. — Task 3 — Step 5 replaces four pieces by their exact text, each confirmed to occur once on 2026-10-15, and Step 7 greps that the old pieces are gone.
- `agents/fankeel-init-scout.md` returns its `status:` rows "in the skill's order"; after the reorder that order starts with profile. — Task 2 — changes the one sentence naming the order.
- `lib/profile.js:382` says "init's step 7 says so"; after Task 2 the commit-format question lives in step 1. — Task 1 — Step 5 rewords the comment.

## Task 1: `profile preset` applies a preset in one command

**Files:**
- Modify: `lib/profile.js` — `applyPreset` added after `unset` and exported; the comment at line 382 names the habits step
- Modify: `scripts/task.js:1118-1630` — `cmdProfile` gains the `preset` verb; its refusal message and the usage line name it
- Test: `tests/profile.test.js`

**Interfaces:**
- Consumes: `profile.write(file, key, raw) -> { ok, file, key, value } | { ok: false, reason }`, `profile.unset(file, key) -> { ok, file, key } | { ok: false, reason }`, `profile.suggest(projectRoot, registryRoot) -> { values, evidence: string[] }`, `profile.display(v) -> string` — all existing in `lib/profile.js`
- Produces: `applyPreset(file: string, name: string, history?: object | null) -> { ok: true, file: string, rows: Array<{ key: string, value: any | null, from: 'preset' | 'history' }> } | { ok: false, reason: string }`, exported from `lib/profile.js`; the CLI `node scripts/task.js profile preset <manual|balanced|lean> [--project <dir>|--default]`, whose output is a head line `fankeel — profile preset <name>  → <file>`, one line per key `  <key> = <value>` (`(cleared)` for a null) with `  (from history)` appended where history chose the value, then `  history: <evidence>` lines when any value came from history

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] Step 1. Write the failing tests. At the end of `tests/profile.test.js`, add:

```js
// docs/90-agent/plans/2026-10-15-init-quick-setup-design.md §2.
test('applyPreset writes a preset the way wizApply does: a value as write, null as unset', () => {
    const file = path.join(dir(), 'profile.json');
    profile.write(file, 'land.push', 'true');
    profile.write(file, 'class.default', 'bounded');
    profile.write(file, 'language', '繁體中文');
    const out = profile.applyPreset(file, 'manual');
    assert.equal(out.ok, true);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {
        language: '繁體中文', guard: 'ask', 'stage.agents': profile.parseValue('stage.agents', 'false').value,
    });
    assert.deepEqual(out.rows.map((r) => r.key), Object.keys(profile.PRESETS.manual.set));
    assert.ok(out.rows.every((r) => r.from === 'preset'));
    assert.equal(out.rows.find((r) => r.key === 'land.push').value, null);
});

test('balanced takes land.integration and land.push from history, and nothing else from it', () => {
    const file = path.join(dir(), 'profile.json');
    const out = profile.applyPreset(file, 'balanced', {
        'land.integration': 'pr', 'land.push': true, 'class.default': 'spike', 'commit.format': '^(feat)(\\([^)]+\\))?: ',
    });
    assert.equal(out.ok, true);
    const written = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(written['land.integration'], 'pr');
    assert.equal(written['land.push'], true);
    assert.equal(written['land.archivePlan'], true);
    assert.equal(written.guard, 'ask');
    assert.deepEqual(written['stage.agents'], ['survey', 'build', 'verify']);
    assert.equal('class.default' in written, false);
    assert.equal('commit.format' in written, false);
    assert.deepEqual(out.rows.filter((r) => r.from === 'history').map((r) => r.key), ['land.integration', 'land.push']);
});

test('lean and manual ignore history, balanced with none writes its own values, and an unknown preset writes nothing', () => {
    const lean = path.join(dir(), 'profile.json');
    profile.applyPreset(lean, 'lean', { 'land.integration': 'pr' });
    assert.equal(JSON.parse(fs.readFileSync(lean, 'utf8'))['land.integration'], 'merge');
    assert.deepEqual(JSON.parse(fs.readFileSync(lean, 'utf8'))['stage.agents'], profile.parseValue('stage.agents', 'all').value);
    const plain = path.join(dir(), 'profile.json');
    const out = profile.applyPreset(plain, 'balanced', null);
    assert.equal(JSON.parse(fs.readFileSync(plain, 'utf8'))['land.integration'], 'merge');
    assert.ok(out.rows.every((r) => r.from === 'preset'));
    const other = path.join(dir(), 'profile.json');
    const bad = profile.applyPreset(other, 'fast');
    assert.equal(bad.ok, false);
    assert.equal(bad.reason, 'preset is one of: manual, balanced, lean');
    assert.equal(fs.existsSync(other), false);
});

// docs/90-agent/plans/2026-10-15-init-quick-setup-design.md, Proves it done.
test('profile preset balanced --project writes land.integration pr from a history of pull requests, and says so', () => {
    const d = dir();
    const cfg = path.join(d, 'cfg');
    const app = path.join(d, 'app');
    fs.mkdirSync(app);
    const who = ['-c', 'user.name=t', '-c', 'user.email=t@t'];
    const g = (...a) => execFileSync('git', a, { cwd: app, stdio: 'ignore' });
    g('init', '-q', '-b', 'main');
    g(...who, 'commit', '-q', '--allow-empty', '-m', 'init');
    for (let i = 0; i < 3; i++) {
        g('checkout', '-q', '-b', 'f' + i);
        g(...who, 'commit', '-q', '--allow-empty', '-m', 'work ' + i);
        g('checkout', '-q', 'main');
        g(...who, 'merge', '-q', '--no-ff', '-m', 'Merge pull request #' + (i + 1) + ' from me/f' + i, 'f' + i);
    }
    const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
    const out = execFileSync(process.execPath, [TASK, 'profile', 'preset', 'balanced', '--project', 'app', '--root', d, '--claude-dir', cfg],
        { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
    const written = JSON.parse(fs.readFileSync(profile.projectFile(app), 'utf8'));
    assert.equal(written['land.integration'], 'pr');
    assert.deepEqual(written['stage.agents'], ['survey', 'build', 'verify']);
    assert.match(out, /^ {2}land\.integration = pr {2}\(from history\)$/m);
    assert.match(out, /^ {2}stage\.agents = survey,build,verify$/m);
    assert.match(out, /^ {2}history: merges: 0 local, 3 pull request$/m);
});

test('profile preset refuses a name that is not a preset, and --default reads no history', () => {
    const d = dir();
    const cfg = path.join(d, 'cfg');
    const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
    const env = Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg });
    const r = require('node:child_process').spawnSync(process.execPath, [TASK, 'profile', 'preset', 'fast', '--root', d, '--claude-dir', cfg], { encoding: 'utf8', env });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /preset is one of: manual, balanced, lean/);
    assert.equal(fs.existsSync(profile.projectFile(d)), false);
    const out = execFileSync(process.execPath, [TASK, 'profile', 'preset', 'balanced', '--default', '--root', d, '--claude-dir', cfg], { encoding: 'utf8', env });
    assert.doesNotMatch(out, /from history/);
    assert.equal(JSON.parse(fs.readFileSync(profile.machineFile(cfg), 'utf8'))['land.integration'], 'merge');
});
```

- [ ] Step 2. Run `node --test tests/profile.test.js`. The five new tests fail: the first three with `profile.applyPreset is not a function`, the last two because `task.js` exits 1 with `profile is one of: show, set ...` for the verb `preset`.

- [ ] Step 3. Write `applyPreset`. In `lib/profile.js`, directly after the closing `}` of `function unset(file, key)`, add:

```js
// One preset written to one file the way the station's wizApply writes it: a
// value as `write`, `null` as `unset`, in the preset's own key order.
// `history` is `suggest()`'s values; only `balanced` takes anything from it,
// and only its two land answers (docs/90-agent/plans/2026-10-15-init-quick-setup-design.md §2).
const FROM_HISTORY = { balanced: ['land.integration', 'land.push'] };
function applyPreset(file, name, history) {
    if (!Object.prototype.hasOwnProperty.call(PRESETS, name)) return { ok: false, reason: 'preset is one of: ' + Object.keys(PRESETS).join(', ') };
    const rows = [];
    for (const [key, value] of Object.entries(PRESETS[name].set)) {
        const fromHistory = (FROM_HISTORY[name] || []).includes(key) && !!history && history[key] !== undefined;
        const raw = fromHistory ? String(history[key]) : value;
        const out = raw === null ? unset(file, key) : write(file, key, raw);
        if (!out.ok) return { ok: false, reason: out.reason };
        rows.push({ key, value: raw === null ? null : out.value, from: fromHistory ? 'history' : 'preset' });
    }
    return { ok: true, file, rows };
}
```

And in `lib/profile.js`'s `module.exports` line, add `applyPreset` after `unset`, so it reads `... write, unset, applyPreset, suggest, ...`.

- [ ] Step 4. Write the verb. In `scripts/task.js`, in `cmdProfile`, directly above the line `    fail('profile is one of: show, set <key> <value> [--default], unset <key> [--default], suggest');`, add:

```js
    if (verb === 'preset') {
        const name = String(opts.positional[1] || '');
        const file = opts.default ? profile.machineFile(cfg) : profile.projectFile(projectRoot);
        if (!file) fail('No config directory to write the machine default to.');
        // A machine default is no one repository's habit, so only a project
        // file takes balanced's land answers from this repository's history.
        const history = name === 'balanced' && !opts.default ? profile.suggest(projectRoot, root) : null;
        const out = profile.applyPreset(file, name, history ? history.values : null);
        if (!out.ok) fail(out.reason);
        const lines = ['fankeel — profile preset ' + name + '  → ' + file];
        for (const r of out.rows) {
            lines.push('  ' + r.key + ' = ' + (r.value === null ? '(cleared)' : profile.display(r.value)) + (r.from === 'history' ? '  (from history)' : ''));
        }
        if (out.rows.some((r) => r.from === 'history')) for (const e of history.evidence) lines.push('  history: ' + e);
        return lines.join('\n');
    }
```

Then, in `scripts/task.js`, replace that `fail('profile is one of: ...')` line with:

```js
    fail('profile is one of: show, set <key> <value> [--default], unset <key> [--default], suggest, preset <manual|balanced|lean> [--default]');
```

And in `scripts/task.js`'s usage array, replace the line `    '  profile show|set <key> <value>|unset <key>|suggest',` with:

```js
    '  profile show|set <key> <value>|unset <key>|suggest|preset <manual|balanced|lean>',
```

- [ ] Step 5. In `lib/profile.js`, in `suggest()`'s comment, replace `init's step 7 says so.` with `init's habits step says so.` (the rest of that line, ` Offered like every value here, never written.`, stays).

- [ ] Step 6. Run `node --test tests/profile.test.js`. Every test passes, the five new ones included.

- [ ] Step 7. Commit `lib/profile.js`, `scripts/task.js`, `tests/profile.test.js`: `feat: profile preset writes a whole preset, balanced takes land from history`.

## Task 2: fankeel-init asks habits first, then one gate, then the docs

**Files:**
- Modify: `skills/fankeel-init/SKILL.md` — `last_verified`, the Done-when paragraph, and everything from `## 0.` to the end: scout, habits, gate, then the old steps 1-6 and 8 renumbered 3-9
- Modify: `agents/fankeel-init-scout.md` — the `status:` row order starts with profile
- Read: `assets/station/station.js` — `WIZ_STEPS` (lines 1964-2017), the card order 逐項設定 follows; the new test loads it
- Read: `lib/profile.js` — `PRESETS`, which the habits step's descriptions cite
- Test: `tests/init-skill.test.js`
- Test: `tests/worktree-docs.test.js` — repointed at the new headings and scout row order
- Test: `tests/init-todo-ask.test.js` — repointed at `## 5. TODO`

**Interfaces:**
- Consumes: `node <plugin>/scripts/task.js profile preset <manual|balanced|lean> [--project <dir>|--default]` from Task 1; `WIZ_STEPS[i].t` titles from `assets/station/station.js`
- Produces: the init skill headings `## 0. The scout`, `## 1. Habits`, `## 2. The gate`, `## 3. Visibility and the word list`, `## 4. docs.json, raw data first`, `## 5. TODO`, `## 6. The directory tree`, `## 7. CLAUDE.md`, `## 8. Memory`, `## 9. Close` — Task 3's guide cites `## 1. Habits` as 第 1 步

**Dispatch:** implementer, sonnet — the plan carries the text; transcription plus tests.

- [ ] Step 1. Write the failing tests. Replace the whole of `tests/init-skill.test.js` with:

```js
'use strict';

// docs/90-agent/plans/2026-09-30-init-design.md §3 and §4;
// docs/90-agent/plans/2026-10-15-init-quick-setup-design.md §1 and §3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', 'skills', 'fankeel-init', 'SKILL.md');
const text = () => fs.readFileSync(FILE, 'utf8');
const flat = () => text().replace(/\s+/g, ' ');
const between = (from, to) => { const t = text(); return t.slice(t.indexOf(from), t.indexOf(to)).replace(/\s+/g, ' '); };

test('fankeel-init is model-invocable and its description routes on the onboard: line', () => {
  const head = text().split(/\n---\r?\n/)[0];
  assert.doesNotMatch(head, /disable-model-invocation/);
  assert.match(head, /^description: .*`onboard:`/m);
});

test('the steps run in the design\'s order: scout, habits, the gate, the docs half, onboard.js --full last', () => {
  const t = text();
  let at = -1;
  for (const h of ['## 0. The scout', '## 1. Habits', '## 2. The gate', '## 3. Visibility', '## 4. docs.json', '## 5. TODO', '## 6. The directory tree', '## 7. CLAUDE.md', '## 8. Memory', '## 9. Close']) {
    const i = t.indexOf(h);
    assert.ok(i > at, h + ' is missing or out of order');
    at = i;
  }
  assert.match(flat(), /scripts\/onboard\.js --full --root <project>/);
  assert.doesNotMatch(flat(), /先跳過/);
});

test('the habits heading comes before the docs.json heading, and the gate names its three answers', () => {
  const t = text();
  assert.ok(t.indexOf('## 1. Habits') >= 0 && t.indexOf('## 1. Habits') < t.indexOf('## 4. docs.json'));
  const gate = between('## 2. The gate', '## 3. Visibility');
  for (const a of ['**整理**', '**先不要**', '**下次再說**']) assert.ok(gate.includes(a), a);
  assert.match(gate, /\*\*先不要\*\* — runs `node <plugin>\/scripts\/task\.js profile set init\.skip true --project <name>`/);
  assert.match(gate, /every later survey reads the unfiled pages and the undescribed tree as the present/);
  assert.match(gate, /\*\*下次再說\*\* — writes nothing/);
  assert.match(flat(), /profile set init\.skip false/);
});

test('the habits step offers three presets and 逐項設定, each preset one command, the cards in the wizard\'s order', () => {
  global.window = { STATION: {} };
  const V = require('../assets/station/station.js');
  const step = between('## 1. Habits', '## 2. The gate');
  for (const o of ['**建議值** (`balanced`, recommended)', '**省 context** (`lean`)', '**每關都問** (`manual`)', '**逐項設定**']) assert.ok(step.includes(o), o);
  assert.match(step, /scripts\/task\.js profile preset <balanced\|lean\|manual> --project <name>/);
  assert.ok(step.includes(V.WIZ_STEPS.map((s) => s.t).join(', ')), 'the cards in WIZ_STEPS order');
  assert.ok(step.indexOf('profile preset') < step.indexOf('compact-window.js show'), 'compact.at is asked after the preset');
});

test('drift goes to fankeel-reader by batch, four at once by default, each page settled one of three ways', () => {
  const f = flat();
  assert.match(f, /docs-audit\.js --batches --root <project>/);
  assert.match(f, /fankeel:fankeel-reader/);
  assert.match(f, /four at once by default/);
  assert.match(f, /update the page, move its `last_verified`, or move it into the archive/);
});

test('CLAUDE.md cuts go to fankeel-slimmer, and memory is reported, never merged', () => {
  const f = flat();
  assert.match(f, /fankeel:fankeel-slimmer/);
  assert.match(f, /memory-check\.js --root <open>/);
  assert.match(f, /nothing is merged/);
});

test('a fat MEMORY.md line is a slimmer cut, not a step-8 finding', () => {
  assert.match(flat(), /A `MEMORY\.md` line that carries more than its title, link and a short hook is a slimmer cut, not a step-8 finding: it goes with step 7's dispatch\./);
});

// docs/03-decisions/2026-10-12-compact-at.md.
test('step 1 asks the four compact.at tiers, applies only in a fankeel task, and says task.js start syncs the window', () => {
  const f = between('## 1. Habits', '## 2. The gate');
  assert.match(f, /scripts\/compact-window\.js show/);
  assert.match(f, /`compact\.at` the source `builtin`/);
  for (const v of ['450000', '350000', '600000', '1000000', 'off']) assert.ok(f.includes(v), v);
  assert.match(f, /scripts\/task\.js profile set compact\.at <value> --default/);
  assert.match(f, /only applies in a session that is running a fankeel task/);
  assert.match(f, /`task\.js start` syncs `env\.CLAUDE_CODE_AUTO_COMPACT_WINDOW` to `compact\.at` each time a task starts/);
  assert.ok(!f.includes('compact-window.js set <n>'));
  assert.ok(!f.includes('compact-window.js decline'));
  assert.match(f, /No answer writes nothing/);
  assert.match(text().split(/\n---\r?\n/)[0], /^source_of_truth: .*scripts\/compact-window\.js/m);
});
```

- [ ] Step 2. Run `node --test tests/init-skill.test.js`. Five tests fail: the order test (`## 1. Habits is missing or out of order`), the gate test, the habits test, the step-8 sentence and the step-1 compact test; three pass.

- [ ] Step 3. Write the skill header changes. In `skills/fankeel-init/SKILL.md`, change `last_verified: 2026-10-12` to `last_verified: 2026-10-15`, and replace the two lines

```text
**Done when** `node <plugin>/scripts/onboard.js --full --root <project>` exits
0. Short of that, the checks that failed are named and left at their step.
```

with, in `skills/fankeel-init/SKILL.md`:

```md
**Done when** step 1 has written the habits and either step 2 was answered
先不要 or 下次再說, or `node <plugin>/scripts/onboard.js --full --root <project>`
exits 0. Short of that, the checks that failed are named and left at their step.
```

- [ ] Step 4. Write the steps. In `skills/fankeel-init/SKILL.md`, replace everything from the line `## 0. The scout and the first gate` to the end of the file with:

```md
## 0. The scout

Dispatch one `subagent_type: fankeel:fankeel-init-scout` — its file pins
`sonnet` — with `<project>` and `<open>`, and say how many, and on which model:
one, `fankeel-init-scout`, on `sonnet`.
Its `status:` and `drafts:` are what every step below starts from. Nothing is
asked before step 1: the habits come first, and the docs half waits behind
step 2's gate.

## 1. Habits

`node <plugin>/scripts/task.js profile show --project <name>` first. A
`profile.json` already there is read as it is: nothing in it is migrated, and
only what an answer below writes changes.

- The first question, one `AskUserQuestion`, four options in this order:
  **建議值** (`balanced`, recommended), **省 context** (`lean`), **每關都問**
  (`manual`), **逐項設定**. Each description says what its preset writes —
  `PRESETS` in `<plugin>/lib/profile.js` — and 建議值's says that
  `land.integration` and `land.push` come from this repository's history
  where `profile suggest` reads one.
- 建議值, 省 context and 每關都問 run one command and are done:
  `node <plugin>/scripts/task.js profile preset <balanced|lean|manual> --project <name>`.
  It writes a value as `profile set` does and clears a `null` as
  `profile unset` does. Show its lines; one ending `(from history)` is a value
  the history chose over the preset's.
- 逐項設定 asks one `AskUserQuestion` per card, in the station wizard's order:
  收尾, 任務大小, 前端, context, 撞檔, 模型, 監控站, 答 gate (`WIZ_STEPS` in
  `<plugin>/assets/station/station.js`). Each card's options are its habits;
  an answer runs `node <plugin>/scripts/task.js profile set <key> <value> --project <name>`
  for each key it sets and `node <plugin>/scripts/task.js profile unset <key> --project <name>`
  for each key it clears.

Then, whichever answer, two keys that carry this repository's own evidence:

- `worktree` — `false` (the builtin), `true` (every task opens its own
  checkout), `bounded` (bounded and architectural tasks do) or `architectural`
  (only those).
- `commit.format` — `node <plugin>/scripts/task.js profile suggest --project <name>`
  prints one when four in five of the last fifty non-merge subjects read
  `type(scope): `, built from the types the log used and no others. Offer it
  as the recommended answer with its evidence line, and say that
  `land.js merge` writes `merge: <task>`, so a pattern without `merge` refuses
  `land.js merge` until the user adds it. Write nothing the user did not pick.

One more question belongs to the machine, not to the profile, and is asked on
its own after the preset, whatever the scout's `profile` row says:

- The auto-compact window — asked when
  `node <plugin>/scripts/task.js profile show` gives `compact.at` the
  source `builtin` (nobody has chosen); a row sourced `project` or a machine
  default is not asked again. First run
  `node <plugin>/scripts/compact-window.js show`: when it prints `set <n>`,
  the descriptions say this machine already has a machine-wide
  `CLAUDE_CODE_AUTO_COMPACT_WINDOW` of `<n>`. The next `task.js start`
  replaces that `<n>` with the answer, and the descriptions say so. One `AskUserQuestion`, four options in this order: `450000`,
  recommended (the default); `1000000` — for document work and long files,
  keeps up to 1M in context, spends the most, and needs a 1M-context model;
  `600000` — loose, keeps more in context and spends
  more; 不設 (`off`) — fankeel's own mod, `hooks/compact.ts`, never compacts
  (the host's own auto-compact, or a machine-wide
  `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, still can), and the description says this
  burns tokens heavily. `350000` — conservative, compacts sooner and spends
  fewer tokens — is reachable through **Other**; the key takes only those five
  values. The descriptions say what the answer does: it only applies in a
  session that is running a fankeel task — `hooks/compact.ts` compacts the main
  conversation once its context reaches that many tokens. It is a mod, so it
  acts only in an interactive session where the mod is loaded (the session has
  pressed Enable under `/plugin`), and never in a headless `claude -p` session.
  The descriptions say so too. The answer is not written to `settings.json`
  now, but `task.js start` syncs `env.CLAUDE_CODE_AUTO_COMPACT_WINDOW` to
  `compact.at` each time a task starts, but only once `compact.at` has been
  chosen (it writes only when the value differs,
  keeping a `.fankeel-bak` copy of a settings.json that already existed), so
  the host's own auto-compact, which fires about 30k tokens before the window,
  then applies to every session on the machine. `off` and a
  `compact-window.declined` marker left by an earlier init are left alone, and
  the descriptions say so. When settings.json cannot be written, start prints
  `compact window: not synced — <reason>` and goes on. When start prints `compact window: <n> written to <file>`,
  the user restarts Claude Desktop; sessions already open keep the old window.
  350000, 600000 and 1000000 have not been measured, and the descriptions say so. The
  answer runs
  `node <plugin>/scripts/task.js profile set compact.at <value> --default`.
  No answer writes nothing, and `task.js start` then leaves the machine's
  window as it is.

## 2. The gate

One `AskUserQuestion` after the habits, three options in this order:

- **整理** — organise the docs: `docs.json`, the TODO, the directory tree,
  `CLAUDE.md`, memory and the word list. Steps 3 to 9 run.
- **先不要** — runs
  `node <plugin>/scripts/task.js profile set init.skip true --project <name>`;
  after it, `task.js start` prints no `onboard:` line for this project. Its
  description says what skipping costs — every later survey reads the unfiled
  pages and the undescribed tree as the present — and that `/fankeel-init`
  still runs the docs steps on any later day.
- **下次再說** — writes nothing; the `onboard:` line comes back at the next
  `task.js start`.

先不要 and 下次再說 end the skill here, with the habits already written.

## 3. Visibility and the word list

First of the docs half, because everything it writes is committed afterwards.

- `gh repo view --json visibility` answers `public` or `private`; no remote is
  `local`; no `gh`, or no answer, is `unknown`. Visibility only sets how hard to
  ask: on `public`, recommend a word list and `block`.
- The list is `.fankeel/sensitive.txt`, one word per line. Add `sensitive.txt`
  to `.fankeel/.gitignore` before writing it: the list is itself sensitive, and
  it is per machine — a new machine sets it again.
- Ask for `sensitive.mode` — `warn`, the default, or `block` — and
  `sensitive.review` — `false`, the default, or `true`, recommended on
  `public` — and set each with
  `node <plugin>/scripts/task.js profile set <key> <value> --project <name>`.
- Specs and plans are committed as they always are: the list decides what a
  commit is warned about, not whether a plan lands.

## 4. docs.json, raw data first

- Take the scout's `data` drafts to the user one directory at a time. Each one
  approved becomes a bucket `{ "path": "<dir>", "role": "data" }` — a path and a
  role, nothing more. A `data` bucket is not a document: docs-check and
  docs-audit skip it and it is never counted unfiled.
- No `docs.json`: offer the three shapes, `audience` as option one, and write
  the chosen one with `lib/docs.js`'s `write(root, PRESETS[<shape>])` —
  `node -e "const d=require('<plugin>/lib/docs.js');d.write('<project>',d.PRESETS['<shape>'])"` —
  then add the approved `data` buckets to it.
- Pages already on disk:
  `node <plugin>/scripts/docs-move.js plan --to <shape> --out <project>/.fankeel/build/moves.tsv --root <project>`,
  show the table, and only after approval
  `node <plugin>/scripts/docs-move.js apply --to <shape> --table <project>/.fankeel/build/moves.tsv --root <project>`.
- The scout's `file` drafts settle what is still unfiled: a bucket for its
  directory, or a move.

## 5. TODO

- A `TODO.md` already there: ask one question first, two options.
  **Move it into docs**: declare a `role: todo` bucket — `docs/90-agent/todo`
  under `audience` — run `node <plugin>/scripts/todo.js migrate --root <project>`
  (each line becomes an entry file whose body is that line and a source line,
  and `TODO.md` is removed; its text stays in git history), then
  `node <plugin>/scripts/todo-check.js --root <project>`. Every open entry it
  names `thin body` gets its body written from that line's history — `git log`
  on the old `TODO.md` finds the commit that brought the line in — in three
  parts: where it came from, what it should become, what counts as done, at
  least 200 characters together. An entry it names `no reason` (text outside the
  migration template and its own description under 200 characters) needs a reason
  written by hand, not derived from history: a `## 為什麼還開著` section naming the
  incident, session or sha and what done looks like. **Keep the hand-written `TODO.md`**: declare
  no bucket; `orient`, todo-check and the station go on reading it, and
  `todo.js migrate` can move it in any later day.
- None: declare the same bucket and create its empty folder.

## 6. The directory tree

`node <plugin>/scripts/layout.js --root <project>` prints the half a listing
can derive. Fill each row with the scout's `tree` draft, show the result as a
diff, and take the user's approval row by row before writing it into the file
`onboard.js` found the tree in — `README.md` where there was none.

## 7. CLAUDE.md

- `node <plugin>/scripts/input-check.js --root <open>` lists every `CLAUDE.md`
  loaded at `<open>` — global, above, at `<open>` and under it — and each
  `MEMORY.md`, with sizes.
- Put the scout's `scope:`, `contradiction:` and `duplicate:` lines to the user
  as diffs: a repository's own rule moves into that repository's `CLAUDE.md`, a
  duplicate loses one side, and a contradiction is the user's to settle. Each
  file is written only after its own approval.
- Cuts for size go to one `subagent_type: fankeel:fankeel-slimmer`, never here.

## 8. Memory

`node <plugin>/scripts/memory-check.js --root <open>`, and name every other
open location under this workspace that keeps a memory of its own. Report only:
nothing is merged, and no entry is written in advance.
A `MEMORY.md` line that carries more than its title, link and a short hook is
a slimmer cut, not a step-8 finding: it goes with step 7's dispatch.

## 9. Close

- Residue: the scout's `worktrees` row says whether `.gitignore` holds
  `.claude/worktrees/` and how many worktrees and spent `worktree-agent-*`
  branches `residue.js` lists. Name each one and ask whether to clean it;
  nothing is deleted unasked.
- Drift: `node <plugin>/scripts/docs-audit.js --batches --root <project>` lists
  one batch per bucket. Each batch goes to one `subagent_type:
  fankeel:fankeel-reader`, four at once by default, with its pages and the
  question *which of these no longer describe the code*. A page it names is
  settled only when the user picks one of three: update the page, move its
  `last_verified`, or move it into the archive.
- Then `node <plugin>/scripts/onboard.js --full --root <project>`. Exit 0 is
  done: run `node <plugin>/scripts/task.js profile set init.skip false --project <name>`
  so a later start checks again, and say so. Anything else: name each failing
  line and go back to its step.
```

- [ ] Step 5. Write the scout's row order. In `agents/fankeel-init-scout.md`, replace

```text
`status:` one row per step, in the skill's order — visibility, docs.json,
TODO, tree, CLAUDE.md, memory, profile, worktrees — each `done`, `partial` or
```

with, in `agents/fankeel-init-scout.md`:

```md
`status:` one row per step, in the skill's order — profile, visibility,
docs.json, TODO, tree, CLAUDE.md, memory, worktrees — each `done`, `partial` or
```

- [ ] Step 5b. Repoint the two tests that slice the init skill by heading. In `tests/worktree-docs.test.js`, lines 26-27 become:

```js
    const seven = t.slice(t.indexOf('## 1. Habits'), t.indexOf('## 2. The gate'));
    const eight = t.slice(t.indexOf('## 9. Close'));
```

and line 40 becomes `assert.match(t, /profile, visibility,\s+docs\.json, TODO, tree, CLAUDE\.md, memory, worktrees/);`. In `tests/init-todo-ask.test.js`, lines 15-16 become:

```js
  const from = text.indexOf('## 5. TODO');
  const to = text.indexOf('## 6.', from);
```

- [ ] Step 6. Run `node --test tests/init-skill.test.js tests/worktree-docs.test.js tests/init-todo-ask.test.js tests/agents.test.js tests/skills.test.js`. All pass. `tests/skills.test.js` is run because its `classify()` reads every `task.js` flag the skill names.

- [ ] Step 7. Commit `skills/fankeel-init/SKILL.md`, `agents/fankeel-init-scout.md`, `tests/init-skill.test.js`: `feat: fankeel-init asks habits first, then one gate before the docs`.

## Task 3: the wizard's 省 context writes all, and the guide says how presets are applied

**Files:**
- Modify: `assets/station/station.js:1985-1995` — the agents step's H2 habit sets `stage.agents: all` and its blurb says so
- Modify: `assets/station/i18n.js` — the English `wiz.agentsH2B`
- Modify: `docs/01-guide/profile.md` — line 61's three sentences on 省 context and the init step number; the `profile preset` verb in the command list and its bullet
- Read: `lib/profile.js` — `PRESETS.lean.set['stage.agents']`, the value the new test compares against
- Test: `tests/station-wizard.test.js`

**Interfaces:**
- Consumes: `profile preset <manual|balanced|lean>` and its `(from history)` marker from Task 1; the init skill's `## 1. Habits` from Task 2
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the text; transcription plus tests.

- [ ] Step 1. Write the failing test. In `tests/station-wizard.test.js`, replace the line

```text
    assert.equal(W.pick[3], 2, 'the 省 context card matches what is on disk');
```

with, in `tests/station-wizard.test.js`:

```js
    assert.equal(W.pick[3], undefined, 'survey,build,verify on disk is the 交三站 card, and no habit writes it');
```

And at the end of `tests/station-wizard.test.js`, add:

```js
// docs/90-agent/plans/2026-10-15-init-quick-setup-design.md §4.
test('the wizard\'s 省 context habit and PRESETS.lean write the same stage.agents', () => {
    const step = V.WIZ_STEPS.findIndex((s) => s.id === 'agents');
    const h = V.WIZ_STEPS[step].habits.findIndex((x) => x.l === '省 context');
    assert.ok(h >= 0, 'the agents step has a 省 context habit');
    assert.equal(V.WIZ_STEPS[step].habits[h].s['stage.agents'], profile.PRESETS.lean.set['stage.agents']);
    let W = load();
    W.step = step;
    W = V.wizApply(W, KEYS, PROFILES, { h: String(h) });
    assert.equal(W.val['stage.agents'], 'all');
});
```

- [ ] Step 2. Run `node --test tests/station-wizard.test.js`. Two tests fail: the `wizLoad` test (`2 !== undefined`) and the new one (`'survey,build,verify' !== 'all'`).

- [ ] Step 3. Write the habit. In `assets/station/station.js`, replace the line

```text
                { l: loc('wiz.agentsH2L', '省 context'), b: loc('wiz.agentsH2B', 'survey、build、verify 三站交出去。'), s: { 'stage.agents': 'survey,build,verify' } },
```

with, in `assets/station/station.js`:

```js
                { l: loc('wiz.agentsH2L', '省 context'), b: loc('wiz.agentsH2B', '每一站都交給站 agent，在自己乾淨的 context 裡跑；主 session 只拿回路徑。'), s: { 'stage.agents': 'all' } },
```

In `assets/station/i18n.js`, replace the line `            'wiz.agentsH2B': 'Hand off survey, build and verify.',` with:

```js
            'wiz.agentsH2B': 'Every stage goes to a stage agent and runs in its own clean context; the main session only gets paths back.',
```

- [ ] Step 4. Run `node --test tests/station-wizard.test.js`. Every test passes.

- [ ] Step 5. Write the guide. In `docs/01-guide/profile.md`, line 61, make four replacements; each old piece occurs exactly once.

Replace

```text
`PRESETS.balanced` 那一行的註解也這樣寫，精靈「省 context」按鈕的說明同樣只寫「三站交出去」，沒有理由。
```

with, in `docs/01-guide/profile.md`:

```md
`PRESETS.balanced` 那一行的註解也這樣寫。
```

Replace

```text
精靈 agents 那一步有三顆會交出站的按鈕：「只交出 survey」設 `survey`；「省 context」的值在 `assets/station/station.js:1991`，是 `survey,build,verify`，其餘幾站仍由主控自己跑；「全部交出去」的值在 `assets/station/station.js:1992`，是 `all`，七站都交出去。
```

with, in `docs/01-guide/profile.md`:

```md
精靈 agents 那一步有三顆會交出站的按鈕：「只交出 survey」設 `survey`；「省 context」與「全部交出去」都設 `all`（`assets/station/station.js` 的 `WIZ_STEPS`），七站都交出去，和 `PRESETS.lean` 一樣；只交 survey、build、verify 三站，要在同一步下面的卡片選「交三站」。
```

Replace

```text
程式碼裡另有兩組預設：`PRESETS.balanced` 的值在 `lib/profile.js:458`，是 `survey,build,verify`，`PRESETS.lean`（標籤也叫「省 context」）的值在 `lib/profile.js:463`，是 `all`；現在的站頁不再套用這兩組，實際寫入值的是精靈的按鈕，所以在精靈按「省 context」得到的是三站，不是 `all`。
```

with, in `docs/01-guide/profile.md`:

```md
`PRESETS.balanced` 的值是 `survey,build,verify`，`PRESETS.lean`（標籤也叫「省 context」）的值是 `all`；`/fankeel-init` 的習慣那一步用 `task.js profile preset` 套這幾組，站頁精靈則用自己的按鈕。2026-10-15 以前精靈的「省 context」寫的是三站，那時寫下的 `profile.json` 照原樣讀，不會被改寫。
```

Replace

```text
`/fankeel-init` 的第 7 步會先跑
```

with, in `docs/01-guide/profile.md`:

```md
`/fankeel-init` 的第 1 步（習慣）套完組合之後，會先跑
```

- [ ] Step 6. Write the verb into the guide. In `docs/01-guide/profile.md`, in the code block under 不開站頁也可以直接設, add after the line `node <plugin>/scripts/task.js profile suggest`:

```md
node <plugin>/scripts/task.js profile preset balanced
```

Then, in `docs/01-guide/profile.md`, replace `三個動詞各做一件事：` with `四個動詞各做一件事：`, and after the bullet that begins `` - `suggest` 只印不寫 `` add:

```md
- `preset` 一次套一整組：`manual`、`balanced` 或 `lean`，值照 `lib/profile.js` 的 `PRESETS` 寫，組合裡是 `null` 的 key 從檔案拿掉，和 `unset` 一樣。`balanced` 的 `land.integration` 與 `land.push` 改用 `suggest` 從這個 repo 歷史讀到的值，輸出在那幾行後面標 `(from history)`，再列出它讀到的證據；加 `--default` 寫機器層時不讀歷史，照組合本身的值寫。`/fankeel-init` 的第 1 步就是跑這一行。
```

- [ ] Step 7. Check the guide. Run, from the repository root:

```sh
grep -cF '三站交出去」，沒有理由' docs/01-guide/profile.md
grep -cF 'station.js:1991' docs/01-guide/profile.md
grep -cF '第 7 步' docs/01-guide/profile.md
grep -cF 'profile preset balanced' docs/01-guide/profile.md
node --test tests/profile-table.test.js
```

The first three print `0`, the fourth `1`, and the table test passes.

- [ ] Step 8. Commit `assets/station/station.js`, `assets/station/i18n.js`, `docs/01-guide/profile.md`, `tests/station-wizard.test.js`: `fix: the wizard's 省 context writes all, as PRESETS.lean does`.

## Coverage

| promise | task |
|---|---|
| fankeel-init's first step after the scout is the habits step (today's step 7, moved up); the sensitive word list stays with the docs half. | Task 2 |
| Its first question has four options: 建議值 (`balanced`, recommended), 省 context (`lean`), 每關都問 (`manual`), 逐項設定. The first three run one command and are done; 逐項 asks one card at a time in the station wizard's order. | Task 2 |
| `compact.at` is still asked on its own after the preset, because it writes the machine-wide window; worktree and `commit.format` stay where step 7 has them. | Task 2 |
| `task.js profile preset <manual\|balanced\|lean> [--project <dir>\|--default]` writes `PRESETS[name].set` the way the station's wizApply does: a value as `profile set`, `null` as `unset`. | Task 1 |
| For `balanced`, a `land.integration` or `land.push` that `profile suggest` reads off this repository's history replaces the preset's value, and the output says which came from history. | Task 1 |
| After habits, one AskUserQuestion: 整理 docs (docs.json, TODO, tree, CLAUDE.md, memory, word list) / 先不要 — writes `init.skip true`, so `task.js start` stops printing `onboard:` / 下次再說 — writes nothing, `onboard:` comes back next start. | Task 2 |
| The station wizard's 省 context option writes `stage.agents: all`, as `PRESETS.lean` does (the user's 2026-10-02 ruling); `survey,build,verify` keeps its 交三站 label. Existing profile.json files are read as they are. | Task 3 |
| `task.js profile preset balanced --project <tmp>` on a repo whose history says `pr` writes `land.integration: pr` and `stage.agents: survey,build,verify` — fails now (no such verb). | Task 1 |
| tests/init-skill.test.js: the habits heading comes before the docs.json heading, and the gate's three answers are named — fails now. | Task 2 |
| The wizard's 省 context option and `PRESETS.lean` carry the same `stage.agents` — fails now (`survey,build,verify` vs `all`). | Task 3 |
