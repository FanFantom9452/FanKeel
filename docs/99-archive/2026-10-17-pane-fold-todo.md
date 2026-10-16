---
status: current
last_verified: 2026-10-17
---

# Pane fold heads and TODO buttons Implementation Plan

**Goal:** The Pane's route and tasks fold under a head Button, a foldable TODO block in the foot opens the station on one entry, the station reads `#/p/<pkey>/todo[/<id>]`, and the brief-3 probe is ready for the user to run.
**Architecture:** `hooks/pane-status.ts` stays a pure function from data to rows: a fold head is a segment with `press: 'fold'`, a TODO title one with `press: 'todo'` and the station hash in `to`. `hooks/pane.ts` holds the fold flags in the `register` closure's `state`, reads the project's TODO bucket through `$.fs`, and turns each pressable segment into a `Button`; `hooks/pane-svg.ts` keeps the tasks head a row above its Svg. The station's `parseHash` peels a trailing `/todo[/<id>]` off the pkey, each open TODO row carries `id="todo-<id>"`, and `draw()` scrolls it into view once.
**Tech Stack:** Node v24.21.0 (`node --test`; `.ts` loads by type stripping, erasable TypeScript only), no dependencies, the Claude Code mod API typed in `.claude-plugin/types/claude-code/index.d.ts`, the station page as ES5 in one file.
**Spec:** 2026-10-17-pane-fold-todo-design.md

## Global Constraints

Generated 2026-10-17 from `node scripts/map.js` (`.fankeel/map.md`), `package.json`, the hooks, the station page and the tests. The repository has no `CLAUDE.md`.

- `package.json` declares no dependency, `"engines": { "node": ">=22.5" }`, `"test": "node --test --require ./tests/subprocess-timeout.js"` and `"test:fast": "node --test --test-skip-pattern=@slow --require ./tests/subprocess-timeout.js"`. Add no dependency.
- `hooks/*.ts` run inside the engine: they never import `lib/` (`hooks/pane.ts:76-77`, "the engine follows $ only into a function of this file, never across an import"). Every function taking `$` is declared at the top level of `hooks/pane.ts` (`hooks/pane.ts:451`); a closure inside a render hook may use that hook's own `$`, as the station Button's `onPress` does (`hooks/pane.ts:602`). A `lib/` rule a hook needs is written again in the hook and a test pins the copy to the original.
- `hooks/*.ts`: two-space indent, no semicolons, single quotes, imports name the `.ts` extension, erasable syntax only (no `enum`, no parameter properties, no namespaces).
- `tests/pane*.test.js` and `tests/station*.test.js`: `'use strict'`, four-space indent, semicolons. A `.ts` module is loaded with `import(pathToFileURL(path.join(__dirname, '..', 'hooks', '<name>.ts')).href)`; the station page with `global.window = { STATION: ... }` then `require('../assets/station/station.js')`, whose test exports are the `module.exports` block (`assets/station/station.js:2704-2725`).
- `assets/station/station.js` is ES5 inside one IIFE: `var`, `function`, no arrow functions, no `let`/`const`, four-space indent, semicolons. It is 6311 lines, so every task names it as `path:a-b`.
- `READ_CAP` is `1500` lines and `FILE_CAP` is `3` `Modify:` entries a task (`lib/plantasks.js:353-354`).
- `PANE` is `'fankeel'`, `COMMAND` is `'fankeel-panel'`, `POLL_MS` is `250` (`tests/pane.test.js:90-92`). `SVG_MAX` is `131072` (`hooks/pane-svg.ts:14`).
- `RAILS` is asserted whole by `assert.deepEqual(m.RAILS, RAIL)` (`tests/pane-status.test.js:53`): a block added to it is added to `RAIL` in the same commit.
- A station url is drawn as a Button only when it matches `STATION_URL`, `/^http:\/\/127\.0\.0\.1:\d{1,5}\/?$/` (`hooks/pane.ts:324`); every TODO Button opens that url with a hash appended, through `openStation` (`hooks/pane.ts:347-364`).
- `pkeyOf(session)` is `session.project ? session.root + '/' + session.project : session.root` (`lib/station.js:650-652`); the station's roots are `path.resolve`d (`lib/station.js:35-41`), so on Windows they carry backslashes.
- An open TODO entry is every entry file whose `state` is not `done` (`lib/station.js:390`); its id is the file name without `.md` (`lib/todo.js:364`); the bucket is the `role: 'todo'` entry of `.fankeel/docs.json` (`lib/todo.js:291-295`).
- `docs/01-guide/*.md` are human reference pages in Traditional Chinese; `docs-check` flags a sentence wider than 160 columns there (`lib/plain.js:12`, `MAX_SENTENCE_WIDTH`).
- `node scripts/docs-check.js` names every quoted `path:line` that no longer holds its quote; `docs/90-agent/reference/station.md` quotes 28 lines of `assets/station/station.js` and cites 3 more unquoted, all clean at `eae94c85`.
- `.fankeel/build/` is ignored by git (`.fankeel/.gitignore`).
- A commit is `<type>: <sentence>`, a blank line, one `- what changed — path` line a change, then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- An implementer runs only its own test files. The session that dispatched it runs `npm run test:fast` before committing a group; on this machine that needs `FANKEEL_BROWSER` set to chrome.exe's full path, or 14 render tests fail on Edge.
- Claude Desktop runs the plugin snapshot taken at install: a change shows there only after `claude plugin update fankeel@fankeel` (`README.md:216`).

## Risks

- Tasks 2 and 3 change the rows `statusRows` draws, and 18 existing assertions across `tests/pane.test.js`, `tests/pane-status.test.js` and `tests/pane-svg.test.js` read those rows (row counts, `tasks N of M`, "no Button"). — Task 2 — its Step 1 diffs carry every one of them, measured on a scratch copy at `eae94c85`; Step 2 lists the eight that fail before the code and why.
- Two renders of the Pane now make two different `onPress` closures, so a test that `deepEqual`s two whole trees fails on the fold Buttons. — Task 2 — `tests/pane-svg.test.js` compares the trees through `bare()` (a JSON round trip, which drops functions); no other test compares whole Pane trees.
- The Pane builds the pkey from `$.session.root()`, which may write `F:/x` where the station's `path.resolve` wrote `F:\x`, so a hash the Pane opens could name no project on the page. — Task 1 — `knownPkey` matches the session key ignoring slash direction and case; Task 6 opens one on the real Desktop.
- `cmd /c start "" <url>` hands the url to `cmd`, and `encodeURIComponent` writes `%3A`, `%2F`, `%5C`: `cmd` expands `%name%` only for a defined variable, so an environment variable named like `3A` or `2Fymlab` would rewrite the url. — Task 6 — the user's click is the check; nothing in the suite can see `cmd`'s expansion.
- A hash whose raw pkey ends in a segment named `todo` (`#/p/F:/x/todo`, slashes unencoded) is now read as project `F:/x` with its panel focused. The station and the Pane both encode the key whole, so only a hand-typed hash meets it. — Task 1 — its test pins `#/p/todo` as a key and the encoded forms; no fix.
- Task 1 inserts about 30 lines into `assets/station/station.js`, which moves 31 citations in `docs/90-agent/reference/station.md`. — Task 4 — its Step 3 moves every one by the diff against `eae94c85` and Step 4 runs `docs-check` for none left.
- `docs/90-agent/reference/station.md` names the two sub-routes, which design §3 puts with the station work, but Task 1's three ranges of `assets/station/station.js` already use `FILE_CAP`. — Task 4 — the page's paragraph goes there, with the citations it has to move anyway.
- The approved mockup also dropped the `tasks N of M` line inside `tasksSvg` (the head Button says it) and moved the station url under its Button; design §2 says the `開啟 station` Button "stays as it is" and names neither change. — Task 2 — the Svg keeps its own title line and the url stays beside the Button; the user can overturn this at the plan gate.
- The design does not place the TODO block in the drop order. — Task 3 — it drops first, down to its head row, before notes: it is a shortcut to the station, the rest is this task. The user can overturn this at the plan gate.
- The design's count is "the project's open entries"; the station counts every state but `done` open, Ready, Needs a decision, Blocked and Watch alike (`lib/station.js:390`). — Task 3 — the Pane counts the same, and its last test pins the count to `lib/todo.js` `load()` over this repository's own 30 entries.
- `todosOf` lists the TODO folder on every tick while a station is up (221 files here). — Task 3 — each file is read only when its listing stamp moves, as the neighbours are; one listing a tick is the cost.
- `docs/90-agent/todo/brief-3.md` step 5 says `SessionAppendArgs` exists only after the probe mod loads; this checkout already has the generated types at `.claude-plugin/types/claude-code/index.d.ts:10541` (`message`, `agentId`). — Task 5 — the probe's append uses those two fields, and its entry note says the types were read from this checkout.
- Steps 2 to 6 of brief-3 need an interactive session with the probe mod enabled, which no subagent can start. — Task 5 — it prepares and checks the files only; running the probe stays the user's, as design §4 says.

## Task 1: Station sub-route `#/p/<pkey>/todo[/<id>]`, entry anchors and the scroll

`parseHash` reads a trailing `/todo` or `/todo/<id>` on `#/p/<pkey>` as a focus, each open row of the TODO panel carries `id="todo-<id>"`, and after a draw on such a hash the entry (or the panel, when that entry is not open) is scrolled into view once. A pkey that differs from a session's only in slash direction or case is read as that session's.

**Files:**
- Modify: `assets/station/station.js:230-251` — `parseHash` peels the focus off; `knownPkey` after `projectHash`
- Modify: `assets/station/station.js:2603-2725` — `rowOpen` takes `anchor`, open rows pass `true`; `knownPkey` exported
- Modify: `assets/station/station.js:5270-5430` — `focusFor` and `focusTodo` before `draw()`, called at its end; `hashchange` scrolls to the top only when nothing was focused
- Test: `tests/station-view.test.js`
- Test: `tests/station-todo-panel.test.js`

**Interfaces:**
- Consumes: none
- Produces: `parseHash('#/p/<enc pkey>/todo/<enc id>')` → `{ view: 'project', pkey, todo: '<id>' }`, `'#/p/<enc pkey>/todo'` → `{ view: 'project', pkey, todo: '' }`, plain `#/p/<enc pkey>` unchanged `{ view: 'project', pkey }`; `knownPkey(k: string, sessions: { pkey: string }[] | undefined): string`; open TODO rows carry `id="todo-<id>"`. Task 3 builds the hashes, Task 4 documents them.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] Step 1. Write the failing tests. In `tests/station-todo-panel.test.js`, apply:

```diff
@@ -5,4 +5,7 @@
 const test = require('node:test');
 const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const path = require('node:path');
+const vm = require('node:vm');
 
 global.window = { STATION: { serve: false } };
@@ -23,5 +26,8 @@
     assert.match(html, /未完成 3/);
     assert.match(html, /已完成 2/);
-    assert.equal((html.match(/<li class="td-row">/g) || []).length, 5);
+    assert.equal((html.match(/<li class="td-row"( id="todo-[a-z0-9-]+")?>/g) || []).length, 5);
+    // An open row carries the id #/p/<pkey>/todo/<id> scrolls to; a done row does not.
+    assert.match(html, /<li class="td-row" id="todo-b-1">/);
+    assert.doesNotMatch(html, /id="todo-c-1"/);
     assert.match(html, /<code>x<\/code>/);
     assert.match(html, /class="td-tm rep"/, 'a second entry under the same timing is muted');
@@ -147,10 +153,10 @@
     ], done: [Object.assign({}, ROW.done[0], { body: 'closed because' }), ROW.done[1]] });
     const shut = V.todoPanelHtml(row, []);
-    assert.match(shut, /<li class="td-row td-has" data-tdbody="a-1" role="button" tabindex="0" aria-expanded="false">/);
+    assert.match(shut, /<li class="td-row td-has" data-tdbody="a-1" role="button" tabindex="0" aria-expanded="false" id="todo-a-1">/);
     assert.match(shut, /data-tdbody="c-1"/);
     assert.doesNotMatch(shut, /data-tdbody="b-1"|data-tdbody="c-2"/);
     assert.doesNotMatch(shut, /data-block="todo-body"/);
     const open = V.todoPanelHtml(row, [], false, { 'a-1': true });
-    assert.match(open, /aria-expanded="true">/);
+    assert.match(open, /aria-expanded="true" id="todo-a-1">/);
     assert.match(open, /<li class="td-body" data-block="todo-body">From <code>x<\/code>\.\nSecond line &lt;b&gt;<\/li>/);
     assert.equal((open.match(/data-block="todo-body"/g) || []).length, 1);
@@ -190,2 +196,55 @@
     assert.equal(bodyShown(p), 1, 'the row itself still toggles');
 });
+
+// The page booted whole in a fresh vm context, the way tests/station-docs-tour.test.js
+// boots it, on `hash`. Of the ids `todo` and `todo-<id>` only those in `present`
+// are on the page; every element records being scrolled to, and the window its scrollTo.
+// The elements are of the vm's realm, so what they record is compared as plain strings.
+const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
+function bootAt(hash, present) {
+    const els = {};
+    const scrolled = [];
+    const tops = [];
+    const on = {};
+    const el = (id) => ({ id, innerHTML: '', textContent: '', className: '', title: '', hidden: false, style: {},
+        setAttribute() {}, getAttribute() { return null; }, appendChild() {}, addEventListener() {},
+        removeAttribute() {}, scrollIntoView(o) { scrolled.push([id, o && o.block]); } });
+    const doc = {
+        hidden: false,
+        getElementById: (id) => (/^todo(-|$)/.test(id) && !present.includes(id) ? null : els[id] || (els[id] = el(id))),
+        addEventListener() {}, createElement: () => el(''), querySelectorAll: () => [],
+        querySelector: () => ({ parentNode: { insertBefore() {} }, nextSibling: null }),
+        head: { appendChild() {} },
+    };
+    const win = {
+        location: { hash, protocol: 'file:' }, addEventListener: (type, fn) => { (on[type] = on[type] || []).push(fn); }, scrollTo: (x, y) => { tops.push([x, y]); },
+        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {},
+        STATION: {
+            generatedAt: new Date(2026, 9, 17, 11, 0).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-04', serve: false,
+            projects: [], profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [],
+        },
+    };
+    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams });
+    return { scrolled, tops, go: (to) => { win.location.hash = to; on.hashchange.forEach((fn) => fn()); } };
+}
+const P = '#/p/' + encodeURIComponent('F:\\ws');
+
+test('#/p/<pkey>/todo/<id> scrolls that entry into view once the page draws; one not on the page scrolls the panel', () => {
+    const at = bootAt(P + '/todo/b-1', ['todo', 'todo-b-1']);
+    assert.deepEqual(at.scrolled, [['todo-b-1', 'start']]);
+    assert.deepEqual(bootAt(P + '/todo/gone-1', ['todo']).scrolled, [['todo', 'start']]);
+    assert.deepEqual(bootAt(P + '/todo', ['todo', 'todo-b-1']).scrolled, [['todo', 'start']]);
+    assert.deepEqual(bootAt(P, ['todo', 'todo-b-1']).scrolled, []);
+    // No panel on the page yet: nothing is scrolled, and nothing throws.
+    assert.deepEqual(bootAt(P + '/todo/b-1', []).scrolled, []);
+});
+
+test('arriving on a TODO hash scrolls to it and not back to the top; any other hash goes to the top', () => {
+    const at = bootAt('#/', ['todo', 'todo-b-1']);
+    at.go(P + '/todo/b-1');
+    assert.deepEqual(at.scrolled, [['todo-b-1', 'start']]);
+    assert.deepEqual(at.tops, []);
+    at.go('#/sessions');
+    assert.deepEqual(at.tops, [[0, 0]]);
+    assert.equal(at.scrolled.length, 1);
+});
```

