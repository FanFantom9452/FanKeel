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

const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

test('no file under assets/station is a tour file or names the tour', () => {
    const root = path.join(__dirname, '..');
    const files = walk(path.join(root, 'assets', 'station'));
    assert.deepEqual(files.filter((f) => /tour/i.test(path.basename(f))), []);
    for (const f of files.filter((x) => /\.(js|css|html)$/.test(x))) {
        assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /tour/i, path.relative(root, f));
    }
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'scripts', 'station.js'), 'utf8'), /tour/i);
});

test('the recorder and every tour test are gone, and no station test names the tour', () => {
    const root = path.join(__dirname, '..');
    assert.equal(fs.existsSync(path.join(root, 'scripts', 'tour-record.js')), false);
    const tests = fs.readdirSync(path.join(root, 'tests'));
    assert.deepEqual(tests.filter((n) => /^tour/.test(n)), []);
    for (const n of tests.filter((x) => /^station-.*\.test\.js$/.test(x))) {
        assert.doesNotMatch(fs.readFileSync(path.join(root, 'tests', n), 'utf8'), /tour/i, n);
    }
});
