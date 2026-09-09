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
const tmp = require('./tmp.js');

const CLI = path.join(__dirname, '..', 'scripts', 'station.js');
const LIVE = 'aaaaaaaa-1111-4111-8111-111111111111';
const STALE = 'bbbbbbbb-2222-4222-8222-222222222222';
const DAY = 24 * 3600e3;
// A pid no operating system hands out, the same constant `tests/carry.test.js`
// uses for one that is gone.
const GONE_PID = 2147483646;

function fixture() {
    const base = tmp('fankeel-station-cli-');
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
    const file = path.join(f.cfg, 'fankeel', 'index.html');
    assert.ok(out.includes(file));
    assert.match(out, /1 registries · 1 live, 1 stale, 0 down/);
    const dataFile = path.join(f.cfg, 'fankeel', 'station', 'station-data.js');
    assert.ok(fs.readFileSync(dataFile, 'utf8').includes('"state":"stale"'));
});

test('--json prints the rows as one JSON document and writes nothing', () => {
    const f = fixture();
    const env = { ...process.env, CLAUDE_CONFIG_DIR: f.cfg };
    const out = execFileSync(process.execPath, [CLI, '--json'], { cwd: f.base, env, encoding: 'utf8' });
    const model = JSON.parse(out);
    const states = model.registries.flatMap((r) => r.sessions.map((s) => s.state)).sort();
    assert.deepEqual(states, ['live', 'stale']);
    assert.equal(fs.existsSync(path.join(f.cfg, 'fankeel', 'index.html')), false, '--json wrote the page');
    assert.equal(fs.existsSync(path.join(f.r1, '.fankeel', 'index.html')), false, '--json wrote the copy');
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
    assert.ok(fs.readFileSync(path.join(f.cfg, 'fankeel', 'station', 'station-data.js'), 'utf8').includes('scanned'));
    const again = execFileSync(process.execPath, [CLI], { cwd: f.base, env, encoding: 'utf8' });
    assert.match(again, /2 registries/, 'roots.json remembered the scanned registry');
    const inside = execFileSync(process.execPath, [CLI], { cwd: far, env, encoding: 'utf8' });
    assert.match(inside, /copy at /);
    assert.ok(fs.existsSync(path.join(far, '.fankeel', 'index.html')), 'run from inside a registry, the copy lands there');
});

test('serve renders live, refuses a bad nonce, refuses a live row, clears a stale one, then exits when idle', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const page = await request(s.url, { method: 'GET' });
        assert.equal(page.status, 200);
        const data = await request(s.url + 'station/station-data.js', { method: 'GET' });
        assert.match(data.text, /"serve":true/);
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
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

test('serve answers the shell and its three siblings', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const page = await request(s.url, { method: 'GET' });
        assert.equal(page.status, 200);
        assert.match(page.headers['content-type'], /text\/html/);
        assert.ok(!page.text.includes('window.STATION'), 'the shell inlined the data');

        const data = await request(s.url + 'station/station-data.js', { method: 'GET' });
        assert.equal(data.status, 200);
        assert.match(data.headers['content-type'], /javascript/);
        assert.match(data.text, /^window\.STATION = /);
        assert.match(data.text, /"serve":true/);

        assert.equal((await request(s.url + 'station/station.css', { method: 'GET' })).status, 200);
        assert.equal((await request(s.url + 'station/station.js', { method: 'GET' })).status, 200);
        assert.equal((await request(s.url + 'nothing', { method: 'GET' })).status, 404);
    } finally {
        s.close();
    }
});

test('GET / answers 404 when the shell cannot be read', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    // `render()` is what the route calls; it is not given a path to fail on,
    // so this stands in for a missing or unreadable `assets/station/` without
    // touching the real plugin directory — the same way `station.gather` is
    // swapped out below to observe a call this file cannot otherwise see.
    const real = station.render;
    station.render = () => { throw new Error('ENOENT: no such file or directory'); };
    let s = null;
    try {
        s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
        const res = await request(s.url, { method: 'GET' });
        assert.equal(res.status, 404);
        assert.match(res.headers['content-type'], /text\/plain/);
        assert.match(res.text, /assets directory/, 'the reason names the directory, not a single file');
    } finally {
        station.render = real;
        if (s) s.close();
    }
});

