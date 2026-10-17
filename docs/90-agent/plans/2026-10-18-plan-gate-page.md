---
status: design-intent
---

# plan gate 頁 Implementation Plan

**Goal:** at the plan gate the user can see the plan they are approving — a `plan` tab on the station's session page draws its dispatch groups as columns of task cards, and the controlled plan stage prints and opens that page beside its question.
**Architecture:** `tasksOf` in `lib/detail.js` finds the claimed plan through the project's `role: plan` bucket and gives every task its parsed `Files`/`Dispatch` fields and a `waits` list taken from `plantasks.conflict` alone. `assets/station/station.js` draws that as a new `plan` tab (pure `planTabHtml`, listeners added on first use), styled by a block appended to `station.css`. `scripts/await.js` prints a `page:` line under a plan-stage handoff when `lib/serve.js` probes a live station, and the plan controller rule in `lib/stages.js` prints it above the gate and opens it in a browser pane.
**Tech Stack:** Node `>=22.5`, CommonJS, `node --test`, no dependencies; the station page is hand-written ES5-style browser JS and CSS with no build step.
**Spec:** 2026-10-18-plan-gate-page-design.md

## Global Constraints

- Node `>=22.5` (`package.json` `engines.node`); CommonJS with `'use strict';` as each file's first line; `package.json` is `"private": true` with no `dependencies` key, and no dependency may be added (CONTRIBUTING.md, Issue first: "no new dependency"; `assets/station/station.js:8-9`: "this repository carries no dependencies").
- Tests are `node --test`: `npm test` is `node --test --require ./tests/subprocess-timeout.js`, `npm run test:fast` is `node --test --test-skip-pattern=@slow --require ./tests/subprocess-timeout.js`; one file runs as `node --test --require ./tests/subprocess-timeout.js tests/<file>` (README.md:262); never two suites at once (README.md:260).
- There is no `CLAUDE.md` in this repository; CONTRIBUTING.md holds the conventions: `lib/*.js` are pure functions tested directly and nothing in `lib/` reaches into `scripts/` or `hooks/`; `scripts/*.js` are thin wrappers over `lib/`.
- A new test file must be staged (`git add`) before `tests/source.test.js` can see it, and every exported name needs an importer (CONTRIBUTING.md, Tests row).
- Indentation follows the file: 4 spaces in `lib/`, `scripts/`, `assets/station/`, `tests/detail-tasks.test.js`, `tests/await.test.js` and `tests/station-*.test.js`; 2 spaces in `tests/stages.test.js`.
- `station.css` is copied verbatim beside every written page: "nothing in here may reference the plugin directory, and nothing is fetched from anywhere" (`assets/station/station.css:3-4`). `assets/station/index.html:2` is `data-style="keel"`, so the `:root[data-style=keel]` tokens (`--keel`, `--keel-tint`, `--keel-deep`, `--lift`, `--r-sm`) apply.
- In `station.js` everything above the `module.exports` guard (`assets/station/station.js:2721`) is pure; a function declared further down is exported with `if (typeof module !== 'undefined' && module.exports) module.exports.<name> = <name>;` (the pattern at `:3117`).
- Load-time document listeners are pinned by position — `KEY_FBAR = 4, KEY_BIG = 6, KEY_GATE = 7, CLICK_WZ = 8` (`tests/station-hdl-c.test.js:20`) — so a listener the plan tab needs is added on its first draw, the way `talkLoad` adds its click listener (`assets/station/station.js:3858-3865`), never at load.
- i18n: every CJK string literal in `station.js` is the Chinese of a `loc('<prefix>.<key>', '<zh>'` call written with exactly that spacing (`tests/station-i18n.test.js:69`, regex `KEYED`); a key's prefix is its section's — `det` from `// ---- the detail panel` (`:4166`) to `// ---- 派工:` (`:4528`), `ses` from `:944` to `:1489`; every key has an English entry in `assets/station/i18n.js` with no CJK character, and every English entry is used (`tests/station-i18n.test.js:84`).
- `.pg` already belongs to the pending gate (`assets/station/station.css:1328-1336`; `station.js` `'.pg [data-pg-other]'`), so the mockup's `pg-` classes land as `pv-`, and the mockup's bare `.files`, `.read`, `.interface` are scoped under `.pv`.
- The session tabs' href list is asserted exactly at `tests/station-view.test.js:894-895`.
- A controlled stage's block stays under 2400 characters at the reference root (`tests/render.test.js:801`); `plan renderResume` measures 2091 today.
- Plan sizes: `READ_CAP` 1500 lines across a task's `Modify:` files and `FILE_CAP` 3 `Modify:` entries (`lib/plantasks.js:353-354`).
- `plantasks.conflict(a, b)` returns `'undeclared' | 'files' | 'read' | 'interface' | null`, comparing paths with any `:a-b` suffix stripped (`lib/plantasks.js:164-195`); nothing else computes an edge.
- Filing (`.fankeel/map.md`): `docs/90-agent/plans` is `plan`, `docs/90-agent/reference` is `reference`, `docs/99-archive` is `archive`; this repository's `.fankeel/docs.json` declares no `docs/plans`.
- `dispatch.floor` is `sonnet` (builtin); this task's class is `architectural`, so `dispatchFor` raises the floor to `opus` at effort `high` (`lib/profile.js:290-294`).
- The serve record is `<configDir>/fankeel/serve.json` `{ pid, port, url }` with `url` ending in `/` (`lib/serve.js:22-30`, `scripts/station.js:728`); `probe(record, timeoutMs)` resolves false for no record, a dead pid, another pid or silence, 500 ms by default (`lib/serve.js:81-117`).
- Version numbers move only through `scripts/version.js` (CONTRIBUTING.md); no task here touches one.

## Risks

- `tasksOf`'s return shape grows (new task fields, entries with `error`) — Task 1 and Task 3 — Task 1 updates the exact `deepEqual` in `tests/detail-tasks.test.js`; Task 3 makes `tasksHtml` and the dispatch-order hint lines skip `error` entries before anything else reads them.
- A new `keydown` listener registered at load would shift the positions `tests/station-hdl-c.test.js` presses — Task 3 — its listeners are added in `planListen()` on the first draw of the tab; run `tests/station-hdl-c.test.js` after the change.
- The station redraws on every poll, which would wipe a hover drawn only in the DOM — Task 3 — the lit task is kept in `planAt` and `planTabHtml` renders it, so a redraw draws the same lit state.
- The controlled plan block's 2400 cap — Task 2 — run the cap test in `tests/render.test.js` by name after adding the rule.
- Task 3's test reads the archived `docs/99-archive/2026-10-18-deny-posix-helpers.md`; its expectations are computed from `plantasks` on that file rather than typed in, so they hold whatever its edges are — Task 3.
- Whether opening the pane before `AskUserQuestion` lands in front of the question in Claude Desktop is not verified (design, Not verified) — Task 2 — the rule's text is all a test can hold; the order is checked live at verify.

## Task 1: `tasksOf` finds the plan by its bucket and gives each task its fields and `waits`

**Files:**
- Modify: `lib/detail.js` — `tasksOf` finds plans through `docs.roleOf`; new `waitsOf`; each task carries `modify`, `test`, `read`, `dispatch`, `model`, `effort`, `waits`; unreadable and taskless plans are listed with `error`
- Read: `lib/plantasks.js` — `parseTasks`, `conflict`, `surfaces`
- Read: `lib/docs.js` — `read(root)`, `roleOf(tree, rel)`, `projectRootsFor(root, paths)`
- Read: `lib/registry.js` — `claimsOf(data)`
- Test: `tests/detail-tasks.test.js`

**Interfaces:**
- Consumes: `plantasks.parseTasks(text)`, `plantasks.conflict(a, b)`, `docs.read(root) -> { tree }`, `docs.roleOf(tree, rel) -> string | null`, `docs.projectRootsFor(root, paths) -> string[]`
- Produces: `tasksOf(root, data, rows) -> Array<{ plan: string, ledgerLines: number, tasks: Array<{ n, title, status, range, turns, modify: string[], test: string[], read: string[], dispatch: string | null, model: string, effort: string, waits: Array<{ n: number, kind: string, file: string | null }> }>, groups, unmatched } | { plan: string, error: 'unreadable' | 'no tasks', ledgerLines: 0, tasks: [], groups: [], unmatched: [] }>`, `waitsOf(tasks) -> Array<Array<{ n, kind, file }>>`

**Dispatch:** implementer, opus, high — the architectural floor; the plan carries the code.

1. Write the failing tests. In `tests/detail-tasks.test.js`, replace the `tasks: [ ... ]` array of the first test's expected value with:

In `tests/detail-tasks.test.js`, first test, expected `tasks`:
```js
        tasks: [
            { n: 1, title: 'one', status: 'complete', range: 'abc1234..def5678', turns: [4], modify: ['a.js'], test: [], read: [], dispatch: null, model: '', effort: '', waits: [] },
            { n: 2, title: 'two', status: 'no ledger line', range: null, turns: [6], modify: ['b.js'], test: [], read: [], dispatch: null, model: '', effort: '', waits: [] },
            { n: 3, title: 'three', status: 'no ledger line', range: null, turns: [], modify: ['a.js'], test: [], read: [], dispatch: null, model: '', effort: '', waits: [{ n: 1, kind: 'files', file: 'a.js' }] },
        ],
```

Then append to the end of `tests/detail-tasks.test.js`:

In `tests/detail-tasks.test.js`, at the end:
```js
// plan gate page §1: the plan is found through the project's own `role: plan`
// bucket, so a repository filing plans under docs/90-agent/plans gets its
// task list — the docs/plans/ pattern this replaced returned nothing there.
test('a plan in the project\'s role: plan bucket is found, and a task that modifies an earlier task\'s file waits on it', () => {
    const root = tmp('fankeel-tasks-');
    fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [{ path: 'docs/90-agent/plans', role: 'plan' }] }));
    fs.mkdirSync(path.join(root, 'docs', '90-agent', 'plans'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', '90-agent', 'plans', 'x.md'), '# X\n\n' + task(1, 'one', 'lib/a.js') + task(2, 'two', 'lib/a.js'));
    const got = detail.tasksOf(root, { claims: ['docs/90-agent/plans/x.md'] }, []);
    assert.equal(got.length, 1);
    assert.equal(got[0].plan, 'docs/90-agent/plans/x.md');
    assert.deepEqual(got[0].tasks.map((t) => t.waits), [[], [{ n: 1, kind: 'files', file: 'lib/a.js' }]]);
    assert.deepEqual(got[0].tasks[1].modify, ['lib/a.js']);
    // The control: without the docs.json that files it, the same path is in no plan bucket.
    fs.unlinkSync(path.join(root, '.fankeel', 'docs.json'));
    assert.deepEqual(detail.tasksOf(root, { claims: ['docs/90-agent/plans/x.md'] }, []), []);
});

test('waitsOf names what each refused pair shares — the read path, the interface name, nothing for a task with no files — and tasks carry their Dispatch fields', () => {
    const plan = [
        '## Task 1: make', '', '**Files:**', '- Modify: `lib/a.js:10-40`', '', '**Interfaces:**', '- Consumes: none', '- Produces: `frob`', '',
        '**Dispatch:** implementer, opus, high — reasons.', '',
        '## Task 2: read it', '', '**Files:**', '- Modify: `lib/b.js`', '- Read: `lib/a.js`', '', '**Interfaces:**', '- Consumes: none', '- Produces: none', '',
        '## Task 3: use it', '', '**Files:**', '- Modify: `lib/c.js`', '', '**Interfaces:**', '- Consumes: `frob`', '- Produces: none', '',
        '## Task 4: nothing', '', '**Interfaces:**', '- Consumes: none', '- Produces: none', '',
    ].join('\n');
    const root = repo();
    fs.writeFileSync(path.join(root, 'docs', 'plans', '2026-09-11-y.md'), plan);
    const [p] = detail.tasksOf(root, { claims: ['docs/plans/2026-09-11-y.md'] }, []);
    assert.deepEqual(p.tasks.map((t) => t.waits), [
        [],
        [{ n: 1, kind: 'read', file: 'lib/a.js' }],
        [{ n: 1, kind: 'interface', file: 'frob' }],
        [{ n: 1, kind: 'undeclared', file: null }, { n: 2, kind: 'undeclared', file: null }, { n: 3, kind: 'undeclared', file: null }],
    ]);
    assert.deepEqual([p.tasks[0].dispatch, p.tasks[0].model, p.tasks[0].effort], ['implementer', 'opus', 'high']);
    assert.deepEqual(p.tasks[1].read, ['lib/a.js']);
    assert.deepEqual(detail.waitsOf([]), []);
});

test('a claimed plan that will not open, or holds no task, is listed with the reason rather than dropped', () => {
    const root = repo();
    // A directory named like a plan: it is there, and it does not read as a file.
    fs.mkdirSync(path.join(root, 'docs', 'plans', '2026-09-11-dir.md'));
    fs.writeFileSync(path.join(root, 'docs', 'plans', '2026-09-11-empty.md'), '# Empty\n\nno tasks here\n');
    assert.deepEqual(detail.tasksOf(root, { claims: ['docs/plans/2026-09-11-dir.md', 'docs/plans/2026-09-11-empty.md'] }, []), [
        { plan: 'docs/plans/2026-09-11-dir.md', error: 'unreadable', ledgerLines: 0, tasks: [], groups: [], unmatched: [] },
        { plan: 'docs/plans/2026-09-11-empty.md', error: 'no tasks', ledgerLines: 0, tasks: [], groups: [], unmatched: [] },
    ]);
});
```

2. Run it and watch it fail:

```
node --test --require ./tests/subprocess-timeout.js tests/detail-tasks.test.js
```

Expected: the first test fails on the missing task fields, the new ones on an empty result and `detail.waitsOf is not a function`.

3. Write the implementation. In `lib/detail.js`, add `const docs = require('./docs.js');` after `const plantasks = require('./plantasks.js');`. Then replace everything from `const PLAN = /(^|[\\/])docs[\\/]plans[\\/][^\\/]+\.md$/;` through the end of `function tasksOf` (the line `    return out;\n}` before `// ---- by day`) with:

In `lib/detail.js`, the tasks section:
```js
const TASK_REF = /\btask\s+(\d+)\b/i;

// The plan bucket of a project whose docs.json declares none: `docs/plans`,
// the flat and phased presets' spelling — the same fallback `lib/render.js`'s
// `planDir` takes.
const NO_TREE = { buckets: [{ path: 'docs/plans', role: 'plan' }] };

// The file a claim names when it is a plan: a markdown file on disk, filed
// under the project's own `role: plan` bucket (`docs.roleOf`), and not the
// design beside it. A claim may be written from the registry root or from the
// project, so both are tried, as before; the bucket test is on the path
// relative to the project, which is where docs.json's buckets are rooted.
function planFileOf(root, data, tree, projectRoot, claim) {
    if (!/\.md$/.test(claim) || /-design\.md$/.test(claim)) return null;
    const candidates = [path.resolve(root, claim)];
    if (data && data.project) candidates.push(path.resolve(root, data.project, claim));
    const file = candidates.find((f) => fs.existsSync(f));
    if (!file) return null;
    const rel = path.relative(projectRoot, file).split(path.sep).join('/');
    return docs.roleOf(tree || NO_TREE, rel) === 'plan' ? file : null;
}

// A `Files:` path without the `:12` or `:12-40` it may end in — the strip
// `plantasks.conflict` reads every path through, so the two agree on "same file".
const barePath = (p) => String(p || '').replace(/:\d+(-\d+)?$/, '');
const firstShared = (x, y, norm) => {
    const f = norm || ((p) => p);
    const ys = (y || []).map(f);
    return (x || []).map(f).find((p) => ys.includes(p)) || null;
};

// What a refused pair shares, once `plantasks.conflict` has named the
// predicate: the path both touch for `files`, the path one reads while the
// other changes it for `read`, the identifier one produces and the other
// consumes for `interface`, and nothing for `undeclared`. The verdict is
// plantasks' alone; this only names its evidence, for the page to say why.
function sharedOf(a, b, kind) {
    if (kind === 'files') {
        for (const [x, y] of [[a.modify, b.modify], [a.modify, b.test], [a.test, b.modify], [a.test, b.test]]) {
            const hit = firstShared(x, y, barePath);
            if (hit) return hit;
        }
        return null;
    }
    const owned = (t) => [...t.modify, ...t.test];
    if (kind === 'read') return firstShared(a.read, owned(b), barePath) || firstShared(b.read, owned(a), barePath);
    if (kind === 'interface') return firstShared(a.consumes, b.produces) || firstShared(b.consumes, a.produces);
    return null;
}

// For each task in plan order, every earlier task it may not run beside, as
// `{ n, kind, file }` with `kind` the word `plantasks.conflict` returned.
// Every earlier task, not only the one before it: the station's plan tab draws
// one 等 line per refused pair, so its lines and plantasks' refusals are one
// count (docs/90-agent/plans/2026-10-18-plan-gate-page-design.md §1).
function waitsOf(tasks) {
    return tasks.map((t, i) => tasks.slice(0, i).map((e) => {
        const kind = plantasks.conflict(e, t);
        return kind ? { n: e.n, kind, file: sharedOf(e, t, kind) } : null;
    }).filter(Boolean));
}

// A claimed plan with nothing to draw, said rather than dropped: `unreadable`
// for a file that is there and will not open, `no tasks` for one with no
// `## Task N:` heading. A claim whose file is gone is still skipped.
const unusable = (plan, error) => ({ plan, error, ledgerLines: 0, tasks: [], groups: [], unmatched: [] });

// The plan this session built from, per plan it claimed: its tasks with what
// the ledger says of each, the groups `plantasks` would dispatch them in, and
// the parallel hint. A task unfinished has no `Task` line in the ledger, so
// the rows come from the plan and such a task reads `no ledger line` rather
// than a guess. A dispatch is tied to a task by `task N` in its label and by
// nothing else; the ones that name no task are listed, not guessed at. Each
// task also carries what the plan declared of it — its files, its Dispatch
// line's fields — and `waits`, for the station's plan tab.
function tasksOf(root, data, rows) {
    const out = [];
    const projectRoot = docs.projectRootsFor(root, data && data.project ? [data.project] : [])[0] || root;
    const { tree } = docs.read(projectRoot);
    for (const claim of registry.claimsOf(data)) {
        const planFile = planFileOf(root, data, tree, projectRoot, claim);
        if (!planFile) continue;
        const text = readText(planFile);
        if (text === null) { out.push(unusable(claim, 'unreadable')); continue; }
        const tasks = plantasks.parseTasks(text);
        if (!tasks.length) { out.push(unusable(claim, 'no tasks')); continue; }
        const waits = waitsOf(tasks);
        const lines = ledger.completions(readText(ledger.ledgerPath(root, claim)) || '');
        const done = new Map(lines.map((c) => [c.n, c]));
        const turns = new Map();
        const unmatched = new Set();
        for (const r of rows || []) {
            const m = TASK_REF.exec(r.label || '');
            const n = m ? Number(m[1]) : null;
            if (n === null || !tasks.some((t) => t.n === n)) {
                unmatched.add(r.label || r.id);
                continue;
            }
            if (!turns.has(n)) turns.set(n, new Set());
            if (Number.isFinite(r.turn)) turns.get(n).add(r.turn);
        }
        const sorted = (set) => [...(set || [])].sort((a, b) => a - b);
        out.push({
            plan: claim,
            ledgerLines: lines.length,
            tasks: tasks.map((t, i) => ({
                n: t.n, title: t.name,
                status: done.has(t.n) ? 'complete' : 'no ledger line',
                range: done.has(t.n) ? done.get(t.n).range : null,
                turns: sorted(turns.get(t.n)),
                modify: t.modify, test: t.test, read: t.read,
                dispatch: t.dispatch, model: t.model, effort: t.effort,
                waits: waits[i],
            })),
            groups: plantasks.surfaces(tasks).map((g, i) => {
                const seen = new Set();
                for (const n of g.tasks) for (const t of turns.get(n) || []) seen.add(t);
                return { g: i + 1, tasks: g.tasks, surface: g.surface, turns: sorted(seen), hint: g.tasks.length > 1 && seen.size > 1 };
            }),
            unmatched: [...unmatched],
        });
    }
    return out;
}
```

And in the `module.exports` at the end of `lib/detail.js`, change `risesOf, tasksOf, cachePath,` to `risesOf, tasksOf, waitsOf, cachePath,`.

4. Run it and watch it pass:

```
node --test --require ./tests/subprocess-timeout.js tests/detail-tasks.test.js
```

Expected: 5 tests pass.

5. Commit: `feat(detail): tasksOf finds plans by the project's plan bucket and names what each task waits for`.

