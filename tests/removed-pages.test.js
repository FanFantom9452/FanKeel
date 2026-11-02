'use strict';
// The station tour was removed on 2026-11-02 and is to be rebuilt (TODO tour-2).
// Nothing the station serves, writes or tests names it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { STATIC } = require('../scripts/station.js');

test('serve answers none of the tour files, whether or not they are on disk', () => {
    for (const n of ['tour.html', 'tour.css', 'tour.js', 'tour-keel.js', 'tour-ring.js', 'tour-reel-kit.js', 'tour-player.js']) {
        assert.ok(!STATIC.test('/station/' + n), n);
    }
});