Then in `tests/station-view.test.js`, apply:

```diff
@@ -1756,2 +1756,24 @@
 });
 
+
+test('a trailing /todo or /todo/<id> on #/p/<pkey> is a focus on the TODO panel, not part of the key', () => {
+    const key = 'F:\\ymlab\\fankeel';
+    const k = encodeURIComponent(key);
+    assert.deepEqual(V.parseHash('#/p/' + k + '/todo/brief-3'), { view: 'project', pkey: key, todo: 'brief-3' });
+    assert.deepEqual(V.parseHash('#/p/' + k + '/todo'), { view: 'project', pkey: key, todo: '' });
+    assert.deepEqual(V.parseHash('#/p/' + k), { view: 'project', pkey: key });
+    // A key written with its slashes unencoded loses only the tail.
+    assert.deepEqual(V.parseHash('#/p/F:/ymlab/fankeel/todo/brief-3'), { view: 'project', pkey: 'F:/ymlab/fankeel', todo: 'brief-3' });
+    assert.deepEqual(V.parseHash('#/p/F:/ymlab/fankeel'), { view: 'project', pkey: 'F:/ymlab/fankeel' });
+    // `todo` alone is a key, not a focus with no project.
+    assert.deepEqual(V.parseHash('#/p/todo'), { view: 'project', pkey: 'todo' });
+});
+
+test('knownPkey finds the session key the Pane meant across slash direction and drive-letter case', () => {
+    const sessions = [{ pkey: 'F:\\ymlab\\fankeel' }, { pkey: 'F:\\ymlab\\fankeel/app' }];
+    assert.equal(V.knownPkey('F:/ymlab/fankeel', sessions), 'F:\\ymlab\\fankeel');
+    assert.equal(V.knownPkey('f:/ymlab/fankeel/app', sessions), 'F:\\ymlab\\fankeel/app');
+    assert.equal(V.knownPkey('F:\\ymlab\\fankeel', sessions), 'F:\\ymlab\\fankeel');
+    assert.equal(V.knownPkey('G:/other', sessions), 'G:/other');
+    assert.equal(V.knownPkey('G:/other', undefined), 'G:/other');
+});
```

- [ ] Step 2. Run them and watch them fail:

```
node --test tests/station-todo-panel.test.js tests/station-view.test.js
```

Expected: the panel test (`id="todo-b-1"` missing), the body-row test, the two scroll tests, the sub-route test and `knownPkey` (not a function) fail; everything else passes.

- [ ] Step 3. Write the implementation. In `assets/station/station.js`, apply (three ranges, ES5 only):

```diff
@@ -233,5 +233,7 @@
     // `#/tour`, `#/list` and `#/cmp` are the other pages the left bar opens;
     // `#/p/<pkey>` and `#/s/<id>[/<tab>]` are opened from rows. A hash is what
-    // a page opened from file:// can go back through.
+    // a page opened from file:// can go back through. `#/p/<pkey>/todo` and
+    // `#/p/<pkey>/todo/<id>` are the project page with its TODO panel, or that
+    // entry in it, scrolled into view: the Pane's TODO buttons open them.
     var PAGES = ['live', 'sessions', 'projects', 'docs', 'settings', 'tour'];
     function parseHash(hash) {
@@ -240,6 +242,9 @@
         if (p[0] === 'd' && /^\d{4}-\d{2}-\d{2}$/.test(p[1] || '')) return { view: 'days', day: p[1] };
         if (p[0] === 'days') return { view: 'days', day: null };
-        var key = p[0] === 'p' && p[1] ? dec(p.slice(1).join('/')) : null;
-        if (key !== null) return { view: 'project', pkey: key };
+        var seg = p[0] === 'p' && p[1] ? p.slice(1) : [], todo;
+        if (seg.length > 1 && seg[seg.length - 1] === 'todo') { todo = ''; seg = seg.slice(0, -1); }
+        else if (seg.length > 2 && seg[seg.length - 2] === 'todo') { todo = dec(seg[seg.length - 1]) || ''; seg = seg.slice(0, -2); }
+        var key = seg.length ? dec(seg.join('/')) : null;
+        if (key !== null) return todo === undefined ? { view: 'project', pkey: key } : { view: 'project', pkey: key, todo: todo };
         var id = p[0] === 's' && p[1] ? dec(p[1]) : null;
         if (id !== null) return { view: 'session', id: id, tab: TABS.indexOf(p[2]) >= 0 ? p[2] : 'timeline' };
@@ -249,4 +254,13 @@
     }
     function projectHash(pkey) { return '#/p/' + encodeURIComponent(pkey); }
