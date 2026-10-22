'use strict';
// lib/serve.js: whether a station is serving, and starting one detached.
//
// The first test is the one thing the design could not settle by reading
// (its 還沒驗證的): that a serve started detached by a process which exits
// soon after — the way hooks/inject.js starts it — still answers once that
// process, and the process above it, have both gone. The rest hold
// ensureServe to the four answers the `/fankeel` block prints.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const serve = require('../lib/serve.js');
const live = require('../lib/live.js');
const tmp = require('./tmp.js');

const PLUGIN = path.join(__dirname, '..');
const LIB = path.join(PLUGIN, 'lib', 'serve.js');
// A pid no operating system hands out, the same constant tests/carry.test.js uses.
const GONE_PID = 2147483646;

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

async function recordWithin(cfg, ms) {
    const until = Date.now() + ms;
    for (;;) {
        const rec = serve.readServeRecord(cfg);
        if (rec && typeof rec.url === 'string') return rec;
        if (Date.now() >= until) return null;
        await sleep(50);
    }
}

function writeRecord(cfg, rec) {
    fs.mkdirSync(path.dirname(serve.serveRecordPath(cfg)), { recursive: true });
    fs.writeFileSync(serve.serveRecordPath(cfg), JSON.stringify(rec) + '\n');
}

// A listener in this process answering /station/health for `pid` — or, with
// `hang`, taking the request and never answering it. `fingerprint`, when
// given, rides along in the body the same way `scripts/station.js` puts one
// there for real. `delayMs` holds the answer back that long, for a probe that
// must outwait it.
function listener(opts) {
    const o = opts || {};
    let hits = 0;
    const server = http.createServer((req, res) => {
        if (req.url !== '/station/health') {
            res.writeHead(404);
            res.end();
            return;
        }
        hits += 1;
        if (o.hang) return;
        const answer = () => {
            const body = { station: true, pid: o.pid, started: new Date().toISOString() };
            if (o.fingerprint !== undefined) body.fingerprint = o.fingerprint;
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify(body));
        };
        if (o.delayMs) setTimeout(answer, o.delayMs);
        else answer();
    });
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            resolve({
                url: 'http://127.0.0.1:' + server.address().port + '/',
                hits: () => hits,
                close: () => new Promise((r) => {
                    server.closeAllConnections();
                    server.close(r);
                }),
            });
        });
    });
}

