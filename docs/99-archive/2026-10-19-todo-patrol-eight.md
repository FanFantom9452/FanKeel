---
status: current
last_verified: 2026-10-19
---

# TODO Patrol 2026-10-19 (eight) Implementation Plan

**Goal:** Land the five entries the 2026-10-19 patrol marked do-now (await-8, reviewer-1, build-11, pane-16, test-10) and the three it decided at its gate: judge-3 as a guard exception for `.fankeel/build/ask/`, skills-4 as a measurement plus a byte-cap test, gate-13 as a decision record that closes it.
**Architecture:** Each entry is a bounded change to a flow already in the repository, landed test first, each in its own test file where a shared one would serialise the tasks. Text rules (reviewer, implementer, design, build, verify, the fankeel skill) are pinned by new assertions in new test files rather than edits to `tests/agents.test.js`. Closing the TODO entries happens at land (`node scripts/todo.js done <id> --sha <sha>`), never inside a task.
**Tech Stack:** Node >=22.5 (`package.json` `engines`; this machine runs v24.21.0), CommonJS, `node --test`, no dependencies; `hooks/pane-band.ts` and `hooks/pane-status.ts` are TypeScript loaded as-is by dynamic import in their tests.
**Spec:** [../todo/await-8.md](../todo/await-8.md)

The entries this plan builds, with the patrol's decisions: [await-8](../todo/await-8.md), [reviewer-1](../todo/reviewer-1.md), [build-11](../todo/build-11.md), [pane-16](../todo/pane-16.md), [test-10](../todo/test-10.md), [judge-3](../todo/judge-3.md) (guard exception, controller may write only `.fankeel/build/ask/`), [skills-4](../todo/skills-4.md) (measure with input-check, then a size cap test), [gate-13](../todo/gate-13.md) (not built; reason recorded, closed as abandoned at land).

## Global Constraints

Generated from `node scripts/map.js` (1015 markdown files, 3 planned not built, 327 retired, 28 undeclared; filing: `docs/90-agent/plans` is `plan`, `docs/90-agent/todo` is `todo`, `docs/03-decisions` is `decision` with `audience: human`, index `docs/README.md`), `CONTRIBUTING.md` (there is no `CLAUDE.md` and no `AGENTS.md` in this repository), `package.json` and the tests that pin text.

