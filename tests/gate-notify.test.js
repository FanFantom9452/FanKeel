'use strict';
// hooks/gate.js and notify.gate (docs/90-agent/plans/2026-10-21-station-remote-design.md §5):
// a question the hook lets out is one ntfy publish — priority 4, a click and an
// 打開 gate action into the phone page — carrying the stage, the first question
// and the task cut to 80 characters, and nothing else; a question the hook
// refuses sends none; and no publish, on, off or unreachable, changes the
// hook's stdout or its exit code. The hook is spawned rather than
// execFileSync'd, so this file's stub server answers while it runs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const tmp = require('./tmp.js');

const GATE = path.join(__dirname, '..', 'hooks', 'gate.js');
const SID = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const NAME = 'ymlab-pc.tail1234.ts.net';
const TOPIC = 'fankeel-00112233445566778899';
const TASK = 'rework the colour ramp so the station reads the same in light and dark, every chart and every card included';
// The first option names the next stage and there are three of them, so the
// hook adds no thin-gate line (hooks/gate.js thinGate).
const QUESTIONS = [
    { header: 'design', question: '設計可以進 plan 嗎？', multiSelect: false, options: [
        { label: '核准，進 plan', description: '照這份設計寫計畫' },
        { label: '改設計', description: '先改再問' },
        { label: '暫停', description: '先停在這裡' },
    ] },
    { header: 'design', question: 'a second question that stays on this machine', multiSelect: false, options: [
        { label: 'yes', description: 'y' },
        { label: 'no', description: 'n' },
    ] },
];

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

// A registry with one session at design, and the config directory its entry
// names holding the station's serve.json with a tailnet address.
function fixture(over) {
    const base = tmp('fankeel-gate-notify-');
    const root = path.join(base, 'ws');
    const cfg = path.join(base, 'cfg');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    const now = Date.now();
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SID + '.json'), JSON.stringify(Object.assign({
        task: TASK, stage: 'design', active: true, claims: ['secret/plan-notes.md'],
        started: new Date(now - 2 * 3600e3).toISOString(), updated: new Date(now - 3600e3).toISOString(), configDir: cfg,
    }, over), null, 2) + '\n');
    fs.writeFileSync(path.join(cfg, 'fankeel', 'serve.json'), JSON.stringify({ port: 28888, url: 'http://127.0.0.1:28888/', remote: { url: 'https://' + NAME + '/' } }) + '\n');
    return { root, cfg };
}

// The machine profile, where the 手機遠端 card writes the triggers.
const machine = (cfg, values) => fs.writeFileSync(path.join(cfg, 'fankeel', 'profile.json'), JSON.stringify(values, null, 2) + '\n');

function hook(f, toolInput, env) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [GATE], {
            env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: f.root, CLAUDE_CONFIG_DIR: f.cfg, FANKEEL_NOTIFY_TEST: '1' }, env),
        });
        let out = '';
        child.stdout.on('data', (d) => { out += d; });
        child.on('close', (code) => resolve({ out, code }));
        child.stdin.end(JSON.stringify({ session_id: SID, cwd: f.root, tool_name: 'AskUserQuestion', tool_input: toolInput }));
    });
}

test('a question the hook lets out is one publish: priority 4, a click and an 打開 gate action into the phone page', async () => {
    const s = await stub();
    try {
        const f = fixture();
        machine(f.cfg, { 'notify.gate': true, 'notify.topic': TOPIC, 'notify.server': s.url });
        assert.equal((await hook(f, { questions: QUESTIONS })).code, 0);
        assert.equal(await arrived(s.got, 1), 1, 'exactly one publish');
        const { method, url, body } = s.got[0];
        assert.equal(method, 'POST');
        assert.equal(url, '/');
        assert.deepEqual(Object.keys(body).sort(), ['actions', 'click', 'message', 'priority', 'tags', 'title', 'topic']);
        assert.equal(body.topic, TOPIC);
        assert.equal(body.priority, 4);
        assert.deepEqual(body.tags, ['fankeel']);
        assert.equal(body.title, 'design gate 在等你');
        assert.equal(body.click, 'https://' + NAME + '/m#/gate/' + SID);
        assert.deepEqual(body.actions, [{ action: 'view', label: '打開 gate', url: body.click }]);
        const lead = QUESTIONS[0].question + ' — ';
        assert.ok(body.message.startsWith(lead), body.message);
        const tail = body.message.slice(lead.length);
        assert.ok(tail.length <= 80, 'the task is cut to 80 characters: ' + tail);
        assert.ok(TASK.startsWith(tail.replace(/…$/, '')), tail);
        const text = JSON.stringify(body);
        for (const kept of [QUESTIONS[1].question, '改設計', '照這份設計寫計畫', 'secret/plan-notes.md']) {
            assert.ok(!text.includes(kept), kept + ' left for the ntfy server');
        }
    } finally {
        s.server.close();
    }
});

test('notify.gate off, no topic, or node --test without FANKEEL_NOTIFY_TEST: nothing is sent', async () => {
    assert.ok(process.env.NODE_TEST_CONTEXT, 'node --test sets NODE_TEST_CONTEXT, which keeps every other hook test quiet');
    const s = await stub();
    try {
        const cases = [
            [{ 'notify.gate': false, 'notify.topic': TOPIC, 'notify.server': s.url }, {}],
            [{ 'notify.gate': true, 'notify.server': s.url }, {}],
            [{ 'notify.gate': true, 'notify.topic': TOPIC, 'notify.server': s.url }, { FANKEEL_NOTIFY_TEST: '' }],
        ];
        for (const [values, env] of cases) {
            const f = fixture();
            machine(f.cfg, values);
            assert.equal((await hook(f, { questions: QUESTIONS }, env)).code, 0);
        }
        await sleep(1500);
        assert.equal(s.got.length, 0, JSON.stringify(s.got));
    } finally {
        s.server.close();
    }
});

test('a question the hook refuses is no gate waiting, and sends nothing', async () => {
    const s = await stub();
    try {
        // gate.away: the user answered 要離開 earlier and gate.station is off,
        // so the hook holds the question (hooks/gate.js holdsForAway).
        const f = fixture({ leavingAt: Date.now() - 60e3 });
        machine(f.cfg, { 'notify.gate': true, 'notify.topic': TOPIC, 'notify.server': s.url });
        const r = await hook(f, { questions: QUESTIONS });
        assert.equal(r.code, 0);
        assert.equal(JSON.parse(r.out).hookSpecificOutput.permissionDecision, 'deny', r.out);
        assert.match(r.out, /is held, not asked/);
        await sleep(1500);
        assert.equal(s.got.length, 0, JSON.stringify(s.got));
    } finally {
        s.server.close();
    }
});

test('no publish changes what the hook writes or how it exits: on, off and unreachable alike', async () => {
    const s = await stub();
    try {
        const f = fixture();
        const outs = [];
        for (const server of [s.url, 'http://127.0.0.1:1']) {
            for (const on of [true, false]) {
                machine(f.cfg, { 'notify.gate': on, 'notify.topic': TOPIC, 'notify.server': server });
                const r = await hook(f, { questions: QUESTIONS });
                assert.equal(r.code, 0, server + ' ' + on);
                outs.push(r.out);
            }
        }
        assert.equal(new Set(outs).size, 1, outs.join('\n'));
    } finally {
        s.server.close();
    }
});
