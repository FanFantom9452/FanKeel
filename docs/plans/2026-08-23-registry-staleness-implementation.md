---
status: design-intent
last_verified: 2026-08-23
source_of_truth: lib/registry.js, lib/render.js, scripts/task.js, hooks/touch.js
---

# Registry Staleness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the registry notice both ways it goes stale — the work moving out from under a declared scope, and a claim outliving the terminal that made it.

**Architecture:** Three additions, no new concepts. A `drift` field on the session entry, mirroring `notes` in shape and caps, written by a fifth hook on `PostToolUse` and filtered against current scope at read time so `scope --add` clears it for free. A `clear` subcommand that puts another session's claim down without inheriting its task. And two blocks in the injected text, each present only when it applies and each printing a command that runs exactly as shown.

**Tech Stack:** Node.js, built-ins only. `node:test` + `node:assert/strict`. No dependencies — `package.json` is `private: true` and has none.

**Spec:** [docs/plans/2026-08-23-registry-staleness-design.md](2026-08-23-registry-staleness-design.md)

## Global Constraints

Generated from this repository via `node scripts/map.js`, `package.json` and the test suite, not copied from prose. Every task's requirements implicitly include this section.

| Constraint | Exact value | Source |
|---|---|---|
| Dependencies | none may be added. `"private": true`, no `dependencies` key at all | `package.json` |
| Test command | `npm test` → `node --test` | `package.json` scripts |
| Current suite | **509 pass, 0 fail.** Any task leaving it lower has broken something | `npm test` |
| Hook exit code | **every hook exits 0 on every path, including every error path** | `README.md`, and every `hooks/*.js` header |
| Hook timeout | `5` seconds, in every manifest entry | `.claude-plugin/plugin.json` |
| Hook test style | driven as a subprocess with a real payload via `execFileSync`, `CLAUDE_PROJECT_DIR` set explicitly rather than inherited | `tests/guard.test.js:36-40` |
| Session id shape | `/^[0-9a-fA-F][0-9a-fA-F-]{7,63}$/` | `lib/registry.js` `SESSION_ID` |
| Existing caps | `MAX_NOTES = 5`, `MAX_NOTE_LEN = 100`, `MAX_NEXT_LEN = 120`, `STALE_MS = 12 * 60 * 60 * 1000` | `lib/registry.js:16,33-35` |
| Eviction shape | `slice(-MAX)` — newest last, oldest evicted. A repeat is dropped, **not** moved to the end | `lib/registry.js` `addNote` |
| Badge word | `MAX_WORD = 16`, stripped to `[a-z0-9-]` | `lib/badge.js` |
| Deactivation rule | *Nothing here deactivates anything.* No timer may be added that does | `lib/registry.js:7-10` |
| Registry marker | the walk-up looks for `.fankeel/sessions/`, never `.fankeel/` | `lib/registry.js` `findStateRoot` |
| Scope frame | scope entries are **registry-relative**, not relative to where the session opened | `docs/registry.md` |
| Version alignment | one string in **10 files**: `.claude-plugin/plugin.json`, `package.json`, and the `version:` frontmatter of all 8 `skills/*/SKILL.md`. **No test asserts this** — it is manual discipline | `grep -rl 0.24.0` |
| Docs frontmatter | `status` / `last_verified` / `source_of_truth`; a plan is `design-intent` until it lands | `docs/documents.md` |
| Doc gates | `node scripts/docs-check.js`, `node scripts/docs-audit.js`, `node scripts/todo-check.js` must all exit 0 | `docs/README.md` |
| Indentation | 4 spaces in `lib/`, `hooks/`, `scripts/`; 2 spaces in `tests/` | existing files |
| Commit style | Conventional Commits, lowercase subject, body says *why* | `git log` |

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `lib/registry.js` | the `drift` field: caps, write, read-filter | 1 |
| `hooks/touch.js` | **new.** observes an edit, records it when it lands outside scope | 2 |
| `.claude-plugin/plugin.json` | registers the fifth hook | 2 |
| `tests/resume.test.js` | its manifest assertion is re-expressed against resume's own entry | 2 |
| `README.md` | the hook count on the front page | 2 |
| `lib/render.js` | `TASK_SCRIPT`, the session id in commands, the drift block, the all-cold block | 3, 6 |
| `scripts/task.js` | `adopt` carries `drift`; new `clear` and `--force` | 4, 5 |
| `lib/guard.js` | its refusal text names `clear` now that it exists | 5 |
| `skills/fankeel/SKILL.md` | the scope question's copy; `clear` in the command list | 5, 7 |
| `docs/registry.md`, `docs/collisions.md` | the field, and how a claim outlives its terminal | 1, 5 |

`lib/overlap.js` gains a consumer but no change: `entriesOverlap` is already exported and already pure.

---

## Task 1: `drift` on the session entry

**Files:**
- Modify: `lib/registry.js`
- Modify: `docs/registry.md`
- Test: `tests/registry.test.js`