test('a serve started detached outlives the process that started it and the one above that', async (t) => {
    const cfg = tmp('fankeel-serve-');
    const env = Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg });
    // The hook: what hooks/inject.js does on a `/fankeel` prompt — ask, start,
    // wait for the record, print the answer, exit. `--port 0` keeps the serve
    // off 28888 and any station already there; `--idle 2` is the backstop
    // should the kill below never run.
    const hook = 'require(' + JSON.stringify(LIB) + ').ensureServe({ configDir: ' + JSON.stringify(cfg)
        + ', plugin: ' + JSON.stringify(PLUGIN) + ", open: false, extra: ['--port', '0', '--idle', '2'],"
        + ' until: Date.now() + 4000 }).then((r) => { process.stdout.write(JSON.stringify(r)); });';
    // Claude Code: runs the hook as an ordinary child, passes its output on, exits.
    const host = "const r = require('node:child_process').spawnSync(process.execPath, ['-e', "
        + JSON.stringify(hook) + "], { encoding: 'utf8' });"
        + " process.stdout.write(r.stdout || ''); process.exit(r.status === null ? 1 : r.status);";
    const began = Date.now();
    const ran = spawnSync(process.execPath, ['-e', host], { env, encoding: 'utf8', timeout: 20000 });
    assert.equal(ran.status, 0, 'the host or the hook did not exit cleanly: ' + ran.stderr);
    const said = JSON.parse(ran.stdout);
    assert.ok(said.state === 'started' || said.state === 'starting', 'the hook answered ' + ran.stdout);
    const rec = await recordWithin(cfg, 10000);
    assert.ok(rec, 'no serve.json ten seconds after both parents exited');
    t.diagnostic('serve.json ' + (Date.now() - began) + ' ms after the host started; the hook said ' + said.state);
    if (said.state === 'started') assert.equal(said.url, rec.url);
    try {
        // Both parents are gone: spawnSync returned only once the host exited,
        // and the host only once the hook had. A second more, for anything that
        // reaps a process tree after its root exits.
        await sleep(1000);
        // A single 2-second probe can time out under a CPU-starved machine
        // with the station still alive and still the one answering: measured
        // under 28 competing busy loops, `live.running` said alive both
        // before and after a timed-out probe, and a retried probe with more
        // budget then answered true in 3.6s. So this retries while the
        // recorded pid is still running, up to an outer 10-second budget —
        // and a genuinely dead station stops this at once, on the first
        // `live.running` check that finds the pid gone, rather than waiting
        // out the whole budget.
        const patience = Date.now() + 10000;
        let alive = false;
        for (;;) {
            alive = await serve.probe(rec, 2000);
            if (alive || !live.running(rec.pid) || Date.now() >= patience) break;
            await sleep(200);
        }
        assert.equal(alive, true, 'the station died with the process that started it');
        // The wiring, not just the unit: a real `scripts/station.js serve`
        // has to put the fingerprint in its own health body, or every live
        // station would read as stale to `ensureServe`'s `o.plugin` check.
        const body = await new Promise((resolve, reject) => {
            http.get(rec.url + 'station/health', { agent: false }, (res) => {
                let text = '';
                res.setEncoding('utf8');
                res.on('data', (c) => { text += c; });
                res.on('end', () => resolve(JSON.parse(text)));
            }).on('error', reject);
        });
        assert.equal(body.fingerprint, serve.diskFingerprint(PLUGIN),
            'scripts/station.js does not put the disk fingerprint in /station/health');
    } finally {
        try { process.kill(rec.pid); } catch (e) { /* already gone */ }
    }
    // The control: the same probe goes false once the station is killed, so
    // the true above was the station answering and not the probe.
    let gone = false;
    for (let i = 0; i < 50 && !gone; i++) {
        gone = !(await serve.probe(rec, 300));
        if (!gone) await sleep(100);
    }
    assert.ok(gone, 'the station still answers after it was killed');
});

test('probe is true only for a listener naming the recorded pid, and false for a gone pid, another pid, or silence', async () => {
    const mine = await listener({ pid: process.pid });
    const other = await listener({ pid: process.pid + 1 });
    const silent = await listener({ hang: true });
    try {
        assert.equal(await serve.probe({ pid: process.pid, url: mine.url }), true);
        assert.equal(await serve.probe({ pid: GONE_PID, url: mine.url }), false, 'a pid the OS denies');
        assert.equal(mine.hits(), 1, 'a gone pid is ruled out before the round trip');
        assert.equal(await serve.probe({ pid: process.pid, url: other.url }), false, 'a listener naming another pid');
        const began = Date.now();
        assert.equal(await serve.probe({ pid: process.pid, url: silent.url }, 200), false, 'a listener that never answers');
        const took = Date.now() - began;
        assert.ok(took >= 150 && took < 2000, 'the timeout bounds the whole request: ' + took + ' ms');
        assert.equal(await serve.probe(null), false);
    } finally {
        await Promise.all([mine.close(), other.close(), silent.close()]);
    }
});

// A hook calls fetchHealth and then has to exit on its own
// (hooks/inject.js, through ensureServe). This test guards the child's
// exit time (under 3 s), not a particular cause: a mutation to http.get
// with the default keep-alive agent was run and left it green, so it does
// not prove an idle socket is caught.
test('a process that probes a station exits on its own within 3 seconds', async () => {
    const mine = await listener({ pid: process.pid });
    try {
        const script = "require(process.argv[1]).probe({ pid: Number(process.argv[2]), url: process.argv[3] }, 2000).then((ok) => { process.stdout.write(String(ok)); });";
        const began = Date.now();
        const out = await new Promise((resolve) => {
            const child = spawn(process.execPath, ['-e', script, LIB, String(process.pid), mine.url]);
            let text = '';
            child.stdout.setEncoding('utf8');
            child.stdout.on('data', (c) => { text += c; });
            const kill = setTimeout(() => child.kill(), 15000);
            child.on('close', () => { clearTimeout(kill); resolve(text); });
        });
        const took = Date.now() - began;
        assert.equal(out, 'true', 'the child reached the station');
        assert.ok(took < 3000, 'the child exited on its own: ' + took + ' ms');
    } finally {
        await mine.close();
    }
});

