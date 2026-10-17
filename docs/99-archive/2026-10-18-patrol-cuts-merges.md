---
status: current
last_verified: 2026-10-18
---

# Patrol Cuts and Merges Implementation Plan

**Goal:** Land the code cuts of `docs/90-agent/todo/audit-2.md` that survive a re-check against the code, the seven doc merges of `docs/90-agent/todo/docs-7.md`, and the TODO bookkeeping the 2026-10-18 patrol approved (two entries moved to Watch, eight Blocked entries re-stamped).
**Architecture:** Every task is a deletion or a move: a helper that already exists in one place replaces its copies (`repoRoot`, `readText`, `sleepMs`, `requireRange`, `send`, `add`), or a mechanism explained on two pages is explained on one and linked from the other. Behaviour does not change; the existing tests of each file are the proof, and a helper that is new or newly exported gets one test.
**Tech Stack:** Node >=22.5 (`package.json` `engines`), CommonJS, `node --test`, no dependencies; `hooks/pane-status.ts` is TypeScript loaded as-is by `tests/pane-status.test.js`.
**Spec:** [../todo/audit-2.md](../todo/audit-2.md)

## Global Constraints

Generated from `node scripts/map.js` (962 markdown files; filing: `docs/90-agent/plans` is `plan`, `docs/90-agent/todo` is `todo`, `docs/90-agent/reference` is `reference`, index `docs/README.md`), `CONTRIBUTING.md` (there is no `CLAUDE.md` and no `AGENTS.md` in this repository), `package.json` and the tests that pin text.

- Runtime: `"engines": { "node": ">=22.5" }`, CommonJS with `'use strict';`, no dependency may be added (`package.json` has none).
- Indentation as the file already has it: 4 spaces in `lib/`, `scripts/` and `tests/pane-status.test.js`; 2 spaces in `hooks/pane-status.ts`, `tests/tracked.test.js` and `tests/suitelock.test.js`.
- `CONTRIBUTING.md`: "Nothing in `lib/` reaches into `scripts/` or `hooks/`"; "Every exported name needs an importer" (`tests/source.test.js`); a new test file must be `git add`ed before that test sees it (this plan creates no file).
- Tests: `package.json` `"test": "node --test --require ./tests/subprocess-timeout.js"`. An implementer runs only its own test command, never the whole suite (`scripts/ledger.js` brief footer). Never two suites at once: two full suites on this machine exhaust the Windows commit limit (`VirtualAlloc failed`, `0xC0000409`, `0xC000012D`, README.md:260). `FANKEEL_BROWSER` matters only for the render tests, which no task here runs.
- No implementer commits; the build parent commits each group with `scripts/commit.js` and runs `scripts/suite.js --fast` before it.
- Version words (`tests/version-prose.test.js`): `CONTRIBUTING.md`, `docs/01-guide/development.md` and `skills/fankeel-land/SKILL.md` must each still contain `fifteen` and never `twelve skills` or `fourteen files`. Leave every SKILL.md frontmatter `version:` line untouched (`tests/contract.test.js` compares all fifteen).
- Skill text pinned by tests, keep verbatim: in `skills/fankeel-init/SKILL.md` step 1, `scripts/compact-window.js show`, "`compact.at` the source `builtin`", the five values `450000 350000 600000 1000000 off`, `scripts/task.js profile set compact.at <value> --default`, "only applies in a session that is running a fankeel task", "`task.js start` syncs `env.CLAUDE_CODE_AUTO_COMPACT_WINDOW` to `compact.at` each time a task starts", "No answer writes nothing", and `profile preset` before `compact-window.js show` (`tests/init-skill.test.js:44-86`); in `skills/fankeel-ask/SKILL.md`, `-<slug>-brief.md`, `subagent_type: fankeel:fankeel-judge`, `judge.model`, the full `judge.js record --session <id> --brief <path> --answer - --slug <slug> --model <m>` line, `never opens the gate` (`tests/skills.test.js:1208`); in `skills/fankeel-build/SKILL.md`, `ledger.js --plan <plan bucket>/<file>.md ready` and `hands` (`tests/skills.test.js:1327`).
- Every flag a SKILL.md names must be one the script accepts (`tests/skills.test.js:1037`).
- Doc links are relative and resolve; `node scripts/docs-check.js` exits 0 after every doc task. Leave each page's `last_verified` as it is.
- TODO entries (`lib/todo.js`, `docs/90-agent/reference/todo.md`): states are `ready`, `decision`, `blocked`, `watch` (`done` only through `todo.js done`); `MAX_ENTRY_CHARS = 200`; the body is at least 200 characters; a Watch timing is `timing: if: <the event>`; a Blocked timing is `on:`, `after:` or `upstream:`; the stamp is `stamp: YYYY-MM-DD`. `scripts/todo.js` has only `list | new | done | migrate`, no edit verb, so these edits are by hand. `node scripts/todo-check.js` must exit 0 after each of them.
- Plan caps (`lib/plantasks.js`): FILE_CAP 3 `Modify:` entries per task, READ_CAP 1500 lines per file; `implementer, haiku` only with `Modify:` files of at most 750 lines and every step beginning `Write` above a real code fence.
- Windows: Git Bash is available; use `/` in paths. No emojis.

## Risks

- `lib/guard.js:287` reads `--git-common-dir` and `--show-toplevel` in one `try` with a `timeout` and treats either failing as null — Task 1 and Task 2 would change that if it were folded into `repoRoot`, which has no timeout — struck from the plan (see Coverage); nothing checks it because nothing touches it.
- `renderScope` in `lib/shots.js:191` gives its `git` closure `exec` options (`task.js:865` passes `{ maxBuffer: 256 * 1024 * 1024 }`) — Task 2 — the rev-parse call has no use for them, so it moves to `repoRoot`; the task re-reads both callers (`scripts/ledger.js:538`, `scripts/task.js:865`) first.
- `scripts/review-check.js` falls back to `process.cwd()` when git fails; `lib/sensitive.js` and `scripts/commit.js` return early on failure — Task 2 and Task 3 — each keeps its own fallback around the `null` that `repoRoot` returns; the task reads the surrounding lines before editing.
- `lib/suitelock.js` would require `lib/registry.js` (1058 lines, loaded by `lib/agentends.js` through `lib/suitelock.js`) — Task 8 — it first proves `lib/registry.js`, `lib/json.js` and `lib/launchers.js` require nothing that leads back to `lib/suitelock.js`.
- `docs/90-agent/reference/subagents.md` is edited by Tasks 12, 13 and 14, which therefore run one after another; they are numbered bottom-up (line 716, then 467-500, then 158-182) so the line numbers in later tasks stay true — each task also names its text by its first and last words, which are the authority if a line moved.
- A doc merge deletes a fact the source page lacks — Tasks 12, 14 and 16 — each of those first moves the one fact the source page does not carry (the 2026-09-27 measurement, the judge record details, the sixty-path cap) and only then trims the other page.
- `README.md:260` already says `VirtualAlloc failed`, `0xC0000409` and `0xC000012D` mean the commit limit ran out; what it lacks is the consequence — Task 18 appends that one clause rather than a second sentence about the same thing.
- `docs/90-agent/todo/pane-2.md`, the file edited on 2026-10-14, is not covered by `Edit(/.fankeel/build/**)` — Task 17 — the evidence is written as "no verdict happened again", not as "the covered rule was skipped".

## Task 1: `repoRoot` beside `gitList`

**Files:**
- Modify: `lib/tracked.js` — add `repoRoot(dir)` after `gitList`, export it
- Test: `tests/tracked.test.js`

**Interfaces:**
- Consumes: none
- Produces: `repoRoot(dir: string): string | null` exported from `lib/tracked.js`. The top-level directory git prints for `dir`, trimmed, forward slashes on Windows; `null` when `dir` is in no repository, does not exist, git is missing, or git prints nothing. Stderr is discarded and nothing is thrown.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] Step 1. In `tests/tracked.test.js`, at the end of the file (the top-level `fs`, `path`, `execFileSync`, `tmp` and `tracked` are already declared there), add the failing test:

```js
test('repoRoot names the repository a subdirectory is in, and null where there is none', () => {
  const root = tmp('fankeel-reporoot-');
  execFileSync('git', ['init', '-q'], { cwd: root });
  const sub = path.join(root, 'a', 'b');
  fs.mkdirSync(sub, { recursive: true });
  const real = (p) => fs.realpathSync.native(p);

  assert.equal(real(tracked.repoRoot(sub)), real(root), 'a subdirectory did not resolve to its repository top');
  assert.equal(tracked.repoRoot(path.join(root, 'missing')), null, 'a directory that is not there was answered for');
  assert.equal(tracked.repoRoot(tmp('fankeel-reporoot-none-')), null, 'a directory in no repository was answered for');
});
```

- [ ] Step 2. Run `node --test tests/tracked.test.js` and watch the new test fail with `tracked.repoRoot is not a function`.
- [ ] Step 3. In `lib/tracked.js`, directly after the closing brace of `gitList` (before the comment that starts `A cached record under`), add:

```js
// The toplevel of the repository `dir` is in, as git prints it, or null: not a
// repository, no git, or a directory that is not there. Asking is a normal step
// here, not an error, so it swallows exactly what `gitList` above does —
// stderr included, or `fatal: not a git repository` leaks into a report that
// goes on to work.
function repoRoot(dir) {
    try {
        const top = cp.execFileSync('git', ['rev-parse', '--show-toplevel'], {
            cwd: dir,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        return top || null;
    } catch (e) {
        return null;
    }
}
```

- [ ] Step 4. In `lib/tracked.js`, change the last line to export it:

```js
module.exports = { trackedFiles, isRepo, repoRoot, parseStaged, flatten, SKIP_EXT, MAX_WALK_FILES };
```

- [ ] Step 5. Run `node --test tests/tracked.test.js`; every test passes, the new one among them.

## Task 2: `repoRoot` replaces three copies

**Files:**
- Modify: `lib/sensitive.js` — `commitVerdict` asks `repoRoot(cwd)`
- Modify: `lib/shots.js` — `renderScope` asks `repoRoot(cwd)`
- Modify: `scripts/review-check.js` — `topLevel` asks `repoRoot(process.cwd())`
- Read: `lib/tracked.js` — where `repoRoot` lives (Task 1)

**Interfaces:**
- Consumes: `repoRoot(dir: string): string | null` from `lib/tracked.js` (Task 1)
- Produces: none; `commitVerdict`, `renderScope` and `main` keep their signatures and results.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] Step 1. Read the three call sites before touching them: `lib/sensitive.js:186-192` (returns `null` on a non-zero status), `lib/shots.js:191-197` (`top` is `null` when git throws), `scripts/review-check.js:18-20` (falls back to `process.cwd()`). Each fallback survives the change below; none relied on a throw reaching its caller, because each already wrapped the call in its own `try` or status test.
- [ ] Step 2. Run `node --test tests/sensitive.test.js tests/sensitive-lens.test.js tests/shots.test.js tests/reviewcheck.test.js` and confirm they pass before the edit.
- [ ] Step 3. In `lib/sensitive.js`, add the import under `const path = require('node:path');` (`spawnSync` stays: lines 99 and 103 still use it):

```js
const { repoRoot } = require('./tracked.js');
```

- [ ] Step 4. In `lib/sensitive.js`, in `commitVerdict`, replace the three lines that start `const r = spawnSync('git', ['rev-parse', '--show-toplevel']` and end `const top = r.stdout.trim();` with:

```js
    const top = repoRoot(cwd);
    if (!top) return null;
```

- [ ] Step 5. In `lib/shots.js`, add the import under `const { renderShips } = require('./ledger.js');`:

```js
const { repoRoot } = require('./tracked.js');
```

- [ ] Step 6. In `lib/shots.js`, in `renderScope`, replace the two lines `let top = null;` and `try { top = realPath(git(['rev-parse', '--show-toplevel']).trim()); } catch (e) { ... }` with the following (the `git` closure above them stays: the ledger and task scripts use it):

```js
    // No repository: the registry root is the stop.
    const found = repoRoot(cwd);
    const top = found ? realPath(found) : null;
```

- [ ] Step 7. In `scripts/review-check.js`, delete the line `const { execFileSync } = require('node:child_process');` (nothing else in the file uses it), add the import under `const { tables, render } = require('../lib/reviewcheck.js');`, and replace the body of `topLevel`:

```js
const { repoRoot } = require('../lib/tracked.js');

function topLevel() {
    return repoRoot(process.cwd()) || process.cwd();
}
```

- [ ] Step 8. Run `node --test tests/sensitive.test.js tests/sensitive-lens.test.js tests/shots.test.js tests/reviewcheck.test.js` and then `node scripts/review-check.js --sha HEAD; echo $?`. The tests pass; the script prints a table and exits 0 or 1, never 2.

## Task 3: `repoRoot` replaces three more copies

**Files:**
- Modify: `scripts/commit.js` — `:213` and `:226`
- Modify: `scripts/residue.js` — `:238`
- Read: `lib/tracked.js` — where `repoRoot` lives (Task 1)

**Interfaces:**
- Consumes: `repoRoot(dir: string): string | null` from `lib/tracked.js` (Task 1)
- Produces: none; `main` in `scripts/commit.js` and the worktree listing in `scripts/residue.js` keep their results.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] Step 1. Read `scripts/commit.js:205-232` and `scripts/residue.js:228-245` first. The three copies test `status !== 0` or `|| []`, never a thrown error, so a `null` from `repoRoot` is the same signal. `run` in `scripts/commit.js` stays: `git(...)` below still uses it, as does `commonDir(run, ...)`.
- [ ] Step 2. Run `node --test tests/commit.test.js tests/commit-format.test.js tests/profile-commit-format.test.js tests/collisions-commit.test.js tests/residue.test.js tests/residue-inuse.test.js` and confirm they pass before the edit.
- [ ] Step 3. In `scripts/commit.js`, add the import under `const profile = require('../lib/profile.js');`:

```js
const { repoRoot } = require('../lib/tracked.js');
```

- [ ] Step 4. In `scripts/commit.js`, replace the lines from `const top = run(cwd, ['rev-parse', '--show-toplevel']);` through `const home = top.stdout.trim();`, the two-line comment about where the profile is read included, with the block below — it already carries that comment, so do not keep the old copy:

```js
    const home = repoRoot(cwd);
    if (!home) return { text: 'commit.js: not inside a git repository', code: 1 };
    // Where the profile and .fankeel/sensitive.txt are read: the checkout this
    // was started in, which is the main one when the controller runs it.
```

- [ ] Step 5. In `scripts/commit.js`, inside `if (into) {`, replace the `const there = ...` line, the `if (...)` line that tests `!there || there.status !== 0 ...` and the `topDir = there.stdout.trim();` line with:

```js
        const there = fs.existsSync(want) ? repoRoot(want) : null;
        const mine = commonDir(run, home);
        if (!there || !mine || commonDir(run, want) !== mine) {
            return { text: 'commit.js: into names no worktree of this repository: ' + into[1], code: 1 };
        }
        topDir = there;
```

(the `const mine = ...` line and the `return` line already exist; keep one of each.)

- [ ] Step 6. In `scripts/residue.js`, widen the import on the line that requires the tracked-files module:

```js
const { isRepo, repoRoot } = require('../lib/tracked.js');
```

Then, in `scripts/residue.js`, in the worktree listing, replace the `here` line with:

```js
    const here = repoRoot(root);
```

- [ ] Step 7. Run `node --test tests/commit.test.js tests/commit-format.test.js tests/profile-commit-format.test.js tests/collisions-commit.test.js tests/residue.test.js tests/residue-inuse.test.js`; all pass.