**Interfaces:**
- Consumes: `entriesOverlap(a, b)` from `lib/overlap.js`, already exported.
- Produces: `MAX_DRIFT = 5`, `MAX_DRIFT_LEN = 200`, `addDrift(projectRoot, sessionId, rel) -> boolean`, `driftOf(data) -> string[]`. All four added to `module.exports`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/registry.test.js`:

```js
test('drift records a path outside the declared scope, newest last', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  assert.equal(registry.addDrift(root, MINE, 'api/routes.js'), true);
  assert.equal(registry.addDrift(root, MINE, 'config/flags.json'), true);
  assert.deepEqual(registry.readSession(root, MINE).drift, ['api/routes.js', 'config/flags.json']);
});

test('a repeated path is dropped rather than pushing a still-useful one out', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  registry.addDrift(root, MINE, 'api/a.js');
  registry.addDrift(root, MINE, 'api/b.js');
  registry.addDrift(root, MINE, 'api/a.js');
  assert.deepEqual(registry.readSession(root, MINE).drift, ['api/a.js', 'api/b.js']);
});

test('drift is capped at five, oldest evicted', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  for (const n of [1, 2, 3, 4, 5, 6]) registry.addDrift(root, MINE, 'api/' + n + '.js');
  const held = registry.readSession(root, MINE).drift;
  assert.equal(held.length, registry.MAX_DRIFT);
  assert.equal(held[0], 'api/2.js');
  assert.equal(held[4], 'api/6.js');
});

test('a path too long to paste into scope --add is not recorded at all', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  assert.equal(registry.addDrift(root, MINE, 'api/' + 'x'.repeat(registry.MAX_DRIFT_LEN)), false);
  assert.equal(registry.readSession(root, MINE).drift, undefined);
});

test('driftOf hides what the current scope now covers', () => {
  const data = { scope: ['web'], drift: ['api/routes.js', 'web/late.js'] };
  assert.deepEqual(registry.driftOf(data), ['api/routes.js']);
});

test('widening the scope clears the line with no second code path', () => {
  const data = { scope: ['web', 'api'], drift: ['api/routes.js'] };
  assert.deepEqual(registry.driftOf(data), []);
});

test('a glob in scope covers the path it matches', () => {
  const data = { scope: ['api/**'], drift: ['api/routes.js'] };
  assert.deepEqual(registry.driftOf(data), []);
});

test('an entry written before drift existed reads as no drift', () => {
  assert.deepEqual(registry.driftOf({ scope: ['web'] }), []);
  assert.deepEqual(registry.driftOf(null), []);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/registry.test.js`
Expected: FAIL — `registry.addDrift is not a function`.

- [ ] **Step 3: Write the implementation**

In `lib/registry.js`, beside the existing require of `node:path`:

```js
const { entriesOverlap } = require('./overlap.js');
```

Beside `MAX_NEXT_LEN`:

```js
const MAX_DRIFT = 5;
// A path is recorded whole or not at all. `trim` truncates, and a truncated path
// cannot be pasted into `scope --add` — an entry nobody can act on is worse than
// an absent one.
const MAX_DRIFT_LEN = 200;
```

After `addNote`:

```js
// Where the work went that the task never declared. Newest last, oldest evicted,
// and a repeat dropped rather than moved — the path drifted into first is the one
// that has been ignored longest, so it is the last one worth losing.
//
// It never touches `scope`. A guessed scope produces false collision warnings,
// and a false warning is worse than a missing one.
function addDrift(projectRoot, sessionId, rel) {
    const text = String(rel == null ? '' : rel).trim();
    if (!text || text.length > MAX_DRIFT_LEN) return false;
    const data = readSession(projectRoot, sessionId);
    if (!data) return false;
    const drift = Array.isArray(data.drift) ? data.drift.filter((d) => typeof d === 'string') : [];
    if (drift.includes(text)) return true;
    drift.push(text);
    data.drift = drift.slice(-MAX_DRIFT);
    return writeSession(projectRoot, sessionId, data);
}

// Filtered against the entry's *current* scope rather than deleted when the scope
// widens. `scope --add` therefore clears the line for free: no second code path,
// no bookkeeping that can disagree with itself, and no way for a cleared entry to
// come back.
function driftOf(data) {
    if (!data || !Array.isArray(data.drift)) return [];
    const scope = Array.isArray(data.scope) ? data.scope : [];
    return data.drift
        .filter((d) => typeof d === 'string' && d.trim())
        .filter((d) => !scope.some((s) => entriesOverlap(s, d)))
        .slice(-MAX_DRIFT);
}
```

Add `MAX_DRIFT`, `MAX_DRIFT_LEN`, `addDrift`, `driftOf` to `module.exports`.

- [ ] **Step 4: Run them and watch them pass**

Run: `node --test tests/registry.test.js`
Expected: PASS.

- [ ] **Step 5: Update `docs/registry.md`**

In the *Task memory* section, after the `notes` / `next` paragraph, add:

```markdown
A third field is written by nobody the user talks to. `drift` holds the paths this
task edited that its declared `scope` does not cover — at most five, each recorded
whole, never truncated, because a truncated path cannot be pasted into
`scope --add`. It is read through a filter against the current scope, so widening
the scope clears it without anything having to delete it.
```

- [ ] **Step 6: Run the full suite and the doc gates**

Run: `npm test && node scripts/docs-check.js && node scripts/docs-audit.js`
Expected: 509 + 8 = **517 pass, 0 fail**; both scanners exit 0.

- [ ] **Step 7: Commit**

```bash
git add lib/registry.js tests/registry.test.js docs/registry.md
git commit -m "feat: record where the work went that the scope never named"
```

---

## Task 2: the hook that notices

**Files:**
- Create: `hooks/touch.js`
- Modify: `.claude-plugin/plugin.json`
- Modify: `tests/resume.test.js:206-214`
- Modify: `README.md:183`, `README.md:188`
- Test: `tests/touch.test.js` (new)

**Interfaces:**
- Consumes: `registry.rootFor(payload)`, `registry.readSession(root, id)`, `registry.addDrift(root, id, rel)` from Task 1; `relPath(root, file)` and `covers(scope, rel)` from `lib/guard.js`, both already exported.
- Produces: nothing importable. The hook writes no stdout at all.

- [ ] **Step 1: Write the failing tests**

Create `tests/touch.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const registry = require('../lib/registry.js');
const HOOK = path.join(__dirname, '..', 'hooks', 'touch.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-touch-'));

function seed(root, sessionId, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({
    task: 'fix the ramp', scope: ['web'], stage: 'build', active: true,
    started: new Date(Date.now() - 3600e3).toISOString(),
    updated: new Date().toISOString(),
  }, over);
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

// The real hook, driven the way Claude Code drives it. CLAUDE_PROJECT_DIR is set
// explicitly rather than inherited: a stray one from the session running these
// tests would send the hook off to read a different repository's registry.
function run(root, payload) {
  const env = Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root });
  return execFileSync(process.execPath, [HOOK], { input: JSON.stringify(payload), env, encoding: 'utf8' });
}

