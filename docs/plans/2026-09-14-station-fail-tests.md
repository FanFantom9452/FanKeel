---
status: design-intent
---

# Station Refusals and Orient Widths Implementation Plan

**Goal:** the seven `fail()` responses in `scripts/station.js` that no test reaches each get a test, `scripts/orient.js`'s table gets an assertion that fails when its column widths are wrong, and `docs/station.md:470-472` stops misstating `POST /profile`'s status codes.
**Architecture:** Tests only, built on the fixtures each test file already has; no source file is committed changed. Tasks 1 and 2 share no file and go out as two implementers in one response. Task 3 reads both test files, so it runs after them, in-session: one page sentence and the `TODO.md` entry the other two close.
**Tech Stack:** Node, no dependencies; `node --test` with the spec reporter; `node:test`'s `t.mock.method`.
**Spec:** 2026-09-14-station-fail-tests-design.md

## Global Constraints

- The test command is exactly `node --test` — `package.json:8`. There is no `dependencies` key, and none is added — `package.json:1-11`. There is no `CLAUDE.md`; `CONTRIBUTING.md` holds the conventions.
- The spec reporter prints `✔`/`✖` and `ℹ pass N` / `ℹ fail N`; filter with `grep -E '^(ℹ (pass|fail)|✖)'`, never for `ok`.
- `tests/station-cli.test.js` indents four spaces (`:23-46`); `tests/orient.test.js` indents two (`:18-24`). Both open with `'use strict';`.
- A test that serves calls `serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false })` and calls `s.close()` in `finally` — `tests/station-cli.test.js:112`, `:131-133`. A server left open keeps `node --test` from exiting.
- Temporary directories come from `tmp()` in `tests/tmp.js` — `tests/station-cli.test.js:12`, `tests/orient.test.js:11`.
- `fail(code, msg)` answers `content-type: text/plain` with the body `msg + '\n'` — `scripts/station.js:372-375`.
- Every POST route checks the nonce first — `scripts/station.js:452`, `:482`, `:536` — and the tests read it off `station/station-data.js` with `/"nonce":"([^"]+)"/` — `tests/station-cli.test.js:118`.
- The seven sites and the statuses they answer today: `:439` `404`, `:463` `404`, `:472` `409`, `:488` `404`, `:552` `400`, `:558` `400`, `:573` `409` — `scripts/station.js`.
- No file under `scripts/` or `lib/` is committed changed. A mutation is restored with `git checkout -- <file>` and proved restored with `git diff --quiet -- <file> && echo restored`. A mutation keeps the code runnable: change a number or an argument, never delete a line.
- Every exported name needs an importer — `CONTRIBUTING.md:19`. No export is added.
- Whoever finishes the work removes the `TODO.md` entry in the same change — `TODO.md:5`; `node scripts/todo-check.js` exits 0 afterwards.
- `docs/station.md` is a reference page (`.fankeel/map.md`, filing `docs — reference`). A `path:line` citation into it moves when its line count changes, so the edit keeps `:470-472` three lines.
- Dated records are not edited: `docs/archive/`, `docs/decisions/`, `docs/reports/`, `docs/judgements/`, and every plan but this one.
- An implementer runs only the test file its task names and does not commit. The parent runs the whole suite — `node --test 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'` showing `ℹ fail 0` — before committing each group, because a shared tree hides cross-file red until then.
- The parent commits with `git commit -o <paths>` while an implementer is live, so a neighbour's staged change does not ride along. A subject is `type: what changed` under 60 characters, and every message ends with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01C7NXiqVXNxE1hoxkm3vUnD`.
- Edit files with the Edit and Write tools: a heredoc eats backslashes, and a Python write on this machine turns a file CRLF.

## File structure

| file | responsibility | task |
|---|---|---|
| `tests/station-cli.test.js` | a `served()` helper and seven tests, inserted after the test ending at `:418` | 1 |
| `tests/orient.test.js` | three alignment assertions inside the test at `:56-69`, after `:65` | 2 |
| `docs/station.md` | the sentence at `:470-472` | 3 |
| `TODO.md` | the `## Ready` bullet at `:70` | 3 |

## Task 1: the seven station refusals

**Files:**
- Modify: `tests/station-cli.test.js` — a `served()` helper and seven tests after line 418
- Test: `tests/station-cli.test.js`
- Read: `scripts/station.js` — `fail` at :372-375 and the seven sites; mutated in step 4 and restored in step 6, never committed
- Read: `lib/clear.js` — the `reason: 'fresh'` refusal at :29
- Read: `lib/profile.js` — the `does not parse; fix it by hand first` reason at :94

