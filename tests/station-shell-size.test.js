'use strict';
// station-52 (b): station.js is the shell — state, draw, VIEWS, the listeners
// and intervals, refresh — and everything else lives in its modules. CAP is
// what the shell measured once the seven station-shell plans landed, rounded
// up to fifty. It only ever moves down.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CAP = 2000;

test('station.js stays a shell of at most CAP lines', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
    const lines = src.split('\n').length;
    assert.ok(lines <= CAP, 'station.js is ' + lines + ' lines, over ' + CAP);
});