- Runtime: `"engines": { "node": ">=22.5" }`, CommonJS with `'use strict';`, no dependency may be added (`package.json` has none).
- Indentation as the file already has it: 4 spaces in `lib/`, `scripts/`, `hooks/guard.js` and `tests/await.test.js`; 2 spaces in `hooks/pane-band.ts`, `hooks/pane-status.ts` and `tests/guard.test.js`. Read the file first.
- `CONTRIBUTING.md`: "Nothing in `lib/` reaches into `scripts/` or `hooks/`"; "Every exported name needs an importer" (`tests/source.test.js`); a new test file must be `git add`ed before the suite sees it.
- Tests: `package.json:11` `"test": "node --test --require ./tests/subprocess-timeout.js"`, `:12` `"test:fast": "node --test --test-skip-pattern=@slow --require ./tests/subprocess-timeout.js"`. An implementer runs only its own test command, never the whole suite (`scripts/ledger.js` brief footer). Never two suites at once on this machine. Render tests need `FANKEEL_BROWSER` set to Chrome's full path.
- No implementer commits; the build parent commits each group with `scripts/commit.js` and runs `scripts/suite.js --fast` before it.
- The injected stage text is capped below 2400 characters per stage (`tests/render.test.js:569`, strict `<`), and `skills/registry.json` carries `prompt_byte_budget` 2400 (`tests/stage-registry.test.js:32-33`). No task in this plan touches `lib/stages.js`.
- Every SKILL.md frontmatter `version:` line stays untouched (`tests/contract.test.js`); version words (`tests/version-prose.test.js`) likewise.
- Every flag a SKILL.md names must be one the script accepts (`tests/skills.test.js:1037`, `node scripts/skills-check.js`).
- `tests/agents.test.js:474` pins the implementer's "grep every caller" sentence; `:464-476` its five headings; `:71-76` the reviewer's cut tags and `net: -<N> lines possible.`; `:258-272` both agents' `effort: medium`; `:44-58` frontmatter `model` is set.
- `tests/inflight-text.test.js:18,26` pin "eight by default" in the build and verify skills; `tests/skills.test.js:34` pins the first 60 characters of the build skill's surface paragraph.
- Guard: `CONTROLLED(stage)` refusal text (`tests/guard.test.js:723`), and `node scripts/*.js` commands already pass a controlled stage (`tests/guard.test.js:736-750`).
- Plan caps (`lib/plantasks.js`): FILE_CAP 3 `Modify:` entries per task, READ_CAP 1500 lines per file. Largest file here: `skills/fankeel/SKILL.md`, 1243 lines.
- Doc links are relative and resolve; `node scripts/docs-check.js` exits 0 after every doc task. A decision page in a human bucket opens with one sentence and carries 決定, 為什麼 and 放棄了什麼 headings (docs-check's decision-shape).
- Windows: Git Bash is available; use `/` in paths. No emojis.

## Risks

- `--test-force-exit` ends a test file's process once its tests finish, so a file that relied on a lingering handle to run something after its last test would lose it — Task 5 — before editing `package.json`, it runs `grep -rln "process.on('exit'\|beforeExit" tests` and reads each hit; none is expected.
- A 300-second `--test-timeout` turns any single legitimate test slower than five minutes red — Task 5 — it greps `tests/` for `timeout:` options above 300000 on `test(` calls and raises the package value to cover the largest found, never lowering a test's own.
- Appending the failure-handoff path to the `lost` and `timeout` lines breaks every exact assertion on those lines — Task 1 — it runs `grep -rn "the stage agent stopped with neither file written\|^timeout — \|nothing moved in" tests lib hooks scripts skills` first and updates each consumer it finds (known: `tests/await.test.js:109`).
- The verify skill's "let its file pin the model" rule (`skills/fankeel-verify/SKILL.md:242-244`) and the fankeel skill's agent-file exception mean a `model` on the confirming reviewer is a deliberate exception — Task 2 — it greps `tests/` for `fankeel-reviewer` assertions about `model` before writing, and states the exception in the same sentence.
- `hooks/guard.js` has no `path` import (`:14-22`) — Task 6 — it adds `const path = require('node:path');` above `:14`.
- `targetOf(payload)` (`lib/guard.js`) may return a path relative to `cwd` rather than absolute — Task 6 — `asksBrief` resolves against `root` either way; the test sends both an absolute and a relative `file_path`.
- `todo.js new` with `--id skills-5` may refuse an explicit id, or may also touch `docs/README.md` — Task 7 — it runs `node scripts/todo.js new` once, reads its output, and if it wrote anything besides the entry, lists that file in its report for the parent to commit.
- `docs/README.md` is written by Task 8 only; `judge.js record` also writes it, but no task runs `judge.js` — Task 8 — none.
- The SKILL.md byte caps are set just above today's sizes, so any task in this plan that grows a skill could cross one — Task 7 — its caps are measured after Tasks 1, 2, 3 and 6 land (it is ordered after them by `Read:` of the four skills), and it measures before writing the numbers.
- The pane refactor changes no output, so its only test cycle is the existing tests — Task 4 — it runs `tests/pane-band.test.js tests/pane-status.test.js tests/pane-svg.test.js tests/band-0108.test.js` before and after and compares the pass counts.

## Task 1: await writes a failure handoff and the calibration names the classifier

**Files:**
- Modify: `scripts/await.js` — `lineFor` and `main` write `<stage>-failed.md` beside the handoff on `lost` and `timeout`
- Modify: `skills/fankeel/SKILL.md` — one sentence on the treadmill rule (`:917`) saying an observable fact is not a question, aligned with build's four stops
- Test: `tests/await.test.js`

**Interfaces:**
- Consumes: none
- Produces: `failedPath(handoff)` inside `scripts/await.js` (not exported); a file `<task dir>/<stage>[-gN]-failed.md` with lines `mode:`, `agent:`, `at:`, `count:`, `next:`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. In `tests/await.test.js`, after the test that starts at `:92`, add:

```js
test('await.js writes a failure handoff on lost and on timeout, and counts repeats', async () => {
    const g = fixture({ inflight: { stage: 'build', at: 1, agentId: 'a3f9c2' } });
    at(path.join(g.config, 'projects', 'F--x', SID + '.jsonl'), Date.now());
    at(path.join(g.config, 'projects', 'F--x', SID, 'subagents', 'agent-a3f9c2.jsonl'), Date.now() - 600000);
    const lost = await awaitCli.main(['--session', SID, '--root', g.root, '--idle', '0.2'], g.env);
    const failed = g.task + '/build-failed.md';
    assert.ok(lost.text.endsWith(' Failure handoff: ' + failed + '.'), lost.text);
    const body = fs.readFileSync(failed, 'utf8');
    assert.match(body, /^mode: lost$/m);
    assert.match(body, /^agent: a3f9c2$/m);
    assert.match(body, /^count: 1$/m);
    assert.match(body, /^next: dispatch a fresh stage agent with the same line$/m);

    const f = fixture({});
    const since = path.join(f.task, 'build-commit.md');
    const one = await awaitCli.main(['--session', SID, '--root', f.root, '--since', since, '--timeout', '0.2'], f.env);
    const two = await awaitCli.main(['--session', SID, '--root', f.root, '--since', since, '--timeout', '0.2'], f.env);
    assert.match(one.text, /^timeout — /);
    const again = fs.readFileSync(f.task + '/build-failed.md', 'utf8');
    assert.match(again, /^mode: timeout$/m);
    assert.match(again, /^count: 2$/m);
    assert.match(again, /^next: stop retrying and ask the user — two failures in a row$/m);
    assert.ok(two.text.includes('Failure handoff: '), two.text);
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/await.test.js`.

3. Update the exact `lost` assertion at `tests/await.test.js:109` to the new line:

```js
    assert.equal(lost.text, 'lost a3f9c2 — the stage agent stopped with neither file written: dispatch a fresh one with the same line. Failure handoff: ' + g.task + '/build-failed.md.');
```

   Then run `grep -rn "the stage agent stopped with neither file written\|nothing moved in" tests lib hooks scripts skills` and update any other exact match the same way.

4. Write the implementation. In `scripts/await.js`, above `function lineFor`, add:

```js
// A stage agent that dies leaves nothing behind but the await line, and the
// line is gone with the turn. This writes what happened beside the handoff it
// never wrote, so the next dispatch — or the user — reads the mode and what to
// try, and a second failure in a row says to stop retrying rather than loop.
function failedPath(handoff) {
    return handoff.replace(/\.md$/, '-failed.md');
}

function writeFailure(state, o) {
    const file = failedPath(o.handoff);
    let count = 1;
    try {
        const prior = /^count: (\d+)$/m.exec(fs.readFileSync(file, 'utf8'));
        if (prior) count = Number(prior[1]) + 1;
    } catch (e) { /* first failure */ }
    const next = count >= 2 ? 'stop retrying and ask the user — two failures in a row'
        : state === 'lost' ? 'dispatch a fresh stage agent with the same line'
        : 'run await again';
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, ['mode: ' + state, 'agent: ' + (o.agentId || '?'), 'at: ' + new Date().toISOString(),
            'count: ' + count, 'next: ' + next, ''].join('\n'));
    } catch (e) { return null; }
    return file;
}
```

   In `scripts/await.js`, in `main`, inside `awaitHandoff(o).then((state) => {`, replace the line

```js
        const line = lineFor(state, o, state === 'commit' ? newestCommit(o.commit, o.since) : null);
```

   with, in `scripts/await.js`:

```js
        const failed = state === 'lost' || state === 'timeout' ? writeFailure(state, o) : null;
        const line = lineFor(state, o, state === 'commit' ? newestCommit(o.commit, o.since) : null)
            + (failed ? ' Failure handoff: ' + failed.replace(/\\/g, '/') + '.' : '');
```

   On a `handoff` state, delete a stale `-failed.md` so a later failure counts from one: in `scripts/await.js`, directly after the `failed` line add

```js
        if (state === 'handoff') { try { fs.unlinkSync(failedPath(o.handoff)); } catch (e) { /* none */ } }
```

5. In `skills/fankeel/SKILL.md`, at the end of the paragraph that opens `**A gate on every stage is a treadmill.**` (`:917`), append this sentence to that paragraph:

```md
Nor is a fact a run can observe a question: what a command, a test or a
throwaway prototype would show is answered by running it, and only a product
or preference judgement no experiment settles goes to the user — the same line
`fankeel-build`'s four stops draw, where nothing short of those four stops the
loop.
```

6. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/await.test.js tests/await-pending.test.js`, then `node scripts/skills-check.js`.

## Task 2: the reviewer filters nits and presumes four blockers; verify's confirmer runs on another model

**Files:**
- Modify: `agents/fankeel-reviewer.md` — three dismissal rules under `## Never a finding`, an explicit empty review, four presumed cuts under `## Cuts`
- Modify: `skills/fankeel-verify/SKILL.md` — the confirming reviewer (`:292-297`) is dispatched on a model other than the adversary's
- Test: `tests/reviewer-filter.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the text; transcription plus tests.

1. Write the failing test, `tests/reviewer-filter.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('the reviewer dismisses nits, untraced assumptions and taste, and an empty review is a result', () => {
    const r = read('agents/fankeel-reviewer.md');
    assert.match(r, /every finding is a nit, the code is fine/);
    assert.match(r, /trace it to a real caller/);
    assert.match(r, /I would have done it differently/);
    assert.match(r, /An empty review is a result/);
});

test('the reviewer presumes four cuts: a file past 1000 lines, a scattered feature check, a no-op wrapper or cast, a duplicate helper', () => {
    const r = read('agents/fankeel-reviewer.md');
    const cuts = r.slice(r.indexOf('## Cuts'), r.indexOf('## Security'));
    assert.match(cuts, /past 1000 lines/);
    assert.match(cuts, /feature check scattered/);
    assert.match(cuts, /wrapper or a cast/);
    assert.match(cuts, /duplicates a helper/);
});

test('verify confirms the adversary on a different model', () => {
    const v = read('skills/fankeel-verify/SKILL.md');
    assert.match(v, /model other than the adversary's/);
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/reviewer-filter.test.js`.

3. In `agents/fankeel-reviewer.md`, at the end of `## Never a finding` (after `:69`, the paragraph ending "the same as one that found nothing at all."), add:

```md

Three more are dismissed before they are written. When every finding is a
nit, the code is fine: say `clean`, not a list of nits. An assumption — that
a value can be null, that a call can fail — is a finding only once you trace it to a real caller
that passes it; one you cannot trace is not reported. And "I would have done
it differently" is never a finding: a different shape that is not shorter,
safer or faster is taste. An empty review is a result, not a review that
failed to look.
```

4. In `agents/fankeel-reviewer.md`, under `## Cuts`, directly after the table that ends with the `shrink:` row, add:

```md

Four shapes are presumed cuts — report them unless the diff says why they
must stay: a file the diff takes past 1000 lines (`shrink:`, split by
responsibility); a feature check scattered across callers rather than decided
once (`yagni:`, one place); a wrapper or a cast that changes nothing
(`delete:`); a new helper that duplicates a helper the repository already has
(`delete:`, naming the existing one).
```

5. In `skills/fankeel-verify/SKILL.md`, at the end of the paragraph `:292-297` (ending "one it drops did not hold after all."), add:

```md
This one is the exception to letting the agent file pin the model: pass
`model` on it, a model other than the adversary's — the adversary ran on the
file's own `sonnet`, so the confirmer goes as `opus` — because a confirmer
sharing the adversary's model shares its blind spots.
```

   Before writing it, run `grep -n "fankeel-reviewer" tests/*.js | grep -i model` and keep any assertion green.

6. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/reviewer-filter.test.js tests/agents.test.js`, then `node scripts/skills-check.js`.

## Task 3: bug-fix, perf and refactor lenses, and a written premise on the third fix round

**Files:**
- Modify: `skills/fankeel-design/SKILL.md` — the success-criterion table (`:174-178`) gains the three kind lenses
- Modify: `agents/fankeel-implementer.md` — `## A bug fix` (`:62-66`) requires a repro and a `Root cause:` line
- Modify: `skills/fankeel-build/SKILL.md` — after step 6's five-round bound (`:540-541`), the third round writes the shared premise down first
- Test: `tests/kind-lens.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the text; transcription plus tests.

1. Write the failing test, `tests/kind-lens.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('the design criterion table carries a lens for a bug, a speed-up and a refactor', () => {
    const d = read('skills/fankeel-design/SKILL.md');
    assert.match(d, /\| "fix the bug" \| reproduced through the same interface the user hit/);
    assert.match(d, /\| "make it faster" \| a baseline first/);
    assert.match(d, /at least five runs, median and range/);
    assert.match(d, /\| "refactor X" \| the behaviour pinned by tests before/);
    assert.match(d, /no shim left behind/);
});

test('an implementer fixing a bug commits the repro first and writes the root cause', () => {
    const i = read('agents/fankeel-implementer.md');
    const fix = i.slice(i.indexOf('## A bug fix'), i.indexOf('## Never cut'));
    assert.match(fix, /grep every caller/);
    assert.match(fix, /reproduce it yourself/);
    assert.match(fix, /`Root cause: <X> because <Y>`/);
});

test('the third fix round writes down the premise the first two shared', () => {
    const b = read('skills/fankeel-build/SKILL.md');
    assert.match(b, /Before a third round, write down the premise/);
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/kind-lens.test.js`.

3. In `skills/fankeel-design/SKILL.md`, replace the table at `:174-178`:

```md
| Ask | Criterion |
|---|---|
| "add validation" | tests for the invalid inputs, failing, then passing |
| "fix the bug" | a test reproducing it, failing, then passing |
| "refactor X" | the suite green before and after |
```

   with, in `skills/fankeel-design/SKILL.md`:

```md
| Ask | Criterion |
|---|---|
| "add validation" | tests for the invalid inputs, failing, then passing |
| "fix the bug" | reproduced through the same interface the user hit, that repro committed failing, then passing; the cause stated as `Root cause: <X> because <Y>` |
| "make it faster" | a baseline first, the limiting factor named, at least five runs, median and range, before and after |
| "refactor X" | the behaviour pinned by tests before, the suite green after, no shim left behind, and reverted if it does not leave the code easier to read |
```

4. In `agents/fankeel-implementer.md`, replace `## A bug fix` (`:62-66`) with — keeping the "grep every caller" sentence word for word (pinned by tests/agents.test.js:474):

```md
## A bug fix

Before the fix, reproduce it yourself through the same interface the bug was
met in, and land that repro as a failing test first. Then write one line in
your return, `Root cause: <X> because <Y>`; a fix you cannot finish that line
for is a symptom patch.

Fix the cause, not the symptom. Before editing a function, grep every caller
of it: one guard in the shared function is a smaller diff than one in every
caller, and patching only the path the task names leaves its siblings broken.
```

5. In `skills/fankeel-build/SKILL.md`, directly after the two lines of step 6 (`6. Fix rounds are bounded at **five**. A finding you overrule is a ruling, not a` / `silence.`), add, indented to step 6's continuation:

```md
   Before a third round, write down the premise the first two rounds shared —
   `ledger.js ruling` — and test that premise before fixing again: two fixes
   that failed on one assumption fail a third time on it.
```

   Before writing it, run `node scripts/ledger.js` with no arguments and confirm `ruling` is a subcommand it lists; if it is not, write `task.js note` there instead.

6. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/kind-lens.test.js tests/agents.test.js tests/design-skill.test.js tests/design-guide.test.js tests/inflight-text.test.js`, then `node scripts/skills-check.js`.

## Task 4: one marked-bar helper in the band, and an early return in the pane's tasks block

**Files:**
- Modify: `hooks/pane-band.ts` — the three `markedBar` loops in `secondAt` (`:175-182`, `:197-204`, `:212-219`) become calls to one closure
- Modify: `hooks/pane-status.ts` — `tasksBlock` (`:265-281`) returns `[]` before computing `mark`, `out` and `late`
- Read: `tests/pane-band.test.js` — run before and after, not edited

**Interfaces:**
- Consumes: none
- Produces: `marked(part, whole, at, paint, markSeg)` — a closure inside `secondAt` in `hooks/pane-band.ts`, not exported

**Dispatch:** implementer, sonnet — a refactor whose code is in the plan; the existing tests are its criterion.

1. Run the existing tests and record their pass count: `node --test --require ./tests/subprocess-timeout.js tests/pane-band.test.js tests/pane-status.test.js tests/pane-svg.test.js tests/band-0108.test.js`.

2. In `hooks/pane-band.ts`, inside `secondAt`, directly after the `draw` closure (`:162-166`), add:

```ts
    const marked = (part: number, whole: number, at: number, paint: Paint, markSeg: (text: string) => Seg): void => {
      for (const p of markedBar(part, whole, shape.cells, at)) {
        if (p.kind === 'fill') row.push(inked(p.text, paint))
        else row.push(p.kind === 'mark' ? markSeg(p.text) : { text: p.text, color: DIM })
      }
    }
```

3. In `hooks/pane-band.ts`, replace the ctx loop (`:176-179`):

```ts
            for (const p of markedBar(context.tokens, window, shape.cells, context.at)) {
              if (p.kind === 'fill') row.push(inked(p.text, paint))
              else row.push(p.kind === 'mark' ? { text: p.text, color: '#ffffff', bold: true } : { text: p.text, color: DIM })
            }
```

   with, in `hooks/pane-band.ts`:

```ts
            marked(context.tokens, window, context.at, paint, (text) => ({ text, color: '#ffffff', bold: true }))
```

   Replace the 5h loop in `hooks/pane-band.ts` (`:200-203`):

```ts
          for (const p of markedBar(five.percentUsed, 100, shape.cells, gone * 100)) {
            if (p.kind === 'fill') row.push(inked(p.text, paint))
            else row.push({ text: p.text, color: p.kind === 'mark' ? WHERE : DIM })
          }
```

   with, in `hooks/pane-band.ts`:

```ts
          marked(five.percentUsed, 100, gone * 100, paint, (text) => ({ text, color: WHERE }))
```

   and the 7d loop in `hooks/pane-band.ts` (`:215-218`), the same shape with `week`:

```ts
          marked(week.percentUsed, 100, gone * 100, paint, (text) => ({ text, color: WHERE }))
```

   If the `else {` braces around a now single-statement body read oddly, leave them: the diff is the loops only.

4. In `hooks/pane-status.ts`, in `tasksBlock`, move the line

```ts
  if (!plan || !plan.tasks.length) return []
```

   from `:281` to be the first statement of the function body, above `const stage = str(entry.stage)`. Nothing else in the function changes.

5. Run the four test files again; the pass count equals step 1's and nothing fails. Then `grep -c "markedBar(" hooks/pane-band.ts` prints `1`.

## Task 5: a stuck test turns red instead of holding the suite lock

**Files:**
- Modify: `package.json` — `test` and `test:fast` gain `--test-timeout=300000 --test-force-exit`
- Modify: `tests/station-serve.test.js` — the test at `:161-175` closes its server in `finally`
- Test: `tests/test-timeout.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test, `tests/test-timeout.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tmp = require('./tmp.js');

test('both suite scripts bound a single test and exit when the tests are done', () => {
    const scripts = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).scripts;
    for (const name of ['test', 'test:fast']) {
        const m = /--test-timeout=(\d+)/.exec(scripts[name]);
        assert.ok(m, name + ' has no --test-timeout');
        assert.ok(Number(m[1]) >= 60000 && Number(m[1]) <= 600000, name + ' timeout ' + m[1]);
        assert.match(scripts[name], /--test-force-exit/, name);
    }
});

test('an async test that never ends goes red within the timeout and the run exits', () => {
    const dir = tmp('fankeel-test-timeout-');
    const file = path.join(dir, 'hangs.test.js');
    fs.writeFileSync(file, "const test = require('node:test');\n"
        + "test('hangs', () => new Promise(() => { setInterval(() => {}, 1000); }));\n");
    const started = Date.now();
    const r = spawnSync(process.execPath, ['--test', '--test-timeout=500', '--test-force-exit', file], { encoding: 'utf8', timeout: 60000 });
    assert.equal(r.error, undefined, 'the run itself hung');
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /timed out|cancelled/i);
    assert.ok(Date.now() - started < 30000);
});
```

2. Run it and watch the first test fail: `node --test --require ./tests/subprocess-timeout.js tests/test-timeout.test.js`.

3. Before editing, run `grep -rln "process.on('exit'\|beforeExit" tests` and read each hit for work done after the last test; and `grep -rn "timeout: [0-9]\{6,\}" tests` for a single test allowed more than 300000 ms — if one exists, use its value instead of 300000 below.

4. In `package.json`, replace `:11-12`:

```json
    "test": "node --test --require ./tests/subprocess-timeout.js",
    "test:fast": "node --test --test-skip-pattern=@slow --require ./tests/subprocess-timeout.js",
```

   with, in `package.json`:

```json
    "test": "node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js",
    "test:fast": "node --test --test-timeout=300000 --test-force-exit --test-skip-pattern=@slow --require ./tests/subprocess-timeout.js",
```

5. In `tests/station-serve.test.js`, in the test at `:161-175`, wrap the asserts that run between `serve(...)` and `s.close()` (`:173`) in `try`, and move the close into `finally` guarded so the assertion on `serve.json` being removed still runs after it:

```js
    let closed = false;
    try {
        // the existing asserts that run before close, unchanged
        s.close();
        closed = true;
        // the existing asserts on serve.json after close, unchanged
    } finally {
        if (!closed) s.close();
    }
```

   Read `:161-175` first and keep every existing assert, in its order, inside the `try`.

6. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/test-timeout.test.js tests/station-serve.test.js`.

## Task 6: a controlled stage lets the controller write its /fankeel-ask brief

**Files:**
- Modify: `hooks/guard.js` — the controlled-stage Write refusal (`:137-148`) skips a target under `.fankeel/build/ask/`
- Modify: `skills/fankeel-ask/SKILL.md` — step 1 (`:63-68`) says the guard lets the controller write there on a controlled stage
- Test: `tests/guard.test.js`

**Interfaces:**
- Consumes: `targetOf(payload)` from `lib/guard.js` (already imported at `hooks/guard.js:16`)
- Produces: `asksBrief(root, file)` inside `hooks/guard.js` (not exported)

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. In `tests/guard.test.js`, after the test that starts at `:736` (`a controlled stage lets the controller's read-only commands and its own scripts through`), add:

```js
test('a controlled stage lets the controller write its /fankeel-ask brief and nothing else', () => {
  const root = tmp();
  seed(root, MINE, { stage: 'survey', claims: [] });
  agentsOn(root, 'survey,build,verify');
  const write = (file) => ({ session_id: MINE, cwd: root, tool_name: 'Write', tool_input: { file_path: file, content: 'q' } });
  assert.equal(run(root, write(path.join(root, '.fankeel', 'build', 'ask', '1-memory-brief.md'))), '');
  assert.equal(run(root, write('.fankeel/build/ask/2-memory-brief.md')), '');
  assert.equal(decisionOf(run(root, write(path.join(root, '.fankeel', 'build', 'ask', '..', 'survey.md')))), 'deny');
  assert.equal(decisionOf(run(root, write(path.join(root, 'notes.md')))), 'deny');
  assert.equal(run(root, shellCall(root, 'node scripts/judge.js record --session x --brief .fankeel/build/ask/1-memory-brief.md --answer - --slug memory')), '');
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/guard.test.js`.

3. In `hooks/guard.js`, add above `:14`:

```js
const path = require('node:path');
```

   and, in `hooks/guard.js`, above the function that holds the Write-tool block, add:

```js
// /fankeel-ask's first step is the controller writing its brief, and a judge
// is asked from whatever stage the user is in — controlled ones included. So
// the one directory the brief goes to is let through, and nothing outside it:
// a `..` that climbs back out is refused like any other controller write.
const ASK_DIR = '.fankeel/build/ask/';
function asksBrief(root, file) {
    if (typeof file !== 'string' || !file) return false;
    const rel = path.relative(root, path.resolve(root, file)).replace(/\\/g, '/');
    return rel.startsWith(ASK_DIR) && !rel.split('/').includes('..');
}
```

   Then change the condition in `hooks/guard.js` at `:137` from

```js
    if (!payload.agent_id && WRITE_TOOLS.has(payload.tool_name)) {
```

   to, in `hooks/guard.js`:

```js
    if (!payload.agent_id && WRITE_TOOLS.has(payload.tool_name) && !asksBrief(root, targetOf(payload))) {
```

4. In `skills/fankeel-ask/SKILL.md`, at the end of step 1 (after `:68`, the sentence about build/ already being in .fankeel/.gitignore), add, indented to the step:

```md
   On a controlled stage the guard refuses every other controller write but
   lets this one through (`asksBrief`, `hooks/guard.js`), so the judge is asked
   from the stage the user is in — no `task.js route` detour.
```

5. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/guard.test.js`, then `node scripts/skills-check.js`.

## Task 7: input-check measures the stage skills, and a byte cap holds them

**Files:**
- Modify: `scripts/input-check.js` — a `--skills` flag lists every `skills/*/SKILL.md` with bytes, lines and tokens; `skillFiles(root)` exported
- Modify: `docs/90-agent/todo/skills-5.md` — a new Ready entry for the slimming itself, written by `todo.js new`
- Read: `skills/fankeel/SKILL.md` — measured after Task 1 lands
- Read: `skills/fankeel-build/SKILL.md` — measured after Task 3 lands
- Test: `tests/skill-size.test.js`

**Interfaces:**
- Consumes: none
- Produces: `skillFiles(root) → [{ file, bytes, lines, tokens }]` from `scripts/input-check.js`, sorted by `bytes` descending

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test, `tests/skill-size.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { skillFiles, main } = require('../scripts/input-check.js');

// A ratchet, not a target: each cap sits just above the size measured on
// 2026-10-19 (`node scripts/input-check.js --skills`), so a skill can shrink
// freely and cannot grow unnoticed. Slimming lowers the number in the same
// change; growing past it is a decision, made by raising it here.
const CAPS = { 'fankeel': 78000, 'fankeel-build': 49000 };
const OTHER = 24000;

test('input-check --skills lists every stage skill with its size', () => {
    const root = path.join(__dirname, '..');
    const list = skillFiles(root);
    assert.ok(list.length >= 13, 'found ' + list.length);
    for (const s of list) assert.ok(s.bytes > 0 && s.lines > 0 && s.tokens > 0, s.file);
    const out = main(['--root', root, '--skills']).text;
    assert.match(out, /skills\/fankeel-build\/SKILL\.md/);
});

test('no SKILL.md grows past its byte cap', () => {
    for (const s of skillFiles(path.join(__dirname, '..'))) {
        const name = path.basename(path.dirname(s.file));
        const cap = CAPS[name] || OTHER;
        assert.ok(s.bytes <= cap, name + ' is ' + s.bytes + ' bytes, cap ' + cap);
    }
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/skill-size.test.js`.

3. In `scripts/input-check.js`, above `function report`, add:

```js
// The stage skills are read once, on entering a stage, rather than in every
// session — so they are listed apart from the always-loaded files above, and
// only when asked for.
function skillFiles(root) {
    const dir = path.join(root, 'skills');
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { return []; }
    return names.map((name) => path.join(dir, name, 'SKILL.md'))
        .filter((file) => fs.existsSync(file))
        .map((file) => {
            const text = fs.readFileSync(file, 'utf8');
            return { file, bytes: Buffer.byteLength(text, 'utf8'), lines: text.split('\n').length, tokens: estimateTokens(text) };
        })
        .sort((a, b) => b.bytes - a.bytes);
}

function skillReport(root, list) {
    const n = (v) => v.toLocaleString('en-US');
    const lines = ['fankeel input-check --skills — ' + path.resolve(root).replace(/\\/g, '/'),
        '  ' + list.length + ' SKILL.md files, each read once on entering its stage', ''];
    for (const s of list) {
        lines.push('  ' + n(s.bytes).padStart(8) + ' B  ' + n(s.lines).padStart(5) + ' lines  ~' + n(s.tokens).padStart(7) + ' tok  '
            + path.relative(root, s.file).replace(/\\/g, '/'));
    }
    return lines.join('\n');
}
```

   In `scripts/input-check.js`, in `parseArgs`, add `skills: { type: 'boolean' }` to `options`, and `skills: values.skills === true,` to the returned object. In `main`, replace

```js
    const { root, configDir, sectionBytes } = parseArgs(argv);
    return { text: report(scan(root, configDir, { sectionBytes })), code: 0 };
```

   with, in `scripts/input-check.js`:

```js
    const { root, configDir, sectionBytes, skills } = parseArgs(argv);
    if (skills) return { text: skillReport(root, skillFiles(root)), code: 0 };
    return { text: report(scan(root, configDir, { sectionBytes })), code: 0 };
```

   and add `skillFiles` to `module.exports`. Update the usage comment at `:6` to `node input-check.js [--root <dir>] [--config-dir <dir>] [--section-bytes <n>] [--skills]`.

4. Run `node scripts/input-check.js --skills`. If `fankeel` measures above 77000 bytes or `fankeel-build` above 48000 or any other above 23000 — Tasks 1, 2, 3 and 6 grew them first — set that cap to the measured size rounded up to the next 1000 plus 1000, and keep the comment's date.

5. File the slimming as its own entry:

```
node scripts/todo.js new --id skills-5 --label skills --title "stage skill 瘦身到上限以下" --state ready --link scripts/input-check.js --description "fankeel 與 build 兩份 SKILL.md 依 input-check --skills 的量測瘦身，並把 tests/skill-size.test.js 的上限一起調低" --body "來源：2026-10-19 TODO 全表盤點的 skills-4 決定「先量測再設上限」。tests/skill-size.test.js 已把每份 SKILL.md 的位元組上限釘在 2026-10-19 量到的大小之上，只防變大、不逼變小。要變成：用 node scripts/input-check.js --skills 找出最大的 fankeel（約 77k bytes）與 fankeel-build（約 47k bytes），把只有理由沒有規則的段落移到 rationale 或 docs/90-agent/reference，規則本身不刪。完成的樣子：兩份檔各少至少 15%，tests/skill-size.test.js 的 CAPS 同一個 commit 調低到新大小之上，skills-check 與整套測試綠。"
```

   Then `node scripts/todo-check.js`. If `todo.js new` refuses `--id`, run it without `--id` and put the id it printed in the report.

6. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/skill-size.test.js tests/source.test.js`.

## Task 8: the decision not to answer gates unattended

**Files:**
- Modify: `docs/03-decisions/2026-10-19-no-unattended-gate.md` — new decision record
- Modify: `docs/README.md` — one row in the decisions table beside `:302`, one line in the list beside `:572`
- Read: `tests/docs-check.test.js` — run, not edited

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the page; transcription plus docs-check.

1. Run `node scripts/docs-check.js` and note its last line (the baseline).

2. Write `docs/03-decisions/2026-10-19-no-unattended-gate.md`:

```md
---
status: decision
last_verified: 2026-10-19
---

# 不讓常備答案代答 gate（10-19）

一句話：使用者宣告離開時，gate 仍然要問人；fankeel 不加「由 profile 常備答案代答階段 gate」的鍵。

這是 [gate-13](../90-agent/todo/gate-13.md) 的結論，來源是判官對 cursor/plugins 的 pstack 與 fankeel 的比較（[judgements/2026-10-18-cursor-plugins-pstack.md](../90-agent/judgements/2026-10-18-cursor-plugins-pstack.md)，比較表 #1、#21，判官評為 C 拒）。

## 決定

- 不加常備答案的 profile 鍵；每一站結束仍以 AskUserQuestion 問人。
- 現有的 `gate.away` 不變：context 很大時多問一題「離開」，答要離開就在這輪結束時壓縮，不替人回答。
- gate-13 以 abandoned 關閉。

## 為什麼

`hooks/gate.js` 的去重（同一題被重問時沿用第一次的時間）、stage agent 交回的 gate 必須逐字複製的檢查，以及答完後的 resume 流程，全都假設 gate 一定被問。常備答案會讓這三件事各自要多一條「沒問」的分支，而 gate 是使用者唯一核准一站成果的地方：代答等於讓下一站建立在沒人看過的報告上。

## 放棄了什麼

- 常備答案代答指定階段：能真正無人值守，但要改 `hooks/gate.js` 與它的測試，並失去 gate 作為核准點的意義。
- 只批次或延後提問：改動較小，但不能真正無人值守，等於現有 `gate.away` 的變形。

## 還沒驗的

- 過夜長跑的實際需求有多常出現；若之後有具體案例，再開新條目重議。
```

   The judgement page it links was checked to exist on 2026-10-19.

3. In `docs/README.md`, directly below `:302` (the `判官先列清單、讀者一次派出（10-19）` row), add:

```md
| 不讓常備答案代答 gate（10-19）定了什麼：離開時 gate 仍問人，不加代答的 profile 鍵；放棄了什麼 | [decisions/2026-10-19-no-unattended-gate.md](03-decisions/2026-10-19-no-unattended-gate.md) — *繁體中文* |
```

   and in `docs/README.md`, directly below `:572` (the 判官先列清單 list line), add:

```md
- [不讓常備答案代答 gate（10-19）](03-decisions/2026-10-19-no-unattended-gate.md)
```

4. Run `node scripts/docs-check.js` — no new line against step 1's baseline — and `node --test --require ./tests/subprocess-timeout.js tests/docs-check.test.js`.

## Coverage

| promise | task |
|---|---|
| await-8: calibration 加「能跑出來觀察的事實不問人」並對齊 build 四種停 | Task 1 |
| await-8: await.js 在 lost／timeout 時寫一份合成 handoff，記錄模式、最後活動與建議下一步 | Task 1 |
| await-8: await 測試加一個 lost 情境，斷言合成 handoff 檔存在且含模式欄位 | Task 1 |
| reviewer-1: 三條駁回規則、空審查合法、四條推定阻擋項（放進 cuts lens） | Task 2 |
| reviewer-1: fankeel-verify 第二輪確認 reviewer 用與首輪不同的模型 | Task 2 |
| build-11: design 準則表與 implementer 的 bug-fix 節補上三種 lens | Task 3 |
| build-11: build 的修補迴圈第 3 輪要求寫下共同前提 | Task 3 |
| pane-16: markedBar 迴圈抽成一個 helper | Task 4 |
| pane-16: tasksBlock 沒有計畫時提早回傳 | Task 4 |
| test-10: test 與 test:fast 帶 --test-timeout，開伺服器的測試結束時一定關掉 | Task 5 |
| test-10: 一條刻意永遠不結束的非同步測試會在逾時內變紅 | Task 5 |
| test-10: station-serve.test.js 在整套負載下連跑數次都不再卡住 | struck from build — verify runs it three times under the suite; no task can prove "several runs" in its own test |
| test-10: suite.js 等鎖時，持有者沒有新輸出就報出來 | struck — the entry says 考慮; the lock records no output path (`lib/suitelock.js:103`), so it needs its own design |
| judge-3: guard 對主控寫 .fankeel/build/ask/ 放行，judge.js record 不被擋 | Task 6 |
| judge-3: 在 survey 站實跑一次 /fankeel-ask 能歸檔 | struck from build — verify, or the user, runs it once on a controlled stage |
| skills-4: 先用 input-check 量化每個 stage skill，再設上限的測試 | Task 7 |
| skills-4: 若瘦身，另開任務 | Task 7 |
| skills-4: architectural design 要不要多候選（兩個草圖由 judge 選一） | struck — not decided at the survey gate; left open on skills-4 for the user |
| gate-13: 不做，把理由寫進決策紀錄後關閉 | Task 8; closed at land |
