'use strict';
// `task.js profile set station.remote true` is the advanced Tailscale feature:
// without --confirm it refuses, prints the warning and exits 1; off needs no
// confirmation; the station page's own POST /profile path (profile.write) has
// its own modal and is not gated here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

const TASK = path.join(__dirname, '..', 'scripts', 'task.js');

function cli(d, ...args) {
    const cfg = path.join(d, 'cfg');
    const r = spawnSync(process.execPath, [TASK, 'profile', ...args, '--root', d, '--claude-dir', cfg],
        { encoding: 'utf8', cwd: d, env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
    return { code: r.status, out: r.stdout + r.stderr, cfg };
}
const machineValue = (cfg) => profile.read(null, cfg).values['station.remote'];

test('station.remote true without --confirm is refused: exit 1, the warning, nothing written', () => {
    const d = tmp('fankeel-confirm-');
    const got = cli(d, 'set', 'station.remote', 'true', '--default');
    assert.equal(got.code, 1);
    assert.match(got.out, /Tailscale 遠端是進階功能/);
    assert.match(got.out, /AskUserQuestion/);
    assert.match(got.out, /--confirm/);
    assert.match(got.out, /docs\/01-guide\/tailscale-setup\.md/);
    assert.notEqual(machineValue(got.cfg), true, 'the profile is unchanged');
    const project = cli(d, 'set', 'station.remote', 'TRUE');
    assert.equal(project.code, 1, 'a project-level write is gated too, and the value is read the way the profile reads it');
    assert.equal(fs.existsSync(profile.projectFile(d)), false);
});

test('station.remote true with --confirm is written', () => {
    const d = tmp('fankeel-confirm-');
    const got = cli(d, 'set', 'station.remote', 'true', '--default', '--confirm');
    assert.equal(got.code, 0, got.out);
    assert.equal(machineValue(got.cfg), true);
});

test('false needs no confirmation, and neither does any other key', () => {
    const d = tmp('fankeel-confirm-');
    assert.equal(cli(d, 'set', 'station.remote', 'false', '--default').code, 0);
    assert.equal(machineValue(path.join(d, 'cfg')), false);
    assert.equal(cli(d, 'set', 'ui.lang', 'en', '--default').code, 0, 'only station.remote is gated');
});

test('the station page\'s path, profile.write, is not gated: the page has its own modal', () => {
    const d = tmp('fankeel-confirm-');
    const file = profile.machineFile(path.join(d, 'cfg'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const out = profile.write(file, 'station.remote', 'true');
    assert.equal(out.ok, true);
    assert.equal(out.value, true);
});
