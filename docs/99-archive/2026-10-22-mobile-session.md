---
status: current
role: plan
last_verified: 2026-10-22
source_of_truth: lib/phone.js, hooks/stop.js, hooks/inject.js, hooks/budget.js, scripts/station.js, lib/mobile.js, assets/station/mobile.js
---

# 手機頁接上 session Implementation Plan

**Goal:** the phone page `/m` attaches a live Claude Code session, sends it messages through a holding Stop hook, shows its replies and tool steps, and is redrawn to the mockup's direction A.
**Architecture:** `lib/phone.js` owns five small files per session under `<registry>/.fankeel/station/phone/<session_id>/`. `hooks/stop.js` records each turn's reply and background work, then, while `attach.json` exists, polls `inbox.json` and returns a phone message as `{decision:'block', reason}`; `hooks/inject.js` and `hooks/budget.js` add the desktop's prompts and the tool steps. The station serves `/station/phone.json` and three `/phone/*` POST routes under the device policy, and `assets/station/mobile.js` draws a session list and a conversation screen from them.
**Tech Stack:** Node `>=22.5`, no dependencies, `node --test`; the page is ES5 in a browser (Samsung Internet), Web Speech API where present.
**Spec:** 2026-10-22-mobile-session-design.md

## Global Constraints

- `package.json`: `"node": ">=22.5"` and no `dependencies` — add none. Tests run with `node --test`; an implementer runs only its own test file.
- There is no CLAUDE.md; `CONTRIBUTING.md` is the conventions file. `lib/` is pure and never requires `scripts/` or `hooks/`; `scripts/` are thin wrappers; every hook exits 0 on every path — use `run` and `parse` from `lib/hook.js` and wrap housekeeping in `try { } catch (e) { }`.
- `lib/`, `hooks/`, `scripts/` indent 4 spaces; tests follow the file being edited (station tests 4, `tests/stop-hook.test.js` 2). New test files in this plan use 4.
- A new file must be `git add`ed before `tests/source.test.js` sees it; every exported name needs an importer (knip) — a test importing it counts.
- `tests/inventory.test.js:71`: `hooks/*.js` equals the hooks `plugin.json` names (no new hook file here). `tests/inventory.test.js:13-28` hard-codes the SKILLS list; `tests/skill-size.test.js` caps each skill's bytes (`fankeel-station` 1600).
- `tests/profile-table.test.js`: `docs/01-guide/profile.md` must equal `node scripts/profile-table.js` output — regenerate after adding a KEYS entry. `tests/profile.test.js:290` every key has a one-line `desc`; `:450` wizard keys equal the keys with non-empty `values` (`phone.hold` uses `values: []`).
- `tests/version-prose.test.js` asserts the file count "sixteen" in `CONTRIBUTING.md`, `docs/01-guide/development.md`, `skills/fankeel-land/SKILL.md`; a fifteenth skill makes it seventeen files and fifteen skills.
- `tests/cjk-docs.test.js:23`: `docs/02-architecture/layout.md` keeps "a SubagentHandback is refused while an agent that subagent dispatched has not stopped"; `tests/away-docs.test.js:21` keeps "Seven are not rowed below".
- `tests/skills.test.js:1410`: user-invoked skills (`disable-model-invocation`) must not name each other.
- `lib/plantasks.js:353-354`: READ_CAP 1500 lines summed over a task's `Modify:` files, FILE_CAP 3 `Modify:` entries.
- `.claude-plugin/plugin.json:112-118`: the Stop hook's timeout is 5 seconds today; `hooks/gate.js`'s is 605.
- Claude Code honours at most 8 consecutive Stop blocks by default; `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` raises it (probed 2026-10-22). fankeel never writes that variable.
- Never write a tailnet hostname, IP address, pairing code or ntfy topic into code, tests or docs. New test code names the machine `station.example.invalid` / `my-pc`; do not copy the existing tests' `NAME` constants.

## Risks

- UserPromptSubmit may fire for a Stop-hook block reason — Task 4 — skip prompts starting `（手機）` so the phone's own message never detaches the phone.
- Stop does not fire on an Esc interrupt: the last chat line stays `tool` and the session reads 跑中 until the next prompt — Task 1 (`stateOf`) — accepted and noted in the guide.
- A live session with no `chat.jsonl` yet (started before this lands) reads 閒置 — Task 1 — `stateOf` returns `idle` when there are no lines.
- Parallel PreToolUse hooks append concurrently; the 200-line trim rewrite can drop a concurrent line — Task 1 (`append`) — accepted.
- Whether the terminal accepts typing while the Stop hook holds is unmeasured (spec, Not verified) — Task 3 — settled by verify's live check.
- `hooks/budget.js` now reads the session entry on every main-thread tool call — Task 5 — two small file reads, nothing else.

## File structure

| file | responsibility | task |
|---|---|---|
| `lib/phone.js` (new) | the five channel files, `snapshot`, `stateOf`, `stepOf`, `stepOk` | 1 |
| `lib/profile.js`, `docs/01-guide/profile.md` | the `phone.hold` key | 2 |
| `hooks/stop.js`, `.claude-plugin/plugin.json` | record the reply and background work on every Stop; refusal first; then hold for the phone; timeout 1805 | 3 |
| `hooks/inject.js` | a typed desktop prompt is a `desktop` line and takes the session back | 4 |
| `hooks/budget.js` | the main thread's tool calls as `tool` / `tool-end` lines | 5 |
| `scripts/phone.js` (new), `skills/fankeel-phone/SKILL.md` (new), `README.md` | `/fankeel-phone` hands an idle session to the phone | 6 |
| `CONTRIBUTING.md`, `docs/01-guide/development.md`, `skills/fankeel-land/SKILL.md` | seventeen version files, fifteen skills | 7 |
| `scripts/station.js`, `lib/mobile.js`, `docs/90-agent/reference/station.md` | `/station/phone.json`, `/phone/attach|detach|say`, rows with `state` | 8 |
| `assets/station/mobile.js`, `assets/station/mobile.css` | the redraw to direction A | 9 |
| `lib/tailscale.js`, `docs/01-guide/tailscale-setup.md` | the win32 `tailscale.exe` fallback | 10 |
| `docs/01-guide/station.md`, `docs/02-architecture/layout.md`, `scripts/version.js` | the guide, the layout rows, the version comments | 11 |

Dependencies: Task 1 before 3, 4, 5, 6, 8; Task 2 before 3; Task 8 before 9. Tasks 1, 2, 7, 10, 11 share no files.

## Task 1: Phone channel files

**Read:** the design's §1 and the state table under "What the phone shows".

**Files:**
- Modify: `lib/phone.js` — new: the channel files and the pure readers over them
- Read: `lib/registry.js` — `sessionPath`, `stateDir`, `writeAtomic`, `sleepMs`
- Read: `lib/json.js` — `readObject` (null on a missing or unparsable file)
- Test: `tests/phone.test.js`
- Test: `tests/phone-state.test.js`

**Interfaces:**
- Consumes: none
- Produces: `phone.SAY_MAX`, `phone.dirOf`, `phone.attach`, `phone.detach`, `phone.isAttached`, `phone.say`, `phone.take`, `phone.append`, `phone.chat`, `phone.writeBackground`, `phone.background`, `phone.hold`, `phone.snapshot`, `phone.stateOf`, `phone.stepOf`, `phone.stepOk` — all from `lib/phone.js`, signatures:
  - `SAY_MAX` = 4000
  - `dirOf(root, sid) -> string|null` — `<root>/.fankeel/station/phone/<sid>`, null when `registry.sessionPath(root, sid)` is null
  - `attach(root, sid, device: string, now: number) -> boolean`; `detach(root, sid) -> boolean` (true when a file was removed); `isAttached(root, sid) -> boolean`
  - `say(root, sid, text, now) -> {ok:true} | {ok:false, code:400|404|409, reason:string}`
  - `take(root, sid) -> {text, at} | null`
  - `append(root, sid, entry) -> boolean`; `chat(root, sid, n) -> entry[]`
  - `writeBackground(root, sid, tasks, now) -> boolean`; `background(root, sid) -> item[]` with items `{id, type, status, description, command, since}`
  - `hold(root, sid, ms) -> {text} | {gone:'detached'|'timeout'|'no session'}`
  - `snapshot(root, sid, now, n) -> {attached, holding, waiting:{text,at}|null, lastRole, last:{role,text,at}|null, background, chat}`
  - `stateOf(live:boolean, gate:boolean, snap) -> 'gate'|'holding'|'running'|'background'|'idle'`
  - `stepOf(tool, input, cwd) -> {label} | {label, background:true}`; `stepOk(response) -> boolean`

**Dispatch:** implementer, opus — architectural floor: the hold loop, the atomic take and the state rules are a protocol other tasks build on.

1. Write the failing tests. In `tests/phone.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const phone = require('../lib/phone.js');
const tmp = require('./tmp.js');

const SID = 'bbbbbbbb-1111-4111-8111-000000000001';
const file = (root, name) => path.join(phone.dirOf(root, SID), name);

test('dirOf sits under the registry and refuses a bad session id', () => {
    const root = tmp('fankeel-phone-');
    assert.equal(phone.dirOf(root, SID), path.join(root, '.fankeel', 'station', 'phone', SID));
    assert.equal(phone.dirOf(root, '../x'), null);
});

test('attach, isAttached, detach', () => {
    const root = tmp('fankeel-phone-');
    assert.equal(phone.isAttached(root, SID), false);
    assert.equal(phone.attach(root, SID, 'my-pc', 5), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(file(root, 'attach.json'), 'utf8')), { at: 5, device: 'my-pc' });
    assert.equal(phone.isAttached(root, SID), true);
    assert.equal(phone.detach(root, SID), true);
    assert.equal(phone.detach(root, SID), false);
    assert.equal(phone.isAttached(root, SID), false);
});

test('say refuses empty, too long, unattached and a second message; take empties the inbox', () => {
    const root = tmp('fankeel-phone-');
    assert.equal(phone.say(root, SID, 'hi', 1).code, 409);
    phone.attach(root, SID, 'my-pc', 1);
    assert.equal(phone.say(root, SID, '   ', 1).code, 400);
    assert.equal(phone.say(root, SID, 'x'.repeat(phone.SAY_MAX + 1), 1).code, 400);
    assert.deepEqual(phone.say(root, SID, '  跑吧 ', 2), { ok: true });
    const again = phone.say(root, SID, 'more', 3);
    assert.equal(again.code, 409);
    assert.match(again.reason, /already waiting/);
    assert.deepEqual(phone.take(root, SID), { text: '跑吧', at: 2 });
    assert.equal(fs.existsSync(file(root, 'inbox.json')), false);
    assert.equal(phone.take(root, SID), null);
});

test('append keeps known roles, caps text, trims to the last 200 lines; chat reads n', () => {
    const root = tmp('fankeel-phone-');
    assert.equal(phone.append(root, SID, { role: 'stranger', text: 'x', at: 1 }), false);
    phone.append(root, SID, { role: 'assistant', text: 'y'.repeat(9000), at: 1 });
    assert.equal(phone.chat(root, SID, 1)[0].text.length, 8001);
    for (let i = 0; i < 205; i++) phone.append(root, SID, { role: 'desktop', text: String(i), at: i });
    const all = phone.chat(root, SID, 0);
    assert.equal(all.length, 200);
    assert.equal(all[199].text, '204');
    assert.deepEqual(phone.chat(root, SID, 2).map((x) => x.text), ['203', '204']);
});

test('writeBackground carries since by id, and an empty list clears it', () => {
    const root = tmp('fankeel-phone-');
    const item = { id: 'b1', type: 'shell', status: 'running', description: 'tests', command: 'npm test' };
    phone.writeBackground(root, SID, [item], 100);
    phone.writeBackground(root, SID, [item, Object.assign({}, item, { id: 'b2' })], 200);
    assert.deepEqual(phone.background(root, SID).map((x) => [x.id, x.since]), [['b1', 100], ['b2', 200]]);
    phone.writeBackground(root, SID, null, 300);
    assert.deepEqual(phone.background(root, SID), []);
});

test('hold returns a waiting message, a detach, or a timeout that detaches', () => {
    const root = tmp('fankeel-phone-');
    phone.attach(root, SID, 'my-pc', 1);
    phone.say(root, SID, 'go', 1);
    assert.deepEqual(phone.hold(root, SID, 1000), { text: 'go' });
    assert.equal(fs.existsSync(file(root, 'holding.json')), false);
    assert.deepEqual(phone.hold(root, SID, 300), { gone: 'timeout' });
    assert.equal(phone.isAttached(root, SID), false);
    assert.deepEqual(phone.hold(root, SID, 300), { gone: 'detached' });
    assert.deepEqual(phone.hold(root, '../x', 300), { gone: 'no session' });
});

test('stepOf labels each tool kind; stepOk reads failures', () => {
    const cwd = path.resolve('/work/proj');
    assert.deepEqual(phone.stepOf('Bash', { command: 'npm test\nmore', description: 'Run the tests' }, cwd), { label: 'Run the tests' });
    assert.deepEqual(phone.stepOf('PowerShell', { command: 'Get-ChildItem\nx' }, cwd), { label: 'Get-ChildItem' });
    assert.deepEqual(phone.stepOf('Read', { file_path: path.join(cwd, 'lib', 'a.js') }, cwd), { label: 'lib/a.js' });
    assert.equal(phone.stepOf('Edit', { file_path: path.resolve('/elsewhere/b.js') }, cwd).label, path.resolve('/elsewhere/b.js').replace(/\\/g, '/'));
    assert.deepEqual(phone.stepOf('Grep', { pattern: 'foo.*bar' }, cwd), { label: 'foo.*bar' });
    assert.deepEqual(phone.stepOf('Agent', { description: 'Plan it', run_in_background: true }, cwd), { label: 'Plan it', background: true });
    assert.deepEqual(phone.stepOf('mcp__Claude_Browser__navigate', {}, cwd), { label: 'Claude_Browser · navigate' });
    assert.deepEqual(phone.stepOf('TodoWrite', {}, cwd), { label: 'TodoWrite' });
    const long = phone.stepOf('Bash', { description: 'a  b ' + 'c'.repeat(100) }, cwd).label;
    assert.equal(long.length, 80);
    assert.match(long, /^a b c+…$/);
    assert.equal(phone.stepOk({ is_error: true }), false);
    assert.equal(phone.stepOk({ success: false }), false);
    assert.equal(phone.stepOk({ interrupted: true }), false);
    assert.equal(phone.stepOk({ stdout: 'ok' }), true);
    assert.equal(phone.stepOk('text'), true);
});
```

In `tests/phone-state.test.js` — the spec's proof, built from the same calls the Stop hook makes:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const phone = require('../lib/phone.js');
const tmp = require('./tmp.js');

const SID = 'bbbbbbbb-1111-4111-8111-000000000002';
const RUNNING = { id: 'b1', type: 'shell', status: 'running', description: 'build', command: 'npm run build' };

function stopped(tasks) {
    const root = tmp('fankeel-phone-state-');
    phone.append(root, SID, { role: 'desktop', text: 'go', at: 1 });
    phone.append(root, SID, { role: 'assistant', text: 'started it', at: 2 });
    phone.writeBackground(root, SID, tasks, 2);
    return phone.snapshot(root, SID, 3, 0);
}

