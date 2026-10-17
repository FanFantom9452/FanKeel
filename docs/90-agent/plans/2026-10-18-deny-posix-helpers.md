---
status: design-intent
last_verified: 2026-10-18
---

# Deny and Posix Helpers Implementation Plan

**Goal:** Land all three parts of `docs/90-agent/todo/cuts-2.md`: one `deny(reason)` / `refuse(reason)` pair in `lib/hook.js` replacing the twelve hand-written PreToolUse deny objects, one `posix(p)` in `lib/tracked.js` replacing the twenty hand-written `split(path.sep).join('/')`, and the four smaller merges of part (3) — `within`, `addModels`, the station's form-and-registry lookup, `readObject` (the user put (3) in at the plan gate, 2026-10-18).
**Architecture:** Both are deletions behind a helper. `deny` returns the `hookSpecificOutput` object a deny has always been, `refuse` writes it to stdout the way every hook site did; `posix` is `lib/bench.js:40`'s one-liner, moved to `lib/tracked.js` (which already requires only `node:` modules, so no cycle) and imported where the copies were. The JSON a hook prints does not change, key order included, so the existing subprocess tests of each hook are the proof; each new helper gets one direct test.
**Tech Stack:** Node >=22.5 (`package.json` `engines`), CommonJS, `node --test`, no dependencies.
**Spec:** [../todo/cuts-2.md](../todo/cuts-2.md)

## Global Constraints

Generated from `node scripts/map.js` (969 markdown files, 3 planned not built, 319 retired, 22 undeclared; filing: `docs/90-agent/plans` is `plan`, `docs/90-agent/todo` is `todo`, index `docs/README.md`), `CONTRIBUTING.md` (no `CLAUDE.md` in this repository), `package.json` and the tests that pin behaviour.

- Runtime: `"engines": { "node": ">=22.5" }`, CommonJS with `'use strict';`, no dependency may be added (`package.json` has none).
- Indentation as the file already has it: 4 spaces in `lib/`, `scripts/` and `hooks/`; 2 spaces in `tests/hook.test.js` and `tests/tracked.test.js`.
- `CONTRIBUTING.md:15`: "Nothing in `lib/` reaches into `scripts/` or `hooks/`" — `lib/sensitive.js` may require `./hook.js` because both are in `lib/`. "Every exported name needs an importer" (`tests/source.test.js`): `deny` is imported by `lib/sensitive.js`, `refuse` by the hooks, `posix` by `lib/` and `scripts/`. This plan creates no file.
- Tests: `package.json` `"test": "node --test --require ./tests/subprocess-timeout.js"`. An implementer runs only its own test command, never the whole suite (`scripts/ledger.js` brief footer). Never two suites at once: two full suites on this machine exhaust the Windows commit limit (`VirtualAlloc failed`, `0xC0000409`, `0xC000012D`, README.md:260). `FANKEEL_BROWSER` matters only for the render tests, which no task here runs.
- No implementer commits; the build parent commits each group with `scripts/commit.js` and runs `scripts/suite.js --fast` before it.
- Every hook exits 0 on every path (`lib/hook.js:19-23`); nothing here adds a `throw` or a `process.exit`.
- The deny object keeps its key order — `hookEventName`, `permissionDecision`, `permissionDecisionReason` — and every reason string stays byte-for-byte as it is; only the wrapper moves.
- Not touched (other decisions, same files): `hooks/gate.js:158` (`allow`), `hooks/guard.js:190` (`verdict.decision`), `hooks/dispatch-gate.js:143` (`ask`), `lib/sensitive.js:197` and `:209` (`additionalContext`).
- Every line number in a task is the file as it stood when this plan was written, before any task ran. Adding a require line shifts what is below it by one, and an earlier task may already have done so (Task 2 before Task 5 in `lib/sensitive.js`). So in every task: make the replacements first and add the require line last, and find each line by the text quoted beside it, which is the authority over the number.
- Plan caps (`lib/plantasks.js`): FILE_CAP 3 `Modify:` entries per task, READ_CAP 1500 lines per file — `scripts/task.js` (1772 lines) is written as a range.
- Windows: Git Bash is available; use `/` in paths. No emojis.

## Risks

