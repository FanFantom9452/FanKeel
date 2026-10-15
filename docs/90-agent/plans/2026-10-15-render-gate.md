---
status: design-intent
last_verified: 2026-10-15
---

# Render gate, effort parameter, unused agents — Implementation Plan

**Goal:** A page change cannot complete without a render verdict, effort travels on the dispatch instead of in six copied agent files, and every agent this repository never dispatched has a written ruling.
**Architecture:** `lib/shots.js` learns which files draw a page (`src`) and which pages a path list touches; `scripts/ledger.js complete|fix` refuses a range that touched one without `--render` or a skip ruling, and `scripts/task.js stage` does the same leaving build where no plan means no ledger. `lib/title.js` reads the dispatch's `effort`; the six `-high`/`-xhigh` agent files, their generator and their tests go, in an order that keeps the suite green after each task; skills, the brain's file, the stage rules and two reference pages say `effort:` on the dispatch. A Traditional Chinese decision record carries the ruling on the unused agents.
**Tech Stack:** Node 24.21.0 on this machine (`path.posix.matchesGlob`, Node 22+), `node --test`, no dependencies, git for the range diff.
**Spec:** 2026-10-15-render-gate-design.md

## Global Constraints

Generated 2026-10-15 from `CONTRIBUTING.md`, `.fankeel/map.md`, `package.json` and the tests. The repository has no `CLAUDE.md`; `CONTRIBUTING.md` says so and carries the conventions.

- `package.json` declares no dependency and `"test": "node --test"`. Add no dependency.
- `lib/*.js` is pure logic, tested directly; nothing in `lib/` requires from `scripts/` or `hooks/` (`CONTRIBUTING.md`, Scope and ownership).
- `lib/*.js` and `scripts/*.js`: `'use strict'`, four-space indent, semicolons, single quotes. Tests follow their own file: `tests/ledger.test.js`, `tests/stages.test.js`, `tests/brief.test.js`, `tests/skills.test.js` and `tests/plantasks-effort.test.js` indent two spaces; `tests/shots.test.js`, `tests/title.test.js`, `tests/agents.test.js`, `tests/agentfile.test.js` and `tests/init-docs.test.js` indent four.
- Every exported name needs an importer, a test counting (`tests/source.test.js:117`). It reads `git ls-files`, so a new file must be `git add`ed before that test sees it — the session stages it with the task's commit.
- `FILE_CAP` is `3` `Modify:` entries a task and `READ_CAP` `1500` lines (`lib/plantasks.js:350-351`); `scripts/task.js` is 1694 lines, so it is named with a range.
- `tests/agents.test.js:60-66`: `.claude-plugin/plugin.json`'s `agents` equals `NAMES` in order, and `agents/` holds exactly those files. `tests/init-docs.test.js:32` pins the count of files in `agents/` (20 today).
- `tests/skills.test.js:30-47` `KNOWN_LEDGER_PARAGRAPHS`: a `skills/fankeel-build/SKILL.md` paragraph matching `` /`ledger\.js`|\bgroups\b|\bbrief\b/ `` without `/no plan|without a plan|file table|spike/i` must be on that list, by its first 60 characters. Adding a no-plan word to a listed paragraph, or changing its first line, fails the test as surely as a new unlisted one.
- `tests/skills-cli.test.js:79` runs `scripts/skills-check.js` over this repository: every flag a skill names for a script must be one that script accepts, read off its `STRING_FLAGS` table (`lib/skills.js:48-56`).
- Every injected block stays under 2400 characters (`tests/render.test.js:569`, `:781`, `:801`). Measured 2026-10-15: the largest controlled block, build from `renderResume`, is 2243.
- A page under `docs/03-decisions/` dated 2026-10-10 or later opens with `一句話：` and has the headings `## 決定`, `## 為什麼`, `## 放棄了什麼`, every sentence at most 160 columns with a CJK character counting two, and no bare `Task N`, commit hex or TODO id outside a code span (`lib/plain.js:12-60`). A new page gets its `docs/README.md` row in the same change (`CONTRIBUTING.md`).
- A TODO entry is closed only through `node scripts/todo.js done <id> --sha <sha>` (`scripts/todo.js:9`); never edit its state by hand.
- `node scripts/docs-check.js` exits 1 on this tree before any change (15 references that no longer resolve, all in other pages). A docs task checks that no line of its output names a page it wrote.
- Version numbers move only through `scripts/version.js`. No task here moves one.
- A commit is `<type>: <sentence>`, then one `- <what> — <path>` line per change, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- An implementer runs only its own test file. The session that dispatched it runs `node --test` before committing; on this machine the full suite needs `FANKEEL_BROWSER="C:\Program Files\Google\Chrome\Application\chrome.exe"`, or 14 render tests fail on Edge. Run one suite at a time (`README.md`, Development).

## Risks

- Another session on main is editing `scripts/task.js`, `lib/render.js`, `lib/profile.js`, `skills/fankeel-plan`, `skills/fankeel-verify` and `skills/fankeel/SKILL.md`; this branch rebases before land. — Tasks 3, 9 and 10 — each keeps its diff local: Task 3 adds two requires, one flag, one helper above `cmdStage` and one block inside it; Task 9 changes one comment and one string in `lib/profile.js`; Task 10 replaces named paragraphs and leaves frontmatter alone. `lib/render.js` and `skills/fankeel/SKILL.md` are not touched.
- `git diff --name-only <range>` runs at the registry root, while a worktree build commits on its own branch. — Task 2 — worktrees share one object store, so the main tree reads the range; the tests run in a single repository, so the worktree case is reasoned, not tested.
- `ledger.js` reads `<registry root>/.fankeel/render.json` only; a project under `--project <subdir>` keeps its render.json in the subdirectory and is not checked by the ledger. — Task 2 — the design names the repository root; Task 3's stage check does resolve the project root, and the gap is said in Task 2's comment.
- Claims are relative to the registry root, `src` globs to the project, and a worktree's claims carry the worktree path in front. — Task 3 — strips the worktree path, else the project's own prefix, and tests the worktree case.
- `tests/title.test.js:116-124` opens the real `agents/fankeel-implementer-xhigh.md`. — Task 6 — consumes Task 4, which replaces that test, so the file is gone only after nothing reads it.
- Naming `--render` in a skill before the scripts accept it fails `tests/skills-cli.test.js:79`. — Task 10 — consumes `--render` from Tasks 2 and 3.
- The brain's Deep-thought sentence grows by eight characters, inside the 2400-character cap. — Task 9 — runs `tests/render.test.js`; 157 characters of margin were measured.
- The ledger-paragraph whitelist in `tests/skills.test.js`. — Task 10 — keeps the render paragraph's first line and no no-plan word in it; the new paragraph names "no plan" so it needs no list entry.

## Task 1: `render.json` pages name the files that draw them

**Files:**
- Modify: `lib/shots.js` — `parseTargets` accepts and returns `src`; new `pagesTouched`
- Test: `tests/shots.test.js`

**Interfaces:**
- Consumes: none
- Produces: `parseTargets` — `parseTargets(text)` now returns `{ pages, roles, src }`, `src` a `Map` from page name to its non-empty array of glob strings, holding only pages that declared one; `pagesTouched` — `pagesTouched(targets, paths)` → `string[]`, the names of the pages whose `src` matches any path, in declaration order

**Dispatch:** implementer, opus, high — the architectural floor; it owes no argument.

1. Write the failing tests. In `tests/shots.test.js`, change line 5 to:

   ```js
   const { parseTargets, cells, pagesTouched } = require('../lib/shots.js');
   ```

   and append to `tests/shots.test.js`:

   ```js
   // docs/90-agent/plans/2026-10-15-render-gate-design.md §1: a page names the
   // files that draw it, so a change to one of them can be told apart.
   const SRC = JSON.stringify({
       pages: [{ name: 'home', url: 'site/index.html', src: ['site/**', 'assets/home.css'] }, { name: 'admin', url: 'http://127.0.0.1:9/admin' }],
       roles: [{ name: 'guest' }],
   });

   test('a page\'s `src` globs are kept by page name; a page with none has no entry, and cells are unchanged', () => {
       const t = parseTargets(SRC);
       assert.deepEqual(t.src.get('home'), ['site/**', 'assets/home.css']);
       assert.equal(t.src.has('admin'), false);
       assert.deepEqual(cells(t, path.join('base')).map((c) => c.page), ['home', 'admin']);
   });

   test('a `src` that is not an array of non-empty strings is refused, naming the page', () => {
       for (const src of ['site/**', [''], [3], {}]) {
           const bad = JSON.stringify({ pages: [{ name: 'home', url: 'h.html', src }], roles: [{ name: 'a' }] });
           assert.throws(() => parseTargets(bad), /pages\[0\] \("home"\) has a `src` that is not an array of non-empty strings/, JSON.stringify(src));
       }
   });

   test('pagesTouched names the pages whose src matches a path, either separator, and none for a path outside every src', () => {
       const t = parseTargets(SRC);
       assert.deepEqual(pagesTouched(t, ['site/index.html']), ['home']);
       assert.deepEqual(pagesTouched(t, ['lib/x.js', 'assets\\home.css']), ['home']);
       assert.deepEqual(pagesTouched(t, ['lib/x.js', 'assets/other.css', 'README.md']), []);
       assert.deepEqual(pagesTouched(t, []), []);
       assert.deepEqual(pagesTouched(parseTargets(CONF), ['home.html']), []);
   });
   ```

