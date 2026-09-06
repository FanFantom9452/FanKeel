'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFileSync, spawnSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const badge = require('../lib/badge.js');
const station = require('../lib/station.js');

const CLI = path.join(__dirname, '..', 'scripts', 'station.js');
const LIVE = 'aaaaaaaa-1111-4111-8111-111111111111';
const STALE = 'bbbbbbbb-2222-4222-8222-222222222222';
const DAY = 24 * 3600e3;

function fixture() {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-station-cli-'));
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    const now = Date.now();
    const at = (ms) => new Date(ms).toISOString();
    registry.writeSession(r1, LIVE, { task: 'live', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: at(now - 40 * DAY), updated: at(now - 30 * DAY), configDir: cfg });
    registry.writeSession(r1, STALE, { task: 'stale', stage: 'design', route: ['survey', 'design'], active: true, claims: [],
        started: at(now - 40 * DAY), updated: at(now - 30 * DAY), configDir: cfg });
    badge.writeLead(cfg, STALE, { word: 'design', root: r1 });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({
        pid: process.pid, sessionId: LIVE, cwd: r1, startedAt: at(now), procStart: 0, version: '2.0.0',
        kind: 'interactive', entrypoint: 'cli', status: 'idle',
    }));
    // Seeded so the CLI never sees "no roots.json at all" here: these three
    // tests exercise the ordinary write path, not the once-only auto-scan,
    // and an unseeded config dir would make every one of them spend the
    // auto-scan's own budget walking this machine's real drives.
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'),
        JSON.stringify({ [path.resolve(r1)]: at(now) }, null, 2) + '\n');
    return { base, cfg, r1 };
}

const request = (url, opts, body) => new Promise((resolve, reject) => {
    const req = http.request(url, opts, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
});

test('the default form writes the page, prints its path and the counts', () => {
    const f = fixture();
    const out = execFileSync(process.execPath, [CLI], { cwd: f.base, env: { ...process.env, CLAUDE_CONFIG_DIR: f.cfg }, encoding: 'utf8' });
    const file = path.join(f.cfg, 'fankeel', 'station.html');
    assert.ok(out.includes(file));
    assert.match(out, /1 registries · 1 live, 1 stale, 0 down/);
    assert.ok(fs.readFileSync(file, 'utf8').includes('stale'));
});

test('--json prints the rows as one JSON document and writes nothing', () => {
    const f = fixture();
    const env = { ...process.env, CLAUDE_CONFIG_DIR: f.cfg };
    const out = execFileSync(process.execPath, [CLI, '--json'], { cwd: f.base, env, encoding: 'utf8' });
    const model = JSON.parse(out);
    const states = model.registries.flatMap((r) => r.sessions.map((s) => s.state)).sort();
    assert.deepEqual(states, ['live', 'stale']);
    assert.equal(fs.existsSync(path.join(f.cfg, 'fankeel', 'station.html')), false, '--json wrote the page');
    assert.equal(fs.existsSync(path.join(f.r1, '.fankeel', 'station.html')), false, '--json wrote the copy');
});

test('--json refuses a verb, the way an unknown argument is refused', () => {
    const f = fixture();
    const env = { ...process.env, CLAUDE_CONFIG_DIR: f.cfg };
    for (const argv of [['--json', 'serve'], ['--json', '--forget', f.r1]]) {
        const r = spawnSync(process.execPath, [CLI, ...argv], { cwd: f.base, env, encoding: 'utf8' });
        assert.equal(r.status, 2, argv.join(' '));
        assert.match(r.stderr, /--json/);
    }
});

test('--scan walks a directory for registries, and the next run remembers what it found', () => {
    const f = fixture();
    const far = path.join(f.base, 'elsewhere', 'deep', 'ws2');
    registry.ensureLayout(far);
    registry.writeSession(far, 'cccccccc-3333-4333-8333-333333333333', { task: 'scanned', stage: 'land', route: ['survey', 'land'],
        active: false, claims: [], started: new Date().toISOString(), updated: new Date().toISOString(), configDir: f.cfg });
    const env = { ...process.env, CLAUDE_CONFIG_DIR: f.cfg };
    const out = execFileSync(process.execPath, [CLI, '--scan', path.join(f.base, 'elsewhere')], { cwd: f.base, env, encoding: 'utf8' });
    assert.match(out, /2 registries · 1 live, 1 stale, 1 down/);
    assert.ok(fs.readFileSync(path.join(f.cfg, 'fankeel', 'station.html'), 'utf8').includes('scanned'));
    const again = execFileSync(process.execPath, [CLI], { cwd: f.base, env, encoding: 'utf8' });
    assert.match(again, /2 registries/, 'roots.json remembered the scanned registry');
    const inside = execFileSync(process.execPath, [CLI], { cwd: far, env, encoding: 'utf8' });
    assert.match(inside, /copy at /);
    assert.ok(fs.existsSync(path.join(far, '.fankeel', 'station.html')), 'run from inside a registry, the copy lands there');
});

test('serve renders live, refuses a bad nonce, refuses a live row, clears a stale one, then exits when idle', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const page = await request(s.url, { method: 'GET' });
        assert.equal(page.status, 200);
        assert.ok(page.text.includes('action="/clear"'));
        const nonce = /name="nonce" value="([^"]+)"/.exec(page.text)[1];
        const form = (o) => new URLSearchParams(o).toString();
        const post = (body) => request(s.url + 'clear', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } }, body);
        assert.equal((await post(form({ root: f.r1, id: STALE, nonce: 'wrong' }))).status, 403);
        const refused = await post(form({ root: f.r1, id: LIVE, nonce }));
        assert.equal(refused.status, 409);
        assert.match(refused.text, /running/);
        assert.equal(registry.readSession(f.r1, LIVE).active, true);
        const ok = await post(form({ root: f.r1, id: STALE, nonce }));
        assert.equal(ok.status, 303);
        assert.equal(ok.headers.location, '/');
        assert.equal(registry.readSession(f.r1, STALE).active, false);
        assert.equal((await request(s.url + 'nowhere', { method: 'GET' })).status, 404);
    } finally {
        s.close();
    }
});