+    // The Pane builds a pkey from the engine's root, which may write `/` where
+    // lib/station.js's path.resolve wrote `\`, or another case of the drive
+    // letter: the key a session on the page carries wins, else `k` as it came.
+    function knownPkey(k, sessions) {
+        var flat = function (s) { return String(s).replace(/\\/g, '/').toLowerCase(); };
+        var all = sessions || [];
+        var hit = all.filter(function (s) { return s.pkey === k; })[0] || all.filter(function (s) { return flat(s.pkey) === flat(k); })[0];
+        return hit ? hit.pkey : k;
+    }
     function sessionHash(id, tab) { return '#/s/' + encodeURIComponent(id) + (tab && tab !== 'timeline' ? '/' + tab : ''); }
     function family(model) {
@@ -2604,7 +2618,9 @@
         // open is the project page's `view.tdBody`, so a 3 s redraw keeps it.
         var opened = bodyOpen || {};
-        var rowOpen = function (e, cls) {
+        // An open row carries `id="todo-<id>"`, what `#/p/<pkey>/todo/<id>` scrolls to.
+        var rowOpen = function (e, cls, anchor) {
             var has = !!(e.body && e.id), on = has && !!opened[e.id];
-            return { on: on, head: '<li class="' + cls + (has ? ' td-has" data-tdbody="' + esc(e.id) + '" role="button" tabindex="0" aria-expanded="' + String(on) + '">' : '">') };
+            var at = anchor && e.id ? ' id="todo-' + esc(e.id) + '"' : '';
+            return { on: on, head: '<li class="' + cls + (has ? ' td-has" data-tdbody="' + esc(e.id) + '" role="button" tabindex="0" aria-expanded="' + String(on) + '"' : '"') + at + '>' };
         };
         var bodyRow = function (e, r) {
@@ -2620,5 +2636,5 @@
                     var rep = timed && e.condition === prev;
                     prev = timed ? e.condition : null;
-                    var r = rowOpen(e, 'td-row');
+                    var r = rowOpen(e, 'td-row', true);
                     return r.head + todoChip(e.label) + '<span class="td-t">' + esc(e.title) + '</span>'
                         + '<span class="td-d" title="' + esc(e.description) + '">' + md(e.description) + '</span>'
@@ -2705,5 +2721,5 @@
     if (typeof module !== 'undefined' && module.exports) {
         module.exports = {
-            todoPanelHtml: todoPanelHtml,
+            todoPanelHtml: todoPanelHtml, knownPkey: knownPkey,
             boardLinkHtml: boardLinkHtml,
             tokens: tokens, mins: mins, hours: hours, usd: usd, ago: ago, day: day,
@@ -5275,6 +5291,19 @@
         drawFloat();
     });
+    // The hash a `#/p/<pkey>/todo[/<id>]` arrived with, until its TODO panel or
+    // entry is scrolled into view; null once it is. Tried after every draw, since
+    // the panel can come with a later data read; a hash the reader has left is
+    // not chased.
+    var focusFor = w.location.hash;
+    function focusTodo() {
+        if (focusFor !== w.location.hash || route.view !== 'project' || route.todo === undefined) return;
+        var to = (route.todo && doc.getElementById('todo-' + route.todo)) || doc.getElementById('todo');
+        if (!to) return;
+        focusFor = null;
+        to.scrollIntoView({ block: 'start' });
+    }
     function draw() {
         route = parseHash(w.location.hash);
+        if (route.view === 'project') route.pkey = knownPkey(route.pkey, S.sessions);
         var p = doc.getElementById('page');
         p.className = 'page' + (route.view === 'list' ? ' fixed' : '');
@@ -5339,4 +5368,5 @@
         drawSide();
         doc.getElementById('gen').textContent = genText();
+        focusTodo();
     }
     // The left bar's folds, kept as `{fold: true}` for each one the reader
@@ -5423,6 +5453,7 @@
         // Edit mode belongs to one visit of the dashboard: another page ends it.
         view.dashEdit = false;
+        focusFor = w.location.hash;
         draw();
-        w.scrollTo(0, 0);
+        if (focusFor !== null) w.scrollTo(0, 0);
     });
     // The 前端 step's model bar: arrow keys, Home and End walk the three
```

- [ ] Step 4. Run Step 2's command again: all pass. Then the rest of the station tests, which read the same file: `node --test tests/station-dash.test.js tests/station-todo-files.test.js tests/station-hdl-a.test.js tests/station-docs-tour.test.js` — all pass.

- [ ] Step 5. Commit:

```
feat(station): #/p/<pkey>/todo[/<id>] opens the project on its TODO panel or one entry

- parseHash reads a trailing /todo[/<id>] as a focus; knownPkey matches a pkey across slash direction and case — assets/station/station.js
- each open TODO row carries id="todo-<id>"; the first draw that has it scrolls it into view, once — assets/station/station.js
- tests for the sub-route, knownPkey, the anchors and the scroll — tests/station-view.test.js, tests/station-todo-panel.test.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 2: Pane fold heads for route and tasks, Desktop and terminal

The route opens with a head row `▾ route 2/6`, the tasks block's title row becomes `▾ tasks 3/5`; both are `Button`s whose `onPress` flips a flag in the Pane's `state` closure and calls `$.ui.invalidate('ui.render')`. Folded (`▸ route 2/6 design`, `▸ tasks 3/5`) a block is its head row alone: no route rows or tasks rows in the terminal, no Svg on Desktop. The flags are memory only.

**Files:**
- Modify: `hooks/pane-status.ts` — `Fold`, `Seg.press: 'fold'`, `StatusInput.folded`, `head()`, the route head in `taskBlock`, the tasks head in `tasksBlock`
- Modify: `hooks/pane.ts` — `State.folded`, passed to `statusRows`; `piece` draws a fold segment as a `Button` that flips it
- Modify: `hooks/pane-svg.ts` — `paneParts` keeps the tasks head a row above the tasks Svg
- Test: `tests/pane-status.test.js`
- Test: `tests/pane.test.js`
- Test: `tests/pane-svg.test.js`

**Interfaces:**
- Consumes: none
- Produces: `export type Fold = 'route' | 'tasks'` (Task 3 widens it to `'route' | 'tasks' | 'todo'`); `Seg = { text; color?; bold?; press?: 'station' | 'fold'; fold?: Fold }`; `StatusInput.folded?: Partial<Record<Fold, boolean>>`; `const head = (fold: Fold, folded: boolean, text: string): Seg` in `hooks/pane-status.ts`; `State.folded: Partial<Record<Fold, boolean>>` in `hooks/pane.ts`; fold Buttons keyed `fold-<fold>`; test helper `stationButtons(tree)` in `tests/pane.test.js`.

**Dispatch:** implementer, sonnet — the plan carries the code and every changed assertion; transcription plus tests.

- [ ] Step 1. Write the failing tests and move the existing assertions to the new rows. In `tests/pane-status.test.js`, apply:

```diff
@@ -48,6 +48,6 @@
         assert.deepEqual(row.segs[0], first || row.block === 'clash' ? rail : { text: ' ' }, line(row));
     });
-    // The task 5 rows (the route wraps to two), the clash 2, notes 3, the foot 2: the session, then the station.
-    assert.equal(rows.filter((r) => r.segs.length).map((r) => r.segs[0].text).join(''), '▌    ▌▌▌  ▌ ');
+    // The task 6 rows (the route's head, then the route wrapped to two), the clash 2, notes 3, the foot 2: the session, then the station.
+    assert.equal(rows.filter((r) => r.segs.length).map((r) => r.segs[0].text).join(''), '▌     ▌▌▌  ▌ ');
     assert.deepEqual(m.RAILS, RAIL);
 });
@@ -103,8 +103,8 @@
     // A route that is empty, or has not the stage, draws no row; a narrow pane wraps between stations.
     const rowsOf = (over, cols) => text(status(m, { entry: Object.assign({}, entry, { next: '' }, over), cols }), 'task').length;
-    assert.equal(rowsOf({ route, stage: 'build' }, 41), 3);
+    assert.equal(rowsOf({ route, stage: 'build' }, 41), 4);
     assert.equal(rowsOf({ route: [], stage: 'build' }, 41), 2);
     assert.equal(rowsOf({ route, stage: 'plan' }, 41), 2);
-    assert.deepEqual(text(status(m, { entry: Object.assign({}, entry, { next: '', task: 't', route, stage: 'build' }), cols: 22 }), 'task'), ['▌t', ' survey › design', ' build › verify › land']);
+    assert.deepEqual(text(status(m, { entry: Object.assign({}, entry, { next: '', task: 't', route, stage: 'build' }), cols: 22 }), 'task'), ['▌t', ' ▾ route 3/5', ' survey › design', ' build › verify › land']);
 });
 
@@ -178,10 +178,10 @@
     const m = await load();
     const rows = (room) => status(m, { others: [other], room });
-    assert.equal(rows(60).length, 15);
-    assert.deepEqual(blocksOf(rows(15)), ['task', 'clash', 'notes', 'foot']);
-    assert.deepEqual(blocksOf(rows(14)), ['task', 'clash', 'foot']);
+    assert.equal(rows(60).length, 16);
+    assert.deepEqual(blocksOf(rows(16)), ['task', 'clash', 'notes', 'foot']);
+    assert.deepEqual(blocksOf(rows(15)), ['task', 'clash', 'foot']);
     assert.deepEqual(blocksOf(rows(-9)), ['task', 'clash', 'foot']);
-    assert.equal(rows(-9).length, 11);
-    for (const room of [15, 14, 11])assert.ok(rows(room).length <= room, room + ' < ' + rows(room).length);
+    assert.equal(rows(-9).length, 12);
+    for (const room of [16, 15, 12])assert.ok(rows(room).length <= room, room + ' < ' + rows(room).length);
 });
 
@@ -272,5 +272,5 @@
     const rows = status(m, { plan: planOf(5, [1, 2], [4]) });
     assert.deepEqual(body(rows, 'tasks'), [
-        [{ text: 'tasks', color: SECOND, bold: true }, { text: ' 2 of 5' }],
+        [{ text: '▾ tasks 2/5', color: SECOND, bold: true, press: 'fold', fold: 'tasks' }],
         [{ text: '●', color: '#87af5f' }, { text: ' 1 task 1', color: SECOND }],
         [{ text: '●', color: '#87af5f' }, { text: ' 2 task 2', color: SECOND }],
@@ -280,5 +280,5 @@
     ]);
     assert.equal(drawn(status(m, { plan: planOf(6, []) }), 'tasks').length, 7);
-    assert.deepEqual(text(status(m, { plan: planOf(3, [1, 9]) }), 'tasks')[0], '▌tasks 1 of 3');
+    assert.deepEqual(text(status(m, { plan: planOf(3, [1, 9]) }), 'tasks')[0], '▌▾ tasks 1/3');
     assert.deepEqual(blocksOf(status(m, { others: [other], plan: planOf(5, []) })), ['task', 'clash', 'tasks', 'notes', 'foot']);
     assert.deepEqual(text(status(m, { plan: null }), 'tasks'), []);
@@ -304,5 +304,5 @@
     const m = await load();
     assert.deepEqual(text(status(m, { entry: busy, plan: planOf(13, [1, 2, 3, 4], [13]) }), 'tasks'), [
-        '▌tasks 4 of 13',
+        '▌▾ tasks 4/13',
         ' ✓ 完成 4',
         ' ◉  5 task 5 · 出去 12 分',
@@ -311,13 +311,13 @@
         ' ○ 還有 6 個，1 個是你的',
     ]);
-    assert.deepEqual(body(status(m, { plan: planOf(13, [1, 2, 3, 4]) }), 'tasks').filter((segs) => /完成|還有/.test(segs[1].text)), [
+    assert.deepEqual(body(status(m, { plan: planOf(13, [1, 2, 3, 4]) }), 'tasks').slice(1).filter((segs) => /完成|還有/.test(segs[1].text)), [
         [{ text: '✓', color: '#87af5f' }, { text: ' 完成 4', color: SECOND }],
         [{ text: '○', color: '#767676' }, { text: ' 還有 6 個', color: SECOND }],
     ]);
-    assert.deepEqual(text(status(m, { plan: planOf(7, []) }), 'tasks'), ['▌tasks 0 of 7', ' ○ 1 task 1', ' ○ 2 task 2', ' ○ 3 task 3', ' ○ 還有 4 個']);
+    assert.deepEqual(text(status(m, { plan: planOf(7, []) }), 'tasks'), ['▌▾ tasks 0/7', ' ○ 1 task 1', ' ○ 2 task 2', ' ○ 3 task 3', ' ○ 還有 4 個']);
     // Complete out of order: the window is still the first three that are open.
-    assert.deepEqual(text(status(m, { plan: planOf(8, [1, 3, 8]) }), 'tasks'), ['▌tasks 3 of 8', ' ✓ 完成 3', ' ○ 2 task 2', ' ○ 4 task 4', ' ○ 5 task 5', ' ○ 還有 2 個']);
-    assert.deepEqual(text(status(m, { plan: planOf(9, [1, 2, 3, 4, 5, 6, 7, 8]) }), 'tasks'), ['▌tasks 8 of 9', ' ✓ 完成 8', ' ○ 9 task 9']);
-    assert.deepEqual(text(status(m, { plan: planOf(7, [1, 2, 3, 4, 5, 6, 7]) }), 'tasks'), ['▌tasks 7 of 7', ' ✓ 完成 7']);
+    assert.deepEqual(text(status(m, { plan: planOf(8, [1, 3, 8]) }), 'tasks'), ['▌▾ tasks 3/8', ' ✓ 完成 3', ' ○ 2 task 2', ' ○ 4 task 4', ' ○ 5 task 5', ' ○ 還有 2 個']);
+    assert.deepEqual(text(status(m, { plan: planOf(9, [1, 2, 3, 4, 5, 6, 7, 8]) }), 'tasks'), ['▌▾ tasks 8/9', ' ✓ 完成 8', ' ○ 9 task 9']);
+    assert.deepEqual(text(status(m, { plan: planOf(7, [1, 2, 3, 4, 5, 6, 7]) }), 'tasks'), ['▌▾ tasks 7/7', ' ✓ 完成 7']);
     // Three open is the window exactly; four open leaves one.
     assert.deepEqual(text(status(m, { plan: planOf(7, [1, 2, 3, 4]) }), 'tasks').slice(2), [' ○ 5 task 5', ' ○ 6 task 6', ' ○ 7 task 7']);
@@ -331,5 +331,5 @@
         const rows = drawn(status(m, { entry: busy, plan: planOf(30, Array.from({ length: done }, (_, i) => i + 1), [29, 30]) }), 'tasks');
         assert.ok(rows.length <= 7, done + ' done: ' + rows.length + ' rows');
-        assert.equal(line(rows[0]), '▌tasks ' + done + ' of 30');
+        assert.equal(line(rows[0]), '▌▾ tasks ' + done + '/30');
     }
 });
@@ -382,5 +382,5 @@
     for (const row of drawn(rows, 'clash')) assert.deepEqual(row.segs[0], { text: '▌', color: '#ff5f5f' }, line(row));
     // A tasks block cut to its title row, and the task block's first row, are still first rows.
-    assert.deepEqual(text(whole({ room: -9 }), 'tasks'), ['▌tasks 2 of 13']);
+    assert.deepEqual(text(whole({ room: -9 }), 'tasks'), ['▌▾ tasks 2/13']);
     for (const cols of [20, 30, 41, 88]) {
         for (const room of [60, 20, -9]) {
@@ -400,13 +400,13 @@
     const rows = (room) => status(m, { others: [other], plan: planOf(5, [1, 2]), room });
     const all = ['task', 'clash', 'tasks', 'notes', 'foot'];
-    // 22 rows: the task 5, the clash 2, tasks 6, notes 3, the foot 2, and four blank rows between.
-    assert.equal(rows(60).length, 22);
-    assert.deepEqual(blocksOf(rows(22)), all);
-    assert.deepEqual(blocksOf(rows(21)), ['task', 'clash', 'tasks', 'foot']);
-    assert.equal(drawn(rows(18), 'tasks').length, 6);
-    assert.deepEqual(text(rows(17), 'tasks'), ['▌tasks 2 of 5']);
+    // 23 rows: the task 6, the clash 2, tasks 6, notes 3, the foot 2, and four blank rows between.
+    assert.equal(rows(60).length, 23);
+    assert.deepEqual(blocksOf(rows(23)), all);
+    assert.deepEqual(blocksOf(rows(22)), ['task', 'clash', 'tasks', 'foot']);
+    assert.equal(drawn(rows(19), 'tasks').length, 6);
+    assert.deepEqual(text(rows(18), 'tasks'), ['▌▾ tasks 2/5']);
     assert.deepEqual(blocksOf(rows(-9)), ['task', 'clash', 'tasks', 'foot']);
-    assert.equal(rows(-9).length, 13);
-    for (const room of [22, 21, 18, 17, 13]) assert.ok(rows(room).length <= room, room + ' < ' + rows(room).length);
+    assert.equal(rows(-9).length, 14);
+    for (const room of [23, 22, 19, 18, 14]) assert.ok(rows(room).length <= room, room + ' < ' + rows(room).length);
 });
 
@@ -468,2 +468,20 @@
     assert.deepEqual(empty[empty.length - 1], { block: 'empty', segs: on });
 });
+
+test('route and tasks open under a ▾ head and fold to it under ▸, the route head naming the stage', async () => {
+    const m = await load();
+    const plan = planOf(5, [1, 2], [4]);
+    const heads = (rows) => rows.flatMap((r) => r.segs.filter((s) => s.press === 'fold')).map((s) => [s.fold, s.text]);
+    const open = status(m, { plan });
+    assert.deepEqual(heads(open), [['route', '▾ route 2/7'], ['tasks', '▾ tasks 2/5']]);
+    assert.deepEqual(open.flatMap((r) => r.segs).find((s) => s.fold === 'route'), { text: '▾ route 2/7', color: SECOND, bold: true, press: 'fold', fold: 'route' });
+    const folded = status(m, { plan, folded: { route: true, tasks: true } });
+    assert.deepEqual(heads(folded), [['route', '▸ route 2/7 design'], ['tasks', '▸ tasks 2/5']]);
+    // Folded, each block is its head row: the two route rows and the task rows go, the title and next: stay.
+    assert.deepEqual(text(folded, 'tasks'), ['▌▸ tasks 2/5']);
+    assert.equal(drawn(folded, 'task').length, drawn(open, 'task').length - 2);
+    assert.ok(!text(folded, 'task').some((t) => t.includes(' › ')));
+    assert.deepEqual(heads(status(m, { plan, folded: { tasks: true } })), [['route', '▾ route 2/7'], ['tasks', '▸ tasks 2/5']]);
+    // A stage that is not on the route draws no route and no head.
+    assert.deepEqual(heads(status(m, { entry: Object.assign({}, entry, { stage: 'nowhere' }) })), []);
+});
```

In `tests/pane.test.js`, apply:

```diff
@@ -77,5 +77,7 @@
 }
 const entryFile = (data) => ({ [ROOT + '/.fankeel/sessions/' + ID + '.json']: JSON.stringify(data) });
-const texts = (node) => (node.tag === 'Text' || node.tag === 'Button' ? [String(node.children.join(''))] : node.children.flatMap(texts));
+const texts = (node) => (node.tag === 'Text' ? [String(node.children.join(''))] : node.tag === 'Button' ? [String(node.props.label)] : node.children.flatMap(texts));
+// The station's Button, apart from the fold heads.
+const stationButtons = (tree) => buttons(tree).filter((b) => b.props.key === 'station');
 const buttons = (node) => (node.tag === 'Button' ? [node] : (node.children || []).filter((c) => c && c.tag).flatMap(buttons));
 const leaves = (node) => (node.tag === 'Text' ? [node] : (node.children || []).filter((c) => c && c.tag).flatMap(leaves));
@@ -125,4 +127,5 @@
     assert.deepEqual(paneLines(tree), [
         '▌demo task',
+        ' ▾ route 2/3',
         ' survey › design › build',
         ' ',
@@ -134,5 +137,5 @@
     ]);
     assert.doesNotMatch(paneLines(tree).join('\n'), /touched|▸|本站|2 of 3|bounded|400k|450k/);
-    assert.equal(buttons(tree).length, 0);
+    assert.deepEqual(buttons(tree).map((b) => b.props.label), ['▾ route 2/3']);
 });
 
@@ -318,5 +321,5 @@
     assert.deepEqual(log.toasts, []);
     const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
-    assert.equal(buttons(tree).length, 0);
+    assert.deepEqual(buttons(tree).map((b) => b.props.key), ['fold-route']);
     assert.doesNotMatch(paneLines(tree).join('\n'), /gate|Go on|Stay/);
     assert.match(bandLines(await hooks.band($, BAND, passed))[0], /gate 在等 {3}還 \d+ 秒/);
@@ -510,5 +513,5 @@
     for (let i = 0; i < 3; i++) await torn.log.ticks[0].fn();
     assert.deepEqual(torn.log.logs.filter((m) => /pending file/.test(m)), ['fankeel pane: pending file does not parse, ' + PENDING], JSON.stringify(torn.log.logs));
-    assert.equal(buttons(await hooks['ui.render'](torn.$, { viewport: { columns: 44, rows: 40 } })).length, 0);
+    assert.deepEqual(buttons(await hooks['ui.render'](torn.$, { viewport: { columns: 44, rows: 40 } })).map((b) => b.props.key), ['fold-route']);
 
     const hooks2 = await wired();
@@ -530,8 +533,8 @@
     const { $, log, store } = fake({ files });
     const draw = async () => paneLines(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } }));
-    const tasks = (seen) => seen.slice(seen.indexOf(seen.find((t) => t.startsWith('▌tasks '))), seen.findIndex((t) => t.startsWith('▌abcdef12')) - 1);
+    const tasks = (seen) => seen.slice(seen.indexOf(seen.find((t) => t.startsWith('▌▾ tasks '))), seen.findIndex((t) => t.startsWith('▌abcdef12')) - 1);
     await hooks['session.start']($, {}, async () => ({}));
     await log.ticks[0].fn();
-    assert.deepEqual(tasks(await draw()), ['▌tasks 1 of 2', ' ● 1 one', ' ◐ 2 two · 你的']);
+    assert.deepEqual(tasks(await draw()), ['▌▾ tasks 1/2', ' ● 1 one', ' ◐ 2 two · 你的']);
     assert.match(bandLines(await hooks.band($, BAND, passed))[0], / {2}tasks 1\/2 {2}/);
     const after = log.invalidated;
@@ -539,5 +542,5 @@
     await log.ticks[0].fn();
     assert.equal(log.invalidated, after + 1);
-    assert.deepEqual(tasks(await draw()), ['▌tasks 2 of 2', ' ● 1 one', ' ● 2 two']);
+    assert.deepEqual(tasks(await draw()), ['▌▾ tasks 2/2', ' ● 1 one', ' ● 2 two']);
     assert.match(bandLines(await hooks.band($, BAND, passed))[0], / {2}tasks 2\/2 {2}/);
     assert.equal(log.reads.filter((p) => p === ROOT + '/' + PLAN).length, 1, 'the plan file was read again though it had not changed');
@@ -599,6 +602,6 @@
     const foot = leaves(tree).find((n) => n.children.join('').startsWith('abcdef12'));
     assert.equal(foot.props.color, '#8a8a8a');
-    // 15 rows in all: the task 4, the clash 4, notes 2, the foot 2 (its station row last), and three blank rows between.
-    assert.equal(tree.children.length, 15);
+    // 16 rows in all: the task 5 (the route's head among them), the clash 4, notes 2, the foot 2 (its station row last), and three blank rows between.
+    assert.equal(tree.children.length, 16);
     assert.deepEqual(heads(await at(14)), [], 'the room is the body rows the surface gave, not the viewport');
 });
@@ -1116,5 +1119,5 @@
     await log.ticks[0].fn();
     const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
-    const found = buttons(tree);
+    const found = stationButtons(tree);
     assert.equal(found.length, 1);
     assert.equal(found[0].props.label, '開啟 station');
@@ -1159,5 +1162,5 @@
     await log.ticks[0].fn();
     const draw = async () => hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
-    await buttons(await draw())[0].props.onPress({ surface: 'terminal' });
+    await stationButtons(await draw())[0].props.onPress({ surface: 'terminal' });
     assert.deepEqual(ran, [['open', url], ['xdg-open', url]]);
     // The url is in the redraw key: a station that goes away redraws on the next tick.
@@ -1167,5 +1170,5 @@
     assert.equal(log.invalidated, after + 1);
     const tree = await draw();
-    assert.equal(buttons(tree).length, 0);
+    assert.equal(stationButtons(tree).length, 0);
     assert.ok(paneLines(tree).includes(' station 未啟動'));
 });
@@ -1263,2 +1266,50 @@
     assert.equal(projects(), 2);
 });
+
+test('a fold head\'s onPress folds its block to that one row and opens it again, in the terminal and on Claude Desktop', async () => {
+    const hooks = await wired();
+    const PLAN = 'docs/plans/2026-10-17-demo.md';
+    const files = Object.assign(entryFile(Object.assign({}, live, { claims: ['a.js', PLAN] })), {
+        [ROOT + '/' + PLAN]: ['# Demo', '', '## Task 1: one', '', '**Dispatch:** implementer, sonnet — code.', '', '## Task 2: two', '', '**Dispatch:** implementer, sonnet — code.', '', '## Coverage', ''].join('\n'),
+        [ROOT + '/.fankeel/build/2026-10-17-demo/progress.md']: '# fankeel build ledger — plan: ' + PLAN + '\nTask 1: complete — one\n',
+    });
+    const { $, log } = fake({ files });
+    await hooks['session.start']($, {}, async () => ({}));
+    await log.ticks[0].fn();
+    const draw = async (surface) => hooks['ui.render']($, { surface, viewport: { columns: 44, rows: 40 } });
+    const press = async (fold) => buttons(await draw()).find((b) => b.props.key === 'fold-' + fold).props.onPress({ surface: 'terminal' });
+    const open = ['▌demo task', ' ▾ route 2/3', ' survey › design › build', ' ', '▌▾ tasks 1/2', ' ● 1 one', ' ○ 2 two', ' ', '▌abcdef12 · /fankeel-panel 關閉', ' station 未啟動'];
+    assert.deepEqual(paneLines(await draw()), open);
+    const before = log.invalidated;
+    await press('tasks');
+    assert.equal(log.invalidated, before + 1);
+    assert.deepEqual(paneLines(await draw()), ['▌demo task', ' ▾ route 2/3', ' survey › design › build', ' ', '▌▸ tasks 1/2', ' ', '▌abcdef12 · /fankeel-panel 關閉', ' station 未啟動']);
+    await press('route');
+    assert.equal(log.invalidated, before + 2);
+    assert.deepEqual(paneLines(await draw()), ['▌demo task', ' ▸ route 2/3 design', ' ', '▌▸ tasks 1/2', ' ', '▌abcdef12 · /fankeel-panel 關閉', ' station 未啟動']);
+    // Claude Desktop: folded, a block draws no Svg, and its head is the same Button.
+    $.ui.resolve = () => ({ Box: 'Box', Text: 'Text', Button: 'Button', Svg: 'Svg' });
+    const svgs = async () => (await draw('desktop')).children.filter((n) => n.tag === 'Svg').length;
+    assert.equal(await svgs(), 0);
+    assert.deepEqual(buttons(await draw('desktop')).map((b) => b.props.label), ['▸ route 2/3 design', '▸ tasks 1/2']);
+    await press('route');
+    await press('tasks');
+    assert.equal(await svgs(), 2);
+    assert.deepEqual(buttons(await draw('desktop')).map((b) => b.props.label), ['▾ route 2/3', '▾ tasks 1/2']);
+    $.ui.resolve = () => ({ Box: 'Box', Text: 'Text', Button: 'Button' });
+    assert.deepEqual(paneLines(await draw()), open);
+});
+
+test('the fold flags live in the module\'s memory: a fresh register starts with every block open', async () => {
+    const first = await wired();
+    const { $, log } = fake({ files: entryFile(live) });
+    await first['session.start']($, {}, async () => ({}));
+    await log.ticks[0].fn();
+    const draw = async (hooks) => hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
+    await buttons(await draw(first)).find((b) => b.props.key === 'fold-route').props.onPress({ surface: 'terminal' });
+    assert.deepEqual(buttons(await draw(first)).map((b) => b.props.label), ['▸ route 2/3 design']);
+    const second = await wired();
+    await second['session.start']($, {}, async () => ({}));
+    await log.ticks[1].fn();
+    assert.deepEqual(buttons(await draw(second)).map((b) => b.props.label), ['▾ route 2/3']);
+});
```

In `tests/pane-svg.test.js`, apply:

```diff
@@ -296,5 +296,7 @@
 }
 const kids = (tree) => tree.children.filter((c) => c && c.tag);
-const textOf = (node) => (node.tag === 'Text' ? String(node.children.join('')) : (node.children || []).filter((c) => c && c.tag).map(textOf).join(''));
+const textOf = (node) => (node.tag === 'Text' ? String(node.children.join('')) : node.tag === 'Button' ? String(node.props.label) : (node.children || []).filter((c) => c && c.tag).map(textOf).join(''));
+// A drawing without its onPress handlers: each render makes new ones, so two renders compare by what they draw.
+const bare = (tree) => JSON.parse(JSON.stringify(tree));
 // The terminal's rows, without the cell each one opens with.
 const plain = (tree) => kids(tree).map(textOf).map((t) => t.slice(1));
@@ -327,6 +329,8 @@
     const block = (from, to) => rows.slice(rows.findIndex((t) => t.startsWith(from)), to === undefined ? undefined : rows.findIndex((t) => t.startsWith(to)) - 1).join('\n');
     assert.equal(svgs[0].props.alt, 'survey › design › plan › build › verify\nland');
-    assert.equal(svgs[1].props.alt, block('⚑ hooks/pane.ts', 'tasks '));
-    assert.equal(svgs[2].props.alt, block('tasks 4 of 9', 'notes'));
+    assert.equal(svgs[1].props.alt, block('⚑ hooks/pane.ts', '▾ tasks '));
+    // The tasks head is a Button row above the drawing; the drawing stands for the rows under it.
+    assert.equal(svgs[2].props.alt, block('✓ 完成 4', 'notes'));
+    assert.ok(rows.includes('▾ tasks 4/9'));
     // 400k of 450k is past four fifths of the threshold; the band alone says so.
     assert.ok(!rows.some((t) => t.startsWith('context')));
@@ -349,5 +353,5 @@
     for (const surface of ['terminal', 'vscode', 'mobile']) {
         assert.deepEqual(await band(surface), await band(undefined), surface);
-        assert.deepEqual(await pane(surface), await pane(undefined), surface);
+        assert.deepEqual(bare(await pane(surface)), bare(await pane(undefined)), surface);
     }
     const tags = (node) => [node.tag, ...(node.children || []).filter((c) => c && c.tag).flatMap(tags)];
@@ -435,6 +439,6 @@
 test('a Pane drawing that throws on Claude Desktop falls back to the terminal rows, and logs once to debug', async () => {
     const { pane, logs } = await drawn({ svgThrows: true });
-    assert.deepEqual(await pane('desktop'), await pane('terminal'));
-    assert.deepEqual(await pane('desktop'), await pane('terminal'));
+    assert.deepEqual(bare(await pane('desktop')), bare(await pane('terminal')));
+    assert.deepEqual(bare(await pane('desktop')), bare(await pane('terminal')));
     const said = logs.filter(([t]) => /Pane Svg not drawn/.test(t));
     assert.equal(said.length, 1);
```

- [ ] Step 2. Run them and watch them fail:

```
node --test tests/pane-status.test.js tests/pane.test.js tests/pane-svg.test.js
```

Expected red, and only these: in `tests/pane-status.test.js` the frame test, the route test, the two drop-order tests, the three tasks-window tests, the rail test and the new fold test; in `tests/pane.test.js` the first Pane test, the gate test, the torn pending file test, the plan test, the layout test, the two station-button tests, and the two new fold tests; in `tests/pane-svg.test.js` the Desktop Pane test. The two `bare()` comparisons pass before the code.

- [ ] Step 3. Write the implementation. In `hooks/pane-status.ts`, apply:

```diff
@@ -16,6 +16,9 @@
 // `color` is a hex, or absent for the terminal's own. The segments of a row
 // touch: one that wants a space before it carries the space in its text.
-// `press` makes the segment a Button on the Pane (hooks/pane.ts piece): 'station' opens the station's page.
-export type Seg = { text: string; color?: string; bold?: boolean; press?: 'station' }
+// `press` makes the segment a Button on the Pane (hooks/pane.ts piece): 'station' opens the station's page,
+// 'fold' folds or opens the block `fold` names.
+export type Seg = { text: string; color?: string; bold?: boolean; press?: 'station' | 'fold'; fold?: Fold }
+// The blocks a head row folds; docs/90-agent/plans/2026-10-17-pane-fold-todo-design.md section 1.
+export type Fold = 'route' | 'tasks'
 // One drawn row. No segments is the blank row above a block. `who` is the
 // neighbour a clash row names: hooks/pane.ts counts them against the band's flag.
@@ -40,4 +43,6 @@
   // The station's url, from <configDir>/fankeel/serve.json (hooks/pane.ts stationOf); absent or null when none is up.
   station?: string | null
+  // The blocks folded to their head row (hooks/pane.ts state); absent is every block open.
+  folded?: Partial<Record<Fold, boolean>>
 }
 
@@ -61,4 +66,6 @@
 // Labels and secondary text.
 const dim = (text: string): Seg => ({ text, color: WHERE })
+// A fold head: ▾ while the block under it is open, ▸ while it is folded, drawn as a Button.
+const head = (fold: Fold, folded: boolean, text: string): Seg => ({ text: `${folded ? '▸' : '▾'} ${text}`, color: WHERE, bold: true, press: 'fold', fold })
 
 // The tail of `s` that fits: a path is told apart by its end.
@@ -156,5 +163,5 @@
 
 // `inner` is the cells a row has after its rail.
-function taskBlock(entry: Entry, inner: number): Row[] {
+function taskBlock(entry: Entry, inner: number, folded: boolean): Row[] {
   const rows = wrap(str(entry.task) || '—', inner).map((text) => row('task', { text, bold: true }))
   const next = str(entry.next)
@@ -166,5 +173,7 @@
   const route = list(entry.route)
   const at = route.indexOf(str(entry.stage))
-  if (at >= 0) {
+  // The route opens with its head row, `▾ route 2/6`; folded, the head alone, with the stage after it.
+  if (at >= 0) rows.push(row('task', head('route', folded, `route ${at + 1}/${route.length}${folded ? ` ${route[at]}` : ''}`)))
+  if (at >= 0 && !folded) {
     let cur: Seg[] = []
     let used = 0
@@ -230,5 +239,5 @@
 // dispatch group holds, so the agent is drawn on the first open task that is
 // not the user's. With no ledger, a mark on this stage is one row of its own.
-function tasksBlock(entry: Entry, plan: PlanInfo | null, inner: number, now: number): Row[] {
+function tasksBlock(entry: Entry, plan: PlanInfo | null, inner: number, now: number, folded: boolean): Row[] {
   const stage = str(entry.stage)
   const marks = Array.isArray(entry.inflight) ? entry.inflight : [entry.inflight]
@@ -262,7 +271,8 @@
     return row('tasks', { text: '○', color: TODO }, { text: name('') })
   }
-  const head = row('tasks', title('tasks', 'tasks'), { text: ` ${count} of ${plan.tasks.length}` })
-  if (plan.tasks.length <= WHOLE) return [head, ...plan.tasks.map(one)]
-  const rows = [head]
+  const top = row('tasks', head('tasks', folded, `tasks ${count}/${plan.tasks.length}`))
+  if (folded) return [top]
+  if (plan.tasks.length <= WHOLE) return [top, ...plan.tasks.map(one)]
+  const rows = [top]
   if (count) rows.push(row('tasks', { text: '✓', color: DONE }, dim(` 完成 ${count}`)))
   rows.push(...open.slice(0, 3).map(one))
@@ -350,8 +360,9 @@
   // 1: the cell every drawn row opens with, its block's rail or the space under it.
   const inner = Math.max(4, cols - 1)
-  const blocks: Row[][] = [taskBlock(entry, inner)]
+  const folded = input.folded ?? {}
+  const blocks: Row[][] = [taskBlock(entry, inner, !!folded.route)]
   const clash = clashBlock(entry, others, inner, now)
   if (clash.length) blocks.push(clash)
-  const tasks = tasksBlock(entry, input.plan, inner, now)
+  const tasks = tasksBlock(entry, input.plan, inner, now, !!folded.tasks)
   if (tasks.length) blocks.push(tasks)
   const agents = agentsBlock(input.agents ?? [], inner, now)
```

In `hooks/pane.ts`, apply:

```diff
@@ -2,5 +2,5 @@
 import { parentOf, isActive, SESSION_ID, thresholdWith } from './compact.ts'
 import { statusRows, ledgerDoneIds, planTasks } from './pane-status.ts'
-import type { Entry, Other, PlanInfo, PlanTask, Seg as StatusSeg, Row as StatusRow, StatusInput } from './pane-status.ts'
+import type { Entry, Other, PlanInfo, PlanTask, Seg as StatusSeg, Row as StatusRow, StatusInput, Fold } from './pane-status.ts'
 import type { Context, Limit } from './pane-bar.ts'
 import { taskDir, pendingName, parsePending } from './pane-gate.ts'
@@ -442,4 +442,6 @@
   cache: Cache
   logged: Logged
+  // The blocks folded to their head row: memory only, so a new session starts with every block open.
+  folded: Partial<Record<Fold, boolean>>
 }
 
@@ -508,4 +510,5 @@
     seen: blank(''), print: '', mine: false, edge: { task: false }, bad: 0, busy: false, cache: new Map(),
     logged: { context: '', plan: '', open: '', registry: '', neighbour: '', gate: '', live: '', remote: '', bandSvg: '', paneSvg: '', agents: '', station: '' },
+    folded: {},
   }
 
@@ -594,4 +597,5 @@
       agents: seen.agents,
       station: seen.station,
+      folded: state.folded,
     }
     const status = statusRows(input)
@@ -601,4 +605,11 @@
       const url = seen.station
       if (seg.press === 'station' && url) return h(Button, { key: 'station', label: seg.text, hotkey: 's', onPress: (press: UiPressArgument) => openStation($, url, press.surface) })
+      const fold = seg.fold
+      if (seg.press === 'fold' && fold) {
+        return h(Button, { key: `fold-${fold}`, label: seg.text, onPress: () => {
+          state.folded[fold] = !state.folded[fold]
+          $.ui.invalidate('ui.render')
+        } })
+      }
       return h(Text, { color: seg.color, bold: seg.bold, wrap: 'truncate-end' }, seg.text)
     }
```

In `hooks/pane-svg.ts`, apply:

```diff
@@ -444,5 +444,5 @@
 // title, `next:`, notes and the foot stay rows; the route rows, the clash
 // and the tasks become one Svg each, whose alt is those rows'
-// text. A block statusRows cut to its title (the tasks, when the Pane is short),
+// text. A block statusRows cut to its head row (the tasks, when the Pane is short or folded),
 // a drawing with nothing in it, or one over SVG_MAX stays rows.
 export function paneParts(input: StatusInput, rows: Row[]): Part[] {
@@ -481,6 +481,9 @@
       draw(routeSvg(entry, now, cols), body.slice(from), false)
     } else if (name === 'clash') draw(clashSvg(entry, input.others, now, cols), body, false)
-    else if (name === 'tasks' && plan && plan.tasks.length && body.length > 1) draw(tasksSvg(entry, plan, now, cols), body, true)
-    else keep(body)
+    else if (name === 'tasks' && plan && plan.tasks.length && body.length > 1) {
+      // The head row stays a row, the Button that folds the drawing under it.
+      keep(body.slice(0, 1))
+      draw(tasksSvg(entry, plan, now, cols), body.slice(1), true)
+    } else keep(body)
   }
   return parts
```

- [ ] Step 4. Run Step 2's command again: all pass. Then the two other files that load these modules: `node --test tests/band-0108.test.js tests/inject-live.test.js tests/pane-band.test.js tests/pane-bar.test.js` — all pass.

- [ ] Step 5. Commit:

```
feat(pane): route and tasks fold under a head Button, in the terminal and on Desktop

- fold heads ▾/▸ route i/n and tasks done/total, a folded block its head row alone — hooks/pane-status.ts
- the fold flags in the register closure's state, flipped by the head Button's onPress — hooks/pane.ts
- the tasks head stays a row above its Svg — hooks/pane-svg.ts
- the row counts, labels and Button counts the heads move, and the fold tests — tests/pane-status.test.js, tests/pane.test.js, tests/pane-svg.test.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 3: Pane TODO block: the project's open entries, six titles, 還有 N 條, each a station Button

While a station is up, the foot gains a `todo` block: a fold head `▾ TODO 30` counting the project's open entries, then up to six titles (Ready first, then Needs a decision, Blocked, Watch, then by id), each a `Button` opening `<station url>#/p/<pkey>/todo/<id>`, and past six a grey `還有 N 條` Button opening `#/p/<pkey>/todo`. The entries come from the `todo` bucket in `<pkey>/.fankeel/docs.json`, read with `$.fs`; `pkey` is `root + '/' + project`, or `root`.

**Files:**
- Modify: `hooks/pane-status.ts` — `Fold` gains `'todo'`, `Seg.press: 'todo'` and `to`, `TodoEntry`, `StatusInput.todos`/`pkey`, `RAILS.todo`, `todoBlock`, `DROP` starts with `todo`
- Modify: `hooks/pane.ts` — `Seen.pkey`/`todos`, `TODO_ORDER`, `field`, `todosOf`, `look()` reads them while a station is up, the redraw key, `piece` draws a `todo` segment as a station Button
- Read: `lib/todo.js` — `STATES`, `bucketPath`, `readFolder`, `load` (the rule `todosOf` copies, and the count the last test pins)
- Read: `lib/station.js` — `pkeyOf` at `:650`, `todoOf`'s open filter at `:390`
- Test: `tests/pane-status.test.js`
- Test: `tests/pane.test.js`

**Interfaces:**
- Consumes: Task 1's `parseHash` sub-routes `#/p/<encodeURIComponent(pkey)>/todo[/<encodeURIComponent(id)>]`; Task 2's `Fold`, `head()`, `StatusInput.folded`, `State.folded`, `stationButtons`.
- Produces: `export type Fold = 'route' | 'tasks' | 'todo'`; `export type TodoEntry = { id: string; title: string; state: string }`; `Seg.press: 'station' | 'fold' | 'todo'`, `Seg.to?: string`; `StatusInput.todos?: TodoEntry[]`, `StatusInput.pkey?: string`; `async function todosOf($: EngineInterface, dir: string, cache: Cache, logged: Logged): Promise<TodoEntry[]>`; TODO Buttons keyed by their hash.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] Step 1. Write the failing tests. In `tests/pane-status.test.js`, apply:

```diff
@@ -28,5 +28,5 @@
 const apart = { id: 'bbbbbbbb-0000-4000-8000-000000000002', entry: { task: 'x', stage: 'plan', active: true, claims: ['lib/x.js'] } };
 const SECOND = '#8a8a8a';
-const RAIL = { clash: '#ff5f5f', tasks: SECOND, agents: SECOND, notes: SECOND, foot: '#585858' };
+const RAIL = { clash: '#ff5f5f', tasks: SECOND, agents: SECOND, notes: SECOND, todo: SECOND, foot: '#585858' };
 // A row as the Pane shows it: its segments touch.
 const line = (row) => row.segs.map((seg) => seg.text).join('');
@@ -486,2 +486,35 @@
     assert.deepEqual(heads(status(m, { entry: Object.assign({}, entry, { stage: 'nowhere' }) })), []);
 });
+
+test('the TODO block is a fold head counting the open entries, then at most six titles and a grey 還有 N 條, each a Button with its station hash', async () => {
+    const m = await load();
+    const url = 'http://127.0.0.1:28888/';
+    const pkey = 'F:/ws/app';
+    const todos = Array.from({ length: 8 }, (_, i) => ({ id: 'a-' + (i + 1), title: 'entry ' + (i + 1), state: 'ready' }));
+    const rows = status(m, { station: url, todos, pkey });
+    assert.deepEqual(blocksOf(rows), ['task', 'notes', 'todo', 'foot']);
+    const segs = body(rows, 'todo').map((s) => s[0]);
+    assert.deepEqual(segs[0], { text: '▾ TODO 8', color: SECOND, bold: true, press: 'fold', fold: 'todo' });
+    assert.deepEqual(segs.slice(1, 7).map((s) => [s.text, s.press, s.to]), todos.slice(0, 6).map((t) => [t.title, 'todo', '#/p/F%3A%2Fws%2Fapp/todo/' + t.id]));
+    assert.deepEqual(segs[7], { text: '還有 2 條', color: SECOND, press: 'todo', to: '#/p/F%3A%2Fws%2Fapp/todo' });
+    assert.equal(segs.length, 8);
+    // Six or fewer: no 還有 row. Folded: the head alone. No station, or no entries: no block.
+    assert.equal(drawn(status(m, { station: url, todos: todos.slice(0, 6), pkey }), 'todo').length, 7);
+    assert.deepEqual(text(status(m, { station: url, todos, pkey, folded: { todo: true } }), 'todo'), ['▌▸ TODO 8']);
+    assert.deepEqual(drawn(status(m, { station: null, todos, pkey }), 'todo'), []);
+    assert.deepEqual(drawn(status(m, { station: url, todos: [], pkey }), 'todo'), []);
+    // A long title is cut four cells short of the row: the terminal draws a Button as `[ label ]`.
+    const long = status(m, { station: url, todos: [{ id: 'l-1', title: '一個很長很長的 TODO 標題，'.repeat(4), state: 'ready' }], pkey, cols: 41 });
+    assert.ok(m.width(body(long, 'todo')[1][0].text) <= 40 - 4);
+});
+
+test('with no room the TODO list goes first, down to its head row', async () => {
+    const m = await load();
+    const todos = Array.from({ length: 3 }, (_, i) => ({ id: 'a-' + i, title: 'entry ' + i, state: 'ready' }));
+    const rows = (room) => status(m, { station: 'http://127.0.0.1:28888/', todos, pkey: 'F:/ws', room });
+    const full = rows(60).length;
+    assert.equal(drawn(rows(full), 'todo').length, 4);
+    assert.deepEqual(text(rows(full - 1), 'todo'), ['▌▾ TODO 3']);
+    assert.deepEqual(blocksOf(rows(full - 1)), ['task', 'notes', 'todo', 'foot']);
+    assert.deepEqual(blocksOf(rows(-9)), ['task', 'todo', 'foot']);
+});
```

