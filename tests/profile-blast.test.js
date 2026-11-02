'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

test('verify.blast takes off or a whole number from 1 to 1000', () => {
    assert.deepEqual(profile.parseValue('verify.blast', '3'), { value: 3 });
    assert.deepEqual(profile.parseValue('verify.blast', ' 1000 '), { value: 1000 });
    assert.deepEqual(profile.parseValue('verify.blast', 'OFF'), { value: 'off' });
    for (const bad of ['0', '1001', 'x', '2.5', '', '-4']) {
        assert.equal(profile.parseValue('verify.blast', bad).error, 'verify.blast is off or a whole number from 1 to 1000', bad);
    }
});

test('verify.blast defaults to 10, one line, and is no wizard key', () => {
    const got = profile.read(tmp('fankeel-profile-blast-'), null);
    assert.equal(got.values['verify.blast'], 10);
    assert.equal(got.sources['verify.blast'], 'builtin');
    assert.equal(Object.keys(profile.WIZARD_KEYS).includes('verify.blast'), false);
    assert.match(profile.KEYS['verify.blast'].desc, /^[^\n]+$/);
});
