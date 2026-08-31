---
status: design-intent
last_verified: 2026-09-01
source_of_truth: lib/registry.js, hooks/gate.js, hooks/resume.js, .claude-plugin/plugin.json, scripts/task.js
---

# Stage Timing Implementation Plan

**Goal:** the session record holds wall-clock per stage beside `burn`, and reports how much of it was the user deciding at a gate.

**Architecture:** `clock` is `burn`'s two-slot shape with epoch milliseconds instead of a token count, written in `touch()` outside the `used` guard so an answered gate is a sighting too. `waited` is a running total per stage, accumulated by a new `PreToolUse(AskUserQuestion)` hook that stamps `gateAt` and the existing `hooks/resume.js` that consumes it. Both are read by `scripts/task.js` only — `show` and the stage-transition line — because the injected block has no room.

**Tech Stack:** Node's built-in test runner (`node --test`). No dependencies, and none may be added.

**Spec:** [docs/plans/2026-09-01-stage-timing-design.md](2026-09-01-stage-timing-design.md)

## Global Constraints

Generated from `package.json`, `.fankeel/map.md`, `.fankeel/docs.json` and the suite on 2026-09-01. There is no `CLAUDE.md` in this repository, so nothing here comes from a conventions file.

- **No dependencies.** `package.json` declares neither `dependencies` nor `devDependencies`. Adding one is out of scope for every task below.
- **`npm test` is `node --test`.** Tests live in `tests/*.test.js` and use `node:test` with `node:assert/strict`. There is no `engines` field, so no Node floor is declared — do not invent one.
- **Indentation: 4 spaces in `lib/` and `scripts/`, 2 spaces in `tests/`.** Both are already uniform; match the file you are in.
- **`'use strict';` is the first statement of every module**, after the shebang in `hooks/`.
- **Every hook exits 0 on every path**, including every error path, and gets its stdin handling from `run`/`parse` in `lib/hook.js`. Nothing calls `process.exit`. A `PreToolUse` hook additionally **never writes a decision** for a tool it has no opinion about — see the comment at the top of `hooks/guard.js`.
- **Every registry write goes through `update` or `replace`** in `lib/registry.js`; both take `sessions/{session_id}.lock`. `writeSession` takes no lock and is for a caller already holding one.
- **Caps already asserted in code**, none of which this work changes: `MAX_NOTES = 5`, `MAX_NOTE_LEN = 100`, `MAX_NEXT_LEN = 120`, `MAX_CLAIMS = 60`, `STALE_MS = 12 * 60 * 60 * 1000`.
- **The injected block is capped at 2400 characters and `build` renders at 2394** (`scripts/task.js:473`). No task below adds anything to it.
- **Documents carry `status:`, `last_verified:` and `source_of_truth:` frontmatter.** `.fankeel/docs.json` files `docs/plans` as role `plan` and `docs` at depth 1 as `reference`.
- **A plan is `status: design-intent` until the work lands.** This file becomes `status: current` at `land`, and is archived after that.

## File structure

| File | Responsibility |
|---|---|
| `lib/registry.js` | modified — holds `clock`, `waited` and `gateAt`, and the three readers over them |
| `hooks/gate.js` | **new** — `PreToolUse` on `AskUserQuestion`; stamps `gateAt` and nothing else |
| `hooks/resume.js` | modified — closes the gate it already fires at the end of |
| `.claude-plugin/plugin.json` | modified — one `PreToolUse` entry |
| `scripts/task.js` | modified — clears the three fields on rename, prints two of them |
| `tests/registry.test.js` | modified — the field mechanics |
| `tests/gate.test.js` | **new** — the hook pair, run the way Claude Code runs it |
| `tests/task.test.js` | modified — the rename clears, and the two display lines |
| `docs/registry.md`, `skills/fankeel/SKILL.md` | modified — the record's documented shape |

## Task 1: The three fields and their readers

`lib/registry.js` gains one write in `touch()`, two small writers for the gate, and three readers. Nothing else in the repository changes in this task, so the suite proves it on its own.

**Files:**
- Modify: `lib/registry.js` — `touch()` writes `clock`; add `gateOpen`, `gateClose`, `clockOf`, `waitedOf`; export the four
- Test: `tests/registry.test.js`

