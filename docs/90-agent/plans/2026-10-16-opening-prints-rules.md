---
status: design-intent
last_verified: 2026-10-16
---

# Opening prints rules Implementation Plan

**Goal:** `task.js start` and `task.js task` print the first stage's rules the way `task.js stage` does, and the dirty tests stop failing when git is slow under full-suite load.
**Architecture:** One `openingLines(root, id, data, values)` in `scripts/task.js` builds the block `cmdStage` prints today; `cmdStart` and `cmdTask` print it too, and `FIRST_STEP` goes. `lib/dirty.js` reads git's timeout from `FANKEEL_GIT_TIMEOUT` at call time, default 2500, and the two test files that hit it under load raise it.
**Tech Stack:** Node (`node --test`), no dependencies.
**Spec:** 2026-10-16-opening-prints-rules-design.md

## Global Constraints

Generated 2026-10-16 from `node scripts/map.js`, `package.json` and the tests. The repository has no `CLAUDE.md`.

- `package.json` declares no dependency and `"test": "node --test"`. Add no dependency.
- `lib/*.js` and `scripts/task.js`: four-space indent, semicolons, single quotes.
- `tests/task-control.test.js`, `tests/dirty*.test.js`, `tests/inject.test.js`: two-space indent. `tests/stage-prints-rules.test.js`: four-space indent.
- `tests/task-control.test.js` asserts `Now build, through its stage agent. You are its controller:` from `start` and `task`; the controller block stays as it is.
- `tests/dirty-timeout.test.js` asserts the default cut is under 3000 ms against 2500; the default does not move.
- A commit is `<type>: <sentence>` then one `- <what> — <path>` line a change, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The full suite on this machine needs `FANKEEL_BROWSER` set to chrome.exe's full path, or 14 render tests fail on Edge.

## Risks

- A test asserting `start`'s `FIRST_STEP` sentence — Task 1 — `tests/task-control.test.js:203` asserts `run the scanner`; it is rewritten to assert `stage rules:`.
- An env var left set leaking into `dirty-timeout.test.js` — Task 2 — `node --test` runs each file in its own process, so a `process.env` set at the top of one file does not reach another.

## Task 1: start and task print the opening block

**Files:**
- Modify: `scripts/task.js:76-1120` — delete `FIRST_STEP`, add `openingLines`, use it in `cmdStart`, `cmdStage`, `cmdTask`
- Test: `tests/stage-prints-rules.test.js`
- Test: `tests/task-control.test.js`
- Modify: `skills/fankeel/SKILL.md:292-296` — the sentence names `start` and `task` beside `stage`
- Modify: `docs/03-decisions/2026-10-16-stage-prints-rules.md` — the last 放棄了什麼 bullet
- Read: `lib/stages.js` — `rulesFor`, `templateFor`

**Interfaces:**
- Consumes: `rulesLines`, `controllerLines`, `handsLines`, `todoLines` already in scope in `scripts/task.js`
- Produces: `openingLines(root, id, data, values)` in `scripts/task.js`, returning an array of lines

**Dispatch:** in-session — one function moved and three call sites, interlocked with its own red tests; a dispatch costs more than the work.

1. Write the failing tests. In `tests/stage-prints-rules.test.js`, add:

```js
test('task.js start prints the first stage\'s rules and output shape, and says to start it this turn', () => {
    const dir = tmp('fankeel-start-rules-');
    const { out, code } = run(dir, ['start', '--session', A, '--task', 'a fixture task', '--route', 'plan,build']);
    assert.equal(code, 0, out);
    assert.ok(out.includes('stage rules:\n  - ' + rulesFor('plan', { next: 'build' })[0]), out);
    assert.ok(out.includes('output shape:\n  ' + templateFor('plan').split('\n')[0]), out);
    assert.doesNotMatch(out, /Now plan: decompose/);
    assert.ok(out.trimEnd().endsWith(GO), out);
});

test('task.js task prints the new task\'s first stage rules and says to start it this turn', () => {
    const dir = tmp('fankeel-task-rules-');
    run(dir, ['start', '--session', A, '--task', 'first', '--route', 'plan,build']);
    const { out, code } = run(dir, ['task', 'second', '--session', A]);
    assert.equal(code, 0, out);
    assert.ok(out.includes('stage rules:'), out);
    assert.ok(out.trimEnd().endsWith(GO), out);
});
```

2. Run `node --test tests/stage-prints-rules.test.js` and watch both new tests fail.
3. In `scripts/task.js`, delete `FIRST_STEP` and its comment (lines 78-80), rewrite the comment above `controllerLines` (lines 797-799) so it says `openingLines` carries the controller's rules instead of naming `FIRST_STEP`, and add above `cmdStage`:

