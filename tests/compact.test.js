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
            // A directory is a key holding '' in these fakes.
            stat: async (p) => {
                if (!Object.prototype.hasOwnProperty.call(files, p)) throw new Error('ENOENT');
                return { kind: files[p] === '' ? 'dir' : 'file', size: 0, mtimeMs: 0, isLink: false };
            },
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

const profileAt = (file, data) => ({ [file]: JSON.stringify(data) });

test('compact.at in the project profile sets the threshold', async () => {
    const files = { ...entryAt('F:/proj', live), ...profileAt('F:/proj/.fankeel/profile.json', { 'compact.at': '350000' }) };
    const { $, calls } = fake({ tokens: 360000, files });
    await fire(handlerOf(await load()), $);
    assert.equal(calls.length, 1);
});

test('compact.at off never compacts, even far above HARD', async () => {
    const files = { ...entryAt('F:/proj', live), ...profileAt('F:/proj/.fankeel/profile.json', { 'compact.at': 'off' }) };
    const { $, calls } = fake({ tokens: 700000, files });
    await fire(handlerOf(await load()), $);
    assert.equal(calls.length, 0);
});

test('compact.at is read from the entry\'s project directory and its configDir machine file', async () => {
    const mod = await load();
    const sub = { ...live, project: 'app' };
    let f = { ...entryAt('F:/proj', sub), 'F:/proj/app': '', ...profileAt('F:/proj/app/.fankeel/profile.json', { 'compact.at': '600000' }) };
    let r = fake({ tokens: 500000, files: f });
    await fire(handlerOf(mod), r.$);
    assert.equal(r.calls.length, 0);
    f = { ...entryAt('F:/proj', { ...live, configDir: 'C:/cfg' }), ...profileAt('C:/cfg/fankeel/profile.json', { 'compact.at': '350000' }) };
    r = fake({ tokens: 360000, files: f });
    await fire(handlerOf(mod), r.$);
    assert.equal(r.calls.length, 1);
});

// lib/docs.js projectRootsFor: the project's first segment, when it is a directory.
async function projectCompacts(project, extra) {
    const files = {
        ...entryAt('F:/proj', { ...live, project }),
        ...profileAt('F:/proj/.fankeel/profile.json', { 'compact.at': '350000' }),
        ...profileAt('F:/proj/app/.fankeel/profile.json', { 'compact.at': 'off' }),
        ...profileAt('F:/proj/app/src/.fankeel/profile.json', { 'compact.at': '350000' }),
        ...extra,
    };
    const r = fake({ tokens: 360000, files });
    await fire(handlerOf(await load()), r.$);
    return r.calls.length;
}

test('a project of app/src reads the profile of its first segment, app', async () => {
    assert.equal(await projectCompacts('app/src', { 'F:/proj/app': '' }), 0);
    assert.equal(await projectCompacts('.\\app\\src', { 'F:/proj/app': '' }), 0);
});

test('a project naming a directory that does not exist reads the root profile', async () => {
    assert.equal(await projectCompacts('app', {}), 1);
});

test('a project whose first segment is a file reads the root profile', async () => {
    assert.equal(await projectCompacts('app/src', { 'F:/proj/app': 'not a directory' }), 1);
});

test('a project containing .. or starting with / reads the root profile', async () => {
    assert.equal(await projectCompacts('app/../x', { 'F:/proj/app': '' }), 1);
    assert.equal(await projectCompacts('/app', { 'F:/proj/app': '' }), 1);
    assert.equal(await projectCompacts('./', { 'F:/proj/': '' }), 1);
});

test('the project profile beats the machine one and FANKEEL_COMPACT_AT beats both', async () => {
    const mod = await load();
    const files = {
        ...entryAt('F:/proj', { ...live, configDir: 'C:/cfg' }),
        ...profileAt('F:/proj/.fankeel/profile.json', { 'compact.at': '600000' }),
        ...profileAt('C:/cfg/fankeel/profile.json', { 'compact.at': '350000' }),
    };
    let r = fake({ tokens: 400000, files });
    await fire(handlerOf(mod), r.$);
    assert.equal(r.calls.length, 0);
    r = fake({ tokens: 400000, files, env: '1000' });
    await fire(handlerOf(mod), r.$);
    assert.equal(r.calls.length, 1);
});

test('an unparsable or invalid profile falls back to HARD', async () => {
    const mod = await load();
    for (const raw of ['{not json', JSON.stringify({ 'compact.at': '123' })]) {
        const files = { ...entryAt('F:/proj', live), 'F:/proj/.fankeel/profile.json': raw };
        const r = fake({ tokens: CONTEXT_HARD, files });
        await fire(handlerOf(mod), r.$);
        assert.equal(r.calls.length, 1, raw);
        const b = fake({ tokens: CONTEXT_HARD - 1, files });
        await fire(handlerOf(mod), b.$);
        assert.equal(b.calls.length, 0, raw);
    }
});

test('an unparsable profile file logs one debug line naming it; a missing file or a profile without the key logs none', async () => {
    const mod = await load();
    const file = 'F:/proj/.fankeel/profile.json';
    const run = async (extra) => {
        const r = fake({ tokens: CONTEXT_HARD, files: { ...entryAt('F:/proj', live), ...extra } });
        const logs = [];
        r.$.ui.log = (text) => { logs.push(text); };
        await fire(handlerOf(mod), r.$);
        assert.equal(r.calls.length, 1);
        return logs.filter((l) => /unreadable profile/.test(l));
    };
    const bad = await run({ [file]: '{not json' });
    assert.equal(bad.length, 1);
    assert.ok(bad[0].includes(file), bad[0]);
    assert.deepEqual(await run({}), []);
    assert.deepEqual(await run({ [file]: JSON.stringify({ guard: 'off' }) }), []);
    assert.deepEqual(await run({ [file]: JSON.stringify({ 'compact.at': '123' }) }), []);
});

test('compact.at written as a JSON number is that tier; a number outside the tiers is absent', async () => {
    const mod = await load();
    const run = async (value, tokens) => {
        const files = { ...entryAt('F:/proj', live), ...profileAt('F:/proj/.fankeel/profile.json', { 'compact.at': value }) };
        const r = fake({ tokens, files });
        await fire(handlerOf(mod), r.$);
        return r.calls.length;
    };
    assert.equal(await run(600000, 500000), 0);
    assert.equal(await run(600000, 610000), 1);
    assert.equal(await run(123, CONTEXT_HARD - 1), 0);
    assert.equal(await run(123, CONTEXT_HARD), 1);
    assert.equal(await run([600000], CONTEXT_HARD), 1);
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

// docs/90-agent/plans/2026-10-10-workflow-gaps-design.md §6: a no-plan build
// reads its denominator back from design.md once the summary has replaced the chat.
test('the summary is told to keep the design.md and context.md paths', async () => {
    const { instructionsFor } = await load();
    const lines = instructionsFor(ID, live, 'F:/plugin').split('\n');
    assert.ok(lines.includes('- the design.md and context.md paths under .fankeel/build/, when the conversation named them'), lines.join(' | '));
    assert.equal(lines[lines.length - 1], '- the plugin scripts live under F:/plugin/scripts');
});
