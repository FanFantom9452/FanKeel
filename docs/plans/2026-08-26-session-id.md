---
status: design-intent
last_verified: 2026-08-26
source_of_truth: lib/live.js, scripts/task.js, hooks/inject.js
---

# The id nobody could check — implementation plan

**Goal:** make an entry written under an id no hook will ever read impossible to
create, and make the right id something a hook says rather than something anyone
reads off a path.

**Architecture:** two changes, both upstream of the five hooks. `scripts/task.js`
checks `--session` against Claude Code's own live-session registry and refuses an
id no running process claims. `hooks/inject.js` answers a `/fankeel` prompt with
one line naming `payload.session_id` — the id the hook itself is holding. The
five hooks that go silent on a miss are deliberately not touched.

**Tech Stack:** Node built-ins only, `node --test`, no dependencies.

**Spec:** [2026-08-26-session-id-design.md](2026-08-26-session-id-design.md)

## Global Constraints

Taken from `package.json`, `.fankeel/map.md`, and the suite. Every task's
requirements implicitly include this section.

- **No dependencies.** `package.json` has no `dependencies` and no
  `devDependencies`, and is `"private": true`. Every module here requires only
  Node built-ins, in the `require('node:fs')` prefixed form.
- **`npm test` is `node --test`.** The baseline on this branch is **620 pass, 0
  fail**. No task may land with a lower pass count or any failure.
- **`'use strict';`** is the first statement of every module in `lib/`, `hooks/`
  and `scripts/`.
- **Indentation: 4 spaces** in `lib/`, `hooks/` and `scripts/`; **2 spaces** in
  `tests/`. Match the file you are editing.
- **Hooks exit 0 on every path**, and a session not in the mode must cost
  nothing — no directories created, no flags written, no output.
- **A measurement that could not be made must not become a refusal.**
  `lib/live.js` returns `null` from `runningIds` when the directory cannot be
  read, and `isLive` turns that into "live". Any new check keeps the same rule.
- **Registry invariants** (`skills/fankeel/SKILL.md`, "Invariants"): never write
  another session's file, never set `active: false` unasked, never edit
  `updated` or `claims` by hand, never delete a session file.
- **`TODO.md` entries are one line, at most 200 characters**
  (`scripts/todo-check.js:28`, `MAX_ENTRY_CHARS`), and must link to a file that
  exists.
- **The version is `0.30.0` in ten places** — `package.json:3`,
  `.claude-plugin/plugin.json:3`, and `version:` in each of the eight
  `skills/*/SKILL.md`. The bump is not part of any task here; it happens once at
  `land`, together with setting this plan and its spec to `status: current`.
- **`docs/plans/` is role `plan`** in `.fankeel/docs.json`. Both files stay
  `status: design-intent` until the work lands.

## File structure

| file | responsibility after this change |
|---|---|
| `lib/live.js` | Adds `runningSessions(configDir)` — the rows behind the ids, so a caller that needs to *name* the running sessions does not read the directory a second time. `runningIds` is rebuilt on it and keeps its exact contract. |
| `scripts/task.js` | `requireSession` gains the check. One chokepoint, every subcommand. |
| `hooks/inject.js` | The not-in-the-mode branch gains one line of output on a `/fankeel` prompt. |
| `tests/live.test.js` | `runningSessions` behaviour. |
| `tests/task.test.js` | The harness gains `CLAUDE_CONFIG_DIR`; three existing tests are repaired; two new tests. |
| `tests/route.test.js` | The harness gains `CLAUDE_CONFIG_DIR`. |
| `tests/inject.test.js` | One existing assertion changes; two new tests. |
| `skills/fankeel/SKILL.md`, `docs/registry.md`, `TODO.md` | The sentence each is missing. |

---

## Task 1: `lib/live.js` — the rows behind the ids

**Files:**
- Modify: `lib/live.js` (the `runningIds` function, currently at line 76)
- Test: `tests/live.test.js`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `runningSessions(configDir)` → `Array<{sessionId: string, cwd: string}>`,
  or `null` when the directory cannot be read. `runningIds(configDir)` →
  `Set<string>` or `null`, unchanged in behaviour.

- [ ] **Step 1: Write the failing test**