**Interfaces:**
- Consumes: `fixture()` (`tests/station-cli.test.js:22`, returns `{ base, cfg, r1 }`), `clearStaleFixture(withFresh)` (`:264`, same shape), `request(url, opts, body)` (`:49`, resolves `{ status, headers, text }`), the ids `STALE`, `CS_FRESH`, `CS_OLD_A`, and `registry.readSession(root, id)` — all already in the file
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription, one test file's run, and a seven-number mutation restored by checkout.

1. Baseline: `node --test tests/station-cli.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'`. Note the pass count N; it shows `ℹ fail 0`.
2. In `tests/station-cli.test.js`, after line 418 — the `});` closing `POST /profile writes a project key, refuses a bad nonce, a bad key, and an unknown project` — insert a blank line and then:

   ```js
   // --- the seven refusals no test reached ---

   // On 2026-09-14 the seven replies `scripts/station.js` had just moved onto
   // `fail()` were renumbered 491-497 and every test stayed green. Each test
   // below reaches one of them. `served()` binds a server for `f`, reads the
   // per-run nonce the way the tests above do, and posts forms that carry it.
   async function served(f) {
       const { serve } = require('../scripts/station.js');
       const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
       let nonce;
       try {
           const data = await request(s.url + 'station/station-data.js', { method: 'GET' });
           nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
       } catch (e) {
           s.close();
           throw e;
       }
       const post = (route, fields) => request(s.url + route,
           { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } },
           new URLSearchParams({ nonce, ...fields }).toString());
       return { s, post };
   }

   test('GET /station/station.css answers 404 when the asset cannot be read', async (t) => {
       const f = fixture();
       const { s } = await served(f);
       try {
           // `scripts/station.js` reads the asset through the same cached
           // `node:fs` this file required, at request time, so failing that one
           // read stands in for an unreadable assets directory without touching
           // the real one.
           const realRead = fs.readFileSync;
           t.mock.method(fs, 'readFileSync', (p, ...rest) => {
               if (path.basename(String(p)) === 'station.css') throw new Error('EACCES: permission denied');
               return realRead(p, ...rest);
           });
           const res = await request(s.url + 'station/station.css', { method: 'GET' });
           assert.equal(res.status, 404);
           assert.match(res.headers['content-type'], /text\/plain/);
           assert.equal(res.text, 'no such asset\n');
       } finally {
           s.close();
       }
   });

   test('POST /clear answers 404 for a session not on the page', async () => {
       const f = fixture();
       const { s, post } = await served(f);
       try {
           const res = await post('clear', { root: f.r1, id: 'dddddddd-4444-4444-8444-444444444444' });
           assert.equal(res.status, 404);
           assert.equal(res.text, 'no such session on this page\n');
           assert.equal(registry.readSession(f.r1, STALE).active, true, 'nothing else was cleared');
       } finally {
           s.close();
       }
   });

   test('POST /clear answers 409 with the reason when clearEntry refuses a too-fresh row', async () => {
       const f = clearStaleFixture(true);
       const { s, post } = await served(f);
       try {
           // Not running, so the page reads it `stale` and the live-row check
           // passes; five minutes old, so `clearEntry`'s twelve-hour rule refuses.
           const res = await post('clear', { root: f.r1, id: CS_FRESH });
           assert.equal(res.status, 409);
           assert.match(res.text, /^not cleared: fresh\b/);
           assert.equal(registry.readSession(f.r1, CS_FRESH).active, true, 'the fresh row is refused, not cleared');
       } finally {
           s.close();
       }
   });

   test('POST /clear-stale answers 404 for a registry not on the page', async () => {
       const f = clearStaleFixture(false);
       const { s, post } = await served(f);
       try {
           const res = await post('clear-stale', { root: path.join(f.base, 'nowhere') });
           assert.equal(res.status, 404);
           assert.equal(res.text, 'no such registry on this page\n');
           assert.equal(registry.readSession(f.r1, CS_OLD_A).active, true, 'nothing was cleared');
       } finally {
           s.close();
       }
   });

   test('POST /profile answers 400 for a scope that is neither project nor machine', async () => {
       const f = fixture();
       const { s, post } = await served(f);
       try {
           const res = await post('profile', { scope: 'workspace', key: 'land.push', value: 'false' });
           assert.equal(res.status, 400);
           assert.equal(res.text, 'scope is project or machine\n');
       } finally {
           s.close();
       }
   });

   test('POST /profile answers 400 when no key/value pair is sent', async () => {
       const f = fixture();
       const { s, post } = await served(f);
       try {
           const res = await post('profile', { scope: 'machine' });
           assert.equal(res.status, 400);
           assert.equal(res.text, 'key and value come in pairs\n');
       } finally {
           s.close();
       }
   });

   test('POST /profile answers 409 with the reason when the project profile does not parse', async () => {
       const f = fixture();
       const { s, post } = await served(f);
       try {
           const file = path.join(f.r1, '.fankeel', 'profile.json');
           fs.writeFileSync(file, 'not json');
           const res = await post('profile', { scope: 'project', project: f.r1, key: 'land.push', value: 'false' });
           assert.equal(res.status, 409);
           assert.match(res.text, /does not parse; fix it by hand first\n$/);
           assert.equal(fs.readFileSync(file, 'utf8'), 'not json', 'the unreadable file is left for a person');
       } finally {
           s.close();
       }
   });
   ```

