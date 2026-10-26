'use strict';
// notify-1 and station-chartroom-vendored-1: the five notify.* keys and
// station.chartroom are gone from the profile, and a machine profile that
// still holds them loads as if they were not there (lib/profile.js reads only
// KEYS), keeping them on the next write.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

const GONE = ['notify.server', 'notify.topic', 'notify.gate', 'notify.stage', 'notify.end', 'station.chartroom'];

test('KEYS has none of the six, and setting one is an unknown key', () => {
    for (const k of GONE) {
        assert.equal(Object.prototype.hasOwnProperty.call(profile.KEYS, k), false, k);
        assert.match(profile.parseValue(k, 'true').error, /^unknown key/, k);
    }
    assert.equal(profile.parseValue('station.remote', 'true').value, true, 'station.remote is still a switch');
});

test('an old machine profile holding them loads clean, and a write keeps them', () => {
    const cfg = tmp('fankeel-notify-gone-');
    const file = profile.machineFile(cfg);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ 'notify.gate': true, 'notify.topic': 'fankeel-x', 'station.chartroom': 'F:/c', 'ui.lang': 'en' }) + '\n');
    const got = profile.read(null, cfg);
    for (const k of GONE) assert.equal(k in got.values, false, k);
    assert.equal(got.values['ui.lang'], 'en');
    assert.deepEqual(got.unreadable, []);
    assert.equal(profile.write(file, 'station.remote', 'false').ok, true);
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(raw['notify.gate'], true, 'left as it was: inert, not migrated');
});
