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