In `tests/pane.test.js`, apply:

```diff
@@ -1314,2 +1314,91 @@
     assert.deepEqual(buttons(await draw(second)).map((b) => b.props.label), ['▾ route 2/3']);
 });
+
+// A project's docs.json with its todo bucket, and one entry file a TODO.
+const STATION = 'http://127.0.0.1:28888/';
+const todoFiles = (dir, entries) => Object.assign({
+    [dir + '/.fankeel/docs.json']: JSON.stringify({ buckets: [{ path: 'docs/notes', role: 'reference' }, { path: 'docs/todo', role: 'todo' }] }),
+}, ...entries.map(([id, state, title]) => ({ [dir + '/docs/todo/' + id + '.md']: '---\nlabel: x\n' + (title === undefined ? '' : 'title: ' + title + '\n') + 'state: ' + state + '\n---\n\nbody\n' })));
+function todoRig(entries, over) {
+    const cfg = 'C:/cfg';
+    const mine = Object.assign({}, live, { configDir: cfg }, over);
+    const dir = mine.project ? ROOT + '/' + mine.project : ROOT;
+    const files = Object.assign(entryFile(mine), { [cfg + '/fankeel/serve.json']: JSON.stringify({ pid: 1, port: 28888, url: STATION, started: 1 }) }, todoFiles(dir, entries));
+    return fake({ files, env: { OS: 'Windows_NT' } });
+}
+
+test('the TODO block lists six open titles, Ready first, and a 還有 N 條; a title opens the station on its entry and the rest on the panel', async () => {
+    const hooks = await wired();
+    const entries = [['w-1', 'watch', 'watch one'], ['b-1', 'blocked', 'blocked one'], ['r-2', 'ready', 'ready two'], ['r-1', 'ready', 'ready one'],
+        ['d-1', 'decision', 'decide one'], ['x-1', 'done', 'finished'], ['r-3', 'ready', undefined], ['b-2', 'blocked', 'blocked two'], ['w-2', 'watch', 'watch two']];
+    const { $, log } = todoRig(entries);
+    const ran = [];
+    $.process = { run: async (argv) => { ran.push(argv); return { exitCode: 0, stdout: '', stderr: '' }; } };
+    await hooks['session.start']($, {}, async () => ({}));
+    await log.ticks[0].fn();
+    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 60 } });
+    const labels = buttons(tree).map((b) => b.props.label);
+    // Eight open: the done one is not counted; an entry with no title shows its id.
+    assert.deepEqual(labels.slice(labels.indexOf('▾ TODO 8')), ['▾ TODO 8', 'ready one', 'ready two', 'r-3', 'decide one', 'blocked one', 'blocked two', '還有 2 條', '開啟 station']);
+    const key = encodeURIComponent(ROOT);
+    await buttons(tree).find((b) => b.props.label === 'ready two').props.onPress({ surface: 'terminal' });
+    await buttons(tree).find((b) => b.props.label === '還有 2 條').props.onPress({ surface: 'terminal' });
+    assert.deepEqual(ran, [['cmd', '/c', 'start', '', STATION + '#/p/' + key + '/todo/r-2'], ['cmd', '/c', 'start', '', STATION + '#/p/' + key + '/todo']]);
+    // The fold head folds the list to itself.
+    await buttons(tree).find((b) => b.props.key === 'fold-todo').props.onPress({ surface: 'terminal' });
+    const folded = buttons(await hooks['ui.render']($, { viewport: { columns: 44, rows: 60 } })).map((b) => b.props.label);
+    assert.deepEqual(folded.slice(folded.indexOf('▸ TODO 8')), ['▸ TODO 8', '開啟 station']);
+});
+
+test('the TODO entries are the entry\'s project\'s, keyed root/project, and with no station there is no TODO block', async () => {
+    const hooks = await wired();
+    const { $, log, store } = todoRig([['r-1', 'ready', 'in the app']], { project: 'app' });
+    const ran = [];
+    $.process = { run: async (argv) => { ran.push(argv); return { exitCode: 0, stdout: '', stderr: '' }; } };
+    await hooks['session.start']($, {}, async () => ({}));
+    await log.ticks[0].fn();
+    const draw = async () => buttons(await hooks['ui.render']($, { viewport: { columns: 44, rows: 60 } }));
+    await (await draw()).find((b) => b.props.label === 'in the app').props.onPress({ surface: 'terminal' });
+    assert.deepEqual(ran, [['cmd', '/c', 'start', '', STATION + '#/p/' + encodeURIComponent(ROOT + '/app') + '/todo/r-1']]);
+    delete store['C:/cfg/fankeel/serve.json'];
+    await log.ticks[0].fn();
+    assert.deepEqual((await draw()).map((b) => b.props.key), ['fold-route']);
+});
+
+test('an entry file is read again only when it moved, and a docs.json that does not parse is no TODO block', async () => {
+    const hooks = await wired();
+    const { $, log, store, mtimes } = todoRig([['r-1', 'ready', 'one']]);
+    await hooks['session.start']($, {}, async () => ({}));
+    await log.ticks[0].fn();
+    await log.ticks[0].fn();
+    const file = ROOT + '/docs/todo/r-1.md';
+    assert.equal(log.reads.filter((p) => p === file).length, 1);
+    store[file] = store[file].replace('title: one', 'title: one, renamed');
+    mtimes[file] = 2;
+    await log.ticks[0].fn();
+    assert.equal(log.reads.filter((p) => p === file).length, 2);
+    assert.ok(buttons(await hooks['ui.render']($, { viewport: { columns: 44, rows: 60 } })).some((b) => b.props.label === 'one, renamed'));
+    store[ROOT + '/.fankeel/docs.json'] = '{';
+    await log.ticks[0].fn();
+    assert.ok(!buttons(await hooks['ui.render']($, { viewport: { columns: 44, rows: 60 } })).some((b) => b.props.key === 'fold-todo'));
+});
+
+test('the TODO head counts what lib/todo.js counts open in this repository, and the list draws from that many', async () => {
+    const hooks = await wired();
+    const fs = require('node:fs');
+    const repo = path.join(__dirname, '..');
+    const open = require('../lib/todo.js').load(repo).all.filter((e) => e.state !== 'done').length;
+    const dir = path.join(repo, 'docs', '90-agent', 'todo');
+    const files = { [ROOT + '/.fankeel/docs.json']: fs.readFileSync(path.join(repo, '.fankeel', 'docs.json'), 'utf8') };
+    for (const name of fs.readdirSync(dir)) files[ROOT + '/docs/90-agent/todo/' + name] = fs.readFileSync(path.join(dir, name), 'utf8');
+    const cfg = 'C:/cfg';
+    const { $, log } = fake({ files: Object.assign(files, entryFile(Object.assign({}, live, { configDir: cfg })), { [cfg + '/fankeel/serve.json']: JSON.stringify({ url: STATION }) }) });
+    await hooks['session.start']($, {}, async () => ({}));
+    await log.ticks[0].fn();
+    const labels = buttons(await hooks['ui.render']($, { viewport: { columns: 44, rows: 80 } })).map((b) => b.props.label);
+    assert.ok(open > 6, 'the repository has ' + open + ' open entries');
+    assert.ok(labels.includes('▾ TODO ' + open), labels.join(' | '));
+    const listed = labels.slice(labels.indexOf('▾ TODO ' + open) + 1, labels.indexOf('開啟 station'));
+    assert.equal(listed.length, 7);
+    assert.equal(listed[6], '還有 ' + (open - 6) + ' 條');
+});
```