**Interfaces:**
- Consumes: `update(projectRoot, sessionId, change)` — already exported from this file.
- Consumes: `readSession(projectRoot, sessionId)` — likewise.
- Produces: `clockOf(data, stage)` — elapsed milliseconds as a number, `null` when the stage was never sampled, sampled once, or sampled backwards.
- Produces: `waitedOf(data, stage)` — accumulated gate milliseconds as a number, `null` when nothing was accumulated.
- Produces: `gateOpen(projectRoot, sessionId)` — stamps `data.gateAt`.
- Produces: `gateClose(projectRoot, sessionId)` — folds `now - gateAt` into `waited[stage]` and deletes `gateAt`.

Neither gate function reports whether there was a gate. `update` documents a
change returning `false` as a success with no write (`lib/registry.js`, the
comment above `update`), so it hands back `true` either way; `hooks/resume.js`
ignores the return, and no caller asks. Assert the effect on the record.

### 1.1 Write the failing tests

Append to `tests/registry.test.js`, below the existing `burnOf` tests:

```js
// The clock is written where `updated` is, not where `burn` is. inject.js passes
// a token figure and resume.js passes none, so a gate answered without a prompt
// refreshes `updated` and leaves `burn` alone — a clock has no such threshold.
test('touch records the clock even when no token figure is passed', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task({ stage: 'survey' }));
  registry.touch(root, SID);
  registry.touch(root, SID);
  const after = registry.readSession(root, SID);
  assert.equal(Array.isArray(after.clock.survey), true);
  assert.equal(after.clock.survey.length, 2);
  assert.equal(after.burn, undefined);
});

test('the clock keeps the first sighting and moves the latest', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task({ stage: 'survey', clock: { survey: [1000, 2000] } }));
  registry.touch(root, SID);
  const after = registry.readSession(root, SID);
  assert.equal(after.clock.survey[0], 1000);
  assert.equal(after.clock.survey[1] > 2000, true);
});

test('a stage change opens its own clock pair', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task({ stage: 'survey', clock: { survey: [1000, 2000] } }));
  const data = registry.readSession(root, SID);
  data.stage = 'design';
  registry.writeSession(root, SID, data);
  registry.touch(root, SID);
  const after = registry.readSession(root, SID);
  assert.deepEqual(after.clock.survey, [1000, 2000]);
  assert.equal(after.clock.design[0], after.clock.design[1]);
});

test('clockOf is null for a stage never sampled, sampled once, or sampled backwards', () => {
  assert.equal(registry.clockOf(task(), 'survey'), null);
  assert.equal(registry.clockOf({ clock: { survey: [1000, 1000] } }, 'survey'), null);
  assert.equal(registry.clockOf({ clock: { survey: [2000, 1000] } }, 'survey'), null);
  assert.equal(registry.clockOf({ clock: { survey: 2000 } }, 'survey'), null);
  assert.equal(registry.clockOf({ clock: { survey: [1000, 61000] } }, 'survey'), 60000);
});

// A malformed pair is replaced rather than repaired, for the reason the burn
// tests give: carrying a broken first sighting forward keeps it forever.
test('a clock that is not a readable pair is replaced', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task({ stage: 'survey', clock: { survey: ['x'] } }));
  registry.touch(root, SID);
  const after = registry.readSession(root, SID);
  assert.equal(after.clock.survey.length, 2);
  assert.equal(after.clock.survey[0], after.clock.survey[1]);
});

// Gates accumulate: a stage may open three of them, so `waited` is a total and
// not a pair.
test('gateOpen stamps and gateClose accumulates into the stage it was in', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task({ stage: 'design' }));
  registry.gateOpen(root, SID);
  assert.equal(Number.isFinite(registry.readSession(root, SID).gateAt), true);
  registry.gateClose(root, SID);
  const after = registry.readSession(root, SID);
  assert.equal(after.gateAt, undefined);
  assert.equal(Number.isFinite(after.waited.design), true);
  registry.gateOpen(root, SID);
  registry.gateClose(root, SID);
  assert.equal(registry.readSession(root, SID).waited.design >= after.waited.design, true);
});

test('gateClose with no gateAt writes nothing', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task({ stage: 'design' }));
  assert.equal(registry.gateClose(root, SID), false);
  assert.equal(registry.readSession(root, SID).waited, undefined);
});

test('waitedOf is null for a stage that never waited', () => {
  assert.equal(registry.waitedOf(task(), 'design'), null);
  assert.equal(registry.waitedOf({ waited: { design: 0 } }, 'design'), null);
  assert.equal(registry.waitedOf({ waited: { design: 4000 } }, 'design'), 4000);
});
```