test('a station that answers is running, and nothing is started', async () => {
    const cfg = tmp('fankeel-serve-');
    const st = await listener({ pid: process.pid, fingerprint: serve.diskFingerprint(PLUGIN) });
    writeRecord(cfg, { pid: process.pid, port: 0, url: st.url, started: new Date().toISOString() });
    const calls = [];
    try {
        const got = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: (o) => { calls.push(o); } });
        assert.deepEqual(got, { state: 'running', url: st.url });
        assert.equal(calls.length, 0, 'a running station is not started again, so no browser opens');
    } finally {
        await st.close();
    }
});

test('a deadline already spent still gives a live station its probe, so it is running and nothing is started', async () => {
    // hooks/inject.js hands `until` in after a synchronous station.write; when
    // that write ran long, `until` had passed and the probe got 1 ms, so a
    // live station read as down and a second one was started.
    const cfg = tmp('fankeel-serve-');
    const st = await listener({ pid: process.pid, fingerprint: serve.diskFingerprint(PLUGIN), delayMs: 50 });
    writeRecord(cfg, { pid: process.pid, port: 0, url: st.url, started: new Date().toISOString() });
    const calls = [];
    try {
        const got = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: (o) => { calls.push(o); }, until: Date.now() - 1000 });
        assert.deepEqual(got, { state: 'running', url: st.url });
        assert.equal(calls.length, 0, 'a live station is not started again');
    } finally {
        await st.close();
    }
});

test('with no station, one is started with --open, and its url comes back once its record appears', async () => {
    const cfg = tmp('fankeel-serve-');
    const calls = [];
    const start = (o) => {
        calls.push(o);
        setTimeout(() => writeRecord(cfg, { pid: 4242, port: 7817, url: 'http://127.0.0.1:7817/', started: 'now' }), 100);
    };
    const got = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start, until: Date.now() + 3000 });
    assert.deepEqual(got, { state: 'started', url: 'http://127.0.0.1:7817/' });
    assert.equal(calls.length, 1);
    assert.deepEqual([calls[0].plugin, calls[0].open], [PLUGIN, true]);
});

test('a start whose record has not appeared by the deadline is starting, and a dead record is never read as the new one', async () => {
    const cfg = tmp('fankeel-serve-');
    let began = Date.now();
    assert.deepEqual(await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: () => {}, until: began + 300 }),
        { state: 'starting', url: null });
    assert.ok(Date.now() - began < 1500, 'the deadline bounds the wait');
    // A crashed station's record: its pid is gone, so the probe fails at once,
    // and the url it still names must not come back as the station just started.
    writeRecord(cfg, { pid: GONE_PID, port: 7817, url: 'http://127.0.0.1:7817/', started: 'old' });
    const calls = [];
    began = Date.now();
    assert.deepEqual(await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: (o) => { calls.push(o); }, until: began + 300 }),
        { state: 'starting', url: null });
    assert.equal(calls.length, 1, 'a dead record is a station to start');
    const fresh = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, until: Date.now() + 2000,
        start: () => { setTimeout(() => writeRecord(cfg, { pid: 4243, port: 7817, url: 'http://127.0.0.1:7817/', started: 'new' }), 50); } });
    assert.deepEqual(fresh, { state: 'started', url: 'http://127.0.0.1:7817/' });
});