2. Run `node --test tests/shots.test.js` and watch the three new tests fail (`pagesTouched` is not a function; `t.src` is undefined).
3. In `lib/shots.js`, extend the header comment's example and say what `src` is for. Replace lines 6-7 with:

   ```js
   //   { "pages": [{ "name": "home", "url": "http://127.0.0.1:28888/", "src": ["site/**"] }],
   //     "roles": [{ "name": "guest" }, { "name": "admin", "pages": ["home"] }] }
   //
   // `src`, optional on a page, is the globs of the files that draw it, relative
   // to the repository root: `pagesTouched` says which pages a list of changed
   // paths reaches, and the ledger and `task.js stage` refuse such a change
   // without a render verdict.
   ```

4. In `lib/shots.js` `parseTargets`, after `const pages = new Map();` add `const src = new Map();`. Inside `conf.pages.forEach`, after the `is declared twice` line and before `pages.set(p.name, p.url);`, add:

   ```js
           if (p.src !== undefined) {
               if (!Array.isArray(p.src) || p.src.some((g) => typeof g !== 'string' || !g)) {
                   fail('pages[' + i + '] ("' + p.name + '") has a `src` that is not an array of non-empty strings');
               }
               src.set(p.name, p.src);
           }
   ```

   and change the function's last line to `return { pages, roles, src };`.
5. In `lib/shots.js`, add after `cells` and change the export line:

   ```js
   // The names of the pages whose `src` globs match any of `paths`, in
   // declaration order. Paths are repository-relative; a `\` is read as `/`, and
   // the posix matcher is used so one glob means the same on every platform.
   function pagesTouched(targets, paths) {
       const files = (paths || []).map((p) => String(p).replace(/\\/g, '/'));
       const out = [];
       for (const [name, globs] of targets.src) {
           if (files.some((f) => globs.some((g) => path.posix.matchesGlob(f, g)))) out.push(name);
       }
       return out;
   }

   module.exports = { parseTargets, cells, pagesTouched, NAME };
   ```

6. Run `node --test tests/shots.test.js` and watch it pass.
7. The session commits: `feat: a render.json page names the files that draw it`, one line for `lib/shots.js` and one for `tests/shots.test.js`.

## Task 2: `ledger.js complete` and `fix` refuse a page range with no render verdict

**Files:**
- Modify: `scripts/ledger.js` — `--render` flag on `complete` and `fix`; the range checked against `src`; the render file's path written into the entry
- Modify: `lib/ledger.js` — `renderShips`, `renderSkipped`
- Read: `lib/shots.js` — `parseTargets`, `pagesTouched`
- Read: `tests/skills-cli.test.js` — runs `scripts/skills-check.js` over this repository; run, not changed
- Test: `tests/ledger.test.js`

**Interfaces:**
- Consumes: `parseTargets`, `pagesTouched` (Task 1, `lib/shots.js`)
- Produces: `renderShips` — `renderShips(text)` → `boolean`, true only when the first non-blank line of `text`, trimmed, is exactly `disposition: ship`; `renderSkipped` — `renderSkipped(text)` → `string | null`, the non-empty `<why>` of the last `Ruling: render skipped — <why>` line written after the last `Task N: complete` or `Fix:` line in `text`, with any `— costs if wrong: …` tail dropped, else `null`; `--render` — `ledger.js --render <file>` on `complete` and `fix`

**Dispatch:** implementer, opus, high — the architectural floor; it owes no argument.

1. Write the failing tests. Append to `tests/ledger.test.js` (it already has `git`, `commit`, `freshRepo`, `root` and `SCRIPT`; function declarations are hoisted):

   ```js
   // docs/90-agent/plans/2026-10-15-render-gate-design.md §1: a range that
   // changed a file a render.json page names in `src` completes only with a
   // render verdict, and one task's skip ruling never covers the next.
   const RENDER_JSON = JSON.stringify({
     pages: [{ name: 'home', url: 'site/index.html', src: ['site/**'] }, { name: 'admin', url: 'http://127.0.0.1:9/admin' }],
     roles: [{ name: 'guest' }],
   });

   function pageRepo(withConf) {
     const dir = root();
     freshRepo(dir);
     if (withConf !== false) {
       fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
       fs.writeFileSync(path.join(dir, '.fankeel', 'render.json'), RENDER_JSON);
     }
     return { dir, base: commit(dir, 'base.txt') };
   }

   function commitAt(dir, rel) {
     fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
     fs.writeFileSync(path.join(dir, rel), rel + '\n');
     git(dir, ['add', '-A']);
     git(dir, ['commit', '-qm', rel]);
     return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
   }

   const inRepo = (dir, ...args) => {
     try {
       return { out: execFileSync(process.execPath, [SCRIPT, '--plan', 'p.md', ...args], { cwd: dir, encoding: 'utf8' }), code: 0 };
     } catch (e) {
       return { out: String(e.stdout || ''), code: e.status };
     }
   };
   const progress = (dir) => fs.readFileSync(ledger.ledgerPath(dir, 'p.md'), 'utf8');

   test('renderShips reads the first non-blank line, and only disposition: ship passes', () => {
     assert.equal(ledger.renderShips('\n  \ndisposition: ship\nthe rest'), true);
     assert.equal(ledger.renderShips('disposition: fix\ndisposition: ship'), false);
     assert.equal(ledger.renderShips('disposition: recapture'), false);
     assert.equal(ledger.renderShips(''), false);
   });

   test('renderSkipped is the why of a skip ruling written since the last complete or fix line', () => {
     const skip = ledger.rulingLine('render skipped', 'tuned live with the user', 'a broken page ships');
     assert.equal(ledger.renderSkipped([ledger.header('p.md'), ledger.completionLine(1, 'one'), skip].join('\n')), 'tuned live with the user');
     assert.equal(ledger.renderSkipped([skip, ledger.completionLine(2, 'two')].join('\n')), null);
     assert.equal(ledger.renderSkipped([skip, ledger.fixLine('a fix', 'abc1234..def5678')].join('\n')), null);
     assert.equal(ledger.renderSkipped(ledger.rulingLine('render skipped', '', 'a cost')), null);
     assert.equal(ledger.renderSkipped(ledger.rulingLine('something else', 'why', 'cost')), null);
     assert.equal(ledger.renderSkipped('Ruling: render skipped — said in a note'), 'said in a note');
   });

   test('complete refuses a range that changed a src page with no render verdict, naming the page, the path and both ways through', () => {
     const { dir, base } = pageRepo();
     const head = commitAt(dir, 'site/index.html');
     const { out, code } = inRepo(dir, '--range', base + '..' + head, 'complete', '1', 'the page');
     assert.equal(code, 1, out);
     assert.match(out, /home/);
     assert.match(out, /site\/index\.html/);
     assert.match(out, /--render <file>/);
     assert.match(out, /Ruling: render skipped — <why>/);
     assert.doesNotMatch(out, /admin/);
     assert.equal(fs.existsSync(ledger.ledgerPath(dir, 'p.md')), false, 'nothing was recorded');
   });

   test('complete records a page range with a disposition: ship file and its path, and refuses a disposition: fix file or a missing one', () => {
     const { dir, base } = pageRepo();
     const head = commitAt(dir, 'site/index.html');
     fs.writeFileSync(path.join(dir, 'fix.md'), 'disposition: fix\n- site/index.html:3 — the header overlaps\n');
     fs.writeFileSync(path.join(dir, 'ship.md'), '\ndisposition: ship\n');
     const fixed = inRepo(dir, '--range', base + '..' + head, '--render', 'fix.md', 'complete', '1', 'the page');
     assert.equal(fixed.code, 1);
     assert.match(fixed.out, /first line is not `disposition: ship`/);
     assert.equal(inRepo(dir, '--range', base + '..' + head, '--render', 'gone.md', 'complete', '1', 'the page').code, 1);
     const shipped = inRepo(dir, '--range', base + '..' + head, '--render', 'ship.md', 'complete', '1', 'the page');
     assert.equal(shipped.code, 0, shipped.out);
     assert.match(progress(dir), /^Task 1: complete \[[0-9a-f]+\.\.[0-9a-f]+\] — the page — render: ship\.md$/m);
   });

   test('a skip ruling lets one task through, and the next task is refused despite it', () => {
     const { dir, base } = pageRepo();
     const one = commitAt(dir, 'site/index.html');
     inRepo(dir, 'ruling', 'render skipped', 'tuned live with the user', 'a broken page ships');
     assert.equal(inRepo(dir, '--range', base + '..' + one, 'complete', '1', 'the page').code, 0);
     const two = commitAt(dir, 'site/about.html');
     const { out, code } = inRepo(dir, '--range', one + '..' + two, 'complete', '2', 'another page');
     assert.equal(code, 1, out);
     assert.match(out, /site\/about\.html/);
   });

   test('a range touching no page, or a project with no render.json, completes as before', () => {
     const { dir, base } = pageRepo();
     const head = commitAt(dir, 'lib/x.js');
     assert.equal(inRepo(dir, '--range', base + '..' + head, 'complete', '1', 'no page').code, 0);
     const bare = pageRepo(false);
     const page = commitAt(bare.dir, 'site/index.html');
     assert.equal(inRepo(bare.dir, '--range', bare.base + '..' + page, 'complete', '1', 'no render.json').code, 0);
   });

   test('fix is held to the same render check, and records the render file it was given', () => {
     const { dir, base } = pageRepo();
     const head = commitAt(dir, 'site/index.html');
     assert.equal(inRepo(dir, '--range', base + '..' + head, 'fix', 'the header').code, 1);
     fs.writeFileSync(path.join(dir, 'ship.md'), 'disposition: ship\n');
     assert.equal(inRepo(dir, '--range', base + '..' + head, '--render', 'ship.md', 'fix', 'the header').code, 0);
     assert.match(progress(dir), /^Fix: \[[0-9a-f]+\.\.[0-9a-f]+\] — the header — render: ship\.md$/m);
   });

   test('--render is a flag of complete and fix only', () => {
     const { out, code } = inRepo(root(), '--render', 'x.md', 'show');
     assert.equal(code, 1);
     assert.match(out, /refused: --render/);
   });
   ```

