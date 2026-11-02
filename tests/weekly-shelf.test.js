'use strict';
// lib/weekly-collect.js: a session moved to the shelf still answers sessionClaims.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');

test('sessionClaims finds a shelved session by its first 8 characters', () => {
    process.env.CLAUDE_CONFIG_DIR = tmp('weekly-shelf-config');
    const shelf = require('../lib/shelf.js');
    const wc = require('../lib/weekly-collect.js');
    const repo = tmp('weekly-shelf-repo');
    fs.mkdirSync(path.join(repo, '.fankeel', 'sessions'), { recursive: true });
    const shelved = path.join(shelf.shelfDir(repo), 'sessions');
    fs.mkdirSync(shelved, { recursive: true });
    fs.writeFileSync(path.join(shelved, 'eeeeeeee-0001.json'), JSON.stringify({ task: 'shelved', claims: ['lib/a.js'], updated: '2026-10-01T00:00:00.000Z' }));
    assert.deepEqual(wc.sessionClaims(repo)('eeeeeeee'), ['lib/a.js']);
});