Run `npm test` and watch these eight fail: `registry.clockOf`, `registry.gateOpen`, `registry.gateClose` and `registry.waitedOf` are not functions, and `after.clock` is `undefined`.

### 1.2 Write the implementation

In `lib/registry.js`, inside `touch()`, immediately after `data.updated = new Date().toISOString();` and **before** the `if (Number.isFinite(used) ...)` block:

```js
        // Outside the `used` guard, which is the one place this does not copy
        // `burn`. inject.js passes a token figure and resume.js passes none, so
        // a gate answered without a prompt leaves `burn` alone — and the wait
        // at a gate is exactly what this is here to see. A clock has no
        // threshold to fall below: every touch is a sighting.
        if (data.stage) {
            const at = Date.parse(data.updated);
            const clock = (data.clock && typeof data.clock === 'object' && !Array.isArray(data.clock))
                ? data.clock
                : {};
            const seen = clock[data.stage];
            const first = (Array.isArray(seen) && seen.length === 2 && Number.isFinite(seen[0]))
                ? seen[0]
                : at;
            clock[data.stage] = [first, at];
            data.clock = clock;
        }
```

Beside `burnOf`, add the three readers and the two gate writers:

```js
// How long a stage has been open, in milliseconds. Null under the same three
// conditions as `burnOf`: never sampled, sampled once, or sampled backwards —
// the last of which a clock reaches only through a corrupted record, where a
// negative duration is worse than no answer.
function clockOf(data, stage) {
    const seen = data && data.clock && data.clock[stage];
    if (!Array.isArray(seen) || seen.length !== 2) return null;
    const spent = seen[1] - seen[0];
    return spent > 0 ? spent : null;
}

// What the gates in a stage took. A total rather than a pair, because a stage
// may open more than one, and what is worth knowing is their sum.
function waitedOf(data, stage) {
    const held = data && data.waited && data.waited[stage];
    return Number.isFinite(held) && held > 0 ? held : null;
}

// Stamped when an AskUserQuestion goes out, consumed when it is answered. A
// `gateAt` nothing consumes — the session dies at a gate — is overwritten by the
// next one rather than repaired: the interval it measured has no end, so there
// is nothing to recover.
function gateOpen(projectRoot, sessionId) {
    return update(projectRoot, sessionId, (data) => {
        data.gateAt = Date.now();
        return true;
    });
}

function gateClose(projectRoot, sessionId) {
    return update(projectRoot, sessionId, (data) => {
        const opened = data.gateAt;
        if (!Number.isFinite(opened)) return false;
        delete data.gateAt;
        if (!data.stage) return true;
        // `< 0` and not `<= 0`. A gate opened and answered inside one
        // millisecond is a real gate with nothing to add, and skipping it leaves
        // `waited` absent rather than zero — which reads, to everything
        // downstream, exactly like a stage that never opened one. `waitedOf`
        // hides the zero; this keeps the fact that it happened.
        const held = Date.now() - opened;
        if (held < 0) return true;
        const waited = (data.waited && typeof data.waited === 'object' && !Array.isArray(data.waited))
            ? data.waited
            : {};
        const had = Number.isFinite(waited[data.stage]) ? waited[data.stage] : 0;
        waited[data.stage] = had + held;
        data.waited = waited;
        return true;
    });
}
```

Add `clockOf`, `waitedOf`, `gateOpen` and `gateClose` to `module.exports`, beside `burnOf` and `touch` respectively.

Run `npm test` and watch the eight pass, with the existing `burn` tests still green.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

## Task 2: The hook pair

The half that does not exist yet, and the registration that makes Claude Code call it. `hooks/resume.js` already fires at the moment a gate closes; it gains one line.

**Files:**
- Create: `hooks/gate.js` — `PreToolUse` on `AskUserQuestion`, stamps `gateAt`
- Modify: `hooks/resume.js` — call `registry.gateClose` beside the existing `registry.touch`
- Modify: `.claude-plugin/plugin.json` — one `PreToolUse` entry with matcher `AskUserQuestion`
- Test: `tests/gate.test.js`

**Interfaces:**
- Consumes: `gateOpen(projectRoot, sessionId)` from Task 1.
- Consumes: `gateClose(projectRoot, sessionId)` from Task 1.
- Consumes: `rootFor(payload)` — already exported from `lib/registry.js`.
- Consumes: `run(main)` and `parse(raw)` from `lib/hook.js`, the way every other hook takes them.
- Produces: nothing any later task imports. Task 3 reads the fields these write, not these functions.