// --- Task 7: bulk clear, --forget, and the once-only budgeted first-run scan ---

const CS_LIVE = 'aaaaaaaa-9999-4999-8999-999999999991';
const CS_OLD_A = 'bbbbbbbb-9999-4999-8999-999999999992';
const CS_OLD_B = 'bbbbbbbb-9999-4999-8999-999999999993';
const CS_FRESH = 'cccccccc-9999-4999-8999-999999999994';

// Two stages old and one live, with an optional recently-touched fourth row —
// `clearEntry`'s age rule (`STALE_MS`, twelve hours) is independent of the
// station's own `stale` classification (not running), so a row can read
// `stale` on the page and still be too fresh for `/clear-stale` to touch
// without `force`. `withFresh` is what exercises that gap.
function clearStaleFixture(withFresh) {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-clear-stale-'));
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    const now = Date.now();
    const at = (ms) => new Date(ms).toISOString();
    registry.writeSession(r1, CS_LIVE, { task: 'live', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: at(now - DAY), updated: at(now - DAY), configDir: cfg });
    registry.writeSession(r1, CS_OLD_A, { task: 'old-a', stage: 'design', route: ['survey', 'design'], active: true, claims: [],
        started: at(now - 30 * DAY), updated: at(now - 30 * DAY), configDir: cfg });
    registry.writeSession(r1, CS_OLD_B, { task: 'old-b', stage: 'design', route: ['survey', 'design'], active: true, claims: [],
        started: at(now - 30 * DAY), updated: at(now - 30 * DAY), configDir: cfg });
    if (withFresh) {
        registry.writeSession(r1, CS_FRESH, { task: 'fresh', stage: 'design', route: ['survey', 'design'], active: true, claims: [],
            started: at(now - 5 * 60e3), updated: at(now - 5 * 60e3), configDir: cfg });
    }
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({
        pid: process.pid, sessionId: CS_LIVE, cwd: r1, startedAt: at(now), procStart: 0, version: '2.0.0',
        kind: 'interactive', entrypoint: 'cli', status: 'idle',
    }));
    return { base, cfg, r1 };
}

