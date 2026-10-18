'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'mod.ts')).href);

test('mod register wires the compact hook, the pane, the band, one turn.complete, the turn.step effort observer, nothing else', async () => {
    const { register } = await load();
    const calls = [];
    register((...args) => { calls.push(args); });
    assert.deepEqual(calls.map((a) => a[0]).sort(), ['agent.spawn', 'command.run', 'session.start', 'turn.complete', 'turn.step', 'ui.render', 'ui.render'],
        'mod.ts registers a different set: ' + JSON.stringify(calls.map((a) => a[0])));
    assert.deepEqual(calls.filter((a) => a[0] === 'ui.render').map((a) => a[1].component).sort(), ['AbovePrompt', 'Pane']);
});

const ID = 'abcdef12-0000-4000-8000-000000000001';

function spawnFake({ files = {}, root = 'F:/proj/sub', failWrite = false } = {}) {
    const written = {};
    const logs = [];
    const $ = {
        session: { id: async () => ID, root: async () => root },
        fs: {
            exists: async (p) => Object.prototype.hasOwnProperty.call(files, p),
            write: async (p, text) => { if (failWrite) throw new Error('EACCES'); written[p] = text; },
        },
        ui: { log: (text, opts) => logs.push([text, opts]) },
    };
    return { $, written, logs };
}

async function spawnHandler() {
    const { register } = await load();
    let handler;
    register((name, fn) => { if (name === 'agent.spawn') handler = fn; });
    return handler;
}

const live = { ['F:/proj/.fankeel/sessions/' + ID + '.json']: '{}' };
const spawnInput = { prompt: 'build group 2\nthe rest of the brief', subagentType: 'fankeel:fankeel-brain', parentAgentId: 'p1' };

test('agent.spawn writes the spawn record once next() has answered the agentId', async () => {
    const handler = await spawnHandler();
    const { $, written } = spawnFake({ files: live });
    const out = await handler($, spawnInput, async () => ({ model: 'sonnet', agentId: 'a9' }));
    assert.deepEqual(out, { model: 'sonnet', agentId: 'a9' });
    const file = 'F:/proj/.fankeel/build/spawn/a9.json';
    assert.deepEqual(Object.keys(written), [file]);
    const record = JSON.parse(written[file]);
    assert.deepEqual([record.prompt, record.subagentType, record.parentAgentId], ['build group 2', 'fankeel:fankeel-brain', 'p1']);
    assert.ok(!Number.isNaN(Date.parse(record.at)), record.at);
});

test('agent.spawn keeps only the first 200 characters of the first line, and an empty parentAgentId from main', async () => {
    const handler = await spawnHandler();
    const { $, written } = spawnFake({ files: live });
    await handler($, { prompt: 'x'.repeat(500), subagentType: 'Explore' }, async () => ({ model: 'sonnet', agentId: 'a1' }));
    const record = JSON.parse(written['F:/proj/.fankeel/build/spawn/a1.json']);
    assert.equal(record.prompt.length, 200);
    assert.equal(record.parentAgentId, '');
});

test('agent.spawn writes nothing for a deny, an unsafe agentId, or a session with no registry entry', async () => {
    const handler = await spawnHandler();
    for (const [files, answer] of [[live, { deny: 'no' }], [live, { model: 'sonnet', agentId: '../x' }], [{}, { model: 'sonnet', agentId: 'a2' }]]) {
        const { $, written } = spawnFake({ files });
        assert.deepEqual(await handler($, spawnInput, async () => answer), answer);
        assert.deepEqual(written, {});
    }
});

test('a write that fails is logged once to debug and never blocks the spawn', async () => {
    const handler = await spawnHandler();
    const { $, logs } = spawnFake({ files: live, failWrite: true });
    const next = async () => ({ model: 'sonnet', agentId: 'a3' });
    assert.deepEqual(await handler($, spawnInput, next), { model: 'sonnet', agentId: 'a3' });
    assert.deepEqual(await handler($, spawnInput, next), { model: 'sonnet', agentId: 'a3' });
    assert.equal(logs.length, 1, JSON.stringify(logs));
    assert.deepEqual(logs[0][1], { to: 'debug' });
});