test('a last Stop with one running background item reads background', () => {
    assert.equal(phone.stateOf(true, false, stopped([RUNNING])), 'background');
});

test('a last Stop whose background_tasks was [] reads idle', () => {
    assert.equal(phone.stateOf(true, false, stopped([])), 'idle');
});

test('gate wins, a dead session is idle, a holding one is holding, a non-assistant last line is running', () => {
    const root = tmp('fankeel-phone-state-');
    assert.equal(phone.stateOf(true, false, phone.snapshot(root, SID, 1, 0)), 'idle', 'no lines yet');
    phone.append(root, SID, { role: 'phone', text: 'go', at: 1 });
    const snap = phone.snapshot(root, SID, 2, 5);
    assert.equal(snap.lastRole, 'phone');
    assert.deepEqual(snap.last, { role: 'phone', text: 'go', at: 1 });
    assert.equal(snap.chat.length, 1);
    assert.equal(phone.stateOf(true, false, snap), 'running');
    assert.equal(phone.stateOf(false, false, snap), 'idle');
    assert.equal(phone.stateOf(true, true, snap), 'gate');
    assert.equal(phone.stateOf(true, false, Object.assign({}, snap, { holding: true })), 'holding');
});
```

2. Run `node --test tests/phone.test.js tests/phone-state.test.js` and watch both fail (`Cannot find module '../lib/phone.js'`).

3. Write `lib/phone.js`:

```js
'use strict';
// The phone's channel to one session (docs/99-archive/2026-10-22-mobile-session-design.md §1):
// five files under <registry>/.fankeel/station/phone/<session_id>/ — attach.json
// while the phone holds the session, inbox.json for the one waiting message,
// holding.json while the Stop hook waits, chat.jsonl the conversation and its
// tool steps, background.json the last Stop's background_tasks. Nothing else
// opens them. stateOf is the five states the phone draws.
const fs = require('node:fs');
const path = require('node:path');
const registry = require('./registry.js');
const { readObject } = require('./json.js');

const SAY_MAX = 4000;
const TEXT_MAX = 8000;
const CHAT_KEEP = 200;
const POLL_MS = 200;
const LABEL_MAX = 80;
const LAST_MAX = 200;
const ROLES = new Set(['desktop', 'phone', 'assistant', 'tool', 'tool-end']);
const SPOKEN = new Set(['desktop', 'phone', 'assistant']);

function dirOf(root, sid) {
    if (!registry.sessionPath(root, sid)) return null;
    return path.join(registry.stateDir(root), 'station', 'phone', sid);
}
function fileOf(root, sid, name) {
    const dir = dirOf(root, sid);
    return dir ? path.join(dir, name) : null;
}
function put(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    registry.writeAtomic(file, JSON.stringify(value) + '\n');
}
function unlink(file) {
    try {
        fs.unlinkSync(file);
        return true;
    } catch (e) {
        return false;
    }
}

function attach(root, sid, device, now) {
    const file = fileOf(root, sid, 'attach.json');
    if (!file) return false;
    put(file, { at: now, device: String(device || '') });
    return true;
}
function detach(root, sid) {
    const file = fileOf(root, sid, 'attach.json');
    return file ? unlink(file) : false;
}
function isAttached(root, sid) {
    const file = fileOf(root, sid, 'attach.json');
    return Boolean(file && fs.existsSync(file));
}

function say(root, sid, text, now) {
    const file = fileOf(root, sid, 'inbox.json');
    if (!file) return { ok: false, code: 404, reason: 'no such session' };
    const body = String(text == null ? '' : text).trim();
    if (!body) return { ok: false, code: 400, reason: 'the message is empty' };
    if (body.length > SAY_MAX) return { ok: false, code: 400, reason: 'a message is at most ' + SAY_MAX + ' characters' };
    if (!isAttached(root, sid)) return { ok: false, code: 409, reason: 'the phone has not attached this session' };
    if (fs.existsSync(file)) return { ok: false, code: 409, reason: 'a message is already waiting for this turn to end' };
    put(file, { text: body, at: now });
    return { ok: true };
}

// Rename first: the station cannot write a second message into the file
// this reads, and a second reader finds nothing to rename.
function take(root, sid) {
    const file = fileOf(root, sid, 'inbox.json');
    if (!file) return null;
    const mine = file + '.' + process.pid + '.taking';
    try {
        fs.renameSync(file, mine);
    } catch (e) {
        return null;
    }
    const got = readObject(mine);
    unlink(mine);
    return got && typeof got.text === 'string' ? { text: got.text, at: got.at } : null;
}

function append(root, sid, entry) {
    const file = fileOf(root, sid, 'chat.jsonl');
    if (!file || !entry || !ROLES.has(entry.role)) return false;
    const line = Object.assign({}, entry);
    if (typeof line.text === 'string' && line.text.length > TEXT_MAX) line.text = line.text.slice(0, TEXT_MAX) + '…';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(line) + '\n');
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    if (lines.length > CHAT_KEEP) registry.writeAtomic(file, lines.slice(-CHAT_KEEP).join('\n') + '\n');
    return true;
}

function chat(root, sid, n) {
    const file = fileOf(root, sid, 'chat.jsonl');
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return [];
    }
    const out = [];
    for (const l of text.split('\n')) {
        if (!l.trim()) continue;
        try {
            const o = JSON.parse(l);
            if (o && ROLES.has(o.role)) out.push(o);
        } catch (e) { /* a torn line */ }
    }
    return n > 0 ? out.slice(-n) : out;
}

function background(root, sid) {
    const file = fileOf(root, sid, 'background.json');
    const got = file ? readObject(file) : null;
    return got && Array.isArray(got.tasks) ? got.tasks : [];
}

function writeBackground(root, sid, tasks, now) {
    const file = fileOf(root, sid, 'background.json');
    if (!file) return false;
    const before = new Map(background(root, sid).map((x) => [x.id, x.since]));
    const list = (Array.isArray(tasks) ? tasks : []).filter((x) => x && typeof x === 'object').map((x) => {
        const id = String(x.id || '');
        return {
            id, type: String(x.type || ''), status: String(x.status || ''),
            description: String(x.description || ''), command: String(x.command || ''),
            since: Number.isFinite(before.get(id)) ? before.get(id) : now,
        };
    });
    put(file, { at: now, tasks: list });
    return true;
}

// The Stop hook's wait, hooks/gate.js stationAnswers' shape: a sync poll.
function hold(root, sid, ms) {
    const file = fileOf(root, sid, 'holding.json');
    if (!file) return { gone: 'no session' };
    const since = Date.now();
    put(file, { since, until: since + ms });
    try {
        for (;;) {
            const got = take(root, sid);
            if (got) return { text: got.text };
            if (!isAttached(root, sid)) return { gone: 'detached' };
            if (Date.now() - since >= ms) {
                detach(root, sid);
                return { gone: 'timeout' };
            }
            registry.sleepMs(POLL_MS);
        }
    } finally {
        unlink(file);
    }
}

function snapshot(root, sid, now, n) {
    const all = chat(root, sid, 0);
    const spoken = all.filter((x) => SPOKEN.has(x.role));
    const said = spoken.length ? spoken[spoken.length - 1] : null;
    const h = fileOf(root, sid, 'holding.json');
    const holding = h ? readObject(h) : null;
    const i = fileOf(root, sid, 'inbox.json');
    const waiting = i ? readObject(i) : null;
    return {
        attached: isAttached(root, sid),
        holding: Boolean(holding && Number(holding.until) > now),
        waiting: waiting && typeof waiting.text === 'string' ? { text: waiting.text, at: waiting.at } : null,
        lastRole: all.length ? all[all.length - 1].role : null,
        last: said ? { role: said.role, text: String(said.text || '').slice(0, LAST_MAX), at: said.at } : null,
        background: background(root, sid),
        chat: n > 0 ? all.slice(-n) : [],
    };
}

function stateOf(live, gate, snap) {
    if (gate) return 'gate';
    if (!live || !snap) return 'idle';
    if (snap.holding) return 'holding';
    if (!snap.lastRole) return 'idle';
    if (snap.lastRole !== 'assistant') return 'running';
    return snap.background.length ? 'background' : 'idle';
}

function rel(p, cwd) {
    const s = String(p || '');
    if (s && cwd && path.isAbsolute(s)) {
        const r = path.relative(cwd, s);
        if (r && !r.startsWith('..') && !path.isAbsolute(r)) return r.split(path.sep).join('/');
    }
    return s.replace(/\\/g, '/');
}

function stepOf(tool, input, cwd) {
    const name = String(tool || '');
    const i = input && typeof input === 'object' ? input : {};
    let label = name;
    let bg = false;
    if (name === 'Bash' || name === 'PowerShell') label = i.description || String(i.command || '').split(/\r?\n/)[0] || name;
    else if (name === 'Edit' || name === 'Write' || name === 'Read' || name === 'NotebookEdit') label = rel(i.file_path || i.notebook_path, cwd) || name;
    else if (name === 'Grep' || name === 'Glob') label = i.pattern || name;
    else if (name === 'Agent' || name === 'Task') {
        label = i.description || name;
        bg = i.run_in_background === true;
    } else {
        const m = /^mcp__(.+?)__(.+)$/.exec(name);
        if (m) label = m[1] + ' · ' + m[2];
    }
    label = String(label).replace(/\s+/g, ' ').trim();
    if (label.length > LABEL_MAX) label = label.slice(0, LABEL_MAX - 1) + '…';
    return bg ? { label, background: true } : { label };
}

function stepOk(response) {
    if (!response || typeof response !== 'object') return true;
    return !(response.is_error === true || response.success === false || response.interrupted === true);
}

module.exports = { SAY_MAX, dirOf, attach, detach, isAttached, say, take, append, chat, writeBackground, background, hold, snapshot, stateOf, stepOf, stepOk };
```

4. `git add lib/phone.js tests/phone.test.js tests/phone-state.test.js`, then run `node --test tests/phone.test.js tests/phone-state.test.js` and watch both pass.

5. Commit: `feat: lib/phone.js, the phone's channel to a session`.

## Task 2: phone.hold profile key

**Read:** the design's §2 third bullet.

**Files:**
- Modify: `lib/profile.js` — KEYS entry, `parsePhoneHold`, `parseValue` line
- Modify: `docs/01-guide/profile.md` — regenerated, never hand-edited
- Test: `tests/profile-phone.test.js`

**Interfaces:**
- Consumes: none
- Produces: `profileFor(root, mine).values['phone.hold']`; profile key `'phone.hold'` — `profile.profileFor(root, mine).values['phone.hold']` is the seconds as a string or number, builtin `'1800'`; `profile.parseValue('phone.hold', raw) -> {value:number} | {error:string}`

**Dispatch:** implementer, opus — architectural floor.

1. Write the failing test in `tests/profile-phone.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

test('phone.hold takes whole seconds from 1 to 1800', () => {
    assert.deepEqual(profile.parseValue('phone.hold', '60'), { value: 60 });
    assert.deepEqual(profile.parseValue('phone.hold', '1800'), { value: 1800 });
    for (const bad of ['0', '1801', 'x', '1.5', '']) {
        assert.equal(profile.parseValue('phone.hold', bad).error, 'phone.hold is a number of seconds from 1 to 1800', bad);
    }
});

test('phone.hold defaults to 1800 and is no wizard key', () => {
    const got = profile.read(tmp('fankeel-profile-phone-'), null);
    assert.equal(Number(got.values['phone.hold']), 1800);
    assert.equal(got.sources['phone.hold'], 'builtin');
    assert.equal(profile.WIZARD_KEYS.includes('phone.hold'), false);
    assert.match(profile.KEYS['phone.hold'].desc, /^[^\n]+$/);
});
```

If `read`'s return names its provenance map differently from `sources`, use the name the existing profile tests already assert on for `gate.station`.

2. Run `node --test tests/profile-phone.test.js`; watch it fail.

3. In `lib/profile.js`, add the KEYS entry directly after `'gate.station'`:

```js
    'phone.hold': { values: [], builtin: '1800', free: '1 到 1800 的秒數', desc: '手機接上 session 時，每回合結束後 Stop hook 等手機下一句最多幾秒；逾時把 session 交還電腦' },
```

Beside `parseGateStation` in `lib/profile.js`, add:

```js
// `phone.hold`: how many seconds hooks/stop.js holds a turn's end for the
// phone's next message (docs/99-archive/2026-10-22-mobile-session-design.md §2).
const PHONE_HOLD_MAX = 1800;
function parsePhoneHold(raw) {
    const s = String(raw == null ? '' : raw).trim();
    const n = /^\d+$/.test(s) ? Number(s) : NaN;
    if (Number.isInteger(n) && n >= 1 && n <= PHONE_HOLD_MAX) return { value: n };
    return { error: 'phone.hold is a number of seconds from 1 to ' + PHONE_HOLD_MAX };
}
```

In `parseValue` of `lib/profile.js`, after the `gate.station` line:

```js
    if (key === 'phone.hold') return parsePhoneHold(raw);
```

4. Regenerate the table: `node scripts/profile-table.js > docs/01-guide/profile.md` only if that is how `tests/profile-table.test.js` compares it — otherwise paste the printed table over the old one in `docs/01-guide/profile.md` so the file equals the output exactly.

5. Run `node --test tests/profile-phone.test.js tests/profile-table.test.js tests/profile.test.js`; all pass.

6. Commit: `feat: phone.hold, how long the Stop hook waits for the phone`.

## Task 3: Stop hook holds for the phone

**Read:** the design's §2.

**Files:**
- Modify: `hooks/stop.js` — record reply and background on every Stop; refusal first; then hold
- Modify: `.claude-plugin/plugin.json` — the Stop hook's timeout 5 -> 1805 and its statusMessage
- Read: `lib/stop.js` — `refusal(mine, transcriptPath)`, unchanged
- Read: `tests/stop-hook.test.js` — the `project` / `fire` harness to copy
- Test: `tests/phone-stop.test.js`

**Interfaces:**
- Consumes: Task 1 — `phone.append`, `phone.writeBackground`, `phone.isAttached`, `phone.hold`, `phone.chat`, `phone.attach`, `phone.say`, `phone.detach`, `phone.dirOf`; Task 2 — `profileFor(root, mine).values['phone.hold']`
- Produces: Stop prints `{decision:'block', reason:'（手機）' + text}` for a phone message; `chat.jsonl` gets `assistant` and `phone` lines; `background.json` reflects each Stop

**Dispatch:** implementer, opus — architectural floor: the hook's ordering against the refusal and `stop_hook_active` is the protocol.