## Task 2: `await.js` prints the plan page under a plan-stage handoff, and the controller opens it

**Files:**
- Modify: `scripts/await.js` — `pageLine(o)`; `waitFor` carries `stage`, `session`, `configDir`; `main` appends the `page:` line on a plan handoff
- Modify: `lib/stages.js` — `PAGE_RULE`, in the controlled block for `plan` only
- Modify: `docs/90-agent/reference/subagents.md:588-630` — the controller's block row and "How the controller waits" gain the `page:` line
- Read: `lib/serve.js` — `readServeRecord(configDir)`, `probe(record, timeoutMs)`
- Read: `lib/handoff.js` — `workflowOf(file)`
- Read: `lib/detail.js` — `scripts/await.js` requires its `transcriptOf`, and Task 1 changes this file (and `lib/detail.js` requires `lib/stages.js`), so the two go one after the other
- Test: `tests/await.test.js`
- Test: `tests/stages.test.js`

**Interfaces:**
- Consumes: `readServeRecord(configDir) -> { pid, port, url } | null`, `probe(record, timeoutMs) -> Promise<boolean>`, `workflowOf(file) -> string | null`
- Produces: the await output contract — a plan-stage `handoff` line followed by `\npage: <serve url>#/s/<session id>/plan` when a station answers; `PAGE_RULE` in `controlFor('plan', ...)`'s rules

**Dispatch:** implementer, opus, high — the architectural floor; the plan carries the code.

1. Write the failing tests. In `tests/await.test.js`, add `const http = require('node:http');` after `const { spawnSync } = require('node:child_process');`, then append at the end of the file:

In `tests/await.test.js`, at the end:
```js
// plan gate page §3: a station answering /station/health for this process's
// pid, the way scripts/station.js answers it — all lib/serve.js's probe asks.
function station() {
    const server = http.createServer((req, res) => {
        if (req.url !== '/station/health') { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ station: true, pid: process.pid }));
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
        port: server.address().port,
        url: 'http://127.0.0.1:' + server.address().port + '/',
        close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }),
    })));
}
function serveRecord(config, s) {
    fs.mkdirSync(path.join(config, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(config, 'fankeel', 'serve.json'), JSON.stringify({ pid: process.pid, port: s.port, url: s.url }));
}

test('a plan-stage handoff prints a page: line under it when the station answers, and no such line when none does', async () => {
    const f = fixture({ stage: 'plan', moves: [['plan', 1]] });
    at(path.join(f.task, 'plan.md'), Date.now());
    const alone = await awaitCli.main(['--session', SID, '--root', f.root], f.env);
    assert.match(alone.text, new RegExp('^handoff ' + f.task + '/plan\\.md — '));
    assert.doesNotMatch(alone.text, /page: /, 'no serve.json: the gate is asked as before');
    const s = await station();
    try {
        serveRecord(f.config, s);
        const out = await awaitCli.main(['--session', SID, '--root', f.root], f.env);
        const lines = out.text.split('\n');
        assert.match(lines[0], new RegExp('^handoff ' + f.task + '/plan\\.md — '));
        assert.equal(lines[1], 'page: ' + s.url + '#/s/' + SID + '/plan');
        assert.equal(lines.length, 2);
        const b = fixture({});
        at(path.join(b.task, 'build.md'), Date.now());
        serveRecord(b.config, s);
        const build = await awaitCli.main(['--session', SID, '--root', b.root], b.env);
        assert.doesNotMatch(build.text, /page: /, 'only the plan stage gets the page');
    } finally {
        await s.close();
    }
    const gone = await awaitCli.main(['--session', SID, '--root', f.root], f.env);
    assert.doesNotMatch(gone.text, /page: /, 'a serve.json nobody answers for prints no line');
});
```

In `tests/stages.test.js`, at the end:
```js
// plan gate page §3: the plan gate asks about tasks nobody has seen, so the
// controlled plan block prints await's page: line above it and opens the
// page in a browser pane first; no other stage's block mentions it.
test('only the controlled plan stage prints the await page: line above its gate and opens it in a browser pane', () => {
  const { controlFor } = require('../lib/stages.js');
  const all = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
  for (const stage of all) {
    const text = controlFor(stage, { 'stage.agents': all }, { handoff: '/r/h.md' }).rules.join('\n');
    if (stage === 'plan') {
      assert.match(text, /an await `page: <url>` line goes above the gate as printed/);
      assert.match(text, /with a browser-pane tool, open that url there before AskUserQuestion/);
    } else {
      assert.doesNotMatch(text, /page: <url>/, stage);
    }
  }
});
```

2. Run them and watch them fail:

```
node --test --require ./tests/subprocess-timeout.js tests/await.test.js tests/stages.test.js
```

Expected: the new await test fails on `lines[1]` being undefined; the new stages test fails on the missing rule.

3. Write the implementation. In `scripts/await.js`, add after `const { configDirOf } = require('../lib/profile.js');`:

In `scripts/await.js`, requires:
```js
const { readServeRecord, probe } = require('../lib/serve.js');
```

In `scripts/await.js`, in `waitFor`, replace its last line `    return { root, handoff, commit: commitCandidates(root, data, lap, group), since, agentId, group, lap, kind, activity, idleMs: opts.idle * 1000, timeoutMs: opts.timeout * 1000 };` with:

In `scripts/await.js`, `waitFor`'s return:
```js
    return {
        root, handoff, commit: commitCandidates(root, data, lap, group), since, agentId, group, lap, kind, activity,
        idleMs: opts.idle * 1000, timeoutMs: opts.timeout * 1000,
        stage: data.stage, session: opts.session, configDir: data.configDir || configDirOf(env),
    };
```

In `scripts/await.js`, directly after `function lineFor` ends, add:
```js
// plan gate page §3 (docs/90-agent/plans/2026-10-18-plan-gate-page-design.md):
// a plan stage's report asks the user to approve tasks they have not seen, so
// with a station answering — the record in `<configDir>/fankeel/serve.json`,
// probed for half a second — the handoff line gains the station's plan tab
// for this session on a line of its own. No record, no answer, any other
// stage, or a workflow hand-over: nothing more, and the gate is asked as before.
function pageLine(o) {
    if (o.stage !== 'plan' || workflowOf(o.handoff)) return Promise.resolve('');
    const record = readServeRecord(o.configDir);
    if (!record || typeof record.url !== 'string') return Promise.resolve('');
    const base = record.url.endsWith('/') ? record.url : record.url + '/';
    return probe(record).then((up) => (up ? '\npage: ' + base + '#/s/' + encodeURIComponent(o.session) + '/plan' : ''), () => '');
}
```

In `scripts/await.js`, in `main`, replace `        return { text: lineFor(state, o, state === 'commit' ? newestCommit(o.commit, o.since) : null) };` with:
```js
        const line = lineFor(state, o, state === 'commit' ? newestCommit(o.commit, o.since) : null);
        return state === 'handoff' ? pageLine(o).then((page) => ({ text: line + page })) : { text: line };
```

In `lib/stages.js`, after the `const AWAIT_RULE = ...;` line, add:
```js
// plan gate page §3: the plan gate asks about tasks the user has not seen.
// `scripts/await.js` prints `page: <url>` under a plan handoff when a station
// answers; the controller prints it where the user reads the question and,
// with a browser pane to hand, opens it there first. No line, no change.
const PAGE_RULE = 'Plan only: an await `page: <url>` line goes above the gate as printed; with a browser-pane tool, open that url there before AskUserQuestion.';
```

In `lib/stages.js`, in `controlRules`, replace:
```text
    AWAIT_RULE,
    'When it returns a path
```
In `lib/stages.js`, with:
```js
    AWAIT_RULE,
    ...(stage === 'plan' ? [PAGE_RULE] : []),
    'When it returns a path
```
(only the two lines change; the rest of that string stays as it is).

In `docs/90-agent/reference/subagents.md`, in the controller's block row, replace `and does what its one line says (below);` with:
```md
and does what its one line says (below) — on `plan`, a `page:` line under the handoff is printed above the gate and, with a browser-pane tool, opened there before asking;
```

In `docs/90-agent/reference/subagents.md`, under "How the controller waits", replace `or \`timeout\` after thirty. A second await` with:
```md
or `timeout` after thirty. On `plan`, a `handoff` line is followed by a second, `page: <url>#/s/<id>/plan`, when the station recorded in `<configDir>/fankeel/serve.json` answers `lib/serve.js`'s `probe` within half a second: the station's plan tab for that session, which the controlled plan block prints above the gate and opens in a browser pane where there is one. No record, or no answer, and there is no second line. A second await
```

4. Run them and watch them pass, then the cap:

```
node --test --require ./tests/subprocess-timeout.js tests/await.test.js tests/stages.test.js
node --test --require ./tests/subprocess-timeout.js --test-name-pattern="2,400-character cap" tests/render.test.js
```

Expected: all pass; the cap test's diagnostic for `plan renderResume` reads under 2400.

5. Commit: `feat(await): plan handoff carries the station's plan page; the plan controller opens it beside the gate`.

