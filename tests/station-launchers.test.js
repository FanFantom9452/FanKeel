'use strict';

// lib/launchers.js: the two station launchers every registry gets under
// `.fankeel/` (docs/90-agent/plans/2026-10-02-station-launchers.md, Task 1).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const launchers = require('../lib/launchers.js');
const tmp = require('./tmp.js');

const PLUGIN = path.join(__dirname, '..');
const read = (root, name) => fs.readFileSync(path.join(root, '.fankeel', name), 'utf8');

test('NAMES is the two launchers, and PLUGIN is this install', () => {
    assert.deepEqual(launchers.NAMES, ['station.bat', 'station.sh']);
    assert.equal(launchers.PLUGIN, PLUGIN);
});

test('write puts station.bat and station.sh under .fankeel/ and names both', () => {
    const root = tmp('fankeel-launchers-');
    assert.deepEqual(launchers.write(root), ['station.bat', 'station.sh']);
    for (const name of launchers.NAMES) assert.ok(fs.existsSync(path.join(root, '.fankeel', name)), name);
});

test('station.bat runs this install\'s station.js, serve --detach --open, --root on the project', () => {
    const root = tmp('fankeel-launchers-');
    launchers.write(root);
    const script = path.join(PLUGIN, 'scripts', 'station.js');
    assert.equal(read(root, 'station.bat'), '@node "' + script + '" serve --detach --open --root "%~dp0.." %*\r\n');
});

test('station.sh runs the same script with forward slashes and --root on the project', () => {
    const root = tmp('fankeel-launchers-');
    launchers.write(root);
    const script = path.join(PLUGIN, 'scripts', 'station.js').split(path.sep).join('/');
    assert.equal(read(root, 'station.sh'),
        '#!/bin/sh\nexec node "' + script + '" serve --detach --open --root "$(dirname "$0")/.." "$@"\n');
});

test('a second write with the same install writes nothing', () => {
    const root = tmp('fankeel-launchers-');
    launchers.write(root);
    const before = read(root, 'station.bat');
    assert.deepEqual(launchers.write(root), []);
    assert.equal(read(root, 'station.bat'), before);
});

test('a moved install rewrites both, so an upgrade reaches them', () => {
    const root = tmp('fankeel-launchers-');
    launchers.write(root);
    const moved = path.join(root, 'elsewhere', 'fankeel');
    assert.deepEqual(launchers.write(root, moved), ['station.bat', 'station.sh']);
    assert.ok(read(root, 'station.bat').includes(path.join(moved, 'scripts', 'station.js')));
});

test('station.sh is executable', { skip: process.platform === 'win32' }, () => {
    const root = tmp('fankeel-launchers-');
    launchers.write(root);
    assert.equal(fs.statSync(path.join(root, '.fankeel', 'station.sh')).mode & 0o777, 0o755);
});

// Red when the loop goes back to one try around everything: station.sh is never tried.
test('a launcher that cannot be written does not stop the other, and write throws after', () => {
    const root = tmp('fankeel-launchers-');
    fs.mkdirSync(path.join(root, '.fankeel', 'station.bat'), { recursive: true });
    assert.throws(() => launchers.write(root), /station\.bat/);
    const script = path.join(PLUGIN, 'scripts', 'station.js').split(path.sep).join('/');
    assert.equal(read(root, 'station.sh'),
        '#!/bin/sh\nexec node "' + script + '" serve --detach --open --root "$(dirname "$0")/.." "$@"\n');
});

// The three pages a user reads to reopen the station name the launcher.
test('README, getting-started and the station skill name .fankeel/station.bat', () => {
    for (const rel of ['README.md', 'docs/01-guide/getting-started.md', 'skills/fankeel-station/SKILL.md']) {
        const text = fs.readFileSync(path.join(PLUGIN, rel), 'utf8');
        assert.ok(text.includes('.fankeel/station.bat'), rel + ' does not name .fankeel/station.bat');
        assert.ok(text.includes('station.sh'), rel + ' does not name station.sh');
    }
});
