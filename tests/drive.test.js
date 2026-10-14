'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const registry = require('../lib/registry.js');
const handoff = require('../lib/handoff.js');
const tmp = require('./tmp.js');
const { parse, capReason, afterAnswer, lastJson, argsFor, insidePlugin, drive } = require('../scripts/drive.js');

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
            child.stdout.emit('data', Buffer.from(usd === null ? 'no json here\n' : JSON.stringify({ type: 'result', total_cost_usd: usd }) + '\n'));
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

test('drive stops on error, naming the cause, when claude cannot be spawned', async () => {
    const { root, env } = setup();
    const spawn = () => {
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.stdin = Object.assign(new EventEmitter(), { end() {} });
        setTimeout(() => child.emit('error', Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' })), 0);
        return child;
    };
    const out = await drive(base(root, env), { spawn, sleep: answerer(root, () => '留在本站'), pollMs: 5 });
    assert.equal(out.stopped, 'error');
    assert.match(out.detail, /ENOENT/);
});

test('drive stops on error, not a rejection, when task.js refuses a move', async () => {
    const { root, env } = setup();
    const task = () => { throw new Error('task.js refused'); };
    const out = await drive(base(root, env), { spawn: fakeSpawn(root), sleep: answerer(root, (q) => q.options[0].label), pollMs: 5, task });
    assert.equal(out.stopped, 'error');
    assert.equal(out.detail, 'task.js refused');
});

test('drive stops on error, naming total_cost_usd, when a round reports no cost', async () => {
    const { root, env } = setup();
    const out = await drive(base(root, env), { spawn: fakeSpawn(root, { usd: null }), sleep: answerer(root, () => '留在本站'), pollMs: 5 });
    assert.equal(out.stopped, 'error');
    assert.equal(out.rounds, 1);
    assert.match(out.detail, /total_cost_usd/);
});

test('drive pauses on a pause answer: next set from the gate, stop line pause', async () => {
    const { root, env } = setup();
    const out = await drive(base(root, env), { spawn: fakeSpawn(root), sleep: answerer(root, () => '暫停'), pollMs: 5 });
    assert.equal(out.stopped, 'pause');
    assert.equal(registry.readSession(root, ID).next, 'paused at survey');
});

test('drive stands down on option one at the route end: task.js down runs, stop down', async () => {
    const { root, env } = setup();
    const data = registry.readSession(root, ID);
    registry.writeSession(root, ID, Object.assign({}, data, { stage: 'build', moves: [['build', Date.now(), null]] }));
    const calls = [];
    const out = await drive(base(root, env), { spawn: fakeSpawn(root), sleep: answerer(root, (q) => q.options[0].label), pollMs: 5, task: (args) => { calls.push(args); } });
    assert.equal(out.stopped, 'down');
    assert.deepEqual(calls, [['down']]);
});

test('drive stops on gate when no answer comes in time, and the pending file is gone', async () => {
    const { root, env } = setup();
    const out = await drive(base(root, env, { gateWaitMs: 60 }), { spawn: fakeSpawn(root), sleep: () => new Promise((r) => setTimeout(r, 10)), pollMs: 5 });
    const data = registry.readSession(root, ID);
    assert.equal(out.stopped, 'gate');
    assert.ok(!fs.existsSync(handoff.pendingPath(root, data, 'survey')));
});

test('parse: the defaults, and a flag overrides one', () => {
    const d = parse([]);
    assert.equal(d.maxRounds, 12);
    assert.equal(d.maxUsd, 20);
    assert.equal(d.timeoutMs, 3600000);
    assert.equal(d.gateWaitMs, 86400000);
    assert.equal(parse(['--max-usd', '3']).maxUsd, 3);
});

test('argsFor: acceptEdits as an adjacent pair, the budget to cents, never bypassPermissions', () => {
    const args = argsFor(1.234);
    const pair = (a, b) => args.some((x, i) => x === a && args[i + 1] === b);
    assert.ok(pair('--permission-mode', 'acceptEdits'));
    assert.ok(pair('--max-budget-usd', '1.23'));
    assert.ok(!args.includes('bypassPermissions'));
});

test('argsFor: --plugin-dir takes the directory it is given, acceptEdits stays, never bypassPermissions', () => {
    const args = argsFor(1, path.join(path.sep, 'copy'));
    assert.equal(args[args.indexOf('--plugin-dir') + 1], path.join(path.sep, 'copy'));
    assert.equal(args[args.indexOf('--permission-mode') + 1], 'acceptEdits');
    assert.ok(!args.includes('bypassPermissions'));
});

test('insidePlugin: the plugin itself and below it, not a sibling or a stranger', () => {
    const plugin = path.resolve('plug');
    assert.equal(insidePlugin(plugin, plugin), true);
    assert.equal(insidePlugin(path.join(plugin, 'sub', 'deep'), plugin), true);
    assert.equal(insidePlugin(plugin + '-other', plugin), false);
    assert.equal(insidePlugin(path.resolve('elsewhere'), plugin), false);
});

test('drive over a root inside the plugin: worktree add before the first spawn, remove after, copy passed as --plugin-dir', async () => {
    const { root, env } = setup();
    const plugin = path.dirname(root);
    const log = [];
    const inner = fakeSpawn(root);
    const spawn = (cmd, argv, o) => { log.push('spawn ' + argv[argv.indexOf('--plugin-dir') + 1]); return inner(cmd, argv, o); };
    const git = (args) => { if (args[3] !== 'prune') log.push('git ' + args[3] + ' ' + args[5]); };
    await drive(base(root, env, { maxRounds: 1 }), { spawn, git, plugin, sleep: answerer(root, () => '留在本站'), pollMs: 5 });
    assert.equal(log.length, 3);
    assert.match(log[0], /^git add .*fankeel-drive-plugin-\d+-\d+$/);
    assert.match(log[1], /^spawn .*fankeel-drive-plugin-\d+-\d+$/);
    assert.match(log[2], /^git remove .*fankeel-drive-plugin-\d+-\d+$/);
});

test('drive over a root inside the plugin prunes stale worktrees before it adds its own', async () => {
    const { root, env } = setup();
    const seen = [];
    const git = (args) => { seen.push(args[3]); };
    await drive(base(root, env, { maxRounds: 1 }), { spawn: fakeSpawn(root), git, plugin: path.dirname(root), sleep: answerer(root, () => '留在本站'), pollMs: 5 });
    assert.ok(seen.indexOf('prune') >= 0 && seen.indexOf('prune') < seen.indexOf('add'));
});

test('drive over a root inside the plugin: a failed worktree remove is reported on stderr and pruned, the stop line stays', async () => {
    const { root, env } = setup();
    const seen = [];
    const git = (args) => { seen.push(args[3]); if (args[3] === 'remove') throw new Error('remove refused'); };
    const written = [];
    const orig = process.stderr.write;
    process.stderr.write = (s) => { written.push(String(s)); return true; };
    let out;
    try {
        out = await drive(base(root, env, { maxRounds: 1 }), { spawn: fakeSpawn(root), git, plugin: path.dirname(root), sleep: answerer(root, () => '留在本站'), pollMs: 5 });
    } finally {
        process.stderr.write = orig;
    }
    assert.equal(out.stopped, 'rounds');
    assert.ok(written.join('').includes('remove refused'));
    assert.ok(seen.lastIndexOf('prune') > seen.indexOf('remove'));
});

test('drive over a root inside the plugin stops on error naming git when the copy cannot be made, and spawns nothing', async () => {
    const { root, env } = setup();
    let spawned = 0;
    const git = () => { throw new Error('fatal: worktree add refused'); };
    const out = await drive(base(root, env), { spawn: () => { spawned++; }, git, plugin: path.dirname(root), sleep: answerer(root, () => '留在本站'), pollMs: 5 });
    assert.equal(out.stopped, 'error');
    assert.match(out.detail, /worktree add refused/);
    assert.equal(spawned, 0);
});