- A hook test compares the printed JSON as a string, so a changed key order would fail it — Task 1, Task 2 — `deny` builds the keys in the old order; the task runs the hook's own subprocess tests before and after.
- `lib/sensitive.js` is modified by Task 2 and Task 5 — they run one after another (the Files blocks share it) — Task 5 re-reads the require block Task 2 left.
- `lib/bench.js` exports `posix` and `scripts/bench.js:96,98,147` calls `bench.posix` — Task 3 — `lib/bench.js` keeps `posix` in its `module.exports`, now as the imported function, so `scripts/bench.js` is not touched.
- `lib/guard.js:72` is the tail of `relPath`, which the TODO entry says not to merge with `within`/`insidePlugin` — Task 4 — only the slash conversion on that one line changes; the rest of `relPath` stays.
- Part (3) touches files earlier tasks also modify (`lib/tracked.js` Task 3 and 8, `lib/shots.js` Task 5 and 8, `lib/bench.js` Task 3 and 11) — those pairs run one after another, and the line-number rule in Global Constraints covers the shift.
- `insidePlugin` is exported and tested by name (`tests/drive.test.js:11,239`) — Task 8 — it stays as a one-line wrapper over `within`, so that test is untouched.
- `lib/usage.js`'s `addModels` adds `m[k]` with no `|| 0`, where `lib/compare.js`'s added `m[k] || 0` — Task 9 — both callers in `lib/compare.js` pass maps that `lib/usage.js` itself built from `blank()`, so every field is present; the task keeps the `|| {}` the entry asks for at the call site.
- `readObject` returns null for an array or a scalar where `JSON.parse` returned it — Task 11 — a `bench.json` or a `.meta.json` that is not an object was already unusable at each of the three call sites (`conf.arms`, `.agentType`), so the refusal moves earlier and says the same thing.
- `lib/tracked.js` would be required by modules a hook loads (`lib/guard.js`, `lib/render.js`) — Task 4 — `lib/tracked.js:18-20` requires only `node:child_process`, `node:fs` and `node:path`, so there is no cycle and nothing runs at require time.

## Task 1: `deny` and `refuse` in `lib/hook.js`, used by `hooks/gate.js` and `hooks/guard.js`

**Files:**
- Modify: `lib/hook.js` — add `deny(reason)` and `refuse(reason)`, export both
- Modify: `hooks/gate.js` — five deny blocks (lines 248-255, 272-281, 307-315, 332-339, 355-362) become `refuse(...)`
- Modify: `hooks/guard.js` — five deny blocks (lines 87-96, 110-118, 133-135, 155-162, 182-189) become `refuse(...)`
- Test: `tests/hook.test.js`

**Interfaces:**
- Consumes: none
- Produces: `deny(reason: string): { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: string }` and `refuse(reason: string): void` (writes `JSON.stringify({ hookSpecificOutput: deny(reason) })` to stdout), both exported from `lib/hook.js`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] Step 1. In `tests/hook.test.js`, change the require line to `const { parse, run, deny, refuse } = require('../lib/hook.js');` and add at the end of the file:

```js
test('deny is the PreToolUse refusal, keys in the order the hooks always printed them', () => {
  const d = deny('fankeel: no');
  assert.deepEqual(Object.keys(d), ['hookEventName', 'permissionDecision', 'permissionDecisionReason']);
  assert.deepEqual(d, { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'fankeel: no' });
});

test('refuse writes the deny as the hook output, and nothing else', (t) => {
  const written = [];
  t.mock.method(process.stdout, 'write', (s) => { written.push(s); return true; });
  refuse('fankeel: no');
  t.mock.restoreAll();
  assert.deepEqual(written, [JSON.stringify({ hookSpecificOutput: deny('fankeel: no') })]);
});
```

- [ ] Step 2. Run `node --test tests/hook.test.js` and watch the two new tests fail with `deny is not a function`.
- [ ] Step 3. In `lib/hook.js`, replace `module.exports = { run, parse };` with:

```js
// The PreToolUse refusal, which twelve call sites wrote out by hand and which
// differed only in the reason. `deny` is the object, for a caller that hands it
// back (`lib/sensitive.js`); `refuse` prints it, for a hook about to return.
function deny(reason) {
    return { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason };
}

function refuse(reason) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: deny(reason) }));
}

module.exports = { run, parse, deny, refuse };
```

- [ ] Step 4. Run `node --test tests/hook.test.js` and watch it pass.
- [ ] Step 5. In `hooks/gate.js`, change line 53 to `const { run, parse, refuse } = require('../lib/hook.js');`, then replace each of the five blocks. Each block runs from `process.stdout.write(JSON.stringify({` to its `}));`; the `return;` after it stays. The replacements, in file order:

In `hooks/gate.js`, the block inside `if (owed) {`:

