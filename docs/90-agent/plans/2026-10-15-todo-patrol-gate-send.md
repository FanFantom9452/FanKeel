---
status: design-intent
---

# TODO patrol 2026-10-15 Implementation Plan

**Goal:** a station gate button says it is sending, cannot be pressed twice, and comes back after 10 seconds or an error; the patrol's three decisions and its re-stamps are written into the TODO.
**Architecture:** one helper, `answerPost`, beside `gatePost` in `assets/station/station.js`, carries both POST /answer paths (the floating gate's options and hand-off, and the 懸著的 gate's 送出答案): it disables the box's buttons, writes 送出中…, races the fetch against a 10-second `w.setTimeout` that aborts it, and gives the buttons back on timeout, refusal or network error. The state lives in `view.pg` under `<id>:send`, the map both gate renderers already take as `picked`, so the three-second poll's redraw draws the buttons disabled and the line as it was rather than fresh and enabled. The rest is markdown: one seam paragraph, one TODO entry moved to ready, eleven Blocked stamps moved to 2026-10-15.
**Tech Stack:** browser ES5 in `assets/station/station.js` (`var`, `function`, no arrow functions, no `let`); tests on `node:test` driving the page script through `node:vm`, the way `tests/station-hdl-j.test.js` does; no dependencies (`package.json` has none, and none are added).
**Spec:** ../todo/station-25.md

## Global Constraints

- `assets/station/station.js` is 5784 lines, over `READ_CAP` (1500, `lib/plantasks.js:350`): every `Modify:` of it names a line range.
- At most 3 `Modify:` files per task (`FILE_CAP`, `lib/plantasks.js:351`).
- Every user-facing string is written in Chinese at the call, `loc(key, zh, vars)`, and its English goes in `assets/station/i18n.js` under the same key (`assets/station/i18n.js:3`); keys for this area start `cmp.` (`assets/station/i18n.js:906-911`).
- The page script runs in a `vm` context in tests with no `AbortController` global (`tests/station-hdl-j.test.js:47-48` passes only `window`, `document`, `URLSearchParams`, `fetch`, `module`, `grab`): code must work when `typeof AbortController !== 'function'`.
- Fakes in `tests/station-hdl-j.test.js:499-503` and `tests/station-hdl-k.test.js:146-152` have no `querySelectorAll`: the helper must not call it when it is absent, so those suites stay green unchanged.
- These strings stay byte for byte: `已送出：`, `已交給終端：`, and `<status> — <body>` on a refusal (`tests/station-hdl-k.test.js:255,267`). The network-error line gains `可以再按一次`, so `tests/station-hdl-k.test.js:276-279` and `:343-344` change with it; `tests/station-hdl-i.test.js:251` is the todo form's line and does not.
- `refresh()` (`assets/station/station.js:5637-5659`) runs every poll and `drawFloat()` (`:4798-4803`) rewrites `fk.innerHTML`, so any state a send needs after a redraw lives in `view.pg`, which `drawFloat` passes to `floatHtml` as `picked` (`:4802`).
- Timers go through `w.setTimeout` / `w.clearTimeout` (`assets/station/station.js:5541`), never the bare globals.
- A TODO entry's `stamp:` is `YYYY-MM-DD`; `node scripts/todo-check.js` must stay clean after every todo edit.
- Commit subjects are `type: subject`, lower case, English (`git log --oneline -5`).
- Render tests need `FANKEEL_BROWSER` set to chrome.exe's full path, or 14 of them fail on Edge.

## Risks

- A poll redraw re-renders the floating `.gc` and the `.pg` inside the 10 seconds (reviewer, `refresh()` at `:5637-5659`), so nodes `answerPost` holds go stale — Task 1 — the renderers read `picked[id + ':send']` (Step 5), and `answerPost` writes the state before it writes the nodes, so a redraw shows what the send last said; after a stale write the next poll, within three seconds, shows it.
- `pendingGateHtml` may have a second caller that passes something other than `view.pg` as `picked` — Task 1 — Step 1 greps every call site first.
- The 懸著的 gate's `pgSync` sets `[data-answer]`'s `disabled` from the tick count (`assets/station/station.js:5565`), so a tick during a send re-enables it — Task 1 — Step 5's `answerPost` leaves `pgSync` alone; a second press during the send is a second POST of the same answers, which `/answer` accepts once (the hook answers only the first). Named, not fixed.

