---
status: current
---

# TODO patrol 2026-10-21 Implementation Plan

**Goal:** Build the four do-now TODO entries the patrol found (舊 await 通知別叫醒主對話, agent 分支與 worktree 殘留, 紅燈時 suite.js 留下完整 TAP, the land mover commit rule) plus the knip re-check, and bring README.md and the guide pages back in line with the code.
**Architecture:** Each code change stays inside the script that owns it — `scripts/await.js`, `lib/suite.js` + `scripts/suite.js`, `scripts/residue.js` + `scripts/land.js`, two agent files — with its own test file. Documentation tasks correct only sentences the survey proved false, then move `last_verified`.
**Tech Stack:** Node >=22.5, CommonJS, `node:test`; no dependencies may be added (package.json has none).
**Spec:** [survey.md](../../../.fankeel/build/task-20261020T160900/survey.md)

## Global Constraints

- `lib/*.js` never requires from `scripts/` or `hooks/`; `scripts/*.js` are thin wrappers over `lib/` (CONTRIBUTING.md, Scope and ownership).
- Every hook exits `0` on every path (CONTRIBUTING.md).
- Every exported name needs an importer, and a new test file must be `git add`ed before `tests/source.test.js` can see it (CONTRIBUTING.md).
- Version numbers move only through `node scripts/version.js`; it keeps sixteen files in agreement (CONTRIBUTING.md:24, `node scripts/version.js` prints `in all 16 places`).
- TODO entries are written only by `scripts/todo.js`; `node scripts/todo-check.js` must exit 0 (CONTRIBUTING.md).
- A tests file's own run: `node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js tests/<file>.test.js` (package.json:11). Implementers run only their own test file, never the full suite.
- Commit subjects read `type: subject` with types `feat`, `fix`, `docs`, `chore`, `refactor` (last 50 subjects).
- Reference pages (`docs/90-agent/reference`, `agents`, `skills`, `lib/chartroom`) are checked by `node scripts/docs-check.js --root .`; a backticked `name()` in one must be a declared symbol (scripts/docs-check.js:422).
- `.claude/agents/*.md` are generated from `agents/*.md` by `task.js start` (`agent file: rewritten`); edit the source only.

## Risks
- runSuite's result now carries `stdout`; a test that `deepEqual`s a whole runSuite result would break — Task 2 — grep `tests/suite*.test.js` for `deepEqual(suite.runSuite` before editing.
- `git worktree remove` on Windows can fail on a locked file — Task 3 — the sweep keeps the entry with the git error as its reason instead of forcing.
- `gateAsked.at` keeps the first ask's time when the same gate is re-asked (lib/registry.js:658) — Task 1 — compare against the handoff's mtime, which moves when the file is rewritten, so a rewritten handoff still prints.
- knip 6.42.1 may now resolve the namespace access — Task 5 — if `--trace-export clearBadge` finds an import, stop and report instead of editing.

## Task 1: an await whose handoff was already asked exits quietly

**Files:**
- Modify: `scripts/await.js` — `main`'s end: a handoff already asked returns a `stale` line instead of the `handoff` line
- Read: `lib/registry.js` — `readSession(projectRoot, sessionId)` and the `gateAsked = { stage, hash, at }` field `gateOpen` writes (:654-664)
- Test: `tests/await-stale.test.js`

**Interfaces:**
- Consumes: `registry.readSession(root, sessionId)` → record or null
- Produces: `already(root, sessionId, handoff)` → boolean, exported from `scripts/await.js`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. In `tests/await-stale.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');
const { already } = require('../scripts/await.js');

const SID = 'b7a7d8d4-0000-0000-0000-000000000001';

function setup(askedAt, fileMs) {
    const root = tmp('fankeel-await-stale-');
    registry.writeSession(root, SID, { task: 't', stage: 'survey', active: true, started: '2026-10-21T00:00:00.000Z', gateAsked: { stage: 'survey', hash: 'h', at: askedAt } });
    const file = path.join(root, 'survey.md');
    fs.writeFileSync(file, 'report');
    fs.utimesSync(file, fileMs / 1000, fileMs / 1000);
    return { root, file };
}

test('a handoff asked after its last change is already asked', () => {
    const { root, file } = setup(2000000000000, 1999999990000);
    assert.equal(already(root, SID, file), true);
});

test('a handoff rewritten after the ask is not already asked', () => {
    const { root, file } = setup(1999999990000, 2000000000000);
    assert.equal(already(root, SID, file), false);
});

test('no gateAsked, or no file, is not already asked', () => {
    const root = tmp('fankeel-await-stale-');
    registry.writeSession(root, SID, { task: 't', stage: 'survey', active: true, started: '2026-10-21T00:00:00.000Z' });
    assert.equal(already(root, SID, path.join(root, 'missing.md')), false);
});
```

