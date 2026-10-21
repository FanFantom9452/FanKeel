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