### 2.1 Write the failing test

`tests/gate.test.js`, new, modelled on `tests/resume.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(ROOT, 'hooks', 'gate.js');
const RESUME = path.join(ROOT, 'hooks', 'resume.js');

const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';

const ago = (ms) => new Date(Date.now() - ms).toISOString();

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function seed(root, sessionId, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({
    task: 'rework the colour ramp',
    stage: 'design',
    active: true,
    started: ago(2 * 3600e3),
    updated: ago(3600e3),
  }, over);
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

function readEntry(root, sessionId) {
  const file = path.join(root, '.fankeel', 'sessions', sessionId + '.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function run(hook, root, payload) {
  return execFileSync(process.execPath, [hook], {
    input: JSON.stringify(Object.assign({
      session_id: MINE,
      cwd: root,
      tool_name: 'AskUserQuestion',
    }, payload)),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
  });
}

test('the gate hook stamps gateAt on a session in the mode', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE);
  run(GATE, root, {});
  assert.equal(Number.isFinite(readEntry(root, MINE).gateAt), true);
});

// A PreToolUse hook that answers on a tool it has no opinion about overrides the
// user's own permission rules. This one has an opinion about none of them.
test('the gate hook writes nothing to stdout', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE);
  assert.equal(run(GATE, root, {}).trim(), '');
});

test('a session not in the mode is left alone', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { active: false });
  run(GATE, root, {});
  assert.equal(readEntry(root, MINE).gateAt, undefined);
});

test('no entry at all is not an error', () => {
  const root = tmp('fankeel-gate-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  assert.equal(run(GATE, root, {}).trim(), '');
});

test('malformed stdin is not an error', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE);
  const out = execFileSync(process.execPath, [GATE], {
    input: 'not json',
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
  });
  assert.equal(out.trim(), '');
});

// The pair, in the order Claude Code runs it.
test('the gate opened then answered accumulates into the stage', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'design' });
  run(GATE, root, {});
  run(RESUME, root, {});
  const after = readEntry(root, MINE);
  assert.equal(after.gateAt, undefined);
  assert.equal(Number.isFinite(after.waited.design), true);
});
```

Run `npm test` and watch all six fail — `hooks/gate.js` does not exist, so `execFileSync` throws.

### 2.2 Write the hook

`hooks/gate.js`, new:

```js
#!/usr/bin/env node
'use strict';

// PreToolUse on AskUserQuestion. It marks the moment a gate opened, so that the
// time the user spent at it can be told apart from the time the session spent
// working — `hooks/resume.js` is already the other end of the pair, because an
// answer arrives as a tool result rather than as a prompt.
//
// Stop was the obvious hook and is the wrong one: it fires when Claude finishes
// responding, and a session pausing on a tool call has not finished responding.
// The gate is a tool call, so Stop never fires at one.
//
// Same two rules as guard.js: exit 0 on every path, and cost nothing for a
// session that is not in the mode. It goes further on one — it never writes a
// decision at all. A PreToolUse hook that answers about a tool it has no opinion
// on overrides the user's own permission rules, and this one has no opinion
// about any tool. It only notes the time.

const registry = require('../lib/registry.js');
const { run, parse } = require('../lib/hook.js');

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;

    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;

    try {
        registry.gateOpen(root, payload.session_id);
    } catch (e) { /* housekeeping */ }
}

// Deliberately silent, and deliberately answerless. Whatever went wrong, the
// question still has to reach the user.
run(main);
```

In `hooks/resume.js`, inside the existing `try` at the end of `main`, add one line above `registry.touch`:

```js
    try {
        // The other end of hooks/gate.js. It runs first, so the clock `touch`
        // is about to move is already counted against the stage rather than
        // against the wait.
        registry.gateClose(root, sessionId);
        registry.touch(root, sessionId);
    } catch (e) { /* housekeeping */ }
```

In `.claude-plugin/plugin.json`, add a second entry to the existing `PreToolUse` array, after the `Edit|Write|NotebookEdit` one:

```json
      {
        "matcher": "AskUserQuestion",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/gate.js\"",
            "timeout": 5,
            "statusMessage": "Noting when the gate opened..."
          }
        ]
      }
```

Run `npm test` and watch the six pass.

