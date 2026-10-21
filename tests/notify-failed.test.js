'use strict';
// scripts/notify.js's failure record: a publish that does not go out — nothing
// listening, a refusal — appends one line to notify-failed.log beside the
// machine profile, carrying the time and the server's host and nothing of the
// topic, the body or the url path; a publish that goes out writes nothing; the
// file keeps its last 20 lines; and a record that cannot be written changes
// neither the child's silence nor its exit 0.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const notify = require('../lib/notify.js');
const tmp = require('./tmp.js');

const CHILD = path.join(__dirname, '..', 'scripts', 'notify.js');
const TOPIC = 'fankeel-00112233445566778899';
const LINE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z (\S+) unreachable or refused$/;

// A stub ntfy: 200 to every publish but one whose topic is `refuse`, 403.
function stub() {
    const server = http.createServer((req, res) => {
        let text = '';
        req.on('data', (c) => { text += c; });
        req.on('end', () => {
            res.statusCode = JSON.parse(text).topic === 'refuse' ? 403 : 200;
            res.end('{}');
        });
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
        url: 'http://127.0.0.1:' + server.address().port,
        close: () => { server.closeAllConnections(); server.close(); },
    })));
}

// A config directory with its fankeel/ folder, where the machine profile lives.
function configDir() {
    const cfg = path.join(tmp('fankeel-notify-failed-'), 'cfg');
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    return cfg;
}
const logOf = (cfg) => path.join(cfg, 'fankeel', 'notify-failed.log');
const linesOf = (cfg) => fs.readFileSync(logOf(cfg), 'utf8').split('\n').filter(Boolean);

// The child run to its end without blocking this file's stub server.
function child(req) {
    return new Promise((resolve) => {
        const c = spawn(process.execPath, [CHILD, JSON.stringify(req)]);
        let out = '';
        c.stdout.on('data', (d) => { out += d; });
        c.stderr.on('data', (d) => { out += d; });
        c.on('close', (code) => resolve({ code, out }));
    });
}

async function waitFor(pred, ms) {
    const until = Date.now() + ms;
    while (!pred() && Date.now() < until) await new Promise((r) => setTimeout(r, 50));
    return pred();
}

test('a publish fire hands off that does not go out leaves one line beside the machine profile: the time and the host, never the topic or the path', async () => {
    const cfg = configDir();
    const values = { 'notify.gate': true, 'notify.topic': TOPIC, 'notify.server': 'http://127.0.0.1:1/private-path' };
    const env = Object.assign({}, process.env, { FANKEEL_NOTIFY_TEST: '1' });
    assert.equal(notify.fire(values, notify.gateEvent({ task: 'a private task', stage: 'design' }, [{ question: 'a private question' }], 'id'), { base: null, env, configDir: cfg }), true);
    assert.equal(await waitFor(() => fs.existsSync(logOf(cfg)), 10000), true, 'no notify-failed.log beside the machine profile');
    await new Promise((r) => setTimeout(r, 300));
    const lines = linesOf(cfg);
    assert.equal(lines.length, 1, lines.join('\n'));
    assert.equal(LINE.exec(lines[0])[1], '127.0.0.1:1', lines[0]);
    const text = fs.readFileSync(logOf(cfg), 'utf8');
    for (const kept of [TOPIC, 'private-path', 'a private task', 'a private question']) assert.ok(!text.includes(kept), kept + ' is in the record');
});

test('a refused publish is a line too, and one that goes out writes nothing', async () => {
    const s = await stub();
    try {
        const cfg = configDir();
        assert.equal((await child({ url: s.url + '/', body: { topic: TOPIC, message: 'm' }, configDir: cfg })).code, 0);
        assert.equal(fs.existsSync(logOf(cfg)), false, 'a publish that went out left a record');
        assert.equal((await child({ url: s.url + '/', body: { topic: 'refuse' }, configDir: cfg })).code, 0);
        const lines = linesOf(cfg);
        assert.equal(lines.length, 1, lines.join('\n'));
        assert.equal(LINE.exec(lines[0])[1], new URL(s.url).host, lines[0]);
    } finally {
        s.close();
    }
});

test('the record keeps its last 20 lines', async () => {
    const cfg = configDir();
    const old = Array.from({ length: 25 }, (_, i) => '2026-01-01T00:00:00.000Z old-' + i + ' unreachable or refused');
    fs.writeFileSync(logOf(cfg), old.join('\n') + '\n');
    assert.equal((await child({ url: 'http://127.0.0.1:1/', body: { topic: TOPIC }, configDir: cfg })).code, 0);
    const lines = linesOf(cfg);
    assert.equal(lines.length, 20);
    assert.equal(lines[0], old[6]);
    assert.equal(LINE.exec(lines[19])[1], '127.0.0.1:1', lines[19]);
});

test('a record that cannot be written leaves the child silent, exiting 0', async () => {
    const cfg = configDir();
    // A directory where the file would go: the write fails on every platform.
    fs.mkdirSync(logOf(cfg));
    for (const dir of [cfg, path.join(cfg, 'missing'), undefined, 42]) {
        const r = await child({ url: 'http://127.0.0.1:1/', body: { topic: TOPIC }, configDir: dir });
        assert.equal(r.code, 0, String(dir) + ': ' + r.out);
        assert.equal(r.out, '', String(dir));
    }
});