## Task 3: the plan tab's view — `planTabHtml`, its focus, its CSS and its strings

**Files:**
- Modify: `assets/station/station.js:4425-4495` — `tasksHtml` and the hint lines skip `error` entries; new `planTabHtml`, `planRel`, `planTab`, `planFocus`, `planListen` after `tasksHtml`
- Modify: `assets/station/station.css:2266-2277` — the plan tab's block appended at the end
- Modify: `assets/station/i18n.js:780-791` — English for every new `det.plan*` key
- Read: `lib/detail.js` — `tasksOf(root, data, rows)`, the shape the tab draws
- Read: `lib/plantasks.js` — `parseTasks`, `conflict`, for the test's own count
- Read: `.fankeel/build/2026-10-18-plan-gate-page/mockup.html` — the approved markup the code below transcribes
- Test: `tests/station-plan-tab.test.js`

**Interfaces:**
- Consumes: `tasksOf(root, data, rows)` and its task fields `modify`, `test`, `read`, `dispatch`, `model`, `effort`, `waits: [{ n, kind, file }]`, and its `{ plan, error }` entries
- Produces: `planTabHtml(s, list, focus) -> string` (inner HTML of the tab's panel; `focus` a task number or null), `planRel(p, f) -> { pre: number, post: number, rel: { [n]: { cls, text } }, focus: string }`, `planTab(s, x) -> string` (registers the tab's listeners once, renders with the lit task kept across redraws)

**Dispatch:** implementer, opus, high — the architectural floor; the plan carries the code.

1. Write the failing test, a new file:

In `tests/station-plan-tab.test.js`:
```js
'use strict';
// The plan tab (docs/90-agent/plans/2026-10-18-plan-gate-page-design.md §2),
// drawn from what lib/detail.js's tasksOf returns for a real archived plan:
// one card per task, one 等 line per pair plantasks.conflict refuses, the
// banner only at the plan stage, the lit card's neighbours, and the three
// states with nothing to draw.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const detail = require('../lib/detail.js');
const plantasks = require('../lib/plantasks.js');
const tmp = require('./tmp.js');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const V = require('../assets/station/station.js');

const REAL = path.join(__dirname, '..', 'docs', '99-archive', '2026-10-18-deny-posix-helpers.md');
const count = (s, re) => (s.match(re) || []).length;

// The real plan, claimed by a session in a scratch repository, read back the way the station reads it.
function claimed() {
    const root = tmp('fankeel-plan-tab-');
    fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
    fs.copyFileSync(REAL, path.join(root, 'docs', 'plans', 'x.md'));
    return detail.tasksOf(root, { claims: ['docs/plans/x.md'] }, []);
}

test('one 等 line per earlier-later pair plantasks.conflict refuses, one card per task, one column per group', () => {
    const tasks = plantasks.parseTasks(fs.readFileSync(REAL, 'utf8'));
    let refused = 0;
    for (let i = 0; i < tasks.length; i++) for (let j = 0; j < i; j++) if (plantasks.conflict(tasks[j], tasks[i])) refused++;
    const list = claimed();
    const html = V.planTabHtml({ stage: 'plan' }, list, null);
    assert.ok(refused > 0, 'the fixture plan has dependencies to draw');
    assert.equal(count(html, /<li class="pv-dep /g), refused);
    assert.equal(count(html, /<article class="pv-card[ "]/g), tasks.length);
    assert.equal(count(html, /data-block="group-g\d+"/g), list[0].groups.length);
    assert.equal(count(html, /class="pv-then"/g), list[0].groups.length - 1);
    assert.doesNotMatch(html, /<line\b/, 'no edge is drawn as a line');
});

test('the banner puts the gate question with its counts at the plan stage, and is gone at any other', () => {
    const list = claimed();
    const p = list[0];
    const edges = p.tasks.reduce((s, t) => s + t.waits.length, 0);
    const at = V.planTabHtml({ stage: 'plan' }, list, null);
    assert.match(at, /data-block="gate-banner"/);
    assert.match(at, new RegExp('plan gate：要用這 ' + p.tasks.length + ' 個 task 進 build 嗎？'));
    assert.match(at, new RegExp('<b>' + p.groups.length + '</b>組，依序跑'));
    assert.match(at, new RegExp('<b>' + edges + '</b>條相依'));
    const models = {};
    for (const t of p.tasks) if (t.dispatch === 'implementer') models[t.model] = (models[t.model] || 0) + 1;
    for (const m of Object.keys(models)) assert.ok(at.includes(m + ' × ' + models[m]), m);
    assert.match(at, /回答在 Claude Desktop 那邊給/);
    assert.match(at, /docs\/plans\/x\.md/);
    const after = V.planTabHtml({ stage: 'build' }, list, null);
    assert.doesNotMatch(after, /gate-banner/);
    assert.equal(count(after, /<li class="pv-dep /g), edges, 'the same page without the banner');
});

test('the legend counts each of the three kinds, and a kind the plan has none of says so', () => {
    const list = claimed();
    const by = {};
    for (const t of list[0].tasks) for (const w of t.waits) by[w.kind] = (by[w.kind] || 0) + 1;
    const html = V.planTabHtml({ stage: 'build' }, list, null);
    for (const k of ['files', 'read', 'interface']) {
        if (by[k]) assert.match(html, new RegExp('<span class="pv-li ' + k + '">.*?<small>' + by[k] + ' 條</small>'), k);
        else assert.match(html, new RegExp('<span class="pv-li ' + k + ' zero">.*?這份 plan 沒有'), k);
    }
});

test('a lit card: what it waits for is-pre, what waits on it is-post with the line naming it hit, every other card dimmed', () => {
    const list = claimed();
    const p = list[0];
    const f = p.tasks.find((t) => t.waits.length && p.tasks.some((u) => u.waits.some((w) => w.n === t.n))).n;
    const me = p.tasks.find((t) => t.n === f);
    const pre = new Map(me.waits.map((w) => [w.n, w.kind]));
    const post = new Map(p.tasks.flatMap((t) => t.waits.filter((w) => w.n === f).map((w) => [t.n, w.kind])));
    const html = V.planTabHtml({ stage: 'plan' }, list, f);
    const cls = (n) => (new RegExp('<article class="([^"]*)" data-block="task-card-' + n + '"').exec(html) || [])[1];
    assert.equal(cls(f), 'pv-card is-focus');
    for (const t of p.tasks) {
        if (t.n === f) continue;
        const want = pre.has(t.n) ? 'pv-card is-pre ' + pre.get(t.n) : post.has(t.n) ? 'pv-card is-post ' + post.get(t.n) : 'pv-card is-dim';
        assert.equal(cls(t.n), want, 'Task ' + t.n);
    }
    assert.equal(count(html, new RegExp('class="pv-dep [a-z]+ is-hit" data-from="' + f + '"', 'g')), post.size);
    const r = V.planRel(p, f);
    assert.equal(r.pre, pre.size);
    assert.equal(r.post, post.size);
    assert.ok(html.includes('<p class="pv-tag">' + r.focus + '</p>'));
    assert.equal(count(V.planTabHtml({ stage: 'plan' }, list, null), /is-(focus|pre|post|dim)/g), 0, 'nothing lit with no focus');
});

test('no plan, a plan that will not open and a plan with no task each say so instead of an empty frame', () => {
    const none = V.planTabHtml({ stage: 'plan' }, [], null);
    assert.match(none, /還沒有 plan 檔/);
    assert.doesNotMatch(none, /pv-groups/);
    const bad = (error) => [{ plan: 'docs/plans/x.md', error, ledgerLines: 0, tasks: [], groups: [], unmatched: [] }];
    assert.match(V.planTabHtml({ stage: 'plan' }, bad('unreadable'), null), /讀不到 <code>docs\/plans\/x\.md<\/code>/);
    assert.match(V.planTabHtml({ stage: 'plan' }, bad('no tasks'), null), /找不到 <code>## Task N:<\/code> 標題/);
    assert.match(V.tasksHtml(bad('unreadable')), /讀不到這份 plan/);
    assert.match(V.tasksHtml(bad('no tasks')), /這份 plan 裡沒有 task/);
});
```

Stage it so `tests/source.test.js` sees it: `git add tests/station-plan-tab.test.js`.

2. Run it and watch it fail:

```
node --test --require ./tests/subprocess-timeout.js tests/station-plan-tab.test.js
```

Expected: `V.planTabHtml is not a function`.

3. Write the implementation. In `assets/station/station.js`, in `tasksHtml`, replace:
```
        return list.map(function (p) {
            var byN = {};
            p.tasks.forEach(function (t) { byN[t.n] = t; });
            var done =
```
with the same lines plus an `error` branch, so the start of the map reads:

In `assets/station/station.js`, `tasksHtml`:
```js
        return list.map(function (p) {
            if (p.error) return '<div class="srcline" title="' + esc(p.plan) + '">' + esc(p.plan) + '</div><p class="tally">'
                + (p.error === 'unreadable' ? loc('det.planUnreadableShort', '讀不到這份 plan') : loc('det.planNoTasksShort', '這份 plan 裡沒有 task')) + '</p>';
            var byN = {};
            p.tasks.forEach(function (t) { byN[t.n] = t; });
```

In `assets/station/station.js`, in the hint lines a few lines above `tasksHtml`, replace `        (x.tasks || []).forEach(function (p) {` with:
```js
        (x.tasks || []).filter(function (p) { return !p.error; }).forEach(function (p) {
```