2. Run it and watch it fail: `node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js tests/await-stale.test.js` — `already is not a function`.

3. Write the implementation. In `scripts/await.js`, above the comment block that sits directly on `function holder(file, agentId)` (that comment stays attached to `holder`), add:

```js
// A handoff whose gate went out after the file last changed has been asked
// already: an older await finishing on it has nothing left to say, and its
// `handoff` line would only wake the session to say so (TODO 舊 await 通知別叫醒主對話).
function already(root, sessionId, handoff) {
    try {
        const rec = registry.readSession(root, sessionId);
        const at = rec && rec.gateAsked && rec.gateAsked.at;
        return Number.isFinite(at) && at >= fs.statSync(handoff).mtimeMs;
    } catch (e) {
        return false;
    }
}
```

   In `scripts/await.js`, in `main`, change the final `return state === 'handoff' ? pageLine(o)...` line to:

```js
        if (state === 'handoff' && already(o.root, opts.session, o.handoff)) return { text: 'stale ' + o.handoff + ' — already asked; nothing to do, end the turn without a reply.' };
        return state === 'handoff' ? pageLine(o).then((page) => ({ text: line + (page ? PAGE_OPEN : '') + page })) : { text: line };
```

   and add `already` to `scripts/await.js`'s `module.exports`.

4. Run the test file and watch it pass, then `tests/await.test.js` the same way: both green.

5. Commit: `fix: an await on a handoff already asked says stale, not handoff`.

## Task 2: a red suite run leaves its full TAP beside suite.json

**Files:**
- Modify: `lib/suite.js` — `runSuite` returns `stdout`; `record` writes or removes `suite.tap` and keeps `stdout` out of the JSON
- Modify: `scripts/suite.js` — the result line names the TAP file on red
- Test: `tests/suite-tap.test.js`

**Interfaces:**
- Consumes: none
- Produces: `suite.tapPath(file)` → string, the `suite.tap` beside a `suite.json` path

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. In `tests/suite-tap.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const suite = require('../lib/suite.js');
const tmp = require('./tmp.js');

const DATA = { task: 't', stage: 'land', active: true, started: '2026-09-19T09:30:12.345Z' };

function repo(body) {
    const dir = tmp('fankeel-suite-tap-');
    const git = (args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
    git(['init', '-q']);
    git(['config', 'user.email', 't@example.com']);
    git(['config', 'user.name', 'T']);
    fs.writeFileSync(path.join(dir, 'a.test.js'), body);
    git(['add', '-A']);
    git(['commit', '-qm', 'first']);
    return dir;
}

test('a red run writes suite.tap with the not ok block; a green run removes it @slow', () => {
    const dir = repo("require('node:test')('a', () => { throw new Error('boom 42'); });\n");
    const file = suite.record(dir, DATA, suite.runSuite(dir, 'node --test'));
    const tap = suite.tapPath(file);
    assert.match(fs.readFileSync(tap, 'utf8'), /not ok \d+ - a[\s\S]*boom 42/);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).stdout, undefined, 'the TAP stays out of suite.json');
    fs.writeFileSync(path.join(dir, 'a.test.js'), "require('node:test')('a', () => {});\n");
    suite.record(dir, DATA, suite.runSuite(dir, 'node --test'));
    assert.equal(fs.existsSync(tap), false);
});
```

2. Run it and watch it fail: `node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js tests/suite-tap.test.js` — `suite.tapPath is not a function`.

3. Write the implementation. In `lib/suite.js`, in `runSuite`, change the return line to carry the output:

