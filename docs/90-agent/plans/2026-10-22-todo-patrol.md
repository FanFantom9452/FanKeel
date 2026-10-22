---
status: design-intent
---

# TODO Patrol 2026-10-22 Implementation Plan

**Goal:** close the eight Ready entries survey marked `do now`, plus the two Needs-a-decision entries the user decided at the survey gate, and take the docs and settings page mockups to an approved state.
**Architecture:** ten independent small fixes, each in the module the entry already names, each with its own test; two hands-on tasks for the user last. No new module.
**Tech Stack:** Node built-ins only (`node:test`, `node:assert/strict`, `node:vm`, `node:child_process`); no dependency may be added.
**Spec:** [survey.md](../../../.fankeel/build/task-20261022T113839/survey.md)

The user's survey-gate answers, which this plan argues from alongside the spec:

- plan all eight `do now` entries.
- stage-2 (各站交接改為帶入有大小上限的事實檔): every stage embeds the capped context.md and every stage writes facts before its handoff. The embedding already ships (`lib/render.js:610` and `:839` inline the content into both brief kinds; `tests/render-context-inline.test.js:51-82` proves a brief carries the facts a previous stage recorded), so what is left is the warning at `scripts/task.js:1025` that only fires leaving survey or plan.
- station-47: a separate, answerable group on the phone home page for a session that stopped while its gate still holds, plus a route test.
- station-38 / station-39: the user approves the two mockups block by block first; porting into `assets/station/` follows as its own work.

## Global Constraints

- From `.fankeel/map.md` (`node scripts/map.js`): 1174 markdown files, 3 planned-not-built, 357 retired, 50 undeclared. Plans live in `docs/90-agent/plans/` (role `plan`), references in `docs/90-agent/reference/` (role `reference`, must match the code).
- 4-space indentation in `lib/`, `scripts/`, `hooks/`, `assets/` and most tests; `tests/stop.test.js` uses 2 spaces — match the file being edited.
- `'use strict';` heads every Node file. Browser scripts in `assets/station/` are ES5 (`var`, `function`), no arrow functions, no `let`/`const`.
- `assets/station/station.js` `focusBoot` may use only `w.*` and hoisted function declarations (`assets/station/station.js:2920-2924`).
- Every string in `assets/station/mobile.js` goes through `STR` (`:17`) in both `zh` and `en`; `tests/station-mobile-page.test.js:171` requires identical key sets and no CJK in `en`.
- `tests/skill-size.test.js:25` caps `skills/fankeel-explain/SKILL.md` at 4400 bytes (currently 4355).
- `tests/cjk-docs.test.js:19` pins the sentence "A slip the reader never saw is not news." in the explain skill — do not edit it.
- An implementer runs only its own test file; the parent runs `node scripts/suite.js --fast` before committing a group.
- `CHAT_KEEP = 200`, `TEXT_MAX = 8000` (`lib/phone.js:14-15`); `CAP = 40` facts (`scripts/context.js:24`).
- The notify send rule is `lib/notify.js:79-82`: a trigger `notify.<kind> === true`, a non-empty `notify.topic`, a `notify.server` matching `/^https?:\/\//`. A TODO entry never carries a real topic value.

## Risks

- `pendingWork` fixtures carry no `timestamp` — Task 1 — an entry with no parseable timestamp keeps today's behaviour (pending), so the existing `tests/stop.test.js` cases stay green; the test runs first unchanged.
- Narrowing the vm member scan could hide a real export some test reaches by another sandbox shape — Task 4 — run the whole `tests/source.test.js` file, not just the changed test, and grep `tests/` for `runInNewContext` shapes other than `*.module.exports.<name>` before narrowing.
- Widening the context.md warning could change output a snapshot test pins — Task 9 — `grep -rn "context.md has no facts" tests/` first; the only negative pin is `tests/context-facts-required.test.js:95-101`.
- The `configDir` variable may not be in scope at the `/station/mobile.json` handler — Task 7 — read `scripts/station.js:295-310` first; `const configDir = opts.configDir || live.liveConfigDir();` at `:303` is the one to use.
- A stopped session's chat screen finds its row only in `m.tasks` (`assets/station/mobile.js:461-467`) — Task 8 — the route test opens `#/s/<id>` for the stopped session and asserts the question renders.
- `gate-frame.js`'s `.gt-more` may also be redrawn closed — Task 6 — out of scope here; Task 11 is where the user would see it, and a finding there becomes a TODO.

## Task 1: Stop hook stops counting a dead background job as pending (stop-1)

**Files:**
- Modify: `lib/stop.js` — `pendingWork` keeps a launch time per id, drops an errored launch and one older than `STALE_MS`
- Test: `tests/stop.test.js`

**Interfaces:**
- Consumes: none
- Produces: `pendingWork(list, now)` — `now` optional, defaults to `Date.now()`; `STALE_MS` exported

**Dispatch:** implementer, sonnet — the code is below; transcription plus tests.

Decision recorded for the entry's open question: Monitor and ScheduleWakeup stay uncounted — the hook refuses once and `stop_hook_active` lets the second stop through, so the cost is one extra nudge.

Steps:

1. Write the failing tests. In `tests/stop.test.js`, after the `note` helper (line ~15), add:

```js
const at = (entry, iso) => Object.assign(entry, { timestamp: iso });

test('a background Bash launched over STALE_MS ago with no notification is no longer pending', () => {
  const launch = at(bg('toolu_old'), '2026-10-22T10:00:00.000Z');
  const list = [user('go'), launch, user([{ type: 'tool_result', tool_use_id: 'toolu_old', content: 'Command running in background' }])];
  const now = Date.parse('2026-10-22T10:00:00.000Z') + STALE_MS + 1;
  assert.equal(pendingWork(list, now), false);
  assert.equal(pendingWork(list, now - 2), true);
});

test('a background Bash whose launch result is an error is not pending', () => {
  const list = [user('go'), bg('toolu_err'), user([{ type: 'tool_result', tool_use_id: 'toolu_err', is_error: true, content: 'killed' }])];
  assert.equal(pendingWork(list), false);
});
```

and change the require at the top of `tests/stop.test.js` to take `STALE_MS` too:

```js
const { pendingWork, refusal, STALE_MS } = require('../lib/stop.js');
```

2. Run `node --test tests/stop.test.js` and watch both fail.
3. In `lib/stop.js`, under `const NOTIFIED = ...`, add:

```js
// A background job the harness never reported on — killed, or lost — would
// otherwise hold this check open for the rest of the session (stop-1). Past
// this long since its launch it no longer counts; a launch with no readable
// timestamp keeps counting, as before.
const STALE_MS = 60 * 60 * 1000;
```

4. In `lib/stop.js`, replace `pendingWork` with:

```js
function pendingWork(list, now) {
    const clock = typeof now === 'number' ? now : Date.now();
    const launched = new Map();
    const agents = new Set();
    let sentAt = -1;
    let notifiedAt = -1;
    list.forEach((entry, i) => {
        if (!entry || entry.isSidechain) return;
        const when = Date.parse(entry.timestamp);
        const queued = entry.attachment && entry.attachment.prompt;
        if (typeof queued === 'string' && queued.includes('<task-notification>')) {
            for (const m of queued.matchAll(NOTIFIED)) launched.delete(m[1].trim());
            notifiedAt = i;
        }
        for (const b of blocks(entry)) {
            if (!b || typeof b !== 'object') continue;
            if (entry.type === 'assistant' && b.type === 'tool_use') {
                const input = b.input || {};
                if ((b.name === 'Bash' || b.name === 'PowerShell') && input.run_in_background === true) launched.set(b.id, when);
                else if (b.name === 'Agent') agents.add(b.id);
                else if (b.name === 'SendMessage') sentAt = i;
            } else if (entry.type === 'user' && b.type === 'tool_result') {
                if (b.is_error === true) launched.delete(b.tool_use_id);
                else if (agents.has(b.tool_use_id) && ASYNC_AGENT.test(textOf(b.content))) launched.set(b.tool_use_id, when);
            } else if (entry.type === 'user' && b.type === 'text' && b.text.includes('<task-notification>')) {
                for (const m of b.text.matchAll(NOTIFIED)) launched.delete(m[1].trim());
                notifiedAt = i;
            }
        }
    });
    for (const [id, when] of launched) if (Number.isFinite(when) && clock - when > STALE_MS) launched.delete(id);
    return launched.size > 0 || sentAt > notifiedAt;
}
```

and change the export to `module.exports = { STALE_MS, pendingWork, refusal };`.

5. Run `node --test tests/stop.test.js` and watch it pass.
6. Replay the entry's case: `node -e "const s=require('./lib/stop.js');const fs=require('fs');const l=fs.readFileSync(process.argv[1],'utf8').split('\n').slice(0,875).filter(Boolean).map(x=>{try{return JSON.parse(x)}catch(e){return null}}).filter(Boolean);console.log(s.pendingWork(l, Date.now())?'pending':'block')" C:/Users/user/.claude/projects/F--ymlab-fankeel/198a8e58-f383-465a-8b51-3d93fb0706f6.jsonl` prints `block`.
7. Commit: `fix: a background job never reported on stops holding the Stop check (stop-1)`.

## Task 2: One Stop reply lands once in the phone chat (station-46)

**Files:**
- Modify: `hooks/stop.js` — skip the assistant append when the last spoken chat line is the same assistant text
- Test: `tests/phone-stop.test.js`

**Interfaces:**
- Consumes: `phone.chat(root, sid, 0)` — every entry, oldest first
- Produces: none

**Dispatch:** implementer, sonnet — the code is below; transcription plus tests.

Steps:

1. Write the failing test. In `tests/phone-stop.test.js`, after the first test, add:

```js
test('the same reply from two Stops lands once; a repeat after a new message lands again', () => {
    const p = project(false);
    fire(p, { last_assistant_message: 'same' });
    fire(p, { last_assistant_message: 'same' });
    assert.deepEqual(phone.chat(p.root, SID, 0).map((x) => [x.role, x.text]), [['assistant', 'same']]);
    phone.append(p.root, SID, { role: 'phone', text: 'again?', at: Date.now() });
    fire(p, { last_assistant_message: 'same' });
    assert.deepEqual(phone.chat(p.root, SID, 0).map((x) => x.role), ['assistant', 'phone', 'assistant']);
});
```