In `assets/station/station.js`, directly after `tasksHtml`'s closing `    }` and before `    // Every column below is the sum of the rows under it: each row's cents,`, insert:
```js
    // The plan tab (docs/90-agent/plans/2026-10-18-plan-gate-page-design.md
    // §2), drawn from the newest plan this session claimed: its dispatch
    // groups as columns of task cards. Each card names every earlier task
    // `plantasks.conflict` refused it beside — one 等 line per pair, so the
    // lines on the page and the pairs refused are one count. No edge is drawn
    // as a line: `focus` is the task hovered or focused, whose neighbours light
    // (`planRel`). While the session sits at `plan` a banner puts the gate's
    // question; the answer is given in Claude Desktop, never here. Classes are
    // `pv-`: `.pg` is the pending gate's.
    var PV_KINDS = ['files', 'read', 'interface'];
    var PV_THEN = '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6.2 8 9.8l3.5-3.6"/></svg>';
    var PV_GATE = '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.8 13.5 4v4c0 3-2.4 5.3-5.5 6.2C4.9 13.3 2.5 11 2.5 8V4z"/><path d="M8 5.2v3.3M8 10.8v.01"/></svg>';
    // The newest plan claimed: claims are kept newest last.
    function planNewest(list) { return list && list.length ? list[list.length - 1] : null; }
    // What one 等 line says about earlier task `w.n`, as waiting task `t` says it.
    function planReason(t, w) {
        var f = w.file ? '<code>' + esc(w.file) + '</code>' : '';
        if (w.kind === 'files') return loc('det.planWaitFiles', '同改 {f}', { f: f });
        if (w.kind === 'interface') return loc('det.planWaitIface', '用它產出的 {f}', { f: f });
        if (w.kind === 'read') {
            var mine = (t.read || []).some(function (r) { return String(r).replace(/:\d+(-\d+)?$/, '') === w.file; });
            return mine ? loc('det.planWaitRead', '讀 {f}', { f: f }) : loc('det.planWaitItReads', '它讀 {f}', { f: f });
        }
        return loc('det.planWaitUndeclared', '有一方沒宣告檔案，保守地等');
    }
    // What lighting Task `f` lights: each task it waits for (`is-pre`) and each
    // task waiting on it (`is-post`), with the kind and the tag that card wears,
    // and the focused card's own tag. Every other card dims.
    function planRel(p, f) {
        var out = { pre: 0, post: 0, rel: {}, focus: '' };
        var me = ((p && p.tasks) || []).filter(function (t) { return t.n === f; })[0];
        if (!me) return out;
        (me.waits || []).forEach(function (w) {
            out.pre++;
            out.rel[w.n] = { cls: 'is-pre ' + w.kind, text: loc('det.planTagPre', 'Task {f} 等這張 · {r}', { f: f, r: planReason(me, w) }) };
        });
        p.tasks.forEach(function (t) {
            (t.waits || []).forEach(function (w) {
                if (w.n !== f) return;
                out.post++;
                out.rel[t.n] = { cls: 'is-post ' + w.kind, text: loc('det.planTagPost', '這張等 Task {f} · {r}', { f: f, r: planReason(t, w) }) };
            });
        });
        out.focus = (out.pre ? loc('det.planFocusPre', '等 {n} 張', { n: out.pre }) : loc('det.planFocusNoPre', '不等誰'))
            + ' · ' + (out.post ? loc('det.planFocusPost', '{n} 張等它', { n: out.post }) : loc('det.planFocusNoPost', '沒有卡等它'));
        return out;
    }
    // The class and tag card `n` wears while Task `f` is lit; null when nothing is.
    function planLit(r, n, f) {
        if (!r) return null;
        if (n === f) return { cls: 'is-focus', tag: esc(r.focus), hit: false };
        var x = r.rel[n];
        return x ? { cls: x.cls, tag: '<i class="pv-ln" aria-hidden="true"></i>' + x.text, hit: x.cls.indexOf('is-post') === 0 }
            : { cls: 'is-dim', tag: null, hit: false };
    }
    function planCard(t, lit, f) {
        var file = function (x) {
            var m = /^(.*?)(:\d+-\d+)?$/.exec(String(x));
            return '<code>' + esc(m[1]) + (m[2] ? '<small>' + esc(m[2]) + '</small>' : '') + '</code>';
        };
        var disp = t.dispatch === 'implementer'
            ? 'implementer · <span class="pv-m"><i class="sw" style="background:var(--m-' + family('claude-' + t.model) + ')"></i>' + esc(t.model || '?')
                + '</span> · <span>effort ' + esc(t.effort || loc('det.planEffortDefault', '預設')) + '</span>'
            : t.dispatch === 'user' ? loc('det.planByUser', '交給你')
                : t.dispatch === 'in-session' ? loc('det.planInSession', '主 session 自己做')
                    : loc('det.planNoDispatch', '沒有 Dispatch 行');
        var waits = t.waits || [];
        var wait = waits.length
            ? '<div class="pv-wait"><span class="pv-wl">' + loc('det.planWaitLabel', '等') + '</span><ul>' + waits.map(function (w) {
                return '<li class="pv-dep ' + esc(w.kind) + (lit && lit.hit && w.n === f ? ' is-hit' : '') + '" data-from="' + w.n + '"><i class="pv-ln" aria-hidden="true"></i>'
                    + '<b>Task ' + w.n + '</b><span>' + planReason(t, w) + '</span></li>';
            }).join('') + '</ul></div>'
            : '<p class="pv-wait none">' + loc('det.planWaitsNone', '不等誰：這組一開就能跑') + '</p>';
        return '<article class="pv-card' + (lit ? ' ' + lit.cls : '') + '" data-block="task-card-' + t.n + '" data-n="' + t.n + '" tabindex="0" aria-label="Task ' + t.n + '">'
            + (lit && lit.tag !== null ? '<p class="pv-tag">' + lit.tag + '</p>' : '')
            + '<h3><span class="pv-num">' + t.n + '</span><span class="pv-tt">' + esc(t.title).replace(/`([^`]+)`/g, '<code>$1</code>') + '</span></h3>'
            + '<dl class="pv-files"><div><dt>' + loc('det.planModify', '改') + '</dt><dd>' + (t.modify || []).map(file).join('') + '</dd></div>'
            + ((t.test || []).length ? '<div><dt>' + loc('det.planTest', '測') + '</dt><dd>' + t.test.map(file).join('') + '</dd></div>' : '') + '</dl>'
            + '<p class="pv-disp">' + disp + '</p>' + wait + '</article>';
    }
    function planTabHtml(s, list, focus) {
        var p = planNewest(list);
        var code = function (x) { return '<code>' + esc(x) + '</code>'; };
        if (!p) return '<p class="pv-empty">' + loc('det.planNone', '這個 session 的 claims 裡還沒有 plan 檔。plan stage 寫出 plan 後，這裡列出它的 task 和分組。') + '</p>';
        if (p.error === 'unreadable') return '<p class="pv-empty err">' + loc('det.planUnreadable', '讀不到 {p}：檔案在，但打不開。', { p: code(p.plan) }) + '</p>';
        if (!p.tasks.length) return '<p class="pv-empty err">' + loc('det.planNoTasks', '{p} 裡找不到 <code>## Task N:</code> 標題，沒有 task 可畫。', { p: code(p.plan) }) + '</p>';
        var byN = {}, kinds = { files: 0, read: 0, interface: 0, undeclared: 0 }, edges = 0, models = {};
        p.tasks.forEach(function (t) {
            byN[t.n] = t;
            (t.waits || []).forEach(function (w) { edges++; kinds[w.kind] = (kinds[w.kind] || 0) + 1; });
            if (t.dispatch === 'implementer' && t.model) models[t.model] = (models[t.model] || 0) + 1;
        });
        var f = focus === null || focus === undefined ? null : Number(focus);
        var r = f !== null && byN[f] ? planRel(p, f) : null;
        var banner = s && s.stage === 'plan'
            ? '<div class="pv-banner" data-block="gate-banner"><div class="pv-q"><span class="pill gate">' + PV_GATE + 'gate</span>'
                + '<h2>' + loc('det.planGateQ', 'plan gate：要用這 {n} 個 task 進 build 嗎？', { n: p.tasks.length }) + '</h2></div>'
                + '<ul class="pv-counts"><li><b>' + p.tasks.length + '</b>task</li>'
                + '<li>' + loc('det.planGroupsRun', '<b>{n}</b>組，依序跑', { n: p.groups.length }) + '</li>'
                + '<li>' + loc('det.planEdges', '<b>{n}</b>條相依', { n: edges }) + '</li>'
                + (Object.keys(models).length ? '<li class="pv-mods"><span class="pv-ml">implementer</span>' + Object.keys(models).map(function (m) {
                    return '<span class="chip"><i class="sw" style="background:var(--m-' + family('claude-' + m) + ')"></i>' + esc(m) + ' × ' + models[m] + '</span>';
                }).join('') + '</li>' : '') + '</ul>'
                + '<div class="srcline pv-src" title="' + esc(p.plan) + '">' + esc(p.plan) + '</div>'
                + '<p class="pv-where"><i class="hatchsw" aria-hidden="true"></i><span>' + loc('det.planWhere', '回答在 Claude Desktop 那邊給；這頁只讓你看清楚要核准什麼，不收答案。') + '</span></p></div>'
            : '<div class="srcline pv-src pv-plain" title="' + esc(p.plan) + '">' + esc(p.plan) + '</div>';
        var label = { files: loc('det.planKindFiles', '同改一個檔'), read: loc('det.planKindRead', '一個讀、一個改'), interface: loc('det.planKindIface', '用到對方產出的介面') };
        var legend = '<div class="pv-legend" data-block="legend"><span class="pv-lh">' + loc('det.planLegend', '相依') + '</span>'
            + PV_KINDS.map(function (k) {
                return '<span class="pv-li ' + k + (kinds[k] ? '' : ' zero') + '"><i class="pv-ln" aria-hidden="true"></i><b>' + k + '</b>' + label[k]
                    + '<small>' + (kinds[k] ? loc('det.planKindN', '{n} 條', { n: kinds[k] }) : loc('det.planKindZero', '這份 plan 沒有')) + '</small></span>';
            }).join('')
            + '<span class="pv-lnote">' + loc('det.planLegendNote', '一欄跑完才換下一欄，欄內並行；停在或 tab 到一張卡，亮出它等的和等它的卡，Esc 清掉。') + '</span></div>';
        var groups = p.groups.map(function (g, i) {
            var par = g.tasks.length === 1 ? loc('det.planAlone', '單獨 1 個') : loc('det.planParallel', '可並行 {n} 個', { n: g.tasks.length });
            return '<section class="pv-g" data-block="group-g' + g.g + '" aria-label="G' + g.g + ' · ' + par + '">'
                + '<header class="pv-gh"><span class="gb">G' + g.g + '</span><span class="pv-surf mono">' + esc(g.surface) + '</span><span class="pv-par">' + par + '</span></header>'
                + '<div class="pv-cards">' + g.tasks.map(function (n) { return byN[n] ? planCard(byN[n], planLit(r, n, f), f) : ''; }).join('') + '</div></section>'
                + (i < p.groups.length - 1 ? '<div class="pv-then">' + PV_THEN + '<span>' + loc('det.planThen', 'G{a} 全部回來，才派 G{b}', { a: g.g, b: g.g + 1 }) + '</span></div>' : '');
        }).join('');
        return banner + legend + '<div class="pv-groups" data-block="group-columns">' + groups + '</div>';
    }
    // The tab as the session page draws it: the lit task carried across a
    // redraw (`planAt`), and the hover, focus and Esc listeners added on the
    // first draw rather than at load — tests/station-hdl-c.test.js presses the
    // page's load-time listeners by their place in the order they were added.
    var planAt = null;
    var planHeard = false;
    function planTab(s, x) {
        planListen();
        return planTabHtml(s, x.tasks, planAt);
    }
    // Lights Task `f`'s neighbours on the drawn tab, or clears them for null,
    // without a redraw: a redraw would take the keyboard focus with it.
    function planFocus(f) {
        planAt = f === null || f === undefined ? null : Number(f);
        var grid = doc && doc.querySelector ? doc.querySelector('.pv-groups') : null;
        if (!grid) return;
        var x = route.view === 'session' ? DETAIL[route.id] : null;
        var p = x ? planNewest(x.tasks) : null;
        var r = p && planAt !== null ? planRel(p, planAt) : null;
        [].forEach.call(grid.querySelectorAll('.pv-card'), function (c) {
            c.classList.remove('is-focus', 'is-pre', 'is-post', 'is-dim', 'files', 'read', 'interface', 'undeclared');
            var old = c.querySelector('.pv-tag');
            if (old) old.parentNode.removeChild(old);
            [].forEach.call(c.querySelectorAll('.pv-dep.is-hit'), function (d) { d.classList.remove('is-hit'); });
            var lit = planLit(r, Number(c.getAttribute('data-n')), planAt);
            if (!lit) return;
            lit.cls.split(' ').forEach(function (k) { c.classList.add(k); });
            if (lit.hit) [].forEach.call(c.querySelectorAll('.pv-dep[data-from="' + planAt + '"]'), function (d) { d.classList.add('is-hit'); });
            if (lit.tag === null) return;
            var tag = doc.createElement('p');
            tag.className = 'pv-tag';
            tag.innerHTML = lit.tag;
            c.insertBefore(tag, c.firstChild);
        });
    }
    function planListen() {
        if (planHeard || !doc || !doc.addEventListener) return;
        planHeard = true;
        var near = function (e, sel) { return e && e.target && e.target.closest ? e.target.closest(sel) : null; };
        var on = function (e) {
            var c = near(e, '.pv-card');
            if (c && Number(c.getAttribute('data-n')) !== planAt) planFocus(c.getAttribute('data-n'));
        };
        doc.addEventListener('mouseover', on);
        doc.addEventListener('focusin', on);
        // Leaving the columns clears, unless a card in them holds the keyboard focus.
        doc.addEventListener('mouseout', function (e) {
            var g = near(e, '.pv-groups');
            if (!g || (e.relatedTarget && g.contains(e.relatedTarget)) || g.contains(doc.activeElement)) return;
            planFocus(null);
        });
        doc.addEventListener('focusout', function (e) {
            var g = near(e, '.pv-groups');
            if (g && !(e.relatedTarget && g.contains(e.relatedTarget))) planFocus(null);
        });
        doc.addEventListener('keydown', function (e) {
            if (!e || e.key !== 'Escape' || planAt === null) return;
            var a = doc.activeElement;
            planFocus(null);
            if (a && a.closest && a.closest('.pv-card') && a.blur) a.blur();
        });
    }
    if (typeof module !== 'undefined' && module.exports) { module.exports.planTabHtml = planTabHtml; module.exports.planRel = planRel; }
```

