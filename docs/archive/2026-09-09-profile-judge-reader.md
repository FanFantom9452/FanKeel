---
status: design-intent
last_verified: 2026-09-09
source_of_truth: docs/archive/2026-09-09-profile-judge-reader-design.md
---

# Profile, Judge and Reader Implementation Plan

**Goal:** 一份 `profile.json` 讓 land 的 menu 與 `guard` 不再每次問；兩個 plugin
自帶的 custom agent——`fankeel-reader` 唯讀、`fankeel-judge` 一次性判斷——
和一支把判斷逐字歸檔到 `docs/judgements/` 的 `scripts/judge.js`；`lib/stages.js`
多一種依 profile 鍵開關的規則。

**Architecture:** 照這個 repo 的 lib／scripts／hooks 分層：純函式進 `lib/profile.js`，
CLI 進 `scripts/task.js profile` 與 `scripts/judge.js`，注入層在 `lib/render.js`
多收一個 `profile` 參數，由 `hooks/inject.js` 與 `hooks/resume.js` 各自讀一次。
規則的條件開關是每個 stage 一個 `when: [{ when, text }]` 陣列，與現有的字串
`rules` 並列——所有讀 `.rules` 的地方（`tests/stages.test.js`、`lib/skills.js`
的文字掃描）因此不動。station 的設定面照 `/clear` 的樣子：資料進
`station-data.js`，寫入只在 `serve` 的 `POST /profile`。

**Tech Stack:** Node 內建，`node --test`（`package.json` 的 `test`），無外部相依，
`private: true`。`util.parseArgs` 已在 `scripts/task.js:181` 用著。

**Spec:** [2026-09-09-profile-judge-reader-design.md](2026-09-09-profile-judge-reader-design.md)

## Global Constraints

從 `CONTRIBUTING.md` 的 `## Scope and ownership`、`.fankeel/map.md`、`package.json`
與測試套件抄來的實數：

- `lib/*.js` 是純函式，直接測；**`lib/` 不得 require `scripts/` 或 `hooks/`**，只有
  反方向可以（`CONTRIBUTING.md` Core logic 列）。`lib/stages.js` require
  `lib/profile.js` 是 lib→lib，可以。
- `scripts/*.js` 是 `lib/` 的薄殼。**station CLI 的新 flag 要在 `docs/station.md`
  有一列，否則 `tests/station-doc.test.js` 紅**——本計畫不加 station 的 flag，只加
  一條 POST 路由。
- 每個 hook 在每條路徑都 exit 0，包括自己的錯誤。profile 讀失敗只能少一行，不能
  讓注入消失。
- 測試用 `node --test`。**每個 export 的名字都要有 importer，新檔要先 `git add`
  `tests/source.test.js` 才看得見**（`tests/source.test.js:17-20`）；frontmatter
  除 `status`／`last_verified`／`source_of_truth` 外的鍵不得含裸的 repo 路徑
  （`tests/source.test.js:132-148`）——兩個 agent 檔的 `description` 不要寫路徑。
- **注入區塊上限 2400 字元**，只在 `tests/render.test.js:538` 斷言，每個 stage 各量
  一次；`survey` 必須仍含 `one workflow, every path:line checked`
  （`tests/render.test.js:540`）。加規則要用替換換空間，不改上限。
- `tests/stages.test.js:44-45` 要每個 stage 的 `rules` ≥3 條、每條 >20 字且是字串；
  `:197` 數總條數、`:202` join 全文——所以條件規則放**另一個陣列**。
- `tests/docs.test.js:460`：`docs/README.md` 的 `## Roles` 表要列出 `docs.json`
  的每個 bucket。新 bucket 與它的列在同一個 task。
- `docs-check` 對 `report`／`archive` 不驗連結（`scripts/docs-check.js:201`）。
- `lib/docs.js normalise()` 只驗 role 在 `ROLES` 內（`lib/docs.js:33,122`），不驗
  目錄存在。
- 文件：新頁面在同一個 change 拿到索引列（`CONTRIBUTING.md` Documentation 列）。
  歸檔照 map：`docs` reference、`docs/plans` plan、`docs/reports` report。
- 版本號由 `scripts/version.js` 移，本計畫不動。
- commit 用 conventional commits（`feat(profile):`、`test(judge):` 這類）。
- 每個 task 收尾跑 `node --test tests/` 全綠（spec reporter 看 `ℹ pass|fail`），不是
  只跑自己那個檔。
- `.fankeel/.gitignore` 的五行（`sessions/ map.md build/ index.html station/`）
  不加 `profile.json`。

## File structure

| file | 責任 |
|---|---|
| `lib/profile.js` | 新。鍵表、兩層檔案的讀合併、單鍵寫入、`git log` 的建議、注入用的兩個字串。 |
| `scripts/task.js` | `profile show\|set\|suggest`；`start` 套 profile 的 `guard`。 |
| `lib/stages.js` | `ALWAYS_WHEN` 與每 stage 的 `when`；`{{PROFILE_LAND}}`、`{{JUDGE}}` token；reader 換字。 |
| `lib/render.js` | `render`／`renderResume` 收 `profile`；`profile:` 行；`renderBrief` 的 judge 行。 |
| `hooks/inject.js`、`hooks/resume.js` | 各讀一次 profile 交給 render。 |
| `hooks/brief.js` | 註解改：agent type 現在有一個分支。 |
| `agents/fankeel-reader.md`、`agents/fankeel-judge.md` | 新。兩個 agent 定義。 |
| `.claude-plugin/plugin.json` | `agents` 陣列。 |
| `scripts/judge.js` | 新。`record`。 |
| `lib/station.js`、`scripts/station.js` | `profiles` 進資料檔；`POST /profile`。 |
| `assets/station/station.js`、`assets/station/index.html` | profile 區。 |
| `.fankeel/docs.json`、`docs/README.md` | `docs/judgements`、`agents` 兩個 bucket 與 Roles 列；judgements 表。 |
| `docs/documents.md`、`docs/registry.md`、`docs/subagents.md`、`docs/station.md`、`docs/pipeline.md`、`docs/improvement-brief.md` | 壽命表、樹、兩個 agent、設定面、`when`、§4.2／4.3 補記。 |
| `skills/fankeel/SKILL.md`、`skills/fankeel-land/SKILL.md`、`skills/fankeel-survey/SKILL.md`、`skills/fankeel-verify/SKILL.md` | 樹、不變量 6、menu、reader 型別。 |

profile 檔的形是**扁平的點號鍵**，跟 `KEYS` 一對一：

```json
{ "land.integration": "merge", "land.push": false, "guard": "ask" }
```

## Task 1: `lib/profile.js`

**Files:**
- Modify: `lib/profile.js` — 新檔，全部內容如下
- Read: `lib/registry.js` — `readFile` 的 parse-or-null 樣子（`lib/registry.js:139`）
- Read: `tests/tmp.js` — 測試用的暫存目錄 helper
- Test: `tests/profile.test.js`

**Interfaces:**
- Consumes: none
- Produces: `KEYS`（`{ [key]: { values: string[], builtin: string|null } }`）、
  `projectFile(projectRoot) → string`、`machineFile(configDir) → string|null`、
  `configDirOf(env) → string|null`、`read(projectRoot, configDir) → { values, sources, unreadable }`、
  `write(file, key, raw) → { ok, file?, key?, value?, reason? }`、
  `suggest(projectRoot) → { values, evidence: string[] }`、
  `landClause(values) → string`、`summary(values, sources) → string`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

In `lib/profile.js`, the whole file:

