'use strict';
// notify-1 and station-chartroom-vendored-1: the settings pages offer no push
// and no Chartroom install path — no step, no checkbox, no machine key.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', name), 'utf8');

test('no settings module names notify.*, ntfy or station.chartroom', () => {
    for (const name of ['settings-steps.js', 'settings-page.js', 'settings-detail.js']) {
        assert.doesNotMatch(read(name), /notify\.|ntfy|station\.chartroom/i, name);
    }
});

test('the machine keys the quick page writes are the four left', () => {
    global.window = undefined;
    const Q = require('../assets/station/settings-page.js');
    assert.deepEqual([...Q.MACHINE], ['station.remote', 'phone.hold', 'ui.lang', 'quota.week']);
});