In `assets/station/i18n.js`, after `            'det.notEqualsSign': '≠',` and before `            // disp — the dispatch tab, agent rows and step lists`, insert:
```js
            'det.planUnreadableShort': 'This plan could not be read',
            'det.planNoTasksShort': 'This plan has no task',
            'det.planWaitFiles': 'both change {f}',
            'det.planWaitIface': 'uses its {f}',
            'det.planWaitRead': 'reads {f}',
            'det.planWaitItReads': 'it reads {f}',
            'det.planWaitUndeclared': 'one of the two declared no files, so it waits to be safe',
            'det.planTagPre': 'Task {f} waits for this · {r}',
            'det.planTagPost': 'this waits for Task {f} · {r}',
            'det.planFocusPre': 'waits for {n}',
            'det.planFocusNoPre': 'waits for none',
            'det.planFocusPost': '{n} wait for it',
            'det.planFocusNoPost': 'nothing waits for it',
            'det.planEffortDefault': 'default',
            'det.planByUser': 'yours to do',
            'det.planInSession': 'done in the main session',
            'det.planNoDispatch': 'no Dispatch line',
            'det.planWaitLabel': 'waits',
            'det.planWaitsNone': 'waits for nothing: runs as soon as its group opens',
            'det.planModify': 'mod',
            'det.planTest': 'test',
            'det.planNone': 'This session has claimed no plan file yet. Once the plan stage writes one, its tasks and groups are listed here.',
            'det.planUnreadable': 'Cannot read {p}: the file is there but will not open.',
            'det.planNoTasks': 'No <code>## Task N:</code> heading in {p}, so there is no task to draw.',
            'det.planGateQ': 'plan gate: build with these {n} tasks?',
            'det.planGroupsRun': '<b>{n}</b>groups, in order',
            'det.planEdges': '<b>{n}</b>dependencies',
            'det.planWhere': 'The answer is given in Claude Desktop; this page only shows what you are approving and takes no answer.',
            'det.planKindFiles': 'both change one file',
            'det.planKindRead': 'one reads what the other changes',
            'det.planKindIface': 'uses an interface the other produces',
            'det.planLegend': 'Depends',
            'det.planKindN': '{n} edges',
            'det.planKindZero': 'none in this plan',
            'det.planLegendNote': 'One column finishes before the next goes out; cards in a column run together. Hover or tab to a card to light what it waits for and what waits on it; Esc clears.',
            'det.planAlone': '1 alone',
            'det.planParallel': '{n} in parallel',
            'det.planThen': 'G{b} goes out when all of G{a} is back',
```

