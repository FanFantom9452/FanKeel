---
status: current
last_verified: 2026-10-29
---

# Reviewer incident-replay evals Implementation Plan

**Goal:** Two eval cases that replay misses fankeel's own review let through, a rule that a reviewer change which drops one is not kept, and the retired effort-variant leftovers deleted.
**Architecture:** Each case is a directory under `evals/` in the existing layout (`case.yaml` with a one-line `scaffold_script`, `prompt.md`, `graders/*.md`) read by `lib/eval.js` `parseCase`. Free `node --test` files build each scaffold in a temp dir and grade sample returns with `ev.grade`, so fixture and graders are proven without spending a `claude -p`. The rule is a section in `docs/90-agent/reference/evals.md`.
**Tech Stack:** Node `>=22.5`, zero runtime dependencies, `node --test`; `bash` for scaffolds, as `scripts/eval.js:73` and `tests/eval.test.js:159` already use.
**Spec:** [design.md](../../../.fankeel/build/task-20261029T144337/design.md), approved at the design gate; judgement `docs/90-agent/judgements/2026-10-29-anthropic-review-practice.md`.

## Global Constraints

- `scaffoldOf` (lib/eval.js:25) reads `scaffold_script` as the rest of one line and strips one leading and one trailing `"` or `'` with no unescaping: write it unquoted, end it on a character that is not a quote, and keep `: ` (colon space) and ` #` out of it so the official YAML runner reads it as a plain scalar.
- `parseCase` (lib/eval.js:37-39) throws `no prompt.md in <dir>` when a case has no `prompt.md`.
- Frontmatter values (lib/docs.js:386) are the rest of the line, end quotes stripped: grader `pattern:` values are written unquoted on one line.
- Grader types this runner grades: `tool_used`, `regex` with `target: last_message` or `trace` (lib/eval.js:121-142).
- `tests/*.test.js` use `node --test`; scratch dirs come from `tests/tmp.js`; a new file has to be staged (`git add`) before `tests/source.test.js` sees it (map).
- An implementer runs only its own test command, never the full suite.
- Evals spend money and are run by hand only, never in CI (docs/90-agent/reference/evals.md:53-57); no task here runs `scripts/eval.js`.
- Version numbers move only through `scripts/version.js`; this plan moves none, land releases.

## Risks

- Bash on Windows may write CRLF or mangle `\n` in `printf '%s\n'` — Task 1, Task 3 — each fixture test reads the scaffolded file and asserts the planted line by content and line number.
- A grader regex loose enough to pass a vague return — Task 2, Task 4 — each grader test grades a `clean` return and a return naming the wrong cause, both must fail.

## Task 1: Replay fixture — a guard whose flag is always set

**Files:**
- Modify: `evals/replay-guard-always-true/case.yaml` — new; scaffold a two-commit repo
- Modify: `evals/replay-guard-always-true/prompt.md` — new; dispatch the reviewer
- Read: `lib/eval.js` — `parseCase`
- Read: `tests/tmp.js` — scratch dirs
- Test: `tests/eval-replay-guard-fixture.test.js`

**Interfaces:**
- Consumes: `ev.parseCase(dir) -> { scaffold }` from `lib/eval.js`
- Produces: the case directory `evals/replay-guard-always-true/` with `inflight.js:11` as the planted guard, for Task 2

**Dispatch:** implementer, sonnet — the plan carries every file; transcription plus one test.

1. Write the failing test.

In `tests/eval-replay-guard-fixture.test.js`:

```js
'use strict';

// Replays revert 5e2e621d: a handoff condition meant to spare the stage's
// closing brain, where markInflight always assigns a group. Proves the fixture
// for free; the paid run is scripts/eval.js, by hand.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const tmp = require('./tmp.js');
const ev = require('../lib/eval.js');

const CASE = path.join(__dirname, '..', 'evals', 'replay-guard-always-true');

test('the scaffold builds the two commits with the guard at line 11', () => {
    const c = ev.parseCase(CASE);
    const dir = tmp('fankeel-replay-guard-');
    const r = spawnSync('bash', ['-c', c.scaffold], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const lines = fs.readFileSync(path.join(dir, 'inflight.js'), 'utf8').split(/\r?\n/);
    assert.equal(lines[3].trim(), 'if (o.group == null) o.group = ++next;');
    assert.equal(lines[10].trim(), 'if (state === "handoff" && o.group) delete marks[o.id];');
    const log = spawnSync('git', ['log', '--oneline'], { cwd: dir, encoding: 'utf8' });
    assert.equal(log.stdout.trim().split('\n').length, 2);
    const diff = spawnSync('git', ['diff', 'HEAD~1..HEAD', '--stat'], { cwd: dir, encoding: 'utf8' });
    assert.match(diff.stdout, /inflight\.js/);
});

test('the prompt dispatches the reviewer', () => {
    assert.match(ev.parseCase(CASE).prompt.body, /subagent_type fankeel:fankeel-reviewer/);
});
```

