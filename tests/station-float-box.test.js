'use strict';
// The gate panel's own size (docs/90-agent/plans/2026-10-15-todo-patrol-gate-drive-design.md §1):
// parsed from localStorage, pulled back inside the window, and written into
// floatHtml's own markup so the 3 s repaint keeps it the size it was resized to.
// Its place is the bell's in the masthead, so no x or y is kept.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: true } };
const V = require('../assets/station/station.js');

test('fkBoxParse: two finite numbers or null; an old saved x and y are dropped', () => {
    assert.deepEqual(V.fkBoxParse('{"w":300,"h":200}'), { w: 300, h: 200 });
    assert.deepEqual(V.fkBoxParse('{"x":1,"y":2,"w":300,"h":200}'), { w: 300, h: 200 });
    assert.equal(V.fkBoxParse(null), null);
    assert.equal(V.fkBoxParse('not json'), null);
    assert.equal(V.fkBoxParse('{"w":300}'), null);
    assert.equal(V.fkBoxParse('{"w":"300","h":200}'), null);
});

test('fkBoxClamp: a size inside the window is left alone', () => {
    assert.deepEqual(V.fkBoxClamp({ w: 376, h: 400 }, 1200, 800), { w: 376, h: 400 });
});

test('fkBoxClamp: larger than the window it shrinks to fit, smaller than 260 by 160 it grows', () => {
    assert.deepEqual(V.fkBoxClamp({ w: 2000, h: 2000 }, 1200, 800), { w: 1200, h: 800 });
    assert.deepEqual(V.fkBoxClamp({ w: 40, h: 30 }, 1200, 800), { w: 260, h: 160 });
    assert.equal(V.fkBoxClamp(null, 1200, 800), null);
});

test('floatHtml: a size sets the panel width and height; none leaves it to the CSS', () => {
    const sized = V.floatHtml([], [], true, 0, {}, 'denied', { w: 300, h: 200 });
    assert.match(sized, /<section class="fkp" id="fkp"[^>]* style="width:300px;height:200px">/);
    assert.doesNotMatch(sized, /position:fixed|left:|top:/);
    assert.match(sized, /<div class="fkh"><b>/);
    assert.doesNotMatch(sized, /data-fk-drag/);
    assert.match(sized, /<span class="fkr" data-fk-resize aria-hidden="true"><\/span><\/section>/);
    assert.doesNotMatch(V.floatHtml([], [], true, 0, {}, 'denied'), /style="/);
});
