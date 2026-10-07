'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'mod.ts')).href);

test('mod register wires only the compact hook', async () => {
    const { register } = await load();
    const calls = [];
    register((...args) => { calls.push(args); });
    assert.deepEqual(calls.map((a) => a[0]), ['turn.complete'],
        'mod.ts registers more than compact: ' + JSON.stringify(calls.map((a) => a[0])));
});
