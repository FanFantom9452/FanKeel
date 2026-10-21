---
status: current
last_verified: 2026-10-21
source_of_truth: scripts/station.js, lib/remote.js, lib/tailscale.js, lib/qr.js, lib/mobile.js, lib/notify.js, lib/profile.js, hooks/gate.js, hooks/leave.js, scripts/task.js, assets/station/mobile.js, assets/station/remote-card.js
---

# Station Remote Implementation Plan

**Goal:** the station reached from the user's phone through their own Tailscale — off by default, loopback-only when off — with a phone page that reads every task, answers a held gate, installs as a PWA, and ntfy notifications for a waiting gate, a finished stage and an ended task.
**Architecture:** four pure modules come first and touch nothing else: `lib/remote.js` (who is asking, the tailnet route policy, pairing codes and device tokens), `lib/tailscale.js` (the machine's tailnet name and `tailscale serve --bg` made once, never Funnel), `lib/qr.js` (a byte-mode level-L QR encoder for versions 1-5) and `lib/notify.js` with its detached child `scripts/notify.js`, beside the six profile keys in `lib/profile.js` (Tasks 1-5). `scripts/station.js` then puts the Host check, the tailnet policy, the pairing and card routes and `tailscale serve` at listen in front of every existing route (Task 6). The phone page is `lib/mobile.js` (its data and shell) and `assets/station/mobile.js`/`mobile.css`/`sw.js` (Tasks 7-8), the desktop's 手機遠端 card is `assets/station/remote-card.js` (Task 9), both served and mounted by Tasks 10-11; the three triggers are one call each in `hooks/gate.js`, `scripts/task.js` and `hooks/leave.js` (Tasks 12-14); a live check on the phone closes (Task 15).
**Tech Stack:** Node >= 22.5 (`package.json` engines), CommonJS, `node:http`, `node:crypto`, `node:child_process`, global `fetch`; `node --test`; no dependencies; Tailscale's own CLI on the user's machine, ntfy's JSON publish API.
**Spec:** [2026-10-21-station-remote-design.md](2026-10-21-station-remote-design.md)

## Global Constraints

- Node >= 22.5 (`package.json` engines) and no dependencies: `package.json` has none, and none is added — the QR encoder, the cookie and the ntfy publish are written here.
- `lib/*.js` are pure functions tested directly; nothing in `lib/` requires `scripts/` or `hooks/` (CONTRIBUTING.md:15). `lib/notify.js` starts `scripts/notify.js` by path, as `lib/serve.js:142` starts `scripts/station.js`, and does not require it.
- `scripts/*.js` are thin wrappers over `lib/`; every route `scripts/station.js` answers by name (`url.pathname === '/…'`) appears on `docs/90-agent/reference/station.md`, or `tests/station-doc.test.js:30` fails.
- Every `hooks/*.js` exits `0` on every path, its own errors included, and a notification never changes a hook's stdout (CONTRIBUTING.md:17).
- `node --test`; every exported name needs an importer (`tests/source.test.js:117`), and a new file is `git add`ed before `tests/source.test.js` can see it (CONTRIBUTING.md:19).
- An implementer runs only its own test file; the parent runs `node scripts/suite.js --fast` before committing a group.
- A `KEYS` change in `lib/profile.js` is followed by `node scripts/profile-table.js`, or `tests/profile-table.test.js:13` fails; a key with `values: []` stays off `WIZARD_KEYS` (`tests/profile.test.js:450`); every key's `desc` is one line (`tests/profile.test.js:292`).
- A station module's file name goes into `MODULES` (`lib/station.js:1085`), which feeds `EMITTED` (`lib/station.js:1086`, compared to what `write()` leaves in `tests/station.test.js:598`); a file `station.js serve` writes is never hand-edited (CONTRIBUTING.md:21).
- Station modules end in `module.exports = api` when `module` exists and `window.FK_*` when `window` does (`assets/station/spend-panel.js`), and carry their own strings; no `loc()` key is added to `assets/station/station.js`, so `tests/station-i18n.test.js` is untouched.
- `assets/station/station.js` is 6849 lines, `assets/station/station.css` 2568, `scripts/task.js` 1828 and `docs/90-agent/reference/station.md` 1518 (f51da72e): every `Modify:` of them names a range, and a task's `Modify:` files read at most 1500 lines (`READ_CAP`, `lib/plantasks.js:353`).
- Version numbers move only through `scripts/version.js` (CONTRIBUTING.md:24) — not in any task here; land does it.
- Commit subjects are `feat:` / `fix:` / `test:` / `docs:`, lowercase; the body ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 4-space indent in every new `lib/`, `scripts/`, `hooks/` and `assets/` file.
- A test that calls `serve()` passes `port: 0` and its own `configDir`, and passes `opts.tailscaleRun` whenever `station.remote` could be on: no test runs the real `tailscale`.
- Notifications are off under `node --test` (`NODE_TEST_CONTEXT` set) unless `FANKEEL_NOTIFY_TEST=1`; a test that turns them on points `CLAUDE_CONFIG_DIR` and the profile at scratch directories and `notify.server` at a stub on `127.0.0.1`.
- Scratch directories come from `tests/tmp.js`.
- `hooks/pane.ts:334` accepts only `http://127.0.0.1:<port>` as the station url: `serve.json`'s `url` stays the loopback address in every state.

## Risks

- What `tailscale serve` forwards on Windows (the Host it sends, and which of X-Forwarded-For, X-Forwarded-Host and Tailscale-User-Login it adds) is unverified — Task 2 — its step 1 probes it with an echo server before anything is written, and stops the plan if Host is rewritten to loopback with no forwarding header added (the fallback, a dedicated tailnet listener, is a design change).
- The JSON shape of `tailscale serve status --json` (`Web[hostPort].Handlers[mount].Proxy`, `AllowFunnel`) is assumed — Task 2 — step 1 records the real one and the test's `STATUS` fixture is replaced by it if it differs.
- `spawnSync('tailscale', …)` blocks the event loop up to 5 s a call (three calls, at most 15 s) at listen and on a `station.remote` write — Task 6 — `serve.json` is written before Tailscale is asked, so `/fankeel` finds the station meanwhile; the test's fake `run` returns at once.
- The `NODE_TEST_CONTEXT` guard does not cover a test file run as plain `node tests/x.js` — Tasks 5, 12-14 — Task 5 asserts the variable is set under `node --test`, and Tasks 12-14 point every profile and config directory at scratch.
- An SVG-only manifest icon (`sizes: any`) and BarcodeDetector are unverified on the S24 — Tasks 7, 8 — the page falls back to 輸入配對碼 without BarcodeDetector; Task 15 records both.
- The phone answers only gates `hooks/gate.js` holds for the station, which needs `gate.station` above 0 — Task 6 — the reference section says so, and Task 15 sets `gate.station 300` first.
- The fixed-port retry (`scripts/station.js` `tryFixed`) rebinds 28888 later while `tailscale serve` keeps proxying the first, ephemeral port, which stays open — Task 6 — `refreshRemote` reads `boundPort`, set once at the first listen.
- Line numbers are as of f51da72e — Tasks 6, 9, 10, 11, 13 re-read their target lines before editing; Task 6 inserts its section before `## When a tuned block is done` (station.md:1409) and Task 10 edits the served-files paragraph (station.md:1336-1342) above it.
- A neighbouring live session is editing `scripts/task.js` while this plan is written — Task 13 — its range is the seven lines around `cmdStage`'s `showBadge` call (task.js:980-986), its require is inline so the top of the file is not touched, and the implementer re-reads the lines and rebases on whatever landed before editing.
- A QR that a reader written by the same hand accepts can still fail a camera — Task 3 — the test decodes with its own function map, mask table and Reed-Solomon syndromes; Task 15 scans the real one.
- The mockup's class names (`.row`, `.body`, `.empty`, `.tb`) are partly also station.css's, and station.css sets `body{min-width:1000px}` — Task 8 — the mockup was drawn with station.css linked, so `mobile.css` copies the mockup's rules and adds only `body.m{min-width:0}` and the real-page overrides.

## Task 1: lib/remote.js — host kind, the tailnet route policy, pairing codes, device tokens, the cookie

**Files:**
- Modify: `lib/remote.js` — new: `hostKind`, `sameOrigin`, `policy`, the store `<configDir>/fankeel/remote.json`, `newCode`, `liveCode`, `pair`, `deviceFor`, `revoke`, `devicesOf`, `tokenOf`, `cookieFor`
- Read: `lib/registry.js` — `writeAtomic(file, contents)`
- Read: `lib/json.js` — `readObject(file)` (null for a missing or unparsable file)
- Read: `tests/tmp.js` — scratch directories
- Test: `tests/remote.test.js`

**Interfaces:**
- Consumes: none
- Produces: `remote.hostKind` (headers, dnsName|null) → 'loopback' | 'tailnet' | null; `remote.sameOrigin` (headers, dnsName) → boolean; `remote.policy` (method, pathname) → 'open' | 'local' | 'device'; `remote.newCode` (configDir, now) → {value, until}; `remote.liveCode` (configDir, now) → {value, until}; `remote.pair` (configDir, code, name, now) → {ok:true, token, device:{id, name}} | {ok:false, reason}; `remote.deviceFor` (configDir, token, now) → {id, name, paired, seen} | null; `remote.revoke` (configDir, id) → boolean; `remote.devicesOf` (configDir) → [{id, name, paired, seen}]; `remote.tokenOf` (cookieHeader) → string | null; `remote.cookieFor` (token) → the Set-Cookie value

**Dispatch:** implementer, opus, high

1. Write the failing test. Create `tests/remote.test.js`:

In `tests/remote.test.js`, the whole file:

```js
'use strict';
// lib/remote.js (docs/90-agent/plans/2026-10-21-station-remote-design.md §1,
// §3): which requests are this machine's, which came through the tailnet, what
// the tailnet may reach without a paired phone, and the one-time code that
// becomes a device cookie. The store keeps a token's SHA-256 and never the token.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const remote = require('../lib/remote.js');
const tmp = require('./tmp.js');

const NAME = 'ymlab-pc.tail1234.ts.net';
const NOW = Date.parse('2026-10-21T09:00:00.000Z');
const store = (cfg) => path.join(cfg, 'fankeel', 'remote.json');

test('hostKind: loopback only without a proxy header, the tailnet only when a name is given', () => {
    assert.equal(remote.hostKind({ host: '127.0.0.1:28888' }, null), 'loopback');
    assert.equal(remote.hostKind({ host: 'localhost:28888' }, null), 'loopback');
    assert.equal(remote.hostKind({ host: '[::1]:28888' }, NAME), 'loopback');
    assert.equal(remote.hostKind({ host: NAME }, null), null, 'off: the tailnet name is refused');
    assert.equal(remote.hostKind({ host: '127.0.0.1:28888', 'x-forwarded-for': '100.64.0.2' }, null), null, 'a proxied loopback request is not this machine\'s');
    assert.equal(remote.hostKind({ host: 'evil.example' }, NAME), null);
    assert.equal(remote.hostKind({}, null), null);
    assert.equal(remote.hostKind({ host: NAME }, NAME), 'tailnet');
    assert.equal(remote.hostKind({ host: NAME.toUpperCase() + ':443' }, NAME + '.'), 'tailnet', 'case, :443 and the trailing dot do not matter');
    assert.equal(remote.hostKind({ host: NAME + ':8443' }, NAME), null, 'another port is another address');
    assert.equal(remote.hostKind({ host: '127.0.0.1:28888', 'x-forwarded-host': NAME }, NAME), 'tailnet');
    assert.equal(remote.hostKind({ host: '127.0.0.1:28888', 'tailscale-user-login': 'me@example.com' }, NAME), 'tailnet', 'rewritten to loopback by tailscale serve');
});

test('sameOrigin is https and the tailnet name, nothing else', () => {
    assert.equal(remote.sameOrigin({ origin: 'https://' + NAME }, NAME), true);
    assert.equal(remote.sameOrigin({ origin: 'https://' + NAME }, NAME + '.'), true);
    assert.equal(remote.sameOrigin({ origin: 'http://' + NAME }, NAME), false);
    assert.equal(remote.sameOrigin({ origin: 'https://evil.example' }, NAME), false);
    assert.equal(remote.sameOrigin({}, NAME), false);
    assert.equal(remote.sameOrigin({ origin: 'https://' + NAME }, null), false);
});

test('policy: the phone page, its assets and pairing are open; the card, health and Chartroom are local; the rest needs a device', () => {
    for (const p of ['/', '/m', '/m/manifest.webmanifest', '/m/icon.svg', '/sw.js', '/station/station.css', '/station/mobile.js', '/station/mobile.css']) {
        assert.equal(remote.policy('GET', p), 'open', p);
    }
    assert.equal(remote.policy('POST', '/station/remote/pair'), 'open');
    for (const p of ['/station/remote', '/station/remote/qr.svg', '/station/remote/code', '/station/remote/revoke', '/station/health', '/chartroom/fankeel/']) {
        assert.equal(remote.policy('GET', p), 'local', p);
    }
    assert.equal(remote.policy('POST', '/station/remote/code'), 'local');
    assert.equal(remote.policy('POST', '/station/remote/revoke'), 'local');
    for (const p of ['/station/station-data.js', '/station/mobile.json', '/station/talk/abc', '/station/i18n.js', '/station/detail/a.js', '/f/a/plan']) {
        assert.equal(remote.policy('GET', p), 'device', p);
    }
    for (const p of ['/answer', '/clear', '/clear-stale', '/todo', '/profile', '/']) assert.equal(remote.policy('POST', p), 'device', p);
});

test('a code is 8 characters, live for 10 minutes and kept while live; a new one replaces it', () => {
    const cfg = tmp('fankeel-remote-');
    const code = remote.liveCode(cfg, NOW);
    assert.match(code.value, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    assert.equal(code.until, NOW + 600e3);
    assert.deepEqual(remote.liveCode(cfg, NOW + 599e3), code, 'a live code is kept');
    assert.equal(remote.liveCode(cfg, NOW + 600e3).until, NOW + 1200e3, 'an expired one is replaced');
    const fresh = remote.newCode(cfg, NOW + 700e3);
    assert.deepEqual(remote.liveCode(cfg, NOW + 700e3), fresh);
});

test('pair trades a live code once for a token; the store holds its SHA-256 and never the token', () => {
    const cfg = tmp('fankeel-remote-');
    const c = remote.newCode(cfg, NOW);
    const got = remote.pair(cfg, ' ' + c.value.toLowerCase() + ' ', 'Galaxy S24 <script>', NOW + 1000);
    assert.equal(got.ok, true);
    assert.match(got.token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(got.device.name, 'Galaxy S24 script');
    assert.match(got.device.id, /^[0-9a-f]{16}$/);
    const text = fs.readFileSync(store(cfg), 'utf8');
    assert.ok(!text.includes(got.token), 'the token reached remote.json');
    assert.ok(text.includes(crypto.createHash('sha256').update(got.token).digest('hex')));
    assert.deepEqual(remote.pair(cfg, c.value, 'again', NOW + 2000), { ok: false, reason: 'no live pairing code — mint one on the station\'s 手機遠端 card' }, 'one-time');
    const late = remote.newCode(cfg, NOW);
    assert.equal(remote.pair(cfg, late.value, 'late', NOW + 600e3).ok, false, 'past ten minutes');
    assert.equal(remote.pair(cfg, remote.newCode(cfg, NOW).value, '', NOW).device.name, 'phone', 'an empty name');
    assert.equal(remote.pair(cfg, remote.newCode(cfg, NOW).value, 'x'.repeat(60), NOW).device.name.length, 40);
});

test('five wrong tries drop the code, the right one included', () => {
    const cfg = tmp('fankeel-remote-');
    const c = remote.newCode(cfg, NOW);
    for (let i = 0; i < 4; i++) assert.equal(remote.pair(cfg, 'WRNG2345', 'x', NOW).reason, 'wrong pairing code');
    assert.match(remote.pair(cfg, 'WRNG2345', 'x', NOW).reason, /five wrong codes/);
    assert.equal(remote.pair(cfg, c.value, 'x', NOW).ok, false);
});

test('deviceFor finds a paired token, marks it seen at most once a minute, and revoke ends it', () => {
    const cfg = tmp('fankeel-remote-');
    const { token, device } = remote.pair(cfg, remote.newCode(cfg, NOW).value, 'S24', NOW);
    assert.equal(remote.deviceFor(cfg, token, NOW + 30e3).seen, NOW);
    assert.equal(remote.deviceFor(cfg, token, NOW + 61e3).seen, NOW + 61e3);
    assert.equal(remote.deviceFor(cfg, token + 'x', NOW), null);
    assert.equal(remote.deviceFor(cfg, null, NOW), null);
    assert.equal(remote.deviceFor(cfg, '', NOW), null);
    assert.deepEqual(remote.devicesOf(cfg), [{ id: device.id, name: 'S24', paired: NOW, seen: NOW + 61e3 }]);
    assert.equal(remote.revoke(cfg, device.id), true);
    assert.equal(remote.revoke(cfg, device.id), false);
    assert.equal(remote.deviceFor(cfg, token, NOW), null);
    assert.deepEqual(remote.devicesOf(cfg), []);
});

test('the cookie lives a year, HttpOnly, Secure, SameSite=Strict, and is read back from a Cookie header', () => {
    const t = 'abc_DEF-0123456789abcdefghij';
    assert.equal(remote.cookieFor(t), 'fk_device=' + t + '; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict');
    assert.equal(remote.tokenOf('x=1; fk_device=' + t + '; y=2'), t);
    assert.equal(remote.tokenOf('fk_device=' + t), t);
    assert.equal(remote.tokenOf('x=1'), null);
    assert.equal(remote.tokenOf(undefined), null);
});

test('a store that does not parse reads as nothing paired', () => {
    const cfg = tmp('fankeel-remote-');
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(store(cfg), 'not json');
    assert.deepEqual(remote.devicesOf(cfg), []);
    assert.equal(remote.deviceFor(cfg, 'abc_DEF-0123456789abcdefghij', NOW), null);
});
```

2. Run it and watch it fail (`Cannot find module '../lib/remote.js'`):

```
node --test tests/remote.test.js
```

3. Write the implementation. Create `lib/remote.js`:

In `lib/remote.js`, the whole file:

```js
'use strict';
// The station reached from a phone (docs/90-agent/plans/2026-10-21-station-remote-design.md
// §1, §3): who a request comes from, what the tailnet may reach, and the
// pairing that turns a one-time code into a device cookie. Pure but for one
// store, `<configDir>/fankeel/remote.json`, which holds each device token's
// SHA-256 and never a token, and lives in the config directory — never in a
// repository.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readObject } = require('./json.js');
const { writeAtomic } = require('./registry.js');

const LOOPBACK = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/;
// What `tailscale serve`, or any proxy, adds. A loopback Host carrying one of
// these came through a proxy, not from this machine's own browser.
const PROXY = ['x-forwarded-for', 'x-forwarded-host', 'forwarded', 'tailscale-user-login'];
// No 0/O, 1/I/L: a code read off a screen and typed on a phone.
const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LEN = 8;
const CODE_MS = 10 * 60e3;
const MISSES = 5;
const SEEN_MS = 60e3;
const NAME_MAX = 40;
const COOKIE = 'fk_device';
// Through the tailnet without a cookie: the phone page, its assets, pairing.
const OPEN_GET = new Set(['/', '/m', '/m/manifest.webmanifest', '/m/icon.svg', '/sw.js', '/station/station.css', '/station/mobile.js', '/station/mobile.css']);
// Never through the tailnet: the 手機遠端 card's own routes, the health probe.
const LOCAL = new Set(['/station/remote', '/station/remote/qr.svg', '/station/remote/code', '/station/remote/revoke', '/station/health']);

// A Host as compared: the first of a list, lower-cased, without :443 or a trailing dot.
const nameOf = (h) => String(h || '').split(',')[0].trim().toLowerCase().replace(/:443$/, '').replace(/\.$/, '');

// 'loopback' is today's station; 'tailnet' is a request `tailscale serve`
// passed on — its Host (or X-Forwarded-Host) is this machine's tailnet name,
// or it was rewritten to loopback with a proxy header on it; null is anything
// else, and with `dnsName` null (remote off) that is every Host but loopback's.
function hostKind(headers, dnsName) {
    const h = headers || {};
    const host = String(h.host || '').trim().toLowerCase();
    const proxied = PROXY.some((k) => h[k] !== undefined);
    if (LOOPBACK.test(host) && !proxied) return 'loopback';
    const name = nameOf(dnsName);
    if (!name) return null;
    if (nameOf(host) === name || nameOf(h['x-forwarded-host']) === name) return 'tailnet';
    if (proxied && LOOPBACK.test(host)) return 'tailnet';
    return null;
}

// A POST through the tailnet carries the phone page's own Origin.
function sameOrigin(headers, dnsName) {
    const name = nameOf(dnsName);
    return Boolean(name) && String((headers || {}).origin || '').trim().toLowerCase() === 'https://' + name;
}

function policy(method, pathname) {
    if (method === 'POST' && pathname === '/station/remote/pair') return 'open';
    if (LOCAL.has(pathname) || pathname.startsWith('/chartroom/')) return 'local';
    if (method === 'GET' && OPEN_GET.has(pathname)) return 'open';
    return 'device';
}

const storePath = (configDir) => path.join(String(configDir || ''), 'fankeel', 'remote.json');

function load(configDir) {
    const d = readObject(storePath(configDir)) || {};
    const code = d.code && typeof d.code.value === 'string' && Number.isFinite(d.code.until) ? d.code : null;
    const devices = Array.isArray(d.devices)
        ? d.devices.filter((x) => x && typeof x.id === 'string' && typeof x.hash === 'string' && /^[0-9a-f]{64}$/.test(x.hash))
        : [];
    return { code, devices };
}

function save(configDir, data) {
    const file = storePath(configDir);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    writeAtomic(file, JSON.stringify(data, null, 2) + '\n');
}

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

function newCode(configDir, now) {
    let value = '';
    for (let i = 0; i < CODE_LEN; i++) value += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    const d = load(configDir);
    d.code = { value, until: now + CODE_MS, misses: 0 };
    save(configDir, d);
    return { value, until: d.code.until };
}

// The code the card shows: the live one, or a new one when none is.
function liveCode(configDir, now) {
    const c = load(configDir).code;
    return c && c.until > now ? { value: c.value, until: c.until } : newCode(configDir, now);
}

function cleanName(name) {
    const s = String(name || '').replace(/[\u0000-\u001f\u007f<>"'&`]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
    return s || 'phone';
}

// The code is compared as SHA-256 digests through timingSafeEqual, so a wrong
// guess takes as long as a right one. Five wrong guesses drop the code.
function pair(configDir, code, name, now) {
    const d = load(configDir);
    const c = d.code;
    if (!c || !(c.until > now)) return { ok: false, reason: 'no live pairing code — mint one on the station\'s 手機遠端 card' };
    if (!crypto.timingSafeEqual(sha(String(code || '').trim().toUpperCase()), sha(c.value))) {
        c.misses = (Number(c.misses) || 0) + 1;
        const dropped = c.misses >= MISSES;
        if (dropped) d.code = null;
        save(configDir, d);
        return { ok: false, reason: dropped ? 'five wrong codes: this code is dropped — mint a new one' : 'wrong pairing code' };
    }
    const token = crypto.randomBytes(32).toString('base64url');
    const device = { id: crypto.randomBytes(8).toString('hex'), hash: sha(token).toString('hex'), name: cleanName(name), paired: now, seen: now };
    d.devices.push(device);
    d.code = null;
    save(configDir, d);
    return { ok: true, token, device: { id: device.id, name: device.name } };
}

function deviceFor(configDir, token, now) {
    if (typeof token !== 'string' || !token) return null;
    const want = sha(token);
    const d = load(configDir);
    const hit = d.devices.find((x) => crypto.timingSafeEqual(Buffer.from(x.hash, 'hex'), want));
    if (!hit) return null;
    if (!(now - hit.seen < SEEN_MS)) {
        hit.seen = now;
        save(configDir, d);
    }
    return { id: hit.id, name: hit.name, paired: hit.paired, seen: hit.seen };
}

function revoke(configDir, id) {
    const d = load(configDir);
    const left = d.devices.filter((x) => x.id !== id);
    if (left.length === d.devices.length) return false;
    d.devices = left;
    save(configDir, d);
    return true;
}

function devicesOf(configDir) {
    return load(configDir).devices.map((x) => ({ id: x.id, name: x.name, paired: x.paired, seen: x.seen }));
}

function tokenOf(cookieHeader) {
    const m = new RegExp('(?:^|;\\s*)' + COOKIE + '=([A-Za-z0-9_-]{20,})').exec(String(cookieHeader || ''));
    return m ? m[1] : null;
}

function cookieFor(token) {
    return COOKIE + '=' + token + '; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict';
}

module.exports = { hostKind, sameOrigin, policy, newCode, liveCode, pair, deviceFor, revoke, devicesOf, tokenOf, cookieFor };
```

4. Run it and watch it pass:

```
node --test tests/remote.test.js
```

5. Commit:

```
git add lib/remote.js tests/remote.test.js
git commit -m "feat: lib/remote.js — host kind, tailnet route policy, pairing codes and device cookies" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 2: lib/tailscale.js — the machine's tailnet name, `tailscale serve --bg` made once, never Funnel

**Files:**
- Modify: `lib/tailscale.js` — new: `selfName`, `proxiesOf`, `ensureServe`, `enable`, and the private `runTailscale` that production uses when no `run` is passed
- Test: `tests/tailscale.test.js`

**Interfaces:**
- Consumes: none
- Produces: `tailscale.selfName` (run) → {ok:true, dnsName} | {ok:false, warning}; `tailscale.proxiesOf` (status) → [{hostPort, mount, proxy}]; `tailscale.ensureServe` (port, run) → {ok:true, already} | {ok:false, warning}; `tailscale.enable` (port, run?) → {ok:true, dnsName, url, already} | {ok:false, warning}. A `run` is `(args: string[]) => {status: number|null, stdout: string, stderr: string}`.

**Dispatch:** implementer, opus, high