2. Run `node --test tests/ledger.test.js` and watch the new tests fail.
3. In `lib/ledger.js`, after `rulingLine`, add, and append `renderShips, renderSkipped` to `module.exports`:

   ```js
   // A render reviewer's return passes only when its first non-blank line is
   // `disposition: ship`: `recapture` and `fix` both mean the page is not done.
   function renderShips(text) {
       const first = String(text || '').split(/\r?\n/).find((l) => l.trim());
       return first !== undefined && first.trim() === 'disposition: ship';
   }

   // The `<why>` of a `Ruling: render skipped — <why>` written after the last
   // `complete` or `Fix:` line, or null — scoped so one task's skip never covers
   // the next (docs/90-agent/plans/2026-10-15-render-gate-design.md §1). The
   // `— costs if wrong:` tail `rulingLine` adds is not the why, and an empty why
   // is no ruling.
   const RENDER_SKIP = /^Ruling: render skipped — (.*)$/;
   function renderSkipped(text) {
       let why = null;
       for (const raw of String(text || '').split(/\r?\n/)) {
           const line = raw.trim();
           if (COMPLETE.test(line) || FIX_RANGE.test(line)) { why = null; continue; }
           const m = RENDER_SKIP.exec(line);
           const said = m ? m[1].replace(/\s*— costs if wrong:.*$/, '').trim() : '';
           if (said) why = said;
       }
       return why;
   }
   ```

4. In `scripts/ledger.js`, add after the `contextPath` require:

   ```js
   const { parseTargets, pagesTouched } = require('../lib/shots.js');
   ```

   In `scripts/ledger.js`, `STRING_FLAGS` gains `render: 'render'`, and `VERB_FLAGS` gives `complete` and `fix` each `BASE_FLAGS.concat(['range', 'render'])`.
5. In `scripts/ledger.js`, add above `function main(argv)`:

   ```js
   // `--render <file>`: the render reviewer's return. Checked whenever it is
   // given, page or not — a `fix` verdict recorded beside a completion would
   // read as a review that passed. Returns the note's suffix naming the file.
   function renderNote(root, render) {
       if (render === undefined) return '';
       const file = path.resolve(render);
       let text;
       try {
           text = fs.readFileSync(file, 'utf8');
       } catch (e) {
           return fail('--render: no file at ' + file + '.');
       }
       if (!ledger.renderShips(text)) {
           fail('--render ' + render + ': its first line is not `disposition: ship`. What it found goes back to the implementer before this is recorded.');
       }
       return ' — render: ' + path.relative(root, file).split(path.sep).join('/');
   }

   // A range that changed a file a `.fankeel/render.json` page names in `src`,
   // with neither `--render` nor a `Ruling: render skipped — <why>` since the
   // last complete or fix: the refusal, else null. No render.json, or no page
   // with `src`, is never refused
   // (docs/90-agent/plans/2026-10-15-render-gate-design.md §1). Only the
   // registry root's render.json is read; a `--project` subdirectory's is not.
   function renderRefusal(root, range, opts) {
       let conf;
       try {
           conf = fs.readFileSync(path.join(root, '.fankeel', 'render.json'), 'utf8');
       } catch (e) {
           return null;
       }
       let targets;
       try {
           targets = parseTargets(conf);
       } catch (e) {
           return e.message;
       }
       let changed;
       try {
           changed = execFileSync('git', ['diff', '--name-only', range], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
               .split(/\r?\n/).filter(Boolean);
       } catch (e) {
           return 'git could not read ' + range + ', so it cannot be checked against .fankeel/render.json.';
       }
       const pages = pagesTouched(targets, changed);
       if (!pages.length || opts.render !== undefined) return null;
       let contents = '';
       try {
           contents = fs.readFileSync(ledger.ledgerPath(root, opts.plan), 'utf8');
       } catch (e) { /* no ledger yet, so no ruling either */ }
       if (ledger.owns(contents, opts.plan) && ledger.renderSkipped(contents) !== null) return null;
       const hits = changed.filter((p) => pagesTouched(targets, [p]).length);
       return 'fankeel ledger — this range changes ' + pages.join(', ') + ' (' + hits.join(', ') + ') and carries no render verdict.'
           + '\nPass --render <file>, the render reviewer\'s return, whose first line is `disposition: ship`;'
           + '\nor record `ruling "render skipped" "<why>" "<cost if wrong>"` first: one `Ruling: render skipped — <why>` covers this task alone.';
   }
   ```

6. In `scripts/ledger.js` `complete`, replace the `ledger.append(...)` line with:

   ```js
           const suffix = renderNote(root, opts.render);
           if (opts.range !== undefined) {
               const refusal = renderRefusal(root, opts.range, opts);
               if (refusal) fail(refusal);
           }
           ledger.append(root, opts.plan, ledger.completionLine(n, note + suffix, opts.range));
   ```

   In `scripts/ledger.js` `fix`, after the `isRange` check, replace its `ledger.append(...)` line with:

   ```js
           const suffix = renderNote(root, opts.render);
           const refusal = renderRefusal(root, opts.range, opts);
           if (refusal) fail(refusal);
           ledger.append(root, opts.plan, ledger.fixLine(what + suffix, opts.range));
   ```

7. Run `node --test tests/ledger.test.js tests/skills-cli.test.js` and watch both pass.
8. The session commits: `feat: a page range completes only with a render verdict`, one line each for `scripts/ledger.js`, `lib/ledger.js` and `tests/ledger.test.js`.

## Task 3: `task.js stage` leaving build with no plan refuses a claimed page with no render verdict

**Files:**
- Modify: `scripts/task.js:21-960` — `--render` flag; `renderRefusal` above `cmdStage`; the check inside `cmdStage`
- Read: `lib/shots.js` — `parseTargets`, `pagesTouched`
- Read: `lib/ledger.js` — `renderShips`, `renderSkipped`
- Read: `lib/registry.js` — `claimsOf`, `notesOf`, `addClaim`, `update`, `readSession`
- Read: `lib/guard.js` — `worktreeOf`, already required at `scripts/task.js:34`
- Read: `lib/docs.js` — `projectRootsFor`, the project-root lookup `valuesOfRecord` (`scripts/task.js:1087-1090`) uses
- Read: `tests/context-facts-required.test.js` — the `run()` helper to copy
- Read: `tests/skills-cli.test.js` — run, not changed
- Test: `tests/task-render-gate.test.js`

**Interfaces:**
- Consumes: `parseTargets`, `pagesTouched` (Task 1); `renderShips`, `renderSkipped` (Task 2); `refresh`, `agentKey`, `parseTasks`, `parsePlan`, `filedPaths` — already used by `scripts/task.js`, kept by Task 5
- Produces: `--render` — `task.js stage <next> --session <id> --render <file>`

**Dispatch:** implementer, opus, high — the architectural floor; it owes no argument.