test('POST /clear-stale clears every stale row in one registry', async () => {
    const f = clearStaleFixture(false);
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const page = await request(s.url, { method: 'GET' });
        const nonce = /name="nonce" value="([^"]+)"/.exec(page.text)[1];
        const form = (o) => new URLSearchParams(o).toString();
        const res = await request(s.url + 'clear-stale',
            { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } },
            form({ root: f.r1, nonce }));
        assert.equal(res.status, 303);
        // The count travels in the redirect rather than in a body this response
        // does not have: a bare `303 → /` said nothing about what it had done,
        // and the design asks the route to report how many it cleared.
        assert.equal(res.headers.location, '/?cleared=2');
        assert.equal(registry.readSession(f.r1, CS_OLD_A).active, false, 'the first stale row is cleared');
        assert.equal(registry.readSession(f.r1, CS_OLD_B).active, false, 'the second stale row is cleared');
        assert.equal(registry.readSession(f.r1, CS_LIVE).active, true, 'the live row is untouched');
        // And the page the browser lands on says so, which is the half a
        // redirect cannot do by itself.
        const after = await request(s.url + '?cleared=2', { method: 'GET' });
        assert.equal(after.status, 200);
        assert.match(after.text, /<p class="cleared">cleared 2 stale rows<\/p>/);
        const plain = await request(s.url, { method: 'GET' });
        assert.ok(!plain.text.includes('<p class="cleared">'),
            'a page loaded without the query says nothing about clearing');
        const junk = await request(s.url + '?cleared=lots', { method: 'GET' });
        assert.ok(!junk.text.includes('<p class="cleared">'),
            'a non-numeric count is ignored rather than echoed into the page');
    } finally {
        s.close();
    }
});

test('POST /clear-stale refuses without the nonce', async () => {
    const f = clearStaleFixture(false);
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const form = (o) => new URLSearchParams(o).toString();
        const res = await request(s.url + 'clear-stale',
            { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } },
            form({ root: f.r1, nonce: 'wrong' }));
        assert.equal(res.status, 403);
        assert.equal(registry.readSession(f.r1, CS_OLD_A).active, true, 'nothing changed');
        assert.equal(registry.readSession(f.r1, CS_OLD_B).active, true, 'nothing changed');
    } finally {
        s.close();
    }
});

test('POST /clear-stale reports the rows it refused', async () => {
    const f = clearStaleFixture(true);
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const page = await request(s.url, { method: 'GET' });
        const nonce = /name="nonce" value="([^"]+)"/.exec(page.text)[1];
        const form = (o) => new URLSearchParams(o).toString();
        const res = await request(s.url + 'clear-stale',
            { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } },
            form({ root: f.r1, nonce }));
        assert.equal(res.status, 409);
        assert.match(res.text, /cleared 2; refused 1/);
        assert.match(res.text, new RegExp(CS_FRESH + ': fresh'));
        assert.equal(registry.readSession(f.r1, CS_FRESH).active, true, 'the fresh row is refused, not force-cleared');
        assert.equal(registry.readSession(f.r1, CS_OLD_A).active, false, 'an old row is still cleared alongside a refusal');
        assert.equal(registry.readSession(f.r1, CS_OLD_B).active, false);
    } finally {
        s.close();
    }
});

test('POST /clear-stale clears a too-fresh row when force is sent', async () => {
    const f = clearStaleFixture(true);
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const page = await request(s.url, { method: 'GET' });
        const nonce = /name="nonce" value="([^"]+)"/.exec(page.text)[1];
        const form = (o) => new URLSearchParams(o).toString();
        const res = await request(s.url + 'clear-stale',
            { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } },
            form({ root: f.r1, nonce, force: '1' }));
        assert.equal(res.status, 303, 'force lets the whole batch clear rather than reporting a refusal');
        assert.equal(res.headers.location, '/?cleared=3', 'all three, the too-fresh one included');
        assert.equal(registry.readSession(f.r1, CS_FRESH).active, false, 'the too-fresh row is cleared when force is sent');
        assert.equal(registry.readSession(f.r1, CS_OLD_A).active, false);
        assert.equal(registry.readSession(f.r1, CS_OLD_B).active, false);
    } finally {
        s.close();
    }
});

// The sixty-second `--scan` budget was exercised by nothing: every `--scan`
// test walks a temp tree that finishes in milliseconds, so a build that dropped
// the deadline — leaving the walk bounded only by depth, which is what it was
// before this change — passed all of them unchanged. Timing a real walk long
// enough to hit sixty seconds is not a test anyone would keep, so what is
// checked here is that the budget is computed and handed to the walk, which is
// the part that was missing. The walk's own obedience to a deadline is proved
// by `scanRoots stops mid-walk when its deadline is spent` in station.test.js.
test('a --scan run is given the sixty-second budget and a run with nothing to scan is given none', () => {
    const { scanDeadline } = require('../scripts/station.js');
    assert.equal(scanDeadline([]), undefined, 'nothing to scan, no clock');
    assert.equal(scanDeadline(undefined), undefined);
    const before = Date.now();
    const deadline = scanDeadline(['anywhere']);
    assert.ok(deadline >= before + 60000 && deadline <= Date.now() + 60000,
        'a minute out — not a second, and not Infinity: ' + (deadline - before) + 'ms');
});