1. Probe what `tailscale serve` really forwards, before writing anything (the design's first "Not verified" item). Only when `tailscale status` prints a running tailnet; with no `tailscale` on the PATH, or not running, write "unverified: <why>" in your report and go to step 2. Start a throwaway echo server in the background, from any scratch directory:

```
node -e "require('http').createServer((q,s)=>{s.setHeader('content-type','application/json');s.end(JSON.stringify({host:q.headers.host,headers:q.headers},null,1))}).listen(28899,'127.0.0.1')"
```

then, in another shell (`<DNSName>` is `Self.DNSName` from `tailscale status --json`, without its trailing dot):

```
tailscale serve --bg --https=8443 28899
curl -s https://<DNSName>:8443/
tailscale serve status --json
tailscale serve --https=8443 off
```

and stop the echo server. Put in your report: the `host` the echo server saw, every `x-forwarded-*`, `forwarded` and `tailscale-user-*` header, and the `serve status --json` output while the proxy was on. If the Host was rewritten to `127.0.0.1:28899` **and** none of `x-forwarded-for`, `x-forwarded-host`, `forwarded`, `tailscale-user-login` came with it, stop here and report it: the remote module (Task 1) could not tell a tailnet request from this machine's, and the fallback (a listener bound to the tailnet address) is a design change. If the `serve status --json` shape differs from `STATUS` in step 2, replace `STATUS` with the real output (your DNSName replaced by `ymlab-pc.tail1234.ts.net`, the port by 28888) and adjust `proxiesOf` to read it.

2. Write the failing test. Create `tests/tailscale.test.js`:

In `tests/tailscale.test.js`, the whole file:

```js
'use strict';
// lib/tailscale.js (docs/90-agent/plans/2026-10-21-station-remote-design.md §2):
// VoiceLedger's ensure_tailscale_serve — `tailscale serve --bg <port>` only when
// no proxy to that port is there yet, never `funnel`, and every failure a warning.
// `run` is faked throughout: no test runs the real tailscale.
const test = require('node:test');
const assert = require('node:assert/strict');
const tailscale = require('../lib/tailscale.js');

const NAME = 'ymlab-pc.tail1234.ts.net';
// `tailscale serve status --json` while `tailscale serve --bg 28888` is on
// (replaced by the real output in step 1 when it differs).
const STATUS = {
    TCP: { 443: { HTTPS: true } },
    Web: { [NAME + ':443']: { Handlers: { '/': { Proxy: 'http://127.0.0.1:28888' } } } },
};
const RUNNING = { BackendState: 'Running', Self: { DNSName: NAME + '.', HostName: 'ymlab-pc' } };

// A fake tailscale CLI: answers `status --json` with `self`, `serve status
// --json` with `serve` (and, after `serve --bg <port>`, with that proxy), and
// records every call.
function fake(self, serve, opts) {
    const o = opts || {};
    const calls = [];
    let config = serve;
    const run = (args) => {
        calls.push(args.join(' '));
        if (args[0] === 'status') return self === null ? { status: null, stdout: '', stderr: 'spawnSync tailscale ENOENT' } : { status: 0, stdout: JSON.stringify(self), stderr: '' };
        if (args[0] === 'serve' && args[1] === 'status') return { status: 0, stdout: config === null ? '' : JSON.stringify(config), stderr: '' };
        if (args[0] === 'serve' && args[1] === '--bg') {
            if (o.refuse) return { status: 1, stdout: '', stderr: 'Serve is not enabled on your tailnet.\nTo enable, visit: https://login.tailscale.com/f/serve' };
            config = { TCP: { 443: { HTTPS: true } }, Web: { [NAME + ':443']: { Handlers: { '/': { Proxy: 'http://127.0.0.1:' + args[2] } } } } };
            return { status: 0, stdout: '', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: 'unexpected: ' + args.join(' ') };
    };
    return { run, calls };
}

test('selfName: the MagicDNS name without its dot, only while the tailnet is Running', () => {
    assert.deepEqual(tailscale.selfName(fake(RUNNING, {}).run), { ok: true, dnsName: NAME });
    const stopped = tailscale.selfName(fake({ BackendState: 'Stopped', Self: { DNSName: NAME + '.' } }, {}).run);
    assert.equal(stopped.ok, false);
    assert.match(stopped.warning, /Stopped/);
    const absent = tailscale.selfName(fake(null, {}).run);
    assert.equal(absent.ok, false);
    assert.match(absent.warning, /not installed or not answering/);
    const nameless = tailscale.selfName(fake({ BackendState: 'Running', Self: { DNSName: '' } }, {}).run);
    assert.match(nameless.warning, /MagicDNS/);
    const garbled = tailscale.selfName(() => ({ status: 0, stdout: 'not json', stderr: '' }));
    assert.match(garbled.warning, /did not parse/);
});

test('proxiesOf reads every handler\'s proxy, and nothing from nothing', () => {
    assert.deepEqual(tailscale.proxiesOf(STATUS), [{ hostPort: NAME + ':443', mount: '/', proxy: 'http://127.0.0.1:28888' }]);
    assert.deepEqual(tailscale.proxiesOf({}), []);
    assert.deepEqual(tailscale.proxiesOf(null), []);
    assert.deepEqual(tailscale.proxiesOf({ Web: { x: { Handlers: { '/a': { Path: '/srv' } } } } }), [], 'a file handler is not a proxy');
});

test('ensureServe runs serve --bg once when no proxy is there, and not again once it is', () => {
    const t = fake(RUNNING, {});
    assert.deepEqual(tailscale.ensureServe(28888, t.run), { ok: true, already: false });
    assert.deepEqual(tailscale.ensureServe(28888, t.run), { ok: true, already: true });
    assert.deepEqual(t.calls.filter((c) => c.startsWith('serve --bg')), ['serve --bg 28888']);
    const empty = fake(RUNNING, null);
    assert.equal(tailscale.ensureServe(28888, empty.run).ok, true, 'an empty status is no proxy yet');
});

test('a proxy already on / at :443 to something else is left alone, with a warning', () => {
    const t = fake(RUNNING, { Web: { [NAME + ':443']: { Handlers: { '/': { Proxy: 'http://127.0.0.1:3000' } } } } });
    const got = tailscale.ensureServe(28888, t.run);
    assert.equal(got.ok, false);
    assert.match(got.warning, /already proxies .*127\.0\.0\.1:3000; not replaced/);
    assert.equal(t.calls.some((c) => c.startsWith('serve --bg')), false);
});

test('Funnel on for the machine leaves remote off and says so; funnel is never run', () => {
    const t = fake(RUNNING, Object.assign({}, STATUS, { AllowFunnel: { [NAME + ':443']: true } }));
    const got = tailscale.enable(28888, t.run);
    assert.equal(got.ok, false);
    assert.match(got.warning, /Funnel/);
    assert.equal(t.calls.some((c) => /funnel/.test(c)), false);
});

test('enable: the https url when it worked, the warning when it did not', () => {
    const t = fake(RUNNING, {});
    assert.deepEqual(tailscale.enable(28888, t.run), { ok: true, dnsName: NAME, url: 'https://' + NAME + '/', already: false });
    assert.equal(t.calls.some((c) => /funnel/.test(c)), false);
    const refused = tailscale.enable(28888, fake(RUNNING, {}, { refuse: true }).run);
    assert.equal(refused.ok, false);
    assert.match(refused.warning, /serve --bg 28888 failed: Serve is not enabled on your tailnet\./);
    const off = tailscale.enable(28888, fake({ BackendState: 'NeedsLogin', Self: {} }, {}).run);
    assert.match(off.warning, /NeedsLogin/);
});
```

3. Run it and watch it fail (`Cannot find module '../lib/tailscale.js'`):

```
node --test tests/tailscale.test.js
```

4. Write the implementation. Create `lib/tailscale.js`:

In `lib/tailscale.js`, the whole file:

```js
'use strict';
// The station's tailnet address (docs/90-agent/plans/2026-10-21-station-remote-design.md
// §2), VoiceLedger's `ensure_tailscale_serve`: the machine's MagicDNS name from
// `tailscale status --json`, and `tailscale serve --bg <port>` run only when
// `tailscale serve status --json` shows no proxy to that port yet. Never
// `tailscale funnel`; with Funnel on for the machine remote stays off. Every
// failure is a warning the caller prints, never a throw. `run` is the seam the
// tests fake; without one the real CLI is run, five seconds a call at most.
const { spawnSync } = require('node:child_process');

const TIMEOUT_MS = 5000;

function runTailscale(args) {
    const r = spawnSync('tailscale', args, { encoding: 'utf8', timeout: TIMEOUT_MS, windowsHide: true });
    if (r.error) return { status: null, stdout: '', stderr: String(r.error.message || r.error) };
    return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

const firstLine = (s) => String(s || '').trim().split(/\r?\n/)[0] || 'no output';
const parsed = (text) => {
    try { return JSON.parse(text); } catch (e) { return undefined; }
};

function selfName(run) {
    const r = (run || runTailscale)(['status', '--json']);
    if (r.status !== 0) return { ok: false, warning: 'tailscale is not installed or not answering: ' + firstLine(r.stderr) };
    const s = parsed(r.stdout);
    if (!s || typeof s !== 'object') return { ok: false, warning: 'tailscale status --json did not parse' };
    if (s.BackendState !== 'Running') return { ok: false, warning: 'tailscale is ' + (s.BackendState || 'not running') + ', not Running' };
    const name = s.Self && typeof s.Self.DNSName === 'string' ? s.Self.DNSName.replace(/\.$/, '') : '';
    if (!name) return { ok: false, warning: 'this machine has no MagicDNS name: turn on MagicDNS and HTTPS certificates in the tailnet\'s admin console' };
    return { ok: true, dnsName: name };
}

// Every reverse proxy a serve config holds, as `Web[hostPort].Handlers[mount].Proxy`.
function proxiesOf(status) {
    const out = [];
    const web = status && status.Web && typeof status.Web === 'object' ? status.Web : {};
    for (const hostPort of Object.keys(web)) {
        const handlers = (web[hostPort] && web[hostPort].Handlers) || {};
        for (const mount of Object.keys(handlers)) {
            const h = handlers[mount];
            if (h && typeof h.Proxy === 'string') out.push({ hostPort, mount, proxy: h.Proxy });
        }
    }
    return out;
}

function ensureServe(port, run) {
    const go = run || runTailscale;
    const r = go(['serve', 'status', '--json']);
    if (r.status !== 0) return { ok: false, warning: 'tailscale serve status failed: ' + firstLine(r.stderr || r.stdout) };
    const status = r.stdout.trim() ? parsed(r.stdout) : {};
    if (!status || typeof status !== 'object') return { ok: false, warning: 'tailscale serve status --json did not parse' };
    const funnel = status.AllowFunnel && typeof status.AllowFunnel === 'object' && Object.values(status.AllowFunnel).some((v) => v === true);
    if (funnel) return { ok: false, warning: 'Funnel is on for this machine, which would put the station on the public internet; remote stays off until Funnel is turned off' };
    const target = 'http://127.0.0.1:' + port;
    const proxies = proxiesOf(status);
    if (proxies.some((p) => p.proxy.replace(/\/+$/, '') === target)) return { ok: true, already: true };
    const taken = proxies.find((p) => p.mount === '/' && /:443$/.test(p.hostPort));
    if (taken) return { ok: false, warning: 'tailscale serve already proxies ' + taken.hostPort + '/ to ' + taken.proxy + '; not replaced' };
    const made = go(['serve', '--bg', String(port)]);
    if (made.status !== 0) return { ok: false, warning: 'tailscale serve --bg ' + port + ' failed: ' + firstLine(made.stderr || made.stdout) };
    return { ok: true, already: false };
}

function enable(port, run) {
    const go = run || runTailscale;
    const self = selfName(go);
    if (!self.ok) return self;
    const served = ensureServe(port, go);
    if (!served.ok) return served;
    return { ok: true, dnsName: self.dnsName, url: 'https://' + self.dnsName + '/', already: served.already };
}

module.exports = { selfName, proxiesOf, ensureServe, enable };
```

5. Run it and watch it pass:

```
node --test tests/tailscale.test.js
```

6. Commit:

```
git add lib/tailscale.js tests/tailscale.test.js
git commit -m "feat: lib/tailscale.js — the tailnet name and tailscale serve made once, never funnel" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 3: lib/qr.js — a QR encoder (byte mode, level L, versions 1-5) and its SVG

**Files:**
- Modify: `lib/qr.js` — new: `qrMatrix(text)`, `qrSvg(text)`
- Test: `tests/qr.test.js`

**Interfaces:**
- Consumes: none
- Produces: `qr.qrMatrix` (text) → boolean[][] (row-major, `[y][x]`, true is dark) | null when the UTF-8 text is over 106 bytes; `qr.qrSvg` (text) → an SVG string with a 4-module quiet zone, a white rect and one black path | null

**Dispatch:** implementer, opus, high

1. Write the failing test. Create `tests/qr.test.js` — an independent reader: its own function-module map, its own mask table in the standard's row/column form, the format bits read from both copies, a zigzag read, Reed-Solomon syndromes from log/exp tables, and the byte-mode header:

In `tests/qr.test.js`, the whole file:

```js
'use strict';
// lib/qr.js (docs/90-agent/plans/2026-10-21-station-remote-design.md §3): the
// pairing url as a QR. Read back here by a decoder that shares no code with
// the encoder — a camera is Task 15's check, this is the arithmetic.
const test = require('node:test');
const assert = require('node:assert/strict');
const qr = require('../lib/qr.js');

// GF(256) over x^8 + x^4 + x^3 + x^2 + 1, as tables.
const EXP = new Array(512);
const LOG = new Array(256);
(() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
        EXP[i] = x;
        LOG[x] = i;
        x <<= 1;
        if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

// size → [version, total codewords, EC codewords] at level L; alignment centre per version.
const SIZES = { 21: [1, 26, 7], 25: [2, 44, 10], 29: [3, 70, 15], 33: [4, 100, 20], 37: [5, 134, 26] };
const CENTRE = { 2: 18, 3: 22, 4: 26, 5: 30 };
// The standard's eight masks, i the row and j the column.
const MASK = [
    (i, j) => (i + j) % 2 === 0,
    (i) => i % 2 === 0,
    (i, j) => j % 3 === 0,
    (i, j) => (i + j) % 3 === 0,
    (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
    (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
    (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
    (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
];

// Function modules: the three finder corners with their separators and format
// areas (9x9 top left, 8 wide by 9 tall top right, 9 wide by 8 tall bottom
// left), the timing row and column, and the one 5x5 alignment pattern
// versions 2-5 carry.
function reserved(size, version) {
    const r = Array.from({ length: size }, () => new Array(size).fill(false));
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            if ((i < 9 && j < 9) || (i < 9 && j >= size - 8) || (i >= size - 8 && j < 9) || i === 6 || j === 6) r[i][j] = true;
        }
    }
    const c = CENTRE[version];
    if (c) for (let i = c - 2; i <= c + 2; i++) for (let j = c - 2; j <= c + 2; j++) r[i][j] = true;
    return r;
}

// Format information, bit k of the 15 at cell [row, column], from both copies.
function formatOf(m) {
    const size = m.length;
    const first = [[0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8], [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0]];
    const second = [];
    for (let k = 0; k < 8; k++) second.push([8, size - 1 - k]);
    for (let k = 8; k < 15; k++) second.push([size - 15 + k, 8]);
    const read = (cells) => cells.reduce((v, [i, j], k) => v | ((m[i][j] ? 1 : 0) << k), 0);
    const a = read(first);
    const unmasked = a ^ 0x5412;
    const data = unmasked >>> 10;
    // BCH(15,5): the remainder of data * x^10 divided by x^10 + x^8 + x^5 + x^4 + x^2 + x + 1.
    let rem = data << 10;
    for (let bit = 14; bit >= 10; bit--) if (rem & (1 << bit)) rem ^= 0x537 << (bit - 10);
    return { level: data >>> 3, mask: data & 7, valid: (unmasked & 0x3ff) === rem, same: a === read(second), dark: m[size - 8][8] };
}

function decode(m) {
    const size = m.length;
    const [version, total, ec] = SIZES[size];
    const f = formatOf(m);
    assert.equal(f.valid, true, 'format bits fail their BCH check');
    assert.equal(f.same, true, 'the two format copies disagree');
    assert.equal(f.level, 1, 'level L');
    assert.equal(f.dark, true, 'the dark module');
    const fn = reserved(size, version);
    const bits = [];
    let upward = true;
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let v = 0; v < size; v++) {
            const i = upward ? size - 1 - v : v;
            for (const j of [right, right - 1]) {
                if (fn[i][j]) continue;
                bits.push((m[i][j] !== MASK[f.mask](i, j)) ? 1 : 0);
            }
        }
        upward = !upward;
    }
    const words = [];
    for (let k = 0; k < total; k++) words.push(bits.slice(k * 8, k * 8 + 8).reduce((a, b) => (a << 1) | b, 0));
    for (let r = 0; r < ec; r++) {
        let s = 0;
        for (const w of words) s = mul(s, EXP[r]) ^ w;
        assert.equal(s, 0, 'syndrome ' + r + ' is not zero');
    }
    const data = words.slice(0, total - ec).flatMap((w) => [7, 6, 5, 4, 3, 2, 1, 0].map((k) => (w >>> k) & 1));
    const take = (n) => data.splice(0, n).reduce((a, b) => (a << 1) | b, 0);
    assert.equal(take(4), 0b0100, 'byte mode');
    const len = take(8);
    const out = [];
    for (let k = 0; k < len; k++) out.push(take(8));
    return { version, mask: f.mask, bytes: Buffer.from(out) };
}

const URL = 'https://ymlab-pc.tail1234.ts.net/m#/pair/ABCD2345';

test('a short text is version 1, the pairing url version 3, 106 bytes version 5 — each read back whole', () => {
    const masks = new Set();
    for (const [text, version] of [['fk', 1], ['x'.repeat(17), 1], ['x'.repeat(18), 2], [URL, 3], ['y'.repeat(78), 4], ['z'.repeat(106), 5], ['配對 ok', 1], ['https://a.ts.net/m#/pair/2345ABCD', 2]]) {
        const m = qr.qrMatrix(text);
        assert.equal(m.length, 17 + 4 * version, text.slice(0, 12) + ' size');
        assert.ok(m.every((row) => row.length === m.length));
        const got = decode(m);
        masks.add(got.mask);
        assert.equal(got.version, version);
        assert.deepEqual(got.bytes, Buffer.from(text, 'utf8'), text.slice(0, 12) + ' reads back');
    }
    assert.ok(masks.size > 1, 'the penalty never picked anything but one mask');
});

test('the finder patterns and timing lines are where a camera looks for them', () => {
    const m = qr.qrMatrix(URL);
    const s = m.length;
    for (const [i0, j0] of [[0, 0], [0, s - 7], [s - 7, 0]]) {
        for (let i = 0; i < 7; i++) {
            for (let j = 0; j < 7; j++) {
                const ring = Math.max(Math.abs(i - 3), Math.abs(j - 3));
                assert.equal(m[i0 + i][j0 + j], ring !== 2, 'finder at ' + i0 + ',' + j0);
            }
        }
    }
    for (let k = 8; k < s - 8; k++) {
        assert.equal(m[6][k], k % 2 === 0, 'timing row');
        assert.equal(m[k][6], k % 2 === 0, 'timing column');
    }
});

test('more than 106 bytes is no QR, and the SVG has a quiet zone of four', () => {
    assert.equal(qr.qrMatrix('z'.repeat(107)), null);
    assert.equal(qr.qrSvg('z'.repeat(107)), null);
    const m = qr.qrMatrix(URL);
    const svg = qr.qrSvg(URL);
    const n = m.length + 8;
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '"'));
    assert.ok(svg.includes('<rect width="' + n + '" height="' + n + '" fill="#fff"/>'));
    const dark = m.flat().filter(Boolean).length;
    assert.equal((svg.match(/h1v1h-1z/g) || []).length, dark);
    const cells = [...svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((x) => [Number(x[1]), Number(x[2])]);
    assert.ok(cells.every(([x, y]) => x >= 4 && y >= 4 && x < n - 4 && y < n - 4), 'nothing drawn inside the quiet zone');
});
```

2. Run it and watch it fail (`Cannot find module '../lib/qr.js'`):

```
node --test tests/qr.test.js
```

3. Write the implementation. Create `lib/qr.js`, after Project Nayuki's QR Code generator (MIT), cut to one error-correction level and five versions:

In `lib/qr.js`, the whole file:

```js
'use strict';
// A QR code for the station's pairing url (docs/90-agent/plans/2026-10-21-station-remote-design.md
// §3): byte mode, error-correction level L, versions 1-5 — one Reed-Solomon
// block each at L, so nothing is interleaved — after Project Nayuki's QR Code
// generator (MIT), cut to what a url of at most 106 bytes needs. The matrix is
// `[y][x]`, true for a dark module.

// [total codewords, EC codewords] per version at level L; each version's
// alignment centre (version 1 has none; at 2-5 only the one at (c, c) is clear
// of the finders).
const BLOCKS = [null, [26, 7], [44, 10], [70, 15], [100, 20], [134, 26]];
const ALIGN = [null, 0, 18, 22, 26, 30];
const LEVEL_L = 1;

function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d);
        z ^= ((y >>> i) & 1) * x;
    }
    return z;
}

// The generator polynomial's coefficients, highest first, the leading 1 left
// off: the product of (x - 2^i) for i below `degree`.
function divisor(degree) {
    const out = new Array(degree).fill(0);
    out[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < degree; j++) {
            out[j] = gfMul(out[j], root);
            if (j + 1 < degree) out[j] ^= out[j + 1];
        }
        root = gfMul(root, 0x02);
    }
    return out;
}

function remainder(data, div) {
    const out = div.map(() => 0);
    for (const b of data) {
        const factor = b ^ out.shift();
        out.push(0);
        div.forEach((coef, i) => { out[i] ^= gfMul(coef, factor); });
    }
    return out;
}

// Mode 0100, an 8-bit length, the bytes, a terminator, the 0xEC/0x11 pad,
// then the EC codewords.
function codewords(bytes, version) {
    const [total, ec] = BLOCKS[version];
    const cap = (total - ec) * 8;
    const bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(0b0100, 4);
    put(bytes.length, 8);
    for (const b of bytes) put(b, 8);
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
    return data.concat(remainder(data, divisor(ec)));
}

const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

// Both copies of the 15 format bits — level L and the mask, BCH-coded and
// xored with 0x5412 — and the dark module. `set(x, y, on)`.
function format(set, size, mask) {
    const data = (LEVEL_L << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
}

// The codewords' bits in the standard's zigzag, two columns at a time from
// the right, skipping the timing column; the remainder bits stay light.
function place(dark, fixed, size, data) {
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < size; vert++) {
            for (let j = 0; j < 2; j++) {
                const x = right - j;
                const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
                if (!fixed[y][x] && i < data.length * 8) {
                    dark[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
                    i++;
                }
            }
        }
    }
}

function applyMask(dark, fixed, size, m) {
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) if (!fixed[y][x] && MASKS[m](x, y)) dark[y][x] = !dark[y][x];
    }
}

// The standard's four penalties: runs of five or more, 2x2 blocks, finder-like
// 1:1:3:1:1 runs with four light modules beside them, and the dark share.
function penalty(dark, size) {
    let score = 0;
    const lines = [];
    for (let i = 0; i < size; i++) {
        lines.push(dark[i].map(Number).join(''));
        lines.push(dark.map((row) => Number(row[i])).join(''));
    }
    for (const line of lines) {
        for (const run of line.match(/0{5,}|1{5,}/g) || []) score += run.length - 2;
        const padded = '0000' + line + '0000';
        for (const pat of ['10111010000', '00001011101']) {
            for (let at = padded.indexOf(pat); at >= 0; at = padded.indexOf(pat, at + 1)) score += 40;
        }
    }
    let blacks = 0;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (dark[y][x]) blacks++;
            if (x < size - 1 && y < size - 1 && dark[y][x] === dark[y][x + 1] && dark[y][x] === dark[y + 1][x] && dark[y][x] === dark[y + 1][x + 1]) score += 3;
        }
    }
    const total = size * size;
    score += (Math.ceil(Math.abs(blacks * 20 - total * 10) / total) - 1) * 10;
    return score;
}

function qrMatrix(text) {
    const bytes = Buffer.from(String(text), 'utf8');
    let version = 1;
    while (version <= 5 && 12 + 8 * bytes.length > (BLOCKS[version][0] - BLOCKS[version][1]) * 8) version++;
    if (version > 5) return null;
    const size = 17 + 4 * version;
    const dark = Array.from({ length: size }, () => new Array(size).fill(false));
    const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, on) => { dark[y][x] = on; fixed[y][x] = true; };
    for (let i = 0; i < size; i++) {
        set(6, i, i % 2 === 0);
        set(i, 6, i % 2 === 0);
    }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
        for (let dy = -4; dy <= 4; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
                const x = cx + dx;
                const y = cy + dy;
                const d = Math.max(Math.abs(dx), Math.abs(dy));
                if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
            }
        }
    }
    const c = ALIGN[version];
    if (c) {
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) set(c + dx, c + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
    }
    format(set, size, 0);
    place(dark, fixed, size, codewords(bytes, version));
    let best = 0;
    let least = Infinity;
    for (let m = 0; m < 8; m++) {
        applyMask(dark, fixed, size, m);
        format(set, size, m);
        const p = penalty(dark, size);
        if (p < least) { least = p; best = m; }
        applyMask(dark, fixed, size, m);
    }
    applyMask(dark, fixed, size, best);
    format(set, size, best);
    return dark;
}

function qrSvg(text) {
    const m = qrMatrix(text);
    if (!m) return null;
    const n = m.length + 8;
    let d = '';
    m.forEach((row, y) => row.forEach((on, x) => { if (on) d += 'M' + (x + 4) + ' ' + (y + 4) + 'h1v1h-1z'; }));
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges">'
        + '<rect width="' + n + '" height="' + n + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
}

module.exports = { qrMatrix, qrSvg };
```

4. Run it and watch it pass:

```
node --test tests/qr.test.js
```

5. Commit:

```
git add lib/qr.js tests/qr.test.js
git commit -m "feat: lib/qr.js — a byte-mode level-L QR encoder for versions 1-5 and its svg" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 4: the six profile keys — `station.remote`, `notify.server`, `notify.topic`, `notify.gate`, `notify.stage`, `notify.end`

**Files:**
- Modify: `lib/profile.js` — six `KEYS` entries right after `'station.link'` (lib/profile.js:50), all `values: []`; `parseFlag`, `parseUrl`, `parseTopic`; wired in `parseValue` before the enum fallback
- Modify: `docs/01-guide/profile.md` — the key table, regenerated by `node scripts/profile-table.js`, never by hand
- Read: `scripts/profile-table.js` — what regenerates the table
- Read: `tests/tmp.js` — scratch directories
- Test: `tests/profile-remote.test.js`

**Interfaces:**
- Consumes: none
- Produces: `station.remote` (boolean, builtin false, read from the machine profile by Task 6); `notify.server` (url string without a trailing slash, builtin `https://ntfy.sh`); `notify.topic` (string or absent); `notify.gate`, `notify.stage`, `notify.end` (boolean, builtin false)

**Dispatch:** implementer, opus, high

1. Write the failing test. Create `tests/profile-remote.test.js`:

In `tests/profile-remote.test.js`, the whole file:

```js
'use strict';
// The six keys the station remote and its notifications read
// (docs/90-agent/plans/2026-10-21-station-remote-design.md §1, §5): two kinds
// of free value and four switches, every one off the station wizard.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

const SIX = ['station.remote', 'notify.server', 'notify.topic', 'notify.gate', 'notify.stage', 'notify.end'];
const FLAGS = ['station.remote', 'notify.gate', 'notify.stage', 'notify.end'];

test('the switches are true or false, written as words or as booleans', () => {
    for (const k of FLAGS) {
        assert.equal(profile.parseValue(k, 'true').value, true, k);
        assert.equal(profile.parseValue(k, ' FALSE ').value, false, k);
        assert.equal(profile.parseValue(k, true).value, true, k);
        assert.equal(profile.parseValue(k, false).value, false, k);
        assert.equal(profile.parseValue(k, 'yes').error, k + ' is true or false');
    }
});

test('notify.server is an http or https url of at most 200 characters, its trailing slash dropped', () => {
    assert.equal(profile.parseValue('notify.server', 'https://ntfy.example.com/').value, 'https://ntfy.example.com');
    assert.equal(profile.parseValue('notify.server', 'http://127.0.0.1:8080').value, 'http://127.0.0.1:8080');
    assert.equal(profile.parseValue('notify.server', 'https://example.com/ntfy/').value, 'https://example.com/ntfy');
    assert.ok(profile.parseValue('notify.server', 'ftp://example.com').error);
    assert.ok(profile.parseValue('notify.server', 'https://exa mple.com').error);
    assert.ok(profile.parseValue('notify.server', 'https://' + 'a'.repeat(200)).error);
    assert.ok(profile.parseValue('notify.server', '').error);
});

test('notify.topic is letters, digits, - and _, 1 to 64 of them', () => {
    assert.equal(profile.parseValue('notify.topic', 'fankeel-0123456789abcdef0123').value, 'fankeel-0123456789abcdef0123');
    assert.equal(profile.parseValue('notify.topic', 'a_B-9').value, 'a_B-9');
    assert.ok(profile.parseValue('notify.topic', 'has space').error);
    assert.ok(profile.parseValue('notify.topic', 'a/b').error);
    assert.ok(profile.parseValue('notify.topic', 'a'.repeat(65)).error);
    assert.ok(profile.parseValue('notify.topic', '').error);
});

test('builtins: remote and every trigger off, the server ntfy.sh, no topic', () => {
    const v = profile.read(null, null).values;
    for (const k of FLAGS) assert.equal(v[k], false, k);
    assert.equal(v['notify.server'], 'https://ntfy.sh');
    assert.equal(Object.prototype.hasOwnProperty.call(v, 'notify.topic'), false);
});

test('a machine profile written true reads back true, from the machine', () => {
    const cfg = tmp('fankeel-profile-remote-');
    assert.equal(profile.write(profile.machineFile(cfg), 'station.remote', 'true').ok, true);
    assert.equal(profile.write(profile.machineFile(cfg), 'notify.topic', 'fankeel-00112233445566778899').ok, true);
    const got = profile.read(null, cfg);
    assert.equal(got.values['station.remote'], true);
    assert.equal(got.sources['station.remote'], 'machine');
    assert.equal(got.values['notify.topic'], 'fankeel-00112233445566778899');
    assert.deepEqual(JSON.parse(fs.readFileSync(profile.machineFile(cfg), 'utf8')), { 'station.remote': true, 'notify.topic': 'fankeel-00112233445566778899' });
});

test('the six sit right after station.link, off the wizard, each with a one-line desc and a row in the guide', () => {
    const keys = Object.keys(profile.KEYS);
    const at = keys.indexOf('station.link');
    assert.deepEqual(keys.slice(at + 1, at + 7), SIX);
    const page = fs.readFileSync(path.join(__dirname, '..', 'docs', '01-guide', 'profile.md'), 'utf8');
    for (const k of SIX) {
        assert.equal(Object.prototype.hasOwnProperty.call(profile.WIZARD_KEYS, k), false, k + ' is on the wizard');
        assert.ok(profile.KEYS[k].desc && !profile.KEYS[k].desc.includes('\n'), k);
        assert.ok(profile.KEYS[k].free, k + ' needs the free-text line the table prints');
        assert.ok(page.includes('| `' + k + '` |'), k + ' has no row on docs/01-guide/profile.md');
    }
});
```

2. Run it and watch it fail (`station.remote` is an unknown key):

```
node --test tests/profile-remote.test.js
```

3. Add the keys. In `lib/profile.js`, right after the `'station.link': { … },` entry (lib/profile.js:50) and before the comment that opens `// Acts only past lib/context.js AWAY (200k)`, insert:

In `lib/profile.js`, after the `station.link` entry inside `KEYS`:

```js
    // docs/90-agent/plans/2026-10-21-station-remote-design.md §1: whether the
    // station puts itself on this machine's tailnet through `tailscale serve`.
    // Read from the machine profile only (scripts/station.js), so `values` is
    // empty — the 手機遠端 card is its switch — and `parseFlag` is the check.
    'station.remote': { values: [], builtin: 'false', free: '`true` 或 `false`', desc: '監控站要不要經這台機器的 Tailscale（tailscale serve）讓手機連進來；只讀機器層 profile，預設關，關著時只有 127.0.0.1 連得到' },
    // §5: ntfy. The server and the topic are free text; the topic is written
    // the first time a trigger is turned on from the card (scripts/station.js).
    'notify.server': { values: [], builtin: 'https://ntfy.sh', free: '一個 http 或 https 網址：ntfy 伺服器', desc: 'ntfy 推播送到哪個伺服器；自架的 ntfy 填它的網址' },
    'notify.topic': { values: [], builtin: null, free: '英數字、`-`、`_`，最多 64 個字', desc: 'ntfy 的 topic，手機訂閱它；從監控站第一次打開推播時自動寫一個 `fankeel-` 開頭的亂數' },
    'notify.gate': { values: [], builtin: 'false', free: '`true` 或 `false`', desc: 'gate 在等你回答時推一則高優先、會響的通知，附「打開 gate」' },
    'notify.stage': { values: [], builtin: 'false', free: '`true` 或 `false`', desc: '一個 stage 完成、進下一站時推一則靜音通知' },
    'notify.end': { values: [], builtin: 'false', free: '`true` 或 `false`', desc: '任務結束（session 結束）時推一則靜音通知，附含子代理的花費' },
```

4. Add the parsers. In `lib/profile.js`, right after `function parseQuota(key, raw) { … }` (lib/profile.js:347-352), add:

In `lib/profile.js`, after `parseQuota`:

```js
// `station.remote` and the three `notify.*` triggers: a switch, written as a
// word or read back as the boolean `write` stored.
function parseFlag(key, raw) {
    const s = String(raw).trim().toLowerCase();
    if (s === 'true') return { value: true };
    if (s === 'false') return { value: false };
    return { error: key + ' is true or false' };
}

// `notify.server`: an http or https url, its trailing slash dropped so
// lib/notify.js can add the one the publish goes to.
const URL_MAX = 200;
function parseUrl(key, raw) {
    const s = String(raw).trim().replace(/\/+$/, '');
    if (s.length <= URL_MAX && /^https?:\/\/[^\s/?#]+(?:\/[^\s?#]*)?$/i.test(s)) return { value: s };
    return { error: key + ' is an http or https url of at most ' + URL_MAX + ' characters' };
}

// `notify.topic`: what ntfy accepts as a topic name.
function parseTopic(key, raw) {
    const s = String(raw).trim();
    if (/^[A-Za-z0-9_-]{1,64}$/.test(s)) return { value: s };
    return { error: key + ' is 1 to 64 letters, digits, - or _' };
}
```

5. Wire them. In `lib/profile.js`, in `parseValue`, right after the line `if (key === 'station.chartroom') return parsePath(key, raw);` (lib/profile.js:369) and before the enum fallback that opens `const s = String(raw).trim().toLowerCase();`, add:

In `lib/profile.js`, inside `parseValue`:

```js
    if (key === 'station.remote' || key === 'notify.gate' || key === 'notify.stage' || key === 'notify.end') return parseFlag(key, raw);
    if (key === 'notify.server') return parseUrl(key, raw);
    if (key === 'notify.topic') return parseTopic(key, raw);
```

6. Regenerate the guide's table (it rewrites only the table on `docs/01-guide/profile.md`):

```
node scripts/profile-table.js
```

7. Run the new test, the table test and the profile test, and watch them pass:

```
node --test tests/profile-remote.test.js tests/profile-table.test.js tests/profile.test.js
```

8. Commit:

```
git add lib/profile.js docs/01-guide/profile.md tests/profile-remote.test.js
git commit -m "feat: station.remote and the notify.* profile keys" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 5: lib/notify.js and scripts/notify.js — one ntfy publish per trigger, sent by a detached child

**Files:**
- Modify: `lib/notify.js` — new: `newTopic`, `remoteBase`, `gateEvent`, `stageEvent`, `endEvent`, `request`, `send`, `fire`
- Modify: `scripts/notify.js` — new: the detached child — `parseRequest(arg)`, then `send(req, 8000)` and exit 0 whatever happened
- Read: `lib/serve.js` — `readServeRecord(configDir)`, and the detached spawn at lib/serve.js:125-133 that `fire` copies
- Read: `tests/tmp.js` — scratch directories
- Test: `tests/notify.test.js`

**Interfaces:**
- Consumes: none — `request` and `fire` take the profile's values as a plain object and read the six keys the profile task adds by name, as strings
- Produces: `notify.newTopic` () → string `fankeel-` + 20 hex digits; `notify.remoteBase` (configDir) → serve.json's `remote.url` (`https://<name>/`) | null; `notify.gateEvent` (mine, questions, id, root) → event; `notify.stageEvent` (mine, from, to, id, root) → event; `notify.endEvent` (mine, usd|null, id, root) → event; an event is {kind: 'gate'|'stage'|'end', id, tab: 'gate'|'task', title, message}; `notify.request` (values, event, base|null) → {url, body} | null; `notify.send` (req, ms) → Promise<boolean>, never rejects; `notify.fire` (values, event, {configDir, base, env}) → boolean, never throws — false under `NODE_TEST_CONTEXT` unless `FANKEEL_NOTIFY_TEST=1`

**Dispatch:** implementer, opus, high

1. Write the failing test. Create `tests/notify.test.js`:

In `tests/notify.test.js`, the whole file:

```js
'use strict';
// lib/notify.js and scripts/notify.js (docs/90-agent/plans/2026-10-21-station-remote-design.md
// §5): one ntfy JSON publish per trigger, built from the stage, the first
// question, the task cut to 80 characters, the project and the cost — and
// nothing else of the entry — sent by a detached child no failure escapes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const notify = require('../lib/notify.js');
const { parseRequest } = require('../scripts/notify.js');
const tmp = require('./tmp.js');

const CHILD = path.join(__dirname, '..', 'scripts', 'notify.js');
const NAME = 'ymlab-pc.tail1234.ts.net';
const BASE = 'https://' + NAME + '/';
const ID = 'eeeeeeee-7777-4777-8777-777777777777';
const TASK = 'station 遠端存取討論：參考 VoiceLedger 架構，可選 Tailscale、手機版、完成通知';
const MINE = { task: TASK, stage: 'design', project: '', clock: { survey: [1, 2], design: [3, 4] },
    claims: ['lib/secret-path.js'], notes: ['a private note'], next: 'private next step' };
const Q = [{ question: '核准這份 design？', options: [{ label: '核准，進 plan' }] }, { question: '第二題' }];
const ON = { 'notify.server': 'https://ntfy.sh', 'notify.topic': 'fankeel-00112233445566778899', 'notify.gate': true, 'notify.stage': true, 'notify.end': true };
const TESTING = Object.assign({}, process.env, { FANKEEL_NOTIFY_TEST: '1' });

// A stub ntfy: records every publish; a topic of `refuse` is answered 403.
function stub() {
    const got = [];
    const server = http.createServer((req, res) => {
        let text = '';
        req.setEncoding('utf8');
        req.on('data', (c) => { text += c; });
        req.on('end', () => {
            const body = JSON.parse(text);
            got.push({ method: req.method, url: req.url, type: req.headers['content-type'], body });
            res.statusCode = body.topic === 'refuse' ? 403 : 200;
            res.end('{}');
        });
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
        got, url: 'http://127.0.0.1:' + server.address().port,
        close: () => { server.closeAllConnections(); server.close(); },
    })));
}

async function waitFor(pred, ms) {
    const until = Date.now() + ms;
    while (!pred() && Date.now() < until) await new Promise((r) => setTimeout(r, 25));
    return pred();
}

test('notifications are off under node --test unless FANKEEL_NOTIFY_TEST=1', () => {
    assert.ok(process.env.NODE_TEST_CONTEXT, 'node --test no longer sets NODE_TEST_CONTEXT: the guard in fire() guards nothing');
    const env = Object.assign({}, process.env);
    delete env.FANKEEL_NOTIFY_TEST;
    assert.equal(notify.fire(ON, notify.gateEvent(MINE, Q, ID, '/home/me/fankeel'), { base: null, env }), false);
});

test('newTopic is fankeel- and 20 hex digits, fresh each time', () => {
    const a = notify.newTopic();
    assert.match(a, /^fankeel-[0-9a-f]{20}$/);
    assert.notEqual(notify.newTopic(), a);
});

test('a gate event: the stage, the first question and the task, each cut to 80', () => {
    assert.deepEqual(notify.gateEvent(MINE, Q, ID, 'F:\\ymlab\\fankeel'),
        { kind: 'gate', id: ID, tab: 'gate', title: 'design gate 在等你', message: '核准這份 design？ — ' + TASK });
    const long = notify.gateEvent(Object.assign({}, MINE, { task: 'x'.repeat(200) }), [{ question: 'q '.repeat(100) }], ID, '/r');
    const [q, t] = long.message.split(' — ');
    assert.equal(q.length, 80);
    assert.equal(t.length, 80);
    assert.ok(q.endsWith('…') && t.endsWith('…'));
    assert.equal(notify.gateEvent(MINE, null, ID, '/r').message, TASK, 'no question: the task alone');
});

test('a stage event and an end event name the task, the project and the cost', () => {
    assert.deepEqual(notify.stageEvent(MINE, 'audit', 'land', ID, 'F:\\ymlab\\fankeel'),
        { kind: 'stage', id: ID, tab: 'task', title: 'audit 完成，接著 land', message: TASK + ' · fankeel' });
    assert.equal(notify.stageEvent(Object.assign({}, MINE, { project: 'ils-bench' }), 'plan', 'build', ID, '/home/me/ws').message, TASK + ' · ils-bench');
    const T = 'fsc-14 錯題分類：A/B/C 理由比較（Opus 對 Qwen3.8，Opus 判官）';
    assert.ok(T.length > 40);
    const end = notify.endEvent(Object.assign({}, MINE, { task: T }), 59.784, ID, '/home/me/ils-bench');
    assert.deepEqual(end, { kind: 'end', id: ID, tab: 'task', title: '任務結束：' + T.slice(0, 39) + '…', message: 'ils-bench · 2 個 stage · $59.78' });
    assert.equal(notify.endEvent(MINE, null, ID, '/home/me/fankeel').message, 'fankeel · 2 個 stage', 'no cost when nothing was priced');
    assert.equal(notify.endEvent({ task: 't' }, 0, ID, '/r/x').message, 'x · 0 個 stage · $0.00');
});

test('request: only for a trigger turned on, with a topic and a server; the tap opens the phone page', () => {
    const gate = notify.gateEvent(MINE, Q, ID, '/home/me/fankeel');
    const req = notify.request(ON, gate, BASE);
    assert.equal(req.url, 'https://ntfy.sh/');
    assert.deepEqual(req.body, {
        topic: 'fankeel-00112233445566778899', title: 'design gate 在等你', message: gate.message, priority: 4, tags: ['fankeel'],
        click: BASE + 'm#/gate/' + ID, actions: [{ action: 'view', label: '打開 gate', url: BASE + 'm#/gate/' + ID }],
    });
    const stage = notify.request(ON, notify.stageEvent(MINE, 'audit', 'land', ID, '/r'), BASE);
    assert.equal(stage.body.priority, 2);
    assert.equal(stage.body.click, BASE + 'm#/task/' + ID);
    assert.equal(stage.body.actions, undefined, 'only a gate carries an action');
    assert.equal(notify.request(ON, notify.endEvent(MINE, 1, ID, '/r'), BASE).body.priority, 2);
    assert.deepEqual(Object.keys(notify.request(ON, gate, null).body).sort(), ['message', 'priority', 'tags', 'title', 'topic'], 'no tailnet address, no tap');
    assert.equal(notify.request(Object.assign({}, ON, { 'notify.server': 'http://127.0.0.1:8080/' }), gate, null).url, 'http://127.0.0.1:8080/');
    assert.equal(notify.request(Object.assign({}, ON, { 'notify.gate': false }), gate, BASE), null);
    assert.equal(notify.request(Object.assign({}, ON, { 'notify.gate': 'true' }), gate, BASE), null, 'a switch is the boolean lib/profile.js reads back');
    const noTopic = Object.assign({}, ON);
    delete noTopic['notify.topic'];
    assert.equal(notify.request(noTopic, gate, BASE), null);
    assert.equal(notify.request(Object.assign({}, ON, { 'notify.server': '' }), gate, BASE), null);
    assert.equal(notify.request(null, gate, BASE), null);
    assert.equal(notify.request(ON, null, BASE), null);
    assert.equal(notify.request(ON, { kind: 'nope', id: ID }, BASE), null);
});

test('what leaves for ntfy is those fields and nothing else of the entry', () => {
    const req = notify.request(ON, notify.gateEvent(MINE, Q, ID, '/home/me/fankeel'), BASE);
    assert.deepEqual(Object.keys(req.body).sort(), ['actions', 'click', 'message', 'priority', 'tags', 'title', 'topic']);
    const text = JSON.stringify(req);
    for (const secret of ['lib/secret-path.js', 'a private note', 'private next step', '第二題']) assert.ok(!text.includes(secret), secret + ' left the machine');
});

test('remoteBase is serve.json\'s tailnet address, and nothing when there is none', () => {
    const cfg = tmp('fankeel-notify-');
    const write = (rec) => {
        fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
        fs.writeFileSync(path.join(cfg, 'fankeel', 'serve.json'), JSON.stringify(rec));
    };
    assert.equal(notify.remoteBase(cfg), null);
    write({ url: 'http://127.0.0.1:28888/' });
    assert.equal(notify.remoteBase(cfg), null);
    write({ url: 'http://127.0.0.1:28888/', remote: { url: BASE } });
    assert.equal(notify.remoteBase(cfg), BASE);
    write({ url: 'http://127.0.0.1:28888/', remote: { url: 'http://' + NAME + '/' } });
    assert.equal(notify.remoteBase(cfg), null, 'only https');
});

test('send resolves true on a 2xx and false on anything else, never rejecting', async () => {
    const s = await stub();
    try {
        assert.equal(await notify.send({ url: s.url + '/', body: { topic: 't', message: 'm' } }, 2000), true);
        assert.equal(s.got.length, 1);
        assert.equal(s.got[0].method, 'POST');
        assert.equal(s.got[0].url, '/');
        assert.match(s.got[0].type, /^application\/json/);
        assert.deepEqual(s.got[0].body, { topic: 't', message: 'm' });
        assert.equal(await notify.send({ url: s.url + '/', body: { topic: 'refuse' } }, 2000), false, 'a refusal');
    } finally {
        s.close();
    }
    assert.equal(await notify.send({ url: 'http://127.0.0.1:1/', body: {} }, 2000), false, 'nothing listening');
    assert.equal(await notify.send(null, 2000), false);
});

test('fire sends exactly one publish from a detached child', async () => {
    const s = await stub();
    try {
        const values = Object.assign({}, ON, { 'notify.server': s.url });
        assert.equal(notify.fire(values, notify.gateEvent(MINE, Q, ID, '/home/me/fankeel'), { base: BASE, env: TESTING }), true);
        assert.equal(await waitFor(() => s.got.length >= 1, 5000), true, 'no publish reached the stub ntfy');
        await new Promise((r) => setTimeout(r, 700));
        assert.equal(s.got.length, 1, 'exactly one publish');
        assert.equal(s.got[0].body.priority, 4);
        assert.equal(s.got[0].body.click, BASE + 'm#/gate/' + ID);
        assert.equal(s.got[0].body.actions[0].label, '打開 gate');
    } finally {
        s.close();
    }
});

test('fire never throws, and sends nothing without a request to send', () => {
    assert.equal(notify.fire(null, null, { env: TESTING }), false);
    assert.equal(notify.fire({}, notify.gateEvent(MINE, Q, ID, '/r'), { base: null, env: TESTING }), false, 'trigger off');
    assert.equal(notify.fire(ON, { kind: 'nope' }, { base: null, env: TESTING }), false);
    assert.equal(notify.fire(ON, notify.gateEvent(MINE, Q, ID, '/r'), null), false, 'no options: the guard holds');
});

test('scripts/notify.js reads one request off argv and exits 0 whatever happens', () => {
    const req = { url: 'https://ntfy.sh/', body: { topic: 't' } };
    assert.deepEqual(parseRequest(JSON.stringify(req)), req);
    assert.equal(parseRequest('not json'), null);
    assert.equal(parseRequest(JSON.stringify({ url: 'file:///etc/passwd', body: {} })), null);
    assert.equal(parseRequest(JSON.stringify({ url: 'https://ntfy.sh/', body: [] })), null);
    assert.equal(parseRequest(undefined), null);
    for (const arg of ['not json', JSON.stringify({ url: 'http://127.0.0.1:1/', body: { topic: 't' } })]) {
        const r = spawnSync(process.execPath, [CHILD, arg], { encoding: 'utf8', timeout: 15000 });
        assert.equal(r.status, 0, arg + ': ' + r.stderr);
        assert.equal(r.stdout, '');
    }
});
```

2. Run it and watch it fail (`Cannot find module '../lib/notify.js'`):

```
node --test tests/notify.test.js
```

3. Write the implementation. Create `lib/notify.js`:

In `lib/notify.js`, the whole file:

```js
'use strict';
// ntfy notifications (docs/90-agent/plans/2026-10-21-station-remote-design.md §5):
// one JSON publish to `<notify.server>/` per trigger — a gate waiting
// (hooks/gate.js), a stage finished (`task.js stage`), a task ended
// (hooks/leave.js) — sent by a detached child, scripts/notify.js, so no hook
// waits on the network and no failure reaches a hook's output or exit code.
// What leaves this machine is the stage, the first question, the task cut to
// 80 characters, the project and the cost: each event is built from those
// fields alone, never from the whole entry. Off under `node --test` unless
// FANKEEL_NOTIFY_TEST=1, so no suite run publishes anything.
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { readServeRecord } = require('./serve.js');

// Started by path, as lib/serve.js starts scripts/station.js; never required.
const CHILD = path.join(__dirname, '..', 'scripts', 'notify.js');
const KINDS = new Set(['gate', 'stage', 'end']);

function newTopic() {
    return 'fankeel-' + crypto.randomBytes(10).toString('hex');
}

// The tailnet address scripts/station.js records beside the loopback one while
// remote is on: a notification's tap opens the phone page there.
function remoteBase(configDir) {
    const rec = readServeRecord(configDir);
    const url = rec && rec.remote && rec.remote.url;
    return typeof url === 'string' && /^https:\/\/[^/\s]+\/$/.test(url) ? url : null;
}

// Whitespace collapsed; past `n` characters, n - 1 of them and an ellipsis.
function cut(s, n) {
    const text = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return text.length > n ? text.slice(0, n - 1) + '…' : text;
}

// The entry's own project, else the registry root's folder name.
function projectOf(mine, root) {
    const own = mine && typeof mine.project === 'string' ? mine.project.trim() : '';
    return own || String(root || '').split(/[\\/]/).filter(Boolean).pop() || '';
}

const taskOf = (mine) => (mine && typeof mine.task === 'string' ? mine.task : '');
const stageOf = (mine) => (mine && typeof mine.stage === 'string' ? mine.stage : '');

function gateEvent(mine, questions, id, root) {
    const first = Array.isArray(questions) && questions[0] && typeof questions[0].question === 'string' ? questions[0].question : '';
    return {
        kind: 'gate', id: String(id || ''), tab: 'gate',
        title: [stageOf(mine), 'gate 在等你'].filter(Boolean).join(' '),
        message: [cut(first, 80), cut(taskOf(mine), 80)].filter(Boolean).join(' — '),
    };
}

function stageEvent(mine, from, to, id, root) {
    return {
        kind: 'stage', id: String(id || ''), tab: 'task',
        title: from + ' 完成，接著 ' + to,
        message: [cut(taskOf(mine), 80), projectOf(mine, root)].filter(Boolean).join(' · '),
    };
}

// `usd` is the parent's and its agents' cost together, or null when neither
// side was priced; the stage count is the stages the entry's clock holds.
function endEvent(mine, usd, id, root) {
    const clock = mine && mine.clock && typeof mine.clock === 'object' && !Array.isArray(mine.clock) ? mine.clock : {};
    const parts = [projectOf(mine, root), Object.keys(clock).length + ' 個 stage'];
    if (typeof usd === 'number' && Number.isFinite(usd)) parts.push('$' + usd.toFixed(2));
    return { kind: 'end', id: String(id || ''), tab: 'task', title: '任務結束：' + cut(taskOf(mine), 40), message: parts.filter(Boolean).join(' · ') };
}

// The publish, or null: the trigger has to be the boolean true the profile
// reads back, and a topic and a server have to be there. A gate is priority 4
// with a 打開 gate action; a stage and an end are 2, silent. The tap opens
// `<base>m#/gate/<id>` or `m#/task/<id>` when the station has a tailnet address.
function request(values, event, base) {
    const v = values || {};
    if (!event || !KINDS.has(event.kind) || v['notify.' + event.kind] !== true) return null;
    const topic = v['notify.topic'];
    const server = v['notify.server'];
    if (typeof topic !== 'string' || !topic || typeof server !== 'string' || !/^https?:\/\//.test(server)) return null;
    const body = { topic, title: event.title, message: event.message, priority: event.kind === 'gate' ? 4 : 2, tags: ['fankeel'] };
    if (typeof base === 'string' && base && event.id) {
        body.click = base + 'm#/' + event.tab + '/' + encodeURIComponent(event.id);
        if (event.kind === 'gate') body.actions = [{ action: 'view', label: '打開 gate', url: body.click }];
    }
    return { url: server.replace(/\/+$/, '') + '/', body };
}

// One POST, aborted after `ms`; true on a 2xx, false on anything else.
async function send(req, ms) {
    if (!req || typeof req.url !== 'string' || !req.body) return false;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms || 8000);
    try {
        const res = await fetch(req.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req.body), signal: ctl.signal });
        await res.text().catch(() => '');
        return res.ok;
    } catch (e) {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

// Hands the publish to a detached child and returns at once; true when one
// was started. Never throws: a hook calls this inside its own try, and a
// notification is never worth a hook's exit code.
function fire(values, event, opts) {
    try {
        const o = opts || {};
        const env = o.env || process.env;
        if (env.NODE_TEST_CONTEXT && env.FANKEEL_NOTIFY_TEST !== '1') return false;
        const base = o.base !== undefined ? o.base : remoteBase(o.configDir);
        const req = request(values, event, base);
        if (!req) return false;
        const child = spawn(process.execPath, [CHILD, JSON.stringify(req)], { detached: true, stdio: 'ignore', windowsHide: true, env });
        child.on('error', () => { /* a spawn that failed; nothing waits on it */ });
        child.unref();
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = { newTopic, remoteBase, gateEvent, stageEvent, endEvent, request, send, fire };
```

4. Create `scripts/notify.js`:

In `scripts/notify.js`, the whole file:

```js
#!/usr/bin/env node
'use strict';
// The child lib/notify.js `fire` starts, detached, for one ntfy publish:
//
//   node scripts/notify.js '<{"url":"https://ntfy.sh/","body":{…}}>'
//
// It sends that one request (lib/notify.js `send`, eight seconds at most) and
// exits 0 whatever happened — no topic, an unreachable server, a refusal —
// because nothing waits on it and nothing reads its exit code.
const { send } = require('../lib/notify.js');

// The request off argv, or null for anything but an http(s) url and a body object.
function parseRequest(arg) {
    try {
        const req = JSON.parse(String(arg));
        if (req && typeof req.url === 'string' && /^https?:\/\//.test(req.url)
            && req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return req;
    } catch (e) { /* not a request */ }
    return null;
}

if (require.main === module) {
    const req = parseRequest(process.argv[2]);
    (req ? send(req, 8000) : Promise.resolve(false)).then(() => process.exit(0), () => process.exit(0));
}

module.exports = { parseRequest };
```

5. Run it and watch it pass:

```
node --test tests/notify.test.js
```

6. Commit:

```
git add lib/notify.js scripts/notify.js tests/notify.test.js
git commit -m "feat: lib/notify.js — one ntfy publish per trigger, sent by a detached child" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 6: the server through the tailnet — the Host check, the route policy, pairing and the card's routes, `tailscale serve` at listen

**Files:**
- Modify: `scripts/station.js` — the four requires; `tailnet`, `boundPort`, `recordData` and `refreshRemote()` in `serve()`; the Host check and the tailnet policy at the top of `handler`; `formOf` taking a device cookie; `GET /station/remote`, `GET /station/remote/qr.svg`, `POST /station/remote/code`, `POST /station/remote/revoke`, `POST /station/remote/pair`; `POST /profile` writing a topic and refreshing remote; `writeRecord` adding `remote`
- Modify: `docs/90-agent/reference/station.md:1370-1408` — a new section, "Reaching the station from a phone", inserted right after "Answering a gate from the page" and before "When a tuned block is done"
- Read: `lib/remote.js` — every name it exports
- Read: `lib/tailscale.js` — `enable(port, run)`
- Read: `lib/qr.js` — `qrSvg(text)`
- Read: `lib/profile.js` — `read(null, configDir)`, `machineFile(configDir)`, `write(file, key, raw)`
- Read: `lib/notify.js` — `newTopic()`
- Read: `lib/serve.js` — `serveRecordPath`, `readServeRecord`
- Read: `lib/body.js` — `readBody(req)`, which the pairing route calls itself
- Read: `lib/handoff.js` — `pendingPath`, `answerPath` for the test fixture
- Read: `lib/registry.js` — `ensureLayout`, `writeSession` for the test fixture
- Read: `hooks/pane.ts` — line 334 accepts only `http://127.0.0.1:<port>`, which is why `url` stays loopback
- Read: `tests/station-answer.test.js` — the fixture this test copies
- Read: `tests/tmp.js` — scratch directories
- Test: `tests/station-remote.test.js`

**Interfaces:**
- Consumes: `remote.hostKind`, `remote.sameOrigin`, `remote.policy`, `remote.newCode`, `remote.liveCode`, `remote.pair`, `remote.deviceFor`, `remote.revoke`, `remote.devicesOf`, `remote.tokenOf`, `remote.cookieFor`; `tailscale.enable`; `qr.qrSvg`; `notify.newTopic`; the profile keys `station.remote`, `notify.server`, `notify.topic`, `notify.gate`, `notify.stage`, `notify.end`
- Produces: `/station/remote` (GET, loopback only) → JSON {on: boolean (the machine profile's `station.remote`), active: boolean, url: `https://<name>/`|null, dnsName|null, warning|null, code|null, until|null, pairUrl: url + 'm#/pair/' + code | null, devices: [{id, name, paired, seen}], notify: {server, topic|null, gate, stage, end}}; `/station/remote/qr.svg` (GET, loopback, 409 while off); `/station/remote/code` (POST, nonce, 409 while off, 201 JSON {code, until}); `/station/remote/revoke` (POST, nonce, form `id`, 200 `revoked` | 404); `/station/remote/pair` (POST, tailnet only, form `code` and `name`, 201 JSON {device} with Set-Cookie, 403 with the reason); `/answer` and every POST route taking a paired device's cookie from the tailnet in place of the nonce; serve.json's `remote.url`; inside `serve()`, `tailnet.on` and `tailnet.dnsName` (null while off), and in `handler` the request's `kind` ('loopback' | 'tailnet') and `device` (the paired device or null), which the phone routes use

**Dispatch:** implementer, opus, high

1. Write the failing test. Create `tests/station-remote.test.js` — the gate fixture of the answer test, a machine profile with `station.remote` on, and a fake `tailscale` that records every call:

In `tests/station-remote.test.js`, the whole file:

```js
'use strict';
// The station through the tailnet (docs/90-agent/plans/2026-10-21-station-remote-design.md
// §1-§3): off, loopback only and 421 for anything else; on, `tailscale serve`
// made once and never Funnel, every tailnet route but the phone page's behind
// a paired device's cookie, every tailnet POST behind the tailnet Origin.
// `tailscaleRun` is faked throughout: no test runs the real tailscale.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const { pendingPath, answerPath } = require('../lib/handoff.js');
const { readServeRecord } = require('../lib/serve.js');
const profile = require('../lib/profile.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const NAME = 'ymlab-pc.tail1234.ts.net';
const SID = 'ffffffff-8888-4888-8888-888888888888';
const Q = [{ question: '進 verify 嗎？', header: 'build', multiSelect: false, options: [{ label: '進 verify', description: 'a' }, { label: '暫停', description: 'b' }] }];
const GOOD = JSON.stringify({ [Q[0].question]: '暫停' });

function fixture(remoteOn) {
    const base = tmp('fankeel-station-remote-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    const data = { task: 't', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: '2026-10-21T08:00:00.000Z', updated: new Date().toISOString(), configDir: cfg };
    registry.writeSession(r1, SID, data);
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: '2026-10-21T08:00:00.000Z' }) + '\n');
    if (remoteOn) fs.writeFileSync(profile.machineFile(cfg), JSON.stringify({ 'station.remote': true }) + '\n');
    const file = pendingPath(r1, data, 'build');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ questions: Q, at: Date.now(), until: Date.now() + 600e3 }));
    return { cfg, r1, data };
}

// tailscale's CLI as lib/tailscale.js calls it: this machine's MagicDNS name
// in `state`, no serve config until `serve --bg <port>`, every call recorded.
function fakeTailscale(state) {
    const calls = [];
    let config = {};
    const run = (args) => {
        calls.push(args.join(' '));
        if (args[0] === 'status') return { status: 0, stdout: JSON.stringify({ BackendState: state || 'Running', Self: { DNSName: NAME + '.' } }), stderr: '' };
        if (args[0] === 'serve' && args[1] === 'status') return { status: 0, stdout: JSON.stringify(config), stderr: '' };
        if (args[0] === 'serve' && args[1] === '--bg') {
            config = { TCP: { 443: { HTTPS: true } }, Web: { [NAME + ':443']: { Handlers: { '/': { Proxy: 'http://127.0.0.1:' + args[2] } } } } };
            return { status: 0, stdout: '', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: 'unexpected: ' + args.join(' ') };
    };
    return { run, calls };
}

const request = (url, o) => new Promise((resolve, reject) => {
    const opts = o || {};
    const post = opts.body !== undefined;
    const headers = Object.assign(post ? { 'content-type': 'application/x-www-form-urlencoded' } : {}, opts.headers);
    const req = http.request(url, { method: post ? 'POST' : 'GET', headers }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, text, headers: res.headers }));
    });
    req.on('error', reject);
    if (post) req.write(opts.body);
    req.end();
});
const form = (o) => new URLSearchParams(o).toString();
const TAILNET = { host: NAME, origin: 'https://' + NAME };
const start = (f, ts) => serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false, tailscaleRun: ts.run });
const nonceOf = async (s) => /"nonce":"([^"]+)"/.exec((await request(s.url + 'station/station-data.js')).text)[1];

test('remote off: the tailnet name and a proxied loopback are refused with 421, and tailscale is never asked', async () => {
    const f = fixture(false);
    const ts = fakeTailscale();
    const s = await start(f, ts);
    try {
        const nonce = await nonceOf(s);
        assert.equal((await request(s.url, { headers: { host: NAME } })).status, 421);
        const answered = await request(s.url + 'answer', { headers: TAILNET, body: form({ nonce, root: f.r1, id: SID, answers: GOOD }) });
        assert.equal(answered.status, 421, 'the nonce does not get a tailnet request past the Host check');
        assert.equal(fs.existsSync(answerPath(f.r1, f.data, 'build')), false, 'a refused answer wrote nothing');
        assert.equal((await request(s.url)).status, 200);
        assert.equal((await request(s.url, { headers: { 'x-forwarded-for': '100.64.0.2' } })).status, 421);
        assert.deepEqual(ts.calls, []);
        assert.equal(readServeRecord(f.cfg).remote, undefined);
    } finally {
        s.close();
    }
});

test('remote on: tailscale serve --bg once, never funnel; serve.json keeps the loopback url and adds remote.url', async () => {
    const f = fixture(true);
    const ts = fakeTailscale();
    const s = await start(f, ts);
    try {
        assert.deepEqual(ts.calls.filter((c) => c.startsWith('serve --bg')), ['serve --bg ' + new URL(s.url).port]);
        assert.equal(ts.calls.some((c) => /funnel/.test(c)), false);
        const rec = readServeRecord(f.cfg);
        assert.match(rec.url, /^http:\/\/127\.0\.0\.1:\d+\/?$/, 'hooks/pane.ts accepts only this');
        assert.deepEqual(rec.remote, { url: 'https://' + NAME + '/' });
    } finally {
        s.close();
    }
});

test('through the tailnet without a paired cookie: 401 on reads and answers, 403 on the card, loopback as before', async () => {
    const f = fixture(true);
    const s = await start(f, fakeTailscale());
    try {
        const nonce = await nonceOf(s);
        const tailnetAnswer = await request(s.url + 'answer', { headers: TAILNET, body: form({ nonce, root: f.r1, id: SID, answers: GOOD }) });
        assert.equal(tailnetAnswer.status, 401, 'the nonce is no key from the tailnet');
        assert.equal((await request(s.url + 'station/station-data.js', { headers: { host: NAME } })).status, 401);
        assert.equal((await request(s.url + 'station/talk/' + SID, { headers: { host: NAME } })).status, 401);
        assert.equal((await request(s.url + 'station/station-data.js', { headers: { 'tailscale-user-login': 'me@example.com' } })).status, 401, 'rewritten to loopback by tailscale serve');
        assert.equal((await request(s.url + 'station/remote', { headers: { host: NAME } })).status, 403);
        assert.equal((await request(s.url + 'station/health', { headers: { host: NAME } })).status, 403);
        assert.equal((await request(s.url + 'station/station.css', { headers: { host: NAME } })).status, 200, 'the phone page\'s assets are open');
        assert.equal(fs.existsSync(answerPath(f.r1, f.data, 'build')), false);
        assert.equal((await request(s.url + 'answer', { body: form({ nonce, root: f.r1, id: SID, answers: GOOD }) })).status, 201, 'loopback keeps the nonce');
    } finally {
        s.close();
    }
});

test('pairing: a live code from the tailnet, once, for an HttpOnly Secure SameSite=Strict cookie that answers without the nonce until revoked', async () => {
    const f = fixture(true);
    const s = await start(f, fakeTailscale());
    try {
        const nonce = await nonceOf(s);
        const card = JSON.parse((await request(s.url + 'station/remote')).text);
        assert.equal(card.on, true);
        assert.equal(card.active, true);
        assert.equal(card.url, 'https://' + NAME + '/');
        assert.equal(card.dnsName, NAME);
        assert.equal(card.warning, null);
        assert.match(card.code, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
        assert.equal(typeof card.until, 'number');
        assert.equal(card.pairUrl, 'https://' + NAME + '/m#/pair/' + card.code);
        assert.deepEqual(card.devices, []);
        assert.deepEqual(card.notify, { server: 'https://ntfy.sh', topic: null, gate: false, stage: false, end: false });
        const svg = await request(s.url + 'station/remote/qr.svg');
        assert.equal(svg.status, 200);
        assert.equal(svg.headers['content-type'], 'image/svg+xml');
        assert.match(svg.text, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
        assert.match(svg.headers['content-security-policy'], /default-src 'none'/);
        const pairBody = form({ code: card.code, name: 'Galaxy S24' });
        assert.equal((await request(s.url + 'station/remote/pair', { body: pairBody })).status, 403, 'pairing is from the phone, not from this machine');
        assert.equal((await request(s.url + 'station/remote/pair', { headers: { host: NAME, origin: 'https://evil.example' }, body: pairBody })).status, 403, 'wrong origin');
        const paired = await request(s.url + 'station/remote/pair', { headers: TAILNET, body: pairBody });
        assert.equal(paired.status, 201, paired.text);
        assert.equal(JSON.parse(paired.text).device.name, 'Galaxy S24');
        const cookie = paired.headers['set-cookie'][0];
        assert.match(cookie, /^fk_device=[A-Za-z0-9_-]{43}; Path=\/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict$/);
        assert.equal((await request(s.url + 'station/remote/pair', { headers: TAILNET, body: pairBody })).status, 403, 'one-time');
        const jar = Object.assign({ cookie: cookie.split(';')[0] }, TAILNET);
        const ok = await request(s.url + 'answer', { headers: jar, body: form({ root: f.r1, id: SID, answers: GOOD }) });
        assert.equal(ok.status, 201, ok.text);
        assert.deepEqual(JSON.parse(fs.readFileSync(answerPath(f.r1, f.data, 'build'), 'utf8')), { answers: { [Q[0].question]: '暫停' } });
        const foreign = await request(s.url + 'answer', { headers: { cookie: jar.cookie, host: NAME, origin: 'https://evil.example' }, body: form({ root: f.r1, id: SID, answers: GOOD }) });
        assert.equal(foreign.status, 403, 'a cookie does not lift the origin check');
        assert.equal((await request(s.url + 'station/station-data.js', { headers: jar })).status, 200, 'a paired phone reads');
        assert.equal((await request(s.url + 'station/remote', { headers: jar })).status, 403, 'a paired phone still cannot reach the card');
        const devices = JSON.parse((await request(s.url + 'station/remote')).text).devices;
        assert.equal(devices.length, 1);
        assert.equal(devices[0].name, 'Galaxy S24');
        assert.equal((await request(s.url + 'station/remote/revoke', { body: form({ id: devices[0].id }) })).status, 403, 'revoke needs the nonce');
        assert.equal((await request(s.url + 'station/remote/revoke', { body: form({ nonce, id: devices[0].id }) })).status, 200);
        assert.equal((await request(s.url + 'station/remote/revoke', { body: form({ nonce, id: devices[0].id }) })).status, 404);
        assert.equal((await request(s.url + 'answer', { headers: jar, body: form({ root: f.r1, id: SID, answers: GOOD }) })).status, 401, 'revoked from the next request');
        const minted = await request(s.url + 'station/remote/code', { body: form({ nonce }) });
        assert.equal(minted.status, 201);
        const code = JSON.parse(minted.text);
        assert.match(code.code, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
        assert.equal(JSON.parse((await request(s.url + 'station/remote')).text).code, code.code, 'the card shows the new code');
        assert.equal((await request(s.url + 'station/remote/code', { body: form({ nonce: 'wrong' }) })).status, 403);
    } finally {
        s.close();
    }
});

test('a tailscale that is not running leaves remote off with the reason on the card, and loopback serving', async () => {
    const f = fixture(true);
    const ts = fakeTailscale('Stopped');
    const s = await start(f, ts);
    try {
        const card = JSON.parse((await request(s.url + 'station/remote')).text);
        assert.equal(card.on, true);
        assert.equal(card.active, false);
        assert.match(card.warning, /Stopped/);
        assert.equal(card.code, null);
        assert.equal(card.pairUrl, null);
        assert.equal((await request(s.url + 'station/remote/qr.svg')).status, 409);
        assert.equal((await request(s.url, { headers: { host: NAME } })).status, 421);
        assert.equal((await request(s.url)).status, 200);
        assert.equal(ts.calls.some((c) => c.startsWith('serve')), false);
        assert.equal(readServeRecord(f.cfg).remote, undefined);
    } finally {
        s.close();
    }
});

test('POST /profile: the first trigger turned on writes a topic, and station.remote turns the tailnet on and off live', async () => {
    const f = fixture(false);
    const ts = fakeTailscale();
    const s = await start(f, ts);
    try {
        const nonce = await nonceOf(s);
        const set = (key, value) => request(s.url + 'profile', { body: form({ nonce, scope: 'machine', key, value }) });
        const machine = () => JSON.parse(fs.readFileSync(profile.machineFile(f.cfg), 'utf8'));
        assert.equal((await set('notify.gate', 'true')).status, 303);
        const topic = machine()['notify.topic'];
        assert.match(topic, /^fankeel-[0-9a-f]{20}$/);
        assert.equal(machine()['notify.gate'], true);
        assert.equal((await set('notify.stage', 'true')).status, 303);
        assert.equal(machine()['notify.topic'], topic, 'written once');
        assert.equal((await request(s.url, { headers: { host: NAME } })).status, 421);
        assert.equal((await set('station.remote', 'true')).status, 303);
        const on = (await request(s.url, { headers: { host: NAME } })).status;
        assert.ok(on === 200 || on === 303, 'answered through the tailnet now (the phone routes later redirect it to /m): ' + on);
        assert.deepEqual(ts.calls.filter((c) => c.startsWith('serve --bg')), ['serve --bg ' + new URL(s.url).port]);
        assert.equal(readServeRecord(f.cfg).remote.url, 'https://' + NAME + '/');
        const before = ts.calls.length;
        assert.equal((await set('station.remote', 'false')).status, 303);
        assert.equal((await request(s.url, { headers: { host: NAME } })).status, 421, 'refused from the next request');
        assert.equal(ts.calls.length, before, 'turning it off does not touch tailscale');
        assert.equal(readServeRecord(f.cfg).remote, undefined);
    } finally {
        s.close();
    }
});
```

2. Run it and watch it fail (the first test reads 200 where it expects 421):

```
node --test tests/station-remote.test.js
```

3. Re-read `scripts/station.js` around each anchor below before editing (line numbers are as of f51da72e). First the requires: in `scripts/station.js`, right after `const todoFiles = require('../lib/todo.js');` (line 54), add:

In `scripts/station.js`, after the `todoFiles` require:

```js
const remote = require('../lib/remote.js');
const tailscale = require('../lib/tailscale.js');
const qr = require('../lib/qr.js');
const notify = require('../lib/notify.js');
```

And replace the two comment lines that close the file's header (lines 29-30, "The per-run nonce is what stops a page…" and "…so nothing off this machine reaches it.") with:

In `scripts/station.js`, the end of the header comment:

```js
// The per-run nonce is what stops a page on some other origin from posting to
// this port. The address is loopback, and with `station.remote` off every Host
// but loopback's is refused with 421; on, `tailscale serve` is the one way in
// from off this machine, and what it may reach is `policy` in lib/remote.js.
```

4. The tailnet state. In `scripts/station.js`, in `serve()`, right after `const nonce = crypto.randomBytes(16).toString('hex');` (line 320), add:

In `scripts/station.js`, in `serve()` after `nonce`:

```js
    // docs/90-agent/plans/2026-10-21-station-remote-design.md §1-§2: the
    // tailnet address `tailscale serve` gives this port while the machine
    // profile's `station.remote` is on and Tailscale agreed. `dnsName` null is
    // remote off, and then every Host but loopback's is refused. `boundPort` is
    // the first port bound — the fixed-port retry leaves the proxy where it
    // is — and `recordData` the last record written, rewritten when this moves.
    let tailnet = { on: false, dnsName: null, url: null, warning: null };
    let boundPort = null;
    let recordData = null;
```

5. The Host check and the tailnet policy. In `scripts/station.js`, in `handler`, delete the line `if (req.method === 'POST') shared = null;` (line 433), and right after `const redirect = (to) => send(303, null, undefined, { location: to });` (line 442) — before the Chartroom comment — insert:

In `scripts/station.js`, in `handler` after `redirect`:

```js
        // docs/90-agent/plans/2026-10-21-station-remote-design.md §1, §3: who
        // is asking. Off, only loopback is answered — a DNS-rebinding page's
        // Host is refused here too. Through the tailnet, `remote.policy`
        // decides: the phone page and pairing are open, the card's own routes
        // are this machine's, and the rest needs a paired device's cookie; every
        // POST from there also needs the tailnet Origin.
        const kind = remote.hostKind(req.headers, tailnet.on ? tailnet.dnsName : null);
        if (!kind) return fail(421, 'this station answers on 127.0.0.1 only');
        let device = null;
        if (kind === 'tailnet') {
            const rule = remote.policy(req.method, url.pathname);
            if (rule === 'local') return fail(403, 'this route answers on this machine only');
            if (req.method === 'POST' && !remote.sameOrigin(req.headers, tailnet.dnsName)) return fail(403, 'wrong origin');
            if (rule === 'device') {
                device = remote.deviceFor(configDir, remote.tokenOf(req.headers.cookie), Date.now());
                if (!device) return fail(401, 'pair this phone first: scan the QR on the station\'s 手機遠端 card');
            }
        }
        if (req.method === 'POST') shared = null;
```

6. A paired device's cookie in place of the nonce. In `scripts/station.js`, replace `formOf` (lines 475-482) with:

In `scripts/station.js`, `formOf`:

```js
        // Every POST carries the nonce this server printed, or — through the
        // tailnet, where the nonce is no key — a paired device's cookie, checked
        // above. One with neither is refused before its form is read further;
        // null tells the route to stop.
        const formOf = async () => {
            const form = new URLSearchParams(await readBody(req));
            if (device || form.get('nonce') === nonce) return form;
            fail(403, 'wrong nonce: open the page this server printed and try again');
            return null;
        };
```

7. The card's routes and pairing. In `scripts/station.js`, right before `if (req.method === 'GET' && url.pathname === '/station/health') {` (line 653), insert:

In `scripts/station.js`, in `handler` before the health route:

```js
        // The 手機遠端 card on #/settings (docs/90-agent/plans/2026-10-21-station-remote-design.md
        // §3). These four answer loopback only — `remote.policy` refuses them
        // through the tailnet above. The code shown is the live one, minted
        // when none is; the QR is the pairing url that code makes.
        if (req.method === 'GET' && url.pathname === '/station/remote') {
            const v = profile.read(null, configDir).values;
            const code = tailnet.on ? remote.liveCode(configDir, Date.now()) : null;
            return send(200, 'application/json; charset=utf-8', JSON.stringify({
                on: v['station.remote'] === true,
                active: tailnet.on,
                url: tailnet.url,
                dnsName: tailnet.dnsName,
                warning: tailnet.warning,
                code: code ? code.value : null,
                until: code ? code.until : null,
                pairUrl: code ? tailnet.url + 'm#/pair/' + code.value : null,
                devices: remote.devicesOf(configDir),
                notify: {
                    server: v['notify.server'] || null,
                    topic: v['notify.topic'] || null,
                    gate: v['notify.gate'] === true,
                    stage: v['notify.stage'] === true,
                    end: v['notify.end'] === true,
                },
            }), noStore);
        }
        if (req.method === 'GET' && url.pathname === '/station/remote/qr.svg') {
            if (!tailnet.on) return fail(409, 'remote is off: nothing to pair with');
            const code = remote.liveCode(configDir, Date.now());
            const svg = qr.qrSvg(tailnet.url + 'm#/pair/' + code.value);
            if (!svg) return fail(500, 'the pairing url is too long for a QR');
            return send(200, 'image/svg+xml', svg, Object.assign({ 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" }, noStore));
        }
        if (req.method === 'POST' && url.pathname === '/station/remote/code') {
            const form = await formOf();
            if (!form) return;
            if (!tailnet.on) return fail(409, 'remote is off: nothing to pair with');
            const code = remote.newCode(configDir, Date.now());
            return send(201, 'application/json; charset=utf-8', JSON.stringify({ code: code.value, until: code.until }), noStore);
        }
        if (req.method === 'POST' && url.pathname === '/station/remote/revoke') {
            const form = await formOf();
            if (!form) return;
            return remote.revoke(configDir, form.get('id') || '') ? send(200, 'text/plain; charset=utf-8', 'revoked\n') : fail(404, 'no such device');
        }
        // The phone's side: a live code for a device token, set as a cookie for
        // a year. Only through the tailnet (its Origin was checked above); it
        // reads its own form, since it has neither a nonce nor a cookie yet.
        if (req.method === 'POST' && url.pathname === '/station/remote/pair') {
            if (kind !== 'tailnet') return fail(403, 'pair from the phone, through the tailnet address');
            const form = new URLSearchParams(await readBody(req));
            const got = remote.pair(configDir, form.get('code') || '', form.get('name') || '', Date.now());
            if (!got.ok) return fail(403, got.reason);
            return send(201, 'application/json; charset=utf-8', JSON.stringify({ device: got.device }), Object.assign({ 'set-cookie': remote.cookieFor(got.token) }, noStore));
        }
```

8. `POST /profile` after its writes. In `scripts/station.js`, in the `/profile` route, right after the write loop that ends `return fail(409, out.reason);` / `}` / `}` (lines 801-806) and before the `// The wizard posts from #/settings` comment, insert (the form's `values` name is taken here, so the read is `after`):

In `scripts/station.js`, in the `/profile` route after the writes:

```js
            // §5: the first trigger turned on gets a topic, so the card has
            // something to say to subscribe to. §2: a `station.remote` write
            // asks Tailscale again now, and its answer is in force from the
            // next request — off included, which touches nothing in Tailscale.
            if (scope === 'machine') {
                const after = profile.read(null, configDir).values;
                const trigger = keys.some((k, i) => /^notify\.(gate|stage|end)$/.test(k) && String(values[i]).trim().toLowerCase() === 'true');
                if (trigger && !after['notify.topic']) profile.write(file, 'notify.topic', notify.newTopic());
                if (keys.includes('station.remote')) refreshRemote();
            }
```

9. The record and `refreshRemote`. In `scripts/station.js`, replace `writeRecord` (lines 815-822, its comment included) with:

In `scripts/station.js`, `writeRecord` and the new `refreshRemote`:

```js
    // Factored so the first bind and the fixed-port retry below write the
    // exact same shape, rather than one drifting from the other. `url` is the
    // loopback address in every state — hooks/pane.ts accepts nothing else —
    // and the tailnet address, while there is one, sits beside it as `remote.url`.
    const writeRecord = (data) => {
        recordData = data;
        const record = serveRecordPath(configDir);
        fs.mkdirSync(path.dirname(record), { recursive: true });
        fs.writeFileSync(record, JSON.stringify(Object.assign({}, data, tailnet.on ? { remote: { url: tailnet.url } } : {}), null, 2) + '\n');
        return record;
    };
    // Asks Tailscale again: at listen, and whenever `station.remote` is
    // written from the page. Never fatal — a warning on stderr and on the
    // card, and loopback keeps serving. Off asks Tailscale nothing.
    const refreshRemote = () => {
        const want = profile.read(null, configDir).values['station.remote'] === true;
        if (want && boundPort) {
            const got = tailscale.enable(boundPort, opts.tailscaleRun);
            tailnet = got.ok
                ? { on: true, dnsName: got.dnsName, url: got.url, warning: null }
                : { on: false, dnsName: null, url: null, warning: got.warning };
            if (!got.ok) process.stderr.write('station: remote stays off — ' + got.warning + '\n');
        } else {
            tailnet = { on: false, dnsName: null, url: null, warning: null };
        }
        if (recordData) writeRecord(recordData);
    };
```

10. Tailscale at listen. In `scripts/station.js`, in the listen callback, right after `const record = writeRecord({ pid: process.pid, port: server.address().port, url, started });` (line 842), add:

In `scripts/station.js`, in the listen callback after the first `writeRecord`:

```js
            // The proxy goes to the port bound first, and the fixed-port retry
            // below leaves it there: that listener stays open. Asked after
            // serve.json is written, so `/fankeel` finds the station while
            // tailscale answers — five seconds a call at most.
            boundPort = server.address().port;
            refreshRemote();
```

11. The reference section. In `docs/90-agent/reference/station.md`, right before the line `## When a tuned block is done` (station.md:1409, the end of the "Answering a gate from the page" section), insert:

In `docs/90-agent/reference/station.md`, before "When a tuned block is done":

```md
## Reaching the station from a phone

Off by default. `station.remote`, read from the machine profile only
(`<configDir>/fankeel/profile.json`), is `false`, and then the station answers
only a request whose Host is `127.0.0.1`, `localhost` or `[::1]` and that
carries none of `X-Forwarded-For`, `X-Forwarded-Host`, `Forwarded` and
`Tailscale-User-Login`; anything else is 421 (`hostKind` in `lib/remote.js`) —
the tailnet name, and a DNS-rebinding page's Host as well. The server listens
on `127.0.0.1` in every state.

Turned on — the 手機遠端 card's switch on `#/settings` posts `station.remote`
to `POST /profile` with `scope=machine` — the station asks Tailscale at listen
and on every write of `station.remote` from the page (`refreshRemote` in
`scripts/station.js`): `tailscale status --json` for this machine's MagicDNS
name, then `tailscale serve --bg <port>` only when `tailscale serve status
--json` shows no proxy to that port yet (`enable` in `lib/tailscale.js`). It
never runs `tailscale funnel`. With Funnel on for the machine, with Tailscale
missing or not running, with no MagicDNS name, or with another proxy already on
`/`, remote stays off, the reason goes to stderr as `station: remote stays off
— <why>` and onto the card, and loopback keeps serving. `serve.json`'s `url`
stays the loopback address — `hooks/pane.ts` accepts nothing else — and the
tailnet address sits beside it as `remote.url`. The proxy is made for the port
bound first; the fixed-port retry leaves it there, and that listener stays
open. Turning `station.remote` off does not touch Tailscale: the tailnet Host
is refused from the next request, and `tailscale serve --https=443 off`
removes the proxy.

Through the tailnet, `policy` in `lib/remote.js` decides what a request may
reach. Open: `GET /`, `/m`, `/m/manifest.webmanifest`, `/m/icon.svg`, `/sw.js`,
`/station/station.css`, `/station/mobile.js`, `/station/mobile.css`, and
`POST /station/remote/pair`. This machine's only (403): the card's own routes
`/station/remote`, `/station/remote/qr.svg`, `/station/remote/code` and
`/station/remote/revoke`, `/station/health`, and Chartroom. Everything else —
reads included, since `/station/talk/<id>` serves whole transcripts — needs a
paired device's cookie and answers 401 without one. Every POST from the
tailnet also needs `Origin: https://<name>` (403 `wrong origin`), and takes the
device cookie in place of the nonce: `/answer`, `/clear`, `/clear-stale`,
`/todo` and `/profile` from a paired phone carry no nonce, and from loopback
they need it as before.

Pairing. `GET /station/remote` is the card's state: `on` (the profile's
`station.remote`), `active` (Tailscale agreed), `url`, `dnsName`, `warning`,
the live `code` with its `until`, `pairUrl` (`<url>m#/pair/<code>`), `devices`
(`id`, `name`, `paired`, `seen`) and `notify` (`server`, `topic`, `gate`,
`stage`, `end`). `GET /station/remote/qr.svg` is `pairUrl` as a QR
(`lib/qr.js`), 409 while remote is off. A code is 8 characters from
`23456789ABCDEFGHJKMNPQRSTUVWXYZ`, one-time, live for 10 minutes; `POST
/station/remote/code` (nonce) mints a new one, 201 `{"code","until"}`, and five
wrong tries drop it. `POST /station/remote/pair` from the tailnet trades a live
`code`, with the phone's `name`, for a device token: 201
`{"device":{"id","name"}}` and `Set-Cookie: fk_device=<token>; Path=/;
Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`; a code that is wrong,
spent or late is 403 with the reason, and from loopback the route is 403.
Only each token's SHA-256 is kept, in `<configDir>/fankeel/remote.json`, which
lives in the config directory and never in a repository. `POST
/station/remote/revoke` (nonce, `id`) drops one device — 200 `revoked`, 404
for an id not paired — and its cookie answers 401 from the next request.

A phone answers a gate only while the gate hook holds it for the station, so
`gate.station` has to be above 0 (the section above).

The first time `notify.gate`, `notify.stage` or `notify.end` is set to `true`
through `POST /profile` with `scope=machine` and no `notify.topic` is set, the
station writes one: `fankeel-` and 20 hex digits (`newTopic` in
`lib/notify.js`), the topic the phone subscribes to in ntfy.

```

12. Run the new test, the answer test and the reference-page test, and watch them pass:

```
node --test tests/station-remote.test.js tests/station-answer.test.js tests/station-doc.test.js
```

13. Commit:

```
git add scripts/station.js docs/90-agent/reference/station.md tests/station-remote.test.js
git commit -m "feat: the station through the tailnet — host check, route policy, pairing, tailscale serve at listen" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 7: lib/mobile.js — `/station/mobile.json`'s three lists, the `/m` shell, its manifest and its icon

**Files:**
- Modify: `lib/mobile.js` — new: `mobileModel`, `shell`, `manifest`, `icon`
- Read: `lib/station.js` — the session row `gather()` builds (lib/station.js:549-630: `sessionId`, `task`, `project`, `stage`, `route`, `state`, `updated` in ms, `ended.at` ISO, `cost`/`agentCost` `{usd, priced}`, `stages[]` `{stage, from, to, usd}` in ms, `pending` `{questions, at, until}`, `gateAt`) and the `hiddenPkeys` key shape (lib/station.js:717)
- Test: `tests/mobile-model.test.js`

**Interfaces:**
- Consumes: none — the model is the one `gather()` already builds, passed in by the server
- Produces: `mobile.mobileModel` (model, now: ms, host: string, hidden?: Set of `root` or `root + '/' + project`) → {host, at, gates: [{id, root, task, project, stage, route, questions, since, until}] oldest `since` first, tasks: [{id, root, task, project, stage, route, gate: boolean, updated}] newest first, done: [{id, root, task, project, stage, route, kind: 'stage'|'end', at, usd: number|null, stages (on 'end' only)}] newest first, an 'end' before a 'stage' at the same moment, at most 40}; `mobile.shell` () → the `/m` html string; `mobile.manifest` () → the manifest's JSON text; `mobile.icon` () → the icon's SVG text

**Dispatch:** implementer, opus, high

1. Write the failing test. Create `tests/mobile-model.test.js`:

In `tests/mobile-model.test.js`, the whole file:

```js
'use strict';
// lib/mobile.js (docs/90-agent/plans/2026-10-21-station-remote-design.md §4):
// the three lists /station/mobile.json carries, read from the rows gather()
// builds and cut to what the phone draws, and the /m shell, manifest and icon.
const test = require('node:test');
const assert = require('node:assert/strict');
const mobile = require('../lib/mobile.js');

const NOW = Date.parse('2026-10-21T03:02:00.000Z');
const H = 3600e3;
const Q = [{ question: '核准這份 design？', multiSelect: false, options: [{ label: '核准，進 plan (Recommended)' }, { label: '改 mockup' }] }];
const row = (o) => Object.assign({
    sessionId: 's', task: 't', project: '', stage: 'build', route: ['survey', 'build'], state: 'live', updated: NOW - 60e3,
    ended: null, cost: null, agentCost: null, stages: [], pending: null, gateAt: null,
    claims: ['lib/private.js'], notes: ['private'],
}, o);
const model = (sessions) => ({ registries: [{ root: '/ws/fankeel', profiles: {}, sessions }] });
const waiting = (at, until) => ({ questions: Q, at, until });

test('gates: every held gate still inside its wait, oldest first, waited from when the question went out', () => {
    const m = mobile.mobileModel(model([
        row({ sessionId: 'b', stage: 'survey', task: 'TODO 全表盤點', pending: waiting(NOW - 60e3, NOW + 30e3) }),
        row({ sessionId: 'a', stage: 'design', pending: waiting(NOW - 240e3, NOW + 60e3), gateAt: NOW - 250e3 }),
        row({ sessionId: 'over', pending: waiting(NOW - 900e3, NOW - 1) }),
        row({ sessionId: 'plain' }),
    ]), NOW, 'ymlab-pc');
    assert.equal(m.host, 'ymlab-pc');
    assert.equal(m.at, NOW);
    assert.deepEqual(m.gates.map((g) => g.id), ['a', 'b']);
    assert.deepEqual(m.gates[0], { id: 'a', root: '/ws/fankeel', task: 't', project: 'fankeel', stage: 'design', route: ['survey', 'build'], questions: Q, since: NOW - 250e3, until: NOW + 60e3 });
    assert.equal(m.gates[1].since, NOW - 60e3, 'no gateAt: the hook\'s own at');
});

test('tasks: the running ones, newest first, each saying whether a gate waits', () => {
    const m = mobile.mobileModel(model([
        row({ sessionId: 'old', updated: NOW - 600e3, pending: waiting(NOW - 60e3, NOW + 30e3) }),
        row({ sessionId: 'new', updated: NOW - 5e3, project: 'sub' }),
        row({ sessionId: 'stale', state: 'stale' }),
        row({ sessionId: 'down', state: 'down' }),
    ]), NOW, 'ymlab-pc');
    assert.deepEqual(m.tasks.map((x) => [x.id, x.gate, x.project]), [['new', false, 'sub'], ['old', true, 'fankeel']]);
    assert.equal(m.tasks[0].updated, NOW - 5e3);
    assert.deepEqual(Object.keys(m.tasks[0]).sort(), ['gate', 'id', 'project', 'root', 'route', 'stage', 'task', 'updated']);
});

test('done: stages finished and tasks ended in the last 48 hours, newest first, an end before its last stage, agents in the cost', () => {
    const m = mobile.mobileModel(model([
        row({ sessionId: 'e', state: 'down', stage: 'land', ended: { at: new Date(NOW - 0.5 * H).toISOString(), reason: 'exit' },
            cost: { usd: 70, priced: ['claude-opus'] }, agentCost: { usd: 9.71, priced: ['claude-sonnet'] },
            stages: [{ stage: 'plan', from: NOW - 52 * H, to: NOW - 49 * H, usd: 4 }, { stage: 'audit', from: NOW - 4 * H, to: NOW - 3 * H, usd: 11.09 }, { stage: 'land', from: NOW - 3 * H, to: NOW - 0.5 * H, usd: 2.58 }] }),
        row({ sessionId: 'l', state: 'live', stage: 'design', stages: [{ stage: 'survey', from: NOW - 2 * H, to: NOW - H, usd: 1.5 }, { stage: 'design', from: NOW - H, to: NOW - 1e3, usd: 0.4 }] }),
        row({ sessionId: 'u', state: 'down', stage: 'plan', ended: { at: new Date(NOW - 2 * H).toISOString() }, cost: { usd: 0, priced: [] },
            stages: [{ stage: 'plan', from: NOW - 3 * H, to: NOW - 2 * H, usd: null }] }),
        row({ sessionId: 'x', state: 'down', ended: { at: new Date(NOW - 72 * H).toISOString() }, stages: [{ stage: 'build', from: NOW - 73 * H, to: NOW - 72 * H, usd: 1 }] }),
    ]), NOW, 'ymlab-pc');
    assert.deepEqual(m.done.map((d) => [d.id, d.kind, d.stage]), [
        ['e', 'end', 'land'], ['e', 'stage', 'land'], ['l', 'stage', 'survey'], ['u', 'end', 'plan'], ['u', 'stage', 'plan'], ['e', 'stage', 'audit'],
    ], 'the running stage of a live task is not done; past 48 hours is gone');
    const end = m.done[0];
    assert.ok(Math.abs(end.usd - 79.71) < 1e-9, 'the parent and its agents: ' + end.usd);
    assert.equal(end.stages, 3);
    assert.equal(end.at, NOW - 0.5 * H);
    assert.equal(m.done[1].usd, 2.58);
    assert.equal(m.done[1].stages, undefined);
    assert.equal(m.done[3].usd, null, 'nothing priced is no cost, not $0');
    assert.equal(m.done[4].usd, null);
});

test('done keeps the newest forty', () => {
    const stages = Array.from({ length: 50 }, (_, i) => ({ stage: 's' + i, from: NOW - (i + 2) * 60e3, to: NOW - (i + 1) * 60e3, usd: 1 }));
    const m = mobile.mobileModel(model([row({ state: 'down', stages })]), NOW, 'h');
    assert.equal(m.done.length, 40);
    assert.equal(m.done[0].stage, 's0');
    assert.equal(m.done[39].stage, 's39');
});

test('a project station.hide takes off the phone too, and nothing private rides along', () => {
    const m = mobile.mobileModel(model([
        row({ sessionId: 'shown', pending: waiting(NOW - 60e3, NOW + 30e3) }),
        row({ sessionId: 'hidden', project: 'secret', pending: waiting(NOW - 60e3, NOW + 30e3) }),
    ]), NOW, 'h', new Set(['/ws/fankeel/secret']));
    assert.deepEqual(m.gates.map((g) => g.id), ['shown']);
    assert.deepEqual(m.tasks.map((g) => g.id), ['shown']);
    const text = JSON.stringify(m);
    assert.ok(!text.includes('lib/private.js') && !text.includes('"private"'), 'claims and notes stay on this machine');
    assert.deepEqual(mobile.mobileModel({ registries: [] }, NOW, 'h'), { host: 'h', at: NOW, gates: [], tasks: [], done: [] });
    assert.deepEqual(mobile.mobileModel(null, NOW, null), { host: '', at: NOW, gates: [], tasks: [], done: [] });
});

test('the /m shell: the keel look, its manifest and icon, both stylesheets, the phone script', () => {
    const html = mobile.shell();
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /<html lang="zh-Hant" data-style="keel">/);
    assert.match(html, /<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">/);
    assert.match(html, /<meta name="theme-color" content="#2d5bd8">/);
    assert.match(html, /<link rel="manifest" href="\/m\/manifest\.webmanifest">/);
    assert.match(html, /<link rel="icon" href="\/m\/icon\.svg" type="image\/svg\+xml">/);
    const a = html.indexOf('href="/station/station.css"');
    assert.ok(a > 0 && a < html.indexOf('href="/station/mobile.css"'), 'station.css first, mobile.css over it');
    assert.match(html, /<body class="m"><div class="scr" id="app" data-block="app"><\/div>/);
    assert.match(html, /<script src="\/station\/mobile\.js"><\/script>/);
});

test('the manifest installs /m standalone with its one svg icon', () => {
    assert.deepEqual(JSON.parse(mobile.manifest()), {
        name: 'fankeel 測站', short_name: 'fankeel', id: '/m', start_url: '/m', scope: '/', display: 'standalone',
        background_color: '#f2f4f3', theme_color: '#2d5bd8', icons: [{ src: '/m/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    });
});

test('the icon is the keel glyph on keel blue', () => {
    const svg = mobile.icon();
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 120 120">/);
    assert.match(svg, /<rect width="120" height="120" rx="26" fill="#2d5bd8"\/>/);
    assert.equal((svg.match(/<path d="M[^"]+Z" fill="#fbfcfc"\/>/g) || []).length, 7, 'six segments and the core');
});
```

2. Run it and watch it fail (`Cannot find module '../lib/mobile.js'`):

```
node --test tests/mobile-model.test.js
```

3. Write the implementation. Create `lib/mobile.js` (the glyph's paths are the masthead's six segments and core, the same ones the mockup's notification icon draws):

In `lib/mobile.js`, the whole file:

```js
'use strict';
// The phone station's data and page (docs/90-agent/plans/2026-10-21-station-remote-design.md
// §4): what /station/mobile.json carries — the gates held for the station,
// the running tasks, what finished in the last 48 hours — read from the model
// gather() builds and cut to the fields the phone draws, a few kilobytes where
// the desktop's station-data.js is the whole machine; and the /m shell, its
// manifest and its icon. Pure: the server passes the model, the clock, this
// machine's name and the projects `station.hide` takes off the page.

const DONE_MS = 48 * 3600e3;
const DONE_MAX = 40;
// station.css's keel tokens (`--keel`, `--ground`, `--on-keel`).
const KEEL = '#2d5bd8';
const GROUND = '#f2f4f3';
const ON_KEEL = '#fbfcfc';
// The masthead's glyph on 120 x 120: six segments, then the core.
const GLYPH = [
    'M56.50 107.98L20.20 87.02L36.65 77.52L56.50 88.98Z',
    'M16.70 80.96L16.70 39.04L33.15 48.54L33.15 71.46Z',
    'M20.20 32.98L56.50 12.02L56.50 31.02L36.65 42.48Z',
    'M63.50 12.02L99.80 32.98L83.35 42.48L63.50 31.02Z',
    'M103.30 39.04L103.30 80.96L86.85 71.46L86.85 48.54Z',
    'M99.80 87.02L63.50 107.98L63.50 88.98L83.35 77.52Z',
    'M60.00 39.00L78.19 49.50L78.19 70.50L60.00 81.00L41.81 70.50L41.81 49.50Z',
];

const tail = (root) => String(root || '').split(/[\\/]/).filter(Boolean).pop() || '';
const pricedUsd = (cost) => (cost && Array.isArray(cost.priced) && cost.priced.length && Number.isFinite(cost.usd) ? cost.usd : null);
const held = (s, now) => Boolean(s.pending && Array.isArray(s.pending.questions) && s.pending.until > now);

// Every row on the page, without the projects `station.hide` takes off — the
// key is lib/station.js's pkey, `root` or `root + '/' + project`.
function rowsOf(model, hidden) {
    const out = [];
    for (const r of (model && Array.isArray(model.registries)) ? model.registries : []) {
        for (const s of Array.isArray(r.sessions) ? r.sessions : []) {
            if (hidden && hidden.has(s.project ? r.root + '/' + s.project : r.root)) continue;
            out.push({ root: r.root, s });
        }
    }
    return out;
}

// What every list's row carries, and nothing else of the entry.
function base(root, s) {
    return { id: s.sessionId, root, task: s.task || '', project: s.project || tail(root), stage: s.stage || '', route: Array.isArray(s.route) ? s.route : [] };
}

function mobileModel(model, now, host, hidden) {
    const all = rowsOf(model, hidden);
    const gates = all.filter(({ s }) => held(s, now))
        .map(({ root, s }) => Object.assign(base(root, s), {
            questions: s.pending.questions,
            since: Number.isFinite(s.gateAt) ? s.gateAt : Number.isFinite(s.pending.at) ? s.pending.at : now,
            until: s.pending.until,
        }))
        .sort((a, b) => a.since - b.since);
    const tasks = all.filter(({ s }) => s.state === 'live')
        .map(({ root, s }) => Object.assign(base(root, s), { gate: held(s, now), updated: Number.isFinite(s.updated) ? s.updated : null }))
        .sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const done = [];
    for (const { root, s } of all) {
        for (const w of Array.isArray(s.stages) ? s.stages : []) {
            if (!w || !Number.isFinite(w.to) || now - w.to > DONE_MS) continue;
            // The stage a session is still in has not finished.
            if (s.state !== 'down' && w.stage === s.stage) continue;
            done.push(Object.assign(base(root, s), { kind: 'stage', stage: w.stage, at: w.to, usd: Number.isFinite(w.usd) ? w.usd : null }));
        }
        const ended = s.ended && typeof s.ended.at === 'string' ? Date.parse(s.ended.at) : NaN;
        if (Number.isFinite(ended) && now - ended <= DONE_MS) {
            const own = pricedUsd(s.cost);
            const theirs = pricedUsd(s.agentCost);
            done.push(Object.assign(base(root, s), {
                kind: 'end', stage: s.stage || '', at: ended,
                usd: own === null && theirs === null ? null : (own || 0) + (theirs || 0),
                stages: Array.isArray(s.stages) ? s.stages.length : 0,
            }));
        }
    }
    done.sort((a, b) => b.at - a.at || (a.kind === b.kind ? 0 : a.kind === 'end' ? -1 : 1));
    return { host: String(host || ''), at: now, gates, tasks, done: done.slice(0, DONE_MAX) };
}

// The /m page: one app-like column, drawn by /station/mobile.js into #app.
function shell() {
    return '<!doctype html>\n'
        + '<html lang="zh-Hant" data-style="keel"><head><meta charset="utf-8">\n'
        + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        + '<meta name="theme-color" content="' + KEEL + '">\n'
        + '<title>fankeel 測站</title>\n'
        + '<link rel="manifest" href="/m/manifest.webmanifest">\n'
        + '<link rel="icon" href="/m/icon.svg" type="image/svg+xml">\n'
        + '<link rel="stylesheet" href="/station/station.css">\n'
        + '<link rel="stylesheet" href="/station/mobile.css">\n'
        + '</head><body class="m"><div class="scr" id="app" data-block="app"></div>\n'
        + '<script src="/station/mobile.js"></script>\n'
        + '</body></html>\n';
}

function manifest() {
    return JSON.stringify({
        name: 'fankeel 測站', short_name: 'fankeel', id: '/m', start_url: '/m', scope: '/', display: 'standalone',
        background_color: GROUND, theme_color: KEEL,
        icons: [{ src: '/m/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    }, null, 2) + '\n';
}

function icon() {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="26" fill="' + KEEL + '"/>'
        + '<g transform="translate(15 15) scale(.75)">' + GLYPH.map((d) => '<path d="' + d + '" fill="' + ON_KEEL + '"/>').join('') + '</g></svg>\n';
}

module.exports = { mobileModel, shell, manifest, icon };
```

4. Run it and watch it pass:

```
node --test tests/mobile-model.test.js
```

5. Commit:

```
git add lib/mobile.js tests/mobile-model.test.js
git commit -m "feat: lib/mobile.js — the phone station's lists, shell, manifest and icon" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 8: the phone page — `assets/station/mobile.js`, its stylesheet and the service worker

**Files:**
- Modify: `assets/station/mobile.js` — new: the phone page — `parseRoute`, `screen` and the screens it draws, `answersOf`, `collect`, `codeIn`, `setLang`, the `STR` tables, and `boot` on a page with `#app`
- Modify: `assets/station/mobile.css` — new: the mockup's phone rules, and what a real page needs over them
- Modify: `assets/station/sw.js` — new: the service worker, caching the shell only
- Read: `.fankeel/build/2026-10-21-station-mobile/mockup.html` — the approved mockup: blocks `tabbar`, `tab-gates`, `gate-sheet`, `tab-tasks`, `tab-done`, `pair-scan`, `pair-error`, `gates-empty`; its CSS lines 12, 25-26, 30-31, 44-85, 88-127, 129-135, 137-163 and 221-224; its icon symbols
- Read: `assets/station/station.js` — `pgAnswers` (assets/station/station.js:2569-2579), the rule `answersOf` mirrors
- Read: `assets/station/spend-panel.js` — the module shape: `module.exports = api` when `module` exists, `window.FK_*` when `window` does
- Read: `lib/mobile.js` — the `/station/mobile.json` shape the page draws
- Test: `tests/station-mobile-page.test.js`

**Interfaces:**
- Consumes: `mobile.mobileModel` — the JSON the page reads every 5 s
- Produces: `FK_M.parseRoute` (hash) → {tab: 'gates'|'tasks'|'done', open: id|null, focus: id|null, pair: CODE|null}; `FK_M.screen` (M, R, now?, ui?) → the html string for `#app` — `ui.mode` 'app' (default), 'pair' (`ui.camera`, `ui.manual`, `ui.say`) or 'off' (`ui.host`); in 'app' every 待答 row is `<a class="row" href="#/gate/<id>" data-gate="<id>">`, the badge is `<span class="bdg" aria-label="…">N</span>` on every tab and absent at 0, and the blocks are `tabbar`, `tab-gates`, `gates-empty`, `gate-sheet`, `tab-tasks`, `tab-done`, `pair-scan`, `pair-error`; `FK_M.answersOf` (questions, picks, others) → {question: answer} | null while any is missing; `FK_M.codeIn` (text) → 8-character code | null; `FK_M.collect` (inputs, count) → {picks, others}; `FK_M.setLang` ('zh'|'en'); `FK_M.STR` {zh, en}; the files served as `/station/mobile.js`, `/station/mobile.css` and `/sw.js`, the last caching `fankeel-m-1`

**Dispatch:** implementer, opus, high

1. Write the failing test. Create `tests/station-mobile-page.test.js` — the screens drawn from a mobile.json-shaped model, the page booted in a context of its own against a fake `fetch`, and the service worker against fake caches:

In `tests/station-mobile-page.test.js`, the whole file:

```js
'use strict';
// The phone page (docs/90-agent/plans/2026-10-21-station-remote-design.md §4
// and the approved mockup's blocks): assets/station/mobile.js drawn from a
// mobile.json-shaped model, booted in a context of its own against a fake
// fetch, and assets/station/sw.js against fake caches.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const P = require('../assets/station/mobile.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const read = (name) => fs.readFileSync(path.join(ASSETS, name), 'utf8');
const CJK = /[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;
// Local time, so 今天 / 昨天 and the clock times are this machine's.
const NOW = new Date(2026, 9, 21, 11, 2).getTime();
const Q1 = [{ question: '核准這份 design？', header: 'design', multiSelect: false, options: [
    { label: '核准，進 plan (Recommended)', description: '照 Tailscale + ntfy 這版拆任務' },
    { label: '改 mockup', description: '回 tune，指出要改的 block' },
    { label: '換做法', description: '回 design 重想連線方式' }] }];
const Q2 = [Q1[0], { question: '這次一起改哪些？', header: '範圍', multiSelect: true, options: [{ label: 'gate', description: 'a' }, { label: 'tune', description: 'b' }] }];
const M = {
    host: 'ymlab-pc', at: NOW,
    gates: [
        { id: 'aaaa-1', root: '/ws/fankeel', task: 'station 遠端存取討論', project: 'fankeel', stage: 'design', route: ['survey', 'design', 'plan'], questions: Q1, since: NOW - 240e3, until: NOW + 60e3 },
        { id: 'bbbb-2', root: '/ws/fankeel', task: 'TODO 全表盤點', project: 'fankeel', stage: 'survey', route: ['survey', 'plan'], questions: Q2, since: NOW - 60e3, until: NOW + 60e3 },
    ],
    tasks: [
        { id: 'aaaa-1', root: '/ws/fankeel', task: 'station 遠端存取討論', project: 'fankeel', stage: 'design', route: ['survey', 'design', 'plan', 'build'], gate: true, updated: NOW - 240e3 },
        { id: 'cccc-3', root: '/ws/ils', task: 'FSC 下一輪', project: 'ils-bench', stage: 'build', route: ['survey', 'design', 'plan', 'build', 'verify'], gate: false, updated: NOW - 180e3 },
    ],
    done: [
        { id: 'dddd-4', root: '/ws/fankeel', task: 'TODO 全表盤點', project: 'fankeel', stage: 'land', route: [], kind: 'end', at: NOW - 20 * 60e3, usd: 79.71, stages: 6 },
        { id: 'dddd-4', root: '/ws/fankeel', task: 'TODO 全表盤點', project: 'fankeel', stage: 'land', route: [], kind: 'stage', at: NOW - 49 * 60e3, usd: 2.58 },
        { id: 'eeee-5', root: '/ws/ils', task: 'fsc-14', project: 'ils-bench', stage: 'verify', route: [], kind: 'stage', at: NOW - 13 * 3600e3, usd: null },
    ],
};
const APP = { mode: 'app' };
const count = (html, re) => (html.match(re) || []).length;

test('the hash names the tab, an open gate, a task to find, or a pairing code', () => {
    const r = (tab, open, focus, pair) => ({ tab, open: open || null, focus: focus || null, pair: pair || null });
    assert.deepEqual(P.parseRoute(''), r('gates'));
    assert.deepEqual(P.parseRoute('#/gates'), r('gates'));
    assert.deepEqual(P.parseRoute('#/tasks'), r('tasks'));
    assert.deepEqual(P.parseRoute('#/done'), r('done'));
    assert.deepEqual(P.parseRoute('#/gate/aaaa-1'), r('gates', 'aaaa-1'));
    assert.deepEqual(P.parseRoute('#/task/cccc-3'), r('tasks', null, 'cccc-3'));
    assert.deepEqual(P.parseRoute('#/pair/abcd2345'), r('gates', null, null, 'ABCD2345'));
    assert.deepEqual(P.parseRoute('#/pair/short'), r('gates'));
    assert.deepEqual(P.parseRoute('#/gate/<x>'), r('gates'));
});

test('codeIn reads a code off the pairing url a QR carries, or one typed', () => {
    assert.equal(P.codeIn('https://ymlab-pc.tail1234.ts.net/m#/pair/ABCD2345'), 'ABCD2345');
    assert.equal(P.codeIn(' abcd2345 '), 'ABCD2345');
    assert.equal(P.codeIn('https://x/m#/pair/ABCD23456'), null, 'nine is not eight');
    assert.equal(P.codeIn('hello'), null);
    assert.equal(P.codeIn(null), null);
});

test('answersOf is pgAnswers\' rule, and null while any question has no answer', () => {
    assert.deepEqual(P.answersOf(Q2, { 0: ['__other'], 1: ['gate', '__other'] }, { 0: '  換個做法 ', 1: 'docs' }),
        { [Q2[0].question]: '換個做法', [Q2[1].question]: 'gate, docs' });
    assert.deepEqual(P.answersOf(Q2, { 0: ['改 mockup'], 1: ['gate', 'tune'] }, {}), { [Q2[0].question]: '改 mockup', [Q2[1].question]: 'gate, tune' });
    assert.equal(P.answersOf(Q2, { 0: ['改 mockup'], 1: ['__other'] }, { 1: '   ' }), null, 'a 自己寫 with nothing typed is no answer');
    assert.equal(P.answersOf(Q2, { 0: ['改 mockup'] }, {}), null);
    assert.equal(P.answersOf([], {}, {}), null);
});

test('collect reads the sheet\'s inputs: the picks per question, and the typed text only where its box is ticked', () => {
    const input = (name, value, checked) => ({ name, value, checked, getAttribute: () => null });
    const own = (qi, value) => ({ name: '', value, checked: false, getAttribute: (a) => (a === 'data-own' ? String(qi) : null) });
    const got = P.collect([input('q0', '改 mockup', false), input('q0', '__other', true), own(0, '換個做法'),
        input('q1', 'gate', true), input('q1', 'tune', false), input('q1', '__other', false), own(1, 'not ticked')], 2);
    assert.deepEqual(got, { picks: { 0: ['__other'], 1: ['gate'] }, others: { 0: '換個做法' } });
});

test('待答: one row per held gate, oldest first, the badge counting them, a long wait in the signal colour', () => {
    const html = P.screen(M, P.parseRoute('#/gates'), NOW, APP);
    assert.match(html, /data-block="tab-gates"/);
    assert.match(html, /data-block="tabbar"/);
    assert.deepEqual([...html.matchAll(/data-gate="([^"]+)"/g)].map((m) => m[1]), ['aaaa-1', 'bbbb-2']);
    assert.match(html, /<span class="bdg" aria-label="2 個在等">2<\/span>/);
    assert.match(html, /<a class="tb" href="#\/gates" aria-current="page">/);
    assert.match(html, /href="#\/gate\/aaaa-1"/);
    assert.match(html, /<span class="ago wait">4 分<\/span>/);
    assert.match(html, /<span class="ago">1 分<\/span>/);
    assert.match(html, /還有 1 題/, 'a second question is counted on its row');
    assert.match(html, /<h1>待答<\/h1><span class="n">2<\/span>/);
    assert.match(html, /<i class="dot live"><\/i>ymlab-pc/);
    assert.doesNotMatch(html, /data-block="gate-sheet"/);
});

test('with no gate held, 待答 is gates-empty and the badge is gone', () => {
    const html = P.screen(Object.assign({}, M, { gates: [] }), P.parseRoute('#/gates'), NOW, APP);
    assert.match(html, /data-block="gates-empty"/);
    assert.match(html, /沒有在等你的 gate/);
    assert.equal(count(html, /class="bdg"/g), 0);
    assert.equal(count(html, /data-gate=/g), 0);
});

test('the gate sheet: every question, the recommended option picked under its own label, a 自己寫答案 box, the report link', () => {
    const one = P.screen(M, P.parseRoute('#/gate/aaaa-1'), NOW, APP);
    assert.match(one, /<form class="sheet" id="gate-sheet" data-block="gate-sheet" data-id="aaaa-1"/);
    assert.match(one, /<div class="dim" data-close="1"/);
    assert.match(one, /<input type="radio" name="q0" value="核准，進 plan \(Recommended\)" checked>/);
    assert.match(one, /<span class="opt-l">核准，進 plan<span class="gq-rec">建議<\/span><\/span>/);
    assert.match(one, /<input type="radio" name="q0" value="改 mockup">/);
    assert.match(one, /<input type="radio" name="q0" value="__other">/);
    assert.match(one, /<input class="own" type="text" data-own="0"/);
    assert.match(one, /href="\/f\/aaaa-1\/gate">.*看 design 報告/);
    assert.match(one, /等了 4 分/);
    assert.match(one, /<p class="sh-say" role="status"><\/p><button type="submit" class="cta">送出答案<\/button>/);
    const two = P.screen(M, P.parseRoute('#/gate/bbbb-2'), NOW, APP);
    assert.equal(count(two, /<h2 class="sh-q"/g), 2);
    assert.match(two, /<input type="checkbox" name="q1" value="gate">/);
    assert.match(two, /<input type="checkbox" name="q1" value="__other">/);
    const held = P.screen(M, P.parseRoute('#/gate/aaaa-1'), NOW, { mode: 'app', picks: { 0: ['改 mockup'] } });
    assert.match(held, /value="改 mockup" checked>/);
    assert.doesNotMatch(held, /\(Recommended\)" checked/);
    assert.doesNotMatch(P.screen(M, P.parseRoute('#/gate/nobody'), NOW, APP), /gate-sheet/, 'a gate no longer held opens nothing');
});

test('任務: each running task with its route dots, its stage and a 待答 pill when a gate waits', () => {
    const html = P.screen(M, P.parseRoute('#/task/cccc-3'), NOW, APP);
    assert.match(html, /data-block="tab-tasks"/);
    assert.match(html, /<a class="tb" href="#\/tasks" aria-current="page">/);
    assert.equal(count(html, /<a class="row"/g), 2);
    assert.match(html, /href="\/f\/aaaa-1\/design"/);
    assert.match(html, /<i style="background:var\(--st-survey\)"><\/i><i class="now" style="--c:var\(--st-design\);background:var\(--c\)"><\/i><i class="todo"><\/i><i class="todo"><\/i>/);
    assert.equal(count(html, /class="pill gate"/g), 1);
    assert.match(html, /href="\/f\/cccc-3\/build" data-focus="1"/);
    assert.match(html, /<span class="bdg"[^>]*>2<\/span>/, 'the 待答 badge on every tab');
    assert.match(html, /<h1>任務<\/h1><span class="n">2<\/span>/);
});

test('完成: an ended task and a finished stage with their cost, today and yesterday apart', () => {
    const html = P.screen(M, P.parseRoute('#/done'), NOW, APP);
    assert.match(html, /data-block="tab-done"/);
    assert.match(html, /<div class="grp-h">今天<span>到 11:02<\/span><\/div>/);
    assert.match(html, /<div class="grp-h">昨天<\/div>/);
    assert.match(html, /<a class="row fin" href="\/f\/dddd-4\/land">.*任務結束.*<span class="usd">\$79\.71<\/span><span class="ago">10:42<\/span>/);
    assert.match(html, /完成 ·<\/span><span class="pj">fankeel<\/span>.*<span class="usd">\$2\.58<\/span><span class="ago">10:13<\/span>/);
    assert.match(html, /<span class="usd">—<\/span><span class="ago">22:02<\/span>/, 'nothing priced is a dash');
    assert.doesNotMatch(html, /<span class="n">/, '完成 carries no count');
});

test('pair-scan: the viewfinder where a camera can scan, the typed code otherwise; pair-error names the machine', () => {
    const cam = P.screen(null, P.parseRoute(''), NOW, { mode: 'pair', camera: true });
    assert.match(cam, /data-block="pair-scan"/);
    assert.match(cam, /<div class="vf" role="img"/);
    assert.match(cam, /data-act="manual"/);
    assert.doesNotMatch(cam, /data-pair-form/);
    assert.doesNotMatch(cam, /data-block="tabbar"/);
    const typed = P.screen(null, P.parseRoute(''), NOW, { mode: 'pair', camera: false, say: 'wrong pairing code <b>' });
    assert.match(typed, /data-pair-form="1"/);
    assert.match(typed, /<input class="code" name="code"/);
    assert.doesNotMatch(typed, /class="vf"/);
    assert.match(typed, /<p class="say" role="status">wrong pairing code &lt;b&gt;<\/p>/);
    const off = P.screen(null, P.parseRoute(''), NOW, { mode: 'off', host: 'ymlab-pc' });
    assert.match(off, /data-block="pair-error"/);
    assert.match(off, /<h2>連不到 ymlab-pc<\/h2>/);
    assert.match(off, /data-act="retry"/);
    assert.match(off, /data-act="repair"/);
    assert.match(P.screen(null, null, NOW, { mode: 'off' }), /<h2>連不到 測站<\/h2>/);
});

test('every value from the registry is escaped', () => {
    const bad = '<img src=x onerror=alert(1)>';
    const m = {
        host: bad,
        gates: [Object.assign({}, M.gates[0], { task: bad, project: bad, questions: [{ question: bad, options: [{ label: bad, description: bad }] }] })],
        tasks: [Object.assign({}, M.tasks[0], { task: bad })],
        done: [Object.assign({}, M.done[0], { task: bad })],
    };
    for (const hash of ['#/gate/aaaa-1', '#/tasks', '#/done']) {
        const html = P.screen(m, P.parseRoute(hash), NOW, APP);
        assert.ok(!html.includes('<img'), hash);
        assert.ok(html.includes('&lt;img'), hash);
    }
});

test('English: the same keys in both tables, and no CJK left on any screen', () => {
    assert.deepEqual(Object.keys(P.STR.en).sort(), Object.keys(P.STR.zh).sort());
    for (const [k, v] of Object.entries(P.STR.en)) assert.ok(!CJK.test(v), k + ' is not English: ' + v);
    const ascii = JSON.parse(JSON.stringify(M).replace(/[^\x00-\x7f]+/g, 'x'));
    P.setLang('en');
    try {
        const screens = [
            P.screen(ascii, P.parseRoute('#/gate/bbbb-2'), NOW, APP),
            P.screen(ascii, P.parseRoute('#/tasks'), NOW, APP),
            P.screen(ascii, P.parseRoute('#/done'), NOW, APP),
            P.screen(Object.assign({}, ascii, { gates: [] }), P.parseRoute(''), NOW, APP),
            P.screen(null, null, NOW, { mode: 'pair', camera: true }),
            P.screen(null, null, NOW, { mode: 'pair', camera: false, say: 'x' }),
            P.screen(null, null, NOW, { mode: 'off', host: 'ymlab-pc' }),
        ];
        for (const html of screens) assert.equal(CJK.exec(html), null, html.slice(0, 160));
        assert.match(screens[0], /Send answer/);
    } finally {
        P.setLang('zh');
    }
});

test('mobile.css carries a rule for every class the screens draw, and the real page\'s overrides', () => {
    const css = read('mobile.css');
    // Drawn from station.css, which the shell loads first, as the mockup did.
    const STATION = new Set(['dot', 'live', 'hm-stw', 'route', 'now', 'todo', 'pill', 'gate', 'gq-rec', 'glyph', 'gseg', 'done', 'gedge', 'gcore']);
    const html = [
        P.screen(M, P.parseRoute('#/gate/bbbb-2'), NOW, APP), P.screen(M, P.parseRoute('#/task/cccc-3'), NOW, APP), P.screen(M, P.parseRoute('#/done'), NOW, APP),
        P.screen(Object.assign({}, M, { gates: [] }), null, NOW, APP), P.screen(null, null, NOW, { mode: 'pair', camera: true }),
        P.screen(null, null, NOW, { mode: 'pair', camera: false, say: 'x' }), P.screen(null, null, NOW, { mode: 'off' }),
    ].join('');
    const classes = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
    for (const c of classes) {
        if (STATION.has(c)) continue;
        assert.match(css, new RegExp('\\.' + c + '(?![\\w-])'), '.' + c + ' has no rule in mobile.css');
    }
    assert.ok(css.includes('body.m{min-width:0'), 'station.css holds every page at 1000 px');
    assert.match(css, /@media \(min-width:601px\)\{/);
    assert.ok(css.includes('.vf video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}'));
    assert.ok(css.includes('.opt .own{'), 'the 自己寫 box is not hidden like the radios');
    assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{/);
    assert.doesNotMatch(css, /\.gest|\.mk|\.phone\{|\.cbar|\.shade|\.nt-|\.rm-|\.m-switch/, 'the mockup\'s frame and the desktop card stay out');
});

// The page in a context of its own: a document with #app, a fake fetch.
const SRC = read('mobile.js');
function boot(o) {
    const app = { innerHTML: '' };
    const calls = [];
    const store = Object.assign({}, o.store);
    const doc = {
        getElementById: (id) => (id === 'app' ? app : null), documentElement: {}, body: { insertAdjacentHTML() {} },
        addEventListener() {}, querySelector: () => null, visibilityState: 'visible',
    };
    const win = {
        document: doc, location: { hash: o.hash || '' },
        navigator: { language: 'zh-TW', userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36' },
        localStorage: { getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
        addEventListener() {}, setInterval() {}, setTimeout, URLSearchParams,
        fetch: (url, init) => { calls.push({ url, init: init || {} }); return o.fetch(url, init || {}); },
    };
    vm.runInNewContext(SRC, { window: win });
    return { app, calls, store, win };
}
const reply = (status, body) => Promise.resolve({
    status, ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body), text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
});
const settle = () => new Promise((r) => setTimeout(r, 30));

test('boot: an unpaired phone sees pair-scan, a paired one 待答, an unreachable station pair-error', async () => {
    const unpaired = boot({ fetch: () => reply(401, 'pair this phone first') });
    await settle();
    assert.equal(unpaired.calls[0].url, '/station/mobile.json');
    assert.match(unpaired.app.innerHTML, /data-block="pair-scan"/);
    assert.match(unpaired.app.innerHTML, /data-pair-form="1"/, 'no BarcodeDetector here: the typed code');
    const paired = boot({ fetch: () => reply(200, M) });
    await settle();
    assert.match(paired.app.innerHTML, /data-block="tab-gates"/);
    assert.equal(paired.store['station.m.host'], 'ymlab-pc');
    assert.equal(paired.win.FK_M.parseRoute('#/done').tab, 'done');
    const away = boot({ store: { 'station.m.host': 'ymlab-pc' }, fetch: () => Promise.reject(new Error('offline')) });
    await settle();
    assert.match(away.app.innerHTML, /data-block="pair-error"/);
    assert.match(away.app.innerHTML, /連不到 ymlab-pc/);
});

test('boot: a pairing url opened on an unpaired phone pairs with its code, then shows 待答', async () => {
    let reads = 0;
    const page = boot({
        hash: '#/pair/ABCD2345',
        fetch: (url) => {
            if (url === '/station/remote/pair') return reply(201, { device: { id: '0123456789abcdef', name: 'Android' } });
            reads += 1;
            return reads === 1 ? reply(401, 'pair this phone first') : reply(200, M);
        },
    });
    await settle();
    const pair = page.calls.find((c) => c.url === '/station/remote/pair');
    assert.ok(pair, 'no pairing POST');
    assert.equal(pair.init.method, 'POST');
    assert.equal(pair.init.headers['content-type'], 'application/x-www-form-urlencoded');
    assert.equal(pair.init.body, 'code=ABCD2345&name=Android');
    assert.equal(page.win.location.hash, '#/gates');
    assert.match(page.app.innerHTML, /data-block="tab-gates"/);
});

// The service worker against fake caches and a fetch that can go offline.
function worker(fetchImpl) {
    const on = {};
    const cache = new Map();
    const deleted = [];
    const caches = {
        open: () => Promise.resolve({
            addAll: (files) => { files.forEach((f) => cache.set(f, 'cached ' + f)); return Promise.resolve(); },
            put: (k, v) => { cache.set(k, v); return Promise.resolve(); },
        }),
        keys: () => Promise.resolve(['fankeel-m-0', 'fankeel-m-1', 'someone-else']),
        delete: (k) => { deleted.push(k); return Promise.resolve(true); },
        match: (k) => Promise.resolve(cache.get(k)),
    };
    const self = { addEventListener: (type, fn) => { on[type] = fn; }, skipWaiting: () => Promise.resolve(), clients: { claim: () => Promise.resolve() }, location: { origin: ORIGIN } };
    vm.runInNewContext(read('sw.js'), { self, caches, fetch: fetchImpl, URL, Response: { error: () => 'network error' } });
    return { on, cache, deleted };
}
const ORIGIN = 'https://ymlab-pc.tail1234.ts.net';
const event = (url, method) => {
    const e = { request: { method: method || 'GET', url }, p: undefined, respondWith(p) { e.p = p; } };
    return e;
};

test('sw.js caches the shell at install, serves it network-first, and leaves everything else alone', async () => {
    const live = { ok: true, clone() { return 'copy'; } };
    let up = true;
    const w = worker(() => (up ? Promise.resolve(live) : Promise.reject(new Error('offline'))));
    let waited;
    w.on.install({ waitUntil: (p) => { waited = p; } });
    await waited;
    assert.deepEqual([...w.cache.keys()].sort(), ['/m', '/m/icon.svg', '/m/manifest.webmanifest', '/station/mobile.css', '/station/mobile.js', '/station/station.css']);
    w.on.activate({ waitUntil: (p) => { waited = p; } });
    await waited;
    assert.deepEqual(w.deleted, ['fankeel-m-0'], 'an older cache of its own goes; this one and others stay');
    const fresh = event(ORIGIN + '/m');
    w.on.fetch(fresh);
    assert.equal(await fresh.p, live, 'network first');
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(w.cache.get('/m'), 'copy', 'and the copy kept');
    up = false;
    const offline = event(ORIGIN + '/station/mobile.js');
    w.on.fetch(offline);
    assert.equal(await offline.p, 'cached /station/mobile.js', 'the cached shell when the station cannot be reached');
    for (const e of [event(ORIGIN + '/station/mobile.json'), event(ORIGIN + '/station/talk/x'), event(ORIGIN + '/answer', 'POST'), event('https://ntfy.sh/m')]) {
        w.on.fetch(e);
        assert.equal(e.p, undefined, e.request.url + ' was intercepted');
    }
});
```

2. Run it and watch it fail (`Cannot find module '../assets/station/mobile.js'`):

```
node --test tests/station-mobile-page.test.js
```

3. Write the page. Create `assets/station/mobile.js` — ES5 like every station module (`var`, `function`, no arrows), its own strings, the drawing functions pure and exported, `boot` only on a page with `#app`:

In `assets/station/mobile.js`, the whole file:

```js
'use strict';
// assets/station/mobile.js — the phone station, /m
// (docs/90-agent/plans/2026-10-21-station-remote-design.md §4; the approved
// mockup's blocks tabbar, tab-gates, gate-sheet, tab-tasks, tab-done,
// pair-scan, pair-error, gates-empty). Reads /station/mobile.json
// (lib/mobile.js) every five seconds while the page is visible and no gate
// sheet is open; answers a held gate through POST /answer and pairs through
// POST /station/remote/pair, both on the device cookie, which the browser
// sends itself. Carries its own strings — station.js's loc() table is not on
// this page. The drawing functions are pure and exported for the tests;
// `boot` runs only on a page with #app.
(function (w) {
    var STR = {
        zh: {
            'tab.gates': '待答', 'tab.tasks': '任務', 'tab.done': '完成', 'tab.nav': '分頁',
            'gates.waiting': '{n} 個在等', 'gates.empty': '沒有在等你的 gate', 'gates.emptyHint': '有新的會推播通知你。',
            'gate.word': 'gate', 'gate.waited': '等了 {t}', 'gate.report': '看 {stage} 報告', 'gate.pick': '選一個答案', 'gate.pickMany': '可以選幾個',
            'gate.own': '自己寫答案…', 'gate.rec': '建議', 'gate.send': '送出答案', 'gate.sending': '送出中…', 'gate.needAll': '每一題都要有答案',
            'gate.failed': '沒送到：可以再按一次', 'gate.gone': '這個 gate 已經不在等了', 'gate.more': '還有 {n} 題',
            'tasks.empty': '沒有在跑的任務', 'tasks.route': 'route {route}，現在 {stage}', 'tasks.gate': '待答',
            'done.empty': '48 小時內沒有完成的', 'done.end': '任務結束', 'done.stage': '完成 ·', 'done.today': '今天', 'done.yesterday': '昨天', 'done.upTo': '到 {t}',
            'ago.now': '剛剛', 'ago.min': '{n} 分', 'ago.hour': '{n} 小時', 'ago.day': '{n} 天',
            'host.on': '已連上 {host}', 'host.station': '測站',
            'pair.title': '掃桌機測站上的 QR', 'pair.where': '在 <b>設定</b> › <b>手機遠端</b>', 'pair.frame': '相機取景框', 'pair.type': '輸入配對碼',
            'pair.code': '8 位配對碼', 'pair.go': '配對', 'pair.busy': '配對中…', 'pair.failed': '連不到測站：再試一次',
            'off.title': '連不到 {host}', 'off.hint': '打開手機的 Tailscale 再試。', 'off.badge': 'Tailscale 未連線', 'off.retry': '重試', 'off.repair': '重新配對',
        },
        en: {
            'tab.gates': 'Gates', 'tab.tasks': 'Tasks', 'tab.done': 'Done', 'tab.nav': 'Tabs',
            'gates.waiting': '{n} waiting', 'gates.empty': 'No gate is waiting on you', 'gates.emptyHint': 'A new one will notify you.',
            'gate.word': 'gate', 'gate.waited': 'waiting {t}', 'gate.report': 'Read the {stage} report', 'gate.pick': 'Pick one answer', 'gate.pickMany': 'Pick any number',
            'gate.own': 'Write your own answer…', 'gate.rec': 'Recommended', 'gate.send': 'Send answer', 'gate.sending': 'Sending…', 'gate.needAll': 'Every question needs an answer',
            'gate.failed': 'Not sent: press again', 'gate.gone': 'This gate is no longer waiting', 'gate.more': '{n} more',
            'tasks.empty': 'No task is running', 'tasks.route': 'route {route}, now {stage}', 'tasks.gate': 'Gate',
            'done.empty': 'Nothing finished in the last 48 hours', 'done.end': 'Task ended', 'done.stage': 'done ·', 'done.today': 'Today', 'done.yesterday': 'Yesterday', 'done.upTo': 'up to {t}',
            'ago.now': 'now', 'ago.min': '{n} min', 'ago.hour': '{n} h', 'ago.day': '{n} d',
            'host.on': 'Connected to {host}', 'host.station': 'the station',
            'pair.title': 'Scan the QR on the desktop station', 'pair.where': 'Under <b>Settings</b> › <b>Phone remote</b>', 'pair.frame': 'Camera viewfinder', 'pair.type': 'Type the pairing code',
            'pair.code': '8-character code', 'pair.go': 'Pair', 'pair.busy': 'Pairing…', 'pair.failed': 'Could not reach the station: try again',
            'off.title': 'Cannot reach {host}', 'off.hint': 'Turn on Tailscale on this phone and try again.', 'off.badge': 'Tailscale not connected', 'off.retry': 'Retry', 'off.repair': 'Pair again',
        },
    };
    var lang = 'zh';
    var POLL_MS = 5000;
    var WAIT_MS = 3 * 60e3;
    var STAGES = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
    // A label ending in (Recommended) or (建議) is picked before anything is touched.
    var REC = /\s*\((?:Recommended|建議)\)\s*$/;
    // The mockup's icons: Lucide (ISC) on 24, the station's own set on 16.
    var SPRITE = '<svg width="0" height="0" style="position:absolute" aria-hidden="true">'
        + '<symbol id="i-gate" viewBox="0 0 16 16"><path d="M8 1.8 13.5 4v4c0 3-2.4 5.3-5.5 6.2C4.9 13.3 2.5 11 2.5 8V4z"/><path d="M8 5.2v3.3M8 10.8v.01"/></symbol>'
        + '<symbol id="i-now" viewBox="0 0 16 16"><circle cx="8" cy="8" r="1.5"/><path d="M5.2 5.2a4 4 0 0 0 0 5.6M10.8 5.2a4 4 0 0 1 0 5.6M3 3a7 7 0 0 0 0 10M13 3a7 7 0 0 1 0 10"/></symbol>'
        + '<symbol id="i-check" viewBox="0 0 16 16"><path d="M3.5 8.5 6.5 11.5 12.5 5"/></symbol>'
        + '<symbol id="i-chev" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></symbol>'
        + '<symbol id="i-cc" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></symbol>'
        + '<symbol id="i-wifioff" viewBox="0 0 24 24"><path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/></symbol>'
        + '<symbol id="i-refresh" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></symbol>'
        + '<symbol id="i-kbd" viewBox="0 0 24 24"><path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/></symbol>'
        + '<symbol id="i-pencil" viewBox="0 0 24 24"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></symbol>'
        + '<symbol id="i-doc" viewBox="0 0 24 24"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></symbol>'
        + '</svg>';
    // The masthead's glyph, as pair-scan's lock-up draws it.
    var GLYPH = '<svg class="glyph" viewBox="0 0 120 120" aria-hidden="true">'
        + '<path class="gseg done" d="M56.50 107.98L20.20 87.02L36.65 77.52L56.50 88.98Z"/><path class="gseg done" d="M16.70 80.96L16.70 39.04L33.15 48.54L33.15 71.46Z"/>'
        + '<path class="gseg done" d="M20.20 32.98L56.50 12.02L56.50 31.02L36.65 42.48Z"/><path class="gseg done" d="M63.50 12.02L99.80 32.98L83.35 42.48L63.50 31.02Z"/>'
        + '<path class="gseg done" d="M103.30 39.04L103.30 80.96L86.85 71.46L86.85 48.54Z"/><path class="gseg done" d="M99.80 87.02L63.50 107.98L63.50 88.98L83.35 77.52Z"/>'
        + '<path class="gedge done" d="M60.00 10.00L103.30 35.00L103.30 85.00L60.00 110.00L16.70 85.00L16.70 35.00Z" stroke-width="8"/>'
        + '<path class="gcore" d="M60.00 39.00L78.19 49.50L78.19 70.50L60.00 81.00L41.81 70.50L41.81 49.50Z"/></svg>';

    function setLang(l) { lang = l === 'en' ? 'en' : 'zh'; return lang; }
    // A string of this page's own; `vars` are put in as given, so a caller
    // escapes any it took from the registry.
    function t(key, vars) {
        var s = STR[lang][key];
        if (s === undefined) s = STR.zh[key];
        return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] !== undefined ? String(vars[k]) : m; });
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function num(v) { return typeof v === 'number' && isFinite(v); }
    function stVar(stage) { return STAGES.indexOf(stage) >= 0 ? 'var(--st-' + stage + ')' : 'var(--st-none)'; }
    function stw(stage) { return '<span class="hm-stw" style="--c:' + stVar(stage) + '">' + esc(stage) + '</span>'; }
    function ic(name, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
    function ago(ms) {
        var m = Math.max(0, Math.floor(ms / 60e3));
        if (m < 1) return t('ago.now');
        if (m < 60) return t('ago.min', { n: m });
        if (m < 1440) return t('ago.hour', { n: Math.floor(m / 60) });
        return t('ago.day', { n: Math.floor(m / 1440) });
    }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function hm(at) { var d = new Date(at); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
    function dayOf(at) { var d = new Date(at); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
    function usd(v) { return num(v) ? '$' + v.toFixed(2) : '—'; }

    // #/gates (the default), #/tasks, #/done; #/gate/<id> opens that gate's
    // sheet, #/task/<id> finds that task — the two a notification's tap opens —
    // and #/pair/<code> is the pairing url the desktop's QR carries.
    function parseRoute(hash) {
        var h = String(hash || '').replace(/^#/, '');
        var none = { tab: 'gates', open: null, focus: null, pair: null };
        var m = /^\/pair\/([A-Za-z0-9]{8})$/.exec(h);
        if (m) return { tab: 'gates', open: null, focus: null, pair: m[1].toUpperCase() };
        m = /^\/gate\/([0-9A-Za-z-]+)$/.exec(h);
        if (m) return { tab: 'gates', open: m[1], focus: null, pair: null };
        m = /^\/task\/([0-9A-Za-z-]+)$/.exec(h);
        if (m) return { tab: 'tasks', open: null, focus: m[1], pair: null };
        if (h === '/tasks' || h === '/done') return { tab: h.slice(1), open: null, focus: null, pair: null };
        return none;
    }

    // A code off the pairing url a QR carries, or eight characters typed.
    function codeIn(text) {
        var s = String(text == null ? '' : text);
        var m = /#\/pair\/([A-Za-z0-9]{8})(?![A-Za-z0-9])/.exec(s) || /^\s*([A-Za-z0-9]{8})\s*$/.exec(s);
        return m ? m[1].toUpperCase() : null;
    }

    // pgAnswers' rule (assets/station/station.js): a single choice is the
    // typed text, else the label picked; a multi-select is the labels and the
    // text, joined ', '. Null while any question has no answer.
    function answersOf(questions, picks, others) {
        var qs = questions || [];
        var answers = {};
        var missing = 0;
        qs.forEach(function (q, i) {
            var labels = ((picks || {})[i] || []).filter(function (l) { return l !== '__other'; });
            var text = String((others || {})[i] || '').trim();
            var a = q.multiSelect ? labels.concat(text ? [text] : []).join(', ') : (text || labels[0] || '');
            if (a) answers[q.question] = a;
            else missing++;
        });
        return missing || !qs.length ? null : answers;
    }

    // The sheet's inputs: every ticked value per question (`q<n>`), and a
    // 自己寫 box's text only where that question's __other is ticked.
    function collect(inputs, count) {
        var picks = {};
        var others = {};
        var ticked = {};
        var i;
        for (i = 0; i < count; i++) picks[i] = [];
        Array.prototype.forEach.call(inputs || [], function (el) {
            var q = /^q(\d+)$/.exec(el.name || '');
            if (!q || !el.checked) return;
            (picks[q[1]] = picks[q[1]] || []).push(el.value);
            if (el.value === '__other') ticked[q[1]] = true;
        });
        Array.prototype.forEach.call(inputs || [], function (el) {
            var own = el.getAttribute ? el.getAttribute('data-own') : null;
            if (own !== null && own !== undefined && ticked[own]) others[own] = el.value;
        });
        return { picks: picks, others: others };
    }

    function appBar(tab, M) {
        var n = tab === 'gates' ? (M.gates || []).length : tab === 'tasks' ? (M.tasks || []).length : 0;
        return '<div class="ab"><h1>' + t('tab.' + tab) + '</h1>' + (n ? '<span class="n">' + n + '</span>' : '')
            + '<span class="sp"></span><span class="host" aria-label="' + esc(t('host.on', { host: M.host || '' })) + '"><i class="dot live"></i>'
            + esc(M.host || t('host.station')) + '</span></div>';
    }

    function tabbar(tab, n) {
        function one(key, icon) {
            return '<a class="tb" href="#/' + key + '"' + (tab === key ? ' aria-current="page"' : '') + '><span class="ind">' + ic(icon) + '</span>' + t('tab.' + key)
                + (key === 'gates' && n > 0 ? '<span class="bdg" aria-label="' + esc(t('gates.waiting', { n: n })) + '">' + n + '</span>' : '') + '</a>';
        }
        return '<nav class="tabbar" data-block="tabbar" aria-label="' + t('tab.nav') + '">' + one('gates', 'gate') + one('tasks', 'now') + one('done', 'check') + '</nav>';
    }

    function gateRow(g, now) {
        var qs = g.questions || [];
        var waited = now - (num(g.since) ? g.since : now);
        return '<a class="row" href="#/gate/' + esc(g.id) + '" data-gate="' + esc(g.id) + '">'
            + '<div class="r-l"><div class="r-meta">' + stw(g.stage) + '<span>' + t('gate.word') + '</span><span>·</span><span class="pj">' + esc(g.project) + '</span></div>'
            + '<p class="r-t">' + esc(g.task) + '</p>'
            + '<p class="r-q">' + esc((qs[0] && qs[0].question) || '') + (qs.length > 1 ? ' · ' + t('gate.more', { n: qs.length - 1 }) : '') + '</p></div>'
            + '<div class="r-side"><span class="ago' + (waited >= WAIT_MS ? ' wait' : '') + '">' + esc(ago(waited)) + '</span>' + ic('chev', 'g24') + '</div></a>';
    }

    function gatesHtml(M, now) {
        var gates = M.gates || [];
        if (!gates.length) {
            return '<div class="body" data-block="gates-empty"><div class="empty"><span class="off">' + ic('check') + '</span>'
                + '<h2>' + t('gates.empty') + '</h2><p>' + t('gates.emptyHint') + '</p></div></div>';
        }
        return '<div class="body" data-block="tab-gates"><div class="grp">' + gates.map(function (g) { return gateRow(g, now); }).join('') + '</div></div>';
    }

    function optionHtml(q, qi, o, on) {
        var label = String((o && o.label) || '');
        var shown = label.replace(REC, '');
        return '<label class="opt"><input type="' + (q.multiSelect ? 'checkbox' : 'radio') + '" name="q' + qi + '" value="' + esc(label) + '"' + (on ? ' checked' : '') + '>'
            + '<span class="rd" aria-hidden="true"></span><span class="opt-l">' + esc(shown) + (shown !== label ? '<span class="gq-rec">' + t('gate.rec') + '</span>' : '') + '</span>'
            + (o && o.description ? '<span class="opt-d">' + esc(o.description) + '</span>' : '') + '</label>';
    }

    // The gate as a bottom sheet: every question, the recommended option
    // picked unless `ui.picks` says otherwise, a 自己寫答案 box per question,
    // and the report the gate is about.
    function sheetHtml(g, now, ui) {
        var picks = (ui && ui.picks) || {};
        var others = (ui && ui.others) || {};
        var body = (g.questions || []).map(function (q, qi) {
            var opts = Array.isArray(q.options) ? q.options : [];
            var held = picks[qi];
            return '<h2 class="sh-q" id="shq' + qi + '">' + esc(q.question || '') + '</h2>'
                + (qi === 0 ? '<a class="sh-rep" href="/f/' + esc(g.id) + '/gate">' + ic('doc', 'g24') + t('gate.report', { stage: esc(g.stage) }) + '<span class="sp"></span>' + ic('chev', 'g24') + '</a>' : '')
                + '<fieldset class="opts"><legend hidden>' + t(q.multiSelect ? 'gate.pickMany' : 'gate.pick') + '</legend>'
                + opts.map(function (o) {
                    var l = String((o && o.label) || '');
                    return optionHtml(q, qi, o, held ? held.indexOf(l) >= 0 : REC.test(l));
                }).join('')
                + '<label class="opt other"><input type="' + (q.multiSelect ? 'checkbox' : 'radio') + '" name="q' + qi + '" value="__other"' + (held && held.indexOf('__other') >= 0 ? ' checked' : '') + '>'
                + ic('pencil', 'g24') + '<input class="own" type="text" data-own="' + qi + '" value="' + esc(others[qi] || '') + '" placeholder="' + t('gate.own') + '" aria-label="' + t('gate.own') + '"></label>'
                + '</fieldset>';
        }).join('');
        return '<div class="dim" data-close="1" aria-hidden="true"></div>'
            + '<form class="sheet" id="gate-sheet" data-block="gate-sheet" data-id="' + esc(g.id) + '" role="dialog" aria-modal="true" aria-labelledby="shq0">'
            + '<span class="grab" data-close="1" aria-hidden="true"></span><div class="sh-b">'
            + '<div class="sh-m">' + stw(g.stage) + '<span>' + t('gate.word') + ' · <span class="pj">' + esc(g.project) + '</span> · '
            + t('gate.waited', { t: esc(ago(now - (num(g.since) ? g.since : now))) }) + '</span></div>'
            + '<p class="sh-task">' + esc(g.task) + '</p>' + body + '</div>'
            + '<div class="sh-f"><p class="sh-say" role="status"></p><button type="submit" class="cta">' + t('gate.send') + '</button></div></form>';
    }

    function routeHtml(route, stage) {
        var at = route.indexOf(stage);
        var dots = route.map(function (s, i) {
            if (i === at) return '<i class="now" style="--c:' + stVar(s) + ';background:var(--c)"></i>';
            if (at >= 0 && i < at) return '<i style="background:' + stVar(s) + '"></i>';
            return '<i class="todo"></i>';
        }).join('');
        return '<span class="route" aria-label="' + esc(t('tasks.route', { route: route.join(' → '), stage: stage })) + '">' + dots + '</span>';
    }

    function tasksHtml(M, now, focus) {
        var tasks = M.tasks || [];
        if (!tasks.length) return '<div class="body" data-block="tab-tasks"><div class="empty"><h2>' + t('tasks.empty') + '</h2></div></div>';
        return '<div class="body" data-block="tab-tasks"><div class="grp">' + tasks.map(function (s) {
            return '<a class="row" href="/f/' + esc(s.id) + '/' + esc(s.stage || 'gate') + '"' + (focus === s.id ? ' data-focus="1"' : '') + '>'
                + '<div class="r-l"><div class="r-meta"><span class="pj">' + esc(s.project) + '</span></div><p class="r-t">' + esc(s.task) + '</p>'
                + '<div class="r-st">' + routeHtml(s.route || [], s.stage) + stw(s.stage)
                + (s.gate ? '<span class="pill gate">' + ic('gate') + t('tasks.gate') + '</span>' : '') + '</div></div>'
                + '<div class="r-side"><span class="ago">' + esc(ago(now - (num(s.updated) ? s.updated : now))) + '</span>' + ic('chev', 'g24') + '</div></a>';
        }).join('') + '</div></div>';
    }

    function doneRow(x) {
        var meta = x.kind === 'end'
            ? '<span class="end">' + ic('cc', 'g24') + t('done.end') + '</span><span>·</span>'
            : stw(x.stage) + '<span>' + t('done.stage') + '</span>';
        return '<a class="row' + (x.kind === 'end' ? ' fin' : '') + '" href="/f/' + esc(x.id) + '/' + esc(x.stage || 'gate') + '">'
            + '<div class="r-l"><div class="r-meta">' + meta + '<span class="pj">' + esc(x.project) + '</span></div><p class="r-t">' + esc(x.task) + '</p></div>'
            + '<div class="r-side"><span class="usd">' + usd(x.usd) + '</span><span class="ago">' + hm(x.at) + '</span></div></a>';
    }

    // Newest first as mobile.json sends it, under one heading per day.
    function doneHtml(M, now) {
        var done = M.done || [];
        if (!done.length) return '<div class="body" data-block="tab-done"><div class="empty"><h2>' + t('done.empty') + '</h2></div></div>';
        var today = dayOf(now);
        var yday = dayOf(now - 864e5);
        var out = '';
        var open = null;
        done.forEach(function (x) {
            var day = dayOf(x.at);
            if (day !== open) {
                var d = new Date(x.at);
                var head = day === today ? t('done.today') + '<span>' + t('done.upTo', { t: hm(now) }) + '</span>'
                    : day === yday ? t('done.yesterday') : (d.getMonth() + 1) + '/' + d.getDate();
                out += (open === null ? '' : '</div>') + '<div class="grp-h">' + head + '</div><div class="grp">';
                open = day;
            }
            out += doneRow(x);
        });
        return '<div class="body" data-block="tab-done">' + out + '</div></div>';
    }

    function pairHtml(ui) {
        var u = ui || {};
        var typed = u.manual || !u.camera;
        return '<div class="solo" data-block="pair-scan"><span class="lock">' + GLYPH + 'fankeel</span>'
            + (typed ? '' : '<div class="vf" role="img" aria-label="' + t('pair.frame') + '"><i></i><i></i><i></i><i></i><span class="scan"></span></div>')
            + '<h2>' + t('pair.title') + '</h2><p class="one path">' + t('pair.where') + '</p>'
            + (u.say ? '<p class="say" role="status">' + esc(u.say) + '</p>' : '')
            + '<span class="sp"></span>'
            + (typed
                ? '<form class="acts" data-pair-form="1"><input class="code" name="code" autocapitalize="characters" autocomplete="one-time-code" maxlength="8" placeholder="'
                    + t('pair.code') + '" aria-label="' + t('pair.code') + '"><button type="submit" class="cta">' + t('pair.go') + '</button></form>'
                : '<div class="acts"><button type="button" class="ghost" data-act="manual">' + ic('kbd', 'g24') + t('pair.type') + '</button></div>')
            + '</div>';
    }

    function offHtml(host) {
        return '<div class="solo" data-block="pair-error"><span class="off">' + ic('wifioff', 'g24') + '</span>'
            + '<h2>' + t('off.title', { host: esc(host || t('host.station')) }) + '</h2><p class="one">' + t('off.hint') + '</p>'
            + '<span class="tsx"><i class="dot"></i>' + t('off.badge') + '</span><span class="sp"></span>'
            + '<div class="acts"><button type="button" class="cta" data-act="retry">' + ic('refresh', 'g24') + t('off.retry') + '</button>'
            + '<button type="button" class="ghost" data-act="repair">' + t('off.repair') + '</button></div></div>';
    }

    // What #app holds: pair-scan, pair-error, or the app bar, the tab's body,
    // the tab bar and — when the hash opens a gate still held — its sheet.
    function screen(M, R, now, ui) {
        var u = ui || {};
        if (u.mode === 'pair') return pairHtml(u);
        if (u.mode === 'off') return offHtml(u.host);
        var m = M || {};
        var r = R || parseRoute('');
        var at = num(now) ? now : Date.now();
        var gates = m.gates || [];
        var body = r.tab === 'tasks' ? tasksHtml(m, at, r.focus) : r.tab === 'done' ? doneHtml(m, at) : gatesHtml(m, at);
        var open = r.open ? gates.filter(function (g) { return g.id === r.open; })[0] : null;
        return appBar(r.tab, m) + body + tabbar(r.tab, gates.length) + (open ? sheetHtml(open, at, u) : '');
    }

    function pickLang(win) {
        var saved = null;
        try { saved = win.localStorage.getItem('station.lang'); } catch (e) { saved = null; }
        if (saved === 'zh' || saved === 'en') return saved;
        return /^zh/i.test(String((win.navigator && win.navigator.language) || '')) ? 'zh' : 'en';
    }

    // What the desktop card lists the phone as: the model Android names, or
    // the platform when Chrome's reduced user agent says only `K`.
    function deviceName(ua) {
        var s = String(ua || '');
        var m = /Android[^;)]*;\s*([^;)]+)/.exec(s);
        if (m && m[1].trim() !== 'K' && m[1].trim() !== 'wv') return m[1].trim().slice(0, 40);
        m = /iPhone|iPad|Android/.exec(s);
        return m ? m[0] : 'phone';
    }

    function boot(win) {
        var d = win.document;
        var app = d.getElementById('app');
        setLang(pickLang(win));
        if (d.documentElement) d.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';
        if (d.body && d.body.insertAdjacentHTML) d.body.insertAdjacentHTML('afterbegin', SPRITE);
        var camera = Boolean(win.BarcodeDetector && win.navigator && win.navigator.mediaDevices && win.navigator.mediaDevices.getUserMedia);
        var st = { M: null, ui: { mode: 'app' }, loading: false, tried: null, stream: null };
        function store(k, v) {
            try {
                if (v === undefined) return win.localStorage.getItem(k);
                win.localStorage.setItem(k, v);
            } catch (e) { /* private mode: nothing kept */ }
            return null;
        }
        function route() { return parseRoute(win.location.hash); }
        function post(url, fields) {
            return win.fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new win.URLSearchParams(fields).toString() });
        }
        function pairUi(extra) {
            var u = { mode: 'pair', camera: camera, manual: !camera, say: '' };
            for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) u[k] = extra[k];
            return u;
        }
        function stopScan() {
            if (!st.stream) return;
            st.stream.getTracks().forEach(function (k) { k.stop(); });
            st.stream = null;
        }
        // The camera in .vf, read by BarcodeDetector every 300 ms until a
        // pairing url turns up; refused or absent, the typed code instead.
        function scan() {
            var vf = d.querySelector ? d.querySelector('.vf') : null;
            if (!vf || st.stream || !st.ui.camera || st.ui.manual) return;
            win.navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (stream) {
                st.stream = stream;
                var v = d.createElement('video');
                v.setAttribute('playsinline', '');
                v.muted = true;
                v.srcObject = stream;
                vf.insertBefore(v, vf.firstChild);
                v.play();
                var det = new win.BarcodeDetector({ formats: ['qr_code'] });
                (function tick() {
                    if (!st.stream) return;
                    det.detect(v).then(function (codes) {
                        var hit = null;
                        (codes || []).forEach(function (c) { hit = hit || codeIn(c.rawValue); });
                        if (hit) { stopScan(); pairWith(hit); } else win.setTimeout(tick, 300);
                    }, function () { win.setTimeout(tick, 300); });
                }());
            }, function () { st.ui = pairUi({ camera: false, manual: true }); draw(); });
        }
        function draw() {
            stopScan();
            app.innerHTML = screen(st.M, route(), Date.now(), st.ui);
            if (st.ui.mode === 'pair') scan();
            var hot = d.querySelector ? d.querySelector('[data-focus]') : null;
            if (hot && hot.scrollIntoView) hot.scrollIntoView({ block: 'center' });
        }
        function pairWith(code) {
            st.ui = pairUi({ manual: true, say: t('pair.busy') });
            draw();
            post('/station/remote/pair', { code: code, name: deviceName(win.navigator && win.navigator.userAgent) }).then(function (r) {
                if (r.status === 201) {
                    st.ui = { mode: 'app' };
                    win.location.hash = '#/gates';
                    return load();
                }
                return r.text().then(function (text) { st.ui = pairUi({ manual: true, say: String(text || r.status).trim() }); draw(); });
            }, function () { st.ui = pairUi({ manual: true, say: t('pair.failed') }); draw(); });
        }
        // 401 is an unpaired phone; anything else that is not a 2xx, or no
        // answer at all, is a station this phone cannot reach.
        function load() {
            st.loading = true;
            return win.fetch('/station/mobile.json', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
                if (r.status === 401) {
                    var R = route();
                    if (R.pair && st.tried !== R.pair) { st.tried = R.pair; pairWith(R.pair); return; }
                    st.ui = pairUi({});
                    draw();
                    return;
                }
                if (!r.ok) throw new Error(String(r.status));
                return r.json().then(function (M) {
                    st.M = M;
                    st.ui = { mode: 'app' };
                    if (M && M.host) store('station.m.host', String(M.host));
                    draw();
                });
            }).catch(function () {
                st.ui = { mode: 'off', host: store('station.m.host') };
                draw();
            }).then(function () { st.loading = false; });
        }
        function gateOf(id) {
            return ((st.M && st.M.gates) || []).filter(function (g) { return g.id === id; })[0] || null;
        }
        // 送出答案: a refusal or a network error changes the sheet's one line
        // and nothing else, so what was picked stays picked.
        function answer(f) {
            var say = f.querySelector('.sh-say');
            var g = gateOf(f.getAttribute('data-id'));
            if (!g) { say.textContent = t('gate.gone'); return; }
            var got = collect(f.querySelectorAll('input'), (g.questions || []).length);
            var answers = answersOf(g.questions, got.picks, got.others);
            if (!answers) { say.textContent = t('gate.needAll'); return; }
            var btn = f.querySelector('.cta');
            btn.disabled = true;
            say.textContent = t('gate.sending');
            post('/answer', { root: g.root, id: g.id, answers: JSON.stringify(answers) }).then(function (r) {
                if (r.status === 201) { win.location.hash = '#/gates'; return load(); }
                return r.text().then(function (text) { btn.disabled = false; say.textContent = r.status + ' — ' + String(text).trim(); });
            }, function () { btn.disabled = false; say.textContent = t('gate.failed'); });
        }
        d.addEventListener('submit', function (e) {
            var f = e.target;
            if (!f || !f.getAttribute) return;
            if (f.id === 'gate-sheet') { e.preventDefault(); answer(f); return; }
            if (f.getAttribute('data-pair-form') !== null) {
                e.preventDefault();
                var input = f.querySelector('input');
                var code = codeIn(input ? input.value : '');
                if (code) pairWith(code);
                else { st.ui = pairUi({ manual: true, say: t('pair.code') }); draw(); }
            }
        });
        d.addEventListener('click', function (e) {
            var el = e.target && e.target.closest ? e.target.closest('[data-act],[data-close]') : null;
            if (!el) return;
            if (el.getAttribute('data-close') !== null) { win.location.hash = '#/gates'; return; }
            var act = el.getAttribute('data-act');
            if (act === 'manual') { st.ui = pairUi({ manual: true }); draw(); }
            else if (act === 'retry') load();
            else if (act === 'repair') { st.ui = pairUi({}); draw(); }
        });
        // Typing in a 自己寫 box ticks its own radio or checkbox.
        function own(e) {
            var el = e.target;
            if (!el || !el.getAttribute || el.getAttribute('data-own') === null) return;
            var box = el.closest ? el.closest('label') : null;
            var pick = box ? box.querySelector('input[value="__other"]') : null;
            if (pick) pick.checked = true;
        }
        d.addEventListener('input', own);
        d.addEventListener('focusin', own);
        d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && route().open) win.location.hash = '#/gates'; });
        d.addEventListener('visibilitychange', function () { if (d.visibilityState === 'visible' && st.ui.mode === 'app') load(); });
        win.addEventListener('hashchange', function () { draw(); if (route().open && !gateOf(route().open)) load(); });
        win.setInterval(function () {
            if (!st.loading && d.visibilityState === 'visible' && st.ui.mode === 'app' && !route().open) load();
        }, POLL_MS);
        if (win.navigator && win.navigator.serviceWorker) win.navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () { /* the page works without it */ });
        load();
    }

    var api = {
        parseRoute: parseRoute, screen: screen, answersOf: answersOf, collect: collect, codeIn: codeIn, setLang: setLang, deviceName: deviceName,
        gatesHtml: gatesHtml, sheetHtml: sheetHtml, tasksHtml: tasksHtml, doneHtml: doneHtml, pairHtml: pairHtml, offHtml: offHtml, tabbar: tabbar, STR: STR,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_M = api;
    if (w && w.document && w.document.getElementById && w.document.getElementById('app')) boot(w);
}(typeof window !== 'undefined' ? window : null));
```

4. Write the stylesheet. Create `assets/station/mobile.css` — the mockup's rules copied as they are (its lines 12 without `--r-dev`, 25-26, 30-31, 44-85 without `.gest`, 88-127, 129-135, 137-163, and the phone half of 221-224), then what a real page needs that a drawn phone frame did not:

In `assets/station/mobile.css`, the whole file:

```css
/* assets/station/mobile.css — the phone station, /m
   (docs/90-agent/plans/2026-10-21-station-remote-design.md §4). The approved
   mockup's rules, loaded over station.css as the mockup was: the keel tokens,
   .route, .hm-stw, .dot, .pill.gate, .gq-rec and .glyph come from there.
   Radius scale stays --r-sm / --r / --r-pill; --r-sheet is a bottom sheet's
   top edge (2 x --r). */
:root{--r-sheet:20px;--on-signal:#18202c;--scrim:rgba(11,15,21,.52)}

/* ---- icons: Lucide (ISC) on 24, the station's own set on 16 ---- */
.ic{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.ic.g24{stroke-width:2.1}

/* ---- the screen ---- */
.scr{position:relative;height:100%;display:flex;flex-direction:column;color:var(--ink);font-size:15px;line-height:1.45;
  background:var(--ground) radial-gradient(circle,var(--dot) 1.2px,transparent 1.7px) 11px 11px/22px 22px}

/* app bar: one big title, the machine you are on */
.ab{flex:none;display:flex;align-items:center;gap:10px;padding:10px 16px 14px 20px;min-height:64px}
.ab h1{font-size:27px;font-weight:700;letter-spacing:-.02em;line-height:1.15}
.ab .n{font:700 15px var(--f-mono);color:var(--muted);margin-left:2px}
.ab .sp{flex:1}
.host{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:0 4px 0 12px;font-size:13px;color:var(--ink2);background:none;border:0}
.host .dot{width:8px;height:8px}

.body{flex:1;min-height:0;overflow:hidden;padding:0 12px 96px}
.grp{background:var(--panel);border-radius:var(--r);box-shadow:inset 0 0 0 1px var(--rule)}
.grp-h{display:flex;align-items:baseline;gap:8px;margin:6px 8px 8px;font-size:13px;font-weight:700;color:var(--ink2)}
.grp-h span{font-weight:400;color:var(--muted)}
.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;align-items:center;padding:14px 12px 14px 16px;min-height:76px;
  border-top:1px solid var(--rule);text-decoration:none;color:inherit;-webkit-tap-highlight-color:transparent}
.grp>.row:first-child{border-top:0}
.row:active{background:var(--wash)}
.row:focus-visible{outline-offset:-2px;border-radius:var(--r)}
.r-meta{display:flex;align-items:center;gap:8px;min-width:0;font-size:12.5px;color:var(--muted);white-space:nowrap}
.r-meta .pj{font:12.5px var(--f-mono);overflow:hidden;text-overflow:ellipsis}
.r-t{margin:0;font-size:16px;font-weight:600;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.r-q{margin:0;font-size:14px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.r-l{display:grid;gap:3px;min-width:0}
.r-side{display:grid;justify-items:end;gap:4px;align-self:stretch;align-content:center}
.r-side .ic{color:var(--faint);width:20px;height:20px}
.ago{font:12.5px var(--f-mono);color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.ago.wait{color:var(--signal-ink);font-weight:600}
.scr .hm-stw{font-size:13px}
.scr .route{gap:4px}
.scr .route i{width:9px;height:9px}
.r-st{display:flex;align-items:center;gap:10px;margin-top:3px}
.scr .pill.gate{font-size:12px;padding:3px 10px}

/* bottom tab bar: three places, thumbs-first */
.tabbar{position:absolute;left:0;right:0;bottom:0;z-index:2;display:grid;grid-template-columns:repeat(3,1fr);padding:6px 8px 22px;
  background:var(--panel);box-shadow:0 -1px 0 var(--rule)}
.tb{position:relative;display:grid;justify-items:center;gap:3px;min-height:56px;padding:6px 0 2px;text-decoration:none;color:var(--muted);font-size:12.5px;font-weight:600;border-radius:var(--r)}
.tb .ind{display:grid;place-items:center;width:60px;height:32px;border-radius:var(--r-pill);transition:background-color .2s cubic-bezier(.16,1,.3,1)}
.tb .ic{width:22px;height:22px}
.tb[aria-current=page]{color:var(--ink)}
.tb[aria-current=page] .ind{background:var(--keel-tint);color:var(--keel-deep)}
.tb .bdg{position:absolute;top:2px;left:calc(50% + 10px);min-width:20px;height:20px;padding:0 6px;border-radius:var(--r-pill);
  background:var(--stale);color:var(--on-signal);font:700 12px/20px var(--f-mono);text-align:center;box-shadow:0 0 0 2px var(--panel)}

/* ---- gate sheet: the one bold place ---- */
.dim{position:absolute;inset:0;z-index:4;background:var(--scrim)}
.sheet{position:absolute;left:0;right:0;bottom:0;z-index:5;display:flex;flex-direction:column;max-height:calc(100% - 52px);
  background:var(--panel);border-radius:var(--r-sheet) var(--r-sheet) 0 0;box-shadow:0 -12px 32px -8px rgba(11,15,21,.45);
  animation:sh-in .32s cubic-bezier(.16,1,.3,1) both}
@keyframes sh-in{from{transform:translateY(32px)}to{transform:none}}
.grab{display:block;width:40px;height:4px;margin:10px auto 6px;border-radius:var(--r-pill);background:var(--rule2)}
.sh-b{flex:1;min-height:0;overflow:hidden;padding:4px 16px 0}
.sh-m{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)}
.sh-m .pj{font-family:var(--f-mono)}
.sh-task{margin:6px 0 0;font-size:13.5px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sh-q{margin:6px 0 4px;font-size:23px;font-weight:700;line-height:1.3;letter-spacing:-.015em;text-wrap:balance}
.sh-rep{display:flex;align-items:center;gap:8px;min-height:44px;margin:0 -4px 6px;padding:0 4px;color:var(--keel-deep);font-size:14px;font-weight:600;text-decoration:none;border-radius:var(--r-sm)}
.sh-rep .ic{width:18px;height:18px}
.sh-rep .sp{flex:1}
.opts{display:grid;gap:10px;margin:0;padding:0;border:0}
.opt{position:relative;display:grid;grid-template-columns:24px minmax(0,1fr);gap:2px 12px;align-items:start;min-height:72px;padding:14px 16px 14px 14px;
  border-radius:var(--r);background:var(--panel);box-shadow:inset 0 0 0 1px var(--rule2);cursor:pointer;
  transition:box-shadow .18s cubic-bezier(.16,1,.3,1),background-color .18s cubic-bezier(.16,1,.3,1)}
.opt input{position:absolute;opacity:0;pointer-events:none}
.opt .rd{grid-row:1/3;width:22px;height:22px;margin-top:1px;border-radius:50%;box-shadow:inset 0 0 0 2px var(--rule2);display:grid;place-items:center}
.opt .rd::after{content:"";width:10px;height:10px;border-radius:50%;background:var(--on-keel);transform:scale(0);transition:transform .18s cubic-bezier(.16,1,.3,1)}
.opt-l{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;font-size:16.5px;font-weight:700;line-height:1.35}
.opt-d{font-size:14px;line-height:1.45;color:var(--ink2)}
.opt:has(input:checked){background:var(--keel-tint);box-shadow:inset 0 0 0 2px var(--keel)}
.opt:has(input:checked) .rd{background:var(--keel);box-shadow:none}
.opt:has(input:checked) .rd::after{transform:scale(1)}
.opt:has(input:focus-visible){outline:2px solid var(--keel);outline-offset:2px}
.opt.other{min-height:56px;align-items:center;grid-template-columns:24px minmax(0,1fr)}
.opt.other .ic{width:20px;height:20px;color:var(--muted);justify-self:center}
.opt.other span{font-size:15px;color:var(--muted)}
.sheet .gq-rec{font-size:12px;padding:2px 9px}
.sh-f{flex:none;padding:12px 16px 30px;background:var(--panel);box-shadow:0 -1px 0 var(--rule)}
.cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:54px;border:0;border-radius:var(--r);
  background:var(--keel);color:var(--on-keel);font:700 17px var(--f-ui);cursor:pointer}
.cta:active{background:var(--keel-deep)}
.cta:focus-visible{outline:2px solid var(--keel);outline-offset:3px}
.ghost{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:50px;border:0;border-radius:var(--r);
  background:transparent;color:var(--ink);font:600 15.5px var(--f-ui);box-shadow:inset 0 0 0 1px var(--rule2);cursor:pointer}
.ghost .ic{width:18px;height:18px}

/* ---- 完成 ---- */
.dn-sum{display:flex;align-items:baseline;gap:6px;margin:0 8px 10px;font-size:13px;color:var(--muted)}
.dn-sum b{font:700 13px var(--f-mono);color:var(--ink2)}
.end{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:700;color:var(--good)}
.end .ic{width:16px;height:16px;stroke-width:2}
.usd{font:700 15px var(--f-mono);font-variant-numeric:tabular-nums;color:var(--ink)}
.row.fin .r-t{font-weight:700}

/* ---- 配對 / 連不到 ---- */
.solo{flex:1;display:flex;flex-direction:column;align-items:center;padding:28px 24px 34px;text-align:center}
.lock{display:flex;align-items:center;gap:10px;font-size:22px;font-weight:700;letter-spacing:-.03em}
.lock .glyph{width:30px;height:30px}
.vf{position:relative;width:264px;height:264px;margin:40px 0 28px;border-radius:var(--r);overflow:hidden;
  background:var(--term) radial-gradient(circle at 50% 45%,rgba(201,209,220,.10),transparent 70%)}
.vf i{position:absolute;width:40px;height:40px;border:4px solid var(--keel);}
.vf i:nth-child(1){top:18px;left:18px;border-right:0;border-bottom:0;border-top-left-radius:var(--r-sm)}
.vf i:nth-child(2){top:18px;right:18px;border-left:0;border-bottom:0;border-top-right-radius:var(--r-sm)}
.vf i:nth-child(3){bottom:18px;left:18px;border-right:0;border-top:0;border-bottom-left-radius:var(--r-sm)}
.vf i:nth-child(4){bottom:18px;right:18px;border-left:0;border-top:0;border-bottom-right-radius:var(--r-sm)}
.vf .scan{position:absolute;left:30px;right:30px;top:30px;height:2px;border-radius:2px;background:var(--keel);opacity:.8;animation:scan 2.2s cubic-bezier(.45,0,.55,1) infinite alternate}
@keyframes scan{to{transform:translateY(200px)}}
.solo h2{margin:0;font-size:21px;font-weight:700;letter-spacing:-.01em}
.solo .one{margin:8px 0 0;font-size:15px;color:var(--ink2)}
.solo .sp{flex:1}
.solo .acts{display:grid;gap:10px;width:100%}
.solo .path{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center}
.solo .path b{font-weight:600;color:var(--ink)}
.off{display:grid;place-items:center;width:88px;height:88px;margin:96px 0 24px;border-radius:50%;background:var(--inset);color:var(--muted)}
.off .ic{width:40px;height:40px;stroke-width:1.8}
.solo .tsx{display:inline-flex;align-items:center;gap:7px;margin-top:16px;padding:4px 12px;border-radius:var(--r-pill);background:var(--fail-tint);color:var(--fail-ink);font-size:13px;font-weight:600}
.solo .tsx .dot{background:var(--bad)}
.empty{display:grid;justify-items:center;gap:6px;padding:120px 24px 0;text-align:center}
.empty .off{margin:0 0 14px;color:var(--good);background:var(--pass-tint)}
.empty h2{font-size:19px;font-weight:700;color:var(--ink)}
.empty p{margin:0;font-size:14.5px;color:var(--ink2)}

/* ---- the real page: the window is the phone. station.css holds every
   page at 1000 px and the mockup drew a 360 x 780 frame; here the screen is
   the viewport, full-bleed under 600 px and a centred 480 px column above. ---- */
html,body.m{margin:0;height:100%}
body.m{min-width:0;background:var(--ground);overscroll-behavior-y:contain}
body.m .scr{height:100dvh}
body.m .ab{padding-top:calc(10px + env(safe-area-inset-top))}
body.m .body{overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:calc(96px + env(safe-area-inset-bottom))}
body.m .tabbar,body.m .sheet,body.m .dim{position:fixed}
body.m .tabbar{padding-bottom:calc(10px + env(safe-area-inset-bottom))}
body.m .sheet{max-height:calc(100dvh - 52px)}
body.m .sh-b{overflow-y:auto}
body.m .sh-f{padding-bottom:calc(16px + env(safe-area-inset-bottom))}
body.m .solo{padding-top:calc(28px + env(safe-area-inset-top));padding-bottom:calc(34px + env(safe-area-inset-bottom))}
@media (min-width:601px){
  body.m .scr{max-width:480px;margin:0 auto;box-shadow:0 0 0 1px var(--rule)}
  body.m .tabbar,body.m .sheet{left:50%;right:auto;width:480px;margin-left:-240px}
}
/* The camera behind the viewfinder's corners. */
.vf video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
/* The 自己寫答案 box is a text input inside its option: not hidden like the radios. */
.opt .own{position:static;opacity:1;pointer-events:auto;min-width:0;width:100%;height:28px;padding:0;border:0;background:transparent;color:var(--ink);font:400 15px var(--f-ui);outline:none}
.opt .own::placeholder{color:var(--muted)}
/* The task a notification's tap opened. */
.row[data-focus]{background:var(--keel-tint)}
.scr .pill.gate .ic{width:13px;height:13px}
.cta .ic{width:18px;height:18px}
/* The sheet's one line: sending, refused, or not sent. */
.sh-say{margin:0 0 10px;font-size:13.5px;color:var(--fail-ink)}
.sh-say:empty{display:none}
.solo .say{margin:16px 0 0;font-size:14px;color:var(--fail-ink)}
.solo .code{box-sizing:border-box;width:100%;height:54px;padding:0 16px;border:0;border-radius:var(--r);background:var(--inset);color:var(--ink);
  font:700 22px var(--f-mono);letter-spacing:.18em;text-align:center;text-transform:uppercase;box-shadow:inset 0 0 0 1px var(--rule2)}
.solo .code:focus-visible{outline:2px solid var(--keel);outline-offset:2px}

@media (prefers-reduced-motion:reduce){
  .sheet,.vf .scan{animation:none}
  .opt,.opt .rd::after,.tb .ind{transition:none}
}
```

5. Write the service worker. Create `assets/station/sw.js` — served at `/sw.js` so its scope is the whole origin; it caches the shell's six files and nothing else, network first, so an installed phone that cannot reach the station still draws pair-error:

In `assets/station/sw.js`, the whole file:

```js
'use strict';
// assets/station/sw.js — the phone station's service worker, served at /sw.js
// (docs/90-agent/plans/2026-10-21-station-remote-design.md §4). It caches the
// shell only — the page, its script, its two stylesheets, the manifest and the
// icon — and serves those network first, the cached copy when the station
// cannot be reached, so an installed phone draws pair-error rather than the
// browser's own error page. Nothing else is intercepted: /station/mobile.json,
// every POST, and every other route go to the network as they would without it.
var CACHE = 'fankeel-m-1';
var FILES = ['/m', '/station/mobile.js', '/station/mobile.css', '/station/station.css', '/m/manifest.webmanifest', '/m/icon.svg'];

self.addEventListener('install', function (e) {
    e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

// An older cache of this worker's goes; anything not named fankeel-m- is not its own.
self.addEventListener('activate', function (e) {
    e.waitUntil(caches.keys().then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE && k.indexOf('fankeel-m-') === 0; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
    var req = e.request;
    if (req.method !== 'GET') return;
    var u = new URL(req.url);
    if (u.origin !== self.location.origin || FILES.indexOf(u.pathname) < 0) return;
    e.respondWith(fetch(req).then(function (res) {
        if (res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { return c.put(u.pathname, copy); });
        }
        return res;
    }).catch(function () {
        return caches.match(u.pathname).then(function (hit) { return hit || Response.error(); });
    }));
});
```

6. Run it and watch it pass:

```
node --test tests/station-mobile-page.test.js
```

7. Commit:

```
git add assets/station/mobile.js assets/station/mobile.css assets/station/sw.js tests/station-mobile-page.test.js
git commit -m "feat: the phone station page, its stylesheet and service worker" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


## Task 9: the 手機遠端 card — `assets/station/remote-card.js` and its styles

**Files:**
- Modify: `assets/station/remote-card.js` — new: a station module, `FK_REMOTE.html(serve)`, `FK_REMOTE.view(state, now)`, its own `EN` table, the held `/station/remote` answer, and the delegated `change`/`click` listeners on `document` that post the card's actions
- Modify: `assets/station/station.css:2540-2568` — the card's rules appended at the end of the file: the mockup's lines 187-219 without `.mk-desk` and the faux `.qr .fp`/`.qr .mid` rules, plus `.qr img`, `.rm-code`, `.rm-devs`, `.rm-none`, `.rm-topic`, `.rm-say` and reduced motion for `.m-switch`
- Read: `assets/station/spend-panel.js` — the module pattern: an IIFE over `window`, its own `EN` table and `loc()`, `module.exports = api` when `module` exists and `window.FK_*` when `window` does
- Read: `.fankeel/build/2026-10-21-station-mobile/mockup.html` — blocks `remote-on` and `remote-off` (lines 515-531) and the card's CSS (lines 185-219); the mockup's `<use href="#i-…">` sprite is not on the desktop page, so the card inlines its three Lucide icons
- Read: `tests/station-module.js` — `stringsLeft(name, EN)`, the check every station module's strings pass
- Read: `tests/station-keel.test.js` — line 34 keeps every `.mk-` rule off station.css, which is why `.mk-desk` is not copied
- Test: `tests/station-remote-card.test.js`

**Interfaces:**
- Consumes: `/station/remote` (GET, loopback only) → `{on: boolean, active: boolean, url: string|null, dnsName: string|null, warning: string|null, code: string (8 characters, when active), until: number, pairUrl: string, devices: [{id, name, paired, seen}], notify: {server, topic, gate, stage, end}}`; POST `/profile` (form `nonce`, `scope=machine`, `key`, `value`; answers 303 to `/`, which `fetch` follows); POST `/station/remote/code` (form `nonce`; 201); POST `/station/remote/revoke` (form `nonce`, `id`; 200 or 404); GET `/station/remote/qr.svg`; the keys `station.remote`, `notify.gate`, `notify.stage`, `notify.end`, written as `'true'`/`'false'` through `/profile`; `window.STATION.nonce`; `window.FK_I18N.lang`
- Produces: `FK_REMOTE.html` (serve: boolean) → string — `''` when not served; the held card when an answer is held; otherwise a placeholder `<section … id="rm-card" data-block="remote-off">` with a loading line, and one GET of the card's state route that repaints `#rm-card`'s `outerHTML` when it answers; `FK_REMOTE.view` (state, now: ms) → string — the `<section class="dcard rm…" id="rm-card" data-block="remote-on|remote-off">` for one answer of that route (`state.error` for one that failed, `state.said` for a refused action's reason); `FK_REMOTE.EN` (the English table). The controls carry `data-rm`: `switch`, `copy` (with `data-url`), `code`, `revoke` (with `data-id`), `trigger` (with `data-key`).

**Dispatch:** implementer, opus, high

1. Write the failing test. Create `tests/station-remote-card.test.js`:

In `tests/station-remote-card.test.js`, the whole file:

```js
'use strict';
// The 手機遠端 card (assets/station/remote-card.js;
// docs/90-agent/plans/2026-10-21-station-remote-design.md §3; mockup blocks
// remote-on, remote-off): what it draws for each answer GET /station/remote
// gives, that it asks once and holds the answer across the page's redraws,
// what each control posts, and that every string has English and every class
// a rule in station.css.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const R = require('../assets/station/remote-card.js');
const { stringsLeft } = require('./station-module.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const SRC = fs.readFileSync(path.join(ASSETS, 'remote-card.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ASSETS, 'station.css'), 'utf8');
const CJK = /[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;
const NAME = 'ymlab-pc.tail1234.ts.net';
const NOW = Date.parse('2026-10-21T09:00:00.000Z');
const QUIET = { server: 'https://ntfy.sh', gate: false, stage: false, end: false };
const ACTIVE = { on: true, active: true, url: 'https://' + NAME + '/', dnsName: NAME, warning: null, code: 'ABCD2345', until: NOW + 600e3,
    pairUrl: 'https://' + NAME + '/m#/pair/ABCD2345',
    devices: [{ id: '0011223344556677', name: 'Galaxy S24', paired: NOW - 86400e3, seen: NOW - 120e3 },
        { id: '8899aabbccddeeff', name: '<b>tab</b>', paired: NOW - 7200e3, seen: NOW - 3 * 3600e3 }],
    notify: { server: 'https://ntfy.sh', topic: 'fankeel-00112233445566778899', gate: true, stage: false, end: true } };
const OFF = { on: false, active: false, url: null, dnsName: null, warning: null, devices: [], notify: QUIET };
const STUCK = { on: true, active: false, url: null, dnsName: null, warning: 'tailscale is Stopped, not Running', devices: [], notify: QUIET };

// The card as the page loads it: a window with the nonce (and FK_I18N when a
// language is given), a document holding only #rm-card and the listeners, and
// a fetch that logs each call and answers from `answers`
// ('<METHOD> <url>' → {status, json, text}); a GET answers `state` by default.
function boot(opts) {
    const o = opts || {};
    const listeners = {};
    const card = { outerHTML: '' };
    const calls = [];
    const copied = [];
    const answers = o.answers || {};
    const fetch = (url, init) => {
        const method = (init && init.method) || 'GET';
        calls.push({ method, url, body: init && init.body ? new URLSearchParams(String(init.body)) : null });
        const a = answers[method + ' ' + url] || (method === 'GET' ? { status: 200, json: o.state || ACTIVE } : { status: 200, text: '' });
        return Promise.resolve({ ok: a.status < 400, status: a.status, json: () => Promise.resolve(a.json), text: () => Promise.resolve(a.text || '') });
    };
    const win = { STATION: { serve: true, nonce: 'N0NCE' }, navigator: { clipboard: { writeText: (t) => { copied.push(t); return Promise.resolve(); } } } };
    if (o.lang) win.FK_I18N = { lang: o.lang };
    const doc = { getElementById: (id) => (id === 'rm-card' ? card : null), addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); } };
    const box = { window: win, document: doc, fetch, URLSearchParams, module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    const fire = (type, ctl) => (listeners[type] || []).forEach((fn) => fn({ target: { closest: (sel) => (sel === '#rm-card [data-rm]' ? ctl : null) } }));
    return { R: box.module.exports, card, calls, copied, fire };
}
const settle = () => new Promise((r) => setTimeout(r, 0));
const ctl = (attrs, checked) => ({ checked: Boolean(checked), textContent: '', getAttribute: (k) => (k in attrs ? attrs[k] : null) });

test('off: the switch unchecked and only this computer, nothing else', () => {
    const h = R.view(OFF, NOW);
    assert.match(h, /^<section class="dcard rm rm-off" id="rm-card" data-block="remote-off">/);
    assert.match(h, /<i class="dot down"><\/i>只在這台電腦看得到（127\.0\.0\.1）/);
    assert.match(h, /data-rm="switch" aria-label="手機遠端">/);
    for (const no of ['rm-url', 'rm-pair', 'data-rm="trigger"', 'data-rm="revoke"']) assert.ok(!h.includes(no), no);
});

test('on while Tailscale is not serving the station: the warning and the triggers, no url or QR', () => {
    const h = R.view(STUCK, NOW);
    assert.match(h, /^<section class="dcard rm" id="rm-card" data-block="remote-on">/);
    assert.match(h, /data-rm="switch" checked aria-label=/);
    assert.ok(h.includes('<i class="dot stale"></i>Tailscale 沒有替測站開門：tailscale is Stopped, not Running'));
    assert.equal((h.match(/data-rm="trigger"/g) || []).length, 3);
    assert.ok(h.includes('打開任一個就會產生 topic'));
    for (const no of ['rm-url', 'rm-pair', 'data-rm="revoke"']) assert.ok(!h.includes(no), no);
});

test('active: the url with 複製, the QR of the live code typed out, each phone with 解除, the triggers as set', () => {
    const h = R.view(ACTIVE, NOW);
    assert.ok(h.includes('<i class="dot live"></i>Tailscale 已連上 <span class="mono">ymlab-pc</span>'));
    assert.ok(h.includes('<code>https://' + NAME + '/</code><button type="button" class="btn" data-rm="copy" data-url="https://' + NAME + '/">'));
    assert.ok(h.includes('<img src="/station/remote/qr.svg?c=ABCD2345" alt="">'));
    assert.ok(h.includes('<code class="rm-code">ABCD2345</code>'));
    assert.match(h, /data-rm="code">[\s\S]*?換一個<\/button>/);
    assert.deepEqual([...h.matchAll(/data-rm="revoke" data-id="([^"]+)"/g)].map((m) => m[1]), ['0011223344556677', '8899aabbccddeeff']);
    assert.ok(h.includes('Galaxy S24 · 2 分鐘前'));
    assert.ok(h.includes('&lt;b&gt;tab&lt;/b&gt; · 3 小時前'));
    assert.ok(!h.includes('<b>tab</b>'), 'a device name reached the page unescaped');
    assert.match(h, /data-key="notify\.gate" checked>gate 待答/);
    assert.match(h, /data-key="notify\.stage">stage 完成/);
    assert.match(h, /data-key="notify\.end" checked>任務結束/);
    assert.ok(h.includes('訂閱 <code>https://ntfy.sh/fankeel-00112233445566778899</code>'));
});

test('no phone paired, an answer that failed, and a refused action each say so', () => {
    assert.ok(R.view(Object.assign({}, ACTIVE, { devices: [] }), NOW).includes('<span class="rm-none">還沒有配對的手機</span>'));
    const e = R.view({ error: '403' }, NOW);
    assert.match(e, /data-block="remote-off"/);
    assert.ok(e.includes('讀不到手機遠端的狀態：403'));
    assert.ok(R.view(Object.assign({}, OFF, { said: '409 — <x>' }), NOW).includes('<p class="rm-say">409 — &lt;x&gt;</p>'));
});

test('html: nothing on a file; served, one GET held across redraws and painted into #rm-card', async () => {
    assert.equal(R.html(false), '');
    const b = boot();
    const first = b.R.html(true);
    assert.match(first, /^<section class="dcard rm rm-off" id="rm-card" data-block="remote-off">/);
    assert.ok(first.includes('讀取手機遠端的狀態…'));
    assert.match(first, /data-rm="switch" disabled/);
    b.R.html(true);
    assert.deepEqual(b.calls.map((c) => c.method + ' ' + c.url), ['GET /station/remote'], 'asked once while the first answer is on its way');
    await settle();
    assert.match(b.card.outerHTML, /data-block="remote-on"/);
    assert.ok(b.card.outerHTML.includes('ABCD2345'));
    assert.match(b.R.html(true), /data-block="remote-on"/);
    assert.equal(b.calls.length, 1, 'a redraw draws the held answer and does not ask again');
});

test('each control posts with the nonce, then reads the state again', async () => {
    const b = boot();
    b.R.html(true);
    await settle();
    b.fire('change', null);
    b.fire('click', null);
    b.fire('change', ctl({ 'data-rm': 'switch' }, false));
    await settle();
    b.fire('change', ctl({ 'data-rm': 'trigger', 'data-key': 'notify.stage' }, true));
    await settle();
    b.fire('click', ctl({ 'data-rm': 'code' }));
    await settle();
    b.fire('click', ctl({ 'data-rm': 'revoke', 'data-id': '8899aabbccddeeff' }));
    await settle();
    b.fire('click', ctl({ 'data-rm': 'switch' }, true));
    await settle();
    const posts = b.calls.filter((c) => c.method === 'POST').map((c) => [c.url, Object.fromEntries(c.body)]);
    assert.deepEqual(posts, [
        ['/profile', { nonce: 'N0NCE', scope: 'machine', key: 'station.remote', value: 'false' }],
        ['/profile', { nonce: 'N0NCE', scope: 'machine', key: 'notify.stage', value: 'true' }],
        ['/station/remote/code', { nonce: 'N0NCE' }],
        ['/station/remote/revoke', { nonce: 'N0NCE', id: '8899aabbccddeeff' }],
    ], 'a click on the switch is its change event\'s business, not the click\'s');
    assert.deepEqual(b.calls.map((c) => c.method), ['GET', 'POST', 'GET', 'POST', 'GET', 'POST', 'GET', 'POST', 'GET']);
});

test('a refused post shows the server\'s reason on the card', async () => {
    const b = boot({ answers: { 'POST /station/remote/code': { status: 409, text: 'remote is off\n' } } });
    b.R.html(true);
    await settle();
    b.fire('click', ctl({ 'data-rm': 'code' }));
    await settle();
    assert.ok(b.card.outerHTML.includes('<p class="rm-say">409 — remote is off</p>'));
});

test('複製 puts the url on the clipboard and says so, posting nothing', async () => {
    const b = boot();
    const c = ctl({ 'data-rm': 'copy', 'data-url': 'https://' + NAME + '/' });
    b.fire('click', c);
    await settle();
    assert.deepEqual(b.copied, ['https://' + NAME + '/']);
    assert.equal(c.textContent, '已複製');
    assert.equal(b.calls.length, 0);
});

test('in English the card carries no CJK, and every string has English', () => {
    const b = boot({ lang: 'en' });
    for (const s of [ACTIVE, OFF, STUCK, { error: '403' }, Object.assign({}, ACTIVE, { devices: [] })]) {
        const h = b.R.view(s, NOW);
        assert.ok(!CJK.test(h), h);
    }
    assert.ok(!CJK.test(b.R.html(true)));
    assert.deepEqual(stringsLeft('remote-card.js', R.EN), []);
});

test('every class the card draws has a rule in station.css', () => {
    const names = new Set();
    for (const s of [ACTIVE, OFF, STUCK, Object.assign({}, ACTIVE, { devices: [], said: 'x' })]) {
        for (const m of R.view(s, NOW).matchAll(/class="([^"]+)"/g)) for (const c of m[1].split(/\s+/)) if (/^(?:rm|m-switch|qr)/.test(c)) names.add(c);
    }
    for (const c of ['rm', 'rm-off', 'rm-st', 'rm-url', 'rm-pair', 'qr', 'rm-code', 'rm-sub', 'rm-devs', 'rm-dev', 'rm-none', 'rm-trg', 'rm-topic', 'rm-say', 'm-switch']) {
        assert.ok(names.has(c), c + ' is not drawn');
    }
    for (const c of names) assert.match(CSS, new RegExp('\\.' + c + '(?![\\w-])'), c + ' has no rule');
    assert.ok(CSS.includes('.qr img{display:block;width:100%;height:100%}'));
    assert.ok(CSS.includes('@media (prefers-reduced-motion:reduce){.m-switch .tr,.m-switch .tr::after{transition:none}}'));
    assert.ok(!CSS.includes('.qr .fp') && !CSS.includes('.qr .mid'), 'the mockup\'s faux QR stays out');
});
```

2. Run it and watch it fail (`Cannot find module '../assets/station/remote-card.js'`):

```
node --test tests/station-remote-card.test.js
```

3. Write the module. Create `assets/station/remote-card.js` — every CJK string is the Chinese of a `loc('rm.<key>', …)` call on its own line, which is what `stringsLeft` reads:

In `assets/station/remote-card.js`, the whole file:

```js
'use strict';
// assets/station/remote-card.js — the 手機遠端 card under the wizard on
// #/settings (docs/90-agent/plans/2026-10-21-station-remote-design.md §3;
// mockup blocks remote-on, remote-off): the `station.remote` switch, the
// tailnet url with 複製, a QR of the live pairing code with the code typed
// out and 換一個, the paired phones with 解除, and the three ntfy triggers.
// Its state is GET /station/remote, which answers loopback only: asked once
// when the card is first drawn and again after each action, and held in
// between, so the page's redraw draws the held card rather than starting
// over. The icons are Lucide (ISC), as in the mockup, inlined because the
// mockup's sprite is not on this page. Loaded before station.js, whose
// settingsPage calls `html(serve)`.
(function (w, doc) {
    var EN = {
        'rm.title': 'Phone remote',
        'rm.on': 'On',
        'rm.off': 'Off',
        'rm.loading': 'Reading the remote state…',
        'rm.local': 'Only this computer can see it (127.0.0.1)',
        'rm.unread': 'Could not read the remote state: {why}',
        'rm.gone': 'serve did not answer',
        'rm.linked': 'Tailscale connected',
        'rm.notLinked': 'Tailscale is not serving the station: {why}',
        'rm.copy': 'Copy',
        'rm.copied': 'Copied',
        'rm.qr': 'Pairing QR',
        'rm.scan': 'Scan this QR with the phone',
        'rm.once': 'One-time, valid for 10 minutes.',
        'rm.newCode': 'New code',
        'rm.paired': 'Paired',
        'rm.none': 'No phone paired yet',
        'rm.revoke': 'Unpair',
        'rm.ntfy': 'ntfy push',
        'rm.gate': 'gate waiting',
        'rm.stage': 'stage done',
        'rm.end': 'task ended',
        'rm.subscribe': 'Subscribe to',
        'rm.noTopic': 'turning one on makes a topic',
        'rm.justNow': 'just now',
        'rm.minutes': '{n} min ago',
        'rm.hours': '{n} h ago',
        'rm.days': '{n} d ago',
        'rm.unsent': 'Not sent: is serve still running?',
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function fill(s, vars) {
        if (!vars) return s;
        return String(s).replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) ? String(vars[k]) : m; });
    }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return fill(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    var ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ENT[c]; }); }

    var PHONE = '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><path d="M12 18h.01"></path>';
    var COPY = '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>';
    var REFRESH = '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path>'
        + '<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path>';
    function ico(paths, size) {
        return '<svg class="ico" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" aria-hidden="true" fill="none" stroke="currentColor"'
            + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
    }

    function ago(at, now) {
        var s = Math.round((now - at) / 1000);
        if (!(s >= 60)) return loc('rm.justNow', '剛剛');
        if (s < 3600) return loc('rm.minutes', '{n} 分鐘前', { n: Math.floor(s / 60) });
        if (s < 86400) return loc('rm.hours', '{n} 小時前', { n: Math.floor(s / 3600) });
        return loc('rm.days', '{n} 天前', { n: Math.floor(s / 86400) });
    }

    // The header: the phone glyph, the title and the switch. `wait` is the
    // placeholder's, whose switch cannot be pressed before the state is known.
    function head(on, wait) {
        return '<div class="dcard-h">' + ico(PHONE, 16) + '<b>' + loc('rm.title', '手機遠端') + '</b><span class="sp"></span>'
            + '<label class="m-switch"><span>' + (on ? loc('rm.on', '開') : loc('rm.off', '關')) + '</span>'
            + '<input type="checkbox" data-rm="switch"' + (on ? ' checked' : '') + (wait ? ' disabled' : '')
            + ' aria-label="' + loc('rm.title', '手機遠端') + '"><span class="tr"></span></label></div>';
    }
    function card(block, inner) {
        return '<section class="dcard rm' + (block === 'remote-off' ? ' rm-off' : '') + '" id="rm-card" data-block="' + block + '">' + inner + '</section>';
    }
    function status(dot, text) {
        return '<div class="rm-st"><i class="dot ' + dot + '"></i>' + text + '</div>';
    }
    function pair(code) {
        return '<div class="rm-pair"><div class="qr" role="img" aria-label="' + loc('rm.qr', '配對 QR') + '">'
            + '<img src="/station/remote/qr.svg?c=' + encodeURIComponent(code) + '" alt=""></div>'
            + '<div><h3>' + loc('rm.scan', '用手機掃這個 QR') + '</h3>'
            + '<p>' + loc('rm.once', '一次性，10 分鐘內有效。') + '</p>'
            + '<code class="rm-code">' + esc(code) + '</code>'
            + '<button type="button" class="btn" data-rm="code">' + ico(REFRESH, 14) + loc('rm.newCode', '換一個') + '</button></div></div>';
    }
    function devices(list, now) {
        var rows = list.map(function (d) {
            return '<span class="rm-dev">' + ico(PHONE, 18) + '<span>' + esc(d.name) + ' · ' + ago(d.seen, now) + '</span>'
                + '<button type="button" class="btn" data-rm="revoke" data-id="' + esc(d.id) + '">' + loc('rm.revoke', '解除') + '</button></span>';
        }).join('');
        var none = '<span class="rm-none">' + loc('rm.none', '還沒有配對的手機') + '</span>';
        return '<div class="rm-sub"><b>' + loc('rm.paired', '已配對') + '</b><span class="rm-devs">' + (rows || none) + '</span></div>';
    }
    function triggers(n) {
        var label = {
            gate: loc('rm.gate', 'gate 待答'),
            stage: loc('rm.stage', 'stage 完成'),
            end: loc('rm.end', '任務結束'),
        };
        var boxes = ['gate', 'stage', 'end'].map(function (k) {
            return '<label><input type="checkbox" data-rm="trigger" data-key="notify.' + k + '"' + (n[k] === true ? ' checked' : '') + '>' + label[k] + '</label>';
        }).join('');
        var where = esc(String(n.server || '').replace(/\/+$/, '') + '/' + n.topic);
        var topic = n.topic
            ? loc('rm.subscribe', '訂閱') + ' <code>' + where + '</code>'
            : loc('rm.noTopic', '打開任一個就會產生 topic');
        return '<div class="rm-sub"><b>' + loc('rm.ntfy', 'ntfy 推播') + '</b><span class="rm-trg">' + boxes + '</span></div><p class="rm-topic">' + topic + '</p>';
    }

    // One /station/remote answer as the card. Off (or an answer that failed)
    // is the mockup's remote-off; on is remote-on, with the url, the QR and
    // the phones only while Tailscale is serving the station.
    function view(state, now) {
        var S = state || {};
        var said = S.said ? '<p class="rm-say">' + esc(S.said) + '</p>' : '';
        if (S.error) return card('remote-off', head(false) + status('down', loc('rm.unread', '讀不到手機遠端的狀態：{why}', { why: esc(S.error) })) + said);
        if (!S.on) return card('remote-off', head(false) + status('down', loc('rm.local', '只在這台電腦看得到（127.0.0.1）')) + said);
        var body = head(true);
        if (!S.active) {
            body += status('stale', loc('rm.notLinked', 'Tailscale 沒有替測站開門：{why}', { why: esc(S.warning || '') }));
        } else {
            body += status('live', loc('rm.linked', 'Tailscale 已連上') + ' <span class="mono">' + esc(String(S.dnsName || '').split('.')[0]) + '</span>')
                + '<div class="rm-url"><code>' + esc(S.url) + '</code><button type="button" class="btn" data-rm="copy" data-url="' + esc(S.url) + '">'
                + ico(COPY, 14) + loc('rm.copy', '複製') + '</button></div>';
            if (S.code) body += pair(S.code);
            body += devices(S.devices || [], now);
        }
        return card('remote-on', body + triggers(S.notify || {}) + said);
    }
    function waiting() {
        return card('remote-off', head(false, true) + status('down', loc('rm.loading', '讀取手機遠端的狀態…')));
    }

    var held = null;
    var asking = false;
    function paint() {
        var el = doc && doc.getElementById('rm-card');
        if (el) el.outerHTML = view(held, Date.now());
    }
    // `note` is the reason the last action was refused, shown once.
    function load(note) {
        if (typeof fetch !== 'function') return;
        asking = true;
        fetch('/station/remote', { cache: 'no-store' }).then(function (r) {
            return r.ok ? r.json() : { error: String(r.status) };
        }).catch(function () {
            return { error: loc('rm.gone', 'serve 沒有回應') };
        }).then(function (s) {
            asking = false;
            held = Object.assign({}, s);
            if (note) held.said = note;
            paint();
        });
    }
    function post(url, fields) {
        var body = new URLSearchParams();
        body.set('nonce', (w && w.STATION && w.STATION.nonce) || '');
        Object.keys(fields).forEach(function (k) { body.set(k, fields[k]); });
        return fetch(url, { method: 'POST', body: body }).then(function (r) {
            return r.ok ? '' : r.text().then(function (t) { return r.status + ' — ' + String(t).trim(); });
        }, function () {
            return loc('rm.unsent', '送不出去：serve 還在跑嗎？');
        }).then(load);
    }
    function html(serve) {
        if (!serve) return '';
        if (!held) {
            if (!asking) load();
            return waiting();
        }
        return view(held, Date.now());
    }

    // Delegated on the document, because station.js redraws the page and the
    // card with it; a checkbox's click is left to its change event.
    function controlOf(e) {
        var t = e && e.target;
        return t && t.closest ? t.closest('#rm-card [data-rm]') : null;
    }
    if (doc && doc.addEventListener) {
        doc.addEventListener('change', function (e) {
            var c = controlOf(e);
            if (!c) return;
            var kind = c.getAttribute('data-rm');
            var value = c.checked ? 'true' : 'false';
            if (kind === 'switch') post('/profile', { scope: 'machine', key: 'station.remote', value: value });
            else if (kind === 'trigger') post('/profile', { scope: 'machine', key: c.getAttribute('data-key'), value: value });
        });
        doc.addEventListener('click', function (e) {
            var c = controlOf(e);
            if (!c) return;
            var kind = c.getAttribute('data-rm');
            if (kind === 'code') post('/station/remote/code', {});
            else if (kind === 'revoke') post('/station/remote/revoke', { id: c.getAttribute('data-id') });
            else if (kind === 'copy' && w && w.navigator && w.navigator.clipboard) {
                w.navigator.clipboard.writeText(c.getAttribute('data-url')).then(function () {
                    c.textContent = loc('rm.copied', '已複製');
                }, function () {});
            }
        });
    }

    var api = { html: html, view: view, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_REMOTE = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
```

4. Add the styles. At the very end of `assets/station/station.css` (after line 2568, `#focus.fm-stale{opacity:.6}`), append — the mockup's lines 187-219 with `.mk-desk` and the faux `.qr .fp`/`.qr .mid` rules left out (`tests/station-keel.test.js:34` keeps every `.mk-` rule off this sheet), the mockup's `.rm-dev .ic` written for the station's `.ico`, and the rules the real card adds:

In `assets/station/station.css`, at the end of the file:

```css
/* ---- the 手機遠端 card on #/settings (assets/station/remote-card.js; mockup remote-on, remote-off) ---- */
.rm{box-shadow:var(--lift);margin-top:14px;max-width:560px}
.rm .dcard-h .sp{flex:1}
.m-switch{position:relative;display:inline-flex;align-items:center;gap:10px;font-size:13px;color:var(--ink2);cursor:pointer}
.m-switch input{position:absolute;opacity:0}
.m-switch .tr{position:relative;width:40px;height:24px;border-radius:var(--r-pill);background:var(--rule2);transition:background-color .2s cubic-bezier(.16,1,.3,1)}
.m-switch .tr::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:var(--panel);box-shadow:0 1px 2px rgba(11,15,21,.3);transition:transform .2s cubic-bezier(.16,1,.3,1)}
.m-switch input:checked+.tr{background:var(--keel)}
.m-switch input:checked+.tr::after{transform:translateX(16px)}
.m-switch input:focus-visible+.tr{outline:2px solid var(--keel);outline-offset:2px}
.m-switch input:disabled+.tr{opacity:.5}
.rm-st{display:flex;align-items:center;gap:8px;margin:14px 0 12px;font-size:13.5px}
.rm-st .mono{color:var(--ink2)}
.rm-url{display:flex;align-items:center;gap:8px;height:38px;padding:0 4px 0 12px;border-radius:var(--r-sm);background:var(--inset)}
.rm-url code{flex:1;min-width:0;font:12.5px var(--f-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;user-select:all}
.rm-url .btn{min-height:30px}
.rm-pair{display:grid;grid-template-columns:148px minmax(0,1fr);gap:18px;align-items:center;margin:16px 0 4px}
.qr{position:relative;width:148px;height:148px;padding:10px;border-radius:var(--r-sm);background:#fbfcfc;box-shadow:inset 0 0 0 1px var(--rule)}
.qr img{display:block;width:100%;height:100%}
.rm-pair h3{font-size:15px;font-weight:700}
.rm-pair p{margin:4px 0 10px;font-size:13px;color:var(--ink2)}
.rm-code{display:block;margin:0 0 10px;font:600 15px var(--f-mono);letter-spacing:.12em;color:var(--ink);user-select:all}
.rm-sub{display:flex;align-items:center;gap:10px;margin:14px -18px 0;padding:12px 18px 0;border-top:1px solid var(--rule);font-size:13px}
.rm-sub>b{font-weight:600;min-width:4.5em;color:var(--ink2)}
.rm-sub .sp{flex:1}
.rm-devs{display:grid;gap:6px;flex:1}
.rm-dev{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center}
.rm-dev .ico{width:18px;height:18px;color:var(--muted)}
.rm-none{color:var(--muted)}
.rm-trg{display:flex;flex-wrap:wrap;gap:6px}
.rm-trg label{display:inline-flex;align-items:center;gap:6px;min-height:30px;padding:0 10px;border-radius:var(--r-pill);box-shadow:inset 0 0 0 1px var(--rule2);font-size:12.5px;cursor:pointer}
.rm-trg input{accent-color:var(--keel);margin:0}
.rm-topic{margin:8px 0 0;font-size:12.5px;color:var(--ink2)}
.rm-topic code{font:12px var(--f-mono);user-select:all}
.rm-say{margin:10px 0 0;font-size:12.5px;color:var(--bad)}
.rm-off .rm-st{margin-bottom:0;color:var(--ink2)}
@media (prefers-reduced-motion:reduce){.m-switch .tr,.m-switch .tr::after{transition:none}}
```

5. Run it and watch it pass, with the keel sheet's own test beside it:

```
node --test tests/station-remote-card.test.js tests/station-keel.test.js
```

6. Commit:

```
git add assets/station/remote-card.js assets/station/station.css tests/station-remote-card.test.js
git commit -m "feat: the 手機遠端 card — remote switch, tailnet url, pairing QR, devices, ntfy triggers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 10: the phone's routes — `/m`, its manifest, icon and service worker, `/station/mobile.json`, and the new files in `STATIC`

**Files:**
- Modify: `scripts/station.js` — `const os = require('node:os')` and `const mobile = require('../lib/mobile.js')`; `STATIC` admits `mobile.js`, `remote-card.js` and `mobile.css`; through the tailnet `GET /` answers 303 to `/m`; `GET /m`, `/m/manifest.webmanifest`, `/m/icon.svg`, `/sw.js` and `/station/mobile.json`
- Modify: `docs/90-agent/reference/station.md:1336-1369` — the served-files paragraph (1336-1342) names the three new files, and a paragraph after it names the five phone routes (`tests/station-doc.test.js:30` needs each `url.pathname === '…'` on the page)
- Read: `lib/mobile.js` — `mobileModel(model, now, host, hidden)`, `shell()`, `manifest()`, `icon()`
- Read: `assets/station/mobile.js` — `parseRoute(hash)` and `screen(M, R, now, ui)`, which the test draws `/station/mobile.json` with; required in node, it exports its api and boots nothing
- Read: `assets/station/mobile.css` — served byte for byte
- Read: `assets/station/sw.js` — served byte for byte at `/sw.js`
- Read: `assets/station/remote-card.js` — served byte for byte
- Read: `lib/remote.js` — `newCode(configDir, now)` and `pair(configDir, code, name, now)`, which the test pairs a phone with directly; `policy`, which already lists the phone's open routes
- Read: `lib/station.js` — `hiddenPkeys(model)` (a Set of hidden pkeys)
- Read: `lib/profile.js` — `machineFile(configDir)` and `write(file, key, value)`, which turn `station.remote` on for the test
- Read: `lib/handoff.js` — `pendingPath(root, data, stage)`, where a held gate's questions sit
- Read: `tests/station-answer.test.js` — the fixture shape copied (a live session, roots.json, a pending gate)
- Read: `tests/tmp.js` — scratch directories
- Test: `tests/station-mobile-route.test.js`

**Interfaces:**
- Consumes: `mobile.mobileModel` (model, now, host: string, hidden: Set) → {host, at, gates: [{id, root, task, project, stage, route, questions, since, until}], tasks, done}; `mobile.shell` () → the `/m` html string; `mobile.manifest` () → the manifest as JSON text (served as is); `mobile.icon` () → the svg string; `FK_M.parseRoute` (hash) → a route; `FK_M.screen` (M, R, now, ui: {mode: 'app'}) → html, whose 待答 tab carries `<span class="bdg"…>N</span>` and each gate row an `href="#/gate/<id>"`; `remote.hostKind`, `remote.policy`, `remote.newCode`, `remote.pair`; `station.remote` (machine profile); `tailscale.enable`, reached through `opts.tailscaleRun`; `FK_REMOTE.html` (only that `assets/station/remote-card.js` exists, to be served); inside `serve()` after the remote server task: `tailnet` ({on, dnsName, url, warning}) and `kind` (this request's `remote.hostKind`), and its 401 for a tailnet request without a paired phone on a `'device'` route
- Produces: `STATIC` (the regex in `scripts/station.js`, now admitting `/station/mobile.js`, `/station/remote-card.js`, `/station/mobile.css`); `/m`; `/m/manifest.webmanifest`; `/m/icon.svg`; `/sw.js`; `/station/mobile.json` → `mobile.mobileModel(sharedModel(), Date.now(), host, station.hiddenPkeys(model))` as JSON, `host` the tailnet name's first label while the tailnet is on, `os.hostname()` otherwise

**Dispatch:** implementer, opus, high

1. Write the failing test. Create `tests/station-mobile-route.test.js`:

In `tests/station-mobile-route.test.js`, the whole file:

```js
'use strict';
// The phone's routes (docs/90-agent/plans/2026-10-21-station-remote-design.md
// §4): /m with its manifest, icon and service worker, /station/mobile.json,
// the phone page's files and the 手機遠端 card's module served from
// assets/station/, and `/` through the tailnet sent to /m. The tailnet is
// faked: a fake `tailscale` run, a Host of the tailnet name, and a phone
// paired straight through lib/remote.js against the station's configDir.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const profile = require('../lib/profile.js');
const remote = require('../lib/remote.js');
const mobile = require('../lib/mobile.js');
const { pendingPath } = require('../lib/handoff.js');
const { serve } = require('../scripts/station.js');
const M = require('../assets/station/mobile.js');
const tmp = require('./tmp.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const NAME = 'ymlab-pc.tail1234.ts.net';
const ONE = 'ffffffff-8888-4888-8888-888888888881';
const TWO = 'ffffffff-8888-4888-8888-888888888882';
const Q = [{ question: '核准這份 design？', header: 'design', multiSelect: false,
    options: [{ label: '核准，進 plan (Recommended)', description: 'a' }, { label: '暫停', description: 'b' }] }];

// Two live sessions in one registry, each with a gate hooks/gate.js is
// holding for the station, and `station.remote` on in the machine profile
// when `on`.
function fixture(on) {
    const base = tmp('fankeel-station-mobile-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    const held = (id, stage, started, at) => {
        const data = { task: '手機版測站 ' + stage, stage, route: ['survey', 'design', 'plan'], active: true, claims: [],
            started, updated: new Date().toISOString(), configDir: cfg };
        registry.writeSession(r1, id, data);
        const file = pendingPath(r1, data, stage);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ questions: Q, at, until: Date.now() + 300e3 }));
    };
    held(ONE, 'design', '2026-10-21T08:00:00.000Z', Date.now() - 60e3);
    held(TWO, 'survey', '2026-10-21T08:30:00.000Z', Date.now() - 30e3);
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: '2026-10-21T08:00:00.000Z' }) + '\n');
    if (on) assert.equal(profile.write(profile.machineFile(cfg), 'station.remote', 'true').ok, true);
    return { cfg, r1 };
}

// A fake tailscale CLI: Running with this machine's MagicDNS name, no serve
// config until `serve --bg <port>` makes one.
function fakeTailscale() {
    let proxy = null;
    return (args) => {
        const a = args.join(' ');
        if (a === 'status --json') return { status: 0, stdout: JSON.stringify({ BackendState: 'Running', Self: { DNSName: NAME + '.' } }), stderr: '' };
        if (a === 'serve status --json') return { status: 0, stdout: proxy ? JSON.stringify({ Web: { [NAME + ':443']: { Handlers: { '/': { Proxy: proxy } } } } }) : '{}', stderr: '' };
        const bg = /^serve --bg (\d+)$/.exec(a);
        if (bg) {
            proxy = 'http://127.0.0.1:' + bg[1];
            return { status: 0, stdout: '', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: 'unexpected: ' + a };
    };
}

// A GET to the station with the headers given; with none, node's own Host
// (127.0.0.1:<port>) is this machine's.
const get = (port, pathname, headers) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: pathname, method: 'GET', headers: headers || {} }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    req.end();
});

async function served(on, f) {
    const fx = fixture(on);
    const s = await serve({ configDir: fx.cfg, port: 0, idleMs: 60e3, open: false, tailscaleRun: fakeTailscale() });
    try {
        await f(Object.assign({ port: Number(new URL(s.url).port) }, fx));
    } finally {
        s.close();
    }
}
const TAILNET = { host: NAME };
// A phone paired the way POST /station/remote/pair pairs one, as its cookie.
function phone(cfg) {
    const now = Date.now();
    const got = remote.pair(cfg, remote.newCode(cfg, now).value, 'S24', now);
    assert.equal(got.ok, true);
    return { host: NAME, cookie: 'fk_device=' + got.token };
}
const file = (name) => fs.readFileSync(path.join(ASSETS, name), 'utf8');

test('through the tailnet `/` goes to /m; from this machine it is still the desktop page', () => served(true, async (s) => {
    const away = await get(s.port, '/', TAILNET);
    assert.equal(away.status, 303);
    assert.equal(away.headers.location, '/m');
    const home = await get(s.port, '/');
    assert.equal(home.status, 200);
    assert.ok(home.text.includes('station/station.js'));
}));

test('/m is lib/mobile.js\'s shell, open through the tailnet without a phone paired', () => served(true, async (s) => {
    const page = await get(s.port, '/m', TAILNET);
    assert.equal(page.status, 200);
    assert.match(page.headers['content-type'], /^text\/html/);
    assert.equal(page.text, mobile.shell());
    assert.ok(page.text.includes('/station/mobile.js'));
}));

test('the manifest, the icon and the service worker that make it installable', () => served(true, async (s) => {
    const man = await get(s.port, '/m/manifest.webmanifest', TAILNET);
    assert.equal(man.status, 200);
    assert.equal(man.headers['content-type'], 'application/manifest+json');
    assert.equal(man.text, mobile.manifest());
    assert.equal(JSON.parse(man.text).start_url, '/m');
    const icon = await get(s.port, '/m/icon.svg', TAILNET);
    assert.equal(icon.status, 200);
    assert.equal(icon.headers['content-type'], 'image/svg+xml');
    assert.equal(icon.text, mobile.icon());
    const sw = await get(s.port, '/sw.js', TAILNET);
    assert.equal(sw.status, 200);
    assert.match(sw.headers['content-type'], /^text\/javascript/);
    assert.equal(sw.headers['service-worker-allowed'], '/');
    assert.equal(sw.text, file('sw.js'));
}));

test('the phone page\'s files and the card\'s module are served byte for byte; the card\'s needs a phone through the tailnet', () => served(true, async (s) => {
    for (const [name, type] of [['mobile.js', /^text\/javascript/], ['mobile.css', /^text\/css/]]) {
        const res = await get(s.port, '/station/' + name, TAILNET);
        assert.equal(res.status, 200, name);
        assert.match(res.headers['content-type'], type, name);
        assert.equal(res.text, file(name), name);
    }
    const card = await get(s.port, '/station/remote-card.js');
    assert.equal(card.status, 200);
    assert.equal(card.text, file('remote-card.js'));
    assert.equal((await get(s.port, '/station/remote-card.js', TAILNET)).status, 401);
    assert.equal((await get(s.port, '/station/not-a-module.js')).status, 404, 'STATIC is still a list');
}));

test('/station/mobile.json needs a paired phone through the tailnet, and names the machine by its tailnet name', () => served(true, async (s) => {
    assert.equal((await get(s.port, '/station/mobile.json', TAILNET)).status, 401);
    const res = await get(s.port, '/station/mobile.json', phone(s.cfg));
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/json');
    assert.equal(res.headers['cache-control'], 'no-store');
    const body = JSON.parse(res.text);
    assert.equal(body.host, 'ymlab-pc');
    assert.deepEqual(body.gates.map((g) => g.id), [ONE, TWO], 'oldest first');
    assert.deepEqual(body.gates[0].questions, Q);
}));

test('with remote off, /station/mobile.json from this machine names it by its hostname', () => served(false, async (s) => {
    const res = await get(s.port, '/station/mobile.json');
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.text).host, os.hostname());
}));

