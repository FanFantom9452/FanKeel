---
status: current
---

# TODO 全表盤點 Implementation Plan

**Goal:** a patrol's survey gate is refused unless every open TODO entry has its own line with a disposition, and the two buildable entries this patrol found land.
**Architecture:** `lib/handoff.js` gains `isPatrol`, `patrolEntries` and `patrolProblem`; `readGate` runs `patrolProblem` over the report above the last gate block when `rules.patrol` is a list. The three callers that already pass `ids` pass `patrol` beside it. The two documentation fixes are single edits.
**Tech Stack:** Node, CommonJS, `node:test`; no dependencies may be added.
**Spec:** [2026-10-17-patrol-every-entry-design.md](2026-10-17-patrol-every-entry-design.md)

## Global Constraints

- Generated filing (`node scripts/map.js`): `docs/90-agent/plans` is `plan`, `docs/90-agent/reference` is `reference`, `skills` is `reference`; the index is `docs/README.md`.
- `package.json` carries no runtime dependencies; nothing is added.
- A `path:line` reference in a reference page is written `` (`path:line`, `quote`) `` so `scripts/docs-check.js` compares the quote against the line (`scripts/docs-check.js:374`, `carries no quote`).
- Four-space indentation in `lib/` and `hooks/`, two in `tests/`, `'use strict';` at the top of every test file.
- An implementer runs only its own test file; the parent runs `node scripts/suite.js --fast` before committing a group.
- `FANKEEL_BROWSER` must be Chrome's full path when the full suite runs (14 render tests fail on Edge).

## Risks
- `todo.js load` returns done entries in `all` — Task 3 — the filter keeps only `state !== 'done'`, and a test holds a done entry out.
- an id that is a prefix of another (`docs-1`, `docs-12`) matches by substring — Task 3 — the match is bounded by non-id characters, and a test covers it.

## Task 1: station.md's three references point at what they describe

**Files:**
- Modify: `docs/90-agent/reference/station.md` — lines 235, 755 and 757
- Read: `assets/station/station.js` — `NAV_TREE` at 1628, `navHtml` at 1650, `csmore` at 3824

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — three one-line edits whose target lines are already found; a dispatch costs more than the edits.

1. Write the replacement at line 235 of `docs/90-agent/reference/station.md`:

   In `docs/90-agent/reference/station.md`, replace `` (`assets/station/station.js:3129`) `` with:

   ```md
   (`assets/station/station.js:3824`, `'<details class="csmore"><summary>'`)
   ```
2. Write the replacement at lines 755-756 of `docs/90-agent/reference/station.md` — the citation and the quote on the next line, which is stale too:

   In `docs/90-agent/reference/station.md`, replace the two lines `` (`assets/station/station.js:1426`, `` and `` `kids: [['settings', '#/settings', '精靈']]`) carries none, so `navHtml` `` with:

   ```md
   (`assets/station/station.js:1628`,
   `kids: [['settings', '#/settings', loc('nav.wizard', '精靈')]]`) carries none, so `navHtml`
   ```