## Task 4: `send` and `return fail` in the station server

**Files:**
- Modify: `scripts/station.js` — the `handler` inside `serve` (about `:385-717`)

**Interfaces:**
- Consumes: none
- Produces: inside `handler`, `send(code, type, body, headers)`, `fail(code, msg)`, `noStore` and `redirect(to)`; none is exported.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

Recount at 6d1ed244: `fail(` is called 27 times; 21 of them are a `fail(...);` line followed by a `return;` line, 4 are already `return fail(...)`, one is in `formOf` and one ends the handler. `res.writeHead` appears 14 times: one in `fail` and 13 in `writeHead` / `end` / `return;` triples (ten answer 200 or 201 with a body, two redirect with 303 and no body, one takes `out.status`).

- [ ] Step 1. Run `node --test tests/serve.test.js tests/station-answer.test.js tests/station-todo.test.js tests/station-todo-files.test.js tests/station-chartroom.test.js tests/station-board-link.test.js tests/station-detail.test.js tests/station-search.test.js tests/station-cli.test.js` and confirm they pass before the edit.
- [ ] Step 2. In `scripts/station.js`, in `handler`, replace the whole `const fail = (code, msg) => { res.writeHead(...); res.end(msg + '\n'); };` statement with:

```js
        // One way to answer: status, an optional content type, the body, and
        // any further headers. A 303 passes `null` for the type and no body.
        const send = (code, type, body, headers) => {
            res.writeHead(code, Object.assign(type ? { 'content-type': type } : {}, headers));
            res.end(body);
        };
        const fail = (code, msg) => send(code, 'text/plain', msg + '\n');
        const noStore = { 'cache-control': 'no-store' };
        const redirect = (to) => send(303, null, undefined, { location: to });
```

- [ ] Step 3. Collapse the 21 `fail(...);` + `return;` pairs with one pass (single-line calls only, which all 21 are), then count:

```sh
node -e 'const fs=require("fs");const f="scripts/station.js";const s=fs.readFileSync(f,"utf8");fs.writeFileSync(f,s.replace(/^([ \t]*)fail\((.*)\);\r?\n[ \t]*return;/gm,"$1return fail($2);"))'
grep -c "return fail(" scripts/station.js
grep -nE "^[ \t]*fail\(" scripts/station.js
```

The count is 25 (21 + 4). The last command lists two lines: the `fail(403, ...)` in `formOf`, which is followed by `return null;`, and the final `fail(404, 'not here');`.

- [ ] Step 4. In `scripts/station.js`, replace each of the 13 `res.writeHead(...)` + `res.end(...)` + `return;` triples, in file order, with the one statement beside its number. They are found by their status and type: 1 is the html 200 of `GET /`; 2 the javascript 200 of the station-data route; 3 the json 200 of the search route; 4 the json 200 of the talk route (`conversation.pageOf`); 5 the javascript 200 of the detail route (`serializeDetail`); 6 the 200 of the health route; 7 the 200 of the static file route (`TYPES[...]`); 8 the 303 of `/clear`; 9 the 303 with `?cleared=` of `/clear-stale`; 10 the `out.status` answer of `/todo`; 11 the 201 `handed to the terminal`; 12 the 201 `answered N question(s)`; 13 the 303 of `/profile`.

```js
        // 1
        return send(200, 'text/html; charset=utf-8', html, noStore);
        // 2
        return send(200, 'text/javascript; charset=utf-8', station.serialize(sharedModel(), { serve: true, nonce, plugin: PLUGIN, cleared }), noStore);
        // 3
        return send(200, 'application/json; charset=utf-8', JSON.stringify(out), noStore);
        // 4
        return send(200, 'application/json; charset=utf-8', JSON.stringify(conversation.pageOf(talked.read, from, conversation.PAGE)), noStore);
        // 5
        return send(200, 'text/javascript; charset=utf-8', station.serializeDetail(hit), noStore);
        // 6
        return send(200, 'application/json', JSON.stringify({ station: true, pid: process.pid, started, fingerprint }));
        // 7
        return send(200, TYPES[path.extname(file[1])], body, noStore);
        // 8
        return redirect('/');
        // 9
        return redirect('/?cleared=' + cleared);
        // 10
        return send(out.status, 'text/plain; charset=utf-8', out.text + '\n');
        // 11 (inside its nested if, keep the indentation it has)
        return send(201, 'text/plain; charset=utf-8', 'handed to the terminal\n');
        // 12
        return send(201, 'text/plain; charset=utf-8', 'answered ' + keys.length + ' question' + (keys.length === 1 ? '' : 's') + '\n');
        // 13
        return redirect('/' + (/^#\/[a-z]*$/.test(back) ? back : ''));
```

- [ ] Step 5. Check nothing is left: `grep -c "res.writeHead" scripts/station.js` prints 1 (inside `send`), `grep -c "res.end(" scripts/station.js` prints 1, and `node --check scripts/station.js` is silent.
- [ ] Step 6. Run the Step 1 command again; all pass.

## Task 5: `add` in `todo-check.js`'s `check`

**Files:**
- Modify: `scripts/todo-check.js` — `check` (about `:343-535`)

**Interfaces:**
- Consumes: none
- Produces: inside `check`, `add(line, kind, detail)` which pushes `{ line, kind, detail }` onto `problems`; not exported.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

Recount at 6d1ed244: `problems.push(` appears 14 times in `check`: 13 object literals and the spread `problems.push(...folderProblems(...))`, which stays. The literal at `:366` inside a `return { ... problems: [{...}] }` also stays.

- [ ] Step 1. Run `node --test tests/todo-check.test.js tests/todo-check-claims.test.js tests/todo-check-folder.test.js` and `node scripts/todo-check.js`; all pass and the script exits 0.
- [ ] Step 2. In `scripts/todo-check.js`, in `check`, directly after the line `let problems = [];`, add (it closes over the variable, which is reassigned only after the last push):

```js
    const add = (line, kind, detail) => problems.push({ line, kind, detail });
```

- [ ] Step 3. In `scripts/todo-check.js`, replace each of the 13 `problems.push({ line: ..., kind: '...', detail: ... });` statements, keeping the `if` around it and the detail text character for character, with the statement beside its kind. The first six are in the `for (const entry of found)` loop, the last seven in the `for (const t of timings(text, at))` loop and the deletion check; `continue;` after `dead link` stays.

