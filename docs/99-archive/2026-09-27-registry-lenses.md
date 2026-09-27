---
status: current
last_verified: 2026-09-27
---

# Registry lenses Implementation Plan

**Goal:** git 掃描降為弱證據 `seen`、hook 的 `git status` 有 2.5 秒上限、每個 session 可有自己的 worktree、plan/build 開始前用 `intends` 比對鄰居。
**Architecture:** `lib/dirty.js` 改寫 `seen` 而不寫 `claims`；`lib/guard.js` 新增 `effectiveClaims`／`sharedWith`／`worktreeOf`／`logicalPath`，guard、CLASH 計數、`task.js` 的 `collisions()` 與注入區塊都改走它們。worktree 由 `task.js start` 依 profile 開在 `.fankeel/worktrees/<id8>/`，路徑一律記邏輯路徑；`task.js intends` 攤平 plan／design 的檔案寫進 `intends` 並對鄰居分級印出。
**Tech Stack:** Node（本機 v24.9.0），CommonJS，`node:test`，git CLI；`package.json` 沒有任何 dependency。
**Spec:** 2026-09-27-registry-lenses-design.md

## Global Constraints

Taken from `node scripts/map.js`, `.fankeel/map.md`, `CONTRIBUTING.md` (there is no `CLAUDE.md`), `package.json` and the tests named on each line.

1. `package.json`: `"test": "node --test"`, no `dependencies` key. No dependency is added.
2. CommonJS: `'use strict';` on line 1, `require`, no ESM. `lib/`, `scripts/`, `hooks/` indent 4 spaces. Tests copy the file they take their fixture from: `tests/dirty.test.js`, `tests/guard.test.js`, `tests/registry.test.js`, `tests/task.test.js`, `tests/touch.test.js`, `tests/inject.test.js`, `tests/residue.test.js` use 2 spaces; `tests/station*.test.js` and `tests/profile.test.js` use 4.
3. `lib/` never requires `scripts/` or `hooks/` (CONTRIBUTING.md, Scope table, "Core logic").
4. Every hook exits 0 on every path (CONTRIBUTING.md, "Hooks").
5. `const MAX_CLAIMS = 60;` (`lib/registry.js:46`; `tests/registry.test.js:642` asserts 60). `seen` is capped by the same constant; `intends` gets `MAX_INTENDS = 60`.
6. Every exported name must be imported by something, a test counts (`tests/source.test.js:117`). A new file has to be `git add`ed before `tests/source.test.js` can see it.
7. Temp directories come from `tests/tmp.js` (`const tmp = require('./tmp.js'); tmp('<prefix>-')`), removed at exit.
8. Injection caps: `size < 2400` at a 59-character reference root (`tests/render.test.js:528`; today plan 2333, build 2254). `rulesFor(name)` under 2000 characters (`tests/stages.test.js:102`). `prompt_bytes <= prompt_byte_budget` (`tests/stage-registry.test.js:32`; today plan 2371 of 2400, build 2290 of 2400). `skills/registry.json` must equal its regeneration, `node scripts/stage-registry.js` (`tests/stage-registry.test.js:21`). Every stage's last rule starts `Output:` (`tests/stages.test.js:323`).
9. Every line of the committed `.fankeel/.gitignore` needs a row in the lifetime table of `docs/90-agent/reference/documents.md` (`tests/docs.test.js:537`).
10. In `skills/fankeel-build/SKILL.md`, a paragraph naming `ledger.js` in backticks, `groups` or `brief` must also say `no plan`, `without a plan`, `file table` or `spike` (`tests/skills.test.js:410`).
11. Profile values `'true'`/`'false'` parse to booleans (`lib/profile.js:181`). A key whose `values` array is non-empty joins `WIZARD_KEYS`; `tests/station-wizard.test.js:52` pins the wizard summary at 12 rows.
12. The station has two builders and the page reads the second: a new session field goes into both `gather()` and `serialize()` in `lib/station.js` (`tests/station.test.js:122`).
13. A `path:line` citation in docs and skills must keep holding. `node scripts/docs-check.js` prints `does not hold` for each one that moved. A task that rewrites the code a citation quotes rewords that quote; Task 10 fixes line numbers that merely shifted.
14. An implementer runs only its own test file, `node --test tests/<file>.test.js`; the parent runs `node --test` before committing a group.
15. Commit subjects are `feat:`, `fix:` or `docs:` plus a short subject (`git log`).
16. A plan closes its TODO entries: `TODO.md:84`–`87` are the four Ready lines this delivers, each removed whole (match the full line) by the task named on it below.
17. Replacement pairs below are given as `text` blocks: the first block is the exact old text, line breaks included, and the block after "becomes" is the new text.

## Rulings

- **Ruling 1 — `seen` minus neighbours' `seen` too.** The design's formula `claims ∪ (seen − 任何 live session 的 claims)` fails its own first test: two sessions that only saw `f` in git would each keep `f` and collide. `effectiveClaims` subtracts from `seen` every path a live neighbour **in the same tree** holds in `claims` or `seen`. All three §2 test cases hold under it. Cost: a shell write two sessions in one tree both saw counts for neither; per-session worktrees are what separates those.
- **Ruling 2 — intends goes into an existing rule line, not a new one.** The design says one line per stage. `plan` has 29 bytes left against its 2400 budget, so a new line does not fit. A clause does: patched in memory, plan measures 2394/2400 and build 2316/2400, injection 2356 and 2277. It also keeps `lib/stages.js` line numbers that other pages cite.
- **Ruling 3 — `worktreeOf` lives in `lib/guard.js`**, beside the tree comparison that uses it. That way Task 5 (station) does not have to wait on `lib/registry.js`.
- **Ruling 4 — a failed `git worktree add` does not refuse `start`.** The task starts on the main tree, and `start` prints `worktree: not opened — <git's first line>`.
- **Ruling 5 — residue's "in use" means any `active: true` record** (what `readActive` returns). Liveness is not measured there.

## File structure

| file | responsibility after this plan |
|---|---|
| `lib/dirty.js` | git scan with a 2.5 s timeout; writes `seen`; scans a task's worktree when it has one |
| `lib/registry.js` | adds `seenOf`, `addSeen`, `intendsOf`, `setIntends`, `MAX_INTENDS` (appended above `module.exports`) |
| `lib/guard.js` | adds `worktreeOf`, `effectiveClaims`, `sharedWith`, `logicalPath`; `blockers` and `decide` use them |
| `lib/render.js` | `seen:`, `merge:` and `worktree:` lines; CLASH via `sharedWith` |
| `hooks/inject.js`, `hooks/touch.js` | CLASH count through `sharedWith`; logical path on touch |
| `scripts/task.js` | `collisions()` through `sharedWith`; worktree at `start`, carried by `adopt`, shown by `show`; `intends` command |
| `lib/profile.js` | `worktree` key |
| `lib/station.js`, `assets/station/station.js` | `seen` on the session and on the page |
| `scripts/residue.js`, `skills/fankeel-land/SKILL.md` | worktree in use; land merges the task's branch |
| `lib/stages.js`, `skills/fankeel-plan/SKILL.md`, `skills/fankeel-build/SKILL.md` | where `task.js intends` runs |

## Task 1: dirtyPaths gives up after 2.5 seconds

**Files:**
- Modify: `lib/dirty.js` — `timeout: 2500` on the `git status` call in `dirtyPaths`
- Modify: `TODO.md` — remove line 84 (the `〔hooks〕UserPromptSubmit 09-27 又逾時 5s` entry)
- Test: `tests/dirty-timeout.test.js`

**Interfaces:**
- Consumes: none
- Produces: none. `dirtyPaths(dir)` keeps its signature and still returns `null` on any git failure; a timeout is now one of those failures.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus one test.

1. Write the failing test. On Windows `execFileSync('git', …)` finds only `git.exe`/`git.com` on PATH, so the fake is a hard link (or copy) of node that sleeps in a `--require` preload. Everywhere else it is a shell script.

   Create `tests/dirty-timeout.test.js`:

   ```js
   'use strict';

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');

   const dirty = require('../lib/dirty.js');
   const mkTmp = require('./tmp.js');

   // A `git` that sleeps five seconds, first on PATH. On Windows the lookup
   // only tries git.exe and git.com, so it is node under that name with a
   // preload that sleeps; elsewhere a shell script.
   function slowGit() {
     const bin = mkTmp('fankeel-slowgit-');
     if (process.platform === 'win32') {
       const exe = path.join(bin, 'git.exe');
       try {
         fs.linkSync(process.execPath, exe);
       } catch (e) {
         fs.copyFileSync(process.execPath, exe);
       }
       const pre = path.join(bin, 'sleep.js');
       fs.writeFileSync(pre, 'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000); process.exit(0);\n');
       return { bin, env: { NODE_OPTIONS: '--require "' + pre.replace(/\\/g, '/') + '"' } };
     }
     fs.writeFileSync(path.join(bin, 'git'), '#!/bin/sh\nsleep 5\n', { mode: 0o755 });
     return { bin, env: {} };
   }

   test('a git that hangs is cut off and answers null inside three seconds', () => {
     const repo = mkTmp('fankeel-dirty-slow-');
     fs.mkdirSync(path.join(repo, '.git'));
     const { bin, env } = slowGit();
     const saved = { PATH: process.env.PATH, NODE_OPTIONS: process.env.NODE_OPTIONS };
     process.env.PATH = bin + path.delimiter + process.env.PATH;
     for (const k of Object.keys(env)) process.env[k] = env[k];
     const began = Date.now();
     let got;
     try {
       got = dirty.dirtyPaths(repo);
     } finally {
       process.env.PATH = saved.PATH;
       if (saved.NODE_OPTIONS === undefined) delete process.env.NODE_OPTIONS;
       else process.env.NODE_OPTIONS = saved.NODE_OPTIONS;
     }
     const took = Date.now() - began;
     assert.equal(got, null);
     assert.ok(took < 3000, 'took ' + took + 'ms against a 2500ms timeout');
   });
   ```

2. Run `node --test tests/dirty-timeout.test.js`. It should fail, and fail within about 5 s rather than hang: the fake exits 0 with no output, so `dirtyPaths` returns `[]`, not `null`, after about 5000 ms.
3. In `lib/dirty.js`, `dirtyPaths`, replace the options object of the `git status` call so the call reads:

   ```js
           out = execFileSync('git', ['status', '--porcelain', '-z', '-uall'], {
               cwd: dir,
               encoding: 'utf8',
               maxBuffer: 32 * 1024 * 1024,
               stdio: ['ignore', 'pipe', 'ignore'],
               // A git that hangs held UserPromptSubmit past its five seconds on
               // 2026-09-27. Past 2.5s the catch below answers null: nothing is
               // recorded this prompt, and the prompt goes through.
               timeout: 2500,
           });
   ```

4. Run `node --test tests/dirty-timeout.test.js tests/dirty.test.js`. Both pass.
5. Delete the whole `TODO.md` line that starts `- 〔hooks〕UserPromptSubmit 09-27 又逾時 5s`.
6. Commit: `fix: dirtyPaths — git status gives up after 2.5s`.

## Task 2: residue marks a live task's worktree in use; land merges the task's branch

**Files:**
- Modify: `scripts/residue.js` — `worktreesOf` sets `inUse`, `scan` leaves in-use worktrees out of the spent list and returns `inUse`, `report` lists them
- Modify: `skills/fankeel-land/SKILL.md` — §7 merge paragraph for a task's own worktree; `.fankeel/worktrees/` joins the cleanup line
- Read: `lib/registry.js` — `findStateRoot(start)`, `readActive(root)`
- Test: `tests/residue-inuse.test.js`

**Interfaces:**
- Consumes: the record field `worktree` = { path, branch }, with path relative to the registry root. The design fixes that shape; Task 6 writes it.
- Produces: the `scan(root)` result gains `inUse`, an array of { path, branch }.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Create `tests/residue-inuse.test.js`:

   ```js
   'use strict';

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');

   const { scan, report } = require('../scripts/residue.js');
   const tmp = require('./tmp.js');

   function repo() {
     const root = tmp('fankeel-residue-inuse-');
     const git = (args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
     git(['init', '-q']);
     git(['config', 'user.email', 't@example.com']);
     git(['config', 'user.name', 'T']);
     fs.writeFileSync(path.join(root, 'kept.txt'), 'kept');
     git(['add', '-A']);
     git(['commit', '-qm', 'first']);
     return { root, git };
   }

   // A fresh `fk/<id8>` sits on the commit it was cut from, so it is merged into
   // HEAD from the first second — spent, by the old test, while somebody works in it.
   function worktreeWithRecord(active) {
     const { root, git } = repo();
     git(['branch', 'fk/aaaaaaaa']);
     git(['worktree', 'add', '-q', path.join(root, '.fankeel', 'worktrees', 'aaaaaaaa'), 'fk/aaaaaaaa']);
     const sessions = path.join(root, '.fankeel', 'sessions');
     fs.mkdirSync(sessions, { recursive: true });
     fs.writeFileSync(path.join(sessions, 'aaaaaaaa-0000-4000-8000-000000000001.json'), JSON.stringify({
       task: 't', stage: 'build', active,
       worktree: { path: '.fankeel/worktrees/aaaaaaaa', branch: 'fk/aaaaaaaa' },
     }) + '\n');
     return root;
   }

   test('a worktree an active record points at is in use, not spent', () => {
     const result = scan(worktreeWithRecord(true));
     assert.deepEqual(result.worktrees, [], 'reported spent: ' + JSON.stringify(result.worktrees));
     assert.deepEqual(result.inUse.map((w) => w.branch), ['fk/aaaaaaaa']);
     assert.match(report(result), /1 worktree is in use by a live task/);
   });

   test('the same worktree under a stood-down record is spent again', () => {
     const result = scan(worktreeWithRecord(false));
     assert.deepEqual(result.worktrees.map((w) => w.branch), ['fk/aaaaaaaa']);
     assert.deepEqual(result.inUse, []);
   });
   ```