```js
    return { sha: headOf(projectRoot), at: new Date().toISOString(), command, pass: totals.pass, fail: totals.fail, failed: totals.failed, ok: r.status === 0, ms, stdout: String(r.stdout || '') };
```

   In `lib/suite.js`, above `function record(root, data, result)`, add:

```js
// The whole TAP of the last red run, beside suite.json: a name in `failed`
// says which test, never which assertion or number (TODO 紅燈時 suite.js 留下完整 TAP).
function tapPath(file) {
    return path.join(path.dirname(file), 'suite.tap');
}
```

   In `lib/suite.js`, in `record`, replace `delete run.runs;` with:

```js
    delete run.runs;
    delete run.stdout;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!result.ok && result.stdout) fs.writeFileSync(tapPath(file), result.stdout);
    else fs.rmSync(tapPath(file), { force: true });
```

   and add `tapPath` to `lib/suite.js`'s `module.exports`.

   In `scripts/suite.js`, change the `return { text: line + noFast + ...` line to:

```js
    const tap = file && !result.ok && fs.existsSync(suite.tapPath(file)) ? ' — TAP: ' + suite.tapPath(file) : '';
    return { text: line + noFast + tap + (file ? '' : ' (not recorded: the entry has no started stamp)'), ok: result.ok };
```

4. Run `tests/suite-tap.test.js` and `tests/suite.test.js` the same way; both green. If a test in `tests/suite.test.js` `deepEqual`s a whole runSuite result, add `stdout` to its expectation rather than dropping the field.

5. Commit: `feat: a red suite run keeps its TAP beside suite.json`.

## Task 3: residue --sweep clears spent agent worktrees and branches, land reports it

**Files:**
- Modify: `scripts/residue.js` — new `sweep(root)` and a `--sweep` flag
- Modify: `scripts/land.js` — `main` appends the sweep's lines after a successful `clean` only, so `merge` keeps printing `<base>..<sha>` (skills/fankeel-land/SKILL.md:376-379)
- Test: `tests/residue-sweep.test.js`

**Interfaces:**
- Consumes: `worktreesOf(root)`, `git(root, args)` (both in `scripts/residue.js`)
- Produces: `sweep(root, { now } = {})` → `{ removed: string[], kept: { name: string, why: string }[] }`; `sweepLines(result)` → string[]

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. In `tests/residue-sweep.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { sweep } = require('../scripts/residue.js');
const tmp = require('./tmp.js');

const HOUR = 3600000;

function repo() {
    const root = tmp('fankeel-sweep-');
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    git('init', '-q');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 'T');
    fs.writeFileSync(path.join(root, '.gitignore'), '.claude/worktrees/\n');
    git('add', '-A');
    git('commit', '-qm', 'first');
    return { root, git, home: git('rev-parse', '--abbrev-ref', 'HEAD') };
}

function agent(r, name, file) {
    const where = path.join(r.root, '.claude', 'worktrees', name);
    r.git('worktree', 'add', '-q', '-b', 'worktree-' + name, where);
    fs.writeFileSync(path.join(where, file), name);
    execFileSync('git', ['add', '-A'], { cwd: where });
    execFileSync('git', ['commit', '-qm', name], { cwd: where });
    return { where, sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: where, encoding: 'utf8' }).trim() };
}

test('sweep removes a picked clean agent worktree and keeps dirty or unlanded ones @slow', () => {
    const r = repo();
    const picked = agent(r, 'agent-picked', 'p.txt');
    r.git('cherry-pick', picked.sha);
    const dirty = agent(r, 'agent-dirty', 'd.txt');
    r.git('cherry-pick', dirty.sha);
    fs.writeFileSync(path.join(dirty.where, 'scratch.txt'), 'uncommitted');
    agent(r, 'agent-open', 'o.txt');
    assert.deepEqual(sweep(r.root).removed, [], 'a worktree touched in the last two hours may be a live agent');
    const result = sweep(r.root, { now: Date.now() + 3 * HOUR });
    assert.deepEqual(result.removed, ['worktree-agent-picked']);
    assert.equal(fs.existsSync(picked.where), false);
    assert.equal(r.git('branch', '--list', 'worktree-agent-picked'), '');
    const why = Object.fromEntries(result.kept.map((k) => [k.name, k.why]));
    assert.match(why['worktree-agent-dirty'], /uncommitted/);
    assert.match(why['worktree-agent-open'], /commits HEAD lacks/);
});

test('sweep deletes a spent agent branch that has no worktree @slow', () => {
    const r = repo();
    const a = agent(r, 'agent-gone', 'g.txt');
    r.git('cherry-pick', a.sha);
    r.git('worktree', 'remove', '--force', a.where);
    assert.deepEqual(sweep(r.root).removed, ['worktree-agent-gone']);
    assert.equal(r.git('branch', '--list', 'worktree-agent-gone'), '');
});

test('sweep removes a clean detached agent worktree whose branch is already gone @slow', () => {
    const r = repo();
    const a = agent(r, 'agent-orphan', 'x.txt');
    r.git('cherry-pick', a.sha);
    execFileSync('git', ['checkout', '-q', '--detach'], { cwd: a.where });
    r.git('branch', '-D', 'worktree-agent-orphan');
    const result = sweep(r.root, { now: Date.now() + 3 * HOUR });
    assert.deepEqual(result.removed, [a.where]);
    assert.equal(fs.existsSync(a.where), false);
});
```