2. Run it and watch it fail: `node --test tests/eval-replay-guard-fixture.test.js` — fails with `no prompt.md in`.

3. Write the case.

In `evals/replay-guard-always-true/case.yaml`:

```yaml
schema_version: "1.1"
name: replay-guard-always-true
context:
  scaffold_script: git init -q && printf '%s\n' 'const marks = {};' 'let next = 0;' 'function markInflight(o) {' '  if (o.group == null) o.group = ++next;' '  marks[o.id] = o;' '}' 'function onState(o, state) {' '  if (state === "done") delete marks[o.id];' '}' 'module.exports = { markInflight, onState, marks };' > inflight.js && git add -A && git -c user.email=eval@fankeel -c user.name=eval commit -qm base && printf '%s\n' 'const marks = {};' 'let next = 0;' 'function markInflight(o) {' '  if (o.group == null) o.group = ++next;' '  marks[o.id] = o;' '}' 'function onState(o, state) {' '  if (state === "done") delete marks[o.id];' '  // A group brain hands off partial work, so its mark goes now.' '  // The closing brain has no group and keeps its mark until the gate is confirmed.' '  if (state === "handoff" && o.group) delete marks[o.id];' '}' 'module.exports = { markInflight, onState, marks };' > inflight.js && git add -A && git -c user.email=eval@fankeel -c user.name=eval commit -m 'clear a group brain mark on handoff' -q
```

In `evals/replay-guard-always-true/prompt.md`:

```md
---
name: replay-guard-always-true
description: Replays revert 5e2e621d — the reviewer sees that the guard's group is always set
tags: [reviewer, replay]
runs: 1
max_turns: 8
timeout_seconds: 300
---
Dispatch subagent_type fankeel:fankeel-reviewer with this brief, and give me its return verbatim: "Review git diff HEAD~1..HEAD in this repository against its commit message and its comments."
```

4. Run it and watch it pass: `node --test tests/eval-replay-guard-fixture.test.js`.

5. Commit: `git add evals/replay-guard-always-true tests/eval-replay-guard-fixture.test.js` and commit `evals: replay fixture for revert 5e2e621d`.

## Task 2: Replay graders — a guard whose flag is always set

**Files:**
- Modify: `evals/replay-guard-always-true/graders/dispatches-the-reviewer.md` — new
- Modify: `evals/replay-guard-always-true/graders/names-the-cause.md` — new
- Read: `lib/eval.js` — `parseCase`, `grade`
- Test: `tests/eval-replay-guard-graders.test.js`

**Interfaces:**
- Consumes: `evals/replay-guard-always-true/` from Task 1 (`parseCase` needs its `prompt.md`); `ev.grade(g, { calls, last, texts }) -> { pass }` from `lib/eval.js`
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries every file; transcription plus one test.

1. Write the failing test.

In `tests/eval-replay-guard-graders.test.js`:

```js
'use strict';

// The graders of the revert-5e2e621d replay: a catch passes, a clean return
// and a wrong cause fail. Free; the paid run is scripts/eval.js, by hand.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ev = require('../lib/eval.js');

const CASE = path.join(__dirname, '..', 'evals', 'replay-guard-always-true');
const AGENT = { name: 'Agent', input: { subagent_type: 'fankeel:fankeel-reviewer', prompt: 'Review git diff HEAD~1..HEAD' } };
const run = (last, calls) => ({ calls: calls || [AGENT], last, texts: last });
const byName = (n) => ev.parseCase(CASE).graders.find((g) => g.name === n);

test('the reviewer must be dispatched', () => {
    const g = byName('dispatches-the-reviewer');
    assert.equal(ev.grade(g, run('x')).pass, true);
    assert.equal(ev.grade(g, run('x', [])).pass, false);
});

test('the cause grader passes the catch and fails clean or a wrong cause', () => {
    const g = byName('names-the-cause');
    const caught = 'inflight.js:11 — `o.group` is always set by markInflight (inflight.js:4), so the handoff condition clears the closing brain too.';
    assert.equal(ev.grade(g, run(caught)).pass, true);
    assert.equal(ev.grade(g, run('clean')).pass, false);
    assert.equal(ev.grade(g, run('inflight.js:9 — the comment has a typo.')).pass, false);
});
```