**Note for `verify`:** these tests prove the hook behaves when run. They do **not** prove Claude Code fires `PreToolUse` for `AskUserQuestion` — this repository has never registered a `PreToolUse` matcher for a tool that does not write a file. The live check belongs in `verify`: after this task lands, answer one gate in a real session and read `waited` out of that session's own record.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

## Task 3: Clearing on rename, and the two places it is read

`scripts/task.js` is where the fields become visible, and where a rename must forget them.

**Files:**
- Modify: `scripts/task.js` — `delete` the three fields in `cmdTask`; a `time:` line in `describe`; the elapsed figure on the stage-transition line; a `mins` formatter
- Test: `tests/task.test.js`

**Interfaces:**
- Consumes: `clockOf(data, stage)` from Task 1.
- Consumes: `waitedOf(data, stage)` from Task 1.
- Consumes: `tokens(n)` — already imported at `scripts/task.js:28` from `lib/context.js`.
- Produces: nothing later tasks import.

### 3.1 Write the failing tests

Append to `tests/task.test.js`, following the file's existing pattern for invoking the CLI:

This file's helpers are `root()`, `started(dir, id, task, project)`, `entry(dir, id)` and `run(dir, args, env)` returning `{ out, code }`; an entry is backdated by reading it with `registry.readSession` and writing it back, the way `chill` does at `tests/task.test.js:73`. Use those rather than inventing new ones.

```js
test('renaming the task forgets the clock, the wait and any open gate', () => {
  const dir = root();
  started(dir, A, 'rework the colour ramp');
  const data = entry(dir, A);
  data.clock = { survey: [1000, 61000] };
  data.waited = { survey: 4000 };
  data.gateAt = 1000;
  registry.writeSession(dir, A, data);

  run(dir, ['task', 'something else entirely', '--session', A]);
  const after = entry(dir, A);
  assert.equal(after.clock, undefined);
  assert.equal(after.waited, undefined);
  assert.equal(after.gateAt, undefined);
});

test('show prints a time line for the stages that have one', () => {
  const dir = root();
  started(dir, A, 'rework the colour ramp');
  const data = entry(dir, A);
  data.stage = 'design';
  data.clock = { survey: [1000, 721000], design: [800000, 1040000] };
  data.waited = { survey: 240000 };
  registry.writeSession(dir, A, data);

  const { out } = run(dir, ['show', '--session', A]);
  assert.match(out, /time:\s+survey 12m \(4m waiting\), design 4m/);
});

test('the stage line reports what the stage it left took', () => {
  const dir = root();
  started(dir, A, 'rework the colour ramp');
  const data = entry(dir, A);
  data.clock = { survey: [1000, 721000] };
  data.waited = { survey: 240000 };
  registry.writeSession(dir, A, data);

  const { out } = run(dir, ['stage', 'design', '--session', A]);
  assert.match(out, /survey took 12m, 4m of it at the gate/);
});
```

Run `npm test` and watch all three fail.

### 3.2 Write the implementation

In `scripts/task.js`, beside the `tokens` import at line 28, add a formatter — minutes, because a stage measured in seconds is a stage nobody is asking about:

```js
// Minutes, rounded, with hours above sixty of them. Seconds are not offered: a
// stage that took forty seconds is one nobody is asking the cost of, and a
// second-precision figure invites reading noise as signal.
const mins = (ms) => {
    const m = Math.round(ms / 60000);
    if (m < 60) return m + 'm';
    const h = Math.floor(m / 60);
    return h + 'h' + (m % 60 ? (m % 60) + 'm' : '');
};
```

In `describe`, immediately after the `burn:` line:

```js
    // Same rule as the burn line above: only the stages this route holds, in the
    // order it runs them, and only the ones with a distance to report. The wait
    // is shown inside the total rather than beside it, because it is a part of
    // that number and not another one.
    const clock = route.map((r) => [r, registry.clockOf(data, r), registry.waitedOf(data, r)])
        .filter((row) => row[1]);
    if (clock.length) {
        lines.push('time:  ' + clock.map((row) => row[0] + ' ' + mins(row[1])
            + (row[2] ? ' (' + mins(row[2]) + ' waiting)' : '')).join(', '));
    }
```

In `cmdTask`, beside the existing `delete d.burn` and under the same comment:

```js
        delete d.burn;
        // The same argument, and the same failure if it is left: stage names come
        // round again, so a clock left here dates the new task's stage from the
        // old one, and a `gateAt` left open bills the rename to whatever stage the
        // next answer lands in.
        delete d.clock;
        delete d.waited;
        delete d.gateAt;
```