1. Write the failing tests in a new `tests/task-render-gate.test.js`:

   ```js
   'use strict';

   // docs/90-agent/plans/2026-10-15-render-gate-design.md §1: with no plan there
   // is no ledger to refuse a page change, so `stage` leaving build does.

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');

   const registry = require('../lib/registry.js');
   const tmp = require('./tmp.js');

   const SCRIPT = path.join(__dirname, '..', 'scripts', 'task.js');
   const A = 'aaaaaaaa-1111-2222-3333-444444444444';
   const CONF = JSON.stringify({
       pages: [{ name: 'home', url: 'site/index.html', src: ['site/**'] }],
       roles: [{ name: 'guest' }],
   });

   function run(dir, args) {
       const cfg = path.join(dir, 'cfg');
       try {
           return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', dir, '--claude-dir', cfg],
               { cwd: dir, encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) }), code: 0 };
       } catch (e) {
           return { out: String(e.stdout || ''), code: e.status };
       }
   }

   // A task at build on `route`, holding `claims`, in a project whose
   // render.json gives `home` the files under `site/`.
   function atBuild(route, claims) {
       const dir = tmp('fankeel-render-gate-');
       run(dir, ['start', '--session', A, '--task', 'a page task', '--route', route]);
       if (!route.startsWith('build')) run(dir, ['stage', 'build', '--session', A]);
       fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
       fs.writeFileSync(path.join(dir, '.fankeel', 'render.json'), CONF);
       for (const c of claims) registry.addClaim(dir, A, c);
       return dir;
   }

   test('leaving build with no plan, a claimed page with no render verdict is refused, naming both ways through', () => {
       const dir = atBuild('build,verify', ['site/index.html', 'lib/x.js']);
       const { out, code } = run(dir, ['stage', 'verify', '--session', A]);
       assert.equal(code, 1, out);
       assert.match(out, /home/);
       assert.match(out, /site\/index\.html/);
       assert.doesNotMatch(out, /lib\/x\.js/);
       assert.match(out, /--render <file>/);
       assert.match(out, /Ruling: render skipped — <why>/);
       assert.equal(registry.readSession(dir, A).stage, 'build');
   });

   test('--render passes only a file whose first non-blank line is disposition: ship', () => {
       const dir = atBuild('build,verify', ['site/index.html']);
       fs.writeFileSync(path.join(dir, 'fix.md'), 'disposition: fix\n- site/index.html:3 — overlap\n');
       fs.writeFileSync(path.join(dir, 'ship.md'), '\n\ndisposition: ship\n');
       assert.equal(run(dir, ['stage', 'verify', '--render', 'missing.md', '--session', A]).code, 1);
       const fixed = run(dir, ['stage', 'verify', '--render', 'fix.md', '--session', A]);
       assert.equal(fixed.code, 1);
       assert.match(fixed.out, /disposition: ship/);
       const shipped = run(dir, ['stage', 'verify', '--render', 'ship.md', '--session', A]);
       assert.equal(shipped.code, 0, shipped.out);
       assert.equal(registry.readSession(dir, A).stage, 'verify');
   });

   test('a note reading Ruling: render skipped — <why> lets it through; one with no why does not', () => {
       const dir = atBuild('build,verify', ['site/index.html']);
       run(dir, ['note', 'Ruling: render skipped —', '--session', A]);
       assert.equal(run(dir, ['stage', 'verify', '--session', A]).code, 1);
       run(dir, ['note', 'Ruling: render skipped — tuned live with the user', '--session', A]);
       assert.equal(run(dir, ['stage', 'verify', '--session', A]).code, 0);
   });

   test('a route with plan, a claim outside every src, and a project with no render.json are not checked', () => {
       assert.equal(run(atBuild('plan,build,verify', ['site/index.html']), ['stage', 'verify', '--session', A]).code, 0);
       assert.equal(run(atBuild('build,verify', ['lib/x.js']), ['stage', 'verify', '--session', A]).code, 0);
       const bare = atBuild('build,verify', ['site/index.html']);
       fs.unlinkSync(path.join(bare, '.fankeel', 'render.json'));
       assert.equal(run(bare, ['stage', 'verify', '--session', A]).code, 0);
   });

   test('a worktree claim is read relative to its worktree', () => {
       const dir = atBuild('build,verify', []);
       registry.update(dir, A, (d) => { d.worktree = { path: '.fankeel/worktrees/aaaaaaaa', branch: 'fk/aaaaaaaa' }; });
       registry.addClaim(dir, A, '.fankeel/worktrees/aaaaaaaa/site/index.html');
       const { out, code } = run(dir, ['stage', 'verify', '--session', A]);
       assert.equal(code, 1, out);
       assert.match(out, /site\/index\.html/);
   });
   ```

2. Run `node --test tests/task-render-gate.test.js` and watch the refusals fail to happen.
3. In `scripts/task.js`, after the `plantasks` require, add:

   ```js
   const { parseTargets, pagesTouched } = require('../lib/shots.js');
   const { renderShips, renderSkipped } = require('../lib/ledger.js');
   ```

   and in `STRING_FLAGS` add `render: 'render',` after `todo: 'todo',`.
4. In `scripts/task.js`, add directly above `function cmdStage(root, opts)`:

   ```js
   // Leaving build on a route with no plan there is no ledger, so the render
   // check `ledger.js complete` makes runs here, over the entry's claims
   // (docs/90-agent/plans/2026-10-15-render-gate-design.md §1). The refusal, or
   // null. Claims are relative to the registry root and `src` to the project
   // render.json sits in, found as `valuesOfRecord` finds it; a worktree's
   // claims carry the worktree's own path in front.
   function renderRefusal(root, data, opts, next) {
       const projectRoot = docs.projectRootsFor(root, data.project ? [data.project] : [])[0] || root;
       let conf;
       try {
           conf = fs.readFileSync(path.join(projectRoot, '.fankeel', 'render.json'), 'utf8');
       } catch (e) {
           return null;
       }
       let targets;
       try {
           targets = parseTargets(conf);
       } catch (e) {
           return e.message;
       }
       const wt = worktreeOf(data);
       const base = wt ? wt.path : path.relative(root, projectRoot).split(path.sep).join('/');
       const paths = registry.claimsOf(data).map((c) => (base && c.startsWith(base + '/') ? c.slice(base.length + 1) : c));
       const pages = pagesTouched(targets, paths);
       if (!pages.length) return null;
       if (opts.render !== undefined) {
           const file = path.resolve(opts.render);
           let text;
           try {
               text = fs.readFileSync(file, 'utf8');
           } catch (e) {
               return '--render: no file at ' + file + '.';
           }
           return renderShips(text) ? null
               : '--render ' + opts.render + ': its first line is not `disposition: ship`. What it found goes back to the implementer first.';
       }
       if (renderSkipped(registry.notesOf(data).join(NL)) !== null) return null;
       const hits = paths.filter((p) => pagesTouched(targets, [p]).length);
       return 'fankeel — this task changed ' + pages.join(', ') + ' (' + hits.join(', ') + ') and has no render verdict.' + NL
           + 'Pass `stage ' + next + ' --render <file>`: the render reviewer\'s return, whose first line is `disposition: ship`;' + NL
           + 'or `note "Ruling: render skipped — <why>"` first.';
   }
   ```

5. In `scripts/task.js` `cmdStage`, inside the `registry.update` callback, directly after `from = d.stage;`, add:

   ```js
           // A route with plan was checked by the ledger already; not twice.
           if (from === 'build' && name !== 'build' && !route.includes('plan')) {
               const why = renderRefusal(root, d, opts, name);
               if (why) { refuse = why; return false; }
           }
   ```

6. Run `node --test tests/task-render-gate.test.js tests/context-facts-required.test.js tests/skills-cli.test.js` and watch them pass.
7. The session stages the new test file and commits: `feat: leaving build with no plan, a page change needs a render verdict`, one line for `scripts/task.js` and one for `tests/task-render-gate.test.js`.

## Task 4: The title reads the dispatch's effort before the agent file's

**Files:**
- Modify: `lib/title.js` — `prefixFor` takes `toolInput.effort` first
- Test: `tests/title.test.js`

**Interfaces:**
- Consumes: `generatedVersion` — already used by `lib/title.js`, kept by Task 5
- Produces: `prefixFor` — reads `toolInput.effort` (a non-empty string) before the agent file's `effort:`; `tests/title.test.js` no longer opens any file under `agents/`

**Dispatch:** implementer, opus, high — the architectural floor; it owes no argument.

1. Write the failing test. In `tests/title.test.js`, replace the last test (lines 116-124, `a shipped effort variant titles with its own effort`, which opens the real implementer-xhigh agent file, deleted in Task 6) with:

   ```js
   // docs/90-agent/plans/2026-10-15-render-gate-design.md §2: the dispatch's own
   // `effort` is what runs — the 2026-10-15 probe's title read `· medium` on a
   // `high` dispatch, the agent file's effort and not the call's.
   test('a dispatch carrying effort titles with it, over the agent file\'s', () => {
       const w = world();
       assert.equal(ask(w, { subagent_type: 'fankeel:fankeel-reader', effort: 'xhigh', description: 'x' }), 'sonnet · xhigh');
       assert.equal(ask(w, { subagent_type: 'general-purpose', effort: 'high', description: 'x' }), 'opus 5.5 · high');
       assert.equal(ask(w, { subagent_type: 'fankeel:fankeel-reader', effort: '', description: 'x' }), 'sonnet · medium');
   });
   ```

2. Run `node --test tests/title.test.js` and watch it fail on `sonnet · medium`.
3. In `lib/title.js` `prefixFor`, replace `const effort = fm.effort || 'inherit';` with:

   ```js
       // The call's `effort` is what runs: probe 2026-10-15, a dispatch with
       // `effort: "high"` over a `medium` agent file carried `effortValue: "high"`.
       const effort = (typeof input.effort === 'string' && input.effort) || fm.effort || 'inherit';
   ```

4. Run `node --test tests/title.test.js` and watch it pass.
5. The session commits: `fix: a dispatch's own effort titles it`, one line for `lib/title.js` and one for `tests/title.test.js`.

## Task 5: Retire the variant generator

**Files:**
- Modify: `scripts/variants.js` — deleted
- Modify: `lib/agentfile.js` — `VARIANT_EFFORTS` and `renderVariant` removed; `baseAgent`'s comment says why it stays
- Modify: `lib/plantasks.js` — its own `RAISED` list replaces the import; the third-field comment and the lint line
- Read: `tests/source.test.js` — every exported name has an importer; run, not changed
- Test: `tests/agentfile.test.js`
- Test: `tests/agents.test.js`
- Test: `tests/plantasks-effort.test.js`

**Interfaces:**
- Consumes: none
- Produces: `scripts/variants.js` deleted; `renderVariant` and `VARIANT_EFFORTS` no longer exported by `lib/agentfile.js`; `baseAgent` unchanged in behaviour; every other export kept as it is: `generatedVersion`, `refresh`, `agentKey`, `syncAgent` from `lib/agentfile.js`, `parseTasks`, `parsePlan`, `filedPaths` from `lib/plantasks.js`

**Dispatch:** implementer, opus, high — the architectural floor; it owes no argument.