## Task 1: Gate buttons say they are sending, and come back on timeout or error

**Files:**
- Modify: `assets/station/station.js:2418-2530` — `gateCountdownHtml` and `pendingGateHtml` draw a send's state from `picked[id + ':send']`
- Modify: `assets/station/station.js:5028-5590` — the `[data-answer]` branch calls `answerPost`; `answerPost` and `SEND_MS` sit above `gatePost`, which calls it
- Modify: `assets/station/i18n.js:900-915` — English for `cmp.sending`, `cmp.notConfirmedRetry` and `cmp.pressAgain`
- Read: `tests/station-hdl-j.test.js` — the `boot()` harness this task's test copies, and the gop/gho tests that must stay green
- Test: `tests/station-gate-send.test.js`
- Test: `tests/station-gate-send-render.test.js`
- Test: `tests/station-hdl-k.test.js` — the two network-error assertions gain `可以再按一次`

**Interfaces:**
- Consumes: `loc(key, zh, vars)`, `w`, `S.sessions`, `pgRead` — all already in `assets/station/station.js`
- Produces: `answerPost(id, box, line, cls, form, said, failed)` — private to the page script; `SEND_MS = 10000`; `view.pg[id + ':send']` is `{ busy: boolean, cls: string, text: string }`

**Dispatch:** implementer, sonnet — the code and the tests are in the plan; transcription plus one grep of call sites.

1. Check every caller of the two renderers passes `view.pg`:

   ```sh
   grep -n "pendingGateHtml(\|gateCountdownHtml(\|floatHtml(" assets/station/station.js
   ```

   Any call passing something else as `picked` gets `view.pg` in its place, within the ranges above; one outside them stops the task, reported.