// A station inside a synchronous gather() takes the connection and does not
// answer. Its pid is running and the request times out: busy, not dead, so
// nothing is started and its record stays.
test('a station whose pid runs but whose health times out is busy: nothing is started and serve.json stays', async () => {
    const cfg = tmp('fankeel-serve-');
    const slow = await listener({ pid: process.pid, fingerprint: serve.diskFingerprint(PLUGIN), delayMs: 3000 });
    writeRecord(cfg, { pid: process.pid, port: 0, url: slow.url, started: 'busy' });
    const calls = [];
    try {
        const began = Date.now();
        const got = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: (o) => { calls.push(o); }, until: began + 1600 });
        const took = Date.now() - began;
        assert.deepEqual(got, { state: 'busy', url: slow.url });
        assert.equal(calls.length, 0, 'a busy station got a second one started beside it');
        assert.ok(took >= 900, 'the probe waited its second: ' + took + ' ms');
        assert.ok(took < 2600, 'and the whole call kept to its deadline: ' + took + ' ms');
        assert.equal(serve.readServeRecord(cfg).started, 'busy', 'the busy station\'s record was removed or replaced');
    } finally {
        await slow.close();
    }
});

// The unverified half of the design, measured: a station whose own event loop
// is blocked, in a process of its own, still has its connection accepted by
// the OS, so the probe times out rather than being refused.
test('a station whose own event loop is blocked is busy, not dead, and nothing is started', async () => {
    const cfg = tmp('fankeel-serve-');
    const portFile = path.join(cfg, 'port');
    const script = "const http = require('node:http'); const fs = require('node:fs');"
        + "const s = http.createServer((q, r) => { r.end('{}'); });"
        + "s.listen(0, '127.0.0.1', () => { fs.writeFileSync(process.argv[1], String(s.address().port));"
        + " const until = Date.now() + 4000; while (Date.now() < until) { /* a synchronous gather */ } process.exit(0); });";
    const child = spawn(process.execPath, ['-e', script, portFile], { stdio: 'ignore' });
    try {
        let port = null;
        for (let i = 0; i < 100 && !port; i++) {
            try { port = Number(fs.readFileSync(portFile, 'utf8')) || null; } catch (e) { /* not yet */ }
            if (!port) await sleep(50);
        }
        assert.ok(port, 'the child never bound');
        const url = 'http://127.0.0.1:' + port + '/';
        writeRecord(cfg, { pid: child.pid, port, url, started: 'blocked' });
        const calls = [];
        const got = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: (o) => { calls.push(o); }, until: Date.now() + 1600 });
        assert.deepEqual(got, { state: 'busy', url });
        assert.equal(calls.length, 0, 'a blocked station was read as dead and a second one started');
        assert.equal(serve.readServeRecord(cfg).pid, child.pid);
    } finally {
        try { child.kill(); } catch (e) { /* already gone */ }
    }
});

// The control for the two above: a running pid whose recorded port refuses
// at once is dead, not busy — a timeout is what busy means, not any failure.
test('a running pid whose recorded port refuses is dead, so one is started', async () => {
    const cfg = tmp('fankeel-serve-');
    const gone = await listener({ pid: process.pid });
    const url = gone.url;
    await gone.close();
    writeRecord(cfg, { pid: process.pid, port: 0, url, started: 'refused' });
    const calls = [];
    const got = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: (o) => { calls.push(o); }, until: Date.now() + 300 });
    assert.equal(calls.length, 1, 'a refused port was read as busy');
    assert.deepEqual(got, { state: 'starting', url: null });
});

test('health answers answered, busy or dead, and never rejects', async () => {
    const ok = await listener({ pid: process.pid });
    const other = await listener({ pid: process.pid + 1 });
    const hang = await listener({ hang: true });
    try {
        const a = await serve.health({ pid: process.pid, url: ok.url }, 500);
        assert.equal(a.state, 'answered');
        assert.equal(a.body.pid, process.pid);
        assert.deepEqual(await serve.health({ pid: process.pid, url: hang.url }, 300), { state: 'busy' });
        assert.deepEqual(await serve.health({ pid: GONE_PID, url: hang.url }, 300), { state: 'dead' });
        assert.deepEqual(await serve.health({ pid: process.pid, url: other.url }, 300), { state: 'dead' });
        assert.deepEqual(await serve.health(null, 300), { state: 'dead' });
    } finally {
        await ok.close();
        await other.close();
        await hang.close();
    }
});