const edit = (root, file, session) => ({
  session_id: session || MINE, cwd: root,
  tool_name: 'Edit', tool_input: { file_path: path.join(root, file) },
});

test('an edit outside the declared scope is recorded', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  run(root, edit(root, 'api/routes.js'));
  assert.deepEqual(registry.readSession(root, MINE).drift, ['api/routes.js']);
});

test('an edit inside the declared scope writes nothing at all', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  const before = fs.readFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), 'utf8');
  run(root, edit(root, 'web/page.js'));
  assert.equal(fs.readFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), 'utf8'), before);
});

test('NotebookEdit carries its path under another key', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  run(root, {
    session_id: MINE, cwd: root, tool_name: 'NotebookEdit',
    tool_input: { notebook_path: path.join(root, 'api/explore.ipynb') },
  });
  assert.deepEqual(registry.readSession(root, MINE).drift, ['api/explore.ipynb']);
});

test('a file outside the registry root is not this registry\'s business', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  run(root, { session_id: MINE, cwd: root, tool_name: 'Edit', tool_input: { file_path: path.join(os.tmpdir(), 'elsewhere.js') } });
  assert.equal(registry.readSession(root, MINE).drift, undefined);
});

test('a session with no entry is left alone', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  run(root, edit(root, 'api/routes.js'));
  assert.equal(fs.readdirSync(path.join(root, '.fankeel', 'sessions')).length, 0);
});

test('a stood-down entry records nothing', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'], active: false });
  run(root, edit(root, 'api/routes.js'));
  assert.equal(registry.readSession(root, MINE).drift, undefined);
});

test('it exits 0 on a malformed payload and on a tool with no path', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  const env = Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root });
  execFileSync(process.execPath, [HOOK], { input: 'not json', env, encoding: 'utf8' });
  run(root, { session_id: MINE, cwd: root, tool_name: 'Bash', tool_input: { command: 'ls' } });
  assert.equal(registry.readSession(root, MINE).drift, undefined);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/touch.test.js`
Expected: FAIL — `Cannot find module '../hooks/touch.js'`.

- [ ] **Step 3: Write the hook**

Create `hooks/touch.js`:

```js
#!/usr/bin/env node
'use strict';

// PostToolUse on Edit|Write|NotebookEdit. It records the edits that landed
// outside the scope this task declared, and does nothing else.
//
// It is not on PreToolUse, where guard.js already sits, and the reason is that
// hook's own discipline: silence everywhere except a live collision on a session
// that asked to be guarded, because a PreToolUse hook answering on edits it has
// no opinion about overrides the user's own permission rules. Drift is not a
// permission question and must never gate an edit. This observes something that
// already happened.
//
// Same two rules as every other hook here: exit 0 on every path, and cost nothing
// for a session that is not in the mode. It writes no stdout on any path — a
// PostToolUse hook that speaks appends to the transcript, and this fires on every
// edit in every session on the machine.

const registry = require('../lib/registry.js');
const { relPath, covers } = require('../lib/guard.js');

// Edit and Write carry `file_path`; NotebookEdit carries `notebook_path`. A tool
// with neither is not a write this can reason about.
function targetOf(payload) {
    const input = (payload && payload.tool_input) || {};
    for (const key of ['file_path', 'notebook_path']) {
        if (typeof input[key] === 'string' && input[key]) return input[key];
    }
    return null;
}