- [ ] Step 2. Run them and watch them fail:

```
node --test tests/pane-status.test.js tests/pane.test.js
```

Expected red: the frame test (`RAILS` has no `todo`), the two TODO block tests in `tests/pane-status.test.js`, and the four TODO tests in `tests/pane.test.js`; everything else passes.

- [ ] Step 3. Write the implementation. In `hooks/pane-status.ts`, apply:

```diff
@@ -17,8 +17,10 @@
 // touch: one that wants a space before it carries the space in its text.
 // `press` makes the segment a Button on the Pane (hooks/pane.ts piece): 'station' opens the station's page,
-// 'fold' folds or opens the block `fold` names.
-export type Seg = { text: string; color?: string; bold?: boolean; press?: 'station' | 'fold'; fold?: Fold }
-// The blocks a head row folds; docs/90-agent/plans/2026-10-17-pane-fold-todo-design.md section 1.
-export type Fold = 'route' | 'tasks'
+// 'fold' folds or opens the block `fold` names, 'todo' opens the station at the hash `to`.
+export type Seg = { text: string; color?: string; bold?: boolean; press?: 'station' | 'fold' | 'todo'; fold?: Fold; to?: string }
+// The blocks a head row folds; docs/90-agent/plans/2026-10-17-pane-fold-todo-design.md sections 1 and 2.
+export type Fold = 'route' | 'tasks' | 'todo'
+// One open entry of the project's TODO bucket (hooks/pane.ts todosOf): its file name without `.md`, its title, its state.
+export type TodoEntry = { id: string; title: string; state: string }
 // One drawn row. No segments is the blank row above a block. `who` is the
 // neighbour a clash row names: hooks/pane.ts counts them against the band's flag.
@@ -45,4 +47,7 @@
   // The blocks folded to their head row (hooks/pane.ts state); absent is every block open.
   folded?: Partial<Record<Fold, boolean>>
+  // The project's open TODO entries, Ready first (hooks/pane.ts todosOf), and the station's key for the project.
+  todos?: TodoEntry[]
+  pkey?: string
 }
 
@@ -55,4 +60,5 @@
   agents: WHERE,
   notes: WHERE,
+  todo: WHERE,
   foot: DIM,
 }
@@ -295,4 +301,21 @@
 }
 
+// The most TODO titles the block lists.
+const TODO_ROWS = 6
+
+// The project's open TODO entries under a fold head that counts them: a title a
+// row, each a Button opening the station's TODO panel on that entry, and past
+// TODO_ROWS a grey Button opening the whole panel. The terminal draws a Button
+// four cells wider than its label. No entries, no block.
+function todoBlock(todos: TodoEntry[], pkey: string, inner: number, folded: boolean): Row[] {
+  if (!todos.length) return []
+  const at = `#/p/${encodeURIComponent(pkey)}/todo`
+  const rows = [row('todo', head('todo', folded, `TODO ${todos.length}`))]
+  if (folded) return rows
+  for (const t of todos.slice(0, TODO_ROWS)) rows.push(row('todo', { text: cut(t.title, Math.max(4, inner - 4)), press: 'todo', to: `${at}/${encodeURIComponent(t.id)}` }))
+  if (todos.length > TODO_ROWS) rows.push(row('todo', { text: `還有 ${todos.length - TODO_ROWS} 條`, color: WHERE, press: 'todo', to: at }))
+  return rows
+}
+
 // A row cut to `cols` cells: the segment that crosses the edge is cut, and the ones after it go.
 function fit(r: Row, cols: number): Row {
@@ -342,7 +365,7 @@
 }
 
-// Given up in this order when the rows do not fit: `agents` and `tasks` keep their title rows.
+// Given up in this order when the rows do not fit: `todo`, `agents` and `tasks` keep their head rows.
 // The task, the clash and the foot never go.
-const DROP = ['notes', 'agents', 'tasks']
+const DROP = ['todo', 'notes', 'agents', 'tasks']
 // The blocks that are alarms, not sections: every row of one keeps its rail.
 const ALARMS = ['clash']
@@ -373,4 +396,8 @@
   if (notes.length) blocks.push([row('notes', title('notes', 'notes')), ...notes.map((note) => row('notes', { text: cut(`· ${note}`, inner) }))])
 
+  // With no station up nothing opens a TODO: the foot's `station 未啟動` stands for both.
+  const todo = input.station ? todoBlock(input.todos ?? [], input.pkey ?? '', inner, !!folded.todo) : []
+  if (todo.length) blocks.push(todo)
+
   // The probe is asked for by hand (hooks/pane.ts probeOf): it is drawn whole, in the block that never drops.
   const probed = input.probe ? wrap(input.probe, inner).map((text) => row('foot', dim(text))) : []
@@ -383,5 +410,5 @@
     const at = blocks.findIndex((block) => block[0].block === name)
     if (at < 0) continue
-    if (name === 'tasks' || name === 'agents') blocks[at] = blocks[at].slice(0, 1)
+    if (name !== 'notes') blocks[at] = blocks[at].slice(0, 1)
     else blocks.splice(at, 1)
   }
```

In `hooks/pane.ts`, apply:

```diff
@@ -2,5 +2,5 @@
 import { parentOf, isActive, SESSION_ID, thresholdWith } from './compact.ts'
 import { statusRows, ledgerDoneIds, planTasks } from './pane-status.ts'
-import type { Entry, Other, PlanInfo, PlanTask, Seg as StatusSeg, Row as StatusRow, StatusInput, Fold } from './pane-status.ts'
+import type { Entry, Other, PlanInfo, PlanTask, Seg as StatusSeg, Row as StatusRow, StatusInput, Fold, TodoEntry } from './pane-status.ts'
 import type { Context, Limit } from './pane-bar.ts'
 import { taskDir, pendingName, parsePending } from './pane-gate.ts'
@@ -40,4 +40,7 @@
   // The station's url from serve.json (stationOf), or null when none is up.
   station: string | null
+  // The station's key for this task's project (lib/station.js pkeyOf), and its open TODO entries while a station is up (todosOf).
+  pkey: string
+  todos: TodoEntry[]
 }
 
@@ -48,8 +51,8 @@
 type Cache = Map<string, { stamp: string; value: unknown }>
 
-const blank = (id: string): Seen => ({ id, entry: null, others: [], pending: null, context: null, limits: [], plan: null, remote: false, probe: null, agents: [], station: null })
+const blank = (id: string): Seen => ({ id, entry: null, others: [], pending: null, context: null, limits: [], plan: null, remote: false, probe: null, agents: [], station: null, pkey: '', todos: [] })
 
 // The last message each silent catch logged: the tick runs four times a second, and a failure that stays is said once.
-type Logged = { context: string; plan: string; open: string; registry: string; neighbour: string; gate: string; live: string; remote: string; bandSvg: string; paneSvg: string; agents: string; station: string }
+type Logged = { context: string; plan: string; open: string; registry: string; neighbour: string; gate: string; live: string; remote: string; bandSvg: string; paneSvg: string; agents: string; station: string; todo: string }
 
 // A registry file that is there and does not parse: told apart so `tick` can wait it out for a while, then give up on it.
@@ -342,4 +345,51 @@
 }
 
