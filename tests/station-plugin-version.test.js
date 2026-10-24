// tests/station-plugin-version.test.js
'use strict';
// The page model names the fankeel plugin's own version, read server-side
// from the plugin's package.json. The `version` on a session row is Claude
// Code's, so it must not be what the footer shows.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const PLUGIN = path.join(__dirname, '..');
const MODEL = { generatedAt: '2026-10-24T00:00:00.000Z', configDir: 'C:\\cfg', pricesVerified: '2026-09-24', registries: [], machineProfile: null, scanStats: null };
const stationOf = (js) => { const win = {}; new Function('window', js)(win); return win.STATION; };

test('serialize carries the plugin package.json version', () => {
    const want = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'package.json'), 'utf8')).version;
    assert.equal(stationOf(station.serialize(MODEL, { plugin: PLUGIN })).fankeel, want);
});

test('no plugin, or one with no readable package.json, leaves it out', () => {
    assert.equal(stationOf(station.serialize(MODEL, {})).fankeel, undefined);
    assert.equal(stationOf(station.serialize(MODEL, { plugin: tmp('fankeel-nover-') })).fankeel, undefined);
});
