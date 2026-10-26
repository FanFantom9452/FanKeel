'use strict';
// The key the station remote reads (docs/90-agent/plans/2026-10-21-station-remote-design.md §1):
// a switch, off the station wizard.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

const FLAGS = ['station.remote'];

test('the switches are true or false, written as words or as booleans', () => {
    for (const k of FLAGS) {
        assert.equal(profile.parseValue(k, 'true').value, true, k);
        assert.equal(profile.parseValue(k, ' FALSE ').value, false, k);
        assert.equal(profile.parseValue(k, true).value, true, k);
        assert.equal(profile.parseValue(k, false).value, false, k);
        assert.equal(profile.parseValue(k, 'yes').error, k + ' is true or false');
    }
});

test('a machine profile written true reads back true, from the machine', () => {
    const cfg = tmp('fankeel-profile-remote-');
    assert.equal(profile.write(profile.machineFile(cfg), 'station.remote', 'true').ok, true);
    const got = profile.read(null, cfg);
    assert.equal(got.values['station.remote'], true);
    assert.equal(got.sources['station.remote'], 'machine');
    assert.deepEqual(JSON.parse(fs.readFileSync(profile.machineFile(cfg), 'utf8')), { 'station.remote': true });
});

test('station.remote sits right after station.link, off the wizard, with a one-line desc and a row in the guide', () => {
    const keys = Object.keys(profile.KEYS);
    assert.equal(keys[keys.indexOf('station.link') + 1], 'station.remote');
    const page = fs.readFileSync(path.join(__dirname, '..', 'docs', '01-guide', 'profile.md'), 'utf8');
    const k = 'station.remote';
    assert.equal(Object.prototype.hasOwnProperty.call(profile.WIZARD_KEYS, k), false, k + ' is on the wizard');
    assert.ok(profile.KEYS[k].desc && !profile.KEYS[k].desc.includes('\n'), k);
    assert.ok(profile.KEYS[k].free, k + ' needs the free-text line the table prints');
    assert.ok(page.includes('| `' + k + '` |'), k + ' has no row on docs/01-guide/profile.md');
});