2. Run `node --test tests/phone-stop.test.js` and watch it fail on the first `deepEqual`.
3. In `hooks/stop.js`, replace the `try` block at lines 47-50 with:

```js
    try {
        const reply = String(payload.last_assistant_message || '');
        // A Stop that fires twice for one turn must not draw two bubbles
        // (station-46): the last spoken line already saying it is enough.
        const spoken = phone.chat(root, sid, 0).filter((x) => x.role === 'desktop' || x.role === 'phone' || x.role === 'assistant');
        const last = spoken[spoken.length - 1];
        const same = last && last.role === 'assistant' && (last.text === reply || (reply.length > 8000 && last.text === reply.slice(0, 8000) + '…'));
        if (!same) phone.append(root, sid, { role: 'assistant', text: reply, at: now });
        phone.writeBackground(root, sid, payload.background_tasks, now);
    } catch (e) { /* housekeeping */ }
```

4. Run `node --test tests/phone-stop.test.js` and watch it pass.
5. Commit: `fix: a Stop that fires twice draws one phone bubble (station-46)`.

## Task 3: Concurrent chat.jsonl appends keep both lines (station-45)

**Files:**
- Modify: `lib/phone.js` — `append` takes a `suitelock` lock around append, read and trim
- Read: `lib/suitelock.js` — `acquire({ file, pollMs, maxAgeMs })` returns `{ release }`
- Test: `tests/phone.test.js`

**Interfaces:**
- Consumes: `acquire` from `lib/suitelock.js:147`
- Produces: none — `append`'s signature is unchanged

**Dispatch:** implementer, sonnet — the code is below; transcription plus tests.

Steps:

1. Write the failing test. In `tests/phone.test.js`, after the append test, add:

```js
test('two processes appending to a full chat.jsonl both keep their line', () => {
    const { spawn } = require('node:child_process');
    const root = tmp('fankeel-phone-race-');
    for (let i = 0; i < 200; i++) phone.append(root, SID, { role: 'desktop', text: String(i), at: i });
    const script = (tag) => 'const p=require(' + JSON.stringify(require.resolve('../lib/phone.js')) + ');'
        + 'for(let i=0;i<40;i++)p.append(' + JSON.stringify(root) + ',' + JSON.stringify(SID) + ',{role:"desktop",text:"' + tag + '"+i,at:i});';
    const run = (tag) => new Promise((done) => spawn(process.execPath, ['-e', script(tag)]).on('exit', done));
    return Promise.all([run('a'), run('b')]).then(() => {
        const texts = phone.chat(root, SID, 0).map((x) => x.text);
        assert.equal(texts.length, 200);
        assert.ok(texts.includes('a39') && texts.includes('b39'), texts.slice(-4).join(','));
        assert.equal(texts.filter((t) => /^[ab]\d+$/.test(t)).length, 80);
    });
});
```

2. Run `node --test tests/phone.test.js` and watch it fail (fewer than 80 tagged lines).
3. In `lib/phone.js`, under `const registry = require('./registry.js');`, add:

```js
const { acquire } = require('./suitelock.js');
```

and in `lib/phone.js`, under `const SPOKEN = ...`, add:

```js
// chat.jsonl is written by the Stop hook, the inject hook and the station at
// once; append, read and trim run under one lock so a line appended between
// another writer's read and its rename is not dropped (station-45).
const LOCK_MS = 3000;
```

4. In `lib/phone.js`, replace `append` with:

```js
function append(root, sid, entry) {
    const file = fileOf(root, sid, 'chat.jsonl');
    if (!file || !entry || !ROLES.has(entry.role)) return false;
    const line = Object.assign({}, entry);
    if (typeof line.text === 'string' && line.text.length > TEXT_MAX) line.text = line.text.slice(0, TEXT_MAX) + '…';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const lock = acquire({ file: file + '.lock', pollMs: 10, maxAgeMs: LOCK_MS });
    try {
        fs.appendFileSync(file, JSON.stringify(line) + '\n');
        const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
        if (lines.length > CHAT_KEEP) registry.writeAtomic(file, lines.slice(-CHAT_KEEP).join('\n') + '\n');
    } finally {
        lock.release();
    }
    return true;
}
```

5. Run `node --test tests/phone.test.js` and watch it pass.
6. Commit: `fix: chat.jsonl appends and trims under one lock (station-45)`.

## Task 4: The vm comparison test can go red (test-vm-1)

**Files:**
- Modify: `tests/source.test.js` — the vm branch of `importIndex` counts only `module.exports.<name>`, and the fixture gains a decoy
- Test: `tests/source.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the code is below; transcription plus tests.

Steps:

1. Before narrowing: `grep -rn "runInNewContext\|runInContext" tests/ | grep -v source.test.js` — confirm every sandbox in `tests/` is read back through `<box>.module.exports.<name>` or through a `window`/`w` object the vm branch does not need; list any that is not in the commit message.
2. Write the failing fixture. In `tests/source.test.js`, in the test at lines 164-176, change the last line of `viaVm` so the fixture carries a dotted name that is not a sandbox export:

```js
        + 'box.module.exports.onlyVm();\n'
        + 'const note = other.neverCalled;\n';
