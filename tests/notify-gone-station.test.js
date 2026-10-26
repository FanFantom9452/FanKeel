'use strict';
// notify-1: the station server reads no notify.* key and writes no topic, and
// the phone page's model carries no subscribe button.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mobile = require('../lib/mobile.js');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('scripts/station.js and lib/mobile.js hold no notify', () => {
    for (const rel of ['scripts/station.js', 'lib/mobile.js']) {
        assert.doesNotMatch(read(rel), /lib\/notify\.js|notify\.|subscribeOf|ntfy/i, rel);
    }
});

test('lib/mobile.js exports no subscribeOf', () => {
    assert.equal('subscribeOf' in mobile, false);
});

test('lib/render.js no longer points at lib/notify.js', () => {
    assert.doesNotMatch(read('lib/render.js'), /lib\/notify\.js|remoteBase/);
});
