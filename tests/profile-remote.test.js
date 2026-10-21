'use strict';
// The six keys the station remote and its notifications read
// (docs/90-agent/plans/2026-10-21-station-remote-design.md §1, §5): two kinds
// of free value and four switches, every one off the station wizard.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

const SIX = ['station.remote', 'notify.server', 'notify.topic', 'notify.gate', 'notify.stage', 'notify.end'];
const FLAGS = ['station.remote', 'notify.gate', 'notify.stage', 'notify.end'];

test('the switches are true or false, written as words or as booleans', () => {
    for (const k of FLAGS) {
        assert.equal(profile.parseValue(k, 'true').value, true, k);
        assert.equal(profile.parseValue(k, ' FALSE ').value, false, k);
        assert.equal(profile.parseValue(k, true).value, true, k);
        assert.equal(profile.parseValue(k, false).value, false, k);
        assert.equal(profile.parseValue(k, 'yes').error, k + ' is true or false');
    }
});

test('notify.server is an http or https url of at most 200 characters, its trailing slash dropped', () => {
    assert.equal(profile.parseValue('notify.server', 'https://ntfy.example.com/').value, 'https://ntfy.example.com');
    assert.equal(profile.parseValue('notify.server', 'http://127.0.0.1:8080').value, 'http://127.0.0.1:8080');
    assert.equal(profile.parseValue('notify.server', 'https://example.com/ntfy/').value, 'https://example.com/ntfy');
    assert.ok(profile.parseValue('notify.server', 'ftp://example.com').error);
    assert.ok(profile.parseValue('notify.server', 'https://exa mple.com').error);
    assert.ok(profile.parseValue('notify.server', 'https://' + 'a'.repeat(200)).error);
    assert.ok(profile.parseValue('notify.server', '').error);
});

test('notify.topic is letters, digits, - and _, 1 to 64 of them', () => {
    assert.equal(profile.parseValue('notify.topic', 'fankeel-0123456789abcdef0123').value, 'fankeel-0123456789abcdef0123');
    assert.equal(profile.parseValue('notify.topic', 'a_B-9').value, 'a_B-9');
    assert.ok(profile.parseValue('notify.topic', 'has space').error);
    assert.ok(profile.parseValue('notify.topic', 'a/b').error);
    assert.ok(profile.parseValue('notify.topic', 'a'.repeat(65)).error);
    assert.ok(profile.parseValue('notify.topic', '').error);
});

test('builtins: remote and every trigger off, the server ntfy.sh, no topic', () => {
    const v = profile.read(null, null).values;
    for (const k of FLAGS) assert.equal(v[k], false, k);
    assert.equal(v['notify.server'], 'https://ntfy.sh');
    assert.equal(Object.prototype.hasOwnProperty.call(v, 'notify.topic'), false);
});

test('a machine profile written true reads back true, from the machine', () => {
    const cfg = tmp('fankeel-profile-remote-');
    assert.equal(profile.write(profile.machineFile(cfg), 'station.remote', 'true').ok, true);
    assert.equal(profile.write(profile.machineFile(cfg), 'notify.topic', 'fankeel-00112233445566778899').ok, true);
    const got = profile.read(null, cfg);
    assert.equal(got.values['station.remote'], true);
    assert.equal(got.sources['station.remote'], 'machine');
    assert.equal(got.values['notify.topic'], 'fankeel-00112233445566778899');
    assert.deepEqual(JSON.parse(fs.readFileSync(profile.machineFile(cfg), 'utf8')), { 'station.remote': true, 'notify.topic': 'fankeel-00112233445566778899' });
});

test('the six sit right after station.link, off the wizard, each with a one-line desc and a row in the guide', () => {
    const keys = Object.keys(profile.KEYS);
    const at = keys.indexOf('station.link');
    assert.deepEqual(keys.slice(at + 1, at + 7), SIX);
    const page = fs.readFileSync(path.join(__dirname, '..', 'docs', '01-guide', 'profile.md'), 'utf8');
    for (const k of SIX) {
        assert.equal(Object.prototype.hasOwnProperty.call(profile.WIZARD_KEYS, k), false, k + ' is on the wizard');
        assert.ok(profile.KEYS[k].desc && !profile.KEYS[k].desc.includes('\n'), k);
        assert.ok(profile.KEYS[k].free, k + ' needs the free-text line the table prints');
        assert.ok(page.includes('| `' + k + '` |'), k + ' has no row on docs/01-guide/profile.md');
    }
});
