'use strict';
// station-52 (c): assets/station/index.html, lib/station.js MODULES and the
// names scripts/station.js serves list the same modules. index.html is the
// one hand-written list; the other two are read off it, and this holds them.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const station = require('../lib/station.js');
const { STATIC } = require('../scripts/station.js');
const { NAMES } = require('./station-src.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'index.html'), 'utf8');
const scripts = NAMES.filter((n) => n !== 'i18n.js' && n !== 'station.js');
const sheets = [...html.matchAll(/<link rel="stylesheet" href="station\/([^"]+)">/g)].map((m) => m[1]).filter((n) => n !== 'station.css');

test('MODULES is index.html\'s scripts and stylesheets, then gate-frame and focus-page for the focus shell', () => {
    assert.deepEqual(station.MODULES, [...scripts, ...sheets, 'gate-frame.js', 'gate-frame.css', 'board-edit.js', 'board-edit.css', 'focus-page.js', 'vendor/pele.js']);
});

test('serve answers every module by name, and nothing it does not list', () => {
    for (const n of station.MODULES) assert.ok(STATIC.test('/station/' + n), n);
    for (const n of ['station.js', 'i18n.js', 'station.css', 'mobile.js', 'mobile.css', 'tour.html', 'tour-keel.js']) assert.ok(STATIC.test('/station/' + n), n);
    for (const n of ['nope.js', 'station-data.js.map', '../package.json', 'spend-evil.js']) assert.ok(!STATIC.test('/station/' + n), n);
});