2. Run it and watch it fail: `node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js tests/residue-sweep.test.js` — `sweep is not a function`.

3. Write the implementation. In `scripts/residue.js`, above `function parseArgs(argv)`, add:

```js
// Every worktree-agent-* branch whose commits HEAD already has, with its
// worktree when one is checked out and clean, is removed; anything holding
// uncommitted files or a commit HEAD lacks is kept and said, never forced
// (TODO agent 分支與 worktree 殘留). A worktree in use by a live session, or
// touched in the last two hours, may be an agent still running and is kept.
const SWEEP_QUIET_MS = 2 * 3600000;

function sweepable(root, w, now) {
    if (w.inUse) return 'in use by a live session';
    try {
        if (now - fs.statSync(w.path).mtimeMs < SWEEP_QUIET_MS) return 'touched in the last two hours';
    } catch (e) {}
    const status = git(w.path, ['status', '--porcelain']);
    if (status === null || status.length) return 'uncommitted files in ' + w.path;
    return null;
}

function sweep(root, { now = Date.now() } = {}) {
    const removed = [];
    const kept = [];
    const listed = worktreesOf(root);
    const trees = new Map(listed.filter((w) => w.branch).map((w) => [w.branch, w]));
    for (const name of (git(root, ['branch', '--list', 'worktree-agent-*', '--format=%(refname:short)']) || []).map((s) => s.trim()).filter(Boolean)) {
        const cherry = git(root, ['cherry', 'HEAD', name]);
        if (cherry === null || cherry.some((l) => l.startsWith('+'))) { kept.push({ name, why: 'holds commits HEAD lacks' }); continue; }
        const w = trees.get(name);
        if (w) {
            const why = sweepable(root, w, now);
            if (why) { kept.push({ name, why }); continue; }
            if (git(root, ['worktree', 'remove', w.path]) === null) { kept.push({ name, why: 'git worktree remove failed for ' + w.path }); continue; }
        }
        if (git(root, ['branch', '-D', name]) === null) { kept.push({ name, why: 'git branch -D failed' }); continue; }
        removed.push(name);
    }
    for (const w of listed.filter((t) => !t.branch && path.basename(t.path).startsWith('agent-'))) {
        const head = git(w.path, ['rev-parse', 'HEAD']);
        const cherry = head && head[0] ? git(root, ['cherry', 'HEAD', head[0]]) : null;
        if (cherry === null || cherry.some((l) => l.startsWith('+'))) { kept.push({ name: w.path, why: 'holds commits HEAD lacks' }); continue; }
        const why = sweepable(root, w, now);
        if (why) { kept.push({ name: w.path, why }); continue; }
        if (git(root, ['worktree', 'remove', w.path]) === null) { kept.push({ name: w.path, why: 'git worktree remove failed' }); continue; }
        removed.push(w.path);
    }
    return { removed, kept };
}

function sweepLines(result) {
    const lines = [];
    if (result.removed.length) lines.push('swept ' + result.removed.length + ' spent agent branch(es): ' + result.removed.join(', '));
    for (const k of result.kept) lines.push('kept ' + k.name + ' — ' + k.why);
    return lines;
}
```

   In `scripts/residue.js`, change `parseArgs`'s options to `{ root: { type: 'string' }, sweep: { type: 'boolean' } }` and its return to `{ root: resolveRoot(typeof values.root === 'string' ? values.root : undefined), sweep: values.sweep === true }`. In the `require.main === module` block, before `scan`, add:

```js
    const args = parseArgs(process.argv.slice(2));
    if (args.sweep) {
        process.stdout.write((sweepLines(sweep(args.root)).join('\n') || 'nothing to sweep') + '\n');
        process.exit(0);
    }
```

   and add `sweep, sweepLines` to `scripts/residue.js`'s `module.exports`.

   In `scripts/land.js`, add `const { sweep, sweepLines } = require('./residue.js');` under its requires, and change `main`'s last line to:

```js
    if (verb === 'merge') return merge(root, values.session);
    const r = clean(root, values.session);
    if (r.code !== 0) return r;
    const swept = sweepLines(sweep(root));
    return swept.length ? { ...r, text: r.text + '\n' + swept.join('\n') } : r;
```

   (`main` is synchronous; `merge`'s output is untouched.) Check that `scripts/residue.js` already requires `node:fs` and `node:path`; add whichever is missing.

4. Run `tests/residue-sweep.test.js`, `tests/residue.test.js` and `tests/land.test.js` the same way; all green.

5. Commit: `feat: residue --sweep and land clear spent agent worktrees`.

## Task 4: the mover never commits; brain sends commits to commit.js

**Files:**
- Modify: `agents/fankeel-mover.md` — the opening line and Refusals name `git commit`
- Modify: `agents/fankeel-brain.md:94-104` — the mover is for moves; commits go through commit.js
- Test: `tests/mover-commit.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the text; transcription plus a test.

1. Write the failing test. In `tests/mover-commit.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('the mover refuses git commit, and brain never sends it a git write', () => {
    const refusals = read('agents/fankeel-mover.md').split('## Refusals')[1].split('## Return')[0];
    assert.match(refusals, /`git commit`/);
    assert.doesNotMatch(read('agents/fankeel-brain.md'), /for a move or a git write/);
    assert.match(read('agents/fankeel-brain.md'), /scripts\/commit\.js/);
});
```

2. Run it and watch it fail: `node --test tests/mover-commit.test.js`.

3. Write the change. In `agents/fankeel-mover.md`, replace lines 12-13 with:

```md
You are a mover. Audit's and land's stage agent cannot run a git write; you
run the moves it names and change no file's content. A commit is never yours:
it goes through `node <plugin>/scripts/commit.js`, run by the session.
```

   In `agents/fankeel-mover.md`, under `## Refusals`, after the `git push` bullet, add:

```md
- `git commit`, `git cherry-pick`, `git rebase`: a commit goes through
  `commit.js`, which checks the format and the word list a raw commit skips.
```

   In `agents/fankeel-brain.md`, replace `` `fankeel:fankeel-mover` for a move or a git write, `` with:

```md
`fankeel:fankeel-mover` for a move — never a commit, which goes back to the
session as a commit request for `node <plugin>/scripts/commit.js`,
```

   In `agents/fankeel-mover.md` and `agents/fankeel-brain.md`, set `last_verified: 2026-10-21` in the frontmatter.

4. Run `tests/mover-commit.test.js` and `tests/agents.test.js` the same way; green. Then `node scripts/docs-check.js --root .` shows no finding in either file.

5. Commit: `fix: the mover refuses commits; land commits go through commit.js`.

## Task 5: re-run the knip check on 6.42.1

**Files:**
- Modify: `docs/90-agent/todo/build-1.md` — one more dated re-run sentence and the new stamp
- Test: none (todo-check is the check)

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — one command and one sentence.

1. Run: `npx --yes knip@6.42.1 --trace-export clearBadge`.
2. If its output names any import of `clearBadge`, stop and return `knip 6.42.1 resolves clearBadge` with the output lines — do not edit.
3. Otherwise, in `docs/90-agent/todo/build-1.md`, change `stamp: 2026-10-19` to `stamp: 2026-10-21`, and in the `來源：` paragraph after its last sentence add:

```md
2026-10-21 的盤點用 6.42.1 重跑 `npx knip@6.42.1 --trace-export clearBadge`，仍是 (no imports found)。
```

   and in the `description:` line change `6.42.0 仍認不得` to `6.42.1 仍認不得` and `10-19 重跑` to `10-21 重跑`.
4. Run `node scripts/todo-check.js`; exit 0.
5. Commit: `docs: knip 6.42.1 still misses CJS namespace access`.

## Task 6: README.md matches the tree, plus two init leftovers

**Files:**
- Modify: `README.md` — :216 and :249, and three features it never names
- Modify: `lib/chartroom/README.md` — :7 drops the backticked `import()`
- Modify: `agents/fankeel-init-scout.md` — `last_verified`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the text; transcription plus docs-check.

1. In `README.md:216`, change `pane.ts beside it, with pane-bar.ts, pane-band.ts, pane-status.ts, pane-gate.ts and pane-svg.ts,` to `pane.ts beside it, with pane-bar.ts, pane-band.ts, pane-status.ts, pane-gate.ts, pane-svg.ts and pane-agents.ts,` and change `and toggled by /fankeel-panel` to `and toggled by the /fankeel-panel command pane.ts registers`.
2. In `README.md:249`, change the skills row to:

```md
├── skills/            one directory per skill — fankeel, one per stage, ask, audit, explain, init, retro-all, station, upgrade — and registry.json
```

3. In `README.md`, in the `## Where to find things` table (README.md:173-186), add these three rows directly above the `| Why any of it was built this way |` row:

```md
| How a deferred thing becomes a TODO entry under `docs/90-agent/todo/`, and what `todo-check` refuses | [docs/todo.md](docs/90-agent/reference/todo.md) |
| What a task's `.board` drawing is, and where the station shows it as `AI 畫的圖` | [docs/station.md](docs/90-agent/reference/station.md) |
| How a session is exported as one masked bundle under `.fankeel/bundles/`, and how every bundle is reviewed at once | [skills/fankeel-retro-all](skills/fankeel-retro-all/SKILL.md) |
```

4. In `lib/chartroom/README.md:7`, change ``loads it with dynamic `import()`.`` to `loads it with a dynamic import.`
5. In `agents/fankeel-init-scout.md`, change `last_verified: 2026-09-30` to `last_verified: 2026-10-21` (a reader checked it against `scripts/input-check.js` on 2026-10-21 and found nothing false).
6. Run `node scripts/docs-check.js --root .`; no finding in the three files.
7. Commit: `docs: README names the skills, hooks and features it missed`.

## Task 7: the guide pages say sixteen, fourteen hooks and three stage agents

**Files:**
- Modify: `docs/01-guide/development.md` — :22-35, :178-208, :268-276, `last_verified`
- Modify: `docs/01-guide/profile.md` — :70, `last_verified`
- Modify: `docs/01-guide/station.md` — :35, `last_verified`
- Read: `.fankeel/profile.json` — `stage.agents`, which profile.md:70 now quotes
- Read: `docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/ab.sh` — the path profile.md:70 keeps citing

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the text; transcription plus docs-check.

1. In `docs/01-guide/development.md`, replace every `fifteen` with `sixteen` and `thirteen skills` with `fourteen skills` in :178-208 (the heading at :178, :180-181, :183, :202, :208).
2. In `docs/01-guide/development.md:31-32`, replace the quoted command with:

```md
`node --test --test-timeout=300000 --test-force-exit --test-skip-pattern=@slow --require ./tests/subprocess-timeout.js`;
```

3. In `docs/01-guide/development.md:275`, change `of the 74 test files, against 35 destructured lines across 26.` to `of the 74 test files there were on 2026-10-01, against 35 destructured lines across 26; tests/ held 348 test files on 2026-10-21.` — re-count with `ls tests/*.test.js | wc -l` and write that number in place of 348 if it differs.
4. In `docs/01-guide/profile.md:70`, replace the paragraph with:

```md
本 repo 的 `stage.agents` 現在是 `survey`、`build`、`verify`（`.fankeel/profile.json`）。2026-10-09 起原本只交 `survey`：工作流評審指出 build 加 verify 占長任務花費的 63.9%，當時只量過 survey 打平；之後 build 與 verify 也加了回來。對照腳本在 `docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/ab.sh`，判定規則寫在旁邊的 README。
```

5. In `docs/01-guide/station.md:35`, after `點任一個 session 會進它自己的頁面 \`#/s/<id>\`，有六個分頁。` keep the sentence and add at the end of the paragraph:

```md
session 卡上若這個任務畫過圖，會多一塊「AI 畫的圖」，點開是那張 `.board` 畫成的 SVG；專案卡則連到專案的架構圖。
```

6. Set `last_verified: 2026-10-21` in all three pages' frontmatter.
7. Run `node scripts/docs-check.js --root .`; no finding in the three pages.
8. Commit: `docs: guide pages catch up with sixteen, the hooks and stage agents`.

## Task 8: re-read three reference pages whose sources moved, then restamp

**Files:**
- Modify: `docs/02-architecture/pipeline.md` — false sentences corrected, `last_verified`
- Modify: `docs/01-guide/concepts.md` — false sentences corrected, `last_verified`
- Modify: `docs/01-guide/getting-started.md` — false sentences corrected, `last_verified`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — reading each page against the files its `source_of_truth` names; the corrections are not known before the read.

1. For each page, list what changed since its `last_verified`: `git log --since=<last_verified> --format='%h %s' -- <each source_of_truth path>`.
2. Read the page against those changes. For every sentence now false, rewrite it to what the code does, citing `path:line`. Write nothing that the commits did not change.
3. Set `last_verified: 2026-10-21` on each page.
4. Run `node scripts/docs-check.js --root .` and `node scripts/docs-audit.js --root .`; neither names these pages.
5. Commit: `docs: re-verify pipeline, concepts and getting-started`.

## Task 9: re-read the docs index, then restamp

**Files:**
- Modify: `docs/README.md` — false rows corrected, `last_verified`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — reading the index against the tree; the corrections are not known before the read.

1. Run `node scripts/docs-audit.js --root .` and read its `missing from docs/README.md` and broken-index lines; fix each (a row for a missing page in its section's style, a dead row removed).
2. For each row whose one-line description names a count or a file list, check it against the page it links; rewrite only what is false.
3. Set `last_verified: 2026-10-21` in the frontmatter.
4. Run `node scripts/docs-check.js --root .` and `node scripts/docs-audit.js --root .`; neither names `docs/README.md`.
5. Commit: `docs: re-verify the docs index`.

## Coverage

| promise | task |
|---|---|
| await-10 — scripts/await.js:219-236 仍只印 already awaiting，沒有過期靜默退出；disposition: do now | Task 1 |
| land-6 — commit.js:180-186、land.js:75-79、residue.js:297-311 吻合 | Task 3 |
| suite-1 — lib/suite.js:74-79 仍只留總數與失敗葉名，無 TAP 存檔；disposition: do now | Task 2 |
| land-5 — lib/stages.js:705 仍只列 build/design/plan 有 commit 規則 | Task 4 (user chose: mover and brain only) |
| build-1 — npm view knip 現為 6.42.1 | Task 5 |
| README.md:249 — 寫「one directory per skill | Task 6 |
| README.md:216 — compact.ts 的伴隨檔清單缺 hooks/pane-agents.ts | Task 6 |
| README 缺漏的近期功能：遮罩後的 session 包 | Task 6 |
| docs/01-guide/development.md:178-183（及約 205-218 的步驟 3、5）— 寫「fifteen files／thirteen skills」 | Task 7 |
| docs/01-guide/development.md:268-276 — 「nine hooks／74 test files」 | Task 7 — the 74 is dated and today's count added; `nine hooks` struck — the string is not in the page (reviewer, 2026-10-21) |
| docs/01-guide/profile.md:70 — 稱本 repo 只交 survey | Task 7 |
| docs/01-guide/station.md:35 — 沒提 session 卡的「AI 畫的圖」 | Task 7 |
| last_verified 落後來源：docs/README.md、pipeline.md（10-10）、profile.md（10-15）、concepts.md、getting-started.md | Tasks 7, 8, 9 |
| init 殘項：agents/fankeel-init-scout.md 只需移動 last_verified | Task 6 |
