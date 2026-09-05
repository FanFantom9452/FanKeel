'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const badge = require('../lib/badge.js');

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
        assert.equal(res.headers.location, '/');
        assert.equal(registry.readSession(f.r1, CS_OLD_A).active, false, 'the first stale row is cleared');
        assert.equal(registry.readSession(f.r1, CS_OLD_B).active, false, 'the second stale row is cleared');
        assert.equal(registry.readSession(f.r1, CS_LIVE).active, true, 'the live row is untouched');
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

    const t1 = Date.now();
    const out2 = execFileSync(process.execPath, [CLI], { cwd: base, env, encoding: 'utf8', timeout: 20000 });
    const elapsed2 = Date.now() - t1;
    assert.ok(!/first run/.test(out2), 'a second run does not announce a scan');

    const after2 = JSON.parse(fs.readFileSync(rootsFile, 'utf8'));
    assert.equal(after2.scannedAt.at, stamp1, 'scannedAt is not rewritten by a run that did not scan');
    // The budget is 5 seconds; a run that actually walked the machine's drives
    // again would sit near it, the way the first run just did. Three seconds
    // is comfortably below that and comfortably above what an ordinary run —
    // read a small registry, render a page — costs.
    assert.ok(elapsed2 < 3000, 'a run with roots.json already present does not re-walk the drives (took ' + elapsed2 + 'ms)');
});