test('the phone page\'s 待答 badge, its gate rows and /station/mobile.json\'s gates agree in number', () => served(true, async (s) => {
    const json = JSON.parse((await get(s.port, '/station/mobile.json', phone(s.cfg))).text);
    const html = M.screen(json, M.parseRoute('#/gates'), Date.now(), { mode: 'app' });
    const rows = (html.match(/href="#\/gate\/[^"]+"/g) || []).length;
    const badge = Number((/<span class="bdg"[^>]*>(\d+)<\/span>/.exec(html) || [])[1]);
    assert.equal(json.gates.length, 2);
    assert.equal(rows, json.gates.length);
    assert.equal(badge, json.gates.length);
}));
```

2. Run it and watch it fail (`/m` is a 404 and `/station/mobile.css` is not in `STATIC`):

```
node --test tests/station-mobile-route.test.js
```

3. Re-read `scripts/station.js` as it stands after the remote server task (its `remote` require, `tailnet`, and the `kind` it computes right after `redirect` is defined). Beside the requires that task added at the top (`const remote = require('../lib/remote.js');` and its neighbours), add:

In `scripts/station.js`, with the requires:

```js
const os = require('node:os');
const mobile = require('../lib/mobile.js');
```

4. Widen `STATIC`. In `scripts/station.js`, replace the comment and the regex at lines 59-63 (`// The files \`serve\` answers from ASSETS, by name: …` through `const STATIC = …;`) with:

In `scripts/station.js`, the `STATIC` list:

```js
// The files `serve` answers from ASSETS, by name: the page's own two, the
// language table, the four spend-*.js modules, the 手機遠端 card's
// remote-card.js, the phone page's mobile.js and mobile.css, and the tour
// (`tour.html` and what it loads). A list, so nothing else under the plugin
// directory is reachable by url.
const STATIC = /^\/station\/((?:station|i18n|mobile|remote-card|spend-[a-z]+)\.js|(?:station|mobile)\.css|tour(?:-[a-z]+)*\.(?:js|css|html))$/;
```

5. Send the tailnet's `/` to the phone. In `scripts/station.js`, in the handler, right before `if (req.method === 'GET' && url.pathname === '/') {`, add:

In `scripts/station.js`, before the `GET /` route:

```js
        // Through the tailnet `/` is the phone's page (design §4); this
        // machine's own browser keeps the desktop page there.
        if (kind === 'tailnet' && req.method === 'GET' && url.pathname === '/') return redirect('/m');
```

6. Add the phone's routes. In `scripts/station.js`, in the handler, right after the `GET /station/health` route and before `const file = req.method === 'GET' ? STATIC.exec(url.pathname) : null;`, add:

In `scripts/station.js`, after the `/station/health` route:

```js
        // The phone station (lib/mobile.js; assets/station/mobile.js). The
        // shell, the manifest and the icon are built, not files; the service
        // worker is assets/station/sw.js served from the root, so its scope
        // can be the whole origin.
        if (req.method === 'GET' && url.pathname === '/m') {
            return send(200, 'text/html; charset=utf-8', mobile.shell(), noStore);
        }
        if (req.method === 'GET' && url.pathname === '/m/manifest.webmanifest') {
            return send(200, 'application/manifest+json', mobile.manifest(), noStore);
        }
        if (req.method === 'GET' && url.pathname === '/m/icon.svg') {
            return send(200, 'image/svg+xml', mobile.icon(), noStore);
        }
        if (req.method === 'GET' && url.pathname === '/sw.js') {
            let body;
            try {
                body = fs.readFileSync(path.join(ASSETS, 'sw.js'), 'utf8');
            } catch (e) {
                return fail(404, 'no such asset');
            }
            return send(200, 'text/javascript; charset=utf-8', body, Object.assign({ 'service-worker-allowed': '/' }, noStore));
        }
        if (req.method === 'GET' && url.pathname === '/station/mobile.json') {
            // A few kilobytes the phone reads every 5 s — never station-data.js.
            // The machine is named by its tailnet name's first label while the
            // tailnet is on, by its hostname otherwise.
            const model = sharedModel();
            const host = (tailnet.on && tailnet.dnsName ? tailnet.dnsName.split('.')[0] : '') || os.hostname();
            return send(200, 'application/json', JSON.stringify(mobile.mobileModel(model, Date.now(), host, station.hiddenPkeys(model))), noStore);
        }
```

7. Name them on the reference page. In `docs/90-agent/reference/station.md`, replace the served-files paragraph — the one that opens "serve answers a fixed list of files" and ends "reachable by url." (station.md:1336-1342) — with these two paragraphs:

In `docs/90-agent/reference/station.md`, the served-files paragraph and the one after it:

```md
`serve` answers a fixed list of files from `assets/station/` — `STATIC` in
`scripts/station.js`: `station.js`, `station.css`, `i18n.js`, the four spend modules
`spend-talk.js`, `spend-kinds.js`, `spend-range.js` and `spend-panel.js`, the
手機遠端 card's `remote-card.js`, the phone page's `mobile.js` and `mobile.css`,
`tour.html`, `tour.css`, `tour.js` and every `tour-<name>.js` (any number of hyphenated
segments, so `tour-reel-kit.js` and the like are served too). Any other name
under `/station/` is a 404, so nothing else in the plugin directory is
reachable by url.

The phone station has five routes of its own. `/m` is its page, the shell
`lib/mobile.js` builds (`shell()`), which loads `station.css`, `mobile.css` and
`mobile.js`; `/m/manifest.webmanifest` (`manifest()`, served as
`application/manifest+json`) and `/m/icon.svg` (`icon()`) make it installable;
`/sw.js` is `assets/station/sw.js`, served from the root with
`service-worker-allowed: /` so it can cache the shell; and
`/station/mobile.json` is the page's data, `mobileModel(model, now, host,
hidden)`: the held gates oldest first, the live tasks, and the stages finished
and tasks ended in the last 48 hours — a few kilobytes, read every 5 s while
the page is visible, never `station-data.js`. `host` is the first label of the
tailnet name while the tailnet is on, `os.hostname()` otherwise. Through the
tailnet `/` answers 303 to `/m`, and `/m`, its manifest, its icon, `/sw.js`,
`station.css`, `mobile.css` and `mobile.js` need no paired phone, while
`/station/mobile.json` answers 401 without one (`remote.policy` in
`lib/remote.js`); from this machine `/` is still the desktop page.
```

8. Run the new test and the reference page's test, and watch them pass:

```
node --test tests/station-mobile-route.test.js tests/station-doc.test.js
```

9. Commit:

```
git add scripts/station.js docs/90-agent/reference/station.md tests/station-mobile-route.test.js
git commit -m "feat: the phone's routes — /m, its manifest, icon and service worker, /station/mobile.json" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 11: the card mounted — `#/settings` draws it, the shell loads it, a written station carries it

**Files:**
- Modify: `assets/station/station.js:5670-5680` — `settingsPage` returns the wizard followed by `w.FK_REMOTE.html(Boolean(S.serve))` when the module is loaded
- Modify: `assets/station/index.html` — `<script src="station/remote-card.js"></script>` after `spend-panel.js` and before `station.js`
- Modify: `lib/station.js:1080-1090` — `MODULES` gains `'remote-card.js'`, so `EMITTED` names `station/remote-card.js` and `write()` copies it
- Read: `tests/station-pages.test.js` — the `draw(hash)` harness (lines 15-29) copied
- Read: `assets/station/remote-card.js` — `FK_REMOTE.html(serve)`, the one name `settingsPage` calls
- Read: `lib/profile.js` — `WIZARD_KEYS`, the keys the wizard draws with in the harness
- Read: `tests/tmp.js` — scratch directories
- Test: `tests/station-remote-mount.test.js`
- Test: `tests/station-spend-route.test.js` — line 91 asserts the shell's exact script order, which now has `remote-card.js` between the spend modules and `station.js`

**Interfaces:**
- Consumes: `FK_REMOTE.html` (serve: boolean) → string; `STATIC` (the station server serves the card's module, which the shell now loads); `station.remote` and the five `notify.*` keys stay off `WIZARD_KEYS`, which the test's wizard draws with
- Produces: `station.EMITTED` gains `'station/remote-card.js'` (`MODULES`); the settings page draws `#rm-card` after `data-block="wizard"`

**Dispatch:** implementer, opus, high

1. Write the failing test. Create `tests/station-remote-mount.test.js`:

In `tests/station-remote-mount.test.js`, the whole file:

```js
'use strict';
// The 手機遠端 card mounted (docs/90-agent/plans/2026-10-21-station-remote-design.md
// §3): #/settings draws it under the wizard when assets/station/remote-card.js
// is loaded, the shell loads that module before station.js, and a written
// station carries it. What the card draws is tests/station-remote-card.test.js's.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const profile = require('../lib/profile.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const SRC = fs.readFileSync(path.join(ASSETS, 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-21T09:00:00.000Z');
const CARD = '<section class="dcard rm" id="rm-card" data-block="remote-on">card</section>';

// tests/station-pages.test.js's draw(), with the wizard's keys, a fetch that
// never answers (a served page asks the server for things this test does not
// serve), and window.FK_REMOTE when `remote` is given.
function draw(hash, opts) {
    const o = opts || {};
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash, protocol: o.serve ? 'http:' : 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: Boolean(o.serve), nonce: 'N0NCE',
            projects: [{ root: 'F:\\ws', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: profile.WIZARD_KEYS, classes: {}, sessions: [] } };
    if (o.remote) win.FK_REMOTE = o.remote;
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => new Promise(() => {}), module: { exports: {} } });
    return els.page.innerHTML;
}
// A stand-in for remote-card.js: records what it was told and draws CARD.
function stub() {
    const told = [];
    return { told, html: (serve) => { told.push(serve); return CARD; } };
}

test('#/settings draws the card after the wizard, told whether the page is served', () => {
    const off = stub();
    const page = draw('#/settings', { remote: off });
    assert.ok(page.includes('data-block="wizard"'));
    assert.ok(page.includes(CARD));
    assert.ok(page.indexOf('data-block="wizard"') < page.indexOf('id="rm-card"'), 'the card sits under the wizard');
    assert.equal(off.told[0], false);
    const on = stub();
    draw('#/settings', { remote: on, serve: true });
    assert.equal(on.told[0], true);
});

test('without remote-card.js the settings page is the wizard alone', () => {
    const page = draw('#/settings');
    assert.ok(page.includes('data-block="wizard"'));
    assert.ok(!page.includes('rm-card'));
});

test('no other page draws the card', () => {
    const s = stub();
    assert.ok(!draw('#/live', { remote: s }).includes('rm-card'));
    assert.deepEqual(s.told, []);
});

test('the shell loads remote-card.js after the spend modules and before station.js', () => {
    for (const html of [fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8'), station.render()]) {
        const order = [...html.matchAll(/<script src="station\/([^"]+)"><\/script>/g)].map((m) => m[1]);
        assert.equal(order.indexOf('remote-card.js'), order.indexOf('station.js') - 1, order.join(', '));
        assert.ok(order.indexOf('spend-panel.js') < order.indexOf('remote-card.js'), order.join(', '));
    }
});

test('a written station carries remote-card.js beside station.js', () => {
    assert.ok(station.EMITTED.includes('station/remote-card.js'));
    const cfg = tmp('fankeel-remote-mount-');
    station.write({ configDir: cfg });
    assert.equal(fs.readFileSync(path.join(cfg, 'fankeel', 'station', 'remote-card.js'), 'utf8'), fs.readFileSync(path.join(ASSETS, 'remote-card.js'), 'utf8'));
});
```

2. Run it and watch it fail (the stub is never called; `remote-card.js` is in neither the shell nor `EMITTED`):

```
node --test tests/station-remote-mount.test.js
```

3. Draw the card on the settings page. In `assets/station/station.js`, re-read `function settingsPage()` (station.js:5673-5677) and replace it with:

In `assets/station/station.js`, `settingsPage`:

```js
    function settingsPage() {
        var profiles = S.profiles || { machine: null, projects: {} }, keys = S.profileKeys || {};
        if (!wiz) wiz = wizLoad(profiles, keys, Object.keys(profiles.projects || {})[0] || 'machine');
        // The 手機遠端 card (assets/station/remote-card.js) under the wizard. It
        // draws nothing on a file on disk, which has no server to ask.
        return wizHtml(keys, wiz, profiles, { serve: Boolean(S.serve), nonce: S.nonce, plugin: S.plugin, configDir: S.configDir })
            + (w.FK_REMOTE ? w.FK_REMOTE.html(Boolean(S.serve)) : '');
    }
```

4. Load it from the shell. In `assets/station/index.html`, right after the line `<script src="station/spend-panel.js"></script>`, add:

In `assets/station/index.html`, between `spend-panel.js` and `station.js`:

```html
<script src="station/remote-card.js"></script>
```

5. Copy it into a written station. In `lib/station.js`, replace the comment and the line at lib/station.js:1083-1085 (`// The page's own modules (assets/station/spend-*.js), loaded by the shell` through `const MODULES = [...];`) with:

In `lib/station.js`, `MODULES`:

```js
// The page's own modules (assets/station/spend-*.js and the 手機遠端 card's
// remote-card.js), loaded by the shell between i18n.js and station.js, served
// and written beside them.
const MODULES = ['spend-talk.js', 'spend-kinds.js', 'spend-range.js', 'spend-panel.js', 'remote-card.js'];
```

6. Keep the spend route's order check true. In `tests/station-spend-route.test.js`, line 91 asserts the shell's whole script order; replace

```
    assert.deepEqual(order, ['i18n.js'].concat(MODULES, ['station.js']));
```

with the line below — its `MODULES` is that test's own list of the four spend modules, which stays four:

In `tests/station-spend-route.test.js`, line 91:

```js
    assert.deepEqual(order, ['i18n.js'].concat(MODULES, ['remote-card.js', 'station.js']));
```

7. Run the new test, the spend route's, the station's write test and the pages' tests, and watch them pass:

```
node --test tests/station-remote-mount.test.js tests/station-spend-route.test.js tests/station.test.js tests/station-pages.test.js
```

8. Commit:

```
git add assets/station/station.js assets/station/index.html lib/station.js tests/station-remote-mount.test.js tests/station-spend-route.test.js
git commit -m "feat: #/settings draws the 手機遠端 card, the shell loads it, a written station carries it" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


## Task 12: the gate trigger — `hooks/gate.js` publishes `notify.gate` for every question it lets out

**Files:**
- Modify: `hooks/gate.js` — one require; in `emit()`, one guarded `notify.fire` right after the `registry.gateOpen` try and before `stationAnswers` waits
- Read: `lib/notify.js` — `fire(values, event, opts)`, `gateEvent(mine, questions, id, root)`
- Read: `lib/profile.js` — `configDirOf(env)`, already required here as `profileLib`
- Read: `tests/gate.test.js` — the `runAsync` spawn pattern (tests/gate.test.js:409-417) and the `seed` entry shape
- Read: `tests/tmp.js` — scratch directories
- Test: `tests/gate-notify.test.js`

**Interfaces:**
- Consumes: `notify.fire` (values: object|null, event, {configDir}) → boolean, never throws, sends nothing under `node --test` unless `FANKEEL_NOTIFY_TEST=1`; `notify.gateEvent` (mine, questions: array|undefined, id: session id, root: registry root) → {kind:'gate', id, tab:'gate', title, message}; `notify.gate`, `notify.topic`, `notify.server` (Task 4's keys, read here through `profileFor`)
- Produces: none

**Dispatch:** implementer, opus, high

1. Write the failing test. Create `tests/gate-notify.test.js`:

In `tests/gate-notify.test.js`, the whole file:

```js
'use strict';
// hooks/gate.js and notify.gate (docs/90-agent/plans/2026-10-21-station-remote-design.md §5):
// a question the hook lets out is one ntfy publish — priority 4, a click and an
// 打開 gate action into the phone page — carrying the stage, the first question
// and the task cut to 80 characters, and nothing else; a question the hook
// refuses sends none; and no publish, on, off or unreachable, changes the
// hook's stdout or its exit code. The hook is spawned rather than
// execFileSync'd, so this file's stub server answers while it runs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const tmp = require('./tmp.js');

const GATE = path.join(__dirname, '..', 'hooks', 'gate.js');
const SID = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const NAME = 'ymlab-pc.tail1234.ts.net';
const TOPIC = 'fankeel-00112233445566778899';
const TASK = 'rework the colour ramp so the station reads the same in light and dark, every chart and every card included';
// The first option names the next stage and there are three of them, so the
// hook adds no thin-gate line (hooks/gate.js thinGate).
const QUESTIONS = [
    { header: 'design', question: '設計可以進 plan 嗎？', multiSelect: false, options: [
        { label: '核准，進 plan', description: '照這份設計寫計畫' },
        { label: '改設計', description: '先改再問' },
        { label: '暫停', description: '先停在這裡' },
    ] },
    { header: 'design', question: 'a second question that stays on this machine', multiSelect: false, options: [
        { label: 'yes', description: 'y' },
        { label: 'no', description: 'n' },
    ] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The ntfy server, as far as a publish can tell: it takes a POST and answers 200.
function stub() {
    const got = [];
    const server = http.createServer((req, res) => {
        let raw = '';
        req.on('data', (d) => { raw += d; });
        req.on('end', () => {
            let body = raw;
            try { body = JSON.parse(raw); } catch (e) { /* kept as text; the key check then fails on it */ }
            got.push({ method: req.method, url: req.url, body });
            res.setHeader('content-type', 'application/json');
            res.end('{"id":"stub"}');
        });
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, got, url: 'http://127.0.0.1:' + server.address().port })));
}

// Up to 5 s for `want` publishes, then 700 ms more to see that no other follows.
async function arrived(got, want) {
    for (let i = 0; i < 50 && got.length < want; i++) await sleep(100);
    await sleep(700);
    return got.length;
}

// A registry with one session at design, and the config directory its entry
// names holding the station's serve.json with a tailnet address.
function fixture(over) {
    const base = tmp('fankeel-gate-notify-');
    const root = path.join(base, 'ws');
    const cfg = path.join(base, 'cfg');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    const now = Date.now();
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SID + '.json'), JSON.stringify(Object.assign({
        task: TASK, stage: 'design', active: true, claims: ['secret/plan-notes.md'],
        started: new Date(now - 2 * 3600e3).toISOString(), updated: new Date(now - 3600e3).toISOString(), configDir: cfg,
    }, over), null, 2) + '\n');
    fs.writeFileSync(path.join(cfg, 'fankeel', 'serve.json'), JSON.stringify({ port: 28888, url: 'http://127.0.0.1:28888/', remote: { url: 'https://' + NAME + '/' } }) + '\n');
    return { root, cfg };
}