```js
            // kind: 'untimed'
            add(entry.line, 'untimed',
                'under ## ' + entry.section + ' but under no ### timing. Put it beneath the ### naming what it'
                + ' waits for, or open one: a title, then a "' + line + '. MM-DD." line.');
            // kind: 'unclassified'
            add(entry.line, 'unclassified',
                (entry.section ? 'under "' + entry.section + '"' : 'under no heading')
                + '. Every entry sits under one of ' + SECTIONS.map((s) => '## ' + s).join(' · ')
                + ', which is what says whether it can be started today.'
                + (entry.section === RETIRED
                    ? ' ## Waiting was split on 2026-09-27: ## Blocked takes on:, after: and upstream:; ## Watch takes if:.'
                    : ''));
            // kind: 'too long'
            add(entry.line, 'too long',
                len + ' characters, cap is ' + MAX_ENTRY_CHARS + '. Move the detail into the file this points at.');
            // kind: 'dead link'
            add(entry.line, 'dead link',
                target + ' does not exist. Either the entry is finished and should be closed (todo.js done) or removed, or the detail moved.');
            // kind: 'stale citation'
            add(entry.line, 'stale citation',
                target + ' is filed as ' + role + ', a role that records a moment rather than the present. Point at the code this is about, or at a reference page.');
            // kind: 'past end'
            add(entry.line, 'past end',
                cited + ' is past the end — ' + c.target + ' has ' + n + ' lines. The code moved; cite where it is now.');
            // kind: 'undocumented deletion' (line is 1, not an entry's)
            add(1, 'undocumented deletion',
                '"' + norm + '" was in TODO.md at the previous commit and is gone from the working'
                + ' file, with no matching record in ' + COMPLETIONS_PAGE + '. Add a record there'
                + ' (the original text, a disposition — done, measured-no-change or abandoned — and'
                + ' the commit sha that closed it) before removing the entry.');
            // kind: 'undated' (these and the rest use t.line)
            add(t.line, 'undated',
                'no MM-DD stamp on its condition line. End that line with the date somebody last read'
                + ' this timing and confirmed it still holds — without one it cannot be told from'
                + ' one nobody has looked at since it was filed.');
            // kind: 'unconditioned'
            add(t.line, 'unconditioned',
                'no condition on the line after it. Under ## Blocked write "on: MM-DD", "after: <what>"'
                + ' or "upstream: <what>"; under ## Watch, "if: <the event>". A timing that cannot'
                + ' name one is not waiting for anything.');
            // kind: 'wrong section'
            add(t.line, 'wrong section',
                '"' + t.kind + ':" belongs under ' + (t.kind === 'if' ? '## Watch' : '## Blocked')
                + ', not ## ' + t.section + '. Blocked takes on:, after: and upstream: — something a session'
                + ' can check; Watch takes if: — an event only whoever meets it knows.');
            // kind: 'bad date'
            add(t.line, 'bad date',
                '"on:" is not followed by an MM-DD. It is the day the date is compared against;'
                + ' a wait with no day is an "after:".');
            // kind: 'empty timing'
            add(t.line, 'empty timing',
                'no entries under it. A timing lifts the entries beneath it; with none it is'
                + ' waiting for nothing — remove it.');
            // kind: 'long title'
            add(t.line, 'long title',
                w + ' columns, cap is ' + MAX_TITLE_WIDTH + ' — a CJK character counts two.'
                + ' The title names the timing; the condition goes on the line after it.');
```

- [ ] Step 4. Check: `grep -c "problems.push(" scripts/todo-check.js` prints 2 (the spread and the one inside `add`), `grep -c "add(" scripts/todo-check.js` shows the 13 calls plus the definition, and `node --check scripts/todo-check.js` is silent. The `kind` strings in the fence above are the full set the tests assert on; none was renamed.
- [ ] Step 5. Run the Step 1 command again; all pass and `node scripts/todo-check.js` exits 0.

## Task 6: one `--range` refusal in `ledger.js`

**Files:**
- Modify: `scripts/ledger.js` — a helper after `fail` (`:41`) and the three checks at about `:684`, `:737` and `:845`

**Interfaces:**
- Consumes: none
- Produces: `requireRange(range)` in `scripts/ledger.js`, private. It calls `fail(...)` (exit 1, message on stdout) when `range` is defined and `ledger.isRange(range)` is false, and returns nothing otherwise.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

The three copies are identical text. `init` and `complete` already tested `opts.range !== undefined` first; `fix` rejects `undefined` on the line above its copy, so the helper's `undefined` test changes nothing there. Existing tests pin all three (the ledger test file, lines 426 for `complete`, 505 for `init` and 516 for `fix`), each asserting `--range wants two commit shas`.

- [ ] Step 1. Run `node --test tests/ledger.test.js tests/ledger-brief-prefix.test.js tests/ledger-show-done.test.js tests/ledger-workflow.test.js tests/hands.test.js tests/plantasks-lint-cap.test.js` and confirm they pass.
- [ ] Step 2. In `scripts/ledger.js`, directly after the closing brace of `fail`, add:

```js
// `--range` is refused on the way in rather than dropped on the way out: a value
// `ledger.isRange` cannot read back would reach the file and then read as no
// range at all. `undefined` is no flag and passes; `fix` insists on one before
// it asks.
function requireRange(range) {
    if (range !== undefined && !ledger.isRange(range)) {
        fail('--range wants two commit shas: <base>..<head>, 7 to 40 hex each. '
            + '"' + range + '" would reach the file and read back as no range at all.');
    }
}
```

- [ ] Step 3. In `scripts/ledger.js`, in the `init` verb, inside `if (opts.range !== undefined) {`, replace the inner four-line `if (!ledger.isRange(opts.range)) { fail(...); }` with:

```js
            requireRange(opts.range);
```

- [ ] Step 4. In `scripts/ledger.js`, in the `complete` verb, replace the four-line `if (opts.range !== undefined && !ledger.isRange(opts.range)) { fail(...); }` with:

```js
        requireRange(opts.range);
```

- [ ] Step 5. In `scripts/ledger.js`, in the `fix` verb, replace the four-line `if (!ledger.isRange(opts.range)) { fail(...); }` (the line above it, `if (opts.range === undefined) fail('fix wants --range ...')`, stays) with:

```js
        requireRange(opts.range);
```

- [ ] Step 6. Check `grep -c "range wants\|--range wants" scripts/ledger.js` prints 1, then run the Step 1 command again; all pass.

## Task 7: `readIf` becomes `readText` in `map.js`

**Files:**
- Modify: `lib/map.js` — drop `readIf` (`:48`), three call sites (`:129`, `:211`, `:246`)
- Read: `lib/json.js` — `readText(file)`, the UTF-8 text or `null`, identical to `readIf`

**Interfaces:**
- Consumes: `readText(file: string): string | null` from `lib/json.js`
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] Step 1. Run `node --test tests/map.test.js tests/map-cli.test.js`; both pass. `readIf` is not exported (`lib/map.js:491` exports `firstTable, signpost, layoutBlock, pagesByStatus, markdownUnder, buildMap, PLUGIN_ROOT`), so no other file can depend on it.
- [ ] Step 2. In `lib/map.js`, add the import under `const requires = require('./requires.js');`:

```js
const { readText } = require('./json.js');
```

- [ ] Step 3. Delete the whole `readIf` function (the seven lines from `function readIf(file) {` through its closing `}` and the blank line after it), then:

```sh
sed -i 's/\breadIf(/readText(/' lib/map.js
grep -n "readIf" lib/map.js
```

The `grep` prints nothing.

- [ ] Step 4. Run `node --test tests/map.test.js tests/map-cli.test.js`; both pass.

## Task 8: one `sleepMs`

**Files:**
- Modify: `lib/registry.js` — export `sleepMs` (defined at `:268`)
- Modify: `lib/suitelock.js` — drop its own `sleep` (`:54`), call `sleepMs` (`:126`)
- Test: `tests/suitelock.test.js`

**Interfaces:**
- Consumes: none
- Produces: `sleepMs(ms: number): void` exported from `lib/registry.js`, a blocking wait (`Atomics.wait`) of `ms` milliseconds; `lib/suitelock.js` consumes it.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] Step 1. Prove there is no cycle before editing: running grep for `require(` over the registry, json and launchers modules lists only `node:` modules and those two siblings; none of them requires the suite lock or the agent-end module. The two `sleep` bodies are the same `Atomics.wait` call (registry line 268, suitelock line 54).
- [ ] Step 2. In `tests/suitelock.test.js`, add the failing test at the end of the file and the import under `const lock = require('../lib/suitelock.js');`:

```js
const registry = require('../lib/registry.js');

test('sleepMs, the one wait suitelock polls with, blocks for at least the time it is given', () => {
  const t0 = Date.now();
  registry.sleepMs(40);
  assert.ok(Date.now() - t0 >= 35, 'sleepMs returned early');
});
```

(`const registry = ...` goes with the other `require`s at the top of the file, not at the end.) Run `node --test tests/suitelock.test.js` and watch it fail with `registry.sleepMs is not a function`.

- [ ] Step 3. In `lib/registry.js`, in `module.exports`, add the name after `ensureIgnored,`:

```js
    sleepMs,
```

- [ ] Step 4. In `lib/suitelock.js`, add the import under `const path = require('node:path');`:

```js
const { sleepMs } = require('./registry.js');
```