test('a start that throws is failed, and never a rejection', async () => {
    const cfg = tmp('fankeel-serve-');
    const got = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: () => { throw new Error('spawn EACCES'); } });
    assert.deepEqual(got, { state: 'failed', url: null });
});

test('a station whose fingerprint no longer matches disk is stopped and started fresh', async () => {
    const cfg = tmp('fankeel-serve-');
    // A stand-in for the old station's OS process: a real child, so
    // `process.kill` and `live.running` both see something real, without
    // spawning `scripts/station.js` itself — this test is about
    // `ensureServe`'s decision, not a second real serve.
    const oldChild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
    const st = await listener({ pid: oldChild.pid, fingerprint: 'stale-fingerprint' });
    writeRecord(cfg, { pid: oldChild.pid, port: 0, url: st.url, started: 'old' });
    const calls = [];
    try {
        const got = await serve.ensureServe({
            configDir: cfg, plugin: PLUGIN,
            start: (o) => {
                calls.push(o);
                setTimeout(() => writeRecord(cfg, { pid: 4321, port: 7817, url: 'http://127.0.0.1:7817/', started: 'new' }), 50);
            },
            until: Date.now() + 2000,
        });
        assert.deepEqual(got, { state: 'started', url: 'http://127.0.0.1:7817/' });
        assert.equal(calls.length, 1, 'a stale fingerprint is a station to start, same as none');
        // The stale process is not left running: ensureServe stops it before
        // asking for a fresh one, so a hook that gets "started" back never
        // leaves two stations pointed at one port.
        let dead = false;
        for (let i = 0; i < 50 && !dead; i++) {
            dead = !live.running(oldChild.pid);
            if (!dead) await sleep(50);
        }
        assert.ok(dead, 'the stale station is still running after ensureServe replaced it');
    } finally {
        try { oldChild.kill(); } catch (e) { /* already gone, which is the point */ }
        await st.close();
    }
});

test('ensureServe carries serve.json\'s remote: an https url or a string warning, nothing else', async () => {
    const cfg = tmp('fankeel-serve-');
    const st = await listener({ pid: process.pid, fingerprint: serve.diskFingerprint(PLUGIN) });
    const record = (remote) => writeRecord(cfg, Object.assign({ pid: process.pid, port: 0, url: st.url, started: new Date().toISOString() }, remote === undefined ? {} : { remote }));
    const ask = () => serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: () => {} });
    try {
        record({ url: 'https://ymlab-pc.tail1234.ts.net/' });
        assert.deepEqual(await ask(), { state: 'running', url: st.url, remote: { url: 'https://ymlab-pc.tail1234.ts.net/' } });
        record({ warning: 'tailscale is Stopped, not Running' });
        assert.deepEqual(await ask(), { state: 'running', url: st.url, remote: { warning: 'tailscale is Stopped, not Running' } });
        for (const bad of [{ url: 'http://evil.example/' }, { url: 'https://a.b/path' }, { warning: 42 }, { warning: '  ' }, 'x', null, {}]) {
            record(bad);
            assert.deepEqual(await ask(), { state: 'running', url: st.url }, JSON.stringify(bad));
        }
        record();
        assert.deepEqual(await ask(), { state: 'running', url: st.url });
    } finally {
        await st.close();
    }
});

test('a station started by this call brings its remote back with the url', async () => {
    const cfg = tmp('fankeel-serve-');
    const start = () => {
        setTimeout(() => writeRecord(cfg, { pid: 4244, port: 7817, url: 'http://127.0.0.1:7817/', started: 'now', remote: { warning: 'tailscale is Stopped, not Running' } }), 50);
    };
    const got = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start, until: Date.now() + 3000 });
    assert.deepEqual(got, { state: 'started', url: 'http://127.0.0.1:7817/', remote: { warning: 'tailscale is Stopped, not Running' } });
});