// The machine profile, where the 手機遠端 card writes the triggers.
const machine = (cfg, values) => fs.writeFileSync(path.join(cfg, 'fankeel', 'profile.json'), JSON.stringify(values, null, 2) + '\n');

function hook(f, toolInput, env) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [GATE], {
            env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: f.root, CLAUDE_CONFIG_DIR: f.cfg, FANKEEL_NOTIFY_TEST: '1' }, env),
        });
        let out = '';
        child.stdout.on('data', (d) => { out += d; });
        child.on('close', (code) => resolve({ out, code }));
        child.stdin.end(JSON.stringify({ session_id: SID, cwd: f.root, tool_name: 'AskUserQuestion', tool_input: toolInput }));
    });
}

test('a question the hook lets out is one publish: priority 4, a click and an 打開 gate action into the phone page', async () => {
    const s = await stub();
    try {
        const f = fixture();
        machine(f.cfg, { 'notify.gate': true, 'notify.topic': TOPIC, 'notify.server': s.url });
        assert.equal((await hook(f, { questions: QUESTIONS })).code, 0);
        assert.equal(await arrived(s.got, 1), 1, 'exactly one publish');
        const { method, url, body } = s.got[0];
        assert.equal(method, 'POST');
        assert.equal(url, '/');
        assert.deepEqual(Object.keys(body).sort(), ['actions', 'click', 'message', 'priority', 'tags', 'title', 'topic']);
        assert.equal(body.topic, TOPIC);
        assert.equal(body.priority, 4);
        assert.deepEqual(body.tags, ['fankeel']);
        assert.equal(body.title, 'design gate 在等你');
        assert.equal(body.click, 'https://' + NAME + '/m#/gate/' + SID);
        assert.deepEqual(body.actions, [{ action: 'view', label: '打開 gate', url: body.click }]);
        const lead = QUESTIONS[0].question + ' — ';
        assert.ok(body.message.startsWith(lead), body.message);
        const tail = body.message.slice(lead.length);
        assert.ok(tail.length <= 80, 'the task is cut to 80 characters: ' + tail);
        assert.ok(TASK.startsWith(tail.replace(/…$/, '')), tail);
        const text = JSON.stringify(body);
        for (const kept of [QUESTIONS[1].question, '改設計', '照這份設計寫計畫', 'secret/plan-notes.md']) {
            assert.ok(!text.includes(kept), kept + ' left for the ntfy server');
        }
    } finally {
        s.server.close();
    }
});