2. Run `node --test tests/residue-inuse.test.js`. It fails: `result.inUse` is undefined.
3. In `scripts/residue.js`, change the registry import line to:

   ```js
   const { resolveRoot, findStateRoot, readActive } = require('../lib/registry.js');
   ```

4. In `scripts/residue.js`, put this function directly above `function worktreesOf(root) {`:

   ```js
   // The worktrees an active record points at, absolute. `task.js start` cuts a
   // task's `fk/<id8>` from the branch it is on, so until the task's first
   // commit that branch is merged into HEAD — spent, by the test in `scan`,
   // while somebody is working in it.
   function worktreesInUse(root) {
       const reg = findStateRoot(root) || root;
       const out = [];
       for (const e of readActive(reg)) {
           const wt = e.data && e.data.worktree;
           if (wt && typeof wt.path === 'string' && wt.path.trim()) out.push(path.resolve(reg, wt.path.trim()));
       }
       return out;
   }
   ```

5. In `scripts/residue.js`, `worktreesOf`, replace its last statement, the `return all.slice(1).filter(…)` line, with:

   ```js
       const used = worktreesInUse(root);
       return all.slice(1)
           .filter((w) => !here || path.relative(w.path, here) !== '')
           .map((w) => Object.assign(w, { inUse: used.some((p) => path.relative(p, w.path) === '') }));
   ```

6. In `scripts/residue.js`, `scan`, replace

   ```text
       const worktrees = worktreesOf(root)
           .filter((w) => w.branch && merged.has(w.branch))
           .map((w) => ({ path: w.path, branch: w.branch }));
   ```

   with this, in `scripts/residue.js`:

   ```js
       const listed = worktreesOf(root);
       const worktrees = listed
           .filter((w) => w.branch && merged.has(w.branch) && !w.inUse)
           .map((w) => ({ path: w.path, branch: w.branch }));
       const inUse = listed.filter((w) => w.inUse).map((w) => ({ path: w.path, branch: w.branch }));
   ```

   Then change `return { repo: true, branch, undecided, worktrees, weight, empty, orphans };` to `return { repo: true, branch, undecided, worktrees, inUse, weight, empty, orphans };`. In the not-a-repository return, `worktrees: [],` becomes `worktrees: [], inUse: [],`.
7. In `scripts/residue.js`, `report`, right after the `section(...)` call that lists the worktrees `already merged into` the branch, add:

   ```js
           lines.push(...section(plural(result.inUse.length, 'worktree is', 'worktrees are')
               + ' in use by a live task, merged or not:',
               result.inUse.map((w) => w.path + '  (' + w.branch + ')')));
   ```

   `defects()` stays as it is: an in-use worktree is context, not a defect.
8. In `skills/fankeel-land/SKILL.md` §7, after the paragraph that ends with the text below:

   ```text
   investigate. Green, then clean the worktree, then `git branch -d`.
   ```

   insert this paragraph, in `skills/fankeel-land/SKILL.md`:

   ```md
   **A task with its own worktree.** `node <plugin>/scripts/task.js show --session <id>`
   prints a `worktree:` line when `task.js start` opened one under
   `.fankeel/worktrees/<id8>/` on branch `fk/<id8>`. Merge from the main checkout,
   not from inside it: checkout the base there, `git merge fk/<id8>`, re-run the
   suite on the merged result, and only when it is green run
   `git worktree remove .fankeel/worktrees/<id8>` and then `git branch -d fk/<id8>`.
   A red suite leaves both in place, as above. `scripts/residue.js` lists that
   worktree as in use, not spent, for as long as the task's record is active.
   ```

   Then, in the same file:

   ```text
   Clean up only worktrees the project created under `.worktrees/` or `worktrees/`.
   ```

   becomes

   ```text
   Clean up only worktrees the project created under `.worktrees/`, `worktrees/` or `.fankeel/worktrees/`.
   ```

9. Run `node --test tests/residue-inuse.test.js tests/residue.test.js tests/skills.test.js`. All pass.
10. Commit: `feat: residue — a live task's worktree is in use, not spent; land merges fk/<id8>`.

## Task 3: git's writes go to `seen`, not `claims`

**Files:**
- Modify: `lib/registry.js` — `seenOf`, `addSeen`, appended above `module.exports` and exported
- Modify: `lib/dirty.js` — `claimWrites` writes through `addSeen`; its comments say `seen`
- Modify: `lib/render.js` — a `seen:` line under `touched:`
- Modify: `scripts/task.js` — `cmdTask` also deletes `seen`
- Modify: `docs/90-agent/reference/registry.md` — writer cell; the `claims` paragraph; the "One writer at a time" sentence
- Modify: `docs/90-agent/reference/collisions.md` — the git-pass prose and two table rows
- Test: `tests/registry-seen.test.js`
- Test: `tests/dirty.test.js`
- Test: `tests/inject.test.js`

**Interfaces:**
- Consumes: none
- Produces: `seenOf` — `seenOf(data)` returns an array of strings, `[]` for a record without the field. `addSeen` — `addSeen(projectRoot, sessionId, rel)` returns a boolean, same contract as `addClaim`, capped at `MAX_CLAIMS`, oldest evicted.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus test edits.

1. Create `tests/registry-seen.test.js`:

   ```js
   'use strict';

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');

   const registry = require('../lib/registry.js');
   const tmp = require('./tmp.js');

   const SID = '23916a07-5213-4e61-a3f0-70b5c462fd82';

   function seed(root, over) {
     const dir = path.join(root, '.fankeel', 'sessions');
     fs.mkdirSync(dir, { recursive: true });
     const data = Object.assign({ task: 't', stage: 'build', active: true,
       started: new Date(Date.now() - 3600e3).toISOString(), updated: new Date().toISOString() }, over);
     fs.writeFileSync(path.join(dir, SID + '.json'), JSON.stringify(data) + '\n');
   }

   test('seenOf reads nothing from a record written before the field', () => {
     assert.deepEqual(registry.seenOf({ claims: ['a.js'] }), []);
     assert.deepEqual(registry.seenOf(null), []);
     assert.deepEqual(registry.seenOf({ seen: ['a.js', '', 7] }), ['a.js']);
   });

   test('addSeen keeps the newest sixty, oldest evicted, and leaves claims alone', () => {
     const root = tmp('fankeel-seen-');
     seed(root, { claims: ['kept.js'] });
     for (let n = 1; n <= 61; n++) registry.addSeen(root, SID, 'lib/' + n + '.js');
     const data = registry.readSession(root, SID);
     assert.equal(data.seen.length, registry.MAX_CLAIMS);
     assert.equal(data.seen[0], 'lib/2.js');
     assert.deepEqual(data.claims, ['kept.js']);
   });
   ```

2. In `tests/dirty.test.js`, under the `const claims = (root) => …` line, add `const seen = (root) => registry.seenOf(registry.readSession(root, MINE));`. Then change three tests:
   - `test('a write no hook saw is claimed', …)`: rename it `'a write no hook saw is seen, not claimed'`, change `assert.deepEqual(claims(dir), ['api/routes.js']);` to `assert.deepEqual(seen(dir), ['api/routes.js']);`, and add `assert.deepEqual(claims(dir), []);` after it;
   - `test('a project under the registry root is claimed with its prefix', …)`: change `assert.deepEqual(claims(root), ['Waypoint/statusline.ps1']);` to `assert.deepEqual(seen(root), ['Waypoint/statusline.ps1']);`;
   - `test('a pass the record can hold is taken whole', …)`: change `assert.equal(claims(dir).length, registry.MAX_CLAIMS);` to `assert.equal(seen(dir).length, registry.MAX_CLAIMS);`.
3. In `tests/inject.test.js`:
   - `test('a write no hook saw is claimed on the next prompt', …)`: rename it `'a write no hook saw is seen on the next prompt'` and change `assert.deepEqual(readEntry(root, MINE).claims, ['api/routes.js']);` to `assert.deepEqual(readEntry(root, MINE).seen, ['api/routes.js']);`;
   - `test('a file dirty before the task started is not claimed', …)`: change `assert.deepEqual(readEntry(root, MINE).claims, []);` to `assert.equal(readEntry(root, MINE).seen, undefined);`;
   - `test('a write outside the hooks is in the block on the same prompt it is claimed', …)`: change `assert.match(text, /touched: api\/routes\.js/);` to `assert.match(text, /^seen: api\/routes\.js  \(weak: from git, no writer\)$/m);`.
4. Run `node --test tests/registry-seen.test.js tests/dirty.test.js tests/inject.test.js`. The new and changed assertions fail.
5. In `lib/registry.js`, directly above `module.exports = {`, add:

   ```js
   // What git saw this task write, kept beside `claims` rather than in it. A
   // shared tree shows every session every dirty file, so a git pass names no
   // writer: weak evidence, shown but not a claim. Same cap and eviction as
   // `claims`. A record written before this field reads as holding none, and
   // nothing is migrated.
   function seenOf(data) {
       if (!data || !Array.isArray(data.seen)) return [];
       return data.seen.filter((c) => typeof c === 'string' && c.trim());
   }

   function addSeen(projectRoot, sessionId, rel) {
       const text = String(rel == null ? '' : rel).trim();
       if (!text) return false;
       return update(projectRoot, sessionId, (data) => {
           const seen = seenOf(data);
           if (seen.includes(text)) return false;
           seen.push(text);
           data.seen = seen.slice(-MAX_CLAIMS);
           return true;
       });
   }
   ```

   In the `module.exports` object in `lib/registry.js`, directly under the line `    addClaim,`, add the two lines `    seenOf,` and `    addSeen,`.
6. In `lib/dirty.js`, the first comment line above `function claimWrites` becomes, in `lib/dirty.js`:

   ```js
   // Records in `seen` every path this task wrote that no hook was there to see.
   ```

   In `lib/dirty.js`, `claimWrites`, the four comment lines below:

   ```text
       // `claims` keeps the newest sixty, so taking those would evict every path
       // `hooks/touch.js` recorded from an edit somebody actually drove and replace
       // it with build output. The threshold is `MAX_CLAIMS` rather than a number
       // of its own because that is exactly the size of what would be destroyed.
   ```

   become these four, in `lib/dirty.js`:

   ```js
       // `seen` keeps the newest sixty, so taking those would evict every earlier
       // path git saw this task write and replace it with build output. The
       // threshold is `MAX_CLAIMS` rather than a number of its own because `seen`
       // is capped at exactly that.
   ```

   In `lib/dirty.js`, replace the tail of `claimWrites`, from `const held = registry.claimsOf(data);` down to its `return { added, declined: 0 };`, with:

   ```js
       // Into `seen`, never `claims`: git names no writer. A path this task
       // already holds either way costs no lock and no write.
       const held = registry.claimsOf(data).concat(registry.seenOf(data));
       let added = 0;
       for (const rel of written) {
           const claim = sub ? sub + '/' + rel : rel;
           if (covers(held, claim)) continue;
           if (registry.addSeen(root, sessionId, claim)) added++;
       }
       return { added, declined: 0 };
   ```

7. In `lib/render.js`, change the import line `const { isStale, ageText, notesOf, nextOf, claimsOf, projectOf } = require('./registry.js');` to `const { isStale, ageText, notesOf, nextOf, claimsOf, projectOf, seenOf } = require('./registry.js');` (still one line). In `render()`, directly under `if (mineClaims.length) lines.push('touched: ' + mineClaims.join(', '));`, add:

   ```js
       // What git saw, marked weak: it names no writer, so it lights CLASH and
       // reaches the guard only where no live neighbour saw or touched it too.
       const seen = seenOf(data);
       if (seen.length) lines.push('seen: ' + seen.join(', ') + '  (weak: from git, no writer)');
   ```

