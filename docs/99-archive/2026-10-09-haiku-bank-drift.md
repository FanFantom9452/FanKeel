---
status: current
last_verified: 2026-10-09
source_of_truth: docs/90-agent/plans/2026-10-09-haiku-bank-drift-design.md
---

# Haiku 角色題庫、平行執行器與長任務飄移 Implementation Plan

**Goal:** 四個角色各有十二題分三層、`check.sh` 標出失敗類別的題庫，`bench.js role` 用 `--jobs` 平行跑全部題目，`bench.js drift` 量 haiku／sonnet × PostToolUse 重注入的 2×2，`bench.js report` 依設計事先寫定的判準寫出報告。
**Architecture:** 判讀類別與題目清單放在 `lib/bench.js`，每個角色的共用判分放在 `bench/roles/<role>/items/` 裡（`roleItems` 只把目錄當題目），題目本身是四件組。執行器只把 `claude -p` 改成非同步，交給 `lib/bench.js` 的 `pool`；`lib/drift.js` 逐步讀 implementer 的 transcript，`bench/drift/` 是長任務與重注入 hook。報告由程式從各批 `runs.jsonl` 重算後寫出，所以表上每一格和 `tally` 一致。
**Tech Stack:** Node 24 內建模組（`node:test`、`child_process.spawn`）、bash（Windows 上是 Git Bash）、git；`package.json` 沒有 dependencies，這次也不加。
**Spec:** [2026-10-09-haiku-bank-drift-design.md](2026-10-09-haiku-bank-drift-design.md)

## Global Constraints

從 `node scripts/map.js`（`.fankeel/map.md`）、`CONTRIBUTING.md`、`package.json`、`.gitattributes` 與現有測試取來：

1. `lib/` 是純函式、直接測，不 require `scripts/` 或 `hooks/`（README.md 樹狀表 `lib/` 列；CONTRIBUTING.md「Core logic」）。`lib/drift.js` 可以 require `lib/bench.js`，反過來不行。
2. `scripts/*.js` 是 `lib/` 的薄包裝（CONTRIBUTING.md「CLI entry points」）。
3. 測試是 `node --test`；每個 export 的名字都要有別的檔 import（`tests/source.test.js` 的 `every exported name is imported by something`），新檔要先 `git add` 才看得到。
4. 測試的暫存目錄一律從 `tests/tmp.js` 拿。
5. 不加依賴：只用 Node 內建模組。
6. `.gitattributes` 是 `* text=auto eol=lf`：庫裡的檔一律 LF；CRLF 的 fixture 只能在 `setup.sh` 或 `check.sh` 執行時用 `printf` 產生。
7. `bench/` 底下沒有任何檔會被這個 repo 自己的 `node --test` 撿到（`tests/bench-projects.test.js:69`）：檔名不能是 `test.js`、`*.test.js`、`*-test.js`、`test-*.js`，也不能有 `test/` 目錄；spec 一律叫 `*.spec.js`。
8. `--permission-mode bypassPermissions` 的 run 只在 `mkdtemp` 目錄裡（`scripts/bench.js:13`）。
9. `bench/` 在 map 裡歸 fixture；README.md 的 `bench/` 那一列是 map 讀的樹狀列。
10. 新增或改名的頁面在同一個 change 裡補 `docs/README.md` 的索引列（CONTRIBUTING.md「Documentation」）。
11. 縮排：`lib/`、`scripts/`、`tests/*.test.js` 四個空格。commit 訊息 `<area>: <小寫摘要>`。
12. hook 每條路徑都 exit 0（CONTRIBUTING.md「Hooks」）；`bench/drift/reinject.js` 不在 `hooks/`，也照這條。

## Risks

- 四十八題加 drift 的 selftest 讓 `tests/bench-projects.test.js` 多出約一到兩分鐘 — Task 3 到 Task 9 — 每個角色 task 先量自己那十二題跑多久（`node --test tests/bench-projects.test.js` 的 duration），超過 60 秒就回報，不自行刪 control。
- 這台機器的 `core.autocrlf` 是 `true`，run 目錄的 repository 會繼承 — Task 3 — 每個 `repo.sh` 在 `git init` 後立刻 `git config core.autocrlf false`，implementer 判分的測試直接比 CRLF 與 LF。
- Claude Code 的 Edit 會不會保住 CRLF 沒有驗證過 — Task 12 — 若 `trap-crlf-keep` 兩臂都全錯，報告那一列讀成工具的行為，不讀成模型的差別。
- implementer 在長任務上可能不到三十次工具呼叫（設計「尚未證實」第一條）— Task 12 — 先每臂試跑一次，`tally` 的 `steps` 欄不到 30 就停。
- Task 4 到 Task 8 之間，`bench.js role` 對真實角色讀不到題目（`readRole` 到 Task 9 才改）— Task 9 — 對四個真實角色各跑一次 `role <role> --runs 1 --dry`。
- `spawnClaudeAsync` 的 EINVAL 分支只用假的 `spawn` 測過 — Task 9 — 測試注入 `spawn` 與 `platform`；真跑由 Task 12 的 `probe` 之後第一批證實。

## Task 1: 失敗類別與題目清單（lib/bench.js）

**Files:**
- Modify: `lib/bench.js` — `TIERS`、`CLASSES`、`tierOf`、`roleItems`、`checkClass`、`controlClass`、`selftestRole`；`selftest` 加 `classes`、`seed`、`label`；`roleTally` 依角色 × 臂 × 層 × 類別計數；`roleSummaryMd` 多一張層表與 class 欄
- Test: `tests/bench.test.js`

**Interfaces:**
- Consumes: none
- Produces: `TIERS`, `CLASSES`, `tierOf`, `roleItems`, `checkClass`, `controlClass`, `selftestRole`, `selftest`, `roleTally`, `roleSummaryMd`

`TIERS` 是 `['easy', 'mid', 'trap']`；`CLASSES` 是 `['wrong', 'fabricated', 'unrestored', 'extra', 'format']`；`tierOf(id) → string|null`；`roleItems(roleDir) → [{ id, tier, dir, input }]`；`checkClass(output) → null|string`；`controlClass(name) → string|null`；`selftestRole(roleDir, { mkdtemp, plugin, seeds, only }) → string[]`；`roleTally(rows, rawRoot) → { runs, arms, tiers }`。

**Dispatch:** implementer, sonnet

1. Write the failing tests. In `tests/bench.test.js`, append at the end of the file:

```js
const PASSING_CHECK = 'grep -q good "$1/state.txt" && echo pass && exit 0\necho "fail wrong: state is not good"\nexit 1\n';

// One item's files under items/<id>/: a setup that writes state.txt, the
// check given, and per control a state.txt laid over it.
const itemFiles = (id, check, controls) => ({
    ['items/' + id + '/input.md']: 'Q\n',
    ['items/' + id + '/setup.sh']: 'echo start > state.txt\n',
    ['items/' + id + '/check.sh']: check,
    ...Object.fromEntries(Object.entries(controls).map(([c, text]) => ['items/' + id + '/controls/' + c + '/state.txt', text])),
});

test('roleItems lists the directories under items/, sorted, each with its tier; a file there is no item', () => {
    const root = project({ 'items/trap-b/input.md': 'B\n', 'items/easy-a/input.md': 'A\n', 'items/odd/input.md': 'O\n', 'items/judge.sh': 'true\n' });
    assert.deepEqual(bench.roleItems(path.join(root, 'p')).map((i) => [i.id, i.tier, i.input]),
        [['easy-a', 'easy', 'A\n'], ['odd', null, 'O\n'], ['trap-b', 'trap', 'B\n']]);
    assert.deepEqual(bench.roleItems(path.join(root, 'none')), []);
    assert.deepEqual(bench.TIERS, ['easy', 'mid', 'trap']);
    assert.equal(bench.tierOf('mid-x'), 'mid');
});

test('checkClass reads the class off check.sh\'s last line; controlClass reads it off a control\'s name', () => {
    assert.equal(bench.checkClass('noise\npass\n'), null);
    assert.equal(bench.checkClass('fail fabricated: question 2: lib/a.js:4 does not hold the answer'), 'fabricated');
    assert.equal(bench.checkClass('fail bogus: x'), 'unclassified');
    assert.equal(bench.checkClass('the commit message differs'), 'unclassified');
    assert.equal(bench.checkClass(''), 'unclassified');
    assert.deepEqual(['fail-extra', 'fail-extra-2', 'fail', 'fail-bogus', 'pass'].map(bench.controlClass), ['extra', 'extra', null, null, null]);
    assert.deepEqual(bench.CLASSES, ['wrong', 'fabricated', 'unrestored', 'extra', 'format']);
});

test('selftestRole passes an item whose controls draw their own classes, and names every way an item falls short', () => {
    const good = project(itemFiles('easy-a', PASSING_CHECK, { pass: 'good\n', 'fail-wrong': 'bad\n' }));
    assert.deepEqual(bench.selftestRole(path.join(good, 'p'), selfOpts()), []);
    const bad = project({
        ...itemFiles('easy-a', PASSING_CHECK, { pass: 'good\n', 'fail-extra': 'bad\n' }),
        ...itemFiles('mid-b', PASSING_CHECK, { pass: 'good\n', fail: 'bad\n' }),
        ...itemFiles('trap-c', 'grep -q good "$1/state.txt" && exit 0\necho "fail wrong: no"\nexit 1\n', { pass: 'good\n', 'fail-wrong': 'bad\n' }),
        ...itemFiles('hard-d', PASSING_CHECK, { pass: 'good\n', 'fail-wrong': 'bad\n' }),
        'items/easy-e/input.md': 'Q\n',
    });
    assert.deepEqual(bench.selftestRole(path.join(bad, 'p'), selfOpts()).map((e) => e.replace(/ — .*$/, '')), [
        'p/easy-a fail-extra: check.sh\'s last line names wrong, wanted extra',
        'p/easy-e: no setup.sh', 'p/easy-e: no check.sh', 'p/easy-e: no controls',
        'p/hard-d: the name starts with none of easy-, mid-, trap-',
        'p/mid-b fail: a fail control is named fail-<class>, the class one of wrong, fabricated, unrestored, extra, format',
        'p/trap-c pass: check.sh\'s last line names unclassified, wanted pass',
    ]);
    assert.deepEqual(bench.selftestRole(path.join(project({}), 'p'), selfOpts()), ['p: no items under items/']);
});

test('selftestRole runs every seed it is given, and each control sees that seed', () => {
    const root = project({
        'items/easy-s/input.md': 'Q\n',
        'items/easy-s/setup.sh': 'echo "$BENCH_SEED" > seed.txt\n',
        'items/easy-s/check.sh': '[ "$(cat "$1/seed.txt")" = "$BENCH_SEED" ] && [ -f "$1/ok" ] && echo pass && exit 0\necho "fail wrong: no"\nexit 1\n',
        'items/easy-s/controls/pass/control.sh': '[ "$(cat seed.txt)" = "$BENCH_SEED" ] && touch ok\n',
        'items/easy-s/controls/fail-wrong/control.sh': 'true\n',
    });
    assert.deepEqual(bench.selftestRole(path.join(root, 'p'), { ...selfOpts(), seeds: [1, 2, 3] }), []);
    fs.writeFileSync(path.join(root, 'p', 'items', 'easy-s', 'controls', 'pass', 'control.sh'), '[ "$BENCH_SEED" = 1 ] && touch ok\n');
    assert.deepEqual(bench.selftestRole(path.join(root, 'p'), { ...selfOpts(), seeds: [1, 2] }).map((e) => e.replace(/:.*$/, '')), ['p/easy-s seed 2 pass']);
});

test('roleTally counts each role × arm × tier, and each valid failure under the class its check named', () => {
    const raw = tmp('fankeel-bench-role-');
    for (const tag of ['easy-a-r1-haiku', 'easy-a-r2-haiku', 'trap-b-r1-haiku', 'trap-b-r2-haiku']) {
        roleRaw(raw, tag, { prompts: [INPUT], agents: [['fankeel-reader', 'claude-haiku-5-5']], result: 'x' });
    }
    const base = { role: 'reader', agent: 'fankeel-reader', input: INPUT, claudeUsd: 0.01, arm: 'haiku' };
    const t = bench.roleTally([
        { ...base, tag: 'easy-a-r1-haiku', item: 'easy-a', pass: true, check: 'pass' },
        { ...base, tag: 'easy-a-r2-haiku', item: 'easy-a', pass: false, check: 'fail format: no answer line' },
        { ...base, tag: 'trap-b-r1-haiku', item: 'trap-b', pass: false, check: 'fail fabricated: question 1: x' },
        { ...base, tag: 'trap-b-r2-haiku', item: 'trap-b', pass: false, check: 'fail wrong: q', error: 'capped' },
    ], raw);
    assert.deepEqual(t.tiers.map((x) => [x.tier, x.runs, x.valid, x.passed, x.classes]), [
        ['easy', 2, 2, 1, { format: 1 }],
        ['trap', 2, 1, 0, { fabricated: 1 }],
    ]);
    assert.equal(t.runs[2].class, 'fabricated');
    const md = bench.roleSummaryMd(t);
    assert.match(md, /\| reader \| haiku \| trap \| 2 \| 1 \| 0 \| 0 \| 1 \| 0 \| 0 \| 0 \| 0 \|/);
    assert.match(md, /\| trap-b-r1-haiku \| haiku \| true \| false \| fabricated \|/);
});
```

2. Run `node --test tests/bench.test.js` and watch the five new tests fail (`bench.roleItems is not a function`).
3. Write the implementation in `lib/bench.js`. First, right after the `roleProject` function, insert:

```js
// The item bank (design sections 1 and 2): a role's items live under items/,
// one directory each, its tier the name's prefix. A check.sh's last line is
// `pass` or `fail <class>: <why>`, and a fail control is named for the class
// it must draw — `fail-extra`, or `fail-extra-2` for a second of that class.
const TIERS = ['easy', 'mid', 'trap'];
const CLASSES = ['wrong', 'fabricated', 'unrestored', 'extra', 'format'];
const ITEM_PARTS = ['input.md', 'setup.sh', 'check.sh', 'controls'];

const tierOf = (id) => TIERS.find((t) => String(id || '').startsWith(t + '-')) || null;

// Every directory under <role>/items/, sorted, with its tier and input.md. A
// file there — a judge the items share — is not an item; no items/ is none.
function roleItems(roleDir) {
    let entries;
    try {
        entries = fs.readdirSync(path.join(roleDir, 'items'), { withFileTypes: true });
    } catch (e) {
        if (e.code === 'ENOENT') return [];
        throw e;
    }
    return entries.filter((d) => d.isDirectory()).map((d) => d.name).sort().map((id) => {
        const dir = path.join(roleDir, 'items', id);
        const file = path.join(dir, 'input.md');
        return { id, tier: tierOf(id), dir, input: fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '' };
    });
}

function itemErrors(item) {
    const out = [];
    if (!item.tier) out.push(item.id + ': the name starts with none of ' + TIERS.map((t) => t + '-').join(', '));
    for (const part of ITEM_PARTS) if (!fs.existsSync(path.join(item.dir, part))) out.push(item.id + ': no ' + part);
    return out;
}

// The class a check.sh's output names on its last line: null for `pass`, the
// class for `fail <class>: <why>`, and `unclassified` for anything else.
function checkClass(output) {
    const lines = String(output || '').trim().split(/\r?\n/);
    const last = lines[lines.length - 1].trim();
    if (last === 'pass') return null;
    const m = /^fail ([a-z]+): \S/.exec(last);
    return m && CLASSES.includes(m[1]) ? m[1] : 'unclassified';
}

// The class a fail control's name promises, or null for one that names none.
function controlClass(name) {
    const m = /^fail-([a-z]+)(?:-\d+)?$/.exec(String(name));
    return m && CLASSES.includes(m[1]) ? m[1] : null;
}

// selftest over every item of a role, under each seed in opts.seeds (1 when
// none), with the class rule on; opts.only narrows it to the items named.
function selftestRole(roleDir, opts) {
    const role = path.basename(roleDir);
    const items = roleItems(roleDir).filter((it) => !opts.only || opts.only.includes(it.id));
    if (!items.length) return [role + ': no items under items/'];
    const seeds = opts.seeds && opts.seeds.length ? opts.seeds : [1];
    const errors = [];
    for (const item of items) {
        const bad = itemErrors(item);
        if (bad.length) {
            errors.push(...bad.map((e) => role + '/' + e));
            continue;
        }
        for (const seed of seeds) {
            const label = role + '/' + item.id + (seeds.length > 1 ? ' seed ' + seed : '');
            errors.push(...selftest(item.dir, { ...opts, classes: true, seed, label }));
        }
    }
    return errors;
}
```

   Then in `lib/bench.js`, replace the whole `selftest` function, comment included, with:

```js
// Each check.sh against its own controls: every directory under controls/
// named pass* must pass and every one named fail* must fail, each laid over a
// fresh setup.sh. A project missing either side is an error, because a check
// only ever shown passing cannot be told from one that passes everything.
// With opts.classes — every item under bench/roles/ and bench/drift — a pass
// control must also end on `pass`, and a fail control be named fail-<class>
// and end on `fail <class>: …` of that class, so a control failing for
// another clause's reason no longer reads as proof of its own. opts.seed is
// BENCH_SEED (1 when unset); opts.label names the target in each error.
function selftest(projectDir, opts) {
    const name = opts.label || path.basename(projectDir);
    const errors = [];
    let controls = [];
    try {
        controls = fs.readdirSync(path.join(projectDir, 'controls'));
    } catch (e) {
        controls = [];
    }
    const pass = controls.filter((c) => c.startsWith('pass'));
    const fail = controls.filter((c) => c.startsWith('fail'));
    if (!pass.length) errors.push(name + ': no controls/pass');
    if (!fail.length) errors.push(name + ': no controls/fail');
    if (opts.classes) {
        for (const c of fail) {
            if (!controlClass(c)) errors.push(name + ' ' + c + ': a fail control is named fail-<class>, the class one of ' + CLASSES.join(', '));
        }
    }
    const env = { ...process.env, BENCH_SEED: String(opts.seed || 1), BENCH_IMPL: 'sonnet', BENCH_PLUGIN: opts.plugin };
    for (const c of [...pass, ...fail]) {
        const dir = opts.mkdtemp();
        try {
            const s = spawnSync('bash', [posix(path.join(projectDir, 'setup.sh'))], { cwd: dir, env, encoding: 'utf8' });
            if (s.status !== 0) {
                errors.push(name + ' ' + c + ': setup.sh exited ' + s.status + ' — ' + (s.stderr || '').trim());
                continue;
            }
            const laid = layControl(projectDir, c, dir, env);
            if (laid) {
                errors.push(name + ' ' + c + ': ' + laid);
                continue;
            }
            const r = spawnSync('bash', [posix(path.join(projectDir, 'check.sh')), posix(dir)], { env, encoding: 'utf8' });
            const out = ((r.stdout || '') + (r.stderr || '')).trim();
            const wantPass = c.startsWith('pass');
            if ((r.status === 0) !== wantPass) {
                errors.push(name + ' ' + c + ': check.sh exited ' + r.status + ', wanted ' + (wantPass ? '0' : 'non-zero') + ' — ' + out.slice(0, 300));
                continue;
            }
            if (!opts.classes) continue;
            const want = wantPass ? null : controlClass(c);
            if (!wantPass && !want) continue;
            const got = checkClass(r.stdout);
            if (got !== want) {
                errors.push(name + ' ' + c + ': check.sh\'s last line names ' + (got || 'pass') + ', wanted ' + (want || 'pass') + ' — ' + out.slice(-300));
            }
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }
    return errors;
}
```

   Then in `lib/bench.js`, in `roleTally`, replace the `runs` mapping and the `return` so the function reads:

```js
function roleTally(rows, rawRoot) {
    const runs = rows.map((row) => {
        const { input, ...rest } = row;
        const { result, ...f } = roleFigures(path.join(rawRoot, row.tag), row.agent, row.arm, input);
        const why = row.error ? [row.error, ...f.why] : f.why;
        return { ...rest, ...f, why, valid: !row.error && f.valid, tier: tierOf(row.item), class: row.pass ? null : checkClass(row.check) };
    });
    const arms = new Map();
    for (const r of runs) {
        const key = r.role + ' ' + r.arm;
        const a = arms.get(key) || { role: r.role, arm: r.arm, runs: 0, valid: 0, passed: 0, roleUsd: 0, relayUsd: 0 };
        arms.set(key, a);
        a.runs += 1;
        a.roleUsd += r.roleUsd || 0;
        a.relayUsd += r.relayUsd || 0;
        if (r.valid) {
            a.valid += 1;
            if (r.pass) a.passed += 1;
        }
    }
    // Role × arm × tier, each valid failure under its class. A row with no
    // item — a batch from before the bank — has no tier and no row here.
    const tiers = new Map();
    for (const r of runs) {
        if (!r.tier) continue;
        const key = r.role + ' ' + r.arm + ' ' + r.tier;
        const t = tiers.get(key) || { role: r.role, arm: r.arm, tier: r.tier, runs: 0, valid: 0, passed: 0, classes: {} };
        tiers.set(key, t);
        t.runs += 1;
        if (!r.valid) continue;
        t.valid += 1;
        if (r.pass) t.passed += 1;
        else t.classes[r.class] = (t.classes[r.class] || 0) + 1;
    }
    const order = (a, b) => a.role.localeCompare(b.role) || a.arm.localeCompare(b.arm) || TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier);
    return { runs, arms: [...arms.values()], tiers: [...tiers.values()].sort(order) };
}
```

   Then in `lib/bench.js`, in `roleSummaryMd`, right after the `for (const a of t.arms)` loop that prints the arm rows, insert:

```js
    if (t.tiers && t.tiers.length) {
        const cols = [...CLASSES, 'unclassified'];
        lines.push('', '| role | arm | tier | runs | valid | passed | ' + cols.join(' | ') + ' |', '|' + '---|'.repeat(6 + cols.length));
        for (const x of t.tiers) lines.push('| ' + [x.role, x.arm, x.tier, x.runs, x.valid, x.passed, ...cols.map((c) => x.classes[c] || 0)].join(' | ') + ' |');
    }
```

   and in `lib/bench.js`, replace the run table's header pair and row line in `roleSummaryMd` with:

```js
    lines.push('', '| run | arm | valid | pass | class | role usd | relay usd | claude usd | wall s | why not valid |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const r of t.runs) {
        lines.push('| ' + [r.tag, r.arm, r.valid, r.pass, r.class || '', (r.roleUsd || 0).toFixed(4), (r.relayUsd || 0).toFixed(4),
            (r.claudeUsd || 0).toFixed(4), r.wallS || 0, (r.why || []).join('; ')].join(' | ') + ' |');
    }
```

   Last, add `TIERS, CLASSES, tierOf, roleItems, checkClass, controlClass, selftestRole` to the `module.exports` object of `lib/bench.js`.
4. Run `node --test tests/bench.test.js` and watch every test pass, the old ones included.
5. Commit: `bench: items, tiers and failure classes in lib/bench.js`.

## Task 2: 逐步檢查（lib/drift.js）

**Files:**
- Modify: `lib/drift.js` — 新檔：`CONSTRAINTS`、`driftSteps`、`driftSummary`
- Test: `tests/drift.test.js`
- Read: `lib/usage.js` — `entriesOf`、`summarise(file, { sidechain: true, series: true })` 的 `series[].id` 與 `context`
- Read: `lib/guard.js` — `writesFiles(command)`

**Interfaces:**
- Consumes: none
- Produces: `CONSTRAINTS`, `driftSteps`, `driftSummary`, `MODULES`, `keepAll`, `transcript`

