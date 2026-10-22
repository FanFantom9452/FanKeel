'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

test('phone.hold takes whole seconds from 1 to 1800', () => {
    assert.deepEqual(profile.parseValue('phone.hold', '60'), { value: 60 });
    assert.deepEqual(profile.parseValue('phone.hold', '1800'), { value: 1800 });
    for (const bad of ['0', '1801', 'x', '1.5', '', '-5']) {
        assert.equal(profile.parseValue('phone.hold', bad).error, 'phone.hold is a number of seconds from 1 to 1800', bad);
    }
});

test('phone.hold defaults to 1800 and is no wizard key', () => {
    const got = profile.read(tmp('fankeel-profile-phone-'), null);
    assert.equal(Number(got.values['phone.hold']), 1800);
    assert.equal(got.sources['phone.hold'], 'builtin');
    assert.equal(Object.keys(profile.WIZARD_KEYS).includes('phone.hold'), false);
    assert.match(profile.KEYS['phone.hold'].desc, /^[^\n]+$/);
});
