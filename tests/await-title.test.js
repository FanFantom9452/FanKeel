'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'await-title.ts')).href);

test('prefixed adds the prefix once', async () => {
    const { prefixed, PREFIX } = await load();
    assert.equal(prefixed('demo'), PREFIX + 'demo');
    assert.equal(prefixed(PREFIX + 'demo'), PREFIX + 'demo');
});

test('the AskUserQuestion hook runs rename and still passes the call on', async () => {
    const mod = await load();
    const runs = [];
    const logs = [];
    const $ = {
        command: { list: async () => [{ name: 'rename' }], run: async (a) => { runs.push(a); return { text: 'ok' }; } },
        clock: { sleep: async () => {} },
        ui: { log: (t) => logs.push(t) },
    };
    let seen;
    mod.register((name, filter, fn) => { seen = { name, filter, fn }; });
    assert.deepEqual([seen.name, seen.filter], ['tool.call', { tool: 'AskUserQuestion' }]);
    const out = await seen.fn($, { tool: 'AskUserQuestion' }, async (e) => ({ passed: e.tool }));
    assert.deepEqual(out, { passed: 'AskUserQuestion' });
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(runs, [{ command: 'rename', args: mod.PREFIX.trim() }]);
});

test('a rejecting rename is retried three times and never breaks the call', async () => {
    const mod = await load();
    let runs = 0;
    const $ = {
        command: { list: async () => [{ name: 'rename' }], run: async () => { runs++; throw new Error('busy'); } },
        clock: { sleep: async () => {} },
        ui: { log: () => {} },
    };
    let fn;
    mod.register((n, f, h) => { fn = h; });
    const out = await fn($, { tool: 'AskUserQuestion' }, async () => 'answered');
    assert.equal(out, 'answered');
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(runs, 3);
});