3. Write the replacement at line 757 of `docs/90-agent/reference/station.md`:

   In `docs/90-agent/reference/station.md`, replace `` (`assets/station/station.js:1440`) `` with:

   ```md
   (`assets/station/station.js:1650`, `function navHtml(active, c, ui) {`)
   ```
4. Run `node scripts/docs-check.js` and confirm no finding names `station.md:235`, `:755` or `:757`.
5. Commit: `docs(station): three station.js references point at what they describe`.

## Task 2: README names the commit-limit signature

**Files:**
- Modify: `README.md` — the parallel-runs paragraph at line 260
- Read: `docs/90-agent/todo/test-8.md` — the failure counts

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — one sentence appended to one paragraph.

1. Write the sentence at the end of line 260 of `README.md`, after `set it to 30000.`:

   In `README.md`, append to the paragraph ending `set it to 30000.`:

   ```md
    A different failure shares the symptom: two full suites at once on a machine short of commit memory fail with `VirtualAlloc failed`, exit `0xC0000409`, `0xC000012D` (STATUS_COMMITMENT_LIMIT) or git's `Out of memory` — that is Windows running out of commit, not a failing test, and one suite alone passes.
   ```
2. Run `grep -n 0xC000012D README.md` and confirm the line.
3. Commit: `docs(readme): name the commit-limit signature of two parallel suites`.

## Task 3: readGate refuses a patrol report that skips an entry

**Files:**
- Modify: `lib/handoff.js` — `isPatrol`, `patrolEntries`, `patrolProblem`; `readGate` runs the check; exports
- Modify: `skills/fankeel-survey/SKILL.md` — one paragraph under `## The patrol`
- Read: `lib/todo.js` — `load(root)` returns `{ all: [{ id, title, state }] }`; `add(root, fields)` writes an entry
- Test: `tests/handoff-patrol.test.js`

**Interfaces:**
- Consumes: `require('./todo.js').load(root)`
- Produces: `isPatrol(entry) -> boolean`; `patrolEntries(root, entry) -> Array<{ id: string, title: string }> | null`; `patrolProblem(report: string, entries) -> { at: 'report', detail: string } | null`; `readGate(file, next, route, rules)` honours `rules.patrol`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test, `tests/handoff-patrol.test.js`:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const tmp = require('./tmp.js');
   const todo = require('../lib/todo.js');
   const { readGate, isPatrol, patrolEntries, patrolProblem } = require('../lib/handoff.js');

   const TICKS = '`'.repeat(3);
   const GATE = { questions: [{ header: '下一站', question: 'plan?', multiSelect: false, options: [{ label: 'plan', description: 'a' }, { label: 'stay', description: 'b' }, { label: 'pause', description: 'c' }] }], next: 'plan' };
   const ROUTE = ['survey', 'plan', 'build', 'verify', 'land'];
   const ENTRIES = [{ id: 'docs-1', title: '流程圖' }, { id: 'docs-12', title: '另一頁' }, { id: 'test-8', title: '認可上限' }];
   const file = (report) => {
     const f = path.join(tmp('fankeel-patrol-'), 'survey.md');
     fs.writeFileSync(f, report + '\n\n' + TICKS + 'json gate\n' + JSON.stringify(GATE) + '\n' + TICKS + '\n');
     return f;
   };

   test('a patrol is the patrol route at survey, and nothing else', () => {
     assert.equal(isPatrol({ stage: 'survey', route: ROUTE }), true);
     assert.equal(isPatrol({ stage: 'plan', route: ROUTE }), false);
     assert.equal(isPatrol({ stage: 'survey', route: ['survey', 'design', 'build', 'verify', 'land'] }), false);
     assert.equal(isPatrol(null), false);
   });

   test('a report naming every open entry with a disposition passes', () => {
     const report = '- docs-1 — waiting on the other project\n- docs-12 — keep\n- 認可上限 — do now';
     assert.equal(patrolProblem(report, ENTRIES), null);
     const gate = readGate(file(report), 'plan', ROUTE, { patrol: ENTRIES });
     assert.ok(gate && !gate.invalid, JSON.stringify(gate));
   });

   test('a report that skips an entry is refused, naming it', () => {
     const report = '- docs-1 — waiting on the other project\n- test-8 — do now\n22 Blocked and Watch seen by title only';
     const got = patrolProblem(report, ENTRIES);
     assert.equal(got.at, 'report');
     assert.match(got.detail, /docs-12/);
     assert.doesNotMatch(got.detail, /test-8/);
     const gate = readGate(file(report), 'plan', ROUTE, { patrol: ENTRIES });
     assert.equal(gate.invalid, 'report');
   });

   test('an id inside a longer id does not count, and a line with no disposition does not either', () => {
     const report = '- docs-12 — keep\n- test-8 — looked at it';
     const got = patrolProblem(report, ENTRIES);
     assert.match(got.detail, /docs-1(,|$)/);
     assert.match(got.detail, /test-8/);
   });

   test('the gate block itself is not the report', () => {
     const f = path.join(tmp('fankeel-patrol-'), 'survey.md');
     const gate = Object.assign({}, GATE, { next: 'docs-1 docs-12 test-8 keep' });
     fs.writeFileSync(f, '# report\n\n' + TICKS + 'json gate\n' + JSON.stringify(gate) + '\n' + TICKS + '\n');
     assert.equal(readGate(f, 'plan', ROUTE, { patrol: ENTRIES }).invalid, 'report');
   });

   test('patrolEntries lists open entries only, and only for a patrol', () => {
     const dir = tmp('fankeel-patrol-root-');
     fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
     fs.mkdirSync(path.join(dir, 'docs', 'todo'), { recursive: true });
     fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [
       { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
     todo.add(dir, { label: 'a', title: 'one', description: 'first', state: 'ready' });
     todo.add(dir, { label: 'a', title: 'two', description: 'second', state: 'ready' });
     const all = todo.load(dir).all;
     const doneId = all[1].id;
     const f = path.join(dir, all[1].file);
     fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/^state: ready$/m, 'state: done'));
     assert.deepEqual(patrolEntries(dir, { stage: 'survey', route: ROUTE }).map((e) => e.id), all.filter((e) => e.id !== doneId).map((e) => e.id));
     assert.equal(patrolEntries(dir, { stage: 'build', route: ROUTE }), null);
   });
   ```
2. Run `node --test tests/handoff-patrol.test.js` and watch it fail on `isPatrol is not a function`.
3. Write the implementation. In `lib/handoff.js`, directly above `function gateProblem(`, add:

   ```js
   // A patrol is the task `/fankeel`'s INIT rule starts on this route; at survey
   // its report owes one line to every open TODO entry. 2026-10-17: a patrol
   // survey wrote `entries: 29 listed, 29 in TODO` over seven Ready lines and a
   // paragraph saying the other 22 were seen by title, and its gate went out.
   const PATROL_ROUTE = 'survey,plan,build,verify,land';
   const DISPOSITIONS = ['do now', 'needs the user', 'waiting on', 'keep'];

   function isPatrol(entry) {
       return !!entry && entry.stage === 'survey' && Array.isArray(entry.route) && entry.route.join(',') === PATROL_ROUTE;
   }

   // The open entries a patrol's survey report must name, or null when this is
   // not one, or the TODO cannot be read — a check that cannot read its list
   // checks nothing rather than refusing everything.
   function patrolEntries(root, entry) {
       if (!isPatrol(entry)) return null;
       try {
           const loaded = require('./todo.js').load(root);
           if (!loaded || !Array.isArray(loaded.all)) return null;
           return loaded.all.filter((e) => e && e.id && e.state !== 'done').map((e) => ({ id: e.id, title: e.title || '' }));
       } catch (e) {
           return null;
       }
   }

   // Every entry needs one line naming it, by id or by title, with a
   // disposition beside it. An id is matched whole: `docs-1` is not in `docs-12`.
   function patrolProblem(report, entries) {
       const lines = String(report).split(/\r?\n/);
       const named = (line, e) => new RegExp('(^|[^A-Za-z0-9_-])' + e.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^A-Za-z0-9_-]|$)').test(line)
           || (e.title && line.includes(e.title));
       const missing = entries.filter((e) => !lines.some((line) => named(line, e) && DISPOSITIONS.some((d) => line.toLowerCase().includes(d))));
       if (!missing.length) return null;
       return {
           at: 'report',
           detail: missing.length + ' of ' + entries.length + ' open TODO entries have no line naming them with a disposition ('
               + DISPOSITIONS.join(', ') + '): ' + missing.map((e) => e.id).join(', ') + ' — a patrol checks Blocked and Watch too, one line each',
       };
   }
   ```
4. Write the call in `readGate`. In `lib/handoff.js`, in `readGate`, replace

   ```js
       let last = null;
       for (const m of text.matchAll(BLOCK)) last = m[1];
   ```

   with, in `lib/handoff.js`:

   ```js
       let last = null;
       let lastAt = 0;
       for (const m of text.matchAll(BLOCK)) { last = m[1]; lastAt = m.index; }
   ```

   and, in `lib/handoff.js`, replace

   ```js
       const bad = gateProblem(gate, next, route, rules);
   ```

   with, in `lib/handoff.js`:

   ```js
       const bad = gateProblem(gate, next, route, rules)
           || (rules && Array.isArray(rules.patrol) && rules.patrol.length ? patrolProblem(text.slice(0, lastAt), rules.patrol) : null);
   ```
5. Write the exports. In `lib/handoff.js`, in `module.exports`, after `readGate,` add `isPatrol, patrolEntries, patrolProblem,`.
6. Write the skill paragraph. In `skills/fankeel-survey/SKILL.md`, under `## The patrol`, after the paragraph whose last line ends `back by the user.` (line 338, wrapped from `was sent` on 337), add:

   ```md
   A script holds this now. `readGate` (`lib/handoff.js`) refuses a patrol's
   survey gate while any open entry has no line, above the gate block, naming it
   by id or title beside `do now`, `needs the user`, `waiting on` or `keep`, and
   the refusal lists the ids still missing. 2026-10-17: a report that counted 29
   and checked 7 was the reason.
   ```
7. Run `node --test tests/handoff-patrol.test.js` and `node --test tests/handoff.test.js`; both pass.
8. Commit: `feat: a patrol's survey gate is refused until every open entry has a line`.

## Task 4: the three gate readers pass the patrol list

**Files:**
- Modify: `hooks/gate.js` — the controlled `readGate` call passes `patrol`
- Modify: `hooks/gate-write.js` — its `readGate` call passes `patrol`
- Modify: `scripts/gate-check.js` — its `readGate` call passes `patrol`
- Read: `lib/handoff.js` — `patrolEntries(root, entry)` from Task 3
- Test: `tests/gate-check-patrol.test.js`
- Test: `tests/gate-write-patrol.test.js`

**Interfaces:**
- Consumes: `patrolEntries(root, entry)` from Task 3
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus a test.

1. Write the failing test, `tests/gate-check-patrol.test.js`:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const tmp = require('./tmp.js');
   const todo = require('../lib/todo.js');
   const registry = require('../lib/registry.js');
   const { main } = require('../scripts/gate-check.js');

   const ID = 'cccccccc-0000-4000-8000-000000000003';
   const TICKS = '`'.repeat(3);
   const GATE = { questions: [{ header: '下一站', question: 'plan?', multiSelect: false, options: [{ label: 'plan', description: 'a' }, { label: 'stay', description: 'b' }, { label: 'pause', description: 'c' }] }], next: 'plan' };

   test('gate-check refuses a patrol survey report that skips an open entry', () => {
     const dir = tmp('fankeel-gcpatrol-');
     fs.mkdirSync(path.join(dir, '.fankeel', 'sessions'), { recursive: true });
     fs.mkdirSync(path.join(dir, 'docs', 'todo'), { recursive: true });
     fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [
       { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
     todo.add(dir, { label: 'a', title: 'one', description: 'first', state: 'ready' });
     todo.add(dir, { label: 'b', title: 'two', description: 'second', state: 'ready' });
     const [first, second] = todo.load(dir).all;
     fs.writeFileSync(path.join(dir, '.fankeel', 'sessions', ID + '.json'), JSON.stringify({
       task: 'TODO 全表盤點', stage: 'survey', route: ['survey', 'plan', 'build', 'verify', 'land'], active: true, started: '2026-10-17T00:00:00.000Z' }));
     const f = path.join(dir, 'survey.md');
     const write = (report) => fs.writeFileSync(f, report + '\n\n' + TICKS + 'json gate\n' + JSON.stringify(GATE) + '\n' + TICKS + '\n');
     write('- ' + first.id + ' — do now');
     const bad = main([f, '--session', ID, '--root', dir]);
     assert.equal(bad.code, 1, bad.text);
     assert.match(bad.text, new RegExp(second.id));
     write('- ' + first.id + ' — do now\n- ' + second.id + ' — waiting on upstream');
     const good = main([f, '--session', ID, '--root', dir]);
     assert.equal(good.code, 0, good.text);
     assert.ok(registry.readSession(dir, ID));
   });

   // hooks/gate.js needs a controlled stage, a profile and a live gate hash to
   // reach its readGate call; this holds the one argument this task adds there.
   test('hooks/gate.js passes the patrol list to its controlled readGate', () => {
     const src = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'gate.js'), 'utf8');
     assert.match(src, /ids: todo\.ids, patrol: patrolEntries\(root, mine\) \}/);
   });
   ```

   Write the second failing test, `tests/gate-write-patrol.test.js`:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');
   const tmp = require('./tmp.js');
   const todo = require('../lib/todo.js');
   const { handoffPath } = require('../lib/handoff.js');

   const HOOK = path.join(__dirname, '..', 'hooks', 'gate-write.js');
   const MINE = 'dddddddd-0000-4000-8000-000000000004';
   const AGENT = 'b7e1d0';
   const TICKS = '`'.repeat(3);
   const GATE = { questions: [{ header: '下一站', question: 'plan?', multiSelect: false, options: [{ label: 'plan', description: 'a' }, { label: 'stay', description: 'b' }, { label: 'pause', description: 'c' }] }], next: 'plan' };

   test('a patrol stage agent writing a report that skips an entry hears which one', () => {
     const root = tmp('fankeel-gwpatrol-');
     fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
     fs.mkdirSync(path.join(root, 'docs', 'todo'), { recursive: true });
     fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [
       { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
     todo.add(root, { label: 'a', title: 'one', description: 'first', state: 'ready' });
     todo.add(root, { label: 'b', title: 'two', description: 'second', state: 'ready' });
     const [first, second] = todo.load(root).all;
     const data = { task: 'TODO 全表盤點', stage: 'survey', route: ['survey', 'plan', 'build', 'verify', 'land'], active: true,
       started: '2026-10-17T00:00:00.000Z', inflight: { stage: 'survey', at: 1758000000000, agentId: AGENT } };
     fs.writeFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), JSON.stringify(data));
     const file = handoffPath(root, data, 'survey');
     fs.mkdirSync(path.dirname(file), { recursive: true });
     fs.writeFileSync(file, '- ' + first.id + ' — do now\n\n' + TICKS + 'json gate\n' + JSON.stringify(GATE) + '\n' + TICKS + '\n');
     const out = execFileSync(process.execPath, [HOOK], {
       input: JSON.stringify({ session_id: MINE, cwd: root, hook_event_name: 'PostToolUse', tool_name: 'Write', agent_id: AGENT, tool_input: { file_path: file } }),
       encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
     });
     const said = JSON.parse(out).hookSpecificOutput.additionalContext;
     assert.match(said, /invalid at report/);
     assert.match(said, new RegExp(second.id));
   });
   ```
2. Run `node --test tests/gate-check-patrol.test.js tests/gate-write-patrol.test.js` and watch both fail: the first `main` returns code 0, and the hook prints nothing.
3. Write the gate-check wiring. In `scripts/gate-check.js`, replace `const { readGate } = require('../lib/handoff.js');` with:

   ```js
   const { readGate, patrolEntries } = require('../lib/handoff.js');
   ```

   and, in `scripts/gate-check.js`, replace `{ pause: true, floor: mine.floor, ids: todo.ids });` with:

   ```js
   { pause: true, floor: mine.floor, ids: todo.ids, patrol: patrolEntries(at, mine) });
   ```

   `scripts/gate-check.js` already exports `main` (line 47).
4. Write the gate hook wiring. In `hooks/gate.js`, in the handoff destructure on line 52, add `patrolEntries` after `readGate`; and, in `hooks/gate.js`, replace `{ pause: true, floor: mine.floor, ids: todo.ids });` with:

   ```js
   { pause: true, floor: mine.floor, ids: todo.ids, patrol: patrolEntries(root, mine) });
   ```
5. Write the gate-write wiring. In `hooks/gate-write.js`, replace `const { handoffPath, readGate } = require('../lib/handoff.js');` with:

   ```js
   const { handoffPath, readGate, patrolEntries } = require('../lib/handoff.js');
   ```

   and, in `hooks/gate-write.js`, replace `{ pause: true, floor: mine.floor });` with:

   ```js
   { pause: true, floor: mine.floor, patrol: patrolEntries(root, mine) });
   ```
6. Run `node --test tests/gate-check-patrol.test.js tests/gate-write-patrol.test.js tests/gate-check.test.js tests/gate-write.test.js`; all pass.
7. Commit: `feat: gate, gate-write and gate-check pass the patrol's open entries`.

## Coverage

| promise | task |
|---|---|
| A patrol is a task whose route is exactly `survey,plan,build,verify,land`, the | Task 3 |
| `readGate` refuses the gate when any open entry has no line, above the last | Task 3 |
| The refusal names the missing ids, so the stage agent knows which to add. | Task 3 |
| Scope: entry-file TODOs and a controlled survey only — a hand-written | Task 3 (fix row, the skill paragraph) |
| `hooks/gate.js`, `hooks/gate-write.js` and `scripts/gate-check.js` pass the | Task 4 |
| The survey skill's `## The patrol` says the check exists. | Task 3 |
| `docs/90-agent/reference/station.md`'s three references to | Task 1 |
| README.md's paragraph on parallel `npm test` runs names the commit-limit | Task 2 |
| a patrol survey report missing an entry is refused | Task 3 |
| a report naming every open entry with a disposition passes | Task 3 |
| a task not on the patrol route, or not at survey, is not checked | Task 3 |
| station.md's three references resolve and carry quotes | Task 1 |
| README.md names the signature | Task 2 |
