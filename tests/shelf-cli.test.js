'use strict';
// scripts/shelf.js: the command line over lib/shelf.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'shelf.js');
const old = new Date(Date.now() - 30 * 86400000).toISOString();

function setup() {
    const root = tmp('shelf-cli-root');
    const config = tmp('shelf-cli-config');
    const sessions = path.join(root, '.fankeel', 'sessions');
    fs.mkdirSync(sessions, { recursive: true });
    fs.writeFileSync(path.join(sessions, 'bbbbbbbb-0001.json'), JSON.stringify({ task: 'cli old', active: false, ended: old, updated: old, started: old, stage: 'land' }));
    const sh = (...args) => spawnSync(process.execPath, [SCRIPT, ...args, '--root', root], { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: config }) });
    return { sessions, sh };
}

test('dry run, run, find and restore', () => {
    const { sessions, sh } = setup();
    const dry = sh('run', '--dry-run');
    assert.equal(dry.status, 0);
    assert.match(dry.stdout, /^shelf: would move 1 session\(s\), 0 build dir\(s\)/);
    assert.equal(fs.readdirSync(sessions).length, 1);
    const moved = sh('run');
    assert.equal(moved.status, 0);
    assert.match(moved.stdout, /^shelf: moved 1 session\(s\), 0 build dir\(s\), 1 file\(s\)/);
    assert.equal(fs.readdirSync(sessions).length, 0);
    assert.match(sh('find', 'cli').stdout, /bbbbbbbb-0001\s+land\s+cli old/);
    assert.equal(sh('restore', 'bbbbbbbb-0001').status, 0);
    assert.equal(fs.readdirSync(sessions).length, 1);
    assert.equal(sh('restore', 'bbbbbbbb-0001').status, 2);
});

test('bad --days and a missing command are usage errors', () => {
    const { sh } = setup();
    assert.equal(sh('run', '--days', 'x').status, 2);
    assert.equal(sh().status, 2);
});
