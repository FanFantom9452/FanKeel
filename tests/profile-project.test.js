'use strict';

// profile-3: `--project` naming a directory that does not exist fell back to
// the registry root through projectRootFor, and `profile set` / `profile
// preset` wrote the root's .fankeel/profile.json with exit 0.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
const run = (d, cfg, args) => spawnSync(process.execPath, [TASK, 'profile', ...args, '--root', d, '--claude-dir', cfg], { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });

for (const args of [['set', 'guard', 'ask'], ['preset', 'lean']]) {
    test('profile ' + args[0] + ' refuses a --project that does not exist and writes nothing', () => {
        const d = tmp('fankeel-profile-project-');
        const cfg = path.join(d, 'cfg');
        const r = run(d, cfg, [...args, '--project', 'nope']);
        assert.equal(r.status, 1);
        assert.match(r.stdout, /--project nope: no such project under /);
        assert.equal(fs.existsSync(profile.projectFile(d)), false);
        assert.equal(fs.existsSync(path.join(d, 'nope')), false);
    });
}

test('profile set refuses a --project naming a file rather than a directory', () => {
    const d = tmp('fankeel-profile-project-');
    const cfg = path.join(d, 'cfg');
    fs.writeFileSync(path.join(d, 'notes.txt'), 'x');
    const r = run(d, cfg, ['set', 'guard', 'ask', '--project', 'notes.txt']);
    assert.equal(r.status, 1);
    assert.equal(fs.existsSync(profile.projectFile(d)), false);
});

test('profile preset with no name exits 1 and writes nothing', () => {
    const d = tmp('fankeel-profile-project-');
    const cfg = path.join(d, 'cfg');
    const r = run(d, cfg, ['preset']);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /preset is one of: manual, balanced, lean/);
    assert.equal(fs.existsSync(profile.projectFile(d)), false);
});

test('profile set with a --project that exists still writes there', () => {
    const d = tmp('fankeel-profile-project-');
    const cfg = path.join(d, 'cfg');
    fs.mkdirSync(path.join(d, 'app'));
    const r = run(d, cfg, ['set', 'guard', 'ask', '--project', 'app']);
    assert.equal(r.status, 0, r.stdout);
    assert.equal(fs.existsSync(profile.projectFile(path.join(d, 'app'))), true);
    assert.equal(fs.existsSync(profile.projectFile(d)), false);
});