3. Green: the step 1 command shows `ℹ pass N+7` and `ℹ fail 0`. If one of the seven fails, stop and report its name and assertion message. Do not change an expected status or body to match what came back: the design names what each route answers, and a mismatch is a finding for the parent.
4. Red, by mutation. In `scripts/station.js`, with the Edit tool, change only the status argument of the seven calls: `:439` `404`→`491`, `:463` `404`→`492`, `:472` `409`→`493`, `:488` `404`→`494`, `:552` `400`→`495`, `:558` `400`→`496`, `:573` `409`→`497`. Then `git diff --stat -- scripts/station.js` shows `7 insertions(+), 7 deletions(-)`.
5. Run the step 1 command: `ℹ fail 7`, and the seven `✖` lines are exactly the seven tests from step 2. Report the `✖` lines.
6. Restore: `git checkout -- scripts/station.js`, then `git diff --quiet -- scripts/station.js && echo restored` prints `restored`.
7. Run the step 1 command again: `ℹ pass N+7`, `ℹ fail 0`.
8. Do not commit. Return the step 5 `✖` lines and the step 7 counts. The parent runs the whole suite and commits `tests/station-cli.test.js` as `test: the seven station refusals no test reached`.

## Task 2: orient's column widths

**Files:**
- Modify: `tests/orient.test.js` — three assertions inside `a directory of projects lists each one, not the files under it`, after line 65
- Test: `tests/orient.test.js`
- Read: `scripts/orient.js` — `table()`, where `padEnd(widths[i])` pads each cell at :279; mutated in steps 4-5 and restored in step 6, never committed