```js
            refuse('fankeel: this patrol\'s survey gate cannot go out — ' + owed.detail
                + '. Write ' + file + ' so every open entry has its line, then ask again.');
```

In `hooks/gate.js`, the block inside `if (gate.invalid) {`:

```js
        refuse('fankeel: the gate in ' + handoffPath(root, mine, mine.stage)
            + ' cannot be asked — `' + gate.invalid + '`: ' + gate.detail + '. SendMessage the stage agent to'
            + ' rewrite the gate block at the end of that file so `' + gate.invalid + '` holds (option one names'
            + ' the next stage, or a stage on this route to send the work back to), then ask again when it returns the path. Do not write the question yourself.');
```

In `hooks/gate.js`, the block inside `if (looksLikeAttempt) {`:

```js
            refuse('fankeel: this question does not match ' + file
                + '\'s `json gate` block word for word. Re-read the file and copy its `questions` array exactly'
                + ' — do not retype or summarize it — then ask again.');
```

In `hooks/gate.js`, the block inside `if (again) {`:

```js
            refuse('fankeel: already answered (' + again.stage + '): ' + again.question + ' -> ' + again.answer
                + '. The user settled this at the ' + again.stage + ' gate; act on that answer instead of asking again.');
```

In `hooks/gate.js`, the block after `&& answeredAt !== null && answeredAt > before.at) {`:

```js
        refuse('fankeel: this gate is unchanged since the user answered it (' + answer + '). SendMessage the stage agent to'
            + ' rewrite the gate in ' + file + ', taking out the options that answer settled, then ask again when it returns the path.');
```

- [ ] Step 6. In `hooks/guard.js`, change line 21 to `const { run, parse, refuse } = require('../lib/hook.js');`, then replace the five blocks the same way, in file order:

In `hooks/guard.js`, the block inside `if (payload.agent_id && readOnlyAgentType(payload.agent_type) && writesFiles(command)) {`:

```js
            refuse('fankeel: this is a subagent call (agent_id is set) with the '
                + 'read-only agent_type ' + payload.agent_type + ', and this command writes to disk. '
                + 'Redirect to /dev/null (or $null), or ask for a fankeel-verifier if the result needs '
                + 'to be written.');
```

In `hooks/guard.js`, the first block inside `if (controlled) {` (the shell one, before `emitCommit`):

```js
                refuse('fankeel: ' + mine.stage + ' is a controlled stage — this command '
                    + 'writes to disk, and its stage agent does the writing here, not the controller. '
                    + 'Dispatch it, relay a path, ask.');
```

In `hooks/guard.js`, the block inside `if (reason) {` under `payload.tool_name === 'Write'`:

```js
            refuse(reason);
```

In `hooks/guard.js`, the second block inside `if (controlled) {` (the edit one):

```js
            refuse('fankeel: ' + mine.stage + ' is a controlled stage — its stage '
                + 'agent does the writing here, not the controller. Dispatch it, relay a path, ask.');
```

In `hooks/guard.js`, the block after `const listed = ...`:

```js
        refuse('fankeel: `' + (mine.stage || 'no stage') + '` is not on stage.agents (' + listed
            + '), so no fankeel-brain runs it and its gate would never be substituted. Do the stage here, in this session.');
```

- [ ] Step 7. Run `grep -c "permissionDecision: 'deny'" hooks/gate.js hooks/guard.js` and see `0` for both; then run `node --test tests/hook.test.js tests/gate*.test.js tests/guard*.test.js tests/pane-gate.test.js` and watch it pass.

## Task 2: `hooks/budget.js` and `lib/sensitive.js` use `deny`

**Files:**
- Modify: `hooks/budget.js` — the deny block at lines 65-74 becomes `refuse(...)`
- Modify: `lib/sensitive.js` — the two deny objects in `commitVerdict` (lines 195, 205-211) become `deny(...)`
- Read: `lib/hook.js` — `deny` and `refuse` from Task 1

**Interfaces:**
- Consumes: `deny(reason)` and `refuse(reason)` from `lib/hook.js` (Task 1)
- Produces: none — `commitVerdict` returns the same objects as before

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] Step 1. Run `node --test tests/budget.test.js tests/context-budget.test.js tests/sensitive.test.js tests/sensitive-lens.test.js tests/guard.test.js` and note it passes before the change.
- [ ] Step 2. In `hooks/budget.js`, change line 22 to `const { run, parse, refuse } = require('../lib/hook.js');` and replace the block from `process.stdout.write(JSON.stringify({` to `}));` that sits before the `return;` above `if (payload.hook_event_name === 'PostToolUse') {` with:

```js
        refuse('fankeel: this subagent is at ' + info.used + ' tokens, over the '
            + HARD + '-token budget hooks/budget.js enforces. Write your progress to ' + relay
            + ' and return that path; every tool but a Write or Edit under .fankeel/build/ is '
            + 'refused until this agent ends.');
```

- [ ] Step 3. In `lib/sensitive.js`, after line 13 (`const { repoRoot } = require('./tracked.js');`) add `const { deny } = require('./hook.js');`. In `lib/sensitive.js`, replace line 195 with:

```js
        if (mode === 'block') return deny(why + ' sensitive.mode is block. Fix the file, or run `task.js profile set sensitive.mode warn` to be warned instead.');
```

In `lib/sensitive.js`, replace the `if (mode === 'block') { return { ... }; }` block (lines 205-211) with:

```js
    if (mode === 'block') {
        return deny(what + ' sensitive.mode is block. Take the words out, remove one from .fankeel/sensitive.txt, or run `task.js profile set sensitive.mode warn` to be warned instead.');
    }
```

- [ ] Step 4. Run `grep -rn "permissionDecision: 'deny'" hooks lib scripts` and see only the line in `lib/hook.js`; run the Step 1 command again and watch it pass.

## Task 3: `posix` in `lib/tracked.js`, used by `lib/bench.js` and `lib/launchers.js`

**Files:**
- Modify: `lib/tracked.js` — add `posix(p)`, export it
- Modify: `lib/bench.js` — line 40 imports `posix` instead of defining it
- Modify: `lib/launchers.js` — line 23
- Test: `tests/tracked.test.js`

**Interfaces:**
- Consumes: none
- Produces: `posix(p: unknown): string` exported from `lib/tracked.js` — `String(p)` with every `path.sep` replaced by `/`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] Step 1. In `tests/tracked.test.js`, at the end of the file (`path` and `tracked` are already declared at the top), add:

```js
test('posix turns this platform\'s separator into a forward slash, and leaves one alone', () => {
  assert.equal(tracked.posix(['a', 'b', 'c.js'].join(path.sep)), 'a/b/c.js');
  assert.equal(tracked.posix('a/b'), 'a/b');
  assert.equal(tracked.posix(''), '');
});
```

- [ ] Step 2. Run `node --test tests/tracked.test.js` and watch the new test fail with `tracked.posix is not a function`.
- [ ] Step 3. In `lib/tracked.js`, directly above `module.exports`, add:

```js
// This platform's separator as a forward slash: what every path that reaches a
// report, a claim or a shell script is written in. Twenty copies of the one-liner
// lived across lib/ and scripts/ before it lived here.
const posix = (p) => String(p).split(path.sep).join('/');
```

and change the export line to `module.exports = { trackedFiles, isRepo, repoRoot, posix, parseStaged, flatten, SKIP_EXT, MAX_WALK_FILES };`.
- [ ] Step 4. In `lib/bench.js`, replace line 40 (`const posix = (p) => String(p).split(path.sep).join('/');`) with:

```js
const { posix } = require('./tracked.js');
```

`posix` stays in the `module.exports` of `lib/bench.js`; scripts/bench.js keeps calling `bench.posix` and is not touched.
- [ ] Step 5. In `lib/launchers.js`, after line 16 (`const path = require('node:path');`) add `const { posix } = require('./tracked.js');` and replace line 23 with:

```js
    const slashed = posix(script);
```

- [ ] Step 6. Run `node --test tests/tracked.test.js tests/bench.test.js tests/station-launchers.test.js` and watch it pass.

## Task 4: `posix` in `lib/guard.js`, `lib/profile.js` and `lib/render.js`

**Files:**
- Modify: `lib/guard.js:19-72` — the require block and line 72
- Modify: `lib/profile.js:8-433` — the require block and line 433
- Modify: `lib/render.js:16-220` — the require block and lines 163 and 220
- Read: `lib/tracked.js` — `posix` from Task 3

**Interfaces:**
- Consumes: `posix(p)` from `lib/tracked.js` (Task 3)
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] Step 1. Run `node --test tests/guard.test.js tests/profile.test.js tests/profile-project.test.js tests/render.test.js` and note it passes before the change.
- [ ] Step 2. In `lib/guard.js`, after line 22 (`const { execFileSync } = require('node:child_process');`) add `const { posix } = require('./tracked.js');`, and in `relPath` replace `return rel.split(path.sep).join('/');` with:

```js
    return posix(rel);
```

- [ ] Step 3. In `lib/profile.js`, after line 12 (`const agentfile = require('./agentfile.js');`) add `const { posix } = require('./tracked.js');`, and replace line 433 with:

```js
        const rel = posix(path.relative(registryRoot, projectRoot));
```

- [ ] Step 4. In `lib/render.js`, after line 27 (`const { sessionDirOf } = require('./usage.js');`) add `const { posix } = require('./tracked.js');`. In `lib/render.js`, replace line 163 with:

```js
    if (file) subs.designHandoff = posix(path.relative(root, file));
```

In `lib/render.js`, replace line 220 with:

```js
    const r = posix(path.relative(root, p));
```

- [ ] Step 5. Run `grep -n "split(path.sep).join" lib/guard.js lib/profile.js lib/render.js` and see nothing; run the Step 1 command again and watch it pass.

## Task 5: `posix` in `lib/sensitive.js`, `lib/shots.js` and `lib/station.js`

**Files:**
- Modify: `lib/sensitive.js` — line 118
- Modify: `lib/shots.js` — lines 158 and 167
- Modify: `lib/station.js` — lines 579, 587 and 643
- Read: `lib/tracked.js` — `posix` from Task 3

**Interfaces:**
- Consumes: `posix(p)` from `lib/tracked.js` (Task 3)
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] Step 1. Run `node --test tests/sensitive.test.js tests/shots.test.js tests/station.test.js tests/station-todo-files.test.js tests/station-build-dirs.test.js` and note it passes before the change.
- [ ] Step 2. In `lib/sensitive.js`, change line 13 to `const { repoRoot, posix } = require('./tracked.js');` and replace line 118 with:

```js
    const rel = (base, t) => posix(path.relative(top, path.resolve(base, t)));
```

- [ ] Step 3. In `lib/shots.js`, change line 26 to `const { repoRoot, posix } = require('./tracked.js');`. In `lib/shots.js`, replace line 158 with:

```js
        const rel = posix(path.relative(found.dir, path.resolve(file)));
```

In `lib/shots.js`, replace line 167 with:

```js
        const at = posix(path.relative(stop, dir));
```

- [ ] Step 4. In `lib/station.js`, after line 19 (`const { readObject } = require('./json.js');`) add `const { posix } = require('./tracked.js');`; in `lib/station.js` replace lines 579 and 587, which are identical, each with:

```js
            const rel = dir === root ? '' : posix(path.relative(root, dir));
```

In `lib/station.js`, replace line 643 with:

```js
            const rel = posix(path.relative(r.root, dir));
```

- [ ] Step 5. Run `grep -n "split(path.sep).join" lib/sensitive.js lib/shots.js lib/station.js` and see nothing; run the Step 1 command again and watch it pass.

## Task 6: `posix` in `scripts/judge.js`, `scripts/ledger.js` and `scripts/skills-check.js`

**Files:**
- Modify: `scripts/judge.js` — line 122
- Modify: `scripts/ledger.js` — line 529
- Modify: `scripts/skills-check.js` — line 131
- Read: `lib/tracked.js` — `posix` from Task 3

**Interfaces:**
- Consumes: `posix(p)` from `lib/tracked.js` (Task 3)
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] Step 1. Run `node --test tests/judge.test.js tests/ledger.test.js tests/skills.test.js` and note it passes before the change.
- [ ] Step 2. In `scripts/judge.js`, after line 13 (`const docs = require('../lib/docs.js');`) add `const { posix } = require('../lib/tracked.js');` and replace line 122 with:

```js
    const rel = posix(path.relative(path.dirname(indexFile), file));
```

- [ ] Step 3. In `scripts/ledger.js`, after line 39 (the line that requires lib/shots.js) add `const { posix } = require('../lib/tracked.js');` and replace line 529 with:

```js
    return ' — render: ' + posix(path.relative(root, path.resolve(render)));
```

- [ ] Step 4. In `scripts/skills-check.js`, after line 21 (`const { resolveRoot } = require('../lib/registry.js');`) add `const { posix } = require('../lib/tracked.js');` and replace line 131 with:

```js
        const rel = posix(path.relative(root, file));
```

- [ ] Step 5. Run `grep -n "split(path.sep).join" scripts/judge.js scripts/ledger.js scripts/skills-check.js` and see nothing; run the Step 1 command again and watch it pass.

## Task 7: `posix` in `scripts/task.js`