```

3. Run `node --test tests/source.test.js` and watch `assert.ok(!vmTarget.has('neverCalled'))` fail.
4. In `tests/source.test.js`, in the vm branch at line ~99, replace

```js
                const member = /\.([A-Za-z_$][\w$]*)/g;
```

with, in `tests/source.test.js`:

```js
                // Only what the sandbox's own exports reach counts — a dotted
                // name elsewhere in the test is not loaded through it (test-vm-1).
                const member = /\bmodule\.exports\.([A-Za-z_$][\w$]*)/g;
```

5. Run `node --test tests/source.test.js` and watch the whole file pass.
6. Check it can go red: revert step 4 alone, rerun, see the `neverCalled` assertion fail; restore it.
7. Commit: `test: the vm comparison counts sandbox exports only and can fail (test-vm-1)`.

## Task 5: Tailscale warnings point at the guide (station-44)

**Files:**
- Modify: `lib/tailscale.js` — the MagicDNS warning names the admin page and the guide
- Modify: `scripts/task.js:1240-1255` — the `station.remote` refusal names the guide
- Modify: `scripts/phone.js` — `attach` refuses with the guide path while `station.remote` is off
- Test: `tests/tailscale.test.js`
- Test: `tests/profile-confirm.test.js`
- Test: `tests/phone-cli.test.js`

**Interfaces:**
- Consumes: `profile.read(null, configDir).values`, `profile.machineFile(configDir)`, `live.liveConfigDir()`
- Produces: `main(argv, opts)` in `scripts/phone.js` — `opts.configDir` optional, defaults to `live.liveConfigDir()`

**Dispatch:** implementer, sonnet — the code is below; transcription plus tests.

Steps:

1. Write the failing tests. In `tests/tailscale.test.js`, after line 49 (`assert.match(nameless.warning, /MagicDNS/);`), add:

```js
    assert.match(nameless.warning, /login\.tailscale\.com\/admin\/dns/);
    assert.match(nameless.warning, /docs\/01-guide\/tailscale-setup\.md/);
```

In `tests/profile-confirm.test.js`, after line 30, add:

```js
    assert.match(got.out, /docs\/01-guide\/tailscale-setup\.md/);
```

In `tests/phone-cli.test.js`, add at the top:

```js
const path = require('node:path');
const profile = require('../lib/profile.js');

function cfg(remote) {
    const dir = tmp('fankeel-phone-cfg-');
    if (remote) assert.equal(profile.write(profile.machineFile(dir), 'station.remote', 'true').ok, true);
    return dir;
}
```

change the attach call in the first test to `main(['attach', '--session', SID, '--root', root], { configDir: cfg(true) })`, and add to `tests/phone-cli.test.js`:

```js
test('attach while station.remote is off is refused with the guide path', () => {
    const root = project();
    const a = main(['attach', '--session', SID, '--root', root], { configDir: cfg(false) });
    assert.equal(a.code, 1);
    assert.match(a.text, /station\.remote/);
    assert.match(a.text, /docs\/01-guide\/tailscale-setup\.md/);
    assert.equal(phone.isAttached(root, SID), false);
});
```

2. Run `node --test tests/tailscale.test.js tests/profile-confirm.test.js tests/phone-cli.test.js` and watch the new assertions fail.
3. In `lib/tailscale.js`, replace line 48 with:

```js
    if (!name) return { ok: false, warning: 'this machine has no MagicDNS name: turn on MagicDNS and HTTPS certificates at https://login.tailscale.com/admin/dns — see docs/01-guide/tailscale-setup.md' };
