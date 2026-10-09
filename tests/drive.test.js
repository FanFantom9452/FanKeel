'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const registry = require('../lib/registry.js');
const handoff = require('../lib/handoff.js');
const tmp = require('./tmp.js');
const { capReason, afterAnswer, lastJson, drive } = require('../scripts/drive.js');

const ID = '11111111-2222-4333-8444-555555555555';
const ROUTE = ['survey', 'plan', 'build'];

function gateBlock(status, stage) {
    const nextStage = ROUTE[ROUTE.indexOf(stage) + 1] || 'down';
    const gate = {
        questions: [{
            header: stage,
            question: '下一步？',
            options: [
                { label: nextStage, description: '進下一站。' },
                { label: '留在本站', description: '沒有待決的事。' },
                { label: '暫停', description: 'next 設為暫停。' },
            ],
            multiSelect: false,
        }],
        next: 'paused at ' + stage,
    };
    if (status) gate.status = status;
    return '報告。\n\n```json gate\n' + JSON.stringify(gate) + '\n```\n';
}

function setup() {
    const root = tmp('fankeel-drive-');
    const config = tmp('fankeel-drive-config-');
    registry.writeSession(root, ID, {
        task: 'drive test', route: ROUTE, stage: 'survey', active: true,
        started: '2026-10-10T00:00:00.000Z', updated: '2026-10-10T00:00:00.000Z',
        moves: [['survey', Date.now(), null]], configDir: config,
    });
    return { root, env: { ...process.env, CLAUDE_CONFIG_DIR: config } };
}

// A fake child process: writes the stage's handoff, prints a json result and
// closes after `delayMs`; a kill closes it at once.
function fakeSpawn(root, { status = 'done', usd = 0.1, delayMs = 0 } = {}) {
    return () => {
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.stdin = Object.assign(new EventEmitter(), { end() {} });
        child.pid = 1;
        let closed = false;
        const close = (code) => { if (!closed) { closed = true; child.emit('close', code); } };
        child.kill = () => close(null);
        setTimeout(() => {
            if (closed) return;
            const data = registry.readSession(root, ID);
            const file = handoff.handoffPath(root, data, data.stage, handoff.lapOf(data, data.stage));
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, gateBlock(status, data.stage));
            child.stdout.emit('data', Buffer.from(JSON.stringify({ type: 'result', total_cost_usd: usd }) + '\n'));
            close(0);
        }, delayMs);
        return child;
    };
}

// Answers every gate the moment its pending file appears, with `pick(question)`.
function answerer(root, pick) {
    return async () => {
        await new Promise((r) => setTimeout(r, 15));
        const data = registry.readSession(root, ID);
        const pending = handoff.pendingPath(root, data, data.stage);
        if (!fs.existsSync(pending)) return;
        const { questions } = JSON.parse(fs.readFileSync(pending, 'utf8'));
        const answers = {};
        for (const q of questions) answers[q.question] = pick(q);
        handoff.writeAnswer(handoff.answerPath(root, data, data.stage), JSON.stringify({ answers }) + '\n');
    };
}

const base = (root, env, over) => ({ session: ID, root, env, maxRounds: 12, maxUsd: 20, timeoutMs: 60000, gateWaitMs: 5000, ...over });

test('capReason: rounds, then usd under half a dollar left, then the deadline', () => {
    const caps = { maxRounds: 2, maxUsd: 1 };
    assert.equal(capReason({ rounds: 2, usd: 0 }, caps, 0, 10), 'rounds');
    assert.equal(capReason({ rounds: 1, usd: 0.6 }, caps, 0, 10), 'usd');
    assert.equal(capReason({ rounds: 1, usd: 0 }, caps, 10, 10), 'timeout');
    assert.equal(capReason({ rounds: 1, usd: 0 }, caps, 0, 10), null);
});

test('afterAnswer: option one advances, at the route end it stands down, a pause pauses, anything else relays', () => {
    const gate = { questions: [{ question: 'q', options: [{ label: 'plan' }, { label: '留在本站' }, { label: '暫停' }] }] };
    assert.deepEqual(afterAnswer(gate, { q: 'plan' }, ROUTE, 'survey'), { kind: 'advance', to: 'plan' });
    assert.deepEqual(afterAnswer(gate, { q: 'plan' }, ROUTE, 'build'), { kind: 'down' });
    assert.deepEqual(afterAnswer(gate, { q: '暫停' }, ROUTE, 'survey'), { kind: 'pause' });
    assert.deepEqual(afterAnswer(gate, { q: '留在本站' }, ROUTE, 'survey'), { kind: 'relay' });
});

test('lastJson: the last line that parses as an object', () => {
    assert.deepEqual(lastJson('noise\n{"total_cost_usd":0.2}\n'), { total_cost_usd: 0.2 });
    assert.equal(lastJson('no json here'), null);
});

test('drive stops on rounds when every answer relays', async () => {
    const { root, env } = setup();
    const out = await drive(base(root, env, { maxRounds: 2 }), { spawn: fakeSpawn(root), sleep: answerer(root, () => '留在本站'), pollMs: 5 });
    assert.equal(out.stopped, 'rounds');
    assert.equal(out.rounds, 2);
});

test('drive stops on usd once less than half a dollar is left', async () => {
    const { root, env } = setup();
    const out = await drive(base(root, env, { maxUsd: 1 }), { spawn: fakeSpawn(root, { usd: 0.6 }), sleep: answerer(root, () => '留在本站'), pollMs: 5 });
    assert.equal(out.stopped, 'usd');
    assert.equal(out.rounds, 1);
    assert.equal(out.usd, 0.6);
});

test('drive stops on timeout when a stage outlives the deadline', async () => {
    const { root, env } = setup();
    const out = await drive(base(root, env, { timeoutMs: 100 }), { spawn: fakeSpawn(root, { delayMs: 2000 }), sleep: answerer(root, () => '留在本站'), pollMs: 5 });
    assert.equal(out.stopped, 'timeout');
    assert.equal(out.rounds, 1);
});

test('drive stops on status when the handoff carries none', async () => {
    const { root, env } = setup();
    const out = await drive(base(root, env), { spawn: fakeSpawn(root, { status: null }), sleep: answerer(root, () => '留在本站'), pollMs: 5 });
    assert.equal(out.stopped, 'status');
    assert.equal(out.rounds, 1);
    assert.ok(out.handoff.endsWith('survey.md'));
});

test('drive moves the stage on option one, and its stop line agrees with the registry and the spend', async () => {
    const { root, env } = setup();
    const out = await drive(base(root, env, { maxRounds: 2 }), { spawn: fakeSpawn(root, { usd: 0.25 }), sleep: answerer(root, (q) => q.options[0].label), pollMs: 5 });
    const data = registry.readSession(root, ID);
    assert.equal(out.stopped, 'rounds');
    assert.equal(data.stage, 'build');
    assert.ok(data.moves.some((m) => m[0] === 'plan'));
    assert.equal(out.stage, data.stage);
    assert.equal(out.usd, 0.5);
});