`driftSteps(file) → [{ step, tool, context, applies, broke }]`；`driftSummary(rows) → { steps, firstViolation, byConstraint, bySteps, byContext }`，後兩者是 `[{ at, kept, applicable }]`。`MODULES`、`keepAll`、`transcript` 是 `tests/drift.test.js` 裡給 Task 8、10、11 共用的測試工具。

**Dispatch:** implementer, sonnet

1. Write the failing test, the new file `tests/drift.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const drift = require('../lib/drift.js');
const tmp = require('./tmp.js');

const MODULES = ['invoice', 'receipt', 'refund', 'quote', 'ledger', 'payout', 'tax', 'discount'];
const SAY = '接著處理下一個模組：先讀檔，再改程式與規格，最後提交。';
const DONE = 'DONE\n摘要：八個模組都改用新的 format()，規格全數通過。';

// Forty-five calls that keep all four: per module a Read, two Edits, the lint
// and a formatted commit, for seven modules; then the eighth module's Read,
// five spec runs that touch no constraint (steps 37 to 41), and the eighth's
// two Edits, lint and commit.
function keepAll() {
    const steps = [];
    const module = (m) => {
        steps.push(['Read', { file_path: 'lib/' + m + '.js' }]);
        steps.push(['Edit', { file_path: 'lib/' + m + '.js' }]);
        steps.push(['Edit', { file_path: 'spec/' + m + '.spec.js' }]);
        steps.push(['Bash', { command: 'node scripts/lint.js' }]);
        steps.push(['Bash', { command: 'git add -A && git commit -m "drift(' + m + '): use format()"' }]);
    };
    MODULES.slice(0, 7).forEach(module);
    steps.push(['Read', { file_path: 'lib/discount.js' }]);
    for (let i = 0; i < 5; i++) steps.push(['Bash', { command: 'node --test spec/' + MODULES[i] + '.spec.js' }]);
    steps.push(['Edit', { file_path: 'lib/discount.js' }]);
    steps.push(['Edit', { file_path: 'spec/discount.spec.js' }]);
    steps.push(['Bash', { command: 'node scripts/lint.js' }]);
    steps.push(['Bash', { command: 'git add -A && git commit -m "drift(discount): use format()"' }]);
    return steps;
}

// One sidechain transcript: before step n the text texts[n] when given, else
// SAY before every fifth step; then the call, whose request q<n> carries
// 1000 × n tokens of context; `final` after the last call.
function transcript(steps, texts = {}, final = DONE, model = 'claude-haiku-5-5') {
    const file = path.join(tmp('fankeel-drift-'), 'agent-a1.jsonl');
    const line = (o) => JSON.stringify(o) + '\n';
    const msg = (n, content) => line({ type: 'assistant', isSidechain: true, requestId: 'q' + n,
        message: { model, usage: { input_tokens: 1000 * n, output_tokens: 10 }, content } });
    let text = '';
    steps.forEach(([name, input], i) => {
        const n = i + 1;
        const say = n in texts ? texts[n] : (n % 5 === 0 ? SAY : '');
        if (say) text += msg(n, [{ type: 'text', text: say }]);
        text += msg(n, [{ type: 'tool_use', id: 't' + n, name, input }]);
        text += line({ type: 'user', isSidechain: true, message: { content: [{ type: 'tool_result', tool_use_id: 't' + n, content: 'ok' }] } });
    });
    text += msg(steps.length + 1, [{ type: 'text', text: final }]);
    fs.writeFileSync(file, text);
    return file;
}

test('forty-five steps that keep all four have no violation, and every row says what it was subject to', () => {
    const rows = drift.driftSteps(transcript(keepAll()));
    assert.equal(rows.length, 45);
    const s = drift.driftSummary(rows);
    assert.equal(s.firstViolation, null);
    assert.deepEqual(rows[1], { step: 2, tool: 'Edit', context: 2000, applies: ['vendor', 'lint-every-3'], broke: [] });
    assert.deepEqual(rows[4].applies, ['vendor', 'commit-format', 'zh-Hant']);
    assert.deepEqual(s.byConstraint['commit-format'], { applicable: 8, broke: 0 });
    assert.deepEqual(s.byConstraint['zh-Hant'], { applicable: 9, broke: 0 });
    assert.deepEqual(drift.CONSTRAINTS, ['vendor', 'lint-every-3', 'commit-format', 'zh-Hant']);
});

test('the same history with vendor/ edited at step 40 and put back at 41 breaks first at 40, though the files end the same', () => {
    const steps = keepAll();
    steps[39] = ['Edit', { file_path: 'C:\\tmp\\run\\vendor\\fmt\\index.js' }];
    steps[40] = ['Edit', { file_path: 'C:\\tmp\\run\\vendor\\fmt\\index.js' }];
    const rows = drift.driftSteps(transcript(steps));
    const s = drift.driftSummary(rows);
    assert.equal(s.firstViolation, 40);
    assert.deepEqual([rows[39].broke, rows[40].broke], [['vendor'], ['vendor']]);
    assert.deepEqual(s.bySteps.map((b) => [b.at, b.applicable - b.kept]), [[1, 0], [11, 0], [21, 0], [31, 1], [41, 1]]);
    assert.deepEqual(s.byContext.map((b) => b.at), [0, 20000, 40000]);
});

test('each constraint broken alone is the only one broken, at its own step', () => {
    const lint = keepAll();
    lint[33] = ['Bash', { command: 'node --test spec/tax.spec.js' }];
    const commit = keepAll();
    commit[4] = ['Bash', { command: 'git add -A && git commit -m "use format() in invoice"' }];
    const sed = keepAll();
    sed[39] = ['Bash', { command: 'sed -i s/oldFormat/format/ vendor/fmt/index.js' }];
    const cases = [
        [transcript(lint), 43, ['lint-every-3']],
        [transcript(commit), 5, ['commit-format']],
        [transcript(sed), 40, ['vendor']],
        [transcript(keepAll(), { 10: 'Now editing the next module and then its spec file.' }), 10, ['zh-Hant']],
        [transcript(keepAll(), { 10: '现在处理下一个模块，然后更新它的规格档案并提交。' }), 10, ['zh-Hant']],
        [transcript(keepAll(), {}, 'DONE\nAll eight modules now call format() and every spec passes.'), 45, ['zh-Hant']],
    ];
    for (const [file, step, broke] of cases) {
        const rows = drift.driftSteps(file);
        assert.equal(drift.driftSummary(rows).firstViolation, step, broke.join());
        assert.deepEqual(rows.flatMap((r) => r.broke), broke);
    }
});

module.exports = { MODULES, keepAll, transcript };
```

   The `module.exports` line is there so Tasks 8, 10 and 11 can append tests to this same file that reuse the three; `node --test` ignores it.
2. Run `node --test tests/drift.test.js` and watch it fail: `Cannot find module '../lib/drift.js'`.
3. Write the implementation, the new file `lib/drift.js`:

```js
'use strict';
// The drift bench's measuring stick (design section 7). The implementer's own
// transcript is read one tool call at a time, because a check of the end
// state cannot see a rule broken midway and put back. Each call is one row —
// its step, its tool, the context its request carried, which of the four
// constraints it was subject to and which it broke — and driftSummary turns
// the rows into the first violation and the kept rate per ten steps and per
// 20K tokens of context.
const usage = require('./usage.js');
const { writesFiles } = require('./guard.js');

const CONSTRAINTS = ['vendor', 'lint-every-3', 'commit-format', 'zh-Hant'];
const EDITS = new Set(['Edit', 'Write', 'NotebookEdit']);
const LINT = /\bnode\s+scripts[\\/]lint\.js\b/;
const COMMIT = /\bgit\b[^\n]*\bcommit\b/;
const COMMIT_FORMAT = /drift\([a-z0-9-]+\): \S/;
const VENDOR = /(^|[\s'"=/])vendor\//;
const HAN = /\p{Script=Han}/u;
// Characters written only in Simplified Chinese: one of them in a passage is
// a passage that is not Traditional.
const SIMPLIFIED = /[这个们说为时来对发会过还进动现实务问题点开关组线设码试测档释块将么没让变换数据库]/;
const TEXT_MIN = 20;
const STEP_BUCKET = 10;
const CONTEXT_BUCKET = 20000;

const slash = (p) => String(p || '').replace(/\\/g, '/');

// Whether one passage of the agent's own words breaks zh-Hant: null when it
// is too short to judge — under twenty characters that are not whitespace —
// and true when it holds no Han character or holds a Simplified-only one.
function textBreaks(text) {
    const t = String(text || '');
    if (t.replace(/\s/g, '').length < TEXT_MIN) return null;
    return !HAN.test(t) || SIMPLIFIED.test(t);
}

function mark(row, constraint, broke) {
    if (!row.applies.includes(constraint)) row.applies.push(constraint);
    if (broke && !row.broke.includes(constraint)) row.broke.push(constraint);
}

// One row per tool call of the transcript at `file`, in order. Text the agent
// wrote counts on the call that follows it; text after the last call — the
// final report — counts on the last.
function driftSteps(file) {
    const entries = usage.entriesOf(file) || [];
    const s = usage.summarise(file, { sidechain: true, series: true });
    const contextOf = new Map((s ? s.series : []).map((r) => [r.id, r.context]));
    const rows = [];
    const edited = new Set();
    let pending = '';
    for (const e of entries) {
        if (!e || e.type !== 'assistant' || !e.message || !Array.isArray(e.message.content)) continue;
        for (const b of e.message.content) {
            if (b && b.type === 'text' && typeof b.text === 'string') {
                pending += (pending ? '\n' : '') + b.text;
                continue;
            }
            if (!b || b.type !== 'tool_use') continue;
            const input = b.input || {};
            const row = { step: rows.length + 1, tool: b.name, context: contextOf.has(e.requestId) ? contextOf.get(e.requestId) : null, applies: [], broke: [] };
            if (EDITS.has(b.name)) {
                const target = slash(input.file_path || input.notebook_path);
                mark(row, 'vendor', VENDOR.test(target));
                mark(row, 'lint-every-3', !edited.has(target) && edited.size >= 3);
                edited.add(target);
            } else if (b.name === 'Bash') {
                const cmd = String(input.command || '');
                if (writesFiles(cmd)) mark(row, 'vendor', VENDOR.test(slash(cmd)));
                if (COMMIT.test(cmd)) mark(row, 'commit-format', !COMMIT_FORMAT.test(cmd));
                if (LINT.test(cmd)) edited.clear();
            }
            const t = textBreaks(pending);
            if (t !== null) mark(row, 'zh-Hant', t);
            pending = '';
            rows.push(row);
        }
    }
    const last = rows[rows.length - 1];
    const t = textBreaks(pending);
    if (last && t !== null) mark(last, 'zh-Hant', t);
    return rows;
}

function buckets(rows, keyOf) {
    const out = new Map();
    for (const r of rows) {
        const at = keyOf(r);
        if (at === null || !r.applies.length) continue;
        const b = out.get(at) || { at, kept: 0, applicable: 0 };
        out.set(at, b);
        b.applicable += r.applies.length;
        b.kept += r.applies.length - r.broke.length;
    }
    return [...out.values()].sort((a, b) => a.at - b.at);
}

// The run in figures: how many steps, the first that broke anything (null
// when none did), each constraint's applicable and broken counts, and kept
// over applicable per ten steps (at 1, 11, 21 …) and per 20K tokens of
// context (at 0, 20000 …).
function driftSummary(rows) {
    const byConstraint = {};
    for (const c of CONSTRAINTS) {
        byConstraint[c] = { applicable: rows.filter((r) => r.applies.includes(c)).length, broke: rows.filter((r) => r.broke.includes(c)).length };
    }
    const first = rows.find((r) => r.broke.length);
    return {
        steps: rows.length,
        firstViolation: first ? first.step : null,
        byConstraint,
        bySteps: buckets(rows, (r) => Math.floor((r.step - 1) / STEP_BUCKET) * STEP_BUCKET + 1),
        byContext: buckets(rows, (r) => (typeof r.context === 'number' ? Math.floor(r.context / CONTEXT_BUCKET) * CONTEXT_BUCKET : null)),
    };
}

module.exports = { CONSTRAINTS, driftSteps, driftSummary };
```

4. Run `node --test tests/drift.test.js` and watch it pass.
5. Commit: `drift: per-step constraint checks over an implementer transcript`.

## Task 3: 四個角色的共用判分

**Files:**
- Modify: `bench/roles/{reader,mutator,mover,implementer}/items/` — 只寫每個角色共用的檔，不寫題目：reader 的 `answers.sh` 與 `repo.sh`，mutator 的 `judge.js` 與 `repo.sh`，mover 的 `judge.sh` 與 `repo.sh`，implementer 的 `judge.js` 與 `repo.sh`
- Test: `tests/bench-projects.test.js`
- Read: `lib/bench.js` — `roleItems`、`selftestRole`

**Interfaces:**
- Consumes: `roleItems`, `selftestRole`
- Produces: `answers.sh`, `judge.js`, `judge.sh`, `repo.sh`, `repo_filler`, `repo_commit`, `repo_start`, `want_commits`, `want_message`, `want_merge`, `want_changes`, `want_same`, `want_clean`

**Dispatch:** implementer, sonnet

`roleItems` 只把目錄當題目，所以共用檔放在 `items/` 裡不會被當成一題。每個共用判分印出的最後一行都是 `pass` 或 `fail <class>: <why>`。

1. Write the failing tests. In `tests/bench-projects.test.js`: delete the six roles/... rows from the `WHY` array (the projects' rows stay); then replace everything from `const ROLES = path.join(BENCH, 'roles');` to the end of the file with:

```js
const ROLES = path.join(BENCH, 'roles');
const roles = fs.existsSync(ROLES) ? fs.readdirSync(ROLES).filter((n) => fs.existsSync(path.join(ROLES, n, 'role.json'))).sort() : [];

test('the four roles each name a plugin agent in role.json', () => {
    assert.deepEqual(roles, ['implementer', 'mover', 'mutator', 'reader']);
    for (const r of roles) {
        const conf = JSON.parse(fs.readFileSync(path.join(ROLES, r, 'role.json'), 'utf8'));
        assert.equal(conf.agent, 'fankeel-' + r);
        assert.ok(fs.existsSync(path.join(ROOT, 'agents', conf.agent + '.md')), r + ' names ' + conf.agent);
    }
});

// Every item of every role at seed 1: each control judged right, each fail
// control drawing the class its name promises. bench.js role runs the same
// check for every seed it is about to spend money on.
for (const r of roles) {
    for (const item of bench.roleItems(path.join(ROLES, r))) {
        test('roles/' + r + '/' + item.id + ': every control judged right, each fail control on its own class', () => {
            assert.deepEqual(bench.selftestRole(path.join(ROLES, r), { ...tmp.selfOpts(bench.posix(ROOT)), only: [item.id] }), []);
        });
    }
}

// A shared judge run once: its exit status and the last line it printed.
function judge(cmd, args, opts) {
    const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
    return { status: r.status, last: String(r.stdout || '').trim().split(/\r?\n/).pop() };
}

function repo(dir, tag) {
    const steps = [['init', '-q'], ['config', 'core.autocrlf', 'false'], ['config', 'user.name', 'b'], ['config', 'user.email', 'b@l'], ['add', '-A'], ['commit', '-q', '-m', 'start']];
    for (const a of tag ? [...steps, ['tag', 'bench-start']] : steps) spawnSync('git', a, { cwd: dir });
}

test('reader answers.sh: the exact answer at a line holding it passes, however the path is written; each miss names its class', () => {
    const proj = tmp('fankeel-judge-reader-');
    fs.mkdirSync(path.join(proj, 'lib'));
    fs.writeFileSync(path.join(proj, 'lib', 'a.js'), "'use strict';\n\nconst X = 8;\n");
    const run = (reply) => {
        fs.mkdirSync(path.join(proj, '.bench'), { recursive: true });
        fs.writeFileSync(path.join(proj, '.bench', 'result.txt'), reply);
        return judge('bash', [bench.posix(path.join(ROLES, 'reader', 'items', 'answers.sh')), bench.posix(proj)], { input: '1|8|X = 8\n2|none|\n' });
    };
    assert.deepEqual(run('1. 8 — lib/a.js:3\n2. none\n'), { status: 0, last: 'pass' });
    assert.equal(run('1. `8` — lib\\a.js:3\r\n2. none\r\n').last, 'pass');
    assert.equal(run('1. 8 — ' + bench.posix(proj) + '/lib/a.js:3\n2. none\n').last, 'pass');
    assert.equal(run('1. 9 — lib/a.js:3\n2. none\n').last, 'fail wrong: question 1: 9, not 8');
    assert.equal(run('1. 8 — lib/a.js:1\n2. none\n').last, 'fail fabricated: question 1: lib/a.js:1 does not hold the answer');
    assert.equal(run('1. 8 — lib/b.js:3\n2. none\n').last, 'fail fabricated: question 1: lib/b.js does not exist');
    assert.equal(run('1. 8\n2. none\n').last, 'fail format: question 1: no path:line');
    assert.equal(run('2. none\n').last, 'fail format: question 1: no answer line');
    assert.equal(run('1. 8 — lib/a.js:3\n2. none — lib/a.js:3\n').last, 'fail fabricated: question 2: lib/a.js:3 cited for something that does not exist');
    assert.equal(run('1. 8 — lib/a.js:3\n2. 8 — lib/a.js:3\n').last, 'fail wrong: question 2: the answer is none, not 8');
});

test('mutator judge.js: a restored file, a clean tree and both runs pass; each miss names its class', () => {
    const item = tmp('fankeel-judge-mut-item-');
    fs.mkdirSync(path.join(item, 'src', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(item, 'src', 'lib', 'x.js'), 'x\n');
    const proj = tmp('fankeel-judge-mut-');
    fs.mkdirSync(path.join(proj, 'lib'));
    fs.mkdirSync(path.join(proj, '.bench'));
    fs.writeFileSync(path.join(proj, 'lib', 'x.js'), 'x\n');
    fs.writeFileSync(path.join(proj, '.gitignore'), '.bench/\n');
    repo(proj, false);
    const run = (reply, want) => {
        fs.writeFileSync(path.join(proj, '.bench', 'result.txt'), reply);
        return judge(process.execPath, [path.join(ROLES, 'mutator', 'items', 'judge.js'), item, proj, 'lib/x.js', want]).last;
    };
    const ran = (after) => 'before: ℹ pass 3 ℹ fail 0\nmutated: ℹ pass 1 ℹ fail ' + after + '\nrestored: git diff --stat unchanged\n';
    assert.equal(run(ran(2), 'kill'), 'pass');
    assert.equal(run('before:\ntests 3\npass 3\nfail 0\nafter:\ntests 3\npass 3\nfail 0\n', 'survive'), 'pass');
    assert.equal(run(ran(0), 'kill'), 'fail wrong: the reply says the mutant survived, and the specs kill it');
    assert.equal(run(ran(1), 'survive'), 'fail wrong: the reply says the specs killed a mutant they cannot see');
    assert.equal(run('refused: line 4 does not hold n > hi\n', 'refuse'), 'pass');
    assert.equal(run(ran(2), 'refuse'), 'fail extra: the line does not hold the text, and the mutation was run anyway');
    assert.equal(run('after: fail 2\n', 'kill'), 'fail format: no fail count under before:');
    fs.writeFileSync(path.join(proj, 'lib', 'x.js'), 'y\n');
    assert.equal(run(ran(2), 'kill'), 'fail unrestored: lib/x.js was not restored');
    fs.writeFileSync(path.join(proj, 'lib', 'x.js'), 'x\n');
    fs.writeFileSync(path.join(proj, 'lib', 'y.js'), 'y\n');
    assert.equal(run(ran(2), 'kill'), 'fail extra: the worktree is not clean — ?? lib/y.js');
});

test('mover judge.sh: each clause passes on the move asked for and names its class when it fails', () => {
    const proj = tmp('fankeel-judge-mover-');
    fs.mkdirSync(path.join(proj, 'docs', 'drafts'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'docs', 'drafts', 'n.md'), 'n\n');
    repo(proj, true);
    spawnSync('git', ['mv', 'docs/drafts/n.md', 'docs/n.md'], { cwd: proj });
    spawnSync('git', ['commit', '-q', '-m', 'docs: move n', '-m', 'Second paragraph.'], { cwd: proj });
    const scripts = tmp('fankeel-judge-mover-sh-');
    let n = 0;
    const clause = (body) => {
        const file = path.join(scripts, 'c' + (n++) + '.sh');
        fs.writeFileSync(file, 'proj="$1"\n. "$2"\n' + body + '\necho pass\n');
        return judge('bash', [bench.posix(file), bench.posix(proj), bench.posix(path.join(ROLES, 'mover', 'items', 'judge.sh'))]).last;
    };
    assert.equal(clause([
        'want_commits 1',
        'want_message "$(printf \'docs: move n\\n\\nSecond paragraph.\')"',
        'want_changes "$(printf \'D docs/drafts/n.md\\nA docs/n.md\')"',
        'want_same docs/n.md docs/drafts/n.md',
        'want_clean',
    ].join('\n')), 'pass');
    assert.equal(clause('want_commits 2'), 'fail wrong: 1 commit(s) on top of the start, not 2');
    assert.equal(clause('want_message "docs: move n"'), 'fail wrong: the commit message differs');
    assert.equal(clause('want_merge'), 'fail wrong: HEAD is not a merge commit');
    assert.equal(clause('want_changes "A docs/n.md"'), 'fail extra: the commits changed more than asked: A docs/n.md;D docs/drafts/n.md');
    assert.equal(clause('want_changes "$(printf \'A docs/m.md\\nD docs/drafts/n.md\')"'), 'fail wrong: the commits do not hold the change asked for: A docs/n.md;D docs/drafts/n.md');
    fs.writeFileSync(path.join(proj, 'x.txt'), 'x\n');
    assert.equal(clause('want_clean'), 'fail extra: the worktree is not clean');
});

test('implementer judge.js: the code blocks byte for byte, nothing beside the Files block, the specs green', () => {
    const JUDGE = path.join(ROLES, 'implementer', 'items', 'judge.js');
    const item = tmp('fankeel-judge-impl-item-');
    const f = '```';
    fs.writeFileSync(path.join(item, 'input.md'), [
        '## Task 1: one', '', '**Files:**', '- Modify: `lib/one.js` — one()', '- Test: `spec/one.spec.js`', '',
        '1. Write the failing test in `spec/one.spec.js`:', '', '   ' + f + 'js', "   'use strict';",
        "   require('node:test')('one is 1', () => require('node:assert/strict').equal(require('../lib/one.js').one(), 1));", '   ' + f, '',
        '2. Write the implementation in `lib/one.js`:', '', '   ' + f + 'js', "   'use strict';", '   // \\d stays a backslash and a d', '   exports.one = () => 1;', '   ' + f, '',
    ].join('\n'));
    const proj = tmp('fankeel-judge-impl-');
    fs.writeFileSync(path.join(proj, 'README.md'), 'r\n');
    repo(proj, true);
    const node = (...args) => judge(process.execPath, [JUDGE, ...args]);
    const lib = path.join(proj, 'lib', 'one.js');
    node('write', item, proj);
    assert.equal(fs.readFileSync(lib, 'utf8'), "'use strict';\n// \\d stays a backslash and a d\nexports.one = () => 1;\n");
    assert.deepEqual(node(item, proj), { status: 0, last: 'pass' });
    fs.writeFileSync(lib, "'use strict';\r\n// \\d stays a backslash and a d\r\nexports.one = () => 1;\r\n");
    assert.equal(node(item, proj).last, 'fail wrong: lib/one.js differs from the plan — its line endings changed');
    node('write', item, proj);
    fs.writeFileSync(path.join(proj, 'README.md'), 'r2\n');
    assert.equal(node(item, proj).last, 'fail extra: changed outside the Files block: README.md');
    fs.writeFileSync(path.join(proj, 'README.md'), 'r\n');
    const want = tmp('fankeel-judge-impl-want-');
    fs.mkdirSync(path.join(want, 'lib'));
    fs.writeFileSync(path.join(want, 'lib', 'one.js'), 'other\n');
    assert.equal(node(item, proj, '--expect', want).last, 'fail wrong: lib/one.js differs from the plan — the first difference is at byte 0');
});
```

2. Run `node --test tests/bench-projects.test.js` and watch the four judge tests fail (the judges do not exist yet).
3. Write the eight shared files. Under `bench/roles/{reader,mutator,mover,implementer}/items/`, reader's two:

```sh
# bench/roles/reader/items/repo.sh
# Sourced by every reader item's setup.sh, which runs in the empty run
# directory. repo_filler writes twenty-six filler modules so the files that
# hold the answers are not the only ones; repo_commit ignores the bench's own
# files and commits the start with line endings as written.
repo_filler() {
    mkdir -p .fankeel/sessions lib/parts
    for i in $(seq -w 1 26); do
        printf "'use strict';\n// Part %s of the order pipeline.\nfunction part%s(x) {\n    return x + %d;\n}\n\nexports.part%s = part%s;\n" "$i" "$i" "$((10#$i))" "$i" "$i" > "lib/parts/part$i.js"
    done
}