test('notify.gate off, no topic, or node --test without FANKEEL_NOTIFY_TEST: nothing is sent', async () => {
    assert.ok(process.env.NODE_TEST_CONTEXT, 'node --test sets NODE_TEST_CONTEXT, which keeps every other hook test quiet');
    const s = await stub();
    try {
        const cases = [
            [{ 'notify.gate': false, 'notify.topic': TOPIC, 'notify.server': s.url }, {}],
            [{ 'notify.gate': true, 'notify.server': s.url }, {}],
            [{ 'notify.gate': true, 'notify.topic': TOPIC, 'notify.server': s.url }, { FANKEEL_NOTIFY_TEST: '' }],
        ];
        for (const [values, env] of cases) {
            const f = fixture();
            machine(f.cfg, values);
            assert.equal((await hook(f, { questions: QUESTIONS }, env)).code, 0);
        }
        await sleep(1500);
        assert.equal(s.got.length, 0, JSON.stringify(s.got));
    } finally {
        s.server.close();
    }
});

test('a question the hook refuses is no gate waiting, and sends nothing', async () => {
    const s = await stub();
    try {
        // gate.away: the user answered 要離開 earlier and gate.station is off,
        // so the hook holds the question (hooks/gate.js holdsForAway).
        const f = fixture({ leavingAt: Date.now() - 60e3 });
        machine(f.cfg, { 'notify.gate': true, 'notify.topic': TOPIC, 'notify.server': s.url });
        const r = await hook(f, { questions: QUESTIONS });
        assert.equal(r.code, 0);
        assert.equal(JSON.parse(r.out).hookSpecificOutput.permissionDecision, 'deny', r.out);
        assert.match(r.out, /is held, not asked/);
        await sleep(1500);
        assert.equal(s.got.length, 0, JSON.stringify(s.got));
    } finally {
        s.server.close();
    }
});