8. In `scripts/task.js`, `cmdTask`, directly under `        delete d.claims;`, add `        delete d.seen;`.
9. In `docs/90-agent/reference/registry.md`, make six replacements.

   In the sessions row of the first table:

   ```text
   `touch.js` and `inject.js` for `claims`;
   ```

   becomes

   ```text
   `touch.js` for `claims`; `inject.js` for `seen`, what git saw written since `started`;
   ```

   In the paragraph that opens "A third field is written by nobody the user talks to":

   ```text
   The two writers reach that cap
   from opposite directions.
   ```

   becomes

   ```text
   `claims` and `seen` reach that cap
   from opposite directions.
   ```

   Then:

   ```text
   because trimming it would evict
   every claim an edit earned and put build output in its place.
   ```

   becomes

   ```text
   because trimming it would evict
   every earlier path in `seen` and put build output in its place.
   ```

   Then:

   ```text
   Two hooks append to it,
   which is why the table above lists hooks rather than a command as its writer.
   ```

   becomes

   ```text
   `hooks/touch.js` appends to it,
   which is why the table above lists a hook rather than a command as its writer.
   ```

   Then:

   ```text
   `hooks/inject.js` adds, once a prompt, every path git reports dirty whose
   mtime is later than the task's `started` — the writes that reached the disk
   without any tool a hook matches, a `sed` or a `node -e` or a build script. Which
   of the two recorded a path is not distinguishable afterwards and does not need to
   be: the field says where the work went.
   ```

   becomes

   ```text
   `hooks/inject.js` writes, once a prompt, every path git reports dirty whose
   mtime is later than the task's `started` into a field of its own, `seen` — the
   writes that reached the disk without any tool a hook matches, a `sed` or a
   `node -e` or a build script. Git names no writer, and a shared tree shows every
   session every dirty file, so `seen` is shown as weak and never enters `claims`.
   The same cap holds it, sixty, and `task` clears it with `claims`.
   ```

   And under "# One writer at a time":

   ```text
   pass claims, since `lib/dirty.js:183` calls `addClaim` per path and each one
   ```

   becomes

   ```text
   pass records in `seen`, since `lib/dirty.js:183` calls `addSeen` per path and each one
   ```

   Task 10 fixes the `:183`.
10. In `docs/90-agent/reference/collisions.md`, make four replacements.

    ```text
    `hooks/inject.js` claims it, which makes the tool that wrote the file stop
    ```

    becomes

    ```text
    `hooks/inject.js` records it in `seen`, which makes the tool that wrote the file stop
    ```

    In the `when` row of the table under it:

    ```text
    so what it finds is in the `touched:` list of the same prompt
    ```

    becomes

    ```text
    so what it finds is on the `seen:` line of the same prompt
    ```

    In the `never` row:

    ```text
    a pass holding more paths than `claims` can keep.
    ```

    becomes

    ```text
    a pass holding more paths than `seen` can keep.
    ```

    and, in the same row:

    ```text
    would evict every claim an edit earned. The block says so — `unclaimed: 300 files written outside the hooks` — because a `touched:` list that reads as complete
    ```

    becomes

    ```text
    would evict every earlier path git saw. The block says so — `unclaimed: 300 files written outside the hooks` — because a `seen:` line that reads as complete
    ```

11. Run `node --test tests/registry-seen.test.js tests/dirty.test.js tests/inject.test.js tests/render.test.js tests/registry.test.js`. All pass.
12. Commit: `feat: git scan writes seen, not claims — weak evidence of a write`.

## Task 4: conflicts count effective paths, per tree

**Files:**
- Modify: `lib/guard.js` — `worktreeOf`, `effectiveClaims`, `sharedWith`; `blockers` uses them and skips another tree
- Modify: `lib/render.js` — `otherLine` takes CLASH from `sharedWith`; a `merge:` line
- Modify: `hooks/inject.js` — the overlap count behind the badge uses `sharedWith`
- Modify: `scripts/task.js` — `collisions(root, sessionId, data)` uses `sharedWith`; its four callers pass the record
- Modify: `docs/90-agent/reference/collisions.md` — the two `blockers()` citations; a `weight` row for `seen`
- Modify: `docs/90-agent/reference/registry.md` — one sentence on how `seen` counts
- Modify: `TODO.md` — remove line 85 (the `〔registry〕git 掃描的 claims 降成弱證據` entry)
- Read: `lib/registry.js` — `claimsOf(data)`, `seenOf(data)`
- Read: `lib/overlap.js` — `overlapPaths(mine, theirs)`, `entriesOverlap`
- Read: `lib/live.js` — `isLive(liveState, sessionId, configDir)`
- Test: `tests/guard-effective.test.js`

**Interfaces:**
- Consumes: `seenOf` (Task 3)
- Produces: `worktreeOf` — `worktreeOf(data)` returns { path, branch } or null. `effectiveClaims` — `effectiveClaims(data, liveOthers)` returns an array of strings; `liveOthers` holds `{ data }` entries, and `data` itself is skipped by identity. `sharedWith` — `sharedWith(mine, other, alive)` returns { clash, merge }, two arrays of paths; `mine` is a record, `other` is one `{ sessionId, data }` entry of `alive`. `collisions` — `collisions(root, sessionId, data)` now takes the record, not a claims list.

**Dispatch:** implementer, sonnet — the plan carries the code and the three design cases as tests; Ruling 1 settles the one judgement.

1. Create `tests/guard-effective.test.js`:

   ```js
   'use strict';

   const test = require('node:test');
   const assert = require('node:assert/strict');

   const guard = require('../lib/guard.js');
   const { render } = require('../lib/render.js');

   const A = 'aaaaaaaa-0000-4000-8000-000000000001';
   const B = 'bbbbbbbb-0000-4000-8000-000000000002';
   const UNKNOWN = { known: false, ids: new Set() };
   const older = new Date(Date.now() - 7200e3).toISOString();
   const newer = new Date(Date.now() - 3600e3).toISOString();
   const WA = { path: '.fankeel/worktrees/aaaaaaaa', branch: 'fk/aaaaaaaa' };
   const WB = { path: '.fankeel/worktrees/bbbbbbbb', branch: 'fk/bbbbbbbb' };

   test('two live sessions that only saw f in git neither block nor clash', () => {
     const mine = { seen: ['f.js'], started: newer };
     const theirs = { sessionId: B, data: { seen: ['f.js'], started: older } };
     assert.deepEqual(guard.blockers(mine, [theirs], 'f.js', UNKNOWN), []);
     assert.deepEqual(guard.sharedWith(mine, theirs, [theirs]), { clash: [], merge: [] });
   });

   test('a path one side touched through a hook collides only with the other side\'s claim', () => {
     const mine = { claims: ['f.js'], started: newer };
     const sawIt = { sessionId: B, data: { seen: ['f.js'], started: older } };
     assert.deepEqual(guard.sharedWith(mine, sawIt, [sawIt]).clash, []);
     assert.deepEqual(guard.blockers(mine, [sawIt], 'f.js', UNKNOWN), []);
     const editedIt = { sessionId: B, data: { claims: ['f.js'], started: older } };
     assert.deepEqual(guard.sharedWith(mine, editedIt, [editedIt]).clash, ['f.js']);
     assert.equal(guard.blockers(mine, [editedIt], 'f.js', UNKNOWN).length, 1);
   });

   test('a path git saw and no live session holds still counts', () => {
     const mine = { started: newer };
     const theirs = { sessionId: B, data: { seen: ['f.js'], started: older } };
     assert.equal(guard.blockers(mine, [theirs], 'f.js', UNKNOWN).length, 1);
     assert.deepEqual(guard.effectiveClaims(theirs.data, [{ data: mine }, theirs]), ['f.js']);
   });

   test('two trees on one path neither block nor clash; the path is a merge', () => {
     const mine = { claims: ['lib/x.js'], worktree: WA, started: newer };
     const theirs = { sessionId: B, data: { claims: ['lib/x.js'], worktree: WB, started: older } };
     assert.deepEqual(guard.blockers(mine, [theirs], 'lib/x.js', UNKNOWN), []);
     assert.deepEqual(guard.sharedWith(mine, theirs, [theirs]), { clash: [], merge: ['lib/x.js'] });
     const onMain = { sessionId: B, data: { claims: ['lib/x.js'], started: older } };
     assert.deepEqual(guard.blockers(mine, [onMain], 'lib/x.js', UNKNOWN), [], 'one side on the main tree is another tree');
   });

   test('the block names a merge path once and draws no overlap for it', () => {
     const mine = { task: 'mine', stage: 'build', active: true, claims: ['lib/x.js'], worktree: WA, started: newer };
     const theirs = { sessionId: B, data: { task: 'theirs', stage: 'build', active: true, claims: ['lib/x.js'], worktree: WB, started: older } };
     const out = render({ mine: { sessionId: A, data: mine }, others: [theirs], now: Date.now() });
     assert.match(out, /^merge: lib\/x\.js — also edited in another worktree; they meet at land$/m);
     assert.doesNotMatch(out, /<< overlaps:/);
   });

   test('worktreeOf reads the record field or answers null', () => {
     assert.deepEqual(guard.worktreeOf({ worktree: WA }), WA);
     assert.equal(guard.worktreeOf({ worktree: { branch: 'x' } }), null);
     assert.equal(guard.worktreeOf(null), null);
   });
   ```

2. Run `node --test tests/guard-effective.test.js`. It fails: `guard.sharedWith` is not a function.
3. In `lib/guard.js`, change the two import lines in place (still one line each):

   ```js
   const { entriesOverlap, overlapPaths } = require('./overlap.js');
   const { claimsOf, seenOf } = require('./registry.js');
   ```

4. In `lib/guard.js`, replace the whole of `function blockers(mine, others, rel, liveState) {`, keeping `function blockers(` on the line it is on now:

   ```js
   function blockers(mine, others, rel, liveState) {
       if (!rel) return [];
       const alive = (Array.isArray(others) ? others : []).filter((o) => o
           && isLive(liveState, o.sessionId, o.data && o.data.configDir));
       const pool = [{ data: mine }].concat(alive);
       const mineHolds = covers(effectiveClaims(mine, pool), rel);
       const out = [];
       for (const other of alive) {
           const data = other.data;
           if (treeOf(data) !== treeOf(mine)) continue;
           if (!covers(effectiveClaims(data, pool), rel)) continue;
           if (mineHolds && !claimedFirst(data, mine)) continue;
           out.push(other);
       }
       return out;
   }
   ```

5. In `lib/guard.js`, directly under the closing `}` of `function decide(`, and above the comment that opens the `READ_ONLY_AGENTS` block, add:

   ```js
   // The worktree `task.js start` opened for a task, or null. `path` is
   // relative to the registry root, forward slashes.
   function worktreeOf(data) {
       const wt = data && data.worktree;
       if (!wt || typeof wt.path !== 'string' || !wt.path.trim()) return null;
       return { path: wt.path.trim(), branch: typeof wt.branch === 'string' ? wt.branch : '' };
   }

   // Which checkout a record works in: '' for the main tree, else its worktree.
   function treeOf(data) {
       const wt = worktreeOf(data);
       return wt ? wt.path : '';
   }

   // The paths that count against a neighbour: every `claims` entry, and each
   // `seen` entry that no live session in the same tree holds in its own
   // `claims` or `seen`. Git names no writer and a shared tree shows every
   // session every dirty file, so a path two sessions both merely saw is
   // nobody's, and one a neighbour edited through a hook is that neighbour's.
   // `liveOthers` holds `{ data }` entries; `data` itself is skipped by identity.
   function effectiveClaims(data, liveOthers) {
       const heard = [];
       for (const o of Array.isArray(liveOthers) ? liveOthers : []) {
           const d = o && o.data;
           if (!d || d === data || treeOf(d) !== treeOf(data)) continue;
           heard.push(...claimsOf(d), ...seenOf(d));
       }
       const out = claimsOf(data).slice();
       for (const p of seenOf(data)) {
           if (!covers(out, p) && !covers(heard, p)) out.push(p);
       }
       return out;
   }

   // What `mine` and one live neighbour share, split by tree: `clash` in one
   // checkout, `merge` across two, which meet only when land merges. `alive` is
   // every live neighbour, `other` among them.
   function sharedWith(mine, other, alive) {
       const pool = [{ data: mine }].concat(Array.isArray(alive) ? alive : []);
       const theirs = other && other.data;
       const paths = overlapPaths(effectiveClaims(mine, pool), effectiveClaims(theirs, pool));
       const same = treeOf(mine) === treeOf(theirs);
       return { clash: same ? paths : [], merge: same ? [] : paths };
   }
   ```

   In `lib/guard.js`, add `worktreeOf, effectiveClaims, sharedWith` to the end of the one-line `module.exports = { … }`, after `decide`.
6. In `lib/render.js`, change line 16 `const { overlapPaths } = require('./overlap.js');` to `const { sharedWith } = require('./guard.js');`. In `otherLine`, change `function otherLine(mineClaims, other, now) {` to `function otherLine(mine, other, now, alive) {` and `const shared = overlapPaths(mineClaims, theirClaims);` to `const shared = sharedWith(mine, other, alive).clash;`. All three are edits in place, so no line of `lib/render.js` above `render()` moves. In `render()`, replace the `also in progress:` block with:

   ```js
       const rest = Array.isArray(others) ? others : [];
       if (rest.length) {
           lines.push('');
           lines.push('also in progress:');
           for (const other of rest) lines.push(otherLine(data, other, now, rest));
           // Paths a neighbour in another checkout holds too. Neither blocks the
           // other; land's merge is where the two meet.
           const merge = [];
           for (const other of rest) {
               for (const p of sharedWith(data, other, rest).merge) if (!merge.includes(p)) merge.push(p);
           }
           if (merge.length) lines.push('merge: ' + merge.join(', ') + ' — also edited in another worktree; they meet at land');
       }
   ```