**Files:**
- Modify: `scripts/task.js:21-1272` — the require block and lines 573, 829, 1016, 1192, 1272
- Read: `lib/tracked.js` — `posix` from Task 3

**Interfaces:**
- Consumes: `posix(p)` from `lib/tracked.js` (Task 3)
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] Step 1. Run `node --test tests/task.test.js tests/task-todo.test.js tests/task-worktree.test.js tests/task-onboard.test.js tests/task-control.test.js` and note it passes before the change.
- [ ] Step 2. In `scripts/task.js`, after line 23 (`const { readObject } = require('../lib/json.js');`) add `const { posix } = require('../lib/tracked.js');`. Every line number below is then one higher; each line is named by its text, which is the authority.
- [ ] Step 3. In `scripts/task.js`, replace `const where = projectRoot.split(path.sep).join('/');` with:

```js
    const where = posix(projectRoot);
```

- [ ] Step 4. In `scripts/task.js`, replace `return ['hands — ' + path.relative(projectRoot, plan).split(path.sep).join('/') + ':']` with:

```js
    return ['hands — ' + posix(path.relative(projectRoot, plan)) + ':']
```

- [ ] Step 5. In `scripts/task.js`, in the `design.md is missing` line, replace `path.relative(root, shape).split(path.sep).join('/')` with `posix(path.relative(root, shape))`; the result is:

```js
        line += NL + 'design.md is missing — Write the approved file table to ' + posix(path.relative(root, shape))
```

followed by the rest of that line exactly as it was.
- [ ] Step 6. In `scripts/task.js`, replace `return { worktree: { path: path.relative(root, path.join(repo, rel)).split(path.sep).join('/'), branch } };` with:

```js
    return { worktree: { path: posix(path.relative(root, path.join(repo, rel))), branch } };
```

- [ ] Step 7. In `scripts/task.js`, in the `profile set` line, replace `path.relative(process.cwd(), __filename).split(path.sep).join('/')` with `posix(path.relative(process.cwd(), __filename))`; the result is:

```js
        for (const k of keys) lines.push('node ' + posix(path.relative(process.cwd(), __filename)) + ' profile set ' + k + ' ' + profile.shellWord(values[k]) + (opts.project ? ' --project ' + opts.project : ''));
```

- [ ] Step 8. Run `grep -rn "split(path.sep).join" lib scripts hooks` and see only `lib/tracked.js`; run the Step 1 command again and watch it pass.

## Task 8: `within` in `lib/tracked.js`, used by `lib/shots.js` and `scripts/drive.js`

**Files:**
- Modify: `lib/tracked.js` — add `within(stop, dir)` beside `posix`, export it
- Modify: `lib/shots.js` — delete its `within` (lines 127-131), import the shared one
- Modify: `scripts/drive.js` — `insidePlugin` (lines 85-88) becomes a wrapper over `within`
- Test: `tests/tracked.test.js`

**Interfaces:**
- Consumes: `posix` already in `lib/tracked.js` (Task 3) — only as the neighbour to add beside
- Produces: `within(stop: string, dir: string): boolean` exported from `lib/tracked.js` — true when `dir` is `stop` or under it, both resolved by `path.relative`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] Step 1. In `tests/tracked.test.js`, at the end of the file, add:

```js
test('within is the directory itself or below it, never a sibling or above', () => {
  const root = path.resolve('fankeel-within-root');
  assert.equal(tracked.within(root, root), true);
  assert.equal(tracked.within(root, path.join(root, 'a', 'b')), true);
  assert.equal(tracked.within(root, path.dirname(root)), false);
  assert.equal(tracked.within(root, root + '-sibling'), false);
  assert.equal(tracked.within(root, path.join(root, '..', 'elsewhere')), false);
});
```

- [ ] Step 2. Run `node --test tests/tracked.test.js` and watch the new test fail with `tracked.within is not a function`.
- [ ] Step 3. In `lib/tracked.js`, directly below the `posix` line Task 3 added, add:

```js
// Whether `dir` is `stop` or under it. `path.relative` resolves both, so a
// relative argument is read against the working directory.
function within(stop, dir) {
    const rel = path.relative(stop, dir);
    return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel));
}
```

and add `within` to `module.exports` after `posix`.
- [ ] Step 4. Run `node --test tests/tracked.test.js` and watch it pass.
- [ ] Step 5. In `lib/shots.js`, delete the one-line comment that starts `// Whether` and the `function within(stop, dir) { ... }` below it (lines 127-131), then change line 26 to:

```js
const { repoRoot, posix, within } = require('./tracked.js');
```

