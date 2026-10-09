---
status: design-intent
---

# TODO 全表盤點 Implementation Plan

**Goal:** Land the nine code and doc changes, three closures and two user decisions the 2026-10-09 TODO patrol design approved, each behind its own test or check.
**Architecture:** Eleven tasks over disjoint files. Tasks 1-9 change code, tests and pages (brief prose into the brain agent file, ledger root, suite failure names, compaction fixture, three stale pages, override timing, a dispatch gate hook, "four by default" wording, the allow-rule report); Task 10 closes and restamps TODO entries in this session; Task 11 is the user answering the gate-pane draft's open items.
**Tech Stack:** Node 24 (`node --version` v24.21.0), CommonJS, `node:test`, no dependencies; Claude Code hook JSON on stdin/stdout.
**Spec:** ../../../.fankeel/build/task-20261009T114741/design.md

## Global Constraints

- Tests: `npm test` is `node --test` (`package.json:8`). A dispatched implementer runs only its own test file — "Run only your own test command, never the full suite." (`scripts/ledger.js:144`); the parent runs the full suite before committing a group.
- No dependencies, and none may be added: `package.json` has no `dependencies` key; `CONTRIBUTING.md:36` lists "no new dependency".
- CommonJS with `'use strict';` on line 1 (`lib/render.js:1`) and `require`; no `import`.
- Indentation: 4 spaces in `lib/`, `hooks/`, `scripts/` (`lib/render.js`). Test files keep their own: `tests/brief.test.js`, `tests/render.test.js`, `tests/ledger.test.js`, `tests/suite.test.js` use 2; `tests/title-override.test.js` and `tests/detail.test.js` use 4. The two new test files use 4.
- `BRIEF_MAX = 9950` (`lib/render.js:697`); Task 1 lowers it to 9500. `REFERENCE_ROOT = 59` (`lib/render.js:634`); `sizeAtReference` at `lib/render.js:636`.
- `READ_CAP = 1500` and `FILE_CAP = 3` (`lib/plantasks.js:350-351`): at most three `Modify:` entries a task, and a file over 1500 lines is named as `path:a-b`.
- Hooks exit 0 on every path (`CONTRIBUTING.md:17`, `lib/hook.js:19-23`); a hook ends with `if (require.main === module) run(main);`.
- Every exported name needs an importer, and a new file must be `git add`ed before `tests/source.test.js` sees it (`CONTRIBUTING.md:19`).
- Reference-page frontmatter is `status` / `last_verified: YYYY-MM-DD` / `source_of_truth` (`lib/docs.js:339-341`); a page re-read and found true gets `last_verified` moved to the day (`lib/stages.js:393`).
- After editing `agents/fankeel-brain.md`, `node scripts/variants.js --base fankeel-brain` rewrites its `-high` and `-xhigh` copies; `tests/agents.test.js:494` fails while they differ (`scripts/variants.js:4-6`).
- The hook count is written in prose and recounted: `tests/contract.test.js:336-342` wants `docs/01-guide/development.md` and `tests/hook.test.js` to say "all <N> hooks" (eleven today, `docs/01-guide/development.md:65`).
- A quoted `path:line` on a reference page is checked at that exact line (`scripts/docs-check.js:375`): `docs/90-agent/reference/subagents.md:730` quotes `lib/render.js:719`, `docs/90-agent/reference/model-choice.md:52` quotes `hooks/title.js:28`, `docs/90-agent/reference/subagents.md:309` quotes `hooks/title.js:29`. Tasks 1 and 6 keep those lines where they are.
- TODO entry files are written by `scripts/todo.js` (`CONTRIBUTING.md:22`); `done` rewrites the entry in place (`lib/todo.js:495-521`).

## Risks

- The overflow fixture of `tests/brief.test.js:995` stops being over the cap at the floor once about 2,900 characters of fixed text leave the brief — Task 1 — Task 1 raises its `'x'.repeat(1500)` to `5000` and keeps `text.length > BRIEF_MAX` at line 1000 asserted.
- A net line change above `lib/render.js:719` breaks the quoted citation at `docs/90-agent/reference/subagents.md:730` — Task 1 — its replacements are line-for-line (six for six, four for four), checked with `grep -n` before commit.
- `registry.rootFor` reads `CLAUDE_PROJECT_DIR` before `cwd` (`lib/registry.js:68-70`), so a test run with it set would write ledgers into that directory — Task 2 — the test file deletes it from `process.env` at the top.
- `tests/suite.test.js:32-33` `deepEqual` the whole `parseTap` result — Task 3 — both lines gain `failed: []`.
- The compaction summary reaches the replay through `promptOf` in `lib/replay.js:49-63`, a file no task owns — Task 4 — the fix nulls summary lines in `lib/detail.js` before `replay.eventsOf`, keeping indices aligned.
- No hook here has read `tool_use_id` from a PreToolUse payload, and whether a message's sibling Agent blocks are on disk when the fifth call's hook fires is unverified — Task 7 — `positionOf` finds the call by id when present and otherwise counts the open assistant message's blocks plus one; the test proves both shapes.
- `tests/guard.test.js:677` takes the first `Agent|Task` entry and expects `hooks/guard.js` — Task 7 — the new entry goes after the `hooks/title.js` entry.
- `skills/fankeel-verify/SKILL.md:178` and `skills/fankeel-audit/SKILL.md:226` also call four the ceiling; they are outside the design's list and Task 8's `FILE_CAP` — Task 8 — left as they are and named in Task 8's commit message.
- `approved` is not a status `lib/docs.js:411` reads as intent, so that value would have the gate-pane page audited as current — Task 11 — it writes `status: planned` plus `approved: 2026-10-09` instead.
- `FILE_CAP` (3) and the rule that `Files:` lists every file a step writes conflict in two tasks — Task 1 (two generated variant files) and Task 10 (fourteen restamped entries) — `FILE_CAP` wins, each task's prose under its Dispatch line names the files, and `ledger.js lint` stays the check.

## Task 1: Brief prose out

**Files:**
- Modify: `lib/render.js:560-740` — the four build-only rule lines at 589-594 become three path lines; "four by default" at 586; `BRIEF_MAX` 9500 measured with `sizeAtReference`
- Modify: `agents/fankeel-brain.md` — new `## On a build stage` section holding the moved rules; "four by default" at 90-91
- Read: `scripts/variants.js` — rewrites the -high and -xhigh copies from the base agent file
- Test: `tests/brief.test.js`
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: none
- Produces: `## On a build stage` in agents/fankeel-brain.md; brief lines `group report:`, `commit file:`, `floor model:`; `BRIEF_MAX` 9500 compared against `sizeAtReference` inside `fit`

**Dispatch:** implementer, sonnet, high — the brief wording is pinned by the 2026-09-19 and 2026-09-28 designs and has to be re-pointed to the agent file without changing what it means.

Step 3 also rewrites the brain agent's -high and -xhigh variant files through the variants script, and step 5 commits them; FILE_CAP (3) keeps the two generated copies off the Modify list above, and the Risks line names that ruling.