In `assets/station/station.css`, at the end of the file, append:
```css

/* The plan tab, #/s/<id>/plan (docs/90-agent/plans/2026-10-18-plan-gate-page-design.md §2),
   transcribed from the approved mockup. `.pg` is the pending gate's, so the classes are `pv-`. */
:root[data-style=keel]{--k-files:#a8650a;--k-read:#0f7f79;--k-iface:#6959ae}
@media(prefers-color-scheme:dark){:root[data-style=keel]:not([data-theme=light]){--k-files:#e0a53a;--k-read:#3cc2ba;--k-iface:#9d90e0}}
:root[data-style=keel][data-theme=dark]{--k-files:#e0a53a;--k-read:#3cc2ba;--k-iface:#9d90e0}
.pv .files{--k:var(--k-files)}
.pv .read{--k:var(--k-read)}
.pv .interface{--k:var(--k-iface)}
.pv .undeclared{--k:var(--faint)}
.tabs .pv-tabgate{width:12px;height:8px;margin-left:7px;vertical-align:0}

.panel.pv{container-type:inline-size;padding:0 0 22px;overflow:hidden}
.pv>*{margin-left:26px;margin-right:26px}
.pv-empty{margin-top:22px;font-size:13px;line-height:1.6;color:var(--ink2);max-width:70ch}
.pv-empty.err{color:var(--bad)}
.pv-empty code{font:12px var(--f-mono);overflow-wrap:anywhere}
.pv-plain{margin-top:18px}

/* gate-banner: the hatch band is the station's 等你回答 mark */
.pv-banner{margin:0;padding:22px 26px 18px;border-bottom:1px solid var(--rule);
  background:linear-gradient(var(--hatch-bg),var(--hatch-bg)) top/100% 6px no-repeat,
             repeating-linear-gradient(45deg,var(--hatch) 0 1.3px,transparent 1.3px 4.5px) top/100% 6px no-repeat}
.pv .pill.gate{background:var(--hatch-bg);color:var(--ink)}
.pv-q{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px}
.pv-q h2{margin:0;font-size:20px;font-weight:700;letter-spacing:-.005em;line-height:1.35;text-wrap:balance}
.pv-counts{list-style:none;margin:14px 0 10px;padding:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 22px;font-size:12.5px;color:var(--ink2)}
.pv-counts li{display:inline-flex;align-items:baseline;gap:5px}
.pv-counts b{font-size:22px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums;line-height:1}
.pv-counts .pv-mods{align-items:center;gap:6px}
.pv-ml{color:var(--muted)}
.pv-src{margin:0 0 8px;font-size:11.5px}
.pv-where{display:flex;align-items:center;gap:8px;margin:0;font-size:12.5px;color:var(--ink2);line-height:1.5;max-width:65ch}
.pv-where .hatchsw{flex:none}

/* legend */
.pv-legend{display:flex;flex-wrap:wrap;align-items:center;gap:6px 18px;padding:12px 0;font-size:12px;color:var(--ink2);border-bottom:1px solid var(--rule)}
.pv-lh{font-weight:600;color:var(--ink)}
.pv-li{display:inline-flex;align-items:center;gap:6px}
.pv-li b{font:600 12px var(--f-mono);color:var(--ink)}
.pv-li small{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.pv-li.zero{color:var(--muted)}
.pv-lnote{flex-basis:100%;color:var(--muted);line-height:1.5}
.pv-ln{display:inline-block;flex:none;width:18px;height:0;border-top:2.5px solid var(--k)}
.pv .read .pv-ln{border-top-style:dashed}
.pv .interface .pv-ln{border-top-style:dotted;border-top-width:3px}

/* group-columns: under 980px of tab width, groups stacked top to bottom, cards wrapping inside */
.pv-groups{display:flex;flex-direction:column;padding-top:16px}
.pv-gh{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:12.5px;color:var(--ink2)}
.pv-surf{color:var(--ink)}
.pv-par{color:var(--muted)}
.pv-par::before{content:"·";margin-right:8px;color:var(--faint)}
.pv-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(208px,1fr));gap:10px;align-items:start}
.pv-then{display:flex;align-items:center;gap:8px;margin:12px 0;font-size:12px;color:var(--muted)}
.pv-then::after{content:"";flex:1;border-top:1px solid var(--rule)}
.pv-then .ico{flex:none;color:var(--faint)}
/* from 980px: one column per group, left to right, however many groups there are */
@container (min-width:980px){
  .pv-groups{flex-direction:row;align-items:flex-start}
  .pv-g{flex:1 1 0;min-width:0}
  .pv-cards{grid-template-columns:minmax(0,1fr)}
  .pv-then{flex:none;width:20px;margin:0;justify-content:center;padding-top:2px}
  .pv-then::after{display:none}
  .pv-then .ico{transform:rotate(-90deg)}
  .pv-then span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
}

/* task-card */
.pv-card{position:relative;background:var(--panel);border:1px solid var(--rule);border-radius:var(--r-sm);padding:11px 13px 12px;
  font-size:12.5px;line-height:1.5;transition:opacity .18s ease-out,box-shadow .18s ease-out,border-color .18s ease-out}
.pv-card:hover{border-color:var(--rule2)}
.pv-card h3{display:flex;align-items:flex-start;gap:8px;margin:0 0 8px;font-size:13px;font-weight:600;line-height:1.45;color:var(--ink)}
.pv-num{flex:none;font:700 11.5px/1 var(--f-mono);padding:4px 7px;border-radius:5px;background:var(--keel-tint);color:var(--keel-deep);font-variant-numeric:tabular-nums}
.pv-tt{min-width:0;overflow-wrap:anywhere}
.pv-tt code{font:600 .92em var(--f-mono)}
.pv-files{margin:0 0 6px;display:grid;gap:3px}
.pv-files>div{display:grid;grid-template-columns:1.6em minmax(0,1fr)}
.pv-files dt{color:var(--muted);font-size:12px}
.pv-files dd{margin:0;display:flex;flex-wrap:wrap;gap:0 9px}
.pv-files code{font:12px/1.5 var(--f-mono);color:var(--ink2);overflow-wrap:anywhere}
.pv-files code small{font-size:11px;color:var(--muted)}
.pv-disp{margin:0;font-size:12px;color:var(--ink2)}
.pv-disp>span{white-space:nowrap}
.pv-m{display:inline-flex;align-items:center;gap:4px;font-family:var(--f-mono)}
.pv-m .sw{width:8px;height:8px}
.pv-wait{display:flex;gap:6px;margin:8px 0 0;padding-top:8px;border-top:1px solid var(--rule);font-size:12px}
.pv-wait.none{display:block;color:var(--muted)}
.pv-wl{flex:none;color:var(--muted)}
.pv-wait ul{list-style:none;margin:0;padding:0;display:grid;gap:3px;min-width:0}
.pv-dep{display:flex;align-items:center;flex-wrap:wrap;gap:2px 6px;border-radius:4px;margin:0 -4px;padding:0 4px}
.pv-dep b{font-weight:600;color:var(--ink);white-space:nowrap}
.pv-dep span{color:var(--ink2);overflow-wrap:anywhere}
.pv-dep code{font:12px var(--f-mono)}
.pv-dep.is-hit{background:color-mix(in srgb,var(--k) 16%,transparent)}

/* lit: hovering or tabbing to a card lights what it waits for and what waits on it */
.pv-tag{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:-11px -13px 10px;padding:5px 13px;font-size:12px;font-weight:600;color:var(--ink);
  border-bottom:1px solid var(--rule);border-radius:var(--r-sm) var(--r-sm) 0 0}
.pv-tag code{font:600 12px var(--f-mono)}
.pv-card.is-focus{border-color:var(--keel);box-shadow:0 0 0 1px var(--keel),var(--lift)}
.pv-card.is-focus .pv-tag{background:var(--keel-tint);color:var(--keel-deep);border-bottom-color:transparent}
.pv-card.is-pre,.pv-card.is-post{border-color:var(--k);box-shadow:0 0 0 1px var(--k)}
.pv-card.is-pre .pv-tag,.pv-card.is-post .pv-tag{background:color-mix(in srgb,var(--k) 15%,var(--panel));border-bottom-color:transparent}
.pv-card.is-dim{opacity:.5}
.pv-card.is-dim:hover,.pv-card.is-dim:focus-visible{opacity:1}
@media (prefers-reduced-motion:reduce){.pv-card{transition:none}}
```

4. Run it and watch it pass, with the two suites this change could break:

```
node --test --require ./tests/subprocess-timeout.js tests/station-plan-tab.test.js tests/station-i18n.test.js tests/station-hdl-c.test.js tests/station-dispatch-view.test.js
```

Expected: all pass.

5. Commit: `feat(station): the plan tab's view — groups as columns of task cards, 等 lines, lit neighbours`.

## Task 4: the `plan` tab on the session page, its route, and its reference

**Files:**
- Modify: `assets/station/station.js:200-1350` — `plan` in `TABS` and `TAB_SHOWN`; `tabsHtml` labels it with the task count and the gate hatch at the plan stage
- Modify: `assets/station/station.js:3800-3850` — `sessionPage` draws `planTab(s, x)` for `#/s/<id>/plan` in a `panel pv` section
- Modify: `docs/90-agent/reference/station.md:248-264` — the session page's tabs gain `plan` and what it shows
- Read: `tests/station-talk-page.test.js` — the boot the new test copies
- Test: `tests/station-view.test.js`
- Test: `tests/station-plan-route.test.js`

**Interfaces:**
- Consumes: `planTab(s, x) -> string` from Task 3
- Produces: the route `#/s/<id>/plan` (`parseHash` → `{ view: 'session', id, tab: 'plan' }`), which `scripts/await.js`'s `page:` line points at

**Dispatch:** implementer, opus, high — the architectural floor; the plan carries the code.

1. Write the failing tests. In `tests/station-view.test.js`, in the test `the session header reads dollars from days and time from the timeline; the four tabs link by hash`, replace the expected href list:

In `tests/station-view.test.js`:
```js
        ['#/s/aaaa1111-0000', '#/s/aaaa1111-0000/dispatch', '#/s/aaaa1111-0000/events', '#/s/aaaa1111-0000/talk', '#/s/aaaa1111-0000/plan']);
```

Then a new file, booting the page the way `tests/station-talk-page.test.js` does:

In `tests/station-plan-route.test.js`:
```js
'use strict';
// The plan tab, wired (docs/90-agent/plans/2026-10-18-plan-gate-page-design.md
// §2): `#/s/<id>/plan` is a tab of its own after 對話, its label carries the
// newest plan's task count and, at the plan stage, the 等你回答 hatch, and its
// panel is the plan tab's. station.js is booted as the browser runs it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const V = require('../assets/station/station.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-18T12:00:00.000Z');
const PK = 'F:\\ws\\alpha';