2. Run it and watch it fail: `node --test tests/eval-replay-guard-graders.test.js` — fails reading `meta` of `undefined`.

3. Write the graders.

In `evals/replay-guard-always-true/graders/dispatches-the-reviewer.md`:

```md
---
type: tool_used
tool: Agent
input_match: fankeel-reviewer
min: 1
---
The miss being replayed is the reviewer's; a session that reads the diff
itself has not tested it.
```

In `evals/replay-guard-always-true/graders/names-the-cause.md`:

```md
---
type: regex
target: last_message
pattern: (?=[\s\S]*inflight\.js:\d+)[\s\S]*(group[^\n]{0,160}(always|regardless|never (un)?set|every (mark|call|brain))|(always|regardless|every (mark|call|brain))[^\n]{0,160}group)
flags: i
match: contains
---
Revert 5e2e621d: markInflight gives every mark a group, so `o.group` never
spares the closing brain and the handoff condition clears its mark before the
gate is confirmed. A return that does not say the group is always set, at
inflight.js, has let the same miss through.
```

4. Run it and watch it pass: `node --test tests/eval-replay-guard-graders.test.js`.

5. Commit: `git add evals/replay-guard-always-true/graders tests/eval-replay-guard-graders.test.js` and commit `evals: graders for the revert 5e2e621d replay`.

## Task 3: Replay fixture — a test that asserts nothing fired

**Files:**
- Modify: `evals/replay-nothing-fired/case.yaml` — new; scaffold a two-commit repo
- Modify: `evals/replay-nothing-fired/prompt.md` — new; dispatch the reviewer
- Read: `lib/eval.js` — `parseCase`
- Read: `tests/tmp.js` — scratch dirs
- Test: `tests/eval-replay-nothing-fixture.test.js`

**Interfaces:**
- Consumes: `ev.parseCase(dir) -> { scaffold }` from `lib/eval.js`
- Produces: the case directory `evals/replay-nothing-fired/` with `test/menu.test.js:5` as the planted test, for Task 4

**Dispatch:** implementer, sonnet — the plan carries every file; transcription plus one test.

1. Write the failing test.

In `tests/eval-replay-nothing-fixture.test.js`:

```js
'use strict';

// Replays verify's eighth to eleventh returns of 2026-10-01: a test named for
// a branch that only asserts nothing fired, so it stays green when the branch
// is deleted. Proves the fixture for free.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const tmp = require('./tmp.js');
const ev = require('../lib/eval.js');

const CASE = path.join(__dirname, '..', 'evals', 'replay-nothing-fired');

test('the close test stays green when the close branch is deleted', () => {
    const c = ev.parseCase(CASE);
    const dir = tmp('fankeel-replay-nothing-');
    const r = spawnSync('bash', ['-c', c.scaffold], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const t = path.join(dir, 'test', 'menu.test.js');
    assert.equal(spawnSync(process.execPath, ['--test', t], { cwd: dir }).status, 0);
    const src = path.join(dir, 'src', 'menu.js');
    const lines = fs.readFileSync(src, 'utf8').split(/\r?\n/);
    assert.equal(lines[2].trim(), 'if (target.dataset.close) actions.close();');
    fs.writeFileSync(src, lines.filter((_, i) => i !== 2).join('\n'));
    assert.equal(spawnSync(process.execPath, ['--test', t], { cwd: dir }).status, 0);
    const log = spawnSync('git', ['log', '--oneline'], { cwd: dir, encoding: 'utf8' });
    assert.equal(log.stdout.trim().split('\n').length, 2);
});

test('the prompt dispatches the reviewer', () => {
    assert.match(ev.parseCase(CASE).prompt.body, /subagent_type fankeel:fankeel-reviewer/);
});
```

2. Run it and watch it fail: `node --test tests/eval-replay-nothing-fixture.test.js` — fails with `no prompt.md in`.