+// lib/todo.js STATES, the open ones in the order the station's TODO panel files them; any other state but `done` comes after.
+const TODO_ORDER = ['ready', 'decision', 'blocked', 'watch']
+
+// One frontmatter field of an entry file, as lib/docs.js frontmatter reads it: a `key: value` line between the opening `---` fences, quotes trimmed.
+function field(text: string, key: string): string {
+  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
+  const kv = fm ? new RegExp(`^${key}\\s*:\\s*(.*)$`, 'mi').exec(fm[1]) : null
+  return kv ? kv[1].trim().replace(/^["']|["']$/g, '') : ''
+}
+
+// The project's open TODO entries: the `todo` bucket `<dir>/.fankeel/docs.json` declares (lib/todo.js bucketPath), each
+// `.md` file in it one entry, its id the file name, every state but `done` open, as lib/station.js todoOf counts them;
+// Ready first, then by id. A file is read again only when its listing stamp moved. Anything unreadable is no entries.
+async function todosOf($: EngineInterface, dir: string, cache: Cache, logged: Logged): Promise<TodoEntry[]> {
+  try {
+    const conf = await readJson($, `${dir}/.fankeel/docs.json`)
+    const buckets = conf && Array.isArray(conf.buckets) ? (conf.buckets as unknown[]) : []
+    const bucket = buckets.find((b): b is Record<string, unknown> => !!b && typeof b === 'object' && (b as Record<string, unknown>).role === 'todo')
+    if (!bucket || typeof bucket.path !== 'string') return []
+    const folder = `${dir}/${bucket.path}`
+    if (!(await $.fs.exists(folder))) return []
+    const todos: TodoEntry[] = []
+    const listed = new Set<string>()
+    for (const f of await $.fs.list(folder)) {
+      if (!f.name.endsWith('.md')) continue
+      const path = `${folder}/${f.name}`
+      listed.add(path)
+      const stamp = `${f.mtimeMs}:${f.size}`
+      let hit = cache.get(path)
+      if (!hit || hit.stamp !== stamp) {
+        const text = String(await $.fs.read(path))
+        hit = { stamp, value: { id: f.name.slice(0, -3), title: field(text, 'title'), state: field(text, 'state') } }
+        cache.set(path, hit)
+      }
+      const t = hit.value as TodoEntry
+      if (t.state !== 'done') todos.push({ ...t, title: t.title || t.id })
+    }
+    for (const key of cache.keys()) if (key.startsWith(`${folder}/`) && !listed.has(key)) cache.delete(key)
+    const rank = (state: string): number => (TODO_ORDER.includes(state) ? TODO_ORDER.indexOf(state) : TODO_ORDER.length)
+    logged.todo = ''
+    return todos.sort((a, b) => rank(a.state) - rank(b.state) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
+  } catch (err) {
+    logOnce($, logged, 'todo', `fankeel pane: TODO entries unreadable, ${String(err)}`)
+    return []
+  }
+}
+
 // Opens the station's page in the host's browser: `start` on Windows, else
 // `open`, then `xdg-open`. When none of them runs, the url is copied instead,
@@ -427,5 +477,8 @@
   const agents = await agentsOf($, entry, id, found.root, cache, logged)
   const station = await stationOf($, entry, logged)
-  return { id, entry, others, pending, context, limits, plan, remote, probe, agents, station }
+  // lib/station.js pkeyOf: the registry root, and the entry's project under it when it names one.
+  const pkey = typeof entry.project === 'string' && entry.project ? `${found.root}/${entry.project}` : found.root
+  const todos = station ? await todosOf($, pkey, cache, logged) : []
+  return { id, entry, others, pending, context, limits, plan, remote, probe, agents, station, pkey, todos }
 }
 
@@ -474,5 +527,5 @@
     const minute = Math.floor(clock / 60000)
     const second = next.pending ? Math.floor(clock / 1000) : 0
-    const now = JSON.stringify([next.entry, next.others, next.context, next.limits, next.plan, next.remote, next.probe, next.agents, next.station, minute, second])
+    const now = JSON.stringify([next.entry, next.others, next.context, next.limits, next.plan, next.remote, next.probe, next.agents, next.station, next.pkey, next.todos, minute, second])
     // The opens and closes have their own memory, `edge`, which moves only when they all went through: a rejected
     // one is met again next tick as the same edge, while `seen` and the redraw below never wait on them.
@@ -509,5 +562,5 @@
   const state: State = {
     seen: blank(''), print: '', mine: false, edge: { task: false }, bad: 0, busy: false, cache: new Map(),
-    logged: { context: '', plan: '', open: '', registry: '', neighbour: '', gate: '', live: '', remote: '', bandSvg: '', paneSvg: '', agents: '', station: '' },
+    logged: { context: '', plan: '', open: '', registry: '', neighbour: '', gate: '', live: '', remote: '', bandSvg: '', paneSvg: '', agents: '', station: '', todo: '' },
     folded: {},
   }
@@ -598,4 +651,6 @@
       station: seen.station,
       folded: state.folded,
+      todos: seen.todos,
+      pkey: seen.pkey,
     }
     const status = statusRows(input)
@@ -605,4 +660,6 @@
       const url = seen.station
       if (seg.press === 'station' && url) return h(Button, { key: 'station', label: seg.text, hotkey: 's', onPress: (press: UiPressArgument) => openStation($, url, press.surface) })
+      const to = seg.to
+      if (seg.press === 'todo' && to && url) return h(Button, { key: to, label: seg.text, onPress: (press: UiPressArgument) => openStation($, url + to, press.surface) })
       const fold = seg.fold
       if (seg.press === 'fold' && fold) {
```

- [ ] Step 4. Run Step 2's command again: all pass, and `node --test tests/pane-svg.test.js` still passes. The last test reads this repository's own `docs/90-agent/todo` and `.fankeel/docs.json`, so it runs from the repository (or a worktree of it), not a copy without them.

- [ ] Step 5. Commit:

```
feat(pane): a TODO block in the foot, each title a Button that opens the station on its entry

- the todo block: a fold head counting the open entries, six titles, 還有 N 條, first to drop — hooks/pane-status.ts
- todosOf reads the project's todo bucket through $.fs, cached by stamp; titles open <station>#/p/<pkey>/todo/<id> — hooks/pane.ts
- the block, the presses, the cache and the count against lib/todo.js — tests/pane-status.test.js, tests/pane.test.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 4: The station page names the sub-routes; README and the profile guide name the folds and TODO

`docs/90-agent/reference/station.md` names the two sub-routes and every citation Task 1 moved points at its line again; the Pane's row in `README.md` and its paragraph in `docs/01-guide/profile.md` say what Tasks 2 and 3 drew.

**Files:**
- Modify: `docs/90-agent/reference/station.md:226-1406` — the sub-route paragraph at the TODO panel; the 31 `assets/station/station.js:<n>` citations moved
- Modify: `README.md:216-216` — the Pane's sentence names TODO and the fold heads
- Modify: `docs/01-guide/profile.md:62-62` — the route head, the tasks head, TODO, the folds, the drop order
- Read: `assets/station/station.js` — the lines the citations point at
- Read: `hooks/pane-status.ts` — what the folds and TODO draw

**Interfaces:**
- Consumes: Task 1's sub-routes and `knownPkey`; Task 2's and Task 3's heads, `todoBlock` and `DROP`.
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the text and the citation script; transcription plus a check.

- [ ] Step 1. Watch the check fail first: with Task 1 committed, `node scripts/docs-check.js 2>&1 | grep "reference/station.md" | grep -c "moved:"` prints `28`.

- [ ] Step 2. In `docs/90-agent/reference/station.md`, apply:

```diff
@@ -1117,5 +1117,13 @@
 entry's id. The project page's TODO panel reads each project's `todos` row
 off the data file: open entries in the index's order, and done ones newest
-first where the project keeps entry files.
+first where the project keeps entry files. Two sub-routes open the project
+page on the panel: `#/p/<pkey>/todo` scrolls the panel into view, and
+`#/p/<pkey>/todo/<id>` the open entry `<id>` in it — each open row carries
+`id="todo-<id>"` — or the panel when that entry is not open. The scroll
+happens once, after the first draw that has the panel, and not again on the
+3-second redraw. The Pane's TODO buttons open these, building the pkey from
+the engine's root; a pkey that differs from a session's only in the
+direction of its slashes or the case of its letters is read as that
+session's (`knownPkey` in `assets/station/station.js`).
 The panel sits right under the project's head, above the chart. Shut, the
 done list is one summary strip — how many, a bar for each of the newest three
```

- [ ] Step 3. Move the citations. Save this as `.fankeel/build/<task>/fixcites.js` (scratch, never in the tree) and run `node .fankeel/build/<task>/fixcites.js .` from the repository root; it moves each `assets/station/station.js:<n>` by the lines Task 1's diff against `eae94c85` inserted above `<n>`, and stops on a cite that points into a changed line:

```
// Moves every assets/station/station.js:<n> in station.md by what Task 1 inserted above line <n>.
// Usage: node fixcites.js <repo root> [<old station.js>]; with no old file, the old one is eae94c85's.
const fs = require('fs');
const { execFileSync } = require('child_process');
const root = process.argv[2];
const args = process.argv[3]
    ? ['diff', '--no-index', '-U0', process.argv[3], root + '/assets/station/station.js']
    : ['diff', '-U0', 'eae94c85', '--', 'assets/station/station.js'];
let diff = '';
try { diff = execFileSync('git', args, { cwd: root, encoding: 'utf8' }); } catch (e) { diff = e.stdout; }
const hunks = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)]
    .map((m) => ({ a: Number(m[1]), b: m[2] === undefined ? 1 : Number(m[2]), d: m[4] === undefined ? 1 : Number(m[4]) }));
const moved = (n) => {
    let shift = 0;
    for (const h of hunks) {
        // b = 0 inserts after line a; otherwise lines a..a+b-1 were replaced.
        const last = h.b === 0 ? h.a : h.a + h.b - 1;
        if (h.b > 0 && n >= h.a && n <= last) throw new Error('station.js:' + n + ' is a line Task 1 changed: point at it by hand');
        if (n > last) shift += h.d - h.b;
    }
    return n + shift;
};
const doc = root + '/docs/90-agent/reference/station.md';
let count = 0;
const text = fs.readFileSync(doc, 'utf8').replace(/assets\/station\/station\.js:(\d+)/g, (all, n) => {
    const to = moved(Number(n));
    if (to !== Number(n)) count++;
    return 'assets/station/station.js:' + to;
});
fs.writeFileSync(doc, text);
console.log(count + ' citations moved');
```

Expected output: `32 citations moved` (the 28 quoted, the 3 unquoted at `station.md` lines 235, 755 and 757, and one line citing twice).

- [ ] Step 4. Run `node scripts/docs-check.js 2>&1 | grep -E "reference/station.md|README.md:|profile.md"`: no `moved:` line, and no `long-sentence` on `profile.md`; the six `carries no quote` lines that were there at `eae94c85` stay (lines 67, 235, 355, 441, 755, 757).

- [ ] Step 5. In `README.md`, apply:

```diff
@@ README.md:216 @@
-the three newest notes, and a foot with the session id and a button that opens the station;
+the three newest notes, while a station is up the project's open TODO entries (Ready first, up to six titles, each a button that opens the station's TODO panel on that entry, then 還有 N 條 for the rest), and a foot with the session id and a button that opens the station; the route, tasks and TODO each sit under a ▾ head button that folds the block to that one row, and a new session starts with every block open;
```

- [ ] Step 6. In `docs/01-guide/profile.md`, line 62 is one paragraph; make these five replacements, each of text that occurs once on the line, and touch nothing else:

```diff
@@ docs/01-guide/profile.md:62 @@
-其下一列是 route。
+其下是 route：先是一列「▾ route 2/6」按鈕（目前是第幾站／共幾站），再是站名。
@@ docs/01-guide/profile.md:62 @@
-再來是 tasks：plan 的任務在六個以內就全列
+再來是 tasks，標頭是「▾ tasks 3/5」按鈕（完成幾個／共幾個）。其下 plan 的任務在六個以內就全列
@@ docs/01-guide/profile.md:62 @@
-游標停在格子上會顯示該任務的標題。
+游標停在格子上會顯示該任務的標題。route 與 tasks 的標頭在 Desktop 上也是按鈕，收合時那一塊的圖不畫。
@@ docs/01-guide/profile.md:62 @@
-最後是最新三則 notes 與頁尾；頁尾是 session 編號與 station 那一列，station 在跑時是「開啟 station」按鈕加網址，沒有就寫「station 未啟動」。
+最後是最新三則 notes、TODO 與頁尾。TODO 只在 station 在跑時出現。標頭是「▾ TODO 30」按鈕，數字是這個專案未完成的條目數。條目來自 `.fankeel/docs.json` 裡 role 為 `todo` 的資料夾：每個 `.md` 檔一條，state 不是 `done` 的都算。標頭下每列一條標題，Ready 在前，最多六條；更多時，最後一列是灰色的「還有 N 條」。按一條標題，就在 station 開這個專案的 TODO 面板，並捲到那一條（`#/p/<pkey>/todo/<id>`）。按「還有 N 條」開整個面板（`#/p/<pkey>/todo`）。頁尾是 session 編號與 station 那一列，station 在跑時是「開啟 station」按鈕加網址，沒有就寫「station 未啟動」。route、tasks 與 TODO 的標頭按一下，那一塊就收成只剩標頭一列，箭頭變成 ▸。route 的標頭收合時會多帶目前這一站；再按一下就展開。收合只記在這個 session 的記憶裡，新的 session 一律展開。
@@ docs/01-guide/profile.md:62 @@
-列數不夠時，依 notes、agents 的清單（留標題列）、tasks 的清單（留標題列）的次序讓出位置
+列數不夠時，依 TODO 的清單（留標頭）、notes、agents 的清單（留標題列）、tasks 的清單（留標頭）的次序讓出位置
```

- [ ] Step 7. Run Step 4's command again: still clean. Then `node --test tests/station-doc.test.js tests/docs-check.test.js` — all pass.

- [ ] Step 8. Commit:

```
docs: the station's TODO sub-routes, and the Pane's fold heads and TODO block

- #/p/<pkey>/todo[/<id>] and knownPkey; the station.js citations Task 1 moved — docs/90-agent/reference/station.md
- the Pane's row names TODO and the fold heads — README.md
- the route and tasks heads, the TODO block, folding and the drop order — docs/01-guide/profile.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 5: brief-3 probe files, ready to load