// station.js booted on `hash` with one session and no detail script; returns the page's HTML.
function boot(hash, stage) {
    const els = {};
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {} });
    els.page = el('div');
    const win = { location: { hash }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {},
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: false, nonce: 'N0NCE',
            projects: [{ root: PK, gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
            sessions: [{ id: 's1', pkey: PK, root: PK, task: 't-s1', state: 'live', route: ['survey', 'plan', 'build'], stage: stage || 'plan',
                stages: [], notes: [], claims: [], conflicts: [], burn: 0, backtracks: 0, updated: NOW - 1000, started: new Date(NOW - 120000).toISOString(), days: [] }] } };
    const doc = { hidden: false, documentElement: el('html'), body: el('body'), title: '', head: { appendChild() {} },
        getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    return els.page.innerHTML;
}

test('#/s/<id>/plan parses to the plan tab, and an unknown tab still falls back to 概覽', () => {
    assert.deepEqual(V.parseHash('#/s/aaaa1111-0000/plan'), { view: 'session', id: 'aaaa1111-0000', tab: 'plan' });
    assert.deepEqual(V.parseHash('#/s/aaaa1111-0000/plans'), { view: 'session', id: 'aaaa1111-0000', tab: 'timeline' });
});

test('the plan tab is the fifth, labelled with the newest plan\'s task count, and carries the gate hatch only at the plan stage', () => {
    const x = { rows: [], events: [], tasks: [{ plan: 'docs/plans/a.md', tasks: [{ n: 1 }] }, { plan: 'docs/plans/b.md', tasks: [{ n: 1 }, { n: 2 }, { n: 3 }] }] };
    const at = V.tabsHtml({ id: 's1', stage: 'plan' }, 'plan', x);
    assert.match(at, /<a href="#\/s\/s1\/talk">對話<\/a><a href="#\/s\/s1\/plan" class="on" aria-current="page">plan<small>3<\/small><i class="hatchsw pv-tabgate" aria-label="gate"><\/i><\/a><\/nav>$/);
    assert.match(V.tabsHtml({ id: 's1', stage: 'build' }, 'timeline', x), /<a href="#\/s\/s1\/plan">plan<small>3<\/small><\/a><\/nav>$/);
    assert.match(V.tabsHtml({ id: 's1', stage: 'plan' }, 'timeline', { rows: [], events: [], tasks: [] }), /<a href="#\/s\/s1\/plan">plan<\/a><\/nav>$/, 'no plan: no count and no hatch');
    assert.match(V.tabsHtml({ id: 's1', stage: 'plan' }, 'timeline', null), /<a href="#\/s\/s1\/plan">plan<\/a><\/nav>$/, 'no detail yet');
});

test('the session page on #/s/<id>/plan marks the tab on and draws the plan tab\'s panel; other tabs keep theirs', () => {
    const html = boot('#/s/s1/plan');
    assert.match(html, /<a href="#\/s\/s1\/plan" class="on" aria-current="page">plan<\/a><\/nav>/);
    assert.match(html, /<section class="panel pv" data-block="plan-tab"><p class="tally">/, 'no detail script here, so the note the other tabs show');
    assert.match(boot('#/s/s1/dispatch'), /<section class="panel" data-block="dispatch">/);
    assert.match(boot('#/s/s1'), /<\/nav><section class="panel">/);
});
```

Stage the new file: `git add tests/station-plan-route.test.js`.

2. Run them and watch them fail:

```
node --test --require ./tests/subprocess-timeout.js tests/station-plan-route.test.js tests/station-view.test.js
```

Expected: `plan` parses to `timeline`, no plan tab in the nav, and the four-href assertion fails on the missing fifth.

3. Write the implementation. In `assets/station/station.js`, replace `    var TABS = ['timeline', 'cost', 'dispatch', 'events', 'talk'];` with:

In `assets/station/station.js`, `TABS`:
```js
    var TABS = ['timeline', 'cost', 'dispatch', 'events', 'talk', 'plan'];
```

In `assets/station/station.js`, replace `TAB_SHOWN` and the first lines of `tabsHtml`, from `    var TAB_SHOWN = ['timeline', 'dispatch', 'events', 'talk'];` through `                + (k === 'dispatch' && run ? '<i class="dot live" title="' + loc('ses.nAgentsRunning', '{n} 個 agent running', { n: run }) + '"></i>' : '') + '</a>';`, with:
```js
    var TAB_SHOWN = ['timeline', 'dispatch', 'events', 'talk', 'plan'];
    function tabsHtml(s, tab, x, talk) {
        var label = { timeline: loc('ses.tabOverview', '概覽'), dispatch: loc('ses.tabDispatch', '派工'), events: loc('ses.tabEvents', '事件'), talk: loc('ses.tabTalk', '對話'), plan: 'plan' };
        // plan counts the newest claimed plan's tasks, and wears the gate's
        // hatch while the session sits at the plan gate with a plan to show.
        var plan = x && x.tasks && x.tasks.length ? x.tasks[x.tasks.length - 1] : null;
        var n = { dispatch: x ? x.rows.length : null, events: x ? x.events.length : null, talk: talk, plan: plan && plan.tasks.length ? plan.tasks.length : null };
        var run = x ? x.rows.filter(function (r) { return agentState(x, r, s) === 'running'; }).length : 0;
        if (tab === 'cost') tab = 'timeline';
        return '<nav class="tabs" data-block="session-tabs" aria-label="' + loc('ses.sessionView', 'session 檢視') + '">' + TAB_SHOWN.map(function (k) {
            return '<a href="' + sessionHash(s.id, k) + '"' + (k === tab ? ' class="on" aria-current="page"' : '') + '>' + label[k]
                + (n[k] !== null && n[k] !== undefined ? '<small>' + n[k] + '</small>' : '')
                + (k === 'dispatch' && run ? '<i class="dot live" title="' + loc('ses.nAgentsRunning', '{n} 個 agent running', { n: run }) + '"></i>' : '')
                + (k === 'plan' && s.stage === 'plan' && n.plan ? '<i class="hatchsw pv-tabgate" aria-label="gate"></i>' : '') + '</a>';
```

In `assets/station/station.js`, in `sessionPage`, replace:
```
                : r.tab === 'talk' ? talkHtml(s.id, talk)
                    : overview;
```
In `assets/station/station.js`, `sessionPage`, with:
```js
                : r.tab === 'talk' ? talkHtml(s.id, talk)
                    : r.tab === 'plan' ? (x ? planTab(s, x) : detailNote(s))
                        : overview;
```

In `assets/station/station.js`, in `sessionPage`'s return, replace `'<section class="panel"' + (r.tab === 'dispatch' ? ' data-block="dispatch"' : '') + '>' + body + '</section>'` with:
```js
'<section class="panel' + (r.tab === 'plan' ? ' pv" data-block="plan-tab"' : '"' + (r.tab === 'dispatch' ? ' data-block="dispatch"' : '')) + '>' + body + '</section>'
```

In `docs/90-agent/reference/station.md`, replace:
```
A session also opens on a page of its own, `#/s/<id>`, in four tabs — 概覽,
派工, 事件 and 對話 — and `#/s/<id>/<tab>` opens one directly, with `timeline`,
`dispatch`, `events` or `talk`.
```
In `docs/90-agent/reference/station.md`, with:
```md
A session also opens on a page of its own, `#/s/<id>`, in five tabs — 概覽,
派工, 事件, 對話 and plan — and `#/s/<id>/<tab>` opens one directly, with `timeline`,
`dispatch`, `events`, `talk` or `plan`.
```

In `docs/90-agent/reference/station.md`, replace `` `['timeline', 'dispatch', 'events', 'talk']` `` with `` `['timeline', 'dispatch', 'events', 'talk', 'plan']` ``, and after the paragraph ending `and keeps its claims.` insert a paragraph:
```md
plan (`#/s/<id>/plan`) draws the newest plan the session claimed, found
through the project's `role: plan` bucket (`tasksOf` in `lib/detail.js`): its
dispatch groups as columns, left to right from 980px of tab width and stacked
below that, each task a card with its 改 and 測 paths, its Dispatch line and
one 等 line for every earlier task `plantasks.conflict` refuses it beside,
naming the kind (`files`, `read`, `interface`, `undeclared`) and the path or
name the two share. No edge is drawn as a line: hovering or focusing a card
lights the cards it waits for and the cards waiting on it, and Esc clears. A
legend gives the three kinds by colour and line style. While the session's
stage is `plan`, a banner puts the gate's question with the counts of tasks,
groups, dependencies and implementer models, and says the answer is given in
Claude Desktop; the tab's label carries the task count, and the gate's hatch
at that stage. No plan, a plan that will not open and a plan with no
`## Task N:` heading each say so instead. The controlled plan stage opens this
page beside its gate from the `page:` line `scripts/await.js` prints.
```

4. Run them and watch them pass, with the suites that boot the session page:

```
node --test --require ./tests/subprocess-timeout.js tests/station-plan-route.test.js tests/station-view.test.js tests/station-talk-page.test.js tests/station-i18n.test.js tests/station-doc.test.js
```

Expected: all pass.

5. Commit: `feat(station): #/s/<id>/plan — the plan tab on the session page`.

## Coverage

| promise | task |
|---|---|
| `tasksOf` (lib/detail.js:330) finds a claimed plan by the project's `role: plan` bucket through `docs.roleOf`, not by the `docs/plans/` regex at lib/detail.js:320, which never matches this repository's `docs/90-agent/plans/`. It still skips `-design.md`. | Task 1 |
| Each task it returns carries `modify`, `test`, `dispatch`, `model` and `effort` as `plantasks.parseTasks` parsed them. | Task 1 |
| Each task carries `waits`: one `{ n, kind, file }` for every earlier task that `plantasks.conflict` refuses it beside | Task 1 |
| `plan` joins `TABS` (assets/station/station.js:205); `#/s/<id>/plan` opens it, and its tab label carries the task count. | Task 4 |
| A banner names the question — use these N tasks for build — with the counts (tasks, groups, edges, implementer models) and the plan path | Task 3 |
| Groups are columns left to right from 980px of tab width, stacked top to bottom below it, with a line between groups | Task 3 |
| A card holds the task number and title, its 改/測 paths, its Dispatch line, and one 等 line per predecessor with the reason. | Task 3 |
| Edges are not drawn as lines. Hover or focus on a card lights the cards it waits for and the cards waiting on it; Esc clears. | Task 3 |
| A legend gives the three kinds by colour and line style: files solid, read dashed, interface dotted. | Task 3 |
| No plan, an unreadable plan and a plan with no tasks each say so in the tab rather than drawing an empty frame. | Task 1 (the `error` entries), Task 3 (what the tab says) |
| `scripts/await.js`, when the handoff it reports is the plan stage's and `lib/serve.js` probes a live station, prints a `page: <url>#/s/<id>/plan` line under the handoff line. | Task 2 |
| The plan stage's controller rule (lib/stages.js) prints that line above the gate and, where a browser-pane tool is available, opens the url there before calling AskUserQuestion. | Task 2 |
| docs/90-agent/reference/station.md:250 lists the session page's tabs; it gains `plan` and what it shows. | Task 4 |
| The controller reference that describes `await.js`'s output gains the `page:` line. | Task 2 (`docs/90-agent/reference/subagents.md`) |
| tests/detail-tasks.test.js: a plan at `docs/90-agent/plans/x.md` claimed by a session, whose Task 2 modifies Task 1's file — `tasksOf` returns it (today: nothing) and Task 2's `waits` is `[{ n: 1, kind: 'files', file }]`. | Task 1 |
| tests/await.test.js: with a serve record answering, a plan-stage handoff prints the `page:` line; with none, it prints no such line. | Task 2 |
| On the artefact: for one real plan, the number of 等 lines the rendered tab draws equals the number of earlier-later pairs `plantasks.conflict` refuses. | Task 3 (unit, on `docs/99-archive/2026-10-18-deny-posix-helpers.md`); the rendered page is counted again at verify |