7. In `hooks/inject.js`, delete the line `const { overlapPaths } = require('../lib/overlap.js');` and change `const { guardMode } = require('../lib/guard.js');` to `const { guardMode, sharedWith } = require('../lib/guard.js');`. Replace the `const overlapping = …` line with, in `hooks/inject.js`:

   ```js
       const overlapping = alive.filter((o) => sharedWith(mine, o, alive).clash.length > 0).length;
   ```

8. In `scripts/task.js`, delete the line `const { overlapPaths } = require('../lib/overlap.js');` and change `const { guardMode } = require('../lib/guard.js');` to `const { guardMode, sharedWith } = require('../lib/guard.js');`. Replace `function collisions(root, sessionId, claims) {` and its body, keeping the comment above it, with:

   ```js
   function collisions(root, sessionId, data) {
       const out = [];
       const liveState = live.readLive(live.liveConfigDir(), sessionId);
       const alive = registry.readActive(root).filter((o) => o.sessionId !== sessionId
           && live.isLive(liveState, o.sessionId, o.data && o.data.configDir));
       for (const other of alive) {
           const shared = sharedWith(data, other, alive).clash;
           if (shared.length) out.push({ task: other.data.task || 'untitled', shared });
       }
       return out;
   }
   ```

   In `scripts/task.js`, change the three calls `collisions(root, id, registry.claimsOf(data))` (in `cmdStage`, `cmdGuard`, `cmdRoute`) to `collisions(root, id, data)`, and in `cmdAdopt` change `collisions(root, id, claims)` to `collisions(root, id, data)`.
