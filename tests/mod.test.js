'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'mod.ts')).href);

test('mod register wires both the compact and the await-title hooks', async () => {
    const { register } = await load();
    const calls = [];
    register((...args) => { calls.push(args); });
    assert.ok(calls.some((a) => a[0] === 'turn.complete'), 'turn.complete not registered');
    assert.ok(calls.some((a) => a[0] === 'tool.call' && a.some((x) => x && x.tool === 'AskUserQuestion')),
        'tool.call for AskUserQuestion not registered');
});