1. Change the tests first. In `tests/plantasks-effort.test.js`, change the header comment's second line to `// <effort>` names the effort sent on the implementer's dispatch, `high` or `xhigh`.` and the last test to:

   ```js
   test('lint names an effort a plan may not raise to, and passes high and xhigh', () => {
     assert.deepEqual(plantasks.lint(body('**Dispatch:** implementer, sonnet, xhigh — a design judgement.'), '# A design\n'), []);
     const out = plantasks.lint(body('**Dispatch:** implementer, sonnet, max — why.'), '# A design\n');
     assert.ok(out.includes('Task 1: effort `max` is not one a plan raises to — one of high, xhigh, or none for the agent file\'s own medium'), out.join('\n'));
   });
   ```

   In `tests/agentfile.test.js`, delete the `renderVariant renames the agent…` test with its three-line comment (lines 93-105) and the `scripts/variants.js writes agents/<base>-<effort>.md…` test (lines 115-128). Above the `baseAgent strips the plugin prefix and an effort suffix` test add the comment `// The variants were retired on 2026-10-15; their names live on in older transcripts.` In `tests/agents.test.js`, delete the comment block and the two tests from `// docs/90-agent/plans/2026-10-02-docs-writer.md Tasks 7-9: a variant is` through `every base scripts/variants.js knows has its variants shipped` (lines 484-500), `const VARIANT_BASES` included.
2. Run `node --test tests/plantasks-effort.test.js` and watch it fail on the old message.
3. Delete `scripts/variants.js` (`rm scripts/variants.js`; do not touch the index).
4. In `lib/agentfile.js`, delete the `A per-dispatch effort variant` comment, `const VARIANT_EFFORTS` and `function renderVariant` (lines 111-127). Replace the comment above `baseAgent` and the export line with:

   ```js
   // The effort variants (`fankeel-reviewer-high`, `fankeel-brain-xhigh`, …)
   // were retired on 2026-10-15, when effort moved onto the dispatch. Transcripts
   // written before then still carry their names, and the bench and drift read
   // those, so a variant name is still read as its base.
   function baseAgent(type) {
       return String(type || '').replace(/^fankeel:/, '').replace(/-(high|xhigh)$/, '');
   }

   module.exports = { PLUGIN_ROOT, EFFORTS, agentKey, agentNames, generatedVersion, syncAgent, syncLine, refresh, baseAgent };
   ```

5. In `lib/plantasks.js`, delete line 20 (`const { VARIANT_EFFORTS } = require('./agentfile.js');`) and add after `const DISPATCH = …`:

   ```js
   // The efforts a plan's third Dispatch field may raise an implementer to;
   // leaving it off is the agent files' own `medium`.
   const RAISED = ['high', 'xhigh'];
   ```

   In `lib/plantasks.js`, replace the two comment lines that say the third field is sent as the shipped variant `fankeel:fankeel-implementer-<effort>` with:

   ```js
                   // A third field is the effort, sent as `effort:` on the
                   // implementer's dispatch and its reviewer's: the call's effort
                   // overrides the agent file's (probe, 2026-10-15).
   ```

   and in `lib/plantasks.js` `lint`, replace the effort loop with:

   ```js
       for (const t of tasks) {
           if (t.dispatch !== 'implementer' || !t.effort || RAISED.includes(t.effort)) continue;
           out.push('Task ' + t.n + ': effort `' + t.effort + '` is not one a plan raises to — one of ' + RAISED.join(', ') + ', or none for the agent file\'s own medium');
       }
   ```

6. Run `node --test tests/plantasks-effort.test.js tests/agentfile.test.js tests/agents.test.js tests/source.test.js` and watch them pass.
7. The session commits: `refactor: retire the effort-variant generator`, one line each for `scripts/variants.js`, `lib/agentfile.js`, `lib/plantasks.js` and the three test files.

## Task 6: Delete the implementer's effort variants

**Files:**
- Modify: `agents/fankeel-implementer-high.md` — deleted
- Modify: `agents/fankeel-implementer-xhigh.md` — deleted
- Modify: `.claude-plugin/plugin.json` — the two leave `agents`
- Test: `tests/agents.test.js`
- Test: `tests/init-docs.test.js`

**Interfaces:**
- Consumes: `prefixFor` (Task 4), whose test no longer opens `agents/fankeel-implementer-xhigh.md`
- Produces: `fankeel-implementer-high` and `fankeel-implementer-xhigh` retired

**Dispatch:** implementer, opus, high — the architectural floor; it owes no argument.

1. Change the tests first. In `tests/agents.test.js`: drop `'fankeel-implementer-high', 'fankeel-implementer-xhigh', ` from `NAMES` (line 10) and from `MAY_WRITE` (line 32, both keys), drop `'fankeel-implementer-high': 'high', 'fankeel-implementer-xhigh': 'xhigh', ` from `EFFORT`, and in `the implementer keeps scratch files out of the tree` loop over `['fankeel-implementer']` only. In `tests/init-docs.test.js`, change `assert.equal(names.length, 20);` to `assert.equal(names.length, 18);`.
2. Run `node --test tests/agents.test.js tests/init-docs.test.js` and watch the manifest and count tests fail.
3. Delete both files (`rm agents/fankeel-implementer-high.md agents/fankeel-implementer-xhigh.md`). In `.claude-plugin/plugin.json`, line 10 becomes:

   ```json
     "agents": ["./agents/fankeel-reader.md", "./agents/fankeel-judge.md", "./agents/fankeel-reviewer.md", "./agents/fankeel-verifier.md", "./agents/fankeel-fixer.md", "./agents/fankeel-brain.md", "./agents/fankeel-render-reviewer.md", "./agents/fankeel-mockup.md", "./agents/fankeel-slimmer.md", "./agents/fankeel-init-scout.md", "./agents/fankeel-writer.md", "./agents/fankeel-implementer.md", "./agents/fankeel-mutator.md", "./agents/fankeel-mover.md", "./agents/fankeel-brain-high.md", "./agents/fankeel-brain-xhigh.md", "./agents/fankeel-reviewer-high.md", "./agents/fankeel-reviewer-xhigh.md"],
   ```

4. Run `node --test tests/agents.test.js tests/init-docs.test.js` and watch them pass. The guard, brief and dispatch-gate tests that pass a variant name as a string through `baseAgent` or `roleOf` need no change: that mapping stays for older transcripts, and the session's full suite runs them.
5. The session commits: `refactor: the implementer's effort goes on the dispatch, not a copied file`, one line each for the two deleted files, `.claude-plugin/plugin.json` and the two tests.

## Task 7: Delete the reviewer's effort variants

**Files:**
- Modify: `agents/fankeel-reviewer-high.md` — deleted
- Modify: `agents/fankeel-reviewer-xhigh.md` — deleted
- Modify: `.claude-plugin/plugin.json` — the two leave `agents`
- Test: `tests/agents.test.js`
- Test: `tests/init-docs.test.js`

**Interfaces:**
- Consumes: none
- Produces: `fankeel-reviewer-high` and `fankeel-reviewer-xhigh` retired

**Dispatch:** implementer, opus, high — the architectural floor; it owes no argument.

1. Change the tests first. In `tests/agents.test.js`: drop `'fankeel-reviewer-high', 'fankeel-reviewer-xhigh'` from `NAMES` (and the comma before them) and `'fankeel-reviewer-high': 'high', 'fankeel-reviewer-xhigh': 'xhigh',` from `EFFORT`. In `tests/init-docs.test.js`, change `assert.equal(names.length, 18);` to `assert.equal(names.length, 16);`.
2. Run `node --test tests/agents.test.js tests/init-docs.test.js` and watch the manifest and count tests fail.
3. Delete both files (`rm agents/fankeel-reviewer-high.md agents/fankeel-reviewer-xhigh.md`). In `.claude-plugin/plugin.json`, line 10 becomes:

   ```json
     "agents": ["./agents/fankeel-reader.md", "./agents/fankeel-judge.md", "./agents/fankeel-reviewer.md", "./agents/fankeel-verifier.md", "./agents/fankeel-fixer.md", "./agents/fankeel-brain.md", "./agents/fankeel-render-reviewer.md", "./agents/fankeel-mockup.md", "./agents/fankeel-slimmer.md", "./agents/fankeel-init-scout.md", "./agents/fankeel-writer.md", "./agents/fankeel-implementer.md", "./agents/fankeel-mutator.md", "./agents/fankeel-mover.md", "./agents/fankeel-brain-high.md", "./agents/fankeel-brain-xhigh.md"],
   ```

4. Run `node --test tests/agents.test.js tests/init-docs.test.js` and watch them pass.
5. The session commits: `refactor: the reviewer's effort goes on the dispatch, not a copied file`, one line each for the two deleted files, `.claude-plugin/plugin.json` and the two tests.

## Task 8: Delete the brain's effort variants

**Files:**
- Modify: `agents/fankeel-brain-high.md` — deleted
- Modify: `agents/fankeel-brain-xhigh.md` — deleted
- Modify: `.claude-plugin/plugin.json` — the two leave `agents`
- Test: `tests/agents.test.js`
- Test: `tests/init-docs.test.js`

**Interfaces:**
- Consumes: none
- Produces: `fankeel-brain-high` and `fankeel-brain-xhigh` retired

**Dispatch:** implementer, opus, high — the architectural floor; it owes no argument.

1. Change the tests first. In `tests/agents.test.js`: drop `'fankeel-brain-high', 'fankeel-brain-xhigh'` from `NAMES` and from `MAY_WRITE`, drop `'fankeel-brain-high': 'high', 'fankeel-brain-xhigh': 'xhigh',` from `EFFORT` (and the now-empty line), and in `the brain checks its own gate with gate-check.js before it returns the path` loop over `['fankeel-brain']` only. In `tests/init-docs.test.js`, change `assert.equal(names.length, 16);` to `assert.equal(names.length, 14);`.
2. Run `node --test tests/agents.test.js tests/init-docs.test.js` and watch the manifest and count tests fail.
3. Delete both files (`rm agents/fankeel-brain-high.md agents/fankeel-brain-xhigh.md`). In `.claude-plugin/plugin.json`, line 10 becomes:

   ```json
     "agents": ["./agents/fankeel-reader.md", "./agents/fankeel-judge.md", "./agents/fankeel-reviewer.md", "./agents/fankeel-verifier.md", "./agents/fankeel-fixer.md", "./agents/fankeel-brain.md", "./agents/fankeel-render-reviewer.md", "./agents/fankeel-mockup.md", "./agents/fankeel-slimmer.md", "./agents/fankeel-init-scout.md", "./agents/fankeel-writer.md", "./agents/fankeel-implementer.md", "./agents/fankeel-mutator.md", "./agents/fankeel-mover.md"],
   ```

