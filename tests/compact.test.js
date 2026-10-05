'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { HARD: CONTEXT_HARD } = require('../lib/context.js');

// hooks/compact.ts runs inside the Claude Code engine; Node 24 strips its
// types, so the test imports the very file the engine loads.
const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'compact.ts')).href);
const ID = 'abcdef12-0000-4000-8000-000000000001';
const live = { task: 'demo', stage: 'build', class: 'bounded', active: true };
const entryAt = (dir, data) => ({ [dir + '/.fankeel/sessions/' + ID + '.json']: JSON.stringify(data) });

function fake({ tokens, files = {}, root = 'F:/proj/sub', env }) {
    const calls = [];
    const $ = {
        plugin: { root: 'F:/plugin', name: 'fankeel' },
        session: {
            usage: async () => ({ startedAt: 0, context: { tokens, window: 1000000 }, rateLimits: [] }),
            id: async () => ID,
            root: async () => root,
            compact: async (input) => { calls.push(input); return {}; },
        },
        fs: {
            exists: async (p) => Object.prototype.hasOwnProperty.call(files, p),
            read: async (p) => files[p],
        },
        env: { get: async () => env },
        clock: { sleep: async () => {} },
        ui: { log: () => {} },
    };
    return { $, calls };
}

function handlerOf(mod) {
    let handler;
    mod.register((name, fn) => { if (name === 'turn.complete') handler = fn; });
    return handler;
}

// The compaction is started without being awaited; every fake resolves at
// once, so one setImmediate drains the whole retry chain.
async function fire(handler, $, e = {}) {
    const out = await handler($, { answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer', ...e }, async () => ({ text: 'ok' }));
    await new Promise((r) => setImmediate(r));
    return out;
}

test('the threshold is lib/context.js HARD', async () => {
    assert.equal((await load()).HARD, CONTEXT_HARD);
});

test('compacts the main loop at HARD when an ancestor holds this session\'s active entry', async () => {
    const mod = await load();
    const { $, calls } = fake({ tokens: CONTEXT_HARD, files: entryAt('F:/proj', live) });
    const out = await fire(handlerOf(mod), $);
    assert.deepEqual(out, { text: 'ok' });
    assert.equal(calls.length, 1);
    assert.match(calls[0].instructions, new RegExp('session ' + ID));
    assert.match(calls[0].instructions, /task: demo/);
    assert.match(calls[0].instructions, /stage: build/);
});

test('below HARD nothing is compacted', async () => {
    const { $, calls } = fake({ tokens: CONTEXT_HARD - 1, files: entryAt('F:/proj', live) });
    await fire(handlerOf(await load()), $);
    assert.equal(calls.length, 0);
});

test('a subagent\'s turn is never compacted', async () => {
    const { $, calls } = fake({ tokens: CONTEXT_HARD, files: entryAt('F:/proj', live) });
    await fire(handlerOf(await load()), $, { agentId: 'a1' });
    assert.equal(calls.length, 0);
});

test('no entry, an inactive entry or an init-only entry is left alone', async () => {
    const mod = await load();
    for (const files of [{}, entryAt('F:/proj', { ...live, active: false }), entryAt('F:/proj', { stage: 'init', active: true })]) {
        const { $, calls } = fake({ tokens: CONTEXT_HARD, files });
        await fire(handlerOf(mod), $);
        assert.equal(calls.length, 0, JSON.stringify(files));
    }
});

test('FANKEEL_COMPACT_AT lowers the threshold', async () => {
    const { $, calls } = fake({ tokens: 5, files: entryAt('F:/proj', live), env: '1' });
    await fire(handlerOf(await load()), $);
    assert.equal(calls.length, 1);
});

test('a rejected compaction is retried', async () => {
    const { $, calls } = fake({ tokens: CONTEXT_HARD, files: entryAt('F:/proj', live) });
    let first = true;
    $.session.compact = async (input) => {
        calls.push(input);
        if (first) { first = false; throw new Error('a turn is running'); }
        return {};
    };
    await fire(handlerOf(await load()), $);
    assert.equal(calls.length, 2);
});

// compact-1: the retry loop stops after three tries. A compaction that keeps
// rejecting until its eleventh call shows a lifted cap as eleven calls rather
// than as a hang.
test('a compaction rejected every time is tried three times, each one logged', async () => {
    const { $, calls } = fake({ tokens: CONTEXT_HARD, files: entryAt('F:/proj', live) });
    const logs = [];
    let slept = 0;
    $.ui.log = (text) => { logs.push(text); };
    $.clock.sleep = async () => { slept++; };
    $.session.compact = async (input) => {
        calls.push(input);
        if (calls.length <= 10) throw new Error('a turn is running');
        return {};
    };
    await fire(handlerOf(await load()), $);
    assert.equal(calls.length, 3);
    assert.equal(slept, 3);
    assert.deepEqual(logs.filter((l) => / rejected: /.test(l)).map((l) => l.match(/attempt (\d+)/)[1]), ['1', '2', '3']);
});

test('a second turn while one compaction is pending starts no other', async () => {
    const { $, calls } = fake({ tokens: CONTEXT_HARD, files: entryAt('F:/proj', live) });
    $.session.compact = (input) => { calls.push(input); return new Promise(() => {}); };
    const handler = handlerOf(await load());
    await fire(handler, $);
    await fire(handler, $);
    assert.equal(calls.length, 1);
});

test('parentOf walks both separators up to the root', async () => {
    const { parentOf, isActive } = await load();
    assert.equal(parentOf('F:\\ymlab\\x'), 'F:\\ymlab');
    assert.equal(parentOf('F:/ymlab/'), 'F:');
    assert.equal(parentOf('F:'), null);
    assert.equal(parentOf('/home'), '/');
    assert.equal(parentOf('/'), null);
    assert.equal(isActive(null), false);
});