Append to `tests/live.test.js`. It already has everything these need:
`tmpConfig()` (line 20) makes a config directory with `sessions/` inside;
`seed(configDir, pid, sessionId)` (line 27) writes an entry the way Claude Code
does, with a fixed `cwd`; `seedRaw(configDir, name, text)` (line 42) writes an
arbitrary one; `SID` and `OTHER` are session ids and `GONE_PID` (line 18) is a
pid no operating system hands out. **Do not add a `spawnSync` import** — the
comment above `GONE_PID` says why this file deliberately does not spawn.

```js
// The refusal in `task.js` has to name the sessions that are running, not only
// count them: an id on its own is not something anyone can recognise, and the
// directory each was opened in is what makes the list readable.
test('runningSessions carries the cwd beside the id', () => {
  const dir = tmpConfig();
  seedRaw(dir, process.pid + '.json',
    JSON.stringify({ pid: process.pid, sessionId: SID, cwd: '/somewhere/else' }));

  const rows = live.runningSessions(dir);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sessionId, SID);
  assert.equal(rows[0].cwd, '/somewhere/else');
});

// The same rule the whole module keeps: a directory that cannot be read is not
// an empty machine, and the two must not answer the same.
test('runningSessions is null when the directory cannot be read', () => {
  assert.equal(live.runningSessions(path.join(os.tmpdir(), 'fankeel-no-such-dir-x')), null);
});

// `runningIds` is what every existing caller reads. Rebuilding it on the rows
// must not change what it answers, the dead-pid filter included.
test('runningIds still drops a session whose process is gone', () => {
  const dir = tmpConfig();
  seed(dir, process.pid, SID);
  seed(dir, GONE_PID, OTHER);

  const ids = live.runningIds(dir);
  assert.equal(ids.has(SID), true);
  assert.equal(ids.has(OTHER), false);
});
```

- [ ] **Step 2: Run it and watch it fail**

```
node --test tests/live.test.js
```

Expected: the first two fail with `live.runningSessions is not a function`. The
third passes already — it is the regression guard, and it must pass both before
and after.

- [ ] **Step 3: Write the implementation**

In `lib/live.js`, replace the whole body of `runningIds` with the two functions
below. Keep the long comment block that currently sits above `runningIds`
exactly where it is — it explains the self-check and the `.key` files, and both
still apply. Put `runningSessions` immediately after that comment and
`runningIds` immediately after `runningSessions`.

```js
function runningSessions(configDir) {
    const dir = path.join(String(configDir == null ? '' : configDir), 'sessions');
    let names;
    try {
        names = fs.readdirSync(dir);
    } catch (e) {
        return null;
    }
    const out = [];
    for (const name of names) {
        if (!name.endsWith('.json')) continue;
        let data;
        try {
            data = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
        } catch (e) {
            continue;
        }
        if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
        if (typeof data.sessionId !== 'string' || !data.sessionId) continue;
        if (!running(data.pid)) continue;
        out.push({ sessionId: data.sessionId, cwd: typeof data.cwd === 'string' ? data.cwd : '' });
    }
    return out;
}

// The set every liveness answer is taken from. Kept as its own function because
// that is what four callers want, and because `null` here has to keep meaning
// exactly what it meant before: the directory could not be read, which is not
// the same as a machine running nothing.
function runningIds(configDir) {
    const rows = runningSessions(configDir);
    if (!rows) return null;
    const ids = new Set();
    for (const row of rows) ids.add(row.sessionId);
    return ids;
}
```

Then change the export line at the bottom of the file from:

```js
module.exports = { liveConfigDir, runningIds, readLive, isLive };
```

to:

```js
module.exports = { liveConfigDir, runningSessions, runningIds, readLive, isLive };
```

- [ ] **Step 4: Run the tests and watch them pass**

```
node --test tests/live.test.js
node --test
```

Expected: `tests/live.test.js` green; the whole suite still 620 pass plus the
three added here, 0 fail.

- [ ] **Step 5: Commit**

```
git add lib/live.js tests/live.test.js
git commit -m "feat: the rows behind the running ids, so a refusal can name them"
```

---

## Task 2: `scripts/task.js` — refuse an id nobody is running