In `cmdStage`, extend the return so the move reports time as well as tokens:

```js
    const at = positionIn(route, name);
    const spent = registry.burnOf(data, from);
    const took = registry.clockOf(data, from);
    const held = registry.waitedOf(data, from);
    return 'fankeel — ' + from + ' to ' + name + (at ? '   ' + at.step + ' of ' + at.steps : '')
        + (spent ? '   ' + from + ' burned ' + tokens(spent) : '')
        + (took ? '   ' + from + ' took ' + mins(took)
            + (held ? ', ' + mins(held) + ' of it at the gate' : '') : '');
```

Run `npm test` and watch the three pass.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

## Task 4: The documents that describe the record

Three pages describe the session record's shape, and all three become false the moment Task 1 lands. This task also re-checks the `path:line` citations the earlier tasks moved.

**Files:**
- Modify: `docs/registry.md` — the writer table, the record's fields, `last_verified`
- Modify: `skills/fankeel/SKILL.md` — the record example and the paragraph listing what is written without anyone typing it
- Modify: `docs/plans/2026-09-01-stage-timing-design.md` — every `path:line` it cites
- Modify: `docs/plans/2026-09-01-stage-timing.md` — this file, same reason

**Interfaces:**
- Consumes: nothing. It reads the code Tasks 1–3 wrote.
- Produces: nothing.

### 4.1 The check that stands in for a test

This task writes no test file. Its cycle is three commands, all of which must be run and quoted:

```
npm test
node scripts/docs-check.js
node scripts/todo-check.js
```

`docs-check.js` is the one that matters here: it resolves every `path:line` citation and fails on one past the end of a file. Task 1 adds roughly forty lines to `lib/registry.js` above `burnOf`, so **every citation of `lib/registry.js:NNN` in both plan pages and in `docs/registry.md` has moved.** Re-read each one against the file and correct it; do not adjust by an estimated offset.

### 4.2 The edits

In `docs/registry.md`:

- The writer table row for `.fankeel/sessions/{session_id}.json` gains `gate.js` and `resume.js` as writers of `clock`, `waited` and `gateAt`.
- Add a section after **Task memory** describing the three fields, stating that `clock` is written outside the `used` guard and why, and that `waited` is a total rather than a pair.
- Set `last_verified: 2026-09-01`, and add `hooks/gate.js` to `source_of_truth`.

In `skills/fankeel/SKILL.md`, the paragraph reading *"Four more are written without anyone typing them"* becomes seven, and the JSON example gains `"clock"` and `"waited"`. `gateAt` is deliberately **not** in the example: it exists only between a question going out and its answer arriving, so a record shown with one is a record shown mid-question.

In both plan pages, correct the citations and leave the prose.

Run the three commands and quote their output.

**Dispatch:** in-session — `docs-check.js` reports drift against code this session has just written, and judging whether a citation moved or a claim stopped being true is the reading the parent already did.

## Self-review

**Spec coverage.** `clock` written outside the `used` guard — Task 1.2. `waited` as a per-stage total — Task 1.2. `gateAt` transient, overwritten not repaired — Task 1.2, comment and test. The `PreToolUse`/`PostToolUse` pair — Task 2. Nothing in the injected block — no task touches `lib/stages.js` or `lib/render.js`. `show` and the stage line — Task 3. `task` clears — Task 3. The three documents — Task 4. No requirement is unclaimed.

**Placeholders.** None. Every task carries its own code, its own `**Files:**` block, its own `**Interfaces:**` block and its own `**Dispatch:**` line.

**Test helpers.** Checked, not assumed. `tests/registry.test.js` supplies `tmpRoot()`, `SID` and `task(over)`; `tests/task.test.js` supplies `root()`, `started`, `entry` and `run`, and imports `registry` at line 16. The first draft of Task 3 invented four helper names this repository does not have; they are gone.

**Type consistency.** `clock`, `waited` and `gateAt` are the field names everywhere; `clockOf`, `waitedOf`, `gateOpen`, `gateClose` and `mins` are the function names everywhere. The design page's earlier name for `clock` was `spent`, dropped because `scripts/task.js:478` already binds `spent` to a token figure.

**Sequencing.** All four tasks are sequential, and deliberately so: Tasks 1 and 3 both write `lib/registry.js`'s consumers, Task 2 depends on Task 1's exports, and Task 4 depends on all three having moved the lines it cites. No two tasks here may run at once, and nothing is gained by pretending otherwise.
