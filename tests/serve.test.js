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
const { spawnSync } = require('node:child_process');
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
// `hang`, taking the request and never answering it.
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
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ station: true, pid: o.pid, started: new Date().toISOString() }));
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
    // off 7817 and any station already there; `--idle 2` is the backstop
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

test('a station that answers is running, and nothing is started', async () => {
    const cfg = tmp('fankeel-serve-');
    const st = await listener({ pid: process.pid });
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

test('a station that does not answer gets its second by default, and the start after it keeps to the deadline', async () => {
    const cfg = tmp('fankeel-serve-');
    const silent = await listener({ hang: true });
    writeRecord(cfg, { pid: process.pid, port: 0, url: silent.url, started: 'x' });
    const calls = [];
    try {
        const began = Date.now();
        const got = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: (o) => { calls.push(o); }, until: began + 1600 });
        const took = Date.now() - began;
        assert.equal(calls.length, 1, 'a silent station counts as none, so one is started');
        assert.ok(took >= 900, 'the probe waited its second: ' + took + ' ms');
        assert.ok(took < 2600, 'and the whole call kept to its deadline: ' + took + ' ms');
        assert.deepEqual(got, { state: 'starting', url: null });
    } finally {
        await silent.close();
    }
});

test('a start that throws is failed, and never a rejection', async () => {
    const cfg = tmp('fankeel-serve-');
    const got = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: () => { throw new Error('spawn EACCES'); } });
    assert.deepEqual(got, { state: 'failed', url: null });
});