- [ ] Step 6. In `scripts/drive.js`, replace the four lines of `function insidePlugin(root, plugin) { ... }` with:

```js
const insidePlugin = (root, plugin) => within(plugin, root);
```

and, in `scripts/drive.js` after line 21 (the line that requires ./eval.js), add:

```js
const { within } = require('../lib/tracked.js');
```

- [ ] Step 7. Run `node --test tests/tracked.test.js tests/shots.test.js tests/drive.test.js tests/ledger.test.js` and watch it pass.

## Task 9: `lib/compare.js` uses the `addModels` of `lib/usage.js`

**Files:**
- Modify: `lib/usage.js` — export `addModels`
- Modify: `lib/compare.js` — delete its `addModels` (lines 67-72) and `FIELDS` (line 17), call `usage.addModels` with `|| {}`
- Test: `tests/usage.test.js`

**Interfaces:**
- Consumes: none
- Produces: `addModels(into: object, from: object): void` exported from `lib/usage.js`, unchanged in behaviour — folds a per-model token map into another in place.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] Step 1. In `tests/usage.test.js`, at the end of the file, add:

```js
test('addModels folds one model map into another, in place', () => {
    const into = { m: { input: 1, output: 2, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } };
    usage.addModels(into, {
        m: { input: 10, output: 20, cacheRead: 1, cacheWrite5m: 2, cacheWrite1h: 3 },
        n: { input: 5, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 },
    });
    assert.deepEqual(into, {
        m: { input: 11, output: 22, cacheRead: 1, cacheWrite5m: 2, cacheWrite1h: 3 },
        n: { input: 5, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 },
    });
});
```

- [ ] Step 2. Run `node --test tests/usage.test.js` and watch the new test fail with `usage.addModels is not a function`.
- [ ] Step 3. In `lib/usage.js`, change the first line inside `module.exports = {` to:

```js
    summarise, agentsOf, summariseTree, spanOf, agentFiles, sessionDirOf, addModels,
```

- [ ] Step 4. Run `node --test tests/usage.test.js` and watch it pass.
- [ ] Step 5. Run `grep -n FIELDS lib/compare.js` and see it used only on lines 17 and 70. In `lib/compare.js`, delete `function addModels(into, models) { ... }` (the six lines starting at line 67) and the `const FIELDS = [...]` line (line 17). Then in `lib/compare.js`, in `sessionOf`, replace the two `addModels(...)` calls with:

```js
    usage.addModels(models, (own && own.usage.models) || {});
    usage.addModels(models, (agents && agents.models) || {});
```

- [ ] Step 6. Run `node --test tests/usage.test.js tests/usage-compare.test.js tests/station-compare.test.js` and watch it pass.

## Task 10: the station's four registry routes share one lookup

**Files:**
- Modify: `scripts/station.js:431-600` — add `formAndRegistry` below `formOf`; `/clear`, `/clear-stale`, `/todo` and `/answer` use it

**Interfaces:**
- Consumes: none
- Produces: none outside `scripts/station.js` — `formAndRegistry` is a closure inside the request handler, like `formOf`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

No test is written: the station-post, station-todo and station-answer test files already drive each route, its 404 and its nonce refusal through a served station.

- [ ] Step 1. Run `node --test tests/station-post.test.js tests/station-todo.test.js tests/station-answer.test.js tests/station-serve.test.js` and note it passes before the change.
- [ ] Step 2. In `scripts/station.js`, directly after the closing `};` of `const formOf = async () => {`, add:

```js
        // The routes that act on one registry of the page read the form and find
        // that registry the same way. Null when the nonce refused it, which has
        // already answered; `reg` is undefined when no registry matched, and
        // each route says that in its own 404.
        const formAndRegistry = async () => {
            const form = await formOf();
            if (!form) return null;
            const reg = modelNow().registries.find((r) => r.root === path.resolve(form.get('root') || ''));
            return { form, reg };
        };
```

- [ ] Step 3. In `scripts/station.js`, in the `/clear` route, replace everything from `const form = await formOf();` through `const reg = model.registries.find((r) => r.root === path.resolve(root));` — the `root`, `id`, two comment and `model` lines between them included — with:

```js
            const got = await formAndRegistry();
            if (!got) return;
            const { form, reg } = got;
            const id = form.get('id') || '';
            // The server has just measured liveness for the page; a row that is
            // live is not one the button is for, whatever the age rule says.
```