Then, in `lib/suitelock.js`, delete the whole `function sleep(ms) { ... }` (three lines and the blank line after it) and change its one call, in the polling loop of `acquire`, to:

```js
        sleepMs(pollMs);
```

- [ ] Step 5. Run `node -e "require('./lib/suitelock.js'); require('./lib/agentends.js')"` (no output, no cycle error), then `node --test tests/suitelock.test.js tests/registry.test.js tests/suite.test.js tests/agent-end.test.js`; all pass.

## Task 9: `ledgerDone` and `planTotal` leave `pane-status.ts`

**Files:**
- Modify: `hooks/pane-status.ts` — delete `ledgerDone` (`:129`) and `planTotal` (`:168`)
- Test: `tests/pane-status.test.js` — `:199-233`, `:243`, `:253`, `:258`, `:267`

**Interfaces:**
- Consumes: none
- Produces: nothing new. `hooks/pane-status.ts` no longer exports `ledgerDone` or `planTotal`; callers use `ledgerDoneIds(text, claim)` (`number[] | null`) and `planTasks(text)` (`PlanTask[]`), whose `.length` is the same number. Only the tests used the two (`grep -rn "ledgerDone\b\|planTotal" hooks lib scripts` finds nothing else).

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] Step 1. In `tests/pane-status.test.js`, replace the test at `:199-224` (title `ledgerDone counts what lib/ledger.js completed() counts...`) with:

```js
test('ledgerDoneIds counts what lib/ledger.js completed() counts, for the plan the ledger names', async () => {
    const { ledgerDoneIds } = await load();
    const claim = 'docs/90-agent/plans/2026-10-11-fankeel-pane.md';
    const body = [
        ledger.header(claim),
        ledger.planLine('585391352af5..9d4da4450a28'),
        '',
        'fankeel ledger — 3 groups over 5 tasks',
        ledger.fixLine('Task 2: a test pins the bounds', '0d4be9c..c743946'),
        ledger.completionLine(2, 'gate rows', '0d4be9c..c743946'),
        ledger.rulingLine('Task 1: complete is not a completion here', 'it is a ruling', 'nothing'),
        ledger.completionLine(1, 'status rows'),
        '  ' + ledger.completionLine(4, 'docs'),
        ledger.completionLine(2, 'gate rows, again'),
        'Task 7: completed later',
    ].join('\n') + '\n';
    assert.ok(ledger.owns(body, claim));
    assert.equal(ledgerDoneIds(body, claim).length, new Set(ledger.completed(body)).size);
    assert.equal(ledgerDoneIds(body, claim).length, 3);
    assert.equal(ledgerDoneIds(body.replace(/\n/g, '\r\n'), claim).length, 3);
    for (const foreign of ['docs/90-agent/plans/other.md', '2026-10-11-fankeel-pane.md']) {
        assert.equal(ledger.owns(body, foreign), false);
        assert.equal(ledgerDoneIds(body, foreign), null);
    }
    assert.equal(ledgerDoneIds('', claim), null);
});
```

- [ ] Step 2. In `tests/pane-status.test.js`, replace the test at `:226-235` (title `planTotal counts the headings...`) with:

```js
test('planTasks counts the headings lib/plantasks.js parseTasks counts', async () => {
    const { planTasks } = await load();
    const fence = '`'.repeat(3);
    const body = ['# Plan', '', '## Global Constraints', '', '## Task 1: one', 'text', fence + 'md', '## Task 9: an example inside a fence', fence,
        '##  Task 2:  two', '### Task 3: a sub-heading', '## Task three: no number', '   ## Task 4: indented', '## Coverage', ''].join('\n');
    assert.equal(plantasks.parseTasks(body).length, 3);
    assert.equal(planTasks(body).length, plantasks.parseTasks(body).length);
    assert.equal(planTasks(body.replace(/\n/g, '\r\n')).length, 3);
    assert.equal(planTasks('').length, 0);
});
```

- [ ] Step 3. In `tests/pane-status.test.js`, in the test titled `planTasks reads the headings lib/plantasks.js parseTasks reads...`, change `const { planTasks, planTotal } = await load();` to `const { planTasks } = await load();` and `assert.equal(planTotal(text), 3);` to:

```js
    assert.equal(planTasks(text).length, 3);
```

Then, in `tests/pane-status.test.js`, in the test titled `ledgerDoneIds names the tasks...`, change `const { ledgerDoneIds, ledgerDone } = await load();` to `const { ledgerDoneIds } = await load();` and `assert.equal(ledgerDone(text, claim), 3);` to:

```js
    assert.equal(ledgerDoneIds(text, claim).length, 3);
