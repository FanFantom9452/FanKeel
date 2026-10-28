'use strict';
// tests/station-moved.js — a function moved out of station.js (station-52)
// is declared in its module, is no longer written out in station.js (only a
// one-line forward may remain), and its module is on the page.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const DIR = path.join(__dirname, '..', 'assets', 'station');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

function moved(file, names) {
    const api = require(path.join(DIR, file));
    assert.equal(typeof api.make, 'function', file + ' exports make');
    const shell = read('station.js');
    const mod = read(file);
    assert.ok(read('index.html').includes('<script src="station/' + file + '"></script>'), file + ' is in index.html');
    for (const n of names) {
        assert.match(mod, new RegExp('function ' + n + '\\('), n + ' is declared in ' + file);
        const written = new RegExp('function ' + n + '\\([^)]*\\)\\s*\\{(?!\\s*return \\w+\\(\\)\\.' + n + '\\.apply\\(null, arguments\\); \\})');
        assert.doesNotMatch(shell, written, n + ' is still written out in station.js');
    }
}
module.exports = { moved };