```js
'use strict';

// One profile per project, committed beside docs.json, and one per machine
// under the config dir. Values merge per key — a project that sets only
// `land.push` still gets the machine's `guard`. Built-in defaults are the
// third layer, and `sources` says which layer each value came from.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PROJECT_FILE = ['.fankeel', 'profile.json'];
const MACHINE_FILE = ['fankeel', 'profile.json'];

// Every key, its allowed values, and the built-in default (null: ask).
const KEYS = {
    'land.integration': { values: ['merge', 'pr', 'keep'], builtin: null },
    'land.push': { values: ['true', 'false'], builtin: null },
    'land.archivePlan': { values: ['true', 'false'], builtin: null },
    guard: { values: ['ask', 'deny', 'off'], builtin: 'ask' },
    'dispatch.floor': { values: ['sonnet', 'opus', 'fable'], builtin: 'sonnet' },
    'judge.enabled': { values: ['true', 'false'], builtin: 'true' },
    'judge.model': { values: ['sonnet', 'opus', 'fable'], builtin: 'fable' },
};

function projectFile(projectRoot) {
    return path.join(projectRoot, ...PROJECT_FILE);
}
function machineFile(configDir) {
    return configDir ? path.join(configDir, ...MACHINE_FILE) : null;
}
// The same answer `scripts/task.js claudeDir()` gives without an --claude-dir:
// the variable first, then the home directory. Kept here so hooks can use it
// without reaching into scripts/.
function configDirOf(env) {
    const e = env || process.env;
    if (e.CLAUDE_CONFIG_DIR) return e.CLAUDE_CONFIG_DIR;
    const home = e.HOME || e.USERPROFILE;
    return home ? path.join(home, '.claude') : null;
}

// Parse-or-null, like registry.readFile: a missing file is silence, a file
// that does not parse is reported so the injected line can say so once.
function readOne(file) {
    if (!file) return { values: null, unreadable: false };
    let raw;
    try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { return { values: null, unreadable: false }; }
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { values: null, unreadable: true };
        return { values: parsed, unreadable: false };
    } catch (e) {
        return { values: null, unreadable: true };
    }
}

function parseValue(key, raw) {
    const spec = KEYS[key];
    if (!spec) return { error: 'unknown key: ' + key + '. Keys: ' + Object.keys(KEYS).join(', ') };
    const s = String(raw).trim().toLowerCase();
    if (!spec.values.includes(s)) return { error: key + ' is one of: ' + spec.values.join(', ') };
    return { value: s === 'true' ? true : s === 'false' ? false : s };
}

function read(projectRoot, configDir) {
    const pFile = projectRoot ? projectFile(projectRoot) : null;
    const mFile = machineFile(configDir);
    const project = readOne(pFile);
    const machine = readOne(mFile);
    const values = {};
    const sources = {};
    const unreadable = [];
    if (project.unreadable) unreadable.push(pFile);
    if (machine.unreadable) unreadable.push(mFile);
    const pick = (obj, key) => (obj && Object.prototype.hasOwnProperty.call(obj, key) ? parseValue(key, obj[key]) : null);
    for (const key of Object.keys(KEYS)) {
        const p = pick(project.values, key);
        const m = pick(machine.values, key);
        // A value the table refuses is read as absent: the file is somebody's
        // hand edit, and less guidance beats a refused hook.
        if (p && !p.error) { values[key] = p.value; sources[key] = 'project'; continue; }
        if (m && !m.error) { values[key] = m.value; sources[key] = 'machine'; continue; }
        if (KEYS[key].builtin !== null) { values[key] = parseValue(key, KEYS[key].builtin).value; sources[key] = 'builtin'; }
    }
    return { values, sources, unreadable };
}

function write(file, key, raw) {
    const parsed = parseValue(key, raw);
    if (parsed.error) return { ok: false, reason: parsed.error };
    const current = readOne(file);
    if (current.unreadable) return { ok: false, reason: file + ' does not parse; fix it by hand first' };
    const next = Object.assign({}, current.values || {}, { [key]: parsed.value });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
    return { ok: true, file, key, value: parsed.value };
}

function git(cwd, args) {
    try {
        return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) {
        return null;
    }
}

// What the history already answers. Only land's two questions have evidence
// on disk — the registry never held `guard` and class is per task.
function suggest(projectRoot) {
    const values = {};
    const evidence = [];
    const merges = git(projectRoot, ['log', '--merges', '--format=%s']);
    if (merges === null) return { values, evidence: ['not a git repository, or git is not on PATH'] };
    const subjects = merges.split('\n').filter(Boolean);
    const pr = subjects.filter((s) => /^Merge pull request/i.test(s)).length;
    const local = subjects.length - pr;
    evidence.push('merges: ' + local + ' local, ' + pr + ' pull request');
    if (subjects.length >= 3) values['land.integration'] = pr > local ? 'pr' : 'merge';
    const remotes = (git(projectRoot, ['remote']) || '').split('\n').filter(Boolean);
    const unpushed = (git(projectRoot, ['log', '--oneline', '--branches', '--not', '--remotes']) || '').split('\n').filter(Boolean).length;
    evidence.push(remotes.length ? 'remotes: ' + remotes.join(', ') + '; ' + unpushed + ' commits on no remote' : 'no remote');
    if (!remotes.length || unpushed >= 3) values['land.push'] = false;
    else if (remotes.length && unpushed === 0) values['land.push'] = true;
    return { values, evidence };
}

// The two strings the injected block carries. `landClause` is what fills
// {{PROFILE_LAND}} and is never empty: `substitute` skips a falsy value and
// would ship the raw token.
function landClause(values) {
    const parts = [];
    if (values && values['land.integration']) parts.push(values['land.integration']);
    if (values && values['land.push'] === true) parts.push('push');
    if (values && values['land.push'] === false) parts.push('no push');
    if (!parts.length) return 'the profile has no land answer: open the menu from the fankeel-land skill';
    return 'the profile says ' + parts.join(', ') + ' — do that, say so in one line, and do not open the menu';
}

// Only the keys somebody set. Built-in defaults are not news, and a line that
// listed them would be the same on every project.
function summary(values, sources) {
    const out = [];
    const land = landParts(values);
    if (land) out.push('land ' + land + tag(sources, 'land.integration', 'land.push'));
    if (values['land.archivePlan'] !== undefined) out.push('archive plan ' + values['land.archivePlan'] + tag(sources, 'land.archivePlan'));
    for (const key of ['guard', 'dispatch.floor', 'judge.enabled', 'judge.model']) {
        if (sources[key] && sources[key] !== 'builtin') out.push(key + ' ' + values[key] + tag(sources, key));
    }
    return out.join(' · ');
}
function landParts(values) {
    const parts = [];
    if (values['land.integration']) parts.push(values['land.integration']);
    if (values['land.push'] === true) parts.push('push');
    if (values['land.push'] === false) parts.push('no push');
    return parts.join(', ');
}
function tag(sources, ...keys) {
    return keys.some((k) => sources[k] === 'machine') && !keys.some((k) => sources[k] === 'project') ? ' (machine)' : '';
}

module.exports = { KEYS, projectFile, machineFile, configDirOf, read, write, suggest, landClause, summary };
```

In `tests/profile.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

const dir = () => tmp('fankeel-profile-');

test('project beats machine beats builtin, per key', () => {
    const d = dir();
    const cfg = path.join(d, 'cfg');
    fs.mkdirSync(path.join(d, '.fankeel'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(profile.projectFile(d), JSON.stringify({ 'land.push': false }));
    fs.writeFileSync(profile.machineFile(cfg), JSON.stringify({ 'land.push': true, 'land.integration': 'merge', guard: 'deny' }));
    const { values, sources, unreadable } = profile.read(d, cfg);
    assert.equal(values['land.push'], false);
    assert.equal(sources['land.push'], 'project');
    assert.equal(values['land.integration'], 'merge');
    assert.equal(sources['land.integration'], 'machine');
    assert.equal(values.guard, 'deny');
    assert.equal(values['judge.model'], 'fable');
    assert.equal(sources['judge.model'], 'builtin');
    assert.equal(values['land.archivePlan'], undefined);
    assert.deepEqual(unreadable, []);
});

test('no files at all is the builtins, and a file that does not parse is named', () => {
    const d = dir();
    const none = profile.read(d, path.join(d, 'cfg'));
    assert.equal(none.values.guard, 'ask');
    assert.equal(none.values['land.integration'], undefined);
    fs.mkdirSync(path.join(d, '.fankeel'), { recursive: true });
    fs.writeFileSync(profile.projectFile(d), '{ not json');
    const bad = profile.read(d, null);
    assert.deepEqual(bad.unreadable, [profile.projectFile(d)]);
    assert.equal(bad.values.guard, 'ask');
});

test('write refuses an unknown key and an unknown value, and merges into the file', () => {
    const d = dir();
    const file = profile.projectFile(d);
    assert.equal(profile.write(file, 'colour', 'blue').ok, false);
    assert.match(profile.write(file, 'guard', 'maybe').reason, /guard is one of/);
    assert.equal(profile.write(file, 'land.push', 'false').ok, true);
    assert.equal(profile.write(file, 'guard', 'deny').ok, true);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { 'land.push': false, guard: 'deny' });
});

test('suggest reads three local merges and no remote as merge, no push, and writes nothing', () => {
    const d = dir();
    const g = (...a) => execFileSync('git', a, { cwd: d, stdio: 'ignore' });
    g('init', '-q', '-b', 'main');
    g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
    for (let i = 0; i < 3; i++) {
        g('checkout', '-q', '-b', 'f' + i);
        g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'work ' + i);
        g('checkout', '-q', 'main');
        g('-c', 'user.name=t', '-c', 'user.email=t@t', 'merge', '-q', '--no-ff', '-m', 'merge: f' + i, 'f' + i);
    }
    const out = profile.suggest(d);
    assert.equal(out.values['land.integration'], 'merge');
    assert.equal(out.values['land.push'], false);
    assert.match(out.evidence[0], /3 local, 0 pull request/);
    assert.equal(fs.existsSync(profile.projectFile(d)), false);
});

test('the two injected strings', () => {
    assert.match(profile.landClause({}), /no land answer/);
    assert.equal(profile.landClause({ 'land.integration': 'merge', 'land.push': false }),
        'the profile says merge, no push — do that, say so in one line, and do not open the menu');
    const s = profile.summary({ 'land.integration': 'merge', 'land.push': false, guard: 'ask', 'judge.model': 'opus' },
        { 'land.integration': 'project', 'land.push': 'project', guard: 'builtin', 'judge.model': 'machine' });
    assert.equal(s, 'land merge, no push · judge.model opus (machine)');
    assert.equal(profile.summary({ guard: 'ask' }, { guard: 'builtin' }), '');
});
```

Steps: write the test, watch it fail on the missing module, write the file,
watch it pass, `git add lib/profile.js tests/profile.test.js`, run the whole
suite, commit `feat(profile): the key table and the two-layer read`.

## Task 2: `task.js profile`, and `start` reads `guard`

**Files:**
- Modify: `scripts/task.js` — `cmdProfile`、`COMMANDS`、`USAGE`、`parseArgs` 的 `--default`、`cmdStart` 套 guard
- Read: `lib/profile.js` — Task 1 的 API
- Read: `lib/docs.js` — `projectRootsFor(registryRoot, paths)`（`lib/docs.js:226`）
- Test: `tests/task.test.js`

**Interfaces:**
- Consumes: `profile.read`、`profile.write`、`profile.suggest`、`profile.projectFile`、`profile.machineFile`、`profile.configDirOf`（Task 1）；`docs.projectRootsFor`
- Produces: CLI `task.js profile show|set <key> <value>|suggest [--project <dir>] [--default]`；`start` 在 profile 的 `guard` 非 builtin 時寫 `guard` 並多印一行 `guard: <mode> (profile)`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

In `scripts/task.js`, next to the other requires at the top:

```js
const profile = require('../lib/profile.js');
const docs = require('../lib/docs.js');
```