3. Write the case.

In `evals/replay-nothing-fired/case.yaml`:

```yaml
schema_version: "1.1"
name: replay-nothing-fired
context:
  scaffold_script: git init -q && mkdir -p src test && printf '%s\n' 'function onClick(target, actions) {' '  if (target.dataset.open) actions.open(target.dataset.open);' '  if (target.dataset.close) actions.close();' '}' 'module.exports = { onClick };' > src/menu.js && git add -A && git -c user.email=eval@fankeel -c user.name=eval commit -qm base && printf '%s\n' 'const test = require("node:test");' 'const assert = require("node:assert");' 'const { onClick } = require("../src/menu.js");' 'test("open branch opens", () => { const calls = []; onClick({dataset:{open:"a"}}, {open:(x) => calls.push(x), close:() => calls.push("close")}); assert.deepEqual(calls, ["a"]); });' 'test("close branch is covered", () => { const calls = []; onClick({dataset:{}}, {open:() => calls.push("open"), close:() => calls.push("close")}); assert.deepEqual(calls, []); });' > test/menu.test.js && git add -A && git -c user.email=eval@fankeel -c user.name=eval commit -m 'cover both click branches' -q
```

In `evals/replay-nothing-fired/prompt.md`:

```md
---
name: replay-nothing-fired
description: Replays verify's 8th-11th returns — the reviewer sees a branch test that only asserts nothing fired
tags: [reviewer, replay]
runs: 1
max_turns: 8
timeout_seconds: 300
---
Dispatch subagent_type fankeel:fankeel-reviewer with this brief, and give me its return verbatim: "Review git diff HEAD~1..HEAD in this repository against its commit message."
```

4. Run it and watch it pass: `node --test tests/eval-replay-nothing-fixture.test.js`.

5. Commit: `git add evals/replay-nothing-fired tests/eval-replay-nothing-fixture.test.js` and commit `evals: replay fixture for verify's nothing-fired returns`.

## Task 4: Replay graders — a test that asserts nothing fired, and the replay rule

**Files:**
- Modify: `evals/replay-nothing-fired/graders/dispatches-the-reviewer.md` — new
- Modify: `evals/replay-nothing-fired/graders/names-the-miss.md` — new
- Modify: `docs/90-agent/reference/evals.md` — twelve cases, `## Replay cases`
- Read: `lib/eval.js` — `parseCase`, `grade`
- Test: `tests/eval-replay-nothing-graders.test.js`

**Interfaces:**
- Consumes: `evals/replay-nothing-fired/` from Task 3 (`parseCase` needs its `prompt.md`); `ev.grade(g, run)` from `lib/eval.js`
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries every file; transcription plus one test.

1. Write the failing test.

In `tests/eval-replay-nothing-graders.test.js`:

```js
'use strict';

// The graders of the nothing-fired replay: a catch passes, a clean return and
// a wrong cause fail. Free; the paid run is scripts/eval.js, by hand.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ev = require('../lib/eval.js');

const CASE = path.join(__dirname, '..', 'evals', 'replay-nothing-fired');
const AGENT = { name: 'Agent', input: { subagent_type: 'fankeel:fankeel-reviewer', prompt: 'Review git diff HEAD~1..HEAD' } };
const run = (last, calls) => ({ calls: calls || [AGENT], last, texts: last });
const byName = (n) => ev.parseCase(CASE).graders.find((g) => g.name === n);

test('the reviewer must be dispatched', () => {
    const g = byName('dispatches-the-reviewer');
    assert.equal(ev.grade(g, run('x')).pass, true);
    assert.equal(ev.grade(g, run('x', [])).pass, false);
});

test('the miss grader passes the catch and fails clean or a wrong cause', () => {
    const g = byName('names-the-miss');
    const caught = 'test/menu.test.js:5 — the close test passes an empty dataset, so it never reaches the close branch; deleting src/menu.js:3 keeps it green.';
    assert.equal(ev.grade(g, run(caught)).pass, true);
    assert.equal(ev.grade(g, run('clean')).pass, false);
    assert.equal(ev.grade(g, run('test/menu.test.js:4 — prefer strictEqual.')).pass, false);
});
```

2. Run it and watch it fail: `node --test tests/eval-replay-nothing-graders.test.js` — fails reading `meta` of `undefined`.

3. Write the graders.