test('serve hands that budget to the walk on every request, and hands none when there is nothing to scan', async () => {
    const f = fixture();
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-scan-budget-'));
    const { serve } = require('../scripts/station.js');
    const real = station.gather;
    const seen = [];
    station.gather = (opts) => { seen.push(opts); return real(opts); };
    let scanning = null;
    let plain = null;
    try {
        scanning = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false, scan: [empty] });
        const before = Date.now();
        await request(scanning.url, { method: 'GET' });
        assert.equal(seen.length, 1, 'one render, one gather');
        assert.ok(Number.isFinite(seen[0].deadline), 'the scan walk is bounded by a deadline');
        assert.ok(seen[0].deadline >= before + 55000 && seen[0].deadline <= Date.now() + 60000,
            'and the bound is the sixty-second budget: ' + (seen[0].deadline - before) + 'ms');

        plain = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
        await request(plain.url, { method: 'GET' });
        assert.equal(seen.length, 2);
        assert.equal(seen[1].deadline, undefined, 'a render with no --scan carries no clock');
    } finally {
        station.gather = real;
        if (scanning) scanning.close();
        if (plain) plain.close();
    }
});

test('--forget drops one root and keeps the rest', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-forget-'));
    const cfg = path.join(base, 'cfg');
    const rootsFile = path.join(cfg, 'fankeel', 'roots.json');
    fs.mkdirSync(path.dirname(rootsFile), { recursive: true });
    const keep = path.resolve(path.join(base, 'keep'));
    const drop = path.resolve(path.join(base, 'drop'));
    const now = new Date().toISOString();
    fs.writeFileSync(rootsFile, JSON.stringify({ [keep]: now, [drop]: now }, null, 2) + '\n');
    const env = { ...process.env, CLAUDE_CONFIG_DIR: cfg };
    const out = execFileSync(process.execPath, [CLI, '--forget', drop], { cwd: base, env, encoding: 'utf8' });
    assert.match(out, /forgot/);
    const after = JSON.parse(fs.readFileSync(rootsFile, 'utf8'));
    assert.ok(!Object.prototype.hasOwnProperty.call(after, drop), 'the forgotten root is gone');
    assert.ok(Object.prototype.hasOwnProperty.call(after, keep), 'the other root is kept');
});

test('--forget drops only the named root and keeps the scannedAt record', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-forget-scanrec-'));
    const cfg = path.join(base, 'cfg');
    const rootsFile = path.join(cfg, 'fankeel', 'roots.json');
    fs.mkdirSync(path.dirname(rootsFile), { recursive: true });
    const keep = path.resolve(path.join(base, 'keep'));
    const drop = path.resolve(path.join(base, 'drop'));
    const now = new Date().toISOString();
    const scannedAt = { at: now, roots: 2, depthCuts: 0, timedOut: false };
    fs.writeFileSync(rootsFile, JSON.stringify({ [keep]: now, [drop]: now, scannedAt }, null, 2) + '\n');
    const env = { ...process.env, CLAUDE_CONFIG_DIR: cfg };
    const out = execFileSync(process.execPath, [CLI, '--forget', drop], { cwd: base, env, encoding: 'utf8' });
    assert.match(out, /forgot/);
    const after = JSON.parse(fs.readFileSync(rootsFile, 'utf8'));
    assert.ok(!Object.prototype.hasOwnProperty.call(after, drop), 'the forgotten root is gone');
    assert.ok(Object.prototype.hasOwnProperty.call(after, keep), 'the other root is kept');
    assert.deepEqual(after.scannedAt, scannedAt, 'the first-run scan record survives forgetting an unrelated root');
});