**Interfaces:**
- Consumes: `run(args, cwd)` (`tests/orient.test.js:27`, returns orient's stdout) and `workspace(tree)` (`:17`, returns the root) — both already in the file
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription, one test file's run, and two one-argument mutations restored by checkout.

1. Baseline: `node --test tests/orient.test.js 2>&1 | grep -E '^(ℹ (pass|fail)|✖)'` shows `ℹ fail 0`.
2. In `tests/orient.test.js`, after line 65 — `assert.match(out, /beta\s+no git\s+1 file/);` — insert:

   ```js
     // The two matches above accept any run of spaces, so a table whose columns
     // stopped lining up passed them. Measured 2026-09-14, the rows are
     // `  alpha  no git  2 files` and `  beta   no git  1 file`: `alpha` sets the
     // first column's width, so both rows' later cells start at one offset, and
     // that offset is the indent, `alpha`, and the two-space gap.
     const lines = out.split('\n');
     const a = lines.find((l) => /alpha\s+no git/.test(l));
     const b = lines.find((l) => /beta\s+no git/.test(l));
     assert.equal(a.indexOf('no git'), '  alpha  '.length, JSON.stringify(a));
     assert.equal(b.indexOf('no git'), a.indexOf('no git'), JSON.stringify(b));
     assert.equal(b.indexOf('1 file'), a.indexOf('2 files'), JSON.stringify(b));
   ```

3. Green: the step 1 command shows `ℹ fail 0`.
4. Red, first mutation. In `scripts/orient.js` at :279, with the Edit tool, change `.padEnd(widths[i])` to `.padEnd(0)`. Run the step 1 command: `a directory of projects lists each one, not the files under it` is among the `✖` lines, failing on the `b.indexOf('no git')` assertion. Report every `✖` line.
5. Red, second mutation. Change `.padEnd(0)` to `.padEnd(widths[i] + 1)`. Run the step 1 command: the same test fails, now on the `'  alpha  '.length` assertion. Report every `✖` line.
6. Restore: `git checkout -- scripts/orient.js`, then `git diff --quiet -- scripts/orient.js && echo restored` prints `restored`.
7. Run the step 1 command: `ℹ fail 0`.
8. Do not commit. Return the `✖` lines from steps 4 and 5 and the step 7 counts. The parent runs the whole suite and commits `tests/orient.test.js` as `test: orient's table columns line up`.

## Task 3: the page sentence and the TODO entry

**Files:**
- Modify: `docs/station.md` — the sentence at :470-472, kept to three lines
- Modify: `TODO.md` — the `## Ready` bullet at :70 and the blank line after it removed
- Read: `tests/station-cli.test.js` — the seven tests Task 1 added, which the bullet asked for
- Read: `tests/orient.test.js` — the assertions Task 2 added, which the bullet asked for

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — two Edits whose wording this plan already settles; a dispatch would cost more than the edit.

1. The entry is only closed once what it asked for is in the tree: `grep -c "the seven refusals no test reached" tests/station-cli.test.js` prints `1`, and `grep -c "'  alpha  '.length" tests/orient.test.js` prints `1`. If either prints `0`, stop: Task 1 or Task 2 has not landed.
2. Red: `grep -n "other refusals answer" docs/station.md` prints line 471, and `grep -n "〔station〕\`scripts/station.js\`" TODO.md` prints line 70.
3. In `docs/station.md`, replace lines 470-472:

   ```text
   pair per row changed in one request. A wrong nonce is `403`; an unknown key,
   or a value not on that key's list, is `400`; other refusals answer `404` or
   `409`; a write that lands goes through `lib/profile.js`'s `write` and redirects
   ```

   with:

   ```text
   pair per row changed in one request. A wrong nonce is `403`. A bad `scope`,
   no pair or an unequal count, an unknown key, or a value off its list, is
   `400`; an unknown project `404`, a refused write `409`; one that lands redirects
   ```

4. In `TODO.md`, delete line 70 and the blank line after it, so `## Ready` is followed by one blank line and then `## Needs a decision`:

   ```text
   - 〔station〕`scripts/station.js` 改用 `fail()` 的七個錯誤回應沒有測試走到（09-14 狀態碼改成 491–497，1410 個測試全綠）；`scripts/orient.js` 表格欄寬也沒有斷言 — [tests/station-cli.test.js](tests/station-cli.test.js).
   ```

5. Green: `! grep -q "other refusals answer" docs/station.md && echo gone` prints `gone`; `wc -l docs/station.md` is unchanged from before step 3; `node scripts/docs-check.js` and `node scripts/todo-check.js` both exit 0.
6. The parent runs the whole suite (`ℹ fail 0`) and commits `docs/station.md` and `TODO.md` as `docs: station.md's /profile codes match; TODO closed`.

## Coverage

| promise | task |
|---|---|
| `scripts/station.js:439` 讀 `station.css` 失敗時回 `404` 與 `no such asset`。 | Task 1 |
| `scripts/station.js:463` 的 `POST /clear` 送不在頁面上的 session，回 `404` 與 `no such session on this page`。 | Task 1 |
| `scripts/station.js:472` 的 `POST /clear` 送 `clearEntry` 拒絕的太新的列，回 `409`，本文以 `not cleared: fresh` 開頭，那一列仍 active。 | Task 1 |
| `scripts/station.js:488` 的 `POST /clear-stale` 送不在頁面上的 root，回 `404` 與 `no such registry on this page`。 | Task 1 |
| `scripts/station.js:552` 的 `POST /profile` 送既非 project 也非 machine 的 scope，回 `400` 與 `scope is project or machine`。 | Task 1 |
| `scripts/station.js:558` 的 `POST /profile` 沒送 key/value，回 `400` 與 `key and value come in pairs`。 | Task 1 |
| `scripts/station.js:573` 的 `POST /profile` 寫一個不能 parse 的專案 profile，回 `409`，本文以 `does not parse; fix it by hand first` 結尾，檔案不動。 | Task 1 |
| `alpha` 與 `beta` 兩列的 `no git` 起點相同且等於 `'  alpha  '.length`，檔案數那一欄的起點也相同。 | 部分 struck — the file-count half, in 22c046c: both rows' git column reads `no git`, one length, so the first column alone decides that offset; Task 2 for the rest |
| `docs/station.md:470-472` 改成與 `scripts/station.js:535-573` 一致：scope 不合法、沒有 pair 或數量不等也是 `400`，未知專案 `404`，寫入被拒 `409`，仍是三行。 | Task 3 |
| `TODO.md` 的 `## Ready` 那一條刪掉。 | Task 3 |
| 七個拒絕被測到 — 七處狀態碼改成 491–497，恰好新增的七個測試紅；還原後綠 | Task 1, steps 4-7 |
| 欄寬被測到 — `padEnd(widths[i])` 改成 `padEnd(0)`，新斷言紅；還原後綠 | Task 2, steps 4-7 |
| 全套 — `node --test` 顯示 `ℹ fail 0` | parent, before each group's commit |
| 文件 — `node scripts/docs-check.js` 與 `node scripts/todo-check.js` exit 0 | Task 3, step 4 |