function main(raw) {
    let payload;
    try {
        payload = JSON.parse(raw);
    } catch (e) {
        return;
    }
    if (!payload || typeof payload !== 'object') return;

    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;

    const file = targetOf(payload);
    if (!file) return;

    // Outside the registry root is not this registry's business, and a scope
    // entry could not have named it anyway.
    const rel = relPath(root, file);
    if (!rel) return;

    // The common case, and it ends here without a write.
    if (covers(mine.scope, rel)) return;

    try {
        registry.addDrift(root, payload.session_id, rel);
    } catch (e) { /* housekeeping */ }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
    try {
        main(input);
    } catch (e) {
        // Deliberately silent. Whatever went wrong, it happened after the edit
        // landed, and there is nothing left to protect.
    }
});
process.stdin.on('error', () => {});
```

- [ ] **Step 4: Register it in the manifest**

In `.claude-plugin/plugin.json`, append a second entry to the `PostToolUse` array, after the existing `AskUserQuestion` one:

```json
      {
        "matcher": "Edit|Write|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/touch.js\"",
            "timeout": 5,
            "statusMessage": "Noting where the work went..."
          }
        ]
      }
```

- [ ] **Step 5: Run the suite and watch `tests/resume.test.js` go red**

Run: `npm test`
Expected: FAIL in `tests/resume.test.js` — `assert.equal(post.length, 1)` now sees 2.

This is the point of the step. The assertion is not incidental; its own comment says *the matcher is the whole cost control… so the manifest is asserted rather than trusted*. **Do not delete it and do not loosen it to `>= 1`** — either drops a deliberate guard while leaving the test green.

- [ ] **Step 6: Re-express the assertion against resume's own entry**

Replace the body of `tests/resume.test.js`'s `'the manifest runs it on AskUserQuestion and on nothing else'` with:

```js
  const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  const post = plugin.hooks.PostToolUse;
  const mine = post.filter((e) => e.hooks.some((h) => /hooks\/resume\.js/.test(h.command)));
  assert.equal(mine.length, 1, 'resume.js is registered more than once');
  assert.equal(mine[0].matcher, 'AskUserQuestion');
  assert.equal(mine[0].hooks.length, 1);
  assert.equal(mine[0].hooks[0].timeout, 5);
```

Then add, in the same file, the assertion that keeps the *other* entry honest:

```js
test('the drift hook runs on writes and on nothing else', () => {
  const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  const post = plugin.hooks.PostToolUse;
  const touch = post.filter((e) => e.hooks.some((h) => /hooks\/touch\.js/.test(h.command)));
  assert.equal(touch.length, 1);
  assert.equal(touch[0].matcher, 'Edit|Write|NotebookEdit');
  assert.equal(touch[0].hooks[0].timeout, 5);
});
```

- [ ] **Step 7: Correct the count on the front page**

Two edits in `README.md`, neither of which either scanner will catch — the root README sits in no `.fankeel/docs.json` bucket, and `scripts/docs-check.js` says outright that a README beside code is not reported as misfiled.

- `README.md:183`: `all four hooks are tested as subprocesses` → `all five hooks are tested as subprocesses`
- `README.md:188`: `The other two are not load-bearing that way` → `The other three are not load-bearing that way`

- [ ] **Step 8: Run everything**

Run: `npm test && node scripts/docs-check.js && node scripts/docs-audit.js`
Expected: **525 pass, 0 fail**; both scanners exit 0.

- [ ] **Step 9: Commit**

```bash
git add hooks/touch.js tests/touch.test.js tests/resume.test.js .claude-plugin/plugin.json README.md
git commit -m "feat: notice when an edit lands outside the scope the task declared"
```

---

## Task 3: the drift block, and a command that runs as printed

**Files:**
- Modify: `lib/render.js`
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: `driftOf(data)` from Task 1. `render({ mine, others, now, root, launch, transcript })` where `mine` is `{ sessionId, data }` — `hooks/inject.js` already passes it that way.
- Produces: `TASK_SCRIPT`, a seventh resolved script constant in `lib/render.js`, used again by Task 6.

- [ ] **Step 1: Write the failing tests**

Add to `tests/render.test.js`:

```js
test('a session working where it said it would gets no drift block', () => {
  const out = render({
    mine: { sessionId: MINE, data: { task: 't', stage: 'build', scope: ['web'] } },
    others: [], now: Date.now(),
  });
  assert.equal(/scope drift/.test(out), false);
});

test('the drift block names the paths and a command that carries the session id', () => {
  const out = render({
    mine: { sessionId: MINE, data: { task: 't', stage: 'build', scope: ['web'], drift: ['api/routes.js'] } },
    others: [], now: Date.now(),
  });
  assert.match(out, /scope drift — 1 file this task edited outside its declared scope:/);
  assert.match(out, /api\/routes\.js/);
  assert.match(out, /--session aaaaaaaa-0000-4000-8000-000000000001/);
});

// The whole argument of the block is that the remedy is there at the moment it
// matters. A command that needs a substitution the reader cannot make is not one.
test('the command it prints carries no unresolved placeholder', () => {
  const out = render({
    mine: { sessionId: MINE, data: { task: 't', stage: 'build', scope: ['web'], drift: ['api/routes.js'] } },
    others: [], now: Date.now(),
  });
  const line = out.split('\n').find((l) => l.includes('scope "<path>" --add'));
  assert.ok(line, 'no remedy line');
  assert.equal(/<plugin>/.test(line), false);
  assert.match(line, /task\.js/);
  assert.ok(path.isAbsolute(line.trim().split(' ')[1]), 'the script path is not absolute');
});