9. In `docs/90-agent/reference/collisions.md`, two citation replacements:

   ```text
   `isLive`, `lib/guard.js:130` (`if (!isLive(`)
   ```

   becomes

   ```text
   `isLive`, `lib/guard.js:126` (`isLive(liveState, o.sessionId`)
   ```

   and

   ```text
   `claimedFirst`, `lib/guard.js:131` (`!claimedFirst(data, mine)`)
   ```

   becomes

   ```text
   `claimedFirst`, `lib/guard.js:134` (`!claimedFirst(data, mine)`)
   ```

   In the same file, in the table whose rows are `when`, `what`, `where`, `never`, `cost`, add this row directly under `never`, in `docs/90-agent/reference/collisions.md`:

   ```md
   | weight | weak. Git names no writer and a shared tree shows every session every dirty file, so a `seen` path counts toward a collision only where no live session in the same tree holds it in its own `claims` or `seen` — `effectiveClaims` in `lib/guard.js`. Two sessions that both only saw a file do not collide over it |
   ```

10. In `docs/90-agent/reference/registry.md`, after the sentence Task 3 wrote:

    ```text
    session every dirty file, so `seen` is shown as weak and never enters `claims`.
    ```

    add this sentence on the next line, in `docs/90-agent/reference/registry.md`:

    ```md
    It counts toward a collision only where no live session in the same tree holds the path in its own `claims` or `seen` (`effectiveClaims`, `lib/guard.js`).
    ```

11. Delete the whole `TODO.md` line that starts `- 〔registry〕git 掃描的 claims 降成弱證據`.
12. Run `node --test tests/guard-effective.test.js tests/guard.test.js tests/render.test.js tests/inject.test.js tests/task.test.js`. All pass. Then run `node scripts/docs-check.js`: it must print no line naming `lib/guard.js`.
13. Commit: `feat: effectiveClaims — seen counts only where no live neighbour holds it; other trees merge, not clash`.

## Task 5: the station shows `seen`, marked weak

**Files:**
- Modify: `lib/station.js` — `seen` on the gathered row and on the serialized session, each on the same line as `claims`
- Modify: `assets/station/station.js` — `seenHtml(seen)` after `secOpen`, drawn under the claims list, exported on an existing line
- Read: `lib/registry.js` — `seenOf(data)`
- Test: `tests/station-seen.test.js`

**Interfaces:**
- Consumes: `seenOf` (Task 3)
- Produces: `seenHtml` — `seenHtml(seen)` returns an HTML string, empty for an empty or missing list.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Create `tests/station-seen.test.js`:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const registry = require('../lib/registry.js');
   const station = require('../lib/station.js');
   const tmp = require('./tmp.js');

   global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
   const V = require('../assets/station/station.js');

   const LIVE = 'aaaaaaaa-1111-4111-8111-111111111111';

   test('gather and serialize both carry seen onto the page session', () => {
       const base = tmp('fankeel-station-seen-');
       const cfg = path.join(base, 'cfg');
       const r1 = path.join(base, 'ws');
       fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
       registry.ensureLayout(r1);
       const at = new Date().toISOString();
       registry.writeSession(r1, LIVE, { task: 'seen one', stage: 'build', route: ['survey', 'build'],
           active: true, claims: ['a.js'], seen: ['b.js'], started: at, updated: at, configDir: cfg });
       const m = station.gather({ configDir: cfg, roots: [r1] });
       const row = m.registries[0].sessions.find((s) => s.sessionId === LIVE);
       assert.deepEqual(row.seen, ['b.js']);
       const data = JSON.parse(station.serialize(m, {}).replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
       const page = data.sessions.find((s) => s.id === LIVE);
       assert.deepEqual(page.seen, ['b.js']);
   });

   test('seenHtml marks the list weak, escapes it, and draws nothing for none', () => {
       assert.equal(V.seenHtml([]), '');
       assert.equal(V.seenHtml(undefined), '');
       const html = V.seenHtml(['lib/<x>.js']);
       assert.match(html, /seen（弱：git 看到，沒有經過 hook）/);
       assert.match(html, /lib\/&lt;x&gt;\.js/);
   });
   ```

2. Run `node --test tests/station-seen.test.js`. It fails.
3. In `lib/station.js`, in `gather()`, change the line `                claims: registry.claimsOf(data),` to `                claims: registry.claimsOf(data), seen: registry.seenOf(data),`. In `serialize()`, change `            claims: s.claims, notes: s.notes, next: s.next, guard: s.guard,` to `            claims: s.claims, seen: s.seen || [], notes: s.notes, next: s.next, guard: s.guard,`. Both stay one line, so the station page's line citations into this file do not move.
4. In `assets/station/station.js`, directly after the closing `}` of `function secOpen(id, title, count, open) {`, add:

   ```js
       // What git saw this session write, under its claims and marked weak: git
       // names no writer, so none of it lights a clash. Nothing for none.
       function seenHtml(seen) {
           if (!seen || !seen.length) return '';
           return '<p class="mute" style="font-size:12px">seen（弱：git 看到，沒有經過 hook）</p>'
               + '<div class="claims">' + seen.map(function (p) {
                   return '<div title="' + esc(p) + '">' + esc(p) + '</div>';
               }).join('') + '</div>';
       }
   ```

   In `assets/station/station.js`, in `drawDetail`, change `            + clearControl(s) + '</details>'` to `            + seenHtml(s.seen) + clearControl(s) + '</details>'`. In the `module.exports = {` object, change `            changedParts: changedParts,` to `            changedParts: changedParts, seenHtml: seenHtml,` (same line; the function is hoisted, as `openSections` already is).
5. Run `node --test tests/station-seen.test.js tests/station.test.js tests/station-panel.test.js`. All pass.
6. Commit: `feat: station — seen listed under claims, marked weak`.

## Task 6: a per-session worktree at `start`

**Files:**
- Modify: `lib/profile.js` — `worktree` key after `'prompt.land'`
- Modify: `scripts/task.js` — `openWorktree`, `cmdStart` opens one when the profile says so, `cmdAdopt` carries it, `describe` prints it
- Modify: `lib/render.js` — `worktreeLine` above `render()`; the line in `render`, `renderBrief` and `renderBrainBrief`
- Modify: `.fankeel/.gitignore` — `worktrees/`
- Modify: `docs/90-agent/reference/documents.md` — a lifetime row for the worktrees, and "其餘四區" becomes "其餘五區"
- Modify: `docs/01-guide/profile.md` — a `worktree` row
- Modify: `docs/90-agent/reference/registry.md` — writers for `worktree` and for the new ignore line
- Read: `lib/guard.js` — `worktreeOf(data)`
- Read: `lib/registry.js` — `ensureIgnored(projectRoot, names)`
- Test: `tests/task-worktree.test.js`
- Test: `tests/station-wizard.test.js`

**Interfaces:**
- Consumes: `worktreeOf` (Task 4)
- Produces: the record field `worktree` = { path, branch }, path like .fankeel/worktrees/aaaaaaaa relative to the registry root, branch like fk/aaaaaaaa. `task.js show` and `start` print `worktree: <path> (<branch>)`. `worktreeLine` — `worktreeLine(root, wt)` returns `worktree: <absolute path> (<branch>) — edit there, and run commit.js from there`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests against a real git.

1. Create `tests/task-worktree.test.js`:

   ```js
   'use strict';

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');

   const registry = require('../lib/registry.js');
   const { render, renderBrief } = require('../lib/render.js');
   const tmp = require('./tmp.js');

   const SCRIPT = path.join(__dirname, '..', 'scripts', 'task.js');
   const A = 'aaaaaaaa-1111-2222-3333-444444444444';
   const B = 'bbbbbbbb-1111-2222-3333-444444444444';
   const WT = { path: '.fankeel/worktrees/aaaaaaaa', branch: 'fk/aaaaaaaa' };

   function git(dir, args) {
     return execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
   }

   function repo(profile) {
     const dir = tmp('fankeel-worktree-');
     git(dir, ['init', '-q']);
     git(dir, ['config', 'user.email', 'test@example.invalid']);
     git(dir, ['config', 'user.name', 'test']);
     git(dir, ['config', 'commit.gpgsign', 'false']);
     fs.writeFileSync(path.join(dir, 'kept.js'), 'one\n');
     fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
     fs.writeFileSync(path.join(dir, '.fankeel', '.gitignore'), 'sessions/\n');
     if (profile) fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify(profile) + '\n');
     git(dir, ['add', '-A']);
     git(dir, ['commit', '-qm', 'base']);
     return dir;
   }

   function run(dir, args) {
     const cfg = path.join(dir, 'cfg');
     try {
       return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', dir, '--claude-dir', cfg],
         { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) }), code: 0 };
     } catch (e) {
       return { out: String(e.stdout || ''), code: e.status };
     }
   }

   test('profile worktree: true opens .fankeel/worktrees/<id8> on fk/<id8> and records it', () => {
     const dir = repo({ worktree: 'true' });
     const { out, code } = run(dir, ['start', '--session', A, '--task', 'own tree']);
     assert.equal(code, 0, out);
     assert.deepEqual(registry.readSession(dir, A).worktree, WT);
     assert.ok(fs.existsSync(path.join(dir, '.fankeel', 'worktrees', 'aaaaaaaa', 'kept.js')), 'the checkout is there');
     assert.match(git(dir, ['branch', '--list', 'fk/aaaaaaaa']), /fk\/aaaaaaaa/);
     assert.match(fs.readFileSync(path.join(dir, '.fankeel', '.gitignore'), 'utf8'), /^worktrees\/$/m);
     assert.match(out, /worktree: \.fankeel\/worktrees\/aaaaaaaa \(fk\/aaaaaaaa\)/);
   });

   test('without the key, start opens no worktree', () => {
     const dir = repo(null);
     run(dir, ['start', '--session', A, '--task', 'shared tree']);
     assert.equal(registry.readSession(dir, A).worktree, undefined);
     assert.equal(fs.existsSync(path.join(dir, '.fankeel', 'worktrees')), false);
   });

   test('adopt carries the worktree across', () => {
     const dir = repo({ worktree: 'true' });
     run(dir, ['start', '--session', A, '--task', 'own tree']);
     const { code, out } = run(dir, ['adopt', A, '--session', B]);
     assert.equal(code, 0, out);
     assert.deepEqual(registry.readSession(dir, B).worktree, WT);
   });

   test('the block and a subagent brief both name the worktree', () => {
     const data = { task: 't', stage: 'build', active: true, started: new Date().toISOString(), worktree: WT };
     const line = /^worktree: \/r\/\.fankeel\/worktrees\/aaaaaaaa \(fk\/aaaaaaaa\) — edit there, and run commit\.js from there$/m;
     assert.match(render({ mine: { sessionId: A, data }, others: [], now: Date.now(), root: '/r' }), line);
     assert.match(renderBrief({ mine: { sessionId: A, data }, agentType: 'fankeel-reader', root: '/r', profile: { values: {} } }), line);
   });
   ```

   On Windows `path.join('/r', …)` yields backslashes; `worktreeLine` turns them into forward slashes, which is why the test expects `/r/`.
2. In `tests/station-wizard.test.js`, change `    assert.equal(rows.length, 12);` to `    assert.equal(rows.length, 13);`.
3. Run `node --test tests/task-worktree.test.js tests/station-wizard.test.js`. They fail.
4. In `lib/profile.js`, in `KEYS`, directly under the `'prompt.land': …` line, add:

   ```js
       worktree: { values: ['true', 'false'], builtin: 'false', desc: '起任務時開自己的 git worktree（.fankeel/worktrees/<id 前 8 碼>，分支 fk/<id 前 8 碼>）' },
   ```

5. In `scripts/task.js`, under `const { parseArgs: parseArgv } = require('node:util');`, add `const { execFileSync } = require('node:child_process');`. Directly under the closing `}` of `function projectRootFor(root, opts) {`, add:

   ```js
   // `git worktree add -b fk/<id8> .fankeel/worktrees/<id8>` in the project's
   // repository, with `worktrees/` in its `.fankeel/.gitignore` first so the main
   // tree's `git status` and a Grep never see the checkout. `path` is kept
   // relative to the registry root, forward slashes, the way every claim is.
   // A refusal comes back as git's first line, never as a throw.
   function openWorktree(root, repo, id) {
       const id8 = id.slice(0, 8);
       const rel = '.fankeel/worktrees/' + id8;
       const branch = 'fk/' + id8;
       try {
           registry.ensureIgnored(repo, ['worktrees/']);
           execFileSync('git', ['worktree', 'add', '-b', branch, rel], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
       } catch (e) {
           const said = String((e && e.stderr) || (e && e.message) || '').trim().split(/\r?\n/)[0];
           return { error: said || 'git worktree add failed' };
       }
       return { worktree: { path: path.relative(root, path.join(repo, rel)).split(path.sep).join('/'), branch } };
   }
   ```

6. In `scripts/task.js`, `cmdStart`, directly under `    if (Object.keys(profileSnapshot).length) data.profile = profileSnapshot;`, add:

   ```js
       // Its own checkout, where the profile asks for one. A git that refuses
       // leaves the task on the main tree and says why, rather than refusing it.
       let worktreeNote = null;
       if (prof.values.worktree === true) {
           const made = openWorktree(root, projectRootFor(root, opts), id);
           if (made.worktree) data.worktree = made.worktree;
           else worktreeNote = 'worktree: not opened — ' + made.error;
       }
   ```

   Further down in `cmdStart`, directly under `    for (const line of describe(root, id, data)) lines.push('  ' + line);`, add `    if (worktreeNote) lines.push('  ' + worktreeNote);`.
7. In `scripts/task.js`, change the guard import line to `const { guardMode, sharedWith, worktreeOf } = require('../lib/guard.js');`. In `describe`, directly under `    if (claims.length) lines.push('touched: ' + claims.join(', '));`, add:

   ```js
       const wt = worktreeOf(data);
       if (wt) lines.push('worktree: ' + wt.path + ' (' + wt.branch + ')');
   ```

   In `scripts/task.js`, `cmdAdopt`, directly under `    if (source.floor) data.floor = source.floor;`, add `    if (source.worktree) data.worktree = source.worktree;`.
8. In `lib/render.js`, change line 16 to `const { sharedWith, worktreeOf } = require('./guard.js');`. Directly above `function render({ mine, others, now, root, launch, transcript, unclaimed, profile }) {`, add:

   ```js
   // Where this task's files are: the worktree `task.js start` opened, absolute
   // so it can be used as printed, with the branch land merges.
   function worktreeLine(root, wt) {
       const where = (root ? path.join(root, wt.path) : wt.path).replace(/\\/g, '/');
       return 'worktree: ' + where + ' (' + wt.branch + ') — edit there, and run commit.js from there';
   }
   ```

   In `lib/render.js`, `render()`, directly under the `if (project) lines.push('project: ' + project);` line, add:

   ```js
       const wt = worktreeOf(data);
       if (wt) lines.push(worktreeLine(root, wt));
   ```

   In `lib/render.js`, `renderBrainBrief`, directly under its `    if (claims.length) lines.push('touched: ' + claims.join(', '));`, add `    if (worktreeOf(data)) lines.push(worktreeLine(root, worktreeOf(data)));`. In `renderBrief`, directly under the closing `}` of its `if (claims.length) {` block, add the same line.
9. In `.fankeel/.gitignore`, append the line `worktrees/`.
10. In `docs/90-agent/reference/documents.md`, in the table under the heading about the lifetime of each part of `.fankeel/`, directly under the row for `index.html` and `station/`, add this row, in `docs/90-agent/reference/documents.md`:

    ```md
    | `worktrees/<id8>/` | 否 | profile `worktree: true` 時 `task.js start` 為一個 session 開的 git worktree，分支 `fk/<id8>`；land 合併、測試全綠後 `git worktree remove` |
    ```

    In the same file:

    ```text
    其餘四區都在 `.fankeel/.gitignore` 之內
    ```

    becomes

    ```text
    其餘五區都在 `.fankeel/.gitignore` 之內
    ```

11. In `docs/01-guide/profile.md`, directly under the `stage.agents` row of the key table, add, in `docs/01-guide/profile.md`:

    ```md
    | `worktree` | 起任務時開自己的 git worktree（`.fankeel/worktrees/<id 前 8 碼>/`，分支 `fk/<id 前 8 碼>`），共用樹的誤記消失、真衝突留到 land 合併 | `true`、`false`；內建 `false` | `false` |
    ```

12. In `docs/90-agent/reference/registry.md`, two insertions. In the sessions row of the first table:

    ```text
    `touch.js` for `claims`;
    ```

    becomes

    ```text
    `start` for `worktree` (`{ path, branch }`) when the profile's `worktree` is `true` — `adopt` copies it; `touch.js` for `claims`;
    ```

    and in the ignore-file row of the same table:

    ```text
    `lib/station.js` for `index.html` and `station/` on every write of the copy
    ```

    becomes

    ```text
    `lib/station.js` for `index.html` and `station/` on every write of the copy, `task.js start` for `worktrees/` when it opens one
    ```

13. Run `node --test tests/task-worktree.test.js tests/station-wizard.test.js tests/profile.test.js tests/docs.test.js tests/render.test.js tests/task.test.js`. All pass.
14. Commit: `feat: profile worktree — start opens .fankeel/worktrees/<id8> on fk/<id8>`.

## Task 7: paths inside a worktree are recorded as logical paths

**Files:**
- Modify: `lib/guard.js` — `logicalPath`; `decide` judges the logical path
- Modify: `hooks/touch.js` — claims the logical path
- Modify: `lib/dirty.js` — a record with a worktree is scanned in that checkout
- Modify: `TODO.md` — remove line 86 (the `〔registry〕每個 session 各開一個 git worktree` entry)
- Read: `lib/registry.js` — `readSession`, `claimsOf`, `seenOf`
- Test: `tests/worktree-paths.test.js`

**Interfaces:**
- Consumes: `worktreeOf` (Task 4); the `worktree` record field (Task 6)
- Produces: `logicalPath` — `logicalPath(rel)` returns `rel` with its first worktree segment (.fankeel/worktrees/ plus 8 hex digits and a slash) removed; a non-string passes through.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests against a real worktree.

1. Create `tests/worktree-paths.test.js`:

   ```js
   'use strict';

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');

   const guard = require('../lib/guard.js');
   const dirty = require('../lib/dirty.js');
   const registry = require('../lib/registry.js');
   const tmp = require('./tmp.js');

   const HOOK = path.join(__dirname, '..', 'hooks', 'touch.js');
   const A = 'aaaaaaaa-0000-4000-8000-000000000001';
   const B = 'bbbbbbbb-0000-4000-8000-000000000002';
   const WT = { path: '.fankeel/worktrees/aaaaaaaa', branch: 'fk/aaaaaaaa' };

   function git(dir, args) {
     execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'ignore', 'ignore'] });
   }

   function seed(root, over) {
     const dir = path.join(root, '.fankeel', 'sessions');
     fs.mkdirSync(dir, { recursive: true });
     const data = Object.assign({ task: 't', stage: 'build', active: true,
       started: new Date(Date.now() - 3600e3).toISOString(), updated: new Date().toISOString() }, over);
     fs.writeFileSync(path.join(dir, A + '.json'), JSON.stringify(data) + '\n');
   }

   test('logicalPath drops the worktree segment and keeps a project prefix', () => {
     assert.equal(guard.logicalPath('.fankeel/worktrees/aaaaaaaa/lib/x.js'), 'lib/x.js');
     assert.equal(guard.logicalPath('Waypoint/.fankeel/worktrees/aaaaaaaa/lib/x.js'), 'Waypoint/lib/x.js');
     assert.equal(guard.logicalPath('lib/x.js'), 'lib/x.js');
     assert.equal(guard.logicalPath(null), null);
   });

   test('an edit inside the worktree is claimed as lib/x.js', () => {
     const root = tmp('fankeel-wt-touch-');
     seed(root, { worktree: WT });
     const file = path.join(root, '.fankeel', 'worktrees', 'aaaaaaaa', 'lib', 'x.js');
     execFileSync(process.execPath, [HOOK], {
       input: JSON.stringify({ session_id: A, cwd: root, tool_name: 'Edit', tool_input: { file_path: file } }),
       env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }), encoding: 'utf8',
     });
     assert.deepEqual(registry.claimsOf(registry.readSession(root, A)), ['lib/x.js']);
   });

   test('git is asked about the worktree, and answers in logical paths', () => {
     const root = tmp('fankeel-wt-dirty-');
     git(root, ['init', '-q']);
     git(root, ['config', 'user.email', 'test@example.invalid']);
     git(root, ['config', 'user.name', 'test']);
     git(root, ['config', 'commit.gpgsign', 'false']);
     fs.writeFileSync(path.join(root, 'kept.js'), 'one\n');
     fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
     fs.writeFileSync(path.join(root, '.fankeel', '.gitignore'), 'sessions/\nworktrees/\n');
     git(root, ['add', '-A']);
     git(root, ['commit', '-qm', 'base']);
     git(root, ['worktree', 'add', '-q', '-b', 'fk/aaaaaaaa', '.fankeel/worktrees/aaaaaaaa']);
     seed(root, { worktree: WT });
     const wt = path.join(root, '.fankeel', 'worktrees', 'aaaaaaaa');
     fs.mkdirSync(path.join(wt, 'lib'), { recursive: true });
     fs.writeFileSync(path.join(wt, 'lib', 'y.js'), 'x\n');
     fs.writeFileSync(path.join(root, 'main-only.js'), 'x\n');
     dirty.claimWrites(root, A, registry.readSession(root, A));
     assert.deepEqual(registry.seenOf(registry.readSession(root, A)), ['lib/y.js']);
   });

   test('the guard judges an edit inside a worktree by its logical path', () => {
     const older = new Date(Date.now() - 7200e3).toISOString();
     const mine = { active: true, guard: 'ask', started: new Date().toISOString(), worktree: WT };
     const theirs = { sessionId: B, data: { active: true, claims: ['lib/x.js'], started: older, worktree: WT } };
     const verdict = guard.decide({ mine, sessionId: A, others: [theirs], root: '/r',
       file: '/r/.fankeel/worktrees/aaaaaaaa/lib/x.js', liveState: { known: false, ids: new Set() } });
     assert.equal(verdict && verdict.decision, 'ask');
   });
   ```

2. Run `node --test tests/worktree-paths.test.js`. It fails: `guard.logicalPath` is not a function, and the dirty case sees `main-only.js`.
3. In `lib/guard.js`, directly under the closing `}` of `function sharedWith(` (Task 4), add:

   ```js
   // The path a file has in the project, whichever checkout it was edited in:
   // `.fankeel/worktrees/<id8>/lib/x.js` is `lib/x.js`, so two sessions in two
   // worktrees name one file the same way. A project prefix in front stays.
   const WORKTREE_SEGMENT = /(^|\/)\.fankeel\/worktrees\/[0-9a-fA-F]{8}\//;
   function logicalPath(rel) {
       if (typeof rel !== 'string' || !rel) return rel;
       return rel.replace(WORKTREE_SEGMENT, '$1');
   }
   ```

   In `lib/guard.js`, `decide`, change `    const rel = relPath(root, file);` to `    const rel = logicalPath(relPath(root, file));`, and add `logicalPath` to the end of the `module.exports` line.
4. In `hooks/touch.js`, change `const { relPath, covers, targetOf } = require('../lib/guard.js');` to `const { relPath, covers, targetOf, logicalPath } = require('../lib/guard.js');` and `    const rel = relPath(root, file);` to `    const rel = logicalPath(relPath(root, file));`. Both are edits in place, so `hooks/touch.js:42` still holds.
5. In `lib/dirty.js`, change `const { covers } = require('./guard.js');` to `const { covers, worktreeOf } = require('./guard.js');`. In `claimWrites`, replace `    const written = writtenSince(sub ? path.join(root, sub) : root, since);` with, in `lib/dirty.js`:

   ```js
       // A task in its own worktree is asked about that checkout. Git answers
       // relative to it, which is already the logical path, prefix aside.
       const tree = worktreeOf(data);
       const written = writtenSince(tree ? path.join(root, tree.path) : (sub ? path.join(root, sub) : root), since);
   ```

6. Delete the whole `TODO.md` line that starts `- 〔registry〕每個 session 各開一個 git worktree`.
7. Run `node --test tests/worktree-paths.test.js tests/touch.test.js tests/dirty.test.js tests/guard.test.js`. All pass.
8. Commit: `feat: worktree paths — touch, dirty and guard record the logical path`.

## Task 8: `task.js intends`

**Files:**
- Modify: `lib/registry.js` — `MAX_INTENDS`, `intendsOf`, `setIntends`, appended above `module.exports` and exported
- Modify: `lib/plantasks.js` — export `filedPaths`
- Modify: `scripts/task.js` — `cmdIntends`, `intends` in `COMMANDS` and `USAGE`; `cmdTask` also deletes `intends`
- Modify: `skills/fankeel/SKILL.md` — the command list gains `intends`
- Modify: `docs/90-agent/reference/registry.md` — writer for `intends`
- Read: `lib/guard.js` — `effectiveClaims(data, liveOthers)`
- Read: `lib/overlap.js` — `overlapPaths(mine, theirs)`
- Read: `lib/live.js` — `readLive`, `liveConfigDir`, `isLive`
- Test: `tests/task-intends.test.js`

**Interfaces:**
- Consumes: `effectiveClaims` (Task 4)
- Produces: `task.js intends` — `node scripts/task.js intends <plan-or-design> --session <id>` prints `fankeel — intends: <n> paths from <file>`, then one `warn: <task> @ <stage> — <paths>` or `note: …` line per overlapping live neighbour, or `none`. `intendsOf` — `intendsOf(data)` returns an array of strings. `setIntends` — `setIntends(projectRoot, sessionId, paths)` replaces the list whole and returns a boolean. `MAX_INTENDS` is 60. `filedPaths` — `filedPaths(designText)` returns an array of strings.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Create `tests/task-intends.test.js`:

   ```js
   'use strict';

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');

   const registry = require('../lib/registry.js');
   const tmp = require('./tmp.js');

   const SCRIPT = path.join(__dirname, '..', 'scripts', 'task.js');
   const A = 'aaaaaaaa-1111-2222-3333-444444444444';
   const B = 'bbbbbbbb-1111-2222-3333-444444444444';

   const PLAN = '# P\n\n## Task 1: one\n\n**Files:**\n- Modify: `lib/a.js` — x\n- Test: `tests/a.test.js`\n';
   const DESIGN = '# D\n\n| file | why |\n|---|---|\n| `lib/b.js` | y |\n';

   function seed(root, id, over) {
     const dir = path.join(root, '.fankeel', 'sessions');
     fs.mkdirSync(dir, { recursive: true });
     const data = Object.assign({ task: 'task ' + id.slice(0, 1), stage: 'plan', active: true,
       started: new Date(Date.now() - 3600e3).toISOString(), updated: new Date().toISOString() }, over);
     fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify(data) + '\n');
   }

   function intends(dir, file) {
     const cfg = path.join(dir, 'cfg');
     return execFileSync(process.execPath, [SCRIPT, 'intends', file, '--session', A, '--root', dir, '--claude-dir', cfg],
       { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
   }

   function setup(neighbour) {
     const dir = tmp('fankeel-intends-');
     seed(dir, A);
     if (neighbour) seed(dir, B, neighbour);
     fs.writeFileSync(path.join(dir, 'plan.md'), PLAN);
     fs.writeFileSync(path.join(dir, 'x-design.md'), DESIGN);
     return dir;
   }

   test('a neighbour at build already holding a plan file is a warn', () => {
     const dir = setup({ task: 'their build', stage: 'build', claims: ['lib/a.js'] });
     const out = intends(dir, path.join(dir, 'plan.md'));
     assert.match(out, /^warn: their build @ build — lib\/a\.js$/m);
     assert.deepEqual(registry.readSession(dir, A).intends, ['lib/a.js', 'tests/a.test.js']);
   });

   test('a neighbour at design intending the same file is a note', () => {
     const dir = setup({ task: 'their design', stage: 'design', intends: ['tests/a.test.js'] });
     assert.match(intends(dir, path.join(dir, 'plan.md')), /^note: their design @ design — tests\/a\.test\.js$/m);
   });

   test('nothing shared prints none', () => {
     const dir = setup({ task: 'elsewhere', stage: 'build', claims: ['other.js'] });
     assert.match(intends(dir, path.join(dir, 'plan.md')), /^none$/m);
   });

   test('a design file is read through its file table', () => {
     const dir = setup(null);
     intends(dir, path.join(dir, 'x-design.md'));
     assert.deepEqual(registry.readSession(dir, A).intends, ['lib/b.js']);
   });
   ```

2. Run `node --test tests/task-intends.test.js`. It fails: `No such command: intends`.
3. In `lib/registry.js`, directly above `module.exports = {` (under Task 3's `addSeen`), add:

   ```js
   // What this task means to edit, from its plan's Files blocks or its design's
   // file table, set by `task.js intends`. Replaced whole on each call and capped
   // like `claims`. Nothing blocks on it: it is compared and printed.
   const MAX_INTENDS = 60;

   function intendsOf(data) {
       if (!data || !Array.isArray(data.intends)) return [];
       return data.intends.filter((c) => typeof c === 'string' && c.trim());
   }

   function setIntends(projectRoot, sessionId, paths) {
       const list = [];
       for (const p of Array.isArray(paths) ? paths : []) {
           const text = String(p == null ? '' : p).trim();
           if (text && !list.includes(text)) list.push(text);
       }
       return update(projectRoot, sessionId, (data) => {
           data.intends = list.slice(-MAX_INTENDS);
           return true;
       });
   }
   ```

   In the `module.exports` object in `lib/registry.js`, under `    MAX_MOVES,` add `    MAX_INTENDS,`, and under `    addSeen,` add `    intendsOf,` and `    setIntends,`.
4. In `lib/plantasks.js`, change the `module.exports` line so it ends `…, fences, lint, filedPaths };`.
5. In `scripts/task.js`, change the guard import line to `const { guardMode, sharedWith, worktreeOf, effectiveClaims } = require('../lib/guard.js');` and add under it `const { overlapPaths } = require('../lib/overlap.js');`. Directly above `const COMMANDS = {`, add:

   ```js
   // The files this task means to edit, set as `intends` and compared with every
   // live neighbour's effective claims and intends. A plan is read through its
   // Files blocks (Modify and Test); a `-design.md` through its file table. A
   // neighbour at build or later is a `warn` — it is already writing; any
   // earlier stage is a `note`. It prints and blocks nothing.
   const WRITING_STAGES = ['build', 'verify', 'audit', 'land'];

   function cmdIntends(root, opts) {
       const id = requireSession(opts);
       const given = opts.positional[0];
       if (!given) fail('Give the plan or design file: intends <file> --session <id>');
       let text = null;
       try {
           text = fs.readFileSync(path.resolve(given), 'utf8');
       } catch (e) { /* named below */ }
       if (text === null) fail('Cannot read ' + given);
       const mine = registry.readSession(root, id);
       if (!mine || mine.active !== true) fail('No active entry for this session under ' + root);

       const listed = /-design\.md$/.test(given)
           ? plantasks.filedPaths(text)
           : plantasks.parsePlan(text).tasks.flatMap((t) => t.modify.concat(t.test));
       const sub = registry.projectOf(mine).replace(/\\/g, '/').replace(/\/+$/, '');
       if (!registry.setIntends(root, id, listed.map((p) => (sub ? sub + '/' + p : p)))) fail('Could not write the entry.');
       const data = registry.readSession(root, id) || mine;

       const liveState = live.readLive(live.liveConfigDir(), id);
       const alive = registry.readActive(root).filter((o) => o.sessionId !== id
           && live.isLive(liveState, o.sessionId, o.data && o.data.configDir));
       const pool = [{ data }].concat(alive);
       const held = registry.intendsOf(data);
       const lines = ['fankeel — intends: ' + held.length + ' path' + (held.length === 1 ? '' : 's') + ' from ' + given];
       for (const other of alive) {
           const theirs = effectiveClaims(other.data, pool).concat(registry.intendsOf(other.data));
           const shared = overlapPaths(held, theirs);
           if (!shared.length) continue;
           const stage = String(other.data.stage || '?');
           const level = WRITING_STAGES.includes(stage) ? 'warn' : 'note';
           lines.push(level + ': ' + (other.data.task || 'untitled') + ' @ ' + stage + ' — ' + shared.join(', '));
       }
       if (lines.length === 1) lines.push('none');
       return lines.join(NL);
   }
   ```

   In `scripts/task.js`, add `    intends: cmdIntends,` under `    land: cmdLand,` in `COMMANDS`. In `USAGE`, directly under the two `land <merge|pr|keep>` lines, add, in `scripts/task.js`:

   ```js
       '  intends <plan-or-design>          the files it names become this task\'s intends;',
       '                                    warn/note per live neighbour already in them',
   ```

   In `cmdTask`, directly under `        delete d.seen;` (Task 3), add `        delete d.intends;`.
6. In `skills/fankeel/SKILL.md`, in the command block under `**Never write that file by hand.**`, directly under the `route` line, add `node <plugin>/scripts/task.js intends <plan-or-design> --session <id>`.
7. In `docs/90-agent/reference/registry.md`, in the sessions row of the first table:

   ```text
   `touch.js` for `claims`;
   ```

   becomes

   ```text
   `task.js intends` for `intends`, replaced whole on each call and capped at sixty; `touch.js` for `claims`;
   ```

8. Run `node --test tests/task-intends.test.js tests/task.test.js tests/plantasks.test.js tests/registry.test.js tests/source.test.js`. All pass once the new test file is `git add`ed.
9. Commit: `feat: task.js intends — plan and design files become intends, compared with live neighbours`.

## Task 9: plan's gate and build's start run `intends`

**Files:**
- Modify: `lib/stages.js` — a clause in plan's `Before the gate:` rule and in build's `From a plan:` rule, both edited in place
- Modify: `skills/fankeel-plan/SKILL.md` — a **Neighbours, before the gate.** paragraph after step 5
- Modify: `skills/fankeel-build/SKILL.md` — a **Then the neighbours.** paragraph at the end of §1
- Modify: `skills/registry.json` — regenerated
- Modify: `TODO.md` — remove line 87 (the `〔registry〕意圖比對` entry)
- Test: `tests/stages-intends.test.js`

**Interfaces:**
- Consumes: `task.js intends` (Task 8)
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the exact text; Ruling 2 has already measured the budgets.

1. Create `tests/stages-intends.test.js`:

   ```js
   'use strict';

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');

   const { byName } = require('../lib/stages.js');

   test('the plan gate and the start of build both run task.js intends', () => {
     assert.match(byName('plan').rules.join('\n'), /^Before the gate: `task\.js intends <f>`, `ledger\.js --plan <f> lint` clean/m);
     assert.match(byName('build').rules.join('\n'), /--plan <f> show` and `task\.js intends <f>` first;/);
   });

   test('both skills give the whole command, session flag included', () => {
     for (const name of ['fankeel-plan', 'fankeel-build']) {
       const text = fs.readFileSync(path.join(__dirname, '..', 'skills', name, 'SKILL.md'), 'utf8');
       assert.match(text, /task\.js intends <plan bucket>\/<file>\.md --session <id>/, name);
     }
   });
   ```

2. Run `node --test tests/stages-intends.test.js`. It fails.
3. In `lib/stages.js`, plan's rules, the string's start:

   ```text
   'Before the gate: `ledger.js --plan <f> lint` clean, then one fankeel-reviewer
   ```

   becomes

   ```text
   'Before the gate: `task.js intends <f>`, `ledger.js --plan <f> lint` clean, then one fankeel-reviewer
   ```

   In build's rules, the string's start:

   ```text
   'From a plan: `node {{LEDGER}} --plan <f> show` first;
   ```

   becomes

   ```text
   'From a plan: `node {{LEDGER}} --plan <f> show` and `task.js intends <f>` first;
   ```

   The rest of each string does not change, and no line is added or removed.
4. In `skills/fankeel-plan/SKILL.md`, between the end of step 5 and the line below:

   ```text
   Fix inline. If a requirement has no task, add the task.
   ```

   insert this paragraph, in `skills/fankeel-plan/SKILL.md`:

   ```md
   **Neighbours, before the gate.** `node <plugin>/scripts/task.js intends <plan bucket>/<file>.md --session <id>`
   records every `Modify:` and `Test:` path as this task's `intends` and compares
   them with each live neighbour's claims and intends: `warn` for a neighbour at
   build, verify, audit or land, which is already writing there; `note` for one at
   an earlier stage; `none` when nothing meets. It blocks nothing. Say each `warn`
   line in the report above the question, naming the neighbour's task; a `note`
   needs no word.
   ```

5. In `skills/fankeel-build/SKILL.md`, §1 `An isolated workspace`, after the paragraph that ends:

   ```text
   they chose, and do not ask again.
   ```

   insert this paragraph, in `skills/fankeel-build/SKILL.md`:

   ```md
   **Then the neighbours.** `node <plugin>/scripts/task.js intends <plan bucket>/<file>.md --session <id>`
   — with no plan, the design file, whose file table it reads instead — records
   this task's `intends` and prints `warn`, `note` or `none` against every live
   neighbour. It blocks nothing. A `warn` names a session already at build or later
   in these files: say it in the first dispatch announcement, before any
   implementer goes out.
   ```

6. Run `node scripts/stage-registry.js`, then `node --test tests/stages-intends.test.js tests/stages.test.js tests/stage-registry.test.js tests/render.test.js tests/skills.test.js tests/pipeline-doc.test.js`. All pass. `skills/registry.json` should then read plan 2394 of 2400 and build 2316 of 2400.
7. Delete the whole `TODO.md` line that starts `- 〔registry〕意圖比對`.
8. Commit: `feat: plan gate and build start run task.js intends`.

## Task 10: citations moved by Tasks 1–9

**Files:**
- Modify: `docs/90-agent/reference/registry.md` — `lib/dirty.js:176`, `lib/dirty.js:183`
- Modify: `docs/90-agent/reference/subagents.md` — `lib/profile.js:111` to `:156`, `scripts/task.js:940` and `:947`
- Modify: `skills/fankeel-survey/SKILL.md` — `scripts/task.js:523`, `scripts/task.js:1237`
- Modify: `docs/01-guide/development.md` — `scripts/task.js:157`, `hooks/inject.js:75`
- Modify: `docs/90-agent/reference/collisions.md` — any `lib/guard.js` or `lib/dirty.js` line docs-check still names
- Read: `scripts/docs-check.js` — how the check reads a `path:line` plus quote
- Read: `lib/dirty.js` — the cited lines, after Tasks 1, 3 and 7
- Read: `lib/guard.js` — the cited lines, after Tasks 4 and 7
- Read: `lib/profile.js` — the cited lines, after Task 6
- Read: `scripts/task.js` — the cited lines, after Tasks 3, 4, 6 and 8
- Read: `hooks/inject.js` — the cited line, after Task 4

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — mechanical: the check names each line and where it moved.

1. Run `node scripts/docs-check.js`. Expect `does not hold` lines for the citations in the Files block above. That output is the failing test.
2. Where a line ends `— it is at :<n>`, change that citation's line number to `<n>`. Where a line ends `anywhere in the range`, open the cited file, find the code the sentence describes, and change both the number and the backticked quote to match it.
3. `docs/01-guide/development.md` cites `scripts/task.js:157` and `hooks/inject.js:75` with no quote, as the two callers of `badge.clearBadge`. Set both numbers to what `grep -n "badge.clearBadge" scripts/task.js hooks/inject.js` prints.
4. Run `node scripts/docs-check.js` again. It must print `Every reference resolves.` with no `does not hold` line. Then run `node --test tests/docs.test.js tests/skills.test.js`.
5. Commit: `docs: citations moved by the registry lenses tasks`.

## Task 11: the lens classifier and its CLI

**Files:**
- Modify: `lib/lenses.js` — new file. `lensesFor(diffText)`, the classifier `scripts/lenses.js` and the reviewer's brief both key off.
- Modify: `scripts/lenses.js` — new file. `node scripts/lenses.js <range> [--root <dir>]`, run before dispatching the reviewer.
- Test: `tests/lenses.test.js`

**Interfaces:**
- Consumes: none
- Produces: `lensesFor(diffText)` and `addedLines(diffText)`, exported from `lib/lenses.js`. `lensesFor` returns a `string[]` containing `'silent-failure'` and/or `'comment'`, in that order, and `[]` when a diff's added lines carry neither an added `catch`/`except`/`.catch(`/`||` nor an added comment line (`//`, `#`, `/*`, `*`). CLI contract: `node <plugin>/scripts/lenses.js <range> [--root <dir>]` runs `git diff <range>` in `--root` (default `process.cwd()`) and prints each name `lensesFor` returned, one per line, or the single word `none`; exit `0` on any result, `1` when `git diff` fails, `2` on a usage error — no `<range>`, or one `git` would read as an option.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

### Steps

1. Write the failing test.

In `tests/lenses.test.js`, add:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const { lensesFor, addedLines } = require('../lib/lenses.js');
const { parseArgs } = require('../scripts/lenses.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'lenses.js');

function git(cwd, ...args) {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

// Two commits; every test's range is HEAD~1..HEAD against them.
function repo(secondContent) {
    const dir = tmp('fankeel-lenses-');
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'test@example.invalid');
    git(dir, 'config', 'user.name', 'test');
    git(dir, 'config', 'commit.gpgsign', 'false');
    fs.writeFileSync(path.join(dir, 'a.js'), 'module.exports = 1;\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'base');
    fs.writeFileSync(path.join(dir, 'a.js'), secondContent);
    git(dir, 'commit', '-qam', 'change');
    return dir;
}

test('addedLines: only the lines a diff adds, never the +++ file header', () => {
    const diff = ['--- a/a.js', '+++ b/a.js', '-old', '+new', ' unchanged'].join('\n');
    assert.deepEqual(addedLines(diff), ['new']);
});

test('lensesFor: an added catch( line reads as silent-failure, never []', () => {
    const diff = [
        ' module.exports = 1;',
        '+try {',
        '+  risky();',
        '+} catch (e) {',
        '+  return null;',
        '+}',
    ].join('\n');
    const lenses = lensesFor(diff);
    assert.ok(lenses.length, 'an added catch( line came back []');
    assert.deepEqual(lenses, ['silent-failure']);
});

test('lensesFor: a diff that only adds a comment line reads as comment, never []', () => {
    const diff = [' module.exports = 1;', '+// exported for the CLI entry point'].join('\n');
    const lenses = lensesFor(diff);
    assert.ok(lenses.length, 'a comment-only diff came back []');
    assert.deepEqual(lenses, ['comment']);
});

test('lensesFor: both patterns fire both lenses; neither pattern is []', () => {
    const both = ['+// swallow it', '+try { risky(); } catch (e) { return undefined; }'].join('\n');
    assert.deepEqual(lensesFor(both), ['silent-failure', 'comment']);
    assert.deepEqual(lensesFor(['+const x = 1;', '+return x + 1;'].join('\n')), []);
});

test('parseArgs: <range> and --root, and a range git would read as an option is refused', () => {
    assert.deepEqual(parseArgs(['a..b']), { range: 'a..b', root: process.cwd() });
    assert.equal(parseArgs(['a..b', '--root', '/x']).root, '/x');
    assert.ok(parseArgs([]).error, 'no range');
    assert.ok(parseArgs(['--bogus']).error, 'a range starting with -');
    assert.ok(parseArgs(['a..b', '--root']).error, '--root with nothing after it');
});

test('scripts/lenses.js <range>: one lens per line from the real git diff', () => {
    const dir = repo('module.exports = 1;\n// a plain comment\n');
    const r = spawnSync(process.execPath, [SCRIPT, 'HEAD~1..HEAD', '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, 'comment\n');
});

test('scripts/lenses.js: no lens fires, prints none', () => {
    const dir = repo('module.exports = 2;\n');
    const r = spawnSync(process.execPath, [SCRIPT, 'HEAD~1..HEAD', '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, 'none\n');
});

test('scripts/lenses.js: no range is a usage error, exit 2, nothing run', () => {
    const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /usage: lenses\.js/);
});
```

2. Run it and watch it fail:

```
node --test tests/lenses.test.js
```

It fails on the first `require` — neither `lib/lenses.js` nor `scripts/lenses.js` exists yet.

3. Write the minimal implementation.

In `lib/lenses.js`, add:

```js
'use strict';

// scripts/lenses.js's classifier: which of build's and verify's two extra
// reviewer lenses — agents/fankeel-reviewer.md's `## Silent failure` and
// `## Comment` — an added line in a diff is worth dispatching the reviewer
// for. Read only the lines a diff adds: a `-` line is code already gone, and
// firing a lens on a deletion would send the reviewer looking at the wrong
// half of the change.
//
// `catch`, `except`, `.catch(` and `||` are the silent-failure lens's own
// four patterns (docs/90-agent/plans/2026-09-27-registry-lenses-design.md
// §5); a line opening with `//`, `#`, `/*` or `*` is a comment line, for the
// comment lens. Neither lens is the reviewer's judgement — it still reads
// the line in context and decides whether the catch actually swallows
// something or the comment actually disagrees with the code beside it; this
// only decides which of the two lenses is worth sending it with.

const SILENT_FAILURE = /\bcatch\b|\bexcept\b|\.catch\(|\|\|/;
const COMMENT = /^(\/\/|#|\/\*|\*)/;

// Added lines only, unmarked: a unified diff's leading `+` stripped, and the
// `+++ b/<path>` file header — which also starts with `+` — left out.
function addedLines(diffText) {
    const out = [];
    for (const raw of String(diffText).split(/\r?\n/)) {
        if (!raw.startsWith('+') || raw.startsWith('+++')) continue;
        const line = raw.slice(1);
        if (line.trim()) out.push(line);
    }
    return out;
}

function lensesFor(diffText) {
    let silent = false;
    let comment = false;
    for (const line of addedLines(diffText)) {
        if (!silent && SILENT_FAILURE.test(line)) silent = true;
        if (!comment && COMMENT.test(line.trim())) comment = true;
        if (silent && comment) break;
    }
    const out = [];
    if (silent) out.push('silent-failure');
    if (comment) out.push('comment');
    return out;
}

module.exports = { lensesFor, addedLines };
```

In `scripts/lenses.js`, add:

```js
#!/usr/bin/env node
'use strict';

// Which of build's and verify's two extra reviewer lenses — the
// `## Silent failure` and `## Comment` sections of agents/fankeel-reviewer.md
// — a range's diff is worth dispatching. The classifier is `lib/lenses.js`'s
// `lensesFor`, kept there so a test can call it directly; this script is the
// dispatch step's own CLI, run before sending the reviewer:
//
//   node scripts/lenses.js <range> [--root <dir>]
//
// Prints one lens name per line — `silent-failure`, `comment`, both, or
// neither — and `none` when lensesFor found nothing. Exit 0 whatever it
// finds; 1 when `git diff` fails; 2 on a usage error.

const { execFileSync } = require('node:child_process');
const { lensesFor } = require('../lib/lenses.js');

const USAGE = 'usage: lenses.js <range> [--root <dir>]';

function parseArgs(argv) {
    const out = { range: null, root: process.cwd() };
    const positionals = [];
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--root') {
            if (i + 1 >= argv.length) return { error: USAGE };
            out.root = argv[++i];
            continue;
        }
        positionals.push(argv[i]);
    }
    out.range = positionals[0] || null;
    if (!out.range) return { error: USAGE };
    // Handed to git as an argument: one starting with `-` would be read as an option.
    if (out.range.startsWith('-')) return { error: '<range> is <a>..<b>, not an option: ' + out.range };
    return out;
}

function main(argv) {
    const args = parseArgs(argv);
    if (args.error) {
        process.stderr.write(args.error + '\n');
        return 2;
    }
    let diff;
    try {
        diff = execFileSync('git', ['diff', args.range], { cwd: args.root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        process.stderr.write('git diff ' + args.range + ' failed in ' + args.root + ': ' + String(e.stderr || e.message).trim() + '\n');
        return 1;
    }
    const lenses = lensesFor(diff);
    process.stdout.write((lenses.length ? lenses.join('\n') : 'none') + '\n');
    return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { parseArgs };
```

4. Run it and watch it pass:

```
node --test tests/lenses.test.js
```

5. `git add lib/lenses.js scripts/lenses.js tests/lenses.test.js` before doing anything else with them. `tests/source.test.js` finds every file it scans through `git ls-files`; an untracked file is invisible to its NUL-byte scan and to "every exported name is imported by something" alike — staging the three now, rather than leaving it to whichever later commit happens to add them, is what lets that test actually see this task's exports. Then commit.

## Task 12: the reviewer's silent-failure and comment lenses, wired into build and verify

**Files:**
- Modify: `agents/fankeel-reviewer.md` — add `## Silent failure` and `## Comment`, in the shape of `## Security`, right after its closing paragraph and before `## Return`.
- Modify: `skills/fankeel-build/SKILL.md` — step 5's per-task reviewer dispatch runs `scripts/lenses.js` first and names what it printed in the brief.
- Modify: `skills/fankeel-verify/SKILL.md` — the adversary's dispatch, in `## The adversary`, runs `scripts/lenses.js` over the branch's whole range and names what it printed too, beside the `## Security` lens it already asks for.
- Read: `scripts/lenses.js` — the CLI this task's two skill edits invoke; written by Task 11, not changed here.
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: Task 11's CLI contract — `node <plugin>/scripts/lenses.js <range> [--root <dir>]`, printing `silent-failure` and/or `comment` (one per line) or `none`.
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

### Steps

1. Write the failing test.

At the end of `tests/agents.test.js`, after the `'every agent names its effort, and none of them is max'` test's closing `});`, add:

```js

// The silent-failure and comment lenses: defined here once, and asked for by
// build's per-task dispatch and verify's adversary through scripts/lenses.js.
// docs/90-agent/plans/2026-09-27-registry-lenses-design.md §5.
test('the reviewer carries the silent-failure and comment lenses, and build and verify run scripts/lenses.js before dispatching', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reviewer.md'), 'utf8');
    assert.match(text, /^## Silent failure$/m);
    assert.match(text, /^## Comment$/m);
    const silent = text.split('\n## Silent failure\n')[1].split('\n## ')[0];
    for (const tag of ['swallow:', 'unlogged:', 'broad:']) assert.ok(silent.includes('`' + tag + '`'), 'the lens does not define ' + tag);
    assert.match(silent, /silent-failure: <N> findings\./);
    const comment = text.split('\n## Comment\n')[1].split('\n## ')[0];
    for (const tag of ['stale:', 'unwritten:']) assert.ok(comment.includes('`' + tag + '`'), 'the lens does not define ' + tag);
    assert.match(comment, /comment: <N> findings\./);

    const build = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-build', 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
    assert.match(build, /scripts\/lenses\.js/);
    assert.match(build, /`## Silent failure` lens/);
    assert.match(build, /`## Comment` lens/);
    const verify = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-verify', 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
    assert.match(verify, /scripts\/lenses\.js/);
    assert.match(verify, /`## Silent failure` lens/);
    assert.match(verify, /`## Comment` lens/);
});
```

2. Run it and watch it fail:

```
node --test tests/agents.test.js
```

It fails — neither heading exists in `agents/fankeel-reviewer.md`, and neither `SKILL.md` mentions `scripts/lenses.js` yet.

3. Write the minimal implementation.

In `agents/fankeel-reviewer.md`, right after the sentence "open each `path:line`, trace it from source to sink, and keep or drop it. The line format and the closing line do not change." and before `## Return`, add:

```markdown
## Silent failure

When the brief asks for the silent-failure lens — build's per-task dispatch
and verify's adversary run `scripts/lenses.js` over the range first and ask
for this lens only when it printed `silent-failure` — read every `catch`,
`except`, `.catch(` and `||` fallback the diff adds for a failure that goes
nowhere. One line per finding:

`path:line: <tag> <what fails silently>. <the fix>.`

| tag | the diff adds | look for |
|---|---|---|
| `swallow:` | a caught error with no rethrow, no returned error, and no fallback that changes what the caller does next | a `catch`/`except` block that leaves the caller looking exactly like the call succeeded |
| `unlogged:` | a caught error, or a `?.` short-circuit, that leaves no trace anywhere | nothing written to a log, a report, a `claims`/`seen` field, or a status the caller can read |
| `broad:` | a catch wider than the one failure it was written for | a bare `except:`, a `catch (e)` with no check on `e`, a `?.` chained past the single call that can actually be missing |

A `catch` that logs and rethrows, or a `?.` guarding a value the caller
already treats as optional, is not a finding — trace what happens after the
failure before writing the line. End with `silent-failure: <N> findings.`, or
the single word `none`.

## Comment

When the brief asks for the comment lens — the same run of `scripts/lenses.js`
printed `comment` — read every comment line the diff adds or changes against
the code beside it, sentence by sentence. One line per finding:

`path:line: <tag> "<the comment>" — <what the code actually does>.`

| tag | the diff adds | look for |
|---|---|---|
| `stale:` | a comment describing behaviour the code beside it no longer has | a parameter renamed, a branch removed, a default changed after the comment was written |
| `unwritten:` | a comment promising something the code does not do | "validates", "logs", "retries" — check the line actually does it |

A comment about a line the diff does not touch is out of this lens's scope,
not a finding. End with `comment: <N> findings.`, or the single word `none`.
```

In `skills/fankeel-build/SKILL.md`, in step 5, right after "Give it the brief path and the range — never a paste of the session's history. Dispatch it as `subagent_type: fankeel:fankeel-reviewer`; the model comes from that agent file, not typed by hand here." and before "**A task that changes a page gets a second reviewer** in the same response:", add:

```markdown
   Before dispatching, run `node <plugin>/scripts/lenses.js <BASE>..<sha>` and
   put what it printed in the brief: `none`, or the `## Silent failure` lens
   and the `## Comment` lens by name, whichever it named — the reviewer reads
   that lens over the same range.
```

In `skills/fankeel-verify/SKILL.md`, in `## The adversary`, right after "Its brief also asks for the `## Security` lens of its agent file, once, over the branch's whole range: a finding there is a defeated row like any other." and before "When the claim under evidence is about what a page shows,", add:

```markdown
Before dispatching, run `node <plugin>/scripts/lenses.js <the base>..HEAD` over
that same whole range and put what it printed in the brief too: `none`, or the
`## Silent failure` lens and the `## Comment` lens by name, whichever it named.
```

4. Run it and watch it pass:

```
node --test tests/agents.test.js
```

5. Commit `agents/fankeel-reviewer.md`, `skills/fankeel-build/SKILL.md`, `skills/fankeel-verify/SKILL.md` and `tests/agents.test.js`.

## Task 13: audit's prompt lens — the rules nobody in this session wrote

**Files:**
- Modify: `skills/fankeel-audit/SKILL.md` — new `###` subsection right after `### What every session loads` and before `## What the sweep reports`; one new line in the `## Output` block.
- Read: `lib/stages.js` — names `ALWAYS` and `controlRules`, which the new subsection cites by name.
- Read: `docs/90-agent/reference/improvement-brief.md` — the deletion test the new subsection cites at lines 417-425.
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

### Steps

1. Write the failing test.

At the end of `tests/skills.test.js`, after the `'the audit skill runs both scanners and ends at the gate'` test's closing `});`, add:

```js

// docs/90-agent/plans/2026-09-27-registry-lenses-design.md §6: the prompt
// lens reads the rules a session runs under rather than a scanner's output,
// so what proves the reading happened is a planted control rather than a
// script's exit code.
test('the audit skill reads the injected rules for a prompt lens, runs the deletion test on a candidate, and never self-deletes', () => {
  const text = read('fankeel-audit');
  const before = text.indexOf('### What every session loads');
  const heading = text.indexOf('### The rules nobody in this session wrote');
  const after = text.indexOf('## What the sweep reports');
  assert.ok(before !== -1 && heading !== -1 && after !== -1, 'one of the three anchors is missing');
  assert.ok(before < heading && heading < after, 'the new section is not between input-check.js and the sweep table');
  const body = text.slice(heading).split('## What the sweep reports')[0];
  assert.match(body, /ALWAYS/);
  assert.match(body, /controlRules/);
  assert.match(body, /lib\/stages\.js/);
  assert.match(body, /improvement-brief\.md/);
  assert.match(body, /deletion test/);
  assert.match(body, /移出注入/);
  assert.match(body, /never deleted here/);
  assert.match(body, /Plant one control/);
  assert.match(text, /prompt lens: /);
});
```

2. Run it and watch it fail:

```
node --test tests/skills.test.js
```

It fails — `skills/fankeel-audit/SKILL.md` has no `### The rules nobody in this session wrote` section and no `prompt lens:` line yet.

3. Write the minimal implementation.

In `skills/fankeel-audit/SKILL.md`, right after "It never fails the run and never edits: offer the trim at the gate, and change a file in another repository only in a task on that repository." (the closing sentence of `### What every session loads`) and before `## What the sweep reports`, add:

```markdown
### The rules nobody in this session wrote

Every session here is already running under rules it did not write:
`lib/stages.js`'s `ALWAYS`, each stage's own `rules`, and, on a controlled
stage, `controlRules` — plus whatever a `SKILL.md` or an `agents/*.md` states
as a standing directive in its own prose, the way `## Not a defect`'s tables
and lines like *Never move a document unasked* do. Read all four kinds. Each
one earns its place with a reason, and this repository keeps that reason
wherever the rule itself lives: a comment on the line above it in the code,
an incident or a decision the surrounding sentence names, a dated citation in
the same paragraph. A candidate is a rule whose stated reason points at
something gone — a test that no longer exists, a file the citation names that
has moved or been deleted, an incident whose fix has since been reverted.
Name each one `path:line — <the rule, quoted> — <what its reason cites, and
why that no longer holds>`.

A candidate, and only a candidate, gets the deletion test —
[improvement-brief.md:417-425](../../docs/90-agent/reference/improvement-brief.md)'s
*strike it; if the sentence still parses and still says the same thing, it
was filler*, run on a rule instead of a sentence: remove that one line from
its source, run whatever test pins it — `tests/agents.test.js` where the rule
lives in an `agents/*.md` file, `tests/stages.test.js` or `tests/render.test.js`
where it lives in `lib/stages.js`, `tests/skills.test.js` where it lives in a
`SKILL.md` — and restore the file whatever the test says, the same red-green
discipline `fankeel-verify`'s regression row already keeps. A run that
reddens means something still depends on the exact wording: drop the
candidate. One that stays green, with no other reason found for it, is
listed at the gate as **移出注入** — never deleted here, because the rule may
still be right and only under-cited, and that is the user's call.

A run that finds no candidate is not evidence the rules are all still cited —
it may be evidence nobody actually re-read them. Plant one control before
trusting a `none`: a rule whose reason cites a path that resolves to nothing,
added for this check alone, and confirm it is the one thing this reading
lists. A `none` that misses its own control is not a clean pass; it is the
reading having skipped the file.
```

In the same file's `## Output` block, add a line `prompt lens: <n> candidates, path:line each, or none` immediately after the `pairs disagree: <where, or omit this line>` line and before `routed: <heading — the entry, or omit this line>`.

4. Run it and watch it pass:

```
node --test tests/skills.test.js
```

5. Commit `skills/fankeel-audit/SKILL.md` and `tests/skills.test.js`.

## Coverage

| promise | task |
|---|---|
| `lib/dirty.js:82` 的 `execFileSync('git', ['status', …])` 加 `timeout: 2500`。 | Task 1 |
| 測試：一個睡 5 秒的假 `git` 放在 PATH 前面，`dirtyPaths` 在 3 秒內回 `null`。 | Task 1 |
| 新欄位 `seen`：`lib/dirty.js` 的 git 掃描寫進 `seen`，不再寫 `claims`； | Task 3 |
| 衝突只算「有效路徑」：`claims ∪ (seen − 任何 live session 的 claims)`。 | Task 4 (Ruling 1: also minus live neighbours' `seen`) |
| 顯示：注入區塊的 `touched:` 與 station 列出 `seen`，標成弱（`seen:` 一行）， | Task 3 (block), Task 5 (station) |
| 測試：兩個 live session 都只在 `seen` 有 `f` → `blockers` 空、無 CLASH； | Task 4 |
| profile 新鍵 `worktree`（`true`／`false`，內建 `false`）。為 `true` 時 | Task 6 |
| `.fankeel/.gitignore` 加 `worktrees/`，主樹的 `git status` 與 Grep 看不到它。 | Task 6 |
| 路徑一律記「邏輯路徑」：`hooks/touch.js` 與 `lib/dirty.js` 碰到 | Task 7 |
| guard／CLASH：雙方 `worktree` 不同（含一方沒有）時，同一邏輯路徑不擋、不亮 | Task 4 |
| 注入區塊與 stage agent 的 brief 多一行 `worktree: <path>（branch）`， | Task 6 |
| land：`skills/fankeel-land/SKILL.md` 的 merge 步驟改讀 `worktree` 欄位： | Task 2 |
| 測試：profile 開啟時 `start` 產出目錄與分支、紀錄有 `worktree`； | Task 6 (start), Task 7 (touch in worktree), Task 4 (two worktrees, `merge:`) |
| 新欄位 `intends`（上限 60 條路徑，寫法照 `addClaim`）。新指令 | Task 8 |
| 同一指令印出與鄰居的比對：我的 `intends` 對鄰居的 `effectiveClaims ∪ intends`， | Task 8 |
| 呼叫點：plan 站 gate 前、build 站開始時各跑一次，寫進 `lib/stages.js` 兩站的 | Task 9 (Ruling 2: a clause in an existing line) |
| 測試：鄰居在 build 且 `claims` 含 plan 列的檔 → 印 `warn`； | Task 8 |
| `agents/fankeel-reviewer.md` 在 `## Security` 之後加 `## Silent failure`（每個 catch／fallback／`?.`：吞錯、沒記錄、過寬的 catch）與 `## Comment`（每句註解對程式碼逐句核對），形狀照 `## Security`，結尾同樣一行計數。 | Task 12 |
| 新 `scripts/lenses.js <range>`：讀 `git diff <range>` 的新增行，碰到 `catch`／`except`／`.catch(`／`\|\| fallback` 類印 `silent-failure`，碰到註解行印 `comment`；邏輯在 `lib/lenses.js` 的 `lensesFor(diffText)`。 | Task 11 |
| `skills/fankeel-build/SKILL.md` 與 `skills/fankeel-verify/SKILL.md` 派 reviewer 前跑它，把印出的 lens 名寫進 brief。 | Task 12 |
| 測試：`lensesFor` 對含 `catch (` 新增行的 diff 回 `silent-failure`，只改註解的回 `comment`，都沒有回 `[]` | Task 11 |
| `tests/agents.test.js` 釘兩個新段落。 | Task 12 |
| `skills/fankeel-audit/SKILL.md` 在 `input-check.js` 段後加一節：讀 `lib/stages.js` 的 `ALWAYS`、各站 rules、`controlRules`，以及 skills／agents 裡注入的規則，每條配上方註解寫的原因；原因指的事件或測試已不存在的列為候選。 | Task 13 |
| 候選才跑刪除測試（`improvement-brief.md:417-425`）：刪掉該條、跑釘它的測試；沒紅又沒有現存原因的，在 audit gate 列為「移出注入」，不自行刪。 | Task 13 |
| 測試：本任務自己的 audit 站跑一次，產出的每個候選都附規則與原因的 `path:line`；候選為零時用一條人為加入、原因指向不存在檔案的規則當對照，必須被列出。 | not a build task — this task's own audit stage runs Task 13's procedure once, plants a control rule whose comment cites a nonexistent path, and must list it; Task 13 supplies the procedure |
