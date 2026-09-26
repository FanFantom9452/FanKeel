'use strict';
// docs/plans/2026-09-26-ready-five-design.md §3: the station repaints only the
// sections whose markup changed, instead of the whole page every 3 s.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');

test('changedParts names only the blocks whose markup moved, and null when the page changed shape', () => {
    assert.deepEqual(V.changedParts(['<a>1</a>', '<b>2</b>', '<c>3</c>'], ['<a>1</a>', '<b>9</b>', '<c>3</c>']), [1]);
    assert.deepEqual(V.changedParts(['<a>1</a>'], ['<a>1</a>']), []);
    assert.equal(V.changedParts(['<a>1</a>'], ['<a>1</a>', '<b>2</b>']), null);
    assert.equal(V.changedParts(null, ['<a>1</a>']), null);
});

test('draw replaces only the changed blocks when the page keeps its shape, and falls back to a whole redraw', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
    const at = src.indexOf('    function draw() {');
    const draw = src.slice(at, at + 5000);
    assert.match(draw, /changedParts\(drawnParts, parts\)/);
    assert.match(draw, /replaceChild\(/);
    assert.match(draw, /p\.innerHTML = html;/);
});