4. Run `node --test tests/agents.test.js tests/init-docs.test.js` and watch them pass.
5. The session commits: `refactor: the brain's effort goes on the dispatch, not a copied file`, one line each for the two deleted files, `.claude-plugin/plugin.json` and the two tests.

## Task 9: The brain, the stage rules and the architectural clause send `effort:`

**Files:**
- Modify: `agents/fankeel-brain.md` — `## Effort` and `## Tools` name `effort:` on the dispatch
- Modify: `lib/stages.js:675-725` — the Deep-thought rule; `STAGE_AGENTS.build`'s implementer and its comment
- Modify: `lib/profile.js:265-290` — the `dispatchFor` comment and `dispatchClause`'s last words
- Read: `tests/render.test.js` — the 2400-character cap; run, not changed
- Read: `tests/profile-dispatch.test.js` — pins `dispatchClause`'s opening; run, not changed
- Test: `tests/agents.test.js`
- Test: `tests/stages.test.js`
- Test: `tests/brief.test.js`

**Interfaces:**
- Consumes: none
- Produces: none later tasks rely on

**Dispatch:** implementer, opus, high — the architectural floor; it owes no argument.

1. Change the tests first. In `tests/stages.test.js` (line ~1122-1130), the comment's `brain's high or xhigh variant` becomes `brain at effort high or xhigh`, the test name becomes `every controlled stage tells the controller to ask before sending a brain at a raised effort`, and the assertion becomes:

   ```js
       assert.ok(dispatch.endsWith(' Deep thought? AskUserQuestion first, two options; yes adds `effort: "high"`/`"xhigh"`.'), stage + ': ' + dispatch);
   ```

   In `tests/brief.test.js` line 792, the expected implementer becomes:

   ```js
     assert.match(build, /an implementer \(`fankeel:fankeel-implementer`, with `effort:` set where the task Dispatch line names an effort, on the model named there, with `isolation: "worktree"`\)/);
   ```

   In `tests/agents.test.js` `the brain names the dedicated agents…`, drop `'fankeel:fankeel-implementer-<effort>'` from the `Tools lacks` list, and replace the four `effort` assertions with:

   ```js
       const effort = section('Effort').replace(/\s+/g, ' ');
       assert.match(effort, /sends you with `effort: "high"` \(or `"xhigh"`\) on the dispatch/);
       assert.match(effort, /The controller/);
       assert.match(effort, /`fankeel:fankeel-reviewer` with the same/);
       assert.match(effort, /ask in your report's gate/);
       assert.doesNotMatch(effort, /-high`|-<effort>`/);
       assert.match(tools.replace(/\s+/g, ' '), /`fankeel:fankeel-implementer`, with `effort:` set where the task's Dispatch line names an effort/);
   ```

2. Run `node --test tests/stages.test.js tests/brief.test.js tests/agents.test.js` and watch the three fail.
3. In `agents/fankeel-brain.md`, replace the first two bullets of `## Effort` with:

   ```md
   - Your own. The controller judges, before it sends you, whether your stage
     needs deep thought, asks the user, and on a yes sends you with
     `effort: "high"` (or `"xhigh"`) on the dispatch. It is not yours to change.
   - On build, a task whose Dispatch line names an effort goes to
     `fankeel:fankeel-implementer` with that `effort:` on the dispatch, and its
     reviewer to `fankeel:fankeel-reviewer` with the same: the user approved that
     line at the plan gate.
   ```

   and in `agents/fankeel-brain.md` `## Tools`, replace `(`fankeel:fankeel-implementer`, or `fankeel:fankeel-implementer-<effort>`` / `where the task's Dispatch line names an effort, on the model that line` with:

   ```md
   (`fankeel:fankeel-implementer`, with `effort:` set where the task's Dispatch
   line names an effort, on the model that line
   ```

4. In `lib/stages.js`, replace the comment above the Deep-thought rule and the rule with:

   ```js
       // A brain at high or xhigh effort is the same agent with `effort` on the
       // dispatch (probe 2026-10-15: the call's effort overrides the file's), sent
       // only after the user said yes. Two options, so hooks/resume.js never files
       // the answer as a stage gate's. The block sits under the 2400 cap.
       'Dispatch one Agent: `subagent_type: fankeel:fankeel-brain`, prompt `' + stage + '`, plus any new user instruction; ' + (['design', 'plan'].includes(stage) ? '`model: opus`.' : 'no model.') + ' Deep thought? AskUserQuestion first, two options; yes adds `effort: "high"`/`"xhigh"`.',
   ```

   In `lib/stages.js`, the `STAGE_AGENTS` comment's `its effort variant when that line names an effort` becomes `with \`effort:\` on the dispatch when that line names one`, and the `build` entry's implementer becomes:

   ```js
       build: BRAIN_AGENTS.concat(['fankeel:fankeel-render-reviewer', 'fankeel:fankeel-fixer', 'fankeel:fankeel-writer', 'an implementer (`fankeel:fankeel-implementer`, with `effort:` set where the task Dispatch line names an effort, on the model named there, with `isolation: "worktree"`)']),
   ```

5. In `lib/profile.js`, the comment's `and the effort to high, the one variant the` / `implementer and reviewer agent files ship; every other class reads the` becomes `and the effort to high, sent as \`effort:\` on the implementer's and` / `reviewer's dispatch; every other class reads the`, and `dispatchClause` returns:

   ```js
       return d.effort ? 'class architectural: floor `' + d.floor + '`, effort `' + d.effort + '` — no economising; reviewers at `high`.' : null;
   ```

6. Run `node --test tests/stages.test.js tests/brief.test.js tests/agents.test.js tests/render.test.js tests/profile-dispatch.test.js` and watch them pass; `tests/render.test.js` is the 2400-character cap.
7. The session commits: `refactor: the brain and the stage rules send effort on the dispatch`, one line each for `agents/fankeel-brain.md`, `lib/stages.js`, `lib/profile.js` and the three tests.

## Task 10: The skills name `--render`, the skip ruling and `effort:` on the dispatch

**Files:**
- Modify: `skills/fankeel-build/SKILL.md` — step 2 and the reviewer dispatch name `effort:`; the render paragraph's ruling is per task; a new paragraph names `--render`, the ruling line and `task.js stage --render`
- Modify: `skills/fankeel-verify/SKILL.md` — the render reviewer's return is the `--render` file of the fix
- Modify: `skills/fankeel-plan/SKILL.md` — the third Dispatch field means `effort:` on the dispatch
- Read: `scripts/ledger.js` — the `--render` flag and refusal wording, from Task 2
- Read: `tests/skills-cli.test.js` — every flag a skill names must be one its script accepts; run, not changed
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: `--render` (Tasks 2 and 3)
- Produces: none

**Dispatch:** implementer, opus, high — the architectural floor; it owes no argument.

1. Change the test first. In `tests/skills.test.js`, replace the test at lines ~1405-1412 (`build sends implementers as fankeel-implementer, the effort variant…`) with, and append the second:

   ```js
   // docs/90-agent/plans/2026-10-15-render-gate-design.md §2.
   test('build sends implementers as fankeel-implementer with the Dispatch line\'s effort on the call, and its reviewer at the same effort', () => {
     const build = read('fankeel-build');
     assert.match(build, /`subagent_type: fankeel:fankeel-implementer` — with `effort: "<the field>"`\s+on the call/);
     assert.match(build, /`subagent_type: fankeel:fankeel-reviewer` — with the same `effort: "<the field>"`/);
     assert.doesNotMatch(build, /-<effort>`/);
     const plan = read('fankeel-plan');
     assert.match(plan, /\*\*Dispatch:\*\* implementer, sonnet, high —/);
     assert.doesNotMatch(plan, /VARIANT_EFFORTS|-<effort>`|model-choice\.md:43/);
   });

   // docs/90-agent/plans/2026-10-15-render-gate-design.md §1.
   test('build and verify name --render and the per-task skip ruling, and build names task.js stage --render for no plan', () => {
     const build = read('fankeel-build').replace(/\s+/g, ' ');
     assert.match(build, /--render <file> complete <n>/);
     assert.match(build, /`Ruling: render skipped — <why>`/);
     assert.match(build, /ruling "render skipped" "<why>" "<cost if wrong>"/);
     assert.match(build, /`task\.js stage <next> --session <id> --render <file>`/);
     assert.doesNotMatch(build, /recorded once at the top of the ledger/);
     const verify = read('fankeel-verify').replace(/\s+/g, ' ');
     assert.match(verify, /--render <file> fix/);
     assert.match(verify, /`Ruling: render skipped — <why>`/);
   });
   ```

2. Run `node --test tests/skills.test.js` and watch both fail.
3. In `skills/fankeel-build/SKILL.md` step 2 (line ~216-219), replace `` `subagent_type: fankeel:fankeel-implementer` — or `` / `` `fankeel:fankeel-implementer-<effort>` when the line carries a third field, `` with:

   ```md
      `subagent_type: fankeel:fankeel-implementer` — with `effort: "<the field>"`
      on the call when the line carries a third field,
   ```

   In `skills/fankeel-build/SKILL.md` (line ~430), the reviewer sentence becomes:

   ```md
      history. Dispatch it as `subagent_type: fankeel:fankeel-reviewer` — with the same `effort: "<the field>"` when the task's Dispatch line names one; the model
   ```

4. In `skills/fankeel-build/SKILL.md`, the last three lines of the `**A task that changes a page gets a second reviewer**` paragraph (from `to skip it (or to run it) for any page task; that is a ruling, recorded once`) become the lines below — keep its first line, and keep every no-plan word out of it, or `KNOWN_LEDGER_PARAGRAPHS` fails:

   ```md
      to skip it (or to run it) for any page task; that is a ruling, not a
      stopper, and a skip is written for each page task it covers, because the
      completion reads only the rulings written since the last task's line.
   ```

   Then insert this paragraph in `skills/fankeel-build/SKILL.md` after that one, before `**Where the task changed a page**`:

   ```md
      **The render verdict is what lets a page task complete.** Where
      `.fankeel/render.json` gives a page `src` globs, a range that changed a
      file under one is refused by
      `ledger.js --plan <file> --range <BASE>..<sha> --render <file> complete <n> "<what landed>"`
      — and by `fix` the same way — unless `--render` names the render
      reviewer's return, saved under `.fankeel/build/task-<started>/`, whose
      first line is `disposition: ship`, or the ledger holds a
      `Ruling: render skipped — <why>` written since the last task's line:
      `ledger.js --plan <file> ruling "render skipped" "<why>" "<cost if wrong>"`.
      With no plan there is no ledger, so the same check runs when the task
      leaves build: `task.js stage <next> --session <id> --render <file>`, or
      `task.js note "Ruling: render skipped — <why>" --session <id>` first.
   ```

5. In `skills/fankeel-verify/SKILL.md`, after `defeated row. Leave it off a change with no screen behind it.` (line ~258), add to that paragraph:

   ```md
   Its return, saved under `.fankeel/build/task-<started>/`, is the file build
   passes as `ledger.js --plan <file> --range <BASE>..<sha> --render <file> fix "<what>"`
   for the fix that answers a page row; without it, or a
   `Ruling: render skipped — <why>` written for that fix, the fix is refused.
   ```

6. In `skills/fankeel-plan/SKILL.md`, replace the paragraph `A third field after the model raises the effort: …` (lines 205-213) with:

   ```md
   A third field after the model raises the effort: `high` or `xhigh`. The
   implementer goes out as `fankeel:fankeel-implementer` with
   `effort: "<the field>"` on the dispatch, and the task's reviewer as
   `fankeel:fankeel-reviewer` with the same: the call's `effort` overrides the
   agent file's, measured on 2026-10-15
   (`docs/90-agent/reference/model-choice.md`). Leave it off for the agent
   files' own `medium`. It is above the floor like a stronger
   model, so it names why on that line, and the user approves it at the plan
   gate; `ledger.js lint` lists any other value by task number.
   ```

7. Run `node --test tests/skills.test.js tests/skills-cli.test.js` and watch them pass.
8. The session commits: `docs: the skills name the render gate and effort on the dispatch`, one line each for the three skills and `tests/skills.test.js`.

## Task 11: The ruling on the unused agents, and the effort TODO entry closed

**Files:**
- Modify: `docs/03-decisions/2026-10-15-unused-agents.md` — new decision record, Traditional Chinese
- Modify: `docs/README.md` — its row in the decisions table and its link under `### 模型選擇`
- Modify: `docs/90-agent/todo/effort-1.md` — closed through `scripts/todo.js done`, never by hand
- Read: `docs/03-decisions/2026-10-15-pane-svg.md` — the shape of a decision record to follow
- Read: `lib/plain.js` — the plain-language rules the page is held to
- Read: `scripts/todo.js` — `done <id> --sha <sha> [--commits <sha,sha>] [--record <text>]`, the only way an entry closes
- Read: `scripts/docs-check.js` — run, not changed
- Read: `scripts/todo-check.js` — run, not changed

**Interfaces:**
- Consumes: `scripts/variants.js` (Task 5), `fankeel-implementer-high` (Task 6), `fankeel-reviewer-high` (Task 7), `fankeel-brain-high` (Task 8) — their commits are the record's links
- Produces: `docs/03-decisions/2026-10-15-unused-agents.md`

**Dispatch:** implementer, opus, high — the architectural floor; it owes no argument.

1. Run `node scripts/docs-check.js` and note the lines it prints today; none names an `unused-agents` page.
2. Write `docs/03-decisions/2026-10-15-unused-agents.md`:

   ```md
   ---
   status: decision
   last_verified: 2026-10-15
   ---

   # 沒派過的 agent 各自怎麼處理（10-15）

   一句話：effort 改在派工時傳，六個 `-high`／`-xhigh` 複本刪掉；mover、mutator、writer 留給 stage agent 派；init-scout 與 slimmer 不動。

   ## 決定

   | agent | 怎麼處理 | 為什麼 |
   |---|---|---|
   | implementer-xhigh、reviewer-xhigh、brain-high | 刪掉 | effort 改在派工時傳，六個複本全部退役 |
   | mover、mutator | 留著，只給 stage agent 派 | stage agent 不能 Edit，才需要它們；在 session 裡跑的 audit 與 land 自己搬檔；在 session 裡跑的 verify 沒有 mutation 這一步 |
   | writer | 留著，只給 stage agent 派 | build 與 audit 的 stage agent 透過它寫給人看的頁；在 session 裡由 session 自己寫 |
   | init-scout、slimmer | 留著，不改 | `fankeel-init` 會派這兩個；這個 repository 從來沒跑過 init |

   - 表上第一列的三個從沒被派過；另外三個複本（implementer-high、reviewer-high、brain-xhigh）派過，也一起刪。
   - 哪些 agent 只有 stage agent 會派，寫在 `docs/90-agent/reference/subagents.md`。

   ## 為什麼

   - 10-15 的探針：兩次 `fankeel:fankeel-reader` 派工都用 opus，其中一次帶 `effort: "high"`。
   - 帶的那次，請求前綴記的是 `effortValue: "high"`；沒帶的那次是 `medium`，和 agent 檔一樣。
   - 派工時傳的 effort 會蓋過 agent 檔，複本就沒有存在的理由。
   - 複本是 agent 檔的拷貝，本體每改一次就要重產六份；刪掉之後只剩一份要維護。
   - mover、mutator、writer 在這裡沒被派過，是因為每個 stage 都在 session 裡跑。改由 stage agent 跑時要靠它們，刪了 stage agent 就沒有手。
   - init-scout 與 slimmer 沒被派過，是因為這個 repository 沒跑過 init；別的專案跑 init 時會用到。

   ## 放棄了什麼

   - 用 mod 的 turn.step 依 agentId 改寫每個子代理 effort 的做法不做了；派工時直接傳就夠。TODO 條目「每個子代理的 effort」以此結案。
   - 舊的對話紀錄裡還會出現 `fankeel-implementer-high` 這類名字；`baseAgent` 照舊把它讀成本體，bench 與 drift 讀舊紀錄時不會壞。
   - 探針只量了 reader。brain、implementer 與 reviewer 帶 effort 的派工沒有再量一次，推定它們一樣。
   ```

3. In `docs/README.md`, insert after the row ending `[decisions/2026-10-15-pane-svg.md](03-decisions/2026-10-15-pane-svg.md) — *繁體中文* |` (line ~262):

   ```md
   | 沒派過的 agent 怎麼處理（10-15）定了什麼：effort 改在派工時傳、六個複本刪掉，mover、mutator、writer 只給 stage agent 派，init-scout 與 slimmer 不動；放棄了什麼 | [decisions/2026-10-15-unused-agents.md](03-decisions/2026-10-15-unused-agents.md) — *繁體中文* |
   ```

   and in `docs/README.md` under `### 模型選擇`, after the `[Desktop 用 Svg 畫 band 與 Pane，終端維持文字（10-15）]` item (line ~507):

   ```md
   - [沒派過的 agent 怎麼處理（10-15）：effort 改在派工時傳，六個複本刪掉](03-decisions/2026-10-15-unused-agents.md)
   ```

4. Find the four retirement commits, each the last commit touching its path:

   ```
   git log -n 1 --format=%H -- scripts/variants.js
   git log -n 1 --format=%H -- agents/fankeel-implementer-high.md
   git log -n 1 --format=%H -- agents/fankeel-reviewer-high.md
   git log -n 1 --format=%H -- agents/fankeel-brain-high.md
   ```

   Close the entry with the last of them as `--sha` and all four as `--commits`:

   ```
   node scripts/todo.js done effort-1 --sha <the brain-high commit> --commits <variants>,<implementer>,<reviewer>,<brain> --record "派工時傳 effort 就會蓋過 agent 檔的設定（10-15 探針：帶 high 的派工記到 effortValue high，沒帶的是 medium）。六個 effort 複本與產生它們的腳本已刪，不必靠 mod 的 turn.step 改寫。"
   ```

5. Run `node scripts/docs-check.js` and `node scripts/todo-check.js`. Compare with step 1: no new line may name `docs/03-decisions/2026-10-15-unused-agents.md`, `docs/README.md` or `docs/90-agent/todo/effort-1.md`.
6. The session stages the new page and commits: `docs: rule on the agents this repository never dispatched`, one line each for the record, `docs/README.md` and the closed TODO entry.

## Task 12: The reference pages carry the probe and name the stage-agent-only agents

**Files:**
- Modify: `docs/90-agent/reference/model-choice.md` — `## Constraint on c` and the raise paragraph carry the probe
- Modify: `docs/90-agent/reference/subagents.md` — fourteen agents; the variant paragraph becomes the probe and the stage-agent-only agents
- Modify: `README.md` — the `agents/` tree row drops its variants
- Read: `docs/03-decisions/2026-10-15-unused-agents.md` — the decision `subagents.md` links, from Task 11
- Read: `scripts/docs-check.js` — run, not changed
- Test: `tests/init-docs.test.js`

**Interfaces:**
- Consumes: `docs/03-decisions/2026-10-15-unused-agents.md` (Task 11), which `subagents.md` links; `fankeel-brain-high` (Task 8)
- Produces: none

**Dispatch:** implementer, opus, high — the architectural floor; it owes no argument.

1. Change the test first. In `tests/init-docs.test.js`, the first two asserts of `subagents.md and collisions.md name fankeel-init-scout as read-only` become:

   ```js
       assert.match(flat('subagents.md'), /## The fourteen agents this plugin defines/);
       assert.match(flat('subagents.md'), /`fankeel-slimmer` and `fankeel-init-scout` — carry `tools: \[Read, Grep, Glob, Bash\]`/);
   ```

   and in `tests/init-docs.test.js`, `subagents.md names every agent the plugin ships` gains, after its two `model-choice.md` asserts:

   ```js
       assert.match(flat('model-choice.md'), /effortValue: "high"/);
       assert.doesNotMatch(flat('model-choice.md'), /The Agent tool cannot set effort\. Only/);
       assert.match(text, /dispatched only by a stage agent: `fankeel-mover`, `fankeel-mutator` and `fankeel-writer`/);
       assert.doesNotMatch(text, /scripts\/variants\.js|renderVariant/);
   ```

2. Run `node --test tests/init-docs.test.js` and watch it fail.
3. In `docs/90-agent/reference/subagents.md`: `last_verified` becomes `2026-10-15`; the heading becomes `## The fourteen agents this plugin defines`; `Twenty subagent types` becomes `Fourteen subagent types`; the list drops the six `-high`/`-xhigh` names, ending `` `fankeel-mutator` and `fankeel-mover`. ``; the read-only sentence becomes `` Six of them — `fankeel-reader`, `fankeel-judge`, `fankeel-reviewer`, `` / `` `fankeel-render-reviewer`, `fankeel-slimmer` and `fankeel-init-scout` — carry `tools: [Read, Grep, Glob, Bash]` — Edit, Write and ``; `any of the eight cannot write anything` becomes `any of the six cannot write anything`; and `Nineteen of` / `the twenty agents hold` becomes `Thirteen of` / `the fourteen agents hold`.
4. In `docs/90-agent/reference/subagents.md`, replace the paragraph `The six \`-high\` and \`-xhigh\` files are …` (lines 116-125) with:

   ```md
   Effort for one dispatch is the call's own `effort` parameter. A probe on
   2026-10-15 sent two `fankeel:fankeel-reader` dispatches on opus, one with
   `effort: "high"`: its `agent-*.prefix.json` carried `effortValue: "high"`,
   and the control's carried `medium`, its agent file's own. So an implementer
   and its reviewer go out with `effort: "<the field>"` when the task's
   `**Dispatch:**` line names one, and a brain with `effort: "high"` or
   `"xhigh"` when the controller, judging that the stage needs deep thought,
   asked the user first and the user said yes (`controlRules` in
   `lib/stages.js`). The six `-high` and `-xhigh` copies of the brain,
   implementer and reviewer files that stood in for the parameter were deleted
   that day, with the script that wrote them. A transcript written before then
   still names them, and `baseAgent` in `lib/agentfile.js` still reads such a
   name as its base.

   Three of the fourteen are dispatched only by a stage agent: `fankeel-mover`,
   `fankeel-mutator` and `fankeel-writer`. They exist because a stage agent
   cannot `Edit`. A stage run in the session does that work itself: audit and
   land move their own files, verify there has no mutation step, and build and
   audit write their pages for a person directly — so a project that keeps
   every stage in the session never sends them. `fankeel-init-scout` and
   `fankeel-slimmer` are sent by `fankeel-init` alone. The ruling on each is
   [the 2026-10-15 decision](../../03-decisions/2026-10-15-unused-agents.md).
   ```

5. In `docs/90-agent/reference/model-choice.md`: `last_verified` becomes `2026-10-15`. In `## Constraint on c`, replace from `The Agent tool cannot set effort.` through `and a per-task raise goes through the override file.` (lines 44-48), keeping `It is the plugin's own agent file` and what follows, with:

   ```md
   A dispatch sets it. Until 2026-10-15 this page said the Agent tool cannot set
   effort; a probe that day sent two `fankeel:fankeel-reader` dispatches on
   opus, one with `effort: "high"`. Its `agent-*.prefix.json` carried
   `effortValue: "high"`, and the control's carried `medium`, its agent file's
   `effort:` — the call's `effort` overrides the file's. A default effort per
   model is still the frontmatter's, since a profile key alone would change the
   model and leave the effort as pinned, so item c stands: the pinned `effort:`
   stays, and a raise for one role goes through the override file.
   ```

   In `docs/90-agent/reference/model-choice.md`, replace the paragraph `A raise for one dispatch is shipped rather than generated: …` (lines 59-68) with:

   ```md
   A raise for one dispatch is sent on the call. A plan's `**Dispatch:**` line
   `implementer, <model>, <effort>` sends the implementer and its reviewer with
   `effort: "<effort>"`, approved at the plan gate; `ledger.js lint` refuses any
   value but `high` and `xhigh`. The controller asks the user before it sends a brain
   with `effort: "high"` or `"xhigh"`, and only for a stage it judges needs deep
   thought (`controlRules` in `lib/stages.js`). The six `-high` and `-xhigh`
   agent-file copies that stood in for this were deleted on 2026-10-15. The
   override file above stays the per-role route.
   ```

6. In `README.md`, the `agents/` tree row (line ~203) drops `, some with -high and -xhigh variants`:

   ```md
   ├── agents/            every subagent the stages dispatch, one file each — reader, reviewer, verifier, judge, fixer, brain, implementer, mover, mutator, writer, render-reviewer, mockup and the rest — with its tools and model
   ```

7. Run `node --test tests/init-docs.test.js` and watch it pass. Run `node scripts/docs-check.js` and check that no line names `docs/90-agent/reference/model-choice.md`, `docs/90-agent/reference/subagents.md` or `README.md`.
8. The session runs the whole suite with `FANKEEL_BROWSER="C:\Program Files\Google\Chrome\Application\chrome.exe" npm test` and commits: `docs: the reference pages carry the effort probe and the stage-agent-only agents`, one line each for the three pages and `tests/init-docs.test.js`.

## Coverage

| promise | task |
|---|---|
| `.fankeel/render.json` pages take an optional `"src": [globs]`. `lib/shots.js` | Task 1 |
| A project with no `render.json`, or whose pages carry no `src`, is never | Tasks 2 and 3 — both return null with no render.json, and `pagesTouched` matches nothing for a page with no `src` |
| `scripts/ledger.js complete` and `fix`, given `--range`, run | Task 2 |
| The refusal names the pages, the paths that hit them, and both ways through. | Task 2; Task 3 for the stage refusal |
| `VERB_FLAGS` gains `render` for both verbs. | Task 2 |
| **Departure from the judge:** the no-ledger seat is `task.js stage`, not | Task 3 |
| Design's mockup is not gated: there is no real page to shoot, and the tuning | Task 3 — the check fires only leaving build; nothing is added at design |
| `skills/fankeel-build/SKILL.md` (~442-454) and `skills/fankeel-verify/SKILL.md` | Task 10 |
| Delete the six variant files (`agents/fankeel-{brain,implementer,reviewer}-{high,xhigh}.md`), | Tasks 5 (generator, `VARIANT_EFFORTS`, `renderVariant`), 6, 7 and 8 (the files and `.claude-plugin/plugin.json`) |
| The plan's `**Dispatch:**` third field keeps its form (`implementer, opus, high`) | Task 5 (`lib/plantasks.js` comment and lint), Task 9 (brain file), Task 10 (plan and build skills) |
| `lib/stages.js`: the "Deep thought?" rule sends `fankeel:fankeel-brain` with | Task 9 |
| `lib/title.js` `prefixFor` reads `toolInput.effort` before the file's | Task 4 |
| `docs/90-agent/reference/model-choice.md` (~43-44) and `subagents.md` (~119) | Task 12; the TODO entry closes in Task 11 |
| Tests that list or render variants (`agents`, `agentfile`, `guard-variant`, | Tasks 4-9 and 12; `guard-variant`, `guard`, `brief` and `dispatch-gate` pass a variant name through `baseAgent`, which stays, and run unchanged in the session's full suite after Tasks 6-8 |
| The ruling is written as one decision record, `docs/03-decisions/2026-10-15-unused-agents.md` | Task 11; `subagents.md` names the stage-agent-only agents in Task 12 |
| `tests/ledger.test.js`: a range touching a `src` glob is refused without | Task 2 |
| `tests/shots.test.js`: `src` parsed, a non-array refused, `pagesTouched` | Task 1 |
| A `task.js stage` test: leaving build on `build,verify` with a claimed page | Task 3 |
| `tests/title.test.js`: a dispatch carrying `effort: "xhigh"` titles `· xhigh`. | Task 4 |
| Full suite green with `FANKEEL_BROWSER` set to Chrome. | every task's commit; Task 12's last step runs it whole |