1. Write the failing test in `tests/phone-stop.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const phone = require('../lib/phone.js');
const tmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'stop.js');
const MANIFEST = path.join(__dirname, '..', '.claude-plugin', 'plugin.json');
const SID = 'aaaaaaaa-0000-4000-8000-0000000000f2';

function project(active, profileJson) {
    const root = tmp('fankeel-phone-stop-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SID + '.json'), JSON.stringify({
        task: 't', claims: [], stage: 'build', active, started: '2026-10-22T00:00:00.000Z', updated: new Date().toISOString(),
    }));
    if (profileJson) fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify(profileJson));
    const transcript = path.join(root, 'transcript.jsonl');
    fs.writeFileSync(transcript, JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: '等一下' }] } }) + '\n');
    return { root, transcript };
}
const input = (p, extra) => JSON.stringify(Object.assign({
    session_id: SID, cwd: p.root, hook_event_name: 'Stop', stop_hook_active: false, transcript_path: p.transcript,
    last_assistant_message: 'done', background_tasks: [],
}, extra));
const env = (p) => Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: p.root, CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') });
const fire = (p, extra) => execFileSync(process.execPath, [HOOK], { input: input(p, extra), encoding: 'utf8', env: env(p) });
const exists = (p, name) => fs.existsSync(path.join(phone.dirOf(p.root, SID), name));

test('attached with a message waiting: the Stop blocks with the phone text, even after a block', () => {
    const p = project(false);
    phone.attach(p.root, SID, 'my-pc', 1);
    phone.say(p.root, SID, '跑吧', 2);
    const out = JSON.parse(fire(p, { stop_hook_active: true }));
    assert.deepEqual(out, { decision: 'block', reason: '（手機）跑吧' });
    assert.equal(exists(p, 'inbox.json'), false);
    assert.equal(exists(p, 'holding.json'), false);
    assert.deepEqual(phone.chat(p.root, SID, 0).map((x) => [x.role, x.text]), [['assistant', 'done'], ['phone', '跑吧']]);
});

test('not attached: nothing printed, the reply and the background list recorded, [] clears it', () => {
    const p = project(false);
    const item = { id: 'b1', type: 'shell', status: 'running', description: 'build', command: 'npm run build' };
    assert.equal(fire(p, { background_tasks: [item] }), '');
    assert.equal(phone.chat(p.root, SID, 1)[0].role, 'assistant');
    assert.deepEqual(phone.background(p.root, SID).map((x) => x.id), ['b1']);
    fire(p, { background_tasks: [] });
    assert.deepEqual(phone.background(p.root, SID), []);
});

test('phone.hold runs out: nothing printed and the phone is detached', () => {
    const p = project(false, { 'phone.hold': 1 });
    phone.attach(p.root, SID, 'my-pc', 1);
    const t0 = Date.now();
    assert.equal(fire(p), '');
    assert.ok(Date.now() - t0 >= 900);
    assert.equal(exists(p, 'attach.json'), false);
});

test('a detach while holding releases the hook with nothing printed', async () => {
    const p = project(false);
    phone.attach(p.root, SID, 'my-pc', 1);
    const child = spawn(process.execPath, [HOOK], { env: env(p) });
    let out = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stdin.end(input(p));
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(exists(p, 'holding.json'), true);
    phone.detach(p.root, SID);
    await new Promise((r) => child.on('close', r));
    assert.equal(out, '');
    assert.equal(exists(p, 'attach.json'), false);
    assert.equal(exists(p, 'holding.json'), false);
});

test('the refusal still wins over the phone, and leaves the message waiting', () => {
    const p = project(true);
    phone.attach(p.root, SID, 'my-pc', 1);
    phone.say(p.root, SID, '跑吧', 2);
    const out = JSON.parse(fire(p));
    assert.match(out.reason, /build is open/);
    assert.equal(exists(p, 'inbox.json'), true);
});

test('the manifest gives the Stop hook 1805 seconds', () => {
    const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const h = m.hooks.Stop.flatMap((x) => x.hooks).find((x) => /hooks\/stop\.js/.test(x.command));
    assert.equal(h.timeout, 1805);
});
```

2. Run `node --test tests/phone-stop.test.js`; watch it fail (the first test gets `''` today).

3. Replace the body of `hooks/stop.js` from its requires down:

```js
// Then the phone (docs/99-archive/2026-10-22-mobile-session-design.md §2):
// every Stop of a registry session records the turn's reply and its
// background_tasks; while the phone has attached the session, the hook holds
// up to phone.hold seconds for its next message and returns it as a block —
// whether or not stop_hook_active is set, since every phone message is one.

const registry = require('../lib/registry.js');
const phone = require('../lib/phone.js');
const { profileFor } = require('../lib/profile.js');
const { refusal } = require('../lib/stop.js');
const { run, parse } = require('../lib/hook.js');

const HOLD_DEFAULT = 1800;

function holdSeconds(root, mine) {
    try {
        const n = Number(profileFor(root, mine).values['phone.hold']);
        return Number.isInteger(n) && n > 0 ? n : HOLD_DEFAULT;
    } catch (e) {
        return HOLD_DEFAULT;
    }
}

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;
    if (payload.hook_event_name !== undefined && payload.hook_event_name !== 'Stop') return;
    const root = registry.rootFor(payload);
    const sid = payload.session_id;
    const mine = registry.readSession(root, sid);
    if (!mine) return;
    const now = Date.now();
    try {
        phone.append(root, sid, { role: 'assistant', text: String(payload.last_assistant_message || ''), at: now });
        phone.writeBackground(root, sid, payload.background_tasks, now);
    } catch (e) { /* housekeeping */ }
    if (payload.stop_hook_active !== true) {
        const reason = refusal(mine, payload.transcript_path);
        if (reason) {
            process.stdout.write(JSON.stringify({ decision: 'block', reason }));
            return;
        }
    }
    let got = null;
    try {
        if (!phone.isAttached(root, sid)) return;
        got = phone.hold(root, sid, holdSeconds(root, mine) * 1000);
    } catch (e) {
        return;
    }
    if (!got || typeof got.text !== 'string') return;
    try {
        phone.append(root, sid, { role: 'phone', text: got.text, at: Date.now() });
    } catch (e) { /* housekeeping */ }
    process.stdout.write(JSON.stringify({ decision: 'block', reason: '（手機）' + got.text }));
}

run(main);
```

Keep the existing header comment of `hooks/stop.js` above it, but change its last paragraph to: "Two things go to stdout: the refusal, or a phone message."

4. In `.claude-plugin/plugin.json`, the Stop entry becomes:

```json
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/stop.js\"",
            "timeout": 1805,
            "statusMessage": "Checking the fankeel stage, or holding the session for the phone..."
          }
```

5. Run `node --test tests/phone-stop.test.js tests/stop-hook.test.js`; both pass (the old "a stop that already followed a refusal goes through" still prints nothing — that session is not attached).

6. Commit: `feat: the Stop hook holds a session for the phone`.

## Task 4: Desktop side in inject.js

**Read:** the design's §3 first bullet.

**Files:**
- Modify: `hooks/inject.js` — a typed prompt becomes a `desktop` line and detaches the phone
- Read: `tests/away-hold.test.js` — `seed(over)` at :21-29 and `fire(hook, root, payload)` at :33-39, copied in full below
- Test: `tests/phone-inject.test.js`

**Interfaces:**
- Consumes: Task 1 — `phone.append(root, sid, entry)`, `phone.detach(root, sid)`, `phone.attach`, `phone.chat`, `phone.isAttached`; Task 2 — `profileFor(root, mine).values['phone.hold']`
- Produces: none

**Dispatch:** implementer, opus — architectural floor.

1. Write the failing test in `tests/phone-inject.test.js` — the whole file, 2-space indent as `tests/away-hold.test.js` has; `seed` and `fire` are that file's :21-29 and :33-39 with this file's own prefix and id:

```js
'use strict';

// The desktop side of the phone channel
// (docs/99-archive/2026-10-22-mobile-session-design.md §3): every prompt
// typed at the desktop is a `desktop` line, and takes the session back.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const phone = require('../lib/phone.js');

const INJECT = path.join(__dirname, '..', 'hooks', 'inject.js');
const MINE = 'aaaaaaaa-0000-4000-8000-0000000000c4';
const ago = (ms) => new Date(Date.now() - ms).toISOString();

function seed(over) {
  const root = tmp('fankeel-phone-inject-');
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, MINE + '.json'), JSON.stringify(Object.assign({
    task: 'rework the colour ramp', stage: 'design', active: true, started: ago(2 * 3600e3), updated: ago(3600e3),
  }, over), null, 2) + '\n');
  return root;
}

function fire(hook, root, payload) {
  return execFileSync(process.execPath, [hook], {
    input: JSON.stringify(Object.assign({ session_id: MINE, cwd: root }, payload)),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') }),
  });
}

test('a prompt typed at the desktop is a desktop line and takes the session back', () => {
  const root = seed({});
  phone.attach(root, MINE, 'my-pc', 1);
  fire(INJECT, root, { prompt: '先停一下', hook_event_name: 'UserPromptSubmit' });
  assert.deepEqual(phone.chat(root, MINE, 0).map((x) => [x.role, x.text]), [['desktop', '先停一下']]);
  assert.equal(phone.isAttached(root, MINE), false);
});

test('an inactive or init-only entry still records the prompt and detaches', () => {
  for (const over of [{ active: false }, { stage: 'init', task: undefined }]) {
    const root = seed(over);
    phone.attach(root, MINE, 'my-pc', 1);
    fire(INJECT, root, { prompt: '我回來了', hook_event_name: 'UserPromptSubmit' });
    assert.deepEqual(phone.chat(root, MINE, 0).map((x) => [x.role, x.text]), [['desktop', '我回來了']], JSON.stringify(over));
    assert.equal(phone.isAttached(root, MINE), false, JSON.stringify(over));
  }
});

test('a task notification and the phone\'s own message touch nothing', () => {
  for (const prompt of ['<task-notification>done</task-notification>', '（手機）跑吧']) {
    const root = seed({});
    phone.attach(root, MINE, 'my-pc', 1);
    fire(INJECT, root, { prompt, hook_event_name: 'UserPromptSubmit' });
    assert.deepEqual(phone.chat(root, MINE, 0), [], prompt);
    assert.equal(phone.isAttached(root, MINE), true, prompt);
  }
});
```

(`task: undefined` drops out of `JSON.stringify`, so the second entry is `stage: 'init'`, `active: true` and no task — the `initOnly` case at `hooks/inject.js:99`.)

2. Run `node --test tests/phone-inject.test.js`; watch it fail.

3. In `hooks/inject.js`, add beside the other requires:

```js
const phone = require('../lib/phone.js');
```

In `hooks/inject.js` `main`, directly after `let mine = registry.readSession(root, sessionId);` (:95) and before the `const initOnly = ...` comment block (:96-99) — above the `if (!mine || mine.active !== true || initOnly)` branch whose paths return at :187 and :190 — add:

```js
    // The phone (docs/99-archive/2026-10-22-mobile-session-design.md §3):
    // a prompt typed here is the desktop's line in the conversation, and takes
    // the session back from the phone — for any registry session, so above the
    // early returns an inactive or init-only entry takes, and the one place the
    // output-first rule below does not reach. A background task notification is
    // not the user, and a Stop-hook block carrying the phone's own message
    // starts with （手機）; neither touches anything.
    try {
        const typed = String(payload.prompt || '');
        if (mine && typed.trim() && !/^\s*<task-notification>/.test(typed) && !typed.startsWith('（手機）')) {
            phone.append(root, sessionId, { role: 'desktop', text: typed, at: Date.now() });
            phone.detach(root, sessionId);
        }
    } catch (e) { /* housekeeping */ }
```

The notification test repeats `/^\s*<task-notification>/` from :256 rather than moving `notice` up, so the rest of `main` is untouched.

4. Run `node --test tests/phone-inject.test.js tests/away-hold.test.js`; both pass.

5. Commit: `feat: a prompt typed at the desktop takes the session back from the phone`.

## Task 5: Tool steps in budget.js

**Read:** the design's §3b.

**Files:**
- Modify: `hooks/budget.js` — the main thread's tool calls become `tool` / `tool-end` lines
- Test: `tests/phone-steps.test.js`

**Interfaces:**
- Consumes: Task 1 — `phone.stepOf(tool, input, cwd)`, `phone.stepOk(response)`, `phone.append(root, sid, entry)`, `phone.chat`
- Produces: `chat.jsonl` lines `{role:'tool', id, tool, label, at, background?}` and `{role:'tool-end', id, ok, at}`

**Dispatch:** implementer, opus — architectural floor.

1. Write the failing test in `tests/phone-steps.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const phone = require('../lib/phone.js');
const tmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'budget.js');
const SID = 'cccccccc-2222-4222-8222-000000000001';

function project(withEntry) {
    const root = tmp('fankeel-phone-steps-');
    registry.ensureLayout(root);
    if (withEntry) registry.writeSession(root, SID, { task: 't', stage: 'build', active: true, claims: [], started: '2026-10-22T00:00:00.000Z', updated: new Date().toISOString() });
    return root;
}
const fire = (root, payload) => execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify(Object.assign({ session_id: SID, cwd: root }, payload)), encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') }),
});
const pre = (root, tool, input, id) => fire(root, { hook_event_name: 'PreToolUse', tool_name: tool, tool_input: input, tool_use_id: id });
const post = (root, tool, response, id) => fire(root, { hook_event_name: 'PostToolUse', tool_name: tool, tool_input: {}, tool_response: response, tool_use_id: id });

test('each main-thread tool call is a step, closed by its tool-end', () => {
    const root = project(true);
    pre(root, 'Bash', { command: 'npm test', description: 'Run the tests' }, 't1');
    post(root, 'Bash', { stdout: 'ok' }, 't1');
    pre(root, 'Read', { file_path: path.join(root, 'lib', 'a.js') }, 't2');
    post(root, 'Read', { is_error: true }, 't2');
    pre(root, 'Agent', { description: 'Plan it', run_in_background: true }, 't3');
    pre(root, 'mcp__Claude_Browser__navigate', { url: 'x' }, 't4');
    pre(root, 'AskUserQuestion', { questions: [] }, 't5');
    const lines = phone.chat(root, SID, 0).map((x) => [x.role, x.id, x.label, x.ok, x.background]);
    assert.deepEqual(lines, [
        ['tool', 't1', 'Run the tests', undefined, undefined],
        ['tool-end', 't1', undefined, true, undefined],
        ['tool', 't2', 'lib/a.js', undefined, undefined],
        ['tool-end', 't2', undefined, false, undefined],
        ['tool', 't3', 'Plan it', undefined, true],
        ['tool', 't4', 'Claude_Browser · navigate', undefined, undefined],
    ]);
});

test('a session with no entry, and a subagent\'s call, write no step', () => {
    const none = project(false);
    pre(none, 'Bash', { command: 'ls' }, 't1');
    assert.equal(fs.existsSync(path.join(phone.dirOf(none, SID), 'chat.jsonl')), false);
    const root = project(true);
    fire(root, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls' }, tool_use_id: 't9', agent_id: 'a1' });
    assert.deepEqual(phone.chat(root, SID, 0), []);
});
```

2. Run `node --test tests/phone-steps.test.js`; watch it fail.

3. In `hooks/budget.js`, add beside the other requires:

```js
const phone = require('../lib/phone.js');
```

In `hooks/budget.js`, add above `main`:

```js
// The phone's steps (docs/99-archive/2026-10-22-mobile-session-design.md §3b):
// one chat.jsonl line before each main-thread tool call and one after it, for
// a session with a registry entry. AskUserQuestion is the gate card, no step.
function steps(payload) {
    const tool = String(payload.tool_name || '');
    if (!tool || tool === 'AskUserQuestion') return;
    const root = registry.rootFor(payload);
    if (!registry.readSession(root, payload.session_id)) return;
    const id = String(payload.tool_use_id || '');
    const at = Date.now();
    if (payload.hook_event_name === 'PostToolUse') {
        phone.append(root, payload.session_id, { role: 'tool-end', id, ok: phone.stepOk(payload.tool_response), at });
        return;
    }
    const step = phone.stepOf(tool, payload.tool_input, payload.cwd);
    phone.append(root, payload.session_id, Object.assign({ role: 'tool', id, tool, label: step.label, at }, step.background ? { background: true } : {}));
}
```

In `main` of `hooks/budget.js`, replace `if (!payload.agent_id) return;` with:

```js
    if (!payload.agent_id) {
        try { steps(payload); } catch (e) { /* housekeeping */ }
        return;
    }
```

4. Rewrite the header comment of `hooks/budget.js`: its first line says "PreToolUse and PostToolUse. For the main thread, each tool call is a step on the phone's conversation (lib/phone.js); for a subagent, ..." and the last paragraph no longer says the main session returns before anything else runs — it says the main session writes its step and returns.

5. Run `node --test tests/phone-steps.test.js`; it passes.

6. Commit: `feat: the main thread's tool calls as phone steps`.

## Task 6: /fankeel-phone skill and scripts/phone.js

**Read:** the design's §3 second bullet.

**Files:**
- Modify: `scripts/phone.js` — new: `attach` / `detach` for one session
- Modify: `skills/fankeel-phone/SKILL.md` — new user-invoked skill
- Modify: `README.md` — one command row
- Test: `tests/phone-cli.test.js`
- Test: `tests/inventory.test.js` — `'fankeel-phone'` in SKILLS
- Test: `tests/skill-size.test.js` — `'fankeel-phone': 1600`

**Interfaces:**
- Consumes: Task 1 — `phone.attach(root, sid, device, now)`, `phone.detach(root, sid)`, `phone.isAttached`
- Produces: `scripts/phone.js` `main(argv) -> {text, code}`; `/fankeel-phone`

**Dispatch:** implementer, opus — architectural floor.

1. Write the failing test in `tests/phone-cli.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const registry = require('../lib/registry.js');
const phone = require('../lib/phone.js');
const { main } = require('../scripts/phone.js');
const tmp = require('./tmp.js');

const SID = 'dddddddd-3333-4333-8333-000000000001';

function project() {
    const root = tmp('fankeel-phone-cli-');
    registry.ensureLayout(root);
    registry.writeSession(root, SID, { task: 't', stage: 'build', active: true, claims: [], started: '2026-10-22T00:00:00.000Z', updated: new Date().toISOString() });
    return root;
}

test('attach and detach one session', () => {
    const root = project();
    const a = main(['attach', '--session', SID, '--root', root]);
    assert.equal(a.code, 0);
    assert.match(a.text, /^phone: attached/);
    assert.equal(phone.isAttached(root, SID), true);
    assert.equal(main(['detach', '--session', SID, '--root', root]).code, 0);
    assert.equal(phone.isAttached(root, SID), false);
});

test('no session, an unknown session, or an unknown verb is refused', () => {
    const root = project();
    assert.equal(main(['attach', '--root', root]).code, 2);
    assert.equal(main(['attach', '--session', 'eeeeeeee-0000-4000-8000-000000000000', '--root', root]).code, 2);
    assert.equal(main(['wave', '--session', SID, '--root', root]).code, 2);
});
```

In `tests/inventory.test.js`, add `'fankeel-phone'` to SKILLS between `'fankeel-land'` and `'fankeel-plan'`; in `tests/skill-size.test.js`, add `'fankeel-phone': 1600` to CAPS beside `'fankeel-station'`.

2. Run `node --test tests/phone-cli.test.js tests/inventory.test.js tests/skill-size.test.js`; watch them fail.

3. Write `scripts/phone.js`:

```js
#!/usr/bin/env node
'use strict';
// /fankeel-phone (docs/99-archive/2026-10-22-mobile-session-design.md §3):
// attach hands a session to the phone — when its turn ends, hooks/stop.js
// holds it for the phone's next message; detach takes it back.
const { parseArgs } = require('node:util');
const registry = require('../lib/registry.js');
const phone = require('../lib/phone.js');

const USAGE = 'usage: phone.js attach|detach --session <id> [--root <dir>]';

function main(argv) {
    let parsed;
    try {
        parsed = parseArgs({ args: argv, allowPositionals: true, options: { session: { type: 'string' }, root: { type: 'string' } } });
    } catch (e) {
        return { text: USAGE, code: 2 };
    }
    const verb = parsed.positionals[0];
    const sid = parsed.values.session;
    if ((verb !== 'attach' && verb !== 'detach') || !sid) return { text: USAGE, code: 2 };
    const root = parsed.values.root ? registry.resolveRoot(parsed.values.root) : registry.findStateRoot(process.cwd()) || process.cwd();
    if (!registry.readSession(root, sid)) return { text: 'phone: no fankeel session ' + sid + ' in ' + root, code: 2 };
    if (verb === 'detach') {
        phone.detach(root, sid);
        return { text: 'phone: detached — the session is the desktop\'s again', code: 0 };
    }
    phone.attach(root, sid, 'desktop', Date.now());
    return { text: 'phone: attached — when this turn ends the session waits for the phone (/m), up to phone.hold seconds', code: 0 };
}

if (require.main === module) {
    const out = main(process.argv.slice(2));
    process.stdout.write(out.text + '\n');
    process.exitCode = out.code;
}

module.exports = { main };
```

4. Write `skills/fankeel-phone/SKILL.md` (under 1600 bytes; it names no other user-invoked skill):

```md
---
name: fankeel-phone
description: Hand this session to the phone — when this turn ends the session waits for the next message typed on the station's phone page (/m). Use for /fankeel-phone, "交給手機", or before walking away from a session you want to keep talking to.
disable-model-invocation: true
version: 0.111.68
status: current
last_verified: 2026-10-22
source_of_truth: scripts/phone.js, lib/phone.js, hooks/stop.js
---

# fankeel-phone

`<plugin>` is two directories up from this file.

1. Run `node <plugin>/scripts/phone.js attach --session <id>`, with the id the
   fankeel block names on its `--session <id>` line.
2. Answer with its one line, nothing else.
3. End the turn. Its end is what the Stop hook holds: the next message comes
   from the phone, and a prompt typed here takes the session back.
```

5. In `README.md`, add to the commands table beside the other `/fankeel-*` rows:

```md
| `/fankeel-phone` | 把這個 session 交給手機 |
```

6. `git add scripts/phone.js skills/fankeel-phone/SKILL.md tests/phone-cli.test.js`, then run `node --test tests/phone-cli.test.js tests/inventory.test.js tests/skill-size.test.js tests/skills.test.js`; all pass.

7. Commit: `feat: /fankeel-phone hands a session to the phone`.

## Task 7: Version prose for the fifteenth skill

**Read:** none beyond the files below.

**Files:**
- Modify: `CONTRIBUTING.md` — line 24: sixteen -> seventeen
- Modify: `docs/01-guide/development.md` — lines 216-246: sixteen -> seventeen, fourteen skills -> fifteen skills
- Modify: `skills/fankeel-land/SKILL.md` — line 200: sixteen places -> seventeen places
- Test: `tests/contract.test.js` — line 279: the manifests-plus-SKILL.md count 16 -> 17
- Test: `tests/version-prose.test.js`

**Interfaces:**
- Consumes: Task 6 — `/fankeel-phone` (the count assumes its skill, no file of it)
- Produces: none

**Dispatch:** implementer, opus — architectural floor.

1. Rewrite the count assertions in `tests/version-prose.test.js` (keep any assertion of it that is not about the count):

```js
const COUNTED = ['CONTRIBUTING.md', 'docs/01-guide/development.md', 'skills/fankeel-land/SKILL.md'];

test('the version prose counts seventeen files and fifteen skills', () => {
    for (const rel of COUNTED) {
        const text = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
        assert.match(text, /seventeen/, rel);
        assert.doesNotMatch(text, /sixteen (files|places)/, rel);
    }
    const dev = fs.readFileSync(path.join(__dirname, '..', 'docs', '01-guide', 'development.md'), 'utf8');
    assert.match(dev, /fifteen skills/);
    assert.doesNotMatch(dev, /fourteen skills/);
});
```

2. Run `node --test tests/version-prose.test.js`; watch it fail.

3. Edit the three files: every "sixteen" that counts the version-bearing files becomes "seventeen", every "fourteen skills" becomes "fifteen skills". Recount the list `docs/01-guide/development.md` gives if it enumerates the files — the fankeel-phone skill's SKILL.md (Task 6) is the new one.

4. In `tests/contract.test.js`, line 279 counts the two manifests (package.json and the plugin manifest) and every skill directory's SKILL.md; the fankeel-phone skill from Task 6 is the seventeenth. Replace

```js
  assert.equal(found.size, 16, 'the count moved: ' + [...found.keys()].join(', '));
```

with, in `tests/contract.test.js`:

```js
  assert.equal(found.size, 17, 'the count moved: ' + [...found.keys()].join(', '));
```

5. Run `node --test tests/version-prose.test.js tests/contract.test.js`; both pass.

6. Commit: `docs: seventeen version files, fifteen skills`.

## Task 8: Station routes and the phone model

**Read:** the design's §4.

**Files:**
- Modify: `scripts/station.js:770-930` — require `../lib/phone.js`; `mobile.json` passes `phone.snapshot`; `GET /station/phone.json`; `POST /phone/attach|detach|say`
- Modify: `lib/mobile.js` — rows carry `state`, `attached`, `background`, `last`; `gateOf`; `phoneModel`
- Modify: `docs/90-agent/reference/station.md:1403-1535` — the new routes (after line 1416) and the device-policy paragraph (~1519-1531)
- Read: `lib/remote.js` — `policy(method, path)`, `pair`, `newCode`; no change, `/station/phone.json` and `/phone/*` already fall to `device`
- Read: `tests/station-remote.test.js` — `fixture`, `fakeTailscale`, `request`, `form`, `start` to copy
- Test: `tests/station-phone.test.js`
- Test: `tests/mobile-model.test.js` — the row keys assertion near line 44, and `phoneModel` / `state` tests

**Interfaces:**
- Consumes: Task 1 — `phone.snapshot(root, sid, now, n)`, `phone.stateOf(live, gate, snap)`, `phone.attach`, `phone.detach`, `phone.say`, `phone.append`, `phone.writeBackground`, `phone.dirOf`; Task 2 — `profileFor(root, mine).values['phone.hold']`
- Produces: `mobileModel`, `phoneModel`, and:
  - `mobileModel(model, now, host, hidden, look)` — `look` is `phone.snapshot`; each `tasks` row is `{id, root, task, project, stage, route, gate, updated, state, attached, background, last}`
  - `phoneModel(model, id, now, hidden, look) -> null | {id, root, task, project, stage, route, state, attached, waiting, chat, gate, background, at}` — `gate` is `{questions, since, until} | null`, `chat` the last 50 lines
  - `GET /station/phone.json?id=<sid>` -> 200 `phoneModel` JSON | 404
  - `POST /phone/attach` `{root, id}` -> 201 | 404 | 409; `POST /phone/detach` `{root, id}` -> 200 | 404; `POST /phone/say` `{root, id, text}` -> 201 | 400 | 404 | 409

**Dispatch:** implementer, opus — architectural floor: device policy and the live-state rule meet here.

1. Write the failing tests. In `tests/mobile-model.test.js`, change the tasks-row keys assertion to:

```js
    assert.deepEqual(Object.keys(m.tasks[0]).sort(), ['attached', 'background', 'gate', 'id', 'last', 'project', 'root', 'route', 'stage', 'state', 'task', 'updated']);
```

and add, in `tests/mobile-model.test.js`, using the model fixture the file already builds (one live session `s`):

```js
test('a row takes its state from the look it is given, and phoneModel answers one session', () => {
    const snap = { attached: true, holding: false, waiting: { text: 'hi', at: 1 }, lastRole: 'assistant', last: { role: 'assistant', text: 'ok', at: 1 }, background: [{ id: 'b1' }], chat: [{ role: 'assistant', text: 'ok', at: 1 }] };
    const look = () => snap;
    const m = mobile.mobileModel(MODEL, NOW, 'my-pc', new Set(), look);
    assert.equal(m.tasks[0].state, 'background');
    assert.equal(m.tasks[0].attached, true);
    assert.deepEqual(m.tasks[0].last, snap.last);
    const p = mobile.phoneModel(MODEL, m.tasks[0].id, NOW, new Set(), look);
    assert.equal(p.state, 'background');
    assert.deepEqual(p.waiting, snap.waiting);
    assert.deepEqual(p.chat, snap.chat);
    assert.equal(p.gate, null);
    assert.equal(mobile.phoneModel(MODEL, 'ffffffff-0000-4000-8000-000000000000', NOW, new Set(), look), null);
    assert.equal(mobile.mobileModel(MODEL, NOW, 'my-pc', new Set()).tasks[0].state, 'idle', 'no look: no lines, idle');
});
```