2. Write the failing test, in `tests/station-gate-send.test.js`:

   ```js
   'use strict';
   // The station's two POST /answer paths say they are sending: the floating
   // gate's option and hand-off buttons, and the 懸著的 gate's 送出答案. Each
   // press disables the box's buttons and writes 送出中…; a reply ok leaves
   // them disabled; a refusal, a network error or no reply in 10 seconds gives
   // them back with a line saying it may be pressed again. Driven through the
   // page's own click listener in a vm, the way tests/station-hdl-j.test.js is.
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const vm = require('node:vm');

   const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
   const NOW = Date.parse('2026-10-01T12:00:00.000Z');
   const PK = 'F:\\ws\\alpha';
   const PENDING = { questions: [{ question: 'Q?', options: [{ label: 'A' }, { label: 'B' }] }] };

   // Boot with a fetch the test settles by hand and a setTimeout it fires by hand.
   function boot() {
       const listeners = {}, els = {}, timers = [], fetches = [], aborted = [];
       const el = () => ({ innerHTML: '', textContent: '', className: '', attrs: {}, style: {},
           setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
           hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {} });
       const win = { location: { hash: '#/' }, addEventListener() {}, scrollTo() {}, setInterval: () => 1,
           setTimeout: (fn, ms) => { timers.push({ fn, ms, cleared: false }); return timers.length; },
           clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].cleared = true; },
           navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
           STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: true, nonce: 'N0NCE',
               projects: [{ root: PK, gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
               profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
               sessions: [{ id: 's1', pkey: PK, root: PK, task: 't', state: 'live', route: ['build'], stage: 'build', stages: [], notes: [],
                   claims: [], conflicts: [], burn: 0, backtracks: 0, updated: NOW, started: new Date(NOW).toISOString(), days: [], pending: PENDING }] } };
       const doc = { hidden: false, documentElement: el(), body: el(), title: '', head: { appendChild() {} },
           getElementById: (id) => els[id] || (els[id] = el()), addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
           createElement: el, querySelectorAll: () => [], querySelector: () => null };
       class FakeAbort { constructor() { this.signal = {}; } abort() { aborted.push(true); } }
       const fetchImpl = (url, init) => new Promise((resolve, reject) => { fetches.push({ url, init, resolve, reject }); });
       vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: fetchImpl, AbortController: FakeAbort, module: { exports: {} } });
       const click = (listeners.click || []).filter((fn) => String(fn).includes('[data-tune-notify]'))[0];
       const press = (answers) => click({ target: { closest: (sel) => (sel in answers ? answers[sel] : null) } });
       return { press, timers, fetches, aborted };
   }

   const btn = (attrs) => ({ disabled: false, attrs, getAttribute: (k) => (k in attrs ? attrs[k] : null) });
   // A floating .gc holding two options and the hand-off.
   function gc() {
       const gend = { className: 'gend', textContent: '' };
       const btns = [btn({ 'data-gop': '0' }), btn({ 'data-gop': '1' }), btn({ 'data-gho': '' })];
       const attrs = { 'data-pg-id': 's1', 'data-pg-root': PK };
       return { gend, btns, getAttribute: (k) => (k in attrs ? attrs[k] : null),
           querySelector: (sel) => (sel === '.gend' ? gend : null), querySelectorAll: () => btns };
   }
   const gop = (box) => ({ '[data-gop]': { getAttribute: () => '0', closest: (sel) => (sel === '.gc' ? box : null) } });
   // A 懸著的 gate's .pg with its one question ticked A.
   function pg() {
       const pgr = { className: 'pgr', textContent: '' };
       const send = btn({ 'data-answer': '' });
       const attrs = { 'data-pg-id': 's1', 'data-pg-root': PK };
       const ticked = { value: 'A', checked: true };
       return { pgr, btns: [send], getAttribute: (k) => (k in attrs ? attrs[k] : null),
           querySelector: (sel) => (sel === '.pgr' ? pgr : null),
           querySelectorAll: (sel) => (sel.indexOf('input[name="pg-') === 0 ? [ticked] : [send]) };
   }
   const answer = (box) => ({ '[data-answer]': { closest: (sel) => (sel === '.pg' ? box : null) } });
   const settle = () => new Promise((r) => setImmediate(r));
   const live = (t) => t.filter((x) => !x.cleared && x.ms === 10000);

   test('gop: the press disables every button of the gate and writes 送出中…', () => {
       const b = boot(), box = gc();
       b.press(gop(box));
       assert.deepEqual(box.btns.map((x) => x.disabled), [true, true, true]);
       assert.equal(box.gend.textContent, '送出中…');
   });

   test('gop: the fetch carries an abort signal and a 10-second timer is set', () => {
       const b = boot(), box = gc();
       b.press(gop(box));
       assert.ok(b.fetches[0].init.signal);
       assert.equal(live(b.timers).length, 1);
   });

   test('gop: a reply ok leaves the buttons disabled and clears the timer', async () => {
       const b = boot(), box = gc();
       b.press(gop(box));
       b.fetches[0].resolve({ ok: true, status: 200, text: () => Promise.resolve('answered 1 question(s)') });
       await settle();
       assert.deepEqual(box.btns.map((x) => x.disabled), [true, true, true]);
       assert.equal(box.gend.textContent, '已送出：answered 1 question(s)');
       assert.equal(live(b.timers).length, 0);
   });

   test('gop: a network error gives the buttons back', async () => {
       const b = boot(), box = gc();
       b.press(gop(box));
       b.fetches[0].reject(new Error('down'));
       await settle();
       assert.deepEqual(box.btns.map((x) => x.disabled), [false, false, false]);
       assert.equal(box.gend.className, 'gend bad');
       assert.equal(box.gend.textContent, '送不出去：serve 還在跑嗎？可以再按一次');
   });

   test('gop: a refusal gives the buttons back and keeps the status line', async () => {
       const b = boot(), box = gc();
       b.press(gop(box));
       b.fetches[0].resolve({ ok: false, status: 409, text: () => Promise.resolve('no gate') });
       await settle();
       assert.deepEqual(box.btns.map((x) => x.disabled), [false, false, false]);
       assert.equal(box.gend.textContent, '409 — no gate');
   });

   test('gop: no reply in 10 seconds aborts the fetch and gives the buttons back', async () => {
       const b = boot(), box = gc();
       b.press(gop(box));
       live(b.timers)[0].fn();
       assert.equal(b.aborted.length, 1);
       assert.deepEqual(box.btns.map((x) => x.disabled), [false, false, false]);
       assert.equal(box.gend.textContent, '還沒確認送到：可以再按一次');
       b.fetches[0].reject(new Error('aborted'));
       await settle();
       assert.equal(box.gend.textContent, '還沒確認送到：可以再按一次', 'the abort\'s own rejection writes nothing over it');
   });

   test('answer: the press disables 送出答案 and writes 送出中…', () => {
       const b = boot(), box = pg();
       b.press(answer(box));
       assert.equal(box.btns[0].disabled, true);
       assert.equal(box.pgr.textContent, '送出中…');
   });

   test('answer: no reply in 10 seconds gives 送出答案 back', () => {
       const b = boot(), box = pg();
       b.press(answer(box));
       live(b.timers)[0].fn();
       assert.equal(box.btns[0].disabled, false);
       assert.equal(box.pgr.className, 'pgr bad');
   });

   test('answer: a network error gives 送出答案 back', async () => {
       const b = boot(), box = pg();
       b.press(answer(box));
       b.fetches[0].reject(new Error('down'));
       await settle();
       assert.equal(box.btns[0].disabled, false);
       assert.equal(box.pgr.textContent, '送不出去：serve 還在跑嗎？可以再按一次');
   });
   ```