test('no publish changes what the hook writes or how it exits: on, off and unreachable alike', async () => {
    const s = await stub();
    try {
        const f = fixture();
        const outs = [];
        for (const server of [s.url, 'http://127.0.0.1:1']) {
            for (const on of [true, false]) {
                machine(f.cfg, { 'notify.gate': on, 'notify.topic': TOPIC, 'notify.server': server });
                const r = await hook(f, { questions: QUESTIONS });
                assert.equal(r.code, 0, server + ' ' + on);
                outs.push(r.out);
            }
        }
        assert.equal(new Set(outs).size, 1, outs.join('\n'));
    } finally {
        s.server.close();
    }
});
```

2. Run it and watch it fail (the first test: `exactly one publish`, 0 !== 1 — the hook sends nothing yet):

```
node --test tests/gate-notify.test.js
```

3. Write the implementation. In `hooks/gate.js`, after the line `const { askSlip } = require('../lib/cjk.js');` (hooks/gate.js:56), add the require:

In `hooks/gate.js`, with the other requires:

```js
const notify = require('../lib/notify.js');
```

Then, in `hooks/gate.js`, inside `emit()`, right after the `try { registry.gateOpen(root, payload.session_id, { stage: mine.stage, hash: … }); } catch (e) { /* housekeeping */ }` block (hooks/gate.js:185-187) and before the line `let answers = null;`, insert:

In `hooks/gate.js`, in `emit()`:

```js
    // docs/90-agent/plans/2026-10-21-station-remote-design.md §5: every question
    // this hook lets out is a gate waiting, said once to ntfy when `notify.gate`
    // is on — here, before `stationAnswers` holds it, so the phone hears of it
    // while the station can still answer. Every `refuse()` returns before
    // `emit`, so a refused question sends nothing. A detached child sends the
    // publish (lib/notify.js): nothing here waits on the network, and nothing
    // about it reaches this hook's stdout or exit code. `values` is null when
    // the profile could not be read, and `fire` then sends nothing.
    try {
        notify.fire(values, notify.gateEvent(mine, payload.tool_input && payload.tool_input.questions, payload.session_id, root),
            { configDir: mine.configDir || profileLib.configDirOf() });
    } catch (e) { /* housekeeping: a notification never changes the question */ }
