'use strict';
// registry.readAll(root, { shelf: true }) reads the shelf as well (lib/shelf.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');

test('readAll merges shelved entries only when asked, local first on a shared id', () => {
    process.env.CLAUDE_CONFIG_DIR = tmp('registry-shelf-config');
    const registry = require('../lib/registry.js');
    const shelf = require('../lib/shelf.js');
    const root = tmp('registry-shelf-root');
    const local = path.join(root, '.fankeel', 'sessions');
    const shelved = path.join(shelf.shelfDir(root), 'sessions');
    fs.mkdirSync(local, { recursive: true });
    fs.mkdirSync(shelved, { recursive: true });
    fs.writeFileSync(path.join(local, 'cccccccc-0002.json'), JSON.stringify({ task: 'local' }));
    fs.writeFileSync(path.join(shelved, 'cccccccc-0001.json'), JSON.stringify({ task: 'shelved' }));
    fs.writeFileSync(path.join(shelved, 'cccccccc-0002.json'), JSON.stringify({ task: 'stale copy' }));
    assert.deepEqual(registry.readAll(root).entries.map((e) => e.data.task), ['local']);
    assert.deepEqual(registry.readAll(root, { shelf: true }).entries.map((e) => e.sessionId + ':' + e.data.task), ['cccccccc-0001:shelved', 'cccccccc-0002:local']);
});

test('a root with no sessions directory still reads its shelf', () => {
    process.env.CLAUDE_CONFIG_DIR = tmp('registry-shelf-config2');
    const registry = require('../lib/registry.js');
    const shelf = require('../lib/shelf.js');
    const root = tmp('registry-shelf-root2');
    const shelved = path.join(shelf.shelfDir(root), 'sessions');
    fs.mkdirSync(shelved, { recursive: true });
    fs.writeFileSync(path.join(shelved, 'cccccccc-0003.json'), JSON.stringify({ task: 'only shelved' }));
    assert.deepEqual(registry.readAll(root, { shelf: true }).entries.map((e) => e.sessionId), ['cccccccc-0003']);
});