In `evals/replay-nothing-fired/graders/dispatches-the-reviewer.md`:

```md
---
type: tool_used
tool: Agent
input_match: fankeel-reviewer
min: 1
---
The miss being replayed is the reviewer's; a session that reads the diff
itself has not tested it.
```

In `evals/replay-nothing-fired/graders/names-the-miss.md`:

```md
---
type: regex
target: last_message
pattern: (?=[\s\S]*menu\.test\.js:\d+)[\s\S]*((green|pass(es)?)[^\n]{0,160}(delet|remov)|(delet|remov)[^\n]{0,160}(green|pass)|never (reach|call|exercise|hit)|(not|n't) (reach|exercise|cover|hit)|nothing (fired|happen|was called)|empty dataset)
flags: i
match: contains
---
Verify's eighth to eleventh returns of 2026-10-01: a test that asserts nothing
happened counted as covering its branch, though deleting the branch leaves it
green. A return that does not say so at menu.test.js has let the same miss
through.
```

4. Run it and watch it pass: `node --test tests/eval-replay-nothing-graders.test.js`.

5. In `docs/90-agent/reference/evals.md`, change `Ten cases in the layout` (line 9) to `Twelve cases in the layout`, and insert this section above `## Not run in CI`:

```md
## Replay cases

`replay-guard-always-true` and `replay-nothing-fired` are misses fankeel's own
review let through, rebuilt small: revert 5e2e621d, and verify's eighth to
eleventh returns of 2026-10-01
([the report](../reports/2026-10-01-verify-eleven-returns.md)). Run both before
and after a change to `agents/fankeel-reviewer.md`:

    node scripts/eval.js evals/replay-guard-always-true --model sonnet
    node scripts/eval.js evals/replay-nothing-fired --model sonnet

A change that turns either from pass to fail is not kept. Their fixtures and
graders are checked for free by the four `tests/eval-replay-*.test.js` files;
only the reviewer's answer costs a run.
```

6. Commit: `git add evals/replay-nothing-fired/graders tests/eval-replay-nothing-graders.test.js docs/90-agent/reference/evals.md` and commit `evals: graders for the nothing-fired replay; replay rule in evals.md`.

## Task 5: Delete the retired effort-variant leftovers

**Files:**
- Modify: `agents/fankeel-reviewer-high.md` — deleted, with `agents/fankeel-reviewer-xhigh.md` and the four brain and implementer variants
- Modify: `scripts/variants.js` — deleted

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — one `rm` of seven untracked files; nothing to brief.

1. Confirm all seven are untracked: `git ls-files agents/fankeel-brain-high.md agents/fankeel-brain-xhigh.md agents/fankeel-implementer-high.md agents/fankeel-implementer-xhigh.md agents/fankeel-reviewer-high.md agents/fankeel-reviewer-xhigh.md scripts/variants.js` prints nothing.
2. `rm agents/fankeel-brain-high.md agents/fankeel-brain-xhigh.md agents/fankeel-implementer-high.md agents/fankeel-implementer-xhigh.md agents/fankeel-reviewer-high.md agents/fankeel-reviewer-xhigh.md scripts/variants.js`
3. `git status --short agents scripts` lists none of them. Nothing to commit: they were never tracked.

## Coverage

| promise | task |
|---|---|
| `evals/replay-guard-always-true/` replays the miss behind revert 5e2e621d | Task 1 |
| The case dispatches `fankeel:fankeel-reviewer` over `git diff HEAD~1..HEAD` of a scaffolded two-commit repo | Task 1, Task 2 |
| `evals/replay-nothing-fired/` replays verify's eighth to eleventh returns | Task 3 |
| The case dispatches `fankeel:fankeel-reviewer` over the commit that adds the test | Task 3, Task 4 |
| `docs/90-agent/reference/evals.md` counts twelve cases and gains a `## Replay cases` section | Task 4 |
| The six untracked `agents/fankeel-{brain,implementer,reviewer}-{high,xhigh}.md` and the untracked `scripts/variants.js` are deleted | Task 5 |
| `node --test tests/eval-replay-guard.test.js tests/eval-replay-nothing.test.js` | struck — split into the four `tests/eval-replay-*.test.js` files of Tasks 1-4 to keep each task under FILE_CAP |
| `git status --short agents scripts` shows no `-high`/`-xhigh` file | Task 5 |