In `scripts/task.js`, in `parseArgs`, beside `--force` and `--all`:

```js
    if (whole.includes('--default')) opts.default = true;
```

In `scripts/task.js`, above `cmdGuard`:

```js
// The project a profile belongs to: the registry root, or the directory
// `--project` names under it, resolved the way the docs lookup resolves it.
function projectRootFor(root, opts) {
    const roots = docs.projectRootsFor(root, opts.project ? [opts.project] : []);
    return roots[0] || root;
}

// Nothing here touches a session entry: a profile is the project's, not the
// task's, so `--session` is not required and no badge is written.
function cmdProfile(root, opts) {
    const verb = String(opts.positional[0] || '');
    const projectRoot = projectRootFor(root, opts);
    const cfg = claudeDir(opts);
    if (verb === 'show') {
        const { values, sources, unreadable } = profile.read(projectRoot, cfg);
        const lines = ['fankeel — profile for ' + projectRoot];
        for (const key of Object.keys(profile.KEYS)) {
            lines.push('  ' + key.padEnd(18) + (values[key] === undefined ? '(ask)' : String(values[key])).padEnd(8) + (sources[key] || ''));
        }
        for (const f of unreadable) lines.push('  unreadable: ' + f);
        return lines.join('\n');
    }
    if (verb === 'set') {
        const key = opts.positional[1];
        const value = opts.positional[2];
        if (!key || value === undefined) fail('profile set <key> <value>');
        const file = opts.default ? profile.machineFile(cfg) : profile.projectFile(projectRoot);
        if (!file) fail('No config directory to write the machine default to.');
        const out = profile.write(file, key, value);
        if (!out.ok) fail(out.reason);
        return 'fankeel — profile: ' + key + ' = ' + out.value + '  → ' + file;
    }
    if (verb === 'suggest') {
        const { values, evidence } = profile.suggest(projectRoot);
        const lines = ['fankeel — profile suggested from ' + projectRoot + ' (nothing written)'];
        for (const e of evidence) lines.push('  ' + e);
        const keys = Object.keys(values);
        if (!keys.length) { lines.push('  nothing the history answers'); return lines.join('\n'); }
        lines.push('', JSON.stringify(values, null, 2), '');
        for (const k of keys) lines.push('node ' + path.relative(process.cwd(), __filename).split(path.sep).join('/') + ' profile set ' + k + ' ' + values[k] + (opts.project ? ' --project ' + opts.project : ''));
        return lines.join('\n');
    }
    fail('profile is one of: show, set <key> <value> [--default], suggest');
}
```

In `scripts/task.js`, in `cmdStart`, after the entry's `configDir` is set
(`scripts/task.js:528`) and before it is written:

```js
    // The profile is the user's standing answer, written once with
    // `profile set guard`; applying it here is executing that instruction,
    // not the script choosing a mode — which is what invariant 6 forbids.
    const prof = profile.read(projectRootFor(root, opts), claudeDir(opts));
    if (prof.sources.guard && prof.sources.guard !== 'builtin') data.guard = prof.values.guard;
```

and in `scripts/task.js`, where `cmdStart` builds its output lines, after the
guard line it prints today:

```js
    if (prof.sources.guard && prof.sources.guard !== 'builtin') lines[lines.findIndex((l) => l.startsWith('  guard:'))] += ' (profile)';
```

(read `cmdStart` first: if the guard line is built differently, append
` (profile)` to whichever line names the mode — the test below reads
`/guard: deny \(profile\)/`.)

In `scripts/task.js`, in `COMMANDS`, after `guard: cmdGuard,`:

```js
    profile: cmdProfile,
```

In `scripts/task.js`, in `USAGE`, after the `guard` line:

```js
    '  profile show|set <key> <value>|suggest',
    '                                    the project\'s standing answers; --default writes the',
    '                                    machine file, --project <dir> picks a project under the root',
```

In `tests/task.test.js`, at the end:

```js
test('profile set writes the project file, show reads it with its source, and an unknown key exits 1', () => {
  const dir = root();
  const set = run(dir, ['profile', 'set', 'land.push', 'false']);
  assert.equal(set.code, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, '.fankeel', 'profile.json'), 'utf8')), { 'land.push': false });
  const shown = run(dir, ['profile', 'show']);
  assert.match(shown.out, /land\.push\s+false\s+project/);
  assert.match(shown.out, /guard\s+ask\s+builtin/);
  const bad = run(dir, ['profile', 'set', 'colour', 'blue']);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /unknown key/);
  const machine = run(dir, ['profile', 'set', 'guard', 'deny', '--default']);
  assert.equal(machine.code, 0);
  assert.ok(fs.existsSync(path.join(dir, 'cfg', 'fankeel', 'profile.json')));
  assert.match(run(dir, ['profile', 'show']).out, /guard\s+deny\s+machine/);
});

test('start takes guard from the profile and says so; without one the field stays absent', () => {
  const dir = root();
  run(dir, ['start', '--session', A, '--task', 'plain']);
  assert.equal(registry.readSession(dir, A).guard, undefined);
  const dir2 = root();
  run(dir2, ['profile', 'set', 'guard', 'deny']);
  const out = run(dir2, ['start', '--session', B, '--task', 'guarded']);
  assert.match(out.out, /guard: deny \(profile\)/);
  assert.equal(registry.readSession(dir2, B).guard, 'deny');
});

test('profile suggest writes nothing and says what the history answers', () => {
  const dir = root();
  const out = run(dir, ['profile', 'suggest']);
  assert.equal(out.code, 0);
  assert.match(out.out, /nothing written/);
  assert.equal(fs.existsSync(path.join(dir, '.fankeel', 'profile.json')), false);
});
```

`run()` in that file already passes `--root` and `--claude-dir`, so the machine
file lands under the temp `cfg`. Steps: tests red, code, tests green, full suite,
commit `feat(task): profile show, set, suggest; start reads the profile's guard`.

## Task 3: `docs/judgements/` and `scripts/judge.js record`

**Files:**
- Modify: `scripts/judge.js` — 新檔
- Modify: `.fankeel/docs.json` — 加 `docs/judgements` bucket
- Modify: `docs/README.md` — Roles 列，`## Judgements` 表
- Read: `lib/registry.js` — `readSession(root, id)`、`rootFor`（`lib/registry.js:118,156`）
- Read: `lib/docs.js` — `projectRootsFor(registryRoot, paths)`（`lib/docs.js:226`）
- Read: `scripts/task.js` — `parseArgs` 與 `STRING_FLAGS` 的樣子（`scripts/task.js:158-193`）
- Read: `tests/tmp.js` — 測試用的暫存目錄 helper
- Test: `tests/judge.test.js`

**Interfaces:**
- Consumes: `registry.readSession`、`registry.rootFor`
- Produces: `scripts/judge.js record --session <id> --brief <path> --answer <path|-> --slug <a-z0-9-> [--model <m>] [--root <dir>] [--project <dir>]`，寫 `<project>/docs/judgements/YYYY-MM-DD-<slug>.md` 與 `docs/README.md` 的一列，印兩個路徑；`docs/judgements` 是 `report` bucket

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

The bucket first, then its index rows, then the script.

In `.fankeel/docs.json`, after the archive bucket:

```json
    {
      "path": "docs/judgements",
      "role": "report"
    },
```

In `docs/README.md`, in the `## Roles` table after the archive row:

```md
| `docs/judgements/` | report | it is what `fankeel-judge` answered on that day, filed verbatim by `scripts/judge.js` |
```

The index table the script appends to comes next. It goes in
`docs/README.md`, above the three-scanners section:

```md
## Judgements

What a one-shot `fankeel-judge` dispatch answered, filed verbatim with its
brief by `node scripts/judge.js record`. Never edited after; a wrong judgement
is corrected by the next one, not by rewriting this.

| question | record |
|---|---|
```

In `scripts/judge.js`, the whole file:

```js
#!/usr/bin/env node
'use strict';

// Files what a `fankeel-judge` subagent answered. The judge is read-only by
// construction, so the parent session is the one that writes — and what it
// writes is what it received, verbatim: the brief it sent and the answer that
// came back. A record is never overwritten; a second on the same slug gets -2.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');
const registry = require('../lib/registry.js');
const docs = require('../lib/docs.js');

const FLAGS = ['session', 'brief', 'answer', 'slug', 'model', 'root', 'project'];

function fail(msg) {
    process.stdout.write(msg + '\n');
    process.exit(1);
}

function parse(argv) {
    const options = {};
    for (const f of FLAGS) options[f] = { type: 'string' };
    const { values, positionals } = parseArgv({ args: argv, strict: false, allowPositionals: true, options });
    for (const f of FLAGS) if (values[f] !== undefined && typeof values[f] !== 'string') fail('--' + f + ' needs a value.');
    return { verb: positionals[0], opts: values };
}

function readAnswer(spec) {
    if (spec === '-') return fs.readFileSync(0, 'utf8');
    return fs.readFileSync(spec, 'utf8');
}

function freePath(dir, base) {
    let file = path.join(dir, base + '.md');
    for (let n = 2; fs.existsSync(file); n++) file = path.join(dir, base + '-' + n + '.md');
    return file;
}

function firstLine(text) {
    const line = text.split('\n').map((l) => l.replace(/^#+\s*/, '').trim()).find(Boolean) || '';
    return line.length > 120 ? line.slice(0, 117) + '…' : line;
}

// The index is hand-maintained, so the row is appended under the heading
// Task 3 of the plan created. No heading means no index to keep, and the
// record is still written — the audit's "documents the index never learned
// about" is the safety net there.
function indexRow(indexFile, question, rel, judged, model) {
    if (!fs.existsSync(indexFile)) return false;
    const text = fs.readFileSync(indexFile, 'utf8');
    const at = text.indexOf('## Judgements');
    if (at < 0) return false;
    const tableEnd = (() => {
        const after = text.slice(at);
        const lines = after.split('\n');
        let i = 0;
        while (i < lines.length && !lines[i].startsWith('|')) i++;
        while (i < lines.length && lines[i].startsWith('|')) i++;
        return at + lines.slice(0, i).join('\n').length;
    })();
    const row = '\n| ' + question.replace(/\|/g, '\\|') + ' | [' + rel + '](' + rel + ') — *judged ' + judged.slice(0, 10) + ', ' + model + '* |';
    fs.writeFileSync(indexFile, text.slice(0, tableEnd) + row + text.slice(tableEnd));
    return true;
}

function record(opts) {
    if (!opts.session) fail('--session <id> is required: the record names the session that asked.');
    if (!opts.brief || !opts.answer || !opts.slug) fail('record needs --brief <path>, --answer <path|-> and --slug <a-z0-9->.');
    if (!/^[a-z0-9][a-z0-9-]*$/.test(opts.slug)) fail('--slug is lowercase ascii, digits and dashes.');
    const root = opts.root ? path.resolve(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const mine = registry.readSession(root, opts.session);
    if (!mine || mine.active !== true) fail('No active entry for ' + opts.session + ' under ' + root);
    const projectRoot = docs.projectRootsFor(root, opts.project ? [opts.project] : (mine.project ? [mine.project] : []))[0] || root;
    const brief = fs.readFileSync(opts.brief, 'utf8');
    const answer = readAnswer(opts.answer);
    const judged = new Date().toISOString();
    const model = opts.model || 'fable';
    const dir = path.join(projectRoot, 'docs', 'judgements');
    fs.mkdirSync(dir, { recursive: true });
    const file = freePath(dir, judged.slice(0, 10) + '-' + opts.slug);
    const body = [
        '---',
        'judged: ' + judged,
        'model: ' + model,
        'agent: fankeel-judge',
        'task: ' + JSON.stringify(mine.task || ''),
        'session: ' + opts.session,
        'stage: ' + (mine.stage || ''),
        '---',
        '',
        '# ' + firstLine(brief),
        '',
        '## Question',
        '',
        brief.trimEnd(),
        '',
        '## Answer',
        '',
        answer.trimEnd(),
        '',
    ].join('\n');
    fs.writeFileSync(file, body);
    const indexFile = path.join(projectRoot, 'docs', 'README.md');
    const rel = 'judgements/' + path.basename(file);
    const indexed = indexRow(indexFile, firstLine(brief), rel, judged, model);
    return 'fankeel — judgement filed: ' + file + '\n' + (indexed ? 'index row: ' + indexFile : 'no ## Judgements table in ' + indexFile + '; add the row by hand');
}

function main(argv) {
    const { verb, opts } = parse(argv);
    if (verb !== 'record') fail('judge.js record --session <id> --brief <path> --answer <path|-> --slug <slug> [--model <m>] [--root <dir>] [--project <dir>]');
    return record(opts);
}

if (require.main === module) process.stdout.write(main(process.argv.slice(2)) + '\n');

module.exports = { main, record, firstLine, freePath, indexRow };
```

Check `registry.rootFor`'s argument shape before using it (`lib/registry.js:118`);
if it takes a hook payload with `cwd`, the call above is right, otherwise pass
what it takes — the test uses `--root`, so the fallback is only for the hand
run.

In `tests/judge.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'judge.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';

function seed() {
    const root = tmp('fankeel-judge-');
    registry.ensureLayout(root);
    registry.writeSession(root, A, { task: 'pick a colour', stage: 'design', route: ['survey', 'design'], active: true, claims: [],
        started: new Date().toISOString(), updated: new Date().toISOString() });
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'README.md'), '# docs\n\n## Judgements\n\n| question | record |\n|---|---|\n\n## Roles\n');
    fs.writeFileSync(path.join(root, 'brief.md'), '# Which ramp?\n\noptions: a, b\n');
    fs.writeFileSync(path.join(root, 'answer.md'), 'pick: b\nwhy: fewer stops\n');
    return root;
}

function run(root, args, input) {
    try {
        return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', root], { encoding: 'utf8', input }), code: 0 };
    } catch (e) {
        return { out: String(e.stdout || ''), code: e.status };
    }
}

test('record writes the file with six frontmatter keys, the brief and the answer verbatim, and one index row', () => {
    const root = seed();
    const out = run(root, ['record', '--session', A, '--brief', 'brief.md', '--answer', 'answer.md', '--slug', 'ramp', '--model', 'fable'].map((a) => (a.endsWith('.md') ? path.join(root, a) : a)));
    assert.equal(out.code, 0, out.out);
    const files = fs.readdirSync(path.join(root, 'docs', 'judgements'));
    assert.equal(files.length, 1);
    assert.match(files[0], /^\d{4}-\d{2}-\d{2}-ramp\.md$/);
    const text = fs.readFileSync(path.join(root, 'docs', 'judgements', files[0]), 'utf8');
    for (const key of ['judged:', 'model: fable', 'agent: fankeel-judge', 'task: "pick a colour"', 'session: ' + A, 'stage: design']) assert.ok(text.includes(key), key);
    assert.ok(text.includes('# Which ramp?\n\noptions: a, b'));
    assert.ok(text.includes('pick: b\nwhy: fewer stops'));
    const index = fs.readFileSync(path.join(root, 'docs', 'README.md'), 'utf8');
    assert.equal((index.match(/judgements\//g) || []).length, 1);
    assert.match(index, /\| Which ramp\? \| \[judgements\//);
});

test('a second record on the same slug is -2 and the first is byte-identical; stdin is an answer', () => {
    const root = seed();
    const args = ['record', '--session', A, '--brief', path.join(root, 'brief.md'), '--slug', 'ramp'];
    run(root, args.concat(['--answer', path.join(root, 'answer.md')]));
    const dir = path.join(root, 'docs', 'judgements');
    const first = fs.readdirSync(dir)[0];
    const before = fs.readFileSync(path.join(dir, first));
    const second = run(root, args.concat(['--answer', '-']), 'pick: a\n');
    assert.equal(second.code, 0, second.out);
    assert.ok(fs.readdirSync(dir).some((f) => f.endsWith('-ramp-2.md')));
    assert.deepEqual(fs.readFileSync(path.join(dir, first)), before);
});

test('no session, a stood-down session, or a bad slug exits 1', () => {
    const root = seed();
    const base = ['record', '--brief', path.join(root, 'brief.md'), '--answer', path.join(root, 'answer.md')];
    assert.equal(run(root, base.concat(['--slug', 'x'])).code, 1);
    assert.equal(run(root, base.concat(['--session', A, '--slug', 'Not Ascii'])).code, 1);
    registry.update(root, A, (d) => { d.active = false; return true; });
    assert.equal(run(root, base.concat(['--session', A, '--slug', 'x'])).code, 1);
    assert.equal(fs.existsSync(path.join(root, 'docs', 'judgements')), false);
});
```

Steps: tests red, script, docs.json and README rows, `git add` the two new
files, run `node scripts/docs-check.js` (the README row must resolve — the
`docs/judgements/` directory need not exist yet), full suite green including
`tests/docs.test.js` Roles, commit `feat(judge): record a judgement verbatim
under docs/judgements`.

## Task 4: `lib/stages.js` — `when` rules, `{{PROFILE_LAND}}`, the judge rule, reader wording

**Files:**
- Modify: `lib/stages.js` — `ALWAYS_WHEN`、每 stage 的 `when`、`rulesFor(stage, subs, profile)`、兩個 token、land 與 survey 的字
- Read: `lib/profile.js` — `read(null, null).values` 是 builtin 層
- Read: `scripts/judge.js` — `{{JUDGE}}` 指向的檔要先存在（`scripts/skills-check.js` 是 fail-closed）
- Test: `tests/stages.test.js`

**Interfaces:**
- Consumes: `profile.read`（Task 1）；`scripts/judge.js` 存在（Task 3）
- Produces: `rulesFor(stage, subs, profileValues?)`——第三參數缺省是 builtin 層；`ALWAYS_WHEN`；`STAGES[i].when`；`RENDER_TOKENS.profileLand = '{{PROFILE_LAND}}'`；`SCRIPT_TOKENS.judge = '{{JUDGE}}'`；`holds(when, values)`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

In `lib/stages.js`, near the top requires:

```js
const profile = require('./profile.js');
```

In `lib/stages.js`, after `ALWAYS`:

```js
// Rules that depend on the profile. Kept beside `ALWAYS` rather than inside it
// so every consumer of `ALWAYS` and of a stage's `rules` still reads a list of
// strings. `when` is a profile key; a leading `!` negates it. A value is
// "on" when it is `true` or a non-empty string other than 'false'.
const ALWAYS_WHEN = [
    {
        when: 'judge.enabled',
        text: 'A question you would put to the user inside a stage — a design clarification, the class, a plan split, a build choice — goes to `fankeel-judge` first: write the brief, dispatch it once on the profile\'s judge.model, `node {{JUDGE}} record`, act on the answer and say so in one line. The gate itself never goes to it.',
    },
];

function holds(when, values) {
    if (!when) return true;
    const neg = when.charAt(0) === '!';
    const key = neg ? when.slice(1) : when;
    const v = values ? values[key] : undefined;
    const on = v === true || (typeof v === 'string' && v !== '' && v !== 'false');
    return neg ? !on : on;
}
```

The archive rule becomes two conditional ones. Delete the `rules` entry that
begins `'A landed plan leaves a decision record behind'` and add, in
`lib/stages.js`, a `when` key to the `land` stage object:

```js
        when: [
            { when: 'land.archivePlan', text: 'A landed plan leaves a decision record behind — what was decided and why — then is archived; the profile said so, so no question.' },
            { when: '!land.archivePlan', text: 'A landed plan leaves a decision record behind — what was decided and why — then is archived, after asking. An unarchived plan gets read as current.' },
        ],
```

Then the token rule. In `lib/stages.js`, in the land stage's `rules`, before
the entry that begins `'Read the fankeel-land skill on entry'`:

```js
            'Integration: {{PROFILE_LAND}}.',
```

In `lib/stages.js`, in `SCRIPT_TOKENS`, after `task:`:

```js
    judge: '{{JUDGE}}',
```

In `lib/stages.js`, in `RENDER_TOKENS`, after `ponytail:`:

```js
    profileLand: '{{PROFILE_LAND}}',
```

In `lib/stages.js`, replace `rulesFor`:

```js
function rulesFor(stage, subs, values) {
    const found = byName(stage);
    const v = values || profile.read(null, null).values;
    const on = (list) => (list || []).filter((r) => holds(r.when, v)).map((r) => r.text);
    const all = ALWAYS.concat(on(ALWAYS_WHEN), found ? found.rules.concat(on(found.when)) : []);
    return substitute(all, subs);
}
```

In `lib/stages.js`, in the `survey` stage's rule that begins `'Scope from the
tree before the first term'`, replace `one lens each, one workflow` with
`one \`fankeel-reader\` per lens, one workflow` — the cap test's regex
`/one workflow, every path:line checked/` must still match. In `ALWAYS[2]`,
replace `how many, which model.` with `how many, which model, which agent.`.
In `verify` and `audit`, grep those stages' rules for `reader` and `pair` and
put `` `fankeel-reader` `` where a rule names the thing dispatched — replacing
a word, never adding a clause.

Add `ALWAYS_WHEN` and `holds` to `module.exports`.

In `tests/stages.test.js`, at the end:

```js
test('a when rule shows on its key, hides on its absence, and negates with !', () => {
  const { rulesFor, holds, ALWAYS, ALWAYS_WHEN } = require('../lib/stages.js');
  assert.equal(holds('judge.enabled', { 'judge.enabled': true }), true);
  assert.equal(holds('judge.enabled', { 'judge.enabled': false }), false);
  assert.equal(holds('judge.enabled', {}), false);
  assert.equal(holds('!land.archivePlan', {}), true);
  assert.equal(holds(undefined, {}), true);
  const on = rulesFor('land', null, { 'judge.enabled': true, 'land.archivePlan': true });
  const off = rulesFor('land', null, { 'judge.enabled': false });
  assert.ok(on.some((r) => r.includes('fankeel-judge')));
  assert.ok(!off.some((r) => r.includes('fankeel-judge')));
  assert.ok(on.some((r) => r.includes('the profile said so')));
  assert.ok(off.some((r) => r.includes('after asking')));
  assert.equal(rulesFor('land').length, ALWAYS.length + ALWAYS_WHEN.length + rulesFor('land', null, {}).length - ALWAYS.length,
    'no third argument is the builtin layer, where judge.enabled is on');
  assert.ok(rulesFor('land').some((r) => r.includes('fankeel-judge')));
});

test('land carries the profile token and survey names the reader agent', () => {
  const { byName } = require('../lib/stages.js');
  assert.ok(byName('land').rules.some((r) => r.includes('{{PROFILE_LAND}}')));
  assert.ok(byName('survey').rules.join(' ').includes('`fankeel-reader`'));
});
```

Then run `tests/render.test.js`: the cap test now measures every stage with
the judge rule on. **If any stage exceeds 2400**, shorten that stage's longest
rule by moving its rationale clause into the stage's skill (`skills/fankeel-<stage>/SKILL.md`)
and say in the report which sentence moved. Do not touch the cap. Commit
`feat(stages): profile-conditional rules, the land token, the judge rule`.

## Task 5: `lib/render.js` and the three hooks

**Files:**
- Modify: `lib/render.js` — `profileLine`、`render`／`renderResume` 收 `profile`、`rulesLines(data, profile)`、`SCRIPTS.judge`、`renderBrief` 的 judge 行
- Modify: `hooks/inject.js` — 讀 profile 交給 `render`
- Modify: `hooks/resume.js` — 同
- Modify: `hooks/brief.js` — 註解：agent type 現在有分支
- Read: `lib/profile.js` — `read`、`summary`、`landClause`、`configDirOf`
- Read: `lib/docs.js` — `projectRootsFor`
- Read: `lib/stages.js` — Task 4 的 `rulesFor(stage, subs, values)`
- Test: `tests/render.test.js`
- Test: `tests/resume.test.js`
- Test: `tests/brief.test.js`
- Test: `tests/inject.test.js`

**Interfaces:**
- Consumes: `profile.read/summary/landClause/configDirOf`（Task 1）；`rulesFor(stage, subs, values)`、`RENDER_TOKENS.profileLand`（Task 4）；`docs.projectRootsFor`
- Produces: `render({ ..., profile })`、`renderResume({ mine, profile })`——`profile` 是 `read()` 的回傳，可省略；區塊裡的 `profile:` 行；`renderBrief` 對 `agentType === 'fankeel-judge'` 多一條規則

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

In `lib/render.js`, next to the requires:

```js
const profileLib = require('./profile.js');
```

In `lib/render.js`, in `SCRIPTS`, add `judge: named('judge.js')`.

In `lib/render.js`, above `rulesLines`:

```js
// One line, only when somebody set something. Builtins are not news. A file
// that does not parse is said once here, because nothing else will say it.
function profileLine(profile) {
    if (!profile) return null;
    const bad = Array.isArray(profile.unreadable) ? profile.unreadable : [];
    if (bad.length) return 'profile: unreadable ' + bad.join(', ');
    const text = profileLib.summary(profile.values || {}, profile.sources || {});
    return text ? 'profile: ' + text : null;
}
```

`rulesLines(data)` becomes `rulesLines(data, profile)`. In `lib/render.js`,
its `rulesFor` call becomes:

```js
    const values = profile && profile.values ? profile.values : undefined;
    const rules = rulesFor(data && data.stage, Object.assign({ next, ponytail: ponytailLine(), profileLand: profileLib.landClause(values || {}) }, SCRIPTS), values);
```

`render`'s signature becomes
`render({ mine, others, now, root, launch, transcript, unclaimed, profile })`.
In `lib/render.js`, after the touched and next lines and before the
`if (ctx)` line, push the profile line:

```js
    const prof = profileLine(profile);
    if (prof) lines.push(prof);
```

and the last loop becomes `for (const line of rulesLines(data, profile)) lines.push(line);`.

In `lib/render.js`, `renderResume({ mine, profile })`: after the `GATE_UNSTAMPED`
push, `const prof = profileLine(profile); if (prof) lines.push(prof);` and
`return lines.concat(rulesLines(data, profile)).join('\n');`.

In `lib/render.js`, in `renderBrief`, replace the comment beginning `// Recorded
rather than acted on` and the line under it with:

```js
    // One type gets its own line: a judge answers once, and the parent will not
    // come back for more — so the brief says the return is the whole judgement.
    if (agentType === 'fankeel-judge') lines.push('  - Answer once. The parent will not message you again; what you return is the whole judgement, and it is filed verbatim under docs/judgements/.');
    if (agentType) lines.push('', '(agent type: ' + agentType + ')');
```

The inject hook needs two more requires next to its existing ones: the docs
module as `docs` and the profile module as `profileLib` (both listed under
Read above). Then, once `mine` is active, before `render`, in `hooks/inject.js`:

```js
    // The project's standing answers. A read failure costs one line, never
    // the injection: `read` returns unreadable paths rather than throwing.
    const projectRoot = docs.projectRootsFor(root, mine.project ? [mine.project] : [])[0] || root;
    const profile = profileLib.read(projectRoot, mine.configDir || profileLib.configDirOf());
```

and pass `profile` into `render({...})`.

In `hooks/resume.js`, the same two requires, the same two lines after the
`mine.active` check, and `renderResume({ mine: { sessionId, data: mine }, profile })`.

In `hooks/brief.js`, in the header comment above `main`, add one sentence:
`// The agent type is passed through, and one type — fankeel-judge — gets a
// line of its own in lib/render.js.`

In `tests/render.test.js`, at the end:

```js
test('the profile line lists what somebody set, and nothing when nobody did', () => {
  const profile = { values: { 'land.integration': 'merge', 'land.push': false, guard: 'ask' }, sources: { 'land.integration': 'project', 'land.push': 'project', guard: 'builtin' }, unreadable: [] };
  const out = render({ mine: entry(MINE, { stage: 'land' }), others: [], now: NOW, profile });
  assert.match(out, /^profile: land merge, no push$/m);
  assert.match(out, /Integration: the profile says merge, no push — do that/);
  const none = render({ mine: entry(MINE, { stage: 'land' }), others: [], now: NOW });
  assert.doesNotMatch(none, /^profile:/m);
  assert.match(none, /Integration: the profile has no land answer/);
  const bad = render({ mine: entry(MINE, { stage: 'land' }), others: [], now: NOW, profile: { values: {}, sources: {}, unreadable: ['/x/.fankeel/profile.json'] } });
  assert.match(bad, /^profile: unreadable \/x\/\.fankeel\/profile\.json$/m);
});
```