// --- Task 2: serve starts once, on a port that does not move ---

test('a second serve() call joins the first rather than binding its own port', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const first = await serve({ configDir: f.cfg, port: 0, idleMs: 0, open: false });
    try {
        const second = await serve({ configDir: f.cfg, port: 0, idleMs: 0, open: false });
        assert.equal(second.url, first.url, 'the second call resolves to the first\'s url');
        assert.equal(second.joined, true, 'the second call reports that it joined rather than bound');
        const record = JSON.parse(fs.readFileSync(path.join(f.cfg, 'fankeel', 'serve.json'), 'utf8'));
        assert.equal(record.pid, process.pid, 'serve.json holds one pid — this process, since both calls ran in it');
        assert.equal(record.url, first.url);
    } finally {
        first.close();
    }
});

test('serve.json is written once the listener binds and removed once it closes', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const record = path.join(f.cfg, 'fankeel', 'serve.json');
    assert.equal(fs.existsSync(record), false, 'nothing before the server has bound');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 0, open: false });
    assert.ok(fs.existsSync(record), 'serve.json exists once the listener is bound');
    const data = JSON.parse(fs.readFileSync(record, 'utf8'));
    assert.equal(data.pid, process.pid);
    assert.equal(data.url, s.url);
    assert.ok(Number.isInteger(data.port) && data.port > 0);
    assert.ok(typeof data.started === 'string' && !Number.isNaN(Date.parse(data.started)));
    s.close();
    assert.equal(fs.existsSync(record), false, 'serve.json is removed once the server closes');
});

test('idleMs: 0 arms no timer, rather than the old default falling back on a falsy value', async (t) => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    // A fake timer that advances real elapsed time (`t.mock.timers`) is not
    // usable here: Node's own HTTP keep-alive bookkeeping is built on the same
    // timer wheel, so ticking it forward resets live sockets for reasons that
    // have nothing to do with `touch()`, ten minutes early or not. Spying on
    // `setTimeout` itself — record what it is called with, then run the real
    // one — proves the same thing (no idle timer armed for `idleMs: 0`)
    // without touching how the server's own connections behave.
    const armed = [];
    const real = global.setTimeout;
    t.mock.method(global, 'setTimeout', (fn, ms, ...rest) => {
        armed.push(ms);
        return real(fn, ms, ...rest);
    });
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 0, open: false });
    try {
        await request(s.url, { method: 'GET' });
        assert.ok(!armed.some((ms) => ms >= 60e3),
            'idleMs: 0 armed a timer of at least a minute: ' + JSON.stringify(armed));
    } finally {
        s.close();
    }
});