test('--forget on a root nobody remembers says so and changes nothing', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-forget-'));
    const cfg = path.join(base, 'cfg');
    const rootsFile = path.join(cfg, 'fankeel', 'roots.json');
    fs.mkdirSync(path.dirname(rootsFile), { recursive: true });
    const keep = path.resolve(path.join(base, 'keep'));
    const now = new Date().toISOString();
    fs.writeFileSync(rootsFile, JSON.stringify({ [keep]: now }, null, 2) + '\n');
    const env = { ...process.env, CLAUDE_CONFIG_DIR: cfg };
    const out = execFileSync(process.execPath, [CLI, '--forget', path.join(base, 'never-seen')], { cwd: base, env, encoding: 'utf8' });
    assert.match(out, /not remembered/);
    const after = JSON.parse(fs.readFileSync(rootsFile, 'utf8'));
    assert.ok(Object.prototype.hasOwnProperty.call(after, keep), 'the only known root survives an unknown --forget');
});

test('the first run scans once and records that it did', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-autoscan-'));
    const cfg = path.join(base, 'cfg');
    fs.mkdirSync(cfg, { recursive: true });
    const env = { ...process.env, CLAUDE_CONFIG_DIR: cfg };
    const rootsFile = path.join(cfg, 'fankeel', 'roots.json');
    assert.ok(!fs.existsSync(rootsFile), 'nothing has written roots.json for this config dir yet');

    const t0 = Date.now();
    const out1 = execFileSync(process.execPath, [CLI], { cwd: base, env, encoding: 'utf8', timeout: 20000 });
    const elapsed1 = Date.now() - t0;
    assert.match(out1, /first run/);

    const after1 = JSON.parse(fs.readFileSync(rootsFile, 'utf8'));
    assert.ok(after1.scannedAt && typeof after1.scannedAt.at === 'string', 'roots.json records that the scan ran');
    const stamp1 = after1.scannedAt.at;

    // Whatever that walk had to give up on has to reach the page, not only
    // stdout: `discover` never saw this walk, so the header's two scan-cut
    // lines are silent unless `main()` hands `autoScan`'s counts into
    // `write()`. Guarded on the record rather than asserted flat, because a
    // machine small enough to finish every drive inside five seconds cuts
    // nothing and should say nothing.
    const page1 = fs.readFileSync(path.join(cfg, 'fankeel', 'station.html'), 'utf8');
    if (after1.scannedAt.timedOut) {
        assert.match(page1, /the scan ran out of time/, 'a walk that ran out of time says so on the page');
    }
    if (after1.scannedAt.depthCuts > 0) {
        assert.ok(page1.includes('depth stopped the scan in ' + after1.scannedAt.depthCuts + ' places'),
            'the page carries the same count of depth cuts the record does');
    }

    const t1 = Date.now();
    const out2 = execFileSync(process.execPath, [CLI], { cwd: base, env, encoding: 'utf8', timeout: 20000 });
    const elapsed2 = Date.now() - t1;
    assert.ok(!/first run/.test(out2), 'a second run does not announce a scan');

    const after2 = JSON.parse(fs.readFileSync(rootsFile, 'utf8'));
    assert.equal(after2.scannedAt.at, stamp1, 'scannedAt is not rewritten by a run that did not scan');

    // Not the CLI: `station.write()` is what `hooks/inject.js` runs on every
    // `/fankeel` prompt, and it is the writer that used to rebuild roots.json
    // without this key. The record only counts as durable if it survives that.
    station.write({ configDir: cfg, cwd: base });
    const after3 = JSON.parse(fs.readFileSync(rootsFile, 'utf8'));
    assert.deepEqual(after3.scannedAt, after2.scannedAt,
        'a write of the page from outside this CLI leaves the scan record alone');

    // The budget is 5 seconds; a run that actually walked the machine's drives
    // again would sit near it, the way the first run just did. Three seconds
    // is comfortably below that and comfortably above what an ordinary run —
    // read a small registry, render a page — costs.
    assert.ok(elapsed2 < 3000, 'a run with roots.json already present does not re-walk the drives (took ' + elapsed2 + 'ms)');
    // The first run is the one AUTO_BUDGET_MS exists to bound, and until this
    // line the suite measured it and threw the number away — a budget raised to
    // anything under this test's own 20-second `timeout` shipped green. Measured
    // here on 2026-09-06: 6.0 seconds for a 5-second budget, so a second of
    // node start-up, the readdir in flight when the deadline landed, and the
    // write of the page. Nine seconds leaves that margin doubled and still
    // catches a budget moved to ten seconds or beyond. It is deliberately a
    // literal rather than `AUTO_BUDGET_MS + slack`: a bound that moves with the
    // budget is a bound the budget cannot break.
    assert.ok(elapsed1 < 9000, 'the first run stays inside its scan budget (took ' + elapsed1 + 'ms)');
});