Design §4: the probe `docs/90-agent/todo/brief-3.md` describes is prepared as files the user can load, without running it. Its step 1 (the probe's `LOG` pointed at a new records directory) and step 5 (one `session.append` into the second `mod-probe b` subagent while it runs) are done here, on a copy of the 2026-10-03 probe mod; steps 2 to 6 stay the user's, in an interactive session.

**Files:**
- Modify: `.fankeel/build/2026-10-17-spawn-probe/mod/hooks/probe.ts` — copied from the evidence probe, then `LOG`, the nonce key and the append
- Modify: `.fankeel/build/2026-10-17-spawn-probe/mod/hooks/hooks.json` — copied, its records path moved
- Modify: `docs/90-agent/todo/brief-3.md` — a dated section naming what is ready and the one command the user runs
- Read: `docs/90-agent/reports/evidence/2026-10-03-mod-probe-3/mod/hooks/probe.ts` — the probe copied
- Read: `docs/90-agent/reports/evidence/2026-10-03-mod-probe-3/mod/hooks/hooks.json` — copied
- Read: `.claude-plugin/types/claude-code/index.d.ts` — `SessionAppendArgs` at `:10541`, `SessionAppendResult` at `:10681`
- Test: `.fankeel/build/2026-10-17-spawn-probe/check.mjs`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the edits and the check; transcription plus a check.

- [ ] Step 1. Copy the two files (the evidence stays as it is):

```
mkdir -p .fankeel/build/2026-10-17-spawn-probe/mod/hooks
cp docs/90-agent/reports/evidence/2026-10-03-mod-probe-3/mod/hooks/probe.ts docs/90-agent/reports/evidence/2026-10-03-mod-probe-3/mod/hooks/hooks.json .fankeel/build/2026-10-17-spawn-probe/mod/hooks/
```

- [ ] Step 2. Write the failing check, `.fankeel/build/2026-10-17-spawn-probe/check.mjs`:

```js
// The probe's own check, run under plain node: `node .fankeel/build/2026-10-17-spawn-probe/check.mjs`.
// It loads mod/hooks/probe.ts on a fake engine, dispatches three `mod-probe b` subagents and steps each,
// and asserts what docs/90-agent/todo/brief-3.md steps 1, 3 and 5 need of it. Nothing here runs Claude Code.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const LOG = 'F:/ymlab/fankeel/.fankeel/build/2026-10-17-spawn-probe/records'
const { register } = await import(pathToFileURL(path.join(here, 'mod', 'hooks', 'probe.ts')).href)
const hooks = {}
register((event, a, b) => { hooks[event] = typeof a === 'function' ? a : b })

const store = {}
const written = []
const appends = []
const $ = {
  store: { get: async (k) => store[k], set: async (k, v) => { store[k] = v } },
  fs: { write: async (p, text) => { written.push([p, JSON.parse(text)]) } },
  ui: { log: () => {} },
  session: {
    messages: async () => [],
    append: async (args) => { appends.push(args); return { uuid: 'u-1', message: args.message } },
  },
}

const spawned = []
for (const [i, id] of ['a1', 'a2', 'a3'].entries()) {
  await hooks['agent.spawn']($, { description: `mod-probe b ${i}`, prompt: `prompt ${i}`, tool_use_id: `t${i}`, subagentType: 'general-purpose' },
    async (e) => { spawned.push(e.prompt); return { agentId: id, model: 'm' } })
}
const nonce = store['probe.nonce4']
assert.ok(nonce, 'the nonce is kept under probe.nonce4')
assert.deepEqual(spawned, [0, 1, 2].map((i) => `prompt ${i}\nMOD-PROBE-SPAWN-${nonce}`))

const step = async (agentId, index) => {
  const gen = hooks['turn.step']($, { agentId, index, model: 'm', effort: 'medium', turnId: 't' }, async function* () { return { usage: { output_tokens: 1 } } })
  let r
  do r = await gen.next(); while (!r.done)
}
await step('a1', 0)
await step('a2', 0)
await step('a2', 1)
await step('a3', 0)
assert.deepEqual(appends, [{ message: { type: 'user', content: [{ type: 'text', text: `MOD-PROBE-APPEND-${nonce}` }] }, agentId: 'a2' }])
assert.ok(written.every(([p]) => p.startsWith(LOG + '/')), 'every record goes under the new records directory')
assert.deepEqual(written.filter(([, r]) => r.event === 'session.append.call').map(([, r]) => [r.agentId, r.uuid, r.deny]), [['a2', 'u-1', null]])
assert.match(readFileSync(path.join(here, 'mod', 'hooks', 'hooks.json'), 'utf8'), /2026-10-17-spawn-probe\/records/)
assert.doesNotMatch(readFileSync(path.join(here, 'mod', 'hooks', 'hooks.json'), 'utf8'), /task-20261003T060232/)
console.log('ok — probe ready: three spawns rewritten, one append into the second, records under', LOG)
```

Run `node .fankeel/build/2026-10-17-spawn-probe/check.mjs`: it fails on `the nonce is kept under probe.nonce4`.

- [ ] Step 3. In `.fankeel/build/2026-10-17-spawn-probe/mod/hooks/probe.ts`, apply (the `probe.nonce3` → `probe.nonce4` change is all three occurrences, the comment's too):

```diff
@@ -5,5 +5,5 @@
 // 檔名依時間排序就是事件順序。共三處改寫：prompt.compose 對每個系統提示尾端加標記段，
 // agent.spawn 與 turn.step 只動帶 mod-probe 標記的派遣。
-const LOG = 'F:/ymlab/fankeel/.fankeel/build/task-20261003T060232/probe2/records'
+const LOG = 'F:/ymlab/fankeel/.fankeel/build/2026-10-17-spawn-probe/records'
 const EFFORT = /MOD-PROBE-EFFORT=(low|medium|high|xhigh)/
 
@@ -11,10 +11,13 @@
 const effortOf = new Map<string, string | null>()
 let probedTurn: string | undefined
+// 探測步驟 5（docs/90-agent/todo/brief-3.md）：第二個 mod-probe b 子代理執行中，對它 session.append 一列 user 文字，只做一次。
+const bAgents: string[] = []
+let appended = false
 
 // 啟用與熱重載都會讓 session.start 再跑一次（d.ts:4057），模組變數也會清空；
-// nonce 存在 $.store 的 'probe.nonce3'，沿用舊值才不會中途換號（換新鍵是為了讓主 session 沒看過新值）。
+// nonce 存在 $.store 的 'probe.nonce4'，沿用舊值才不會中途換號（換新鍵是為了讓主 session 沒看過新值）。
 async function getNonce($: EngineInterface): Promise<string> {
   if (nonce) return nonce
-  const kept = await $.store.get('probe.nonce3')
+  const kept = await $.store.get('probe.nonce4')
   if (typeof kept === 'string' && kept) {
     nonce = kept
@@ -22,5 +25,5 @@
   }
   const fresh = crypto.randomUUID()
-  await $.store.set('probe.nonce3', fresh)
+  await $.store.set('probe.nonce4', fresh)
   nonce = fresh
   return nonce
@@ -120,4 +123,5 @@
     const startedAt = Date.now()
     const res = await next(isB ? { ...e, prompt } : e)
+    if (isB && res.agentId) bAgents.push(res.agentId)
     await record($, 'agent.spawn', {
       startedAt,
@@ -178,4 +182,14 @@
       }
     }
+    if (!appended && e.agentId !== undefined && e.agentId === bAgents[1]) {
+      appended = true
+      const n = await getNonce($)
+      try {
+        const got = await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: `MOD-PROBE-APPEND-${n}` }] }, agentId: e.agentId })
+        await record($, 'session.append.call', { agentId: e.agentId, index: e.index, uuid: got.uuid ?? null, deny: got.deny ?? null })
+      } catch (err) {
+        await record($, 'session.append.call', { agentId: e.agentId, index: e.index, error: err instanceof Error ? err.message : String(err) })
+      }
+    }
     const result = yield* next(effort === e.effort ? e : { ...e, effort })
     await record($, 'turn.step', {
```

In `.fankeel/build/2026-10-17-spawn-probe/mod/hooks/hooks.json`, apply:

```diff
@@ -7,5 +7,5 @@
           {
             "type": "command",
-            "command": "node -e \"const fs=require('fs');const d='F:/ymlab/fankeel/.fankeel/build/task-20261003T060232/probe2/records';fs.mkdirSync(d,{recursive:true});const t=Date.now();fs.writeFileSync(d+'/command-hook-'+t+'.json',JSON.stringify({event:'command-hook',at:t})+String.fromCharCode(10))\"",
+            "command": "node -e \"const fs=require('fs');const d='F:/ymlab/fankeel/.fankeel/build/2026-10-17-spawn-probe/records';fs.mkdirSync(d,{recursive:true});const t=Date.now();fs.writeFileSync(d+'/command-hook-'+t+'.json',JSON.stringify({event:'command-hook',at:t})+String.fromCharCode(10))\"",
             "timeout": 5
           }
```

- [ ] Step 4. Run Step 2's command again: it prints `ok — probe ready: ...` and exits 0.

- [ ] Step 5. At the end of `docs/90-agent/todo/brief-3.md`, append:

```md
## 探測準備（2026-10-17）

步驟 1 與步驟 5 已備好，檔案在 `.fankeel/build/2026-10-17-spawn-probe/`（不進 git）。`mod/hooks/probe.ts` 的 LOG 指向同一目錄的 `records`，nonce 改存在 `probe.nonce4`。第二個 description 含 `mod-probe b` 的子代理跑到第一步時，probe 對它呼叫一次 `session.append`，結果記成 `session.append.call`。欄位照 `.claude-plugin/types/claude-code/index.d.ts:10541` 的 `SessionAppendArgs`：`message` 與 `agentId`；這份型別檔在這個 checkout 已經有，不必先載入 mod。`node .fankeel/build/2026-10-17-spawn-probe/check.mjs` 在假引擎上驗過這三件事。步驟 2 起要使用者在互動式 session 跑：`claude --plugin-dir .fankeel/build/2026-10-17-spawn-probe/mod --debug-file <log>`。
```

- [ ] Step 6. Commit `docs/90-agent/todo/brief-3.md` alone (the probe files are under the ignored `.fankeel/build/`):

```
docs(todo): brief-3's probe is ready to load — where it is and the one command left

- steps 1 and 5 prepared under .fankeel/build/2026-10-17-spawn-probe, checked by its check.mjs — docs/90-agent/todo/brief-3.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 6: The user folds a block and opens a TODO title on Claude Desktop

**Files:**
- Modify: `docs/90-agent/todo/pane-11.md` — what was seen when a head was pressed, and the date
- Modify: `docs/90-agent/todo/pane-10.md` — what was seen when a TODO title was pressed, and the date
- Read: `hooks/pane-status.ts` — the heads and the TODO block being looked at
- Read: `assets/station/station.js` — the page the TODO title opens

**Interfaces:**
- Consumes: Tasks 1 to 5, committed
- Produces: none

**Dispatch:** user — Claude Desktop runs the installed snapshot and only a person can click its Pane; no subagent can.

- [ ] Step 1. The session runs `claude plugin update fankeel@fankeel` once Tasks 1 to 5 are committed, and the user restarts Claude Desktop.
- [ ] Step 2. With a station up (`/fankeel-station`) and a fankeel task open in a Desktop session, the user presses the `▾ tasks` head: the tasks block becomes its one head row `▸ tasks i/n` and its Svg goes; pressing again brings it back. The same for `▾ route`.
- [ ] Step 3. The user presses one TODO title: the browser opens the station on this project's page, scrolled to that entry in the TODO panel. If it opens on "這頁上沒有專案", or on the wrong place, the user says what the address bar shows.
- [ ] Step 4. The session records the date and what was seen as a line at the end of `docs/90-agent/todo/pane-11.md` (the folds) and `docs/90-agent/todo/pane-10.md` (the TODO title); anything that needs a change becomes a new TODO entry, not an edit to this plan's tasks.

## Coverage

| promise | task |
|---|---|
| route and tasks each get a head row drawn as a `Button`: `▾ route 2/6` and `▾ tasks 3/5` expanded, `▸ route 2/6 design` and `▸ tasks 3/5` folded. | Task 2 |
| `onPress` flips a fold flag held in the Pane's `state` closure (`hooks/pane.ts`) and calls `$.ui.invalidate('ui.render')`. | Task 2 |
| Folded, the block is its one head row: no Svg on Desktop, no body rows in the terminal. | Task 2 |
| The fold flags live in memory only; a new session starts expanded. | Task 2 |
| Desktop and terminal both fold; in the terminal the head row is the same Button, drawn as text. | Task 2 |
| The foot gains a foldable TODO block in the same shape: head `▸ TODO 30` folded, `▾ TODO 30` expanded, the count being the project's open entries. | Task 3 |
| Expanded, it lists entries one row each, title only, Ready first, at most 6 rows. | Task 3 |
| Each title row is a `Button` that opens the station at `#/p/<pkey>/todo/<id>`. | Task 3 |
| Past 6 rows, a dim `還有 N 條` row is a `Button` opening `#/p/<pkey>/todo`. | Task 3 |
| The `開啟 station` Button stays as it is; with no station running, the TODO buttons give way to the dim `station 未啟動` like it does. | Task 3 |
| The entries come from the project's `todo` bucket in `.fankeel/docs.json`, read with `$.fs`: each file's frontmatter `title` and `state`. | Task 3 |
| `pkey` is `root + '/' + project`, or `root` when the entry has no project — the same one-liner as `pkeyOf` in `lib/station.js`. | Task 3 |
| `parseHash` in `assets/station/station.js` reads a trailing `/todo` or `/todo/<id>` on `#/p/<pkey>` as a focus, not as part of the pkey. | Task 1 |
| After the project page draws, the TODO panel (`#todo`) — or the entry `<id>` inside it — is scrolled into view. | Task 1 |
| `docs/90-agent/reference/station.md` names the two sub-routes. | Task 4 |
| The probe the TODO entry 子代理 brief 改走 spawn describes is prepared as files the user can load, without running it; running it stays the user's, in an interactive session. | Task 5 (running it: the user, after this plan) |
| check — the What proves it done table's header | Tasks 1 to 6 |
| a title Button opens the entry's url | Task 3 (`the TODO block lists six open titles, Ready first, …`) |
| folding works and is driven by `onPress` | Task 2 (`a fold head's onPress folds its block to that one row …`) |
| the list caps at 6 | Task 3 (`the TODO block lists six open titles …`, nine entries: six titles and `還有 2 條`; `tests/pane-status.test.js` with eight) |
| the sub-route parses and scrolls | Task 1 |
| the artefact agrees with itself | Task 3 (`the TODO head counts what lib/todo.js counts open in this repository …`) |
| it works on the real Desktop | Task 6 |