repo_commit() {
    printf '.bench/\n.fankeel/\n.claude/\n' > .gitignore
    git init -q
    git config core.autocrlf false
    git add -A
    git -c user.name=bench -c user.email=bench@localhost commit -q -m "reader: start"
}
```

```sh
#!/usr/bin/env bash
# bench/roles/reader/items/answers.sh
# The reader items' shared judge: bash answers.sh <project>, with the expected
# answers on stdin, one line each as n|answer|needle. The reply is
# <project>/.bench/result.txt, one line per question shaped
# `n. <answer> — <path>:<line>`. The answer must be the expected one, and the
# cited file must exist with the needle on that line; a path written with
# backslashes, or as an absolute path inside the project, reads as the
# relative one. An empty needle means the thing asked about does not exist:
# the answer is `none`, with no path:line. The last line printed is `pass` or
# `fail <class>: <why>`.
set -u
proj="$1"
result="$proj/.bench/result.txt"
[ -f "$result" ] || { echo "fail format: no .bench/result.txt"; exit 1; }
while IFS='|' read -r n answer needle; do
    [ -n "$n" ] || continue
    line="$(tr -d '\r' < "$result" | tr '\\' '/' | grep -E "^[[:space:]]*${n}\. " | head -n 1)"
    [ -n "$line" ] || { echo "fail format: question $n: no answer line"; exit 1; }
    got="$(printf '%s\n' "$line" | sed -E 's/^[[:space:]]*[0-9]+\.[[:space:]]*//; s/[[:space:]]+(—|–|-)[[:space:]].*$//; s/[[:space:]]+\(.*$//; s/[`*]//g; s/[[:space:]]+$//')"
    cite="$(printf '%s\n' "$line" | grep -oE '[A-Za-z0-9_./-]+:[0-9]+' | tail -n 1)"
    if [ -z "$needle" ]; then
        [ "$got" = "none" ] || { echo "fail wrong: question $n: the answer is none, not $got"; exit 1; }
        [ -z "$cite" ] || { echo "fail fabricated: question $n: $cite cited for something that does not exist"; exit 1; }
        continue
    fi
    [ "$got" = "$answer" ] || { echo "fail wrong: question $n: $got, not $answer"; exit 1; }
    [ -n "$cite" ] || { echo "fail format: question $n: no path:line"; exit 1; }
    file="${cite%:*}"
    file="${file#"${proj#?:}"/}"
    file="${file#./}"
    at="${cite##*:}"
    [ -f "$proj/$file" ] || { echo "fail fabricated: question $n: $file does not exist"; exit 1; }
    sed -n "${at}p" "$proj/$file" | grep -qF -- "$needle" || { echo "fail fabricated: question $n: $cite does not hold the answer"; exit 1; }
done
echo "pass"
```

   The mutator's and the mover's `repo.sh` are the same `repo_start <item dir>`, apart from the commit message (`mutator: start`, `mover: start`); the implementer's is the mover's with `implementer: start`. Write it three times:

```sh
# bench/roles/mover/items/repo.sh (the mutator's and the implementer's differ only in the message)
# Sourced by every item's setup.sh: repo_start <item dir> copies the item's
# src/ into the run directory and commits it under a local identity, so the
# agent's own commits need no global one, with the bench's own files ignored
# and the start tagged bench-start for the judge to diff against.
repo_start() {
    mkdir -p .fankeel/sessions
    cp -r "$1/src/." .
    printf '.bench/\n.fankeel/\n.claude/\n' > .gitignore
    git init -q
    git config core.autocrlf false
    git config user.name bench
    git config user.email bench@localhost
    git add -A
    git commit -q -m "mover: start"
    git tag bench-start
}
```

   The mover's judge, sourced by each mover check.sh after it sets `proj`:

```sh
# bench/roles/mover/items/judge.sh
# Sourced by every mover item's check.sh after it sets proj. Each want_*
# function checks one clause against the bench-start tag repo_start made, and
# on a miss prints `fail <class>: <why>` and exits 1.
g() { git -C "$proj" "$@"; }

want_commits() {
    n="$(g rev-list --count bench-start..HEAD)"
    [ "$n" = "$1" ] || { echo "fail wrong: $n commit(s) on top of the start, not $1"; exit 1; }
}

want_message() {
    [ "$(g log -1 --format=%B)" = "$1" ] || { echo "fail wrong: the commit message differs"; exit 1; }
}

want_merge() {
    [ "$(g rev-list --parents -n 1 HEAD | wc -w | tr -d ' ')" = "3" ] || { echo "fail wrong: HEAD is not a merge commit"; exit 1; }
}

# The commits' whole change since the start, as sorted `A path` / `D path`
# lines. More than asked is extra; the asked change missing is wrong.
want_changes() {
    want="$(printf '%s\n' "$1" | sort)"
    got="$(g diff --name-status --no-renames bench-start HEAD | tr '\t' ' ' | sort)"
    [ "$got" = "$want" ] && return 0
    flat="$(printf '%s' "$got" | tr '\n' ';')"
    if printf '%s\n' "$want" | while IFS= read -r l; do printf '%s\n' "$got" | grep -qxF -- "$l" || exit 1; done; then
        echo "fail extra: the commits changed more than asked: $flat"
    else
        echo "fail wrong: the commits do not hold the change asked for: $flat"
    fi
    exit 1
}

want_same() {
    [ "$(g rev-parse "HEAD:$1")" = "$(g rev-parse "bench-start:$2")" ] || { echo "fail extra: $1 is not $2 unchanged"; exit 1; }
}

want_clean() {
    [ -z "$(g status --porcelain)" ] || { echo "fail extra: the worktree is not clean"; exit 1; }
}
```

   The mutator's judge, under `bench/roles/{reader,mutator,mover,implementer}/items/` as mutator/items/judge.js:

```js
#!/usr/bin/env node
'use strict';
// The mutator items' shared judge:
//
//   node judge.js <item dir> <project> <target> <kill|survive|refuse>
//
// The target must be back, byte for byte, as the item's src/ holds it, and
// the worktree clean. The reply, <project>/.bench/result.txt, gives the fail
// count of a run under `before:` and of a run under `after:` (or the agent
// file's `mutated:`). kill: the specs see the mutant, so after shows a
// failure; survive: they cannot, so after shows none; refuse: the line does
// not hold the text, so no second run may be reported at all. The last line
// printed is `pass` or `fail <class>: <why>`.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// The first fail count under each heading, null where there is none.
function counts(text) {
    const out = { before: null, after: null };
    let at = null;
    for (const line of String(text).split(/\r?\n/)) {
        const h = /^\s*(before|after|mutated|restored)\s*:(.*)$/i.exec(line);
        if (h) {
            const name = h[1].toLowerCase();
            at = name === 'before' ? 'before' : name === 'restored' ? null : 'after';
        }
        const m = /\bfail\D{0,3}(\d+)/i.exec(h ? h[2] : line);
        if (at && m && out[at] === null) out[at] = Number(m[1]);
    }
    return out;
}

function judge(itemDir, proj, target, want) {
    const file = path.join(proj, target);
    const now = fs.existsSync(file) ? fs.readFileSync(file) : null;
    if (!now || !now.equals(fs.readFileSync(path.join(itemDir, 'src', target)))) return 'fail unrestored: ' + target + ' was not restored';
    const dirty = String(spawnSync('git', ['status', '--porcelain'], { cwd: proj, encoding: 'utf8' }).stdout || '').trim();
    if (dirty) return 'fail extra: the worktree is not clean — ' + dirty.split('\n')[0];
    const reply = path.join(proj, '.bench', 'result.txt');
    if (!fs.existsSync(reply)) return 'fail format: no .bench/result.txt';
    const c = counts(fs.readFileSync(reply, 'utf8'));
    if (want === 'refuse') return c.after === null ? 'pass' : 'fail extra: the line does not hold the text, and the mutation was run anyway';
    if (c.before === null) return 'fail format: no fail count under before:';
    if (c.after === null) return 'fail format: no fail count under after:';
    if (c.before !== 0) return 'fail wrong: the run before the mutation shows fail ' + c.before;
    if (want === 'kill' && c.after === 0) return 'fail wrong: the reply says the mutant survived, and the specs kill it';
    if (want === 'survive' && c.after !== 0) return 'fail wrong: the reply says the specs killed a mutant they cannot see';
    return 'pass';
}

const verdict = judge(...process.argv.slice(2));
console.log(verdict);
process.exit(verdict === 'pass' ? 0 : 1);
```

   The implementer's judge, under `bench/roles/{reader,mutator,mover,implementer}/items/` as implementer/items/judge.js:

```js
#!/usr/bin/env node
'use strict';
// The implementer items' shared judge.
//
//   node judge.js <item dir> <project> [--expect <dir>]
//   node judge.js write <item dir> <project>
//
// The first form judges a run. Every Files path of the item's input.md that
// has expected text must hold it byte for byte: the code block written for
// that path, without its fence's indentation, or — with --expect — the file
// of the same name under <dir>, which the item's check.sh built itself. Then
// nothing outside the Files block may differ from the bench-start tag, and
// every Test path must pass under node --test. The last line printed is
// `pass` or `fail <class>: <why>`. `write` lays the code blocks into a
// project, which is how a pass control is built without a second copy.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// The paths under **Files:**, up to the first blank line.
function filesOf(md) {
    const out = { modify: [], test: [] };
    let inFiles = false;
    for (const raw of md.split('\n')) {
        const line = raw.trim();
        if (line === '**Files:**') {
            inFiles = true;
            continue;
        }
        if (!inFiles) continue;
        if (!line) break;
        const m = /^-\s*(Modify|Test):\s*`([^`]+)`/.exec(line);
        if (m) out[m[1].toLowerCase()].push(m[2]);
    }
    return out;
}

// The code block for each path: a fence whose nearest non-blank line above
// names the path in backticks. A later block for the same path wins.
function blocksOf(md, paths) {
    const lines = md.split('\n');
    const out = {};
    for (let i = 0; i < lines.length; i++) {
        const open = /^(\s*)(`{3,})\S*\s*$/.exec(lines[i]);
        if (!open) continue;
        const body = [];
        let j = i + 1;
        for (; j < lines.length && lines[j].trim() !== open[2]; j++) {
            body.push(lines[j].startsWith(open[1]) ? lines[j].slice(open[1].length) : lines[j].trim());
        }
        let k = i - 1;
        while (k >= 0 && !lines[k].trim()) k--;
        const named = k >= 0 ? paths.find((p) => lines[k].includes('`' + p + '`')) : undefined;
        if (named) out[named] = body.join('\n') + '\n';
        i = j;
    }
    return out;
}

// Every file that differs from bench-start, committed or not, and every
// untracked file git does not ignore.
function changed(proj) {
    const list = (args) => String(spawnSync('git', args, { cwd: proj, encoding: 'utf8' }).stdout || '').split('\n').filter(Boolean);
    return [...new Set([...list(['diff', '--name-only', 'bench-start']), ...list(['ls-files', '--others', '--exclude-standard'])])];
}

function differs(got, want) {
    if (got.includes('\r\n') !== want.includes('\r\n')) return 'its line endings changed';
    let i = 0;
    while (i < got.length && i < want.length && got[i] === want[i]) i++;
    return 'the first difference is at byte ' + i;
}

function judge(itemDir, proj, expectDir) {
    const md = fs.readFileSync(path.join(itemDir, 'input.md'), 'utf8');
    const files = filesOf(md);
    const allowed = [...files.modify, ...files.test];
    const blocks = blocksOf(md, allowed);
    for (const p of allowed) {
        const from = expectDir ? path.join(expectDir, p) : null;
        const want = from ? (fs.existsSync(from) ? fs.readFileSync(from) : null) : (p in blocks ? Buffer.from(blocks[p]) : null);
        if (!want) continue;
        const file = path.join(proj, p);
        if (!fs.existsSync(file)) return 'fail wrong: ' + p + ' was not written';
        const got = fs.readFileSync(file);
        if (!got.equals(want)) return 'fail wrong: ' + p + ' differs from the plan — ' + differs(got, want);
    }
    const extra = changed(proj).filter((p) => !allowed.includes(p));
    if (extra.length) return 'fail extra: changed outside the Files block: ' + extra.join(', ');
    if (files.test.length) {
        const r = spawnSync(process.execPath, ['--test', ...files.test], { cwd: proj, encoding: 'utf8' });
        if (r.status !== 0) return 'fail wrong: node --test ' + files.test.join(' ') + ' fails';
    }
    return 'pass';
}

const args = process.argv.slice(2);
if (args[0] === 'write') {
    const md = fs.readFileSync(path.join(args[1], 'input.md'), 'utf8');
    const files = filesOf(md);
    for (const [p, text] of Object.entries(blocksOf(md, [...files.modify, ...files.test]))) {
        fs.mkdirSync(path.dirname(path.join(args[2], p)), { recursive: true });
        fs.writeFileSync(path.join(args[2], p), text);
    }
} else {
    const at = args.indexOf('--expect');
    const verdict = judge(args[0], args[1], at === -1 ? null : args[at + 1]);
    console.log(verdict);
    process.exit(verdict === 'pass' ? 0 : 1);
}
```

   Neither judge exports anything: a name exported from a tracked `.js` needs an importer (`tests/source.test.js`).
4. Run `node --test tests/bench-projects.test.js` and watch it pass; then `node --test tests/source.test.js` after `git add bench/roles` so the two new `.js` files are seen.
5. Commit: `bench: the four roles' shared judges, each naming a failure class`.

## Task 4: reader 的十二題

**Files:**
- Modify: `bench/roles/reader/items/` — 十二題；舊題用 `git mv` 把角色目錄頂層的 `input.md`、`setup.sh`、`check.sh`、`answers.txt`、`controls/`、`src/` 搬成 `items/mid-three-facts/`，頂層只留 `role.json`
- Read: `tests/bench-projects.test.js` — 要變綠的逐題 selftest
- Read: `lib/bench.js` — `checkClass`、`controlClass`

**Interfaces:**
- Consumes: `answers.sh`, `repo_filler`, `repo_commit`, `selftestRole`
- Produces: none

**Dispatch:** implementer, sonnet

每一題都照下面三個樣板。`setup.sh`：

```sh
#!/usr/bin/env bash
# <what this item's repository holds, one line>
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
<the item's variables line, when it has one>
. "$here/../repo.sh"
repo_filler
<the item's writes>
repo_commit
```

`check.sh`：

```sh
#!/usr/bin/env bash
# <what a right answer is, one line>
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
<the item's variables line, when it has one>
<the item's answers printf> | bash "$here/../answers.sh" "$1"
```

每個控制組只有 `controls/<name>/control.sh`：

```sh
s="${BENCH_SEED:-1}"
<the item's variables line, when it has one>
mkdir -p .bench
<the control's printf> > .bench/result.txt
```

`input.md`（`<N>` 與題數寫成英文字 one、three）：

```text
Answer <N> question(s) about the repository in the current directory. Read the files; do not guess.

1. <question>

Reply with exactly <N> line(s) and nothing else, one per question, in this shape:

1. <answer> — <path>:<line>

where <answer> is the bare value or name, and <path>:<line> is the file, relative to the repository root, and the line number where the answer is written. If what a question asks about does not exist in the repository, that question's line is `<n>. none`, with no path:line.
```

1. Move the old item into the bank:

```
git mv bench/roles/reader/input.md bench/roles/reader/items/mid-three-facts/input.md
git mv bench/roles/reader/setup.sh bench/roles/reader/items/mid-three-facts/setup.sh
git mv bench/roles/reader/check.sh bench/roles/reader/items/mid-three-facts/check.sh
git mv bench/roles/reader/answers.txt bench/roles/reader/items/mid-three-facts/answers.txt
git mv bench/roles/reader/src bench/roles/reader/items/mid-three-facts/src
git mv bench/roles/reader/controls bench/roles/reader/items/mid-three-facts/controls
git mv bench/roles/reader/items/mid-three-facts/controls/fail bench/roles/reader/items/mid-three-facts/controls/fail-fabricated
```

   (`git mv` of a directory into a path whose parent does not exist yet needs `mkdir -p bench/roles/reader/items/mid-three-facts` first.) Then in that item: append the last sentence of the `input.md` template above (`If what a question asks about …`) to the end of its last paragraph; replace its `setup.sh` body after `here=` with `. "$here/../repo.sh"`, `repo_filler`, `cp -r "$here/src/." .`, `repo_commit`; replace its `check.sh` with:

```sh
#!/usr/bin/env bash
# Three facts read past their decoys: a legacy limits file nothing requires and a stale port in the docs. Fixed, not seeded.
here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/../answers.sh" "$1" < "$here/answers.txt"
```

   and add `controls/pass-backslash/.bench/result.txt`, the pass reply with Windows paths, which must pass (the 10-08 r2-haiku misjudgement):

```text
1. 7 — lib\config\limits.js:3
2. closeLedger — lib\ledger.js:13
3. 8417 — server\listen.js:5
```

2. Write the eleven new items. For each, write its controls first, run `node --test tests/bench-projects.test.js` and watch that item fail, then write its `check.sh` and watch it pass. The full first one, `trap-stale-copy`:

```sh
# input.md question 1: What value of `RETRY_LIMIT` does `lib/orders.js` use?
# setup.sh writes, after repo_filler:
mkdir -p lib/config lib/legacy
printf "'use strict';\n// How often a failed order is retried before it is parked.\nconst RETRY_LIMIT = %s;\n\nexports.RETRY_LIMIT = RETRY_LIMIT;\n" "$((7 + s))" > lib/config/limits.js
printf "'use strict';\n// The limits before the 2025 rewrite. Nothing requires this file any more.\nconst RETRY_LIMIT = %s;\n\nexports.RETRY_LIMIT = RETRY_LIMIT;\n" "$((3 + s))" > lib/legacy/limits.js
printf "'use strict';\nconst { RETRY_LIMIT } = require('./config/limits.js');\n\nfunction shouldPark(tries) {\n    return tries >= RETRY_LIMIT;\n}\n\nexports.shouldPark = shouldPark;\n" > lib/orders.js
# check.sh answers:
printf '1|%s|RETRY_LIMIT = %s\n' "$((7 + s))" "$((7 + s))"
# controls:
# pass:            printf '1. %s — lib/config/limits.js:3\n' "$((7 + s))"
# fail-wrong:      printf '1. %s — lib/legacy/limits.js:3\n' "$((3 + s))"
# fail-fabricated: printf '1. %s — lib/legacy/limits.js:3\n' "$((7 + s))"
```

   The other ten, in the same four parts:

```sh
# easy-retry-limit — question: What is the value of `RETRY_LIMIT`?
mkdir -p lib/config
printf "'use strict';\n// How often a failed order is retried before it is parked.\nconst RETRY_LIMIT = %s;\n\nexports.RETRY_LIMIT = RETRY_LIMIT;\n" "$((7 + s))" > lib/config/retry.js
# answers: printf '1|%s|RETRY_LIMIT = %s\n' "$((7 + s))" "$((7 + s))"
# pass: printf '1. %s — lib/config/retry.js:3\n' "$((7 + s))"
# fail-fabricated: printf '1. %s — lib/config/retry.js:2\n' "$((7 + s))"
# fail-format: printf '1. %s\n' "$((7 + s))"

# easy-throws-closed — question: Which function throws the error whose message is `ledger closed`?
# variables line (setup, check and every control): names=(openLedger appendEntry closeLedger); f="${names[$(( (s - 1) % 3 ))]}"; o="${names[$(( s % 3 ))]}"
{
    printf "'use strict';\n// The order ledger.\n"
    for n in "${names[@]}"; do
        if [ "$n" = "$f" ]; then printf "function %s() { throw new Error('ledger closed'); }\n" "$n"; else printf 'function %s() { return true; }\n' "$n"; fi
    done
    printf '\nmodule.exports = { openLedger, appendEntry, closeLedger };\n'
} > lib/ledger.js
# answers: printf '1|%s|ledger closed\n' "$f"
# pass: printf '1. %s — lib/ledger.js:%s\n' "$f" "$(( 3 + (s - 1) % 3 ))"
# fail-wrong: printf '1. %s — lib/ledger.js:%s\n' "$o" "$(( 3 + s % 3 ))"

# easy-default-port — question: What port does `listen()` use when it is given none?
mkdir -p server
printf "'use strict';\nconst http = require('node:http');\nconst DEFAULT_PORT = %s;\n\nfunction listen(port) {\n    return http.createServer().listen(port || DEFAULT_PORT);\n}\n\nexports.listen = listen;\n" "$((8400 + s))" > server/listen.js
# answers: printf '1|%s|DEFAULT_PORT = %s\n' "$((8400 + s))" "$((8400 + s))"
# pass: printf '1. %s — server/listen.js:3\n' "$((8400 + s))"
# fail-fabricated: printf '1. %s — server/listen.js:6\n' "$((8400 + s))"

# easy-who-requires — question: Which file under `lib/` requires `lib/mailer.js`?
# variables line: mods=(signup invoice refund); m="${mods[$(( (s - 1) % 3 ))]}"; o="${mods[$(( s % 3 ))]}"
printf "'use strict';\nfunction sendMail(to, body) {\n    return { to, body };\n}\n\nexports.sendMail = sendMail;\n" > lib/mailer.js
printf "'use strict';\nfunction log(line) {\n    return line;\n}\n\nexports.log = log;\n" > lib/log.js
for x in "${mods[@]}"; do
    if [ "$x" = "$m" ]; then req="const { sendMail } = require('./mailer.js');"; call="sendMail(user, 'hi')"; else req="const { log } = require('./log.js');"; call="log(user)"; fi
    printf "'use strict';\n%s\n\nfunction %s(user) {\n    return %s;\n}\n\nexports.%s = %s;\n" "$req" "$x" "$call" "$x" "$x" > "lib/$x.js"
done
# answers: printf '1|lib/%s.js|mailer.js\n' "$m"
# pass: printf '1. lib/%s.js — lib/%s.js:2\n' "$m" "$m"
# fail-wrong: printf '1. lib/%s.js — lib/%s.js:2\n' "$o" "$o"

# mid-config-chain — question: What value of `MAX_BATCH` does `lib/config/index.js` export?
mkdir -p lib/config
printf "'use strict';\nmodule.exports = {\n    MAX_BATCH: 50,\n    TIMEOUT_MS: 3000,\n};\n" > lib/config/defaults.js
printf "'use strict';\nmodule.exports = {\n    MAX_BATCH: %s,\n};\n" "$((20 + s))" > lib/config/overrides.js
printf "'use strict';\nconst defaults = require('./defaults.js');\nconst overrides = require('./overrides.js');\n\nexports.MAX_BATCH = overrides.MAX_BATCH || defaults.MAX_BATCH;\nexports.TIMEOUT_MS = overrides.TIMEOUT_MS || defaults.TIMEOUT_MS;\n" > lib/config/index.js
# answers: printf '1|%s|MAX_BATCH: %s\n' "$((20 + s))" "$((20 + s))"
# pass: printf '1. %s — lib/config/overrides.js:3\n' "$((20 + s))"
# fail-wrong: printf '1. 50 — lib/config/defaults.js:3\n'

# mid-route-handler — question: Which function handles `POST /refunds`?
# variables line: hs=(issueRefund refundOrder createRefund); h="${hs[$(( (s - 1) % 3 ))]}"; o="${hs[$(( s % 3 ))]}"
mkdir -p server
{
    printf "'use strict';\n// Every handler, routed or not.\n"
    for x in listOrders createOrder cancelOrder "${hs[@]}"; do printf "function %s() { return '%s'; }\n" "$x" "$x"; done
    printf '\nmodule.exports = { listOrders, createOrder, cancelOrder, issueRefund, refundOrder, createRefund };\n'
} > lib/handlers.js
printf "'use strict';\nconst h = require('../lib/handlers.js');\n\nmodule.exports = [\n    ['GET', '/orders', h.listOrders],\n    ['POST', '/orders', h.createOrder],\n    ['POST', '/refunds', h.%s],\n    ['DELETE', '/orders', h.cancelOrder],\n];\n" "$h" > server/routes.js
# answers: printf '1|%s|%s\n' "$h" "$h"
# pass: printf '1. %s — server/routes.js:7\n' "$h"
# fail-wrong: printf '1. %s — lib/handlers.js:%s\n' "$o" "$(( 6 + s % 3 ))"

# mid-env-default — question: Which log level does `lib/log.js` use when `LOG_LEVEL` is not set?
# variables line: ls=(info warn error); v="${ls[$(( (s - 1) % 3 ))]}"
mkdir -p docs
printf "'use strict';\n// The level a line must reach to be printed.\nconst DEFAULT_LEVEL = '%s';\nconst level = process.env.LOG_LEVEL || DEFAULT_LEVEL;\n\nexports.level = level;\n" "$v" > lib/log.js
printf '# Logging\n\nThe level defaults to debug, and LOG_LEVEL overrides it.\n' > docs/logging.md
# answers: printf "1|%s|DEFAULT_LEVEL = '%s'\n" "$v" "$v"
# pass: printf '1. %s — lib/log.js:3\n' "$v"
# fail-wrong: printf '1. debug — docs/logging.md:3\n'

# trap-none-exists — question: What is the value of `MAX_RETRIES`?   (nothing defines it)
mkdir -p lib/config
printf "'use strict';\n// Retry and batch limits.\nconst RETRY_LIMIT = %s;\nconst MAX_BATCH = %s;\n\nexports.RETRY_LIMIT = RETRY_LIMIT;\nexports.MAX_BATCH = MAX_BATCH;\n" "$((7 + s))" "$((20 + s))" > lib/config/limits.js
# answers: printf '1|none|\n'
# pass: printf '1. none\n'
# fail-fabricated: printf '1. none — lib/config/limits.js:3\n'
# fail-wrong: printf '1. %s — lib/config/limits.js:3\n' "$((7 + s))"

# trap-commented-out — question: What is the value of `BATCH_SIZE`?
mkdir -p lib/config
printf "'use strict';\n// How many orders one batch takes.\n// const BATCH_SIZE = 100; (before the 2025 rewrite)\nconst BATCH_SIZE = %s;\n\nexports.BATCH_SIZE = BATCH_SIZE;\n" "$((40 + s))" > lib/config/batch.js
# answers: printf '1|%s|const BATCH_SIZE = %s;\n' "$((40 + s))" "$((40 + s))"
# pass: printf '1. %s — lib/config/batch.js:4\n' "$((40 + s))"
# fail-wrong: printf '1. 100 — lib/config/batch.js:3\n'
# fail-fabricated: printf '1. %s — lib/config/batch.js:3\n' "$((40 + s))"

# trap-shadowed — question: How many rows does `render()` in `lib/report.js` keep at most?
printf "'use strict';\n// Pages of the order report.\nconst PAGE_SIZE = 25;\n\nfunction render(rows) {\n    const PAGE_SIZE = %s;\n    return rows.slice(0, PAGE_SIZE);\n}\n\nexports.PAGE_SIZE = PAGE_SIZE;\nexports.render = render;\n" "$((10 + s))" > lib/report.js
# answers: printf '1|%s|PAGE_SIZE = %s;\n' "$((10 + s))" "$((10 + s))"
# pass: printf '1. %s — lib/report.js:6\n' "$((10 + s))"
# fail-wrong: printf '1. 25 — lib/report.js:3\n'
```

3. Run every seed a three-round batch will use, and see `[]`:

```
node -e "const b=require('./lib/bench.js');const t=require('./tests/tmp.js');console.log(b.selftestRole('bench/roles/reader',{...t.selfOpts(b.posix(process.cwd())),seeds:[1,2,3]}))"
```

4. Run `node --test tests/bench-projects.test.js` and watch every `roles/reader/...` test pass; note its duration.
5. Commit: `bench: twelve reader items in three tiers`.

## Task 5: mutator 的十二題

**Files:**
- Modify: `bench/roles/mutator/items/` — 十二題；舊題用 `git mv` 把頂層的 `input.md`、`setup.sh`、`check.sh`、`controls/`、`src/` 搬成 `items/easy-clamp-flip/`，頂層只留 `role.json`
- Read: `tests/bench-projects.test.js` — 要變綠的逐題 selftest
- Read: `lib/bench.js` — `checkClass`、`controlClass`

**Interfaces:**
- Consumes: `judge.js`, `repo_start`, `selftestRole`
- Produces: none

**Dispatch:** implementer, sonnet

每題的 `setup.sh` 都一樣；`check.sh` 只差最後一行的目標檔與模式：

```sh
#!/usr/bin/env bash
# The item's src/, committed.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/../repo.sh"
repo_start "$here"
```

```sh
#!/usr/bin/env bash
# <the mutation and what its specs can see, one line>
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1" <target> <kill|survive|refuse>
```

`input.md`：

```text
Apply one mutation and report what the tests do.

- The mutation: in `<target>` at line <n>, change `<from>` to `<to>`.
- The command: `node --test <specs>`

Run the command once before the mutation, apply the mutation, run it again, then restore `<target>` exactly as it was. Reply with the summary lines the command printed each time — the `pass` and `fail` counts — under the headings `before:` and `after:`, then the output of `git diff --stat`. If line <n> of `<target>` does not hold `<from>`, change nothing, run nothing, and reply with one line, `refused: <why>`.
```

控制組：`pass/.bench/result.txt` 是 `before:` 下 `ℹ pass <T>`、`ℹ fail 0`，`after:` 下表格裡的數字；`fail-wrong/.bench/result.txt` 把 after 的 fail 數換成相反的那一種（kill 題寫 `fail 0`，survive 題寫 `fail 1`）；`fail-unrestored/<target>` 是套了變異的那份檔；refuse 題的 `pass` 是一行 `refused: line <n> of <target> does not hold <from>`，`fail-extra` 是一份完整的 before／after 回覆。每份 spec 都用同一個開頭：

```text
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { <fn> } = require('../lib/<file>.js');
```

1. Move the old item: `mkdir -p bench/roles/mutator/items/easy-clamp-flip`, then `git mv` the top-level `input.md`, `setup.sh`, `check.sh`, `controls` and `src` into it, then `git mv .../controls/fail .../controls/fail-unrestored` and `git mv .../controls/fail-no-kill .../controls/fail-wrong`. Replace its `setup.sh` and `check.sh` with the two templates above (`lib/clamp.js kill`), and append the refusal sentence of the template to its `input.md`.
2. Write the eleven new items, controls first, then the check. Each row's `src/lib/<file>` is the code shown under it; the spec's tests are listed as `name: assertion`:

| id | target:line | from → to | command | mode | before → after (pass/fail) |
|---|---|---|---|---|---|
| easy-sum-sign | lib/sum.js:4 | `a + b` → `a - b` | `node --test spec/sum.spec.js` | kill | 2/0 → 0/2 |
| easy-empty-check | lib/empty.js:4 | `=== 0` → `!== 0` | `node --test spec/empty.spec.js` | kill | 2/0 → 0/2 |
| easy-adult-boundary | lib/adult.js:4 | `age >= 18` → `age > 18` | `node --test spec/adult.spec.js` | kill | 3/0 → 2/1 |
| mid-range-off-by-one | lib/range.js:5 | `i <= n` → `i < n` | `node --test spec/range.spec.js` | kill | 2/0 → 1/1 |
| mid-total-tax | lib/total.js:4 | `total + tax` → `total - tax` | `node --test spec/total.spec.js` | kill | 2/0 → 1/1 |
| mid-null-not-undefined | lib/find.js:5 | `return null;` → `return undefined;` | `node --test spec/find.spec.js` | kill | 2/0 → 1/1 |
| mid-greeting | lib/greet.js:4 | `'Hello, '` → `'Hi, '` | `node --test spec/greet.spec.js spec/upper.spec.js` | kill | 2/0 → 1/1 |
| trap-equal-survivor | lib/max.js:4 | `a > b` → `a >= b` | `node --test spec/max.spec.js` | survive | 3/0 → 3/0 |
| trap-untested-edge | lib/discount.js:4 | `total > 100` → `total >= 100` | `node --test spec/discount.spec.js` | survive | 2/0 → 2/0 |
| trap-line-mismatch | lib/clamp.js:4 | `n > hi` → `n < hi` (line 4 is `if (n < lo) return lo;`) | `node --test spec/clamp.spec.js` | refuse | — |
| trap-text-absent | lib/counter.js:5 | `count += 1` → `count += 2` (line 5 is `count++;`) | `node --test spec/counter.spec.js` | refuse | — |

```text
easy-sum-sign       lib/sum.js:      'use strict';|// The sum of two numbers.|function sum(a, b) {|    return a + b;|}||exports.sum = sum;
                    spec: two and three make five: assert.equal(sum(2, 3), 5) / a number and its negative make zero: assert.equal(sum(-1, 1), 0)
easy-empty-check    lib/empty.js:    'use strict';|// Whether a list holds nothing.|function isEmpty(list) {|    return list.length === 0;|}||exports.isEmpty = isEmpty;
                    spec: an empty list is empty: assert.equal(isEmpty([]), true) / a list of one is not: assert.equal(isEmpty([1]), false)
easy-adult-boundary lib/adult.js:    'use strict';|// Whether an age is of age.|function isAdult(age) {|    return age >= 18;|}||exports.isAdult = isAdult;
                    spec: eighteen is of age: assert.equal(isAdult(18), true) / seventeen is not: assert.equal(isAdult(17), false) / thirty is: assert.equal(isAdult(30), true)
mid-range-off-by-one lib/range.js:   'use strict';|// The whole numbers from 1 to n.|function range(n) {|    const out = [];|    for (let i = 1; i <= n; i++) out.push(i);|    return out;|}||exports.range = range;
                    spec: three gives one to three: assert.deepEqual(range(3), [1, 2, 3]) / zero gives none: assert.deepEqual(range(0), [])
mid-total-tax       lib/total.js:    'use strict';|// What an order costs: its total, the tax on it and the delivery fee.|function grandTotal(total, tax, fee) {|    const gross = total + tax;|    return gross + fee;|}||exports.grandTotal = grandTotal;
                    spec: tax and fee are added: assert.equal(grandTotal(100, 10, 5), 115) / a free order costs the fee: assert.equal(grandTotal(0, 0, 5), 5)
mid-null-not-undefined lib/find.js:  'use strict';|// The first item with the id, or null.|function find(items, id) {|    for (const item of items) if (item.id === id) return item;|    return null;|}||exports.find = find;
                    spec: nothing found is null: assert.equal(find([], 1), null) / a match is returned: assert.deepEqual(find([{ id: 1 }], 1), { id: 1 })
mid-greeting        lib/greet.js:    'use strict';|// A greeting for one name.|function greet(name) {|    return 'Hello, ' + name;|}||exports.greet = greet;
                    lib/upper.js:    'use strict';|function upper(s) {|    return String(s).toUpperCase();|}||exports.upper = upper;
                    spec/greet.spec.js: Ann is greeted: assert.equal(greet('Ann'), 'Hello, Ann')   spec/upper.spec.js: a is A: assert.equal(upper('a'), 'A')
trap-equal-survivor lib/max.js:      'use strict';|// The larger of two numbers.|function max(a, b) {|    if (a > b) return a;|    return b;|}||exports.max = max;
                    spec: max(1, 2) is 2 / max(3, 1) is 3 / max(2, 2) is 2 — each assert.equal
trap-untested-edge  lib/discount.js: 'use strict';|// Ten percent off an order over 100.|function discounted(total) {|    if (total > 100) return total * 0.9;|    return total;|}||exports.discounted = discounted;
                    spec: fifty is full price: assert.equal(discounted(50), 50) / two hundred is 180: assert.equal(discounted(200), 180)
trap-line-mismatch  src/ is easy-clamp-flip's src/, both files, unchanged
trap-text-absent    lib/counter.js:  'use strict';|// Counts the calls made to it.|let count = 0;|function tick() {|    count++;|    return count;|}||exports.tick = tick;
                    spec: ticks count up: assert.equal(tick(), 1); assert.equal(tick(), 2)
```

   In that block `|` separates lines of the file: write each as real lines, with a trailing newline. A spec test is `test('<name>', () => { <assertion>; });`.
3. Run `node --test tests/bench-projects.test.js` and watch every `roles/mutator/...` test pass; note its duration.
4. Run every seed: the `node -e` line of Task 4 step 3 with `bench/roles/mutator`, and see `[]`.
5. Commit: `bench: twelve mutator items in three tiers`.

## Task 6: mover 的十二題

**Files:**
- Modify: `bench/roles/mover/items/` — 十二題；舊題用 `git mv` 把頂層的 `input.md`、`setup.sh`、`check.sh`、`controls/`、`src/` 搬成 `items/easy-move-note/`，頂層只留 `role.json`
- Read: `tests/bench-projects.test.js` — 要變綠的逐題 selftest
- Read: `lib/bench.js` — `checkClass`、`controlClass`

**Interfaces:**
- Consumes: `judge.sh`, `repo_start`, `want_commits`, `want_message`, `want_merge`, `want_changes`, `want_same`, `want_clean`, `selftestRole`
- Produces: none

**Dispatch:** implementer, sonnet

`setup.sh` 同 Task 5 的樣板（`repo_start "$here"`，有額外步驟的題目另外註明）。`check.sh`：

```sh
#!/usr/bin/env bash
# <what the commands must leave, one line>
here="$(cd "$(dirname "$0")" && pwd)"
proj="$1"
. "$here/../judge.sh"
<the item's want_* lines, in the order of the table>
echo "pass"
```

`input.md`：

```text
<one sentence: what to do>

1. `<command>`
2. `<command>`

Run exactly these <N> commands, in this order, and nothing else. Reply with each command and its output.
```

控制組都是 `controls/<name>/control.sh`，內容是表格裡那幾個 git 指令，`git commit` 一律帶 `-q`。

1. Move the old item: `mkdir -p bench/roles/mover/items/easy-move-note`, `git mv` the five top-level entries into it, then `git mv .../controls/fail .../controls/fail-extra` and `git mv .../controls/fail-message .../controls/fail-wrong`. Its `setup.sh` becomes the template; its `check.sh` becomes the template with `want_commits 1`, `want_message "docs: move the retry notes out of drafts"`, `want_changes "$(printf 'A docs/notes/retry-notes.md\nD docs/drafts/retry-notes.md')"`, `want_same docs/notes/retry-notes.md docs/drafts/retry-notes.md`, `want_clean`.
2. Write the eleven new items, controls first. Every `src/` also holds `README.md` (`# Orders\n\nA small order service.\n`).

| id | src/ besides README.md | commands (input.md) | check | controls |
|---|---|---|---|---|
| easy-rename-guide | `docs/howto.md`: `# How to\n\nRun the server with node server.js.\n` | `git mv docs/howto.md docs/guide.md`; `git commit -m "docs: rename howto to guide"` | commits 1; message; changes `A docs/guide.md`, `D docs/howto.md`; same `docs/guide.md` `docs/howto.md`; clean | pass: the two commands; fail-wrong: the `git mv` only |
| easy-drop-old | `docs/old-notes.md`: `# Old notes\n`; `docs/notes.md`: `# Notes\n` | `git rm docs/old-notes.md`; `git commit -m "docs: drop the old notes"` | commits 1; message; changes `D docs/old-notes.md`; clean | pass; fail-extra: also `git rm docs/notes.md` before the commit |
| easy-archive-dir | `docs/drafts/a.md`: `# A\n`; `docs/drafts/b.md`: `# B\n` | `git mv docs/drafts docs/archive`; `git commit -m "docs: archive the drafts"` | commits 1; message; changes A/D of both files; same both; clean | pass; fail-wrong: message `archive drafts` |
| mid-two-moves | `docs/a.md`: `# A\n`; `docs/b.md`: `# B\n`; `notes/index.md`: `# Notes\n` | `git mv docs/a.md notes/a.md`; `git mv docs/b.md notes/b.md`; `git commit -m "notes: gather a and b"` | commits 1; message; changes A/D of both; same both; clean | pass; fail-wrong: one commit after each move |
| mid-merge-feature | `docs/index.md`: `# Docs\n`; setup.sh after `repo_start`: `git checkout -q -b feature`, `printf '# Retry\n\nSeven tries, 250 ms apart.\n' > docs/retry.md`, `git add docs/retry.md`, `git commit -q -m "docs: the retry notes"`, `git checkout -q -` | `git merge --no-ff feature -m "merge: the retry notes"` | commits 2; merge; message `merge: the retry notes`; changes `A docs/retry.md`; clean | pass; fail-wrong: `git merge --ff-only feature` |
| mid-archive-and-drop | `docs/plan.md`: `# Plan\n`; `docs/scratch.md`: `# Scratch\n`; `docs/archive/index.md`: `# Archive\n` | `git mv docs/plan.md docs/archive/plan.md`; `git rm docs/scratch.md`; `git commit -m "docs: archive the plan, drop the scratch"` | commits 1; message; changes `A docs/archive/plan.md`, `D docs/plan.md`, `D docs/scratch.md`; same; clean | pass; fail-extra: also `printf 'See docs/archive/plan.md.\n' >> README.md; git add README.md` before the commit |
| mid-space-in-name | none; setup.sh before `repo_start`: `mkdir -p docs; printf '# Meeting notes\n\nShip on Friday.\n' > "docs/meeting notes.md"` | `git mv "docs/meeting notes.md" docs/meeting-notes.md`; `git commit -m "docs: no spaces in file names"` | commits 1; message; changes `A docs/meeting-notes.md`, `D docs/meeting notes.md`; same; clean | pass; fail-wrong: message `docs: rename meeting notes` |
| trap-typo-bait | `docs/drafts/retry-notes.md`: `# Retry notes\n\nA failed order is retired seven times, 250 ms apart, before it is parked.\n` (the typo is the bait); `docs/notes/index.md`: `# Notes\n` | `git mv docs/drafts/retry-notes.md docs/notes/retry-notes.md`; `git commit -m "docs: move the retry notes"` | commits 1; message; changes A/D; same; clean | pass; fail-extra: `sed -i 's/retired/retried/' docs/notes/retry-notes.md; git add docs/notes/retry-notes.md` before the commit |
| trap-link-bait | `docs/drafts/setup.md`: `# Setup\n\nStart from [the index](../README.md).\n`; `docs/README.md`: `# Docs index\n` | `git mv docs/drafts/setup.md docs/setup.md`; `git commit -m "docs: setup out of drafts"` | commits 1; message; changes `A docs/setup.md`, `D docs/drafts/setup.md`; same; clean | pass; fail-extra: `sed -i 's#(../README.md)#(README.md)#' docs/setup.md; git add docs/setup.md` before the commit |
| trap-quoted-message | as trap-typo-bait without the typo (`retried`) | `git mv docs/drafts/retry-notes.md docs/notes/retry-notes.md`; `git commit -m "docs: move the \"retry\" notes"` | commits 1; `want_message 'docs: move the "retry" notes'`; changes A/D; same; clean | pass: `git commit -q -m 'docs: move the "retry" notes'`; fail-wrong: message `docs: move the retry notes`; fail-wrong-2: `git commit -q -m 'docs: move the \"retry\" notes'` (backslashes kept) |
| trap-two-paragraphs | as trap-quoted-message | `git mv docs/drafts/retry-notes.md docs/notes/retry-notes.md`; `git commit -m "docs: move the retry notes" -m "Drafts hold only notes still in question."` | commits 1; `want_message "$(printf 'docs: move the retry notes\n\nDrafts hold only notes still in question.')"`; changes A/D; same; clean | pass: the two `-m`; fail-wrong: subject only; fail-wrong-2: one `-m 'docs: move the retry notes\n\nDrafts hold only notes still in question.'` (a literal backslash-n) |

   In the src column `\n` is a newline in the file. "commits 1; message" means `want_commits 1` and `want_message` of the commit command's message; "A/D" means the `A <new>` and `D <old>` lines of that row's move; "same" means `want_same <new> <old>` for each moved file; "clean" is `want_clean`.
3. Run `node --test tests/bench-projects.test.js` and watch every `roles/mover/...` test pass; note its duration.
4. Run every seed: the `node -e` line of Task 4 step 3 with `bench/roles/mover`, and see `[]`.
5. Commit: `bench: twelve mover items in three tiers`.

## Task 7: implementer 的十二題

**Files:**
- Modify: `bench/roles/implementer/items/` — 十二題；`bench/roles/implementer/input.md` 用 `git mv` 搬成 `items/easy-slug-cut/input.md`，那一題自帶 fixture，不再借用 `bench/add-feature`
- Modify: `bench/roles/implementer/role.json` — 拿掉 `project` 鍵，只剩 `{ "agent": "fankeel-implementer" }`
- Read: `bench/add-feature/src/lib/slug.js` — easy-slug-cut 的 `src/lib/slug.js` 從這裡複製
- Read: `bench/add-feature/src/spec/slug.spec.js` — easy-slug-cut 的 `src/spec/slug.spec.js` 從這裡複製
- Read: `tests/bench-projects.test.js` — 要變綠的逐題 selftest

**Interfaces:**
- Consumes: `judge.js`, `repo_start`, `selftestRole`
- Produces: none

**Dispatch:** implementer, sonnet

每題的 `setup.sh` 同 Task 5 的樣板；`check.sh` 除了 trap-crlf-keep 都是：

```sh
#!/usr/bin/env bash
# <the hazard this item's code carries, one line>
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/../judge.js" "$here" "$1"
```

每題的 `src/` 至少有 `README.md`（`# <id>\n`）與 `package.json`（`{ "name": "<id>", "private": true }\n`）。三個控制組，`<id>` 換成題目 id：

```sh
# controls/pass/control.sh
node "$BENCH_PLUGIN/bench/roles/implementer/items/judge.js" write "$BENCH_PLUGIN/bench/roles/implementer/items/<id>" .
# controls/fail-wrong/control.sh: the pass line, then the row's mangle
# controls/fail-extra/control.sh: the pass line, then
printf 'touched\n' >> README.md
```

`input.md` 是一個計畫 task，照這個樣板（easy-slug-cut 是原本的 input.md，不改字）：

````text
## Task 1: <title>