```

4. Run it and the hook's existing tests, and watch them pass:

```
node --test tests/gate-notify.test.js tests/gate.test.js
```

5. Commit:

```
git add hooks/gate.js tests/gate-notify.test.js
git commit -m "feat: hooks/gate.js publishes notify.gate for every question it lets out" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 13: the stage trigger — `task.js stage` publishes `notify.stage` when a stage is left for another

**Files:**
- Modify: `scripts/task.js:980-986` — in `cmdStage`, one guarded block right after the `showBadge(...)` call (task.js:983), its require inline so the top of the file is untouched
- Read: `lib/notify.js` — `fire(values, event, opts)`, `stageEvent(mine, from, to, id, root)`
- Read: `lib/profile.js` — `profileFor(root, mine)`, `configDirOf(env)`; already required at task.js:39 as `profile`
- Read: `lib/registry.js` — `readSession(root, id)`
- Read: `tests/hands.test.js` — the `taskCli` pattern (tests/hands.test.js:34-38)
- Read: `tests/tmp.js` — scratch directories
- Test: `tests/notify-stage.test.js`

**Interfaces:**
- Consumes: `notify.fire` (values: object|null, event, {configDir}) → boolean, never throws; `notify.stageEvent` (mine: the entry just written, from: the stage left, to: the stage entered, id: session id, root: registry root) → {kind:'stage', id, tab:'task', title, message}; `notify.stage`, `notify.topic`, `notify.server` (Task 4's keys); `station.EMITTED` (Task 11 — this file already requires lib/station.js, so it runs after Task 11 changes it)
- Produces: none

**Dispatch:** implementer, opus, high

1. Write the failing test. Create `tests/notify-stage.test.js`:

In `tests/notify-stage.test.js`, the whole file:

```js
'use strict';
// `task.js stage` and notify.stage (docs/90-agent/plans/2026-10-21-station-remote-design.md §5):
// leaving a stage for another is one silent publish with a click to the phone's
// task row; staying on a stage sends none; and neither a trigger left off nor
// an unreachable server changes what the move prints or how it exits.
// execFileSync blocks this file's event loop while task.js runs, so the stub is
// read after the command returns: the publish comes from a detached child
// that outlives the command, and the stub's socket queues it meanwhile.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const TASK_JS = path.join(__dirname, '..', 'scripts', 'task.js');
const SID = 'aaaaaaaa-1111-2222-3333-4444444444b1';
const NAME = 'ymlab-pc.tail1234.ts.net';
const TOPIC = 'fankeel-00112233445566778899';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The ntfy server, as far as a publish can tell: it takes a POST and answers 200.
function stub() {
    const got = [];
    const server = http.createServer((req, res) => {
        let raw = '';
        req.on('data', (d) => { raw += d; });
        req.on('end', () => {
            let body = raw;
            try { body = JSON.parse(raw); } catch (e) { /* kept as text; the key check then fails on it */ }
            got.push({ method: req.method, url: req.url, body });
            res.setHeader('content-type', 'application/json');
            res.end('{"id":"stub"}');
        });
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, got, url: 'http://127.0.0.1:' + server.address().port })));
}

// Up to 5 s for `want` publishes, then 700 ms more to see that no other follows.
async function arrived(got, want) {
    for (let i = 0; i < 50 && got.length < want; i++) await sleep(100);
    await sleep(700);
    return got.length;
}

// tests/hands.test.js's taskCli: --claude-dir and CLAUDE_CONFIG_DIR both at
// this test's own cfg, plus the variable that lets a publish out under node --test.
function taskCli(dir, args) {
    const cfg = path.join(dir, 'cfg');
    return execFileSync(process.execPath, [TASK_JS, ...args, '--root', dir, '--claude-dir', cfg],
        { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg, FANKEEL_NOTIFY_TEST: '1' }) });
}

// A task started on survey, with the machine profile and the station's
// serve.json (a tailnet address in it) in the config directory its entry names.
function fixture(values) {
    const dir = tmp('fankeel-notify-stage-');
    const cfg = path.join(dir, 'cfg');
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'profile.json'), JSON.stringify(values, null, 2) + '\n');
    fs.writeFileSync(path.join(cfg, 'fankeel', 'serve.json'), JSON.stringify({ port: 28888, url: 'http://127.0.0.1:28888/', remote: { url: 'https://' + NAME + '/' } }) + '\n');
    taskCli(dir, ['start', '--session', SID, '--task', 'notify the stage', '--route', 'survey,design,build']);
    return dir;
}

test('leaving a stage is one silent publish: the move as its title, a click to the task row', async () => {
    const s = await stub();
    try {
        const dir = fixture({ 'notify.stage': true, 'notify.topic': TOPIC, 'notify.server': s.url });
        assert.match(taskCli(dir, ['stage', 'design', '--session', SID]), /fankeel — survey to design/);
        assert.equal(await arrived(s.got, 1), 1, 'exactly one publish');
        const { method, url, body } = s.got[0];
        assert.equal(method, 'POST');
        assert.equal(url, '/');
        assert.deepEqual(Object.keys(body).sort(), ['click', 'message', 'priority', 'tags', 'title', 'topic']);
        assert.equal(body.topic, TOPIC);
        assert.equal(body.priority, 2, 'silent');
        assert.deepEqual(body.tags, ['fankeel']);
        assert.equal(body.title, 'survey 完成，接著 design');
        assert.equal(body.click, 'https://' + NAME + '/m#/task/' + SID);
        assert.ok(body.message.includes('notify the stage'), body.message);
        assert.ok(body.message.includes(path.basename(dir)), 'the project is the registry root\'s last segment: ' + body.message);
        taskCli(dir, ['stage', 'design', '--session', SID]);
        await sleep(1500);
        assert.equal(s.got.length, 1, 'staying on design is no stage finished');
    } finally {
        s.server.close();
    }
});

test('notify.stage off sends nothing, and an unreachable server changes nothing the move prints or how it exits', async () => {
    const s = await stub();
    try {
        const off = fixture({ 'notify.stage': false, 'notify.gate': true, 'notify.topic': TOPIC, 'notify.server': s.url });
        assert.match(taskCli(off, ['stage', 'design', '--session', SID]), /fankeel — survey to design/);
        await sleep(1500);
        assert.equal(s.got.length, 0, JSON.stringify(s.got));
    } finally {
        s.server.close();
    }
    // execFileSync throws on a non-zero exit, so returning at all is the exit check.
    const down = fixture({ 'notify.stage': true, 'notify.topic': TOPIC, 'notify.server': 'http://127.0.0.1:1' });
    assert.match(taskCli(down, ['stage', 'design', '--session', SID]), /fankeel — survey to design/);
    assert.equal(registry.readSession(down, SID).stage, 'design');
});
```

2. Run it and watch it fail (the first test: `exactly one publish`, 0 !== 1):

```
node --test tests/notify-stage.test.js
```

3. Write the implementation. A neighbouring session edits `scripts/task.js` while this plan runs: re-read task.js:975-990 first, and if the `showBadge` line has moved, put the block right after it wherever it now is — change nothing else in the file, and add no require at its top. In `scripts/task.js`, in `cmdStage`, right after the line `showBadge(opts, id, badge.badgeWord(name, clash.length > 0), Object.assign({ others: clash.length }, data), root);` (task.js:983) and before the blank line above the comment that opens `// What the stage just left cost`, insert:

In `scripts/task.js`, in `cmdStage`:

```js
    // docs/90-agent/plans/2026-10-21-station-remote-design.md §5: a stage left
    // for another is one silent ntfy publish when `notify.stage` is on. A
    // detached child sends it (lib/notify.js), so the move never waits on the
    // network, and no failure of it reaches this command's output or exit
    // code. Required here rather than at the top of the file, so this change
    // stays inside `cmdStage`.
    if (from && from !== name) {
        try {
            const notify = require('../lib/notify.js');
            notify.fire(profile.profileFor(root, data).values, notify.stageEvent(data, from, name, id, root),
                { configDir: data.configDir || profile.configDirOf() });
        } catch (e) { /* housekeeping: a notification never changes the move */ }
    }
```

4. Run it and the hands test (the same `taskCli` path through `stage`), and watch them pass:

```
node --test tests/notify-stage.test.js tests/hands.test.js
```

5. Commit:

```
git add scripts/task.js tests/notify-stage.test.js
git commit -m "feat: task.js stage publishes notify.stage when a stage is left for another" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 14: the end trigger — `hooks/leave.js` publishes `notify.end` with the cost including agents

**Files:**
- Modify: `hooks/leave.js` — three requires; inside `if (mine)`, one guarded block right after the `registry.update` try (hooks/leave.js:87-116)
- Read: `lib/notify.js` — `fire(values, event, opts)`, `endEvent(mine, usd, id, root)`
- Read: `lib/prices.js` — `costOf(models)` → {usd, priced, unpriced, estimated}
- Read: `lib/profile.js` — `profileFor(root, mine)`, `configDirOf(env)`
- Read: `lib/registry.js` — `readSession`, `writeSession`, `ensureLayout`
- Read: `tests/leave.test.js` — the fixture (tests/leave.test.js:24-47) and the payload shape
- Read: `tests/tmp.js` — scratch directories
- Test: `tests/notify-end.test.js`

**Interfaces:**
- Consumes: `notify.fire` (values: object|null, event, {configDir}) → boolean, never throws; `notify.endEvent` (mine: the entry as leave just wrote it, usd: number|null — the parent's and the agents' cost, null when neither side has a priced model, id: session id, root: registry root) → {kind:'end', id, tab:'task', title, message}; `notify.end`, `notify.topic`, `notify.server` (Task 4's keys); `station.EMITTED` (Task 11 — this file already requires lib/station.js, so it runs after Task 11 changes it)
- Produces: none

**Dispatch:** implementer, opus, high

1. Write the failing test. Create `tests/notify-end.test.js`:

In `tests/notify-end.test.js`, the whole file:

```js
'use strict';
// hooks/leave.js and notify.end (docs/90-agent/plans/2026-10-21-station-remote-design.md §5):
// a session ending is one silent publish carrying the project, how many stages
// ran and the cost with its agents; a trigger left off, or a session with no
// entry, sends none; and an unreachable server leaves the hook as silent as
// ever with its entry written. The fixture is tests/leave.test.js's, priced.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'leave.js');
const SID = 'aaaaaaaa-1111-4111-8111-1111111111c1';
const NAME = 'ymlab-pc.tail1234.ts.net';
const TOPIC = 'fankeel-00112233445566778899';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The ntfy server, as far as a publish can tell: it takes a POST and answers 200.
function stub() {
    const got = [];
    const server = http.createServer((req, res) => {
        let raw = '';
        req.on('data', (d) => { raw += d; });
        req.on('end', () => {
            let body = raw;
            try { body = JSON.parse(raw); } catch (e) { /* kept as text; the key check then fails on it */ }
            got.push({ method: req.method, url: req.url, body });
            res.setHeader('content-type', 'application/json');
            res.end('{"id":"stub"}');
        });
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, got, url: 'http://127.0.0.1:' + server.address().port })));
}

