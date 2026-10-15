---
status: design-intent
last_verified: 2026-10-16
---

# Stage prints its rules Implementation Plan

**Goal:** `task.js stage <name>` prints the new stage's rules and output shape — the text `hooks/inject.js` would inject — and a line telling the session to start that stage in the same turn.
**Architecture:** `lib/render.js` exports its existing `rulesLines`. `cmdStage` in `scripts/task.js` prints `rulesLines(data, { values }, { root, sessionId: id })` when the new stage has no stage agent, keeps `controllerLines` when it has one, and ends both with the same-turn line.
**Tech Stack:** Node (`node --test`), no dependencies.
**Spec:** 2026-10-16-stage-prints-rules-design.md

## Global Constraints

Generated 2026-10-16 from `node scripts/map.js`, `package.json` and the tests. The repository has no `CLAUDE.md`.

- `package.json` declares no dependency and `"test": "node --test"`. Add no dependency.
- `lib/*.js` and `scripts/task.js`: four-space indent, semicolons, single quotes.
- `tests/task-control.test.js`: two-space indent; its `run(dir, args, env)` helper passes env such as `CLAUDE_CONFIG_DIR`.
- `tests/task-control.test.js` asserts `Now build, through its stage agent. You are its controller:` in `stage build`'s output; that header stays.
- `BLOCK_CAP` in `lib/render.js` bounds the injected block only; `task.js` stdout has no cap.
- A commit is `<type>: <sentence>` then one `- path: what changed` line a file, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The full suite on this machine needs `FANKEEL_BROWSER` set to chrome.exe's full path, or 14 render tests fail on Edge.

## Risks

- A test asserting that `stage` into an uncontrolled stage prints nothing else — Task 1 — `tests/task-control.test.js:133` is titled "into an uncontrolled stage prints only the move"; its assertion (`doesNotMatch /fankeel:fankeel-brain/`) still holds for design's rules, so only the title is corrected.

## Task 1: stage prints the new stage's rules

**Files:**
- Modify: `lib/render.js:829-829` — add `rulesLines` to `module.exports`
- Modify: `scripts/task.js:43-1035` — the `lib/render.js` require, and `cmdStage` prints `rulesLines` or `controllerLines`, then the same-turn line
- Test: `tests/stage-prints-rules.test.js`
- Test: `tests/task-control.test.js`
- Modify: `skills/fankeel/SKILL.md:292-296` — the sentence on when stage rules are injected
- Read: `lib/stages.js` — `rulesFor`, `templateFor`

**Interfaces:**
- Consumes: `rulesFor(stage, subs)` and `templateFor(stage)` from `lib/stages.js`
- Produces: `rulesLines(data, profile, ctx)` exported from `lib/render.js`, returning an array of lines

**Dispatch:** in-session — two small edits interlocked with their own red test; a dispatch costs more than the work.

1. Write the failing test. In `tests/stage-prints-rules.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { rulesFor, templateFor } = require('../lib/stages.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'task.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const GO = '進到這一站後在同一回合開工，不要先收回合。';

function run(dir, args) {
    const cfg = path.join(dir, 'cfg');
    try {
        return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', dir, '--claude-dir', cfg],
            { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) }), code: 0 };
    } catch (e) {
        return { out: String(e.stdout || ''), code: e.status };
    }
}

// The answer that approved the gate was injected while the old stage was
// current, so this output is the only thing on screen naming the new one.
test('task.js stage prints the new stage\'s rules and output shape, and says to start it this turn', () => {
    const dir = tmp('fankeel-stage-rules-');
    run(dir, ['start', '--session', A, '--task', 'a fixture task', '--class', 'architectural']);
    run(dir, ['stage', 'design', '--session', A]);
    const { out, code } = run(dir, ['stage', 'plan', '--session', A]);
    assert.equal(code, 0, out);
    assert.ok(out.includes('stage rules:\n  - ' + rulesFor('plan', { next: 'build' })[0]), out);
    assert.ok(out.includes('output shape:\n  ' + templateFor('plan').split('\n')[0]), out);
    assert.ok(out.trimEnd().endsWith(GO), out);
});
```

2. Run `node --test tests/stage-prints-rules.test.js` and watch it fail on `stage rules:`.
3. In `lib/render.js`, add `rulesLines` to the `module.exports` object.
4. In `scripts/task.js`, require `rulesLines` beside the other `lib/render.js` imports, and in `cmdStage` replace the two lines from `const controller = controllerLines(` with:

```js
    const values = valuesOfRecord(root, data, opts);
    const controller = controllerLines(root, id, data, values);
    line += NL + (controller || rulesLines(data, { values }, { root, sessionId: id })).join(NL);
```

   leaving the `build` hands block and the `land` todo block after it, and directly before `return line;` in `scripts/task.js` add:

```js
    line += NL + NL + '進到這一站後在同一回合開工，不要先收回合。';
```
5. In `tests/task-control.test.js`, retitle the test at line 133 to `stage into a controlled build prints the controller's rules with the commit relay, and into an uncontrolled stage prints that stage's own rules`, and add after the `build` assertions: `assert.doesNotMatch(build.out, /stage rules:/);` and `assert.match(build.out, /進到這一站後在同一回合開工/);`.
6. Run `node --test tests/stage-prints-rules.test.js tests/task-control.test.js tests/context-facts-required.test.js tests/hands.test.js tests/route.test.js` and watch it pass.
7. In `skills/fankeel/SKILL.md`, in the sentence beginning "Each stage's rules are injected on every prompt while you are in it", after "because an answer is a tool result and not a prompt —" insert "and printed by `task.js stage` the moment you enter it, so the work starts that turn —".
8. Run the whole suite with `FANKEEL_BROWSER` set to chrome.exe's full path and `node --test 2>&1 | grep -E '^ℹ (pass|fail)'`; fail must be 0.
9. Commit.

## Coverage

| promise | task |
|---|---|
| `lib/render.js` 匯出 `rulesLines`；它現有三個呼叫者（`render`、`renderResume`、`renderBrief`）行為不變。 | Task 1 |
| `cmdStage` 在新一站不歸 `stage.agents` 管時，印 `rulesLines(data, { values }, { root, sessionId: id })` 的全部行 | Task 1 |
| 新一站歸 `stage.agents` 管時，維持現在的 `controllerLines`（`Now <stage>, through its stage agent…`），不再另印 `rulesLines` | Task 1 |
| 兩種情況最後都加一行：`進到這一站後在同一回合開工，不要先收回合。` | Task 1 |
| `build` 的 hands 清單、`land` 的 todo 收尾行照舊接在後面。 | Task 1 — after the rules, before the same-turn line |
| 新測試：建一個 route 含 plan 的任務，`task.js stage plan` 的 stdout 含 | Task 1 |
| 整套 `npm test`（`FANKEEL_BROWSER` 指向 chrome.exe 完整路徑）綠。 | Task 1 step 8 |
| `skills/fankeel/SKILL.md` 的「Each stage's rules are injected on every prompt … and again each time an AskUserQuestion of yours is answered」在改動後少說了一處 | Task 1 step 7 |
