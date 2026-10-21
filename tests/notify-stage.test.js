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