1. Write the failing tests. In `tests/brief.test.js`, line 14 imports `sizeAtReference` too, and after `briefFor` (line 75) add:

   ```js
   // The build brain's fixed rules, from its agent file with the line wraps
   // flattened, so a regex written against one brief line matches a wrapped paragraph.
   const brainRules = () => fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-brain.md'), 'utf8').replace(/\s+/g, ' ');
   ```

   In `tests/brief.test.js`, after the test ending at line 538, add:

   ```js
   // brief-4: with the build rules in agents/fankeel-brain.md, the bare build
   // brain brief is its paths and sits well under the cap.
   test('a bare build brain brief is under 7,000 characters at the reference root', () => {
     const text = briefFor('build');
     assert.ok(sizeAtReference(text) < 7000, 'build brain brief is ' + sizeAtReference(text) + ' chars at the reference root');
   });
   ```

   Re-point in `tests/brief.test.js` (line numbers before the edit):
   - 126 and 128: `assert.match(text, …)` becomes `assert.match(brainRules(), …)`, regexes unchanged; 127 becomes `assert.match(text, /group report: \S*build-g1\.md instead of \S*build\.md/);`.
   - 129, 369, 537, 567, 1044: `assert.ok(text.length <= BRIEF_MAX, …)` becomes `assert.ok(sizeAtReference(text) <= BRIEF_MAX, 'brain brief is ' + sizeAtReference(text) + ' chars at the reference root');`.
   - 497: `assert.match(brainRules(), /You cannot commit: `git commit` and `git add` are refused to you\. Ask for a commit only when none of your implementers is still running[^\n]*write the commit file[^\n]*return `commit <that path>` and nothing else\. The controller commits and messages you `<base>\.\.<sha>`/);` — 498 stays on `build`.
   - 499: `assert.match(brainRules(), /You have no Edit\. A task whose Dispatch line says in-session goes to `fankeel:fankeel-implementer` on the floor model your brief names, like any other: send it the task's brief\./);` plus `assert.match(build, /floor model: `sonnet`/);`.
   - 500, 759, 760: `build` becomes `brainRules()`, regexes unchanged; 761 becomes `assert.match(brainRules(), /a line `---` between blocks, under a first line `into <path>` when your brief has a `worktree:` line/);`.
   - 520: `assert.match(brief('build', { 'dispatch.floor': 'opus' }), /floor model: `opus`/);`.
   - 776-780 and 782: `build` becomes `brainRules()`; 781 stays on `build` (that text is `lib/stages.js:721` through the dispatch line).
   - 796: `build` becomes `brainRules()`.
   - 899: `assert.match(brainRules(), /Neither — a bare `build`, a verify rework's included: do what is still open, then close as `build close` does: the full suite, then the report and gate to the handoff file\./);` plus `assert.match(text, /Write your report to \S*\/build-2\.md/);`.
   - 995: `'x'.repeat(1500)` becomes `'x'.repeat(5000)` — about 2,900 characters of fixed text leave, and line 1000 still needs the brief over the cap at the floor.

   In `tests/render.test.js`, replace the test at lines 937-945 with:

   ```js
   test('a build brain\'s agent file says beside both the group return and the close return to return only once every implementer has returned', () => {
     const file = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-brain.md'), 'utf8').replace(/\s+/g, ' ');
     const from = file.indexOf('Your prompt names your case');
     assert.ok(from >= 0, 'the group-and-close rule is missing from agents/fankeel-brain.md');
     const rule = file.slice(from, file.indexOf('Neither —', from));
     assert.equal(rule.split('once every implementer you sent has returned').length - 1, 2, 'one for the group return, one for the close return');
   });
   ```
2. Run `node --test tests/brief.test.js tests/render.test.js` and watch the re-pointed and new tests fail.
3. Write the implementation. In `lib/render.js`, replace lines 589-594 — six lines for six, so line 719 stays line 719 — with:

   ```js
           // The rules are agents/fankeel-brain.md's `## On a build stage`; only what varies is here.
           const groupHandoff = rel(handoffPath(root, data, stage, undefined, group));
           const commit = rel(commitPath(root, data, stage, undefined, group));
           lines.push('  - group report: ' + groupHandoff + ' instead of ' + handoff + ' — the rules for it, the commit file and the floor model are your agent file\'s `## On a build stage`.');
           lines.push('  - commit file: ' + commit + ' — return `commit ' + commit + '` once it is written.');
           lines.push('  - floor model: `' + profile.values['dispatch.floor'] + '` — an in-session task\'s implementer goes out on it.');
   ```

   In `lib/render.js` line 586, `with the Agent tool, at most four in one response,` becomes `with the Agent tool, four by default in one response,`. Replace lines 693-698 — four comment lines for four — with:

   ```js
   // touched paths; nothing else. Measured at the 59-character reference root
   // (sizeAtReference), so a worktree's longer plugin root does not move it
   // (brief-5); the build brain's fixed rules live in agents/fankeel-brain.md
   // (brief-4), which put its bare brief under 7,000 and the cap back at 9,500.
   const BRIEF_MAX = 9500;
   const size = (lines) => sizeAtReference(lines.join('\n'));
   ```

   In `agents/fankeel-brain.md`, insert before `## Refusals` (line 123), after the blank line 122:

   ```md
   ## On a build stage

   Your brief names three things these rules use: the group report file, the
   commit file and the floor model.

   - Your prompt names your case: task numbers for a group, or `build close`.
     A group: only those tasks, no `json gate` block, the report to the group
     report file instead of the handoff file, returned once every implementer
     you sent has returned; a fresh brain continues. `build close`: the full
     test suite first, then the report and gate your brief describes — the
     only gate this whole stage asks, once every implementer you sent has
     returned. Neither — a bare `build`, a verify rework's included: do what is
     still open, then close as `build close` does: the full suite, then the
     report and gate to the handoff file.
   - You cannot commit: `git commit` and `git add` are refused to you. Ask for
     a commit only when none of your implementers is still running, never per
     task: then write the commit file — one block per task that returned since
     the last commit, the paths it owns one per line, a blank line, then its
     commit message, and a line `---` between blocks, under a first line
     `into <path>` when your brief has a `worktree:` line — and return
     `commit <that path>` and nothing else. The controller commits and messages
     you `<base>..<sha>` per block — `<paths>: <base>..<sha>` when there are
     several — each that task's review range; where the skill says to commit,
     this is it. Paths are relative to the repository root. The reply is those
     lines, or `commit.js: <why>` (`commit.js: block <n>: <why>` after the
     blocks that landed). A line `profile: <file> does not parse — its values
     were skipped` is a warning: name it in your report. A <why> about your
     file or the paths you listed (a malformed file, a path git refused,
     nothing to commit): fix it and ask again; the same error twice, or any
     other <why> (no repository, a hook or git's own refusal, usage), blocks
     the stage: say so in the report. Return the report path when the whole
     stage is done or blocked.
   - Send every implementer with `isolation: "worktree"`, and ask
     `ledger.js --plan <f> ready --worktree` what goes out: there two tasks
     sharing a file may run at once. In the commit file, the first line of its
     task's block is `worktree <path>`, the path its Agent result names. A
     reply `conflict <paths>` (or `<paths>: conflict <paths>`) means that task
     is not in HEAD: dispatch it once more, fresh, on the new HEAD, without
     asking. The same task conflicting a second time: stop the build and name
     those paths in your report. `kept <path> — <why>` after a range: the
     worktree stayed; name it in your report. Before you dispatch, run
     `git rev-parse HEAD` yourself and tell every worktree-isolated
     implementer, before its first edit, to run `git reset --hard <that sha>`
     in its own worktree: `isolation: "worktree"` bases it on `origin/main`,
     and this repository is never pushed.
   - You have no Edit. A task whose Dispatch line says in-session goes to
     `fankeel:fankeel-implementer` on the floor model your brief names, like
     any other: send it the task's brief. One whose Dispatch line says user is
     not yours to send: `ledger.js ready` never lists it, the controller runs
     it with the user after your report, and your report names it on a line
     `hands: <n>, <n>`.

   ```

   In `agents/fankeel-brain.md` lines 90-91, `at most` / `four in one response` becomes `four by` / `default in one response`. Then run `node scripts/variants.js --base fankeel-brain`.
4. Run `node --test tests/brief.test.js tests/render.test.js tests/agents.test.js` and watch it pass; `grep -n "' older ' + (n === 1" lib/render.js` prints `719:`.
5. Commit `lib/render.js`, `agents/fankeel-brain.md`, the two variant files the script rewrote, `tests/brief.test.js`, `tests/render.test.js`: "brief: build rules move to the brain agent file; cap 9500 at the reference root (brief-4, brief-5)".

## Task 2: Ledger root

**Files:**
- Modify: `scripts/ledger.js` — line 501 resolves the root through the registry
- Read: `lib/registry.js` — `rootFor` (131) and `resolveRoot` (120), as `scripts/task.js:255-258` calls them
- Test: `tests/ledger.test.js`