- [ ] Step 4. In `scripts/station.js`, in each of the `/clear-stale`, `/todo` and `/answer` routes, replace the four lines from `const form = await formOf();` through `const reg = model.registries.find((r) => r.root === path.resolve(form.get('root') || ''));` with:

```js
            const got = await formAndRegistry();
            if (!got) return;
            const { form, reg } = got;
```

- [ ] Step 5. Run `grep -n "model.registries.find" scripts/station.js` and see none of the four routes; the `/profile` route's `model.registries.some` stays. Run the Step 1 command again and watch it pass.

## Task 11: `readObject` in `scripts/bench.js`, `lib/bench.js` and `lib/drift.js`

**Files:**
- Modify: `scripts/bench.js` — the require block and `conf` in `cmdRun` (lines 304-310)
- Modify: `lib/bench.js` — the require block and `agentTypeOf` (lines 268-274)
- Modify: `lib/drift.js` — the require block and the meta read in the implementer search (lines 182-186)
- Read: `lib/json.js` — `readObject(file)`, null for absent, unreadable, unparsable or non-object

**Interfaces:**
- Consumes: `readObject(file)` from `lib/json.js` (already exported)
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] Step 1. Run `node --test tests/bench.test.js tests/bench-projects.test.js tests/drift.test.js` and note it passes before the change.
- [ ] Step 2. In `scripts/bench.js`, in `cmdRun`, replace `let conf;` and the `try { conf = JSON.parse(...) } catch (e) { ... }` block after it with:

```js
    const conf = readObject(path.join(project, 'bench.json'));
    if (!conf) {
        console.error('bench.js: no bench.json under ' + project);
        return 1;
    }
```

and, in `scripts/bench.js` after line 27 (the line that requires ./eval.js), add:

```js
const { readObject } = require('../lib/json.js');
```

- [ ] Step 3. In `lib/bench.js`, replace `function agentTypeOf(file) { ... }` with:

```js
function agentTypeOf(file) {
    const meta = readObject(file.replace(/\.jsonl$/, '.meta.json'));
    return (meta && baseAgent(meta.agentType)) || 'unknown';
}
```

and, in `lib/bench.js` after the line that requires ./agentfile.js, add:

```js
const { readObject } = require('./json.js');
```

- [ ] Step 4. In `lib/drift.js`, inside the `for (const file of usage.agentFiles(...))` loop, replace the `try { ... } catch (e) { ... }` block with:

```js
        // An agent with no readable meta.json is not the one asked for.
        const meta = readObject(file.replace(/\.jsonl$/, '.meta.json'));
        if (meta && baseAgent(meta.agentType) === 'fankeel-implementer') return file;
```

and, in `lib/drift.js` after line 15 (the line that requires ./spend.js), add:

```js
const { readObject } = require('./json.js');
```

- [ ] Step 5. Run `grep -n "JSON.parse(fs.readFileSync" scripts/bench.js lib/bench.js lib/drift.js` and see only the `role.json` read in `scripts/bench.js` (about line 168), which the entry rejects converting and which stays; run the Step 1 command again and watch it pass.

## Coverage

| promise | task |
|---|---|
| (1) hooks/gate.js:248、272、307、332、355 與 hooks/guard.js:87、110、133、155、182 各手寫一次 PreToolUse 的 deny 回應 | Task 1 |
| hooks/budget.js:68 與 lib/sensitive.js:208 同形也改用 | Task 2 |
| (2) split(path.sep).join('/') 在 lib、scripts 約二十處，lib/bench.js:40 已有 posix，搬到共用模組後改用 | Tasks 3-7 |
| (3) 次要、各 3 到 18 行：lib/shots.js:128 within 與 scripts/drive.js:85 insidePlugin 合併（lib/guard.js:71 relPath 行為不同，不併） | Task 8 |
| lib/compare.js:67 addModels 改用 lib/usage.js:54 的（要 export 並在呼叫端補 models || {}） | Task 9 |
| scripts/station.js:524 四條路由共用 formOf 加 registry 查找（404 訊息各自保留） | Task 10 |
| scripts/bench.js:306、lib/bench.js:270、lib/drift.js:183 改用 lib/json.js 的 readObject | Task 11 |
| 已駁回、不要做：兩個 median、readObject 兩處、registry.sleepMs | struck — rejected by the entry itself; no task touches them |
| 完成條件：(1)(2) 改完，npm test 全綠，git diff 淨減行數，並在完成紀錄寫實際減了幾行 | Tasks 1-11, then verify runs the suite and `git diff --shortstat`; land writes the count into `todo.js done` |