**Files:**
- Modify: `scripts/task.js` (`requireSession`, currently at line 153)
- Modify: `tests/task.test.js` (the `run` helper at line 29; the tests at lines
  164, 374 and 537; two new tests)
- Modify: `tests/route.test.js` (the `run` helper at line 25)

**Interfaces:**
- Consumes: `live.runningSessions(configDir)` from Task 1 — an array of
  `{sessionId, cwd}` or `null`. `live` is already required at
  `scripts/task.js:25`; no new import.
- Produces: nothing later tasks depend on.

**Why the test harnesses change first.** `tests/task.test.js` and
`tests/route.test.js` pass `--claude-dir` but not `CLAUDE_CONFIG_DIR`. The badge
follows the flag; liveness follows the variable. So without this, the new check
would measure every test's made-up session id against the **real**
`~/.claude/sessions/` on whatever machine runs the suite, and refuse all of
them. Setting the variable to the same temp directory makes those runs hermetic
and makes `runningSessions` return `null` there, which allows.

- [ ] **Step 1: Make the harnesses hermetic**

In `tests/task.test.js`, the `run` helper currently reads:

```js
      out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', dir, '--claude-dir', cfg],
        { encoding: 'utf8', env: env ? Object.assign({}, process.env, env) : process.env }),
```

Replace the `env:` value so the default is the same temp directory and a caller
that passes its own still wins:

```js
      out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', dir, '--claude-dir', cfg],
        { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }, env || {}) }),
```

In `tests/route.test.js`, the `run` helper currently reads:

```js
      out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', dir, '--claude-dir', cfg], { encoding: 'utf8' }),
```

Replace it with:

```js
      out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', dir, '--claude-dir', cfg],
        { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) }),
```

In `tests/task.test.js`, the test `without --root the registry is found the way
the hooks find it` calls `execFileSync` directly, twice, bypassing the helper.
Both calls need the same treatment. The first currently reads:

```js
  execFileSync(process.execPath, [SCRIPT, 'start', '--session', A, '--task', 'x',
    '--project', 'Waypoint', '--claude-dir', path.join(dir, 'cfg')], {
    encoding: 'utf8', cwd: dir,
  });
```

Replace with:

```js
  execFileSync(process.execPath, [SCRIPT, 'start', '--session', A, '--task', 'x',
    '--project', 'Waypoint', '--claude-dir', path.join(dir, 'cfg')], {
    encoding: 'utf8', cwd: dir,
    env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: path.join(dir, 'cfg') }),
  });
```

The second currently reads:

```js
  const out = execFileSync(process.execPath, [SCRIPT, 'show', '--session', A], { encoding: 'utf8', cwd: inner });
```

Replace with:

```js
  const out = execFileSync(process.execPath, [SCRIPT, 'show', '--session', A],
    { encoding: 'utf8', cwd: inner,
      env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: path.join(dir, 'cfg') }) });
```

- [ ] **Step 2: Run the suite and confirm it is still green**

```
node --test
```

