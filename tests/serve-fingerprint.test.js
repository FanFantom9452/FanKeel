'use strict';
// station-55: diskFingerprint watches assets/station/index.html and every
// module it loads, besides lib/station.js, assets/station/station.js and the
// version. Edits go to a copy, never to this checkout.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { diskFingerprint } = require('../lib/serve.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const PLUGIN = path.join(__dirname, '..');
const TAG = '<script src="station/station.js"></script>';

function copy() {
    const dir = tmp('fankeel-fingerprint-');
    fs.cpSync(path.join(PLUGIN, 'assets', 'station'), path.join(dir, 'assets', 'station'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'lib'));
    fs.copyFileSync(path.join(PLUGIN, 'lib', 'station.js'), path.join(dir, 'lib', 'station.js'));
    fs.copyFileSync(path.join(PLUGIN, 'package.json'), path.join(dir, 'package.json'));
    return dir;
}

test('modulesOf reads a shell the way MODULES was read', () => {
    const shell = fs.readFileSync(path.join(PLUGIN, 'assets', 'station', 'index.html'), 'utf8');
    assert.deepEqual(station.modulesOf(shell), station.MODULES);
    assert.deepEqual(station.modulesOf(''), ['gate-frame.js', 'gate-frame.css', 'focus-page.js', 'vendor/pele.js']);
});

test('an edit to any module the shell loads moves the fingerprint', () => {
    const dir = copy();
    for (const name of station.MODULES) {
        const before = diskFingerprint(dir);
        fs.appendFileSync(path.join(dir, 'assets', 'station', name), '\n/* edited */\n');
        assert.notEqual(diskFingerprint(dir), before, name);
    }
});

test('a module added to index.html moves it, and so does that file appearing', () => {
    const dir = copy();
    const shell = path.join(dir, 'assets', 'station', 'index.html');
    const text = fs.readFileSync(shell, 'utf8');
    assert.ok(text.includes(TAG), 'index.html no longer loads station.js this way');
    const before = diskFingerprint(dir);
    fs.writeFileSync(shell, text.replace(TAG, '<script src="station/zz-new.js"></script>\n' + TAG));
    const listed = diskFingerprint(dir);
    assert.notEqual(listed, before);
    fs.writeFileSync(path.join(dir, 'assets', 'station', 'zz-new.js'), 'window.ZZ = 1;\n');
    assert.notEqual(diskFingerprint(dir), listed);
});

test('the three it always watched still move it', () => {
    const dir = copy();
    for (const rel of [['lib', 'station.js'], ['assets', 'station', 'station.js']]) {
        const before = diskFingerprint(dir);
        fs.appendFileSync(path.join(dir, ...rel), '\n// edited\n');
        assert.notEqual(diskFingerprint(dir), before, rel.join('/'));
    }
    const before = diskFingerprint(dir);
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(Object.assign(pkg, { version: '99.0.0' })));
    assert.notEqual(diskFingerprint(dir), before, 'package.json version');
});