(`MODEL` and `NOW` are the names the file's own fixture uses; rename to match.)

In `tests/station-phone.test.js` — copy `fakeTailscale`, `request`, `form` and `start` from `tests/station-remote.test.js` with `const NAME = 'station.example.invalid'`, then:

```js
const remote = require('../lib/remote.js');
const phone = require('../lib/phone.js');
const SID = 'ffffffff-9999-4999-8999-000000000001';
const TAILNET = { host: NAME, origin: 'https://' + NAME };

function fixture() {
    const base = tmp('fankeel-station-phone-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    registry.writeSession(r1, SID, { task: 't', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: '2026-10-22T08:00:00.000Z', updated: new Date().toISOString(), configDir: cfg });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({ pid: process.pid, sessionId: SID, cwd: r1, startedAt: Date.now() }));
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: '2026-10-22T08:00:00.000Z' }) + '\n');
    fs.writeFileSync(profile.machineFile(cfg), JSON.stringify({ 'station.remote': true }) + '\n');
    const now = Date.now();
    const paired = remote.pair(cfg, remote.newCode(cfg, now).value, 'S24', now);
    return { cfg, r1, cookie: 'fk_device=' + paired.token };
}

test('a paired phone attaches, says, is refused a second message, and detaches', async () => {
    const f = fixture();
    const s = await start(f, fakeTailscale());
    const as = (cookie) => Object.assign({ cookie }, TAILNET);
    const body = (o) => form(Object.assign({ root: f.r1, id: SID }, o));
    try {
        assert.equal((await request(s.url + 'phone/say', { headers: TAILNET, body: body({ text: 'x' }) })).status, 401);
        assert.equal((await request(s.url + 'phone/say', { headers: as(f.cookie), body: body({ text: 'x' }) })).status, 409);
        assert.equal((await request(s.url + 'phone/attach', { headers: as(f.cookie), body: body({}) })).status, 201);
        assert.equal(phone.dirOf(f.r1, SID) && fs.existsSync(path.join(phone.dirOf(f.r1, SID), 'attach.json')), true);
        assert.equal((await request(s.url + 'phone/say', { headers: as(f.cookie), body: body({ text: '跑吧' }) })).status, 201);
        assert.equal(JSON.parse(fs.readFileSync(path.join(phone.dirOf(f.r1, SID), 'inbox.json'), 'utf8')).text, '跑吧');
        assert.equal((await request(s.url + 'phone/say', { headers: as(f.cookie), body: body({ text: 'more' }) })).status, 409);
        const got = JSON.parse((await request(s.url + 'station/phone.json?id=' + SID, { headers: as(f.cookie) })).text);
        assert.equal(got.attached, true);
        assert.equal(got.waiting.text, '跑吧');
        phone.append(f.r1, SID, { role: 'assistant', text: 'started', at: Date.now() });
        phone.writeBackground(f.r1, SID, [{ id: 'b1', type: 'shell', status: 'running', description: 'build', command: 'npm run build' }], Date.now());
        const m = JSON.parse((await request(s.url + 'station/mobile.json', { headers: as(f.cookie) })).text);
        assert.equal(m.tasks[0].state, 'background');
        assert.equal(m.tasks[0].background.length, 1);
        assert.equal((await request(s.url + 'station/phone.json?id=eeeeeeee-0000-4000-8000-000000000000', { headers: as(f.cookie) })).status, 404);
        assert.equal((await request(s.url + 'phone/detach', { headers: as(f.cookie), body: body({}) })).status, 200);
        assert.equal(phone.isAttached(f.r1, SID), false);
    } finally {
        s.close();
    }
});

test('the phone routes are device routes, and the reference names them', () => {
    assert.equal(remote.policy('POST', '/phone/say'), 'device');
    assert.equal(remote.policy('POST', '/phone/attach'), 'device');
    assert.equal(remote.policy('GET', '/station/phone.json'), 'device');
    const ref = fs.readFileSync(path.join(__dirname, '..', 'docs', '90-agent', 'reference', 'station.md'), 'utf8');
    for (const route of ['/station/phone.json', '/phone/attach', '/phone/detach', '/phone/say']) assert.ok(ref.includes(route), route);
});
```

2. Run `node --test tests/station-phone.test.js tests/mobile-model.test.js`; watch both fail.

3. In `lib/mobile.js`, add the phone's states. Add at the top of `lib/mobile.js`:

```js
const phone = require('./phone.js');
```

and replace the `gates` / `tasks` part of `mobileModel` in `lib/mobile.js` with a shared `gateOf` and the new row fields:

```js
// The gate entry as the phone draws it, or null when none is held.
function gateOf(s, now) {
    if (!held(s, now)) return null;
    return {
        questions: s.pending.questions,
        since: Number.isFinite(s.gateAt) ? s.gateAt : Number.isFinite(s.pending.at) ? s.pending.at : now,
        until: s.pending.until,
    };
}

// `look` is lib/phone.js's snapshot, passed by the server; a model with no
// look reads every session as having no conversation yet.
function rowOf(root, s, now, look) {
    const p = look ? look(root, s.sessionId, now, 0) : null;
    const gate = held(s, now);
    return Object.assign(base(root, s), {
        gate, updated: Number.isFinite(s.updated) ? s.updated : null,
        state: phone.stateOf(true, gate, p || { lastRole: null, background: [] }),
        attached: Boolean(p && p.attached), background: p ? p.background : [], last: p ? p.last : null,
    });
}

function mobileModel(model, now, host, hidden, look) {
    const all = rowsOf(model, hidden);
    const gates = all.filter(({ s }) => held(s, now))
        .map(({ root, s }) => Object.assign(base(root, s), gateOf(s, now)))
        .sort((a, b) => a.since - b.since);
    const tasks = all.filter(({ s }) => s.state === 'live')
        .map(({ root, s }) => rowOf(root, s, now, look))
        .sort((a, b) => (b.updated || 0) - (a.updated || 0));
```

(the `done` part and the return stay as they are). Add `phoneModel` to `lib/mobile.js` and export it:

```js
// /station/phone.json: one session's conversation screen.
function phoneModel(model, id, now, hidden, look) {
    const hit = rowsOf(model, hidden).find(({ s }) => s.sessionId === id);
    if (!hit) return null;
    const { root, s } = hit;
    const p = look ? look(root, s.sessionId, now, 50) : null;
    const gate = gateOf(s, now);
    return Object.assign(base(root, s), {
        state: phone.stateOf(s.state === 'live', Boolean(gate), p || { lastRole: null, background: [] }),
        attached: Boolean(p && p.attached), waiting: p ? p.waiting : null, chat: p ? p.chat : [],
        gate, background: p ? p.background : [], at: now,
    });
}

module.exports = { mobileModel, phoneModel, shell, manifest, icon };
```

4. In `scripts/station.js`, require the channel beside `mobile`:

```js
const phone = require('../lib/phone.js');
```

In `scripts/station.js`, the `/station/mobile.json` route passes the look as the fifth argument:

```js
            return send(200, 'application/json', JSON.stringify(mobile.mobileModel(model, Date.now(), host, station.hiddenPkeys(model), phone.snapshot)), noStore);
```

Directly after that route in `scripts/station.js`, add:

```js
        if (req.method === 'GET' && url.pathname === '/station/phone.json') {
            // One session's conversation, read every 2 s while its screen is open.
            const model = sharedModel();
            const got = mobile.phoneModel(model, url.searchParams.get('id') || '', Date.now(), station.hiddenPkeys(model), phone.snapshot);
            if (!got) return fail(404, 'no such session on this station');
            return send(200, 'application/json', JSON.stringify(got), noStore);
        }
        // The phone's three actions on a session (2026-10-22-mobile-session-design.md §4),
        // under the same device policy as /answer.
        const PHONE_ACT = /^\/phone\/(attach|detach|say)$/.exec(url.pathname);
        if (req.method === 'POST' && PHONE_ACT) {
            const got = await formAndRegistry();
            if (!got) return;
            const { form, reg } = got;
            const id = form.get('id') || '';
            const row = reg && reg.sessions.find((s) => s.sessionId === id);
            if (!row) return fail(404, 'no such session on this station');
            if (PHONE_ACT[1] === 'attach') {
                if (row.state !== 'live') return fail(409, 'that session is not running');
                phone.attach(reg.root, id, device ? device.name : 'this machine', Date.now());
                return send(201, 'text/plain; charset=utf-8', 'attached\n');
            }
            if (PHONE_ACT[1] === 'detach') {
                phone.detach(reg.root, id);
                return send(200, 'text/plain; charset=utf-8', 'detached\n');
            }
            const said = phone.say(reg.root, id, form.get('text'), Date.now());
            if (!said.ok) return fail(said.code, said.reason);
            return send(201, 'text/plain; charset=utf-8', 'waiting for the turn to end\n');
        }
```

5. In `docs/90-agent/reference/station.md`, after the `/station/mobile.json` paragraph (line ~1416), add:

```md
`GET /station/phone.json?id=<session>` is one session's conversation screen:
`state` (`gate`, `holding`, `running`, `background`, `idle`), `attached`,
`waiting`, the last 50 `chat` lines, the held `gate` and the `background`
items, from `lib/mobile.js`'s `phoneModel` over `lib/phone.js`'s files. The
phone acts on a session with `POST /phone/attach`, `POST /phone/detach` and
`POST /phone/say` (`root`, `id`, and `text` for say): attach refuses a session
that is not live (409), say refuses an unattached session or a second waiting
message (409) and answers 201, `mobile.json`'s task rows carry the same
`state`, `attached`, `background` and `last`.
```

and in the device-policy paragraph (~1519-1531) of `docs/90-agent/reference/station.md`, add `/station/phone.json` and `/phone/attach`, `/phone/detach`, `/phone/say` to the list of routes a paired cookie reaches.

6. `git add tests/station-phone.test.js`, then run `node --test tests/station-phone.test.js tests/mobile-model.test.js tests/station-remote.test.js`; all pass.

7. Commit: `feat: the station serves a session's conversation and the phone's actions`.

## Task 9: Phone page redraw

**Read:** the design's §5 and "What the phone shows"; the mockup's direction A.

**Files:**
- Modify: `assets/station/mobile.js` — the session list, the conversation screen, the gate card, steps, composer, mic
- Modify: `assets/station/mobile.css` — direction A's rules
- Read: `.fankeel/build/2026-10-22-mobile-session/mockup.html` — blocks `m-home-a`, `m-chat-a`, `m-composer-a`, `m-tools`, `m-attach`, `m-background`, `m-idle`, `m-gate-inline`; icon paths at lines 152-171; CSS at 47-147, 197-244, 344-377, 643-648, 674-692, 725-738, 765-807
- Test: `tests/station-mobile-page.test.js` — the fixture at :23-38, the old-shape tests between :42 and :458, and `sheetForm` at :254-264, as step 1 lists; :1-22, :39-40, the kept tests, the boot harness and the sw.js part from :460 stay
- Test: `tests/station-mobile-route.test.js` — its last test

**Interfaces:**
- Consumes: Task 8 — `mobileModel`'s task rows `{id, root, task, project, stage, route, gate, updated, state, attached, background, last}` at `GET /station/mobile.json`; `phoneModel` `{id, root, task, project, stage, route, state, attached, waiting, chat, gate, background, at}` at `GET /station/phone.json?id=`; `POST /phone/attach|detach|say`
- Produces: `window.FK_M` / `module.exports` = `{parseRoute, screen, answersOf, collect, codeIn, setLang, STR, turnsOf, stepsLine, dur, SCREEN}`; `screen(M, R, now, ui, P) -> string`

**Dispatch:** implementer, opus — a page drawn from a mockup, with refresh rules to reason about; changes a page, so build adds fankeel-render-reviewer against the mockup (/m, no .fankeel/render.json).

1. Write the failing tests in `tests/station-mobile-page.test.js` (4-space indent, as the file has). Line by line against the file as it stands:

- **Keep :1-22** unchanged: the header, the requires with `const P = require('../assets/station/mobile.js')` (:11), `ASSETS`, `read(name)` (:14), `CJK` (:15), `NOW` (:17, 2026-10-21 11:02 local) and `Q1`/`Q2` (:18-22). The new code below declares no second `P` or `NOW`.
- **Remove :23-38** (the old `M`) and put the fixture block A below in its place.
- **Keep :39-40** (`APP`, `count`).
- **Remove :42-53** (the old `parseRoute` test, `{tab, open, focus, pair}`) and put test block B below in its place.
- **Keep :55-78** (`codeIn`, `answersOf`, `collect`): those functions stay in `mobile.js`.
- **Remove :80-148** (待答, the gate sheet, 任務, 完成 tabs).
- **Keep :150-168** (pair-scan, pair-error): the pair and off screens stay.
- **Remove :170-227** (escaping, English, mobile.css against the old screens) and put test block C below in its place.
- **Keep :229-253** (`SRC`, `boot`) and **:265-278** (`pick`, `ownBox`, `pairForm`, `submit`, `tap`, `reply`, `settle`); **replace :254-264** (`sheetForm`, the gate sheet) with block D.
- **Remove :280-357** and **:380-406** and **:419-458**; **keep :359-378** (the typed pairing code) unchanged; **keep :408-417** (自己寫 ticks its own `__other`) with its one `reply(200, M)` changed to `reply(200, HOME)`. Put test block E where :280-357 was.
- **Keep :460-508** (the sw.js part) unchanged.

Block A in `tests/station-mobile-page.test.js` — the fixture, in place of :23-38 (it uses `Q1` from :18):

```js
const row = (id, state, extra) => Object.assign({ id, root: '/w', task: 'task ' + id, project: 'proj', stage: 'build', route: [], gate: state === 'gate', updated: NOW, state, attached: false, background: [], last: null }, extra);
const BG = [{ id: 'b1', type: 'shell', status: 'running', description: 'npm test', command: 'npm test', since: NOW - 90e3 },
    { id: 'b2', type: 'agent', status: 'running', description: 'review', command: '', since: NOW - 30e3 },
    { id: 'b3', type: 'shell', status: 'running', description: 'build', command: 'x', since: NOW - 10e3 }];
const HOME = { host: 'my-pc', at: NOW, gates: [Object.assign(row('aaaaaaaa-1', 'gate'), { questions: Q1, since: NOW - 60e3, until: NOW + 240e3 })],
    tasks: [row('aaaaaaaa-1', 'gate'), row('aaaaaaaa-2', 'running', { last: { role: 'desktop', text: '跑測試', at: NOW } }), row('aaaaaaaa-3', 'background', { background: BG }), row('aaaaaaaa-4', 'idle'), row('aaaaaaaa-5', 'holding', { attached: true })], done: [] };
// One session's /station/phone.json; `sess`, not `page`, so a boot test's own `page` does not shadow it.
const sess = (state, extra) => Object.assign({ id: 'aaaaaaaa-2', root: '/w', task: 't', project: 'proj', stage: 'build', route: [], state, attached: false, waiting: null, chat: [], gate: null, background: [], at: NOW }, extra);
```

Block B in `tests/station-mobile-page.test.js` — in place of :42-53 (it uses `APP` and `count` from :39-40):

```js
test('parseRoute: home, a session, the old gate and task links, done, pair', () => {
    assert.deepEqual(P.parseRoute(''), { view: 'home', id: null, pair: null });
    assert.deepEqual(P.parseRoute('#/s/aaaaaaaa-2'), { view: 'chat', id: 'aaaaaaaa-2', pair: null });
    assert.deepEqual(P.parseRoute('#/gate/aaaaaaaa-1'), { view: 'chat', id: 'aaaaaaaa-1', pair: null });
    assert.deepEqual(P.parseRoute('#/task/aaaaaaaa-1'), { view: 'chat', id: 'aaaaaaaa-1', pair: null });
    assert.deepEqual(P.parseRoute('#/done'), { view: 'done', id: null, pair: null });
    assert.deepEqual(P.parseRoute('#/pair/abcd2345'), { view: 'home', id: null, pair: 'ABCD2345' });
});

test('home: 等你答 first, then holding, running and background, then idle, under three counts', () => {
    const html = P.screen(HOME, P.parseRoute('#/'), NOW, APP);
    assert.match(html, /data-block="m-home-a"/);
    const order = ['ha-ask', 'ha-list', 'ha-idle'].map((c) => html.indexOf('class="' + c));
    assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), String(order));
    assert.equal(count(html, /<span class="st ask">/g), 1);
    assert.ok(html.indexOf('aaaaaaaa-5') < html.indexOf('aaaaaaaa-2') && html.indexOf('aaaaaaaa-2') < html.indexOf('aaaaaaaa-3'));
    assert.match(html, /\+1 個/, 'a background row names two items and +N for the rest');
    assert.match(html, /你：跑測試/);
});

test('each state draws its own screen block', () => {
    const R = P.parseRoute('#/s/aaaaaaaa-2');
    for (const [state, extra] of [['idle', {}], ['background', { background: BG }], ['running', {}], ['holding', { attached: true }]]) {
        const html = P.screen(HOME, R, NOW, APP, sess(state, extra));
        assert.ok(html.includes(P.SCREEN[state]), state);
    }
    const gate = P.screen(HOME, R, NOW, APP, sess('gate', { gate: { questions: Q1, since: NOW - 60e3, until: NOW + 240e3 } }));
    assert.match(gate, /data-block="m-gate-inline"/);
    assert.match(gate, /id="gate-card"/);
    assert.doesNotMatch(gate, /data-block="m-composer-a"/);
});

test('idle has no composer and names /fankeel-phone; background lists every item and needs no reply', () => {
    const R = P.parseRoute('#/s/aaaaaaaa-2');
    const idle = P.screen(HOME, R, NOW, APP, sess('idle'));
    assert.doesNotMatch(idle, /id="cmp-box"/);
    assert.match(idle, /\/fankeel-phone/);
    const bg = P.screen(HOME, R, NOW, APP, sess('background', { background: BG }));
    assert.equal(count(bg, /class="bgp-i/g), 3);
    assert.match(bg, /不用回覆/);
    assert.match(bg, /data-act="attach"/);
});

test('steps group into one line when the turn is over, and show the last three while it runs', () => {
    const chat = [{ role: 'phone', text: 'go', at: NOW - 9e3 }];
    for (let i = 0; i < 5; i++) chat.push({ role: 'tool', id: 't' + i, tool: i === 1 ? 'Edit' : 'Bash', label: 'step ' + i, at: NOW - 8e3 + i }, { role: 'tool-end', id: 't' + i, ok: i !== 2, at: NOW - 7e3 + i });
    const turns = P.turnsOf(chat);
    assert.equal(turns.filter((x) => x.kind === 'steps').length, 1);
    assert.match(P.stepsLine(turns[1].items), /^5 個步驟 · 改了 1 個檔 · 1 個失敗$/);
    const ran = P.screen(HOME, P.parseRoute('#/s/aaaaaaaa-2'), NOW, APP, sess('running', { chat: chat.concat([{ role: 'tool', id: 't9', tool: 'Bash', label: 'last', at: NOW - 1e3 }]) }));
    assert.match(ran, /正在：last/);
    assert.match(ran, /data-block="m-tools"/);
    assert.equal(P.dur(4200), '4.2 秒');
    assert.equal(P.dur(42e3), '42 秒');
    assert.equal(P.dur(125e3), '2 分 5 秒');
});

test('the composer: a waiting message disables it; the mic is drawn only with a Speech API', () => {
    const R = P.parseRoute('#/s/aaaaaaaa-5');
    const held = sess('holding', { attached: true });
    assert.doesNotMatch(P.screen(HOME, R, NOW, Object.assign({ mic: false }, APP), held), /class="mic"/);
    assert.match(P.screen(HOME, R, NOW, Object.assign({ mic: true }, APP), held), /data-mic="cmp-box"/);
    const waiting = P.screen(HOME, R, NOW, APP, Object.assign({}, held, { waiting: { text: '等等', at: NOW } }));
    assert.match(waiting, /<textarea[^>]*id="cmp-box"[^>]*disabled/);
    assert.match(waiting, /等這回合跑完就送進去/);
});
```

Block C in `tests/station-mobile-page.test.js` — in place of :170-227 (the old escaping, English and mobile.css tests, redrawn against `HOME` and `sess`; the five mobile.css assertions of the old :221-225 carry over, since step 4 keeps those rules):

```js
const GATE = { questions: Q1, since: NOW - 60e3, until: NOW + 240e3 };

test('every value from the registry is escaped', () => {
    const bad = '<img src=x onerror=alert(1)>';
    const home = Object.assign({}, HOME, {
        host: bad,
        gates: [Object.assign({}, HOME.gates[0], { task: bad, project: bad, questions: [{ question: bad, options: [{ label: bad, description: bad }] }] })],
        tasks: HOME.tasks.map((x) => Object.assign({}, x, { task: bad, project: bad, last: { role: 'desktop', text: bad, at: NOW } })),
        done: [{ id: 'dddd-4', root: '/w', task: bad, project: bad, stage: 'land', route: [], kind: 'end', at: NOW - 20 * 60e3, usd: 1, stages: 6 }],
    });
    const R = P.parseRoute('#/s/aaaaaaaa-2');
    const chat = [{ role: 'phone', text: bad, at: NOW - 3e3 }, { role: 'assistant', text: bad, at: NOW - 1e3 }];
    const screens = [
        P.screen(home, P.parseRoute('#/'), NOW, APP),
        P.screen(home, P.parseRoute('#/done'), NOW, APP),
        P.screen(home, R, NOW, APP, sess('holding', { task: bad, attached: true, chat, waiting: { text: bad, at: NOW } })),
        P.screen(home, R, NOW, APP, sess('background', { background: [Object.assign({}, BG[0], { description: bad })] })),
        P.screen(home, R, NOW, APP, sess('gate', { gate: Object.assign({}, GATE, { questions: home.gates[0].questions }) })),
    ];
    for (const html of screens) {
        assert.ok(!html.includes('<img'), html.slice(0, 160));
        assert.ok(html.includes('&lt;img'), html.slice(0, 160));
    }
});

test('English: the same keys in both tables, and no CJK left on home, a chat in each state, or the pair screens', () => {
    assert.deepEqual(Object.keys(P.STR.en).sort(), Object.keys(P.STR.zh).sort());
    for (const [k, v] of Object.entries(P.STR.en)) assert.ok(!CJK.test(v), k + ' is not English: ' + v);
    const ascii = (o) => JSON.parse(JSON.stringify(o).replace(/[^\x00-\x7f]+/g, 'x'));
    const home = ascii(HOME);
    const R = P.parseRoute('#/s/aaaaaaaa-2');
    P.setLang('en');
    try {
        const screens = [
            P.screen(home, P.parseRoute('#/'), NOW, APP),
            P.screen(home, P.parseRoute('#/done'), NOW, APP),
            ...['idle', 'running', 'background', 'holding'].map((s) => P.screen(home, R, NOW, Object.assign({ mic: true }, APP), ascii(sess(s, { attached: s === 'holding', background: BG })))),
            P.screen(home, R, NOW, APP, ascii(sess('gate', { gate: Object.assign({}, GATE, { questions: Q2 }) }))),
            P.screen(null, null, NOW, { mode: 'pair', camera: true }),
            P.screen(null, null, NOW, { mode: 'pair', camera: false, say: 'x' }),
            P.screen(null, null, NOW, { mode: 'off', host: 'ymlab-pc' }),
        ];
        for (const html of screens) assert.equal(CJK.exec(html), null, html.slice(0, 160));
        assert.match(screens[6], /Send answer/);
    } finally {
        P.setLang('zh');
    }
});

test('every class the page draws has a rule, the real page\'s overrides stay, and the old sheet and tab bar are gone', () => {
    const css = read('mobile.css') + read('station.css');
    const STATION = new Set(['dot', 'live', 'hm-stw', 'route', 'now', 'todo', 'pill', 'gate', 'gq-rec', 'glyph', 'gseg', 'done', 'gedge', 'gcore']);
    const R = P.parseRoute('#/s/aaaaaaaa-2');
    const all = [P.screen(HOME, P.parseRoute('#/'), NOW, APP)]
        .concat(['idle', 'running', 'background', 'holding'].map((s) => P.screen(HOME, R, NOW, Object.assign({ mic: true }, APP), sess(s, { attached: s === 'holding', background: BG }))))
        .concat([P.screen(HOME, R, NOW, Object.assign({ mic: true }, APP), sess('gate', { gate: Object.assign({}, GATE, { questions: Q2 }) })),
            P.screen(null, null, NOW, { mode: 'pair', camera: true }), P.screen(null, null, NOW, { mode: 'pair', camera: false, say: 'x' }), P.screen(null, null, NOW, { mode: 'off' })]);
    for (const html of all) {
        for (const m of html.matchAll(/class="([^"]+)"/g)) {
            for (const c of m[1].split(/\s+/)) if (!STATION.has(c)) assert.ok(new RegExp('\\.' + c + '(?![\\w-])').test(css), c);
        }
    }
    const mcss = read('mobile.css');
    assert.ok(mcss.includes('body.m{min-width:0'), 'station.css holds every page at 1000 px');
    assert.match(mcss, /@media \(min-width:601px\)\{/);
    assert.ok(mcss.includes('.vf video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}'));
    assert.ok(mcss.includes('.opt .own{'), 'the 自己寫 box is not hidden like the radios');
    assert.match(mcss, /@media \(prefers-reduced-motion:reduce\)\{/);
    assert.doesNotMatch(mcss, /\.gest|\.mk|\.phone\{|\.cbar|\.shade|\.nt-|\.rm-|\.m-switch|\.tabbar|\.sheet/);
});
```

Block D in `tests/station-mobile-page.test.js` — in place of `sheetForm` (:254-264); `answer()` reads the gate card as it read the sheet, with `.gc-st` for `.sh-say`:

```js
// The gate card as answer() reads it: data-id, its .gc-st line, its .cta button, its inputs.
function cardForm(id, inputs) {
    const say = { textContent: '' };
    const btn = { disabled: false };
    return {
        id: 'gate-card', say, btn,
        getAttribute: (a) => (a === 'data-id' ? id : null),
        querySelector: (s) => (s === '.gc-st' ? say : s === '.cta' ? btn : null),
        querySelectorAll: () => inputs,
    };
}
// The composer as its submit reads it: the one textarea.
const composerForm = (text) => ({ id: 'composer', getAttribute: () => null, querySelector: (s) => (s === 'textarea' ? { value: text } : null) });
```

Block E in `tests/station-mobile-page.test.js` — in place of :280-357 (it uses `boot`, `reply`, `settle`, `submit`, `tap`, `pick`, `ownBox` from the kept harness, `cardForm` and `composerForm` from block D):

```js
const PHONE = '/station/phone.json?id=';
// mobile.json is HOME, phone.json is `one`, and every POST is a 201.
const routed = (one) => (url) => (url === '/station/mobile.json' ? reply(200, HOME) : url.startsWith(PHONE) ? reply(200, one) : reply(201, ''));
const callsTo = (page, url) => page.calls.filter((c) => c.url === url);

test('boot: an unpaired phone sees pair-scan, a paired one the session list, an unreachable station pair-error', async () => {
    const unpaired = boot({ fetch: () => reply(401, 'pair this phone first') });
    await settle();
    assert.equal(unpaired.calls[0].url, '/station/mobile.json');
    assert.match(unpaired.app.innerHTML, /data-block="pair-scan"/);
    assert.match(unpaired.app.innerHTML, /data-pair-form="1"/, 'no BarcodeDetector here: the typed code');
    const paired = boot({ fetch: () => reply(200, HOME) });
    await settle();
    assert.match(paired.app.innerHTML, /data-block="m-home-a"/);
    assert.equal(paired.store['station.m.host'], 'my-pc');
    assert.equal(paired.win.FK_M.parseRoute('#/done').view, 'done');
    const away = boot({ store: { 'station.m.host': 'ymlab-pc' }, fetch: () => Promise.reject(new Error('offline')) });
    await settle();
    assert.match(away.app.innerHTML, /data-block="pair-error"/);
    assert.match(away.app.innerHTML, /連不到 ymlab-pc/);
});

test('boot: a pairing url opened on an unpaired phone pairs with its code, then shows the session list', async () => {
    let reads = 0;
    const page = boot({
        hash: '#/pair/ABCD2345',
        fetch: (url) => {
            if (url === '/station/remote/pair') return reply(201, { device: { id: '0123456789abcdef', name: 'Android' } });
            reads += 1;
            return reads === 1 ? reply(401, 'pair this phone first') : reply(200, HOME);
        },
    });
    await settle();
    const pair = page.calls.find((c) => c.url === '/station/remote/pair');
    assert.ok(pair, 'no pairing POST');
    assert.equal(pair.init.body, 'code=ABCD2345&name=Android');
    assert.equal(page.win.location.hash, '#/');
    assert.match(page.app.innerHTML, /data-block="m-home-a"/);
});

test('boot: a hash change to #/s/<id> reads that session\'s phone.json and draws its screen', async () => {
    const page = boot({ hash: '#/', fetch: routed(sess('running')) });
    await settle();
    page.win.location.hash = '#/s/aaaaaaaa-2';
    page.fireWin('hashchange');
    await settle();
    assert.ok(page.calls.some((c) => c.url === PHONE + 'aaaaaaaa-2'));
    assert.match(page.app.innerHTML, /data-block="m-attach"/);
});

test('boot: the composer posts /phone/say, and its 201 reads phone.json again', async () => {
    const page = boot({ hash: '#/s/aaaaaaaa-5', fetch: routed(sess('holding', { id: 'aaaaaaaa-5', attached: true })) });
    await settle();
    const before = callsTo(page, PHONE + 'aaaaaaaa-5').length;
    const e = page.fire('submit', submit(composerForm('跑測試')));
    assert.equal(e.prevented, true);
    await settle();
    const sent = callsTo(page, '/phone/say');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].init.method, 'POST');
    assert.equal(sent[0].init.headers['content-type'], 'application/x-www-form-urlencoded');
    assert.equal(sent[0].init.body, new URLSearchParams({ root: '/w', id: 'aaaaaaaa-5', text: '跑測試' }).toString());
    assert.ok(callsTo(page, PHONE + 'aaaaaaaa-5').length > before);
});

test('boot: 接上這個 session posts /phone/attach with the session\'s root and id', async () => {
    const page = boot({ hash: '#/s/aaaaaaaa-2', fetch: routed(sess('running')) });
    await settle();
    page.fire('click', tap({ 'data-act': 'attach' }));
    await settle();
    const sent = callsTo(page, '/phone/attach');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].init.body, new URLSearchParams({ root: '/w', id: 'aaaaaaaa-2' }).toString());
});

test('boot: the gate card\'s 送出答案 posts answersOf\'s JSON to /answer', async () => {
    const page = boot({ hash: '#/s/aaaaaaaa-1', fetch: routed(sess('gate', { id: 'aaaaaaaa-1', gate: GATE })) });
    await settle();
    const f = cardForm('aaaaaaaa-1', [pick('q0', '改 mockup', true), pick('q0', '__other', false), ownBox(0, 'ignored')]);
    const e = page.fire('submit', submit(f));
    assert.equal(e.prevented, true);
    await settle();
    const sent = callsTo(page, '/answer');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].init.body, new URLSearchParams({ root: '/w', id: 'aaaaaaaa-1', answers: JSON.stringify({ [Q1[0].question]: '改 mockup' }) }).toString());
});

test('boot: retry reads again, repair and manual show pair-scan', async () => {
    let up = false;
    const page = boot({ store: { 'station.m.host': 'ymlab-pc' }, fetch: () => (up ? reply(200, HOME) : Promise.reject(new Error('offline'))) });
    await settle();
    assert.match(page.app.innerHTML, /data-block="pair-error"/);
    up = true;
    page.fire('click', tap({ 'data-act': 'retry' }));
    await settle();
    assert.equal(page.reads(), 2);
    assert.match(page.app.innerHTML, /data-block="m-home-a"/);
    page.fire('click', tap({ 'data-act': 'repair' }));
    assert.match(page.app.innerHTML, /data-block="pair-scan"/);
    page.app.innerHTML = '';
    page.fire('click', tap({ 'data-act': 'manual' }));
    assert.match(page.app.innerHTML, /data-pair-form="1"/);
});

test('boot: coming back into view reads the session list again', async () => {
    const page = boot({ hash: '#/', fetch: () => reply(200, HOME) });
    await settle();
    page.doc.visibilityState = 'hidden';
    page.fire('visibilitychange');
    assert.equal(page.reads(), 1);
    page.doc.visibilityState = 'visible';
    page.fire('visibilitychange');
    await settle();
    assert.equal(page.reads(), 2);
});

test('boot: a screen that fails to draw is thrown, not shown as a station out of reach', async () => {
    const thrown = [];
    const page = boot({ fetch: () => reply(200, { host: 'ymlab-pc', gates: [], tasks: { length: 1 } }), win: { setTimeout: (fn) => { thrown.push(fn); } } });
    await settle();
    assert.doesNotMatch(page.app.innerHTML, /pair-error/);
    assert.equal(thrown.length, 1);
    assert.throws(thrown[0], TypeError);
});
```

After these edits the file declares `P`, `NOW`, `read`, `CJK`, `Q1`, `Q2`, `APP`, `count`, `boot`, `pick`, `ownBox`, `pairForm`, `submit`, `tap`, `reply` and `settle` once each, all at their old lines; the kept :359-378 and :408-417 tests use only those.

In `tests/station-mobile-route.test.js`, the last test's assertions become:

```js
    const P = require('../assets/station/mobile.js');
    const html = P.screen(json, P.parseRoute('#/'), json.at, { mode: 'app' });
    assert.equal((html.match(/<span class="st ask">/g) || []).length, json.tasks.filter((x) => x.state === 'gate').length);
```

and its title: `the phone home's 等你答 rows and /station/mobile.json's gate states agree in number`.

2. Run `node --test tests/station-mobile-page.test.js tests/station-mobile-route.test.js`; watch them fail.

3. Rewrite `assets/station/mobile.js`, keeping the IIFE, `STR`/`t`/`esc`/`ic`/`ago`/`hm`, `codeIn`, `answersOf`, `collect`, `optionHtml`, the pair and off screens and the service-worker registration. Port each block's markup from the mockup's direction A, keeping its literal `data-block` attribute. The routing and screen map in `assets/station/mobile.js`:

```js
    // #/ the session list, #/s/<id> one session's conversation (#/gate/<id>
    // and #/task/<id>, which lib/notify.js's taps open, land there too),
    // #/done the history, #/pair/<code> the desktop QR's pairing url.
    function parseRoute(hash) {
        var h = String(hash || '').replace(/^#/, '');
        var m = /^\/pair\/([A-Za-z0-9]{8})$/.exec(h);
        if (m) return { view: 'home', id: null, pair: m[1].toUpperCase() };
        m = /^\/(?:s|gate|task)\/([0-9A-Za-z-]+)$/.exec(h);
        if (m) return { view: 'chat', id: m[1], pair: null };
        if (h === '/done') return { view: 'done', id: null, pair: null };
        return { view: 'home', id: null, pair: null };
    }

    // Each state's screen root, as the mockup names its block.
    var SCREEN = {
        gate: 'data-block="m-gate-inline"', idle: 'data-block="m-idle"', background: 'data-block="m-background"',
        holding: 'data-block="m-chat-a"', attached: 'data-block="m-chat-a"', running: 'data-block="m-attach"',
    };
    var POLL_MS = 5000;
    var CHAT_MS = 2000;
    var ORDER = { holding: 0, running: 1, background: 2 };

    function screen(M, R, now, ui, P) {
        var u = ui || {};
        if (u.mode === 'pair') return pairHtml(u);
        if (u.mode === 'off') return offHtml(u.host);
        var m = M || {};
        var r = R || parseRoute('');
        var at = num(now) ? now : Date.now();
        if (r.view === 'done') return '<div class="pg">' + doneBar(m) + doneHtml(m, at) + '</div>';
        if (r.view === 'chat') return chatHtml(m, r.id, at, u, P);
        return homeHtml(m, at);
    }
```

The steps model in `assets/station/mobile.js` — consecutive `tool` / `tool-end` lines are one group; an empty assistant line ends a turn and draws nothing:

```js
    function turnsOf(chat) {
        var out = [];
        var group = null;
        (chat || []).forEach(function (x) {
            if (x.role === 'tool' || x.role === 'tool-end') {
                if (!group) { group = { kind: 'steps', items: [], ends: {} }; out.push(group); }
                if (x.role === 'tool') group.items.push(x); else group.ends[x.id] = x;
                return;
            }
            group = null;
            if (x.role === 'assistant' && !String(x.text || '').trim()) return;
            out.push({ kind: 'msg', role: x.role, text: String(x.text || ''), at: x.at });
        });
        out.forEach(function (g) {
            if (g.kind !== 'steps') return;
            g.items = g.items.map(function (s) { var e = g.ends[s.id]; return Object.assign({}, s, { end: e ? e.at : null, ok: e ? e.ok !== false : null }); });
        });
        return out;
    }

    // 「N 個步驟 · 改了 K 個檔 · A 個 agent · F 個失敗」— a part only when it is not zero;
    // a step with no tool-end by the turn's end counts as failed (spec, Not verified).
    function stepsLine(items) {
        var files = {};
        var agents = 0;
        var failed = 0;
        items.forEach(function (s) {
            if (/^(Edit|Write|NotebookEdit)$/.test(s.tool)) files[s.label] = true;
            if (s.tool === 'Agent' || s.tool === 'Task') agents++;
            if (s.ok !== true) failed++;
        });
        var k = Object.keys(files).length;
        return [t('steps.n', { n: items.length })]
            .concat(k ? [t('steps.files', { n: k })] : [], agents ? [t('steps.agents', { n: agents })] : [], failed ? [t('steps.failed', { n: failed })] : [])
            .join(' · ');
    }

    function dur(ms) {
        var s = Math.max(0, ms) / 1000;
        if (s < 10) return t('dur.tenths', { n: s.toFixed(1) });
        if (s < 60) return t('dur.sec', { n: Math.floor(s) });
        return t('dur.min', { m: Math.floor(s / 60), s: Math.floor(s % 60) });
    }
```

The strings these use, added to both tables of `STR` in `assets/station/mobile.js` (every other new string — 等你答, 在跑, 停下來, 去答, 交還電腦, 只能看, 接上這個 session, 手機接著：送出就是下一句, 這回合跑完就送進去, 上一句還在等這回合跑完, 按麥克風用講的, 沒有麥克風權限…, 沒聽清楚…, 背景工作完成後 Claude 會自己接著做，不用回覆, 閒置的 session 手機推不動, Claude 正在做…, 已送進 session — goes in the same way, each with an English twin and no CJK in the English table):

```js
            'steps.n': '{n} 個步驟', 'steps.files': '改了 {n} 個檔', 'steps.agents': '{n} 個 agent', 'steps.failed': '{n} 個失敗',
            'dur.tenths': '{n} 秒', 'dur.sec': '{n} 秒', 'dur.min': '{m} 分 {s} 秒',
```

and in the English table of `STR` in `assets/station/mobile.js`:

```js
            'steps.n': '{n} steps', 'steps.files': '{n} files changed', 'steps.agents': '{n} agents', 'steps.failed': '{n} failed',
            'dur.tenths': '{n} s', 'dur.sec': '{n} s', 'dur.min': '{m} min {s} s',
```

The screens in `assets/station/mobile.js`, each ported from its mockup block:
- `homeHtml(m, at)` — `<div class="pg" data-block="m-home-a">`: `.ab` header (h1 `Session`, count, `a.ha-hist href="#/done"` with `ic('hist')`, `.host`); `.ha-sum` three counts (等你 / 在跑 / 閒置); `.ha-ask` (rows of state `gate`, the question from `m.gates` by id, a 去答 link to the session's chat route, 剩 m:ss); `.ha-list` (sorted by `ORDER`, `.ha-prev` the `last` line with 你： for `desktop`/`phone`, a background row's `.bgl` its first two items with elapsed and `+N 個`); `.ha-idle` (`.ha-stop` rows). Avatar `.av`: two-part names give initials, else the first two characters; colour `var(--p-<hash % 6>)`. Chips `<span class="st ask|held|run|bg|idle">` with `ic('gate')`, `ic('phone')`, `<i class="lv">`, `<i class="lv">`, `ic('kbd')`.
- `chatHtml(m, id, at, u, P)` — `<div class="pg" ` + `SCREEN[P.attached && P.state !== 'gate' && P.state !== 'idle' ? 'attached' : P.state]` + `>`; `.ch-h` (`a.bk href="#/"`, title, meta, then `button.give[data-act=detach]` 交還電腦 when attached and no gate, `span.ro` 只能看 when idle); `.cv` role `log`: `turnsOf(P.chat)` as `.msg.me.pc` (電腦), `.msg.me.ph` (手機), `.msg.ai` (Claude; paragraphs on blank lines, inline `code`, `<br>`, capped 2000 characters), the last phone bubble with `.sent` 已送進 session, `P.waiting` as one more phone bubble with `.sent` 等這回合跑完就送進去; a steps group as `<div class="tl" data-block="m-tools">` (closed: `button.tl-sum[data-act=steps][data-key][aria-expanded]` with `stepsLine`; open — the last group while `running` or `gate`: `p.tl-sum` "N 個步驟 · 跑了 m:ss · 前 K 個收起" and the last three rows, done rows `ic('check', 'done')`, the running row `ic('spin', 'now')` 正在：label, each with `dur()`); `running` with no open group `.work` Claude 正在做… and elapsed; `idle` `.ev` 停下來了…; `background` a `.bgp` section of `.bgp-i` items (`ic('term')` for `shell` else `ic('bot')`, description or command, `<small>` kind · HH:MM 開始, elapsed, 跑中) and `.bgp-f`; `gate` `form.gc#gate-card` inside `.cv` (stage, 剩 m:ss · 之後轉回電腦, per question `.gc-q` and `fieldset.opts[data-voice]` from `optionHtml` with the (Recommended)/(建議) option pre-picked, `label.opt.other` with value `__other`, `textarea.own#gc-own<i>[data-own=i]`, `button.gmic[data-mic=gc-own<i>]` only when `u.mic`, `p.gc-say[data-say]`, `p.gc-st`, `button.cta`). Bottom: none for `gate`; `idle` the `.idl` note (閒置的 session 手機推不動, 交給手機 `/fankeel-phone`, 或等它); `holding` or attached the composer `<form class="cmp" id="composer" data-block="m-composer-a">` (`.cmp-row`, plus `no-mic` without a mic, `button.mic[data-mic=cmp-box]` only when `u.mic`, `textarea#cmp-box` holding `u.draft` and `disabled` while `P.waiting`, `button.send` disabled until there is text, `p.cmp-hint[data-say]`); `running` or `background` not attached `.att` with `button.cta[data-act=attach]` 接上這個 session; `p.note` for a refused attach or detach.

The mic in `assets/station/mobile.js` — voice fills the field and never sends:

```js
    function listen(win, btn, boxId, said) {
        var SR = win.SpeechRecognition || win.webkitSpeechRecognition;
        var box = win.document.getElementById(boxId);
        if (!SR || !box) return;
        var opt = btn.closest && btn.closest('.opt');
        var other = opt ? opt.querySelector('input[value="__other"]') : null;
        if (other) other.checked = true;
        var base = box.value ? box.value + ' ' : '';
        var rec = new SR();
        rec.lang = 'zh-TW';
        rec.interimResults = true;
        rec.continuous = true;
        btn.classList.add('on');
        rec.onresult = function (e) {
            var fin = '';
            var mid = '';
            for (var i = 0; i < e.results.length; i++) {
                if (e.results[i].isFinal) fin += e.results[i][0].transcript; else mid += e.results[i][0].transcript;
            }
            box.value = base + fin + mid;
            box.classList.toggle('interim', Boolean(mid));
        };
        rec.onerror = function (e) {
            said(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? t('mic.denied') : t('mic.missed'));
        };
        rec.onend = function () { btn.classList.remove('on'); box.classList.remove('interim'); };
        rec.start();
    }
```

In `boot` of `assets/station/mobile.js`: `ui.mic = Boolean(win.SpeechRecognition || win.webkitSpeechRecognition)`; the home reads `/station/mobile.json` every `POLL_MS` while visible; the chat reads `/station/phone.json?id=<id>` every `CHAT_MS` while visible and on `hashchange`; `refresh(before, P)` skips when the JSON is unchanged, never redraws a gate card for the same gate (`until`), patches only `.cv`'s `innerHTML` when `state`, `attached` and `waiting` are unchanged, and otherwise draws the whole screen; the draft lives in `ui.draft` across redraws. Posts: `/phone/say` `{root, id, text}` (201 clears the draft and reloads `phone.json`), `/phone/attach` and `/phone/detach` `{root, id}`, `/answer` `{root, id, answers}` — `root` and `id` from the last `phone.json`, the answer's from the gate in `mobile.json`'s `gates`, as `gateOf` finds it today. What block D and E of step 1 hold the page to: `form#gate-card` carries `data-id` (the session id), and `answer(f)` reads it as it read the sheet, with `f.querySelector('.gc-st')` for the line and `f.querySelector('.cta')` for the button; the submit handler sends `#composer` with the value of `f.querySelector('textarea')`; a pairing that succeeds sets the hash to `#/`; the polls run on `win.setInterval`, and `win.setTimeout` is called once per failed draw, to rethrow it, as `load()` does now. Export: `parseRoute, screen, answersOf, collect, codeIn, setLang, STR, turnsOf, stepsLine, dur, SCREEN`.

4. Rewrite `assets/station/mobile.css`: keep the icon rules, `.scr`, `.ab`, `.host`, `.body`/`.grp`/`.grp-h`/`.row`/`.r-*`/`.ago`, `.opts`/`.opt` (and the `.opt .own` rule), `.cta`, `.ghost`, the done list, pair/off/solo/vf (keep `.vf video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}`), `.empty`, the `body.m{min-width:0` real-page block, `@media (min-width:601px){` and the reduced-motion block; drop `.tabbar`, `.tb`, `.dim`, `.sheet`, `.grab`, `.sh-*`, `.route`, `.r-st`, `.pill`, `.row[data-focus]`; port the mockup's rules at lines 47-147 (`.m-ic` -> `.ic`, `.m-mono` -> `.mono`), 197-244 (home), 344-377 (composer), 643-648 (attach), 674-692 (background), 725-738 (idle), 765-807 (gate card). Then add to `assets/station/mobile.css`:

```css
.pg{display:flex;flex-direction:column;min-height:100%}
.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.cmp-row.no-mic{grid-template-columns:1fr auto}
.note{margin:6px 16px 0;font-size:13px;color:var(--warn,#b45309)}
.gc-st{margin:6px 0 0;font-size:13px;min-height:1.2em}
.ab .bk{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;margin-left:-8px;color:inherit}
body.m .cv,body.m .ha-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}
body.m .cmp{padding-bottom:calc(8px + env(safe-area-inset-bottom))}
```

5. Run `node --test tests/station-mobile-page.test.js tests/station-mobile-route.test.js`; both pass.

6. Commit: `feat: the phone page as a list of sessions and their conversations`.

## Task 10: Tailscale on Windows

**Read:** the design's §6.

**Files:**
- Modify: `lib/tailscale.js` — `runTailscale(args, deps)` with the win32 fallback; exported
- Modify: `docs/01-guide/tailscale-setup.md` — the `## Windows：spawnSync tailscale ENOENT` section
- Test: `tests/tailscale-win.test.js`

**Interfaces:**
- Consumes: none
- Produces: `runTailscale` — `runTailscale(args, deps?) -> {status, stdout, stderr}`, `deps = {spawn, platform, env}`

**Dispatch:** implementer, opus — architectural floor.

1. Write the failing test in `tests/tailscale-win.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { runTailscale } = require('../lib/tailscale.js');

const enoent = () => { const e = new Error('spawnSync tailscale ENOENT'); e.code = 'ENOENT'; return { error: e }; };

test('on win32 a missing tailscale on PATH falls back to Program Files', () => {
    const bins = [];
    const spawn = (bin) => { bins.push(bin); return bins.length === 1 ? enoent() : { status: 0, stdout: '{}', stderr: '' }; };
    const r = runTailscale(['status', '--json'], { spawn, platform: 'win32', env: { ProgramFiles: 'D:\\Apps' } });
    assert.equal(r.status, 0);
    assert.deepEqual(bins, ['tailscale', path.win32.join('D:\\Apps', 'Tailscale', 'tailscale.exe')]);
});

test('elsewhere, and for any other error, there is no fallback', () => {
    const bins = [];
    const r = runTailscale(['status'], { spawn: (bin) => { bins.push(bin); return enoent(); }, platform: 'linux', env: {} });
    assert.equal(r.status, null);
    assert.match(r.stderr, /ENOENT/);
    assert.deepEqual(bins, ['tailscale']);
    const other = [];
    runTailscale(['status'], { spawn: (bin) => { other.push(bin); const e = new Error('EACCES'); e.code = 'EACCES'; return { error: e }; }, platform: 'win32', env: {} });
    assert.deepEqual(other, ['tailscale']);
});
```

2. Run `node --test tests/tailscale-win.test.js`; watch it fail.

3. In `lib/tailscale.js`, add `const path = require('node:path');` beside `spawnSync` and replace `runTailscale`:

```js
// On Windows the installer puts tailscale.exe in Program Files and a station
// started before PATH picked it up gets ENOENT: try there once before giving up.
function binariesFor(platform, env) {
    const out = ['tailscale'];
    if (platform === 'win32') out.push(path.win32.join(env.ProgramFiles || 'C:\\Program Files', 'Tailscale', 'tailscale.exe'));
    return out;
}

function runTailscale(args, deps) {
    const d = deps || {};
    const spawn = d.spawn || spawnSync;
    const bins = binariesFor(d.platform || process.platform, d.env || process.env);
    let r = null;
    for (const bin of bins) {
        r = spawn(bin, args, { encoding: 'utf8', timeout: TIMEOUT_MS, windowsHide: true });
        if (!(r.error && r.error.code === 'ENOENT')) break;
    }
    if (r.error) return { status: null, stdout: '', stderr: String(r.error.message || r.error) };
    return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}
```

and export it from `lib/tailscale.js`:

```js
module.exports = { runTailscale, selfName, proxiesOf, ensureServe, enable, disable };
```

The callers' `(run || runTailscale)(args)` stay as they are: a one-argument call takes the real defaults.

4. In `docs/01-guide/tailscale-setup.md`, rewrite the `## Windows：spawnSync tailscale ENOENT` section:

```md
## Windows：spawnSync tailscale ENOENT

Tailscale 的 Windows 安裝程式把 `tailscale.exe` 放在 `%ProgramFiles%\Tailscale\`。
監控站先照 PATH 找 `tailscale`；找不到（`ENOENT`）時，自動改用
`%ProgramFiles%\Tailscale\tailscale.exe`，不必重開監控站。

只有裝在別的位置時才需要處理：把那個資料夾加進 PATH，再重開監控站。
```

5. Run `node --test tests/tailscale-win.test.js tests/tailscale.test.js`; both pass (the second only if it exists).

6. Commit: `fix: the station finds tailscale.exe in Program Files on Windows`.

## Task 11: The guide and the layout

**Read:** the design's §3 third bullet and §5.

**Files:**
- Modify: `docs/01-guide/station.md` — a 手機接上 session part in `## 從手機看`
- Modify: `docs/02-architecture/layout.md` — the code-block tree: line 29 (the `hooks/` line, whose "Seven are not rowed below" parenthetical carries `budget.js` and `stop.js` inline), line 50 (`lib/` `station.js`), line 70 (`skills/`)
- Modify: `scripts/version.js` — comments at lines 4, 7, 11, 17: seventeen files, fifteen skills
- Test: `tests/phone-docs.test.js`

**Interfaces:**
- Consumes: none (it describes Tasks 1-9 by their names: `phone.hold`, `/fankeel-phone`, `lib/phone.js`)
- Produces: none

**Dispatch:** implementer, opus — architectural floor.

1. Write the failing test in `tests/phone-docs.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('the guide tells how to hand a session to the phone and how to talk past eight messages', () => {
    const guide = read('docs', '01-guide', 'station.md');
    for (const s of ['CLAUDE_CODE_STOP_HOOK_BLOCK_CAP', '/fankeel-phone', 'phone.hold', '交還電腦']) assert.ok(guide.includes(s), s);
});

test('the layout names the phone channel and keeps its pinned sentences', () => {
    const layout = read('docs', '02-architecture', 'layout.md');
    assert.ok(layout.includes('phone.js'));
    assert.ok(layout.includes('a SubagentHandback is refused while an agent that subagent dispatched has not stopped'));
});

test('version.js counts seventeen files', () => {
    const src = read('scripts', 'version.js');
    assert.match(src, /seventeen/);
    assert.doesNotMatch(src, /sixteen|fourteen skills/);
});
```

2. Run `node --test tests/phone-docs.test.js`; watch it fail.

3. In `docs/01-guide/station.md`, inside `## 從手機看`, add:

```md
### 手機接上 session

在手機的 session 清單點一個跑中的 session，按「接上這個 session」；或在電腦上的
session 裡打 `/fankeel-phone`。之後每回合結束，Stop hook 會等手機的下一句，最多
`phone.hold` 秒（預設 1800，`task.js profile set phone.hold 600` 可改）；逾時就把
session 交還電腦。手機上按「交還電腦」，或在電腦上直接打字，也會把 session 拿回來。

手機上每個 session 是五種狀態之一：等你答、手機接著、跑中、背景跑中、停下來。停下來
的 session 手機推不動，要先在電腦上 `/fankeel-phone`。按 Esc 中斷的回合沒有 Stop，
會一直顯示跑中，直到下一句。

輸入框旁的麥克風用瀏覽器的語音辨識（zh-TW），講的字先填進框裡，不會自己送出；瀏覽器
沒有語音辨識時不畫麥克風，用鍵盤上的語音鍵即可。

Claude Code 預設最多連續接受 8 次 Stop hook 擋下，所以手機最多連講 8 句就會停。要講
更多，在自己的 `settings.json` 的 `env` 加 `"CLAUDE_CODE_STOP_HOOK_BLOCK_CAP": "50"`；
fankeel 不會替你寫這一行。
```

4. In `docs/02-architecture/layout.md`, edit the tree inside the code block in place — it is one line per directory or file, not a table, and `budget.js` and `stop.js` are not lines of their own: they sit inline in line 29's "Seven are not rowed below: …" parenthetical. No hook is added, so the count stays "Seven". Three substring replacements:

Line 29, `budget.js`. Replace

```
budget.js (PreToolUse and PostToolUse, subagents only: a soft context threshold nudges a handoff,
```

with

```
budget.js (PreToolUse and PostToolUse: on the main thread of a registry session, each tool call is one step line in the phone's chat.jsonl, through lib/phone.js; for subagents, a soft context threshold nudges a handoff,
```

Line 29, `stop.js`. Replace

```
will wake the session is refused once; lib/stop.js decides)
```

with

```
will wake the session is refused once; lib/stop.js decides; every Stop's reply goes to the phone's chat.jsonl, and while the phone holds the session it waits up to phone.hold seconds for the phone's next message)
```

Line 50 (`│   ├── station.js     the station's model: …`): append `; mobile.js and phone.js are the phone page's data and its channel to a session` after `cached by its files' size and mtime`.

Line 70 (`├── skills/ …`): `ask, audit, explain, init, retro-all, station, upgrade` becomes `ask, audit, explain, init, phone, retro-all, station, upgrade`.

What must stay, because tests pin it: `tests/away-docs.test.js:21-23` matches `Seven are not rowed below`, `relay-cap.js (PreToolUse on SendMessage` and `past 3000 characters is refused once` — all three on line 29, outside both replaced spans; `tests/cjk-docs.test.js:23` matches `a SubagentHandback is refused while an agent that subagent dispatched has not stopped` — the tail of the `budget.js` parenthetical, after the replaced span, kept word for word. `tests/away-docs.test.js:24-25` pin lines 32 and 37, which this step does not touch.

5. In `scripts/version.js`, the comments at lines 4, 7, 11 and 17: "sixteen" -> "seventeen", "fourteen skills" -> "fifteen skills" (comments only; no code changes).

6. Run `node --test tests/phone-docs.test.js tests/cjk-docs.test.js tests/away-docs.test.js`; all pass.

7. Commit: `docs: the phone channel in the guide and the layout`.

## Coverage

| promise | task |
|---|---|
| The home list puts 等你答 first, then 手機接著, 跑中 and 背景跑中, then 停下來, under a one-line count of each. | Task 9 |
| A 背景跑中 row names its first one or two background items with elapsed time, and `+N` for the rest. | Task 9 |
| The conversation screen of a 背景跑中 session lists every background item and says no reply is needed. | Task 9 |
| Sending a message, attaching and 交還電腦 are the only actions besides answering a gate. | Task 9 (page), Task 8 (routes) |
| One directory per session, `<registry>/.fankeel/station/phone/<session_id>/`, already gitignored with `station/`. | Task 1 |
| `attach.json` `{at, device}` exists while the phone holds the session; removing it is 交還電腦. | Task 1, Task 8 (detach route) |
| `inbox.json` `{text, at}` is the one message waiting; the station refuses a second one while it is there (409). | Task 1, Task 8 |
| `holding.json` `{since, until}` exists only while the Stop hook is waiting, so the phone can tell 手機接著 from 跑中. | Task 1, Task 3 |
| `chat.jsonl` is the conversation, one `{role, text, at}` a line, `role` one of `desktop`, `phone`, `assistant`; kept to its last 200 lines on each append. | Task 1 |
| `lib/phone.js` owns every read and write of these files; nothing else opens them. | Task 1 |
| `hooks/stop.js` appends `last_assistant_message` to `chat.jsonl` as `assistant` on every Stop of a registry session, and writes `background_tasks` | Task 3 |
| The existing refusal (`lib/stop.js`) still runs first and still only when `stop_hook_active` is false; | Task 3 |
| With `attach.json` present, the hook writes `holding.json` and polls `inbox.json` every 200 ms, the way `stationAnswers` in `hooks/gate.js` does, for up to `phone.hold` seconds | Task 3 (the key: Task 2) |
| A message arrives: the hook removes it, appends it as `phone`, removes `holding.json`, and prints `{decision:'block', reason:'（手機）<text>'}`. | Task 3 |
| `attach.json` disappears, or `phone.hold` runs out: the hook removes `holding.json` and prints nothing, | Task 3 |
| The phone path runs whether or not `stop_hook_active` is true — every phone message is a block. | Task 3 |
| `.claude-plugin/plugin.json` raises the Stop hook's timeout from 5 to 1805. | Task 3 |
| `hooks/inject.js` appends each prompt typed at the desktop to `chat.jsonl` as `desktop`, and removes `attach.json`: | Task 4 |
| A new user-invoked skill, `/fankeel-phone`, runs `node <plugin>/scripts/phone.js attach --session <id>` and answers one line, | Task 6 |
| The guide tells the user to set `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` in their own `settings.json` `env` to talk past 8 messages in a row; | Task 11 |
| `hooks/budget.js`, which already runs on PreToolUse and PostToolUse for every tool, appends one `chat.jsonl` line per tool call of a registry session: | Task 5 |
| `label` is at most 80 characters: Bash and PowerShell their `description`, else the command's head; | Task 1 (`stepOf`), Task 5 |
| AskUserQuestion writes no step: it is the gate card. | Task 5 |
| Intermediate assistant text is not recorded; the turn's reply is the Stop's `last_assistant_message`. | Task 3 |
| The phone groups a turn's steps into one line — counts of steps, files changed, agents, failures — | Task 9 |
| `GET /station/phone.json?id=<session>` answers `{state, chat, gate, background}` — `state` one of the five in the table above | Task 8 |
| `mobile.json` rows carry the same `state` and `background`, so the home list needs no second request. | Task 8 |
| `POST /phone/attach`, `/phone/detach` and `/phone/say` (`id`, and `text` for say), under the same device policy as `/answer`: | Task 8 |
| `/phone/say` answers 409 when the session is not attached or a message is already waiting, and 201 otherwise. | Task 1, Task 8 |
| `running` versus the stopped states comes from the same liveness the station already reads, plus whether the last `chat.jsonl` line is `assistant`; | Task 1 (`stateOf`), Task 8 |
| `assets/station/mobile.js` and `mobile.css` are redrawn to the mockup's approved direction: one session list as home, and a conversation screen per session (`#/s/<id>`). | Task 9 |
| The conversation screen polls `phone.json` every 2 s while visible; the home list keeps `mobile.json` at 5 s. | Task 9 |
| A pending gate shows inside the conversation as a card posting to the existing `/answer`, replacing the separate bottom sheet. | Task 9 |
| Direction A「訊息 app」of the mockup, chosen at the design gate. | Task 9 |
| The composer and a gate's free-text answer each carry a mic button using the Web Speech API | Task 9 |
| Tapping the mic in a gate card selects its free-text option. | Task 9 |
| Where the browser has no Speech API the mic button is not drawn, and the keyboard's own voice key is the way in. | Task 9 (guide line: Task 11) |
| This takes in the TODO 手機頁自己寫答案欄加麥克風鈕, which `land` closes. | Task 9 delivers the mic; land closes the TODO |
| `lib/tailscale.js` falls back to `%ProgramFiles%\Tailscale\tailscale.exe` when spawning `tailscale` fails with `ENOENT` on win32. | Task 10 |
| `tests/phone-stop.test.js`: with `attach.json` present and a message written to `inbox.json`, `hooks/stop.js` prints a block whose reason carries the text | Task 3 |
| `tests/phone-state.test.js`: a session whose last Stop carried one running `background_tasks` item reads `background`, | Task 1 |
| `tests/station-phone.test.js`: `POST /phone/say` from a paired device writes `inbox.json` and answers 201; unpaired answers 401. | Task 8 |
| Live: from the S24 in Samsung Internet over Tailscale, attach a running session, send two messages, see both replies, | struck — verify stage's live check, done by a person with the phone |
