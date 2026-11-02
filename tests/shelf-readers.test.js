'use strict';
// The readers that list history see shelved entries; adopt brings one back.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tmp = require('./tmp.js');

const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
const old = new Date(Date.now() - 30 * 86400000).toISOString();

function setup() {
    const config = tmp('shelf-readers-config');
    process.env.CLAUDE_CONFIG_DIR = config;
    const shelf = require('../lib/shelf.js');
    const root = tmp('shelf-readers-root');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    const shelved = path.join(shelf.shelfDir(root), 'sessions');
    fs.mkdirSync(shelved, { recursive: true });
    fs.writeFileSync(path.join(shelved, 'dddddddd-0001.json'), JSON.stringify({ task: 'shelved task', active: false, ended: old, updated: old, started: old, stage: 'build', handoff: old, spend: { usd: 2 } }));
    const sh = (...args) => spawnSync(process.execPath, [TASK, ...args, '--root', root], { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: config }) });
    return { root, sh };
}

test('spend counts shelved entries', () => {
    const { root } = setup();
    const spend = require('../lib/spend.js');
    const r = spend.sessionsOf([root]);
    assert.equal(r.scanned, 1);
});

test('show --all lists a shelved entry', () => {
    const { sh } = setup();
    assert.match(sh('show', '--all').stdout, /shelved task/);
});

test('adopt restores a shelved entry before taking it', () => {
    const { root, sh } = setup();
    const r = sh('adopt', 'dddddddd-0001', '--session', 'dddddddd-0002');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(fs.existsSync(path.join(root, '.fankeel', 'sessions', 'dddddddd-0001.json')), true);
    const mine = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', 'dddddddd-0002.json'), 'utf8'));
    assert.equal(mine.task, 'shelved task');
});