**Interfaces:**
- Consumes: `registry.rootFor`, `registry.resolveRoot` (lib/registry.js, unchanged)
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus a test.

1. Write the failing test. In `tests/ledger.test.js`, beside line 22's `process.env.CLAUDE_CONFIG_DIR = …`, add `delete process.env.CLAUDE_PROJECT_DIR;` with the comment `// rootFor reads it before cwd (lib/registry.js:68-70).`, and at the end of the file add:

   ```js
   // build-9: run from a worktree under the registry root, the ledger lands
   // beside the registry, not in the worktree that land will remove.
   test('ledger.js run from a worktree under the registry root writes the ledger beside the registry', () => {
     const main = root();
     fs.mkdirSync(path.join(main, '.fankeel', 'sessions'), { recursive: true });
     const wt = path.join(main, '.fankeel', 'worktrees', 'abcd1234');
     fs.mkdirSync(wt, { recursive: true });
     execFileSync(process.execPath, [SCRIPT, '--plan', 'docs/p.md', 'ruling', 'use the helper', 'one extractor', 'a rewrite'], { cwd: wt, encoding: 'utf8' });
     assert.ok(fs.existsSync(path.join(main, '.fankeel', 'build', 'p', 'progress.md')), 'the ledger is beside the registry');
     assert.equal(fs.existsSync(path.join(wt, '.fankeel', 'build', 'p', 'progress.md')), false, 'no second ledger in the worktree');
   });
   ```
2. Run `node --test tests/ledger.test.js` and watch the new test fail: the ledger is under the worktree.
3. Write the implementation. In `scripts/ledger.js`, replace line 501 with:

   ```js
       // The registry's root, found as scripts/task.js rootOf finds it: run from
       // a worktree under it, the ledger lands beside the registry (build-9).
       const root = opts.root ? registry.resolveRoot(opts.root) : registry.rootFor({ cwd: process.cwd() });
   ```
4. Run `node --test tests/ledger.test.js` and watch it pass.
5. Commit `scripts/ledger.js`, `tests/ledger.test.js`: "ledger: resolve the root through the registry, so a worktree writes the main ledger (build-9)".

## Task 3: Suite failed names

**Files:**
- Modify: `lib/suite.js` — `parseTap` (18) collects leaf `not ok` names; `runSuite` records `failed`
- Test: `tests/suite.test.js`

**Interfaces:**
- Consumes: none
- Produces: `parseTap(text)` returning `{ pass, fail, failed }`; `failed` on the `runSuite` result and in `suite.json`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing tests. In `tests/suite.test.js`, lines 32-33 expect `{ pass: 12, fail: 1, failed: [] }` and `{ pass: null, fail: null, failed: [] }`. After the test that opens at line 36 and ends at line 47, add:

   ```js
   test('parseTap keeps the leaf name of each not ok line, not its failing parent, and no TODO', () => {
     const tap = ['    not ok 1 - leaf one', '    ok 2 - leaf ok', 'not ok 1 - outer', 'not ok 2 - a', 'not ok 3 - b # TODO', '# pass 1', '# fail 3'].join('\n');
     assert.deepEqual(suite.parseTap(tap).failed, ['leaf one', 'a']);
   });

   test('a red run records the failing test names in suite.json, a green one none', () => {
     const dir = repo();
     assert.deepEqual(suite.runSuite(dir, 'node --test').failed, []);
     fs.writeFileSync(path.join(dir, 'a.test.js'), RED);
     const red = suite.runSuite(dir, 'node --test');
     assert.deepEqual(red.failed, ['a']);
     const file = suite.record(dir, DATA, red);
     assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).failed, ['a']);
   });
   ```