test('widening the scope takes the block away', () => {
  const out = render({
    mine: { sessionId: MINE, data: { task: 't', stage: 'build', scope: ['web', 'api'], drift: ['api/routes.js'] } },
    others: [], now: Date.now(),
  });
  assert.equal(/scope drift/.test(out), false);
});
```

If `tests/render.test.js` has no `MINE` constant or `path` import, add them at the top:

```js
const path = require('node:path');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/render.test.js`
Expected: FAIL — no `scope drift` line is produced.

- [ ] **Step 3: Write the implementation**

In `lib/render.js`, add `driftOf` to the existing registry import:

```js
const { isStale, ageText, notesOf, nextOf, driftOf } = require('./registry.js');
```

Add a seventh constant beside the six already there:

```js
const TASK_SCRIPT = path.join(__dirname, '..', 'scripts', 'task.js');
```

In `render()`, after the `notes` block and before the `also in progress:` block:

```js
    // Only when the work has left what the task declared, which is no prompt at
    // all on a session working where it said it would.
    //
    // The command is printed whole. `scripts/task.js` refuses without --session,
    // and `<plugin>` is a placeholder that belongs to the skill file, where the
    // line explaining how to resolve it sits beside it — injected text has no such
    // line and must not use it.
    const drift = driftOf(data);
    if (drift.length) {
        lines.push('');
        lines.push('scope drift — ' + drift.length + ' file' + (drift.length === 1 ? '' : 's')
            + ' this task edited outside its declared scope:');
        lines.push('  ' + drift.join(', '));
        lines.push('  node ' + TASK_SCRIPT + ' scope "<path>" --add --session ' + (mine && mine.sessionId));
    }
```

- [ ] **Step 4: Run them and watch them pass**

Run: `node --test tests/render.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: **529 pass, 0 fail**.

- [ ] **Step 6: Commit**

```bash
git add lib/render.js tests/render.test.js
git commit -m "feat: put the remedy for a drifted scope where the drift is reported"
```

---

## Task 4: adopt carries the drift with the task

**Files:**
- Modify: `scripts/task.js` (`cmdAdopt`)
- Test: `tests/task.test.js`

**Interfaces:**
- Consumes: nothing new. `cmdAdopt` already rebuilds the entry field by field and carries `notes`, `next` and `guard`.
- Produces: nothing importable.

- [ ] **Step 1: Write the failing test**

Add to `tests/task.test.js`:

```js
// Drift answers "is this entry still describing where the work is". That is a
// property of the task, and adopt is exactly the moment a task moves to a session
// with no other way of knowing.
test('adopting a task carries the record that its scope went stale', () => {
  const root = tmp();
  seed(root, THEIRS, { scope: ['web'], drift: ['api/routes.js'] });
  run(root, ['adopt', THEIRS, '--session', MINE]);
  assert.deepEqual(registry.readSession(root, MINE).drift, ['api/routes.js']);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/task.test.js`
Expected: FAIL — `drift` is `undefined` on the adopting session's entry.

- [ ] **Step 3: Write the implementation**

In `scripts/task.js` `cmdAdopt`, beside the three lines that already carry optional fields:

```js
    if (source.notes) data.notes = source.notes;
    if (source.next) data.next = source.next;
    if (source.guard) data.guard = source.guard;
    if (source.drift) data.drift = source.drift;
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test tests/task.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite and commit**

```bash
npm test
git add scripts/task.js tests/task.test.js
git commit -m "feat: a task's drift moves with it when the task is adopted"
```

---

## Task 5: `clear` — put a claim down without inheriting it

**Files:**
- Modify: `scripts/task.js` (`parseArgs`, `cmdClear`, `COMMANDS`, `USAGE`)
- Modify: `lib/guard.js` (`reasonFor`)
- Modify: `skills/fankeel/SKILL.md` (the command list, and the adopt-or-clear text)
- Modify: `docs/collisions.md`
- Test: `tests/task.test.js`, `tests/guard.test.js`

**Interfaces:**
- Consumes: `registry.isStale(data, now)`, `registry.ageText(data, now)`, `registry.sessionPath(root, id)`, `registry.writeSession`, and the file-local `hideBadge(opts, sessionId)`, `fail(message)`, `NL` — all already present in `scripts/task.js`.
- Produces: `task.js clear <session-id> --session <id> [--force]`, and `opts.force` on the parsed options.

- [ ] **Step 1: Write the failing tests**

Add to `tests/task.test.js`:

```js
const DAY = 24 * 3600e3;

test('a cold claim is cleared without its task being inherited', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  seed(root, THEIRS, { task: 'the ramp', scope: ['web'], updated: new Date(Date.now() - 3 * DAY).toISOString() });
  const out = run(root, ['clear', THEIRS, '--session', MINE]);
  assert.equal(registry.readSession(root, THEIRS).active, false);
  assert.equal(registry.readSession(root, MINE).task, 'fix the ramp');
  assert.match(out, /cleared: the ramp/);
});