test('--detach is parsed, and portWasExplicit only when --port was given', () => {
    const { parseArgs } = require('../scripts/station.js');
    const a = parseArgs(['serve', '--detach']);
    assert.equal(a.detach, true, '--detach is parsed');
    assert.ok(!a.portWasExplicit, 'no --port: portWasExplicit is falsy');
    const b = parseArgs(['serve', '--port', '1234']);
    assert.equal(b.detach, false);
    assert.equal(b.portWasExplicit, true, '--port given: portWasExplicit is true');
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
    const base = tmp('fankeel-clear-stale-');
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
        const data = await request(s.url + 'station/station-data.js', { method: 'GET' });
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
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
        // And the data the shell fetches next says so, which is the half a
        // redirect cannot do by itself.
        const after = await request(s.url + 'station/station-data.js?cleared=2', { method: 'GET' });
        assert.equal(after.status, 200);
        assert.match(after.text, /"cleared":2/);
        const plain = await request(s.url + 'station/station-data.js', { method: 'GET' });
        assert.ok(!plain.text.includes('"cleared"'),
            'data loaded without the query says nothing about clearing');
        const junk = await request(s.url + 'station/station-data.js?cleared=lots', { method: 'GET' });
        assert.ok(!junk.text.includes('"cleared"'),
            'a non-numeric count is ignored rather than echoed into the data');
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
        const data = await request(s.url + 'station/station-data.js', { method: 'GET' });
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
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
        const data = await request(s.url + 'station/station-data.js', { method: 'GET' });
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
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

test('POST /profile writes a project key, refuses a bad nonce, a bad key, and an unknown project', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const data = await request(s.url + 'station/station-data.js', { method: 'GET' });
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
        assert.match(data.text, /"profiles":\{"machine":/);
        const form = (o) => new URLSearchParams(o).toString();
        const post = (body) => request(s.url + 'profile', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } }, body);
        assert.equal((await post(form({ scope: 'project', project: f.r1, key: 'land.push', value: 'false', nonce: 'wrong' }))).status, 403);
        assert.equal((await post(form({ scope: 'project', project: f.r1, key: 'colour', value: 'blue', nonce }))).status, 400);
        assert.equal((await post(form({ scope: 'project', project: path.join(f.base, 'nowhere'), key: 'land.push', value: 'false', nonce }))).status, 404);
        const ok = await post(form({ scope: 'project', project: f.r1, key: 'land.push', value: 'false', nonce }));
        assert.equal(ok.status, 303);
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.r1, '.fankeel', 'profile.json'), 'utf8')), { 'land.push': false });
        const machine = await post(form({ scope: 'machine', key: 'guard', value: 'deny', nonce }));
        assert.equal(machine.status, 303);
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.cfg, 'fankeel', 'profile.json'), 'utf8')), { guard: 'deny' });
        const after = await request(s.url + 'station/station-data.js', { method: 'GET' });
        assert.match(after.text, /"land\.push":false/);
        assert.match(after.text, /"guard":"deny"/);
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
    const empty = tmp('fankeel-scan-budget-');
    const { serve } = require('../scripts/station.js');
    const real = station.gather;
    const seen = [];
    station.gather = (opts) => { seen.push(opts); return real(opts); };
    let scanning = null;
    let plain = null;
    try {
        scanning = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false, scan: [empty] });
        // A bind now gathers once on its own, to remember its own leads before
        // returning — so one gather has already happened before any request.
        assert.equal(seen.length, 1, 'the bind remembered its own leads with one gather');
        const before = Date.now();
        // The shell itself no longer gathers anything — it is a static file —
        // so the request that triggers a gather is the one for its data.
        await request(scanning.url + 'station/station-data.js', { method: 'GET' });
        assert.equal(seen.length, 2, 'one render, one more gather');
        assert.ok(Number.isFinite(seen[1].deadline), 'the scan walk is bounded by a deadline');
        assert.ok(seen[1].deadline >= before + 55000 && seen[1].deadline <= Date.now() + 60000,
            'and the bound is the sixty-second budget: ' + (seen[1].deadline - before) + 'ms');

        // A distinct configDir: same `f.cfg` here would join `scanning` via
        // `serve.json` rather than bind a second server, and this half of the
        // test is about deadline propagation on a fresh one, not about the
        // join behaviour `station-cli.test.js`'s Task 2 tests cover already.
        const plainCfg = fixture().cfg;
        plain = await serve({ configDir: plainCfg, port: 0, idleMs: 60e3, open: false });
        assert.equal(seen.length, 3, 'the second bind remembered its own leads too');
        await request(plain.url + 'station/station-data.js', { method: 'GET' });
        assert.equal(seen.length, 4);
        assert.equal(seen[3].deadline, undefined, 'a render with no --scan carries no clock');
    } finally {
        station.gather = real;
        if (scanning) scanning.close();
        if (plain) plain.close();
    }
});

