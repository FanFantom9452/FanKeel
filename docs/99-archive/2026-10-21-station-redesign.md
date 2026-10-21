---
status: current
last_verified: 2026-10-22
source_of_truth: assets/station/station.js, lib/station.js, lib/detail.js, lib/todo.js, lib/spendrange.js, lib/tailscale.js, scripts/station.js
---

# Station redesign — plan

**Goal:** The station's pages redrawn chart-first from the approved route mockups, on data that is right first (archived plans found, Blocked due by `lib/todo.js`'s rule, cost per model), and the `tailscale serve` proxy torn down with the station.
**Architecture:** Data fixes in `lib/` land first, each with a unit test. `assets/station/station.js` hands its helpers to page modules through `window.FK_KIT` and the gate tab to `window.FK_GATE`; each redesigned page is its own IIFE module under `assets/station/` (the `remote-card.js` pattern), and the router in `station.js` sends a hash to a module when it is loaded and to the old view when it is not. `scripts/station.js` takes down the proxy it made when `station.remote` is written off and when it closes.
**Tech Stack:** Node `>=22.5` (`package.json` `engines`), no dependencies, `node:test`; the page is plain ES5-style browser JavaScript drawn as strings over `window.STATION`.
**Spec:** 2026-10-21-station-redesign-design.md

## Global Constraints

Taken from `node scripts/map.js` (`.fankeel/map.md`), `package.json`, the tests that assert them, and `git log`:

- Zero dependencies; Node `>=22.5` (`package.json` `"engines": { "node": ">=22.5" }`). Built-ins only (`node:fs`, `node:path`, `node:http`, `node:child_process`).
- Tests are `node --test`; the suite is `npm test` / `node scripts/suite.js`. An implementer runs only its own test file (`node --test tests/<file>.test.js`); the parent runs `node scripts/suite.js --fast` before committing a group.
- `lib/` is pure (no `process.exit`, no stdout); `scripts/` are thin CLIs over `lib/`. A new CLI flag needs its row in the reference page.
- Every exported name is imported by something (`tests/source.test.js:117`, `@slow`); tests count as importers, and `tracked()` is `git ls-files`, so `git add` every new file before running that test.
- `assets/station/station.js`: each `loc('<section>.<key>', '<中文>')` key carries its file section's prefix and has an English entry in `assets/station/i18n.js` (`tests/station-i18n.test.js:84`). A page module owns its English table and passes `stringsLeft(name, EN)` (`tests/station-module.js:38`): no bare CJK literal outside `loc()`, every EN entry used, no CJK in EN.
- `assets/station/station.js` is 6852 lines, over `READ_CAP` 1500 (`lib/plantasks.js:353`): a task writes it by a `path:a-b` range only. More than 3 `Modify:` files in a task is `FILE_CAP` (`lib/plantasks.js:354`).
- Everything above `if (!doc) return;` (`assets/station/station.js:2961`) runs under `require` in node; anything a module or test needs from `station.js` without a document goes above it.
- `lib/station.js` `EMITTED` is generated, never hand-edited.
- The version moves only through `node scripts/version.js`; no task bumps it.
- Commits: lowercase conventional prefix (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), and the message ends `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never feed code to an interpreter on stdin (`node -`, a heredoc into node); write a script file.
- Nothing invented reaches the real page (design, Rules): a figure the station has no field for is left out.

## Risks

- Line numbers in this plan are as of `fc25513a`; a neighbour commit on the shared checkout moves them — every task — the implementer greps the named function before editing and edits by function, not by line.
- `x.stamp <= today` in `homeTodo` is the wrong rule and `tests/station-home.test.js:108-127` pins its fixtures (stamp, `today` argument) — Task 3 — Task 3 rewrites those fixtures to `due`/`dueAt` in the same step and adds an entry stamped before today that is not due.
- `dueOf` drifting from `timings()`, the rule `scripts/todo-check.js` reads — Task 2 — the test runs both on the same condition line and asserts the same `due`.
- An archived plan matched by basename could pick up a different plan of the same name — Task 1 — the archive is looked in only when the claim's own file is gone and the claim is in the plan bucket; a plan still in the plan bucket wins (tested).
- `byModel` totals not summing to `usd` — Task 4 — the test asserts the sum of `byModel[].usd` equals `report().usd` and the token sums equal `tokens.main + tokens.agent`.
- Taking down a proxy the station did not make (`ensureServe` returned `already: true`) — Task 5 — teardown runs only when this run's `ensureServe` made the proxy (`madeServe`); tested with a pre-existing proxy.
- `SIGINT` handling inside `serve()` would end in-process test runs — Task 5 — the handler is installed only in `main()`'s `serve` verb.
- A failing `tailscale serve --https=443 off` blocking shutdown — Task 5 — `disable` never throws; the test makes it fail and asserts the server still closes.
- `FK_GATE.frame`'s argument shape is fixed here and consumed by the gate frame module — Task 3, Task 14 — Task 14 reads `{ session, gate, tasks, reportHtml, shellsHtml }` exactly as Task 3's Produces names it.
- The 3 s poll redraw closing an open dialog, the 30-day `days[]` window, `usd` vs `usd + agentUsd` on stage bars — Tasks 7–13 — each module test asserts against fixture totals.

## Task 1: Archived plan found

**Files:**
- Modify: `lib/detail.js:320-345` — `planFileOf` also finds a claimed plan that `land` moved into the `role: archive` bucket
- Read: `lib/docs.js` — `roleOf(tree, rel)` and the bucket shape `{ path, role }`
- Read: `tests/detail-tasks.test.js` — the fixture pattern (`tmp`, `.fankeel/docs.json`, `task()` helper)
- Test: `tests/detail-archived-plan.test.js`

**Interfaces:**
- Consumes: none
- Produces: `planFileOf(root, data, tree, projectRoot, claim)` unchanged in signature; `tasksOf(root, data, rows)` now returns a plan's tasks for a claim whose file was archived, with `plan` still the claim as written

**Dispatch:** implementer, opus

Steps:

1. Write the failing test. Create `tests/detail-archived-plan.test.js`:

In `tests/detail-archived-plan.test.js`:

```js
'use strict';
// Design §6: an archived plan is still found. `land` moves a plan into the
// project's `role: archive` bucket by its basename; the session's claim still
// names the plan bucket path, and its plan tab and landed card read tasksOf.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const detail = require('../lib/detail.js');
const tmp = require('./tmp.js');

const task = (n, name, file) => [
    '## Task ' + n + ': ' + name, '', '**Files:**', '- Modify: `' + file + '`', '',
    '**Interfaces:**', '- Consumes: none', '- Produces: none', '',
].join('\n');
const PLAN = '# X\n\n' + task(1, 'one', 'lib/a.js');
const BOTH = [{ path: 'docs/90-agent/plans', role: 'plan' }, { path: 'docs/99-archive', role: 'archive' }];
const CLAIM = 'docs/90-agent/plans/2026-10-01-x.md';

function repo(buckets) {
    const root = tmp('fankeel-archived-plan-');
    fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), JSON.stringify({ buckets }));
    fs.mkdirSync(path.join(root, 'docs', '99-archive'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', '99-archive', '2026-10-01-x.md'), PLAN);
    return root;
}

test('a plan moved into the archive bucket is found under the claim it was made with', () => {
    const got = detail.tasksOf(repo(BOTH), { claims: [CLAIM] }, []);
    assert.equal(got.length, 1);
    assert.equal(got[0].plan, CLAIM);
    assert.deepEqual(got[0].tasks.map((t) => [t.n, t.title]), [[1, 'one']]);
});

test('the archive is looked in only for a plan-bucket claim, never for a design, and only where docs.json declares one', () => {
    const root = repo(BOTH);
    assert.deepEqual(detail.tasksOf(root, { claims: ['docs/other/2026-10-01-x.md'] }, []), []);
    assert.deepEqual(detail.tasksOf(root, { claims: ['docs/90-agent/plans/2026-10-01-x-design.md'] }, []), []);
    assert.deepEqual(detail.tasksOf(root, { claims: ['docs/90-agent/plans/2026-10-02-gone.md'] }, []), []);
    const noArchive = repo([{ path: 'docs/90-agent/plans', role: 'plan' }]);
    assert.deepEqual(detail.tasksOf(noArchive, { claims: [CLAIM] }, []), []);
});

test('a plan still in the plan bucket wins over an archived file of the same name', () => {
    const root = repo(BOTH);
    fs.mkdirSync(path.join(root, 'docs', '90-agent', 'plans'), { recursive: true });
    fs.writeFileSync(path.join(root, CLAIM), PLAN + task(2, 'two', 'lib/b.js'));
    const got = detail.tasksOf(root, { claims: [CLAIM] }, []);
    assert.deepEqual(got[0].tasks.map((t) => t.n), [1, 2]);
});
```

2. Run it and watch the first test fail (`got.length` is 0):

```
node --test tests/detail-archived-plan.test.js
```

3. Write the implementation. In `lib/detail.js`, replace the comment above `planFileOf` and the function itself (`lib/detail.js:328-342` at `fc25513a`) with:

In `lib/detail.js`:

```js
// The file a claim names when it is a plan: a markdown file on disk, filed
// under the project's own `role: plan` bucket (`docs.roleOf`), and not the
// design beside it. A claim may be written from the registry root or from the
// project, so both are tried, as before; the bucket test is on the path
// relative to the project, which is where docs.json's buckets are rooted.
// A landed plan is archived: `land` moves it, by its basename, into the
// project's `role: archive` bucket, and the claim still names where it was.
// So when the claimed file is gone and the claim is in the plan bucket, each
// archive bucket is looked in for the same name (design §6). A plan still in
// the plan bucket is always the one taken.
function planFileOf(root, data, tree, projectRoot, claim) {
    if (!/\.md$/.test(claim) || /-design\.md$/.test(claim)) return null;
    const candidates = [path.resolve(root, claim)];
    if (data && data.project) candidates.push(path.resolve(root, data.project, claim));
    const hasPlan = tree && tree.buckets.some((b) => b.role === 'plan');
    const planTree = hasPlan ? tree : NO_TREE;
    const relOf = (f) => path.relative(projectRoot, f).split(path.sep).join('/');
    const file = candidates.find((f) => fs.existsSync(f));
    if (file) return docs.roleOf(planTree, relOf(file)) === 'plan' ? file : null;
    const archives = tree ? tree.buckets.filter((b) => b.role === 'archive') : [];
    if (!archives.length || !candidates.some((f) => docs.roleOf(planTree, relOf(f)) === 'plan')) return null;
    const name = path.basename(claim);
    for (const b of archives) {
        const archived = path.join(projectRoot, b.path, name);
        if (fs.existsSync(archived)) return archived;
    }
    return null;
}
```

4. Run it and watch it pass, then the neighbour that pins the plan bucket:

```
node --test tests/detail-archived-plan.test.js
node --test tests/detail-tasks.test.js
```

5. Commit:

```
git add tests/detail-archived-plan.test.js lib/detail.js
git commit -m "fix: an archived plan is still found by the claim it was made with" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 2: Blocked due from todo

**Files:**
- Modify: `lib/todo.js` — `dueOf(state, timing, stamp, now)`, the Blocked due rule `timings()` applies, for one entry; exported
- Modify: `lib/station.js:405-1170` — `todoOf(dir, now)` puts `due` and `dueAt` on every open entry; `gather()` passes its `now`; `todoOf` exported
- Read: `tests/station-todo-files.test.js` — the folder-mode fixture (`.fankeel/docs.json` with a `role: todo` bucket, `lib.add`)
- Test: `tests/todo-due.test.js`

**Interfaces:**
- Consumes: none
- Produces: `dueOf(state, timing, stamp, now)` in `lib/todo.js` → `{ due: boolean, dueAt: number|null }` (`dueAt` epoch ms, local midnight); `todoOf(dir, now)` exported from `lib/station.js`; every entry of a project's `todos[].open` on `window.STATION` carries `due` and `dueAt`

**Dispatch:** implementer, opus

Steps:

1. Write the failing test.

In `tests/todo-due.test.js`:

```js
'use strict';
// Design §6: home's Blocked count uses lib/todo.js's due rule — `on:` from its
// date, otherwise seven days after the stamp — the rule scripts/todo-check.js
// reads through `timings`. `dueOf` is that rule for one entry, and the
// station's `todoOf` carries it on every open entry as `due` and `dueAt`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const station = require('../lib/station.js');
const todo = require('../lib/todo.js');
const tmp = require('./tmp.js');

const at = (y, m, d) => new Date(y, m - 1, d).getTime();
const NOW = at(2026, 10, 22) + 9 * 3600e3;
const BODY = 'From the station, 2026-10-22: a question raised in the middle of a session and parked here. '
    + 'It should become one decided change, written down where the next session can pick it up. '
    + 'Done when the change lands and this entry is closed by the sha that landed it.';

test('dueOf: on: from its date, otherwise seven days after the stamp; only Blocked is ever due', () => {
    assert.deepEqual(todo.dueOf('blocked', 'after: the release', '2026-10-15', NOW), { due: true, dueAt: at(2026, 10, 22) });
    assert.deepEqual(todo.dueOf('blocked', 'after: the release', '2026-10-16', NOW), { due: false, dueAt: at(2026, 10, 23) });
    assert.deepEqual(todo.dueOf('blocked', 'on: 10-20 the review', '2026-10-01', NOW), { due: true, dueAt: at(2026, 10, 20) });
    assert.deepEqual(todo.dueOf('blocked', 'on: 10-30', '2026-10-20', NOW), { due: false, dueAt: at(2026, 10, 30) });
    assert.deepEqual(todo.dueOf('watch', 'after: x', '2026-01-01', NOW), { due: false, dueAt: null });
    assert.deepEqual(todo.dueOf('ready', '', '2026-01-01', NOW), { due: false, dueAt: null });
    assert.deepEqual(todo.dueOf('blocked', 'after: x', '', NOW), { due: false, dueAt: null });
});

test('dueOf agrees with timings, the rule todo-check reads, on the same condition line', () => {
    const cases = [['after: the release', '2026-10-15'], ['after: the release', '2026-10-16'],
        ['on: 10-20 the review', '2026-10-01'], ['on: 10-30', '2026-10-20'], ['', '2026-10-01']];
    for (const [cond, stamp] of cases) {
        const text = '## Blocked\n\n### waiting\n\n' + (cond ? cond + '. ' : '') + stamp.slice(5) + '.\n';
        const [t] = todo.timings(text, NOW);
        assert.equal(todo.dueOf('blocked', cond, stamp, NOW).due, t.due, cond + ' / ' + stamp);
    }
});

test('the station\'s todoOf carries due and dueAt on every open entry', () => {
    const dir = tmp('fankeel-todo-due-');
    fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'docs', 'todo'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [{ path: 'docs/todo', role: 'todo' }] }));
    todo.add(dir, { id: 'late-1', title: 'late', description: 'waits on a review', state: 'blocked', timing: 'on: 10-20 the review', stamp: '2026-10-01', body: BODY });
    todo.add(dir, { id: 'fresh-1', title: 'fresh', description: 'waits on a release', state: 'blocked', timing: 'after: the release', stamp: '2026-10-16', body: BODY });
    todo.add(dir, { id: 'ready-1', title: 'ready', description: 'can start now', state: 'ready', body: BODY });
    const got = station.todoOf(dir, NOW);
    const by = Object.fromEntries(got.open.map((e) => [e.id, { due: e.due, dueAt: e.dueAt }]));
    assert.deepEqual(by, {
        'late-1': { due: true, dueAt: at(2026, 10, 20) },
        'fresh-1': { due: false, dueAt: at(2026, 10, 23) },
        'ready-1': { due: false, dueAt: null },
    });
});
```

2. Run it and watch it fail (`todo.dueOf is not a function`):

```
node --test tests/todo-due.test.js
```

3. Write `dueOf`. In `lib/todo.js`, directly after the closing brace of `timings()` (`lib/todo.js:273` at `fc25513a`), add:

In `lib/todo.js`:

```js
// One entry's due rule, the one `timings` applies to a Blocked heading: an
// `on: MM-DD` condition is due from that day, anything else seven days after
// the stamp. Only Blocked is ever due. `timing` is the entry's condition line
// without its stamp, `stamp` its ISO day; the line is rebuilt the way the index
// writes it (`render`: `<timing>. <MM-DD>.`) and read by the same
// `conditionAt` / `dateAt`, so the station and todo-check cannot disagree.
// `dueAt` is the moment it falls due, local midnight; null when it never does.
function dueOf(state, timing, stamp, now) {
    const none = { due: false, dueAt: null };
    if (state !== 'blocked' || !ISO.test(String(stamp || ''))) return none;
    const [y, m, d] = stamp.split('-').map(Number);
    const stamped = new Date(y, m - 1, d).getTime();
    const line = String(timing || '').replace(/\s+/g, ' ').trim().replace(/\.$/, '');
    const cond = conditionAt((line ? line + '. ' : '') + stamp.slice(5) + '.');
    const date = cond && cond.kind === 'on' ? dateAt(cond.event, stamped) : null;
    const dueAt = date !== null ? date : stamped + REREAD_DAYS * 86400000;
    return { due: (now === undefined ? Date.now() : now) >= dueAt, dueAt };
}
```

Then add `dueOf` to `module.exports` (`lib/todo.js:671-675`), after `timings`:

In `lib/todo.js`:

```js
module.exports = {
    MAX_ENTRY_CHARS, MIN_BODY_CHARS, SECTIONS, TIMED, RETIRED, STALE_DAYS, REREAD_DAYS, MAX_TITLE_WIDTH, COMPLETIONS_PAGE,
    STATES, ID, ISO, DATE, conditionAt, mmdd, linksIn, entries, timings, dueOf, bodyChars,
    isoDay, folderOf, parse, serialize, readFolder, render, fromLine, add, close, recordOf, load, migrate,
};
```

4. Carry it on the station's entries. In `lib/station.js`, replace `todoOf` (`lib/station.js:411-448` at `fc25513a`, the comment and the function) with:

In `lib/station.js`:

```js
// One project directory's TODO entries for the project page, both modes
// through `load`: `open` always, in the index's order; `done` only where the
// project keeps entry files. null where the directory has neither. Every open
// entry carries `due` and `dueAt` from `todoFiles.dueOf` — the Blocked rule
// todo-check reads — so the page never re-derives it from the stamp.
function todoOf(dir, now) {
    const at = typeof now === 'number' ? now : Date.now();
    let loaded;
    try {
        loaded = todoFiles.load(dir);
    } catch (e) {
        return { mode: 'error', folder: null, open: [], done: [], error: String((e && e.message) || e) };
    }
    if (!loaded) return null;
    if (loaded.mode === 'folder') {
        const rank = new Map(loaded.entries.map((e, i) => [e.id, i]));
        const order = (e) => (rank.has(e.id) ? rank.get(e.id) : Infinity);
        const bodyOf = new Map(loaded.all.map((e) => [e.id, e.body || '']));
        return {
            mode: 'folder', folder: loaded.folder,
            open: loaded.all.filter((e) => e.state !== 'done').sort((a, b) => order(a) - order(b)).map((e) => Object.assign({
                id: e.id, label: e.label, title: e.title, description: e.description, state: e.state,
                condition: e.timing, stamp: e.stamp, body: e.body || '',
            }, todoFiles.dueOf(e.state, e.timing, e.stamp, at))),
            done: loaded.done.map((e) => ({ id: e.id, label: e.label, title: e.title, at: e.at, sha: e.sha,
                disposition: e.disposition, session: e.session, body: todoFiles.recordOf(bodyOf.get(e.id) || '') || bodyOf.get(e.id) || '' })),
        };
    }
    const byLine = new Map(loaded.timings.map((t) => [t.line, t]));
    return {
        mode: 'file', folder: null,
        open: loaded.entries.map((e) => {
            const f = todoFiles.fromLine(e.text, '', STATE_OF_SECTION[e.section] || '');
            const t = e.timing === null ? null : byLine.get(e.timing);
            const condition = t && t.kind ? t.kind + ': ' + (t.event || '') : '';
            const stamp = t && t.stamp !== null ? todoFiles.isoDay(t.stamp) : '';
            return Object.assign({ id: null, label: f.label, title: f.title, description: f.description, state: f.state,
                condition, stamp, body: '' }, todoFiles.dueOf(f.state, condition, stamp, at));
        }),
        done: [],
    };
}
```

In `gather()`, the call (`lib/station.js:667` at `fc25513a`) becomes `todoOf(dir, now)` — `now` is `gather`'s own (`lib/station.js:468`):

In `lib/station.js`:

```js
            const t = todoOf(dir, now);
```

And add `todoOf` to the `module.exports` line (`lib/station.js:1170`):

In `lib/station.js`:

```js
module.exports = { discover, gather, render, serialize, serializeDetail, write, scanRoots, readRoots, rootsPath, boardPath, rememberRoots, EMITTED, hiddenPkeys, parseMapCard, DETAIL_BUDGET_MS, focusOf, serializeFocus, focusShell, FOCUS_TABS, todoOf };
```

5. Run it and watch it pass, then the station's two TODO neighbours:

```
node --test tests/todo-due.test.js
node --test tests/station-todo-files.test.js tests/todo-check-folder.test.js
```

6. Commit:

```
git add tests/todo-due.test.js lib/todo.js lib/station.js
git commit -m "fix: todo entries carry due and dueAt by todo-check's Blocked rule" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 3: Kit, due on home, gate hand-off

**Files:**
- Modify: `assets/station/station.js:2860-3530` — `FK_KIT` gains the helpers the redesigned page modules draw with; `homeTodo` lists the Blocked entries whose `due` is true, soonest `dueAt` first; `focusPageHtml` hands the gate tab to `window.FK_GATE.frame` when that module is loaded
- Read: `lib/gatereport.js` — `parseReport`, `derive` for the gate fixture
- Read: `tests/station-focus-page.test.js` — the `global.window` + `require` pattern and the gate fixture
- Test: `tests/station-kit.test.js`
- Test: `tests/station-home.test.js` — the home-todo fixtures move from `stamp` + `today` to `due` / `dueAt`

**Interfaces:**
- Consumes: `due`, `dueAt` on each `todos[].open` entry (Task 2)
- Produces: `window.FK_KIT.cost(s)` → `s.usd + s.agentUsd`; `window.FK_KIT.usd`, `mins`, `ago`, `stamp`, `keelGlyph(o)`, `shortLabel(full)`, `projectHash(pkey)`, `family(model)`, `modelKey(model)`, `modelLabel(key)`, `icon(name)`, `loc(key, zh, vars)`, `ROUTE`; `focusReportHtml(s, g, tasks)` → the `gate-report` section; `window.FK_GATE.frame({ session, gate, tasks, reportHtml, shellsHtml })` → string, called by `focusPageHtml` for `tab === 'gate'` when `window.FK_GATE` is loaded; `homeTodo(projects)` (no `today` argument)

**Dispatch:** implementer, opus

Steps:

1. Write the failing test.

In `tests/station-kit.test.js`:

```js
'use strict';
// station.js hands the redesigned pages' modules what they draw with
// (window.FK_KIT; design §6: a session's cost is usd + agentUsd on every page),
// and the focus page's gate tab to window.FK_GATE when gate-frame.js is loaded
// (design §5). Without that module the gate tab is the old one.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseReport, derive } = require('../lib/gatereport.js');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const V = require('../assets/station/station.js');

const SID = 'abababab-1111-4111-8111-111111111111';
const ROW = { id: SID, task: 'kit', stage: 'survey', route: ['survey', 'design', 'land'], state: 'live', step: 1, steps: 3 };
const G = { stage: 'survey', path: '.fankeel/build/task-20261022T090000/survey.md', text: 'what is here\n',
    gate: { questions: [{ header: 'Survey', question: 'Go on to design?', multiSelect: false,
        options: [{ label: 'Design next (Recommended)', description: 'the route goes on' }, { label: 'Stop here', description: 'stand down' }] }], next: 'design' },
    parts: derive('survey', parseReport('survey', 'what is here\n')) };

test('FK_KIT carries the session cost as usd + agentUsd and the helpers the page modules share', () => {
    const K = window.FK_KIT;
    for (const k of ['cost', 'usd', 'mins', 'ago', 'stamp', 'keelGlyph', 'shortLabel', 'projectHash', 'family', 'modelKey', 'modelLabel', 'icon', 'loc']) {
        assert.equal(typeof K[k], 'function', k);
    }
    assert.deepEqual(Array.from(K.ROUTE), ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land']);
    assert.equal(K.cost({ usd: 1.25, agentUsd: 0.5 }), 1.75);
    assert.equal(K.cost({ usd: 2 }), 2);
    assert.equal(K.cost, V.cost);
    assert.equal(K.projectHash('F:\\ws\\a'), '#/p/F%3A%5Cws%5Ca');
    assert.match(K.keelGlyph({}), /^<svg class="glyph/);
    assert.equal(K.loc('x.none', '{n} 個', { n: 2 }), '2 個');
});

test('the gate tab is FK_GATE.frame\'s when it is loaded, handed the report station.js drew; the plan tab never is', () => {
    const st = { sessions: [ROW] };
    const details = { [SID]: { tasks: [], gate: G } };
    const old = V.focusPageHtml(st, details, { id: SID, tab: 'gate' });
    assert.match(old, /data-block="gate-question"/, 'no module: the old gate page');
    let got = null;
    window.FK_GATE = { frame(o) { got = o; return '<main data-block="gate-frame"></main>'; } };
    try {
        assert.equal(V.focusPageHtml(st, details, { id: SID, tab: 'gate' }), '<main data-block="gate-frame"></main>');
        assert.equal(got.session.id, SID);
        assert.equal(got.gate, G);
        assert.deepEqual(got.tasks, []);
        assert.equal(got.shellsHtml, '');
        assert.match(got.reportHtml, /^<section class="panel pv gv gr" data-block="gate-report">/);
        assert.doesNotMatch(got.reportHtml, /data-block="gate-question"/);
        got = null;
        assert.match(V.focusPageHtml(st, details, { id: SID, tab: 'plan' }), /data-block="focus-plan"/);
        assert.equal(got, null);
    } finally {
        delete window.FK_GATE;
    }
});
```

Then in `tests/station-home.test.js`, replace the home-todo fixtures and the two tests that call `homeTodo` (`tests/station-home.test.js:108-127` at `fc25513a`, from `const e = ` through the end of `'home-todo and the project page agree on how many entries are Ready'`) with:

In `tests/station-home.test.js`:

```js
// Each entry as lib/station.js `todoOf` hands it over: `due` and `dueAt` from
// lib/todo.js `dueOf` (design §6). `a-7` was stamped before today but is not
// due yet — the case the old `stamp <= today` rule listed.
const day = (m, d) => new Date(2026, m - 1, d).getTime();
const e = (id, title, state, stamp, dueAt) => ({ id, label: '', title, description: '', state, condition: state === 'blocked' ? 'waits on x' : '',
    stamp: stamp || '', due: dueAt != null && dueAt <= NOW, dueAt: dueAt == null ? null : dueAt });
const ALPHA = { pkey: 'F:\\ws\\alpha', mode: 'folder', folder: 'docs/todo', done: [], open: [e('a-1', 'A one', 'ready'), e('a-2', 'A two', 'ready'),
    e('a-3', 'A three', 'ready'), e('a-4', '**A** four', 'ready'), e('a-5', 'A due', 'blocked', '2026-10-05', day(10, 12)),
    e('a-6', 'A later', 'blocked', '2026-11-24', day(12, 1)), e('a-7', 'A stamped', 'blocked', '2026-10-15', day(10, 22))] };
const BETA = { pkey: 'F:\\ws\\beta', mode: 'folder', folder: 'docs/todo', done: [], open: [e('b-1', 'B one', 'ready'), e('b-2', 'B due', 'blocked', '2026-10-13', day(10, 20))] };

test('home-todo counts Ready across projects, most first, and lists only the Blocked entries lib/todo.js calls due', () => {
    const { V } = boot();
    const html = V.homeTodo([{ root: 'F:\\ws\\beta', todos: [BETA] }, { root: 'F:\\ws\\alpha', todos: [ALPHA] }]);
    assert.match(html, /<div class="hm-td-big"><b>5<\/b><span>筆 Ready，分在 2 個專案<\/span><\/div>/);
    assert.match(html, /<a href="#\/p\/F%3A%5Cws%5Calpha" data-tdlg="F:\\ws\\alpha" aria-haspopup="dialog">alpha <b>4<\/b><\/a><a href="#\/p\/F%3A%5Cws%5Cbeta"/);
    assert.match(html, /<b>Blocked 到期<\/b><span>重看日已到，2 筆<\/span>/);
    assert.ok(html.indexOf('A due') < html.indexOf('B due'), 'soonest due first');
    assert.doesNotMatch(html, /A later/);
    assert.doesNotMatch(html, /A stamped/, 'stamped before today is not due: due is seven days after the stamp');
    assert.match(html, /<a class="hm-tdb" href="#\/p\/F%3A%5Cws%5Calpha\/todo\/a-5"><span class="hm-tdb-t">A due<\/span><span class="hm-tdb-m">alpha · blocked · waits on x<\/span><span class="hm-tdb-d">到期 10-12<\/span><\/a>/);
    assert.match(V.homeTodo([]), /沒有 Ready 的條目/);
});

test('home-todo and the project page agree on how many entries are Ready', () => {
    const { V } = boot();
    const home = Number(/<div class="hm-td-big"><b>(\d+)<\/b>/.exec(V.homeTodo([{ todos: [ALPHA] }]))[1]);
    const panel = Number(/<b class="mono">Ready<\/b><span class="mute">(\d+) 筆/.exec(V.todoPanelHtml(ALPHA, []))[1]);
    assert.equal(home, 4);
    assert.equal(home, panel);
});
```

2. Run both and watch them fail (`FK_KIT.cost` undefined; `A stamped` listed):

```
node --test tests/station-kit.test.js tests/station-home.test.js
```

3. Write the gate hand-off. In `assets/station/station.js`, replace `focusGateHtml` and `focusPageHtml` (`assets/station/station.js:2871-2903` at `fc25513a`, from the comment `// The gate first:` through the end of `focusPageHtml`) with:

In `assets/station/station.js`:

```js
    // The 關卡 tab's report under its own head, without the tab's banner: the
    // question is drawn elsewhere — above it here, beside it in gate-frame.js.
    function focusReportHtml(s, g, tasks) {
        var stage = g && g.stage ? g.stage : s.stage || '';
        // gateTabHtml with no wait on the row draws its head, not its banner.
        var calm = Object.assign({}, s, { gateAt: null, pending: null });
        return '<section class="panel pv gv gr" data-block="gate-report"><div class="gr-hd"><h2>' + loc('focus.report', '{s} 報告', { s: esc(stage) }) + '</h2></div>'
            + gateTabHtml(calm, g, tasks) + '</section>';
    }
    // The gate first: its question and options as the session will ask them,
    // then the report under it.
    function focusGateHtml(s, g, tasks) {
        var REC = /\s*\(Recommended\)\s*$/;
        var q = g && g.gate && g.gate.questions && g.gate.questions[0] ? g.gate.questions[0] : null;
        var stage = g && g.stage ? g.stage : s.stage || '';
        var st = '<span class="gv-st" style="--c:var(--st-' + esc(stage) + ')">' + esc(stage) + '</span>';
        var opts = q && Array.isArray(q.options) ? '<ol class="gq-opts">' + q.options.map(function (o, i) {
            var label = String(o && o.label || ''), rec = REC.test(label);
            return '<li class="' + (rec ? 'is-rec' : '') + '"><span class="gq-n num">' + (i + 1) + '</span><div><p class="gq-l">' + esc(label.replace(REC, ''))
                + (rec ? '<span class="gq-rec">' + loc('focus.rec', '建議') + '</span>' : '') + '</p>'
                + (o && o.description ? '<p class="gq-d">' + esc(o.description) + '</p>' : '') + '</div></li>';
        }).join('') + '</ol>' : '';
        var ask = '<section class="panel pv gq" data-block="gate-question"><div class="pv-banner"><div class="pv-q"><span class="pill gate">' + icon('gate') + 'gate</span>'
            + (q && q.header ? '<span class="chip">' + esc(q.header) + '</span>' : '') + '</div>'
            + '<h2 class="gq-h">' + loc('focus.gateQ', '{st} gate：{q}', { st: st, q: q ? esc(q.question) : loc('focus.noQ', '報告裡沒有讀得出的 gate 問題') }) + '</h2>'
            + opts
            + (g && g.gate && g.gate.next ? '<p class="gq-next"><span>' + loc('focus.reportNext', '報告寫的下一步') + '</span>' + esc(g.gate.next) + '</p>' : '')
            + '<p class="pv-where"><i class="hatchsw" aria-hidden="true"></i><span>' + loc('focus.where', '回答在 Claude Desktop 那邊給；這頁只讓你看清楚要核准什麼，不收答案。') + '</span></p></div></section>';
        return ask + focusReportHtml(s, g, tasks);
    }
    function focusPageHtml(st, details, focus) {
        var s = ((st && st.sessions) || []).filter(function (x) { return x.id === focus.id; })[0];
        if (!s) return '<main class="fm"><section class="panel"><p class="note">' + loc('focus.noSession', '這頁上沒有 session {id}', { id: esc(focus.id) }) + '</p></section></main>';
        var x = (details || {})[s.id] || { tasks: [], gate: null };
        var gate = focus.tab === 'gate';
        // Background shells sit under the header (design §5), drawn by Task 5's shellsHtml.
        var shells = x.shells && x.shells.length ? shellsHtml(x.shells, Date.now()) : '';
        // The redesigned gate page (station redesign §5) is assets/station/gate-frame.js:
        // loaded, it draws the whole tab — its own head with no tabs, the report
        // in the main column, the question in the side column — around the
        // report drawn here, which only station.js can draw.
        if (gate && w.FK_GATE && typeof w.FK_GATE.frame === 'function') {
            return w.FK_GATE.frame({ session: s, gate: x.gate, tasks: x.tasks || [], reportHtml: focusReportHtml(s, x.gate, x.tasks || []), shellsHtml: shells });
        }
        return focusHeader(s, focus.tab) + shells + '<main class="fm" data-block="focus-' + (gate ? 'gate' : 'plan') + '">'
            + (gate ? focusGateHtml(s, x.gate, x.tasks || []) : focusPlanHtml(x.tasks)) + '</main>';
    }
```

4. Hand the kit over. In `assets/station/station.js`, directly above the comment `// ---- tune: a block changed, continued: what the tests import` (`assets/station/station.js:2924` at `fc25513a`, above `if (!doc) return;`), add:

In `assets/station/station.js`:

```js
    // What the redesigned pages' modules (assets/station/*-page.js, tip.js,
    // gate-frame.js) draw with, beside the spend modules' helpers above: a
    // session's cost is `usd + agentUsd` on every page (station redesign §6), and
    // the glyph, chips, ages and links are the ones the old pages drew. All
    // hoisted declarations, so this one assign sees them even though some are
    // written further down; it sits above `if (!doc) return;` so a module test
    // under `require` has them too.
    Object.assign(w.FK_KIT, { cost: cost, usd: usd, mins: mins, ago: ago, stamp: stamp, keelGlyph: keelGlyph, shortLabel: shortLabel,
        projectHash: projectHash, family: family, modelKey: modelKey, modelLabel: modelLabel, icon: icon, loc: loc, ROUTE: ROUTE });
```

5. Put `homeTodo` on `due`. In `assets/station/station.js`, replace the comment above `homeTodo` and the function (`assets/station/station.js:3267-3297` at `fc25513a`) with:

In `assets/station/station.js`:

```js
    // home-todo: the Ready count off every project's `todos`, the rows the
    // project page's TODO panel reads, one chip per project (the quick look
    // opens from it, `data-tdlg`); then the Blocked entries lib/todo.js `dueOf`
    // calls due — `on:` from its date, otherwise seven days after the stamp,
    // the rule todo-check reads (station redesign §6) — soonest first, each
    // with the day it fell due.
    function homeTodo(projects) {
        var by = {}, order = [], due = [];
        var plain = function (s) { return String(s == null ? '' : s).split('**').join(''); };
        (projects || []).forEach(function (p) {
            (p.todos || []).forEach(function (t) {
                (t && t.open || []).forEach(function (x) {
                    if (x.state === 'ready') { if (!by[t.pkey]) { by[t.pkey] = 0; order.push(t.pkey); } by[t.pkey]++; }
                    if (x.state === 'blocked' && x.due === true) due.push({ x: x, pkey: t.pkey });
                });
            });
        });
        order.sort(function (a, b) { return by[b] - by[a]; });
        due.sort(function (a, b) { return (a.x.dueAt || 0) - (b.x.dueAt || 0); });
        var total = order.reduce(function (n, k) { return n + by[k]; }, 0);
        return '<section class="dcard" data-block="home-todo" aria-label="TODO"><div class="dcard-h">' + icon('check') + '<b>TODO</b></div>'
            + '<div class="hm-td-big"><b>' + total + '</b><span>' + loc('dash.nReadyInP', '筆 Ready，分在 {p} 個專案', { p: order.length }) + '</span></div>'
            + (order.length ? '<div class="hm-td-pr">' + order.map(function (k) {
                return '<a href="' + projectHash(k) + '" data-tdlg="' + esc(k) + '" aria-haspopup="dialog">' + esc(shortLabel(k)) + ' <b>' + by[k] + '</b></a>';
            }).join('') + '</div>' : '<p class="dnone">' + loc('dash.noReady', '沒有 Ready 的條目') + '</p>')
            + (due.length ? '<div class="hm-td-h"><b>' + loc('dash.blockedDue', 'Blocked 到期') + '</b><span>' + loc('dash.blockedDueN', '重看日已到，{n} 筆', { n: due.length }) + '</span></div>'
                + due.map(function (r) {
                    return '<a class="hm-tdb" href="' + projectHash(r.pkey) + '/todo/' + encodeURIComponent(r.x.id || '') + '"><span class="hm-tdb-t">' + esc(plain(r.x.title)) + '</span>'
                        + '<span class="hm-tdb-m">' + esc(shortLabel(r.pkey)) + ' · blocked' + (r.x.condition ? ' · ' + esc(plain(r.x.condition)) : '') + '</span>'
                        + '<span class="hm-tdb-d">' + loc('dash.dueOn', '到期 {d}', { d: esc(r.x.dueAt ? localDay(r.x.dueAt).slice(5) : '') }) + '</span></a>';
                }).join('') : '') + '</section>';
    }
```

And its one caller in `dashPage` (`assets/station/station.js:3523` at `fc25513a`) drops the `today` argument:

In `assets/station/station.js`:

```js
            + '</div><div class="dcol" data-col="side">' + homeTodo(S.projects) + homeSpend(R, now) + '</div></div>';
```

6. Run them and watch them pass, then the neighbours that draw the focus page and pin i18n keys:

```
node --test tests/station-kit.test.js tests/station-home.test.js
node --test tests/station-focus-page.test.js tests/station-i18n.test.js
```

7. Commit:

```
git add tests/station-kit.test.js tests/station-home.test.js assets/station/station.js
git commit -m "feat: station kit for page modules, home Blocked by due, gate tab hand-off" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 4: spendrange byModel

**Files:**
- Modify: `lib/spendrange.js` — `sessionRow` keeps cost and tokens per model id; `report()` returns `byModel`
- Read: `lib/detail.js` — `rowCost(models)` (`lib/detail.js:505`), the per-kind cost of a `{ [modelId]: usage }` map
- Read: `lib/usage.js` — `splitOf(models)` (`lib/usage.js:492`), the per-kind tokens of the same map
- Read: `tests/spendrange.test.js` — the transcript fixture (`ask`, `call`, `U`)
- Test: `tests/spendrange-models.test.js`

**Interfaces:**
- Consumes: none
- Produces: `report(configDir, range, opts).byModel` → `[{ model: string, cost: { input, output, cacheRead, cacheWrite5m, cacheWrite1h }, tokens: { input, output, cacheRead, cacheWrite5m, cacheWrite1h }, usd: number, share: number }]`, sorted by `usd` descending then `model`; main session and agents together

**Dispatch:** implementer, opus

Steps:

1. Write the failing test.

In `tests/spendrange-models.test.js`:

```js
'use strict';
// Design §6: lib/spendrange.js report() adds byModel — cost and token totals
// per model across the range, the session's own requests and its agents'
// together, from the per-session model usage it already reads.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const compare = require('../lib/compare.js');
const spendrange = require('../lib/spendrange.js');
const tmp = require('./tmp.js');

const at = (mo, d, h) => new Date(2026, mo - 1, d, h).toISOString();
const line = (o) => JSON.stringify(o) + '\n';
const ask = (text, t) => line({ type: 'user', timestamp: t, message: { role: 'user', content: text } });
const call = (id, t, model, u, side) => line(Object.assign({ type: 'assistant', requestId: id, timestamp: t, message: { model, usage: u } }, side ? { isSidechain: true } : {}));
const U = (input, output, read, w5m, w1h) => ({ input_tokens: input, output_tokens: output, cache_read_input_tokens: read,
    cache_creation: { ephemeral_5m_input_tokens: w5m, ephemeral_1h_input_tokens: w1h } });
const KINDS = ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' vs ' + b);

function fixture() {
    const cfg = tmp('fankeel-spendrange-models-');
    const dir = path.join(cfg, 'projects', 'F--proj');
    const sub = path.join(dir, 's1', 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(dir, 's1.jsonl'), ask('第一則', at(10, 14, 9))
        + call('r1', at(10, 14, 10), 'claude-opus-5-5', U(10, 100, 0, 0, 50000))
        + call('r2', at(10, 14, 11), 'claude-opus-5-5', U(5, 200, 50000, 0, 2000)));
    for (const id of ['a1', 'b2']) {
        fs.writeFileSync(path.join(sub, 'agent-' + id + '.jsonl'), call('r' + id, at(10, 14, 10), 'claude-sonnet-5-5', U(3, 300, 10000, 20000, 0), true));
        fs.writeFileSync(path.join(sub, 'agent-' + id + '.meta.json'), JSON.stringify({ agentType: 'implementer' }));
    }
    fs.writeFileSync(path.join(dir, 's2.jsonl'), ask('另一個', at(10, 16, 9)) + call('r3', at(10, 16, 10), 'claude-opus-5-5', U(1, 1000, 400000, 0, 1000)));
    // The week before: not in the range, so not in byModel.
    fs.writeFileSync(path.join(dir, 's3.jsonl'), call('r4', at(10, 8, 10), 'claude-opus-5-5', U(1, 10, 0, 0, 100)));
    return cfg;
}

test('byModel: one row a model, main and agents together, tokens and cost by kind, inside the range only', () => {
    const rep = spendrange.report(fixture(), compare.parseRange('2026-10-13..2026-10-19'));
    assert.deepEqual(rep.byModel.map((m) => m.model).sort(), ['claude-opus-5-5', 'claude-sonnet-5-5']);
    const by = Object.fromEntries(rep.byModel.map((m) => [m.model, m]));
    assert.deepEqual(by['claude-opus-5-5'].tokens, { input: 16, output: 1300, cacheRead: 450000, cacheWrite5m: 0, cacheWrite1h: 53000 });
    assert.deepEqual(by['claude-sonnet-5-5'].tokens, { input: 6, output: 600, cacheRead: 20000, cacheWrite5m: 40000, cacheWrite1h: 0 });
    for (const m of rep.byModel) near(m.usd, KINDS.reduce((n, k) => n + m.cost[k], 0));
});

test('byModel sums to the range total, its shares to one, most costly first', () => {
    const rep = spendrange.report(fixture(), compare.parseRange('2026-10-13..2026-10-19'));
    near(rep.byModel.reduce((n, m) => n + m.usd, 0), rep.usd);
    near(rep.byModel.reduce((n, m) => n + m.share, 0), 1);
    for (const k of KINDS) assert.equal(rep.byModel.reduce((n, m) => n + m.tokens[k], 0), rep.tokens.main[k] + rep.tokens.agent[k], k);
    for (let i = 1; i < rep.byModel.length; i++) assert.ok(rep.byModel[i - 1].usd >= rep.byModel[i].usd);
});

test('an empty range has an empty byModel', () => {
    const rep = spendrange.report(fixture(), compare.parseRange('2026-10-01..2026-10-02'));
    assert.deepEqual(rep.byModel, []);
});
```

2. Run it and watch it fail (`rep.byModel` undefined):

```
node --test tests/spendrange-models.test.js
```

3. Write the implementation. In `lib/spendrange.js`, add below `const sum = ...` (`lib/spendrange.js:25`):

In `lib/spendrange.js`:

```js
// Cost and tokens per model id, added into `into`: what `byModel` sums. One
// model at a time through the same `rowCost` and `splitOf` the totals use, so
// the per-model figures add up to them.
function modelsInto(into, models) {
    for (const [id, m] of Object.entries(models || {})) {
        const one = { [id]: m };
        const x = into[id] || (into[id] = { cost: blank(), tokens: blank() });
        addInto(x.cost, detail.rowCost(one));
        addInto(x.tokens, usage.splitOf(one));
    }
    return into;
}
```

In `sessionRow`, collect the models while the agents are read, and return them on the row. Replace the agents loop and the `return {` object (`lib/spendrange.js:43-61` at `fc25513a`) with:

In `lib/spendrange.js`:

```js
    const agents = [];
    const models = {};
    for (const f of dir ? usage.agentFiles(dir) : []) {
        const seen = usage.summarise(f, { sidechain: true });
        if (!seen) continue;
        agents.push({ type: usage.agentTypeOf(f), cost: detail.rowCost(seen.usage.models) || blank(), tokens: usage.splitOf(seen.usage.models) });
        modelsInto(models, seen.usage.models);
    }
    if (!own && !agents.length) return null;
    if (own) modelsInto(models, own.usage.models);
    const series = own && own.series ? own.series : [];
    const mainTokens = own ? usage.splitOf(own.usage.models) : blank();
    const turns = own ? own.usage.requests : 0;
    return {
        id: path.basename(file, '.jsonl'), file, project: path.basename(path.dirname(file)), start: span.first,
        main: (own && detail.rowCost(own.usage.models)) || blank(), mainTokens, agents, turns, models,
        // The judgement's measures: average context is the main session's
        // cache reads over its requests, the peak its largest single request.
        avgCtx: turns ? mainTokens.cacheRead / turns : 0,
        peak: series.reduce((m, r) => (r.context > m ? r.context : m), 0),
    };
```

In `report()`, after the `types` sort (`lib/spendrange.js:113-115`), add:

In `lib/spendrange.js`:

```js
    const perModel = new Map();
    for (const r of mine) {
        for (const [id, x] of Object.entries(r.models || {})) {
            const t = perModel.get(id) || { model: id, cost: blank(), tokens: blank() };
            addInto(t.cost, x.cost);
            addInto(t.tokens, x.tokens);
            perModel.set(id, t);
        }
    }
    const byModel = [...perModel.values()]
        .map((t) => Object.assign(t, { usd: sum(t.cost), share: share(sum(t.cost)) }))
        .sort((a, b) => b.usd - a.usd || (a.model < b.model ? -1 : 1));
```

and put it on the returned object, beside `types`:

In `lib/spendrange.js`:

```js
        sessions: mine.length, usd, kinds, tokens, types, byModel,
```

Add to the file's header comment, after `(station-31),`: `by model — the session's own requests and its agents' together (station redesign §6),`.

4. Run it and watch it pass, then the range report's own test:

```
node --test tests/spendrange-models.test.js tests/spendrange.test.js
```

5. Commit:

```
git add tests/spendrange-models.test.js lib/spendrange.js
git commit -m "feat: spend range report adds byModel" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 5: Serve torn down

**Files:**
- Modify: `lib/tailscale.js` — `disable(run)` runs `tailscale serve --https=443 off`; a failure is a warning, never a throw
- Modify: `scripts/station.js:330-1160` — `madeServe` remembers a proxy this run made; `teardownRemote()` runs on `station.remote` written off, in `close()`, and on the idle exit; `main()`'s `serve` verb closes on `SIGINT` / `SIGTERM`
- Modify: `docs/90-agent/reference/station.md:1430-1460` — the remote paragraph says the proxy comes down with the station
- Read: `tests/station-remote.test.js` — the fixture, `fakeTailscale`, and the nonce read through `station/station-data.js`
- Read: `lib/profile.js` — `machineFile(configDir)`
- Test: `tests/tailscale-disable.test.js`
- Test: `tests/station-remote-teardown.test.js`

**Interfaces:**
- Consumes: none
- Produces: `disable(run)` in `lib/tailscale.js` → `{ ok: true }` or `{ ok: false, warning: string }`; stderr line `station: tailscale serve left on — <warning>` from `scripts/station.js`

**Dispatch:** implementer, opus

Steps:

1. Write the failing tests.

In `tests/tailscale-disable.test.js`:

```js
'use strict';
// Design §7: lib/tailscale.js gains disable(), `tailscale serve --https=443 off`.
// `run` is faked: no test runs the real tailscale.
const test = require('node:test');
const assert = require('node:assert/strict');
const tailscale = require('../lib/tailscale.js');

test('disable runs tailscale serve --https=443 off', () => {
    const calls = [];
    const got = tailscale.disable((args) => { calls.push(args.join(' ')); return { status: 0, stdout: '', stderr: '' }; });
    assert.deepEqual(got, { ok: true });
    assert.deepEqual(calls, ['serve --https=443 off']);
});

test('a failed or missing tailscale is a warning, never a throw', () => {
    assert.deepEqual(tailscale.disable(() => ({ status: 1, stdout: '', stderr: 'handler does not exist\nsecond line' })),
        { ok: false, warning: 'tailscale serve --https=443 off failed: handler does not exist' });
    assert.deepEqual(tailscale.disable(() => ({ status: null, stdout: '', stderr: 'spawnSync tailscale ENOENT' })),
        { ok: false, warning: 'tailscale serve --https=443 off failed: spawnSync tailscale ENOENT' });
});
```

In `tests/station-remote-teardown.test.js`:

```js
'use strict';
// station-remote-1, design §7: the `tailscale serve` proxy this station made
// comes down with it — when station.remote is written off, when it closes,
// when it exits idle — and one it found already there is left on. A failed
// teardown is one stderr line and never blocks shutdown. tailscale is faked.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const profile = require('../lib/profile.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const NAME = 'ymlab-pc.tail1234.ts.net';
const OFF = 'serve --https=443 off';

function fixture(remoteOn) {
    const base = tmp('fankeel-station-teardown-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: '2026-10-21T08:00:00.000Z' }) + '\n');
    if (remoteOn) fs.writeFileSync(profile.machineFile(cfg), JSON.stringify({ 'station.remote': true }) + '\n');
    return { cfg, r1 };
}

// tailscale's CLI as lib/tailscale.js calls it. `pre()` names a port whose
// proxy is in the serve config before the station asks; `offFails` makes the
// teardown fail.
function fakeTailscale(o) {
    const opts = o || {};
    const calls = [];
    const proxy = (port) => ({ TCP: { 443: { HTTPS: true } }, Web: { [NAME + ':443']: { Handlers: { '/': { Proxy: 'http://127.0.0.1:' + port } } } } });
    let config = {};
    const run = (args) => {
        const line = args.join(' ');
        calls.push(line);
        if (args[0] === 'status') return { status: 0, stdout: JSON.stringify({ BackendState: 'Running', Self: { DNSName: NAME + '.' } }), stderr: '' };
        if (line === 'serve status --json') return { status: 0, stdout: JSON.stringify(opts.pre ? proxy(opts.pre()) : config), stderr: '' };
        if (args[0] === 'serve' && args[1] === '--bg') { config = proxy(args[2]); return { status: 0, stdout: '', stderr: '' }; }
        if (line === OFF) {
            if (opts.offFails) return { status: 1, stdout: '', stderr: 'tailscale: access denied' };
            config = {};
            return { status: 0, stdout: '', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: 'unexpected: ' + line };
    };
    return { run, calls, count: (l) => calls.filter((c) => c === l).length };
}

const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => { let text = ''; res.setEncoding('utf8'); res.on('data', (c) => { text += c; }); res.on('end', () => resolve(text)); }).on('error', reject);
});
const post = (url, body) => new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } }, (res) => {
        let text = ''; res.setEncoding('utf8'); res.on('data', (c) => { text += c; }); res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
});
const nonceOf = async (s) => /"nonce":"([^"]+)"/.exec(await get(s.url + 'station/station-data.js'))[1];
const setRemote = async (s, v) => post(s.url + 'profile', new URLSearchParams({ nonce: await nonceOf(s), scope: 'machine', key: 'station.remote', value: v }).toString());
const start = (f, ts, extra) => serve(Object.assign({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 0, open: false, tailscaleRun: ts.run }, extra));

test('station.remote written off takes down the proxy this station made, once', async () => {
    const f = fixture(true);
    const ts = fakeTailscale();
    const s = await start(f, ts);
    try {
        assert.equal(ts.count('serve --bg ' + new URL(s.url).port), 1);
        const r = await setRemote(s, 'false');
        assert.ok(r.status < 300, r.status + ' ' + r.text);
        assert.equal(ts.count(OFF), 1);
    } finally {
        s.close();
    }
    assert.equal(ts.count(OFF), 1, 'closing after off does not take it down twice');
});

test('closing the station takes down the proxy it made', async () => {
    const ts = fakeTailscale();
    const s = await start(fixture(true), ts);
    assert.equal(ts.count(OFF), 0);
    s.close();
    assert.equal(ts.count(OFF), 1);
});

test('the idle exit takes it down too', async () => {
    const ts = fakeTailscale();
    const s = await start(fixture(true), ts, { idleMs: 100 });
    try {
        await new Promise((r) => setTimeout(r, 400));
        assert.equal(ts.count(OFF), 1);
    } finally {
        s.close();
    }
    assert.equal(ts.count(OFF), 1);
});

test('a proxy found already there is not this station\'s, and is left on', async () => {
    let port = null;
    const ts = fakeTailscale({ pre: () => port });
    const s = await start(fixture(false), ts);
    port = new URL(s.url).port;
    try {
        assert.ok((await setRemote(s, 'true')).status < 300);
        assert.equal(ts.calls.filter((c) => c.startsWith('serve --bg')).length, 0);
        assert.ok((await setRemote(s, 'false')).status < 300);
    } finally {
        s.close();
    }
    assert.equal(ts.count(OFF), 0);
});

test('a teardown that fails is one stderr line, and the station still closes', async () => {
    const ts = fakeTailscale({ offFails: true });
    const s = await start(fixture(true), ts);
    const said = [];
    const write = process.stderr.write;
    process.stderr.write = (chunk) => { said.push(String(chunk)); return true; };
    try {
        s.close();
    } finally {
        process.stderr.write = write;
    }
    assert.equal(ts.count(OFF), 1);
    assert.deepEqual(said.filter((l) => l.startsWith('station: tailscale serve left on')),
        ['station: tailscale serve left on — tailscale serve --https=443 off failed: tailscale: access denied\n']);
    await assert.rejects(get(s.url));
});
```

2. Run them and watch them fail (`tailscale.disable is not a function`; no `serve --https=443 off` call):

```
node --test tests/tailscale-disable.test.js tests/station-remote-teardown.test.js
```

3. Write `disable`. In `lib/tailscale.js`, add after `enable` and export it:

In `lib/tailscale.js`:

```js
// The proxy `ensureServe` made, taken down (station-remote-1): `serve --bg
// <port>` puts an HTTPS handler on 443, and `serve --https=443 off` removes
// it. The caller runs this only for a proxy it made itself. A warning, never
// a throw: a station shutting down must not stop on it.
function disable(run) {
    const r = (run || runTailscale)(['serve', '--https=443', 'off']);
    if (r.status !== 0) return { ok: false, warning: 'tailscale serve --https=443 off failed: ' + firstLine(r.stderr || r.stdout) };
    return { ok: true };
}

module.exports = { selfName, proxiesOf, ensureServe, enable, disable };
```

and change the last sentence of the header comment's first paragraph to say teardown exists: after `` `tailscale serve --bg <port>` run only when `tailscale serve status --json` shows no proxy to that port yet. `` add `` `disable` runs `tailscale serve --https=443 off` for a proxy the caller made. ``

4. Wire it into the station. In `scripts/station.js`, beside `let boundPort = null;` (`scripts/station.js:340` at `fc25513a`), add:

In `scripts/station.js`:

```js
    // Whether this run's `ensureServe` made the proxy (`already: false`). Only
    // then does the station take it down: one found already there was put up
    // by someone else, or by a run that will not come back for it.
    let madeServe = false;
```

In `touch()`'s idle timer (`scripts/station.js:436-445`), take the proxy down before the server closes — the timer body becomes:

In `scripts/station.js`:

```js
        timer = setTimeout(() => {
            teardownRemote();
            server.close();
            // Off by default: `serve()` is also called in-process by tests
            // (station-cli, station-detail, station-todo), and an idle exit
            // there would end that whole test file's own process rather than
            // a station's — silently, with exit code 0, so `node --test`
            // reports no failure and the file's remaining tests simply never
            // ran. Only `main()`'s own `serve` verb — the real `--idle`
            // flag — opts in.
            if (opts.exitOnIdle === true) process.exit(0);
        }, opts.idleMs);
```

Replace `refreshRemote` and the comment above it (`scripts/station.js:971-987`) with:

In `scripts/station.js`:

```js
    // The proxy this station made comes down with it (station-remote-1): when
    // `station.remote` is written off, when `close()` runs, and on the idle
    // exit. Never fatal — a failure is one stderr line and shutdown goes on.
    const teardownRemote = () => {
        if (!madeServe) return;
        madeServe = false;
        const off = tailscale.disable(opts.tailscaleRun);
        if (!off.ok) process.stderr.write('station: tailscale serve left on — ' + off.warning + '\n');
    };
    // Asks Tailscale again: at listen, and whenever `station.remote` is
    // written from the page. Never fatal — a warning on stderr and on the
    // card, and loopback keeps serving. Off takes down a proxy this run made.
    const refreshRemote = () => {
        const want = profile.read(null, configDir).values['station.remote'] === true;
        if (want && boundPort) {
            const got = tailscale.enable(boundPort, opts.tailscaleRun);
            tailnet = got.ok
                ? { on: true, dnsName: got.dnsName, url: got.url, warning: null }
                : { on: false, dnsName: null, url: null, warning: got.warning };
            if (got.ok && got.already === false) madeServe = true;
            if (!got.ok) process.stderr.write('station: remote stays off — ' + got.warning + '\n');
        } else {
            tailnet = { on: false, dnsName: null, url: null, warning: null };
            teardownRemote();
        }
        if (recordData) writeRecord(recordData);
    };
```

In the `/profile` handler's comment (`scripts/station.js:940-942`), the last clause `— off included, which touches nothing in Tailscale.` becomes `— off included, which takes down a proxy this run made.`

In `close()` (`scripts/station.js:1044-1056`), take the proxy down first:

In `scripts/station.js`:

```js
                close() {
                    if (timer) clearTimeout(timer);
                    if (retryTimer) clearInterval(retryTimer);
                    teardownRemote();
                    // Before the server: a board's open event streams would
                    // otherwise hold server.close() until they end.
                    for (const board of boards.values()) {
                        try { board.close(); } catch (e) { /* closing anyway */ }
                    }
                    boards.clear();
                    server.close();
                    if (fixedServer) fixedServer.close();
                    try { fs.unlinkSync(record); } catch (e) { /* already gone */ }
                },
```

In `main()`'s `serve` verb (`scripts/station.js:1145-1153`), close on Ctrl+C and on a polite kill — only here, never inside `serve()`, which tests call in-process:

In `scripts/station.js`:

```js
    if (args.verb === 'serve') {
        serve({ configDir, roots: args.roots, scan: args.scan, port: args.port, idleMs: args.idleMs, open: args.open, portWasExplicit: args.portWasExplicit, exitOnIdle: true }).then((s) => {
            process.stdout.write('fankeel station — ' + s.url
                + (args.idleMs > 0 ? '  (exits after ' + Math.round(args.idleMs / 60e3) + ' idle minutes, or Ctrl+C)' : '  (Ctrl+C to exit)') + '\n');
            // Ctrl+C runs close(), so the proxy this station made and serve.json
            // go with it. A hard kill runs nothing; the reference page says how
            // to take the proxy down by hand then.
            for (const sig of ['SIGINT', 'SIGTERM']) {
                process.once(sig, () => { s.close(); process.exit(0); });
            }
        }, (e) => {
            process.stderr.write('station: could not listen: ' + (e && e.message) + '\n');
            process.exit(1);
        });
        return;
    }
```

5. Correct the reference. In `docs/90-agent/reference/station.md`, replace the sentences from `The proxy is made for the port` through `removes the proxy.` (`docs/90-agent/reference/station.md:1450-1454` at `fc25513a`) with:

In `docs/90-agent/reference/station.md`:

```md
The proxy is made for the port bound first; the fixed-port retry leaves it
there, and that listener stays open. A proxy this station made comes down with
it: writing `station.remote` off, `close()`, Ctrl+C on `serve`, and the
`--idle` exit each run `tailscale serve --https=443 off` (`disable` in
`lib/tailscale.js`, `teardownRemote` in `scripts/station.js`). A proxy that
was already there when the station asked (`already` from `ensureServe`) is
left on. A failed teardown is one stderr line, `station: tailscale serve left
on — <why>`, and shutdown goes on. A hard kill runs none of this; `tailscale
serve --https=443 off` by hand removes the proxy then.
```

6. Run them and watch them pass, then the remote neighbours:

```
node --test tests/tailscale-disable.test.js tests/station-remote-teardown.test.js
node --test tests/tailscale.test.js tests/station-remote.test.js tests/station-remote-card.test.js
```

7. Commit:

```
git add tests/tailscale-disable.test.js tests/station-remote-teardown.test.js lib/tailscale.js scripts/station.js docs/90-agent/reference/station.md
git commit -m "fix: tailscale serve comes down with the station that made it" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


## Task 6: One tooltip for every chart segment

**Files:**
- Modify: `assets/station/tip.js` — new: `FK_TIP`, the one tooltip box every redesigned page shares
- Modify: `assets/station/tip.css` — new: the box's look
- Read: `.fankeel/build/2026-10-21-station-redesign/_sess/r59-tip.js` — the mockup's rule (one label, at most two values, text only); not ported as-is, it is a build-time helper
- Read: `assets/station/remote-card.js:1-60` — the module pattern (IIFE over `window`/`document`, `module.exports` plus `w.FK_X`)
- Test: `tests/station-tip.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks; it reads no `window.STATION` field.
- Produces: `window.FK_TIP` and `module.exports`, `{ attr, show, hide, init, SEP }`:
  - `attr(label: string, values?: Array<string|number>) -> string` — `' tabindex="0" data-tip="<label>" data-tip-v="<v1>\u241f<v2>" aria-label="<label> · <v1> · <v2>"'`, escaped, at most two values (a third is dropped, empty ones skipped), to splice into a mark's opening tag. Tasks 7–13 call it as `w.FK_TIP ? w.FK_TIP.attr(l, v) : ''`.
  - `show(el)`, `hide()`, `init()` — `init` binds `mouseover`/`mouseout`/`focusin`/`focusout`/`keydown` on `document` once; it runs when the file loads.
  - `SEP` — `'\u241f'`.
- Wiring (Task 15, not this task): `tip.js` and `tip.css` go into `index.html` (script between `i18n.js` and `spend-talk.js`, before any `*-page.js`), the model's `MODULES` list, the server's `STATIC` list, and the focus shell.

**Dispatch:** implementer, opus

1. Write the failing test `tests/station-tip.test.js`:

```js
'use strict';
// assets/station/tip.js — the one tooltip the redesigned pages share
// (docs/90-agent/plans/2026-10-21-station-redesign-design.md, "Rules every
// redesigned page keeps": a tooltip belongs to one segment, one label line and
// at most two values; keyboard focus shows the same tip as hover; Esc hides
// it). The module runs in its own vm with a document that records listeners.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const SRC = fs.readFileSync(path.join(ASSETS, 'tip.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ASSETS, 'tip.css'), 'utf8');

// An element as tip.js touches it: attributes, style, hidden, innerHTML, a
// rectangle, and `closest` for `[data-tip]` walking up `parent`.
function el(attrs, parent) {
    return {
        attrs: Object.assign({}, attrs), parent: parent || null, style: {}, hidden: false, innerHTML: '', className: '',
        setAttribute(k, v) { this.attrs[k] = String(v); },
        getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
        getBoundingClientRect() { return { left: 100, top: 40, width: 20, height: 8 }; },
        closest(sel) {
            if (sel === '[data-tip]' && Object.prototype.hasOwnProperty.call(this.attrs, 'data-tip')) return this;
            return this.parent ? this.parent.closest(sel) : null;
        },
    };
}

function boot() {
    const on = {};
    const made = [];
    const body = { kids: [], appendChild(e) { this.kids.push(e); } };
    const doc = {
        body,
        addEventListener(type, fn) { (on[type] = on[type] || []).push(fn); },
        createElement() { const e = el(); made.push(e); return e; },
    };
    const win = { scrollX: 0, scrollY: 10 };
    const box = vm.createContext({ window: win, document: doc, module: { exports: {} } });
    vm.runInContext(SRC, box);
    const fire = (type, e) => (on[type] || []).forEach((fn) => fn(e));
    return { T: box.module.exports, win, made, body, fire, on };
}

test('attr writes the label, at most two values, a tab stop and an accessible name', () => {
    const { T } = boot();
    const a = T.attr('build <x>', ['$1.20', '', null, '40m', 'third']);
    assert.match(a, /^ tabindex="0" data-tip="build &lt;x&gt;"/);
    assert.ok(a.includes(' data-tip-v="$1.20\u241f40m"'), a);
    assert.ok(!a.includes('third'), 'a third value is dropped');
    assert.ok(a.includes(' aria-label="build &lt;x&gt; · $1.20 · 40m"'), a);
    assert.ok(!T.attr('plan').includes('data-tip-v'), 'no values, no data-tip-v');
    assert.equal(T.SEP, '\u241f');
});

test('hover over a mark, or anything inside it, fills the one box with text and places it', () => {
    const { T, made, body, fire } = boot();
    const mark = el({ 'data-tip': 'build', 'data-tip-v': '$1.20\u241f<b>40m</b>' });
    fire('mouseover', { target: el({}, mark) });
    assert.equal(made.length, 1);
    const box = made[0];
    assert.equal(body.kids[0], box);
    assert.equal(box.className, 'fk-tip');
    assert.equal(box.attrs.role, 'tooltip');
    assert.equal(box.hidden, false);
    assert.equal(box.innerHTML, '<b>build</b><span>$1.20</span><span>&lt;b&gt;40m&lt;/b&gt;</span>');
    assert.equal(box.style.left, '110px');
    assert.equal(box.style.top, '50px');
    fire('mouseover', { target: el({ 'data-tip': 'plan' }) });
    assert.equal(made.length, 1, 'still one box');
    assert.equal(box.innerHTML, '<b>plan</b>');
    assert.equal(typeof T.hide, 'function');
});

test('leaving the mark hides the box; moving inside it does not', () => {
    const { made, fire } = boot();
    const mark = el({ 'data-tip': 'verify' });
    const inner = el({}, mark);
    fire('mouseover', { target: mark });
    fire('mouseout', { target: mark, relatedTarget: inner });
    assert.equal(made[0].hidden, false);
    fire('mouseout', { target: inner, relatedTarget: el({}) });
    assert.equal(made[0].hidden, true);
});

test('keyboard focus shows the same tip; Esc and blur hide it', () => {
    const { made, fire } = boot();
    const mark = el({ 'data-tip': 'land', 'data-tip-v': '3' });
    fire('focusin', { target: mark });
    assert.equal(made[0].innerHTML, '<b>land</b><span>3</span>');
    assert.equal(made[0].hidden, false);
    fire('keydown', { key: 'Escape' });
    assert.equal(made[0].hidden, true);
    fire('focusin', { target: mark });
    fire('focusout', { target: mark });
    assert.equal(made[0].hidden, true);
});

test('the listeners are bound once, and the module is on window', () => {
    const { T, win, on } = boot();
    T.init();
    T.init();
    assert.equal(on.mouseover.length, 1);
    assert.equal(on.keydown.length, 1);
    assert.equal(win.FK_TIP, T);
});

test('tip.css draws the box and hides it when hidden', () => {
    assert.match(CSS, /\.fk-tip\{[^}]*position:absolute/);
    assert.match(CSS, /\.fk-tip\[hidden\]\{display:none\}/);
    assert.match(CSS, /\[data-tip\]:focus-visible/);
});
```

2. Run it and watch it fail (no `assets/station/tip.js`):

```sh
node --test tests/station-tip.test.js
```

3. Write `assets/station/tip.js`:

```js
'use strict';
// assets/station/tip.js — the one tooltip every chart on the redesigned
// station pages shares (docs/90-agent/plans/2026-10-21-station-redesign-design.md,
// "Rules every redesigned page keeps"; mockup _sess/r59-tip.js). A mark
// carries its own label and at most two values, written into its tag by
// `attr()`; one `.fk-tip` box shows them on hover and on keyboard focus and
// hides on leave, blur or Esc. The box gets escaped text only. Loaded before
// station.js with the other modules; it binds its listeners once, when it is
// first loaded with a document.
(function (w, doc) {
    var SEP = '\u241f';
    var ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ENT[c]; }); }
    function valuesOf(values) {
        return (values || []).filter(function (v) { return v !== undefined && v !== null && v !== ''; }).slice(0, 2).map(String);
    }
    // To splice into a mark's opening tag. A third value is dropped: a tip
    // says what its own segment is and that segment's figures, nothing more.
    function attr(label, values) {
        var v = valuesOf(values);
        return ' tabindex="0" data-tip="' + esc(label) + '"' + (v.length ? ' data-tip-v="' + esc(v.join(SEP)) + '"' : '')
            + ' aria-label="' + esc([String(label)].concat(v).join(' · ')) + '"';
    }

    var box = null, on = null, bound = false;
    function boxOf() {
        if (!box) {
            box = doc.createElement('div');
            box.className = 'fk-tip';
            box.setAttribute('role', 'tooltip');
            box.hidden = true;
            doc.body.appendChild(box);
        }
        return box;
    }
    function markOf(t) { return t && typeof t.closest === 'function' ? t.closest('[data-tip]') : null; }
    function show(el) {
        var b = boxOf(), v = String(el.getAttribute('data-tip-v') || '');
        b.innerHTML = '<b>' + esc(el.getAttribute('data-tip')) + '</b>'
            + (v ? v.split(SEP).map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') : '');
        var r = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : { left: 0, top: 0, width: 0 };
        b.style.left = Math.round(r.left + r.width / 2 + ((w && w.scrollX) || 0)) + 'px';
        b.style.top = Math.round(r.top + ((w && w.scrollY) || 0)) + 'px';
        b.hidden = false;
        on = el;
    }
    function hide() {
        if (box) box.hidden = true;
        on = null;
    }
    function init() {
        if (bound || !doc || typeof doc.addEventListener !== 'function') return;
        bound = true;
        doc.addEventListener('mouseover', function (e) {
            var m = markOf(e.target);
            if (m && m !== on) show(m);
        });
        doc.addEventListener('mouseout', function (e) {
            if (on && markOf(e.target) === on && markOf(e.relatedTarget) !== on) hide();
        });
        doc.addEventListener('focusin', function (e) {
            var m = markOf(e.target);
            if (m) show(m);
        });
        doc.addEventListener('focusout', function (e) {
            if (on && markOf(e.target) === on) hide();
        });
        doc.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && on) hide();
        });
    }
    init();

    var api = { attr: attr, show: show, hide: hide, init: init, SEP: SEP };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_TIP = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
```

4. Write `assets/station/tip.css`:

```css
/* assets/station/tip.css — the one tooltip (assets/station/tip.js): a label
   line and at most two values, above the mark it belongs to. */
.fk-tip{position:absolute;z-index:90;max-width:260px;padding:6px 10px 7px;border-radius:7px;background:var(--ink);color:var(--panel);
  font:12px/1.45 var(--f-ui);pointer-events:none;transform:translate(-50%,calc(-100% - 8px));
  box-shadow:0 8px 20px -6px color-mix(in srgb,var(--ink) 40%,transparent)}
.fk-tip[hidden]{display:none}
.fk-tip b{display:block;font-weight:700;white-space:nowrap}
.fk-tip span{display:block;font:12px var(--f-mono);font-variant-numeric:tabular-nums;white-space:nowrap}
[data-tip]{cursor:default}
[data-tip]:focus{outline:none}
[data-tip]:focus-visible{outline:2px solid var(--keel);outline-offset:1px}
```

5. Run it and watch it pass:

```sh
node --test tests/station-tip.test.js
```

6. Commit:

```sh
git add assets/station/tip.js assets/station/tip.css tests/station-tip.test.js
git commit -m "feat: station tooltip module, one segment one tip" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 7: 進行中 page (§1)

**Files:**
- Modify: `assets/station/live-page.js` — new: `FK_LIVE`, the page `#/` and `#/live` draw
- Modify: `assets/station/live-page.css` — new: the rows, glyph, roadmap and peek, ported from `_lp/r56-shared.css` and the 進行中 rules of `_lp/r56-gen-a.js`
- Read: `.fankeel/build/2026-10-21-station-redesign/route-live-a.html` — the approved page (blocks `live-head`, `live-wait`, `live-run`, `live-stop`)
- Read: `.fankeel/build/2026-10-21-station-redesign/_lp/r56-row.js` — glyph, roadmap, task text, peek; its `LX` table is invented data and is not ported
- Read: `.fankeel/build/2026-10-21-station-redesign/_lp/r56-shared.css` — the CSS this task ports
- Read: `tests/station-module.js:17-36` — `page(names, station)` loads station.js then the modules in one vm
- Test: `tests/station-live-redesign.test.js`

**Interfaces:**
- Consumes: `window.FK_KIT` from Task 3 — `esc(s)`, `cost(s) -> number` (usd + agentUsd), `usd(n, plain) -> string`, `keelGlyph({cls, seg(i), edge})`, `shortLabel(label)`, `sessionHash(id)`, `modelKey(model)`, `modelLabel(key)`, `icon(name)` (`gate`, `check`, `bot`, `timer`), `ROUTE`. Reads `window.STATION.sessions[]` fields `id, task, pkey, route, stage, state, gateAt, started, updated, usd, agentUsd, model`.
- Produces: `window.FK_LIVE` and `module.exports`, `{ page, groups, EN }`:
  - `page(S, o) -> string` — `S` is `window.STATION`; `o = { names: {pkey: label}, now: ms, serve, redraw }` (station.js's `modOpts()`).
  - `groups(sessions) -> { wait: [], run: [], stop: [] }` — wait: `gateAt` and `state !== 'down'`; run: `state === 'live'` without an open gate; stop: `state === 'stale'` without an open gate. A `down` session is in none.
- Wiring (Tasks 15/16, not this task): Task 15 loads `live-page.js`/`.css` after `tip.js`; Task 16 routes `now` and `live` to `FK_LIVE.page(S, modOpts())`, falling back to the old view when `w.FK_LIVE` is absent.
- Not this task: the home test file belongs to Task 3. This task writes only its own new test file; any old home-markup test that changes because `#/` now draws this page is Task 16's (router) to update.

**Dispatch:** implementer, opus

1. Write the failing test `tests/station-live-redesign.test.js`:

```js
'use strict';
// 進行中 (assets/station/live-page.js; design 2026-10-21-station-redesign §1;
// mockup route-live-a.html): the three groups, one link a row with the
// glyph, chip, task, route n/len, cost main + agents and the last move, the
// peek with only fields the row has, unnamed sessions folded, and the pulse
// stopped under reduced motion.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page, stringsLeft } = require('./station-module.js');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'live-page.css'), 'utf8');
const NOW = Date.parse('2026-10-22T09:00:00.000Z');
const iso = (minAgo) => new Date(NOW - minAgo * 60000).toISOString();
const ROUTE5 = ['survey', 'design', 'plan', 'build', 'land'];
const base = (o) => Object.assign({ root: 'F:\\w', project: 'app', pkey: 'F:\\w/app', route: ROUTE5, stage: 'plan', state: 'live',
    started: iso(120), updated: iso(5), usd: 1.5, agentUsd: 2.25, model: 'claude-opus-4-1', gateAt: null, stages: [], days: null }, o);
const SESSIONS = [
    base({ id: 'aaaaaaaa-0001', task: 'Wait task', gateAt: iso(3) }),
    base({ id: 'bbbbbbbb-0002', task: 'Run <task>' }),
    base({ id: 'cccccccc-0003', task: null, route: [], stage: 'init', updated: iso(1) }),
    base({ id: 'dddddddd-0004', task: null, route: [], stage: 'init', updated: iso(2) }),
    base({ id: 'eeeeeeee-0005', task: 'Stale task', state: 'stale', updated: iso(300) }),
    base({ id: 'ffffffff-0006', task: 'Ended', state: 'down', gateAt: iso(9) }),
];

function live(lang) {
    const { win } = page(['tip.js', 'live-page.js'], {});
    if (lang) win.FK_I18N = { lang };
    return win.FK_LIVE;
}
const draw = (sessions, lang) => live(lang).page({ sessions }, { names: { 'F:\\w/app': 'w / app' }, now: NOW });

test('groups: a gate waiting, running, may have stopped; an ended session is in none', () => {
    const g = live().groups(SESSIONS);
    assert.deepEqual(Array.from(g.wait, (s) => s.id), ['aaaaaaaa-0001']);
    assert.deepEqual(Array.from(g.run, (s) => s.id), ['bbbbbbbb-0002', 'cccccccc-0003', 'dddddddd-0004']);
    assert.deepEqual(Array.from(g.stop, (s) => s.id), ['eeeeeeee-0005']);
});

test('the head switches 進行中 | 全部, with both counts', () => {
    const html = draw(SESSIONS);
    assert.ok(html.includes('data-block="live-head"'));
    assert.ok(html.includes('<a href="#/live" aria-current="page">進行中<b class="kn">5</b></a>'), html.slice(0, 600));
    assert.ok(html.includes('<a href="#/sessions">全部<b class="kn">6</b></a>'));
    for (const b of ['live-wait', 'live-run', 'live-stop']) assert.ok(html.includes('data-block="' + b + '"'), b);
});

test('a row is one link to the session with chip, task, route n/len, cost main + agents and an age', () => {
    const html = draw(SESSIONS);
    const row = html.slice(html.indexOf('<a class="hm-lv sxr" href="#/s/bbbbbbbb-0002"'));
    assert.ok(row.length < html.length, 'the running row links to its session');
    const one = row.slice(0, row.indexOf('</a>') + 4);
    assert.ok(one.includes('<span class="chip">app</span>'), one);
    assert.ok(one.includes('Run &lt;task&gt;'));
    assert.ok(one.includes('<span class="sx-n"><b>3</b>/5</span>'));
    assert.ok(one.includes('<li class="now" style="--c:var(--st-plan)" aria-current="step">'));
    assert.ok(one.includes('<span class="sx-usd">$3.75</span>'), 'cost is usd + agentUsd');
    assert.ok(one.includes('<span class="hm-lv-r">5m 前</span>'));
    assert.ok(one.includes('class="glyph k-only sx-g run"'));
});

test('the peek holds stage, model, cost main · agent, started, last move and id8, nothing else', () => {
    const html = draw(SESSIONS);
    const at = html.indexOf('id="pk-bbbbbbbb"');
    const pk = html.slice(at, html.indexOf('</dl>', at));
    const dts = pk.match(/<dt>[^<]*<\/dt>/g);
    assert.deepEqual(dts, ['<dt>這站</dt>', '<dt>模型</dt>', '<dt>花費</dt>', '<dt>開始</dt>', '<dt>最後動靜</dt>', '<dt>session</dt>']);
    assert.ok(pk.includes('<dd>Opus 4.1</dd>'), pk);
    assert.ok(pk.includes('主 $1.50 · 派工 $2.25'));
    assert.ok(pk.includes('<dd>bbbbbbbb</dd>'));
});

test('two or more unnamed sessions fold into one row; one stays a row', () => {
    const html = draw(SESSIONS);
    assert.ok(html.includes('<details class="sx-un" data-lv-un="run">'), html);
    assert.ok(html.includes('2 個未命名'));
    assert.equal((html.match(/<summary class="hm-lv sxr"/g) || []).length, 1);
    const lone = draw([SESSIONS[2]]);
    assert.ok(!lone.includes('sx-un'));
    assert.ok(lone.includes('href="#/s/cccccccc-0003"'));
});

test('a stopped row is quieter, and an empty group says so', () => {
    assert.ok(draw(SESSIONS).includes('<a class="hm-lv sxr gone" href="#/s/eeeeeeee-0005"'));
    const none = draw([]);
    assert.ok(none.includes('沒有 gate 在等你'));
    assert.ok(none.includes('<span class="kn z">0</span>'));
});

test('English comes from the module table', () => {
    const html = draw(SESSIONS, 'en');
    assert.ok(html.includes('2 unnamed'));
    assert.ok(html.includes('Live<b class="kn">5</b>'));
});

test('only the running stage pulses, and reduced motion stops it', () => {
    assert.match(CSS, /\.sx-g\.run \.gseg\.now[^{]*\{animation:sx-pulse/);
    assert.match(CSS, /@media \(prefers-reduced-motion:reduce\)\{[^}]*\.sx-g\.run \.gseg\.now[^{]*\{animation:none\}/);
});

test('every string of live-page.js has English', () => {
    assert.deepEqual(stringsLeft('live-page.js', live().EN), []);
});
```

2. Run it and watch it fail:

```sh
node --test tests/station-live-redesign.test.js
```

3. Write `assets/station/live-page.js`:

```js
'use strict';
// assets/station/live-page.js — 進行中, the page `#/` and `#/live` draw
// (docs/90-agent/plans/2026-10-21-station-redesign-design.md §1; mockup
// route-live-a.html, blocks live-head, live-wait, live-run, live-stop; the
// row is _lp/r56-row.js). One head with the 進行中 | 全部 switch, then three
// cards: 等你回答 (a gate open, the session not ended), 正在跑 (live) and
// 可能停了 (stale). A row is one link to the session: the glyph (colour the
// state, lit segments the route walked, only the running stage pulses), the
// project chip over the task, the route as n/len and its stations, cost
// (main + agents) and the last move as an age; hover or focus shows the peek,
// which holds only fields the row already has. Two or more unnamed sessions
// in one card fold into one row. Reads `w.FK_KIT` (station.js) when it draws.
(function (w, doc) {
    var EN = {
        'lv.live': 'Live',
        'lv.all': 'All',
        'lv.wait': 'Waiting on you',
        'lv.run': 'Running',
        'lv.stop': 'May have stopped',
        'lv.noGate': 'No gate is waiting on you',
        'lv.noRun': 'No session is running',
        'lv.noStop': 'Nothing looks stopped',
        'lv.unnamed': '{n} unnamed',
        'lv.untitled': 'Unnamed · started {t}',
        'lv.init': 'Starting up, no route yet',
        'lv.glyph': '{state}, {stage}, stop {n} of {len}',
        'lv.route': 'Route, {len} stops: {r}',
        'lv.stage': 'Stage',
        'lv.model': 'Model',
        'lv.cost': 'Cost',
        'lv.costSplit': 'main {m} · agents {a}',
        'lv.started': 'Started',
        'lv.last': 'Last move',
        'lv.justNow': 'just now',
        'lv.min': '{n}m ago',
        'lv.hour': '{n}h ago',
        'lv.day': '{n}d ago',
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function fill(s, vars) {
        if (!vars) return s;
        return String(s).replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) ? String(vars[k]) : m; });
    }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return fill(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    function kit() { return (w && w.FK_KIT) || {}; }
    function esc(s) { return kit().esc(s); }
    function ms(t) { return typeof t === 'number' ? t : Date.parse(t); }
    function lastOf(s) {
        var a = ms(s.updated), b = ms(s.started);
        return Math.max(isFinite(a) ? a : 0, isFinite(b) ? b : 0);
    }
    function byLast(a, b) { return lastOf(b) - lastOf(a); }
    function two(n) { return ('0' + n).slice(-2); }
    function when(t) {
        if (!t || !isFinite(t)) return '—';
        var d = new Date(t);
        return two(d.getMonth() + 1) + '-' + two(d.getDate()) + ' ' + two(d.getHours()) + ':' + two(d.getMinutes());
    }
    function since(t, now) {
        if (!t) return '—';
        var m = Math.max(0, Math.round((now - t) / 60000));
        if (m < 2) return loc('lv.justNow', '剛剛');
        if (m < 60) return loc('lv.min', '{n}m 前', { n: m });
        if (m < 1440) return loc('lv.hour', '{n}h 前', { n: Math.floor(m / 60) });
        return loc('lv.day', '{n}d 前', { n: Math.floor(m / 1440) });
    }
    var CHEV = '<svg class="ico chev" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor"'
        + ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6.2 8 9.8l3.5-3.6"/></svg>';

    // A session is in one group: an open gate first, then live, then stale.
    function groups(sessions) {
        var g = { wait: [], run: [], stop: [] };
        (sessions || []).forEach(function (s) {
            if (s.gateAt && s.state !== 'down') g.wait.push(s);
            else if (s.state === 'live') g.run.push(s);
            else if (s.state === 'stale') g.stop.push(s);
        });
        return g;
    }
    function title(kind) {
        if (kind === 'wait') return loc('lv.wait', '等你回答');
        if (kind === 'run') return loc('lv.run', '正在跑');
        return loc('lv.stop', '可能停了');
    }
    function placeOf(route, stage) {
        var at = route.indexOf(stage);
        return function (name) { var i = route.indexOf(name); return i < 0 ? null : i < at ? 'done' : i === at ? 'now' : 'todo'; };
    }
    function glyph(s, kind) {
        var k = kit(), route = s.route || [], at = route.indexOf(s.stage), place = placeOf(route, s.stage);
        var label = route.length && at >= 0
            ? loc('lv.glyph', '{state}，{stage}，第 {n} 站，共 {len} 站', { state: title(kind), stage: s.stage, n: at + 1, len: route.length })
            : title(kind) + ' · ' + loc('lv.init', '初始化中，還沒有路線');
        return k.keelGlyph({ cls: 'sx-g ' + kind + (route.length ? '' : ' bare'), seg: function (i) { return place(k.ROUTE[i]); },
            edge: route.length ? place('land') || 'todo' : 'todo' }) + '<span class="hm-sr">' + esc(label) + '</span>';
    }
    // n/len, then every station the task's route has: walked solid, here lit, ahead faint.
    function roadmap(s) {
        var route = s.route || [], at = route.indexOf(s.stage);
        if (!route.length || at < 0) {
            return '<span class="sx-rm"><span class="sx-n" aria-hidden="true">–</span><span class="sx-init">' + loc('lv.init', '初始化中，還沒有路線') + '</span></span>';
        }
        var li = route.map(function (name, i) {
            var c = i < at ? 'done' : i === at ? 'now' : 'todo';
            return '<li class="' + c + '" style="--c:var(--st-' + esc(name) + ')"' + (c === 'now' ? ' aria-current="step"' : '') + '><i aria-hidden="true"></i>'
                + (c === 'now' ? '<span class="hm-stw">' + esc(name) + '</span>' : esc(name)) + '</li>';
        }).join('');
        return '<span class="sx-rm"><span class="sx-n"><b>' + (at + 1) + '</b>/' + route.length + '</span>'
            + '<ol class="sx-rt" aria-label="' + esc(loc('lv.route', '路線 {len} 站：{r}', { len: route.length, r: route.join(' → ') })) + '">' + li + '</ol></span>';
    }
    function chip(s, o) {
        return '<span class="chip">' + esc(kit().shortLabel(o.names[s.pkey] || s.pkey || '')) + '</span>';
    }
    function taskText(s, now) {
        if (s.task) return esc(s.task);
        var t = ms(s.started);
        return esc(loc('lv.untitled', '未命名 · {t} 開始', { t: now - t < 864e5 ? when(t).slice(6) : when(t) }));
    }
    function peek(s) {
        var k = kit(), L = [];
        if (s.stage) L.push([loc('lv.stage', '這站'), esc(s.stage)]);
        if (s.model) L.push([loc('lv.model', '模型'), esc(k.modelLabel(k.modelKey(s.model)))]);
        L.push([loc('lv.cost', '花費'), esc(loc('lv.costSplit', '主 {m} · 派工 {a}', { m: k.usd(s.usd || 0, true), a: k.usd(s.agentUsd || 0, true) }))]);
        L.push([loc('lv.started', '開始'), when(ms(s.started))]);
        L.push([loc('lv.last', '最後動靜'), when(lastOf(s))]);
        L.push(['session', esc(String(s.id).slice(0, 8))]);
        return '<dl>' + L.map(function (l) { return '<dt>' + l[0] + '</dt><dd>' + l[1] + '</dd>'; }).join('') + '</dl>';
    }
    function row(s, kind, o) {
        var k = kit(), id8 = esc(String(s.id).slice(0, 8)), c = k.cost(s);
        return '<a class="hm-lv sxr' + (kind === 'stop' ? ' gone' : '') + '" href="' + esc(k.sessionHash(s.id)) + '" aria-describedby="pk-' + id8 + '">'
            + glyph(s, kind)
            + '<span class="hm-lv-p">' + chip(s, o) + '</span>'
            + '<span class="hm-lv-t' + (s.task ? '' : ' un') + '">' + taskText(s, o.now) + '</span>'
            + roadmap(s)
            + '<span class="sx-usd' + (c ? '' : ' z') + '">' + k.usd(c, true) + '</span>'
            + '<span class="hm-lv-r">' + since(lastOf(s), o.now) + '</span>'
            + '<div class="sx-pk" id="pk-' + id8 + '" role="tooltip">' + peek(s) + '</div></a>';
    }
    // Which fold is open, by group, so the poll's redraw keeps it open.
    var openUn = {}, bound = false;
    function bind() {
        if (bound || !doc || typeof doc.addEventListener !== 'function') return;
        bound = true;
        doc.addEventListener('click', function (e) {
            var t = e.target, sm = t && typeof t.closest === 'function' ? t.closest('summary[data-lv-sum]') : null;
            if (sm && sm.parentNode) openUn[sm.getAttribute('data-lv-sum')] = !sm.parentNode.open;
        });
    }
    // Named rows by last move, then the unnamed: one is a row, more fold into "N 個未命名".
    function rowsOf(list, kind, o) {
        var k = kit();
        var named = list.filter(function (s) { return s.task; }).sort(byLast);
        var un = list.filter(function (s) { return !s.task; }).sort(byLast);
        var out = named.map(function (s) { return row(s, kind, o); }).join('');
        if (un.length === 1) return out + row(un[0], kind, o);
        if (!un.length) return out;
        var head = un[0], sum = un.reduce(function (n, s) { return n + k.cost(s); }, 0);
        var one = un.every(function (s) { return s.pkey === head.pkey; });
        return out + '<details class="sx-un" data-lv-un="' + kind + '"' + (openUn[kind] ? ' open' : '') + '>'
            + '<summary class="hm-lv sxr' + (kind === 'stop' ? ' gone' : '') + '" data-lv-sum="' + kind + '">' + glyph(head, kind)
            + '<span class="hm-lv-p">' + (one ? chip(head, o) : '') + '</span>'
            + '<span class="hm-lv-t un">' + loc('lv.unnamed', '{n} 個未命名', { n: un.length }) + CHEV + '</span>'
            + '<span class="sx-rm"><span class="sx-n" aria-hidden="true">–</span></span>'
            + '<span class="sx-usd' + (sum ? '' : ' z') + '">' + k.usd(sum, true) + '</span>'
            + '<span class="hm-lv-r">' + since(lastOf(head), o.now) + '</span></summary>'
            + '<div class="sx-sub">' + un.map(function (s) { return row(s, kind, o); }).join('') + '</div></details>';
    }
    function card(kind, list, o) {
        var k = kit(), n = list.length;
        var ico = kind === 'wait' ? 'gate' : kind === 'run' ? 'bot' : 'timer';
        var none = kind === 'wait' ? loc('lv.noGate', '沒有 gate 在等你') : kind === 'run' ? loc('lv.noRun', '沒有 session 在跑') : loc('lv.noStop', '沒有看起來停了的');
        return '<section class="dcard sx-' + kind + (n ? '' : ' sx-none') + '" data-block="live-' + kind + '" aria-label="' + esc(title(kind)) + '">'
            + '<div class="dcard-h">' + k.icon(ico) + '<b>' + title(kind) + '</b>'
            + '<span class="kn' + (!n ? ' z' : kind === 'wait' ? ' wait' : '') + '">' + n + '</span>'
            + (n ? '' : '<span class="sp"></span><span class="sx-hnote' + (kind === 'wait' ? ' ok' : '') + '" role="status">' + (kind === 'wait' ? k.icon('check') : '') + none + '</span>')
            + '</div>' + (n ? '<div class="dlist">' + rowsOf(list, kind, o) + '</div>' : '') + '</section>';
    }
    function page(S, o) {
        o = o || {};
        bind();
        var opt = { names: o.names || {}, now: isFinite(o.now) ? o.now : Date.now() };
        var all = (S && S.sessions) || [], g = groups(all), n = g.wait.length + g.run.length + g.stop.length;
        return '<div class="sxp" data-block="live-page">'
            + '<div class="phead khead sxh" data-block="live-head"><nav class="subtabs" aria-label="Sessions">'
            + '<a href="#/live" aria-current="page">' + loc('lv.live', '進行中') + '<b class="kn">' + n + '</b></a>'
            + '<a href="#/sessions">' + loc('lv.all', '全部') + '<b class="kn">' + all.length + '</b></a></nav></div>'
            + card('wait', g.wait, opt) + card('run', g.run, opt) + card('stop', g.stop, opt) + '</div>';
    }

    var api = { page: page, groups: groups, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_LIVE = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
```

4. Write `assets/station/live-page.css`:

```css
/* assets/station/live-page.css — 進行中 (assets/station/live-page.js), ported
   from the mockup's _lp/r56-shared.css and the 進行中 rules of _lp/r56-gen-a.js.
   The cards are the home's .dcard; a row is .hm-lv with the glyph in front and
   the route and cost behind; the peek waits behind hover or focus. */
.sxp{display:flex;flex-direction:column;gap:18px;min-width:0;padding-bottom:24px}
.sxp .ico{width:14px;height:14px;flex:none}
.sxp .dcard-h .ico{width:16px;height:16px}
.sxp a:focus-visible,.sxp summary:focus-visible{outline:2px solid var(--keel);outline-offset:-2px;border-radius:6px}
.sxp .hm-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* the head line: 進行中 | 全部 */
:root[data-style=keel] .sxh.phead.khead{flex:none;margin:0;gap:14px;min-height:34px}
.sxh .subtabs a{display:inline-flex;align-items:center;gap:7px}
.sxh .kn{font:700 11px var(--f-mono);padding:0 6px;border-radius:4px;background:var(--inset);color:var(--ink2);font-variant-numeric:tabular-nums}
.sxh .subtabs a[aria-current=page] .kn{background:var(--panel);color:var(--keel-deep)}

/* the cards */
:root[data-style=keel] .sxp .dcard-h{height:42px}
.sxp .dcard-h .sp{flex:1}
.sxp .dlist{margin-top:4px}
.sxp .dcard-h .kn{font:700 11px var(--f-mono);padding:0 6px;border-radius:4px;background:var(--inset);color:var(--ink2)}
:root[data-style=keel] .sxp .dcard-h .kn.wait{background:var(--signal-tint);color:var(--signal-ink)}
:root[data-style=keel] .sxp .dcard-h .kn.z{background:var(--inset);color:var(--muted)}
:root[data-style=keel] .sxp .dcard.sx-none{padding-bottom:0}
:root[data-style=keel] .sxp .sx-none .dcard-h{border-bottom:0}
.sx-hnote{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);white-space:nowrap}
.sx-hnote.ok{color:var(--pass-ink)}

/* the row */
.hm-lv.sxr{position:relative;display:grid;grid-template-columns:22px minmax(0,1fr) 392px 64px 58px;grid-template-areas:"g p rm usd r" "g t rm usd r";
  column-gap:16px;row-gap:3px;padding:9px 10px;text-decoration:none;color:inherit}
.sxr>.sx-g{grid-area:g}
.sxr>.hm-lv-p{grid-area:p;min-width:0}
.sxr>.hm-lv-p .chip{font:11px var(--f-mono);padding:1px 6px;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.sxr>.hm-lv-t{grid-area:t;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;line-height:1.45;font-size:13.5px;color:var(--ink)}
.sxr>.hm-lv-t.un{font-weight:500;color:var(--muted)}
a.sxr:hover>.hm-lv-t{text-decoration:underline;text-decoration-color:var(--keel-mid);text-underline-offset:3px}
.sxr>.sx-usd{grid-area:usd;text-align:right;font:500 12.5px var(--f-mono);color:var(--ink);white-space:nowrap;font-variant-numeric:tabular-nums}
.sxr>.sx-usd.z{color:var(--faint)}
.sxr>.hm-lv-r{grid-area:r;white-space:nowrap;text-align:right;font:12px var(--f-mono);color:var(--ink2)}

/* the glyph: segments survey..audit, the edge land, the core the task; colour is the state */
.sxp{--g-run:var(--live);--g-wait:color-mix(in srgb,var(--stale) 75%,var(--stale-ink));--g-stop:var(--faint)}
.sxp .sx-g{width:22px;height:22px;display:block;flex:none}
.sxp .sx-g.run{--c:var(--g-run)}
.sxp .sx-g.wait{--c:var(--g-wait)}
.sxp .sx-g.stop{--c:var(--g-stop);opacity:.65}
.sxp .sx-g .gseg.done,.sxp .sx-g .gseg.now{fill:var(--c)}
.sxp .sx-g .gseg.todo{fill:var(--rule2)}
.sxp .sx-g .gedge{fill:none;stroke-linejoin:round}
.sxp .sx-g .gedge.done,.sxp .sx-g .gedge.now{stroke:var(--c);stroke-width:8}
.sxp .sx-g .gedge.todo{stroke:var(--rule2);stroke-width:7}
.sxp .sx-g .gcore{fill:var(--c);stroke:none}
.sxp .sx-g.run .gseg.now,.sxp .sx-g.run .gedge.now,.sxp .sx-g.run.bare .gcore{animation:sx-pulse 1.4s ease-in-out infinite alternate}
@keyframes sx-pulse{to{opacity:.35}}

/* the roadmap */
.sx-rm{grid-area:rm;display:flex;align-items:center;gap:10px;min-width:0}
.sx-n{flex:none;width:30px;font:12px var(--f-mono);color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.sx-n b{font-weight:700;color:var(--ink)}
.sx-rt{display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px;margin:0;padding:0;list-style:none;min-width:0}
.sx-rt li{display:inline-flex;align-items:center;gap:4px;font-size:12px;line-height:20px;white-space:nowrap;color:var(--ink2)}
.sx-rt li i{display:block;width:7px;height:7px;border-radius:50%;background:var(--c);flex:none}
.sx-rt li.now i{margin:0 2px;box-shadow:0 0 0 1.5px var(--panel),0 0 0 3px var(--c)}
.sx-rt li.todo{color:var(--muted)}
.sx-rt li.todo i{background:none;box-shadow:inset 0 0 0 1.5px var(--rule2)}
.sx-rt .hm-stw{font-size:12px}
.sx-init{font-size:12px;color:var(--muted);white-space:nowrap}

/* rows that may have stopped: the same columns, quieter */
.sxr.gone>.hm-lv-t:not(.un),.sxr.gone>.sx-usd{color:var(--ink2)}
.sxr.gone>.sx-rm{opacity:.75}
.sxr.gone>.hm-lv-r{color:var(--stale-ink,var(--ink2))}

/* the peek: after a beat on hover, at once on keyboard focus */
.sx-pk{position:absolute;top:calc(100% - 4px);left:48px;z-index:30;width:340px;padding:9px 12px 10px;border-radius:8px;background:var(--panel);
  font-size:12px;color:var(--ink2);box-shadow:0 0 0 1px var(--rule2),0 10px 24px -6px color-mix(in srgb,var(--ink) 22%,transparent);pointer-events:none;
  visibility:hidden;opacity:0;transition:opacity .12s ease-out,visibility 0s .12s}
a.sxr:hover>.sx-pk{visibility:visible;opacity:1;transition:opacity .15s ease-out .4s,visibility 0s .4s}
a.sxr:focus-visible>.sx-pk{visibility:visible;opacity:1;transition:none}
.sx-pk dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 14px;margin:0}
.sx-pk dt{color:var(--muted);white-space:nowrap}
.sx-pk dd{margin:0;color:var(--ink);font:12px var(--f-mono);overflow-wrap:anywhere}

/* unnamed sessions fold into one row */
.sx-un>summary{list-style:none;cursor:pointer}
.sx-un>summary::-webkit-details-marker{display:none}
.sx-un .chev{display:inline-block;width:14px;height:14px;margin-left:6px;vertical-align:-2px;transition:transform .18s cubic-bezier(.16,1,.3,1)}
.sx-un[open] .chev{transform:rotate(180deg)}
.sx-sub>.sxr{background:color-mix(in srgb,var(--inset) 45%,transparent)}
.sx-sub>.sxr:hover{background:var(--wash)}

@media (prefers-reduced-motion:reduce){.sxp .sx-g.run .gseg.now,.sxp .sx-g.run .gedge.now,.sxp .sx-g.run.bare .gcore{animation:none}.sx-un .chev,.sx-pk,a.sxr:hover>.sx-pk{transition:none}}

@media (max-width:1100px){
  .hm-lv.sxr{grid-template-columns:22px minmax(0,1fr) 64px 58px;grid-template-areas:"g p usd r" "g t usd r" "g rm rm rm"}
}
@media (max-width:640px){
  .hm-lv.sxr{grid-template-columns:22px minmax(0,1fr) 64px;grid-template-areas:"g p usd" "g t r" "g rm rm"}
}
```

5. Run it and watch it pass:

```sh
node --test tests/station-live-redesign.test.js
```

6. Commit:

```sh
git add assets/station/live-page.js assets/station/live-page.css tests/station-live-redesign.test.js
git commit -m "feat: station 進行中 page module" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 8: 全部 sessions, ten a page, and the compare dialog (§2)

**Files:**
- Modify: `assets/station/sessions-page.js` — new: `FK_SESSIONS`, the page `#/sessions` and `#/cmp` draw
- Modify: `assets/station/sessions-page.css` — new: now-strip, period tiles, list card, filters, pager and tray, compare dialog, ported from the mockup's `<style>` blocks
- Read: `.fankeel/build/2026-10-21-station-redesign/route-sessions.html:22-227` — blocks `sessions-page`, `sessions-now`, `sessions-periods`, `sessions-list`, `sessions-filter`, `sessions-pager`, `sessions-compare`
- Read: `.fankeel/build/2026-10-21-station-redesign/route-sessions.html:231-480` — the mockup's own script: `match`, `drawPeriods`, `drawRows`, `drawPager`, `drawTray`, `pickItems`, `drawCompare` (its `dd`, `su`, `bt` and `m` fields are not ported: the compare shows only what `lib/compare.js` returns)
- Read: `.fankeel/build/2026-10-21-station-redesign/route-list-cmp.html:23-34` — `#/cmp` is the list with the compare dialog open, never an empty page
- Read: `lib/compare.js:64-87` — `sessionOf`: usd, agentUsd, requests, agents, tokens, start
- Read: `tests/station-module.js:17-36`
- Test: `tests/station-sessions-redesign.test.js`

**Interfaces:**
- Consumes: `window.FK_KIT` (Task 3 plus what it already had) — `esc`, `cost(s)`, `usd(n, plain)`, `mins(ms)`, `tokens(n)`, `keelGlyph(o)`, `shortLabel`, `sessionHash(id)`, `lastDays(nowMs, n) -> ['YYYY-MM-DD', …]`, `ROUTE`; `window.FK_TIP.attr` (Task 6) when loaded. Reads `window.STATION.sessions[]` fields `id, task, pkey, route, stage, state, gateAt, started, updated, usd, agentUsd, requests, agents, clock, hasDetail, days[] {day, usd, tokens}, stages[] {stage, usd}`.
- Produces: `window.FK_SESSIONS` and `module.exports`, `{ page, view, compareHtml, onClick, state, reset, EN }`:
  - `page(S, o) -> string` — `o = { names, now, serve, redraw, tray }`; `tray: true` is `#/cmp`: on landing with two or more ticked rows the compare dialog opens.
  - `view(sessions, q, now) -> { list, periods }` — `q` is the state shape `{d, p, g, c, sort, dir}`; `list` the filtered rows in sort order; `periods` four `{d, n, landed, mid, usd}` (`usd` null for 全部).
  - `compareHtml(list, names) -> string` — the dialog's grid.
  - `onClick(e)` — the page's delegated click handler (bound on `document` by `page`); `state()` the module state `{d, p, g, c, sort, dir, pg, picked, pop, cmp}`; `reset()` back to defaults (tests).
- Wiring (Tasks 15/16, not this task): Task 15 loads the files after `tip.js`; Task 16 routes `sessions` to `FK_SESSIONS.page(S, modOpts())` and `cmp` to `FK_SESSIONS.page(S, modOpts({ tray: true }))`, each falling back to the old view when `w.FK_SESSIONS` is absent.

**Dispatch:** implementer, opus

1. Write the failing test `tests/station-sessions-redesign.test.js`:

```js
'use strict';
// 全部 sessions (assets/station/sessions-page.js; design 2026-10-21-station-redesign
// §2; mockups route-sessions.html and route-list-cmp.html): the period tiles
// filter the list, ten rows a page, filters and sorting, ticking two or three
// rows for the compare dialog, #/cmp landing on the list with the dialog, and
// the dialog's larger figure marked and equal figures read 一樣.
const test = require('node:test');
const assert = require('node:assert/strict');
const { page, stringsLeft } = require('./station-module.js');

const NOW = new Date(2026, 9, 22, 15, 0, 0).getTime();
const DAY = 864e5;
const at = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString();
const dayOf = (daysAgo) => { const d = new Date(NOW - daysAgo * DAY); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const R = ['survey', 'plan', 'build', 'land'];
const ses = (n, o) => Object.assign({ id: 'id' + String(n).padStart(6, '0') + '-x', task: 'Task ' + n, pkey: 'F:\\w/app', route: R, stage: 'build', state: 'down',
    started: at(n % 5 + 1), updated: at(n % 5 + 0.5), usd: n, agentUsd: 1, requests: 10, agents: 2, clock: n * 60000, hasDetail: true,
    days: [{ day: dayOf(0), usd: 0.5, tokens: 1000 }], stages: [] }, o);

function mod(lang) {
    const { win } = page(['tip.js', 'sessions-page.js'], {});
    if (lang) win.FK_I18N = { lang };
    win.FK_SESSIONS.reset();
    return win.FK_SESSIONS;
}
// A clicked element: attributes and `closest` over `[name]` / `[name="v"]`
// selectors, walking up `parent`; the page wrapper is the top.
function el(attrs, parent) {
    return {
        attrs, parent: parent || null, disabled: false,
        getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
        closest(sel) {
            for (const part of sel.split(',')) {
                const m = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(part.trim());
                if (m && Object.prototype.hasOwnProperty.call(this.attrs, m[1]) && (m[2] === undefined || this.attrs[m[1]] === m[2])) return this;
            }
            return this.parent ? this.parent.closest(sel) : null;
        },
    };
}
const PAGE = el({ 'data-block': 'sessions-page' });
const click = (P, attrs) => P.onClick({ target: el(attrs, PAGE) });

test('the period tiles count, land and spend inside their window', () => {
    const P = mod();
    const list = [
        ses(1, { updated: at(0.2), stage: 'land', route: R, days: [{ day: dayOf(0), usd: 2 }, { day: dayOf(10), usd: 5 }] }),
        ses(2, { updated: at(3), days: [{ day: dayOf(3), usd: 1 }] }),
        ses(3, { started: at(21), updated: at(20), route: [], stage: 'init', days: null }),
    ];
    const v = P.view(list, P.state(), NOW);
    assert.deepEqual(Array.from(v.periods, (p) => p.d), ['1', '7', '30', '']);
    assert.deepEqual(Array.from(v.periods, (p) => p.n), [1, 2, 3, 3]);
    assert.deepEqual(Array.from(v.periods, (p) => p.landed), [1, 1, 1, 1]);
    assert.deepEqual(Array.from(v.periods, (p) => p.mid), [0, 1, 1, 1]);
    assert.deepEqual(Array.from(v.periods, (p) => p.usd), [2, 3, 8, null]);
});

test('ten rows a page, sorted by last move; the pager turns', () => {
    const P = mod();
    let redraws = 0;
    const S = { sessions: Array.from({ length: 12 }, (x, i) => ses(i + 1, { updated: at(i * 0.01) })) };
    const o = { names: {}, now: NOW, redraw: () => { redraws++; } };
    let html = P.page(S, o);
    assert.equal((html.match(/<tr data-ss-row=/g) || []).length, 10);
    assert.ok(html.indexOf('data-ss-row="id000001-x"') < html.indexOf('data-ss-row="id000002-x"'));
    assert.ok(html.includes('data-ss-pg="1"'));
    click(P, { 'data-ss-pg': '1' });
    assert.equal(redraws, 1);
    html = P.page(S, o);
    assert.equal((html.match(/<tr data-ss-row=/g) || []).length, 2);
});

test('a row shows cost as usd + agentUsd, and sorts on cost both ways', () => {
    const P = mod();
    const S = { sessions: [ses(1), ses(5), ses(3)] };
    const o = { names: {}, now: NOW, redraw() {} };
    let html = P.page(S, o);
    assert.ok(html.includes('<td class="r">$6.00</td>'), 'id 5: 5 + 1');
    click(P, { 'data-ss-sort': 'usd' });
    html = P.page(S, o);
    const order = (h) => [...h.matchAll(/data-ss-row="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(order(html), ['id000005-x', 'id000003-x', 'id000001-x']);
    click(P, { 'data-ss-sort': 'usd' });
    assert.deepEqual(order(P.page(S, o)), ['id000001-x', 'id000003-x', 'id000005-x']);
});

test('the project, stage and cost filters narrow the list; 重設篩選 clears them', () => {
    const P = mod();
    const S = { sessions: [ses(1), ses(2, { pkey: 'F:\\w/other' }), ses(30, { stage: 'land' })] };
    const o = { names: {}, now: NOW, redraw() {} };
    click(P, { 'data-ss-pop': 'p' });
    let html = P.page(S, o);
    assert.ok(html.includes('data-ss-f="p" data-v="F:\\w/other"'), 'the project popover lists the project');
    click(P, { 'data-ss-f': 'p', 'data-v': 'F:\\w/other' });
    assert.equal(P.state().pop, '');
    html = P.page(S, o);
    assert.equal((html.match(/<tr data-ss-row=/g) || []).length, 1);
    assert.ok(html.includes('data-ss-reset'));
    click(P, { 'data-ss-reset': '' });
    click(P, { 'data-ss-f': 'g', 'data-v': 'land' });
    assert.equal((P.page(S, o).match(/<tr data-ss-row=/g) || []).length, 1);
    click(P, { 'data-ss-reset': '' });
    click(P, { 'data-ss-f': 'c', 'data-v': '10' });
    assert.deepEqual([...P.page(S, o).matchAll(/data-ss-row="([^"]+)"/g)].map((m) => m[1]), ['id000030-x']);
});

test('ticking two or three rows opens the compare dialog; a fourth cannot be ticked', () => {
    const P = mod();
    const S = { sessions: [ses(1), ses(2), ses(3), ses(4)] };
    const o = { names: {}, now: NOW, redraw() {} };
    click(P, { 'data-ss-tick': 'id000001-x' });
    let html = P.page(S, o);
    assert.ok(html.includes('data-ss-cmp disabled'), 'one ticked: 比較 is not yet pressable');
    click(P, { 'data-ss-tick': 'id000002-x' });
    click(P, { 'data-ss-tick': 'id000003-x' });
    html = P.page(S, o);
    assert.ok(/data-ss-tick="id000004-x" disabled/.test(html), 'three ticked: the rest are disabled');
    click(P, { 'data-ss-cmp': '' });
    assert.equal(P.state().cmp, true);
    html = P.page(S, o);
    assert.ok(html.includes('<dialog class="tdlg ss-dlg" id="ss-cmp" data-block="sessions-compare"'));
    assert.ok(html.includes('比較 3 個 session'));
    click(P, { 'data-ss-close': '' });
    assert.equal(P.state().cmp, false);
});

test('#/cmp lands on the list with the dialog open when two rows are ticked, once', () => {
    const P = mod();
    const S = { sessions: [ses(1), ses(2)] };
    click(P, { 'data-ss-tick': 'id000001-x' });
    click(P, { 'data-ss-tick': 'id000002-x' });
    const html = P.page(S, { names: {}, now: NOW, redraw() {}, tray: true });
    assert.equal(P.state().cmp, true);
    assert.ok(html.includes('<div class="ss-lf tray"'));
    assert.ok(html.includes('data-block="sessions-list"'), 'the list is behind the dialog');
    click(P, { 'data-ss-close': '' });
    P.page(S, { names: {}, now: NOW, redraw() {}, tray: true });
    assert.equal(P.state().cmp, false, 'the poll redraw does not reopen a dialog the reader closed');
});

test('the compare grid marks the larger figure, reads equal figures 一樣, and draws stage cost on one scale', () => {
    const P = mod();
    const a = ses(1, { usd: 4, agentUsd: 1, stages: [{ stage: 'plan', usd: 2 }, { stage: 'build', usd: 1 }] });
    const b = ses(2, { usd: 2, agentUsd: 1, stages: [{ stage: 'plan', usd: 0.5 }] });
    const g = P.compareHtml([a, b], {});
    assert.ok(g.includes('<div class="v top">$5.00</div><div class="v">$3.00</div>'), g);
    assert.ok(g.includes('<div class="same">$1.00<small class="eq">一樣</small></div>'), 'agent cost equal');
    assert.ok(g.includes('<div class="same">2<small class="eq">一樣</small></div>'), 'agents equal');
    assert.ok(/style="width:100%"[^>]*data-tip="plan"/.test(g), 'the largest stage bar is the full scale');
    assert.ok(/style="width:25%"[^>]*data-tip="plan"/.test(g));
    assert.ok(/style="width:50%"[^>]*data-tip="build"/.test(g));
    assert.ok(!g.includes('verify'), 'a stage no session spent on is left out');
});

test('English comes from the module table, and every string has it', () => {
    const P = mod('en');
    const html = P.page({ sessions: [ses(1)] }, { names: {}, now: NOW, redraw() {} });
    assert.ok(html.includes('Last 30 days'));
    assert.deepEqual(stringsLeft('sessions-page.js', P.EN), []);
});
```

2. Run it and watch it fail:

```sh
node --test tests/station-sessions-redesign.test.js
```

3. Write `assets/station/sessions-page.js`:

```js
'use strict';
// assets/station/sessions-page.js — 全部, the page `#/sessions` and `#/cmp`
// draw (docs/90-agent/plans/2026-10-21-station-redesign-design.md §2; mockups
// route-sessions.html and route-list-cmp.html). Top to bottom: a now-strip
// counting what runs and linking to 進行中, four period tiles (今天 / 近 7 天 /
// 近 30 天 / 全部) that are both the summary and the date filter, then one card:
// filters in its head (project, stage reached, cost floor, 重設篩選), ten rows
// a page sorted on last move, cost or elapsed, and the pager with the compare
// tray in its foot. Ticking two or three rows opens the compare dialog in
// place; `#/cmp` is this list with the dialog open, so it is never empty. The
// dialog shows the fields lib/compare.js returns, the larger of each row
// marked and equal figures read 一樣. State lives here across the poll's
// redraw, which redraws through `o.redraw`; an open dialog is reopened after
// it. Reads `w.FK_KIT` when it draws.
(function (w, doc) {
    var EN = {
        'ss.now': 'Now',
        'ss.nRun': '{n} running',
        'ss.noRun': 'Nothing running',
        'ss.nGate': '{n} gates waiting on you',
        'ss.noGate': 'No gate waiting on you',
        'ss.nStale': '{n} may have stopped',
        'ss.goLive': 'See Live',
        'ss.today': 'Today',
        'ss.d7': 'Last 7 days',
        'ss.d30': 'Last 30 days',
        'ss.dAll': 'All time',
        'ss.periods': 'Period, by last move',
        'ss.spend': 'Cost {v}',
        'ss.spend30': 'Cost is kept 30 days',
        'ss.nSessions': 'sessions',
        'ss.landed': 'Landed {n}',
        'ss.mid': 'Not finished {n}',
        'ss.byLast': 'By last move',
        'ss.byCost': 'By cost',
        'ss.byTime': 'By elapsed',
        'ss.newFirst': 'newest first',
        'ss.oldFirst': 'oldest first',
        'ss.highFirst': 'highest first',
        'ss.lowFirst': 'lowest first',
        'ss.longFirst': 'longest first',
        'ss.shortFirst': 'shortest first',
        'ss.perPage': '{how}, {n} a page',
        'ss.pick': 'Tick to compare',
        'ss.task': 'Task · project',
        'ss.result': 'Result',
        'ss.cost': 'Cost',
        'ss.last': 'Last move',
        'ss.elapsed': 'Elapsed',
        'ss.unnamed': '(unnamed)',
        'ss.init': 'Starting up, no route',
        'ss.unfinished': 'Not finished',
        'ss.noDetail': 'No transcript: nothing to compare',
        'ss.filters': 'Filter sessions',
        'ss.project': 'Project',
        'ss.allProjects': 'All projects',
        'ss.stage': 'Stage reached',
        'ss.anyStage': 'Any stage',
        'ss.toLand': 'Reached land',
        'ss.midAny': 'Not finished (any stage)',
        'ss.initStage': 'Starting up',
        'ss.costFloor': 'Cost',
        'ss.anyCost': 'Any cost',
        'ss.reset': 'Reset filters',
        'ss.empty': 'No session matches these filters.',
        'ss.trayRegion': 'Compare the ticked sessions',
        'ss.trayHint': 'Tick two or three rows to compare; ticks survive paging',
        'ss.picked': '{n} ticked',
        'ss.oneMore': ', tick one more',
        'ss.compare': 'Compare',
        'ss.untick': 'Clear ticks',
        'ss.pager': 'Pages',
        'ss.rows': 'Rows {a}–{b}',
        'ss.prev': 'Previous page',
        'ss.next': 'Next page',
        'ss.pageN': 'Page {n}',
        'ss.cmpTitle': 'Compare {n} sessions',
        'ss.cmpSub': 'Click a title to open that session',
        'ss.close': 'Close',
        'ss.cmpFoot': 'The larger figure of each row is marked',
        'ss.same': 'same',
        'ss.main': 'Main session',
        'ss.agentUsd': 'Agents',
        'ss.requests': 'API requests',
        'ss.agents': 'Agents sent',
        'ss.tokens': 'Tokens',
        'ss.started': 'Started',
        'ss.stages': 'Cost by stage',
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function fill(s, vars) {
        if (!vars) return s;
        return String(s).replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) ? String(vars[k]) : m; });
    }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return fill(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    function kit() { return (w && w.FK_KIT) || {}; }
    function esc(s) { return kit().esc(s); }
    function tip(label, values) { return w && w.FK_TIP ? w.FK_TIP.attr(label, values) : ''; }
    function ms(t) { return typeof t === 'number' ? t : Date.parse(t); }
    function lastOf(s) {
        var a = ms(s.updated), b = ms(s.started);
        return Math.max(isFinite(a) ? a : 0, isFinite(b) ? b : 0);
    }
    function two(n) { return ('0' + n).slice(-2); }
    function when(t) {
        if (!t || !isFinite(t)) return '—';
        var d = new Date(t);
        return two(d.getMonth() + 1) + '-' + two(d.getDate()) + ' ' + two(d.getHours()) + ':' + two(d.getMinutes());
    }
    function ico(d, size) {
        return '<svg class="ico" viewBox="0 0 16 16" width="' + (size || 16) + '" height="' + (size || 16) + '" aria-hidden="true" fill="none" stroke="currentColor"'
            + ' stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
    }
    var CARET = '<svg class="caret" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var I_PROJ = ico('<path d="M2 4.5h4.5l1.5 1.5h6v6.5H2z"/>');
    var I_STAGE = ico('<circle cx="3" cy="8" r="1.6"/><circle cx="8" cy="8" r="1.6"/><circle cx="13" cy="8" r="1.6"/><path d="M4.6 8h1.8M9.6 8h1.8"/>');
    var I_COST = ico('<circle cx="8" cy="8" r="6"/><path d="M10 5.8H7.2a1.2 1.2 0 0 0 0 2.4h1.6a1.2 1.2 0 0 1 0 2.4H6M8 4.4v1.4M8 10.6V12"/>');
    var I_RESET = ico('<path d="M3 8a5 5 0 1 0 1.5-3.5"/><path d="M3 2.5V5h2.5"/>');
    var I_TICK = ico('<rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/><path d="m5.5 8 1.8 1.8L10.8 6"/>');
    var I_GO = ico('<path d="M3 8h10M9 4l4 4-4 4"/>');
    var I_ARROW = '<svg class="ico ar" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6.5 8 10l3.5-3.5"/></svg>';
    var I_X = '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

    var PER = 10, PERIODS = ['1', '7', '30', ''];
    function fresh() { return { d: '30', p: '', g: '', c: '', sort: 'last', dir: -1, pg: 0, picked: [], pop: '', cmp: false }; }
    var st = fresh(), last = null, bound = false, trayLanded = false;

    function stageOf(s) { var r = s.route || []; return !r.length ? 'init' : s.stage === 'land' ? 'land' : s.stage; }
    function landed(s) { return (s.route || []).length > 0 && s.stage === 'land'; }
    function dayStart(now) { var m = new Date(now); m.setHours(0, 0, 0, 0); return m.getTime(); }
    function inPeriod(s, d, now) { return !d || lastOf(s) >= dayStart(now) - (+d - 1) * 864e5; }
    // What the session spent on the period's local days, from `days` (kept ~30 days).
    function spendIn(s, d, now) {
        var from = kit().lastDays(now, +d)[0];
        return (s.days || []).reduce(function (n, x) { return n + (x && x.day >= from && typeof x.usd === 'number' ? x.usd : 0); }, 0);
    }
    function match(s, q, skip, now) {
        if (skip !== 'p' && q.p && s.pkey !== q.p) return false;
        if (skip !== 'g' && q.g) {
            var g = stageOf(s);
            if (q.g === 'mid' ? (g === 'land' || g === 'init') : g !== q.g) return false;
        }
        if (skip !== 'd' && !inPeriod(s, q.d, now)) return false;
        if (skip !== 'c' && q.c && kit().cost(s) < +q.c) return false;
        return true;
    }
    function keyOf(sort) {
        if (sort === 'usd') return function (s) { return kit().cost(s); };
        if (sort === 'ck') return function (s) { return s.clock || 0; };
        return lastOf;
    }
    function view(sessions, q, now) {
        var all = sessions || [], key = keyOf(q.sort), dir = q.dir || -1;
        var list = all.filter(function (s) { return match(s, q, '', now); })
            .sort(function (a, b) { return dir * (key(a) - key(b)) || lastOf(b) - lastOf(a); });
        var base = all.filter(function (s) { return match(s, q, 'd', now); });
        var periods = PERIODS.map(function (d) {
            var L = base.filter(function (s) { return inPeriod(s, d, now); });
            return {
                d: d, n: L.length, landed: L.filter(landed).length,
                mid: L.filter(function (s) { return (s.route || []).length > 0 && !landed(s); }).length,
                usd: d ? Math.round(L.reduce(function (n, s) { return n + spendIn(s, d, now); }, 0) * 100) / 100 : null,
            };
        });
        return { list: list, periods: periods };
    }

    function periodLabel(d) {
        if (d === '1') return loc('ss.today', '今天');
        if (d === '7') return loc('ss.d7', '近 7 天');
        if (d === '30') return loc('ss.d30', '近 30 天');
        return loc('ss.dAll', '全部時間');
    }
    function nowStrip(all) {
        var run = all.filter(function (s) { return s.state === 'live' && !s.gateAt; }).length;
        var gate = all.filter(function (s) { return s.gateAt && s.state !== 'down'; }).length;
        var stale = all.filter(function (s) { return s.state === 'stale' && !s.gateAt; }).length;
        return '<a class="ss-now" data-block="sessions-now" href="#/live"><span class="k">' + loc('ss.now', '現在') + '</span>'
            + '<span>' + (run ? '<i class="dot live" aria-hidden="true"></i>' + loc('ss.nRun', '{n} 個在跑', { n: '<b>' + run + '</b>' }) : loc('ss.noRun', '沒有 session 在跑')) + '</span>'
            + '<span' + (gate ? ' class="warn"' : '') + '>' + (gate ? loc('ss.nGate', '{n} 個 gate 等你回答', { n: '<b>' + gate + '</b>' }) : loc('ss.noGate', '沒有 gate 等你回答')) + '</span>'
            + (stale ? '<span><i class="dot stale" aria-hidden="true"></i>' + loc('ss.nStale', '{n} 個可能已停', { n: '<b>' + stale + '</b>' }) + '</span>' : '')
            + '<span class="go">' + loc('ss.goLive', '到「進行中」看') + I_GO + '</span></a>';
    }
    function periodsHtml(periods) {
        var k = kit();
        return '<div class="ss-per" data-block="sessions-periods" role="group" aria-label="' + esc(loc('ss.periods', '期間：以最後動靜算')) + '"><div class="ss-pts">'
            + periods.map(function (p) {
                return '<button type="button" class="ss-pt" data-ss-d="' + p.d + '" aria-pressed="' + (p.d === st.d) + '">'
                    + '<span class="l">' + periodLabel(p.d) + '</span>'
                    + (p.usd === null ? '<span class="usd na">' + loc('ss.spend30', '花費只記 30 天') + '</span>'
                        : '<span class="usd">' + loc('ss.spend', '花費 {v}', { v: k.usd(p.usd, true) }) + '</span>')
                    + '<span class="n"><b>' + p.n + '</b>' + loc('ss.nSessions', '個 session') + '</span>'
                    + '<span class="f">' + loc('ss.landed', '走到 land {n}', { n: '<b>' + p.landed + '</b>' })
                    + ' · <span class="mid">' + loc('ss.mid', '還沒走完 {n}', { n: '<b>' + p.mid + '</b>' }) + '</span></span></button>';
            }).join('') + '</div></div>';
    }
    // The popover's items, counted over the rows the other filters leave.
    function itemsOf(key, all, names, now) {
        var k = kit(), base = all.filter(function (s) { return match(s, st, key, now); }), items;
        if (key === 'p') {
            var n = {}, order = [];
            base.forEach(function (s) { if (!n[s.pkey]) { n[s.pkey] = 0; order.push(s.pkey); } n[s.pkey]++; });
            if (st.p && !n[st.p]) { n[st.p] = 0; order.push(st.p); }
            items = [{ v: '', main: loc('ss.allProjects', '全部專案'), n: base.length }].concat(order.sort().map(function (p) {
                return { v: p, main: k.shortLabel(names[p] || p), n: n[p] };
            }));
        } else if (key === 'c') {
            items = [{ v: '', main: loc('ss.anyCost', '不限花費'), n: base.length }].concat([10, 50, 100].map(function (v) {
                return { v: String(v), main: '≥ $' + v, n: base.filter(function (s) { return k.cost(s) >= v; }).length };
            }));
        } else {
            var c = {};
            base.forEach(function (s) { var g = stageOf(s); c[g] = (c[g] || 0) + 1; if (g !== 'land' && g !== 'init') c.mid = (c.mid || 0) + 1; });
            items = [{ v: '', main: loc('ss.anyStage', '任何一站'), n: base.length },
                { v: 'land', main: loc('ss.toLand', '走到 land'), n: c.land || 0, lead: '<i class="dot" style="background:var(--st-land)"></i>' },
                { v: 'mid', main: loc('ss.midAny', '還沒走完（任何一站）'), n: c.mid || 0 }]
                .concat(k.ROUTE.slice(0, 6).map(function (g) { return { v: g, main: g, n: c[g] || 0, lead: '<i class="dot" style="background:var(--st-' + g + ')"></i>' }; }))
                .concat([{ v: 'init', main: loc('ss.initStage', '初始化中'), n: c.init || 0 }])
                .filter(function (it) { return it.n || !it.v || it.v === st.g; });
        }
        return items;
    }
    function pickHtml(key, label, icon, items) {
        var cur = items[0], open = st.pop === key;
        items.forEach(function (it) { if (it.v === st[key]) cur = it; });
        return '<div class="ss-f ctlgrp"><div class="rwrap"' + (st[key] ? ' data-set' : '') + '>'
            + '<button type="button" class="rbtn" data-ss-pop="' + key + '" aria-haspopup="listbox" aria-expanded="' + open + '" aria-label="' + esc(label + ': ' + cur.main) + '">'
            + icon + '<span class="fl">' + esc(cur.main) + '</span><b class="fc">' + cur.n + '</b>' + CARET + '</button>'
            + (open ? '<div class="rpop" role="listbox" aria-label="' + esc(label) + '">' + items.map(function (it) {
                return '<button type="button" role="option" data-ss-f="' + key + '" data-v="' + esc(it.v) + '" aria-selected="' + (it.v === st[key]) + '">' + (it.lead || '')
                    + '<span class="ro-m"><span class="fl">' + esc(it.main) + '</span></span><b class="fc">' + it.n + '</b></button>';
            }).join('') + '</div>' : '') + '</div></div>';
    }
    function result(s) {
        var k = kit(), route = s.route || [], at = route.indexOf(s.stage), out;
        if (!route.length || at < 0) out = '<span class="init">' + loc('ss.init', '初始化中，沒有路線') + '</span>';
        else {
            var place = function (name) { var i = route.indexOf(name); return i < 0 ? null : i < at ? 'done' : i === at ? 'now' : 'todo'; };
            out = k.keelGlyph({ cls: 'prog', seg: function (i) { return place(k.ROUTE[i]); }, edge: place('land') || 'todo', c: 'var(--st-' + esc(s.stage) + ')' })
                + '<span class="kst k-only' + (landed(s) && s.state === 'down' ? ' ok' : '') + '" style="--c:var(--st-' + esc(s.stage) + ')"><b>' + two(at + 1)
                + '</b><i>&nbsp;/&nbsp;' + two(route.length) + '</i><u>' + esc(s.stage) + '</u></span>';
            if (s.state === 'down' && !landed(s)) out += '<span class="stop">' + loc('ss.unfinished', '沒走完') + '</span>';
        }
        if (s.state === 'live') out += '<span class="pill live"><i class="dot live pulse"></i>live</span>';
        if (s.state === 'stale') out += '<span class="pill stale"><i class="dot stale"></i>stale</span>';
        return '<span class="ss-res">' + out + '</span>';
    }
    function sub(s, names, colours) {
        return '<span class="ss-sub">' + (colours ? '<i class="sw" style="background:' + colours(s.pkey) + '" aria-hidden="true"></i>' : '')
            + '<span>' + esc(kit().shortLabel(names[s.pkey] || s.pkey || '')) + '</span><span class="id">' + esc(String(s.id).slice(0, 8)) + '</span></span>';
    }
    function titleOf(s) { return s.task ? esc(s.task) : loc('ss.unnamed', '（未命名）'); }
    function rowHtml(s, names, colours) {
        var k = kit(), on = st.picked.indexOf(s.id) >= 0, c = k.cost(s);
        var dis = !s.hasDetail ? ' disabled title="' + esc(loc('ss.noDetail', '沒有 transcript，沒有可比的')) + '"' : !on && st.picked.length >= 3 ? ' disabled' : '';
        return '<tr data-ss-row="' + esc(s.id) + '"' + (on ? ' class="on"' : '') + '>'
            + '<td><label class="ss-ck"><span class="hm-sr">' + loc('ss.pick', '勾選來比較') + '</span><input type="checkbox" data-ss-tick="' + esc(s.id) + '"' + (on ? ' checked' : '') + dis + '></label></td>'
            + '<td><a class="ss-task' + (s.task ? '' : ' un') + '" href="' + esc(k.sessionHash(s.id)) + '">' + titleOf(s) + '</a>' + sub(s, names, colours) + '</td>'
            + '<td>' + result(s) + '</td>'
            + '<td class="r' + (c ? '' : ' z') + '">' + k.usd(c, true) + '</td>'
            + '<td class="m c-at">' + when(lastOf(s)) + '</td>'
            + '<td class="r c-ck' + (s.clock ? '' : ' z') + '">' + k.mins(s.clock || null) + '</td></tr>';
    }
    var SORTS = { last: ['ss.byLast', 'ss.newFirst', 'ss.oldFirst'], usd: ['ss.byCost', 'ss.highFirst', 'ss.lowFirst'], ck: ['ss.byTime', 'ss.longFirst', 'ss.shortFirst'] };
    function sortText(key) {
        if (key === 'ss.byLast') return loc('ss.byLast', '依最後動靜排');
        if (key === 'ss.byCost') return loc('ss.byCost', '依花費排');
        if (key === 'ss.byTime') return loc('ss.byTime', '依用時排');
        if (key === 'ss.newFirst') return loc('ss.newFirst', '新的在前');
        if (key === 'ss.oldFirst') return loc('ss.oldFirst', '舊的在前');
        if (key === 'ss.highFirst') return loc('ss.highFirst', '高的在前');
        if (key === 'ss.lowFirst') return loc('ss.lowFirst', '低的在前');
        if (key === 'ss.longFirst') return loc('ss.longFirst', '長的在前');
        return loc('ss.shortFirst', '短的在前');
    }
    function th(key, label, cls) {
        var on = st.sort === key;
        return '<th scope="col" class="' + cls + '"' + (on ? ' aria-sort="' + (st.dir < 0 ? 'descending' : 'ascending') + '"' : '') + '>'
            + '<button type="button" data-ss-sort="' + key + '">' + label + I_ARROW + '</button></th>';
    }
    function pagerHtml(n) {
        var pages = Math.max(1, Math.ceil(n / PER)), pg = st.pg, show = [], out = [];
        if (!n) return '<nav class="ss-pg" aria-label="' + esc(loc('ss.pager', '翻頁')) + '"></nav>';
        for (var i = 0; i < pages; i++) if (i === 0 || i === pages - 1 || Math.abs(i - pg) <= 1 || (pg < 3 && i < 4) || (pg > pages - 4 && i > pages - 5)) show.push(i);
        show.forEach(function (i, j) {
            if (j && i - show[j - 1] > 1) out.push('<span class="gap" aria-hidden="true">…</span>');
            out.push('<button type="button" data-ss-pg="' + i + '"' + (i === pg ? ' aria-current="page"' : '') + ' aria-label="' + esc(loc('ss.pageN', '第 {n} 頁', { n: i + 1 })) + '">' + (i + 1) + '</button>');
        });
        return '<nav class="ss-pg" aria-label="' + esc(loc('ss.pager', '翻頁')) + '"><span class="at">' + loc('ss.rows', '第 {a}–{b} 筆', { a: pg * PER + 1, b: Math.min(n, pg * PER + PER) }) + '</span>'
            + '<button type="button" data-ss-pg="' + (pg - 1) + '"' + (pg ? '' : ' disabled') + ' aria-label="' + esc(loc('ss.prev', '上一頁')) + '">' + ico('<path d="M10 3.5 5.5 8l4.5 4.5"/>') + '</button>'
            + out.join('')
            + '<button type="button" data-ss-pg="' + (pg + 1) + '"' + (pg < pages - 1 ? '' : ' disabled') + ' aria-label="' + esc(loc('ss.next', '下一頁')) + '">' + ico('<path d="M6 3.5 10.5 8 6 12.5"/>') + '</button></nav>';
    }
    function trayHtml() {
        var n = st.picked.length;
        if (!n) return '<span class="hint">' + I_TICK + loc('ss.trayHint', '勾兩到三列來比較，翻頁也記得') + '</span>';
        return '<span>' + loc('ss.picked', '已勾 {n} 個', { n: '<b class="ss-n">' + n + '</b>' }) + (n < 2 ? loc('ss.oneMore', '，再勾一個') : '') + '</span>'
            + '<button type="button" class="pri" data-ss-cmp' + (n < 2 ? ' disabled' : '') + ' aria-haspopup="dialog">' + loc('ss.compare', '比較') + '</button>'
            + '<button type="button" class="sec" data-ss-clear>' + loc('ss.untick', '取消勾選') + '</button>';
    }

    // The dialog's rows: one figure a session; the larger marked, equal ones once with 一樣.
    function line(label, vals, fmt) {
        var head = '<div class="k">' + label + '</div>';
        if (vals.every(function (v) { return v === null || v === undefined; })) return head + '<div class="same">—</div>';
        if (vals.every(function (v) { return v === vals[0]; })) return head + '<div class="same">' + esc(fmt(vals[0])) + '<small class="eq">' + loc('ss.same', '一樣') + '</small></div>';
        var max = Math.max.apply(null, vals.map(function (v) { return v || 0; }));
        return head + vals.map(function (v) { return '<div class="v' + (max > 0 && v === max ? ' top' : '') + '">' + esc(v === null ? '—' : fmt(v)) + '</div>'; }).join('');
    }
    function tokensOf(s) {
        var t = null;
        (s.days || []).forEach(function (x) { if (x && typeof x.tokens === 'number') t = (t || 0) + x.tokens; });
        return t;
    }
    function stageUsd(s, g) {
        return (s.stages || []).reduce(function (n, x) { return n + (x && x.stage === g && typeof x.usd === 'number' ? x.usd : 0); }, 0);
    }
    function compareHtml(list, names) {
        var k = kit(), nm = names || {}, usdF = function (v) { return k.usd(v, true); };
        var out = '<div class="ss-cg" style="--n:' + list.length + '"><div class="h"></div>'
            + list.map(function (s) { return '<div class="h"><a href="' + esc(k.sessionHash(s.id)) + '">' + titleOf(s) + '</a>' + sub(s, nm, null) + '</div>'; }).join('')
            + '<div class="k">' + loc('ss.result', '結果') + '</div>' + list.map(function (s) { return '<div>' + result(s) + '</div>'; }).join('')
            + line(loc('ss.cost', '花費'), list.map(function (s) { return k.cost(s); }), usdF)
            + line(loc('ss.main', '主 session'), list.map(function (s) { return s.usd || 0; }), usdF)
            + line(loc('ss.agentUsd', '派工'), list.map(function (s) { return s.agentUsd || 0; }), usdF)
            + line(loc('ss.requests', 'API 請求'), list.map(function (s) { return s.requests || 0; }), String)
            + line(loc('ss.agents', '派出 agent'), list.map(function (s) { return s.agents || 0; }), String)
            + line(loc('ss.tokens', 'token'), list.map(tokensOf), k.tokens)
            + '<div class="k">' + loc('ss.started', '開始') + '</div>' + list.map(function (s) { return '<div class="v">' + when(ms(s.started)) + '</div>'; }).join('');
        var stages = k.ROUTE.filter(function (g) { return list.some(function (s) { return stageUsd(s, g) > 0; }); });
        var max = Math.max.apply(null, [0].concat(list.map(function (s) { return Math.max.apply(null, [0].concat(stages.map(function (g) { return stageUsd(s, g); }))); })));
        if (stages.length) {
            out += '<div class="sec">' + loc('ss.stages', '各站花費') + '</div>' + stages.map(function (g) {
                return '<div class="k"><i class="dot" style="background:var(--st-' + g + ')"></i>' + g + '</div>' + list.map(function (s) {
                    var v = stageUsd(s, g);
                    return v > 0 ? '<div class="ss-bar" style="--c:var(--st-' + g + ')"><i style="width:' + Math.max(1, Math.round(v / max * 100)) + '%"' + tip(g, [usdF(v)]) + '></i></div>'
                        : '<div class="none">—</div>';
                }).join('');
            }).join('');
        }
        return out + '</div>';
    }
    function dialogHtml(all, names, land) {
        var list = st.picked.map(function (id) { return all.filter(function (s) { return s.id === id; })[0]; }).filter(Boolean);
        return '<dialog class="tdlg ss-dlg" id="ss-cmp" data-block="sessions-compare" aria-labelledby="ss-cmp-h"' + (land ? ' data-land' : '') + '><div class="tdlg-in">'
            + '<div class="tdlg-hd"><b id="ss-cmp-h">' + loc('ss.cmpTitle', '比較 {n} 個 session', { n: list.length }) + '</b>'
            + '<span class="tdlg-sub">' + loc('ss.cmpSub', '點標題開那個 session') + '</span>'
            + '<button type="button" class="tdlg-x" data-ss-close aria-label="' + esc(loc('ss.close', '關閉')) + '" title="' + esc(loc('ss.close', '關閉')) + '">' + I_X + '</button></div>'
            + '<div class="tdlg-p">' + (list.length >= 2 ? compareHtml(list, names) : '') + '</div>'
            + '<div class="tdlg-ft"><span>' + loc('ss.cmpFoot', '每一列較大的值標出來') + '</span></div></div></dialog>';
    }

    function page(S, o) {
        o = o || {};
        last = o;
        bind();
        var now = isFinite(o.now) ? o.now : Date.now(), names = o.names || {}, all = (S && S.sessions) || [];
        st.picked = st.picked.filter(function (id) { return all.some(function (s) { return s.id === id; }); });
        if (o.tray && !trayLanded) { trayLanded = true; if (st.picked.length >= 2) st.cmp = true; }
        if (!o.tray) trayLanded = false;
        if (st.picked.length < 2) st.cmp = false;
        var v = view(all, st, now), n = v.list.length;
        if (st.pg > Math.max(0, Math.ceil(n / PER) - 1)) st.pg = Math.max(0, Math.ceil(n / PER) - 1);
        var pk = [];
        all.forEach(function (s) { if (pk.indexOf(s.pkey) < 0) pk.push(s.pkey); });
        pk.sort();
        var colours = function (p) { return 'var(--p-' + Math.min(Math.max(pk.indexOf(p), 0), 5) + ')'; };
        var srt = SORTS[st.sort] || SORTS.last;
        var rows = n ? v.list.slice(st.pg * PER, st.pg * PER + PER).map(function (s) { return rowHtml(s, names, colours); }).join('')
            : '<tr><td colspan="6"><div class="ss-empty">' + loc('ss.empty', '沒有符合這些篩選的 session。') + '<br><button type="button" data-ss-reset>' + loc('ss.reset', '重設篩選') + '</button></div></td></tr>';
        var html = '<div class="ss" data-block="sessions-page">' + nowStrip(all) + periodsHtml(v.periods)
            + '<section class="dcard ss-list" data-block="sessions-list" aria-labelledby="ss-cap"><div class="ss-lh">'
            + '<h2 class="ss-cap" id="ss-cap"><span>' + sortText(srt[0]) + '</span><small>' + loc('ss.perPage', '{how}，一頁 {n} 筆', { how: sortText(st.dir < 0 ? srt[1] : srt[2]), n: PER }) + '</small></h2>'
            + '<div class="ss-filter controls lctl" data-block="sessions-filter" role="group" aria-label="' + esc(loc('ss.filters', '篩選 session')) + '">'
            + pickHtml('p', loc('ss.project', '專案'), I_PROJ, itemsOf('p', all, names, now))
            + pickHtml('g', loc('ss.stage', '停在哪一站'), I_STAGE, itemsOf('g', all, names, now))
            + pickHtml('c', loc('ss.costFloor', '花費'), I_COST, itemsOf('c', all, names, now))
            + (st.p || st.g || st.c ? '<button type="button" class="ss-reset" data-ss-reset>' + I_RESET + loc('ss.reset', '重設篩選') + '</button>' : '')
            + '</div></div>'
            + '<div class="ss-scroll"><table class="ss-t"><colgroup><col class="ck"><col><col class="res"><col class="usd"><col class="at"><col class="ck2"></colgroup><thead><tr>'
            + '<th scope="col"><span class="hm-sr">' + loc('ss.pick', '勾選來比較') + '</span></th>'
            + '<th scope="col">' + loc('ss.task', '任務 · 專案') + '</th><th scope="col">' + loc('ss.result', '結果') + '</th>'
            + th('usd', loc('ss.cost', '花費'), 'r') + th('last', loc('ss.last', '最後動靜'), 'c-at') + th('ck', loc('ss.elapsed', '用時'), 'r c-ck')
            + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
            + '<div class="ss-lf' + (o.tray ? ' tray' : '') + '" data-block="sessions-pager"><div class="ss-tray" role="region" aria-label="' + esc(loc('ss.trayRegion', '比較勾選的 session')) + '">' + trayHtml() + '</div>'
            + pagerHtml(n) + '</div></section></div>'
            + dialogHtml(all, names, Boolean(o.tray));
        if (st.cmp && w && typeof w.setTimeout === 'function') w.setTimeout(reopen, 0);
        return html;
    }
    // The poll's redraw replaced the dialog: open the new one again.
    function reopen() {
        var d = doc && doc.getElementById('ss-cmp');
        if (st.cmp && d && !d.open && typeof d.showModal === 'function') d.showModal();
    }
    function redraw() { if (last && typeof last.redraw === 'function') last.redraw(); }
    function toggle(id) {
        var i = st.picked.indexOf(id);
        if (i >= 0) st.picked.splice(i, 1);
        else if (st.picked.length < 3) st.picked.push(id);
    }
    function onClick(e) {
        var t = e && e.target, a;
        if (!t || typeof t.closest !== 'function' || !t.closest('[data-block="sessions-page"],[data-block="sessions-compare"]')) return;
        if ((a = t.closest('[data-ss-pop]'))) { var key = a.getAttribute('data-ss-pop'); st.pop = st.pop === key ? '' : key; return redraw(); }
        if ((a = t.closest('[data-ss-f]'))) { st[a.getAttribute('data-ss-f')] = a.getAttribute('data-v'); st.pop = ''; st.pg = 0; return redraw(); }
        var hadPop = st.pop;
        st.pop = '';
        if ((a = t.closest('[data-ss-d]'))) { st.d = a.getAttribute('data-ss-d'); st.pg = 0; return redraw(); }
        if ((a = t.closest('[data-ss-reset]'))) { st.p = st.g = st.c = ''; st.pg = 0; return redraw(); }
        if ((a = t.closest('[data-ss-sort]'))) {
            var sk = a.getAttribute('data-ss-sort');
            if (sk === st.sort) st.dir = -st.dir; else { st.sort = sk; st.dir = -1; }
            st.pg = 0;
            return redraw();
        }
        if ((a = t.closest('[data-ss-pg]'))) { if (!a.disabled) { st.pg = +a.getAttribute('data-ss-pg'); return redraw(); } return; }
        if ((a = t.closest('[data-ss-tick]'))) { toggle(a.getAttribute('data-ss-tick')); return redraw(); }
        if ((a = t.closest('[data-ss-cmp]'))) { if (st.picked.length >= 2) { st.cmp = true; return redraw(); } return; }
        if ((a = t.closest('[data-ss-clear]'))) { st.picked = []; st.cmp = false; return redraw(); }
        if ((a = t.closest('[data-ss-close]'))) {
            st.cmp = false;
            var d = doc && doc.getElementById('ss-cmp');
            if (d && d.open && typeof d.close === 'function') d.close();
            return;
        }
        if (t.closest('[data-block="sessions-compare"]') && t.closest('[href]')) { st.cmp = false; return; }
        if (hadPop) redraw();
    }
    function bind() {
        if (bound || !doc || typeof doc.addEventListener !== 'function') return;
        bound = true;
        doc.addEventListener('click', onClick);
        doc.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (st.cmp) st.cmp = false;
            else if (st.pop) { st.pop = ''; redraw(); }
        });
    }
    function state() { return st; }
    function reset() { st = fresh(); trayLanded = false; }

    var api = { page: page, view: view, compareHtml: compareHtml, onClick: onClick, state: state, reset: reset, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_SESSIONS = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
```

4. Write `assets/station/sessions-page.css`:

```css
/* assets/station/sessions-page.css — 全部 sessions (assets/station/sessions-page.js),
   ported from route-sessions.html's blocks sessions-page, sessions-now,
   sessions-periods, sessions-list, sessions-filter, sessions-pager and
   sessions-compare. Nothing scrolls the page at 1440x900: the card's table does. */
.ss{display:flex;flex-direction:column;gap:12px;height:calc(100vh - 76px - 18px);min-height:0}
@media (max-height:700px),(max-width:999px){.ss{height:auto}}
.ss .hm-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.ss button:focus-visible,.ss a:focus-visible,.ss input:focus-visible,.ss-dlg button:focus-visible,.ss-dlg a:focus-visible{outline:2px solid var(--keel);outline-offset:1px}
.ss .ico,.ss-dlg .ico{width:14px;height:14px;flex:none}
.ss-n{font:700 12.5px var(--f-mono);color:var(--ink);font-variant-numeric:tabular-nums}

/* the now-strip: counted here, listed on 進行中 */
.ss-now{flex:none;align-self:flex-start;display:inline-flex;align-items:center;flex-wrap:wrap;gap:4px 0;min-height:34px;margin-top:6px;padding:0 6px 0 12px;
  border-radius:8px;box-shadow:inset 0 0 0 1px var(--rule);background:var(--panel);font-size:12.5px;color:var(--ink2);text-decoration:none}
.ss-now:hover{box-shadow:inset 0 0 0 1px var(--rule2)}
.ss-now>span{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.ss-now>span+span::before{content:"";width:1px;height:14px;margin:0 12px;background:var(--rule2)}
.ss-now .k{font-weight:700;color:var(--ink)}
.ss-now b{font:700 13px var(--f-mono);color:var(--ink);font-variant-numeric:tabular-nums}
.ss-now .warn b{color:var(--signal-ink)}
.ss-now .go{height:26px;padding:0 6px 0 10px;border-radius:6px;font-weight:600;color:var(--keel)}
.ss-now .go::before{display:none}
.ss-now:hover .go{background:var(--keel-tint)}

/* the four periods: summary and date filter in one */
.ss-per{flex:none}
.ss-pts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@media (max-width:999px){.ss-pts{grid-template-columns:repeat(2,minmax(0,1fr))}}
.ss-pt{display:grid;grid-template-columns:1fr auto;grid-template-areas:"l usd" "n n" "f f";align-items:baseline;gap:2px 12px;min-height:80px;padding:9px 16px 10px;border:0;border-radius:var(--r);
  background:var(--panel);box-shadow:inset 0 0 0 1px var(--rule);text-align:left;font:inherit;color:var(--ink2);cursor:pointer;transition:box-shadow .15s ease-out,background-color .15s ease-out}
.ss-pt:hover{box-shadow:inset 0 0 0 1px var(--rule2)}
.ss-pt[aria-pressed=true]{background:var(--keel-tint);box-shadow:inset 0 0 0 1.5px var(--keel)}
.ss-pt .l{grid-area:l;font-size:12.5px;font-weight:700;color:var(--ink)}
.ss-pt .usd{grid-area:usd;justify-self:end;font:600 12.5px var(--f-mono);color:var(--ink2);font-variant-numeric:tabular-nums;white-space:nowrap}
.ss-pt .usd.na{font:12px var(--f-ui);color:var(--muted)}
.ss-pt .n{grid-area:n;display:flex;align-items:baseline;gap:6px;font-size:12.5px;white-space:nowrap}
.ss-pt .n b{font:700 24px/1.1 var(--f-mono);color:var(--ink);font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.ss-pt .f{grid-area:f;font-size:12px;color:var(--ink2);white-space:nowrap}
.ss-pt .f b{font:700 12.5px var(--f-mono);color:var(--ink);font-variant-numeric:tabular-nums}
.ss-pt .f .mid b{color:var(--signal-ink)}

/* the list card */
:root[data-style=keel] .dcard.ss-list{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;padding:0}
.ss-lh{flex:none;display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px;min-height:50px;padding:8px 14px 8px 18px;border-bottom:1px solid var(--rule2)}
.ss-cap{margin:0;display:flex;align-items:baseline;gap:8px;font-size:13.5px;font-weight:700;color:var(--ink);white-space:nowrap}
.ss-cap small{font-size:12px;font-weight:500;color:var(--muted)}
.ss-scroll{position:relative;flex:1 1 auto;min-height:0;overflow:auto;scrollbar-gutter:stable}
@media (max-height:700px),(max-width:999px){.ss-scroll{overflow:visible}}
.ss-t{width:100%;border-collapse:collapse;table-layout:fixed;font-variant-numeric:tabular-nums}
.ss-t col.ck{width:44px}.ss-t col.res{width:244px}.ss-t col.usd{width:88px}.ss-t col.at{width:108px}.ss-t col.ck2{width:72px}
.ss-t thead th{position:sticky;top:0;z-index:1;height:34px;padding:0 10px;background:var(--panel);box-shadow:inset 0 -1px 0 var(--rule);
  text-align:left;font:500 12px var(--f-ui);color:var(--muted);white-space:nowrap}
.ss-t thead th:first-child{padding-left:18px}
.ss-t thead th.r{text-align:right}
.ss-t th button{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 4px;margin:0 -4px;border:0;border-radius:5px;background:none;font:inherit;color:inherit;cursor:pointer}
.ss-t th button:hover{color:var(--ink)}
.ss-t th[aria-sort] button{color:var(--ink);font-weight:700}
.ss-t th .ar{width:12px;height:12px;opacity:0}
.ss-t th[aria-sort] .ar{opacity:1}
.ss-t th[aria-sort=ascending] .ar{transform:rotate(180deg)}
.ss-t tbody td{padding:6px 10px;border-top:1px solid var(--rule);vertical-align:middle}
.ss-t tbody tr:first-child td{border-top:0}
.ss-t tbody td:first-child{padding-left:18px}
.ss-t tbody td:last-child{padding-right:18px}
.ss-t tbody tr:hover td{background:var(--wash)}
.ss-t tbody tr.on td{background:var(--keel-tint)}
.ss-t td.r{text-align:right;font:500 12.5px var(--f-mono);color:var(--ink);white-space:nowrap}
.ss-t td.m{font:12px var(--f-mono);color:var(--ink2);white-space:nowrap}
.ss-t td.r.z{color:var(--faint)}
.ss-t input[type=checkbox]{width:16px;height:16px;margin:0;accent-color:var(--keel);cursor:pointer}
.ss-t input[type=checkbox]:disabled{cursor:not-allowed;opacity:.35}
.ss-ck{display:grid;place-items:center;width:28px;height:28px;margin-left:-6px;border-radius:6px}
.ss-task{display:block;font-size:13.5px;font-weight:600;line-height:1.45;color:var(--ink);text-decoration:none;overflow-wrap:anywhere}
.ss-task.un{color:var(--muted);font-weight:500}
.ss-t tbody tr:hover .ss-task{text-decoration:underline;text-decoration-color:var(--keel-mid);text-underline-offset:3px}
.ss-sub{display:flex;align-items:center;flex-wrap:wrap;gap:2px 8px;margin-top:2px;font:12px var(--f-mono);color:var(--ink2)}
.ss-sub .sw{width:9px;height:9px;margin-right:-2px}
.ss-sub .id{color:var(--muted)}
.ss-res{display:flex;align-items:center;flex-wrap:wrap;gap:4px 9px}
.ss-res .glyph.prog{width:24px;height:24px;flex:none}
.ss-res .kst{white-space:nowrap}
.ss-res .kst.ok,.ss-res .kst.ok b{color:var(--ink2)}
.ss-res .init{font-size:12.5px;color:var(--muted)}
.ss-res .pill{font-size:11.5px;padding:1px 8px}
.ss-res .stop{font-size:12px;color:var(--signal-ink)}
.ss-empty{padding:56px 18px;text-align:center;font-size:13px;color:var(--ink2)}
.ss-empty button{margin-top:10px;height:30px;padding:0 12px;border:0;border-radius:7px;background:transparent;box-shadow:inset 0 0 0 1px var(--rule2);font:600 12.5px var(--f-ui);color:var(--ink);cursor:pointer}
@media (max-width:999px){.ss-t col.ck2,.ss-t .c-ck{display:none}}
@media (max-width:720px){.ss-t col.res{width:150px}.ss-t col.at,.ss-t .c-at{display:none}}

/* the filters */
.ss-filter{margin:0 0 0 auto;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.ss-f{display:inline-flex;align-items:center;min-width:0}
.ss-filter .rbtn{min-height:30px;box-sizing:border-box}
.ss-filter .rwrap{background:var(--inset)}
.ss-filter .rwrap[data-set]{background:var(--panel);box-shadow:inset 0 0 0 1.5px var(--keel)}
.ss-filter .rpop{left:auto;right:0}
.ss-filter .rpop button{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:0;border-radius:6px;background:none;font:inherit;color:var(--ink);text-align:left;cursor:pointer}
.ss-filter .rpop button:hover,.ss-filter .rpop button[aria-selected=true]{background:var(--wash)}
.ss-filter .rpop .fc{margin-left:auto}
.ss-reset{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border:0;border-radius:7px;background:transparent;
  font:600 12.5px var(--f-ui);color:var(--ink2);cursor:pointer;white-space:nowrap}
.ss-reset:hover{color:var(--ink);background:var(--wash)}

/* the foot: the compare tray and the pager */
.ss-lf{flex:none;display:flex;align-items:center;flex-wrap:wrap;gap:8px 16px;min-height:50px;padding:8px 14px 8px 18px;border-top:1px solid var(--rule2);font-size:12.5px;color:var(--ink2)}
.ss-lf.tray .ss-tray{padding:0 8px;border-radius:8px;box-shadow:inset 0 0 0 1.5px var(--keel)}
.ss-tray{display:inline-flex;align-items:center;gap:8px;min-height:32px;white-space:nowrap}
.ss-tray .hint{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:12px}
.ss-tray .pri,.ss-tray .sec{height:30px;padding:0 12px;border:0;border-radius:7px;font:600 12.5px var(--f-ui);cursor:pointer}
.ss-tray .pri{background:var(--keel);color:var(--on-keel)}
.ss-tray .pri[disabled]{opacity:.45;cursor:default}
.ss-tray .sec{background:transparent;box-shadow:inset 0 0 0 1px var(--rule2);color:var(--ink2)}
.ss-tray .sec:hover{color:var(--ink);background:var(--wash)}
.ss-pg{margin-left:auto;display:flex;align-items:center;gap:4px}
.ss-pg .at{margin-right:8px;font:12px var(--f-mono);color:var(--muted);white-space:nowrap}
.ss-pg button{display:inline-grid;place-items:center;min-width:32px;height:32px;padding:0 8px;border:0;border-radius:7px;background:transparent;
  font:600 12.5px var(--f-mono);color:var(--ink2);cursor:pointer;font-variant-numeric:tabular-nums}
.ss-pg button:hover:not([disabled]){background:var(--wash);color:var(--ink)}
.ss-pg button[aria-current=page]{background:var(--ink);color:var(--panel)}
.ss-pg button[disabled]{opacity:.35;cursor:default}
.ss-pg .gap{min-width:20px;text-align:center;color:var(--faint)}

/* the compare dialog: a label column, then one column a session */
.tdlg.ss-dlg{width:min(980px,calc(100vw - 32px));height:auto;max-height:calc(100vh - 48px)}
.tdlg.ss-dlg[data-land][open],.tdlg.ss-dlg[data-land][open]::backdrop{animation:none}
.ss-dlg .tdlg-in{max-height:calc(100vh - 48px)}
.ss-dlg .tdlg-hd b{font:700 15px var(--f-ui)}
.ss-dlg .tdlg-p{padding:0 20px 12px;overflow:auto}
.ss-dlg .tdlg-ft{font-size:12px;color:var(--muted)}
.ss-cg{display:grid;grid-template-columns:7.5em repeat(var(--n),minmax(0,1fr));column-gap:18px;font-size:12.5px;line-height:1.5}
.ss-cg>*{padding:9px 0;border-top:1px solid var(--rule);min-width:0}
.ss-cg>.h{border-top:0;padding-top:14px}
.ss-cg .k{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--muted)}
.ss-cg .k .dot{width:8px;height:8px}
.ss-cg .v{color:var(--ink);font:500 12.5px var(--f-mono);font-variant-numeric:tabular-nums}
.ss-cg .v.top{color:var(--signal-ink);font-weight:700}
.ss-cg .same{grid-column:2/-1;color:var(--ink2);font:500 12.5px var(--f-mono)}
.ss-cg .same .eq{margin-left:8px;font:12px var(--f-ui);color:var(--muted)}
.ss-cg .h a{display:block;font:700 13.5px var(--f-ui);line-height:1.45;color:var(--ink);text-decoration:none;overflow-wrap:anywhere}
.ss-cg .h a:hover{text-decoration:underline;text-decoration-color:var(--keel-mid);text-underline-offset:3px}
.ss-cg .sec{grid-column:1/-1;padding:16px 0 4px;border-top:0;font-size:12px;font-weight:700;color:var(--ink)}
.ss-bar{display:flex;align-items:center}
.ss-bar i{display:block;height:10px;border-radius:2px;background:var(--c,var(--ink2));min-width:2px}
.ss-cg .none{color:var(--faint);font:12px var(--f-mono)}
@media (prefers-reduced-motion:reduce){.ss-pt{transition:none}}
```

5. Run it and watch it pass:

```sh
node --test tests/station-sessions-redesign.test.js
```

6. Commit:

```sh
git add assets/station/sessions-page.js assets/station/sessions-page.css tests/station-sessions-redesign.test.js
git commit -m "feat: station sessions page, ten a page, compare dialog in place" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 9: 專案, overview and analysis (§3)

**Files:**
- Modify: `assets/station/projects-page.js` — new: `FK_PROJECTS`, the page `#/projects` and `#/projects/analysis/<angle>` draw
- Modify: `assets/station/projects-page.css` — new: the head with tabs and the period control, the project table, the analysis rail and angles
- Read: `.fankeel/build/2026-10-21-station-redesign/route-projects.html:55-490` — blocks `period`, `projects-tabs`, `projects-page`, `projects-table`, `analysis`, `analysis-nav`, `angle-*`
- Read: `.fankeel/build/2026-10-21-station-redesign/_proj/gen.js:298-350` — the table row; its sparklines, deltas, model mix and every seeded series are invented data and are not ported
- Read: `.fankeel/build/2026-10-21-station-redesign/_proj/analysis.css:28-67` — the rail and the angle card
- Read: `tests/station-module.js:17-36`
- Test: `tests/station-projects-redesign.test.js`

**Interfaces:**
- Consumes: `window.FK_KIT` (Task 3 plus what it had) — `esc`, `usd(n, plain)`, `mins`, `shortLabel`, `projectHash(pkey)`, `sessionHash(id)`, `lastDays(nowMs, n)`, `ROUTE`; `window.FK_TIP.attr` (Task 6) when loaded; the open TODO entry's `due`/`dueAt` from Task 2. Reads `window.STATION.sessions[]` fields `id, task, pkey, root, route, stage, state, gateAt, started, updated, days[] {day, usd, who}, stages[] {stage, from, to, waited}` and `window.STATION.projects[].todos[] {pkey, open[] {id, state, stamp, due, dueAt}}`.
- Produces: `window.FK_PROJECTS` and `module.exports`, `{ page, rowsOf, angleOf, onClick, state, reset, EN }`:
  - `page(S, o) -> string` — `o = { names, now, serve, redraw, hash }`; `hash` is `location.hash`, read for `#/projects/analysis/<angle>`.
  - `rowsOf(S, days, now) -> Array<{ pkey, usd, main, agent, landed, cpl, dtl, toLand: number[], blockedOldest, overdue, todo, todoBy: {ready, decision, blocked, watch}, gate, live, run, attention, last }>` — one row a project; `usd` from `days[]` on the window's local days, `landed` the sessions at `land` and `down` whose `updated` falls in the window, `cpl = usd / landed` or null, `dtl` the median days from `started` to `updated` of those, `overdue` the open entries with `due`. Task 10 calls it.
  - `angleOf(hash) -> 'stall'|'cost'|'pace'|'todo'|'compare'|null` — null when the hash is not the analysis tab.
  - `onClick(e)`, `state() -> { p }`, `reset()`.
- Wiring (Tasks 15/16, not this task): Task 15 loads the files after `tip.js` and before `project-page.js`; Task 16 routes `projects` to `FK_PROJECTS.page(S, modOpts({ hash: w.location.hash }))` with the old view as fallback. `parseHash` already sends the analysis hashes to the `projects` view (its first segment).

**Dispatch:** implementer, opus

1. Write the failing test `tests/station-projects-redesign.test.js`:

```js
'use strict';
// 專案 (assets/station/projects-page.js; design 2026-10-21-station-redesign §3;
// mockup route-projects.html): one row a project grouped 需要注意 / 其他 with
// the period's figures, a 7 / 30 / 90 control that drives every figure, a
// total equal to the sum of its rows, and the 分析 tab's five angles, each one
// line instead of a chart when the station has nothing for it.
const test = require('node:test');
const assert = require('node:assert/strict');
const { page, stringsLeft } = require('./station-module.js');

const NOW = new Date(2026, 9, 22, 15, 0, 0).getTime();
const DAY = 864e5;
const at = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString();
const dayOf = (daysAgo) => { const d = new Date(NOW - daysAgo * DAY); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const A = 'F:\\w/alpha', B = 'F:\\w/beta', C = 'F:\\w/gamma';
const R = ['survey', 'plan', 'build', 'land'];
const ses = (id, o) => Object.assign({ id, task: 'T ' + id, pkey: A, root: 'F:\\w', route: R, stage: 'land', state: 'down', gateAt: null,
    started: at(6), updated: at(2), usd: 1, agentUsd: 0, days: [], stages: [] }, o);
const S = {
    sessions: [
        ses('a1', { started: at(5), updated: at(1), days: [{ day: dayOf(1), usd: 4, who: 'main' }, { day: dayOf(1), usd: 2, who: 'agent' }, { day: dayOf(40), usd: 50, who: 'main' }],
            stages: [{ stage: 'plan', from: NOW - 5 * DAY, to: NOW - 4 * DAY, waited: 6 * 3600e3 }, { stage: 'build', from: NOW - 4 * DAY, to: NOW - 2 * DAY, waited: 0 }] }),
        ses('a2', { started: at(12), updated: at(10), days: [{ day: dayOf(10), usd: 3, who: 'main' }] }),
        ses('a3', { stage: 'build', updated: at(60), days: [] }),
        ses('b1', { pkey: B, stage: 'plan', state: 'live', gateAt: at(0.1), updated: at(0.1), days: [{ day: dayOf(0), usd: 1.5, who: 'main' }] }),
    ],
    projects: [{ todos: [
        { pkey: A, open: [{ id: 'blk-1', state: 'blocked', stamp: dayOf(20), due: true, dueAt: NOW - DAY }, { id: 'rd-1', state: 'ready', stamp: '', due: false, dueAt: null }] },
        { pkey: C, open: [{ id: 'w-1', state: 'watch', stamp: dayOf(3), due: false, dueAt: null }] },
    ] }],
};
const NAMES = { [A]: 'w / alpha', [B]: 'w / beta', [C]: 'w / gamma' };

function mod(lang) {
    const { win } = page(['tip.js', 'projects-page.js'], {});
    if (lang) win.FK_I18N = { lang };
    win.FK_PROJECTS.reset();
    return win.FK_PROJECTS;
}
const btn = (attrs) => ({ attrs, getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
    closest(sel) { return sel.split(',').some((p) => { const m = /^\[([\w-]+)\]$/.exec(p.trim()); return m && m[1] in attrs; }) ? this : null; } });

test('rowsOf: the window\'s cost from days, landed in the window, cost per landing, median days to land, TODO counts', () => {
    const P = mod();
    const rows = P.rowsOf(S, 30, NOW);
    const a = rows.find((r) => r.pkey === A), b = rows.find((r) => r.pkey === B), c = rows.find((r) => r.pkey === C);
    assert.equal(a.usd, 9, 'the day 40 days back is outside');
    assert.equal(a.main, 7);
    assert.equal(a.agent, 2);
    assert.equal(a.landed, 2);
    assert.equal(a.cpl, 4.5);
    assert.equal(a.dtl, 3, 'median of 4 and 2 days');
    assert.equal(a.overdue, 1);
    assert.equal(a.todo, 2);
    assert.deepEqual({ ...a.todoBy }, { ready: 1, decision: 0, blocked: 1, watch: 0 });
    assert.equal(a.blockedOldest, 20);
    assert.equal(a.attention, true, 'an overdue Blocked entry');
    assert.equal(b.attention, true, 'a gate waiting');
    assert.equal(b.cpl, null);
    assert.equal(c.attention, false);
    const week = P.rowsOf(S, 7, NOW).find((r) => r.pkey === A);
    assert.equal(week.usd, 6);
    assert.equal(week.landed, 1);
});

test('the overview groups 需要注意 before 其他, and its total is the sum of its rows', () => {
    const P = mod();
    const html = P.page(S, { names: NAMES, now: NOW, redraw() {}, hash: '#/projects' });
    assert.ok(html.includes('data-block="projects-table"'));
    assert.ok(html.indexOf('需要注意') < html.indexOf('其他'));
    assert.ok(html.indexOf('data-pkey="F:\\w/alpha"') < html.indexOf('data-pkey="F:\\w/gamma"'));
    const rows = [...html.matchAll(/<div class="pt-row[^"]*" role="row" data-pkey="[^"]*" data-usd="([\d.]+)" data-landed="(\d+)"/g)];
    assert.equal(rows.length, 3);
    const tot = /<div class="pt-sum" data-usd="([\d.]+)" data-landed="(\d+)">/.exec(html);
    assert.ok(tot, 'a total');
    assert.equal(Number(tot[1]), rows.reduce((n, m) => n + Number(m[1]), 0));
    assert.equal(Number(tot[2]), rows.reduce((n, m) => n + Number(m[2]), 0));
    assert.ok(html.includes('href="#/p/' + encodeURIComponent(A) + '"'));
});

test('the period control drives every figure; 30 days is the default', () => {
    const P = mod();
    const o = { names: NAMES, now: NOW, redraw() { this.n = (this.n || 0) + 1; }, hash: '#/projects' };
    let html = P.page(S, o);
    assert.ok(html.includes('data-pj-p="30" aria-pressed="true"'));
    assert.ok(html.includes('data-pkey="F:\\w/alpha" data-usd="9"'));
    P.onClick({ target: btn({ 'data-pj-p': '7' }) });
    assert.equal(P.state().p, 7);
    assert.equal(o.n, 1);
    html = P.page(S, o);
    assert.ok(html.includes('data-pj-p="7" aria-pressed="true"'));
    assert.ok(html.includes('data-pkey="F:\\w/alpha" data-usd="6"'));
    P.onClick({ target: btn({ 'data-pj-p': '90' }) });
    assert.ok(P.page(S, o).includes('class="pj-note"'), '90 days says cost is kept 30 days');
});

test('the analysis tab draws the angle the hash names, on the rail', () => {
    const P = mod();
    assert.equal(P.angleOf('#/projects'), null);
    assert.equal(P.angleOf('#/projects/analysis'), 'stall');
    assert.equal(P.angleOf('#/projects/analysis/cost'), 'cost');
    assert.equal(P.angleOf('#/projects/analysis/nope'), 'stall');
    const html = P.page(S, { names: NAMES, now: NOW, redraw() {}, hash: '#/projects/analysis/cost' });
    assert.ok(html.includes('data-block="analysis-nav"'));
    assert.ok(html.includes('<a href="#/projects/analysis/cost" aria-current="page"'));
    assert.ok(html.includes('data-block="angle-cost"'));
    assert.ok(!html.includes('data-block="projects-table"'));
    assert.ok(/class="seg main" style="width:\d+%"[^>]*data-tip="alpha"/.test(html), 'the cost bar has a main segment with its own tip');
    for (const a of ['stall', 'pace', 'todo', 'compare']) {
        const h = P.page(S, { names: NAMES, now: NOW, redraw() {}, hash: '#/projects/analysis/' + a });
        assert.ok(h.includes('data-block="angle-' + a + '"'), a);
    }
});

test('the stall angle draws 做事 and 等你 on one scale; an angle with nothing says so in one line', () => {
    const P = mod();
    const html = P.page(S, { names: NAMES, now: NOW, redraw() {}, hash: '#/projects/analysis/stall' });
    assert.ok(/class="seg work" style="width:100%"[^>]*data-tip="build"/.test(html), 'build is the longest stay');
    assert.ok(/class="seg wait" style="width:\d+%"[^>]*data-tip="plan"/.test(html));
    const empty = P.page({ sessions: [], projects: [] }, { names: {}, now: NOW, redraw() {}, hash: '#/projects/analysis/stall' });
    assert.ok(empty.includes('<p class="an-empty">'));
});

test('English comes from the module table, and every string has it', () => {
    const P = mod('en');
    const html = P.page(S, { names: NAMES, now: NOW, redraw() {}, hash: '#/projects' });
    assert.ok(html.includes('Needs attention'));
    assert.deepEqual(stringsLeft('projects-page.js', P.EN), []);
});
```

2. Run it and watch it fail:

```sh
node --test tests/station-projects-redesign.test.js
```

3. Write `assets/station/projects-page.js`:

```js
'use strict';
// assets/station/projects-page.js — 專案, the page `#/projects` and
// `#/projects/analysis/<angle>` draw (docs/90-agent/plans/2026-10-21-station-redesign-design.md
// §3; mockup route-projects.html, blocks period, projects-tabs, projects-table,
// analysis, analysis-nav, angle-*). One head with 總覽 | 分析 and the period
// control (7 / 30 / 90 days, default 30), which drives every figure on both
// tabs. 總覽 is one row a project, grouped 需要注意 (a gate waiting, a session
// running, a Blocked entry due) and 其他: cost for the period, landed, cost per
// landing, median days to land, Blocked oldest, overdue and open TODO, last
// move; the total under it is the sum of the rows. 分析 is five angles, each
// drawn only from fields the station has; an angle with nothing to draw says
// so in one line. Cost comes from the sessions' `days`, which the station
// keeps about 30 days, so 90 days says that too. Reads `w.FK_KIT` when it draws.
(function (w, doc) {
    var EN = {
        'pj.overview': 'Overview',
        'pj.analysis': 'Analysis',
        'pj.period': 'Period',
        'pj.periodAria': 'Period: cost, landings and stages all use these days',
        'pj.days': '{n} days',
        'pj.range': 'Period {a} – {b}',
        'pj.spend30': 'Cost is kept about 30 days: older days count nothing',
        'pj.table': 'Projects',
        'pj.att': 'Needs attention',
        'pj.other': 'Others',
        'pj.name': 'Project',
        'pj.cost': 'Cost',
        'pj.landed': 'Landed',
        'pj.cpl': 'Per landing',
        'pj.dtl': 'Days to land',
        'pj.blocked': 'Blocked oldest',
        'pj.overdue': 'Overdue',
        'pj.todo': 'Open TODO',
        'pj.last': 'Last move',
        'pj.waiting': 'Waiting on you',
        'pj.running': 'Running',
        'pj.dueN': '{n} Blocked overdue',
        'pj.noLand': 'none landed',
        'pj.dayUnit': '{n} d',
        'pj.total': 'Total',
        'pj.none': 'No project has a session or a TODO yet.',
        'pj.angles': 'Angles',
        'pj.stall': 'Stalls',
        'pj.stallQ': 'Which stage do tasks sit in?',
        'pj.costA': 'Cost',
        'pj.costQ': 'Where does the money go?',
        'pj.pace': 'Pace',
        'pj.paceQ': 'How fast do tasks land?',
        'pj.todoA': 'TODO',
        'pj.todoQ': 'How much is open, and in what state?',
        'pj.compare': 'Compare',
        'pj.compareQ': 'Which project lands for less?',
        'pj.work': 'working',
        'pj.wait': 'waiting on you',
        'pj.passed': '{n} passed',
        'pj.main': 'main',
        'pj.agent': 'agents',
        'pj.week': 'week of {d}',
        'pj.nLanded': '{n} landed',
        'pj.ready': 'Ready',
        'pj.decision': 'Needs a decision',
        'pj.blockedS': 'Blocked',
        'pj.watch': 'Watch',
        'pj.noStall': 'No session in this period has a stage with both ends timed.',
        'pj.noCost': 'No cost recorded in this period.',
        'pj.noPace': 'Nothing landed in this period.',
        'pj.noTodo': 'No project keeps TODO entries.',
        'pj.noCompare': 'No project both spent and landed in this period.',
        'pj.medianLand': 'Median {t} days from start to land',
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function fill(s, vars) {
        if (!vars) return s;
        return String(s).replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) ? String(vars[k]) : m; });
    }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return fill(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    function kit() { return (w && w.FK_KIT) || {}; }
    function esc(s) { return kit().esc(s); }
    function tip(label, values) { return w && w.FK_TIP ? w.FK_TIP.attr(label, values) : ''; }
    function ms(t) { return typeof t === 'number' ? t : Date.parse(t); }
    function lastOf(s) {
        var a = ms(s.updated), b = ms(s.started);
        return Math.max(isFinite(a) ? a : 0, isFinite(b) ? b : 0);
    }
    function dayStart(now) { var m = new Date(now); m.setHours(0, 0, 0, 0); return m.getTime(); }
    function median(xs) {
        if (!xs.length) return null;
        var s = xs.slice().sort(function (a, b) { return a - b; }), h = s.length >> 1;
        return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
    }
    function r2(n) { return Math.round(n * 100) / 100; }
    function days1(n) { return n === null ? '—' : (Math.round(n * 10) / 10).toString(); }
    function since(t, now) {
        if (!t) return '—';
        var m = Math.max(0, Math.round((now - t) / 60000));
        if (m < 60) return m + 'm';
        if (m < 1440) return Math.floor(m / 60) + 'h';
        return Math.floor(m / 1440) + 'd';
    }

    var PERIODS = [7, 30, 90], ANGLES = ['stall', 'cost', 'pace', 'todo', 'compare'];
    var st = { p: 30 }, last = null, bound = false;

    // One row a project: every session's pkey and every TODO list's.
    function rowsOf(S, days, now) {
        var k = kit(), fromDay = k.lastDays(now, days)[0], from = dayStart(now) - (days - 1) * 864e5;
        var by = {}, order = [];
        function at(pkey) {
            if (!by[pkey]) {
                by[pkey] = { pkey: pkey, usd: 0, main: 0, agent: 0, landed: 0, toLand: [], blockedOldest: null, overdue: 0, todo: 0,
                    todoBy: { ready: 0, decision: 0, blocked: 0, watch: 0 }, gate: null, live: false, run: null, last: 0, hasTodo: false };
                order.push(pkey);
            }
            return by[pkey];
        }
        ((S && S.sessions) || []).forEach(function (s) {
            var r = at(s.pkey);
            (s.days || []).forEach(function (x) {
                if (!x || typeof x.usd !== 'number' || !(x.day >= fromDay)) return;
                r.usd += x.usd;
                if (x.who === 'main') r.main += x.usd; else r.agent += x.usd;
            });
            var up = ms(s.updated), st0 = ms(s.started);
            if (s.stage === 'land' && s.state === 'down' && up >= from && up <= now) {
                r.landed++;
                if (isFinite(st0) && up >= st0) r.toLand.push((up - st0) / 864e5);
            }
            if (s.gateAt && s.state !== 'down' && !r.gate) r.gate = s;
            if (s.state === 'live') { r.live = true; if (!r.run || lastOf(s) > lastOf(r.run)) r.run = s; }
            r.last = Math.max(r.last, lastOf(s));
        });
        ((S && S.projects) || []).forEach(function (p) {
            (p.todos || []).forEach(function (t) {
                var r = at(t.pkey);
                r.hasTodo = true;
                (t.open || []).forEach(function (x) {
                    r.todo++;
                    if (has(r.todoBy, x.state)) r.todoBy[x.state]++;
                    if (x.due) r.overdue++;
                    var ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(x.stamp || '')), stamped = ymd ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3]).getTime() : NaN;
                    if (x.state === 'blocked' && isFinite(stamped)) {
                        var age = Math.round((dayStart(now) - stamped) / 864e5);
                        if (r.blockedOldest === null || age > r.blockedOldest) r.blockedOldest = age;
                    }
                });
            });
        });
        return order.map(function (pkey) {
            var r = by[pkey];
            r.usd = r2(r.usd); r.main = r2(r.main); r.agent = r2(r.agent);
            r.cpl = r.landed ? r2(r.usd / r.landed) : null;
            r.dtl = median(r.toLand);
            r.attention = Boolean(r.gate || r.live || r.overdue > 0);
            return r;
        });
    }
    function angleOf(hash) {
        var m = /^#\/projects\/analysis(?:\/([a-z]+))?/.exec(String(hash || ''));
        if (!m) return null;
        return ANGLES.indexOf(m[1]) >= 0 ? m[1] : 'stall';
    }
    function nameOf(pkey, names) { return kit().shortLabel(names[pkey] || pkey); }
    function byUsd(a, b) { return b.usd - a.usd || b.last - a.last; }
    // A bar of segments on a scale shared by every bar it is drawn with; each segment carries its own tip.
    function bar(segs, max) {
        return '<span class="pj-bar">' + segs.filter(function (g) { return g.v > 0; }).map(function (g) {
            return '<i class="seg ' + g.cls + '" style="width:' + Math.max(1, Math.round(g.v / max * 100)) + '%"' + tip(g.label, g.vals) + '></i>';
        }).join('') + '</span>';
    }

    function head(tab, now) {
        var k = kit(), from = k.lastDays(now, st.p)[0];
        return '<div class="phead khead pjh" data-block="projects-tabs" data-on="' + tab + '">'
            + '<nav class="subtabs" aria-label="' + esc(loc('pj.table', '專案')) + '">'
            + '<a href="#/projects"' + (tab === 'list' ? ' aria-current="page"' : '') + '>' + loc('pj.overview', '總覽') + '</a>'
            + '<a href="#/projects/analysis/stall"' + (tab === 'analysis' ? ' aria-current="page"' : '') + '>' + loc('pj.analysis', '分析') + '</a></nav>'
            + '<span class="pjh-cap">' + esc(loc('pj.range', '區間 {a} – {b}', { a: from.slice(5), b: k.lastDays(now, 1)[0].slice(5) })) + '</span>'
            + '<div class="perseg" role="group" aria-label="' + esc(loc('pj.periodAria', '區間：花費、落地與各站都用這段天數')) + '" data-block="period">'
            + '<span>' + loc('pj.period', '區間') + '</span><span class="perseg-b">' + PERIODS.map(function (n) {
                return '<button type="button" data-pj-p="' + n + '" aria-pressed="' + (st.p === n) + '">' + loc('pj.days', '{n} 天', { n: n }) + '</button>';
            }).join('') + '</span></div></div>'
            + (st.p > 30 ? '<p class="pj-note">' + loc('pj.spend30', '花費只記得近 30 天左右，更早的日子算不到') + '</p>' : '');
    }
    function line2(r, names) {
        var k = kit();
        if (r.gate) return '<a class="pt-l2 wait" href="' + esc(k.sessionHash(r.gate.id)) + '"><span class="waitchip">' + loc('pj.waiting', '等你回答') + '</span><span class="pt-rt">' + esc(r.gate.task || '') + '</span></a>';
        if (r.run) return '<a class="pt-l2" href="' + esc(k.sessionHash(r.run.id)) + '"><span class="hm-stw" style="--c:var(--st-' + esc(r.run.stage) + ')">' + esc(r.run.stage) + '</span><span class="pt-rt">' + esc(r.run.task || loc('pj.running', '在跑')) + '</span></a>';
        if (r.overdue) return '<span class="pt-l2 due">' + loc('pj.dueN', '{n} 筆 Blocked 到期', { n: r.overdue }) + '</span>';
        return '';
    }
    function rowHtml(r, names, max, now) {
        var k = kit();
        return '<div class="pt-row' + (r.gate ? ' wait' : '') + '" role="row" data-pkey="' + esc(r.pkey) + '" data-usd="' + r.usd + '" data-landed="' + r.landed + '">'
            + '<span class="pt-c pt-nm" role="cell"><a href="' + esc(k.projectHash(r.pkey)) + '" title="' + esc(names[r.pkey] || r.pkey) + '"><b><span class="pt-nmt">' + esc(nameOf(r.pkey, names)) + '</span></b></a>' + line2(r, names) + '</span>'
            + '<span class="pt-c pt-usd" role="cell">' + bar([{ v: r.main, cls: 'main', label: loc('pj.main', '主 session'), vals: [k.usd(r.main, true)] },
                { v: r.agent, cls: 'agent', label: loc('pj.agent', '派工'), vals: [k.usd(r.agent, true)] }], max)
            + '<span class="pt-v' + (r.usd ? '' : ' zero') + '">' + k.usd(r.usd, true) + '</span></span>'
            + '<span class="pt-c r" role="cell"><span class="pt-v' + (r.landed ? '' : ' zero') + '">' + r.landed + '</span></span>'
            + '<span class="pt-c r" role="cell">' + (r.cpl === null ? '<span class="pt-mu">' + loc('pj.noLand', '沒有落地') + '</span>' : '<span class="pt-v">' + k.usd(r.cpl, true) + '</span>') + '</span>'
            + '<span class="pt-c r" role="cell"><span class="pt-v' + (r.dtl === null ? ' zero' : '') + '">' + days1(r.dtl) + '</span></span>'
            + '<span class="pt-c r" role="cell">' + (r.blockedOldest === null ? '<span class="pt-mu">—</span>' : '<span class="pt-v">' + esc(loc('pj.dayUnit', '{n} 天', { n: r.blockedOldest })) + '</span>') + '</span>'
            + '<span class="pt-c r" role="cell"><span class="pt-v' + (r.overdue ? ' bad' : ' zero') + '">' + r.overdue + '</span></span>'
            + '<span class="pt-c r" role="cell"><span class="pt-v' + (r.todo ? '' : ' zero') + '">' + r.todo + '</span></span>'
            + '<span class="pt-c pt-last r" role="cell">' + since(r.last, now) + '</span></div>';
    }
    function overview(rows, names, now) {
        var k = kit(), att = rows.filter(function (r) { return r.attention; }).sort(byUsd), other = rows.filter(function (r) { return !r.attention; }).sort(byUsd);
        var max = Math.max.apply(null, [0.01].concat(rows.map(function (r) { return r.usd; })));
        var usd = r2(rows.reduce(function (n, r) { return n + r.usd; }, 0)), landed = rows.reduce(function (n, r) { return n + r.landed; }, 0);
        var grp = function (cls, label, list) {
            return list.length ? '<div class="pt-grp ' + cls + '"><b>' + label + '</b><span class="kn">' + list.length + '</span></div>'
                + list.map(function (r) { return rowHtml(r, names, max, now); }).join('') : '';
        };
        var h = function (label, cls) { return '<span class="pt-h' + (cls ? ' ' + cls : '') + '" role="columnheader">' + label + '</span>'; };
        return '<div class="pj" data-block="projects-page" data-view="projects"><section class="dcard pt" data-block="projects-table" aria-label="' + esc(loc('pj.table', '專案')) + '">'
            + '<div class="pt-tbl" role="table"><div class="pt-colh" role="row">' + h(loc('pj.name', '專案')) + h(loc('pj.cost', '花費')) + h(loc('pj.landed', '落地'), 'r')
            + h(loc('pj.cpl', '每筆落地'), 'r') + h(loc('pj.dtl', '落地天數'), 'r') + h(loc('pj.blocked', '最久 Blocked'), 'r') + h(loc('pj.overdue', '到期'), 'r')
            + h(loc('pj.todo', '開著的 TODO'), 'r') + h(loc('pj.last', '最後動靜'), 'r') + '</div>'
            + (rows.length ? '<div class="pt-body">' + grp('att', loc('pj.att', '需要注意'), att) + grp('quiet', loc('pj.other', '其他'), other) + '</div>'
                : '<p class="an-empty">' + loc('pj.none', '還沒有專案有 session 或 TODO。') + '</p>')
            + '</div><div class="pt-more"><div class="pt-sum" data-usd="' + usd + '" data-landed="' + landed + '">' + loc('pj.total', '合計')
            + ' <b>' + k.usd(usd, true) + '</b> · ' + loc('pj.nLanded', '落地 {n} 筆', { n: '<b>' + landed + '</b>' }) + '</div></div></section></div>';
    }

    function angleName(a) {
        if (a === 'stall') return loc('pj.stall', '卡站');
        if (a === 'cost') return loc('pj.costA', '成本');
        if (a === 'pace') return loc('pj.pace', '產出速度');
        if (a === 'todo') return loc('pj.todoA', 'TODO 健康');
        return loc('pj.compare', '專案比較');
    }
    function angleQ(a) {
        if (a === 'stall') return loc('pj.stallQ', '任務卡在哪一站？');
        if (a === 'cost') return loc('pj.costQ', '錢花在哪裡？');
        if (a === 'pace') return loc('pj.paceQ', '做得多快？');
        if (a === 'todo') return loc('pj.todoQ', '積了多少、卡在哪個狀態？');
        return loc('pj.compareQ', '哪個專案每筆落地花得少？');
    }
    function empty(text) { return '<p class="an-empty">' + text + '</p>'; }
    function barRow(label, href, inner) {
        return '<li class="an-row"><span class="an-l">' + (href ? '<a href="' + esc(href) + '">' + esc(label) + '</a>' : esc(label)) + '</span>' + inner + '</li>';
    }
    // 卡站: per stage, the median stay of the period's sessions split 做事 / 等你, one scale.
    function stall(S, now) {
        var k = kit(), from = dayStart(now) - (st.p - 1) * 864e5, by = {};
        ((S && S.sessions) || []).forEach(function (s) {
            if (!(lastOf(s) >= from)) return;
            (s.stages || []).forEach(function (x) {
                if (!x || !isFinite(x.from) || !isFinite(x.to) || x.to <= x.from) return;
                var wait = Math.min(Math.max(x.waited || 0, 0), x.to - x.from);
                (by[x.stage] = by[x.stage] || []).push({ work: x.to - x.from - wait, wait: wait });
            });
        });
        var stages = k.ROUTE.filter(function (g) { return by[g]; });
        if (!stages.length) return empty(loc('pj.noStall', '這段期間沒有 session 的哪一站頭尾都有計時。'));
        var med = stages.map(function (g) {
            return { g: g, n: by[g].length, work: median(by[g].map(function (x) { return x.work; })), wait: median(by[g].map(function (x) { return x.wait; })) };
        });
        var max = Math.max.apply(null, med.map(function (m) { return m.work + m.wait; }));
        return '<ul class="an-bars">' + med.map(function (m) {
            return barRow(m.g, null, bar([{ v: m.work, cls: 'work', label: m.g, vals: [loc('pj.work', '做事') + ' ' + k.mins(m.work), loc('pj.passed', '{n} 筆經過', { n: m.n })] },
                { v: m.wait, cls: 'wait', label: m.g, vals: [loc('pj.wait', '等你回答') + ' ' + k.mins(m.wait)] }], max));
        }).join('') + '</ul>';
    }
    // 成本: per project, the period's cost split main / agents, one scale.
    function cost(rows, names) {
        var k = kit(), list = rows.filter(function (r) { return r.usd > 0; }).sort(byUsd);
        if (!list.length) return empty(loc('pj.noCost', '這段期間沒有記到花費。'));
        var max = list[0].usd;
        return '<ul class="an-bars">' + list.map(function (r) {
            var nm = nameOf(r.pkey, names);
            return barRow(nm, k.projectHash(r.pkey), bar([{ v: r.main, cls: 'main', label: nm, vals: [loc('pj.main', '主 session') + ' ' + k.usd(r.main, true)] },
                { v: r.agent, cls: 'agent', label: nm, vals: [loc('pj.agent', '派工') + ' ' + k.usd(r.agent, true)] }], max));
        }).join('') + '</ul>';
    }
    // 產出速度: landings per week over the period, one scale, and the median days to land.
    function pace(S, rows, now) {
        var k = kit(), weeks = Math.ceil(st.p / 7), end = dayStart(now) + 864e5, counts = [];
        for (var i = 0; i < weeks; i++) counts.push(0);
        ((S && S.sessions) || []).forEach(function (s) {
            var up = ms(s.updated);
            if (s.stage !== 'land' || s.state !== 'down' || !(up < end)) return;
            var wk = Math.floor((end - up) / (7 * 864e5));
            if (wk < weeks) counts[weeks - 1 - wk]++;
        });
        var total = counts.reduce(function (a, b) { return a + b; }, 0);
        if (!total) return empty(loc('pj.noPace', '這段期間沒有任務走到 land。'));
        var max = Math.max.apply(null, counts), all = [];
        rows.forEach(function (r) { all = all.concat(r.toLand); });
        return '<p class="an-take">' + esc(loc('pj.medianLand', '從開始到 land 中位 {t} 天', { t: days1(median(all)) })) + '</p>'
            + '<div class="an-cols">' + counts.map(function (c, j) {
                var wkFrom = k.lastDays(end - (weeks - j) * 7 * 864e5 + 864e5, 1)[0].slice(5);
                return '<span class="an-col"><i class="seg land" style="height:' + (c ? Math.max(2, Math.round(c / max * 100)) : 0) + '%"'
                    + tip(loc('pj.week', '{d} 那週', { d: wkFrom }), [loc('pj.nLanded', '落地 {n} 筆', { n: c })]) + '></i><small>' + wkFrom + '</small></span>';
            }).join('') + '</div>';
    }
    // TODO 健康: per project, open entries by state, one scale; overdue marked.
    function todo(rows, names) {
        var k = kit(), list = rows.filter(function (r) { return r.todo > 0; }).sort(function (a, b) { return b.todo - a.todo; });
        if (!list.length) return empty(loc('pj.noTodo', '沒有專案記 TODO 條目。'));
        var max = list[0].todo, label = { ready: loc('pj.ready', 'Ready'), decision: loc('pj.decision', '待決定'), blocked: loc('pj.blockedS', 'Blocked'), watch: loc('pj.watch', 'Watch') };
        return '<ul class="an-bars">' + list.map(function (r) {
            return barRow(nameOf(r.pkey, names), k.projectHash(r.pkey) + '/todo', bar(['ready', 'decision', 'blocked', 'watch'].map(function (s) {
                return { v: r.todoBy[s], cls: 'td-' + s, label: label[s], vals: [r.todoBy[s]] };
            }), max) + (r.overdue ? '<span class="pt-v bad">' + loc('pj.dueN', '{n} 筆 Blocked 到期', { n: r.overdue }) + '</span>' : ''));
        }).join('') + '</ul>';
    }
    // 專案比較: per project, cost per landing and landings, each on its own scale.
    function compare(rows, names) {
        var k = kit(), list = rows.filter(function (r) { return r.landed > 0 && r.usd > 0; }).sort(function (a, b) { return a.cpl - b.cpl; });
        if (!list.length) return empty(loc('pj.noCompare', '這段期間沒有專案既有花費又有落地。'));
        var maxC = Math.max.apply(null, list.map(function (r) { return r.cpl; })), maxL = Math.max.apply(null, list.map(function (r) { return r.landed; }));
        return '<ul class="an-bars two">' + list.map(function (r) {
            var nm = nameOf(r.pkey, names);
            return barRow(nm, k.projectHash(r.pkey), bar([{ v: r.cpl, cls: 'main', label: nm, vals: [loc('pj.cpl', '每筆落地') + ' ' + k.usd(r.cpl, true)] }], maxC)
                + bar([{ v: r.landed, cls: 'land', label: nm, vals: [loc('pj.nLanded', '落地 {n} 筆', { n: r.landed })] }], maxL));
        }).join('') + '</ul>';
    }
    function analysis(S, rows, names, now, angle) {
        var body = angle === 'stall' ? stall(S, now) : angle === 'cost' ? cost(rows, names) : angle === 'pace' ? pace(S, rows, now)
            : angle === 'todo' ? todo(rows, names) : compare(rows, names);
        return '<div class="pa" data-block="analysis" data-view="analysis"><nav class="dcard an-nav" data-block="analysis-nav" aria-label="' + esc(loc('pj.angles', '分析角度')) + '"><ul>'
            + ANGLES.map(function (a) {
                return '<li><a href="#/projects/analysis/' + a + '"' + (a === angle ? ' aria-current="page"' : '') + '><span class="an-nm">' + angleName(a) + '</span>'
                    + '<span class="an-q">' + angleQ(a) + '</span></a></li>';
            }).join('') + '</ul></nav>'
            + '<section class="dcard an" data-block="angle-' + angle + '" data-angle="' + angle + '" aria-labelledby="an-q"><div class="dcard-h"><h2 id="an-q">' + angleQ(angle) + '</h2></div>'
            + body + '</section></div>';
    }

    function page(S, o) {
        o = o || {};
        last = o;
        bind();
        var now = isFinite(o.now) ? o.now : Date.now(), names = o.names || {}, angle = angleOf(o.hash);
        var rows = rowsOf(S, st.p, now);
        return head(angle ? 'analysis' : 'list', now) + (angle ? analysis(S, rows, names, now, angle) : overview(rows, names, now));
    }
    function onClick(e) {
        var t = e && e.target, a = t && typeof t.closest === 'function' ? t.closest('[data-pj-p]') : null;
        if (!a) return;
        var n = +a.getAttribute('data-pj-p');
        if (PERIODS.indexOf(n) < 0) return;
        st.p = n;
        if (last && typeof last.redraw === 'function') last.redraw();
    }
    function bind() {
        if (bound || !doc || typeof doc.addEventListener !== 'function') return;
        bound = true;
        doc.addEventListener('click', onClick);
    }
    function state() { return st; }
    function reset() { st = { p: 30 }; }

    var api = { page: page, rowsOf: rowsOf, angleOf: angleOf, onClick: onClick, state: state, reset: reset, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_PROJECTS = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
```

4. Write `assets/station/projects-page.css`:

```css
/* assets/station/projects-page.css — 專案 (assets/station/projects-page.js),
   ported from route-projects.html: the head with 總覽 | 分析 and the period
   control, the project table (projects-table), the analysis rail and angle
   card (_proj/analysis.css). A bar is segments on a scale its list shares. */
.pjh{display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px;min-height:34px}
.pjh .subtabs{margin:0}
.pjh-cap{font-size:12px;color:var(--muted)}
.perseg{margin-left:auto;display:flex;align-items:center;gap:8px;flex:none;font-size:12px;color:var(--muted)}
.perseg-b{display:inline-flex;padding:2px;border-radius:8px;background:var(--inset);box-shadow:inset 0 0 0 1px var(--rule)}
.perseg button{height:30px;min-width:54px;padding:0 10px;border:0;border-radius:6px;background:transparent;color:var(--ink2);font:600 12.5px var(--f-ui);cursor:pointer}
.perseg button:hover{color:var(--ink)}
.perseg button[aria-pressed=true]{background:var(--keel-tint);color:var(--keel-deep);font-weight:700}
.perseg button:focus-visible{outline:2px solid var(--keel);outline-offset:1px}
.pj-note{margin:4px 0 0;font-size:12px;color:var(--signal-ink)}

/* 總覽: the table */
.pj{display:flex;flex-direction:column;gap:10px;margin-top:10px}
.pt{--pt-cols:minmax(0,1fr) 11rem 4.2rem 6.2rem 5.4rem 6.4rem 3.6rem 5.4rem 4rem;display:flex;flex-direction:column;min-height:0;padding-bottom:10px}
.pt-tbl{display:flex;flex-direction:column;min-height:0}
.pt-colh,.pt-row{display:grid;grid-template-columns:var(--pt-cols);column-gap:8px;align-items:center}
.pt-colh{padding:3px 0 6px;border-bottom:1px solid var(--rule2)}
.pt-h{display:flex;min-width:0;font-size:12px;color:var(--muted);white-space:nowrap}
.pt-h.r{justify-content:flex-end}
.pt-body{min-height:0}
.pt-grp{display:flex;align-items:baseline;gap:8px;padding:7px 0 3px;font-size:12px;color:var(--muted)}
.pt-grp b{font-size:12.5px;font-weight:700;color:var(--ink)}
.pt-grp .kn{font:700 11px var(--f-mono);padding:0 6px;border-radius:5px;background:var(--inset);color:var(--ink2)}
.pt-grp.att .kn{background:var(--signal-tint);color:var(--signal-ink)}
.pt-row{position:relative;min-height:38px;margin:0 -18px;padding:4px 18px;border-top:1px solid var(--rule)}
.pt-grp+.pt-row{border-top-color:var(--rule2)}
.pt-row:hover{background:var(--wash)}
.pt-row.wait{background:color-mix(in srgb,var(--signal-tint) 45%,transparent)}
.pt-c{display:flex;align-items:center;gap:6px;min-width:0;font-size:12.5px;color:var(--ink2)}
.pt-c.r{justify-content:flex-end}
.pt-nm{flex-direction:column;align-items:stretch;gap:1px}
.pt-nm>a{min-width:0;text-decoration:none;color:var(--ink)}
.pt-nm>a::after{content:"";position:absolute;inset:0}
.pt-nm>a:focus-visible{outline:none}
.pt-nm>a:focus-visible::after{outline:2px solid var(--keel);outline-offset:-2px;border-radius:var(--r-sm)}
.pt-nm>a:hover .pt-nmt{text-decoration:underline;text-decoration-color:var(--rule2);text-underline-offset:3px}
.pt-nm b{display:flex;align-items:center;gap:8px;min-width:0;font-size:13.5px;line-height:1.3}
.pt-nmt{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pt-l2{position:relative;z-index:1;display:flex;align-items:center;gap:7px;min-width:0;font-size:12px;line-height:18px;color:var(--ink2);text-decoration:none;white-space:nowrap}
a.pt-l2:hover .pt-rt{text-decoration:underline;text-decoration-color:var(--rule2);text-underline-offset:3px}
.pt-l2.due{color:var(--signal-ink);font-weight:600}
.pt-l2 .waitchip{font-weight:700;color:var(--signal-ink)}
.pt-l2 .hm-stw{font-size:11.5px;text-decoration:underline 2px var(--c);text-underline-offset:3px}
.pt-rt{min-width:0;overflow:hidden;text-overflow:ellipsis}
.pt-v{font:700 13px var(--f-mono);color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap}
.pt-v.zero{font-weight:400;color:var(--muted)}
.pt-v.bad{color:var(--fail-ink)}
.pt-usd .pj-bar{flex:1}
.pt-usd .pt-v{flex:none;min-width:4.2rem;text-align:right}
.pt-mu{font-size:12px;color:var(--muted);white-space:nowrap}
.pt-last{font:12px var(--f-mono);color:var(--ink2);white-space:nowrap}
.pt-more{display:flex;align-items:center;gap:12px;margin:0 -18px;padding:8px 18px 0;border-top:1px solid var(--rule);font-size:12px;color:var(--muted)}
.pt-sum{margin-left:auto;display:flex;align-items:baseline;gap:6px;font:12px var(--f-mono);color:var(--ink2)}
.pt-sum b{color:var(--ink)}
@media (max-width:1100px){
  .pt{--pt-cols:minmax(0,1fr) 11rem 4.2rem}
  .pt-colh .pt-h:nth-child(n+4),.pt-row>.pt-c:nth-child(n+4){display:none}
}

/* bars: segments on a shared scale */
.pj-bar{display:flex;align-items:center;gap:1px;height:10px;min-width:0}
.pj-bar .seg{display:block;height:100%;min-width:2px;border-radius:2px}
.pj-bar .seg.main{background:var(--c-main,var(--keel))}
.pj-bar .seg.agent{background:var(--c-agent,var(--keel-mid))}
.pj-bar .seg.work{background:var(--ink2)}
.pj-bar .seg.wait{background:repeating-linear-gradient(135deg,var(--stale) 0 3px,transparent 3px 6px);box-shadow:inset 0 0 0 1px var(--stale)}
.pj-bar .seg.land{background:var(--c-land,var(--pass-ink))}
.pj-bar .seg.td-ready{background:var(--pass-ink)}
.pj-bar .seg.td-decision{background:var(--keel)}
.pj-bar .seg.td-blocked{background:var(--signal-ink)}
.pj-bar .seg.td-watch{background:var(--faint)}

/* 分析: the rail and the angle */
.pa{display:grid;grid-template-columns:13.5rem minmax(0,1fr);gap:10px;margin-top:10px;min-height:0}
@media (max-width:900px){.pa{grid-template-columns:1fr}}
.an-nav ul{list-style:none;margin:0 -10px;padding:0;display:flex;flex-direction:column;gap:2px}
.an-nav a{display:flex;flex-direction:column;gap:2px;padding:9px 10px 9px 12px;border-radius:8px;text-decoration:none;color:var(--ink2)}
.an-nav a:hover{background:var(--wash)}
.an-nav a[aria-current=page]{background:var(--keel-tint);box-shadow:inset 3px 0 0 var(--keel)}
.an-nm{font-size:13.5px;color:var(--ink)}
.an-nav a[aria-current=page] .an-nm{color:var(--keel-deep);font-weight:700}
.an-q{font-size:12px;color:var(--ink2)}
.an-nav a:focus-visible,.an a:focus-visible{outline:2px solid var(--keel);outline-offset:1px}
.an{display:flex;flex-direction:column;min-width:0}
.an .dcard-h h2{margin:0;font-size:15px;font-weight:700;line-height:1.2;color:var(--ink)}
.an-take{margin:10px 0 0;font-size:13.5px;line-height:1.5;color:var(--ink2)}
.an-empty{margin:14px 0 4px;font-size:13px;color:var(--muted)}
.an-bars{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
.an-row{display:grid;grid-template-columns:9rem minmax(0,1fr) auto;align-items:center;gap:12px}
.an-bars.two .an-row{grid-template-columns:9rem minmax(0,1fr) minmax(0,1fr)}
.an-l{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;color:var(--ink)}
.an-l a{color:inherit;text-decoration:none}
.an-l a:hover{text-decoration:underline;text-underline-offset:3px}
.an-cols{display:flex;align-items:flex-end;gap:6px;height:160px;margin-top:12px}
.an-col{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;height:100%;min-width:0}
.an-col .seg{display:block;width:100%;border-radius:2px 2px 0 0;background:var(--c-land,var(--pass-ink))}
.an-col small{font:11px var(--f-mono);color:var(--muted)}
```

5. Run it and watch it pass:

```sh
node --test tests/station-projects-redesign.test.js
```

6. Commit:

```sh
git add assets/station/projects-page.js assets/station/projects-page.css tests/station-projects-redesign.test.js
git commit -m "feat: station projects overview and analysis tab" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 10: The project page `#/p/<name>`

**Files:**
- Modify: `assets/station/project-page.js` — new: `FK_PROJECT`, the report layout of `#/p/<pkey>`
- Modify: `assets/station/project-page.css` — new: head, KPI tiles, weekly trend, stage cards, TODO tabs, recent landings
- Read: `.fankeel/build/2026-10-21-station-redesign/route-projects.html:624-890` — blocks `project-page`, `project-head`, `project-kpis`, `project-trend`, `project-stages`, `project-lists`; the TODO age chart, the stage-task dialog and the period deltas are invented data and are not ported
- Read: `assets/station/station.js:255-271` — `parseHash`: `#/p/<pkey>`, `#/p/<pkey>/todo`, `#/p/<pkey>/todo/<id>` give `{ view: 'project', pkey, todo }`
- Read: `tests/station-module.js:17-36`
- Test: `tests/station-project-redesign.test.js`

**Interfaces:**
- Consumes: `window.FK_PROJECTS.rowsOf(S, days, now)` (Task 9) for the KPI figures, so the project's row on `#/projects` and its tiles are one computation; `window.FK_KIT` — `esc`, `usd(n, plain)`, `mins`, `shortLabel`, `sessionHash`, `lastDays`, `ROUTE`; `window.FK_TIP.attr` (Task 6); the open TODO entry's `due` and `dueAt` (epoch ms, Task 2). Reads `window.STATION.sessions[]` fields `id, task, pkey, root, route, stage, state, gateAt, started, updated, usd, agentUsd, days[] {day, usd, who}, stages[] {stage, from, to, waited, usd}` and `window.STATION.projects[].todos[] {pkey, open[] {id, label, title, description, state, condition, due, dueAt}}`.
- Produces: `window.FK_PROJECT` and `module.exports`, `{ page, onClick, state, reset, EN }`:
  - `page(S, pkey, o) -> string` — `o = { todo, names, now, serve, redraw }`; `todo` is `parseHash`'s: undefined (no panel asked), `''` (the TODO panel) or an entry id (that entry's tab, the entry marked `aria-current`, scrolled into view after the draw).
  - `onClick(e)` — `[data-pp-tab]` switches the TODO tab; `state() -> { pkey, tab }`; `reset()`.
- Wiring (Tasks 15/16, not this task): Task 15 loads `project-page.js` after `projects-page.js`; Task 16 routes `project` to `FK_PROJECT.page(S, r.pkey, modOpts({ todo: r.todo }))`, falling back to the old `projectPage` when `w.FK_PROJECT` is absent.

**Dispatch:** implementer, opus

1. Write the failing test `tests/station-project-redesign.test.js`:

```js
'use strict';
// The project page (assets/station/project-page.js; design 2026-10-21-station-redesign
// §3, last bullet; mockup route-projects.html blocks project-*): head, KPI
// tiles from the same rows the overview prints, a four-week cost and landed
// trend on one scale, stage cards on one scale, TODO tabs with `todo-<id>`
// entries, recent landings.
const test = require('node:test');
const assert = require('node:assert/strict');
const { page, stringsLeft } = require('./station-module.js');

const NOW = new Date(2026, 9, 22, 15, 0, 0).getTime();
const DAY = 864e5;
const at = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString();
const dayOf = (daysAgo) => { const d = new Date(NOW - daysAgo * DAY); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const A = 'F:\\w/alpha';
const R = ['survey', 'plan', 'build', 'land'];
const ses = (id, o) => Object.assign({ id, task: 'T ' + id, pkey: A, root: 'F:\\w', route: R, stage: 'land', state: 'down', gateAt: null,
    started: at(6), updated: at(2), usd: 1, agentUsd: 0, days: [], stages: [] }, o);
const S = {
    sessions: [
        ses('a1', { started: at(5), updated: at(1), days: [{ day: dayOf(1), usd: 4, who: 'main' }, { day: dayOf(1), usd: 2, who: 'agent' }],
            stages: [{ stage: 'plan', from: NOW - 5 * DAY, to: NOW - 4 * DAY, waited: 6 * 3600e3, usd: 1 }, { stage: 'build', from: NOW - 4 * DAY, to: NOW - 2 * DAY, waited: 0, usd: 3 }] }),
        ses('a2', { started: at(12), updated: at(10), days: [{ day: dayOf(10), usd: 3, who: 'main' }] }),
        ses('a3', { task: 'Running now', stage: 'build', state: 'live', updated: at(0.01) }),
        ses('z9', { pkey: 'F:\\w/other' }),
    ],
    projects: [{ todos: [{ pkey: A, open: [
        { id: 'rd-1', label: 'fix', title: 'Ready **one**', description: 'd1', state: 'ready', condition: '', due: false, dueAt: null },
        { id: 'blk-1', label: 'wait', title: 'Blocked one', description: 'd2', state: 'blocked', condition: 'after: release', due: true, dueAt: NOW - DAY },
    ] }] }],
};
const NAMES = { [A]: 'w / alpha' };

function mod(lang) {
    const { win } = page(['tip.js', 'projects-page.js', 'project-page.js'], {});
    if (lang) win.FK_I18N = { lang };
    win.FK_PROJECT.reset();
    return { P: win.FK_PROJECT, Ps: win.FK_PROJECTS };
}
const draw = (P, o) => P.page(S, A, Object.assign({ names: NAMES, now: NOW, redraw() {} }, o));

test('the head names the project, links back and to the running session', () => {
    const { P } = mod();
    const html = draw(P);
    assert.ok(html.includes('data-block="project-head"'));
    assert.ok(html.includes('<a class="ph-back" href="#/projects">'));
    assert.ok(html.includes('<h2>alpha</h2>'));
    assert.ok(html.includes('<a class="ph-now" href="#/s/a3">'));
    assert.ok(html.includes('Running now'));
});

test('the KPI tiles print the overview\'s own row for the project', () => {
    const { P, Ps } = mod();
    const row = Ps.rowsOf(S, 30, NOW).find((r) => r.pkey === A);
    const html = draw(P);
    const tiles = [...html.matchAll(/<div class="kp" data-kp="(\w+)"><span class="kp-l">[^<]*<\/span><span class="kp-v">([^<]*)<\/span>/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(tiles, [['usd', '$9.00'], ['landed', String(row.landed)], ['cpl', '$4.50'], ['dtl', '3'], ['todo', '2'], ['overdue', '1']]);
});

test('the trend is four weeks, cost main / agents and landings, each on one scale with its own tips', () => {
    const { P } = mod();
    const html = draw(P);
    assert.equal((html.match(/<span class="tr-wk" data-wk="\d"/g) || []).length, 4);
    const at3 = html.indexOf('data-wk="3"');
    const wk3 = html.slice(at3, html.indexOf('<small>', at3));
    assert.equal([...wk3.matchAll(/height:(\d+)%/g)].reduce((n, m) => n + Number(m[1]), 0), 100, 'the costliest week, main + agents, is the full height');
    assert.ok(/class="seg main" style="height:\d+%"[^>]*data-tip="/.test(wk3));
    assert.ok(/class="seg agent" style="height:\d+%"/.test(html));
    assert.ok(/class="seg land" style="height:100%"/.test(html));
});

test('stage cards share one time scale; a stage no session timed is left out', () => {
    const { P } = mod();
    const html = draw(P);
    assert.ok(html.includes('data-block="project-stages"'));
    assert.ok(/<li class="sg" data-stage="build">[\s\S]*?class="seg work" style="width:100%"/.test(html));
    assert.ok(/<li class="sg" data-stage="plan">[\s\S]*?class="seg wait" style="width:\d+%"/.test(html));
    assert.ok(!html.includes('data-stage="survey"'));
});

test('TODO tabs count each state; an entry id opens its tab and marks it', () => {
    const { P } = mod();
    let html = draw(P);
    assert.ok(html.includes('data-pp-tab="ready" aria-selected="true"'));
    assert.ok(html.includes('<li id="todo-rd-1"'));
    assert.ok(html.includes('Ready one'), 'the ** marks are dropped');
    html = draw(P, { todo: 'blk-1' });
    assert.ok(html.includes('data-pp-tab="blocked" aria-selected="true"'));
    assert.ok(html.includes('<li id="todo-blk-1" aria-current="true"'));
    assert.ok(/class="tr-due soon"/.test(html), 'a due entry is marked');
    P.onClick({ target: { getAttribute: () => 'ready', closest() { return this; } } });
    assert.equal(P.state().tab, 'ready');
});

test('recent landings list the project\'s landed sessions, newest first', () => {
    const { P } = mod();
    const html = draw(P);
    const land = html.slice(html.indexOf('data-block="project-landed"'));
    assert.ok(land.indexOf('href="#/s/a1"') < land.indexOf('href="#/s/a2"'));
    assert.ok(!land.includes('#/s/z9'));
});

test('an unknown project says so; English and every string have English', () => {
    const { P } = mod();
    assert.ok(P.page(S, 'F:\\nope', { names: {}, now: NOW }).includes('class="pp-none"'));
    const en = mod('en').P;
    assert.ok(draw(en).includes('Recent landings'));
    assert.deepEqual(stringsLeft('project-page.js', en.EN), []);
});
```

2. Run it and watch it fail:

```sh
node --test tests/station-project-redesign.test.js
```

3. Write `assets/station/project-page.js`:

```js
'use strict';
// assets/station/project-page.js — the project page `#/p/<pkey>` in the
// report layout (docs/90-agent/plans/2026-10-21-station-redesign-design.md §3,
// last bullet; mockup route-projects.html, blocks project-head, project-kpis,
// project-trend, project-stages, project-lists). Head (back to 專案, the name,
// the running session), six KPI tiles for the last 30 days printed from
// FK_PROJECTS.rowsOf — the row #/projects prints, computed once — a four-week
// trend of cost (main / agents) and landings, one card a stage with its median
// stay split 做事 / 等你 on one scale, the TODO tabs (`#/p/<pkey>/todo/<id>`
// opens that entry's tab), and the recent landings. Reads `w.FK_KIT` when it draws.
(function (w, doc) {
    var EN = {
        'pp.back': 'Projects',
        'pp.none': 'No session or TODO list belongs to this project.',
        'pp.now': 'Now',
        'pp.last': 'Last move {t}',
        'pp.kpis': 'Last 30 days',
        'pp.cost': 'Cost',
        'pp.landed': 'Landed',
        'pp.cpl': 'Per landing',
        'pp.dtl': 'Days to land',
        'pp.todo': 'Open TODO',
        'pp.overdue': 'Overdue',
        'pp.trend': 'Weekly cost and landings',
        'pp.week': 'week of {d}',
        'pp.main': 'main {v}',
        'pp.agent': 'agents {v}',
        'pp.nLanded': '{n} landed',
        'pp.costRow': 'Cost',
        'pp.landRow': 'Landed',
        'pp.stages': 'Stages',
        'pp.work': 'working {t}',
        'pp.wait': 'waiting on you {t}',
        'pp.passed': '{n} passed',
        'pp.noStages': 'No stage of this project has both ends timed yet.',
        'pp.lists': 'TODO',
        'pp.ready': 'Ready',
        'pp.decision': 'Needs a decision',
        'pp.blocked': 'Blocked',
        'pp.watch': 'Watch',
        'pp.dueOn': 'due {d}',
        'pp.noTodo': 'Nothing in this state.',
        'pp.noList': 'This project keeps no TODO entries.',
        'pp.landedList': 'Recent landings',
        'pp.noLanded': 'Nothing has landed yet.',
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function fill(s, vars) {
        if (!vars) return s;
        return String(s).replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) ? String(vars[k]) : m; });
    }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return fill(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    function kit() { return (w && w.FK_KIT) || {}; }
    function esc(s) { return kit().esc(s); }
    function tip(label, values) { return w && w.FK_TIP ? w.FK_TIP.attr(label, values) : ''; }
    function ms(t) { return typeof t === 'number' ? t : Date.parse(t); }
    function plain(s) { return String(s == null ? '' : s).split('**').join(''); }
    function median(xs) {
        if (!xs.length) return null;
        var s = xs.slice().sort(function (a, b) { return a - b; }), h = s.length >> 1;
        return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
    }
    function two(n) { return ('0' + n).slice(-2); }
    function md(t) { var d = new Date(t); return two(d.getMonth() + 1) + '-' + two(d.getDate()); }
    function dayStart(now) { var m = new Date(now); m.setHours(0, 0, 0, 0); return m.getTime(); }
    function since(t, now) {
        if (!t) return '—';
        var m = Math.max(0, Math.round((now - t) / 60000));
        if (m < 60) return m + 'm';
        if (m < 1440) return Math.floor(m / 60) + 'h';
        return Math.floor(m / 1440) + 'd';
    }
    var STATES = ['ready', 'decision', 'blocked', 'watch'];
    var st = { pkey: null, tab: null, seen: null }, last = null, bound = false;

    function stateName(s) {
        if (s === 'ready') return loc('pp.ready', 'Ready');
        if (s === 'decision') return loc('pp.decision', '待決定');
        if (s === 'blocked') return loc('pp.blocked', 'Blocked');
        return loc('pp.watch', 'Watch');
    }
    function headHtml(pkey, list, names, now) {
        var k = kit(), run = list.filter(function (s) { return s.state === 'live'; }).sort(function (a, b) { return ms(b.updated) - ms(a.updated); })[0];
        var lastMove = Math.max.apply(null, [0].concat(list.map(function (s) { return ms(s.updated) || 0; })));
        var root = list.length ? list[0].root : '';
        return '<section class="dcard ph" data-block="project-head">'
            + '<a class="ph-back" href="#/projects">' + loc('pp.back', '專案') + '</a>'
            + '<div class="ph-id"><h2>' + esc(k.shortLabel(names[pkey] || pkey)) + '</h2><p title="' + esc(pkey) + '">' + esc(names[pkey] || root || pkey) + '</p></div>'
            + (run ? '<a class="ph-now" href="' + esc(k.sessionHash(run.id)) + '"><span class="ph-now-l">' + loc('pp.now', '現在')
                + ' <span class="hm-stw" style="--c:var(--st-' + esc(run.stage) + ')">' + esc(run.stage) + '</span></span><span class="ph-now-t">' + esc(run.task || run.id) + '</span></a>' : '<span></span>')
            + '<ul class="ph-facts"><li>' + esc(loc('pp.last', '最後動靜 {t}', { t: since(lastMove, now) })) + '</li></ul></section>';
    }
    function kpisHtml(row) {
        var k = kit();
        var tile = function (id, label, v) { return '<div class="kp" data-kp="' + id + '"><span class="kp-l">' + label + '</span><span class="kp-v">' + v + '</span></div>'; };
        return '<section class="dcard kps" data-block="project-kpis" aria-label="' + esc(loc('pp.kpis', '近 30 天')) + '">'
            + tile('usd', loc('pp.cost', '花費'), k.usd(row.usd, true))
            + tile('landed', loc('pp.landed', '落地'), String(row.landed))
            + tile('cpl', loc('pp.cpl', '每筆落地'), row.cpl === null ? '—' : k.usd(row.cpl, true))
            + tile('dtl', loc('pp.dtl', '落地天數'), row.dtl === null ? '—' : String(Math.round(row.dtl * 10) / 10))
            + tile('todo', loc('pp.todo', '開著的 TODO'), String(row.todo))
            + tile('overdue', loc('pp.overdue', '到期'), String(row.overdue)) + '</section>';
    }
    // Four weeks ending today: cost from `days` split main / agents, landings by `updated`; each series one scale.
    function trendHtml(list, now) {
        var k = kit(), end = dayStart(now) + 864e5, W = [];
        for (var i = 0; i < 4; i++) {
            var from = end - (4 - i) * 7 * 864e5;
            W.push({ from: from, fromDay: k.lastDays(from + 864e5 - 1, 1)[0], toDay: k.lastDays(from + 7 * 864e5 - 1, 1)[0], main: 0, agent: 0, land: 0 });
        }
        list.forEach(function (s) {
            (s.days || []).forEach(function (x) {
                if (!x || typeof x.usd !== 'number') return;
                W.forEach(function (wk) { if (x.day >= wk.fromDay && x.day <= wk.toDay) { if (x.who === 'main') wk.main += x.usd; else wk.agent += x.usd; } });
            });
            var up = ms(s.updated);
            if (s.stage === 'land' && s.state === 'down') W.forEach(function (wk) { if (up >= wk.from && up < wk.from + 7 * 864e5) wk.land++; });
        });
        var maxU = Math.max.apply(null, [0.01].concat(W.map(function (wk) { return wk.main + wk.agent; })));
        var maxL = Math.max.apply(null, [1].concat(W.map(function (wk) { return wk.land; })));
        var h = function (v, max) { return v > 0 ? Math.max(2, Math.round(v / max * 100)) : 0; };
        return '<section class="dcard trd" data-block="project-trend" aria-label="' + esc(loc('pp.trend', '每週花費與落地')) + '">'
            + '<div class="dcard-h"><b>' + loc('pp.trend', '每週花費與落地') + '</b></div>'
            + '<div class="tr-rows"><span class="tr-k">' + loc('pp.costRow', '花費') + '</span><div class="tr-plot">' + W.map(function (wk, j) {
                var label = loc('pp.week', '{d} 那週', { d: wk.fromDay.slice(5) });
                return '<span class="tr-wk" data-wk="' + j + '"><span class="tr-stack">'
                    + (wk.agent > 0 ? '<i class="seg agent" style="height:' + h(wk.agent, maxU) + '%"' + tip(label, [loc('pp.agent', '派工 {v}', { v: k.usd(wk.agent, true) })]) + '></i>' : '')
                    + (wk.main > 0 ? '<i class="seg main" style="height:' + h(wk.main, maxU) + '%"' + tip(label, [loc('pp.main', '主 {v}', { v: k.usd(wk.main, true) })]) + '></i>' : '')
                    + '</span><small>' + wk.fromDay.slice(5) + '</small></span>';
            }).join('') + '</div>'
            + '<span class="tr-k">' + loc('pp.landRow', '落地') + '</span><div class="tr-plot land">' + W.map(function (wk) {
                var label = loc('pp.week', '{d} 那週', { d: wk.fromDay.slice(5) });
                return '<span class="tr-wl"><span class="tr-stack">' + (wk.land ? '<i class="seg land" style="height:' + h(wk.land, maxL) + '%"'
                    + tip(label, [loc('pp.nLanded', '落地 {n} 筆', { n: wk.land })]) + '></i>' : '') + '</span></span>';
            }).join('') + '</div></div></section>';
    }
    // One card a stage: the median stay of the project's timed stages, 做事 / 等你, on one scale.
    function stagesHtml(list) {
        var k = kit(), by = {};
        list.forEach(function (s) {
            (s.stages || []).forEach(function (x) {
                if (!x || !isFinite(x.from) || !isFinite(x.to) || x.to <= x.from) return;
                var wait = Math.min(Math.max(x.waited || 0, 0), x.to - x.from);
                (by[x.stage] = by[x.stage] || []).push({ work: x.to - x.from - wait, wait: wait });
            });
        });
        var stages = k.ROUTE.filter(function (g) { return by[g]; }).map(function (g) {
            return { g: g, n: by[g].length, work: median(by[g].map(function (x) { return x.work; })), wait: median(by[g].map(function (x) { return x.wait; })) };
        });
        var max = Math.max.apply(null, [1].concat(stages.map(function (m) { return m.work + m.wait; })));
        var pct = function (v) { return Math.max(1, Math.round(v / max * 100)); };
        return '<section class="dcard sgs" data-block="project-stages" aria-label="' + esc(loc('pp.stages', '各站')) + '">'
            + '<div class="dcard-h"><b>' + loc('pp.stages', '各站') + '</b></div>'
            + (stages.length ? '<ul class="sg-l">' + stages.map(function (m) {
                return '<li class="sg" data-stage="' + m.g + '"><span class="sg-h"><span class="hm-stw" style="--c:var(--st-' + m.g + ')">' + m.g + '</span>'
                    + '<small>' + loc('pp.passed', '{n} 筆經過', { n: m.n }) + '</small></span><span class="pj-bar">'
                    + (m.work > 0 ? '<i class="seg work" style="width:' + pct(m.work) + '%"' + tip(m.g, [loc('pp.work', '做事 {t}', { t: k.mins(m.work) })]) + '></i>' : '')
                    + (m.wait > 0 ? '<i class="seg wait" style="width:' + pct(m.wait) + '%"' + tip(m.g, [loc('pp.wait', '等你回答 {t}', { t: k.mins(m.wait) })]) + '></i>' : '')
                    + '</span></li>';
            }).join('') + '</ul>' : '<p class="an-empty">' + loc('pp.noStages', '這個專案還沒有哪一站頭尾都有計時。') + '</p>') + '</section>';
    }
    function todoHtml(open, focus) {
        var by = {};
        STATES.forEach(function (s) { by[s] = []; });
        open.forEach(function (x) { if (by[x.state]) by[x.state].push(x); });
        var hit = focus ? open.filter(function (x) { return x.id === focus; })[0] : null;
        if (hit && by[hit.state] && st.seen !== focus) st.tab = hit.state;
        st.seen = focus;
        if (!st.tab) st.tab = STATES.filter(function (s) { return by[s].length; })[0] || 'ready';
        var rows = by[st.tab];
        return '<section class="dcard pls" data-block="project-lists" aria-label="TODO"><div class="dcard-h"><b>' + loc('pp.lists', 'TODO') + '</b></div>'
            + (open.length ? '<div class="ptd-tabs" role="tablist">' + STATES.map(function (s) {
                var due = by[s].filter(function (x) { return x.due; }).length;
                return '<button type="button" role="tab" data-pp-tab="' + s + '" aria-selected="' + (s === st.tab) + '" data-st="' + s + '">'
                    + '<span class="tt-h">' + stateName(s) + ' <b>' + by[s].length + '</b></span>' + (due ? '<em class="due">' + loc('pp.overdue', '到期') + ' ' + due + '</em>' : '') + '</button>';
            }).join('') + '</div>'
                + (rows.length ? '<ul class="tl">' + rows.map(function (x) {
                    var id = x.id ? ' id="todo-' + esc(x.id) + '"' : '';
                    return '<li' + id + (hit && x === hit ? ' aria-current="true"' : '') + '><div class="tr"><span class="tr-lb">' + esc(x.label || '') + '</span>'
                        + '<span class="tr-tx"><b>' + esc(plain(x.title)) + '</b>' + (x.description ? '<span class="tr-cd">' + esc(plain(x.description)) + '</span>' : '')
                        + (x.condition ? '<span class="tr-cd">' + esc(plain(x.condition)) + '</span>' : '') + '</span>'
                        + (x.dueAt ? '<span class="tr-due' + (x.due ? ' soon' : '') + '">' + esc(loc('pp.dueOn', '{d} 到期', { d: md(x.dueAt) })) + '</span>' : '<span></span>')
                        + '</div></li>';
                }).join('') + '</ul>' : '<p class="an-empty">' + loc('pp.noTodo', '這個狀態沒有條目。') + '</p>')
                : '<p class="an-empty">' + loc('pp.noList', '這個專案沒有 TODO 條目。') + '</p>') + '</section>';
    }
    function landedHtml(list) {
        var k = kit(), land = list.filter(function (s) { return s.stage === 'land' && s.state === 'down'; })
            .sort(function (a, b) { return ms(b.updated) - ms(a.updated); }).slice(0, 8);
        return '<section class="dcard pld" data-block="project-landed" aria-label="' + esc(loc('pp.landedList', '最近落地')) + '">'
            + '<div class="dcard-h"><b>' + loc('pp.landedList', '最近落地') + '</b></div>'
            + (land.length ? '<ul class="pl-l">' + land.map(function (s) {
                return '<li><a href="' + esc(k.sessionHash(s.id)) + '"><span class="pl-t">' + esc(s.task || s.id) + '</span>'
                    + '<span class="pl-d">' + md(ms(s.updated)) + '</span><span class="pl-u">' + k.usd(k.cost ? k.cost(s) : (s.usd || 0) + (s.agentUsd || 0), true) + '</span></a></li>';
            }).join('') + '</ul>' : '<p class="an-empty">' + loc('pp.noLanded', '還沒有任務走到 land。') + '</p>') + '</section>';
    }

    function page(S, pkey, o) {
        o = o || {};
        last = o;
        bind();
        if (st.pkey !== pkey) st = { pkey: pkey, tab: null, seen: null };
        var now = isFinite(o.now) ? o.now : Date.now(), names = o.names || {};
        var list = ((S && S.sessions) || []).filter(function (s) { return s.pkey === pkey; });
        var open = [], kept = false;
        ((S && S.projects) || []).forEach(function (p) {
            (p.todos || []).forEach(function (t) { if (t.pkey === pkey) { kept = true; open = open.concat(t.open || []); } });
        });
        if (!list.length && !kept) {
            return '<div class="pp" data-block="project-page"><a class="ph-back" href="#/projects">' + loc('pp.back', '專案') + '</a>'
                + '<p class="pp-none">' + loc('pp.none', '這個專案沒有 session，也沒有 TODO 清單。') + '</p></div>';
        }
        var P = w && w.FK_PROJECTS;
        var row = (P ? P.rowsOf(S, 30, now) : []).filter(function (r) { return r.pkey === pkey; })[0]
            || { usd: 0, landed: 0, cpl: null, dtl: null, todo: open.length, overdue: 0 };
        if (o.todo && w && typeof w.setTimeout === 'function') {
            w.setTimeout(function () { var el = doc && doc.getElementById('todo-' + o.todo); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' }); }, 0);
        }
        return '<div class="pp" data-block="project-page">' + headHtml(pkey, list, names, now) + kpisHtml(row)
            + '<div class="pp-row2">' + trendHtml(list, now) + stagesHtml(list) + '</div>'
            + '<div class="pp-row3">' + todoHtml(open, o.todo) + landedHtml(list) + '</div></div>';
    }
    function onClick(e) {
        var t = e && e.target, a = t && typeof t.closest === 'function' ? t.closest('[data-pp-tab]') : null;
        if (!a) return;
        var s = a.getAttribute('data-pp-tab');
        if (STATES.indexOf(s) < 0) return;
        st.tab = s;
        if (last && typeof last.redraw === 'function') last.redraw();
    }
    function bind() {
        if (bound || !doc || typeof doc.addEventListener !== 'function') return;
        bound = true;
        doc.addEventListener('click', onClick);
    }
    function state() { return st; }
    function reset() { st = { pkey: null, tab: null, seen: null }; }

    var api = { page: page, onClick: onClick, state: state, reset: reset, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_PROJECT = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
```

4. Write `assets/station/project-page.css`:

```css
/* assets/station/project-page.css — the project page (assets/station/project-page.js),
   ported from route-projects.html's project-head, project-kpis, project-trend,
   project-stages and project-lists. The bars reuse .pj-bar .seg from
   projects-page.css. */
.pp{display:flex;flex-direction:column;gap:10px}
.pp-none{margin:14px 0;font-size:13px;color:var(--muted)}
:root[data-style=keel] .dcard.ph{display:grid;grid-template-columns:auto minmax(0,15rem) minmax(0,1fr) auto;align-items:center;gap:0 22px;padding:8px 18px}
.ph-back{display:inline-flex;align-items:center;gap:4px;height:32px;padding:0 10px;border-radius:7px;font-size:12.5px;color:var(--ink2);text-decoration:none;box-shadow:inset 0 0 0 1px var(--rule)}
.ph-back:hover{background:var(--wash);color:var(--ink)}
.ph-back:focus-visible,.ph-now:focus-visible{outline:2px solid var(--keel);outline-offset:1px}
.ph-id{min-width:0}
.ph-id h2{margin:0;font-size:19px;font-weight:700;line-height:1.3}
.ph-id p{margin:1px 0 0;font:12px var(--f-mono);color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ph-now{display:flex;flex-direction:column;gap:2px;min-width:0;padding:5px 10px;border-radius:8px;background:var(--inset);text-decoration:none;color:var(--ink)}
.ph-now:hover{background:var(--wash)}
.ph-now-l{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)}
.ph-now-l .hm-stw{font-size:11.5px;text-decoration:underline 2px var(--c);text-underline-offset:3px}
.ph-now-t{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ph-facts{display:flex;gap:22px;margin:0;padding:0;list-style:none;font-size:12px;color:var(--muted);white-space:nowrap}

:root[data-style=keel] .dcard.kps{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));padding:0}
.kp{display:flex;flex-direction:column;gap:2px;min-width:0;padding:9px 16px;border-left:1px solid var(--rule)}
.kp:first-child{border-left:0}
.kp-l{font-size:12.5px;color:var(--ink2)}
.kp-v{font:700 22px/1.2 var(--f-ui);color:var(--ink);letter-spacing:-.01em}
.kp[data-kp=overdue] .kp-v{color:var(--signal-ink)}
@media (max-width:1100px){:root[data-style=keel] .dcard.kps{grid-template-columns:repeat(3,minmax(0,1fr))}}

.pp-row2,.pp-row3{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
@media (max-width:1100px){.pp-row2,.pp-row3{grid-template-columns:1fr}}

.trd .tr-rows{display:grid;grid-template-columns:3rem minmax(0,1fr);align-items:end;gap:6px 10px;margin-top:8px}
.tr-k{font-size:12px;color:var(--muted)}
.tr-plot{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;height:120px}
.tr-plot.land{height:48px}
.tr-wk,.tr-wl{display:flex;flex-direction:column;align-items:stretch;gap:4px;min-width:0;height:100%}
.tr-stack{flex:1;display:flex;flex-direction:column-reverse;justify-content:flex-start;min-height:0}
.tr-stack .seg{display:block;width:100%;min-height:2px}
.tr-stack .seg.main{background:var(--c-main,var(--keel))}
.tr-stack .seg.agent{background:var(--c-agent,var(--keel-mid))}
.tr-stack .seg.land{background:var(--c-land,var(--pass-ink))}
.tr-wk small{font:11px var(--f-mono);color:var(--muted);text-align:center}

.sg-l{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
.sg{display:grid;grid-template-columns:9rem minmax(0,1fr);align-items:center;gap:12px}
.sg-h{display:flex;align-items:baseline;gap:8px;min-width:0}
.sg-h .hm-stw{font-size:12.5px;text-decoration:underline 2px var(--c);text-underline-offset:3px}
.sg-h small{font-size:11.5px;color:var(--muted)}

.ptd-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:10px 0 0}
.ptd-tabs [role=tab]{display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-height:48px;padding:8px 12px;border:0;border-radius:8px;background:var(--inset);color:var(--ink2);font:inherit;text-align:left;cursor:pointer}
.ptd-tabs [role=tab]:hover{background:var(--wash);color:var(--ink)}
.ptd-tabs [role=tab]:focus-visible{outline:2px solid var(--keel);outline-offset:1px}
.ptd-tabs [aria-selected=true]{background:var(--keel-tint);color:var(--keel-deep);box-shadow:inset 0 -2.5px 0 var(--keel)}
.tt-h{display:flex;align-items:baseline;gap:7px;font-size:13px;font-weight:700;line-height:18px}
.tt-h b{font:700 12px var(--f-mono);padding:0 6px;border-radius:5px;background:var(--panel);color:var(--ink)}
.ptd-tabs em{font-style:normal;font-size:12px;color:var(--muted)}
.ptd-tabs em.due{color:var(--signal-ink);font-weight:600}
.tl{list-style:none;margin:10px 0 0;padding:0}
.tl li+li{border-top:1px solid var(--rule)}
.tl li[aria-current=true]{background:var(--keel-tint);border-radius:6px}
.tr{display:grid;grid-template-columns:6.5rem minmax(0,1fr) auto;column-gap:14px;align-items:baseline;padding:9px 4px}
.tr-lb{justify-self:start;font:11.5px var(--f-mono);padding:0 6px;border-radius:4px;box-shadow:inset 0 0 0 1px var(--rule2);color:var(--ink2);white-space:nowrap}
.tr-tx{display:flex;flex-direction:column;gap:2px;min-width:0}
.tr-tx b{font-size:13.5px;line-height:1.45}
.tr-cd{font-size:12.5px;line-height:1.5;color:var(--ink2);max-width:72ch}
.tr-due{font:12px var(--f-mono);color:var(--muted);white-space:nowrap}
.tr-due.soon{color:var(--signal-ink);font-weight:700}

.pl-l{list-style:none;margin:8px 0 0;padding:0}
.pl-l li+li{border-top:1px solid var(--rule)}
.pl-l a{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:14px;align-items:baseline;padding:8px 4px;text-decoration:none;color:var(--ink)}
.pl-l a:hover .pl-t{text-decoration:underline;text-underline-offset:3px}
.pl-t{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.pl-d,.pl-u{font:12px var(--f-mono);color:var(--ink2);white-space:nowrap}
```

5. Run it and watch it pass:

```sh
node --test tests/station-project-redesign.test.js
```

6. Commit:

```sh
git add assets/station/project-page.js assets/station/project-page.css tests/station-project-redesign.test.js
git commit -m "feat: station project page in the report layout" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 11: Session page head, 經過 and the landed card (§4)

**Files:**
- Modify: `assets/station/session-page.js` — new: `FK_SESSION`, the page `#/s/<id>` draws: head with three bars, the tabs, 關卡 only with `gateAt`, 經過, the landed card and its dialog
- Modify: `assets/station/session-page.css` — new: the head, tabs, 經過 rows and landed card, ported from `route-session.html` and `_sess/r58-route.css`; the model colours `--dx-*`
- Read: `.fankeel/build/2026-10-21-station-redesign/route-session.html:9-163` — the head, tabs, landed and tooltip rules to port
- Read: `.fankeel/build/2026-10-21-station-redesign/_sess/r58-route.js` — the 經過 markup (rows, shared scales, the chain); its 被擋住 band, back/fail/stall marks and the per-stop CHAIN data are mockup data and are not ported
- Read: `.fankeel/build/2026-10-21-station-redesign/_sess/r58-route.css` — the 經過 rules to port
- Read: `.fankeel/build/2026-10-21-station-redesign/_sess/r63-landed.js:120-200` — the landed card and dialog markup; the per-task agent, check, time and cost columns are mockup data and are not ported
- Read: `tests/station-module.js` — `page(names, station)` boots station.js and the module in one vm; `stringsLeft(name, EN)`
- Test: `tests/station-session-redesign.test.js`

**Interfaces:**
- Consumes: Task 3's `window.FK_KIT` — `esc`, `cost(s)`, `usd(n, plain)`, `mins(ms)`, `keelGlyph(o)`, `projectHash(pkey)`, `sessionHash(id, tab)`, `family(model)`, `icon(name)`, `ROUTE`; Task 6's `window.FK_TIP.attr(label, values) -> string` (optional: without it a segment gets `tabindex` and a `title`).
- Produces: `window.FK_SESSION` and `module.exports`, `{ page, stagesOf, stageOf, agentAt, fam, LETTER, EN }`:
  - `page(s, x, o) -> string` — `s` a `window.STATION.sessions[]` row, `x` its `STATION_DETAIL[id]` or null, `o = { tab: 'timeline'|'dispatch'|'talk', talk: held, serve, now, names, redraw }` (Task 16's `modOpts`). Calls `w.FK_SDISP.html(s, x)` on 派工 (Task 12) and `w.FK_STALK.html(s.id, o.talk, { stages: s.stages, task: s.task })` on 對話 (Task 13).
  - `stagesOf(s) -> [{ stage, from, to, span, wait, work, usd }]` — ms; `wait = min(span, waited)`, `work = span - wait`, `usd` the stage's cost or 0.
  - `stageOf(stages, t) -> string|null` — the stage whose window holds `t`.
  - `agentAt(x, row) -> ms` — the agent's first request, else its dispatch's `out`.
  - `fam(model) -> 'fable'|'opus'|'sonnet'|'haiku'|'other'`; `LETTER = { fable: 'F', opus: 'O', sonnet: 'S', haiku: 'H', other: '?' }`.
  - CSS custom properties `--dx-fable`, `--dx-opus`, `--dx-sonnet`, `--dx-haiku`, `--dx-other` and `--dx-<model>-on`, light and dark, for Task 12.

**Dispatch:** implementer, opus

1. Write the failing test.

In `tests/station-session-redesign.test.js`:

```js
'use strict';
// The session page, #/s/<id> (assets/station/session-page.js; design
// 2026-10-21-station-redesign §4): the head's three bars, the tabs and the
// 關卡 link only while a gate waits, 經過 on two shared scales whose cost
// segments add up to the head's total, the event chain a stage opens to, the
// landed card, and 派工 and 對話 handed to their own modules.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page, stringsLeft } = require('./station-module.js');

const MIN = 60e3;
const T0 = Date.parse('2026-10-20T10:00:00.000Z');
const SID = 'aaaaaaaa-1111-4111-8111-111111111111';
function session(extra) {
    return Object.assign({ id: SID, root: 'F:\\ws', project: 'fankeel', pkey: 'F:\\ws/fankeel', task: 'Station redesign', state: 'down',
        stage: 'build', route: ['survey', 'build'], started: new Date(T0).toISOString(), usd: 4, agentUsd: 2, hasDetail: true,
        stages: [{ stage: 'survey', from: T0, to: T0 + 10 * MIN, burn: null, usd: 1, waited: 2 * MIN },
            { stage: 'build', from: T0 + 10 * MIN, to: T0 + 70 * MIN, burn: null, usd: 4, waited: null }] }, extra);
}
const DETAIL = {
    rows: [{ id: 'a1', model: 'claude-sonnet-4-5', usd: 1.5, from: T0 + 15 * MIN, disp: 0, durMs: 5 * MIN },
        { id: 'a2', model: 'claude-opus-4-1', usd: 0.5, from: T0 + 5 * MIN, disp: 1, durMs: 2 * MIN }],
    dispatches: [{ text: 'build task 1', agentType: 'fankeel-implementer', surface: 'agent', out: T0 + 14 * MIN, ids: ['a1'] },
        { text: 'survey reader', agentType: 'fankeel-reader', surface: 'agent', out: T0 + 4 * MIN, ids: ['a2'] }],
    events: [{ t: T0 + 12 * MIN, kind: 'out', disp: 0, text: 'build task 1', agentType: 'fankeel-implementer' },
        { t: T0 + 20 * MIN, kind: 'commit', sha: 'abc1234', text: 'fix: one' },
        { t: T0 + 80 * MIN, kind: 'commit', sha: 'zzz9999', text: 'after every stage' }],
    tasks: [{ plan: 'docs/90-agent/plans/p.md', tasks: [{ n: 1, title: 'Archived plan', status: 'complete' },
        { n: 2, title: 'Due rule', status: 'no ledger line' }] }],
};
// The page as station.js boots it, with a stand-in tooltip that prints its
// label and values into data-t and keeps every call.
function boot() {
    const p = page(['session-page.js'], { sessions: [session()] });
    const tips = [];
    p.win.FK_TIP = { attr(label, vals) { tips.push([label, vals]); return ' data-t="' + label + '|' + vals.join('|') + '"'; } };
    return { M: p.M['session-page.js'], win: p.win, tips };
}
// One block's section, from its data-block to the first </section> after it.
function section(html, name) {
    const i = html.indexOf('data-block="' + name + '"');
    assert.ok(i >= 0, name + ' is drawn');
    return html.slice(i, html.indexOf('</section>', i));
}
const sum = (html, attr) => [...html.matchAll(new RegExp(attr + '="([0-9.e-]+)"', 'g'))].reduce((n, m) => n + Number(m[1]), 0);

test('the head draws time as 做事 and 等你回答, cost as main and agent, and one pip an agent', () => {
    const { M } = boot();
    const head = section(M.page(session(), DETAIL, { tab: 'timeline', names: {} }), 'session-head');
    assert.match(head, /class="wk" style="flex:4080000"/);
    assert.match(head, /class="wt" style="flex:120000"/);
    assert.match(head, /class="m" style="flex:4" data-usd="4"/);
    assert.match(head, /class="a" style="flex:2" data-usd="2"/);
    assert.equal((head.match(/--dx-sonnet/g) || []).length, 1);
    assert.equal((head.match(/--dx-opus/g) || []).length, 1);
    assert.ok(head.includes('>Station redesign</h1>'));
    assert.ok(head.includes('href="#/p/' + encodeURIComponent('F:\\ws/fankeel') + '"'));
});

test('every tooltip is one label and at most two values; a pip group spells its models as letters', () => {
    const { M, tips } = boot();
    M.page(session(), DETAIL, { tab: 'timeline', names: {} });
    assert.ok(tips.length > 8, tips.length + ' tooltips');
    for (const [label, v] of tips) assert.ok(v.length <= 2, label + ': ' + v.join('|'));
    assert.deepEqual(tips.find((t) => t[0] === 'build task 1')[1], ['1 個 agent', 'S']);
    assert.deepEqual(tips.find((t) => t[0] === 'survey reader')[1], ['1 個 agent', 'O']);
});

test('the tabs are 經過, 派工 and 對話, and 關卡 shows only while a gate waits', () => {
    const { M } = boot();
    const quiet = M.page(session(), DETAIL, { tab: 'timeline' });
    assert.ok(quiet.includes('href="#/s/' + SID + '" role="tab" aria-selected="true">經過</a>'));
    assert.ok(quiet.includes('href="#/s/' + SID + '/dispatch" role="tab" aria-selected="false">派工</a>'));
    assert.ok(quiet.includes('href="#/s/' + SID + '/talk" role="tab" aria-selected="false">對話</a>'));
    assert.ok(!quiet.includes('session-gate-link'));
    const served = M.page(session({ gateAt: T0 + 70 * MIN }), DETAIL, { tab: 'timeline', serve: true });
    assert.ok(served.includes('data-block="session-gate-link" href="/f/' + SID + '/gate"'));
    const file = M.page(session({ gateAt: T0 + 70 * MIN }), DETAIL, { tab: 'timeline', serve: false });
    assert.ok(file.includes('data-block="session-gate-link" href="#/s/' + SID + '/gate"'));
    assert.ok(!quiet.includes('tk-user') && !quiet.includes('talk-counts'), 'the old ten-round talk list is gone');
});

test('經過 is one row a stage on one time scale and one cost scale, and its cost segments add up to the head', () => {
    const { M } = boot();
    const s = session();
    const run = section(M.page(s, DETAIL, { tab: 'timeline' }), 'session-run');
    const survey = run.slice(run.indexOf('data-key="rd-survey"'), run.indexOf('data-key="rd-build"'));
    const build = run.slice(run.indexOf('data-key="rd-build"'));
    assert.match(survey, /class="rd-seg" style="--w:16\.667%"/);
    assert.match(build, /class="rd-seg" style="--w:100\.000%"/);
    assert.match(survey, /class="rd-cost"><span style="--w:25\.000%">/);
    assert.match(build, /class="rd-cost"><span style="--w:100\.000%">/);
    // survey $1 holds agent a2's $0.5; build $4 holds agent a1's $1.5
    assert.match(survey, /class="m" style="flex:0.5" data-usd="0.5"/);
    assert.match(survey, /class="a" style="flex:0.5" data-usd="0.5"/);
    assert.match(build, /class="m" style="flex:2.5" data-usd="2.5"/);
    assert.match(build, /class="a" style="flex:1.5" data-usd="1.5"/);
    assert.ok(build.includes('>其他<'), 'the $1 no stage holds is a row of its own');
    assert.ok(Math.abs(sum(run, 'data-usd') - (s.usd + s.agentUsd)) < 1e-9, 'the bars add up to the head');
});

test('a stage opens to the events inside its window', () => {
    const { M } = boot();
    const run = section(M.page(session(), DETAIL, { tab: 'timeline' }), 'session-run');
    const build = run.slice(run.indexOf('data-key="rd-build"'));
    assert.ok(build.includes('data-t="commit abc1234 · '));
    assert.ok(build.includes('data-t="派工 · '));
    assert.ok(!run.includes('zzz9999'), 'an event after every stage is in no chain');
    const loading = section(M.page(session(), null, { tab: 'timeline' }), 'session-run');
    assert.ok(loading.includes('讀取細節…'));
});

test('the landed card shows the plan tasks done and not done, opens a dialog, and is left out without a plan', () => {
    const { M } = boot();
    const card = section(M.page(session(), DETAIL, { tab: 'timeline' }), 'session-landed');
    assert.match(card, /class="sl-t" data-t="T1\|Archived plan">T1</);
    assert.match(card, /class="sl-t no" data-t="T2\|Due rule">T2</);
    assert.ok(card.includes('<dialog class="tdlg sl-dlg" id="sl-dlg"'));
    assert.ok(card.includes('data-sl-open="1"'));
    for (const tasks of [[], [{ plan: 'p.md', error: 'no tasks', tasks: [] }]]) {
        assert.ok(!M.page(session(), Object.assign({}, DETAIL, { tasks }), { tab: 'timeline' }).includes('session-landed'));
    }
});

test('派工 and 對話 are drawn by their modules, handed the session', () => {
    const { M, win } = boot();
    const told = [];
    win.FK_SDISP = { html: (s, x) => { told.push(['disp', s.id, x === DETAIL]); return '<i id="sd"></i>'; } };
    win.FK_STALK = { html: (id, held, o) => { told.push(['talk', id, held.total, o.stages.length]); return '<i id="tk"></i>'; } };
    assert.ok(M.page(session(), DETAIL, { tab: 'dispatch' }).includes('<i id="sd"></i>'));
    assert.ok(M.page(session(), DETAIL, { tab: 'talk', talk: { turns: [], total: 0, state: '' } }).includes('<i id="tk"></i>'));
    assert.deepEqual(told, [['disp', SID, true], ['talk', SID, 0, 2]]);
});

test('every string has English, and the classes the page draws have rules in session-page.css', () => {
    const { M } = boot();
    assert.deepEqual(stringsLeft('session-page.js', M.EN), []);
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'session-page.css'), 'utf8');
    for (const name of ['.gt-head', '.sh-viz', '.sv-time', '.sv-cost', '.sv-pips', '.ss-tabs', '.rd-stop', '.rd-seg', '.rd-cost', '.rd-ch',
        '.sl-t', '.sl-dlg', '--dx-fable:#7a4fd0', '--dx-opus:#d9601f', '--dx-sonnet:#7d8798', '--dx-fable:#8a70e6']) {
        assert.ok(css.includes(name), name);
    }
});
```

2. Run it and watch it fail (`ENOENT … session-page.js`):

```
node --test tests/station-session-redesign.test.js
```

3. Write the module.

In `assets/station/session-page.js`:

```js
'use strict';
// assets/station/session-page.js — the session page, #/s/<id> (design
// 2026-10-21-station-redesign §4; mockup route-session.html, blocks
// session-head, session-tabs, session-run, session-landed): the head's task,
// project chip and three bars, the tabs 經過 / 派工 / 對話 with 關卡 only
// while a gate waits, 經過 as one row a stage on two shared scales, and the
// landed card when the session's plan has tasks. 派工 is session-dispatch.js
// and 對話 session-talk.js. Every figure sits in a tooltip (tip.js) on the
// one segment it belongs to. Loaded before station.js, whose router calls page().
(function (w, doc) {
    var EN = {
        'spage.work': 'Working',
        'spage.wait': 'Waiting on you',
        'spage.share': '{p} of it',
        'spage.time': 'Time',
        'spage.cost': 'Cost',
        'spage.disp': 'Dispatch',
        'spage.main': 'Main session',
        'spage.agents': 'Agents',
        'spage.nAgents': '{n} agents',
        'spage.noAgent': 'No agent came back',
        'spage.unnamed': '(unnamed)',
        'spage.live': 'Running',
        'spage.stale': 'May have stopped',
        'spage.down': 'Done',
        'spage.tabs': 'Tabs',
        'spage.tabRun': 'Timeline',
        'spage.tabDisp': 'Dispatch',
        'spage.tabTalk': 'Talk',
        'spage.gate': 'Gate',
        'spage.run': 'Timeline',
        'spage.axis': 'Each stage on one scale',
        'spage.stageCost': 'Cost',
        'spage.rest': 'Other',
        'spage.restWhy': 'Spent outside any timed stage',
        'spage.evOut': 'Dispatched',
        'spage.evGate': 'Question',
        'spage.evCommit': 'commit {sha}',
        'spage.evPass': 'Tests passed',
        'spage.evFail': 'Tests failed',
        'spage.evYou': 'You said',
        'spage.noEvents': 'No events recorded in this stage',
        'spage.loading': 'Reading the detail…',
        'spage.noDetail': 'This machine has no transcript for this session',
        'spage.noStages': 'No stage was timed',
        'spage.landed': 'Landed',
        'spage.allTasks': 'All tasks',
        'spage.done': 'Done',
        'spage.notDone': 'Not done',
        'spage.close': 'Close',
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function fill(s, vars) {
        return vars ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) ? String(vars[k]) : m; }) : s;
    }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return fill(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    function kit() { return (w && w.FK_KIT) || {}; }
    function esc(s) { return kit().esc(s); }
    function num(v) { return typeof v === 'number' && isFinite(v); }
    // A segment's tooltip: one label, at most two values (tip.js). Without
    // tip.js the segment still takes focus and says the same in its title.
    function tip(label, vals) {
        var v = (vals || []).filter(function (x) { return x !== null && x !== undefined && x !== ''; }).map(String).slice(0, 2);
        var T = w && w.FK_TIP;
        return T ? T.attr(String(label), v) : ' tabindex="0" title="' + esc([label].concat(v).join(' · ')) + '"';
    }
    function pct(n, d) { return d > 0 ? Math.round(n / d * 100) + '%' : '0%'; }
    function hm(ms) {
        var d = new Date(ms);
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    function clip(t, n) { var s = String(t || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

    var LETTER = { fable: 'F', opus: 'O', sonnet: 'S', haiku: 'H', other: '?' };
    function fam(model) { var f = kit().family(model); return has(LETTER, f) ? f : 'other'; }

    // The stages the registry timed, in the order entered: the window, the
    // gate waits inside it (`waited`, never more than the window), the rest of
    // it as 做事, and what the stage cost (main and agents together).
    function stagesOf(s) {
        return ((s && s.stages) || []).filter(function (g) { return num(g.from) && num(g.to) && g.to >= g.from; }).map(function (g) {
            var span = g.to - g.from, wait = Math.min(span, num(g.waited) && g.waited > 0 ? g.waited : 0);
            return { stage: g.stage, from: g.from, to: g.to, span: span, wait: wait, work: span - wait, usd: num(g.usd) && g.usd > 0 ? g.usd : 0 };
        });
    }
    function stageOf(stages, t) {
        if (!num(t)) return null;
        for (var i = 0; i < stages.length; i++) if (t >= stages[i].from && t <= stages[i].to) return stages[i].stage;
        return null;
    }
    // When an agent began: its first request, else when its dispatch went out.
    function agentAt(x, r) {
        if (num(r.from)) return r.from;
        var d = x && x.dispatches && num(r.disp) ? x.dispatches[r.disp] : null;
        return d && num(d.out) ? d.out : NaN;
    }
    function detailNote(s) {
        return s.hasDetail ? loc('spage.loading', '讀取細節…') : loc('spage.noDetail', '這台機器上沒有這個 session 的 transcript');
    }

    // ---- the head ----
    function glyph(s) {
        var k = kit(), route = s.route || [], at = route.indexOf(s.stage);
        var state = function (st) { var i = route.indexOf(st); return i < 0 ? null : i < at ? 'done' : i === at ? 'now' : 'todo'; };
        return k.keelGlyph({ cls: 'prog' + (s.state === 'live' && !s.gateAt ? ' live' : ''), seg: function (i) { return state(k.ROUTE[i]); },
            edge: state('land'), c: at >= 0 ? 'var(--st-' + esc(s.stage) + ')' : '' });
    }
    function timeBar(st) {
        var k = kit(), work = 0, wait = 0;
        st.forEach(function (g) { work += g.work; wait += g.wait; });
        var all = work + wait;
        if (!all) return '<span class="sv-bar sv-time none"></span>';
        return '<span class="sv-bar sv-time">'
            + (work ? '<i class="wk" style="flex:' + work + '" data-ms="' + work + '"' + tip(loc('spage.work', '做事'), [k.mins(work), loc('spage.share', '佔 {p}', { p: pct(work, all) })]) + '></i>' : '')
            + (wait ? '<i class="wt" style="flex:' + wait + '" data-ms="' + wait + '"' + tip(loc('spage.wait', '等你回答'), [k.mins(wait), loc('spage.share', '佔 {p}', { p: pct(wait, all) })]) + '></i>' : '')
            + '</span>';
    }
    function costBar(s) {
        var k = kit(), main = s.usd || 0, ag = s.agentUsd || 0, all = main + ag;
        if (!(all > 0)) return '<span class="sv-bar sv-cost none"></span>';
        return '<span class="sv-bar sv-cost">'
            + (main ? '<i class="m" style="flex:' + main + '" data-usd="' + main + '"' + tip(loc('spage.main', '主 session'), [k.usd(main, true), loc('spage.share', '佔 {p}', { p: pct(main, all) })]) + '></i>' : '')
            + (ag ? '<i class="a" style="flex:' + ag + '" data-usd="' + ag + '"' + tip(loc('spage.agents', '派工'), [k.usd(ag, true), loc('spage.share', '佔 {p}', { p: pct(ag, all) })]) + '></i>' : '')
            + '</span>';
    }
    // One pip an agent, grouped by the dispatch that sent it and coloured by
    // model; the group's tooltip spells the models out as letters, so the
    // colour is never alone.
    function pips(x) {
        if (!x || !(x.dispatches || []).length) return '<span class="sv-pips none"></span>';
        var byId = {};
        (x.rows || []).forEach(function (r) { byId[r.id] = r; });
        return '<span class="sv-pips">' + x.dispatches.map(function (d) {
            var rows = (d.ids || []).map(function (id) { return byId[id]; }).filter(Boolean);
            var letters = rows.map(function (r) { return LETTER[fam(r.model)]; }).join('');
            return '<span class="g"' + tip(d.text || d.agentType || d.surface, [rows.length ? loc('spage.nAgents', '{n} 個 agent', { n: rows.length }) : loc('spage.noAgent', '沒有 agent 回來'), letters]) + '>'
                + (rows.length ? rows.map(function (r) { return '<i style="--c:var(--dx-' + fam(r.model) + ')"></i>'; }).join('') : '<i class="none"></i>') + '</span>';
        }).join('') + '</span>';
    }
    function stateChip(s) {
        var t = s.state === 'live' ? loc('spage.live', '執行中') : s.state === 'stale' ? loc('spage.stale', '可能停了') : loc('spage.down', '收工');
        return '<span class="ss-st ' + esc(s.state || 'down') + '">' + t + '</span>';
    }
    function head(s, x, o) {
        var k = kit(), names = o.names || {};
        return '<section class="dcard gt-head" data-block="session-head">' + glyph(s)
            + '<div class="gt-id"><div class="sh-tl"><h1 class="gt-task">' + esc(s.task || loc('spage.unnamed', '（未命名）')) + '</h1>'
            + '<a class="sh-proj" href="' + k.projectHash(s.pkey) + '">' + esc(names[s.pkey] || s.project || s.pkey) + '</a>' + stateChip(s) + '</div></div>'
            + '<div class="sh-viz">'
            + '<div class="sv" data-block="session-head-time"><span class="sv-l">' + loc('spage.time', '時間') + '</span>' + timeBar(stagesOf(s)) + '</div>'
            + '<div class="sv" data-block="session-head-cost"><span class="sv-l">' + loc('spage.cost', '花費') + '</span>' + costBar(s) + '</div>'
            + '<div class="sv" data-block="session-head-dispatch"><a class="sv-l" href="' + k.sessionHash(s.id, 'dispatch') + '">' + loc('spage.disp', '派工') + '</a>' + pips(x) + '</div>'
            + '</div></section>';
    }
    function tabs(s, tab, serve) {
        var k = kit();
        var list = [['timeline', loc('spage.tabRun', '經過')], ['dispatch', loc('spage.tabDisp', '派工')], ['talk', loc('spage.tabTalk', '對話')]];
        var gate = s.gateAt ? '<a class="out" data-block="session-gate-link" href="' + (serve ? '/f/' + encodeURIComponent(s.id) + '/gate' : k.sessionHash(s.id, 'gate')) + '">'
            + k.icon('gate') + loc('spage.gate', '關卡') + '</a>' : '';
        return '<nav class="ss-tabs" data-block="session-tabs" aria-label="' + loc('spage.tabs', '分頁') + '"><div class="subtabs" role="tablist">'
            + list.map(function (t) {
                return '<a href="' + k.sessionHash(s.id, t[0]) + '" role="tab" aria-selected="' + (t[0] === tab ? 'true' : 'false') + '">' + t[1] + '</a>';
            }).join('') + gate + '</div></nav>';
    }

    // ---- 經過 ----
    // What happened inside one stage's window, in order, one mark a thing.
    function chain(g, x) {
        var k = kit();
        var items = (x.events || []).filter(function (e) { return num(e.t) && e.t >= g.from && e.t <= g.to; }).map(function (e) {
            if (e.kind === 'out') return '<li class="ch bot"' + tip(loc('spage.evOut', '派工') + ' · ' + hm(e.t), [e.text, e.agentType || e.alias]) + '>' + k.icon('bot') + '</li>';
            if (e.kind === 'gate') {
                var q = (e.qs || [])[0] || {};
                return '<li class="ch ask"' + tip(loc('spage.evGate', '提問') + ' · ' + hm(e.t), [q.q, q.a]) + '>' + k.icon('gate') + '</li>';
            }
            if (e.kind === 'commit') return '<li class="ch cm"' + tip(loc('spage.evCommit', 'commit {sha}', { sha: e.sha }) + ' · ' + hm(e.t), [e.text]) + '>' + k.icon('commit') + '</li>';
            if (e.kind === 'test') {
                var bad = /fail ([1-9]\d*)/.test(e.text || '');
                return '<li class="ch ' + (bad ? 'bad' : 'ok') + '"' + tip((bad ? loc('spage.evFail', '測試紅') : loc('spage.evPass', '測試綠')) + ' · ' + hm(e.t), [e.text]) + '>' + k.icon(bad ? 'close' : 'check') + '</li>';
            }
            if (e.kind === 'prompt') return '<li class="ch you"' + tip(loc('spage.evYou', '你說') + ' · ' + hm(e.t), [clip(e.text, 120)]) + '><i class="you-dot" aria-hidden="true"></i></li>';
            return '';
        }).join('');
        return items ? '<ol class="rd-ch">' + items + '</ol>' : '<p class="rd-none">' + loc('spage.noEvents', '這站沒有記下的事件') + '</p>';
    }
    // One row a stage: its time on a scale every stage shares, split 做事 /
    // 等你回答, and its cost on a scale every stage shares, split main /
    // agents by where each agent began. What no stage holds is one more row,
    // 其他, so the cost segments add up to the head's total.
    function runCard(s, x) {
        var k = kit(), st = stagesOf(s);
        var top = '<section class="dcard ss-run" data-block="session-run"><div class="dcard-h">' + k.icon('timer') + '<b>' + loc('spage.run', '經過') + '</b>';
        if (!st.length) return top + '</div><p class="tally">' + loc('spage.noStages', '沒有一站有計時') + '</p></section>';
        var by = {};
        if (x) (x.rows || []).forEach(function (r) {
            var at = stageOf(st, agentAt(x, r));
            if (at) by[at] = (by[at] || 0) + (r.usd || 0);
        });
        var staged = st.reduce(function (n, g) { return n + g.usd; }, 0);
        var rest = k.cost(s) - staged;
        var maxT = Math.max.apply(null, st.map(function (g) { return g.span; })) || 1;
        var maxU = Math.max.apply(null, st.map(function (g) { return g.usd; }).concat(rest > 0.005 ? [rest] : [])) || 1;
        var row = function (g) {
            var ag = Math.min(g.usd, by[g.stage] || 0), main = g.usd - ag, name = esc(g.stage);
            var seg = '<span class="rd-bar"><span class="rd-seg" style="--w:' + (g.span / maxT * 100).toFixed(3) + '%">'
                + (g.work ? '<i class="wk" style="flex:' + g.work + '" data-ms="' + g.work + '"' + tip(g.stage + ' · ' + loc('spage.work', '做事'), [k.mins(g.work), loc('spage.share', '佔 {p}', { p: pct(g.work, g.span) })]) + '></i>' : '')
                + (g.wait ? '<i class="wt" style="flex:' + g.wait + '" data-ms="' + g.wait + '"' + tip(g.stage + ' · ' + loc('spage.wait', '等你回答'), [k.mins(g.wait), loc('spage.share', '佔 {p}', { p: pct(g.wait, g.span) })]) + '></i>' : '')
                + '</span></span>';
            var cost = g.usd ? '<span class="rd-cost"><span style="--w:' + (g.usd / maxU * 100).toFixed(3) + '%">'
                + (main ? '<i class="m" style="flex:' + main + '" data-usd="' + main + '"' + tip(g.stage + ' · ' + loc('spage.main', '主 session'), [k.usd(main, true), loc('spage.share', '佔 {p}', { p: pct(main, g.usd) })]) + '></i>' : '')
                + (ag ? '<i class="a" style="flex:' + ag + '" data-usd="' + ag + '"' + tip(g.stage + ' · ' + loc('spage.agents', '派工'), [k.usd(ag, true), loc('spage.share', '佔 {p}', { p: pct(ag, g.usd) })]) + '></i>' : '')
                + '</span></span>' : '<span class="rd-cost none"></span>';
            return '<li><details class="rd-stop" data-key="rd-' + name + '" style="--c:var(--st-' + name + ')"><summary class="rd-h"><span class="rd-dot" aria-hidden="true"></span>'
                + '<b class="rd-nm">' + name + '</b>' + seg + cost + k.icon('chev') + '</summary>'
                + '<div class="rd-b">' + (x ? chain(g, x) : '<p class="rd-none">' + detailNote(s) + '</p>') + '</div></details></li>';
        };
        var other = rest > 0.005 ? '<li class="rd-mark"><span class="rd-dot" aria-hidden="true"></span><span class="rd-nm">' + loc('spage.rest', '其他') + '</span><span class="rd-bar"></span>'
            + '<span class="rd-cost"><span style="--w:' + (rest / maxU * 100).toFixed(3) + '%"><i class="o" style="flex:1" data-usd="' + rest + '"'
            + tip(loc('spage.rest', '其他'), [k.usd(rest, true), loc('spage.restWhy', '花在沒計時的時段')]) + '></i></span></span><span></span></li>' : '';
        return top + '<span class="gt-hr rd-key"><span><i class="wksw" aria-hidden="true"></i>' + loc('spage.work', '做事') + '</span>'
            + '<span><i class="hatchsw" aria-hidden="true"></i>' + loc('spage.wait', '等你回答') + '</span>'
            + '<span><i class="ksw m" aria-hidden="true"></i>' + loc('spage.main', '主 session') + '</span>'
            + '<span><i class="ksw a" aria-hidden="true"></i>' + loc('spage.agents', '派工') + '</span></span></div>'
            + '<div class="rd-axis" aria-hidden="true"><span class="ax">' + loc('spage.axis', '每站時間 · 同一把尺') + '</span><span class="cx">' + loc('spage.stageCost', '花費') + '</span></div>'
            + '<ol class="rd">' + st.map(row).join('') + other + '</ol></section>';
    }

    // ---- what landed ----
    // The newest plan the session claimed that has tasks (`detail.tasksOf`).
    function planOf(x) {
        var ps = ((x && x.tasks) || []).filter(function (p) { return p && !p.error && p.tasks && p.tasks.length; });
        return ps.length ? ps[ps.length - 1] : null;
    }
    function landed(x) {
        var p = planOf(x);
        if (!p) return '';
        var k = kit();
        var done = p.tasks.filter(function (t) { return t.status === 'complete'; });
        var left = p.tasks.filter(function (t) { return t.status !== 'complete'; });
        var chip = function (cls) { return function (t) { return '<span class="sl-t' + cls + '"' + tip('T' + t.n, [t.title]) + '>T' + t.n + '</span>'; }; };
        var list = function (ts) { return '<ol class="sl-l">' + ts.map(function (t) { return '<li><b>T' + t.n + '</b><span>' + esc(t.title) + '</span></li>'; }).join('') + '</ol>'; };
        return '<section class="dcard ss-landed" data-block="session-landed"><div class="dcard-h">' + k.icon('files') + '<b>' + loc('spage.landed', '落地') + '</b>'
            + '<button type="button" class="gt-hr sl-open" data-sl-open="1" aria-haspopup="dialog">' + loc('spage.allTasks', '看全部任務') + '</button></div>'
            + '<div class="sl-chips">' + done.map(chip('')).join('') + left.map(chip(' no')).join('') + '</div>'
            + '<dialog class="tdlg sl-dlg" id="sl-dlg" data-block="session-landed-detail" aria-labelledby="sl-dlg-h"><div class="tdlg-in">'
            + '<div class="tdlg-hd">' + k.icon('files') + '<b id="sl-dlg-h">' + loc('spage.landed', '落地') + '</b><span class="tdlg-sub">' + esc(p.plan) + '</span>'
            + '<button type="button" class="tdlg-x" data-sl-close="1" aria-label="' + loc('spage.close', '關閉') + '">' + k.icon('close') + '</button></div>'
            + '<div class="tdlg-p sl-p"><h3 class="sl-sh ok">' + loc('spage.done', '已完成') + '<span>' + done.length + '</span></h3>' + list(done)
            + '<h3 class="sl-sh no">' + loc('spage.notDone', '未完成') + '<span>' + left.length + '</span></h3>' + list(left) + '</div></div></dialog></section>';
    }
    // The dialog the reader opened stays open through the 3 s redraw, which
    // replaces it: `OPEN` says so and the redraw shows the new one.
    var OPEN = false, heard = false;
    function show() {
        var d = doc && doc.getElementById ? doc.getElementById('sl-dlg') : null;
        if (!d || d.open || typeof d.showModal !== 'function') return;
        d.onclose = function () { OPEN = false; };
        d.showModal();
    }
    function listen() {
        if (heard || !doc || !doc.addEventListener) return;
        heard = true;
        doc.addEventListener('click', function (e) {
            var t = e && e.target && e.target.closest ? e.target : null;
            if (!t) return;
            if (t.closest('[data-sl-open]')) { OPEN = true; show(); return; }
            if (t.closest('[data-sl-close]')) {
                var d = doc.getElementById('sl-dlg');
                if (d && typeof d.close === 'function') d.close();
            }
        });
    }

    function page(s, x, o) {
        o = o || {};
        listen();
        var tab = o.tab === 'dispatch' || o.tab === 'talk' ? o.tab : 'timeline';
        var body;
        if (tab === 'dispatch') body = x && w.FK_SDISP ? w.FK_SDISP.html(s, x) : '<p class="tally">' + detailNote(s) + '</p>';
        else if (tab === 'talk') body = w.FK_STALK ? w.FK_STALK.html(s.id, o.talk, { stages: s.stages, task: s.task }) : '';
        else body = '<div class="ss-grid' + (planOf(x) ? ' with-landed' : '') + '">' + runCard(s, x) + landed(x) + '</div>';
        if (OPEN && tab === 'timeline' && w.setTimeout) w.setTimeout(show, 0);
        return '<div class="ssp" data-block="session-page">' + head(s, x, o) + tabs(s, tab, o.serve) + body + '</div>';
    }

    var api = { page: page, stagesOf: stagesOf, stageOf: stageOf, agentAt: agentAt, fam: fam, LETTER: LETTER, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_SESSION = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
```

4. Write the stylesheet.

In `assets/station/session-page.css`:

```css
/* assets/station/session-page.css — the session page, #/s/<id> (station redesign §4;
   mockup route-session.html, blocks session-head, session-tabs, session-run, session-landed).
   The model colours were validated in the mockup (_sess/r62-dispatch.js): fable violet, opus
   orange, sonnet a neutral slate; every chip also carries its letter. */
:root{--dx-fable:#7a4fd0;--dx-opus:#d9601f;--dx-sonnet:#7d8798;--dx-haiku:var(--m-haiku);--dx-other:var(--m-other);
  --dx-fable-on:#fbfcfc;--dx-opus-on:#10151d;--dx-sonnet-on:#10151d;--dx-haiku-on:var(--ink);--dx-other-on:var(--ink);
  --wait:color-mix(in srgb,var(--ink) 9%,var(--panel)) repeating-linear-gradient(45deg,var(--hatch) 0 1.6px,transparent 1.6px 4.2px)}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--dx-fable:#8a70e6;--dx-opus:#e06a2c;--dx-sonnet:#5e6a80;--dx-fable-on:#10151d;--dx-opus-on:#10151d;--dx-sonnet-on:#f2f4f6}}
:root[data-theme=dark]{--dx-fable:#8a70e6;--dx-opus:#e06a2c;--dx-sonnet:#5e6a80;--dx-fable-on:#10151d;--dx-opus-on:#10151d;--dx-sonnet-on:#f2f4f6}
.ssp{display:flex;flex-direction:column;gap:14px}
.ssp .hatchsw{background:var(--wait)}
.ssp .dcard-h .gt-hr{margin-left:auto;min-width:0}

/* ---- head: which session, then time, cost and dispatch as three bars ---- */
.dcard.gt-head,:root[data-style=keel] .dcard.gt-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"g id viz";
  align-items:center;column-gap:16px;padding:14px 18px}
.gt-head .glyph.prog{grid-area:g;width:40px;height:40px;display:block}
.gt-id{grid-area:id;min-width:0}
.sh-tl{display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px;min-width:0}
.gt-task{margin:0;font-size:18px;font-weight:700;letter-spacing:-.01em;line-height:1.35;color:var(--ink)}
.sh-proj{display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:6px;box-shadow:inset 0 0 0 1px var(--rule2);
  font:600 12px var(--f-mono);color:var(--ink2);text-decoration:none}
.sh-proj:hover{color:var(--ink);background:var(--wash)}
.sh-proj:focus-visible{outline:2px solid var(--keel);outline-offset:2px}
.ss-st{display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:6px;font:600 12px var(--f-ui)}
.ss-st.down{background:var(--pass-tint);color:var(--pass-ink)}
.ss-st.live{background:var(--keel-tint);color:var(--keel-deep)}
.ss-st.stale{background:var(--signal-tint);color:var(--signal-ink)}
.sh-viz{grid-area:viz;display:flex;align-items:stretch}
.sv{display:flex;flex-direction:column;justify-content:center;gap:6px;padding:0 0 0 18px;margin:0 0 0 18px;border-left:1px solid var(--rule)}
.sv:first-child{margin-left:0;padding-left:0;border-left:0}
.sv-l{font-size:12px;color:var(--muted);white-space:nowrap;text-decoration:none}
a.sv-l:hover{color:var(--ink)}
.sv-bar{display:flex;gap:2px;height:12px;border-radius:3px}
.sv-bar i{display:block;min-width:3px;border-radius:2px}
.sv-bar.none{background:var(--inset)}
.sv-time{width:220px}
.sv-time .wk{background:var(--keel)}
.sv-time .wt{background:var(--wait)}
.sv-cost{width:150px}
.sv-cost .m,.rd-cost i.m,.rd-key .ksw.m{background:var(--keel)}
.sv-cost .a,.rd-cost i.a,.rd-key .ksw.a{background:color-mix(in srgb,var(--keel) 42%,var(--panel))}
.sv-pips{display:flex;align-items:center;gap:5px;height:16px;min-width:40px}
.sv-pips .g{display:flex;gap:2px;border-radius:2px}
.sv-pips i{display:block;width:4px;height:14px;border-radius:1px;background:var(--c)}
.sv-pips i.none{width:5px;box-sizing:border-box;background:transparent;box-shadow:inset 0 0 0 1px var(--signal-ink)}
.sv-bar i:hover,.sv-pips .g:hover i{filter:brightness(1.2)}
.sv-bar i:focus-visible,.sv-pips .g:focus-visible{outline:2px solid var(--keel);outline-offset:2px}
@media (max-width:1100px){.dcard.gt-head,:root[data-style=keel] .dcard.gt-head{grid-template-columns:auto minmax(0,1fr);grid-template-areas:"g id" "viz viz";row-gap:12px}}

/* ---- tabs: home's sub-tabs; 關卡 leaves for the gate page ---- */
.ss-tabs{display:flex;align-items:center}
.ss-tabs .subtabs{margin:0}
:root[data-style=keel] .ss-tabs .subtabs{background:var(--panel);box-shadow:inset 0 0 0 1px var(--rule)}
.ss-tabs .subtabs a{display:inline-flex;align-items:center;gap:6px;min-height:22px}
.ss-tabs .subtabs a .ico{width:14px;height:14px}
:root[data-style=keel] .ss-tabs .subtabs a[aria-selected="true"]{background:var(--keel-tint);color:var(--keel-deep);box-shadow:inset 0 -2.5px 0 var(--keel);border-radius:6px 6px 2px 2px}
.ss-tabs .subtabs a.out{color:var(--signal-ink)}
.ss-tabs .subtabs a:focus-visible{outline:2px solid var(--keel);outline-offset:1px}

/* ---- 經過: one row a stage, time and cost each on one scale ---- */
.ss-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;align-items:start}
.ss-grid.with-landed{grid-template-columns:minmax(0,1fr) 320px}
@media (max-width:1180px){.ss-grid.with-landed{grid-template-columns:minmax(0,1fr)}}
.rd-key{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:4px 12px;font-size:12px;font-weight:400;color:var(--muted)}
.rd-key>span{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.rd-key .wksw{display:inline-block;width:14px;height:10px;border-radius:2px;background:linear-gradient(90deg,var(--st-survey) 0 33%,var(--st-build) 33% 67%,var(--st-land) 67%)}
.rd-key .hatchsw{width:14px}
.rd-key .ksw{display:inline-block;width:10px;height:10px;border-radius:2px}
.ss-run{--rd-cols:14px 72px minmax(0,1fr) 112px 16px}
.rd-axis,.rd-h,.rd-mark,.rd-b{display:grid;grid-template-columns:var(--rd-cols);column-gap:10px;align-items:center}
.rd-axis{padding:12px 0 4px;font-size:12px;color:var(--muted)}
.rd-axis .ax{grid-column:3}
.rd-axis .cx{grid-column:4}
.rd{list-style:none;margin:0;padding:0}
.rd>li{position:relative}
.rd>li::before{content:"";position:absolute;left:6px;top:0;bottom:0;width:2px;background:var(--rule2)}
.rd>li:first-child::before{top:50%}
.rd>li:last-child::before{bottom:50%}
.rd>li+li{border-top:1px solid var(--rule)}
.rd-dot{grid-column:1;justify-self:center;position:relative;width:12px;height:12px;border-radius:50%;background:var(--c);box-shadow:0 0 0 3px var(--panel)}
.rd-nm{grid-column:2;justify-self:start;font:700 13.5px/22px var(--f-mono);color:var(--ink);white-space:nowrap}
.rd-mark{min-height:40px}
.rd-mark .rd-dot{width:8px;height:8px;background:var(--panel);box-shadow:0 0 0 3px var(--panel),inset 0 0 0 1.5px var(--faint)}
.rd-mark .rd-nm{font:500 12.5px/22px var(--f-ui);color:var(--muted)}
.rd-stop>summary{list-style:none;cursor:pointer;border-radius:6px;min-height:50px}
.rd-stop>summary::-webkit-details-marker{display:none}
.rd-stop>summary:hover{background:var(--wash)}
.rd-stop>summary:focus-visible{outline:2px solid var(--keel);outline-offset:-2px}
.rd-bar{grid-column:3;display:flex;align-items:center;min-width:0;height:22px}
.rd-seg{display:flex;gap:2px;flex:none;width:var(--w);min-width:3px;height:14px}
.rd-seg i{display:block;min-width:3px;border-radius:2px}
.rd-seg .wk{background:var(--c)}
.rd-seg .wt{background:var(--wait)}
.rd-cost{grid-column:4;display:block;height:10px}
.rd-cost>span{display:flex;gap:2px;width:var(--w);min-width:3px;height:100%}
.rd-cost i{display:block;min-width:3px;border-radius:2px}
.rd-cost i.o{background:var(--faint)}
.rd-seg i:hover,.rd-cost i:hover{filter:brightness(1.18);box-shadow:0 0 0 1.5px var(--ink2)}
.rd-seg i:focus-visible,.rd-cost i:focus-visible,.ch:focus-visible,.sl-t:focus-visible{outline:2px solid var(--keel);outline-offset:2px}
.rd-h>.ico{grid-column:5;width:16px;height:16px;color:var(--muted);transition:transform .18s cubic-bezier(.16,1,.3,1)}
.rd-stop[open] .rd-h>.ico{transform:rotate(90deg)}
.rd-b{align-items:start;padding:0 0 10px}
.rd-ch{grid-column:3/5;display:flex;flex-wrap:wrap;align-items:center;gap:2px;margin:0;padding:0;list-style:none}
.rd-none{grid-column:3/5;margin:0;font-size:12px;color:var(--muted)}
.ch{display:inline-flex;align-items:center;justify-content:center;height:24px;min-width:22px;padding:0 3px;box-sizing:border-box;border-radius:5px;color:var(--ink2)}
.ch .ico{width:14px;height:14px}
.ch:hover{background:var(--wash)}
.ch.cm{color:var(--muted)}
.ch.ok{color:var(--pass-ink)}
.ch.bad{color:var(--fail-ink)}
.ch.ask,.ch.you{color:var(--keel)}
.ch .you-dot{width:8px;height:8px;border-radius:50%;background:currentColor}
@media (prefers-reduced-motion:reduce){.rd-h>.ico{transition:none}}
@media (max-width:720px){.ss-run{--rd-cols:14px 64px minmax(0,1fr) 16px}.rd-cost,.rd-axis .cx{display:none}.rd-h>.ico{grid-column:4}.rd-ch,.rd-none{grid-column:2/4}}

/* ---- what landed: done chips filled, not-done hollow; the dialog lists them ---- */
.sl-open{height:28px;padding:0 10px;border:0;border-radius:7px;background:transparent;box-shadow:inset 0 0 0 1px var(--rule2);font:600 12px var(--f-ui);color:var(--ink2);cursor:pointer}
.sl-open:hover{color:var(--ink);background:var(--wash)}
.sl-open:focus-visible{outline:2px solid var(--keel);outline-offset:2px}
.sl-chips{display:flex;flex-wrap:wrap;gap:4px;padding:12px 0 0}
.sl-t{display:inline-flex;align-items:center;height:24px;padding:0 7px;border-radius:6px;background:var(--pass-tint);font:700 12px var(--f-mono);color:var(--pass-ink)}
.sl-t.no{background:transparent;box-shadow:inset 0 0 0 1.5px var(--signal-ink);color:var(--signal-ink)}
.tdlg.sl-dlg{width:min(720px,calc(100vw - 32px));height:fit-content;max-height:calc(100vh - 48px)}
.sl-dlg .tdlg-in{height:auto;max-height:calc(100vh - 48px)}
.sl-dlg .tdlg-hd>.ico{width:16px;height:16px;color:var(--st-land)}
.sl-sh{display:flex;align-items:center;gap:8px;margin:14px 0 4px;font:600 13.5px var(--f-ui)}
.sl-sh span{font:600 12px var(--f-mono);color:var(--muted)}
.sl-sh.ok{color:var(--pass-ink)}
.sl-sh.no{color:var(--signal-ink)}
.sl-l{list-style:none;margin:0;padding:0}
.sl-l li{display:grid;grid-template-columns:44px minmax(0,1fr);column-gap:10px;align-items:center;min-height:36px;border-top:1px solid var(--rule);font-size:13px;color:var(--ink)}
.sl-l b{font:700 12px var(--f-mono);color:var(--ink2)}
```

5. Run it again and watch it pass:

```
node --test tests/station-session-redesign.test.js
```

6. Commit: `git add assets/station/session-page.js assets/station/session-page.css tests/station-session-redesign.test.js` and `git commit -m "feat: session page head, timeline and landed card"` with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer.

## Task 12: Session page 派工 tab (§4)

**Files:**
- Modify: `assets/station/session-dispatch.js` — new: `FK_SDISP`, the 派工 tab: one strip a stage with one chip an agent, then one row a dispatch
- Modify: `assets/station/session-dispatch.css` — new: the strip, chips, badges and the two shared-scale bars, ported from `_sess/r62-dispatch.js`'s CSS
- Read: `.fankeel/build/2026-10-21-station-redesign/_sess/r62-dispatch.js` — the tab's markup and CSS; its insight sentence, the per-dispatch `note` and its reconciliation against `r59-data.js` are mockup data and are not ported
- Read: `tests/station-module.js` — `page(names, station)` and `stringsLeft(name, EN)`
- Test: `tests/station-dispatch-redesign.test.js`

**Interfaces:**
- Consumes: Task 11's `window.FK_SESSION` — `stagesOf(s)`, `stageOf(stages, t)`, `agentAt(x, row)`, `fam(model)`, `LETTER`, and its CSS properties `--dx-<model>` / `--dx-<model>-on`; Task 3's `window.FK_KIT` — `esc`, `usd(n, plain)`, `mins(ms)`, `modelKey`, `modelLabel`, `icon`; Task 6's `window.FK_TIP.attr(label, values)` (optional). The detail: `x.dispatches[] = { text, agentType, surface, out, ids[] }` and `x.rows[] = { id, model, usd, durMs, from, disp }` (`lib/usage.js` `dispatchesOf`, `lib/detail.js:783`).
- Produces: `window.FK_SDISP` and `module.exports`, `{ html, EN }`: `html(s, x) -> string`, the `<section data-block="session-dispatch">` Task 11's page puts under the 派工 tab.

**Dispatch:** implementer, opus

1. Write the failing test.

In `tests/station-dispatch-redesign.test.js`:

```js
'use strict';
// The session page's 派工 tab (assets/station/session-dispatch.js; design
// 2026-10-21-station-redesign §4): a strip a stage with a chip an agent sized
// by cost and coloured by model with its letter, then a row a dispatch whose
// duration and cost bars share one scale each.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page, stringsLeft } = require('./station-module.js');

const MIN = 60e3;
const T0 = Date.parse('2026-10-20T10:00:00.000Z');
const SID = 'bbbbbbbb-2222-4222-8222-222222222222';
const S1 = { id: SID, task: 'dispatch', state: 'down', stage: 'build', route: ['survey', 'build'], usd: 4, agentUsd: 2.25,
    stages: [{ stage: 'survey', from: T0, to: T0 + 10 * MIN, usd: 1, waited: null }, { stage: 'build', from: T0 + 10 * MIN, to: T0 + 70 * MIN, usd: 4, waited: null }] };
function detail(extra) {
    return Object.assign({
        rows: [{ id: 'a1', model: 'claude-sonnet-4-5', usd: 1.5, durMs: 5 * MIN, from: T0 + 15 * MIN, disp: 0, label: 'Task 1' },
            { id: 'a2', model: 'claude-opus-4-1', usd: 0.5, durMs: 2 * MIN, from: T0 + 5 * MIN, disp: 1, label: 'reader' },
            { id: 'a3', model: 'claude-fable-5', usd: 0.25, durMs: 1 * MIN, from: T0 + 90 * MIN, disp: 2, label: 'judge' }],
        dispatches: [{ text: 'build task 1', agentType: 'fankeel-implementer', surface: 'agent', out: T0 + 14 * MIN, ids: ['a1'] },
            { text: 'survey reader', agentType: 'fankeel-reader', surface: 'agent', out: T0 + 4 * MIN, ids: ['a2'] },
            { text: 'ask the judge', agentType: 'fankeel-judge', surface: 'agent', out: T0 + 89 * MIN, ids: ['a3'] },
            { text: 'lost', agentType: 'fankeel-reader', surface: 'agent', out: T0 + 20 * MIN, ids: [] }],
    }, extra);
}
function boot() {
    const p = page(['session-page.js', 'session-dispatch.js'], { sessions: [S1] });
    const tips = [];
    p.win.FK_TIP = { attr(label, vals) { tips.push([label, vals]); return ' data-t="' + label + '|' + vals.join('|') + '"'; } };
    return { D: p.M['session-dispatch.js'], tips };
}

test('the strip has a group a stage, a chip an agent coloured by model with its letter, and the chips add up to the agents', () => {
    const { D } = boot();
    const html = D.html(S1, detail());
    const strip = html.slice(html.indexOf('class="dx-strip"'), html.indexOf('class="dx-lh"'));
    assert.match(strip, /class="dx-g" style="--c:var\(--st-survey\)[^"]*"[\s\S]*class="dx-c opus"[^>]*><b>O<\/b>/);
    assert.match(strip, /class="dx-g" style="--c:var\(--st-build\)[^"]*"[\s\S]*class="dx-c sonnet"[^>]*><b>S<\/b>/);
    assert.match(strip, /--c:var\(--st-none\)[\s\S]*class="dx-c fable"[^>]*><b>F<\/b>/, 'an agent outside every stage');
    assert.ok(strip.includes('>不在任何一站<'));
    const sum = [...strip.matchAll(/data-usd="([0-9.]+)"/g)].reduce((n, m) => n + Number(m[1]), 0);
    assert.ok(Math.abs(sum - 2.25) < 1e-9, String(sum));
});

test('one row a dispatch; duration and cost each share one scale, the widest at 100%', () => {
    const { D } = boot();
    const list = D.html(S1, detail());
    const rows = list.slice(list.indexOf('class="dx-l"'));
    assert.equal((rows.match(/<li class="dx-r"/g) || []).length, 4);
    assert.match(rows, /class="dx-bar dx-dur"><i class="sonnet" style="width:100\.000%"/);
    assert.match(rows, /class="dx-bar dx-dur"><i class="opus" style="width:40\.000%"/);
    assert.match(rows, /class="dx-bar dx-usd"><i class="sonnet" style="width:100\.000%"/);
    assert.match(rows, /class="dx-bar dx-usd"><i class="opus" style="width:33\.333%"/);
    assert.match(rows, /class="dx-b none"[^>]*>–<\/i>/, 'a dispatch no agent came back from');
});

test('the key names each model present with its letter; every tooltip has at most two values', () => {
    const { D, tips } = boot();
    const html = D.html(S1, detail());
    const key = html.slice(html.indexOf('data-block="session-dispatch-key"'), html.indexOf('class="dx-strip"'));
    for (const [m, l] of [['fable', 'F'], ['opus', 'O'], ['sonnet', 'S']]) assert.ok(key.includes('<i class="dx-b ' + m + '">' + l + '</i>' + m), m);
    for (const [label, v] of tips) assert.ok(v.length <= 2, label);
});

test('a session that sent nothing says so', () => {
    const { D } = boot();
    assert.ok(D.html(S1, detail({ dispatches: [], rows: [] })).includes('這個 session 沒有派工'));
});

test('every string has English, and the classes have rules in session-dispatch.css', () => {
    const { D } = boot();
    assert.deepEqual(stringsLeft('session-dispatch.js', D.EN), []);
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'session-dispatch.css'), 'utf8');
    for (const name of ['.dx-strip', '.dx-g', '.dx-c', '.dx-b', '.dx-r', '.dx-bar', '.dx-key', '.dx .fable', '.dx .opus', '.dx .sonnet']) assert.ok(css.includes(name), name);
});
```

2. Run it and watch it fail (`ENOENT … session-dispatch.js`):

```
node --test tests/station-dispatch-redesign.test.js
```

3. Write the module.

In `assets/station/session-dispatch.js`:

```js
'use strict';
// assets/station/session-dispatch.js — the session page's 派工 tab (design
// 2026-10-21-station-redesign §4; mockup route-session.html, the dispatch
// view drawn by _sess/r62-dispatch.js): one strip a stage, one chip an agent
// sized by what it cost and coloured by model with the model's letter, then
// one row a dispatch whose duration and cost bars share one scale each. An
// agent belongs to the stage its first request fell in, the same rule the
// 經過 tab splits a stage's cost by (session-page.js `agentAt`). Loaded
// before station.js; session-page.js calls html().
(function (w, doc) {
    var EN = {
        'sdisp.title': 'Dispatch',
        'sdisp.q': 'Who this session sent, and where the money went',
        'sdisp.none': 'This session dispatched nothing',
        'sdisp.other': 'Outside any stage',
        'sdisp.nSent': '{d} dispatches · {n} agents',
        'sdisp.nAgents': '{n} agents',
        'sdisp.share': '{p} of dispatch',
        'sdisp.strip': 'Agents each stage sent, width is cost',
        'sdisp.list': 'Dispatches, one row each',
        'sdisp.colName': 'Dispatch',
        'sdisp.colRole': 'Role',
        'sdisp.colModel': 'model',
        'sdisp.colTime': 'How long',
        'sdisp.colCost': 'Cost',
        'sdisp.noAgent': 'No agent came back',
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function fill(s, vars) {
        return vars ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) ? String(vars[k]) : m; }) : s;
    }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return fill(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    function kit() { return (w && w.FK_KIT) || {}; }
    function esc(s) { return kit().esc(s); }
    function tip(label, vals) {
        var v = (vals || []).filter(function (x) { return x !== null && x !== undefined && x !== ''; }).map(String).slice(0, 2);
        var T = w && w.FK_TIP;
        return T ? T.attr(String(label), v) : ' tabindex="0" title="' + esc([label].concat(v).join(' · ')) + '"';
    }
    function pct(n, d) { return d > 0 ? Math.round(n / d * 100) + '%' : '0%'; }
    function total(list, f) { return list.reduce(function (n, x) { return n + (f(x) || 0); }, 0); }
    var FAMS = ['fable', 'opus', 'sonnet', 'haiku', 'other'];

    function html(s, x) {
        var k = kit(), F = w.FK_SESSION, st = F.stagesOf(s);
        var top = '<section class="dcard dx" data-block="session-dispatch"><div class="dcard-h">' + k.icon('bot') + '<b>' + loc('sdisp.title', '派工') + '</b>'
            + '<h2 class="dx-q">' + loc('sdisp.q', '這個 session 派了誰、花在哪') + '</h2>';
        var ds = (x && x.dispatches) || [];
        if (!ds.length) return top + '</div><p class="tally">' + loc('sdisp.none', '這個 session 沒有派工') + '</p></section>';
        var byId = {};
        ((x && x.rows) || []).forEach(function (r) { byId[r.id] = r; });
        var sent = ds.map(function (d, i) {
            var rows = (d.ids || []).map(function (id) { return byId[id]; }).filter(Boolean);
            return { d: d, i: i, rows: rows, stage: F.stageOf(st, d.out) || 'none', usd: total(rows, function (r) { return r.usd; }), dur: total(rows, function (r) { return r.durMs; }) };
        });
        var agents = [];
        sent.forEach(function (e) {
            e.rows.forEach(function (r) { agents.push({ r: r, e: e, m: F.fam(r.model), stage: F.stageOf(st, F.agentAt(x, r)) || 'none' }); });
        });
        var all = total(agents, function (a) { return a.r.usd; });
        var nameOf = function (r) { return r.label || r.agentType || String(r.id).slice(0, 8); };
        var modelOf = function (r) { return k.modelLabel(k.modelKey(r.model)); };

        // ---- the key: each model present, its letter, its agents and cost ----
        var key = '<span class="gt-hr rd-key dx-key" data-block="session-dispatch-key">' + FAMS.filter(function (m) {
            return agents.some(function (a) { return a.m === m; });
        }).map(function (m) {
            var xs = agents.filter(function (a) { return a.m === m; }), u = total(xs, function (a) { return a.r.usd; });
            return '<span class="kk"' + tip(m, [loc('sdisp.nAgents', '{n} 個 agent', { n: xs.length }), k.usd(u, true) + ' · ' + loc('sdisp.share', '佔派工 {p}', { p: pct(u, all) })]) + '>'
                + '<i class="dx-b ' + m + '">' + F.LETTER[m] + '</i>' + m + '</span>';
        }).join('') + '</span>';

        // ---- the strip: a group a stage, a chip an agent, width = cost ----
        var chip = function (a) {
            var u = a.r.usd || 0;
            return '<i class="dx-c ' + a.m + '" style="flex:' + Math.max(u, 0.001) + ' 1 0" data-usd="' + u + '"'
                + tip(nameOf(a.r), [modelOf(a.r), k.usd(u, true) + ' · ' + k.mins(a.r.durMs)]) + '><b>' + F.LETTER[a.m] + '</b></i>';
        };
        var keys = st.map(function (g) { return g.stage; }).concat(['none']).filter(function (key, i, list) {
            return list.indexOf(key) === i && agents.some(function (a) { return a.stage === key; });
        });
        var group = function (key) {
            var as = agents.filter(function (a) { return a.stage === key; }), u = total(as, function (a) { return a.r.usd; });
            var n = as.map(function (a) { return a.e.i; }).filter(function (v, i, l) { return l.indexOf(v) === i; }).length;
            var name = key === 'none' ? loc('sdisp.other', '不在任何一站') : esc(key);
            return '<div class="dx-g" style="--c:var(--st-' + esc(key) + ');flex:' + Math.max(u, 0.001) + ' 1 0">'
                + '<span class="dx-gl"' + tip(name, [loc('sdisp.nSent', '派 {d} 次 · {n} 個 agent', { d: n, n: as.length }), k.usd(u, true) + ' · ' + loc('sdisp.share', '佔派工 {p}', { p: pct(u, all) })]) + '><i></i>' + name + '</span>'
                + '<span class="dx-gc">' + as.map(chip).join('') + '</span></div>';
        };

        // ---- the list: a row a dispatch; time and money each on one scale ----
        var maxD = Math.max.apply(null, sent.map(function (e) { return e.dur; })) || 1;
        var maxU = Math.max.apply(null, sent.map(function (e) { return e.usd; })) || 1;
        var row = function (e) {
            var label = e.d.text || e.d.agentType || e.d.surface || '';
            var badges = e.rows.length ? FAMS.filter(function (m) { return e.rows.some(function (r) { return F.fam(r.model) === m; }); }).map(function (m) {
                var xs = e.rows.filter(function (r) { return F.fam(r.model) === m; });
                return '<i class="dx-b ' + m + '"' + tip(m + ' · ' + label, [loc('sdisp.nAgents', '{n} 個 agent', { n: xs.length }), k.usd(total(xs, function (r) { return r.usd; }), true)]) + '>' + F.LETTER[m] + '</i>';
            }).join('') : '<i class="dx-b none"' + tip(label, [loc('sdisp.noAgent', '沒有 agent 回來')]) + '>–</i>';
            var segs = function (f, max, fmt) {
                return e.rows.map(function (r) {
                    return '<i class="' + F.fam(r.model) + '" style="width:' + ((f(r) || 0) / max * 100).toFixed(3) + '%"' + tip(nameOf(r), [modelOf(r), fmt(r)]) + '></i>';
                }).join('');
            };
            return '<li class="dx-r" style="--c:var(--st-' + esc(e.stage) + ')"><span class="dx-n"><i></i><span>' + esc(label) + '</span></span>'
                + '<span class="dx-role">' + esc(e.d.agentType || e.d.surface || '') + '</span><span class="dx-ms">' + badges + '</span>'
                + '<span class="dx-bar dx-dur">' + segs(function (r) { return r.durMs; }, maxD, function (r) { return k.mins(r.durMs); }) + '</span>'
                + '<span class="dx-bar dx-usd">' + segs(function (r) { return r.usd; }, maxU, function (r) { return k.usd(r.usd, true); }) + '</span></li>';
        };
        return top + key + '</div>'
            + '<div class="dx-strip" role="group" aria-label="' + loc('sdisp.strip', '各站派出的 agent，寬度是花費') + '">' + keys.map(group).join('') + '</div>'
            + '<div class="dx-lh" aria-hidden="true"><span>' + loc('sdisp.colName', '派工') + '</span><span>' + loc('sdisp.colRole', '角色') + '</span><span>'
            + loc('sdisp.colModel', 'model') + '</span><span>' + loc('sdisp.colTime', '做了多久') + '</span><span>' + loc('sdisp.colCost', '花多少') + '</span></div>'
            + '<ol class="dx-l" aria-label="' + loc('sdisp.list', '派工，一列一次') + '">' + sent.map(row).join('') + '</ol></section>';
    }

    var api = { html: html, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_SDISP = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
```

4. Write the stylesheet.

In `assets/station/session-dispatch.css`:

```css
/* assets/station/session-dispatch.css — the session page's 派工 tab (station redesign §4;
   mockup _sess/r62-dispatch.js). Model colours are session-page.css's --dx-* properties. */
.dx{display:flex;flex-direction:column}
.dx .fable{--m:var(--dx-fable);--on:var(--dx-fable-on)}
.dx .opus{--m:var(--dx-opus);--on:var(--dx-opus-on)}
.dx .sonnet{--m:var(--dx-sonnet);--on:var(--dx-sonnet-on)}
.dx .haiku{--m:var(--dx-haiku);--on:var(--dx-haiku-on)}
.dx .other{--m:var(--dx-other);--on:var(--dx-other-on)}
.dx-q{margin:0 0 0 14px;padding-left:14px;border-left:1px solid var(--rule);font:600 15px/1.3 var(--f-ui);color:var(--ink)}
.dx-key{margin-left:auto;display:flex;flex-wrap:wrap;gap:4px 12px}
.dx-key .kk{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--ink2);border-radius:4px}
.dx-b{display:inline-grid;place-items:center;flex:none;width:18px;height:18px;border-radius:4px;background:var(--m);color:var(--on);font:700 11px/1 var(--f-mono);font-style:normal}
.dx-b.none{background:transparent;box-shadow:inset 0 0 0 1.5px var(--rule2);color:var(--muted)}
.dx-strip{display:flex;gap:14px;margin-top:12px;padding-bottom:10px;border-bottom:1px solid var(--rule)}
.dx-g{display:flex;flex-direction:column;gap:6px;min-width:0}
.dx-gl{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;max-width:100%;font-size:12.5px;font-weight:600;color:var(--ink);white-space:nowrap;border-radius:4px}
.dx-gl>i{flex:none;width:8px;height:8px;border-radius:2px;background:var(--c)}
.dx-gc{display:flex;gap:2px;height:30px;box-shadow:inset 0 -3px 0 -1px var(--c)}
.dx-c{display:grid;place-items:center;min-width:2px;height:24px;border-radius:3px;background:var(--m);overflow:hidden;font-style:normal}
.dx-c b{font:700 11px/1 var(--f-mono);color:var(--on)}
.dx-c:hover,.dx-bar i:hover,.dx-b:hover{filter:brightness(1.12)}
.dx-lh,.dx-r{display:grid;grid-template-columns:minmax(0,250px) 140px 72px minmax(0,1fr) minmax(0,1fr);column-gap:18px;align-items:center}
.dx-lh{padding:8px 0 4px;font-size:12px;color:var(--muted)}
.dx-l{list-style:none;margin:0;padding:0}
.dx-r{min-height:28px;border-top:1px solid var(--rule)}
.dx-r:hover{background:var(--wash)}
.dx-n{display:flex;align-items:center;gap:8px;min-width:0;font-size:12.5px;color:var(--ink)}
.dx-n>i{flex:none;width:8px;height:8px;border-radius:2px;background:var(--c)}
.dx-n>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dx-role{font:12px var(--f-mono);color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dx-ms{display:flex;gap:4px}
.dx-bar{display:flex;gap:1px;height:12px}
.dx-bar i{display:block;flex:none;min-width:2px;height:100%;border-radius:2px;background:var(--m)}
.dx [tabindex]:focus-visible{outline:2px solid var(--keel);outline-offset:2px}
@media (max-width:999px){.dx-lh,.dx-r{grid-template-columns:minmax(0,170px) 100px 64px minmax(0,1fr) minmax(0,1fr);column-gap:12px}.dx-q{font-size:14px}}
```

5. Run it again and watch it pass:

```
node --test tests/station-dispatch-redesign.test.js
```

6. Commit: `git add assets/station/session-dispatch.js assets/station/session-dispatch.css tests/station-dispatch-redesign.test.js` and `git commit -m "feat: session page dispatch tab"` with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer.

## Task 13: Session page 對話 tab and the 專注 dialog (§4)

**Files:**
- Modify: `assets/station/session-talk.js` — new: `FK_STALK`, the 對話 tab over the turns `station/talk/<id>` returns: every item expandable, 全部展開 / 收起, the 專注 dialog with j / k / o / Esc
- Modify: `assets/station/session-talk.css` — new: the reading column and the full-viewport dialog, ported from `_sess/r58-chat.css`
- Read: `.fankeel/build/2026-10-21-station-redesign/_sess/r58-chat.css` — rules to port (`.tx-*`, `.txf-*`); its activity strip, flags and tool-call lines are not ported (the talk route returns turns, not tool calls)
- Read: `.fankeel/build/2026-10-21-station-redesign/_sess/r61-chat-run.js` — how the mockup's 專注 view moves its cursor
- Read: `assets/station/station.js:1370-1490` — `talkHtml`'s states (`missing`, `static`, `loading`, `failed`) and the `data-talk` load-more button `talkLoad` listens for; not changed
- Read: `tests/station-module.js` — `page(names, station)` and `stringsLeft(name, EN)`
- Test: `tests/station-talk-redesign.test.js`

**Interfaces:**
- Consumes: Task 3's `window.FK_KIT` — `esc`, `tokens(n)`, `icon(name)`; the held talk page station.js keeps per session, `{ turns: [{ kind: 'user'|'claude'|'interrupt'|'compact'|'summary', at: iso, text, trigger, preTokens }], total, state }` (`assets/station/station.js:3915-3950`, `lib/conversation.js`).
- Produces: `window.FK_STALK` and `module.exports`, `{ html, step, EN }`:
  - `html(id, held, o) -> string` — `o = { stages: s.stages, task: s.task }`, optional; the `<section data-block="session-talk">` with the `<dialog id="stalk-focus">`, or the state note when there are no turns.
  - `step(cur, n, key) -> number` — the 專注 cursor after `j` or `k`, held inside `0 … n-1`.

**Dispatch:** implementer, opus

1. Write the failing test.

In `tests/station-talk-redesign.test.js`:

```js
'use strict';
// The session page's 對話 tab (assets/station/session-talk.js; design
// 2026-10-21-station-redesign §4): the turns the station already loads, each
// one expandable, a stage rule where a stage began, 全部展開 / 收起, the
// load-more button station.js's talkLoad answers, the 專注 dialog with j / k
// / o / Esc, and the states a page with no turns can be in.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page, stringsLeft } = require('./station-module.js');

const MIN = 60e3;
const T0 = Date.parse('2026-10-20T10:00:00.000Z');
const at = (m) => new Date(T0 + m * MIN).toISOString();
const ID = 'cccccccc-3333-4333-8333-333333333333';
const HELD = { total: 7, state: '', turns: [
    { kind: 'user', at: at(1), text: 'look at the plan' },
    { kind: 'claude', at: at(2), text: 'Read it.\nTwo tasks.' },
    { kind: 'compact', at: at(12), trigger: 'auto', preTokens: 317000 },
    { kind: 'summary', at: at(12), text: 'Summary of what came before' },
    { kind: 'interrupt', at: at(13), text: '[Request interrupted by user]' }] };
const STAGES = [{ stage: 'survey', from: T0, to: T0 + 10 * MIN }, { stage: 'build', from: T0 + 10 * MIN, to: T0 + 70 * MIN }];
const T = () => page(['session-talk.js']).M['session-talk.js'];
const tab = (html) => html.slice(0, html.indexOf('<dialog'));

test('every turn is an expandable item, a compaction carries its summary, and a stage rule marks where a stage began', () => {
    const html = tab(T().html(ID, HELD, { stages: STAGES, task: 'talk' }));
    const items = html.match(/<details class="tx-it [^"]*" data-key="tk-\d+"/g) || [];
    assert.deepEqual(items.map((s) => /class="tx-it tx-(u|a|cut|n)"/.exec(s)[1]), ['u', 'a', 'cut', 'n']);
    assert.ok(html.includes('Summary of what came before'), 'the summary is the compaction\'s body');
    assert.ok(html.includes('317k'));
    assert.ok(html.indexOf('--st-survey') < html.indexOf('look at the plan'));
    assert.ok(html.indexOf('look at the plan') < html.indexOf('--st-build'));
    assert.ok(html.indexOf('--st-build') < html.indexOf('317k'));
});

test('全部展開 and 專注 sit on the head; more turns load through data-talk', () => {
    const html = tab(T().html(ID, HELD, {}));
    assert.ok(html.includes('data-stalk-all="1" aria-pressed="false">全部展開</button>'));
    assert.ok(html.includes('data-stalk-focus="1"'));
    assert.ok(html.includes('data-talk="' + ID + '"'));
    assert.ok(html.includes('再載入 100 輪'));
    assert.ok(html.includes('已顯示 5 / 7 輪'));
    const all = T().html(ID, Object.assign({}, HELD, { total: 5 }), {});
    assert.ok(!all.includes('再載入'), 'nothing left to load');
});

test('the 專注 dialog repeats the items with the cursor on the first, and names j, k, o and Esc', () => {
    const html = T().html(ID, HELD, { task: 'talk' });
    const dlg = html.slice(html.indexOf('<dialog'));
    assert.ok(dlg.startsWith('<dialog class="tdlg txf" id="stalk-focus"'));
    assert.equal((dlg.match(/txf-it/g) || []).length, 4);
    assert.match(dlg, /class="tx-it tx-u txf-it is-cur" data-key="fk-0"/);
    for (const k of ['<kbd>j</kbd>', '<kbd>k</kbd>', '<kbd>o</kbd>', '<kbd>Esc</kbd>']) assert.ok(dlg.includes(k), k);
});

test('j and k move the cursor one item and stop at either end', () => {
    const { step } = T();
    assert.equal(step(0, 4, 'j'), 1);
    assert.equal(step(3, 4, 'j'), 3);
    assert.equal(step(2, 4, 'k'), 1);
    assert.equal(step(0, 4, 'k'), 0);
    assert.equal(step(2, 4, 'o'), 2);
    assert.equal(step(5, 0, 'j'), 0);
});

test('a page with no turns says why: missing, static, loading, failed, empty', () => {
    const M = T();
    assert.ok(M.html(ID, { turns: [], total: null, state: 'missing' }).includes('這台機器上已經沒有這個 session 的 transcript'));
    assert.ok(M.html(ID, { turns: [], total: null, state: 'static' }).includes('要從 serve 開的頁面才讀得到對話'));
    assert.ok(M.html(ID, { turns: [], total: null, state: 'loading' }).includes('讀取中…'));
    const failed = M.html(ID, { turns: [], total: null, state: 'failed' });
    assert.ok(failed.includes('讀不到對話') && failed.includes('data-talk="' + ID + '"'));
    assert.ok(M.html(ID, { turns: [], total: 0, state: '' }).includes('transcript 裡沒有可列的對話'));
    assert.ok(M.html(ID, undefined).includes('讀取中…'));
});

test('every string has English, and the classes have rules in session-talk.css', () => {
    const M = T();
    assert.deepEqual(stringsLeft('session-talk.js', M.EN), []);
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'session-talk.css'), 'utf8');
    for (const name of ['.tx-it', '.tx-u', '.tx-a', '.tx-cut', '.tx-div', '.tx-tools', '.tdlg.txf', '.txf-it.is-cur', 'prefers-reduced-motion']) assert.ok(css.includes(name), name);
});
```

2. Run it and watch it fail (`ENOENT … session-talk.js`):

```
node --test tests/station-talk-redesign.test.js
```

3. Write the module.

In `assets/station/session-talk.js`:

```js
'use strict';
// assets/station/session-talk.js — the session page's 對話 tab (design
// 2026-10-21-station-redesign §4; mockup route-session.html, the chat panel
// and its 專注 review): the turns station/talk/<id> returns, which station.js
// fetches (`talkLoad`) and keeps; every item opens, 全部展開 / 收起 opens or
// shuts them all, and 專注 shows the conversation alone in a full-viewport
// dialog where j and k move a cursor, o opens the item under it and Esc
// closes. The poll's 3 s redraw replaces the markup: station.js keeps each
// item's open state by its data-key, and this file keeps 全部展開's state and
// the dialog with its cursor, reopening it after the redraw.
(function (w, doc) {
    var EN = {
        'stalk.title': 'Talk',
        'stalk.all': 'Open all',
        'stalk.none': 'Close all',
        'stalk.focus': 'Focus',
        'stalk.focusTitle': 'Focus review',
        'stalk.keysMove': 'next / previous',
        'stalk.keysOpen': 'open',
        'stalk.keysClose': 'close',
        'stalk.close': 'Close',
        'stalk.int': 'Interrupted',
        'stalk.compact': 'compact',
        'stalk.pre': 'context before {n}',
        'stalk.loading': 'Loading…',
        'stalk.failed': 'Could not read the conversation',
        'stalk.retry': 'Retry',
        'stalk.more': 'Load {n} more',
        'stalk.shown': '{n} / {m} turns shown',
        'stalk.empty': 'Nothing in the transcript to list',
        'stalk.missing': 'This machine no longer has this session\'s transcript',
        'stalk.missingWhy': 'The conversation is read from the transcript, and it is gone. To keep later sessions longer, raise {key} in {file}.',
        'stalk.static': 'Only a page opened through serve can read the conversation',
        'stalk.staticWhy': 'The conversation is not written into this file; serve reads it from the transcript. Open the station with {cmd} and come back to this tab.',
        'stalk.list': 'The conversation, in order',
    };
    var PAGE = 100;
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function fill(s, vars) {
        return vars ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) ? String(vars[k]) : m; }) : s;
    }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return fill(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    function kit() { return (w && w.FK_KIT) || {}; }
    function esc(s) { return kit().esc(s); }
    function num(v) { return typeof v === 'number' && isFinite(v); }
    function hm(at) {
        var ms = typeof at === 'string' ? Date.parse(at) : at;
        if (!num(ms)) return '';
        var d = new Date(ms);
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    // One turn as one item: a user turn on the right, Claude's words as plain
    // text, an interruption and a compaction as quiet lines; shut, an item
    // shows two lines of its text, open all of it. A compaction's summary,
    // the turn after it, is its body.
    function item(t, sum, pre, j, open, cur) {
        var cls = t.kind === 'user' ? 'tx-u' : t.kind === 'claude' ? 'tx-a' : t.kind === 'interrupt' ? 'tx-n' : 'tx-cut';
        var head;
        if (t.kind === 'interrupt') head = '<b>' + loc('stalk.int', '中斷') + '</b> ' + esc(t.text);
        else if (t.kind === 'compact' || t.kind === 'summary') {
            head = '<b>' + loc('stalk.compact', 'compact') + '</b>' + (num(t.preTokens) ? ' ' + loc('stalk.pre', '壓縮前 context {n}', { n: kit().tokens(t.preTokens) }) : '');
        } else head = esc(t.text);
        var body = sum ? '<div class="tx-ab">' + esc(sum.text) + '</div>' : t.kind === 'summary' ? '<div class="tx-ab">' + esc(t.text) + '</div>' : '';
        return '<details class="tx-it ' + cls + (pre === 'fk' ? ' txf-it' + (cur ? ' is-cur' : '') : '') + '" data-key="' + pre + '-' + j + '"' + (open ? ' open' : '') + '>'
            + '<summary><span class="tx-at">' + head + '</span><time>' + hm(t.at) + '</time></summary>' + body + '</details>';
    }
    function divider(g) {
        return '<div class="tx-div" style="--c:var(--st-' + esc(g.stage) + ')"><b>' + esc(g.stage) + '</b>' + hm(g.from) + '</div>';
    }
    // The items in order, a stage rule before the first turn at or after the
    // moment the stage began. `pre` keeps the tab's keys (tk-) apart from the
    // dialog's (fk-); `cur` is the dialog's cursor.
    function rows(turns, stages, pre, open, cur) {
        var st = (stages || []).filter(function (g) { return num(g.from); }).slice().sort(function (a, b) { return a.from - b.from; });
        var out = [], si = 0, j = 0;
        for (var i = 0; i < turns.length; i++) {
            var t = turns[i], ms = Date.parse(t.at);
            while (si < st.length && num(ms) && ms >= st[si].from) { out.push(divider(st[si])); si++; }
            var sum = null;
            if (t.kind === 'compact' && turns[i + 1] && turns[i + 1].kind === 'summary') { sum = turns[i + 1]; i++; }
            out.push(item(t, sum, pre, j, open, j === cur));
            j++;
        }
        return out.join('');
    }
    function note(title, why) {
        return '<div class="emptyd tkmiss" data-block="talk-missing"><p class="et">' + title + '</p><p class="es">' + why + '</p></div>';
    }

    var ALL = {}, FOCUS = { id: null, cur: 0 }, heard = false;
    function step(cur, n, key) {
        if (!n) return 0;
        if (key === 'j') return Math.min(n - 1, cur + 1);
        if (key === 'k') return Math.max(0, cur - 1);
        return cur;
    }
    function focusEl() { return doc && doc.getElementById ? doc.getElementById('stalk-focus') : null; }
    function mark() {
        var d = focusEl();
        if (!d || !d.querySelectorAll) return;
        var its = d.querySelectorAll('.txf-it');
        for (var i = 0; i < its.length; i++) its[i].classList.toggle('is-cur', i === FOCUS.cur);
        if (its[FOCUS.cur] && its[FOCUS.cur].scrollIntoView) its[FOCUS.cur].scrollIntoView({ block: 'nearest' });
    }
    function reopen() {
        var d = focusEl();
        if (!d || d.open || typeof d.showModal !== 'function' || FOCUS.id === null) return;
        d.onclose = function () { FOCUS.id = null; };
        d.showModal();
        mark();
    }
    function listen() {
        if (heard || !doc || !doc.addEventListener) return;
        heard = true;
        doc.addEventListener('click', function (e) {
            var t = e && e.target && e.target.closest ? e.target : null;
            if (!t) return;
            var card = t.closest('[data-stalk]'), b = t.closest('[data-stalk-all]');
            if (b && card) {
                var id = card.getAttribute('data-stalk'), on = ALL[id] !== true;
                ALL[id] = on;
                b.setAttribute('aria-pressed', on ? 'true' : 'false');
                b.textContent = on ? loc('stalk.none', '全部收起') : loc('stalk.all', '全部展開');
                [].forEach.call(card.querySelectorAll('.tx-scroll .tx-it'), function (d) { d.open = on; });
                return;
            }
            if (t.closest('[data-stalk-focus]') && card) { FOCUS.id = card.getAttribute('data-stalk'); FOCUS.cur = 0; reopen(); return; }
            if (t.closest('[data-stalk-close]')) {
                var d = focusEl();
                if (d && typeof d.close === 'function') d.close();
            }
        });
        doc.addEventListener('keydown', function (e) {
            var d = focusEl();
            if (!d || !d.open || e.ctrlKey || e.metaKey || e.altKey) return;
            var key = String(e.key || '').toLowerCase();
            if (key === 'j' || key === 'k') {
                e.preventDefault();
                FOCUS.cur = step(FOCUS.cur, d.querySelectorAll('.txf-it').length, key);
                mark();
            } else if (key === 'o') {
                e.preventDefault();
                var c = d.querySelectorAll('.txf-it')[FOCUS.cur];
                if (c) c.open = !c.open;
            }
        });
    }
    function dialog(h, o) {
        var k = kit(), cur = FOCUS.id !== null ? FOCUS.cur : 0;
        return '<dialog class="tdlg txf" id="stalk-focus" aria-labelledby="stalk-focus-h"><div class="tdlg-in"><div class="tdlg-hd txf-hd">'
            + '<b id="stalk-focus-h">' + loc('stalk.focusTitle', '專注 review') + '</b>' + (o.task ? '<span class="tdlg-sub">' + esc(o.task) + '</span>' : '')
            + '<span class="txf-keys" aria-hidden="true"><span><kbd>j</kbd><kbd>k</kbd>' + loc('stalk.keysMove', '上下一則') + '</span>'
            + '<span><kbd>o</kbd>' + loc('stalk.keysOpen', '展開') + '</span><span><kbd>Esc</kbd>' + loc('stalk.keysClose', '關閉') + '</span></span>'
            + '<button type="button" class="tdlg-x" data-stalk-close="1" aria-label="' + loc('stalk.close', '關閉') + '">' + k.icon('close') + '</button></div>'
            + '<div class="txf-sc" tabindex="-1"><div class="tx txf-tx">' + rows(h.turns, o.stages, 'fk', false, cur) + '</div></div></div></dialog>';
    }

    function html(id, held, o) {
        o = o || {};
        listen();
        var h = held || { turns: [], total: null, state: '' };
        var btn = function (text) { return '<button type="button" class="ctl" data-talk="' + esc(id) + '">' + text + '</button>'; };
        if (h.state === 'missing') {
            return note(loc('stalk.missing', '這台機器上已經沒有這個 session 的 transcript'),
                loc('stalk.missingWhy', '對話是直接從 transcript 讀出來的，檔案不在就沒有內容可以列。之後的 session 想留久一點，把 {file} 的 {key} 調大。',
                    { file: '<code>~/.claude/settings.json</code>', key: '<code>cleanupPeriodDays</code>' }));
        }
        if (h.state === 'static') {
            return note(loc('stalk.static', '要從 serve 開的頁面才讀得到對話'),
                loc('stalk.staticWhy', '對話不寫進這份檔案，全文只留在這台機器上，由 serve 讀 transcript 回答。用 {cmd} 開站，再回到這個分頁。',
                    { cmd: '<code>node scripts/station.js serve --open</code>' }));
        }
        if (h.total === null || h.total === undefined) {
            return h.state === 'failed'
                ? '<div class="tkmore" data-block="talk-more"><span>' + loc('stalk.failed', '讀不到對話') + '</span>' + btn(loc('stalk.retry', '重試')) + '</div>'
                : '<p class="tally">' + loc('stalk.loading', '讀取中…') + '</p>';
        }
        if (h.total === 0) return '<p class="tally">' + loc('stalk.empty', 'transcript 裡沒有可列的對話') + '</p>';
        var all = ALL[id] === true, n = h.turns.length;
        var tail = h.state === 'loading' ? '<span>' + loc('stalk.loading', '讀取中…') + '</span>'
            : h.state === 'failed' ? '<span>' + loc('stalk.failed', '讀不到對話') + '</span>' + btn(loc('stalk.retry', '重試'))
                : n < h.total ? btn(loc('stalk.more', '再載入 {n} 輪', { n: PAGE })) : '';
        if (FOCUS.id === id && w.setTimeout) w.setTimeout(reopen, 0);
        return '<section class="dcard tx-card" data-block="session-talk" data-stalk="' + esc(id) + '"><div class="dcard-h">' + kit().icon('list') + '<b>' + loc('stalk.title', '對話') + '</b>'
            + '<span class="gt-hr tx-acts"><button type="button" class="tx-tools" data-stalk-all="1" aria-pressed="' + (all ? 'true' : 'false') + '">'
            + (all ? loc('stalk.none', '全部收起') : loc('stalk.all', '全部展開')) + '</button>'
            + '<button type="button" class="tx-tools tx-fb" data-stalk-focus="1" aria-haspopup="dialog">' + loc('stalk.focus', '專注') + '</button></span></div>'
            + '<div class="tx-scroll"><div class="tx" role="list" aria-label="' + loc('stalk.list', '對話，依時間順序') + '">' + rows(h.turns, o.stages, 'tk', all, -1) + '</div></div>'
            + '<div class="tkmore" data-block="talk-more"><span>' + loc('stalk.shown', '已顯示 {n} / {m} 輪', { n: n, m: h.total }) + '</span>' + tail + '</div>'
            + dialog(h, o) + '</section>';
    }

    var api = { html: html, step: step, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_STALK = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
```

4. Write the stylesheet.

In `assets/station/session-talk.css`:

```css
/* assets/station/session-talk.css — the session page's 對話 tab (station redesign §4; mockup
   _sess/r58-chat.css): your turns in a bubble on the right, Claude's words as plain text, a stage
   rule where a stage began; 專注 is the conversation alone in a full-viewport dialog. */
.tx-card{padding-bottom:0}
.tx-acts{display:inline-flex;gap:6px}
.tx-tools{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:0;border-radius:7px;background:transparent;
  box-shadow:inset 0 0 0 1px var(--rule2);font:600 12px var(--f-ui);color:var(--ink2);cursor:pointer;white-space:nowrap}
.tx-tools:hover{color:var(--ink);background:var(--wash)}
.tx-tools.tx-fb{background:var(--keel-tint);box-shadow:none;color:var(--keel-deep)}
.tx-tools.tx-fb:hover{box-shadow:inset 0 0 0 1px var(--keel)}
.tx-tools:focus-visible{outline:2px solid var(--keel);outline-offset:1px}
.tx-scroll{position:relative;max-height:calc(100vh - 340px);min-height:260px;overflow:auto;margin:0 -18px;padding:6px 18px 24px}
.tx{display:flex;flex-direction:column;max-width:760px;margin:0 auto}
.tx-it>summary{display:block;list-style:none;cursor:pointer;border-radius:6px}
.tx-it>summary::-webkit-details-marker{display:none}
.tx-it>summary:focus-visible{outline:2px solid var(--keel);outline-offset:2px}
.tx-at{white-space:pre-wrap;overflow-wrap:anywhere}
.tx-it:not([open])>summary .tx-at{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.tx-it time{font:12px var(--f-mono);color:var(--muted);font-variant-numeric:tabular-nums}
.tx-u{align-self:flex-end;max-width:min(560px,82%);margin:14px 0 2px}
.tx-u>summary{padding:9px 14px;border-radius:16px 16px 4px 16px;background:var(--inset);box-shadow:inset 0 0 0 1px var(--rule);font-size:13.5px;line-height:1.6;color:var(--ink)}
.tx-u time{display:block;margin-top:3px;text-align:right}
.tx-a{margin:10px 0 2px;font-size:13.5px;line-height:1.7;color:var(--ink)}
.tx-a>summary{margin:0 -8px;padding:2px 8px}
.tx-a>summary:hover{background:var(--wash)}
.tx-a time{display:block;margin-top:2px}
.tx-n,.tx-cut{margin:10px 0;font-size:12.5px;color:var(--muted)}
.tx-n>summary,.tx-cut>summary{display:flex;align-items:baseline;gap:10px;padding:4px 8px;border-radius:6px;background:var(--inset)}
.tx-n b,.tx-cut b{font:600 12px var(--f-mono);color:var(--ink2)}
.tx-n time,.tx-cut time{margin-left:auto}
.tx-ab{margin:8px 0 0;padding:8px 12px;border-left:2px solid var(--rule2);font-size:13px;line-height:1.65;color:var(--ink2);white-space:pre-wrap;overflow-wrap:anywhere}
.tx-div{display:flex;align-items:center;gap:10px;margin:22px 0 6px;font:12px var(--f-mono);color:var(--muted)}
.tx-div::before,.tx-div::after{content:"";flex:1;border-top:1px solid var(--rule)}
.tx-div b{display:inline-flex;align-items:center;gap:7px;font-weight:700;color:var(--ink2)}
.tx-div b::before{content:"";width:8px;height:8px;border-radius:2px;background:var(--c)}
.tx-div:first-child{margin-top:8px}

/* ---- 專注 review: the conversation alone, a 760px column, j / k moving a quiet cursor ---- */
.tdlg.txf{width:100%;height:100%;max-width:none;max-height:none;margin:0;border-radius:0;box-shadow:none}
.txf-hd{gap:12px;padding:0 12px 0 22px}
.txf-keys{display:inline-flex;gap:14px;margin-left:auto;font-size:12px;color:var(--muted)}
.txf-keys>span{display:inline-flex;align-items:center;gap:4px}
.txf kbd{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:4px;background:var(--inset);box-shadow:inset 0 -1px 0 var(--rule2);font:600 11.5px var(--f-mono);color:var(--ink2)}
.txf-hd .tdlg-x{margin-left:4px}
.txf-sc{flex:1 1 auto;min-height:0;overflow:auto;padding:0 64px 45vh;outline:0}
.txf-tx{max-width:760px;margin:0 auto}
.txf-tx .tx-div{position:sticky;top:0;z-index:2;margin:0;padding:18px 0 10px;background:var(--panel)}
.txf-it{position:relative;isolation:isolate}
.txf-it::before{content:"";position:absolute;inset:-4px -12px;z-index:-1;border-radius:8px;pointer-events:none;opacity:0;transition:opacity .15s ease-out}
.txf-it.is-cur::before{opacity:1;background:var(--wash);box-shadow:inset 0 0 0 1px var(--rule2)}
.tdlg.txf[open]{animation:txf-in .18s ease-out}
@keyframes txf-in{from{opacity:0}}
@media (prefers-reduced-motion:reduce){.txf-it::before{transition:none}.tdlg.txf[open]{animation:none}}
@media (max-width:900px){.txf-keys{display:none}.txf-sc{padding:0 16px 45vh}}
```

5. Run it again and watch it pass:

```
node --test tests/station-talk-redesign.test.js
```

6. Commit: `git add assets/station/session-talk.js assets/station/session-talk.css tests/station-talk-redesign.test.js` and `git commit -m "feat: session page talk tab and focus review"` with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer.

## Task 14: Gate frame for /f/<id>/gate (§5)

**Files:**
- Modify: `assets/station/gate-frame.js` — new: `FK_GATE`, the gate page's frame: head with no tabs, the report in the main column, the question in a sticky side column; options show their label, the description opens on click, number keys pick
- Modify: `assets/station/gate-frame.css` — new: the frame, ported from `gate-plan-a.html`
- Read: `.fankeel/build/2026-10-21-station-redesign/gate-plan-a.html:9-60` — head, two-column and option rules
- Read: `.fankeel/build/2026-10-21-station-redesign/gate-plan-a.html:595-700` — the question card, `.gq-pick` rules and the keydown guard; its countdown bar, 交給終端 hand-off button and the `send()` it calls are mockup behaviour (the station cannot answer a gate) and are not ported
- Read: `tests/station-module.js` — `page(names, station)` and `stringsLeft(name, EN)`
- Test: `tests/station-gate-frame.test.js`

**Interfaces:**
- Consumes: Task 3's call from `focusPageHtml` (`assets/station/station.js`), when `tab === 'gate'` and `window.FK_GATE` is loaded: `window.FK_GATE.frame({ session, gate, tasks, reportHtml, shellsHtml })`, whose return value is the whole tab — `session` the `STATION.sessions[]` row, `gate` the detail's `x.gate` (`{ stage, gate: { questions: [{ question, header, options: [{ label, description }] }], next } }` or null), `tasks` the detail's `x.tasks`, `reportHtml` Task 3's `focusReportHtml(s, g, tasks)` (`<section class="panel pv gv gr" data-block="gate-report">…`), `shellsHtml` a string, possibly empty. Task 3's `window.FK_KIT` — `esc`, `keelGlyph(o)`, `icon(name)`, `ROUTE`.
- Produces: `window.FK_GATE` and `module.exports`, `{ frame, pickable, onKey, pick, more, EN }`:
  - `frame({ session, gate, tasks, reportHtml, shellsHtml }) -> string` — `'<main class="fm gt-frame" data-block="gate-frame">' + head + shellsHtml + grid + '</main>'`.
  - `pickable(e, d) -> boolean` — false with a modifier key, an open `<dialog>` in `d`, or `e.target` inside `input, textarea, select, [contenteditable]`.
  - `onKey(e, d) -> boolean` — a key `1` … the option count, when `pickable`, picks that option; true when it did.
  - `pick(n) -> boolean`, `more(n)` — the click handlers: pick option `n`, open or shut option `n`'s description. State is kept per session id, so the focus page's 5 s repaint keeps it. Nothing is sent anywhere: the answer is given in Claude Desktop.

**Dispatch:** implementer, opus

1. Write the failing test.

In `tests/station-gate-frame.test.js`:

```js
'use strict';
// The gate page's frame, /f/<id>/gate (assets/station/gate-frame.js; design
// 2026-10-21-station-redesign §5): a head with no tabs, the report station.js
// drew in the main column, the question in a sticky side column; an option
// shows its label, its description opens on click, number keys pick, and an
// open dialog or a focused field swallows the keys. Task 3's focusPageHtml
// calls frame() with { session, gate, tasks, reportHtml, shellsHtml }.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page, stringsLeft } = require('./station-module.js');

const SID = 'dddddddd-4444-4444-8444-444444444444';
const S = { id: SID, task: 'Gate frame', project: 'fankeel', pkey: 'F:\\ws/fankeel', state: 'live', stage: 'plan',
    route: ['survey', 'design', 'plan', 'build', 'land'], gateAt: Date.parse('2026-10-20T10:00:00.000Z') };
const GATE = { stage: 'plan', gate: { next: 'build the twelve tasks', questions: [{ question: 'Go to build?', header: 'plan', options: [
    { label: 'build (Recommended)', description: 'Approve the plan and start build.' },
    { label: 'rewrite', description: 'Send the plan back.' },
    { label: 'pause', description: '' }] }] } };
const REPORT = '<section class="panel pv gv gr" data-block="gate-report">REPORT</section>';
const SHELLS = '<section data-block="focus-shells">SHELLS</section>';
const boot = () => page(['gate-frame.js'], { sessions: [S] }).M['gate-frame.js'];
const args = (extra) => Object.assign({ session: S, gate: GATE, tasks: [], reportHtml: REPORT, shellsHtml: SHELLS }, extra);
// A key event; `inField` puts its target inside a text field.
const key = (k, o) => Object.assign({ key: k, target: { closest: () => (o && o.inField ? {} : null) }, preventDefault() {} }, o && o.mods);
const quiet = { querySelector: () => null };
const dialogOpen = { querySelector: (sel) => (sel === 'dialog[open]' ? {} : null) };

test('the frame is the whole tab: head without tabs, the shells, then the report beside the question', () => {
    const html = boot().frame(args());
    assert.ok(html.startsWith('<main class="fm gt-frame" data-block="gate-frame">'));
    assert.ok(html.endsWith('</main>'));
    assert.ok(!html.includes('role="tablist"') && !html.includes('subtabs'), 'no tabs');
    assert.ok(html.includes('<a class="gh-link" href="/#/s/' + SID + '"'));
    assert.ok(html.indexOf('data-block="gate-head"') < html.indexOf(SHELLS));
    assert.ok(html.indexOf(SHELLS) < html.indexOf('data-block="gate-columns"'));
    assert.ok(html.indexOf('data-block="gate-main"') < html.indexOf(REPORT));
    assert.ok(html.indexOf(REPORT) < html.indexOf('data-block="gate-side"'));
    assert.ok(html.indexOf('data-block="gate-side"') < html.indexOf('data-block="gate-question"'));
    assert.ok(html.includes('<span class="of">3/5</span>'));
});

test('an option shows its label, the recommended one marked; its description is hidden until opened', () => {
    const G = boot();
    const html = G.frame(args());
    assert.match(html, /<li data-gq="1" class="is-rec">[\s\S]*?<span class="gt-l">build<span class="gt-rec">建議<\/span><\/span>/);
    assert.ok(!html.includes('(Recommended)'));
    assert.ok(html.includes('<p class="gt-d" id="gq-d-1" hidden>Approve the plan and start build.</p>'));
    assert.ok(html.includes('data-gq-pick="3" aria-pressed="false">選這個<kbd>3</kbd>'));
    assert.ok(html.includes('<h2 class="gt-q">Go to build?</h2>'));
    assert.ok(html.includes('build the twelve tasks'));
    G.more(1);
    const open = G.frame(args());
    assert.ok(open.includes('<li data-gq="1" class="is-rec is-open">'));
    assert.ok(open.includes('<p class="gt-d" id="gq-d-1">Approve the plan'));
    G.more(1);
    assert.ok(G.frame(args()).includes('id="gq-d-1" hidden'));
});

test('a number key picks; the pick survives the repaint, names the label, and belongs to this session only', () => {
    const G = boot();
    G.frame(args());
    assert.equal(G.onKey(key('2'), quiet), true);
    const html = G.frame(args());
    assert.ok(html.includes('<li data-gq="2" class="on">'));
    assert.ok(html.includes('data-gq-pick="2" aria-pressed="true"'));
    assert.ok(html.includes('你選了「rewrite」'));
    const other = G.frame(args({ session: Object.assign({}, S, { id: 'eeeeeeee-5555-4555-8555-555555555555' }) }));
    assert.ok(!other.includes('class="on"'));
});

test('a key is swallowed by an open dialog, a focused field, a modifier, or a number past the options', () => {
    const G = boot();
    G.frame(args());
    assert.equal(G.pickable(key('1'), quiet), true);
    assert.equal(G.pickable(key('1'), dialogOpen), false);
    assert.equal(G.pickable(key('1', { inField: true }), quiet), false);
    assert.equal(G.pickable(key('1', { mods: { ctrlKey: true } }), quiet), false);
    assert.equal(G.onKey(key('1'), dialogOpen), false);
    assert.equal(G.onKey(key('4'), quiet), false);
    assert.equal(G.onKey(key('x'), quiet), false);
    assert.ok(!G.frame(args()).includes('class="on"'));
});

test('without a question the frame says so, and the page never sends an answer', () => {
    const html = boot().frame(args({ gate: null, shellsHtml: '' }));
    assert.ok(html.includes('報告裡沒有讀得出的 gate 問題'));
    assert.ok(!html.includes('data-gq='));
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'gate-frame.js'), 'utf8');
    assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|sendBeacon/);
});

test('every string has English, and the frame has its rules in gate-frame.css', () => {
    assert.deepEqual(stringsLeft('gate-frame.js', boot().EN), []);
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'gate-frame.css'), 'utf8');
    for (const name of ['.gt-frame', '.gt-grid', '.gt-pin', 'position:sticky', '.gq-pick', '.gt-d', '.gq-l', 'prefers-reduced-motion']) assert.ok(css.includes(name), name);
});
```

2. Run it and watch it fail (`ENOENT … gate-frame.js`):

```
node --test tests/station-gate-frame.test.js
```

3. Write the module.

In `assets/station/gate-frame.js`:

```js
'use strict';
// assets/station/gate-frame.js — the gate page, /f/<id>/gate (design
// 2026-10-21-station-redesign §5; mockup gate-plan-a.html): a head with no
// tabs whose title opens the session in the full station, the stage report
// station.js drew (`focusReportHtml`) in the main column, and the question in
// a side column that stays in view. An option shows its label; its
// description opens on click; 1 … n pick, unless a dialog is open or a field
// has focus. A pick only marks the option and says to answer in Claude
// Desktop: the station cannot answer a gate, so nothing here is sent.
// Loaded by the focus page before station.js, whose focusPageHtml calls frame().
(function (w, doc) {
    var EN = {
        'gf.open': 'Open this session in the full station',
        'gf.unnamed': '(unnamed)',
        'gf.ask': 'Your call',
        'gf.noQ': 'No gate question could be read from the report',
        'gf.rec': 'Recommended',
        'gf.pick': 'Pick this',
        'gf.next': 'Next step the report names',
        'gf.where': 'Answer in Claude Desktop; this page only shows what you are approving and sends nothing.',
        'gf.picked': 'You picked "{l}". Answer it in Claude Desktop; this page sends nothing.',
    };
    var REC = /\s*\(Recommended\)\s*$/;
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function fill(s, vars) {
        return vars ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) ? String(vars[k]) : m; }) : s;
    }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return fill(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    function kit() { return (w && w.FK_KIT) || {}; }
    function esc(s) { return kit().esc(s); }

    // Per session: the option picked (0 for none) and the options opened.
    // The focus page repaints every 5 s; this survives it. CUR is the session
    // the last frame drew, with its option labels, for the keys and clicks.
    var STATE = {}, CUR = { id: null, labels: [] }, heard = false;
    function state(id) { return STATE[id] || (STATE[id] = { pick: 0, more: {} }); }
    function lineText(st) {
        var l = st.pick ? CUR.labels[st.pick - 1] : null;
        return l !== null && l !== undefined
            ? loc('gf.picked', '你選了「{l}」，到 Claude Desktop 回答；這頁不送答案', { l: l })
            : loc('gf.where', '回答在 Claude Desktop 那邊給；這頁只讓你看清楚要核准什麼，不收答案');
    }

    function glyph(s) {
        var k = kit(), route = s.route || [], at = route.indexOf(s.stage);
        var st = function (name) { var i = route.indexOf(name); return i < 0 ? null : i < at ? 'done' : i === at ? 'now' : 'todo'; };
        return k.keelGlyph({ cls: 'prog', seg: function (i) { return st(k.ROUTE[i]); }, edge: st('land'), c: at >= 0 ? 'var(--st-' + esc(s.stage) + ')' : '' });
    }
    function head(s, stage) {
        var route = s.route || [], at = route.indexOf(stage);
        var sep = '<span class="sep" aria-hidden="true">·</span>';
        return '<section class="dcard gt-head" data-block="gate-head">' + glyph(s) + '<div class="gt-id">'
            + '<h1 class="gt-task"><a class="gh-link" href="/#/s/' + encodeURIComponent(s.id) + '" title="' + loc('gf.open', '在完整 station 開這個 session') + '">'
            + esc(s.task || loc('gf.unnamed', '（未命名）')) + '</a></h1>'
            + '<p class="gt-meta"><span class="gt-st" style="--c:var(--st-' + esc(stage) + ')">' + esc(stage) + '</span>'
            + (at >= 0 ? '<span class="of">' + (at + 1) + '/' + route.length + '</span>' : '')
            + sep + '<span>' + esc(s.project || s.pkey || '') + '</span>' + sep + '<span title="session ' + esc(s.id) + '">' + esc(String(s.id).slice(0, 8)) + '</span></p>'
            + '</div></section>';
    }
    function option(o, i, st) {
        var k = kit(), n = i + 1, raw = String((o && o.label) || ''), rec = REC.test(raw), d = o && o.description, open = st.more[n] === true;
        var cls = [rec ? 'is-rec' : '', st.pick === n ? 'on' : '', open ? 'is-open' : ''].filter(Boolean).join(' ');
        return '<li data-gq="' + n + '"' + (cls ? ' class="' + cls + '"' : '') + '><span class="gt-n">' + n + '</span><div class="gq-b">'
            + '<button type="button" class="gq-l" data-gq-more="' + n + '" aria-expanded="' + (open ? 'true' : 'false') + '"' + (d ? ' aria-controls="gq-d-' + n + '"' : '') + '>'
            + '<span class="gt-l">' + esc(raw.replace(REC, '')) + (rec ? '<span class="gt-rec">' + loc('gf.rec', '建議') + '</span>' : '') + '</span>' + (d ? k.icon('chev') : '') + '</button>'
            + (d ? '<p class="gt-d" id="gq-d-' + n + '"' + (open ? '' : ' hidden') + '>' + esc(d) + '</p>' : '') + '</div>'
            + '<button type="button" class="gq-pick" data-gq-pick="' + n + '" aria-pressed="' + (st.pick === n ? 'true' : 'false') + '">' + loc('gf.pick', '選這個') + '<kbd>' + n + '</kbd></button></li>';
    }
    function ask(g, stage, st) {
        var k = kit(), q = g && g.gate && g.gate.questions && g.gate.questions[0] ? g.gate.questions[0] : null;
        var opts = q && Array.isArray(q.options) ? q.options : [], next = g && g.gate && g.gate.next;
        return '<section class="dcard gt-ask" data-block="gate-question"><div class="dcard-h">' + k.icon('gate') + '<b>' + loc('gf.ask', '等你決定') + '</b>'
            + '<span class="kn wait">' + esc(stage) + ' gate</span>' + (q && q.header ? '<span class="gt-hr chip">' + esc(q.header) + '</span>' : '') + '</div>'
            + '<p class="gq-cd" role="status" aria-live="polite"><i class="hatchsw" aria-hidden="true"></i><span id="gq-line">' + esc(lineText(st)) + '</span></p>'
            + '<h2 class="gt-q">' + (q ? esc(q.question) : loc('gf.noQ', '報告裡沒有讀得出的 gate 問題')) + '</h2>'
            + (opts.length ? '<ol class="gt-opts gq-opts">' + opts.map(function (o, i) { return option(o, i, st); }).join('') + '</ol>' : '')
            + (next ? '<p class="gt-next"><span>' + loc('gf.next', '報告寫的下一步') + '</span>' + esc(next) + '</p>' : '') + '</section>';
    }

    // A repaint in place after a click or a key, without waiting for the
    // focus page's next 5 s draw, which draws the same from STATE.
    function paint() {
        if (!doc || !doc.querySelectorAll || CUR.id === null) return;
        var st = state(CUR.id);
        [].forEach.call(doc.querySelectorAll('[data-gq]'), function (li) {
            var n = Number(li.getAttribute('data-gq')), open = st.more[n] === true;
            li.classList.toggle('on', st.pick === n);
            li.classList.toggle('is-open', open);
            var b = li.querySelector('[data-gq-more]'), d = li.querySelector('.gt-d'), p = li.querySelector('[data-gq-pick]');
            if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (d) d.hidden = !open;
            if (p) p.setAttribute('aria-pressed', st.pick === n ? 'true' : 'false');
        });
        var line = doc.getElementById ? doc.getElementById('gq-line') : null;
        if (line) line.textContent = lineText(st);
    }
    function pick(n) {
        if (CUR.id === null || !(n >= 1 && n <= CUR.labels.length)) return false;
        state(CUR.id).pick = n;
        paint();
        return true;
    }
    function more(n) {
        if (CUR.id === null) return;
        var st = state(CUR.id);
        st.more[n] = st.more[n] !== true;
        paint();
    }
    function pickable(e, d) {
        if (!e || e.ctrlKey || e.metaKey || e.altKey) return false;
        if (d && d.querySelector && d.querySelector('dialog[open]')) return false;
        var t = e.target;
        return !(t && t.closest && t.closest('input,textarea,select,[contenteditable]'));
    }
    function onKey(e, d) {
        var n = e && /^[1-9]$/.test(String(e.key)) ? Number(e.key) : 0;
        if (!n || n > CUR.labels.length || !pickable(e, d)) return false;
        if (e.preventDefault) e.preventDefault();
        return pick(n);
    }
    function listen() {
        if (heard || !doc || !doc.addEventListener) return;
        heard = true;
        doc.addEventListener('click', function (e) {
            var t = e && e.target && e.target.closest ? e.target : null;
            if (!t) return;
            var m = t.closest('[data-gq-more]'), p = t.closest('[data-gq-pick]');
            if (m) more(Number(m.getAttribute('data-gq-more')));
            else if (p) pick(Number(p.getAttribute('data-gq-pick')));
        });
        doc.addEventListener('keydown', function (e) { onKey(e, doc); });
    }

    function frame(o) {
        o = o || {};
        listen();
        var s = o.session || {}, g = o.gate || null, stage = g && g.stage ? g.stage : s.stage || '';
        var q = g && g.gate && g.gate.questions && g.gate.questions[0] ? g.gate.questions[0] : null;
        CUR = { id: s.id, labels: (q && Array.isArray(q.options) ? q.options : []).slice(0, 9).map(function (x) { return String((x && x.label) || '').replace(REC, ''); }) };
        var st = state(s.id);
        return '<main class="fm gt-frame" data-block="gate-frame">' + head(s, stage) + (o.shellsHtml || '')
            + '<div class="gt-grid" data-block="gate-columns"><div class="gt-main" data-block="gate-main">' + (o.reportHtml || '') + '</div>'
            + '<aside class="gt-side" data-block="gate-side"><div class="gt-pin">' + ask(g, stage, st) + '</div></aside></div></main>';
    }

    var api = { frame: frame, pickable: pickable, onKey: onKey, pick: pick, more: more, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_GATE = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
```

4. Write the stylesheet.

In `assets/station/gate-frame.css`:

```css
/* assets/station/gate-frame.css — the gate page, /f/<id>/gate (station redesign §5; mockup
   gate-plan-a.html). Scoped under .gt-frame: the head classes share names with the session page's. */
.gt-frame{display:flex;flex-direction:column;gap:18px;max-width:1440px;margin:0 auto;padding:18px 22px 40px}
.gt-frame .dcard.gt-head,:root[data-style=keel] .gt-frame .dcard.gt-head{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-areas:"g id";
  align-items:center;column-gap:16px;padding:14px 18px}
.gt-frame .gt-head .glyph.prog{grid-area:g;width:40px;height:40px;display:block}
.gt-frame .gt-id{grid-area:id;min-width:0}
.gt-frame .gt-task{margin:0;font-size:18px;font-weight:700;letter-spacing:-.01em;line-height:1.35;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gh-link{color:inherit;text-decoration:none;border-radius:4px}
.gh-link:hover{text-decoration:underline;text-decoration-color:var(--keel-mid);text-decoration-thickness:1.5px;text-underline-offset:4px}
.gh-link:focus-visible{outline:2px solid var(--keel);outline-offset:2px}
.gt-meta{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;margin:6px 0 0;font:12px var(--f-mono);color:var(--muted)}
.gt-meta .gt-st{display:inline-flex;align-items:center;gap:6px;font-weight:700;color:var(--ink2)}
.gt-meta .gt-st::before{content:"";width:8px;height:8px;border-radius:2px;background:var(--c)}
.gt-meta .of{font-variant-numeric:tabular-nums}
.gt-meta .sep{color:var(--faint)}

/* ---- two columns: the report wide, the decision narrow and in view while the report scrolls ---- */
.gt-grid{display:grid;grid-template-columns:minmax(0,7fr) minmax(320px,5fr);gap:18px;align-items:start}
.gt-grid>.gt-side{align-self:stretch}
.gt-side .gt-pin{display:flex;flex-direction:column;gap:18px}
@media (min-width:1181px) and (min-height:760px){.gt-side .gt-pin{position:sticky;top:16px}}
@media (max-width:1180px){.gt-grid{grid-template-columns:minmax(0,1fr)}.gt-grid>.gt-side{order:-1}}
.gt-frame .dcard-h .gt-hr{margin-left:auto;min-width:0}
:root[data-style=keel] .gt-frame .dcard-h .kn.wait{background:var(--signal-tint);color:var(--signal-ink)}

/* ---- the decision ---- */
.gq-cd{display:flex;align-items:center;gap:10px;margin:12px 0 0;font-size:12px;line-height:1.5;color:var(--ink2)}
.gq-cd .hatchsw{flex:none}
.gt-q{margin:10px 0 14px;font-size:17px;font-weight:700;line-height:1.45;letter-spacing:-.005em;color:var(--ink);text-wrap:balance}
.gt-opts{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.gt-opts>li{display:grid;grid-template-columns:22px minmax(0,1fr) auto;align-items:start;column-gap:10px;padding:8px 6px 8px 10px;border-top:1px solid var(--rule)}
.gt-opts>li:first-child{border-top:0}
.gt-opts>li.is-rec{background:var(--keel-tint);border-radius:7px;border-top-color:transparent}
.gt-opts>li.is-rec+li{border-top-color:transparent}
.gt-opts>li.on{box-shadow:inset 0 0 0 1.5px var(--keel);border-radius:7px}
.gt-n{font:700 12px/30px var(--f-mono);color:var(--muted);font-variant-numeric:tabular-nums}
.gt-opts .is-rec .gt-n{color:var(--keel-deep)}
.gq-b{min-width:0}
.gq-l{display:flex;align-items:center;gap:6px;width:100%;min-height:30px;padding:0;border:0;background:transparent;text-align:left;cursor:pointer;color:var(--ink)}
.gq-l .ico{flex:none;width:16px;height:16px;color:var(--muted);transition:transform .18s cubic-bezier(.16,1,.3,1)}
.is-open>.gq-b>.gq-l .ico{transform:rotate(180deg)}
.gq-l:focus-visible{outline:2px solid var(--keel);outline-offset:1px;border-radius:4px}
.gt-l{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;font-size:14px;font-weight:700;line-height:20px}
.gt-rec{font:700 11px var(--f-mono);padding:1px 7px;border-radius:5px;background:var(--keel);color:var(--on-keel)}
.gt-d{margin:4px 0 6px;font-size:12.5px;line-height:1.6;color:var(--ink2);max-width:62ch}
.gq-pick{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 6px 0 11px;border:0;border-radius:7px;background:var(--panel);
  box-shadow:inset 0 0 0 1px var(--rule2);font:600 12.5px var(--f-ui);color:var(--ink);cursor:pointer;white-space:nowrap}
.gq-pick:hover{box-shadow:inset 0 0 0 1.5px var(--keel)}
.gt-opts .is-rec .gq-pick,.gq-pick[aria-pressed="true"]{background:var(--keel);color:var(--on-keel);box-shadow:none}
.gq-pick kbd{display:grid;place-items:center;min-width:18px;height:18px;border-radius:4px;background:var(--inset);font:700 11px var(--f-mono);color:var(--ink2)}
.gt-opts .is-rec .gq-pick kbd,.gq-pick[aria-pressed="true"] kbd{background:color-mix(in srgb,var(--on-keel) 22%,transparent);color:var(--on-keel)}
.gq-pick:focus-visible{outline:2px solid var(--keel);outline-offset:1px}
.gt-next{margin:14px 0 0;padding:10px 0 0;border-top:1px solid var(--rule);display:grid;gap:3px;font-size:13px;color:var(--ink)}
.gt-next span{font-size:12px;color:var(--muted)}
@media (prefers-reduced-motion:reduce){.gq-l .ico{transition:none}}
```

5. Run it again and watch it pass:

```
node --test tests/station-gate-frame.test.js
```

6. Commit: `git add assets/station/gate-frame.js assets/station/gate-frame.css tests/station-gate-frame.test.js` and `git commit -m "feat: gate page frame with the question beside the report"` with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer.

## Task 15: Wiring the page modules into the shell, the focus page, write and serve

**Files:**
- Modify: `assets/station/index.html` — a stylesheet and a script for each redesigned page module, between `i18n.js` and `spend-talk.js`
- Modify: `lib/station.js:1036-1090` — `MODULES` gains the page modules' `.js` and `.css` (so `EMITTED` and `write()` carry them); `focusShell` loads `tip` and `gate-frame`
- Modify: `scripts/station.js:64-75` — `STATIC` answers the new files by name
- Test: `tests/station-modules.test.js`
- Test: `tests/station-spend-route.test.js` — its shell-order assertion (`:91`) names the page modules

**Interfaces:**
- Consumes: the files Tasks 6–14 created: `assets/station/tip.js`/`.css` (`FK_TIP`), `live-page` (`FK_LIVE`), `sessions-page` (`FK_SESSIONS`), `projects-page` (`FK_PROJECTS`), `project-page` (`FK_PROJECT`), `session-page` (`FK_SESSION`), `session-dispatch` (`FK_SDISP`), `session-talk` (`FK_STALK`), `gate-frame` (`FK_GATE`). Each sets its global when loaded.
- Produces: the shell (`index.html`, and `render()` which returns it) loads `tip` and the seven page modules before `station.js`, so Task 16's router finds their globals; the focus shell loads `tip` and `gate-frame` before `station.js`, so Task 3's `focusPageHtml` finds `FK_GATE`; `EMITTED` lists `station/<name>.js` and `.css` for all nine; `serve` answers them with their types.

**Dispatch:** implementer, opus

1. Write the failing test.

In `tests/station-modules.test.js`:

```js
'use strict';
// The redesigned pages' modules wired in (station redesign §1–§5): the shell
// loads tip.js and the page modules between i18n.js and the spend modules,
// with a stylesheet each; the focus shell loads tip and gate-frame; a written
// station carries them all; serve answers each by name and nothing else.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const PAGES = ['tip', 'live-page', 'sessions-page', 'projects-page', 'project-page', 'session-page', 'session-dispatch', 'session-talk'];
const ALL = PAGES.concat(['gate-frame']);
const SPEND = ['spend-talk.js', 'spend-kinds.js', 'spend-range.js', 'spend-panel.js'];
const GLOBAL = { tip: 'FK_TIP', 'live-page': 'FK_LIVE', 'sessions-page': 'FK_SESSIONS', 'projects-page': 'FK_PROJECTS', 'project-page': 'FK_PROJECT',
    'session-page': 'FK_SESSION', 'session-dispatch': 'FK_SDISP', 'session-talk': 'FK_STALK', 'gate-frame': 'FK_GATE' };
const SID = 'abababab-1212-4121-8121-121212121212';

function fixture() {
    const base = tmp('fankeel-modules-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    return { cfg, r1 };
}
const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    }).on('error', reject);
});

test('every module has its script and its stylesheet, and sets its global when loaded', () => {
    for (const n of ALL) {
        for (const ext of ['.js', '.css']) assert.ok(fs.existsSync(path.join(ASSETS, n + ext)), n + ext);
        const win = {};
        const doc = { addEventListener() {}, removeEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {}, toggle() {} } }), body: { appendChild() {} } };
        vm.runInNewContext(fs.readFileSync(path.join(ASSETS, n + '.js'), 'utf8'), { window: win, document: doc, module: { exports: {} } });
        assert.equal(typeof win[GLOBAL[n]], 'object', n + ' sets ' + GLOBAL[n]);
    }
});

test('the shell loads tip.js and the page modules after i18n.js and before the spend modules, each with its stylesheet', () => {
    for (const html of [fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8'), station.render()]) {
        const scripts = [...html.matchAll(/<script src="station\/([^"]+)"><\/script>/g)].map((m) => m[1]);
        assert.deepEqual(scripts, ['i18n.js'].concat(PAGES.map((n) => n + '.js'), SPEND, ['remote-card.js', 'station.js']));
        const sheets = [...html.matchAll(/<link rel="stylesheet" href="station\/([^"]+)">/g)].map((m) => m[1]);
        assert.deepEqual(sheets, ['station.css'].concat(PAGES.map((n) => n + '.css')));
    }
});

test('the focus page loads tip and gate-frame between i18n.js and station.js', () => {
    const html = station.focusShell(SID, 'gate');
    const scripts = [...html.matchAll(/<script src="\/station\/([^"]+)"><\/script>/g)].map((m) => m[1]);
    assert.deepEqual(scripts, ['focus/' + SID + '.js', 'i18n.js', 'tip.js', 'gate-frame.js', 'station.js']);
    const sheets = [...html.matchAll(/<link rel="stylesheet" href="\/station\/([^"]+)">/g)].map((m) => m[1]);
    assert.deepEqual(sheets, ['station.css', 'tip.css', 'gate-frame.css']);
});

test('a written station carries every module byte for byte', () => {
    const f = fixture();
    for (const n of ALL) for (const ext of ['.js', '.css']) assert.ok(station.EMITTED.includes('station/' + n + ext), n + ext);
    station.write({ configDir: f.cfg, root: f.r1 });
    for (const n of ALL) {
        for (const ext of ['.js', '.css']) {
            const at = path.join(f.cfg, 'fankeel', 'station', n + ext);
            assert.equal(fs.readFileSync(at, 'utf8'), fs.readFileSync(path.join(ASSETS, n + ext), 'utf8'), n + ext);
        }
    }
});

test('serve answers every module with its type, and still nothing it does not list', async () => {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        for (const n of ALL) {
            for (const [ext, type] of [['.js', /text\/javascript/], ['.css', /text\/css/]]) {
                const res = await get(s.url + 'station/' + n + ext);
                assert.equal(res.status, 200, n + ext);
                assert.match(res.headers['content-type'], type, n + ext);
                assert.equal(res.text, fs.readFileSync(path.join(ASSETS, n + ext), 'utf8'), n + ext);
            }
        }
        for (const name of ['not-a-page.js', 'session-page.json', 'gate-frame.html', 'tip-x.css']) {
            assert.equal((await get(s.url + 'station/' + name)).status, 404, name);
        }
    } finally {
        s.close();
    }
});
```

2. Run it and watch it fail (the shell has no `tip.js`; `EMITTED` lacks the modules):

```
node --test tests/station-modules.test.js
```

3. Load the modules in the shell. In `assets/station/index.html`, replace the stylesheet line `<link rel="stylesheet" href="station/station.css">` with:

In `assets/station/index.html`:

```html
<link rel="stylesheet" href="station/station.css">
<link rel="stylesheet" href="station/tip.css">
<link rel="stylesheet" href="station/live-page.css">
<link rel="stylesheet" href="station/sessions-page.css">
<link rel="stylesheet" href="station/projects-page.css">
<link rel="stylesheet" href="station/project-page.css">
<link rel="stylesheet" href="station/session-page.css">
<link rel="stylesheet" href="station/session-dispatch.css">
<link rel="stylesheet" href="station/session-talk.css">
```

and, in the same file, replace the line `<script src="station/i18n.js"></script>` with:

In `assets/station/index.html`:

```html
<script src="station/i18n.js"></script>
<script src="station/tip.js"></script>
<script src="station/live-page.js"></script>
<script src="station/sessions-page.js"></script>
<script src="station/projects-page.js"></script>
<script src="station/project-page.js"></script>
<script src="station/session-page.js"></script>
<script src="station/session-dispatch.js"></script>
<script src="station/session-talk.js"></script>
```

4. Emit them and load the gate frame on the focus page. In `lib/station.js`, replace the comment and the `MODULES` line (`lib/station.js:1083-1086` at `fc25513a`, from `// The page's own modules` through `const MODULES = [...]`) with:

In `lib/station.js`:

```js
// The page's own modules, loaded by the shell between i18n.js and station.js,
// served and written beside them: the redesigned pages' (station redesign
// §1–§5) — tip.js and one script and one stylesheet a page, gate-frame for the
// focus page — then the four spend-*.js and the 手機遠端 card's remote-card.js.
const PAGE_MODULES = ['tip', 'live-page', 'sessions-page', 'projects-page', 'project-page', 'session-page', 'session-dispatch', 'session-talk', 'gate-frame'];
const MODULES = [...PAGE_MODULES.flatMap((n) => [n + '.js', n + '.css']), 'spend-talk.js', 'spend-kinds.js', 'spend-range.js', 'spend-panel.js', 'remote-card.js'];
```

and in `focusShell` (`lib/station.js:1044-1051`), replace the four lines from `+ '<link rel="stylesheet" href="/station/station.css">\n'` through `+ '<script src="/station/station.js"></script>\n'` so the function reads:

In `lib/station.js`:

```js
function focusShell(id, tab) {
    if (typeof id !== 'string' || !/^[0-9A-Za-z-]+$/.test(id) || !FOCUS_TABS.includes(tab)) return null;
    return '<!doctype html>\n<html lang="zh-Hant" data-style="keel"><head><meta charset="utf-8">\n'
        + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
        + '<title>fankeel ' + tab + ' · ' + id.slice(0, 8) + '</title>\n'
        + '<link rel="stylesheet" href="/station/station.css">\n'
        + '<link rel="stylesheet" href="/station/tip.css">\n'
        + '<link rel="stylesheet" href="/station/gate-frame.css">\n'
        + '</head><body class="focus">\n<div id="focus"></div>\n'
        + '<script>window.STATION_FOCUS = ' + JSON.stringify({ id, tab }) + ';</script>\n'
        + '<script src="/station/focus/' + id + '.js"></script>\n'
        + '<script src="/station/i18n.js"></script>\n'
        + '<script src="/station/tip.js"></script>\n'
        + '<script src="/station/gate-frame.js"></script>\n'
        + '<script src="/station/station.js"></script>\n'
        + '</body></html>\n';
}
```

5. Serve them. In `scripts/station.js`, replace the comment above `STATIC` and the `STATIC` line (`scripts/station.js:67-73` at `fc25513a`) with:

In `scripts/station.js`:

```js
// The files `serve` answers from ASSETS, by name: the page's own two, the
// language table, the four spend-*.js modules, the 手機遠端 card's
// remote-card.js, the redesigned pages' modules (tip, the five pages, the
// session page's two tabs and the gate frame, a script and a stylesheet
// each), the phone page's mobile.js and mobile.css, and the tour (`tour.html`
// and what it loads). A list, so nothing else under the plugin directory is
// reachable by url.
const PAGE_NAMES = 'tip|gate-frame|live-page|sessions-page|projects-page|project-page|session-page|session-dispatch|session-talk';
const STATIC = new RegExp('^/station/((?:station|i18n|mobile|remote-card|spend-[a-z]+|' + PAGE_NAMES + ')\\.js|(?:station|mobile|' + PAGE_NAMES + ')\\.css|tour(?:-[a-z]+)*\\.(?:js|css|html))$');
```

6. Update the spend modules' order test. In `tests/station-spend-route.test.js`, the shell-order assertion (`:91`) pins the scripts between `i18n.js` and the spend modules; the page modules now sit there. Replace

```
    assert.deepEqual(order, ['i18n.js'].concat(MODULES, ['remote-card.js', 'station.js']));
```

with

In `tests/station-spend-route.test.js`:

```js
    const PAGES = ['tip', 'live-page', 'sessions-page', 'projects-page', 'project-page', 'session-page', 'session-dispatch', 'session-talk'].map((n) => n + '.js');
    assert.deepEqual(order, ['i18n.js'].concat(PAGES, MODULES, ['remote-card.js', 'station.js']));
```

7. Run the new test and every test that pins the shell, the emitted list or the static list:

```
node --test tests/station-modules.test.js tests/station-spend-route.test.js tests/station-remote-mount.test.js tests/station-mobile-route.test.js tests/station-memo-static.test.js tests/station-focus.test.js tests/station-shell.test.js tests/station-serve.test.js tests/station.test.js
```

All pass: `station-remote-mount` still finds `remote-card.js` directly before `station.js`; `station-mobile-route` and `station-memo-static` still get 404 for `not-a-module.js` and `station-x.js`; `station.test.js`'s written-files check reads `EMITTED`.

8. Commit: `git add assets/station/index.html lib/station.js scripts/station.js tests/station-modules.test.js tests/station-spend-route.test.js` and `git commit -m "feat: shell, focus page, write and serve carry the page modules"` with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer.

## Task 16: Router sends each hash to its redesigned page

**Files:**
- Modify: `assets/station/station.js:5630-5770` — after `VIEWS.settings = settingsPage;` (`:5679` at `fc25513a`; Task 3's insertions move it down), the `VIEWS` entries for `now`, `live`, `sessions`, `cmp`, `projects`, `project` and `session` go to the loaded module and fall back to the old view
- Read: `tests/station-remote-mount.test.js:20-40` — the `draw(hash)` harness this task's test copies
- Test: `tests/station-redesign-routes.test.js`

**Interfaces:**
- Consumes: `window.FK_LIVE.page(S, o)` (Task 7); `window.FK_SESSIONS.page(S, o)` with `o.tray` true for `#/cmp` (Task 8); `window.FK_PROJECTS.page(S, o)` with `o.hash` the location hash, for `#/projects` and `#/projects/analysis/<angle>` (Task 9); `window.FK_PROJECT.page(S, pkey, o)` with `o.todo` from `#/p/<pkey>/todo[/<id>]` (Task 10); `window.FK_SESSION.page(s, x, o)` with `o.tab` and `o.talk` (Task 11). Every `o` carries `{ names, now, serve, redraw }`. Inside `station.js`: `parseHash`, `NAMES`, `NOW`, `S`, `draw`, `needDetail`, `DETAIL`, `TALK`, `talkLoad`.
- Produces: `#/` and `#/live` → the 進行中 page; `#/sessions` and `#/cmp` → the sessions page; `#/projects[/analysis/<angle>]` → the projects page; `#/p/<name>` → the project page; `#/s/<id>` with tab 經過 (`timeline`, and the old `cost`), 派工 or 對話 → the session page. The `plan`, `events` and `gate` tabs, a session not on the page, and any route whose module is not loaded draw the old view. The old renderers stay as that fallback: the shell loads every module (Task 15), so they are unreachable there, and the tests that boot `station.js` alone keep drawing them.

**Dispatch:** implementer, opus

1. Write the failing test.

In `tests/station-redesign-routes.test.js`:

```js
'use strict';
// The router (station redesign §1–§4): with the page modules loaded, each
// hash goes to its module, handed the station and { names, now, serve,
// redraw }; without them, and for the session tabs the redesign keeps (plan,
// events, gate), the old view draws. tests/station-remote-mount.test.js's
// draw(), with stand-in modules set on window before station.js runs, or the
// real ones run first.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const SRC = fs.readFileSync(path.join(ASSETS, 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-21T09:00:00.000Z');
const SID = 'acacacac-1313-4131-8131-131313131313';
const ROW = { id: SID, pkey: 'F:\\ws', root: 'F:\\ws', project: 'ws', task: 'route test', state: 'live', route: ['survey', 'build'], stage: 'build', stages: [],
    claims: [], notes: [], updated: NOW - 1000, started: new Date(NOW - 120000).toISOString(), days: [], usd: 1, agentUsd: 0, hasDetail: false };

function draw(hash, opts) {
    const o = opts || {};
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash, protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: false, nonce: 'N0NCE',
            projects: [{ root: 'F:\\ws', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [ROW] } };
    const box = vm.createContext({ window: win, document: doc, URLSearchParams, fetch: () => new Promise(() => {}), module: { exports: {} } });
    for (const f of o.files || []) {
        box.module = { exports: {} };
        vm.runInContext(fs.readFileSync(path.join(ASSETS, f), 'utf8'), box);
    }
    Object.assign(win, o.mods || {});
    box.module = { exports: {} };
    vm.runInContext(SRC, box);
    return els.page.innerHTML;
}
// A stand-in page module: keeps what it was handed and draws a marker.
function spy(name) {
    const told = [];
    return { told, page(...a) { told.push(a); return '<i id="mod-' + name + '"></i>'; } };
}
function common(o) {
    assert.equal(typeof o.names, 'object');
    assert.equal(typeof o.now, 'number');
    assert.equal(o.serve, false);
    assert.equal(typeof o.redraw, 'function');
}

test('#/ and #/live draw the 進行中 page', () => {
    for (const hash of ['#/', '#/live']) {
        const live = spy('live');
        assert.ok(draw(hash, { mods: { FK_LIVE: live } }).includes('<i id="mod-live"></i>'), hash);
        assert.equal(live.told[0][0].sessions[0].id, SID);
        common(live.told[0][1]);
    }
});

test('#/sessions draws the list, and #/cmp the list with its compare tray', () => {
    const a = spy('sessions');
    assert.ok(draw('#/sessions', { mods: { FK_SESSIONS: a } }).includes('<i id="mod-sessions"></i>'));
    assert.equal(a.told[0][1].tray, false);
    common(a.told[0][1]);
    const b = spy('sessions');
    assert.ok(draw('#/cmp', { mods: { FK_SESSIONS: b } }).includes('<i id="mod-sessions"></i>'));
    assert.equal(b.told[0][1].tray, true);
});

test('#/projects and its analysis angles draw the projects page, handed the hash', () => {
    for (const hash of ['#/projects', '#/projects/analysis/cost']) {
        const p = spy('projects');
        assert.ok(draw(hash, { mods: { FK_PROJECTS: p } }).includes('<i id="mod-projects"></i>'), hash);
        assert.equal(p.told[0][1].hash, hash);
        common(p.told[0][1]);
    }
});

test('#/p/<name> draws the project page, with its TODO panel when the hash asks for it', () => {
    const one = spy('project');
    assert.ok(draw('#/p/' + encodeURIComponent('F:\\ws'), { mods: { FK_PROJECT: one } }).includes('<i id="mod-project"></i>'));
    assert.equal(one.told[0][1], 'F:\\ws');
    assert.equal(one.told[0][2].todo, undefined);
    common(one.told[0][2]);
    const two = spy('project');
    draw('#/p/' + encodeURIComponent('F:\\ws') + '/todo', { mods: { FK_PROJECT: two } });
    assert.equal(two.told[0][2].todo, '');
});

test('#/s/<id> draws the session page for 經過, 派工 and 對話; the old 花費 tab is 經過', () => {
    for (const [hash, tab] of [['', 'timeline'], ['/cost', 'timeline'], ['/dispatch', 'dispatch'], ['/talk', 'talk']]) {
        const s = spy('session');
        assert.ok(draw('#/s/' + SID + hash, { mods: { FK_SESSION: s } }).includes('<i id="mod-session"></i>'), hash);
        const [row, x, o] = s.told[0];
        assert.equal(row.id, SID);
        assert.equal(x, null, 'no detail on this page');
        assert.equal(o.tab, tab, hash);
        common(o);
        if (tab === 'talk') assert.equal(o.talk.state, 'static', 'a file on disk cannot read the conversation');
    }
});

test('the plan, events and gate tabs, and a session not on the page, keep the old view', () => {
    for (const hash of ['#/s/' + SID + '/plan', '#/s/' + SID + '/events', '#/s/' + SID + '/gate']) {
        const s = spy('session');
        const html = draw(hash, { mods: { FK_SESSION: s } });
        assert.ok(html.includes('class="panel kshead"'), hash);
        assert.deepEqual(s.told, [], hash);
    }
    const s = spy('session');
    assert.ok(draw('#/s/ffffffff-0000', { mods: { FK_SESSION: s } }).includes('這頁上沒有 session'));
    assert.deepEqual(s.told, []);
});

test('without the modules every route draws the old view', () => {
    assert.ok(draw('#/live').includes('data-block="live-head"'));
    assert.ok(draw('#/s/' + SID).includes('class="panel kshead"'));
    assert.ok(!draw('#/sessions').includes('mod-'));
});

test('the real session page modules draw #/s/<id> and its 對話 tab', () => {
    const files = ['session-page.js', 'session-dispatch.js', 'session-talk.js'];
    const run = draw('#/s/' + SID, { files });
    assert.ok(run.includes('data-block="session-page"') && run.includes('data-block="session-run"'));
    assert.ok(!run.includes('class="panel kshead"'));
    assert.ok(draw('#/s/' + SID + '/talk', { files }).includes('要從 serve 開的頁面才讀得到對話'));
    assert.ok(draw('#/s/' + SID + '/dispatch', { files }).includes('data-block="session-tabs"'));
});
```

2. Run it and watch it fail (the stand-ins are never called):

```
node --test tests/station-redesign-routes.test.js
```

3. Route to the modules. In `assets/station/station.js`, directly below the line `VIEWS.settings = settingsPage;` (the `settingsPage` that draws the wizard and the 手機遠端 card), add:

In `assets/station/station.js`:

```js
    // The redesigned pages (station redesign §1–§4) are modules the shell
    // loads before this file: live-page.js, sessions-page.js, projects-page.js,
    // project-page.js, session-page.js. A route goes to its module when it is
    // loaded and to the view above when it is not, so this file still draws
    // every page on its own — the tests that boot station.js alone draw those.
    // `OLD` is the table as it stood; each module is handed the station and
    // what this file derives from it.
    function modOpts(extra) {
        return Object.assign({ names: NAMES, now: S.serve ? Date.now() : NOW, serve: Boolean(S.serve), redraw: draw }, extra);
    }
    var OLD = Object.assign({}, VIEWS);
    VIEWS.now = function (r) { return w.FK_LIVE ? w.FK_LIVE.page(S, modOpts()) : OLD.now(r); };
    VIEWS.live = function (r) { return w.FK_LIVE ? w.FK_LIVE.page(S, modOpts()) : OLD.live(r); };
    VIEWS.sessions = function (r) { return w.FK_SESSIONS ? w.FK_SESSIONS.page(S, modOpts({ tray: false })) : OLD.sessions(r); };
    // 比較 lands on the list with its compare tray, so it is never an empty page.
    VIEWS.cmp = function (r) { return w.FK_SESSIONS ? w.FK_SESSIONS.page(S, modOpts({ tray: true })) : OLD.cmp(r); };
    VIEWS.projects = function (r) {
        return w.FK_PROJECTS ? w.FK_PROJECTS.page(S, modOpts({ hash: String(w.location.hash || '') })) : OLD.projects(r);
    };
    VIEWS.project = function (r) { return w.FK_PROJECT ? w.FK_PROJECT.page(S, r.pkey, modOpts({ todo: r.todo })) : OLD.project(r); };
    // The session page has three tabs, 經過 / 派工 / 對話; the old 花費 tab is
    // 經過 now. 計畫, 事件 and 關卡 stay on the old page, as does a session
    // only the 花費 page knows (its 對話 is FK_PANEL.talkOnly's).
    var SESSION_TABS = ['timeline', 'cost', 'dispatch', 'talk'];
    VIEWS.session = function (r) {
        var s = S.sessions.filter(function (x) { return x.id === r.id; })[0];
        if (!w.FK_SESSION || !s || SESSION_TABS.indexOf(r.tab) < 0) return OLD.session(r);
        needDetail(s);
        var tab = r.tab === 'cost' ? 'timeline' : r.tab, talk;
        if (tab === 'talk') {
            if (S.serve && !TALK[s.id]) talkLoad(s.id, true);
            talk = S.serve ? TALK[s.id] : { turns: [], total: null, state: 'static' };
        }
        return w.FK_SESSION.page(s, DETAIL[s.id] || null, modOpts({ tab: tab, talk: talk }));
    };
```

4. Run it again and watch it pass:

```
node --test tests/station-redesign-routes.test.js
```

5. Run the tests that pin the old markup. They boot `station.js` without the modules, so every route falls back to the view they pin and none of them changes; each is named here because it pins a page this task reroutes — `#/` and `#/live` (`station-live-page`, `station-live`, `station-live-head`, `station-waiting`, `station-poll`, `station-boards-card`), `#/sessions`, `#/projects` and `#/p/<name>` (`station-pages`, `station-view`, `station-nav`, `station-record`, `station-todo-panel`), `#/cmp` (`station-compare`), `#/s/<id>` (`station-session-head`, `station-talk-page`, `station-plan-route`, `station-plan-tab`, `station-hdl-a`, `station-hdl-f`, `station-hdl-g`, `station-hdl-j`). `tests/station-home.test.js` is Task 3's and is not touched here.

```
node --test tests/station-live-page.test.js tests/station-live.test.js tests/station-live-head.test.js tests/station-waiting.test.js tests/station-poll.test.js tests/station-boards-card.test.js tests/station-pages.test.js tests/station-view.test.js tests/station-nav.test.js tests/station-record.test.js tests/station-todo-panel.test.js tests/station-compare.test.js tests/station-session-head.test.js tests/station-talk-page.test.js tests/station-plan-route.test.js tests/station-plan-tab.test.js tests/station-hdl-a.test.js tests/station-hdl-f.test.js tests/station-hdl-g.test.js tests/station-hdl-j.test.js tests/station-remote-mount.test.js
```

All pass unchanged; none is expected to change, because each boots `station.js` alone and the old views stay its fallback. If one fails, stop and report it BLOCKED with the failing assertion — do not edit a test outside this task's Files.

6. Commit: `git add assets/station/station.js tests/station-redesign-routes.test.js` and `git commit -m "feat: router sends each page to its redesigned module"` with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer.

## Coverage

| promise | task |
|---|---|
| `#/` and `#/live` both draw the page of `route-live-a.html`: one card, a subtab head 進行中 n \| 全部 n, then three groups | Task 7, Task 16 |
| A row is one link to `#/s/<id>`: the hexagon glyph (colour = state, lit segments = route walked, only the running stage pulses) | Task 7 |
| Two or more unnamed sessions fold into one `<details>` row 「N 個未命名」. | Task 7 |
| The hover peek shows only fields the row already has: stage, model, cost main · agent, started, last move, id8. | Task 7, Task 6 |
| `prefers-reduced-motion` stops the pulse. | Task 7 |
| `#/sessions` draws `route-sessions.html`: a now-strip linking to `#/live`, four period tiles (今天 / 近 7 天 / 近 30 天 / 全部) | Task 8, Task 16 |
| Filters are popovers for project, stage reached and cost floor, with 重設篩選. | Task 8 |
| Ticking two or three rows opens the compare dialog in place; `#/cmp` lands on this list with the compare tray | Task 8, Task 16 |
| The compare dialog shows the fields `lib/compare.js` already returns; the larger of each pair is marked, equal figures read 一樣. | Task 8 |
| `#/projects` draws the 總覽 tab of `route-projects.html`: one row a project, grouped 需要注意 | Task 9, Task 16 |
| A period control 7 / 30 / 90 days, default 30, drives every figure on the page. | Task 9 |
| `#/projects/analysis/<stall\|cost\|pace\|todo\|compare>` draws the 分析 tab, five angles | Task 9, Task 16 |
| `#/p/<name>` keeps its route and takes the project report layout: head, KPI tiles, weekly cost and landed trend | Task 10 |
| `#/s/<id>` draws `route-session.html`: a head with the task, project chip and three bars | Task 11 |
| Tabs are 經過 / 派工 / 對話; the old ten-round talk list is gone, replaced by 對話. | Task 11, Task 16 |
| 經過 is one row a stage: a 做事 / 等你 bar on one shared scale and a cost bar on one shared scale | Task 11 |
| 派工 is the dispatch view of `route-session.html`: one strip a stage with one chip an agent sized by cost and coloured by model | Task 12 |
| 對話 lists the transcript the station already loads (`station/talk/<id>`), every item expandable, 全部展開 / 收起 | Task 13 |
| The landed card shows the plan's tasks done and not done from `detail.tasksOf`, and opens a modal listing them | Task 11, Task 1 |
| The 關卡 link appears only while the session has `gateAt`. | Task 11 |
| `/f/<id>/gate` takes the frame of `gate-plan-a.html`: a head with no tabs, a main column for the stage's report | Task 14, Task 3 |
| Options show their label only; the description opens on click; keys 1–3 pick; a dialog open or focus in a field swallows the keys. | Task 14 |
| An archived plan is still found: `lib/detail.js` `planFileOf` accepts a plan under the archive bucket as well as the plan bucket | Task 1 |
| Session cost on every page is `usd + agentUsd`; no page reads `s.usd` alone as the session's cost. | Task 3, Tasks 7–13 |
| Home's Blocked count uses `lib/todo.js`'s `due` rule — `on:` from its date, otherwise seven days after the stamp | Task 2, Task 3 |
| `lib/spendrange.js` `report()` adds `byModel`: cost and token totals per model across the range | Task 4 |
| `lib/tailscale.js` gains `disable()`, running `tailscale serve --https=443 off`. | Task 5 |
| `scripts/station.js` calls it when `station.remote` is written off and when the station shuts down after having turned serve on | Task 5 |
| `docs/90-agent/reference/station.md` stops saying teardown is not done. | Task 5 |