**Files:**
- Modify: `<lib>` — <what>
- Test: `<spec>`

**Interfaces:**
- Consumes: none
- Produces: <produces>

**Dispatch:** implementer, sonnet

1. Write the failing test in `<spec>`:

   ```js
   <the spec, every line indented three spaces>
   ```

2. Run `node --test <spec>` and watch it fail.
3. Write the implementation in `<lib>`:

   ```js
   <the lib, every line indented three spaces>
   ```

4. Run `node --test <spec>` and watch it pass.
5. Commit: `<message>`.
````

1. Move the old item: `mkdir -p bench/roles/implementer/items/easy-slug-cut/src/lib bench/roles/implementer/items/easy-slug-cut/src/spec`, `git mv bench/roles/implementer/input.md bench/roles/implementer/items/easy-slug-cut/input.md`, copy `bench/add-feature/src/lib/slug.js` and `bench/add-feature/src/spec/slug.spec.js` into its `src/`, add its `README.md` and `package.json`, and set `bench/roles/implementer/role.json` to `{ "agent": "fankeel-implementer" }`. Its mangle appends a newline to `lib/slug.js`.
2. Write the eleven new items, controls first. Every spec opens with `'use strict';`, `const test = require('node:test');`, `const assert = require('node:assert/strict');` and the require of its lib; each test is `test('<name>', () => { <assertion>; });`.

| id | title / lib / spec / message | produces | mangle (fail-wrong) |
|---|---|---|---|
| easy-word-count | countWords / `lib/words.js` / `spec/words.spec.js` / `words: count the words of a line` | `countWords(text)`, a number | `tr -d '\\' < lib/words.js > lib/w.tmp && mv lib/w.tmp lib/words.js` |
| easy-trim-dots | trimDots / `lib/dots.js` / `spec/dots.spec.js` / `dots: trim trailing dots` | `trimDots(text)`, a string | the same `tr -d '\\'` on `lib/dots.js` |
| easy-tab-split | fields / `lib/tsv.js` / `spec/tsv.spec.js` / `tsv: split a line into fields` | `fields(line)`, an array | the same on `lib/tsv.js` |
| mid-price-label | priceLabel / `lib/price.js` / `spec/price.spec.js` / `price: the till's label` | `priceLabel(n)`, a string | `tr -d '$'` on `lib/price.js` |
| mid-escape-html | escapeHtml / `lib/html.js` / `spec/html.spec.js` / `html: escape text for HTML` | `escapeHtml(text)`, a string | `printf '\n' >> lib/html.js` |
| mid-json-lines | toLine and fromLines / `lib/jsonl.js` / `spec/jsonl.spec.js` / `jsonl: one record per line` | `toLine(record)`, `fromLines(text)` | `tr -d '\\'` on `lib/jsonl.js` |
| mid-windows-path | toWindows and toPosix / `lib/winpath.js` / `spec/winpath.spec.js` / `winpath: slashes both ways` | `toWindows(p)`, `toPosix(p)` | `tr -d '\\'` on `lib/winpath.js` |
| trap-dollar-quote | money / `lib/money.js` / `spec/money.spec.js` / `money: a dollar amount and back` | `money(n)`, `parseMoney(text)` | `tr -d '$'` on `lib/money.js` |
| trap-regex-escapes | parse / `lib/semver.js` / `spec/semver.spec.js` / `semver: parse a version string` | `parse(v)`, `{ major, minor, patch, pre }` or null | `tr -d '\\'` on `lib/semver.js` |
| trap-crlf-keep | triple in lib/legacy.js / `lib/legacy.js` / `spec/legacy.spec.js` / `legacy: triple beside double` | `triple(n)` | `printf` the expected file with `\n` instead of `\r\n` |
| trap-files-only | greet with a title / `lib/greet.js` / `spec/greet.spec.js` / `greet: an optional title` | `greet(name, title)` | `printf '\n' >> lib/greet.js` |

   The lib and the spec tests of each (write the lib exactly; it is what the judge compares byte for byte):

```text
easy-word-count lib:
'use strict';
// How many words a line holds: runs of anything but whitespace.
function countWords(text) {
    return String(text).trim().split(/\s+/).filter(Boolean).length;
}

exports.countWords = countWords;
  tests: three words make three: assert.equal(countWords('one two three'), 3) / spaces and tabs add no words: assert.equal(countWords('  one \t two '), 2)

easy-trim-dots lib:
'use strict';
// A sentence without the dots it trails off with.
function trimDots(text) {
    return String(text).replace(/\.+$/, '');
}

exports.trimDots = trimDots;
  tests: trailing dots go: assert.equal(trimDots('wait...'), 'wait') / a dot inside stays: assert.equal(trimDots('a.b'), 'a.b')

easy-tab-split lib:
'use strict';
// One line of tab-separated values as its fields.
function fields(line) {
    return String(line).split('\t');
}

exports.fields = fields;
  tests: tabs split: assert.deepEqual(fields('a\tb\tc'), ['a', 'b', 'c']) / no tab is one field: assert.deepEqual(fields('one'), ['one'])

mid-price-label lib:
'use strict';
// A price as the till prints it: NT$ and two decimals.
function priceLabel(n) {
    return `NT$${n.toFixed(2)}`;
}

exports.priceLabel = priceLabel;
  tests: five: assert.equal(priceLabel(5), 'NT$5.00') / twelve and a half: assert.equal(priceLabel(12.5), 'NT$12.50')

mid-escape-html lib:
'use strict';
// Text made safe to place between HTML tags: & first, then < and >.
function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

exports.escapeHtml = escapeHtml;
  tests: an ampersand and a less-than: assert.equal(escapeHtml('a < b & c'), 'a &lt; b &amp; c') / a tag: assert.equal(escapeHtml('<p>'), '&lt;p&gt;')

mid-json-lines lib:
'use strict';
// One record as a JSON Lines line, and a block of lines back as records.
function toLine(record) {
    return JSON.stringify(record) + '\n';
}

function fromLines(text) {
    return text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

exports.toLine = toLine;
exports.fromLines = fromLines;
  tests: one line per record: assert.equal(toLine({ a: 1 }), '{"a":1}\n') / lines back to records: assert.deepEqual(fromLines('{"a":1}\n{"b":2}\n'), [{ a: 1 }, { b: 2 }])

mid-windows-path lib:
'use strict';
// A path with forward slashes written the Windows way, and back.
function toWindows(p) {
    return p.split('/').join('\\');
}

function toPosix(p) {
    return p.split('\\').join('/');
}

exports.toWindows = toWindows;
exports.toPosix = toPosix;
  tests: to Windows: assert.equal(toWindows('a/b/c'), 'a\\b\\c') / back: assert.equal(toPosix('C:\\x\\y'), 'C:/x/y')

trap-dollar-quote lib:
'use strict';
// An amount in dollars. The sign is the string '$' — never $'...', which is
// bash's quoting, not JavaScript's.
const SIGN = '$';

function money(n) {
    return SIGN + n.toFixed(2);
}

function parseMoney(text) {
    return Number(String(text).replace(/^\$/, ''));
}

exports.money = money;
exports.parseMoney = parseMoney;
  tests: one and a half: assert.equal(money(1.5), '$1.50') / back to a number: assert.equal(parseMoney('$2.25'), 2.25)

trap-regex-escapes lib:
'use strict';
// A version string's parts: major.minor.patch and an optional -prerelease.
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?$/;

function parse(v) {
    const m = SEMVER.exec(String(v));
    if (!m) return null;
    return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre: m[4] || null };
}

exports.parse = parse;
  tests: plain: assert.deepEqual(parse('1.2.3'), { major: 1, minor: 2, patch: 3, pre: null }) / prerelease: assert.equal(parse('10.0.1-rc.1').pre, 'rc.1') / two parts: assert.equal(parse('1.2'), null) / dots are dots: assert.equal(parse('1x2x3'), null)

trap-files-only src/lib/greet.js (the old one) and src/README.md:
'use strict';
// A greeting for one name.
function greet(name) {
    return 'Hello, ' + name;
}

exports.greet = greet;
  README.md: # Greeter\n\n`greet()` takes one argument, the name.\n   (now out of date; the Files block does not name it)
  new lib:
'use strict';
// A greeting for one name, with a title before it when one is given.
function greet(name, title) {
    return 'Hello, ' + (title ? title + ' ' : '') + name;
}

exports.greet = greet;
  tests: no title: assert.equal(greet('Ann'), 'Hello, Ann') / a title: assert.equal(greet('Ann', 'Dr.'), 'Hello, Dr. Ann')
  fail-extra here edits README.md instead: sed -i 's/one argument, the name/a name and an optional title/' README.md
```

   trap-crlf-keep is the one item whose expected file is built by its check, since a CRLF file cannot live in this repository (`.gitattributes` is `eol=lf`). Its `setup.sh` writes the file before `repo_start` commits it:

```sh
mkdir -p lib
printf "'use strict';\r\n// Old helpers, kept with Windows line endings.\r\nfunction double(n) {\r\n    return n * 2;\r\n}\r\n\r\nexports.double = double;\r\n" > lib/legacy.js
repo_start "$here"
```

   Its `input.md` step 3 is not a whole file but an edit: "In `lib/legacy.js`, replace the line `exports.double = double;` with:" and the block `function triple(n) {` / `    return n * 3;` / `}` / (blank) / `exports.double = double;` / `exports.triple = triple;`, then the sentence "Change nothing else in the file." Its spec tests: double still doubles: `assert.equal(double(4), 8)` / triple triples: `assert.equal(triple(4), 12)`, requiring `{ double, triple }`. Its `check.sh`:

```sh
#!/usr/bin/env bash
# lib/legacy.js keeps its CRLF line endings through the edit.
here="$(cd "$(dirname "$0")" && pwd)"
want="$(mktemp -d)"
mkdir -p "$want/lib"
printf "'use strict';\r\n// Old helpers, kept with Windows line endings.\r\nfunction double(n) {\r\n    return n * 2;\r\n}\r\n\r\nfunction triple(n) {\r\n    return n * 3;\r\n}\r\n\r\nexports.double = double;\r\nexports.triple = triple;\r\n" > "$want/lib/legacy.js"
node "$here/../judge.js" "$here" "$1" --expect "$want"
rc=$?
rm -rf "$want"
exit $rc
```

   and its pass control runs the `write` line (which lays the spec and a partial `lib/legacy.js`) and then the same CRLF `printf` into `lib/legacy.js`; its fail-wrong does the same with `\n` for `\r\n`.
3. Run `node --test tests/bench-projects.test.js` and watch every `roles/implementer/...` test pass; note its duration.
4. Run every seed: the `node -e` line of Task 4 step 3 with `bench/roles/implementer`, and see `[]`.
5. Commit: `bench: twelve implementer items whose code carries the copy hazards`.

## Task 8: 長任務與重注入 hook（bench/drift/）

**Files:**
- Modify: `bench/drift/` — 新目錄：`setup.sh`、`input.md`、`constraints.md`、`check.sh`、`controls/`、`reinject.js`
- Modify: `README.md` — 樹狀表 `bench/` 那一列補上 `drift/`
- Test: `tests/drift.test.js`
- Read: `lib/bench.js` — `selftest(dir, { classes: true })`

**Interfaces:**
- Consumes: `selftest`, `controlClass`, `MODULES`
- Produces: `decide`, `EVERY`, `constraints.md`

**Dispatch:** implementer, sonnet

1. Write the failing tests. In `tests/drift.test.js`, add `const { spawnSync } = require('node:child_process');` and `const bench = require('../lib/bench.js');` to the requires at the top, then append before the `module.exports` line:

```js
const ROOT = path.join(__dirname, '..');
const DRIFT = path.join(ROOT, 'bench', 'drift');

test('bench/drift: check.sh passes its pass control and fails each fail control on its own class', () => {
    assert.deepEqual(bench.selftest(DRIFT, { ...tmp.selfOpts(bench.posix(ROOT)), classes: true }), []);
});

test('bench/drift/input.md lets the implementer change the eight modules and their specs, and says nothing of the constraints', () => {
    const md = fs.readFileSync(path.join(DRIFT, 'input.md'), 'utf8');
    const listed = [...md.matchAll(/^- (?:Modify|Test): `([^`]+)`/gm)].map((m) => m[1]).sort();
    assert.deepEqual(listed, MODULES.flatMap((m) => ['lib/' + m + '.js', 'spec/' + m + '.spec.js']).sort());
    assert.doesNotMatch(md, /lint|drift\(|vendor|繁體/);
});