test('clearing does not delete the entry, so the task can be adopted back', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  seed(root, THEIRS, { task: 'the ramp', notes: ['46 to 83 to 120'], updated: new Date(Date.now() - 3 * DAY).toISOString() });
  run(root, ['clear', THEIRS, '--session', MINE]);
  run(root, ['down', '--session', MINE]);
  run(root, ['adopt', THEIRS, '--session', MINE]);
  assert.deepEqual(registry.readSession(root, MINE).notes, ['46 to 83 to 120']);
});

test('a claim that is not cold is refused, and the refusal says what it is protecting', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  seed(root, THEIRS, { task: 'the ramp', stage: 'verify', updated: new Date().toISOString() });
  assert.throws(() => run(root, ['clear', THEIRS, '--session', MINE]), /the ramp @ verify/);
  assert.equal(registry.readSession(root, THEIRS).active, true);
});

test('--force is for the terminal the reader watched die', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  seed(root, THEIRS, { updated: new Date().toISOString() });
  run(root, ['clear', THEIRS, '--session', MINE, '--force']);
  assert.equal(registry.readSession(root, THEIRS).active, false);
});

test('clearing this session is refused, and names the command that exists for it', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  assert.throws(() => run(root, ['clear', MINE, '--session', MINE]), /`down`/);
});
```

Add to `tests/guard.test.js`:

```js
test('the refusal names the command that clears a claim nobody is behind', () => {
  const text = guard.reasonFor('web/a.js', [{ sessionId: THEIRS, data: { task: 't', stage: 'build' } }]);
  assert.match(text, /clear/);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/task.test.js tests/guard.test.js`
Expected: FAIL — `clear` is not a command; the refusal text does not contain `clear`.

- [ ] **Step 3: Parse `--force`**

In `scripts/task.js` `parseArgs`, beside the `--add` branch:

```js
        if (arg === '--force') {
            opts.force = true;
            continue;
        }
```

- [ ] **Step 4: Write `cmdClear`**

In `scripts/task.js`, after `cmdAdopt`:

```js
// The second place another session's file is written, and the smaller one.
// `adopt` takes a task over; this only puts a claim down. Wanting a stale badge
// gone is not wanting somebody else's work.
//
// It never deletes. `cmdAdopt` reads a source entry without requiring it to be
// active, so a claim cleared by mistake can still be adopted back with its notes
// and its `next` intact.
function cmdClear(root, opts) {
    const id = requireSession(opts);
    const target = opts.positional[0];
    if (!target) fail('Give the session id to clear.');
    if (target === id) fail('That is this session. Use `down`, which prints the notes that are about to die.');
    if (!registry.sessionPath(root, target)) fail('Not a session id: ' + target);

    const data = registry.readSession(root, target);
    if (!data) fail('No entry for ' + target + ' under ' + root);
    if (data.active !== true) return 'fankeel — already stood down.';

    // Twelve hours of silence is the only evidence the registry has that nobody
    // is behind a claim, and below that the entry may belong to somebody who
    // stepped away. So the refusal names what it is protecting, and --force is
    // there for the case the reader can see and the registry cannot: a terminal
    // that died four minutes ago. Ask before deny, the same as `guard`.
    const at = Date.now();
    if (!registry.isStale(data, at) && opts.force !== true) {
        fail('That entry was last seen ' + (registry.ageText(data, at) || 'just now') + ' ago: '
            + (data.task || 'untitled') + ' @ ' + (data.stage || '?')
            + NL + 'Pass --force if you know the terminal is gone.');
    }

    data.active = false;
    if (!registry.writeSession(root, target, data)) fail('Could not write the entry.');
    hideBadge(opts, target);

    return 'fankeel — cleared: ' + (data.task || 'untitled') + ' @ ' + (data.stage || '?')
        + NL + 'The entry is still there. `adopt ' + target + '` takes the task back, notes and all.';
}
```

Register it and document it:

```js
const COMMANDS = {
    show: cmdShow,
    route: cmdRoute,
    start: cmdStart,
    stage: cmdStage,
    scope: cmdScope,
    note: cmdNote,
    next: cmdNext,
    guard: cmdGuard,
    down: cmdDown,
    adopt: cmdAdopt,
    clear: cmdClear,
};
```

In `USAGE`, after the `adopt` line:

```js
    '  clear <session-id> [--force]      put down a claim nobody is behind; never deletes',
```

- [ ] **Step 5: Name it in the refusal**

In `lib/guard.js` `reasonFor`, replace the three `Ways forward` lines with:

```js
    lines.push('Ways forward: wait for that task, ask it to narrow its scope, or run');
    lines.push('`task.js clear <session-id>` if that session is gone — it puts the claim');
    lines.push('down without taking the task, and `adopt` still takes it back. To go back');
    lines.push('to warnings only, remove `guard` from this session’s entry.');
```

- [ ] **Step 6: Run them and watch them pass**

Run: `node --test tests/task.test.js tests/guard.test.js`
Expected: PASS.

- [ ] **Step 7: Document it where people look**

In `skills/fankeel/SKILL.md`, in the command list beside `task.js scope` and `task.js adopt`, add:

```
node <plugin>/scripts/task.js clear  <session-id> [--force] --session <id>
```

and, in the collisions section, replace the adopt-or-clear sentence so it names the command that now exists rather than only the skill.

In `docs/collisions.md`, at the end of the *stale entries* section, add:

```markdown
## A claim outlives its terminal

`lib/registry.js` is explicit that nothing deactivates anything: a session ending,
a timer expiring and a terminal dying all leave the entry exactly as it was. That
is right — a terminal that dies at midnight has to find its task at nine, and a
registry that expires claims on a timer is one that quietly loses work.

The cost is a claim nobody will ever withdraw. Close the window without standing
down and every session overlapping that scope shows `clash` for good, softened
after twelve hours by an age note and never removed.

`task.js clear <session-id>` puts that claim down. It does not take the task over
the way `adopt` does, and it does not delete the entry — `adopt` still reads a
cleared entry, so the task comes back with its notes if it turns out somebody
wanted it. It refuses an entry seen in the last twelve hours unless `--force`,
because below that the silence is not evidence of anything.
```

- [ ] **Step 8: Run everything**

Run: `npm test && node scripts/docs-check.js && node scripts/docs-audit.js`
Expected: **535 pass, 0 fail**; both scanners exit 0.

- [ ] **Step 9: Commit**

```bash
git add scripts/task.js lib/guard.js tests/task.test.js tests/guard.test.js skills/fankeel/SKILL.md docs/collisions.md
git commit -m "feat: clear a claim whose terminal is gone without inheriting its task"
```

---

## Task 6: say so when every neighbour is cold

**Files:**
- Modify: `lib/render.js`
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: `TASK_SCRIPT` from Task 3; `task.js clear` from Task 5; `isStale`, `ageText`, `overlapPaths`, `scopeOf`, `taskOf`, `stageOf` — all already in `lib/render.js`.
- Produces: nothing importable.

- [ ] **Step 1: Write the failing tests**

Add to `tests/render.test.js`:

```js
const THEIRS = 'bbbbbbbb-0000-4000-8000-000000000002';
const cold = (over) => Object.assign({
  task: 'the ramp', stage: 'build', scope: ['web'],
  updated: new Date(Date.now() - 3 * 24 * 3600e3).toISOString(),
}, over);

test('when the only overlapping neighbour is cold, the block says so and offers clear', () => {
  const out = render({
    mine: { sessionId: MINE, data: { task: 't', stage: 'build', scope: ['web'] } },
    others: [{ sessionId: THEIRS, data: cold() }], now: Date.now(),
  });
  assert.match(out, /every session overlapping your scope is cold/);
  assert.match(out, new RegExp('clear ' + THEIRS + ' --session ' + MINE));
});

// One cold claim beside a live one is not a ghost problem, and its age already
// sits on its own line.
test('a live neighbour keeps the block away', () => {
  const out = render({
    mine: { sessionId: MINE, data: { task: 't', stage: 'build', scope: ['web'] } },
    others: [
      { sessionId: THEIRS, data: cold() },
      { sessionId: 'cccccccc-0000-4000-8000-000000000003', data: cold({ updated: new Date().toISOString() }) },
    ],
    now: Date.now(),
  });
  assert.equal(/every session overlapping your scope is cold/.test(out), false);
});

test('a cold neighbour that does not overlap is not a ghost of yours', () => {
  const out = render({
    mine: { sessionId: MINE, data: { task: 't', stage: 'build', scope: ['web'] } },
    others: [{ sessionId: THEIRS, data: cold({ scope: ['api'] }) }], now: Date.now(),
  });
  assert.equal(/every session overlapping your scope is cold/.test(out), false);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/render.test.js`
Expected: FAIL — no such block is produced.

- [ ] **Step 3: Write the implementation**

In `lib/render.js` `render()`, immediately after the `also in progress:` block:

```js
    // Only when every claim over this scope has gone quiet. One cold claim beside
    // two live ones is not a ghost problem, and `otherLine` already carries its
    // age. All-or-nothing keeps this from becoming atmosphere.
    const overlapping = rest.filter((o) => overlapPaths(mineScope, scopeOf(o.data)).length > 0);
    if (overlapping.length && overlapping.every((o) => isStale(o.data, now))) {
        lines.push('');
        lines.push('every session overlapping your scope is cold. nothing here is being worked on but you:');
        for (const o of overlapping) {
            lines.push('  ' + taskOf(o.data) + ' @ ' + stageOf(o.data) + ' — last seen ' + ageText(o.data, now) + ' ago');
            lines.push('  node ' + TASK_SCRIPT + ' clear ' + o.sessionId + ' --session ' + (mine && mine.sessionId));
        }
    }
```

- [ ] **Step 4: Run them and watch them pass**

Run: `node --test tests/render.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite and commit**

```bash
npm test
git add lib/render.js tests/render.test.js
git commit -m "feat: name the ghost when every claim over your scope has gone quiet"
```

---

## Task 7: the scope question stops implying the choice is permanent

**Files:**
- Modify: `skills/fankeel/SKILL.md` (the `Which part of it?` row)
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: `task.js scope "<path>" --add`, which already exists.
- Produces: nothing importable.

- [ ] **Step 1: Write the failing test**

Add to `tests/skills.test.js`:

```js
// The opening question is where a scope gets chosen, and it was priced as if the
// choice were final. It is not: scope --add widens it at any time.
test('the scope question offers narrow first and says the choice is not final', () => {
  const text = read('fankeel');
  const row = text.split('\n').find((l) => l.includes('Which part of it?'));
  assert.ok(row, 'the scope question is gone');
  assert.match(row, /--add/, 'it never says the scope can be widened later');
  assert.equal(/collides with every other session/.test(row), false, 'it still prices a collision without saying what one does');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/skills.test.js`
Expected: FAIL — the row contains neither `--add` nor a corrected price.

- [ ] **Step 3: Rewrite the row**

In `skills/fankeel/SKILL.md`, replace the `Which part of it?` row with:

```markdown
| Which part of it? | The directories from `inside it`, narrowest useful first. Say the choice is not final: `task.js scope "<path>" --add` widens it the moment the work reaches somewhere it did not name, which is most tasks. The whole project is a legitimate answer for work that really is project-wide — price it honestly rather than warning: every other session in that repository then overlaps you, so the badge reads `clash` for as long as the task runs and stops showing the stage. Nothing is blocked either way. |
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test tests/skills.test.js`
Expected: PASS.

- [ ] **Step 5: Run everything and commit**

```bash
npm test && node scripts/docs-check.js && node scripts/docs-audit.js
git add skills/fankeel/SKILL.md tests/skills.test.js
git commit -m "feat: offer the narrow scope first, and say that scope grows"
```

---

## Task 8: release

**Files:**
- Modify: `.claude-plugin/plugin.json`, `package.json`, and the `version:` frontmatter of all 8 `skills/*/SKILL.md`
- Modify: `docs/plans/2026-08-23-registry-staleness-design.md`, `docs/plans/2026-08-23-registry-staleness-implementation.md` (frontmatter `status`)

**Interfaces:**
- Consumes: everything above.
- Produces: version `0.25.0`.

- [ ] **Step 1: Bump the version in all ten places**

```bash
grep -rl '0\.24\.0' .claude-plugin/plugin.json package.json skills/*/SKILL.md
```

Expected: exactly 10 paths. Change each `0.24.0` to `0.25.0`. **Do not touch `docs/decisions/fankeel-shell.md` or `docs/plans/2026-08-22-seven-stage-implementation.md`** — those record what was true when they were written.

- [ ] **Step 2: Verify the count**

```bash
grep -rc '0\.25\.0' .claude-plugin/plugin.json package.json skills/*/SKILL.md | grep ':0$'
```

Expected: no output. Any line printed is a file that did not get bumped.

- [ ] **Step 3: Land the two plan documents**

Both this plan and its spec are `design-intent` until the work lands. Set `status: current` on both, and `last_verified` to the landing date.

- [ ] **Step 4: Run every gate**

```bash
npm test
node scripts/docs-check.js
node scripts/docs-audit.js
node scripts/todo-check.js
claude plugin validate .
```

Expected: **536 pass, 0 fail**; all four scanners exit 0.

- [ ] **Step 5: Verify on a clean clone**

The one check that only fails outside the tree it was written in:

```bash
git clone . /tmp/fankeel-clone && node scripts/docs-check.js --root /tmp/fankeel-clone
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: 0.25.0 — a registry that notices when it has gone stale"
```

---

## Self-review

**Spec coverage.** Part A → Task 7. Part B → Tasks 1, 2, 3. Part C → Tasks 5, 6. The adopt decision under *How it clears* → Task 4. Every row of the spec's Files table appears in a task's **Files** block: `hooks/touch.js` (2), `lib/registry.js` (1), `lib/render.js` (3, 6), `scripts/task.js` (4, 5), `skills/fankeel/SKILL.md` (5, 7), `.claude-plugin/plugin.json` (2, 8), `README.md` (2), `docs/registry.md` (1), `docs/collisions.md` (5), `lib/guard.js` (5), `tests/resume.test.js` (2). All eight success criteria have a test: 1 → Task 3 step 1; 2 → Task 1 step 1 and Task 3 step 1; 3 → Task 2 step 1; 4 → Task 2 step 1; 5 → Task 2 step 1; 6 → Task 6 step 1; 7 → Task 5 step 1; 8 → Task 5 step 1.

**Not covered, and deliberately.** The spec's **Open** section — the badge word under permanent clash, `SKILL.md:107`'s false claim about the session id, and whether `STALE_MS` is the right gate for `clear` — has no task. Each is a decision nobody has made.

**Type consistency.** `addDrift` / `driftOf` / `MAX_DRIFT` / `MAX_DRIFT_LEN` are named identically in Tasks 1, 2, 3 and 6. `TASK_SCRIPT` is defined in Task 3 and reused in Task 6. `cmdClear` and `opts.force` are named identically in Task 5's steps 3, 4 and its tests. `covers` and `relPath` are the names `lib/guard.js` already exports.

**Test counts.** 509 today; +8 (T1), +8 (T2, of which one replaces an existing assertion body), +4 (T3), +1 (T4), +6 (T5), +3 (T6), +1 (T7) = **536**. A count below that at Task 8 means something was dropped.
