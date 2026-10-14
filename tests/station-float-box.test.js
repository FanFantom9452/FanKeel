'use strict';
// The gate panel's own place and size (docs/90-agent/plans/2026-10-15-todo-patrol-gate-drive-design.md §1):
// parsed from localStorage, pulled back inside the window, and written into
// floatHtml's own markup so the 3 s repaint keeps it where it was dragged.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: true } };
const V = require('../assets/station/station.js');

test('fkBoxParse: four finite numbers or null', () => {
    assert.deepEqual(V.fkBoxParse('{"x":1,"y":2,"w":300,"h":200}'), { x: 1, y: 2, w: 300, h: 200 });
    assert.equal(V.fkBoxParse(null), null);
    assert.equal(V.fkBoxParse('not json'), null);
    assert.equal(V.fkBoxParse('{"x":1,"y":2,"w":300}'), null);
    assert.equal(V.fkBoxParse('{"x":"1","y":2,"w":300,"h":200}'), null);
});

test('fkBoxClamp: a box inside the window is left alone', () => {
    assert.deepEqual(V.fkBoxClamp({ x: 100, y: 50, w: 376, h: 400 }, 1200, 800), { x: 100, y: 50, w: 376, h: 400 });
});

test('fkBoxClamp: past the right and bottom edges it is pulled back in', () => {
    assert.deepEqual(V.fkBoxClamp({ x: 1100, y: 700, w: 376, h: 400 }, 1200, 800), { x: 824, y: 400, w: 376, h: 400 });
});

test('fkBoxClamp: past the left and top edges it is pulled back in', () => {
    assert.deepEqual(V.fkBoxClamp({ x: -50, y: -10, w: 376, h: 400 }, 1200, 800), { x: 0, y: 0, w: 376, h: 400 });
});

test('fkBoxClamp: larger than the window it shrinks to fit, smaller than 260 by 160 it grows', () => {
    assert.deepEqual(V.fkBoxClamp({ x: 0, y: 0, w: 2000, h: 2000 }, 1200, 800), { x: 0, y: 0, w: 1200, h: 800 });
    assert.deepEqual(V.fkBoxClamp({ x: 10, y: 10, w: 40, h: 30 }, 1200, 800), { x: 10, y: 10, w: 260, h: 160 });
    assert.equal(V.fkBoxClamp(null, 1200, 800), null);
});

test('floatHtml: a box puts the panel at its place; none leaves the corner', () => {
    const placed = V.floatHtml([], [], true, 0, {}, 'denied', { x: 40, y: 30, w: 300, h: 200 });
    assert.match(placed, /<section class="fkp" id="fkp"[^>]* style="position:fixed;left:40px;top:30px;right:auto;bottom:auto;width:300px;height:200px;max-height:none">/);
    assert.match(placed, /<div class="fkh" data-fk-drag>/);
    assert.match(placed, /<span class="fkr" data-fk-resize aria-hidden="true"><\/span><\/section>/);
    assert.doesNotMatch(V.floatHtml([], [], true, 0, {}, 'denied'), /position:fixed/);
});