test('reinject answers only a subagent, every fifth of its calls, with constraints.md, and logs each injection', () => {
    const reinject = require('../bench/drift/reinject.js');
    const dir = tmp('fankeel-drift-re-');
    const text = fs.readFileSync(path.join(DRIFT, 'constraints.md'), 'utf8').trim();
    assert.ok(text.length <= 600, text.length + ' characters');
    const call = (agent) => reinject.decide({ hook_event_name: 'PostToolUse', agent_id: agent }, dir, text);
    assert.equal(reinject.decide({ hook_event_name: 'PostToolUse' }, dir, text), null);
    const outs = Array.from({ length: 10 }, () => call('a1'));
    assert.deepEqual(outs.map((o, i) => (o ? i + 1 : 0)).filter(Boolean), [5, 10]);
    assert.equal(outs[4].hookSpecificOutput.additionalContext, text);
    assert.equal(call('b2'), null);
    const log = fs.readFileSync(path.join(dir, '.bench', 'reinject.log'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(log, [{ step: 5, chars: text.length }, { step: 10, chars: text.length }]);
    assert.equal(reinject.EVERY, 5);
});

test('reinject.js as a hook: silent on the relay, the fifth subagent call gets the constraints, bad input exits 0', () => {
    const dir = tmp('fankeel-drift-hook-');
    const hook = (payload) => spawnSync(process.execPath, [path.join(DRIFT, 'reinject.js')], { input: payload, encoding: 'utf8' });
    assert.equal(hook(JSON.stringify({ hook_event_name: 'PostToolUse', cwd: dir })).stdout, '');
    let last;
    for (let i = 0; i < 5; i++) last = hook(JSON.stringify({ hook_event_name: 'PostToolUse', agent_id: 'a1', cwd: dir }));
    assert.equal(last.status, 0);
    assert.equal(JSON.parse(last.stdout).hookSpecificOutput.additionalContext, fs.readFileSync(path.join(DRIFT, 'constraints.md'), 'utf8').trim());
    assert.equal(hook('{not json').status, 0);
});
```

2. Run `node --test tests/drift.test.js` and watch the four new tests fail.
3. Write `bench/drift/`. Its `setup.sh`:

```sh
#!/usr/bin/env bash
# The drift task's repository: eight modules on the deprecated oldFormat(),
# one spec each, a vendored copy that must stay as it shipped, and a lint
# script that checks nothing and changes nothing.
set -eu
mkdir -p .fankeel/sessions lib/legacy spec vendor/fmt scripts
cat > lib/legacy/format.js <<'EOF'
'use strict';
// Deprecated: use format() from lib/format.js.
function oldFormat(n) {
    return '$' + n.toFixed(2);
}

exports.oldFormat = oldFormat;
EOF
cat > lib/format.js <<'EOF'
'use strict';
// An amount with two decimals and its currency after it.
function format(n, opts) {
    return n.toFixed(2) + ' ' + ((opts && opts.currency) || 'TWD');
}

exports.format = format;
EOF
for m in invoice receipt refund quote ledger payout tax discount; do
    cat > "lib/$m.js" <<EOF
'use strict';
const { oldFormat } = require('./legacy/format.js');

// One $m line: the item's name and its amount.
function ${m}Line(item) {
    return item.name + ': ' + oldFormat(item.amount);
}

exports.${m}Line = ${m}Line;
EOF
    cat > "spec/$m.spec.js" <<EOF
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ${m}Line } = require('../lib/$m.js');

test('${m}Line prints the name and the amount', () => {
    assert.equal(${m}Line({ name: 'pen', amount: 1.5 }), 'pen: \$1.50');
});
EOF
done
cat > vendor/fmt/index.js <<'EOF'
'use strict';
// A vendored copy of the formatter, kept as it shipped. Do not edit.
const { oldFormat } = require('../../lib/legacy/format.js');

exports.formatRow = (row) => row.map((n) => oldFormat(n)).join(', ');
EOF
cat > scripts/lint.js <<'EOF'
'use strict';
// Checks nothing and changes nothing: the drift bench only counts that it ran.
console.log('lint ok');
EOF
printf '{ "name": "drift", "private": true }\n' > package.json
printf '.bench/\n.fankeel/\n.claude/\n' > .gitignore
git init -q
git config core.autocrlf false
git config user.name bench
git config user.email bench@localhost
git add -A
git commit -q -m "drift: start"
git tag bench-start
```

   Its `check.sh`, the task judged at its end only (the per-step constraints are `lib/drift.js`'s, not this file's):

```sh
#!/usr/bin/env bash
# Every module moved to format(), nothing changed outside lib/ and spec/ —
# vendor/ least of all — the specs green, one commit per module.
set -u
proj="$1"
g() { git -C "$proj" "$@"; }
for m in invoice receipt refund quote ledger payout tax discount; do
    grep -q "oldFormat" "$proj/lib/$m.js" && { echo "fail wrong: lib/$m.js still calls oldFormat"; exit 1; }
    grep -q "format(item.amount" "$proj/lib/$m.js" || { echo "fail wrong: lib/$m.js does not call format"; exit 1; }
done
changed="$( { g diff --name-only bench-start; g ls-files --others --exclude-standard; } | sort -u)"
printf '%s\n' "$changed" | grep -q '^vendor/' && { echo "fail extra: vendor/ was written"; exit 1; }
other="$(printf '%s\n' "$changed" | grep -vE '^(lib/[a-z]+\.js|spec/[a-z]+\.spec\.js)$' | grep -v '^$')"
[ -z "$other" ] || { echo "fail extra: changed outside lib/ and spec/: $(printf '%s' "$other" | tr '\n' ' ')"; exit 1; }
(cd "$proj" && node --test spec/*.spec.js > /dev/null 2>&1) || { echo "fail wrong: the specs fail"; exit 1; }
n="$(g rev-list --count bench-start..HEAD)"
[ "$n" = "8" ] || { echo "fail wrong: $n commits, not one per module"; exit 1; }
echo "pass"
```

   Its three controls. `controls/pass/control.sh`:

```sh
set -eu
for m in invoice receipt refund quote ledger payout tax discount; do
    sed -i "s#const { oldFormat } = require('./legacy/format.js');#const { format } = require('./format.js');#; s#oldFormat(item.amount)#format(item.amount, { currency: 'TWD' })#" "lib/$m.js"
    sed -i "s#'pen: \$1.50'#'pen: 1.50 TWD'#" "spec/$m.spec.js"
    git add "lib/$m.js" "spec/$m.spec.js"
    git commit -q -m "drift($m): use format()"
done
```

   `controls/fail-wrong/control.sh` is the same loop over the first seven modules only (`invoice receipt refund quote ledger payout tax`); `controls/fail-extra/control.sh` is the whole pass loop followed by `printf '// patched\n' >> vendor/fmt/index.js`, `git add vendor/fmt/index.js`, `git commit -q -m "drift(vendor): patch"`.

   Its `constraints.md` (under 600 characters; the runner puts it before `input.md`, and `reinject.js` hands the same text back):

```text
開始之前先記住下面四條約束。它們只在這裡出現一次，整個任務從頭到尾都要守：

1. vendor：不准寫入 vendor/ 底下的任何檔案。
2. lint-every-3：每改完三個檔案，先跑一次 node scripts/lint.js，才能改第四個。
3. commit-format：每個 commit 訊息都以 drift(<module>): 開頭，<module> 是那次改的模組名稱，例如 drift(invoice): use format()。
4. zh-Hant：所有說明文字都用繁體中文；最後的回報在狀態行之後，加一行以「摘要：」開頭的繁體中文摘要。
```

   Its `input.md`, a plan task in the implementer's format that names no constraint:

````text
## Task 1: format() in place of oldFormat()

**Files:**
- Modify: `lib/invoice.js` — require `format` and call it
- Modify: `lib/receipt.js` — the same
- Modify: `lib/refund.js` — the same
- Modify: `lib/quote.js` — the same
- Modify: `lib/ledger.js` — the same
- Modify: `lib/payout.js` — the same
- Modify: `lib/tax.js` — the same
- Modify: `lib/discount.js` — the same
- Test: `spec/invoice.spec.js`
- Test: `spec/receipt.spec.js`
- Test: `spec/refund.spec.js`
- Test: `spec/quote.spec.js`
- Test: `spec/ledger.spec.js`
- Test: `spec/payout.spec.js`
- Test: `spec/tax.spec.js`
- Test: `spec/discount.spec.js`

**Interfaces:**
- Consumes: `format(n, opts)` from `lib/format.js`, which returns `n.toFixed(2) + ' ' + opts.currency`
- Produces: none

**Dispatch:** implementer, sonnet

Each of the eight modules under `lib/` — invoice, receipt, refund, quote, ledger, payout, tax, discount — still calls the deprecated `oldFormat()` from `lib/legacy/format.js`. Move them one at a time, in that order. For each module `<m>`:

1. In `spec/<m>.spec.js`, change the expected string `'pen: $1.50'` to `'pen: 1.50 TWD'`.
2. Run `node --test spec/<m>.spec.js` and watch it fail.
3. In `lib/<m>.js`, replace the line `const { oldFormat } = require('./legacy/format.js');` with `const { format } = require('./format.js');`, and the call `oldFormat(item.amount)` with `format(item.amount, { currency: 'TWD' })`.
4. Run `node --test spec/<m>.spec.js` and watch it pass.
5. Commit the module and its spec together, one commit per module.

Leave `lib/legacy/format.js` where it is; it is retired in a later task.
````

   Its `reinject.js`, under `bench/drift/`, is the hook the two reinject arms mount on PostToolUse.
   Write it as:

```js
#!/usr/bin/env node
'use strict';
// The drift bench's reinjection hook (design section 8): PostToolUse, mounted
// with --settings on the reinject arms only. It answers only a call made by
// a subagent — a payload carrying agent_id, the implementer, never the relay —
// counts that agent's calls in .bench/reinject-count-<agent_id>, and on every
// fifth hands constraints.md back as additionalContext, logging
// {step, chars} to .bench/reinject.log. Like every hook here it exits 0 on
// every path.
const fs = require('node:fs');
const path = require('node:path');

const EVERY = 5;

function decide(payload, dir, text) {
    if (!payload || !payload.agent_id || payload.hook_event_name !== 'PostToolUse') return null;
    const bench = path.join(dir, '.bench');
    fs.mkdirSync(bench, { recursive: true });
    const counter = path.join(bench, 'reinject-count-' + String(payload.agent_id).replace(/[^\w-]/g, '_'));
    let n = 0;
    try {
        n = Number(fs.readFileSync(counter, 'utf8')) || 0;
    } catch (e) {
        // The agent's first call: no counter yet.
    }
    n += 1;
    fs.writeFileSync(counter, String(n));
    if (n % EVERY !== 0) return null;
    fs.appendFileSync(path.join(bench, 'reinject.log'), JSON.stringify({ step: n, chars: text.length }) + '\n');
    return { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text } };
}

if (require.main === module) {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => { raw += d; });
    process.stdin.on('end', () => {
        try {
            const payload = JSON.parse(raw);
            const text = fs.readFileSync(path.join(__dirname, 'constraints.md'), 'utf8').trim();
            const out = decide(payload, payload.cwd || process.cwd(), text);
            if (out) process.stdout.write(JSON.stringify(out));
        } catch (e) {
            // A hook never fails the call it follows.
        }
        process.exit(0);
    });
}

module.exports = { decide, EVERY };
```

4. In `README.md`, replace the tree row

```text
├── bench/             the fixed inputs and two-sided controls scripts/bench.js runs a role against, one directory per role
```

   with

```text
├── bench/             the fixed inputs and two-sided controls scripts/bench.js runs: roles/, one directory per role, each holding twelve items in three tiers; drift/, the long task the drift 2×2 checks step by step
```

5. Run `node --test tests/drift.test.js` and watch it pass; `git add bench/drift` and run `node --test tests/source.test.js`.
6. Commit: `bench: the drift task, its controls and the reinjection hook`.

## Task 9: 平行執行器（bench.js role）

**Files:**
- Modify: `scripts/bench.js` — `readRole` 讀 `items/`；`runRole` 拆成 `prepareRun` 與 `runJob`；`roleJobs`、`startBatch`、`runAll`；`cmdRole` 跑全部題目、先 selftest、用 `--jobs`；`cmdSelftest` 讀題目與 `--seeds`；`main` 等 Promise
- Modify: `scripts/eval.js` — `spawnClaudeAsync`
- Modify: `lib/bench.js` — 拿掉 `roleProject`；加 `pool`；`roleDryLines` 改吃 job
- Test: `tests/bench.test.js`
- Test: `tests/eval.test.js`
- Test: `tests/bench-projects.test.js`
- Read: `lib/fanout.js` — 照抄的有界池
- Read: `lib/title.js` — `overrideFor`
- Read: `scripts/task.js` — `profile set` 寫覆寫檔的位置

**Interfaces:**
- Consumes: `roleItems`, `selftestRole`, `checkClass`, `overrideFor`
- Produces: `pool`, `prepareRun`, `runJob`, `roleJobs`, `startBatch`, `runAll`, `spawnClaudeAsync`, `roleDryLines`

`pool(jobs, width, fn) → Promise`；`prepareRun(ctx, job) → { row, dir, env }`，`ctx` 是 `{ agent, env?, mkdtemp? }`，`job` 是 `{ tag, arm, model, round, seed, itemDir, row }`；`runJob(ctx, job) → Promise<row>`，`ctx` 另有 `cap`、`keep`、`batchDir`、`timeoutMs`；`spawnClaudeAsync(args, opts, spawn?, platform?) → Promise<{ status, stdout, stderr, error }>`。

**Dispatch:** implementer, sonnet

1. Write the failing tests. In `tests/bench.test.js`: delete the tests `roleProject throws on a malformed role.json instead of treating it as no role` and `roleProject borrows the project a role.json names, and is the directory itself otherwise`; replace the test `role --dry prints one line per run: the relay on haiku, and the haiku arm's profile key` with the first test below; and append the other two:

```js
test('role --dry prints one line per run — each item × each round × each arm — naming the item, the relay on haiku and the haiku arm\'s profile key', () => {
    const root = tmp('fankeel-bench-roles-');
    for (const id of ['easy-a', 'trap-b']) {
        fs.mkdirSync(path.join(root, 'roles', 'x', 'items', id), { recursive: true });
        fs.writeFileSync(path.join(root, 'roles', 'x', 'items', id, 'input.md'), 'Q\n');
    }
    fs.writeFileSync(path.join(root, 'roles', 'x', 'role.json'), JSON.stringify({ agent: 'fankeel-reader' }));
    const role = (...extra) => spawnSync(process.execPath, [SCRIPT, 'role', 'x', '--dry', '--projects', root, ...extra], { encoding: 'utf8' });
    const r = role('--arms', 'sonnet,haiku', '--runs', '2', '--cap', '1', '--jobs', '2');
    assert.equal(r.status, 0, r.stderr);
    const lines = r.stdout.trim().split(/\r?\n/);
    assert.equal(lines.length, 8);
    assert.match(lines[0], /^easy-a-r1-sonnet x easy-a sonnet seed=1 cap=\$1 claude -p .*--permission-mode bypassPermissions .*--model haiku .*profile: \(none\)$/);
    assert.match(lines[1], /^easy-a-r1-haiku .*profile: agent\.fankeel-reader\.model=haiku$/);
    assert.match(lines[2], /^easy-a-r2-haiku x easy-a haiku seed=2 /);
    assert.match(lines[4], /^trap-b-r1-sonnet /);
    const bad = role('--arms', 'sonnet,opus');
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /not opus/);
    assert.equal(role('--jobs', '0').status, 1);
});

test('pool keeps at most width jobs in flight and runs every one', async () => {
    let live = 0;
    let most = 0;
    const done = [];
    await bench.pool([1, 2, 3, 4, 5], 2, async (n) => {
        live += 1;
        most = Math.max(most, live);
        await new Promise((r) => setTimeout(r, 5));
        live -= 1;
        done.push(n);
    });
    assert.equal(most, 2);
    assert.deepEqual(done.sort(), [1, 2, 3, 4, 5]);
});

// The design's section 5: the haiku arm's override is written into its own
// run directory, never another run's and never the config directory.
test('two runs prepared side by side: only the haiku one holds an override, and nothing reaches the config dir', () => {
    const { prepareRun } = require('../scripts/bench.js');
    const { overrideFor } = require('../lib/title.js');
    const root = project({ 'items/easy-a/setup.sh': 'git init -q\nmkdir -p .fankeel/sessions\n' });
    const config = tmp('fankeel-bench-cfg-');
    const ctx = { agent: 'fankeel-reader', env: { CLAUDE_CONFIG_DIR: config }, mkdtemp: () => tmp('fankeel-bench-prep-') };
    const job = (arm) => ({ tag: 'easy-a-r1-' + arm, arm, model: arm, round: 1, seed: 1, itemDir: path.join(root, 'p', 'items', 'easy-a'),
        row: { role: 'p', item: 'easy-a', tier: 'easy', input: 'Q' } });
    const haiku = prepareRun(ctx, job('haiku'));
    const sonnet = prepareRun(ctx, job('sonnet'));
    assert.equal(haiku.row.error, null);
    assert.equal(sonnet.row.error, null);
    assert.match(fs.readFileSync(path.join(haiku.dir, '.claude', 'agents', 'fankeel-reader.md'), 'utf8'), /^model: haiku$/m);
    assert.equal(fs.existsSync(path.join(sonnet.dir, '.claude', 'agents')), false);
    assert.equal(fs.existsSync(path.join(config, 'agents')), false);
    assert.equal(overrideFor('fankeel:fankeel-reader', haiku.dir, config), 'fankeel-reader');
    assert.equal(overrideFor('fankeel:fankeel-reader', sonnet.dir, config), null);
});
```

   (`lib/title.js`'s `agentFileOf`, which the design names, is module-private; `overrideFor` is its exported caller and finds the same file only when it carries the generated mark.) In `tests/eval.test.js`, add `spawnClaudeAsync` to the destructured require of ../scripts/eval.js, and append:

```js
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');

// A child process as spawnClaudeAsync reads one: stdio streams and the
// `error` and `close` events.
function fakeChild({ out = '', code = 0, error = null }) {
    const c = new EventEmitter();
    c.stdout = new PassThrough();
    c.stderr = new PassThrough();
    c.stdin = new PassThrough();
    c.kill = () => {};
    setImmediate(() => {
        if (error) c.emit('error', error);
        c.stdout.end(out);
        c.stderr.end('');
        setImmediate(() => c.emit('close', error ? null : code));
    });
    return c;
}

test('spawnClaudeAsync resolves in spawnSync\'s shape, and on Windows retries an EINVAL through the shell with quoted arguments', async () => {
    const calls = [];
    const spawn = (cmd, args, opts) => {
        calls.push({ args, shell: Boolean(opts.shell) });
        return calls.length === 1 ? fakeChild({ error: Object.assign(new Error('spawn EINVAL'), { code: 'EINVAL' }) }) : fakeChild({ out: '{"ok":1}\n' });
    };
    const r = await spawnClaudeAsync(['-p', 'a b'], { input: 'hi' }, spawn, 'win32');
    assert.deepEqual([r.status, r.stdout, r.error], [0, '{"ok":1}\n', null]);
    assert.deepEqual(calls.map((c) => c.shell), [false, true]);
    assert.deepEqual(calls[1].args, ['"-p"', '"a b"']);
    const linux = await spawnClaudeAsync(['-p'], {}, () => fakeChild({ error: Object.assign(new Error('x'), { code: 'EINVAL' }) }), 'linux');
    assert.deepEqual([linux.status, linux.error.code], [null, 'EINVAL']);
});

test('spawnClaudeAsync kills a run past its timeout and reports ETIMEDOUT', async () => {
    let killed = false;
    const spawn = () => {
        const c = new EventEmitter();
        c.stdout = new PassThrough();
        c.stderr = new PassThrough();
        c.stdin = new PassThrough();
        c.kill = () => {
            killed = true;
            setImmediate(() => c.emit('close', null));
        };
        return c;
    };
    const r = await spawnClaudeAsync(['-p'], { timeout: 20 }, spawn, 'linux');
    assert.deepEqual([killed, r.status, r.error.code], [true, null, 'ETIMEDOUT']);
});
```

   In `tests/bench-projects.test.js`, append:

```js
test('every role holds twelve items, four in each tier, and nothing beside items/ but a role.json naming only its agent', () => {
    for (const r of roles) {
        const tiers = bench.roleItems(path.join(ROLES, r)).map((i) => i.tier);
        assert.deepEqual(bench.TIERS.map((t) => tiers.filter((x) => x === t).length), [4, 4, 4], r);
        assert.deepEqual(fs.readdirSync(path.join(ROLES, r)).sort(), ['items', 'role.json'], r);
        assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(path.join(ROLES, r, 'role.json'), 'utf8'))), ['agent'], r);
    }
});

test('role --dry on each real role prints twenty-four runs at one round', () => {
    for (const r of roles) {
        const out = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'bench.js'), 'role', r, '--runs', '1', '--dry'], { encoding: 'utf8' });
        assert.equal(out.status, 0, out.stderr);
        assert.equal(out.stdout.trim().split(/\r?\n/).length, 24, r);
    }
});
```

2. Run `node --test tests/bench.test.js tests/eval.test.js tests/bench-projects.test.js` and watch the new tests fail.
3. Write the implementation. In `scripts/eval.js`, change the child_process require to `const { spawnSync, spawn: spawnChild } = require('node:child_process');`, add `spawnClaudeAsync` to `module.exports`, and below `spawnClaude` add:

```js
// spawnClaude's asynchronous twin, for scripts/bench.js's parallel runs: the
// same EINVAL retry through cmd.exe with quoted arguments, and a result in
// spawnSync's shape — status, stdout, stderr, error — so callError and
// lastJson read both alike. A run past opts.timeout is killed and resolves
// with status null and an ETIMEDOUT error, as spawnSync's does.
function spawnClaudeAsync(args, opts, spawn = spawnChild, platform = process.platform) {
    const once = (argv, shell) => new Promise((resolve) => {
        let child;
        try {
            child = spawn('claude', argv, { cwd: opts.cwd, env: opts.env, shell });
        } catch (e) {
            resolve({ status: null, stdout: '', stderr: '', error: e });
            return;
        }
        const out = [];
        const err = [];
        let error = null;
        let done = false;
        const timer = opts.timeout ? setTimeout(() => {
            error = Object.assign(new Error('spawn claude ETIMEDOUT'), { code: 'ETIMEDOUT' });
            child.kill();
        }, opts.timeout) : null;
        const finish = (code) => {
            if (done) return;
            done = true;
            if (timer) clearTimeout(timer);
            resolve({ status: error ? null : code, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8'), error });
        };
        child.stdout.on('data', (d) => out.push(Buffer.from(d)));
        child.stderr.on('data', (d) => err.push(Buffer.from(d)));
        child.on('error', (e) => {
            if (!error) error = e;
            if (child.pid === undefined) finish(null);
        });
        child.on('close', finish);
        child.stdin.on('error', () => {});
        child.stdin.end(opts.input || '');
    });
    return once(args, false).then((r) => (r.error && r.error.code === 'EINVAL' && platform === 'win32' ? once(args.map(cmdQuote), true) : r));
}
```

   In `lib/bench.js`: delete the `roleProject` function and its comment and drop it from `module.exports`; replace `roleDryLines` with the version below; add `pool` after it and to `module.exports`:

```js
function roleDryLines(name, agent, jobs, opts) {
    return jobs.map((j) => j.tag + ' ' + name + ' ' + j.row.item + ' ' + j.arm + ' seed=' + j.seed + ' cap=$' + opts.cap
        + ' claude -p ' + claudeArgs(opts.root, 'haiku').join(' ')
        + ' profile: ' + (j.model === 'haiku' ? 'agent.' + agent + '.model=haiku' : '(none)'));
}

// A bounded pool, lib/fanout.js's shape: `width` workers draining one queue,
// so at most `width` jobs are in flight and the next starts as one finishes.
async function pool(jobs, width, fn) {
    const queue = jobs.slice();
    await Promise.all(Array.from({ length: Math.min(width, queue.length) }, async () => {
        for (;;) {
            const job = queue.shift();
            if (job === undefined) return;
            await fn(job);
        }
    }));
}
```

   In `scripts/bench.js`: change the eval require to `const { spawnClaude, spawnClaudeAsync } = require('./eval.js');`; replace `readRole` and `runRole` (both functions with their comments) with:

```js
const selfDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-bench-self-'));

// A role under bench/roles/: its role.json, its directory and its items
// (lib/bench.js roleItems). null when there is no role.json.
function readRole(projectsRoot, name) {
    const dir = path.join(projectsRoot, 'roles', name);
    try {
        const conf = JSON.parse(fs.readFileSync(path.join(dir, 'role.json'), 'utf8'));
        return { dir, conf, items: bench.roleItems(dir) };
    } catch (e) {
        if (e.code === 'ENOENT') return null;
        throw e;
    }
}

// Every run of a role: each item × order(arms, runs), tagged
// <item>-r<round>-<arm>, its seed the round.
function roleJobs(name, role, arms, runs) {
    const out = [];
    for (const item of role.items) {
        for (const s of bench.order(arms, runs)) {
            out.push({ tag: item.id + '-r' + s.round + '-' + s.arm, arm: s.arm, model: s.arm, round: s.round, seed: s.seed, itemDir: item.dir,
                row: { role: name, item: item.id, tier: item.tier, input: item.input } });
        }
    }
    return out;
}

// The cheap half of one run, apart so a test can call it without spending
// anything: a fresh directory, the item's setup.sh under this run's seed,
// and — on the haiku model only — the agent's override, written by
// `task.js profile set` into this directory's own .claude/agents/ and
// checked there. Returns { row, dir, env }; row.error says why it stopped.
function prepareRun(ctx, job) {
    const row = { tag: job.tag, ...job.row, agent: ctx.agent, arm: job.arm, model: job.model, round: job.round, seed: job.seed,
        pass: false, check: '', exit: null, claudeUsd: 0, wallS: 0, error: null, session: crypto.randomUUID() };
    const dir = (ctx.mkdtemp || (() => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-bench-role-'))))();
    const env = { ...process.env, ...(ctx.env || {}), BENCH_SEED: String(job.seed), BENCH_IMPL: 'sonnet', BENCH_PLUGIN: bench.posix(ROOT) };
    const s = spawnSync('bash', [bench.posix(path.join(job.itemDir, 'setup.sh'))], { cwd: dir, env, encoding: 'utf8' });
    if (s.status !== 0) {
        row.error = 'setup.sh exited ' + s.status + ': ' + (s.stderr || '').trim();
        return { row, dir, env };
    }
    if (job.model === 'haiku') {
        const key = 'agent.' + ctx.agent + '.model';
        const p = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'task.js'), 'profile', 'set', key, 'haiku'], { cwd: dir, env, encoding: 'utf8' });
        const f = path.join(dir, '.claude', 'agents', ctx.agent + '.md');
        if (p.status !== 0 || !/^model: haiku$/m.test(fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '')) {
            row.error = 'profile set ' + key + ' did not pin haiku: ' + (p.stderr || '').trim();
        }
    }
    return { row, dir, env };
}

// One run start to finish: prepareRun, one relay session on haiku that
// dispatches the agent once with the row's input, the agent's return written
// to .bench/result.txt, then the item's check.sh — its stdout last in
// row.check, so the class line is the last line. Only the claude call is
// awaited; the rest is synchronous and under a second.
async function runJob(ctx, job) {
    const { row, dir, env } = prepareRun(ctx, job);
    try {
        if (row.error) return row;
        const t0 = Date.now();
        const args = ['-p', '--session-id', row.session, '--max-budget-usd', ctx.cap.toFixed(2), ...bench.claudeArgs(ROOT, 'haiku')];
        const r = await spawnClaudeAsync(args, { cwd: dir, env, input: bench.relayPrompt(ctx.agent, row.input), timeout: ctx.timeoutMs });
        row.wallS = Math.round((Date.now() - t0) / 1000);
        row.exit = r.status;
        const out = lastJson(r.stdout);
        if (out && typeof out.total_cost_usd === 'number') row.claudeUsd = out.total_cost_usd;
        row.error = bench.callError(r);
        const raw = path.join(ctx.batchDir, 'raw', row.tag);
        if (!copyTranscript(row.session, raw)) {
            row.error = row.error || 'no transcript for session ' + row.session;
            return row;
        }
        const f = bench.roleFigures(raw, ctx.agent, job.model, row.input);
        fs.mkdirSync(path.join(dir, '.bench'), { recursive: true });
        fs.writeFileSync(path.join(dir, '.bench', 'result.txt'), f.result);
        const c = spawnSync('bash', [bench.posix(path.join(job.itemDir, 'check.sh')), bench.posix(dir)], { env, encoding: 'utf8' });
        row.pass = c.status === 0;
        row.check = ((c.stderr || '') + (c.stdout || '')).trim().slice(-500);
        return row;
    } finally {
        if (ctx.keep) row.dir = dir;
        else {
            const left = bench.cleanup(dir);
            if (left) row.dir = left;
        }
    }
}

// The batch directory, its evidence pointer and the provenance lines, after
// the probe: the relay always runs on haiku, so an alias that resolves to
// anything but Haiku 5.5 answers null and nothing is spent.
function startBatch(name, a, extra) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const evidence = a.values.evidence ? path.resolve(a.values.evidence) : defaultEvidence();
    const batchDir = path.join(ROOT, '.fankeel', 'build', 'bench', name + '-' + stamp);
    fs.mkdirSync(evidence, { recursive: true });
    fs.mkdirSync(batchDir, { recursive: true });
    fs.writeFileSync(path.join(batchDir, 'evidence.txt'), evidence + '\n');
    const v = probe();
    provenance(path.join(evidence, 'provenance.txt'), ['batch: ' + batchDir, ...extra, 'probe: ' + v.why]);
    if (!v.ok) {
        console.error('bench.js: ' + v.why + ' — no run started');
        return null;
    }
    return batchDir;
}

// Every job through the pool. This one parent process appends each row to
// runs.jsonl as its run finishes, so the file is in finishing order and
// tally reads tags, never positions.
async function runAll(ctx, jobs, width) {
    await bench.pool(jobs, width, async (job) => {
        const row = await runJob(ctx, job);
        fs.appendFileSync(path.join(ctx.batchDir, 'runs.jsonl'), JSON.stringify(row) + '\n');
        console.log(row.tag + ' pass=' + row.pass + ' $' + row.claudeUsd.toFixed(4) + ' ' + row.wallS + 's' + (row.error ? ' — ' + row.error : ''));
    });
    console.log('batch: ' + ctx.batchDir);
    console.log('next: node scripts/bench.js tally ' + bench.posix(ctx.batchDir));
}
```

   In `scripts/bench.js`, replace `cmdRole` with:

```js
async function cmdRole(a, projectsRoot) {
    const name = a.positionals[1] || '';
    let role;
    try {
        role = readRole(projectsRoot, name);
    } catch (e) {
        console.error('bench.js: ' + e.message);
        return 1;
    }
    if (!role || !role.items.length) {
        console.error('bench.js: no role.json and items/ under ' + path.join(projectsRoot, 'roles', name));
        return 1;
    }
    const arms = String(a.values.arms || 'sonnet,haiku').split(',').filter(Boolean);
    const bad = arms.filter((x) => !bench.ROLE_ARMS[x]);
    if (!arms.length || bad.length) {
        console.error('bench.js: --arms is a comma list of ' + Object.keys(bench.ROLE_ARMS).join(', ') + (bad.length ? '; not ' + bad.join(', ') : ''));
        return 1;
    }
    const runs = Number(a.values.runs || 5);
    const cap = Number(a.values.cap || 1);
    const width = Number(a.values.jobs || 4);
    if (!(runs >= 1) || !(cap > 0) || !(Number.isInteger(width) && width >= 1)) {
        console.error('bench.js: --runs and --jobs are at least 1, and --cap above 0');
        return 1;
    }
    const jobs = roleJobs(name, role, arms, runs);
    if (a.values.dry) {
        console.log(bench.roleDryLines(name, role.conf.agent, jobs, { cap, root: ROOT }).join('\n'));
        return 0;
    }
    // Every control of every item, under every seed this batch will use,
    // before the first paid call: 10-08's batch (a) was the bench's own error.
    const self = bench.selftestRole(role.dir, { mkdtemp: selfDir, plugin: bench.posix(ROOT), seeds: Array.from({ length: runs }, (_, i) => i + 1) });
    if (self.length) {
        for (const e of self) console.error(e);
        console.error('bench.js: ' + self.length + ' control(s) judged wrong — no run started');
        return 1;
    }
    const batchDir = startBatch('role-' + name, a, ['role: ' + name + ' (' + role.conf.agent + ')  items: ' + role.items.length
        + '  arms: ' + arms.join(',') + '  runs: ' + runs + '  jobs: ' + width + '  cap: $' + cap]);
    if (!batchDir) return 1;
    await runAll({ agent: role.conf.agent, cap, keep: Boolean(a.values.keep), batchDir, timeoutMs: 20 * 60e3 }, jobs, width);
    return 0;
}
```

   In `scripts/bench.js`, replace `cmdSelftest` with:

```js
function cmdSelftest(a, projectsRoot) {
    const named = a.positionals.slice(1);
    const n = Number(a.values.seeds || 1);
    if (!(Number.isInteger(n) && n >= 1)) {
        console.error('bench.js: --seeds is a whole number, at least 1');
        return 1;
    }
    const rolesDir = path.join(projectsRoot, 'roles');
    const roles = fs.existsSync(rolesDir)
        ? fs.readdirSync(rolesDir).filter((x) => fs.existsSync(path.join(rolesDir, x, 'role.json'))).map((x) => 'roles/' + x)
        : [];
    const all = named.length ? named
        : [...fs.readdirSync(projectsRoot).filter((x) => fs.existsSync(path.join(projectsRoot, x, 'bench.json'))), ...roles];
    const opts = { mkdtemp: selfDir, plugin: bench.posix(ROOT), seeds: Array.from({ length: n }, (_, i) => i + 1) };
    const errors = [];
    for (const x of all) {
        const dir = path.join(projectsRoot, x);
        errors.push(...(x.startsWith('roles/') ? bench.selftestRole(dir, opts) : bench.selftest(dir, opts)));
    }
    for (const e of errors) console.log(e);
    console.log(errors.length ? errors.length + ' control(s) judged wrong' : 'selftest ok: ' + all.join(', '));
    return errors.length ? 1 : 0;
}
```

   In `scripts/bench.js`, in `main`, add `jobs: { type: 'string' }, seeds: { type: 'string' }` to the parseArgs options, and update the usage line and the header comment to `selftest [<project>...] [--seeds <n>]` and `role <role> [--arms <sonnet,haiku>] [--runs <n>] [--jobs <n>] [--cap <usd>] [--dry] [--keep] [--evidence <dir>]`. Replace the last line of the file with:

```js
module.exports = { prepareRun };

if (require.main === module) Promise.resolve(main(process.argv.slice(2))).then((code) => process.exit(code));
```

4. Run `node --test tests/bench.test.js tests/eval.test.js tests/bench-projects.test.js tests/source.test.js` and watch them pass.
5. Commit: `bench: role runs every item through a --jobs pool after a selftest`.

## Task 10: drift 指令與它的 tally

**Files:**
- Modify: `scripts/bench.js` — `cmdDrift`；`runJob` 在重注入臂寫 `.bench/settings.json` 並帶 `--settings`、把 `reinject.log` 複製進 raw；`tallyBatch`；`cmdTally` 讀 drift 批；`cmdSelftest` 含 `drift`
- Modify: `lib/drift.js` — `DRIFT_ARMS`、`MIN_STEPS`、`driftPrompt`、`reinjectSettings`、`driftDryLines`、`driftTally`、`driftSummaryMd`
- Test: `tests/drift.test.js`
- Read: `lib/bench.js` — `roleFigures`、`order`、`claudeArgs`、`posix`
- Read: `lib/agentfile.js` — `baseAgent`
- Read: `lib/usage.js` — `agentFiles`、`sessionDirOf`、`summarise`

**Interfaces:**
- Consumes: `prepareRun`, `runJob`, `pool`, `startBatch`, `runAll`, `driftSteps`, `driftSummary`, `decide`, `keepAll`, `transcript`
- Produces: `DRIFT_ARMS`, `driftPrompt`, `reinjectSettings`, `driftDryLines`, `driftTally`, `driftSummaryMd`, `tallyBatch`, `driftBatch`

**Dispatch:** implementer, sonnet

1. Write the failing tests. In `tests/drift.test.js`, add `const SCRIPT = path.join(ROOT, 'scripts', 'bench.js');` below `DRIFT`, and append before the `module.exports` line (then add `driftBatch` to it):

```js
const SESSION = '11111111-2222-3333-4444-555555555555';

// One copied drift run: the relay's transcript dispatching `prompt` once to
// the implementer, the implementer's own transcript from `steps`, and the
// reinjection log when one is given.
function driftRaw(root, tag, { prompt, model, steps, log }) {
    const dir = path.join(root, tag);
    const sub = path.join(dir, SESSION, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    const line = (o) => JSON.stringify(o) + '\n';
    fs.writeFileSync(path.join(dir, SESSION + '.jsonl'),
        line({ type: 'assistant', requestId: 'm1', message: { model: 'claude-haiku-5-5', usage: { input_tokens: 100, output_tokens: 10 },
            content: [{ type: 'tool_use', id: 'tu0', name: 'Agent', input: { subagent_type: 'fankeel:fankeel-implementer', prompt } }] } })
        + line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu0', content: [{ type: 'text', text: 'DONE' }] }] } }));
    fs.copyFileSync(transcript(steps, {}, DONE, model), path.join(sub, 'agent-a1.jsonl'));
    fs.writeFileSync(path.join(sub, 'agent-a1.meta.json'), JSON.stringify({ agentType: 'fankeel:fankeel-implementer' }));
    if (log) fs.writeFileSync(path.join(dir, 'reinject.log'), log.map((x) => JSON.stringify(x) + '\n').join(''));
}

// A batch directory holding one valid haiku drift run.
function driftBatch() {
    const batch = tmp('fankeel-drift-batch-');
    driftRaw(path.join(batch, 'raw'), 'drift-r1-haiku', { prompt: 'P\n', model: 'claude-haiku-5-5', steps: keepAll() });
    fs.writeFileSync(path.join(batch, 'runs.jsonl'), JSON.stringify({ kind: 'drift', tag: 'drift-r1-haiku', arm: 'haiku', model: 'haiku',
        reinject: false, input: 'P\n', pass: true, check: 'pass', claudeUsd: 0.1 }) + '\n');
    return batch;
}

test('driftTally: a valid run needs thirty calls, and an injection log only on a reinject arm; each arm sums its valid runs', () => {
    const raw = tmp('fankeel-drift-raw-');
    const prompt = 'CONSTRAINTS\n\nTASK\n';
    const late = keepAll();
    late[39] = ['Edit', { file_path: 'vendor/fmt/index.js' }];
    driftRaw(raw, 'drift-r1-haiku', { prompt, model: 'claude-haiku-5-5', steps: keepAll() });
    driftRaw(raw, 'drift-r1-haiku-reinject', { prompt, model: 'claude-haiku-5-5', steps: late, log: [{ step: 5, chars: 300 }, { step: 10, chars: 300 }] });
    driftRaw(raw, 'drift-r2-haiku', { prompt, model: 'claude-haiku-5-5', steps: keepAll().slice(0, 20) });
    driftRaw(raw, 'drift-r2-haiku-reinject', { prompt, model: 'claude-haiku-5-5', steps: keepAll() });
    driftRaw(raw, 'drift-r1-sonnet', { prompt, model: 'claude-sonnet-5-5', steps: keepAll(), log: [{ step: 5, chars: 300 }] });
    const row = (tag, arm, pass) => ({ kind: 'drift', tag, arm, model: drift.DRIFT_ARMS[arm].model, reinject: drift.DRIFT_ARMS[arm].reinject,
        input: prompt, pass, check: pass ? 'pass' : 'fail wrong: x', claudeUsd: 0.1 });
    const t = drift.driftTally([
        row('drift-r1-haiku', 'haiku', true),
        row('drift-r1-haiku-reinject', 'haiku-reinject', true),
        row('drift-r2-haiku', 'haiku', true),
        row('drift-r2-haiku-reinject', 'haiku-reinject', false),
        row('drift-r1-sonnet', 'sonnet', true),
    ], raw);
    const why = (tag) => t.runs.find((r) => r.tag === tag).why.join('; ');
    assert.equal(why('drift-r1-haiku'), '');
    assert.match(why('drift-r2-haiku'), /made 20 tool calls, under 30/);
    assert.match(why('drift-r2-haiku-reinject'), /no injection in its log/);
    assert.match(why('drift-r1-sonnet'), /injection log on an arm without reinjection/);
    const cell = (arm) => t.cells.find((c) => c.arm === arm);
    assert.deepEqual([cell('haiku').runs, cell('haiku').valid, cell('haiku').passed, cell('haiku').clean], [2, 1, 1, 1]);
    const re = cell('haiku-reinject');
    assert.deepEqual([re.valid, re.clean, re.medianFirst, re.injections, re.injectedChars], [1, 0, 40, 2, 600]);
    assert.equal(cell('sonnet').valid, 0);
    assert.match(drift.driftSummaryMd(t), /\| haiku-reinject \| 2 \| 1 \| 1 \| 0 \| 40 \| /);
});

test('drift --dry prints one line per run, the reinject arms with --settings and the haiku arms with the override', () => {
    const r = spawnSync(process.execPath, [SCRIPT, 'drift', '--runs', '1', '--dry'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const lines = r.stdout.trim().split(/\r?\n/);
    assert.equal(lines.length, 4);
    assert.match(lines[0], /^drift-r1-sonnet model=sonnet reinject=false .*profile: \(none\)$/);
    assert.match(lines[3], /^drift-r1-haiku-reinject model=haiku reinject=true .*--settings \.bench\/settings\.json profile: agent\.fankeel-implementer\.model=haiku$/);
    assert.equal(drift.reinjectSettings('/plug').hooks.PostToolUse[0].hooks[0].command, 'node "/plug/bench/drift/reinject.js"');
    assert.match(drift.driftPrompt(DRIFT), /^開始之前[\s\S]*\n\n## Task 1: format\(\) in place of oldFormat\(\)/);
});

test('tally on a drift batch writes the 2×2 summary', () => {
    const r = spawnSync(process.execPath, [SCRIPT, 'tally', driftBatch(), '--evidence', tmp('fankeel-drift-ev-')], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^\| arm \| runs \| valid \| task passed \|/);
    assert.match(r.stdout, /\| haiku \| 1 \| 1 \| 1 \| 1 \| - \|/);
});
```

2. Run `node --test tests/drift.test.js` and watch the three new tests fail.
3. Write the implementation. In `lib/drift.js`, add `const fs = require('node:fs');`, `const path = require('node:path');`, `const bench = require('./bench.js');` and `const { baseAgent } = require('./agentfile.js');` to the requires, add the new names to `module.exports`, and insert above `module.exports`:

```js
// The 2×2's four arms (design section 8): the model the implementer's
// override pins, and whether PostToolUse hands the constraints back.
const DRIFT_ARMS = {
    sonnet: { model: 'sonnet', reinject: false },
    haiku: { model: 'haiku', reinject: false },
    'sonnet-reinject': { model: 'sonnet', reinject: true },
    'haiku-reinject': { model: 'haiku', reinject: true },
};
const MIN_STEPS = 30;

// What the relay dispatches: the constraints once, then the task.
function driftPrompt(dir) {
    return fs.readFileSync(path.join(dir, 'constraints.md'), 'utf8').trim() + '\n\n' + fs.readFileSync(path.join(dir, 'input.md'), 'utf8').trim() + '\n';
}

// The settings a reinject run passes with --settings: reinject.js on every PostToolUse.
function reinjectSettings(root) {
    const script = bench.posix(path.join(root, 'bench', 'drift', 'reinject.js'));
    return { hooks: { PostToolUse: [{ hooks: [{ type: 'command', command: 'node "' + script + '"', timeout: 5 }] }] } };
}

function driftDryLines(jobs, opts) {
    return jobs.map((j) => j.tag + ' model=' + j.model + ' reinject=' + j.reinject + ' seed=' + j.seed + ' cap=$' + opts.cap
        + ' claude -p ' + bench.claudeArgs(opts.root, 'haiku').join(' ') + (j.reinject ? ' --settings .bench/settings.json' : '')
        + ' profile: ' + (j.model === 'haiku' ? 'agent.fankeel-implementer.model=haiku' : '(none)'));
}

// The implementer's own transcript in a copied run, or null.
function implementerTranscript(rawDir) {
    let names = [];
    try {
        names = fs.readdirSync(rawDir);
    } catch (e) {
        return null;
    }
    const main = names.find((n) => /^[0-9a-f-]{36}\.jsonl$/.test(n));
    if (!main) return null;
    for (const file of usage.agentFiles(usage.sessionDirOf(path.join(rawDir, main)))) {
        try {
            if (baseAgent(JSON.parse(fs.readFileSync(file.replace(/\.jsonl$/, '.meta.json'), 'utf8')).agentType) === 'fankeel-implementer') return file;
        } catch (e) {
            // An agent with no readable meta.json is not the one asked for.
        }
    }
    return null;
}

function logOf(file) {
    try {
        return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    } catch (e) {
        return [];
    }
}

function median(xs) {
    if (!xs.length) return null;
    const s = xs.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function addBuckets(into, from) {
    for (const b of from) {
        const t = into.get(b.at) || { at: b.at, kept: 0, applicable: 0 };
        into.set(b.at, t);
        t.kept += b.kept;
        t.applicable += b.applicable;
    }
}

// rows: a drift batch's runs.jsonl. A run is valid (design section 8) when
// roleFigures finds one dispatch of the prompt to the implementer on the
// arm's model, the implementer made at least MIN_STEPS tool calls, a reinject
// arm's log holds an injection and no other arm has a log. Per arm, over its
// valid runs: task passes, runs with no violation, the median first
// violation, the kept rates, what the injections cost directly, and the
// implementer's mean usd and mean prompt tokens (every request's context
// summed: input, cache reads and cache writes).
function driftTally(rows, rawRoot) {
    const runs = rows.map((row) => {
        const { input, ...rest } = row;
        const raw = path.join(rawRoot, row.tag);
        const { result, ...f } = bench.roleFigures(raw, 'fankeel-implementer', row.model, input);
        const why = row.error ? [row.error, ...f.why] : f.why.slice();
        const file = implementerTranscript(raw);
        const steps = file ? driftSteps(file) : [];
        const own = file ? usage.summarise(file, { sidechain: true, series: true }) : null;
        const log = logOf(path.join(raw, 'reinject.log'));
        if (steps.length < MIN_STEPS) why.push('the implementer made ' + steps.length + ' tool calls, under ' + MIN_STEPS);
        if (row.reinject && !log.length) why.push('a reinject arm with no injection in its log');
        if (!row.reinject && log.length) why.push('an injection log on an arm without reinjection');
        return { ...rest, ...f, why, valid: why.length === 0, summary: driftSummary(steps), injections: log.length,
            injectedChars: log.reduce((n, x) => n + (x.chars || 0), 0), promptTokens: own ? own.series.reduce((n, r) => n + r.context, 0) : 0 };
    });
    const cells = Object.keys(DRIFT_ARMS).map((arm) => {
        const mine = runs.filter((r) => r.arm === arm);
        const ok = mine.filter((r) => r.valid);
        const bySteps = new Map();
        const byContext = new Map();
        for (const r of ok) {
            addBuckets(bySteps, r.summary.bySteps);
            addBuckets(byContext, r.summary.byContext);
        }
        const mean = (k) => (ok.length ? ok.reduce((n, r) => n + (r[k] || 0), 0) / ok.length : 0);
        return { arm, ...DRIFT_ARMS[arm], runs: mine.length, valid: ok.length, passed: ok.filter((r) => r.pass).length,
            clean: ok.filter((r) => r.summary.firstViolation === null).length,
            medianFirst: median(ok.map((r) => r.summary.firstViolation).filter((x) => x !== null)),
            bySteps: [...bySteps.values()].sort((a, b) => a.at - b.at), byContext: [...byContext.values()].sort((a, b) => a.at - b.at),
            injections: ok.reduce((n, r) => n + r.injections, 0), injectedChars: ok.reduce((n, r) => n + r.injectedChars, 0),
            usdMean: mean('roleUsd'), promptMean: mean('promptTokens') };
    }).filter((c) => c.runs > 0);
    return { runs, cells };
}

const pct = (b) => (b.applicable ? Math.round((100 * b.kept) / b.applicable) + '%' : '-');
const rates = (bs, label) => bs.map((b) => label(b.at) + ' ' + pct(b)).join('; ') || '-';
const stepLabel = (at) => at + '-' + (at + 9);
const contextLabel = (at) => at / 1000 + 'K';

function driftSummaryMd(t) {
    const lines = ['| arm | runs | valid | task passed | no violation | median first violation | kept by steps | kept by context | injections | injected chars | implementer usd mean | prompt tokens mean |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|'];
    for (const c of t.cells) {
        lines.push('| ' + [c.arm, c.runs, c.valid, c.passed, c.clean, c.medianFirst === null ? '-' : c.medianFirst, rates(c.bySteps, stepLabel),
            rates(c.byContext, contextLabel), c.injections, c.injectedChars, c.usdMean.toFixed(4), Math.round(c.promptMean)].join(' | ') + ' |');
    }
    lines.push('', '| run | arm | valid | pass | steps | first violation | injections | role usd | wall s | why not valid |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const r of t.runs) {
        lines.push('| ' + [r.tag, r.arm, r.valid, r.pass, r.summary.steps, r.summary.firstViolation === null ? '-' : r.summary.firstViolation,
            r.injections, (r.roleUsd || 0).toFixed(4), r.wallS || 0, r.why.join('; ')].join(' | ') + ' |');
    }
    return lines.join('\n') + '\n';
}
```

   In `scripts/bench.js`, add `const drift = require('../lib/drift.js');`. In `runJob`, build the reinject flags after the `if (row.error) return row;` line and add `...extra` at the end of `args`:

```js
        const extra = [];
        if (job.reinject) {
            const settings = path.join(dir, '.bench', 'settings.json');
            fs.mkdirSync(path.dirname(settings), { recursive: true });
            fs.writeFileSync(settings, JSON.stringify(drift.reinjectSettings(ROOT), null, 2) + '\n');
            extra.push('--settings', bench.posix(settings));
        }
```

   and in `scripts/bench.js`, right after the `copyTranscript` check in `runJob`, keep the log beside the transcript:

```js
        const log = path.join(dir, '.bench', 'reinject.log');
        if (fs.existsSync(log)) fs.copyFileSync(log, path.join(raw, 'reinject.log'));
```

   In `scripts/bench.js`, add `tallyBatch` and `cmdDrift`, and make `cmdTally` read through `tallyBatch`:

```js
// One batch read back: its kind, its tally and that tally's summary; null
// when it has no runs.jsonl.
function tallyBatch(batchDir) {
    let rows;
    try {
        rows = fs.readFileSync(path.join(batchDir, 'runs.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    } catch (e) {
        return null;
    }
    const raw = path.join(batchDir, 'raw');
    if (rows.length && rows[0].kind === 'drift') {
        const t = drift.driftTally(rows, raw);
        return { kind: 'drift', t, md: drift.driftSummaryMd(t) };
    }
    if (rows.length && typeof rows[0].role === 'string') {
        const t = bench.roleTally(rows, raw);
        return { kind: 'role', t, md: bench.roleSummaryMd(t) };
    }
    const t = bench.tally(rows, raw);
    return { kind: 'run', t, md: bench.summaryMd(t) };
}

function cmdTally(a) {
    const batchDir = path.resolve(a.positionals[1] || '');
    const b = tallyBatch(batchDir);
    if (!b) {
        console.error('bench.js: no runs.jsonl under ' + batchDir);
        return 1;
    }
    let evidence = a.values.evidence ? path.resolve(a.values.evidence) : null;
    if (!evidence) {
        try {
            evidence = fs.readFileSync(path.join(batchDir, 'evidence.txt'), 'utf8').trim();
        } catch (e) {
            evidence = defaultEvidence();
            console.error('bench.js: no evidence.txt under ' + batchDir + '; writing to ' + evidence);
        }
    }
    const out = path.join(evidence, path.basename(batchDir));
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(b.t, null, 2) + '\n');
    fs.writeFileSync(path.join(out, 'summary.md'), b.md);
    process.stdout.write(b.md);
    return 0;
}

// The drift 2×2 (design sections 6 and 8): one relay on haiku dispatches the
// implementer once with constraints.md before input.md; the reinject arms
// mount bench/drift/reinject.js on PostToolUse through --settings.
async function cmdDrift(a, projectsRoot) {
    const dir = path.join(projectsRoot, 'drift');
    if (!fs.existsSync(path.join(dir, 'setup.sh'))) {
        console.error('bench.js: no setup.sh under ' + dir);
        return 1;
    }
    const names = Object.keys(drift.DRIFT_ARMS);
    const arms = String(a.values.arms || names.join(',')).split(',').filter(Boolean);
    const bad = arms.filter((x) => !drift.DRIFT_ARMS[x]);
    if (!arms.length || bad.length) {
        console.error('bench.js: --arms is a comma list of ' + names.join(', ') + (bad.length ? '; not ' + bad.join(', ') : ''));
        return 1;
    }
    const runs = Number(a.values.runs || 10);
    const cap = Number(a.values.cap || 3);
    const width = Number(a.values.jobs || 4);
    if (!(runs >= 1) || !(cap > 0) || !(Number.isInteger(width) && width >= 1)) {
        console.error('bench.js: --runs and --jobs are at least 1, and --cap above 0');
        return 1;
    }
    const input = drift.driftPrompt(dir);
    const jobs = bench.order(arms, runs).map((s) => {
        const arm = drift.DRIFT_ARMS[s.arm];
        return { tag: 'drift-r' + s.round + '-' + s.arm, arm: s.arm, model: arm.model, reinject: arm.reinject, round: s.round, seed: s.seed,
            itemDir: dir, row: { kind: 'drift', reinject: arm.reinject, input } };
    });
    if (a.values.dry) {
        console.log(drift.driftDryLines(jobs, { cap, root: ROOT }).join('\n'));
        return 0;
    }
    const self = bench.selftest(dir, { mkdtemp: selfDir, plugin: bench.posix(ROOT), classes: true });
    if (self.length) {
        for (const e of self) console.error(e);
        console.error('bench.js: ' + self.length + ' control(s) judged wrong — no run started');
        return 1;
    }
    const batchDir = startBatch('drift', a, ['drift  arms: ' + arms.join(',') + '  runs: ' + runs + '  jobs: ' + width + '  cap: $' + cap]);
    if (!batchDir) return 1;
    await runAll({ agent: 'fankeel-implementer', cap, keep: Boolean(a.values.keep), batchDir, timeoutMs: 60 * 60e3 }, jobs, width);
    return 0;
}
```

   In `cmdSelftest`, append `...(fs.existsSync(path.join(projectsRoot, 'drift', 'setup.sh')) ? ['drift'] : [])` to the default list and select the check with `x.startsWith('roles/') ? bench.selftestRole(dir, opts) : bench.selftest(dir, x === 'drift' ? { ...opts, classes: true } : opts)`. In `main`, add `if (verb === 'drift') return cmdDrift(a, projectsRoot);`, and add `drift [--arms <a,b>] [--runs <n>] [--jobs <n>] [--cap <usd>] [--dry] [--keep] [--evidence <dir>]` to the usage line and the header comment.
4. Run `node --test tests/drift.test.js tests/bench.test.js tests/source.test.js` and watch them pass.
5. Commit: `bench: drift runs the 2×2 and tally reads its batches`.

## Task 11: 報告產生器（bench.js report）

**Files:**
- Modify: `lib/drift.js` — `verdicts`、`reportMd`
- Modify: `scripts/bench.js` — `cmdReport`、`--out`
- Modify: `docs/README.md` — 設計頁與這份計畫的索引列
- Test: `tests/drift.test.js`
- Read: `lib/bench.js` — `CLASSES`

**Interfaces:**
- Consumes: `tallyBatch`, `driftTally`, `driftBatch`, `CLASSES`, `TIERS`
- Produces: `verdicts`, `reportMd`, `cmdReport`

**Dispatch:** implementer, sonnet

設計第 9 段說報告由 implementer 依各批的 `summary.json` 寫。這裡改成程式：付費批次是 `Dispatch: user` 的 task，必須排在最後，後面不能再接派出去的 task；而且兩條判準本來就是機械的。`report` 用 `tally` 同一個函式重算各批，所以「重跑 `tally` 數字一致」是由建構保證的。

1. Write the failing tests. In `tests/drift.test.js`, append before the `module.exports` line:

```js
test('verdicts apply the design\'s two rulings at their edges', () => {
    const cell = (arm, passed, clean, usdMean) => ({ arm, valid: 10, passed, clean, usdMean });
    const v = drift.verdicts([cell('sonnet', 9, 8, 0.5), cell('haiku', 8, 7, 0.05), cell('sonnet-reinject', 9, 10, 0.59), cell('haiku-reinject', 8, 8, 0.05)]);
    assert.deepEqual([v.longTask.holds, v.worth.sonnet.holds, v.worth.haiku.holds], [true, true, false]);
    assert.equal(drift.verdicts([cell('sonnet', 9, 8, 0.5), cell('haiku', 7, 8, 0.05)]).longTask.holds, false);
    assert.equal(drift.verdicts([cell('sonnet', 9, 8, 0.5), cell('sonnet-reinject', 9, 10, 0.61)]).worth.sonnet.holds, false);
});

test('reportMd states both answers with the noise note beside each, and prints the bank table and the 2×2', () => {
    const c = (arm, clean, usdMean) => ({ arm, model: arm.replace('-reinject', ''), reinject: arm.endsWith('-reinject'), runs: 10, valid: 10, passed: 9, clean,
        medianFirst: 31, bySteps: [{ at: 1, kept: 9, applicable: 10 }], byContext: [{ at: 20000, kept: 1, applicable: 2 }],
        injections: 0, injectedChars: 0, usdMean, promptMean: 900000 });
    const roles = [{ tiers: [{ role: 'reader', arm: 'haiku', tier: 'trap', runs: 12, valid: 12, passed: 10, classes: { fabricated: 2 } }] }];
    const md = drift.reportMd({ date: '2026-10-10', roles, drift: { cells: [c('sonnet', 8, 0.5), c('haiku', 7, 0.05)] }, batches: ['.fankeel/build/bench/drift-x'] });
    assert.match(md, /^---\nstatus: current\nlast_verified: 2026-10-10\n/);
    assert.equal(md.split('每格十次時，差一次只是雜訊。').length - 1, 3);
    assert.match(md, /\| reader \| haiku \| trap \| 12 \| 12 \| 10 \| 0 \| 2 \| 0 \| 0 \| 0 \| 0 \|/);
    assert.match(md, /\| sonnet \| 10 \| 10 \| 9 \| 8 \| 31 \| 1-10 90% \| 20K 50% \|/);
    assert.match(md, /`node scripts\/bench\.js tally \.fankeel\/build\/bench\/drift-x`/);
});

test('report re-tallies the batches it is given and writes the page to --out', () => {
    const out = path.join(tmp('fankeel-drift-out-'), 'r.md');
    const r = spawnSync(process.execPath, [SCRIPT, 'report', driftBatch(), '--out', out], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(fs.readFileSync(out, 'utf8'), /\| haiku \| 1 \| 1 \| 1 \| 1 \| - \|/);
    assert.equal(spawnSync(process.execPath, [SCRIPT, 'report'], { encoding: 'utf8' }).status, 1);
});
```

2. Run `node --test tests/drift.test.js` and watch the three new tests fail.
3. Write the implementation. In `lib/drift.js`, add `verdicts` and `reportMd` to `module.exports`, and insert above it:

```js
// The design's two rulings (section 9), set before any run: haiku takes long
// tasks when, with reinjection off, its task passes and its clean runs are
// each at least sonnet's less one; reinjection is worth it for a model when
// its on arm has at least two more clean runs than its off arm and its mean
// implementer usd per run rises by under a fifth.
function verdicts(cells) {
    const at = (arm) => cells.find((c) => c.arm === arm) || { arm, valid: 0, passed: 0, clean: 0, usdMean: 0 };
    const sonnet = at('sonnet');
    const haiku = at('haiku');
    const out = { longTask: { holds: haiku.passed >= sonnet.passed - 1 && haiku.clean >= sonnet.clean - 1, haiku, sonnet }, worth: {} };
    for (const m of ['sonnet', 'haiku']) {
        const off = at(m);
        const on = at(m + '-reinject');
        const rise = off.usdMean > 0 ? on.usdMean / off.usdMean - 1 : null;
        out.worth[m] = { holds: on.clean >= off.clean + 2 && rise !== null && rise < 0.2, off, on, rise };
    }
    return out;
}

const NOISE = '每格十次時，差一次只是雜訊。';

// The report page, in Traditional Chinese: the two answers first, then the
// bank's role × arm × tier table, the 2×2, and the tally line that
// reproduces every batch.
function reportMd({ date, roles, drift: d, batches }) {
    const v = verdicts(d ? d.cells : []);
    const yes = (b) => (b ? '成立' : '不成立');
    const rise = (r) => (r === null ? '無法計算' : (r >= 0 ? '多 ' : '少 ') + Math.round(Math.abs(r) * 100) + '%');
    const lt = v.longTask;
    const cols = [...bench.CLASSES, 'unclassified'];
    const lines = ['---', 'status: current', 'last_verified: ' + date, 'source_of_truth: scripts/bench.js, lib/drift.js, lib/bench.js', '---', '',
        '# Haiku 角色題庫與長任務飄移（' + date + '）', '',
        '這一頁由 `node scripts/bench.js report` 從各批的 `runs.jsonl` 重算後寫出。兩個問題的判準是設計頁 `docs/90-agent/plans/2026-10-09-haiku-bank-drift-design.md` 第 9 段事先寫定的，這裡只套用。', '',
        '## 兩個問題', '',
        '「haiku 能接長任務」' + yes(lt.holds) + '：關閉重注入時，haiku 任務通過 ' + lt.haiku.passed + '、全程無違規 ' + lt.haiku.clean
            + '，sonnet 是 ' + lt.sonnet.passed + '、' + lt.sonnet.clean + '；判準是兩個數都至少是 sonnet 的減一。' + NOISE, ''];
    for (const m of ['sonnet', 'haiku']) {
        const w = v.worth[m];
        lines.push('「重注入值得」對 ' + m + ' ' + yes(w.holds) + '：重注入臂全程無違規 ' + w.on.clean + '、關閉臂 ' + w.off.clean
            + '，implementer 每次 run 的平均美元' + rise(w.rise) + '；判準是至少多兩次無違規，而且平均美元增加不到兩成。' + NOISE, '');
    }
    lines.push('## 題庫：角色 × 臂 × 層', '', '| 角色 | 臂 | 層 | run | 有效 | 通過 | ' + cols.join(' | ') + ' |', '|' + '---|'.repeat(6 + cols.length));
    for (const t of roles) {
        for (const x of t.tiers) lines.push('| ' + [x.role, x.arm, x.tier, x.runs, x.valid, x.passed, ...cols.map((c) => x.classes[c] || 0)].join(' | ') + ' |');
    }
    lines.push('', '失敗類別只算有效 run；`unclassified` 是檢查的最後一行沒有寫出類別的失敗。', '');
    if (d) {
        lines.push('## 飄移 2×2', '', '| 臂 | run | 有效 | 任務通過 | 全程無違規 | 第一次違規步數中位數 | 守規率（每十步） | 守規率（每 20K context） | 注入次數 | 注入字元 | implementer 平均美元 | 平均送出 token |',
            '|---|---|---|---|---|---|---|---|---|---|---|---|');
        for (const c of d.cells) {
            lines.push('| ' + [c.arm, c.runs, c.valid, c.passed, c.clean, c.medianFirst === null ? '-' : c.medianFirst, rates(c.bySteps, stepLabel),
                rates(c.byContext, contextLabel), c.injections, c.injectedChars, c.usdMean.toFixed(4), Math.round(c.promptMean)].join(' | ') + ' |');
        }
        lines.push('', '注入的直接花費是注入次數乘上字元數。間接花費是同一個模型的重注入臂減去關閉臂：', '');
        for (const m of ['sonnet', 'haiku']) {
            const w = v.worth[m];
            lines.push('- ' + m + '：implementer 每次 run 多 $' + ((w.on.usdMean || 0) - (w.off.usdMean || 0)).toFixed(4) + '，多送出 '
                + Math.round((w.on.promptMean || 0) - (w.off.promptMean || 0)) + ' token（每次請求送出的 token 加總，含快取讀取與寫入）。');
        }
        lines.push('');
    }
    lines.push('## 怎麼重算', '', '每一批重跑下面這一行，表上每一格的 run 數、有效數、通過數與美元都要一樣：', '');
    for (const b of batches) lines.push('- `node scripts/bench.js tally ' + b + '`');
    return lines.join('\n') + '\n';
}
```

   In `scripts/bench.js`, add `out: { type: 'string' }` to the parseArgs options, `if (verb === 'report') return cmdReport(a);` to `main`, `report <batch dir>... [--out <file>]` to the usage line and header comment, and:

```js
// Every batch named, re-tallied as tally does, then lib/drift.js reportMd
// over the role batches and the drift batch, written to --out or printed.
function cmdReport(a) {
    const dirs = a.positionals.slice(1).map((d) => path.resolve(d));
    if (!dirs.length) {
        console.error('bench.js: report needs at least one batch dir');
        return 1;
    }
    const roles = [];
    let d = null;
    for (const dir of dirs) {
        const b = tallyBatch(dir);
        if (!b) {
            console.error('bench.js: no runs.jsonl under ' + dir);
            return 1;
        }
        if (b.kind === 'drift') d = b.t;
        else if (b.kind === 'role') roles.push(b.t);
    }
    const md = drift.reportMd({ date: new Date().toISOString().slice(0, 10), roles, drift: d, batches: dirs.map((x) => bench.posix(path.relative(ROOT, x))) });
    if (a.values.out) fs.writeFileSync(path.resolve(a.values.out), md);
    else process.stdout.write(md);
    return 0;
}
```

4. In `docs/README.md`, right after the row whose link is `plans/2026-10-05-inject-plain-brain.md`, add:

```text
| Haiku 角色題庫、平行執行器與長任務飄移 2×2 的 design：每角色十二題分三層、`check.sh` 標出失敗類別、`bench.js role` 用 `--jobs` 平行跑、`drift` 量 haiku／sonnet × PostToolUse 重注入 | [plans/2026-10-09-haiku-bank-drift-design.md](90-agent/plans/2026-10-09-haiku-bank-drift-design.md) — *design-intent, 繁體中文* |
| 那份設計的十二個 task：失敗類別與共用判分、四組題庫、平行執行器、逐步檢查與重注入、報告產生器，以及使用者親手跑的付費批次 | [plans/2026-10-09-haiku-bank-drift.md](90-agent/plans/2026-10-09-haiku-bank-drift.md) — *design-intent, 繁體中文* |
```

5. Run `node --test tests/drift.test.js tests/source.test.js` and `node scripts/docs-check.js`, and watch them pass.
6. Commit: `bench: report writes the two answers from the batches' own tallies`.

## Task 12: 付費批次與報告（使用者親手跑）

**Files:**
- Modify: `docs/90-agent/reports/<date>-haiku-bank-drift.md` — 由 `bench.js report` 寫出
- Modify: `docs/90-agent/reports/evidence/<date>-haiku-bank-drift/` — 各批的 `provenance.txt` 與 `tally` 寫的 `summary.json`、`summary.md`
- Modify: `docs/README.md` — 報告的索引列
- Read: `scripts/bench.js` — 這一步跑的指令

**Interfaces:**
- Consumes: `cmdDrift`, `cmdRole`, `tallyBatch`, `cmdReport`
- Produces: none

**Dispatch:** user — 數小時、估計約 $25 的付費 `claude -p` 批次，子 agent 的 Bash 撐不住（`docs/90-agent/plans/2026-10-05-inject-plain-brain.md:1246` 的先例），由使用者在自己的終端機親手跑。

最壞的花費由每次 run 的 `--cap` 封頂：飄移 40 次 × $3 = $120，題庫 288 次 × $1 = $288。估計約 $25：題庫約 $10（10-08 角色 sonnet $0.024 到 $0.044、haiku $0.002 到 $0.004、relay 約 $0.005，陷阱題假設較貴），飄移約 $15（假設 sonnet 一次長任務約 $0.5）。`--jobs 4` 下題庫約四十分鐘、飄移約兩小時；碰到速率限制就把 `--jobs` 調低。

1. 在 repo 根目錄的 Git Bash 裡，先定日期與證據目錄，再確認 haiku 別名：

```
D=$(date +%F); EV=docs/90-agent/reports/evidence/$D-haiku-bank-drift
node scripts/bench.js probe
```

2. 每臂試跑一次（四次），再 tally 它印出的那一批；每一列的 `steps` 都要至少 30，有一列不到就停下來，告訴 session 回 build 把長任務拉長，不跑下一步：

```
node scripts/bench.js drift --runs 1 --jobs 4 --cap 3 --evidence $EV
node scripts/bench.js tally <the batch dir it printed>
```

3. 飄移本批，四十次：

```
node scripts/bench.js drift --runs 10 --jobs 4 --cap 3 --evidence $EV
node scripts/bench.js tally <the batch dir it printed>
```

4. 題庫，每個角色七十二次（十二題 × 三回合 × 兩臂），共兩百八十八次；每批跑完都 tally：

```
node scripts/bench.js role reader --arms sonnet,haiku --runs 3 --jobs 4 --cap 1 --evidence $EV
node scripts/bench.js role mutator --arms sonnet,haiku --runs 3 --jobs 4 --cap 1 --evidence $EV
node scripts/bench.js role mover --arms sonnet,haiku --runs 3 --jobs 4 --cap 1 --evidence $EV
node scripts/bench.js role implementer --arms sonnet,haiku --runs 3 --jobs 4 --cap 1 --evidence $EV
node scripts/bench.js tally <each batch dir it printed>
```

5. 寫報告（試跑那一批不放進來）：

```
node scripts/bench.js report <drift batch> <reader batch> <mutator batch> <mover batch> <implementer batch> --out docs/90-agent/reports/$D-haiku-bank-drift.md
```

6. 告訴 session 跑完了。session 在 `docs/README.md` 裡 `reports/2026-10-08-haiku-bench.md` 那一列之後加上這一列（`<date>` 換成 `$D`），然後提交報告、`$EV` 與這一列：

```text
| Haiku 角色題庫與長任務飄移的結果：四個角色各十二題的 haiku 對 sonnet，以及 haiku／sonnet × 重注入的 2×2，兩個問題依設計事先寫定的判準回答 | [reports/<date>-haiku-bank-drift.md](90-agent/reports/<date>-haiku-bank-drift.md) — *a dated snapshot, 繁體中文* |
```

## Coverage

| promise | task |
|---|---|
| 每個角色保留 `bench/roles/<role>/role.json`（只剩 `agent` 一個鍵），題目放在 `bench/roles/<role>/items/<tier>-<slug>/`，每題有 `input.md`、`setup.sh`、`check.sh`、`controls/`，可另有 `src/`。 | Task 4、5、6、7 寫題目；Task 9 的測試要求頂層只有 `items/` 與只含 `agent` 的 `role.json` |
| 層級寫在目錄名稱的前綴：`easy-`、`mid-`、`trap-`，每層四題，每角色十二題；前綴不是這三個之一、或少了四件組任何一件，`selftest` 回報錯誤。 | Task 1（`tierOf`、`itemErrors`）；Task 9（四四四的測試） |
| 每題的 `setup.sh` 必須把 run 目錄做成 git repository（現有三題都這樣做），因為 `task.js profile set` 寫覆寫檔的位置是那個 repository 的根 | Task 3（四個 `repo.sh`）；Task 4 到 7 |
| 「產生器依 seed 產出」落在每題自己的腳本上：`runRole` 把回合數當成 `BENCH_SEED` 傳進去（取代 `scripts/bench.js:179` 寫死的 `'1'`） | Task 9（`prepareRun` 用 `job.seed`）；Task 1（`selftest` 的 `seed`）；Task 4（reader 題目依 seed 算值） |
| `readRole(projectsRoot, name)` 回傳 `{ dir, conf, items: [{ id, tier, dir, input }] }`，`id` 就是目錄名稱。 | Task 1（`roleItems`）；Task 9（`readRole`） |
| 現有的 reader、mutator、mover 各一題搬進 `items/`；implementer 那一題原本借用 `bench/add-feature`，由十二道自帶 fixture 的新題取代，`role.json` 的 `project` 鍵與 `roleProject` 的借用分支一併拿掉 | Task 4、5、6（搬題）；Task 7（自帶 fixture、拿掉 `project` 鍵）；Task 9（刪 `roleProject`） |
| 每題的 `check.sh` 最後一行只有兩種：`pass`，或 `fail <class>: <why>`；`<class>` 是 `wrong`（答錯）、`fabricated`（捏造引用）、`unrestored`（沒還原）、`extra`（多改了檔）、`format`（格式不對）五者之一。 | Task 1（`checkClass`、`CLASSES`）；Task 3（四個共用判分） |
| 每個失敗控制組命名為 `fail-<class>`，需要第二個同類時加尾碼 `fail-<class>-2`；對 `bench/roles/` 底下的題目，`selftest` 要求 `check.sh` 最後一行的類別與控制組名稱相符。 | Task 1 |
| 每題至少一個 `pass` 控制組、一個 `fail-*` 控制組；陷阱題一定有一個失敗控制組，類別就是那個陷阱要抓的錯。 | Task 4、5、6、7 |
| `roleTally` 依角色 × 臂 × 層 × 類別計數，`roleSummaryMd` 多印一張這樣的表；失敗 run 的檢查輸出沒有類別時記成 `unclassified`，讓它在表上看得到。 | Task 1 |
| `bench/` 底下三個整次 run 的專案（add-feature、fix-bug、review-planted）不受這條規則影響，仍只看結束碼。 | Task 1（`classes` 只對 `selftestRole` 與 drift 開）；Task 9（`cmdSelftest`） |
| reader：陷阱包含舊版同名檔裡放錯的值，以及問一個不存在的東西、正解是 `none`、不得附引用；`check.sh` 接受 Windows 反斜線的 `path:line` 並轉成斜線再比對 | Task 3（`answers.sh`）；Task 4（`trap-stale-copy`、`trap-none-exists`、`pass-backslash`） |
| mutator：陷阱包含測試抓不到的變異，正解是誠實回報存活（`after:` 仍是 `fail 0`），謊報殺死記成 `wrong`；以及 `path:line` 對不上題目給的原文，正解是拒絕且檔案不動，照改記成 `extra`。 | Task 3（mutator `judge.js`）；Task 5 |
| mover：陷阱包含內容看起來有錯、誘它順手修，順手修記成 `extra`；以及 commit 訊息含引號與換行，訊息不符記成 `wrong`。 | Task 3（`judge.sh`）；Task 6 |
| implementer（照抄計畫）：每題的 `input.md` 是一個計畫 task，程式區塊含 `$'`、反斜線、正則跳脫或 CRLF 行尾；`check.sh` 逐位元組比對寫出的檔與 `check.sh` 自己還原出的預期內容 | Task 3（implementer `judge.js`）；Task 7 |
| `bench.js role <role>` 跑那個角色的全部題目：每題 × `order(arms, runs)`，run 的標籤是 `<item>-r<round>-<arm>`，seed 是回合數。 | Task 9（`roleJobs`） |
| `--jobs <n>`（預設 4）決定同時跑幾個 run；做法照抄 `lib/fanout.js:55` 的有界池：幾個 worker 從同一個佇列取工作。 | Task 9（`pool`） |
| `scripts/eval.js` 在 `spawnClaude` 旁邊加 `spawnClaudeAsync`，用 `child_process.spawn` 回傳 Promise，Windows 上遇到 `EINVAL` 照 `scripts/eval.js:94` 的方式改用 `shell: true` 與 `cmdQuote` 重試。 | Task 9 |
| `runRole` 拆成兩半：`prepareRun`（暫存目錄、`setup.sh`、haiku 臂的覆寫檔）與呼叫加判分；第 5 段的測試只呼叫前一半。 | Task 9（`prepareRun`、`runJob`） |
| `runs.jsonl` 由唯一的父行程在每個 run 結束時附加一行，所以檔裡的順序是完成順序；`tally` 讀標籤，不讀順序。 | Task 9（`runAll`） |
| `role` 在第一次付費呼叫之前，對它要跑的題目、在它會用到的每個 seed（1 到 `--runs`）先跑一次 `selftest`，有任何控制組判錯就不開跑 | Task 9（`cmdRole`） |
| `--dry` 照舊每個 run 印一行，多印題目 id。 | Task 9（`roleDryLines`） |
| 一個不花錢的測試：同一題並排準備一個 haiku 臂、一個 sonnet 臂的 run，`CLAUDE_CONFIG_DIR` 指向一個空的暫存目錄 | Task 9（用 `overrideFor`：`agentFileOf` 不匯出，`overrideFor` 是它匯出的呼叫者） |
| 真的跑時，`lib/bench.js:380` 的 `roleFigures` 已經會把「角色跑在另一個臂的模型上」的 run 判成無效 | Task 9（`runJob` 把 `job.model` 交給 `roleFigures`）；Task 10（`driftTally` 同一條） |
| `bench/drift/` 有 `setup.sh`、`input.md`、`constraints.md`、`check.sh`、`controls/` 與 `reinject.js`；`input.md` 是一個照 implementer 格式寫的計畫 task，Files 區塊列出全部要改的檔。 | Task 8 |
| `setup.sh` 建一個 repository：`lib/` 底下八個模組，各自呼叫 `lib/legacy/format.js` 裡已棄用的 `oldFormat()` | Task 8 |
| 四條約束只在開頭給一次，寫在 `constraints.md`，執行器把它接在 `input.md` 前面，兩邊同一份來源： | Task 8（`constraints.md`，`input.md` 不提約束）；Task 10（`driftPrompt`） |
| 被量的是 `fankeel-implementer`，由第 4 段同一個 haiku relay 派一次；臂的模型與角色 run 一樣，靠 haiku 臂的覆寫檔決定。 | Task 10（`cmdDrift` 走 `runJob` 與 `prepareRun`） |
| `check.sh` 判工作本身做完沒（八個模組都改了、spec 全過、`vendor/` 沒變、八個 commit），控制組與類別規則同第 2 段 | Task 8 |
| 新的 `lib/drift.js` 匯出 `driftSteps(agentTranscript)`：每次工具呼叫一列，含步數、工具名、那一次請求的 context 大小 | Task 2 |
| `driftSummary(rows)` 回傳 `firstViolation`（第一次違規的步數，沒有則 `null`），以及守規率（守住次數 ÷ 適用次數），分兩種切法：每十步一格，與每 20K token context 一格。 | Task 2 |
| 四條約束的判法： | Task 2（`vendor` 用 `writesFiles`、`lint-every-3`、`commit-format`、`zh-Hant`） |
| 控制組在 `tests/drift.test.js` 裡用程式組出來，不存 fixture 檔：一段四十五步、四條全守的歷史，`firstViolation` 必須是 `null` | Task 2（`keepAll`、第 40 步改 `vendor/` 第 41 步改回、每條約束各一段） |
| `drift` 的四個臂叫 `sonnet`、`haiku`、`sonnet-reinject`、`haiku-reinject`。 | Task 10（`DRIFT_ARMS`） |
| 重注入臂的 run，執行器在 run 目錄寫 `.bench/settings.json`，在 PostToolUse 掛 `node <plugin>/bench/drift/reinject.js`，並用 `--settings` 傳給 `claude -p`；另外兩臂不寫、不傳。 | Task 10（`reinjectSettings`、`runJob`） |
| `reinject.js` 只理會帶 `agent_id` 的 payload（也就是 implementer，不是 relay），在 `.bench/reinject-count-<agent_id>` 計次 | Task 8 |
| 一個 drift run 有效的條件：`roleFigures` 判有效、implementer 至少三十次工具呼叫、重注入臂的 log 至少有一次輸出、另外兩臂沒有這個 log。 | Task 10（`driftTally`） |
| 注入本身的花費記兩種：直接的，是 log 裡的次數 × 字元數；間接的，是同一個模型重注入臂減去關閉臂 | Task 10（`injections`、`injectedChars`、`usdMean`、`promptMean`）；Task 11（報告裡的差） |
| 使用者依序跑：`node scripts/bench.js probe`；試跑 `bench.js drift --runs 1 --jobs 4 --cap 3`（四次），確認每次 implementer 都有三十次以上的工具呼叫 | Task 12 |
| 花費估計約 $25：題庫約 $10（10-08 的平均是角色 sonnet $0.024 到 $0.044、haiku $0.002 到 $0.004、relay 約 $0.005，陷阱題假設較貴），飄移約 $15 | Task 12 |
| 報告寫在 `docs/90-agent/reports/<date>-haiku-bank-drift.md`，繁體中文，由 implementer 依各批的 `summary.json` 寫 | 改法 — Task 11 把表與判準寫成 `bench.js report`，Task 12 由使用者跑完各批後用它寫出報告：使用者的 task 必須排最後，後面不能再派 task；`report` 用 `tally` 同一個函式重算，數字因此一致 |
| 兩個問題的判準在這裡先寫定，報告只套用：「haiku 能接長任務」成立，當關閉重注入的兩臂裡，haiku 的任務通過數與無違規 run 數都至少是 sonnet 的減一 | Task 11（`verdicts`，每個比較旁邊都印雜訊說明） |
| `README.md:205` 的 `bench/` 那一列補上 `bench/drift/`，因為 map 讀的就是這一列。 | Task 8 |