```js
// What a session reads the moment it enters a stage: the controller block where
// `stage.agents` names the stage, else the rules and shape inject would send,
// then build's hands and land's closing lines, then the line that keeps the
// turn going. `start`, `task` and `stage` print the same block, because none of
// them has an injection behind it until the next prompt.
function openingLines(root, id, data, values) {
    const controller = controllerLines(root, id, data, values);
    const lines = (controller || rulesLines(data, { values }, { root, sessionId: id })).slice();
    if (data.stage === 'build') {
        const hands = handsLines(root, data);
        if (hands) lines.push(...hands);
    }
    if (data.stage === 'land') {
        const closing = todoLines(root, id, data);
        if (closing) lines.push(...closing);
    }
    lines.push('', '進到這一站後在同一回合開工，不要先收回合。');
    return lines;
}
```

   `cmdStage` replaces its tail from `const values` through the GO line with `line += NL + openingLines(root, id, data, valuesOfRecord(root, data, opts)).join(NL);`. `cmdStart` replaces its controller-or-`FIRST_STEP` block with `for (const l of openingLines(root, id, data, prof.values)) lines.push(l);`. `cmdTask` sets `const tail = openingLines(root, id, data, valuesOfRecord(root, data, opts)).join(NL);`.
4. In `tests/task-control.test.js`, the test `start at survey with stage.agents false keeps the scanner step` becomes `... prints survey's rules`, asserting `/stage rules:/` in place of `/run the scanner/`; fix the comment at line 103 that names `FIRST_STEP`.
5. Run `node --test tests/stage-prints-rules.test.js tests/task-control.test.js tests/hands.test.js tests/task-todo.test.js` and watch it pass.
6. Edit `skills/fankeel/SKILL.md`: the sentence says rules are printed by `task.js start`, `task` and `stage`. In `docs/03-decisions/2026-10-16-stage-prints-rules.md`, the last 放棄了什麼 bullet becomes: 「`start` 與改名（`task.js task`）開站時也印規則：當天的下一個任務補上，三處共用 `openingLines`，`FIRST_STEP` 刪除。」
7. Commit.

## Task 2: a git timeout tests can raise

**Files:**
- Modify: `lib/dirty.js:78-95` — `dirtyPaths` reads `FANKEEL_GIT_TIMEOUT`
- Test: `tests/dirty-timeout.test.js`
- Test: `tests/dirty.test.js`
- Test: `tests/inject.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: env `FANKEEL_GIT_TIMEOUT` (milliseconds, positive integer) read by `dirtyPaths`.

**Dispatch:** in-session — one constant and one test; a dispatch costs more than the work.

1. Write the failing test. In `tests/dirty-timeout.test.js`, add:

```js
test('FANKEEL_GIT_TIMEOUT lets a slow git finish instead of answering null', () => {
  const repo = mkTmp('fankeel-dirty-slow-');
  fs.mkdirSync(path.join(repo, '.git'));
  const { bin, env } = slowGit();
  const saved = { PATH: process.env.PATH, NODE_OPTIONS: process.env.NODE_OPTIONS };
  process.env.PATH = bin + path.delimiter + process.env.PATH;
  for (const k of Object.keys(env)) process.env[k] = env[k];
  process.env.FANKEEL_GIT_TIMEOUT = '10000';
  let got;
  try {
    got = dirty.dirtyPaths(repo);
  } finally {
    process.env.PATH = saved.PATH;
    delete process.env.FANKEEL_GIT_TIMEOUT;
    if (saved.NODE_OPTIONS === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = saved.NODE_OPTIONS;
  }
  assert.deepEqual(got, []);
});
```

2. Run `node --test tests/dirty-timeout.test.js` and watch it fail (`null`).
3. In `lib/dirty.js`, add above `dirtyPaths`:

```js
// 2.5s keeps UserPromptSubmit under its five. Tests on a loaded machine raise it
// with FANKEEL_GIT_TIMEOUT, read per call so a test can set it after require.
function gitTimeout() {
    const n = Number(process.env.FANKEEL_GIT_TIMEOUT);
    return Number.isInteger(n) && n > 0 ? n : 2500;
}
```

   and pass `timeout: gitTimeout()` in place of `timeout: 2500`.
4. At the top of `tests/dirty.test.js` and `tests/inject.test.js`, after the requires, add:

```js
// A loaded machine slows git past the hook's 2.5s; these tests need its answer.
process.env.FANKEEL_GIT_TIMEOUT = '30000';
```

5. Run `node --test tests/dirty-timeout.test.js tests/dirty.test.js tests/inject.test.js` and watch it pass.
6. Commit.

## Coverage

| promise | task |
|---|---|
| `scripts/task.js` gains `openingLines(root, id, data, values)`, returning | Task 1 |
| `cmdStage` replaces its own tail with `openingLines`; its output does not | Task 1 |
| `cmdStart` and `cmdTask` print `openingLines` where they printed | Task 1 |
| `FIRST_STEP` is deleted. Its sentences are a second, drifted wording of the | Task 1 |
| `dirtyPaths` reads its timeout from `FANKEEL_GIT_TIMEOUT` (milliseconds) at | Task 2 |
| `tests/dirty.test.js` and `tests/inject.test.js` (whose "a write no hook | Task 2 |
| The decision record's last 放棄了什麼 bullet (start/task not done) is | Task 1 |
| `start --route plan,build` output holds plan's first rule, plan's output shape, and ends with the same-turn line | Task 1 |
| `task "<new>"` on a started session prints the first stage's rules and the same-turn line | Task 1 |
| `dirtyPaths` with a git shim that sleeps 5 s and `FANKEEL_GIT_TIMEOUT=10000` returns the paths | Task 2 |
| full `npm test` in a clean worktree | struck — verify runs it; no task writes it |