2. Run `node --test tests/suite.test.js` and watch them fail.
3. Write the implementation. In `lib/suite.js`, replace `parseTap` (lines 18-22) with:

   ```js
   // `failed` is the name on every `not ok` line that is a leaf: node prints a
   // parent's result after its children's, so a test point whose previous test
   // point sat deeper is a parent. A `# TODO` or `# SKIP` does not fail the run.
   function parseTap(text) {
       const pass = /^# pass (\d+)/m.exec(text);
       const fail = /^# fail (\d+)/m.exec(text);
       const failed = [];
       let prev = -1;
       for (const line of String(text).split(/\r?\n/)) {
           const point = /^(\s*)(not )?ok \d+ - (.+)$/.exec(line);
           if (!point) continue;
           const indent = point[1].length;
           if (point[2] && indent >= prev && !/\s#\s*(TODO|SKIP)\b/i.test(point[3])) failed.push(point[3]);
           prev = indent;
       }
       return { pass: pass ? Number(pass[1]) : null, fail: fail ? Number(fail[1]) : null, failed };
   }
   ```

   In `lib/suite.js` `runSuite`, the totals line becomes `const totals = isNode ? parseTap(String(r.stdout || '')) : { pass: null, fail: null, failed: null };` and the returned object gains `failed: totals.failed` after `fail`; the header comment at lines 7-9 reads `{ sha, at, command, pass, fail, failed, ok }` and says `failed` is the leaf names of the `not ok` lines, null for another runner.
4. Run `node --test tests/suite.test.js` and watch it pass.
5. Commit `lib/suite.js`, `tests/suite.test.js`: "suite: record the failing test names in suite.json (tests-5)".

## Task 4: Station after compaction

**Files:**
- Modify: `lib/detail.js` — `extract` (596) and `VERSION` (543), only where the fixture finds a mismatch
- Read: `lib/usage.js` — `entriesOf`, `turnIndex`, `summarise`, `dispatchesOf`
- Read: `lib/replay.js` — `promptOf` (49-63) reads a summary's string content as a prompt
- Test: `tests/detail-compact.test.js`

**Interfaces:**
- Consumes: `detail.detailOf(configDir, sessionId, data)` (lib/detail.js, unchanged signature)
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the fixture and the one predicted fix.

1. Write the failing test, a new `tests/detail-compact.test.js`:

   ```js
   'use strict';
   // station-17: a compacted session keeps every line from before the
   // compaction (lib/conversation.js:4-6), so the station's detail reads the
   // whole transcript. One compact_boundary and one isCompactSummary line: the
   // summary is not a prompt the user typed, the context curve drops at the
   // boundary, and a dispatch made before it is still listed.
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const detail = require('../lib/detail.js');
   const tmp = require('./tmp.js');

   const SID = 'cccccccc-0000-4000-8000-000000000017';
   const T = (s) => '2026-10-08T10:00:' + String(s).padStart(2, '0') + '.000Z';
   const ask = (s, text) => ({ type: 'user', timestamp: T(s), message: { role: 'user', content: text } });
   const said = (rid, s, input, content) => ({ type: 'assistant', requestId: rid, timestamp: T(s),
       message: { id: 'msg_' + rid, model: 'claude-opus-5-5', usage: { input_tokens: input, output_tokens: 10 }, content } });

   const LINES = [
       ask(1, 'fix the ramp'),
       said('r1', 2, 150000, [{ type: 'tool_use', id: 'toolu_a', name: 'Agent', input: { subagent_type: 'fankeel:fankeel-reader', description: 'read the map', prompt: 'p' } }]),
       { type: 'user', timestamp: T(3), message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_a', content: 'the map says x' }] } },
       said('r2', 4, 180000, [{ type: 'text', text: 'done reading' }]),
       { type: 'system', subtype: 'compact_boundary', timestamp: T(5), content: '', isMeta: false, compactMetadata: { trigger: 'manual', preTokens: 180000 } },
       { type: 'user', timestamp: T(6), isCompactSummary: true, isVisibleInTranscriptOnly: true,
           message: { role: 'user', content: 'This session is being continued from a previous conversation that ran out of context.' } },
       ask(7, 'go on'),
       said('r3', 8, 20000, [{ type: 'text', text: 'going on' }]),
   ];

   function read() {
       const cfg = tmp('fankeel-detail-compact-');
       const dir = path.join(cfg, 'projects', 'F--some-project');
       fs.mkdirSync(dir, { recursive: true });
       fs.writeFileSync(path.join(dir, SID + '.jsonl'), LINES.map((l) => JSON.stringify(l)).join('\n') + '\n');
       return detail.detailOf(cfg, SID, { route: ['build'], stage: 'build' }).detail;
   }

   test('a compaction summary is not counted as a prompt the user typed', () => {
       const d = read();
       assert.deepEqual(d.events.filter((e) => e.kind === 'prompt').map((e) => e.text), ['fix the ramp', 'go on']);
       assert.equal(d.requests, 3);
   });

   test('the context curve drops at the compaction boundary', () => {
       const d = read();
       assert.deepEqual(d.points.map((p) => p.y), [150000, 180000, 20000]);
       assert.ok(d.points[2].y < d.points[1].y);
   });

   test('a dispatch made before the compaction is still listed', () => {
       const d = read();
       assert.equal(d.dispatches.length, 1);
       assert.equal(d.dispatches[0].text, 'read the map');
       assert.equal(d.dispatches[0].turn, 1);
   });
   ```
2. Run `node --test tests/detail-compact.test.js`. Expected: the prompt test fails (the summary appears as a third prompt); the curve and dispatch tests pass. A curve or dispatch failure is a mismatch this plan did not predict: fix it in `extract` only and name it in the commit message.
3. Write the minimal fix for the prompt mismatch. In `lib/detail.js` `extract`, replace `const replayed = replay.eventsOf(entries, { commands, dispatches: found.dispatches, turnAt });` (line 639) with:

   ```js
       // A compaction's summary is a `user` line Claude Code wrote, not a prompt
       // (`isCompactSummary`, read the same way in lib/conversation.js). Nulled
       // rather than removed, so `turnAt`'s indices still line up.
       const typed = entries.map((e) => (e && e.isCompactSummary === true ? null : e));
       const replayed = replay.eventsOf(typed, { commands, dispatches: found.dispatches, turnAt });
   ```

   In `lib/detail.js` lines 542-543 the cache version moves so cached details are read again:

   ```js
   // 7 carries the main session's `effort`; 8 adds per-day `estimated`; 9 stops reading a compaction summary as a prompt.
   const VERSION = 9;
   ```
4. Run `node --test tests/detail-compact.test.js tests/detail.test.js` and watch both pass. No compaction marker is added to the panel.
5. `git add tests/detail-compact.test.js`, then commit it with `lib/detail.js`: "detail: a compaction summary is not a prompt; fixture for compacted sessions (station-17)".

## Task 5: Pages behind the code

**Files:**
- Modify: `skills/fankeel-explain/SKILL.md` — reread against lib/plain.js, `last_verified`
- Modify: `skills/fankeel-station/SKILL.md` — reread against scripts/station.js, `last_verified`
- Modify: `docs/README.md` — reread against scripts/bench.js, `last_verified`
- Read: `lib/plain.js` — commits cb967f2f and 0591d21d
- Read: `scripts/station.js` — commits ee59eba4, 49abfa55, d5a8f499
- Read: `scripts/bench.js` — commits ea5429d5, 1e2b82fd, 9205304c
- Read: `lib/launchers.js` — the `station.bat` and `station.sh` lines (25-26)

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — a reread against named commits; no code changes.

1. Run `node scripts/docs-audit.js` and see the three pages under "have fallen behind the code they describe".
2. Reread `skills/fankeel-explain/SKILL.md:89-96` (Controlled Chinese) against `lib/plain.js:12` (`MAX_SENTENCE_WIDTH = 160`), `proseProblem` (56-79) and `todoIds` (119-127, the 0591d21d warning when the TODO cannot be read). At plan time every sentence held; a sentence found false is rewritten to what the code does, naming the function.
3. Reread `skills/fankeel-station/SKILL.md:12-29` against `scripts/station.js` (`serve --open`; a running station joined, and 49abfa55's busy station not started twice) and `lib/launchers.js:25-26` (`serve --detach --open --root`). The page sends routes to the station reference page, so d5a8f499's `/chartroom/<project>/` forward is not a gap here. Reread `docs/README.md` rows 359-377 and 447 against `scripts/bench.js` and the `bench/` listing (`add-feature`, `drift`, `fix-bug`, `review-planted`, `roles`). Correct any false sentence the same way.
4. Set the date on all three: `sed -i 's/^last_verified: .*/last_verified: 2026-10-09/' skills/fankeel-explain/SKILL.md skills/fankeel-station/SKILL.md docs/README.md`, then run `node scripts/docs-audit.js` and check none of the three is listed under fallen behind.
5. Commit the three pages: "docs: explain, station and the index reread against plain.js, station.js and bench.js (docs-4)".

## Task 6: Override timing

**Files:**
- Modify: `hooks/title.js` — leave the name and model pin alone for an override newer than this session's process
- Modify: `scripts/task.js:1105-1125` — `profile set` on an agent key prints that a new terminal is needed
- Modify: `docs/90-agent/reference/subagents.md` — the override paragraph (305-314) and "four by default" (324-328)
- Read: `lib/live.js` — `runningSessions(configDir)` (90-108), `startedAt`
- Read: `lib/title.js` — `agentFileOf` (87-98), `overrideFor` (106-121)
- Test: `tests/title-override.test.js`

**Interfaces:**
- Consumes: `runningSessions` (lib/live.js, unchanged)
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing tests. In `tests/title-override.test.js`, the require line becomes `const { spawnSync, execFileSync } = require('node:child_process');`, and after the test that ends at line 49 add:

   ```js
   const SID = 'aaaaaaaa-0000-4000-8000-000000000001';
   const TASK = path.join(__dirname, '..', 'scripts', 'task.js');

   // title-4: Claude Code's sessions/<pid>.json for this session, started at `ms`.
   function started(f, ms) {
       const dir = path.join(f.dir, 'config', 'sessions');
       fs.mkdirSync(dir, { recursive: true });
       fs.writeFileSync(path.join(dir, process.pid + '.json'), JSON.stringify({ pid: process.pid, sessionId: SID, cwd: f.dir, startedAt: ms }));
   }
   const written = (f) => fs.statSync(path.join(f.dir, '.claude', 'agents', 'fankeel-reader.md')).mtimeMs;

   test('an override written after this session started keeps fankeel:fankeel-reader and says a new terminal is needed', () => {
       const f = fixture(MARKED);
       started(f, written(f) - 60000);
       const out = fire({ ...dispatch(f, 'read the map'), session_id: SID }, f.dir);
       assert.equal(out.hookSpecificOutput.updatedInput.subagent_type, 'fankeel:fankeel-reader');
       assert.equal(out.hookSpecificOutput.updatedInput.description, 'sonnet · medium: read the map');
       assert.match(out.systemMessage, /new terminal/);
   });

   test('an override written before this session started is still taken', () => {
       const f = fixture(MARKED);
       started(f, written(f) + 60000);
       const out = fire({ ...dispatch(f, 'read the map'), session_id: SID }, f.dir);
       assert.equal(out.hookSpecificOutput.updatedInput.subagent_type, 'fankeel-reader');
       assert.equal(out.systemMessage, undefined);
   });

   test('profile set on an agent key says a new terminal is needed', () => {
       const d = tmp('title-override-set-');
       const cfg = path.join(d, 'cfg');
       const out = execFileSync(process.execPath, [TASK, 'profile', 'set', 'agent.fankeel-reader.model', 'haiku', '--root', d, '--claude-dir', cfg],
           { encoding: 'utf8', cwd: d, env: { ...process.env, CLAUDE_CONFIG_DIR: cfg } });
       assert.match(out, /new terminal/);
   });
   ```
2. Run `node --test tests/title-override.test.js` and watch the first and third fail.
3. Write the implementation. In `hooks/title.js`, lines 1-27 and 29 stay exactly as they are (docs quote lines 28 and 29), and line 28 becomes:

   ```js
       const { bare, late } = unlessLate(overrideFor(input.subagent_type, payload.cwd, configDir), payload, configDir);
   ```

   In `hooks/title.js`, the end of `main()` (lines 45-49) becomes:

   ```js
       const description = prefix === null ? input.description : retitle(input.description, prefix);
       const notice = late ? 'fankeel: ' + late + ' was written after this session started, and Claude Code reads agent files only when it starts — sent as ' + input.subagent_type + '. Open a new terminal for the override to take effect.' : null;
       if (!bare && !notice && description === input.description && next.model === input.model) return;
       process.stdout.write(JSON.stringify(Object.assign(notice ? { systemMessage: notice } : {}, {
           hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { ...next, description } },
       })));
   ```

   In `hooks/title.js`, between `main()` and the `require.main` line, add (`generated` then finds nothing, so the model pin is skipped too):

   ```js
   // title-4: Claude Code reads agent files when its process starts, so an
   // override written after this session's process started is not a name it
   // can send to yet. The start is `startedAt` from `runningSessions` in
   // lib/live.js; the file is found where lib/title.js agentFileOf looks. The
   // requires sit here so the lines docs cite in main() keep their numbers.
   function unlessLate(bare, payload, configDir) {
       if (!bare) return { bare: null, late: null };
       const fs = require('node:fs');
       const { runningSessions } = require('../lib/live.js');
       const file = [payload.cwd && path.join(payload.cwd, '.claude', 'agents', bare + '.md'), path.join(configDir, 'agents', bare + '.md')]
           .find((f) => f && fs.existsSync(f));
       const me = (runningSessions(configDir) || []).find((s) => s.sessionId === payload.session_id);
       if (!file || !me || !Number.isFinite(me.startedAt)) return { bare, late: null };
       let mtime;
       try { mtime = fs.statSync(file).mtimeMs; } catch (e) { return { bare, late: null }; }
       return mtime > me.startedAt ? { bare: null, late: file } : { bare, late: null };
   }
   ```

   In `scripts/task.js` line 1117, the agent branch returns one more line:

   ```js
               return head + '\n' + agentfile.syncLine(agentfile.syncAgent({ pluginRoot: PLUGIN, profileFile: file, agentsDir, name: agent.name, version: pluginVersion() }))
                   + '\nClaude Code reads agent files when a session starts: a session already running keeps sending fankeel:' + agent.name + ' — open a new terminal for this to take effect.';
   ```

   In `docs/90-agent/reference/subagents.md`, after line 314's `…is the user's own and keeps the named model;`, add:

   ```md
   an override whose file is newer than this session's process — its mtime later than the session's
   `startedAt` in Claude Code's `sessions/<pid>.json`, read by `runningSessions` in `lib/live.js` — is left
   alone, name and model both, because Claude Code reads agent files only when it starts: the hook sends
   the dispatch under `fankeel:<name>` and tells the user a new terminal is needed, and
   `task.js profile set agent.<name>.*` says the same when it writes the file;
   ```

   In `docs/90-agent/reference/subagents.md`, line 324 `Four in one response is the working ceiling, and the reason` becomes `Four in one response is the default, not a cap, and the reason`, and line 328 `one shape the ceiling cannot cover` becomes `one shape the default cannot cover`.
4. Run `node --test tests/title-override.test.js tests/title-hook.test.js tests/agentfile.test.js` and watch it pass; `sed -n 28,29p hooks/title.js` still shows `overrideFor(input.subagent_type` and `const next = bare ? { ...input, subagent_type: bare } : { ...input };`.
5. Commit `hooks/title.js`, `scripts/task.js`, `docs/90-agent/reference/subagents.md`, `tests/title-override.test.js`: "title: an override newer than the process is not swapped in; say a new terminal is needed (title-4)".

## Task 7: Dispatch gate

**Files:**
- Modify: `hooks/dispatch-gate.js` — new: PreToolUse on Agent and Task, `ask` at the fifth call in one assistant message
- Modify: `.claude-plugin/plugin.json` — one `Agent|Task` PreToolUse entry after the title.js entry (139-149)
- Modify: `docs/01-guide/development.md` — line 65 "all eleven" becomes "all twelve"
- Read: `lib/handoff.js` — `pendingTool` (499-518) groups tool_use blocks by `message.id`; `tailEntries` (468)
- Read: `lib/registry.js` — `spendOf` (583), `rootFor` (131), `readSession`
- Read: `lib/prices.js` — `costOf`
- Read: `lib/bench.js` — `roleTally` (477-512): `arms[]` with `roleUsd` and `runs`
- Read: `lib/usage.js` — `sessionDirOf` (181)
- Read: `hooks/budget.js` — a subagent's own transcript at `subagents/agent-<agent_id>.jsonl` (42)
- Read: `hooks/gate.js` — hook shape: stdin JSON, exit 0 on every path
- Read: `lib/hook.js` — `run` and `parse`, the stdin reader every hook calls
- Test: `tests/dispatch-gate.test.js`
- Test: `tests/hook.test.js`

**Interfaces:**
- Consumes: `costOf` (lib/prices.js), `spendOf`, `rootFor`, `readSession` (lib/registry.js), `sessionDirOf` (lib/usage.js)
- Produces: `positionOf(entries, toolUseId)` → number; `benchPerDispatch(evidenceRoot, role, model)` → `{ usd, batch }` or null; `spentSoFar(data)` → number or null; `decide(payload, { data, evidenceRoot })` → `{ reason }` or null — all exported from hooks/dispatch-gate.js

**Dispatch:** implementer, sonnet, high — whether a message's sibling Agent calls are on disk when the fifth call's hook fires is unverified, so the counting has to be reasoned about against the transcript shape and proved in the test.

1. Write the failing test, a new `tests/dispatch-gate.test.js`:

   ```js
   'use strict';
   // dispatch-1: four Agent calls in one response is the default; the fifth and
   // later in the same assistant message are asked of the user, with a figure.
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { spawnSync } = require('node:child_process');
   const tmp = require('./tmp.js');
   const { costOf } = require('../lib/prices.js');
   const { positionOf, benchPerDispatch, spentSoFar, decide } = require('../hooks/dispatch-gate.js');

   const HOOK = path.join(__dirname, '..', 'hooks', 'dispatch-gate.js');
   const SID = 'aaaaaaaa-0000-4000-8000-000000000001';

   // One transcript line per content block: five Agent calls in one response
   // are five assistant lines sharing message.id.
   const agentLine = (i, mid) => ({ type: 'assistant', message: { id: mid || 'msg_01', model: 'claude-opus-5-5',
       content: [{ type: 'tool_use', id: 'toolu_' + i, name: 'Agent', input: { subagent_type: 'fankeel:fankeel-reader', description: 'read ' + i, prompt: 'p' } }] } });
   const resultLine = (i) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_' + i, content: 'ok' }] } });
   const five = [1, 2, 3, 4, 5].map((i) => agentLine(i));

   function transcript(dir, entries) {
       const file = path.join(dir, SID + '.jsonl');
       fs.writeFileSync(file, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
       return file;
   }

   function evidence(dir, roleUsd, runs) {
       const batch = path.join(dir, 'evidence', '2026-10-09-haiku-bank-drift', 'role-reader-20261009T033513');
       fs.mkdirSync(batch, { recursive: true });
       fs.writeFileSync(path.join(batch, 'summary.json'), JSON.stringify({ arms: [{ role: 'reader', arm: 'haiku', runs, valid: runs, passed: runs, roleUsd, relayUsd: 0 }] }));
       return path.join(dir, 'evidence');
   }

   const payload = (file, id) => ({ hook_event_name: 'PreToolUse', session_id: SID, transcript_path: file, tool_name: 'Agent', tool_use_id: id,
       tool_input: { subagent_type: 'fankeel:fankeel-reader', model: 'haiku', description: 'read', prompt: 'p' } });

   test('positionOf counts the Agent calls sharing message.id, found by the call\'s own id', () => {
       assert.equal(positionOf(five, 'toolu_5'), 5);
       assert.equal(positionOf(five, 'toolu_4'), 4);
       assert.equal(positionOf([agentLine(9, 'msg_00'), resultLine(9)].concat(five), 'toolu_2'), 2);
   });

   test('positionOf, with the call not on disk yet, is the next block of an open message or the first of a new one', () => {
       assert.equal(positionOf(five.slice(0, 4), 'toolu_new'), 5);
       assert.equal(positionOf(five.slice(0, 4), undefined), 5);
       assert.equal(positionOf(five.slice(0, 4).concat([resultLine(1)]), 'toolu_new'), 1);
       assert.equal(positionOf([], 'toolu_new'), 1);
   });

   test('the fifth Agent call in one message is asked, with the bench figure when no spend is recorded', () => {
       const dir = tmp('fankeel-dispatch-gate-');
       const root = evidence(dir, 0.05, 5);
       assert.deepEqual(benchPerDispatch(root, 'reader', 'haiku'), { usd: 0.01, batch: 'role-reader-20261009T033513' });
       const out = decide(payload(transcript(dir, five), 'toolu_5'), { data: null, evidenceRoot: root });
       assert.match(out.reason, /Agent call 5 in one response/);
       assert.match(out.reason, /\$0\.050 for these 5 dispatches/);
   });

   test('four Agent calls in one message produce nothing', () => {
       const dir = tmp('fankeel-dispatch-gate-');
       const file = transcript(dir, five.slice(0, 4));
       for (const id of ['toolu_1', 'toolu_4']) assert.equal(decide(payload(file, id), { data: null, evidenceRoot: evidence(dir, 0.05, 5) }), null);
   });

   test('with spend recorded the figure is the registry spend priced by lib/prices.js', () => {
       const models = { 'claude-sonnet-5-5': { input: 1000000, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } };
       const data = { spend: { build: { requests: 0, models: {}, subagents: { requests: 3, models } } } };
       const usd = costOf(models).usd;
       assert.equal(spentSoFar(data), usd);
       assert.equal(spentSoFar({}), null);
       const dir = tmp('fankeel-dispatch-gate-');
       const out = decide(payload(transcript(dir, five), 'toolu_5'), { data, evidenceRoot: evidence(dir, 0.05, 5) });
       assert.ok(out.reason.includes('$' + usd.toFixed(2) + ' so far'), out.reason);
   });

   test('as a hook: the fifth call prints ask with its reason, the fourth prints nothing, both exit 0', () => {
       const dir = tmp('fankeel-dispatch-gate-');
       const fire = (entries, id) => spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload(transcript(dir, entries), id)), encoding: 'utf8',
           env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
       const asked = fire(five, 'toolu_5');
       assert.equal(asked.status, 0);
       const h = JSON.parse(asked.stdout).hookSpecificOutput;
       assert.equal(h.hookEventName, 'PreToolUse');
       assert.equal(h.permissionDecision, 'ask');
       assert.match(h.permissionDecisionReason, /Agent call 5/);
       const quiet = fire(five.slice(0, 4), 'toolu_4');
       assert.equal(quiet.status, 0);
       assert.equal(quiet.stdout, '');
   });
   ```
2. Run `node --test tests/dispatch-gate.test.js` and watch it fail: the hook does not exist.
3. Write the implementation, the new `hooks/dispatch-gate.js`:

   ```js
   #!/usr/bin/env node
   'use strict';

   // PreToolUse on `Agent|Task`: four Agent calls in one response is the
   // default, and the fifth and later in the same assistant message are asked
   // of the user first, with what they are likely to cost (dispatch-1). Claude
   // Code writes one transcript line per content block, so one message's calls
   // are the assistant lines sharing `message.id` — the grouping `pendingTool`
   // in lib/handoff.js uses. At four or fewer it writes nothing, so those calls
   // reach the user's own permission rules untouched. Exits 0 on every path.

   const fs = require('node:fs');
   const path = require('node:path');
   const { run, parse } = require('../lib/hook.js');
   const registry = require('../lib/registry.js');
   const { costOf } = require('../lib/prices.js');
   const { sessionDirOf } = require('../lib/usage.js');

   const DEFAULT = 4;
   const DISPATCH = new Set(['Agent', 'Task']);
   const TAIL = 256 * 1024;
   const EVIDENCE = path.join(__dirname, '..', 'docs', '90-agent', 'reports', 'evidence');

   // The parsed lines at the end of a transcript, read as lib/handoff.js
   // tailEntries reads them: the last TAIL bytes, a cut first line skipped.
   function tailOf(file) {
       let fd;
       try {
           fd = fs.openSync(file, 'r');
           const size = fs.fstatSync(fd).size;
           const start = Math.max(0, size - TAIL);
           const buf = Buffer.alloc(size - start);
           fs.readSync(fd, buf, 0, buf.length, start);
           const out = [];
           for (const l of buf.toString('utf8').split('\n')) {
               if (!l.trim()) continue;
               try { out.push(JSON.parse(l)); } catch (e) { /* cut or half-written */ }
           }
           return out;
       } catch (e) {
           return [];
       } finally {
           if (fd !== undefined) fs.closeSync(fd);
       }
   }

   const blocksOf = (e) => (e && e.message && Array.isArray(e.message.content) ? e.message.content : []);
   const callsIn = (e) => blocksOf(e).filter((b) => b && b.type === 'tool_use' && DISPATCH.has(b.name));
   const sameMessage = (a, b) => a === b || Boolean(a.message && b.message && a.message.id && a.message.id === b.message.id);

   // Which Agent call of its assistant message this one is, from 1. Found by
   // its own id where the transcript holds it already; otherwise it is the next
   // block of the message still being written, or the first of a new message
   // when a user line has come after the last assistant line.
   function positionOf(entries, toolUseId) {
       const assistant = entries.filter((e) => e && e.type === 'assistant');
       const owner = toolUseId ? assistant.find((e) => callsIn(e).some((b) => b.id === toolUseId)) : null;
       if (owner) {
           const calls = assistant.filter((e) => sameMessage(e, owner)).flatMap(callsIn);
           return calls.findIndex((b) => b.id === toolUseId) + 1;
       }
       let last = -1;
       entries.forEach((e, i) => { if (e && e.type === 'assistant') last = i; });
       if (last < 0 || entries.slice(last + 1).some((e) => e && e.type === 'user')) return 1;
       return assistant.filter((e) => sameMessage(e, entries[last])).flatMap(callsIn).length + 1;
   }

   // The transcript the calls are in: a subagent's own file when a subagent
   // dispatches (`agent_id`, the path hooks/budget.js reads), else the session's.
   function transcriptFor(payload) {
       const main = typeof payload.transcript_path === 'string' ? payload.transcript_path : '';
       if (!main) return null;
       if (!payload.agent_id) return main;
       const dir = sessionDirOf(main);
       return dir ? path.join(dir, 'subagents', 'agent-' + payload.agent_id + '.jsonl') : null;
   }

   // `fankeel:fankeel-reader-high` is the bench's `reader`.
   const roleOf = (type) => String(type || '').replace(/^fankeel:/, '').replace(/^fankeel-/, '').replace(/-(high|xhigh)$/, '');

   // One dispatch of `role`, from the newest bench summary that ran it:
   // `bench.js tally` writes <evidence>/<date>-*/role-<role>-<stamp>/summary.json,
   // whose `arms` carry `roleUsd` over `runs` (lib/bench.js roleTally). The arm
   // is the dispatch's own `model` where the summary ran one, else all of them.
   function benchPerDispatch(evidenceRoot, role, model) {
       const prefix = 'role-' + role + '-';
       let best = null;
       let dates;
       try { dates = fs.readdirSync(evidenceRoot); } catch (e) { return null; }
       for (const d of dates) {
           let batches;
           try { batches = fs.readdirSync(path.join(evidenceRoot, d)); } catch (e) { continue; }
           for (const b of batches) {
               if (!b.startsWith(prefix)) continue;
               if (!best || b > best.batch) best = { batch: b, file: path.join(evidenceRoot, d, b, 'summary.json') };
           }
       }
       if (!best) return null;
       let arms;
       try { arms = JSON.parse(fs.readFileSync(best.file, 'utf8')).arms; } catch (e) { return null; }
       if (!Array.isArray(arms)) return null;
       const own = arms.filter((a) => a && a.arm === model);
       const pick = own.length ? own : arms.filter(Boolean);
       const runs = pick.reduce((n, a) => n + (a.runs || 0), 0);
       const usd = pick.reduce((n, a) => n + (a.roleUsd || 0), 0);
       return runs ? { usd: usd / runs, batch: best.batch } : null;
   }

   // What this task has spent, priced by lib/prices.js from the registry's
   // `spend` — written by hooks/leave.js when a session ends, so a resumed
   // session is the one that has it — or null when no stage has any.
   function spentSoFar(data) {
       const spend = data && data.spend && typeof data.spend === 'object' ? data.spend : null;
       if (!spend) return null;
       let usd = 0;
       let any = false;
       for (const stage of Object.keys(spend)) {
           const s = registry.spendOf(data, stage);
           if (!s) continue;
           any = true;
           usd += costOf(s.models).usd + (s.subagents ? costOf(s.subagents.models).usd : 0);
       }
       return any ? usd : null;
   }

   function decide(payload, opts) {
       if (!payload || !DISPATCH.has(payload.tool_name)) return null;
       const file = transcriptFor(payload);
       if (!file) return null;
       const n = positionOf(tailOf(file), payload.tool_use_id);
       if (n <= DEFAULT) return null;
       const input = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : {};
       const role = roleOf(input.subagent_type);
       const head = 'fankeel: this is Agent call ' + n + ' in one response, past the default of four. ';
       const spent = spentSoFar(opts && opts.data);
       if (spent !== null) return { reason: head + 'This task has spent $' + spent.toFixed(2) + ' so far (registry spend, priced by lib/prices.js).' };
       const bench = benchPerDispatch(opts && opts.evidenceRoot, role, input.model);
       if (bench) return { reason: head + 'About $' + (bench.usd * n).toFixed(3) + ' for these ' + n + ' dispatches: $' + bench.usd.toFixed(4) + ' each for ' + role + ' in ' + bench.batch + '.' };
       return { reason: head + 'No figure: no stage has recorded spend and no bench ran ' + role + '.' };
   }

   function main(raw) {
       const payload = parse(raw);
       if (!payload || !DISPATCH.has(payload.tool_name)) return;
       let data = null;
       try { data = registry.readSession(registry.rootFor(payload), payload.session_id); } catch (e) { /* no registry: the bench figure */ }
       const out = decide(payload, { data, evidenceRoot: EVIDENCE });
       if (!out) return;
       process.stdout.write(JSON.stringify({
           hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: out.reason },
       }));
   }

   if (require.main === module) run(main);

   module.exports = { positionOf, benchPerDispatch, spentSoFar, decide };
   ```

   In `.claude-plugin/plugin.json`, after the title.js entry that closes at line 149, add:

   ```json
         {
           "matcher": "Agent|Task",
           "hooks": [
             {
               "type": "command",
               "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/dispatch-gate.js\"",
               "timeout": 5,
               "statusMessage": "Counting this response's Agent calls..."
             }
           ]
         },
   ```

   The hook count moves from eleven to twelve: `docs/01-guide/development.md:65` `all eleven` becomes `all twelve`, and `tests/hook.test.js:3` `What all eleven hooks do` becomes `What all twelve hooks do` (the other six stay non-blocking: PreToolUse is a blocking event).
4. Run `node --test tests/dispatch-gate.test.js tests/contract.test.js tests/inventory.test.js tests/guard.test.js tests/title-hook.test.js` and watch it pass.
5. `git add hooks/dispatch-gate.js tests/dispatch-gate.test.js`, then commit them with `.claude-plugin/plugin.json`, `docs/01-guide/development.md`, `tests/hook.test.js`: "hooks: a fifth Agent call in one response asks first, with a cost figure (dispatch-1)".

## Task 8: Four by default

**Files:**
- Modify: `lib/stages.js:705-720` — the comment at 714
- Modify: `skills/fankeel/SKILL.md:1110-1125` — the bold sentence at 1116
- Modify: `skills/fankeel-build/SKILL.md:285-300` — the bold sentence at 293

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — three wording edits; no test pins this wording.

1. The failing check: `git grep -n -E "at most four in one response|working ceiling|ceiling of four" -- lib/stages.js skills/fankeel/SKILL.md skills/fankeel-build/SKILL.md` prints three lines.
2. In `lib/stages.js:714`, `fans out does it with the Agent tool, at most four in one response. Each kind` becomes `fans out does it with the Agent tool, four by default in one response. Each kind`.
3. In `skills/fankeel/SKILL.md:1116`, `**Four in one response is the working ceiling.** Past that you are guessing at the` becomes `**Four in one response is the default.** Past that you are guessing at the`. In `skills/fankeel-build/SKILL.md:293`, `**The ceiling of four in flight is still the ceiling**, and it binds only` becomes `**Four in flight is still the default**, and it binds only`. Line counts do not change.
4. Re-run the grep: no output. Run `node --test tests/stages.test.js tests/plantasks.test.js` and watch it pass.
5. Commit the three files: "wording: four dispatches in one response is the default, not a cap (dispatch-1); verify and audit skills still say ceiling".

## Task 9: Allow-rule report

**Files:**
- Modify: `docs/90-agent/reports/2026-09-28-allow-rule-probe.md` — a `## 5. 10-08 再發生` section and `last_verified`
- Read: `docs/90-agent/todo/stage-agents-10.md` — the 10-08 counts and times

**Interfaces:**
- Consumes: none
- Produces: `10-08 再發生`, the report section Task 10 relies on before moving stage-agents-10 to blocked

**Dispatch:** implementer, sonnet — the section is written out below; transcription and one check.

1. The failing check: `grep -c "10-08 再發生" docs/90-agent/reports/2026-09-28-allow-rule-probe.md` prints 0.
2. Append to the end of `docs/90-agent/reports/2026-09-28-allow-rule-probe.md`, after `## 4. 結論`:

   ```md
   ## 5. 10-08 再發生

   2026-10-09 的 land（session 8846548c）從 transcript 數出：2026-10-08 auto mode 對這條規則涵蓋的路徑回了 10 次 no verdict（時間是 UTC）。

   - 主 session 4 次，18:27 到 18:28：Write `.fankeel/build/probe/main-tiny.txt`、Write `.fankeel/build/probe/main-4k.txt`、Edit `.fankeel/build/probe/main-bash.txt`、Write 根目錄的 `fk-probe-root.txt`。
   - 三個 brain 子 agent 共 6 次：16:11 與 16:17 Write `.fankeel/build/task-20261008T155402/survey.md`；16:31 Write 設計頁（plans 資料夾）、16:33 Write `.fankeel/build/task-20261008T155402/design.md`；17:46 Write 計畫頁（plans 資料夾）、17:48 Write `.fankeel/build/task-20261008T155402/plan.md`。

   規則在 `.claude/settings.local.json` 第 4 行：`Edit(/.fankeel/build/**)`。這個檔最後一次修改在 16:36，加的是一條 gate-check 的 Bash 規則。之後 17:48、18:27 兩次、18:28 一次，共四次寫的都是這條規則涵蓋的路徑，仍然 no verdict，所以這四次規則確定在檔案裡。

   規則當時有沒有被讀到：未判定。拒絕訊息只說 classifier 沒有判定（tool_result 開頭是 "The server-side auto mode classifier gave no verdict"），看不出權限判定走到哪一步。當時 session 用 `--plugin-dir` 載入、開著 Remote Control、切換過多次模式；使用者切到 accept edits 之後，同樣的寫入都成功。要判定，得由使用者在 auto mode 下以 `claude --debug` 寫一次 `.fankeel/build/` 底下的檔，看 debug 輸出裡權限判定讀了哪些規則。

   證據：`~/.claude/projects/F--ymlab-fankeel/8846548c-26e8-4b4a-a6cd-c8d649c9de33.jsonl` 與同名資料夾下的 `subagents/`。
   ```
3. In the frontmatter, `last_verified: 2026-09-28` becomes `last_verified: 2026-10-09`.
4. Re-run the grep: it prints 1. `node scripts/docs-check.js 2>&1 | grep allow-rule-probe` prints nothing.
5. Commit the report: "report: the 10-08 no-verdict recurrence; whether the rule was read is not determined (stage-agents-10)".

## Task 10: Closures and restamps

**Files:**
- Modify: `docs/90-agent/todo/todo-5.md` — closed on 64bc0797
- Modify: `docs/90-agent/todo/stage-agents-17.md` — closed, the ~60 USD A/B declined
- Modify: `docs/90-agent/todo/stage-agents-15.md` — closed, the ~30 USD rerun declined
- Read: `scripts/todo.js` — `done <id> --sha --disposition --record --commits`
- Read: `lib/todo.js` — `close` (495-521) rewrites the entry in place; `--commits` is read only with `--record`

**Interfaces:**
- Consumes: `10-08 再發生` (Task 9's report section, which stage-agents-10's move to blocked points at)
- Produces: none

**Dispatch:** in-session — one shell call runs every todo.js command and the restamp.

The same call also edits `docs/90-agent/todo/stage-agents-10.md`'s frontmatter (`state: blocked`, its timing and stamp) and restamps every entry whose `state: blocked` — 13 today, 14 with stage-agents-10 — which `FILE_CAP` keeps off the list above. `done` rewrites each file in place with `state: done` and a `done:` record, and `--record` appends the `## 完成紀錄` section with one `- commit <sha>` line per `--commits` sha.

1. The failing check: `node scripts/todo.js list` shows todo-5, stage-agents-17 and stage-agents-15 open, and stage-agents-10 `ready`.
2. Run, from F:/ymlab/fankeel, as one call:

   ```sh
   H=$(git rev-parse --short HEAD)
   node scripts/todo.js done todo-5 --sha 64bc0797 --disposition done
   node scripts/todo.js done stage-agents-17 --sha "$H" --disposition done --record "not run: user declined the ~60 USD A/B on 2026-10-09; stage.agents stays survey" --commits "$H"
   node scripts/todo.js done stage-agents-15 --sha "$H" --disposition done --record "not run: user declined the ~30 USD rerun on 2026-10-09; controller opus-vs-sonnet stays unmeasured" --commits "$H"
   sed -i -e 's/^state: ready$/state: blocked/' -e 's/^group: 放行規則有沒有效$/group: 放行規則有沒有效\ntiming: after: claude --debug 實跑\nstamp: 2026-10-09/' docs/90-agent/todo/stage-agents-10.md
   for f in $(grep -l '^state: blocked$' docs/90-agent/todo/*.md); do sed -i '1,12s/^stamp: .*/stamp: 2026-10-09/' "$f"; done
   node scripts/todo-check.js
   ```
3. Check: `todo-check` exits 0 and counts 14 blocked; `grep -L '^stamp: 2026-10-09' $(grep -l '^state: blocked$' docs/90-agent/todo/*.md)` prints nothing.
4. Commit the changed entries under `docs/90-agent/todo/`: "todo: todo-5, stage-agents-17 and -15 closed; stage-agents-10 blocked on a --debug run; blocked entries restamped".

## Task 11: Gate-pane draft approval

**Files:**
- Modify: `docs/90-agent/plans/2026-10-07-gate-pane-design.md` — the five answers in section 6, `status: planned` with `approved: 2026-10-09`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** user — the five open items in section 6 of the gate-pane design are design decisions only the user can make, asked with AskUserQuestion in this session in two calls (four questions, then one); implementation is a later task, and nothing depends on this one.

1. Read section 6 (`## 6. 待決問題`, lines 55-61) of `docs/90-agent/plans/2026-10-07-gate-pane-design.md`.
2. First AskUserQuestion call, four questions:
   - header `輪詢間隔` — mod 用 `$.clock.every` 輪詢 pending 檔，間隔多少？ Options: `200 ms (Recommended)` — 與 hooks/gate.js 的等待迴圈同節奏；`500 ms` — 讀檔少一半，Pane 晚約半秒出現；`1 秒` — 最省，Pane 晚一秒出現。
   - header `窄終端` — 終端窄於 144 欄、Pane 畫不出來時怎麼辦？ Options: `改用 toast 提示 (Recommended)` — `$.ui.toast` 說有 gate 待答；`不開 Pane` — 照舊只有 AskUserQuestion 與 station 頁。
   - header `答案競寫` — 兩邊在同一個 200 ms 內都寫了 answer 檔時怎麼辦？ Options: `寫前比對 mtime (Recommended)` — answer 檔已存在就不寫並收起 Pane；`後寫者勝` — 不比對，hook 讀到哪個算哪個。
   - header `多選與其他` — 多選題與「其他」框在 Pane 的 Input 裡怎麼填？ Options: `逗號分隔一個 Input` — 一格填完，按逗號拆；`逐項一個 Input` — 每個選項一格，「其他」再一格。
3. Second AskUserQuestion call, one question: header `手機VSCode` — Pane 在手機與 VS Code 上的樣子與 hotkey 何時實測？ Options: `實作 task 裡實測 (Recommended)` — 核准不等實測，實作完三個介面各跑一次；`核准前先實測` — 先在手機與 VS Code 各開一次 Pane 再核准。
4. Append each answer to its bullet in section 6 as `決定（2026-10-09）：<the chosen label and description>`; in the frontmatter `status: design-intent` becomes `status: planned` — `lib/docs.js:411` reads `planned` as intent, where `approved` would fall through to `current` and be audited for drift — and a line `approved: 2026-10-09` is added beneath it; `last_verified` is left as it is.
5. Commit the page: "design: gate-pane draft approved, its five open items answered (gate-7)".

## Coverage

| promise | task |
|---|---|
| Move the fixed build rules out of `lib/render.js:590-594` into `agents/fankeel-brain.md`; the brief keeps the three path lines | Task 1 |
| Brief tests measure at the 59-character reference root via `sizeAtReference`, which closes the worktree failure | Task 1 |
| `scripts/ledger.js` resolves the root through `registry.rootFor` as `scripts/task.js:255` does | Task 2 |
| `lib/suite.js` records `failed`: the leaf test names from `not ok` lines, empty when green | Task 3 |
| A fixture with one `compact_boundary` and one `isCompactSummary` line proves turn count, context curve and dispatch list | Task 4 |
| No compaction marker is added to the panel. | Task 4 |
| The three pages `docs-audit.js` lists as fallen behind | Task 5 |
| `hooks/title.js` leaves `subagent_type` and the model pin alone when the override file's mtime is later | Task 6 |
| `task.js profile set` on an agent key prints that a new terminal is needed | Task 6 |
| A new `hooks/dispatch-gate.js` on `PreToolUse` for Agent and Task returns `permissionDecision: ask` at the fifth | Task 7 |
| The reason carries an estimate: the registry's recorded spend priced through `lib/prices.js` | Task 7 |
| The wording "at most four in one response" becomes "four by default" wherever it is said | Task 1 (render.js), Task 6 (subagents.md), Task 8 (stages.js and the two skills) |
| Close `todo-5` on commit 64bc0797, and `stage-agents-17` and `stage-agents-15` with the declined-spend reason | Task 10 |
| `docs/90-agent/reports/2026-09-28-allow-rule-probe.md` gains a 10-08 recurrence section | Task 9 (section), Task 10 (stage-agents-10 blocked) |
| The gate-pane draft's five open items are asked of the user | Task 11 |
| build brief under 7000 at the reference root | Task 1 |
| ledger from a worktree lands beside the registry | Task 2 |
| `failed` names in `suite.json` after a red run | Task 3 |
| compaction fixture matches the panel | Task 4 |
| no page under fallen behind | Task 5 |
| override newer than the process leaves the name | Task 6 |
| fifth Agent returns `ask` with a figure | Task 7 |

The design's `## Files` table is matched by the Files blocks above, plus four files the table leaves out: `tests/render.test.js` (Task 1, it pins the moved group rule), `docs/01-guide/development.md` and `tests/hook.test.js` (Task 7, the hook count), and `lib/replay.js` read only (Task 4). The check row of `What proves it done` is its header.
