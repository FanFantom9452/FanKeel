'use strict';
// serve()'s own life: binding, joining, idling, the shell and its assets, and the port it takes back. Split out of station-cli.test.js on 2026-09-24.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const badge = require('../lib/badge.js');
const station = require('../lib/station.js');
const profile = require('../lib/profile.js');
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
        assert.equal((await request(s.url + 'station/station.css', { method: 'GET' })).headers['cache-control'], 'no-store');
        assert.equal((await request(s.url + 'station/station.js', { method: 'GET' })).status, 200);
        assert.equal((await request(s.url + 'station/station.js', { method: 'GET' })).headers['cache-control'], 'no-store');
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