3. Run it and watch it fail:

   ```sh
   node --test tests/station-gate-send.test.js
   ```

   Expect the 送出中… and disabled assertions to fail.

4. Add the English, in `assets/station/i18n.js`, below `'cmp.couldNotSendServeRunning'`:

   ```js
               'cmp.sending': 'Sending…',
               'cmp.notConfirmedRetry': 'Not confirmed yet: you can press it again',
               'cmp.pressAgain': ' You can press it again.',
   ```

5. Write the helper, in `assets/station/station.js`, replacing `gatePost` (its comment line `// One POST /answer from the floating icon` through its closing brace, `:5570-5589`):

   ```js
       // One POST /answer that says it is on its way. Every button in `box` is
       // disabled and `line` reads 送出中… until the reply. A reply ok leaves
       // them disabled; a refusal, a network error or no reply in SEND_MS gives
       // them back — the server's own gate waits 60 seconds (`gate.station`),
       // so 10 leaves room to press again. The state is kept in `view.pg` under
       // `<id>:send` first, because the poll's redraw replaces `box` and draws
       // from there (`gateCountdownHtml`, `pendingGateHtml`).
       var SEND_MS = 10000;
       function answerPost(id, box, line, cls, form, said, failed) {
           var btns = box.querySelectorAll ? [].slice.call(box.querySelectorAll('[data-gop],[data-gho],[data-answer]')) : [];
           var ac = typeof AbortController === 'function' ? new AbortController() : null, over = false, timer;
           function show(busy, c, t) {
               view.pg[id + ':send'] = { busy: busy, cls: c, text: t };
               btns.forEach(function (b) { b.disabled = busy || c === 'ok'; });
               if (!line) return;
               line.className = cls + (c ? ' ' + c : '');
               line.textContent = t;
           }
           function give(c, t) {
               if (over) return;
               over = true;
               w.clearTimeout(timer);
               show(false, c, t);
           }
           show(true, '', loc('cmp.sending', '送出中…'));
           timer = w.setTimeout(function () {
               give('bad', loc('cmp.notConfirmedRetry', '還沒確認送到：可以再按一次'));
               if (ac) ac.abort();
           }, SEND_MS);
           var init = { method: 'POST', body: form };
           if (ac) init.signal = ac.signal;
           fetch('answer', init).then(function (r) {
               return r.text().then(function (t) {
                   give(r.ok ? 'ok' : 'bad', (r.ok ? said : r.status + ' — ') + t.trim());
               });
           }, function () { give('bad', failed + loc('cmp.pressAgain', '可以再按一次')); });
       }
       // One POST /answer from the floating icon: an option, or the hand-off.
       function gatePost(gc, fill, said) {
           var id = gc.getAttribute('data-pg-id');
           var who = S.sessions.filter(function (x) { return x.id === id; })[0];
           if (!who || !who.pending) return;
           var form = new URLSearchParams();
           form.set('nonce', S.nonce || '');
           form.set('root', gc.getAttribute('data-pg-root'));
           form.set('id', id);
           fill(form, who);
           answerPost(id, gc, gc.querySelector('.gend'), 'gend', form, said, loc('poll.couldNotSendServeRunning', '送不出去：serve 還在跑嗎？'));
       }
   ```

   And in `assets/station/station.js`, in the `[data-answer]` branch, replace only the `fetch('answer', { method: 'POST', body: form }).then(...)` call — from that line through the `});` that closes it, `:5067-5075` — keeping `var form` and its four `form.set` lines above it, with:

   ```js
               answerPost(pg.getAttribute('data-pg-id'), pg, pgr, 'pgr', form, loc('cmp.sentColon', '已送出：'), loc('cmp.couldNotSendServeRunning', '送不出去：serve 還在跑嗎？'));
   ```

