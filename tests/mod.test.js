'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'mod.ts')).href);

test('mod register wires the compact hook and the pane, nothing else', async () => {
    const { register } = await load();
    const calls = [];
    register((...args) => { calls.push(args); });
    assert.deepEqual(calls.map((a) => a[0]).sort(), ['command.run', 'session.start', 'turn.complete', 'ui.render'],
        'mod.ts registers a different set: ' + JSON.stringify(calls.map((a) => a[0])));
});