Expected: 623 pass (620 plus Task 1's three), 0 fail. This step changes no
behaviour — it only stops the tests reading the machine's real config directory.
If anything fails here, it is a pre-existing dependence on that directory and
must be understood before going on.

- [ ] **Step 3: Write the failing tests**

Append to `tests/task.test.js`:

```js
// The failure this exists for: a background task's output directory carried a
// second session id, in the same shape as the real one, and it went into every
// task.js call for two hours while the hooks read the other one. Nothing said
// so — an entry under an id no hook reads looks exactly like no entry at all.
test('an id no running session claims is refused, and the running ones are named', () => {
  const dir = root();
  const cfg = path.join(dir, 'cfg');
  fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'),
    JSON.stringify({ pid: process.pid, sessionId: B, cwd: '/somewhere/else' }));

  const { out, code } = run(dir, ['start', '--session', A, '--task', 'x']);
  assert.equal(code, 1);
  assert.match(out, /No running Claude Code session/);
  assert.match(out, new RegExp(B), 'the refusal has to name the ids that are running');
  assert.match(out, /\/somewhere\/else/, 'an id alone is not something anyone can recognise');
  assert.equal(entry(dir, A), null, 'refused, and nothing written');
});

// The other half of the same rule, and the one that keeps this from becoming a
// lockout: `runningSessions` answers null when it cannot read the directory, and
// a refusal must never come from a failed measurement.
test('a config directory that cannot be read is not a refusal', () => {
  const dir = root();
  const { out, code } = run(dir, ['start', '--session', A, '--task', 'x']);
  assert.equal(code, 0, out);
  assert.equal(entry(dir, A).task, 'x');
});
```

- [ ] **Step 4: Run them and watch the first fail**

```
node --test tests/task.test.js
```

Expected: `an id no running session claims is refused` fails — the command exits
0 and writes the entry. `a config directory that cannot be read is not a
refusal` passes already; it is the guard, and it must pass both before and
after.

- [ ] **Step 5: Write the implementation**

In `scripts/task.js`, `requireSession` currently reads:

```js
function requireSession(opts) {
    const id = opts.session;
    if (!id) fail('--session <id> is required. Read it from the transcript path; never guess it.');
    if (!registry.sessionPath(process.cwd(), id)) fail('Not a session id: ' + id);
    return id;
}
```

Replace it with:

```js
// The one chokepoint every subcommand passes through, and the only way a wrong
// id ever reaches the registry: somebody typed it here.
//
// An entry written under an id no hook reads is invisible in the direction that
// costs most — every hook goes quiet on a miss, correctly, because a miss is
// what a session that never used the plugin looks like. One real session spent
// two hours that way. The id had come off a background task's output directory,
// which carries a session id in exactly this shape and not always this session's.
//
// `runningSessions` returning null is the directory being unreadable, and that
// allows: a refusal must never come from a failed measurement. It is a measured
// absence that is fatal.
//
// `clear <id>` and `adopt <id>` take the other session's id positionally rather
// than through `--session`, so a dead neighbour is still reachable — which is
// the whole point of those two commands.
function requireSession(opts) {
    const id = opts.session;
    if (!id) fail('--session <id> is required. The /fankeel prompt makes the hook say it; use that one.');
    if (!registry.sessionPath(process.cwd(), id)) fail('Not a session id: ' + id);
    const rows = live.runningSessions(live.liveConfigDir());
    if (rows && !rows.some((row) => row.sessionId === id)) {
        const lines = ['No running Claude Code session has the id ' + id + '.', ''];
        if (rows.length) {
            lines.push('  running now:');
            for (const row of rows) lines.push('    ' + row.sessionId + (row.cwd ? '   ' + row.cwd : ''));
        } else {
            lines.push('  running now: none');
        }
        lines.push('');
        lines.push('An entry written under that id is one no hook would ever read, and every');
        lines.push('hook is silent about a miss — so the mode would look on and do nothing.');
        lines.push('A path on screen carries a session id in the same shape and it is not');
        lines.push('always this one. The /fankeel prompt makes the hook say which it is.');
        fail(lines.join('\n'));
    }
    return id;
}
```

- [ ] **Step 6: Run the tests and watch them pass**

```
node --test tests/task.test.js
```

Expected: three tests now fail — `a dead session holding the same file does not
paint clash`, `a session whose process is gone is not listed as live`, and `a
missing --session is refused with the instruction not to guess`. That is the
next step, not a surprise: two of them deliberately construct a session that is
already dead when `start` runs, and the third asserts on the old wording.

- [ ] **Step 7: Repair the three tests the check breaks**

These are not the check being wrong. A `start` in real life always comes from a
live session; the tests were building the scenario in an order real life cannot
take. Reordering them makes each *more* faithful — the session was live when it
started and died afterwards.

In `a dead session holding the same file does not paint clash`, the seeding
currently reads:

```js
  write(process.pid, B);
  write(spawnSync(process.execPath, ['-e', '0']).pid, A);
```

Replace those two lines with a live entry for each, and kill A only after both
have started. The block from `write(process.pid, B);` down to the two `run`
calls becomes:

```js
  write(process.pid, B);
  write(process.ppid, A);

  // The same registry for all three, because each entry now records the one it
  // was started under and a reader checks the neighbour against that.
  //
  // Both are live for the two `start` calls, because `task.js` refuses an id no
  // running session claims — and a task that was never started by a live session
  // is not the case this is about. A dies afterwards, which is the real story.
  run(dir, ['start', '--session', A, '--task', 'tidy the project cards'], { CLAUDE_CONFIG_DIR: cfg });
  run(dir, ['start', '--session', B, '--task', 'fix the card link'], { CLAUDE_CONFIG_DIR: cfg });
  fs.rmSync(path.join(cfg, 'sessions', process.ppid + '.json'));
  write(spawnSync(process.execPath, ['-e', '0']).pid, A);
```

The existing comment block above the two `run` calls is folded into the one
above, so delete the old two-line version rather than leaving both.

In `a session whose process is gone is not listed as live`, `B` is started while
nothing claims it. Add a live entry for `B` before the starts and take it away
after. The block currently reads:

```js
  seed(process.pid, A);

  run(dir, ['start', '--session', A, '--task', 'mine'], { CLAUDE_CONFIG_DIR: cfg });
  run(dir, ['start', '--session', B, '--task', 'theirs'], { CLAUDE_CONFIG_DIR: cfg });

  const shown = run(dir, ['show', '--session', A], { CLAUDE_CONFIG_DIR: cfg }).out;
```

Replace it with:

```js
  seed(process.pid, A);
  // Live for its own `start` — `task.js` refuses an id no running session
  // claims — and gone by the time the listing is read, which is the subject.
  seed(process.ppid, B);

  run(dir, ['start', '--session', A, '--task', 'mine'], { CLAUDE_CONFIG_DIR: cfg });
  run(dir, ['start', '--session', B, '--task', 'theirs'], { CLAUDE_CONFIG_DIR: cfg });
  fs.rmSync(path.join(cfg, 'sessions', process.ppid + '.json'));

  const shown = run(dir, ['show', '--session', A], { CLAUDE_CONFIG_DIR: cfg }).out;
```

The rest of that test is unchanged: it already re-seeds `process.ppid` for `B`
as its control, and that now also restores the file this step removed.

In `a missing --session is refused with the instruction not to guess`, the
assertion currently reads:

```js
  assert.match(out, /never guess it/);
```

The message no longer tells anyone not to guess; it tells them where the id
comes from. Replace the assertion and the test name. The whole test becomes:

```js
test('a missing --session is refused by naming where the id comes from', () => {
  const dir = root();
  const { out, code } = run(dir, ['start', '--task', 'x']);
  assert.equal(code, 1);
  assert.match(out, /\/fankeel prompt makes the hook say it/);
});
```

- [ ] **Step 8: Run the whole suite**

```
node --test
```

Expected: 625 pass (620 baseline, plus three in Task 1 and two here), 0 fail.

- [ ] **Step 9: Commit**

```
git add scripts/task.js tests/task.test.js tests/route.test.js
git commit -m "feat: refuse a session id no running process claims"
```

---

## Task 3: `hooks/inject.js` — say which id this is

**Files:**
- Modify: `hooks/inject.js` (the not-in-the-mode branch, currently lines 61-84)
- Modify: `tests/inject.test.js` (the assertion at line 282; two new tests)

**Interfaces:**
- Consumes: nothing from Tasks 1 or 2.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the failing tests**

In `tests/inject.test.js`, the test `a /fankeel prompt with no entry raises the
init badge` currently opens:

```js
  assert.equal(run({ session_id: MINE, cwd: root, prompt: '/fankeel @Waypoint' }, cfg), '');
```

That assertion is the behaviour being changed. Replace that one line with:

```js
  const out = run({ session_id: MINE, cwd: root, prompt: '/fankeel @Waypoint' }, cfg);
  assert.match(context(out), new RegExp(MINE));
```

Then append two tests at the end of the file:

```js
// The id typed into `task.js --session` has to be the id the hooks read, and
// nothing on screen distinguishes it: a background task's output directory and
// a scratch directory both carry one in the same shape. So the hook holding the
// real one says it, on the single prompt where it is about to be needed.
test('a /fankeel prompt is answered with the id the hooks use', () => {
  const dir = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  const text = context(run({ session_id: MINE, cwd: dir, prompt: '/fankeel' }, cfg));
  assert.match(text, new RegExp(MINE));
  assert.match(text, /--session/, 'it has to say what the id is for');
});

// The cost stays on that one prompt. Every other prompt in every session on the
// machine that is not in the mode still writes nothing at all.
test('an ordinary prompt with no entry is answered with nothing', () => {
  const dir = tmp('fankeel-hook-');
  assert.equal(run({ session_id: MINE, cwd: dir, prompt: 'what does this repository do' }), '');
  assert.equal(run({ session_id: MINE, cwd: dir, prompt: '/fankeel-audit' }), '');
});
```

- [ ] **Step 2: Run them and watch them fail**

```
node --test tests/inject.test.js
```

Expected: `a /fankeel prompt is answered with the id the hooks use` fails —
`run` returns `''` and `JSON.parse('')` throws. The repaired assertion in the
init-badge test fails the same way. `an ordinary prompt with no entry is
answered with nothing` passes already; it is the cost guard.

- [ ] **Step 3: Write the implementation**

In `hooks/inject.js`, the branch currently reads:

```js
    const mine = registry.readSession(root, sessionId);
    if (!mine || mine.active !== true) {
        const dir = claudeConfigDir();
        if (dir) {
            try {
                if (!mine && startsFankeel(payload.prompt)) {
```

Replace those lines with the block below, keeping everything from the
`badge.writeBadge(dir, sessionId, 'init');` line onward exactly as it is:

```js
    const mine = registry.readSession(root, sessionId);
    if (!mine || mine.active !== true) {
        const starting = startsFankeel(payload.prompt);

        // The one prompt where the id is about to be typed into `task.js`, and
        // the only moment anything here can say what it is. Nothing else on
        // screen can: a background task's output directory and a scratch
        // directory both carry a session id in this exact shape, and they are
        // not always this session's. One real session wrote its whole entry
        // under one of those and every hook here read the other, for two hours,
        // in silence — because a miss is what a session that never used the
        // plugin looks like, and that is the common case worth staying quiet
        // for.
        //
        // Output before the side effects, the same order the injection below
        // keeps and for the same reason.
        if (starting && typeof sessionId === 'string' && sessionId) {
            process.stdout.write(JSON.stringify({
                hookSpecificOutput: {
                    hookEventName: 'UserPromptSubmit',
                    additionalContext: 'fankeel: this session is ' + sessionId
                        + '\nThat is the id every hook here reads. Pass it to --session; an id read'
                        + '\noff a path on screen may be a different one.',
                },
            }));
        }

        const dir = claudeConfigDir();
        if (dir) {
            try {
                if (!mine && starting) {
```

- [ ] **Step 4: Run the tests and watch them pass**

```
node --test tests/inject.test.js
node --test
```

Expected: `tests/inject.test.js` green; the whole suite 627 pass, 0 fail.

- [ ] **Step 5: Commit**

```
git add hooks/inject.js tests/inject.test.js
git commit -m "feat: the /fankeel prompt is answered with this session's id"
```

---

## Task 4: the sentence each page is missing

**Files:**
- Modify: `skills/fankeel/SKILL.md` (lines 127-129)
- Modify: `docs/registry.md` (a new section after `# One writer at a time`)
- Modify: `TODO.md` (the first entry under `## Deferred`)

**Interfaces:**
- Consumes: the behaviour built in Tasks 2 and 3.
- Produces: nothing.

- [ ] **Step 1: `skills/fankeel/SKILL.md`**

It currently reads:

```
The current session id is in the `FANKEEL ACTIVE` block when the mode is on. When
it is not, read it from the transcript path — never guess, and never write a file
whose name you invented.
```

Reading it off a path is the advice that failed. Replace those three lines with:

```
The current session id is in the `FANKEEL ACTIVE` block when the mode is on. When
it is not, the `/fankeel` prompt is answered with it: one line, from the hook that
holds it. Use that one. A background task's output directory and a scratch
directory both carry a session id in the same shape and are not always this
session's, and an entry under the wrong one is invisible — every hook goes quiet
on a miss, because a miss is what a session not using the plugin looks like.
`task.js` refuses an id no running session claims rather than writing it.
```

- [ ] **Step 2: `docs/registry.md`**

The file ends with a navigation line:

```
[Back to the index](README.md) · [Back to the front page](../README.md)
```

The new section goes **above** it, after the `# One writer at a time` section.
Leave the navigation line last:

```markdown
# The id the hooks use

Every hook reads `payload.session_id`, and the entry it looks for is that id plus
`.json`. An entry written under any other id is one no hook will ever find — and
every one of them is silent about it, correctly: a miss is what a session that
never used the plugin looks like, which is nearly always what it is.

That cost one session two hours. A background task's output directory carried a
second session id, in the same shape as the real one, and it went into every
`task.js` call while the hooks read the other. Nought injections, nought claims,
and a statusline badge under an id the statusline does not read.

Two things close it, both upstream of the hooks:

| | |
|---|---|
| `scripts/task.js` | `--session` is checked against Claude Code's own `<config>/sessions/<pid>.json`. An id no running process claims is refused, and the message lists the ids that are running with the directory each was opened in. A directory that cannot be read allows everything — a refusal must never come from a failed measurement. |
| `hooks/inject.js` | a `/fankeel` prompt is answered with one line naming this session's id: the one that hook is itself holding. |

`clear <id>` and `adopt <id>` take the other session's id positionally rather
than through `--session`, so a dead neighbour is still reachable. That is what
those two commands are for.
```

- [ ] **Step 3: `TODO.md`**

The first entry under `## Deferred` currently reads:

```
- `inject.js` is silent on a session id it cannot find — [hooks/inject.js](hooks/inject.js). It is the rule layer's only delivery path, so a miss looks like no task. Measured: 2h, 0 injections.
```

The silence is deliberate and stays; what has changed is that the wrong id can
no longer get in through `task.js`. Replace that line with what is actually
left:

```
- A wrong session id reaching a hook any way but through `task.js` is still silent — [docs/plans/2026-08-26-session-id-design.md](docs/plans/2026-08-26-session-id-design.md). None observed.
```

That is 187 characters as `todo-check` counts them — it measures
`entry.text` *including* the raw markdown link, which is 92 characters on its
own, so the prose has to stay short. Do not lengthen it.

- [ ] **Step 4: Check both invariants the scanners hold**

```
node scripts/todo-check.js
node scripts/docs-check.js
```

Expected: `todo-check` exits 0 — the replacement entry is 187 characters against
a cap of 200, and the file it links to exists. If it reports the cap, shorten
the prose; never drop the link, which is the other half of what it checks.

`docs-check` currently exits 1 with 11 findings, all of them from the untracked
`session-31b5f48b-full.md` at the repository root. Confirm the count has not
grown and that no new finding names a file this task touched.

- [ ] **Step 5: Commit**

```
git add skills/fankeel/SKILL.md docs/registry.md TODO.md
git commit -m "docs: where the session id comes from, and what task.js now refuses"
```

---

## Self-review

**Spec coverage.** Section 1 of the spec (`task.js` refuses) is Task 2. Section 2
(`inject.js` says the id) is Task 3. Section 3 (the five hooks are not touched)
is covered by not appearing in any task, and by the `TODO.md` line in Task 4
recording what that leaves open. The spec's testing table is four rows: rows 1
and 2 are Task 2 steps 3 and 4, rows 3 and 4 are Task 3 step 1. The spec's note
about `tests/task.test.js` needing `CLAUDE_CONFIG_DIR` is Task 2 step 1 — and
grew, on reading the file, to cover `tests/route.test.js` and two direct
`execFileSync` calls the spec had not seen. The spec's "pages this makes
incomplete" is Task 4.

**No gaps found**, and one addition: `lib/live.js` gaining `runningSessions` is
Task 1, which the spec implied by asking the refusal to list the running
sessions but did not name as a change.

**Placeholders.** None. Every step names the file, quotes the text being
replaced, and gives the replacement in full.

**Type consistency.** `runningSessions` is spelled the same in Task 1's
implementation, Task 1's export line, Task 2's `requireSession`, and Task 4's
prose. Its rows are `{sessionId, cwd}` in the implementation, in Task 1's test,
and in the `rows.some((row) => row.sessionId === id)` of Task 2. `runningIds`
keeps its name and its `Set | null` contract, so the four existing callers in
`lib/live.js`, `scripts/task.js` and the hooks are untouched.