6. Draw the state, in `assets/station/station.js`, in `gateCountdownHtml` (`:2418`): after its `var left = ...` line add

   ```js
           var sent = (picked || {})[s.id + ':send'], lock = sent && (sent.busy || sent.cls === 'ok') ? ' disabled' : '';
   ```

   then in the `data-gop` button and the `data-gho` button append `lock` after the attribute (`data-gop="' + i + '"' + lock + '>`, `data-gho' + lock + '>`), and in `assets/station/station.js` replace the closing `'<p class="gend" role="status" aria-live="polite"></p></div>'` with

   ```js
               + '<p class="gend' + (sent && sent.cls ? ' ' + sent.cls : '') + '" role="status" aria-live="polite">' + (sent ? esc(sent.text) : '') + '</p></div>';
   ```

   In `assets/station/station.js`, in `pendingGateHtml` (`:2482`): after `var dis = ...` add

   ```js
           var sent = on[s.id + ':send'], lock = sent && (sent.busy || sent.cls === 'ok');
   ```

   change the button's `(got.missing ? ' disabled' : '')` to `(got.missing || lock ? ' disabled' : '')`, and in `assets/station/station.js` its result line `'<div class="pgr" role="status" aria-live="polite"></div>'` to

   ```js
                   + '<div class="pgr' + (sent && sent.cls ? ' ' + sent.cls : '') + '" role="status" aria-live="polite">' + (sent ? esc(sent.text) : '') + '</div>'
   ```

7. Write the renderer test, in `tests/station-gate-send-render.test.js`:

   ```js
   'use strict';
   // A poll redraw while a POST /answer is out draws the gate from
   // `view.pg[<id>:send]`: buttons disabled while busy or after an ok, enabled
   // after a failure, and the status line carrying the send's own text.
   const test = require('node:test');
   const assert = require('node:assert/strict');

   global.window = { STATION: { serve: true } };
   const V = require('../assets/station/station.js');

   const NOW = Date.UTC(2026, 8, 26, 1, 0, 0);
   const one = [{ question: 'Q?', header: 'h', multiSelect: false, options: [{ label: 'A', description: '' }, { label: 'B', description: '' }] }];
   const two = [one[0], { question: 'R?', header: 'r', multiSelect: false, options: [{ label: 'C', description: '' }] }];
   const held = (questions) => ({ id: 's1', root: '/r', project: 'p', stage: 'build', task: 't', pending: { questions, at: NOW - 10000, until: NOW + 50000 } });
   const all = { 's1:0': ['A'], 's1:1': ['C'] };

   test('float: a busy send draws every option and the hand-off disabled, and the line reads its text', () => {
       const html = V.gateCountdownHtml(held(one), NOW, { 's1:send': { busy: true, cls: '', text: '送出中…' } });
       assert.match(html, /data-gop="0" disabled>/);
       assert.match(html, /data-gop="1" disabled>/);
       assert.match(html, /data-gho disabled>/);
       assert.match(html, /<p class="gend" role="status" aria-live="polite">送出中…<\/p>/);
   });

   test('float: an ok send stays disabled; a failed one is enabled with class gend bad', () => {
       assert.match(V.gateCountdownHtml(held(one), NOW, { 's1:send': { busy: false, cls: 'ok', text: '已送出：x' } }), /data-gop="0" disabled>/);
       const bad = V.gateCountdownHtml(held(one), NOW, { 's1:send': { busy: false, cls: 'bad', text: '還沒確認送到：可以再按一次' } });
       assert.match(bad, /data-gop="0">/);
       assert.match(bad, /<p class="gend bad" role="status" aria-live="polite">還沒確認送到：可以再按一次<\/p>/);
   });

   test('float: with no send the gate draws as before', () => {
       const html = V.gateCountdownHtml(held(one), NOW, {});
       assert.match(html, /data-gop="0">/);
       assert.match(html, /<p class="gend" role="status" aria-live="polite"><\/p>/);
   });

   test('form: a busy send disables 送出答案 even with every question answered', () => {
       const html = V.pendingGateHtml(held(two), Object.assign({ 's1:send': { busy: true, cls: '', text: '送出中…' } }, all));
       assert.match(html, /data-answer disabled>/);
       assert.match(html, /<div class="pgr" role="status" aria-live="polite">送出中…<\/div>/);
   });

   test('form: a failed send leaves 送出答案 enabled when every question is answered', () => {
       const html = V.pendingGateHtml(held(two), Object.assign({ 's1:send': { busy: false, cls: 'bad', text: 'x' } }, all));
       assert.match(html, /data-answer>/);
       assert.match(html, /<div class="pgr bad"/);
   });
   ```