test('--forget drops one root and keeps the rest', () => {
    const base = tmp('fankeel-forget-');
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
    const base = tmp('fankeel-forget-scanrec-');
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
    const base = tmp('fankeel-forget-');
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
    const base = tmp('fankeel-autoscan-');
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
    // nothing and should say nothing. The rendering of that count into words
    // is `station.js`'s, in the browser; what the server writes is the data
    // those words come from.
    const data1 = fs.readFileSync(path.join(cfg, 'fankeel', 'station', 'station-data.js'), 'utf8');
    if (after1.scannedAt.timedOut) {
        assert.match(data1, /"timedOut":true/, 'a walk that ran out of time says so in the data');
    }
    if (after1.scannedAt.depthCuts > 0) {
        assert.ok(data1.includes('"depthCuts":' + after1.scannedAt.depthCuts),
            'the data carries the same count of depth cuts the record does');
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

// The one check neither half had: `station-shell.test.js` reads the shell as a
// string and `serve answers the shell and its three siblings` hits the routes by
// name, so the shell could ask for a path the server never answered and both
// stayed green. It did, for the length of one build: the shell moved to
// `station/…` and the routes did not, and the served page rendered blank.
test('every asset the shell references answers from the server', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const shell = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'index.html'), 'utf8');
    const refs = [];
    // The data script is written by `document.write` so the page's own query
    // string rides along, which means an href/src scan grabs a fragment of that
    // JavaScript string rather than a path. Every asset lives under `station/`.
    const re = /station\/[A-Za-z0-9._-]+\.(?:css|js)/g;
    let m;
    while ((m = re.exec(shell))) if (refs.indexOf(m[0]) < 0) refs.push(m[0]);
    assert.ok(refs.length >= 3, 'the shell names only ' + refs.length + ' local assets');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        for (const ref of refs) {
            const got = await request(s.url + ref, { method: 'GET' });
            assert.equal(got.status, 200, ref + ' answered ' + got.status);
        }
    } finally {
        s.close();
    }
});

// A server killed rather than closed leaves its record behind — `close()` is
// what removes it, and a hard kill never runs. So the join guard has to read a
// record naming a dead pid as no record at all. `docs/station.md` says it does;
// until now the only tests were the live-pid join and the write-and-remove pair,
// so the sentence was documented and unexercised.
test('a serve.json naming a dead pid does not stop a new server binding', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const record = path.join(f.cfg, 'fankeel', 'serve.json');
    fs.mkdirSync(path.dirname(record), { recursive: true });
    fs.writeFileSync(record, JSON.stringify({
        pid: GONE_PID, port: 7817, url: 'http://127.0.0.1:7817/',
        started: '2026-09-08T00:00:00.000Z',
    }) + '\n');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 0, open: false });
    let second = null;
    try {
        assert.notEqual(s.joined, true, 'it joined a server whose pid nobody is running');
        const after = JSON.parse(fs.readFileSync(record, 'utf8'));
        assert.equal(after.pid, process.pid, 'the new listener rewrote the record');
        assert.notEqual(after.url, 'http://127.0.0.1:7817/', 'and with its own url, not the dead one');

        // The record now names this process, which is alive. Nothing else about
        // the situation changed, so a second call joining is what separates "read
        // the record and rejected a dead pid" from "never read the record" — the
        // assertion above holds under both.
        second = await serve({ configDir: f.cfg, port: 0, idleMs: 0, open: false });
        assert.equal(second.joined, true, 'the record is not being read at all');
        assert.equal(second.url, s.url, 'it joined something other than the server the record names');
    } finally {
        // close() on a joined result is a no-op; on a bound one it is what keeps
        // this test from hanging when the guard is broken, which is the state a
        // mutation check puts it in.
        if (second) second.close();
        s.close();
    }
});

// --- probe replaces the pid check, and the joiner's own leads reach the page ---

test('serve() ignores a serve.json whose pid is dead', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const blocker = http.createServer(() => {});
    await new Promise((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    const deadPort = blocker.address().port;
    await new Promise((resolve) => blocker.close(resolve));
    const record = path.join(f.cfg, 'fankeel', 'serve.json');
    fs.mkdirSync(path.dirname(record), { recursive: true });
    fs.writeFileSync(record, JSON.stringify({
        pid: 999999, port: deadPort, url: 'http://127.0.0.1:' + deadPort + '/',
        started: new Date().toISOString(),
    }) + '\n');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 0, open: false });
    try {
        assert.notEqual(s.joined, true, 'it joined a record whose port nothing listens on');
        const after = JSON.parse(fs.readFileSync(record, 'utf8'));
        assert.equal(after.pid, process.pid, 'the new listener rewrote the record with its own pid');
        const health = await request(s.url + 'station/health', { method: 'GET' });
        assert.equal(health.status, 200);
    } finally {
        s.close();
    }
});