// Up to 5 s for `want` publishes, then 700 ms more to see that no other follows.
async function arrived(got, want) {
    for (let i = 0; i < 50 && got.length < want; i++) await sleep(100);
    await sleep(700);
    return got.length;
}

function fixture(values) {
    const base = tmp('fankeel-notify-end-');
    const cfg = path.join(base, 'cfg');
    const root = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    registry.ensureLayout(root);
    registry.writeSession(root, SID, { task: 'the ramp', stage: 'build', route: ['survey', 'build'], active: true,
        claims: ['secret/plan-notes.md'], started: new Date().toISOString(), updated: new Date().toISOString(), configDir: cfg,
        clock: { survey: [1000, 2000], build: [3000, 4000] } });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'profile.json'), JSON.stringify(values, null, 2) + '\n');
    fs.writeFileSync(path.join(cfg, 'fankeel', 'serve.json'), JSON.stringify({ port: 28888, url: 'http://127.0.0.1:28888/', remote: { url: 'https://' + NAME + '/' } }) + '\n');
    const transcript = path.join(base, 't.jsonl');
    const line = (requestId, at, usage, sidechain) => JSON.stringify(Object.assign(sidechain ? { isSidechain: true } : {}, {
        type: 'assistant', requestId, timestamp: new Date(at).toISOString(), message: { model: 'claude-opus-5', usage },
    })) + '\n';
    // claude-opus-5 is $5 in and $25 out a million tokens (lib/prices.js): the
    // parent $0.50 + $0.50, its agent $0.20 + $0.20 — $1.40 together.
    fs.writeFileSync(transcript, line('r1', 1500, { input_tokens: 100000, output_tokens: 20000 }));
    const agentDir = path.join(base, 't', 'subagents');
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, 'agent-dddd.jsonl'), line('d1', 1600, { input_tokens: 40000, output_tokens: 8000 }, true));
    return { cfg, root, transcript };
}

// CLAUDE_PROJECT_DIR is set as well: registry.rootFor reads it before the
// payload's cwd, and a test run from inside a Claude Code session inherits one.
function run(f, over) {
    return execFileSync(process.execPath, [HOOK], {
        input: JSON.stringify(Object.assign({ session_id: SID, transcript_path: f.transcript, cwd: f.root, reason: 'clear', hook_event_name: 'SessionEnd' }, over)),
        env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: f.cfg, CLAUDE_PROJECT_DIR: f.root, FANKEEL_NOTIFY_TEST: '1' }),
        encoding: 'utf8',
    });
}

test('a session ending is one silent publish: the project, the stages and the cost with its agents', async () => {
    const s = await stub();
    try {
        const f = fixture({ 'notify.end': true, 'notify.topic': TOPIC, 'notify.server': s.url });
        assert.equal(run(f), '', 'a SessionEnd hook stays silent');
        assert.equal(await arrived(s.got, 1), 1, 'exactly one publish');
        const { method, url, body } = s.got[0];
        assert.equal(method, 'POST');
        assert.equal(url, '/');
        assert.deepEqual(Object.keys(body).sort(), ['click', 'message', 'priority', 'tags', 'title', 'topic']);
        assert.equal(body.topic, TOPIC);
        assert.equal(body.priority, 2, 'silent');
        assert.deepEqual(body.tags, ['fankeel']);
        assert.equal(body.title, '任務結束：the ramp');
        assert.equal(body.click, 'https://' + NAME + '/m#/task/' + SID);
        for (const part of ['ws', '2 個 stage', '$1.40']) assert.ok(body.message.includes(part), part + ' is not in: ' + body.message);
        assert.ok(!JSON.stringify(body).includes('secret/plan-notes.md'), 'a claim left for the ntfy server');
        assert.equal(registry.readSession(f.root, SID).ended.reason, 'clear');
    } finally {
        s.server.close();
    }
});

test('notify.end off, and a session with no entry, send nothing', async () => {
    const s = await stub();
    try {
        const off = fixture({ 'notify.end': false, 'notify.gate': true, 'notify.topic': TOPIC, 'notify.server': s.url });
        assert.equal(run(off), '');
        const none = fixture({ 'notify.end': true, 'notify.topic': TOPIC, 'notify.server': s.url });
        assert.equal(run(none, { session_id: 'bbbbbbbb-2222-4222-8222-2222222222c2' }), '');
        await sleep(1500);
        assert.equal(s.got.length, 0, JSON.stringify(s.got));
    } finally {
        s.server.close();
    }
});

test('an unreachable ntfy server leaves the hook silent, exiting 0, its entry written', () => {
    const f = fixture({ 'notify.end': true, 'notify.topic': TOPIC, 'notify.server': 'http://127.0.0.1:1' });
    // execFileSync throws on a non-zero exit, so returning at all is the exit check.
    assert.equal(run(f), '');
    const d = registry.readSession(f.root, SID);
    assert.equal(d.ended.reason, 'clear');
    assert.ok(d.usage.models['claude-opus-5'], 'usage is written as before');
});
```

2. Run it and watch it fail (the first test: `exactly one publish`, 0 !== 1):

```
node --test tests/notify-end.test.js
```

3. Write the implementation. In `hooks/leave.js`, after the line `const replay = require('../lib/replay.js');` (hooks/leave.js:28), add:

In `hooks/leave.js`, with the other requires:

```js
const prices = require('../lib/prices.js');
const profile = require('../lib/profile.js');
const notify = require('../lib/notify.js');
```

Then, in `hooks/leave.js`, inside `if (mine) { … }` in `main`, right after the `try { registry.update(root, sessionId, (d) => { … }); } catch (e) { /* housekeeping */ }` block (hooks/leave.js:87-116) and before the closing brace of `if (mine)`, insert:

In `hooks/leave.js`, in `main`, inside `if (mine)`:

```js
        // docs/90-agent/plans/2026-10-21-station-remote-design.md §5: a task
        // ended is one silent ntfy publish when `notify.end` is on, carrying
        // what it cost with its agents — read back from the entry just written
        // and priced the way the station prices a row, the parent's models and
        // the agents' apart and then added. A detached child sends it
        // (lib/notify.js); nothing here waits on it, and this hook still says
        // nothing.
        try {
            const after = registry.readSession(root, sessionId);
            if (after) {
                const u = after.usage || {};
                const own = prices.costOf(u.models);
                const theirs = prices.costOf(u.subagents && u.subagents.models);
                const usd = own.priced.length || theirs.priced.length ? own.usd + theirs.usd : null;
                notify.fire(profile.profileFor(root, after).values, notify.endEvent(after, usd, sessionId, root),
                    { configDir: after.configDir || profile.configDirOf() });
            }
        } catch (e) { /* housekeeping: a notification never changes the hook */ }
```

4. Run it and the hook's existing tests, and watch them pass:

```
node --test tests/notify-end.test.js tests/leave.test.js
```

5. Commit:

```
git add hooks/leave.js tests/notify-end.test.js
git commit -m "feat: hooks/leave.js publishes notify.end with the cost including agents" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 15: the live check — the station on the user's phone through their Tailscale, with ntfy

**Files:**
- Modify: `docs/90-agent/reports/2026-10-21-station-remote-live.md` — new: what the phone did, check by check
- Modify: `docs/README.md` — one index row for the report, after the two-candidate-trial report's row (docs/README.md:521)
- Read: `docs/90-agent/plans/2026-10-21-station-remote-design.md` — the promises being checked, and its "Not verified" list

**Interfaces:**
- Consumes: `station.remote`, `notify.gate`, `notify.stage`, `notify.end` (Task 4); `notify.fire` (Task 5); `remote.url`, `/station/remote` (Task 6); `mobile.manifest` (Task 7); `FK_M.parseRoute` (Task 8); `FK_REMOTE.html` (Task 9); `/station/mobile.json` (Task 10) — every one built and committed before this runs
- Produces: none

**Dispatch:** user — on the user's own phone (Galaxy S24) through their Tailscale: scan the station's QR, answer a held gate from the phone, receive the three ntfy notifications, install the PWA and see the offline screen; no subagent has a phone, a camera or the tailnet.

1. Put this build where Claude Code runs it. The hooks Claude Code fires are the installed plugin's copy (under `~/.claude/plugins/cache/fankeel/fankeel/`), not this working tree's, and the version moves only at land. So: end the station that is running now (its pid is `pid` in `<configDir>/fankeel/serve.json`), start this checkout's from `F:/ymlab/fankeel`, and open a scratch Claude Code session that loads this checkout as the plugin, from a scratch directory of its own:

```
node scripts/station.js serve --open
claude --plugin-dir F:/ymlab/fankeel
```

In the scratch session, run `/fankeel` with a small task, and check its first line names this checkout's version. If it names the installed cache instead, write that on the report's 環境 line, run steps 2-4 now, and run steps 5-7 after land's release; the report is then finished at land, before its gate.

2. Hold gates for the station, and turn the remote on from the page. In the scratch session (or any shell, with the scratch directory as `--root`):

```
node F:/ymlab/fankeel/scripts/task.js profile set gate.station 300
```

On the desktop station, open `#/settings`; under the wizard, the 手機遠端 card. Turn its switch on. Expected: the card shows `https://<name>/` with 複製, a QR, the eight-character code typed out under it, and 換一個. In a shell, `tailscale serve status` shows one proxy to `http://127.0.0.1:<port>`, and `tailscale funnel status` shows nothing on. Turn on 待答, stage 完成 and 任務結束 on the card; it now shows the subscribe line `<server>/<topic>`.

3. Pair the phone. On the S24, with the Tailscale app connected to the same tailnet: scan the card's QR with the phone's own camera app. Expected: Chrome opens `/m`, pairs, and lands on 待答; the desktop card lists the phone with 解除. Then open `/m` on the phone again from a fresh tab with the cookie cleared (Chrome → site settings → clear) and record whether the page offers its own camera scan (BarcodeDetector) or only 輸入配對碼; pair again by typing a fresh code from 換一個.

4. Subscribe and install. In the ntfy app, subscribe to the card's `<server>/<topic>`. In Chrome on `/m`, open the menu: record whether it offers 安裝應用程式 (a real install) or only 加到主畫面 (a shortcut) for a manifest whose only icon is an SVG; install it either way and open it from the home screen.

5. A gate, from the phone. In the scratch session, move the task to a stage with a gate and let it ask. Expected: within a few seconds the phone rings with a priority-4 notification titled `<stage> gate 在等你`, with an 打開 gate button; tapping it opens `/m` on that gate's sheet with the recommended option already picked. Answer from the sheet. Expected: the scratch session's question goes out answered as the phone answered it, and the gate leaves 待答.

6. A stage finished, and a task ended. In the scratch session, let the task move on one stage (`task.js stage`), then end the session (`/exit`). Expected: two silent notifications, `<from> 完成，接著 <to>` and `任務結束：<task>` with the project, the stage count and a cost; tapping either opens `/m` on 任務 or 完成 with that row. The 完成 tab lists both, newest first.

7. Offline, revoke, off. On the phone, turn the Tailscale app off and open the installed app. Expected: the pair-error screen from the cached shell, not Chrome's own error page. Turn Tailscale back on. On the desktop card, press 解除 on the phone. Expected: the phone's next read (within 5 s) lands on the pairing screen. Turn the card's switch off. Expected: reloading `/m` on the phone answers 421; the desktop station is unchanged on `127.0.0.1`. If the proxy should go too, in a shell:

```
tailscale serve --https=443 off
```

8. Write the report. Create it with every 結果 cell holding 通過 or 不通過 and, after a colon, what was seen; the 一句話 line is the verdict; the 環境 lines say what ran:

In `docs/90-agent/reports/2026-10-21-station-remote-live.md`, the whole file:

```md
---
status: current
last_verified: 2026-10-21
source_of_truth: scripts/station.js, lib/remote.js, lib/tailscale.js, lib/notify.js, assets/station/mobile.js, assets/station/sw.js, assets/station/remote-card.js
---

# 監控站手機遠端，實機檢查 — 2026-10-21

一句話：<這次檢查的結論，一句>

計畫在 [2026-10-21-station-remote.md](../plans/2026-10-21-station-remote.md)，設計在 [2026-10-21-station-remote-design.md](../plans/2026-10-21-station-remote-design.md)。

## 環境

- 電腦：Windows 11，Tailscale <版本>，MagicDNS 名稱 <名稱>
- 手機：Galaxy S24，Chrome <版本>，Tailscale app <版本>，ntfy app <版本>
- fankeel：<commit>；hooks 從 <這個 checkout（--plugin-dir）或安裝的 cache>

## 結果

| # | 檢查 | 期望 | 結果 |
|---|---|---|---|
| 1 | 打開手機遠端開關 | 卡片出現 tailnet 網址、QR、配對碼；`tailscale serve status` 只有一個 proxy，沒有 funnel | <通過／不通過：看到什麼> |
| 2 | 手機相機掃 QR | 打開 `/m` 並配對成功，卡片列出這支手機 | <通過／不通過：看到什麼> |
| 3 | 頁內掃描 | S24 的 Chrome 有沒有 BarcodeDetector；沒有時只出現輸入配對碼 | <有／沒有：看到什麼> |
| 4 | 安裝 PWA | 只有 SVG icon 的 manifest，Chrome 給的是安裝還是加到主畫面 | <安裝／捷徑：看到什麼> |
| 5 | gate 通知 | priority 4 會響，「打開 gate」開到那個 gate 的 sheet，推薦選項已勾 | <通過／不通過：看到什麼> |
| 6 | 從手機答 gate | scratch session 的問題帶著手機的答案送出，gate 離開待答 | <通過／不通過：看到什麼> |
| 7 | stage 完成通知 | 靜音，點開到任務那一列 | <通過／不通過：看到什麼> |
| 8 | 任務結束通知 | 靜音，帶專案、stage 數與含 agent 的花費 | <通過／不通過：看到什麼> |
| 9 | 手機 Tailscale 關掉 | 已安裝的 app 開出 pair-error，不是 Chrome 的錯誤頁 | <通過／不通過：看到什麼> |
| 10 | 解除 | 手機下一次讀取回到配對畫面 | <通過／不通過：看到什麼> |
| 11 | 開關關掉 | 手機重新整理得到 421；電腦上 `127.0.0.1` 照常 | <通過／不通過：看到什麼> |

## 沒過的

<每一條不通過：哪一格、看到什麼、要開哪個 TODO；全部通過就寫「沒有」>
```

9. Index it. In `docs/README.md`, right after the row that links the two-candidate-trial report (docs/README.md:521), add one row:

In `docs/README.md`, the new row:

```md
| 監控站手機遠端的實機檢查（10-21）：S24 經自己的 Tailscale 掃 QR 配對、從手機答 gate、三種 ntfy 通知、安裝 PWA、斷線畫面、解除與關掉 | [reports/2026-10-21-station-remote-live.md](90-agent/reports/2026-10-21-station-remote-live.md) — *a dated snapshot, 繁體中文* |
```

10. Check the docs and commit:

```
node scripts/docs-check.js
git add docs/90-agent/reports/2026-10-21-station-remote-live.md docs/README.md
git commit -m "docs: the station remote checked live on the phone" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Coverage

| promise | task |
|---|---|
| `station.remote` is a profile key read from the machine profile, default `false`; off, the station answers only a request whose Host is `127.0.0.1`, `localhost` or `[::1]` and that carries no proxy header, and refuses anything else with 421 — today it answers any Host. | Task 4, Task 1, Task 6 |
| On, a request whose Host or X-Forwarded-Host is this machine's tailnet name, or one tailscale serve rewrote to loopback with a proxy header, is answered as coming through the tailnet; loopback requests are handled exactly as today. | Task 1, Task 6 |
| `hooks/pane.ts` stays on loopback, unchanged: `serve.json`'s `url` is the loopback address whatever `station.remote` says, and the tailnet address sits beside it as `remote.url`. | Task 6 |
| At listen, and whenever `station.remote` is written from the page, the station runs `tailscale serve --bg <port>` only when `tailscale serve status --json` shows no proxy to that port yet — VoiceLedger's `ensure_tailscale_serve`. | Task 2, Task 6 |
| It never runs `tailscale funnel`, and with Funnel on for the machine it leaves remote off and says so. | Task 2, Task 6 |
| Every failure — no tailscale, not running, no MagicDNS name, another proxy already on `/` — is a warning on stderr and on the 手機遠端 card, never fatal: the station keeps serving loopback. | Task 2, Task 6, Task 9 |
| Turning `station.remote` off does not touch Tailscale: the station refuses the tailnet Host from the next request, and the reference page says how to remove the proxy. | Task 6, Task 15 |
| The 手機遠端 card on `#/settings` (mockup `remote-on`, `remote-off`) carries the switch, the tailnet url with 複製, a QR of `https://<name>/m#/pair/<code>` with the code typed out, the paired devices with 解除, and the three ntfy triggers. | Task 3, Task 6, Task 9, Task 11 |
| A pairing code is 8 characters, one-time, live for 10 minutes; 換一個 mints a new one, and five wrong tries drop it. | Task 1, Task 6, Task 9 |
| `POST /station/remote/pair` from the tailnet trades a live code for a device token, set as an `HttpOnly; Secure; SameSite=Strict` cookie for a year; only the token's SHA-256 is stored, in `<configDir>/fankeel/remote.json`, which is never in a repository. | Task 1, Task 6 |
| Through the tailnet every route but the phone page, its assets and pairing needs a paired device's cookie, reads included — `/station/talk/<id>` serves whole transcripts — and answers 401 without; every POST from there also needs `Origin: https://<name>`. | Task 1, Task 6 |
| The POST routes (`/answer`, `/clear`, `/clear-stale`, `/todo`, `/profile`) take a paired device's cookie in place of the nonce from the tailnet; from loopback they keep today's nonce, and the card's own routes and Chartroom answer loopback only. | Task 1, Task 6 |
| 解除 revokes one device: its cookie answers 401 from the next request. | Task 1, Task 6, Task 9 |
| `/m` is the phone's page, one app-like column — full-bleed under 600 px, a centred 480 px column above — with 待答, 任務 and 完成 on a bottom tab bar (mockup `tabbar`, `tab-gates`, `tab-tasks`, `tab-done`). | Task 7, Task 8, Task 10 |
| 待答 lists the gates `hooks/gate.js` is holding for the station, oldest first; a row opens the gate as a bottom sheet with every question, the recommended option picked and a 自己寫答案 box (`gate-sheet`), posting to `POST /answer`; with none held it is `gates-empty`. | Task 7, Task 8, Task 10, Task 15 |
| 任務 lists running tasks with their route dots and stage; 完成 lists the stages finished and tasks ended in the last 48 hours, newest first, with their cost including agents. | Task 7, Task 8 |
| An unpaired phone sees `pair-scan` — the camera through BarcodeDetector where the browser has it, otherwise 輸入配對碼 — and a phone that cannot reach the station sees `pair-error`, from the service worker's cached shell when installed. | Task 8, Task 15 |
| It works as an installed PWA (`/m/manifest.webmanifest`, `/m/icon.svg`, `/sw.js` caching the shell only) and opened directly in the browser, the same page either way. | Task 7, Task 8, Task 10, Task 15 |
| Its data is `GET /station/mobile.json` (`lib/mobile.js`), a few kilobytes, read every 5 s while the page is visible — never the desktop's `station-data.js`; through the tailnet `/` redirects to `/m`. | Task 7, Task 8, Task 10 |
| Profile keys `notify.server` (default `https://ntfy.sh`) and `notify.topic` — random, `fankeel-` and 20 hex digits, written the first time a trigger is turned on from the card — and three triggers, `notify.gate`, `notify.stage` and `notify.end`, each default `false`. | Task 4, Task 5, Task 6, Task 9 |
| One JSON publish per trigger to `<server>/` with the topic, and a `click` to `<remote.url>m#/gate/<id>` or `m#/task/<id>` when `serve.json` has a tailnet address. | Task 5, Task 12, Task 13, Task 14 |
| A gate waiting (`hooks/gate.js`, every question it lets out) is priority 4 with a 打開 gate action; a stage finished (`task.js stage`) and a task ended (`hooks/leave.js`) are priority 2, silent. | Task 5, Task 12, Task 13, Task 14 |
| Each publish is sent by a detached child (`scripts/notify.js`), so no hook waits on the network, and no failure — no topic, an unreachable server, a refusal — changes a hook's output or its exit code. | Task 5, Task 12, Task 13, Task 14 |
| What leaves for the ntfy server is the stage, the first question, the task text cut to 80 characters, the project and the cost, and nothing else. | Task 5, Task 12, Task 14 |
| with `station.remote` off, a request whose Host is the tailnet name is refused with 421 | Task 6 |
| with `station.remote` on and no device cookie, `POST /answer` through the tailnet answers 401 | Task 6 |
| `hooks/gate.js` with ntfy configured makes exactly one POST to a stub ntfy server | Task 12 |
| the phone page's 待答 badge, its gate rows and `/station/mobile.json`'s `gates` agree in number | Task 10 |