8. In `tests/station-hdl-k.test.js`, the network-error line now ends `可以再按一次`: change both assertions, `:279` and `:344`, from `'送不出去：serve 還在跑嗎？'` to `'送不出去：serve 還在跑嗎？可以再按一次'`, and the two test names above them (`:276`, `:343`) to say `送不出去：serve 還在跑嗎？可以再按一次`.

9. Run it and watch it pass, then the suites it must not break:

   ```sh
   node --test tests/station-gate-send.test.js tests/station-gate-send-render.test.js tests/station-hdl-j.test.js tests/station-hdl-k.test.js tests/station-float.test.js tests/station-answer.test.js
   ```

10. Commit:

   ```sh
   git add assets/station/station.js assets/station/i18n.js tests/station-gate-send.test.js tests/station-gate-send-render.test.js tests/station-hdl-k.test.js
   git commit -m "fix: a station gate button says it is sending and comes back after 10s or an error"
   ```

## Task 2: The commit seam is a known limit; drive.js's first run has its task

**Files:**
- Modify: `docs/90-agent/reference/subagents.md:935` — the 在哪提交 seam's `Seen:` line gains the ruling
- Modify: `docs/90-agent/todo/session-2.md` — `state: ready`, the timing and group lines go, the body records the pick
- Test: none — `node scripts/todo-check.js` and `node scripts/docs-check.js` are the checks

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — two markdown edits whose words are given here.

1. In `docs/90-agent/reference/subagents.md`, append to the end of line 935 (the `Seen:` line):

   ```md
    Ruled 2026-10-15: `commit.js` commits in the repository of its cwd, by design, and a task whose `project` is not the cwd is a known limit rather than an open seam — run its commit from that project's directory.
   ```

2. In `docs/90-agent/todo/session-2.md`, change `state: blocked` to `state: ready`, delete the `group:`, `timing:` and `stamp:` lines, and append to the body:

   ```md

   2026-10-15 盤點：使用者選了第一個交給 drive.js 的任務——一個小型文件或測試任務，用 `--max-rounds 2 --max-usd 2` 跑，順便回答 acceptEdits 能否寫 `.fankeel/build/`。
   ```

3. Check, then commit:

   ```sh
   node scripts/todo-check.js
   node scripts/docs-check.js --role reference
   git add docs/90-agent/reference/subagents.md docs/90-agent/todo/session-2.md
   git commit -m "docs: the commit seam is a known limit, and drive.js's first run is ready"
   ```

## Task 3: Re-stamp the Blocked entries checked 2026-10-15 (1 of 4)

**Files:**
- Modify: `docs/90-agent/todo/audit-1.md` — `stamp: 2026-10-15`
- Modify: `docs/90-agent/todo/build-1.md` — `stamp: 2026-10-15`
- Modify: `docs/90-agent/todo/docs-1.md` — `stamp: 2026-10-15`
- Test: none — `node scripts/todo-check.js` is the check

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — a one-line frontmatter change per file.

1. Change each file's `stamp:` line:

   ```sh
   sed -i 's/^stamp: .*/stamp: 2026-10-15/' docs/90-agent/todo/audit-1.md docs/90-agent/todo/build-1.md docs/90-agent/todo/docs-1.md
   node scripts/todo-check.js
   ```

2. Commit:

   ```sh
   git commit -o docs/90-agent/todo/audit-1.md docs/90-agent/todo/build-1.md docs/90-agent/todo/docs-1.md -m "docs: re-stamp three Blocked entries checked in the 10-15 patrol"
   ```

## Task 4: Re-stamp the Blocked entries checked 2026-10-15 (2 of 4)