```

- [ ] Step 4. Run `node --test tests/pane-status.test.js`; every test passes with the two functions still in place.
- [ ] Step 5. In `hooks/pane-status.ts`, delete these two blocks (each with the blank line that follows it):

```text
export function ledgerDone(text: string, claim: string): number | null {
  const ids = ledgerDoneIds(text, claim)
  return ids === null ? null : ids.length
}
```

```text
export const planTotal = (text: string): number => planTasks(text).length
```

- [ ] Step 6. Run `grep -rn "ledgerDone\b\|planTotal" hooks lib scripts tests` (prints nothing) and `node --test tests/pane-status.test.js tests/pane.test.js`; both pass.

## Task 10: `compact.at` keeps one full page

**Files:**
- Modify: `skills/fankeel-init/SKILL.md` — the `The auto-compact window` bullet (`:85-121`); leave the `version:` line alone
- Read: `docs/01-guide/profile.md` — the source; its long paragraph at `:62` holds what the sync writes, what it leaves alone, the `.fankeel-bak` copy, `not synced` and the restart

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, haiku — one text replacement, the new text is in the plan.

`docs/01-guide/profile.md` is the source and is not edited: `:62` already says that `task.js start` aligns `env.CLAUDE_CODE_AUTO_COMPACT_WINDOW` with the merged `compact.at`, writes only when it differs, keeps a `.fankeel-bak` copy when `settings.json` already existed, prints `compact window: not synced` with the reason when it cannot parse the file, leaves `off` and a `compact-window.declined` marker alone, and asks for a Claude Desktop restart. The skill keeps the question, the option order and the command, and points there for the mechanism.

1. Write the new bullet over the old one in `skills/fankeel-init/SKILL.md`: the old one starts `- The auto-compact window — asked when` and ends `window as it is.` (36 lines); the new text is:

```md
- The auto-compact window — asked when
  `node <plugin>/scripts/task.js profile show` gives `compact.at` the
  source `builtin` (nobody has chosen); a row sourced `project` or a machine
  default is not asked again. First run
  `node <plugin>/scripts/compact-window.js show`: when it prints `set <n>`,
  the descriptions say this machine already has a machine-wide
  `CLAUDE_CODE_AUTO_COMPACT_WINDOW` of `<n>`, which the next `task.js start`
  replaces with the answer. One `AskUserQuestion`, four options in this order: `450000`,
  recommended (the default); `1000000` — for document work and long files,
  keeps up to 1M in context, spends the most, and needs a 1M-context model;
  `600000` — loose, keeps more in context and spends
  more; 不設 (`off`) — fankeel's own mod, `hooks/compact.ts`, never compacts
  (the host's own auto-compact, or a machine-wide
  `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, still can), and the description says this
  burns tokens heavily. `350000` — conservative, compacts sooner and spends
  fewer tokens — is reachable through **Other**; the key takes only those five
  values. The descriptions say what the answer does: it only applies in a
  session that is running a fankeel task — `hooks/compact.ts` compacts the main
  conversation once its context reaches that many tokens, in an interactive
  session where the mod is loaded, never in a headless `claude -p` session.
  The answer is not written to `settings.json` now, but `task.js start` syncs
  `env.CLAUDE_CODE_AUTO_COMPACT_WINDOW` to `compact.at` each time a task starts,
  once `compact.at` has been chosen. What the sync writes, what it leaves
  alone (`off`, an earlier init's `compact-window.declined` marker), the
  `compact window: not synced` line and the restart it asks for are in
  [profile.md](../../docs/01-guide/profile.md), and the descriptions say
  that 350000, 600000 and 1000000 have not been measured. The answer runs
  `node <plugin>/scripts/task.js profile set compact.at <value> --default`.
  No answer writes nothing, and `task.js start` then leaves the machine's
  window as it is.
```

2. Run `node --test tests/init-skill.test.js tests/init-docs.test.js` and `node scripts/docs-check.js`; all pass and the script exits 0.

## Task 11: the title override keeps one full page

**Files:**
- Modify: `docs/90-agent/reference/model-choice.md` — the sentence at `:54-60` about `hooks/title.js`
- Read: `docs/90-agent/reference/subagents.md` — the source; `:305-330` holds the rule, the `startedAt` cutoff and the model replacement

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, haiku — one text replacement, the new text is in the plan.

`docs/90-agent/reference/subagents.md` is the source and is not edited: its paragraph at `:305-330` already says that the title hook rewrites `fankeel:<name>` to the bare `<name>` when a generated override exists, replaces a `model` the dispatch named when the override pins one, and leaves an override newer than the session's `startedAt` alone with a "new terminal" notice. `model-choice.md:106` already links to it.

1. Write the new ending over the old one in `docs/90-agent/reference/model-choice.md`: the old text starts at the `; and` that follows the line ending `called at` and the scripts/task.js citation, runs through the hooks/title.js citation and the `unlessLate` clause, and ends at `files only at process start.`; the new text, which begins with that semicolon, is:

```md
; and the dispatch hook sends `fankeel:<name>` as the bare `<name>` when such a marked file exists, so the override is the file that resolves. [subagents](subagents.md) carries the rule: when the hook leaves a file newer than the session alone, and the model replacement that follows from it.
```

2. Run `node --test tests/init-docs.test.js tests/title-docs.test.js` and `node scripts/docs-check.js`; all pass and the script exits 0 (the init-docs test pins three phrases elsewhere on the page).

## Task 12: the running-agent rule keeps one full page

**Files:**
- Modify: `docs/90-agent/reference/station.md:730-737` — gains the 2026-09-27 measurement
- Modify: `docs/90-agent/reference/subagents.md:714-723` — keeps a pointer

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the text; moving one fact before trimming the other page is a judgement the implementer has to check.

`docs/90-agent/reference/station.md` is the source (its `live-subagents` paragraph states the rule and the 20-minute drop). `subagents.md:716-723` says the same and adds two facts the station page lacks: `agent-<id>.meta.json` is written once at spawn and carries no end, and the 2026-09-27 count (290 finished agents, 288 ending `end_turn`, 2 ending `stop_reason: null` with text alone). They move first.

- [ ] Step 1. In `docs/90-agent/reference/station.md`, in the `live-subagents` sentence, replace `A subagent is finished when the last assistant or user line of its `agent-<id>.jsonl` is an assistant line with text and no tool_use; a file that has not moved in 20 minutes is a stopped agent and is dropped.` (it wraps over lines 733-736; the text after `dropped.` stays) with:

```md
A subagent is finished when the last assistant or user line of its `agent-<id>.jsonl` is an assistant line with text and no tool_use — `agent-<id>.meta.json` is written once, at spawn, and carries no end, so the end is read off the transcript; measured 2026-09-27 on 290 finished agents in one project, 288 ending `end_turn` and 2 ending `stop_reason: null` with text alone. A file that has not moved in 20 minutes is a stopped agent and is dropped.
```

- [ ] Step 2. In `docs/90-agent/reference/subagents.md`, replace the paragraph that starts `The station reads the same directory to say which of them are running now` and ends `unless the file has not moved in 20 minutes.` (8 lines) with:

```md
The station reads the same directory to say which of them are running now
(`runningAgents` in `lib/usage.js`, the `live-subagents` row on `#/live`); how
an agent counts as finished or stopped is [station.md](station.md)'s rule.
```

- [ ] Step 3. Run `node --test tests/station-doc.test.js tests/station-subagents.test.js tests/init-docs.test.js tests/skills.test.js` and `node scripts/docs-check.js`; all pass and the script exits 0.

## Task 13: `ledger.js ready` keeps one full page

**Files:**
- Modify: `docs/90-agent/reference/subagents.md:467-500` — the `ready` sentence and the `user` dispatch paragraph
- Read: `skills/fankeel-build/SKILL.md` — the source; `:198-208` holds the hands paragraph and `:262-298` holds `ledger.js ready` (when a task leaves, `INDEX_FILES`, `--worktree`, `dispatch.inflight`)

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, haiku — two text replacements, the new text is in the plan.

`skills/fankeel-build/SKILL.md` is the source and is not edited. This task runs after Task 12 and before Task 14 (the same file, bottom-up), so lines above 467 have not moved; find both passages by their words.

1. Write the new ending of the groups paragraph over the old one in `docs/90-agent/reference/subagents.md`: the old text starts at `and prints the groups they make.` and ends at `default above is still how many are in flight at once.` (lines 467-474); the new text is:

```md
and prints the groups they make. The build loop sends from `ledger.js ready`
instead, which asks the same four per task; [the build
skill](../../../skills/fankeel-build/SKILL.md) carries when a task leaves, what
does not count as a shared file, and how many go out at once.
```

2. Write the new paragraph over the old one in `docs/90-agent/reference/subagents.md`: the old one starts `A task whose` and a Dispatch line reading `user` and ends `controller goes through an implementer.` (lines 494-500); the new text is:

```md
A task whose `**Dispatch:**` line reads `user — <what the user does>` is not
dispatched at all: `ledger.js ready` leaves it out, and [the build
skill](../../../skills/fankeel-build/SKILL.md) says who asks the user and when.
```

3. Run `node --test tests/skills.test.js tests/hands.test.js tests/init-docs.test.js tests/title-docs.test.js` and `node scripts/docs-check.js`; all pass and the script exits 0.

## Task 14: `judge.js record` keeps one full page

**Files:**
- Modify: `skills/fankeel-ask/SKILL.md` — step 3 gains the record's details; leave the `version:` line alone
- Modify: `docs/90-agent/reference/subagents.md:158-182` — keeps a pointer
- Read: `scripts/judge.js` — the flags, the frontmatter fields, `freePath` and the `## Judgements` index row, to check the sentences below

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the text; moving the record's details into the skill before trimming the page is a judgement the implementer has to check against `scripts/judge.js`.

`skills/fankeel-ask/SKILL.md` is the source. Its step 3 has the command, `stdin` advice and the bucket, but not what the file holds, the `-2` rule, the exit-1 rule or the two root flags; `subagents.md:160-176` does. They move first (checked against `scripts/judge.js:81-129`: the frontmatter at `:100-107`, `freePath`, the required-flag check at `:81`, `--model` defaulting to `fable` at `:93`).

- [ ] Step 1. In `skills/fankeel-ask/SKILL.md`, in step 3, after the sentence that ends `and adds its row to the index where the project has a `## Judgements` table.` add this paragraph (indented three spaces like the step's other paragraphs):

```md
   The file's frontmatter carries `judged`, `model`, `agent: fankeel-judge`,
   `task`, `session` and `stage`, and the brief and the answer follow it
   copied in whole, not summarised. A `--slug` already on disk gets `-2`
   rather than overwriting the first record; a missing `--session`, `--brief`,
   `--answer` or `--slug` exits 1 before anything is written; and where the
   project has no `## Judgements` heading the command says so rather than
   inventing one. `--model` is `fable` when left off, `--root <dir>` names the
   registry and `--project <dir>` the project whose bucket receives the file,
   for a working directory that does not decide them.
```

- [ ] Step 2. In `docs/90-agent/reference/subagents.md`, replace the text from `Its answer does not stay in the judge's own context — the parent files it,` through `short form, not the only copy.` (lines 158-182: the command fence, the paragraph about the file it writes, and the paragraph that ends the section on the skill) with:

```md
Its answer does not stay in the judge's own context: the parent files it
verbatim with `scripts/judge.js record`, and [the fankeel-ask
skill](../../../skills/fankeel-ask/SKILL.md) owns that command, every flag on it
and what it writes.
```

- [ ] Step 3. Run `node --test tests/skills.test.js tests/skills-cli.test.js tests/judge.test.js tests/init-docs.test.js tests/title-docs.test.js` and `node scripts/docs-check.js`; all pass and the script exits 0.

## Task 15: the `version.js` rationale keeps one full page

**Files:**
- Modify: `skills/fankeel-land/SKILL.md:158-176` — `## 2a`; leave the `version:` line alone
- Read: `docs/01-guide/development.md` — the source; `:178-222` holds why the script exists and the eight release steps

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, haiku — one text replacement, the new text is in the plan.

`docs/01-guide/development.md` is the source and is not edited. The three commands, "Only when the user says" and the word `fifteen` stay in the skill (the version-prose test needs `fifteen` there).

1. Write the new text over the old in `skills/fankeel-land/SKILL.md`, in the section `2a. The release number, when the work is one`: keep the heading and the fenced block of three commands, and replace everything from `Fifteen files carry it:` through `than from a changelog somebody has to remember to write.` with:

```md
Fifteen files carry it — two manifests and one frontmatter line in each of the
thirteen skills — and `npm test` fails when they disagree. Why the script
exists, and the steps a release takes, are in
[development.md](../../docs/01-guide/development.md).

**Only when the user says this is a release.** The number is a claim about what
shipped, which is theirs to make; `--changes` is what to show them when asking.
```

2. Run `node --test tests/version-prose.test.js tests/contract.test.js tests/skills.test.js` and `node scripts/docs-check.js`; all pass and the script exits 0.

## Task 16: `seen` and `claims` keep one full page

**Files:**
- Modify: `docs/90-agent/reference/collisions.md:70-80` — gains the cap paragraph
- Modify: `docs/90-agent/reference/registry.md:103-121` — keeps a pointer
- Read: `lib/registry.js` — `appendUnique` at `:699`, to confirm the cap behaviour named below
- Read: `lib/dirty.js` — `declined: written.length` at `:184`, the refusal of a pass over the cap

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the text; checking the cap behaviour against `appendUnique` and `lib/dirty.js` is a judgement the implementer has to make.

`docs/90-agent/reference/collisions.md` is the source: it explains `claims`, `seen`, the git pass, its weight and why a pass over the cap is refused whole. It lacks one thing `registry.md:103-121` has: the cap is sixty for both, a path arriving on its own drops the oldest, `task` clears both and `adopt` carries both. That moves first.

- [ ] Step 1. Confirm in `lib/registry.js` (`appendUnique`, `list.slice(-max)`) and `lib/dirty.js` (`declined: written.length` when `written.length > registry.MAX_CLAIMS`) that the sentences below are true; if one is not, correct the sentence, not the code.
- [ ] Step 2. In `docs/90-agent/reference/collisions.md`, directly above the paragraph that starts `Two limits, and they are why this is a second path rather than a replacement.`, add:

```md
`claims` and `seen` each hold sixty paths, every one stored whole because none
is a path a human retypes. A path that arrives on its own, from
`hooks/touch.js`, drops the oldest to make room; a git pass holding more than
sixty is refused whole rather than trimmed, as the table says. `task` clears
both fields, because a task that has just been renamed has touched nothing yet;
`adopt` carries both across, because where the work went belongs to the task
rather than to the session; no subcommand sets either.
```

- [ ] Step 3. In `docs/90-agent/reference/registry.md`, replace the text from `A third field is written by nobody the user talks to. `claims` holds every file` through `has just been renamed has touched nothing yet.` (lines 103-121) with:

```md
A third field is written by nobody the user talks to. `claims` holds every file
this task has edited and `seen` every path git reports written since the task's
`started` that no hook saw; `hooks/touch.js` and `hooks/inject.js` write them,
which is why the table above lists hooks rather than a command as the writer.
Both hold sixty paths, `task` clears both and `adopt` carries both across.
[collisions.md](collisions.md) is the page for what each means and how the cap
behaves.
```

- [ ] Step 4. Run `node --test tests/registry-seen.test.js tests/registry.test.js tests/station-docs-tour.test.js` and `node scripts/docs-check.js`; all pass and the script exits 0.

## Task 17: `stage-agents-10` to Watch; stamp `audit-1` and `build-1`

**Files:**
- Modify: `docs/90-agent/todo/stage-agents-10.md` — frontmatter and one new section
- Modify: `docs/90-agent/todo/audit-1.md:9-9` — the stamp line
- Modify: `docs/90-agent/todo/build-1.md:9-9` — the stamp line

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, haiku — three small file edits, the new text is in the plan.

1. Write the new frontmatter over the old in `docs/90-agent/todo/stage-agents-10.md` (the whole block between the two `---` lines; the `label` and `title` lines come out unchanged):

```md
---
label: stage-agents
title: allow 規則下 no verdict 再現
description: 放行規則 `Edit(/.fankeel/build/**)` 在檔案裡，auto mode 在 10-08、10-14 仍回 no verdict；10-10 `claude --debug` 看到規則有讀到，10-14 那次沒開 debug — [subagents.md](docs/90-agent/reference/subagents.md).
state: watch
link: docs/90-agent/reference/subagents.md
group: 放行規則有沒有效
timing: if: no verdict 下次再發生 — 當場開 claude --debug 看判定走到哪
stamp: 2026-10-18
---
```

2. Write the new section into `docs/90-agent/todo/stage-agents-10.md`, directly above the paragraph that starts `要做成：報告那半已在 10-08 補完`:

```md
## 10-14 再發生

session 82155bbc 的 transcript（2026-10-14）：一個子 agent 對 `docs/90-agent/todo/pane-2.md` 做了三次 Edit，三次都回 "auto mode's classifier gave no verdict"，是 10-10 之後第一次。`Edit(/.fankeel/build/**)` 不涵蓋 `docs/90-agent/todo/`，所以這次是 no verdict 再發生，不是涵蓋路徑的規則被略過。當時沒有開 `claude --debug`，判定走到哪一步仍不知道。

```

3. Re-stamp the two Blocked entries checked this round, and show the result:

```sh
sed -i 's/^stamp: 2026-10-16$/stamp: 2026-10-18/' docs/90-agent/todo/audit-1.md docs/90-agent/todo/build-1.md
grep -n "^stamp:" docs/90-agent/todo/audit-1.md docs/90-agent/todo/build-1.md docs/90-agent/todo/stage-agents-10.md
```

All three lines read `stamp: 2026-10-18` and sit on line 9.

4. Run `node scripts/todo-check.js`; it exits 0 and reports one fewer blocked and one more watch than before. If it reports `too long` for `stage-agents-10`, shorten the description, not the new section.

## Task 18: `test-8` to Watch; the README clause; stamp `docs-1`

**Files:**
- Modify: `docs/90-agent/todo/test-8.md` — frontmatter and the last two paragraphs
- Modify: `README.md:260-260` — the `VirtualAlloc failed` sentence under `## Development`
- Modify: `docs/90-agent/todo/docs-1.md:9-9` — the stamp line

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, haiku — three small file edits, the new text is in the plan.

`README.md` already says the three signatures are Windows running out of commit and that one suite alone passes; what it lacks is the consequence, so this adds a clause to that sentence instead of a second sentence about the same thing.

1. Write the longer ending over the old one in `README.md`, in the paragraph under `## Development` that contains `A different failure shares the symptom:`; the old ending of its last sentence is `— that is Windows running out of commit, not a failing test, and one suite alone passes.` and the new one is:

```md
— that is Windows running out of commit, not a failing test, and one suite alone passes, which is why two suites are never run at once.
```

2. Write the new frontmatter over the old in `docs/90-agent/todo/test-8.md` (the whole block between the two `---` lines; the `label` and `title` lines come out unchanged):

```md
---
label: test
title: 並行測試撞 Windows 認可上限
description: 兩組完整測試同時跑會撞 Windows 認可上限，特徵已寫進 README.md；剩 3 項沒有 stderr 的失敗未證實 — [README.md](README.md).
state: watch
link: README.md
group: 認可量耗盡再發生
timing: if: 整套測試再出現 VirtualAlloc failed、0xC0000409 或 0xC000012D
stamp: 2026-10-18
---
```

3. Write the new closing paragraphs over the last two in `docs/90-agent/todo/test-8.md`, the one that starts `要做成：WSL 釋放認可量後` and the one that starts `完成條件：認可量有餘裕時`:

```md
2026-10-18：vmmemWSL 已從約 158 GB 降到 70.7 GB，可用虛擬記憶體約 85 GB；README.md 的 `## Development` 已寫明 VirtualAlloc failed、0xC0000409、0xC000012D 是 Windows 認可量耗盡，不是測試的錯，所以不再重跑兩組並行測試。

未證實的三項（沒有 stderr，多半也是記憶體）：tests/docs-audit.test.js:123 的 git exit 128、tests/render-cli.test.js:151 的 Chrome exit 1、tests/tracked.test.js:63『fanout is the same answer whatever the width』的 git fallback。

要做成：這三項在整套測試單跑時再失敗，就各自查原因；特徵本身 README 已點名。

完成條件：三項各自查出原因並在 README.md 點名，或確認不再出現後關掉此條。
```

4. Re-stamp the Blocked entry and show the result:

```sh
sed -i 's/^stamp: 2026-10-16$/stamp: 2026-10-18/' docs/90-agent/todo/docs-1.md
grep -n "^stamp:" docs/90-agent/todo/docs-1.md docs/90-agent/todo/test-8.md
```

Both lines read `stamp: 2026-10-18` and sit on line 9.

5. Run `node scripts/todo-check.js` (exit 0) and `node scripts/docs-check.js` (exit 0).

## Task 19: stamp `foreign-1`, `model-4`, `quota-1`

**Files:**
- Modify: `docs/90-agent/todo/foreign-1.md:9-9` — the stamp line
- Modify: `docs/90-agent/todo/model-4.md:9-9` — the stamp line
- Modify: `docs/90-agent/todo/quota-1.md:9-9` — the stamp line

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — one shell command over three files; the plan carries it.

- [ ] Step 1. Re-stamp the three Blocked entries checked this round and show the result:

```sh
sed -i 's/^stamp: 2026-10-16$/stamp: 2026-10-18/' docs/90-agent/todo/foreign-1.md docs/90-agent/todo/model-4.md docs/90-agent/todo/quota-1.md
grep -n "^stamp:" docs/90-agent/todo/foreign-1.md docs/90-agent/todo/model-4.md docs/90-agent/todo/quota-1.md
```

Each line reads `stamp: 2026-10-18` and sits on line 9.

- [ ] Step 2. Run `node scripts/todo-check.js`; it exits 0.

## Task 20: stamp `security-1`, `spend-2`

**Files:**
- Modify: `docs/90-agent/todo/security-1.md:9-9` — the stamp line
- Modify: `docs/90-agent/todo/spend-2.md:9-9` — the stamp line

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — one shell command over two files; the plan carries it.

- [ ] Step 1. Re-stamp the last two Blocked entries checked this round and show the result:

```sh
sed -i 's/^stamp: 2026-10-16$/stamp: 2026-10-18/' docs/90-agent/todo/security-1.md docs/90-agent/todo/spend-2.md
grep -n "^stamp:" docs/90-agent/todo/security-1.md docs/90-agent/todo/spend-2.md
```

Each line reads `stamp: 2026-10-18` and sits on line 9.

- [ ] Step 2. Run `node scripts/todo-check.js`; it exits 0 with the eight Blocked entries listed in Tasks 17-20 carrying today's stamp. The build parent then runs `node scripts/suite.js --fast` over the whole plan.

## Coverage

| promise | task |
|---|---|
| scripts/station.js 的 serve 處理函式把重複 21 次的 fail 寫法和 12 次的 writeHead/end 收成一個 send() | Task 4 — recounted: 21 `fail(...); return;` pairs and 13 `writeHead` triples, not 12 |
| scripts/todo-check.js 的 check 用 add(line, kind, detail) 取代 13 段 problems.push | Task 5 |
| scripts/ledger.js 的 --range 檢查從 init/complete/fix 三份合成一份 | Task 6 |
| git rev-parse --show-toplevel 的七份抄本（lib/shots.js、lib/guard.js、lib/sensitive.js、scripts/review-check.js、scripts/commit.js 兩處、scripts/residue.js）合成 lib/tracked.js 旁的 repoRoot(cwd) | Task 1 (the helper), Task 2 (sensitive, shots, review-check), Task 3 (commit twice, residue) |
| lib/guard.js 的那一份 rev-parse（七份之一） | struck — it asks `--git-common-dir` and `--show-toplevel` in one `try` under `gitTimeout()` and returns null if either fails; `repoRoot` has no timeout and answers only one of the two |
| 另有 lib/map.js 的 readIf 改用 lib/json.js 的 readText | Task 7 |
| lib/suitelock.js 的 sleep 與 lib/registry.js 的 sleepMs 合一 | Task 8 |
| hooks/pane-status.ts 只剩測試在用的 ledgerDone/planTotal | Task 9 |
| scripts/docs-audit.js:140 subjectsSince 的 limit 參數沒人用 | struck — the parameter is read (`subjects.length >= limit`) and defaults to 3; only the one call omits it, so dropping it would trade a default for a literal and save nothing |
| 每處改之前先確認呼叫端有沒有依賴原本會丟出的錯誤 | Task 2, Task 3 (Step 1 of each reads the error handling of every copy), Task 8 (Step 1 checks the require cycle) |
| 完成的標準：上面每一處都改掉或寫明不改的理由，整套測試全綠 | Task 20 — and the build parent's `scripts/suite.js --fast` after it; the two struck rows above are the reasons |
| compact.at 以 docs/01-guide/profile.md 為來源，skills/fankeel-init/SKILL.md 只留問題與指令 | Task 10 |
| title 覆寫以 docs/90-agent/reference/subagents.md 為來源，model-choice.md 只留決定與連結 | Task 11 |
| judge.js record 以 skills/fankeel-ask/SKILL.md 為來源，subagents.md 只留一句指過去 | Task 14 |
| ledger.js ready 以 skills/fankeel-build/SKILL.md 為來源 | Task 13 |
| version.js 的理由以 docs/01-guide/development.md 為來源，fankeel-land SKILL 只留三個指令 | Task 15 |
| running-agent 判定以 station.md 為來源 | Task 12 |
| seen/claims 以 collisions.md 為來源，registry.md 各留一句指標 | Task 16 |
| 完成的標準：每個機制只有一頁完整解釋，另一頁有連結指過去，docs-check 與整套測試全綠 | Tasks 10-16 — each ends with `node scripts/docs-check.js` and its own tests |
| stage-agents-10 加上 10-14 的證據並從 Blocked 移到 Watch，`if:` 是 no verdict 下次再發生 — 當場開 claude --debug 看判定走到哪 | Task 17 |
| test-8 移到 Watch，保留三個未證實的項目，README 加一句認可量耗盡的說明 | Task 18 |
| 八條 Blocked 條目（audit-1、build-1、docs-1、foreign-1、model-4、quota-1、security-1、spend-2）蓋上今天的 stamp | Task 17 (audit-1, build-1), Task 18 (docs-1), Task 19 (foreign-1, model-4, quota-1), Task 20 (security-1, spend-2) |
| 任何 TODO 編輯之後 `node scripts/todo-check.js` 必須通過 | Tasks 17-20 (last step of each) |