```

4. In `scripts/task.js`, re-read line 1248 and append to the end of its `fail(` string, inside the quotes and before `');`, the sentence `設定步驟見 docs/01-guide/tailscale-setup.md。` — match the line's fullwidth punctuation exactly.
5. In `scripts/phone.js`, under `const phone = require('../lib/phone.js');`, add:

```js
const profile = require('../lib/profile.js');
const live = require('../lib/live.js');

const GUIDE = 'docs/01-guide/tailscale-setup.md';
```

change `function main(argv) {` to `function main(argv, opts) {`, and in `scripts/phone.js` replace the line `phone.attach(root, sid, 'desktop', Date.now());` with:

```js
    // The phone reaches the station only through Tailscale; attaching while
    // station.remote is off would hold the session for a phone that cannot
    // connect (station-44).
    const configDir = (opts && opts.configDir) || live.liveConfigDir();
    if (profile.read(null, configDir).values['station.remote'] !== true) {
        return { text: 'phone: station.remote is off, so no phone can reach this machine — turn it on as ' + GUIDE + ' describes, then attach again', code: 1 };
    }
    phone.attach(root, sid, 'desktop', Date.now());
```

6. Run the three test files again and watch them pass.
7. Commit: `fix: Tailscale warnings and the phone refusal name the setup guide (station-44)`.

## Task 6: Folds on the gate page survive the 5-second redraw (station-37)

**Files:**
- Modify: `assets/station/station.js:2900-2990` — `keepOpen` and a click listener on `#focus` in `focusBoot`, export `keepOpen`
- Modify: `assets/station/station.js:4800-4830` — `gateRest` and `gatePatrol` carry `data-gv`
- Test: `tests/station-focus-page.test.js`
- Test: `tests/station-gate-tab.test.js` — two regexes pin the old `gv-more` markup

**Interfaces:**
- Consumes: none
- Produces: `keepOpen(html, open)` — `open` is `{ [key]: boolean }`; returns `html` with ` open` added to each `<details class="gv-more" data-gv="<key>"` whose key is true

**Dispatch:** implementer, sonnet — the code is below; transcription plus tests.

Steps:

1. Write the failing tests. In `tests/station-focus-page.test.js`, extend `focusDom()`'s `focus` object with a listener list — replace its line 84 with:

```js
    const clicks = [];
    const focus = { innerHTML: '', addEventListener: (type, fn) => { if (type === 'click') clicks.push(fn); }, classList: { toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); }, contains: (c) => cls.has(c) } };
```

and return `clicks` from it (`return { focus, asked, heads, ticks, listened, win, waits, clicks };`). Then add to `tests/station-focus-page.test.js`:

```js
test('keepOpen marks the folds the reader opened and leaves the rest', () => {
    const html = '<details class="gv-more" data-gv="rest"><summary>a</summary></details><details class="gv-more" data-gv="patrol"><summary>b</summary></details>';
    const out = V.keepOpen(html, { rest: true, patrol: false });
    assert.match(out, /data-gv="rest" open>/);
    assert.doesNotMatch(out, /data-gv="patrol" open/);
});

test('the focus page listens for clicks on #focus, not on the document', () => {
    const d = focusDom();
    assert.equal(d.clicks.length, 1);
    assert.deepEqual(d.listened, []);
    const details = { open: false, getAttribute: (k) => (k === 'data-gv' ? 'rest' : null) };
    d.clicks[0]({ target: { closest: () => ({ parentNode: details }) } });
    assert.equal(typeof d.focus.innerHTML, 'string');
});

test('gateRest and gatePatrol carry a data-gv key', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
    assert.match(src, /<details class="gv-more" data-gv="rest">/);
    assert.match(src, /<details class="gv-more" data-gv="patrol" data-block="gate-patrol">/);
});
```

2. Run `node --test tests/station-focus-page.test.js` and watch the three fail.
3. In `assets/station/station.js`, directly above `function focusBoot() {`, add:

```js
    // A <details> on the focus page the reader opened stays open through the
    // 5 s repaint, which rewrites the whole page (station-37). Only the
    // report's folds carry a data-gv key; the rest are short.
    function keepOpen(html, open) {
        return String(html).replace(/<details class="gv-more" data-gv="([a-z]+)"/g, function (m, k) { return open[k] ? m + ' open' : m; });
    }
```

4. In `assets/station/station.js`, in `focusBoot`, replace the line `var paint = function () { el.innerHTML = focusPageHtml(S, w.STATION_DETAIL, F); };` with:

```js
        var open = {};
        if (el.addEventListener) el.addEventListener('click', function (e) {
            var t = e.target, sm = t && typeof t.closest === 'function' ? t.closest('details[data-gv] > summary') : null;
            if (sm && sm.parentNode) open[sm.parentNode.getAttribute('data-gv')] = !sm.parentNode.open;
        });
        var paint = function () { el.innerHTML = keepOpen(focusPageHtml(S, w.STATION_DETAIL, F), open); };
```

5. In the `module.exports = {` block at line ~2952, add `keepOpen: keepOpen,` beside `focusPageHtml: focusPageHtml,`.
6. In `gateRest` (line ~4809), change `'<details class="gv-more"><summary>'` to `'<details class="gv-more" data-gv="rest"><summary>'`; in `gatePatrol` (line ~4823), change `'<details class="gv-more" data-block="gate-patrol"><summary>'` to `'<details class="gv-more" data-gv="patrol" data-block="gate-patrol"><summary>'`.
7. In `tests/station-gate-tab.test.js`, line 78, change `<details class="gv-more"><summary>報告其餘` to `<details class="gv-more" data-gv="rest"><summary>報告其餘`; line 208, change `<details class="gv-more" data-block="gate-patrol">` to `<details class="gv-more" data-gv="patrol" data-block="gate-patrol">`.
8. Run `node --test tests/station-focus-page.test.js tests/station-gate-tab.test.js` and watch both pass.
9. Commit: `fix: gate page folds stay open through the focus repaint (station-37)`.

## Task 7: A subscribe button on the phone home page (station-41)

**Files:**
- Modify: `lib/mobile.js` — `subscribeOf(values)`
- Modify: `scripts/station.js:790-805` — `/station/mobile.json` carries `notify`
- Modify: `assets/station/mobile.js` — the header draws the button when `m.notify` is set
- Test: `tests/mobile-model.test.js`
- Test: `tests/station-mobile-page.test.js`

**Interfaces:**
- Consumes: `profile.read(null, configDir).values` in `scripts/station.js`
- Produces: `subscribeOf(values)` → `{ app: 'ntfy://<host>/<topic>', web: '<server>/<topic>' }` or `null`; `/station/mobile.json` gains `notify` (that object or `null`)

**Dispatch:** implementer, sonnet — the code is below; transcription plus tests.

Steps:

1. Write the failing tests. In `tests/mobile-model.test.js`, add:

```js
test('subscribeOf: an app link and a web link only when a trigger is on, a topic is set and the server is http(s)', () => {
    const v = { 'notify.gate': true, 'notify.topic': 'fankeel-test', 'notify.server': 'https://ntfy.sh/' };
    assert.deepEqual(mobile.subscribeOf(v), { app: 'ntfy://ntfy.sh/fankeel-test', web: 'https://ntfy.sh/fankeel-test' });
    assert.equal(mobile.subscribeOf(Object.assign({}, v, { 'notify.gate': false })), null);
    assert.equal(mobile.subscribeOf(Object.assign({}, v, { 'notify.topic': '' })), null);
    assert.equal(mobile.subscribeOf(Object.assign({}, v, { 'notify.server': 'ntfy.sh' })), null);
    assert.equal(mobile.subscribeOf(null), null);
});
```

In `tests/station-mobile-page.test.js`, add:

```js
test('home: a subscribe button opens the ntfy app, with the web topic beside it, only when notify is set', () => {
    const sub = Object.assign({}, HOME, { notify: { app: 'ntfy://ntfy.sh/fankeel-test', web: 'https://ntfy.sh/fankeel-test' } });
    const html = P.screen(sub, P.parseRoute('#/'), NOW, APP);
    assert.match(html, /<a class="ha-sub" href="ntfy:\/\/ntfy\.sh\/fankeel-test">/);
    assert.match(html, /href="https:\/\/ntfy\.sh\/fankeel-test"/);
    assert.doesNotMatch(P.screen(HOME, P.parseRoute('#/'), NOW, APP), /ha-sub/);
});
```

2. Run `node --test tests/mobile-model.test.js tests/station-mobile-page.test.js` and watch both fail.
3. In `lib/mobile.js`, above `module.exports`, add:

```js
// The phone's subscribe button (station-41): shown under the rule
// lib/notify.js sends by — a trigger on, a topic, an http(s) server — so the
// button exists exactly when a notification could arrive.
function subscribeOf(values) {
    const v = values || {};
    const on = ['notify.gate', 'notify.stage', 'notify.end'].some((k) => v[k] === true);
    const topic = typeof v['notify.topic'] === 'string' ? v['notify.topic'].trim() : '';
    const server = typeof v['notify.server'] === 'string' ? v['notify.server'].replace(/\/+$/, '') : '';
    if (!on || !topic || !/^https?:\/\//.test(server)) return null;
    const t = encodeURIComponent(topic);
    return { app: 'ntfy://' + server.replace(/^https?:\/\//, '') + '/' + t, web: server + '/' + t };
}
```

and add `subscribeOf` to its `module.exports`.

4. In `scripts/station.js`, read lines 295-310 to confirm `configDir` is in scope, then replace the `return send(...)` line of the `/station/mobile.json` handler with:

```js
            const body = mobile.mobileModel(model, Date.now(), host, station.hiddenPkeys(model), phone.snapshot);
            body.notify = mobile.subscribeOf(profile.read(null, configDir).values);
            return send(200, 'application/json', JSON.stringify(body), noStore);
```

5. In `assets/station/mobile.js`, add to `STR.zh` beside `'home.hist'`: `'home.sub': '訂閱通知', 'home.subWeb': '網頁',` and to `STR.en`: `'home.sub': 'Get notified', 'home.subWeb': 'Web',`. In `homeHtml`, directly before `return '<div class="pg" data-block="m-home-a">`, add:

```js
        // The ntfy app opens its subscribe dialog from ntfy://; a phone
        // without the app uses the web topic beside it.
        var sub = m.notify && m.notify.app ? '<a class="ha-sub" href="' + esc(m.notify.app) + '">' + t('home.sub') + '</a>'
            + '<a class="ha-sub-web" href="' + esc(m.notify.web) + '" target="_blank" rel="noopener">' + t('home.subWeb') + '</a>' : '';
```

and in the header line (`assets/station/mobile.js:342`) split the literal `'<span class="sp"></span><a class="ha-hist" href="#/done"` into `'<span class="sp"></span>' + sub + '<a class="ha-hist" href="#/done"`, so the button sits after the spacer and before the history link.
6. Run both test files and watch them pass.
7. Commit: `feat: the phone home page offers an ntfy subscribe button (station-41)`.

## Task 8: Stopped sessions still holding a gate get their own group (station-47)

**Files:**
- Modify: `lib/mobile.js` — `mobileModel` returns `stopped`: sessions not live whose gate still holds
- Modify: `assets/station/mobile.js:17-470` — `homeHtml` draws the `stopped` group; `chatHtml` finds a row in it
- Modify: `docs/90-agent/reference/station.md:1505-1587` — the phone page section (`## Reaching the station from a phone`) records the decision
- Test: `tests/mobile-model.test.js`
- Test: `tests/station-mobile-route.test.js`

**Interfaces:**
- Consumes: `held(s, now)` and `rowOf(root, s, now, look)` in `lib/mobile.js`
- Produces: `/station/mobile.json` gains `stopped: [row]`, each row as in `tasks` with `state: 'gate'`

**Dispatch:** implementer, sonnet — the code is below; transcription plus tests.

Steps:

1. Write the failing tests. In `tests/mobile-model.test.js`, add:

```js
test('stopped: a session no longer live whose gate still holds, and nothing else', () => {
    const m = mobile.mobileModel(model([
        row({ sessionId: 'live', pending: waiting(NOW - 60e3, NOW + 30e3) }),
        row({ sessionId: 'gone', state: 'stale', pending: waiting(NOW - 60e3, NOW + 30e3) }),
        row({ sessionId: 'over', state: 'stale', pending: waiting(NOW - 600e3, NOW - 1) }),
    ]), NOW, 'ymlab-pc');
    assert.deepEqual(m.stopped.map((x) => [x.id, x.state]), [['gone', 'gate']]);
    assert.deepEqual(m.tasks.map((x) => x.id), ['live']);
});
```

In `tests/station-mobile-route.test.js`, add a third session id beside `ONE`/`TWO` — `const GONE = 'cccccccc-0000-4000-8000-0000000000c3';` — and a test that writes it held with no live-session file under the config directory's sessions folder:

```js
test('a session that stopped while its gate holds is drawn in its own group on the phone home', () => served(true, async (s) => {
    const data = { task: '手機版測站 stopped', stage: 'plan', route: ['survey', 'plan'], active: true, claims: [],
        started: '2026-10-21T09:00:00.000Z', updated: new Date().toISOString(), configDir: s.cfg };
    registry.writeSession(s.r1, GONE, data);
    const file = pendingPath(s.r1, data, 'plan');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ questions: Q, at: Date.now() - 10e3, until: Date.now() + 300e3 }));
    const json = JSON.parse((await get(s.port, '/station/mobile.json', phone(s.cfg))).text);
    assert.deepEqual(json.stopped.map((x) => x.id), [GONE]);
    const P = require('../assets/station/mobile.js');
    const html = P.screen(json, P.parseRoute('#/'), json.at, { mode: 'app' });
    assert.match(html, /class="ha-gone/);
    assert.ok(html.includes('href="#/s/' + GONE + '"'));
}));
```

If `served`'s callback does not receive `r1`, read `served` at `:86` and pass the fixture's `r1` through the same way it passes `cfg`.

2. Run `node --test tests/mobile-model.test.js tests/station-mobile-route.test.js` and watch both fail.
3. In `lib/mobile.js`, in `mobileModel`, after the `tasks` constant, add:

```js
    // A session that stopped with its gate still held (station-47): answerable
    // from the phone, in a group of its own so it is not read as running.
    const stopped = all.filter(({ s }) => s.state !== 'live' && held(s, now))
        .map(({ root, s }) => Object.assign(rowOf(root, s, now, look), { state: 'gate' }))
        .sort((a, b) => (b.updated || 0) - (a.updated || 0));
```

and change its return to `return { host: String(host || ''), at: now, gates, tasks, stopped, done: done.slice(0, DONE_MAX) };`.

4. In `assets/station/mobile.js`, add to `STR.zh` beside `'grp.idle'`: `'grp.gone': '停了但還在等你答',` and to `STR.en`: `'grp.gone': 'Stopped, still asking',`. In `homeHtml`, after `var idle = ...`, add `var gone = m.stopped || [];`; change the empty check `!tasks.length ?` to `!tasks.length && !gone.length ?`; and after the `idle.length ? ...` line add:

```js
                + (gone.length ? gh('grp.gone', gone.length) + '<div class="ha-gone ha-list">' + rows(gone) + '</div>' : '')
```

In `chatHtml` (line ~461), where the row is looked up in `m.tasks`, look it up in `(m.tasks || []).concat(m.stopped || [])` instead.

5. In `docs/90-agent/reference/station.md`, in the phone page section, add the paragraph:

```md
A session that stopped while its gate still holds is listed under its own heading, 停了但還在等你答, after the idle ones: `mobileModel` returns it in `stopped` (`lib/mobile.js`), not in `tasks`, so it is never counted as running, and its row opens the same answerable gate screen as a live one (station-47).
```

6. Run both test files and watch them pass; then run `node --test tests/station-mobile-page.test.js` (the key-parity test at `:171`).
7. Commit: `feat: the phone home lists stopped sessions whose gate still holds (station-47)`.

## Task 9: Every stage is told when it leaves no facts (stage-2)

**Files:**
- Modify: `scripts/task.js:1020-1036` — the context.md warning fires leaving any stage
- Test: `tests/context-facts-required.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the code is below; transcription plus tests.

Steps:

1. `grep -rn "context.md has no facts" tests/` — every hit other than `tests/context-facts-required.test.js` is a pin this change may move; note them.
2. Write the failing test. In `tests/context-facts-required.test.js`, replace the test at lines 95-101 with:

```js
test('task.js stage warns leaving design with no facts, as it does leaving survey or plan', () => {
    const dir = tmp('fankeel-task-ctx-');
    run(dir, ['start', '--session', A, '--task', 'a fixture task']);
    run(dir, ['stage', 'design', '--session', A]);
    const { out } = run(dir, ['stage', 'plan', '--session', A]);
    assert.match(out, /context\.md has no facts recorded from design/);
});
```

3. Run `node --test tests/context-facts-required.test.js` and watch it fail.
4. In `scripts/task.js`, replace the comment and condition at lines 1022-1025:

```js
    // §5, widened by stage-2: leaving any stage with nothing recorded means
    // the next stage re-derives every fact this one already had open —
    // warned, never blocked, the same shape as the return-to-build line above.
    if (from) {
```

5. Run `node --test tests/context-facts-required.test.js` and every file step 1 listed, and watch them pass.
6. Commit: `feat: leaving any stage with no facts recorded is warned (stage-2)`.

## Task 10: The explain skill says who writes a file artifact (explain-3)

**Files:**
- Modify: `skills/fankeel-explain/SKILL.md` — one sentence in `## A report or a presentation`
- Modify: `tests/skill-size.test.js` — raise the explain cap
- Test: `tests/explain-dispatch.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — the code is below; transcription plus tests.

Steps:

1. Write the failing test, `tests/explain-dispatch.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('fankeel-explain says who writes a report that is kept as a file (explain-3)', () => {
    const text = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel-explain', 'SKILL.md'), 'utf8');
    const section = text.split('## A report or a presentation')[1].split('\n## ')[0];
    assert.match(section, /fankeel-writer/);
    assert.match(section, /fankeel-implementer/);
});
```

2. Run `node --test tests/explain-dispatch.test.js` and watch it fail.
3. In `skills/fankeel-explain/SKILL.md`, after the paragraph ending `If nothing, delete it.`, add the paragraph:

```md
A product kept as a file is dispatched: a guide page or `README.md` to
`fankeel-writer`, any other file to `fankeel-implementer` with these rules in
its brief. Only what is said in chat is written here.
```

4. In `tests/skill-size.test.js`, change `'fankeel-explain': 4400,` to `'fankeel-explain': 4700,`.
5. Run `node --test tests/explain-dispatch.test.js tests/skill-size.test.js tests/cjk-docs.test.js` and watch them pass.
6. Commit: `docs: fankeel-explain dispatches a kept file to writer or implementer (explain-3)`.

## Task 11: The user checks the gate page folds in a browser (station-37)

**Files:**
- Read: `assets/station/station.js` — the page under check, as Task 6 left it

**Interfaces:**
- Consumes: Task 6's `keepOpen`
- Produces: none

**Dispatch:** user — a fold opened by hand and watched through a 5-second redraw is a browser check no subagent can make.

Steps:

1. Open `http://127.0.0.1:28888/f/<this session id>/gate` while a gate is held.
2. Open 報告其餘 and the TODO 盤點 fold; wait ten seconds; both stay open. Close one; wait ten seconds; it stays closed.
3. Any fold that still snaps shut — `gate-frame.js`'s `.gt-more` is the suspect — is noted with `task.js note` and becomes a TODO at land.

## Task 12: The user approves the docs and settings page mockups block by block (station-38, station-39)

**Files:**
- Read: `.fankeel/build/2026-10-21-station-redesign/route-docs.html` — the docs page mockup
- Read: `.fankeel/build/2026-10-21-station-redesign/route-settings.html` — the settings page mockup

**Interfaces:**
- Consumes: none
- Produces: two mockups the user has approved; their port into `assets/station/` is the next work on each entry

**Dispatch:** user — approving a layout is the user's judgement, block by block, in a browser.

Steps:

1. Open each mockup in the browser pane; walk its `data-block` sections in order with the user.
2. Each block the user wants changed goes to a `fankeel:fankeel-mockup` dispatch in its tuning loop, naming only that block.
3. When both are approved, rewrite each entry's body with `todo.js` so it says the mockup is approved and the port into `assets/station/` is what remains; neither entry is closed by this task.

## Coverage

| promise | task |
|---|---|
| stop-1 — lib/stop.js:68 把背景 Bash 的 id 放進 `launched`，只有收到 task-notification 才刪 | Task 1 |
| station-46 — hooks/stop.js:48 對 `last_assistant_message` 無條件 append | Task 2 |
| station-45 — lib/phone.js:89-98 截斷已改走 `registry.writeAtomic`，但競爭仍在 | Task 3 |
| test-vm-1 — tests/source.test.js:174 的 `neverCalled` 斷言恆真 | Task 4 |
| station-44 — lib/tailscale.js:48 的警告與 scripts/task.js:1248 的拒絕字串都沒指向 | Task 5 |
| station-37 — assets/station/station.js:2926-2935 的 focusBoot 每 5 秒重設 innerHTML | Task 6, Task 11 |
| station-41 — assets/station/mobile.js 全檔沒有訂閱通知控制 | Task 7 |
| station-47 — lib/mobile.js:74 的 `gates` 含所有掛住的 session | Task 8 |
| stage-2 — lib/render.js:726-733 的 `pushContext` 已把 context.md 內嵌進 brief | Task 9 |
| explain-3 — 讀 docs/90-agent/todo/explain-3.md:12，skills/fankeel-explain/SKILL.md 搜 `writer` 無結果 | Task 10 |
| station-38 — 文件頁是設計稿工作 | Task 12 |
| station-39 — 設定頁同上 | Task 12 |
| station-44's third half: refuse also when the remote card carries a warning | struck — that needs a live `tailscale status` on every attach; the off-switch refusal is the silent failure the entry names |