(`entry`, `MINE`, `NOW` are that file's existing helpers — read the top of it.)

In `tests/resume.test.js`, one test of the same shape on `renderResume`
asserting the `profile:` line appears with a profile and not without. In
`tests/brief.test.js`, after `'the agent type is carried through'`:

```js
test('a judge is told it answers once', () => {
  const root = tmp();
  seed(root);
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel-judge' })));
  assert.match(text, /Answer once\. The parent will not message you again/);
  assert.doesNotMatch(contextOf(run(root, start(root, { agent_type: 'Explore' }))), /Answer once/);
});
```

In `tests/inject.test.js`, one test: write `.fankeel/profile.json` with
`{ "guard": "deny" }` into the fixture root, run the hook, and assert the
context contains `profile: guard deny`. Read that file's fixture helper first
and copy its shape.

Run the cap test again (`tests/render.test.js:538`) — the `profile:` line is
outside `rulesLines` but inside the block it measures. Commit
`feat(render): the profile line, the land clause, the judge brief`.

## Task 6: the two agents and the manifest

**Files:**
- Modify: `agents/fankeel-reader.md` — 新檔
- Modify: `agents/fankeel-judge.md` — 新檔
- Modify: `.claude-plugin/plugin.json` — `agents`
- Modify: `.fankeel/docs.json` — `agents` bucket，role `reference`
- Modify: `docs/README.md` — Roles 表加 `agents/` 列
- Read: `.claude/agents/brief-probe.md` — frontmatter 的形，與 `tools: []` 的教訓
- Read: `tests/source.test.js` — frontmatter 鍵的限制（`:132-148`）
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: none
- Produces: `subagent_type: fankeel-reader`（`tools: [Read, Grep, Glob, Bash]`, `model: sonnet`）、`subagent_type: fankeel-judge`（同 tools, `model: fable`），從下一個 process 起可派

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

In `.claude-plugin/plugin.json`, as a sibling of `"hooks"`:

```json
  "agents": ["./agents/fankeel-reader.md", "./agents/fankeel-judge.md"],
```

In `.fankeel/docs.json`, after the last bucket:

```json
    {
      "path": "agents",
      "role": "reference"
    }
```

In `docs/README.md`, in the `## Roles` table, as its last row:

```md
| `agents/` | reference | no — the two agents the plugin ships, read by Claude Code at process start |
```

In `agents/fankeel-reader.md`, the whole file:

```md
---
name: fankeel-reader
description: Read-only reader for the survey, verify and audit stages — reads files, runs git and the plugin's scripts, and returns only the lines that decide the question it was sent with. Cannot call Edit, Write or NotebookEdit.
tools: [Read, Grep, Glob, Bash]
model: sonnet
status: current
last_verified: 2026-09-09
source_of_truth: lib/render.js
---

You are a reader. The session that sent you has a question and a list of
files; you read, and you return the lines that decide it.

## Job

Read what the brief names — files, a `git` range, a scanner's output — and
answer the question it asks. Everything you open is spent in a context that is
thrown away; what you return lands in the parent's and stays there for the rest
of its session, so the return is the expensive part. Return the shape the brief
asked for and nothing around it.

## Tools

`Read`, `Grep`, `Glob` and `Bash`. `Bash` is here for `git` and for
`node <plugin>/scripts/*.js`; it can also write a file, and that is the one
gap in "read-only" — do not use it for that. `Edit`, `Write` and
`NotebookEdit` are not on the list and cannot be called.

## Refusals

- Do not change a file, by any tool. If the question cannot be answered without
  changing one, say so and stop.
- Do not dispatch a subagent of your own.
- Do not answer from memory what a file would say — open it, or say you did not.

## Return

What the brief's contract asks for. Say plainly what you could not check: a gap
the parent cannot see becomes a confident wrong answer there.
```

In `agents/fankeel-judge.md`, the whole file:

```md
---
name: fankeel-judge
description: One-shot judgement for a question the session would otherwise put to the user mid-stage — a design clarification, a class, a plan split, a build choice. Reads the brief and the files it names, answers once in a fixed shape, and is not consulted again. Cannot call Edit, Write or NotebookEdit.
tools: [Read, Grep, Glob, Bash]
model: fable
status: current
last_verified: 2026-09-09
source_of_truth: lib/render.js
---

You answer one question, once. The session that sent you would have asked a
person; it is asking you instead, and it will file what you return verbatim
where people can read it later. It will not come back to you for more.

## Job

Read the brief file the dispatch names. It holds the question, the options if
there are any, the background, the paths to read, and what "answered" means.
Open the paths. Decide.

## Return

Exactly these four fields, in this order, nothing before or after:

```text
pick: <one option, or the answer in one line>
why: <at most five lines>
would flip if: <at most two lines — the fact that would change the pick>
unread: <what the brief named that you did not open, or "nothing">
```

## Refusals

- Do not change a file, by any tool.
- Do not dispatch a subagent.
- Do not ask a question back. If the brief cannot be answered, `pick:` says so
  and `why:` says what is missing.
- Do not pad. Every line you return stays in the parent's context for the rest
  of its session.
```

In `tests/agents.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FRONT = /^---\r?\n([\s\S]*?)\r?\n---/;
const NAMES = ['fankeel-reader', 'fankeel-judge'];

function front(file) {
    const m = FRONT.exec(fs.readFileSync(file, 'utf8'));
    assert.ok(m, file + ' has frontmatter');
    const out = {};
    for (const line of m[1].split(/\r?\n/)) {
        const kv = /^([\w-]+):\s*(.*)$/.exec(line);
        if (kv) out[kv[1]] = kv[2];
    }
    return out;
}

test('both agents parse, name themselves after their file, and cannot edit', () => {
    for (const name of NAMES) {
        const f = front(path.join(ROOT, 'agents', name + '.md'));
        assert.equal(f.name, name);
        assert.match(f.tools, /^\[.+\]$/, name + ' tools is a list');
        const tools = f.tools.slice(1, -1).split(',').map((s) => s.trim());
        assert.ok(tools.length > 0, name + ' tools is not empty — an empty list refuses to launch');
        for (const banned of ['Edit', 'Write', 'NotebookEdit']) assert.ok(!tools.includes(banned), name + ' lists ' + banned);
        assert.ok(f.model, name + ' pins a model');
    }
});

test('the manifest ships both, and no others', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
    assert.deepEqual(manifest.agents, NAMES.map((n) => './agents/' + n + '.md'));
    for (const rel of manifest.agents) assert.ok(fs.existsSync(path.join(ROOT, rel)), rel);
    assert.deepEqual(fs.readdirSync(path.join(ROOT, 'agents')).sort(), NAMES.map((n) => n + '.md').sort());
});
```

Steps: test red, files, `git add agents tests/agents.test.js`, full suite
(`tests/source.test.js` reads the new frontmatter; `tests/docs.test.js` reads
the Roles row), `node scripts/docs-check.js`, commit
`feat(agents): fankeel-reader and fankeel-judge`.

## Task 7: `station.js` — profiles in the data, `POST /profile`

**Files:**
- Modify: `lib/station.js` — `gather()` 讀 profile、`serialize()` 多 `profiles`
- Modify: `scripts/station.js` — `POST /profile`
- Read: `lib/profile.js` — `read`、`write`、`projectFile`、`machineFile`、`KEYS`
- Test: `tests/station-cli.test.js`
- Test: `tests/station.test.js`

**Interfaces:**
- Consumes: `profile.*`（Task 1）
- Produces: `window.STATION.profiles = { machine: { values, sources, unreadable }, projects: { [absPath]: { values, sources, unreadable } } }`；`POST /profile` with `nonce`, `scope=project|machine`, `project=<abs path>`, repeated `key`/`value` pairs → 303 `/`; 403 nonce, 400 bad key/value, 404 unknown project

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

In `lib/station.js`, next to the requires: `const profile = require('./profile.js');`.

In `lib/station.js`, in `gather()`, where each registry object is pushed
(`lib/station.js:311`), add a `profiles` field to the registry: the registry
root itself and every distinct non-empty `project` among its sessions, each
resolved as `path.join(root, project)` when that directory exists:

```js
        const projectDirs = [root].concat([...new Set(sessions.map((s) => s.project).filter(Boolean))]
            .map((p) => path.join(root, p)).filter((p) => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } }));
        const profiles = {};
        for (const p of projectDirs) profiles[p] = profile.read(p, configDir);
        registries.push({ root, gone: false, unreadable: all.unreadable, build: buildDirs(root), mapAt: mapDate(root), sessions, profiles });
```

(a gone registry pushes `profiles: {}`). In the object `gather()` returns, add
`machineProfile: profile.read(null, configDir)`.

In `lib/station.js`, in `serialize()`, after `projects:`:

```js
        profiles: {
            machine: model.machineProfile || { values: {}, sources: {}, unreadable: [] },
            projects: Object.assign({}, ...model.registries.map((r) => r.profiles || {})),
        },
        profileKeys: profile.KEYS,
```

In `scripts/station.js`, next to the requires: `const profile = require('../lib/profile.js');`.
In the `handler`, after the `/clear-stale` block and before the 404:

```js
        if (req.method === 'POST' && url.pathname === '/profile') {
            const form = new URLSearchParams(await readBody(req));
            if (form.get('nonce') !== nonce) {
                res.writeHead(403, { 'content-type': 'text/plain' });
                res.end('wrong nonce: open the page this server printed and try again\n');
                return;
            }
            const scope = form.get('scope');
            let file;
            if (scope === 'machine') file = profile.machineFile(configDir);
            else if (scope === 'project') {
                const want = path.resolve(form.get('project') || '');
                const model = modelNow();
                const known = model.registries.some((r) => Object.keys(r.profiles || {}).some((p) => path.resolve(p) === want));
                if (!known) {
                    res.writeHead(404, { 'content-type': 'text/plain' });
                    res.end('no such project on this page\n');
                    return;
                }
                file = profile.projectFile(want);
            } else {
                res.writeHead(400, { 'content-type': 'text/plain' });
                res.end('scope is project or machine\n');
                return;
            }
            const keys = form.getAll('key');
            const values = form.getAll('value');
            if (!keys.length || keys.length !== values.length) {
                res.writeHead(400, { 'content-type': 'text/plain' });
                res.end('key and value come in pairs\n');
                return;
            }
            // Validate every pair before writing any, so a bad second key
            // does not leave the first one applied.
            for (let i = 0; i < keys.length; i++) {
                const spec = profile.KEYS[keys[i]];
                if (!spec || !spec.values.includes(String(values[i]).toLowerCase())) {
                    res.writeHead(400, { 'content-type': 'text/plain' });
                    res.end('not a profile key/value: ' + keys[i] + '=' + values[i] + '\n');
                    return;
                }
            }
            for (let i = 0; i < keys.length; i++) {
                const out = profile.write(file, keys[i], values[i]);
                if (!out.ok) {
                    res.writeHead(409, { 'content-type': 'text/plain' });
                    res.end(out.reason + '\n');
                    return;
                }
            }
            res.writeHead(303, { location: '/' });
            res.end();
            return;
        }
```

`configDir` is whatever name `serve()` already holds for the config directory
it scans — read `serve(opts)` at `scripts/station.js:265` and use that
variable.

In `tests/station-cli.test.js`, after the `/clear-stale` tests:

```js
test('POST /profile writes a project key, refuses a bad nonce, a bad key, and an unknown project', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const data = await request(s.url + 'station/station-data.js', { method: 'GET' });
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
        assert.match(data.text, /"profiles":\{"machine":/);
        const form = (o) => new URLSearchParams(o).toString();
        const post = (body) => request(s.url + 'profile', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } }, body);
        assert.equal((await post(form({ scope: 'project', project: f.r1, key: 'land.push', value: 'false', nonce: 'wrong' }))).status, 403);
        assert.equal((await post(form({ scope: 'project', project: f.r1, key: 'colour', value: 'blue', nonce }))).status, 400);
        assert.equal((await post(form({ scope: 'project', project: path.join(f.base, 'nowhere'), key: 'land.push', value: 'false', nonce }))).status, 404);
        const ok = await post(form({ scope: 'project', project: f.r1, key: 'land.push', value: 'false', nonce }));
        assert.equal(ok.status, 303);
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.r1, '.fankeel', 'profile.json'), 'utf8')), { 'land.push': false });
        const machine = await post(form({ scope: 'machine', key: 'guard', value: 'deny', nonce }));
        assert.equal(machine.status, 303);
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.cfg, 'fankeel', 'profile.json'), 'utf8')), { guard: 'deny' });
        const after = await request(s.url + 'station/station-data.js', { method: 'GET' });
        assert.match(after.text, /"land\.push":false/);
        assert.match(after.text, /"guard":"deny"/);
    } finally {
        s.close();
    }
});
```

In `tests/station.test.js`, one test: a fixture registry whose root holds
`.fankeel/profile.json` with `{ "land.integration": "merge" }` — `gather()`'s
registry carries `profiles[root].values['land.integration'] === 'merge'` with
source `project`, and `serialize()`'s output contains `"profileKeys"`. Read
that file's fixture helper first. Commit `feat(station): profiles in the data
file, POST /profile`.

## Task 8: the station page — profile section

**Files:**
- Modify: `assets/station/station.js` — `profileRows`、`profileCard`，接進 `overview()` 與 registry 的卡
- Modify: `assets/station/index.html` — 無結構變動時可不改；若加 id 就改這裡
- Modify: `assets/station/station.css` — `.profile` 的幾行
- Read: `lib/station.js` — Task 7 的 `profiles`／`profileKeys` 形
- Read: `lib/profile.js` — `KEYS`，測試用它組 `profileKeys`
- Test: `tests/station-view.test.js`

**Interfaces:**
- Consumes: `S.profiles`、`S.profileKeys`、`S.serve`、`S.nonce`、`S.plugin`（Task 7）
- Produces: 每個 project 一張 profile 卡（serve：`<form action="/profile">` 一列一個 `<select>`、一顆「套用機器預設」按鈕；靜態：每列一段 `node <plugin>/scripts/task.js profile set …`）；overview 一張機器預設卡

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

In `assets/station/station.js`, beside `clearStaleControl`:

```js
    // One row per key: the value in force, where it came from, and — served —
    // a select that posts the change. The static file prints the command
    // instead, the same way the clear control does.
    function profileRows(scope, projectPath, prof) {
        var keys = Object.keys(S.profileKeys || {});
        var out = '';
        keys.forEach(function (key) {
            var spec = S.profileKeys[key];
            var v = prof.values[key];
            var src = prof.sources[key] || '';
            var shown = v === undefined ? '(ask)' : String(v);
            var ctl;
            if (S.serve) {
                ctl = '<form method="post" action="/profile" class="pf">'
                    + '<input type="hidden" name="nonce" value="' + esc(S.nonce || '') + '">'
                    + '<input type="hidden" name="scope" value="' + scope + '">'
                    + (projectPath ? '<input type="hidden" name="project" value="' + esc(projectPath) + '">' : '')
                    + '<input type="hidden" name="key" value="' + esc(key) + '">'
                    + '<select name="value">' + spec.values.map(function (o) {
                        return '<option' + (String(v) === o ? ' selected' : '') + '>' + esc(o) + '</option>';
                    }).join('') + '</select><button class="ctl" type="submit">set</button></form>';
            } else {
                ctl = '<code class="mono">node ' + esc(S.plugin || '<plugin>') + '/scripts/task.js profile set '
                    + esc(key) + ' &lt;value&gt;' + (scope === 'machine' ? ' --default' : ' --project "' + esc(projectPath) + '"') + '</code>';
            }
            out += '<tr><td class="mono">' + esc(key) + '</td><td>' + esc(shown) + '</td><td class="mute">' + esc(src) + '</td><td>' + ctl + '</td></tr>';
        });
        return out;
    }
    function applyMachineControl(projectPath) {
        var m = S.profiles && S.profiles.machine ? S.profiles.machine : null;
        if (!S.serve || !m) return '';
        var keys = Object.keys(m.values).filter(function (k) { return m.sources[k] === 'machine'; });
        if (!keys.length) return '';
        return '<form method="post" action="/profile" class="pf">'
            + '<input type="hidden" name="nonce" value="' + esc(S.nonce || '') + '">'
            + '<input type="hidden" name="scope" value="project">'
            + '<input type="hidden" name="project" value="' + esc(projectPath) + '">'
            + keys.map(function (k) {
                return '<input type="hidden" name="key" value="' + esc(k) + '"><input type="hidden" name="value" value="' + esc(String(m.values[k])) + '">';
            }).join('')
            + '<button class="ctl" type="submit">套用機器預設（' + keys.length + ' 鍵）</button></form>';
    }
    function profileCard(title, scope, projectPath, prof) {
        if (!prof) return '';
        var bad = (prof.unreadable || []).length ? '<div class="mute">unreadable: ' + esc(prof.unreadable.join(', ')) + '</div>' : '';
        return '<div class="card profile"><div class="chead"><b>' + esc(title) + '</b>'
            + (scope === 'project' ? applyMachineControl(projectPath) : '') + '</div>'
            + bad + '<table><thead><tr><th>key</th><th>value</th><th>source</th><th></th></tr></thead><tbody>'
            + profileRows(scope, projectPath, prof) + '</tbody></table></div>';
    }
```

In `assets/station/station.js`, in `overview()`, after the registry notes,
append `profileCard('machine profile', 'machine', null, S.profiles && S.profiles.machine)`;
in `registryNote(reg)` (or wherever a registry's card is composed), append one
`profileCard(LAB[p] || p, 'project', p, S.profiles.projects[p])` per key `p` of
`S.profiles.projects` whose path starts with `reg.root`. Read `overview` at
`assets/station/station.js:511` and `registryNote` at `:461` for the exact
insertion; `esc`, `LAB` and `S` are that file's existing helpers.

In `assets/station/station.css`, at the end:

```css
.profile table{width:100%;margin-top:8px}
.profile td,.profile th{padding:4px 6px;text-align:left;font-size:12px}
.pf{display:inline-flex;gap:6px;align-items:center}
```

In `tests/station-view.test.js`, read how that file loads `station.js` with a
fake `window.STATION`, then add one test: with `serve: true`, a `nonce`, one
project profile `{ values: { 'land.push': false }, sources: { 'land.push': 'project' } }`
and `profileKeys` from `lib/profile.js`, the rendered page contains
`action="/profile"`, a `<select name="value">` and `套用機器預設` only when the
machine profile has a `machine`-sourced key; with `serve: false` it contains
`profile set land.push` and no `<form`. Commit `feat(station): the profile
section on the page`.

## Task 9: the reference pages

**Files:**
- Modify: `docs/documents.md` — 新節「`.fankeel/` 各區的壽命」與 spec §6 的表；`docs/judgements` 在 role 說明裡點到
- Modify: `docs/registry.md` — 檔案樹加 `profile.json`；`guard` 欄位說 `start` 會從 profile 讀
- Modify: `docs/subagents.md` — `fankeel-reader` 與 `fankeel-judge`：tools、model、brief 多的那行、`judge.js record`
- Modify: `docs/station.md` — profile 區與 `POST /profile`（不是 flag，所以不進 flag 表）
- Modify: `docs/pipeline.md` — `when` 規則進「Where a rule lives」那節；`{{PROFILE_LAND}}`、`{{JUDGE}}` 進 token 的說明
- Modify: `docs/improvement-brief.md` — §4.2、§4.3 各一段補記（2026-09-09）指向 spec
- Read: `docs/archive/2026-09-09-profile-judge-reader-design.md` — §6 的表
- Read: `lib/stages.js`、`lib/profile.js`、`scripts/judge.js` — 引用的名字要真的存在
- Test: `tests/docs-check.test.js`

**Interfaces:**
- Consumes: Task 1–8 的名字
- Produces: 六頁改過；`node scripts/docs-check.js` 綠；每頁 `last_verified: 2026-09-09`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

In `docs/documents.md`, a new section before its last section:

```md
## `.fankeel/` 各區的壽命

| 路徑 | 提交？ | 壽命 |
|---|---|---|
| `docs.json` | 是 | 跟文件一起版本控制 |
| `profile.json` | 是 | 專案的常設答案，改了就是改偏好；`task.js profile` 寫 |
| `sessions/<id>.json` | 否 | 一個 session 一筆，永不刪，`active:false` 即結束 |
| `map.md` | 否 | 每次 `map.js` 重生 |
| `build/<plan>/` | 否 | 一個 task 的 ledger、brief、judge brief；列出不清理 |
| `index.html`、`station/` | 否 | 這台機器的 station 副本，每次 prompt 重寫 |
| `docs/judgements/`（不在 `.fankeel/`） | 是 | `fankeel-judge` 的判斷，寫完不改（`report`） |
```

The other five pages: one paragraph each, written against the code as landed
(open `lib/stages.js` for the exact rule text, `scripts/judge.js` for the
flags). No `path:line` citation without opening the file at that line. Each
page's `last_verified` becomes `2026-09-09`. Run `node scripts/docs-check.js`;
the test file named above already asserts the checker's behaviour and is
listed so the task has a test to keep green. Commit `docs: profile, judge,
reader, the lifetime table`.

## Task 10: the skills, and the skills gate

**Files:**
- Modify: `skills/fankeel/SKILL.md` — 「Where the files are」樹加 `profile.json` 與 `docs/judgements/`；不變量 6 加一子句；§Subagents 讀者是 `fankeel-reader`、判斷是 `fankeel-judge`
- Modify: `skills/fankeel-land/SKILL.md` — `## 6. The menu` 開頭一段：profile 答了就不開 menu，`task.js profile show` 看答案
- Modify: `skills/fankeel-survey/SKILL.md` — §4／4b 的讀者用 `fankeel-reader`
- Modify: `skills/fankeel-verify/SKILL.md` — 讀者同上
- Read: `scripts/skills-check.js` — 它釘什麼（`:103-158`）
- Read: `lib/stages.js` — Task 4 落地的字，skill 要跟它一致
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: Task 4 的規則字、Task 6 的兩個 agent 名、Task 2 的 `profile` 子命令
- Produces: 四份 skill 改過，`node scripts/skills-check.js` exit 0

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

In `skills/fankeel/SKILL.md`, in the `## Invariants` list, item 6 gains this
sentence at its end:

```md
   A `guard` the profile carries is the user's standing instruction, and
   `task.js start` applying it is executing that instruction, not choosing one.
```

In `skills/fankeel/SKILL.md`, in the tree under `## Where the files are`, after
the `docs.json` line under `Waypoint/.fankeel/`:

```text
│   │   └── profile.json       the project's standing answers. committed.
```

and under `Waypoint/docs/`, after `README.md`:

```text
│       ├── judgements/        what fankeel-judge answered, verbatim, dated
```

In `skills/fankeel/SKILL.md`, in the gate table under **At the end of a
stage, ask**, after the paragraph beginning `Picking option one *is* the
approval`:

```md
Where a stage rested on a `fankeel-judge` answer, option one's description
names the record — `judgements/2026-09-10-ramp.md` — so what the user is
approving includes the judgement it was built on, and the file to read if they
doubt it.
```

In `skills/fankeel-land/SKILL.md`, at the top of `## 6. The menu`:

```md
**Before the menu, the profile.** `node <plugin>/scripts/task.js profile show`
prints the project's standing answer. Where `land.integration` and `land.push`
are set, do that — the injected rule already said which — and say so in one
line; the menu below is for a project that has not answered.
```

In the two stage skills, every place that says what a reader is dispatched as
now names `` `fankeel-reader` `` (with `subagent_type`), and the model is the
profile's `dispatch.floor`. Run `node scripts/skills-check.js` — every script
and flag a skill names must exist. Commit `docs(skills): profile before the
menu, the reader and judge agents`.

## Coverage

| promise | task |
|---|---|
| `<project>/.fankeel/profile.json` 與 `docs.json` 同層、版本控制 | Task 1 |
| `lib/profile.js` 匯出 `KEYS`、`read(projectRoot, configDir)`、`write(file, key, value)`、`suggest(projectRoot, registryRoot)` | Task 1 — `suggest` 只收 `projectRoot`：registry 沒有可分組的鍵（證據報告），第二參數是空的，砍掉 |
| `KEYS` 是全部的鍵，每個帶允許值與內建預設；`write` 拒絕不在表上的鍵或值： | Task 1 |
| 專案查找走 `lib/docs.js projectRootsFor()` 同一條路：task 的 `project` 與 | Task 2、Task 5 |
| `.fankeel/.gitignore` **不加** `profile.json`：它跟 `docs.json` 一樣是要進版本 | Global Constraints；Task 9 寫進 `docs/registry.md` |
| `scripts/task.js profile show [--project X]` 印生效值 | Task 2 |
| `hooks/inject.js` 與 `hooks/resume.js` 都讀 profile | Task 5 |
| `RENDER_TOKENS` 加 `{{PROFILE_LAND}}`：land 的 menu 規則改成「profile 答了 | Task 4、Task 5 |
| `task.js start` 讀生效的 `guard`：非內建預設時寫進 entry 的 `guard` 並在輸出 | Task 2 |
| 2400 上限：`profile:` 行不在 `rulesLines()` 內、不計入 stage rules，但整個區塊 | Task 4、Task 5（各跑一次 cap test） |
| `agents/fankeel-judge.md`：`tools: [Read, Grep, Glob, Bash]`、`model: fable` | Task 6 |
| 觸發規則進 `ALWAYS`（一行，換掉現有第三條裡可移入 skill 的半句以守上限） | Task 4 — 進 `ALWAYS_WHEN` 而不是 `ALWAYS`，讓字串消費者不動；位移由 cap test 決定 |
| brief 由主 agent 寫到 `.fankeel/build/<plan>/judge-<n>-brief.md` | Task 4 的規則字、Task 10 的 skill——這是主 agent 的行為，不是程式 |
| `scripts/judge.js record --session <id> --brief <path> --answer <path\|->` | Task 3 |
| `hooks/brief.js`／`renderBrief`：`agent_type` 是 `fankeel-judge` 時 | Task 5 |
| 主 agent 在下一個 gate 的 option 1 description 裡點名這個 stage 依據的判斷檔 | Task 10（`skills/fankeel/SKILL.md` 的 gate 段） |
| `agents/fankeel-reader.md`：`tools: [Read, Grep, Glob, Bash]`、`model: sonnet` | Task 6 |
| `lib/stages.js` survey／verify／audit 說「dispatch readers」的規則 | Task 4、Task 10 |
| `tests/agents.test.js`（新）：兩個 agent 檔的 frontmatter 可解析、`tools` 不含 | Task 6 |
| `lib/stages.js` 的 rule 可以是字串，也可以是 `{ when: 'judge.enabled', text }` | Task 4 — 形改成每 stage 一個 `when` 陣列，語意同 |
| `tests/stages.test.js`：`when` 為假時規則不出現、為真時出現、沒有 `when` | Task 4 |
| `.fankeel/docs.json` 加 `{ "path": "docs/judgements", "role": "report" }` | Task 3 |
| `docs/documents.md` 加一節「`.fankeel/` 各區的壽命」，一張表： | Task 9 |
| `skills/fankeel/SKILL.md` 的「Where the files are」樹加 `profile.json` | Task 10 |
| `lib/station.js gather()` 對每個 registry 的每個 project 讀 | Task 7 |
| `assets/station/station.js`：project 的 detail 面板多一個 **profile** 區 | Task 8 — 放在 registry 的卡而不是 session detail：profile 是 project 的，detail 是 session 的 |
| `scripts/station.js serve` 加 `POST /profile`：nonce 錯 403；body | Task 7 |
| 「快速套用」按鈕：overview 卡上「把機器預設套到這個專案」一鍵—— | Task 8（`applyMachineControl`，走同一個端點的多對 key/value） |
| `tests/profile.test.js`：專案值蓋機器值蓋內建值、逐鍵而非整檔；`set` 拒絕 | Task 1 |
| `tests/render.test.js`：有 profile 時區塊帶 `profile:` 行 | Task 5 |
| `tests/stages.test.js`：land 規則含 `{{PROFILE_LAND}}` | Task 4 |
| `tests/task.test.js`：`start` 在 profile `guard: deny` 時 | Task 2 |
| `tests/judge.test.js`：`record` 寫出的檔案 frontmatter 六個鍵齊全 | Task 3 |
| `tests/agents.test.js`：§4 的四條斷言 | Task 6 |
| `tests/station-cli.test.js`：`POST /profile` 對 nonce 錯回 403 | Task 7 |
| `tests/docs.test.js:460` Roles 表列出 `docs/judgements/` | Task 3、Task 6 |
| **artefact 一列**：對一個 profile 寫了 `land.push: false` 的專案 | verify 讀 station 頁與 `profile show` 對照；Task 7 的測試比對 `station-data.js` 與檔案 |
| **行為一列**：在本 repo 開一個新 process 走一次 survey，dispatch 的 | verify，新 terminal；不是 build 的 task |

## Verify 要另外做的

- 新 terminal（agents 目錄只在 process 啟動時讀）：派一次 `fankeel-judge`，
  看它啟動並回四個欄位；派一次 `fankeel-reader`，看它的工具清單沒有 Edit。
  `model: fable` 啟不動就照 spec 的退路：agent 檔不釘 model，`judge.model`
  內建改 `opus`，由 dispatch 的 `model` 參數帶。