test('serve() does not join a live pid whose port is not a station', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const impostor = http.createServer((q, r) => { r.writeHead(200); r.end('nope'); });
    await new Promise((resolve) => impostor.listen(0, '127.0.0.1', resolve));
    try {
        const impostorPort = impostor.address().port;
        const record = path.join(f.cfg, 'fankeel', 'serve.json');
        fs.mkdirSync(path.dirname(record), { recursive: true });
        fs.writeFileSync(record, JSON.stringify({
            pid: process.pid, port: impostorPort, url: 'http://127.0.0.1:' + impostorPort + '/',
            started: new Date().toISOString(),
        }) + '\n');
        const s = await serve({ configDir: f.cfg, port: 0, idleMs: 0, open: false });
        try {
            assert.notEqual(s.joined, true, 'it joined a live pid that answers as something other than a station');
            const after = JSON.parse(fs.readFileSync(record, 'utf8'));
            assert.notEqual(after.port, impostorPort, 'the record no longer names the impostor\'s port');
        } finally {
            s.close();
        }
    } finally {
        impostor.close();
    }
});

test('a joining serve() writes its own leads into roots.json', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const r2 = tmp('fankeel-station-leads-');
    fs.mkdirSync(path.join(r2, '.fankeel', 'sessions'), { recursive: true });
    const first = await serve({ configDir: f.cfg, port: 0, idleMs: 0, open: false });
    try {
        const second = await serve({ configDir: f.cfg, port: 0, idleMs: 0, open: false, roots: [r2] });
        assert.equal(second.joined, true, 'the second call joined rather than bound');
        assert.ok(Object.keys(station.readRoots(f.cfg)).includes(path.resolve(r2)),
            'the joiner\'s own lead reached roots.json');
    } finally {
        first.close();
    }
});

test('a server pushed off its port rebinds it once it frees', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const blocker = http.createServer(() => {});
    await new Promise((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    const P = blocker.address().port;
    let blockerClosed = false;
    let s = null;
    try {
        s = await serve({ configDir: f.cfg, port: P, portWasExplicit: false, idleMs: 0, open: false, retryMs: 30 });
        assert.notEqual(Number(new URL(s.url).port), P, 'the fallback did not land on the blocked port: ' + s.url);
        await new Promise((resolve) => blocker.close(resolve));
        blockerClosed = true;
        const record = path.join(f.cfg, 'fankeel', 'serve.json');
        const deadline = Date.now() + 2000;
        let rebound = null;
        while (Date.now() < deadline) {
            let data;
            try {
                data = JSON.parse(fs.readFileSync(record, 'utf8'));
            } catch (e) { data = null; }
            if (data && data.port === P) { rebound = data; break; }
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert.ok(rebound, 'serve.json never named the freed port ' + P);
        const onFixed = await request('http://127.0.0.1:' + P + '/station/health', { method: 'GET' });
        assert.equal(onFixed.status, 200, 'the fixed port answers health once rebound');
        const onOriginal = await request(s.url + 'station/health', { method: 'GET' });
        assert.equal(onOriginal.status, 200, 'the original ephemeral listener is still open');
    } finally {
        if (!blockerClosed) blocker.close();
        if (s) s.close();
    }
});

test('GET /station/health names this process', async () => {
    const f = fixture();
    const { serve, probe } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 0, open: false });
    try {
        const res = await request(s.url + 'station/health', { method: 'GET' });
        assert.equal(res.status, 200);
        assert.match(res.headers['content-type'], /json/);
        const body = JSON.parse(res.text);
        assert.equal(body.station, true);
        assert.equal(body.pid, process.pid);
        // `probe` reads this same route: a record naming this server's own
        // pid is confirmed live by the health check it just answered.
        assert.equal(await probe({ url: s.url, pid: process.pid }), true);
    } finally {
        s.close();
    }
});