**Files:**
- Modify: `docs/90-agent/todo/effort-1.md` — `stamp: 2026-10-15`
- Modify: `docs/90-agent/todo/foreign-1.md` — `stamp: 2026-10-15`
- Modify: `docs/90-agent/todo/model-4.md` — `stamp: 2026-10-15`
- Test: none — `node scripts/todo-check.js` is the check

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — a one-line frontmatter change per file.

1. Change each file's `stamp:` line:

   ```sh
   sed -i 's/^stamp: .*/stamp: 2026-10-15/' docs/90-agent/todo/effort-1.md docs/90-agent/todo/foreign-1.md docs/90-agent/todo/model-4.md
   node scripts/todo-check.js
   ```

2. Commit:

   ```sh
   git commit -o docs/90-agent/todo/effort-1.md docs/90-agent/todo/foreign-1.md docs/90-agent/todo/model-4.md -m "docs: re-stamp three more Blocked entries checked in the 10-15 patrol"
   ```

## Task 5: Re-stamp the Blocked entries checked 2026-10-15 (3 of 4)

**Files:**
- Modify: `docs/90-agent/todo/quota-1.md` — `stamp: 2026-10-15`
- Modify: `docs/90-agent/todo/security-1.md` — `stamp: 2026-10-15`
- Modify: `docs/90-agent/todo/spend-2.md` — `stamp: 2026-10-15`
- Test: none — `node scripts/todo-check.js` is the check

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — a one-line frontmatter change per file.

1. Change each file's `stamp:` line:

   ```sh
   sed -i 's/^stamp: .*/stamp: 2026-10-15/' docs/90-agent/todo/quota-1.md docs/90-agent/todo/security-1.md docs/90-agent/todo/spend-2.md
   node scripts/todo-check.js
   ```

2. Commit:

   ```sh
   git commit -o docs/90-agent/todo/quota-1.md docs/90-agent/todo/security-1.md docs/90-agent/todo/spend-2.md -m "docs: re-stamp three more Blocked entries checked in the 10-15 patrol"
   ```

## Task 6: Re-stamp the Blocked entries checked 2026-10-15 (4 of 4)

**Files:**
- Modify: `docs/90-agent/todo/stage-agents-10.md` — `stamp: 2026-10-15`
- Modify: `docs/90-agent/todo/stage-agents-16.md` — `stamp: 2026-10-15`
- Test: none — `node scripts/todo-check.js` is the check

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — a one-line frontmatter change per file.

1. Change each file's `stamp:` line:

   ```sh
   sed -i 's/^stamp: .*/stamp: 2026-10-15/' docs/90-agent/todo/stage-agents-10.md docs/90-agent/todo/stage-agents-16.md
   node scripts/todo-check.js
   ```

2. Commit:

   ```sh
   git commit -o docs/90-agent/todo/stage-agents-10.md docs/90-agent/todo/stage-agents-16.md -m "docs: re-stamp the last two Blocked entries checked in the 10-15 patrol"
   ```

## Coverage

| promise | task |
|---|---|
| 點下去時，該 gate 內每個 .gop 與「送出答案」按鈕都 disable，並在 .gend 顯示處理中狀態 | Task 1 |
| 以 AbortController 設逾時（建議 10 秒，遠小於 gate.station 的 60 秒） | Task 1 |
| 逾時或錯誤時重新啟用按鈕，並在 .gend 說明尚未確認送達、可以再按一次 | Task 1 |
| 成功時維持 disabled | Task 1 |
| 選項點擊與整表單兩條路徑都要套用 | Task 1 |
| tests/ 下有測試涵蓋送出期間 disabled、逾時後重新啟用、錯誤後重新啟用 | Task 1 |
| 成功時維持 disabled — across the poll's redraw too | Task 1 (Steps 6–7) |
| 並實際打開真的站上頁面看過 | struck — not a build task; verify opens the served station page with a held gate |
| survey gate: commit.js 照 cwd 記為已知限制 | Task 2; the entry itself is closed at land with `todo.js done stage-agents-8 --sha <Task 2's sha>`, and station-25 with Task 1's |
| survey gate: drive 首跑用小型文件或測試任務 | Task 2 |
| survey gate: Blocked 戳記重蓋 2026-10-15 | Tasks 3–6 |
| survey gate: test-1 / test-4 繼續觀察 | struck — no change, by the ruling |
