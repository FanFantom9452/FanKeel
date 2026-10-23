'use strict';
// The notification bell sits in the masthead, last after #appear, as a chip
// like .srv; its panel hangs down from it (docs/90-agent/reference/station.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');
const rule = (sel) => {
    const at = CSS.indexOf('\n' + sel + '{');
    assert.ok(at > -1, sel + ' has its own rule');
    return CSS.slice(at + 1, CSS.indexOf('}', at));
};

test('#fk is inside header.mast, after #appear', () => {
    const head = HTML.slice(HTML.indexOf('<header class="mast"'), HTML.indexOf('</header>'));
    assert.ok(head.includes('id="fk"'), '#fk is in the masthead');
    assert.ok(head.indexOf('id="fk"') > head.indexOf('id="appear"'), '#fk comes after #appear');
});

test('.fk is no longer fixed to the viewport', () => {
    assert.doesNotMatch(rule('.fk'), /position:fixed/);
    assert.match(rule('.fk'), /position:relative/);
});

test('.fkp hangs from the bell by its top edge, right-aligned to it', () => {
    const r = rule('.fkp');
    assert.match(r, /top:calc\(100% \+ 6px\)/);
    assert.match(r, /right:0/);
    assert.doesNotMatch(r, /bottom:66px/);
});

test('the panel caps match fkBoxClamp', () => {
    const r = rule('.fkp');
    assert.ok(r.includes('width:min(376px,calc(100vw - 64px))'));
    assert.ok(r.includes('max-height:calc(100vh - 58px)'));
    assert.ok(CSS.includes(':root[data-style=keel] .fkp{max-height:calc(100vh - 82px)}'));
});

test('narrow screens: the brand shrinks to its glyph so the bell stays on screen', () => {
    const at = CSS.indexOf('@media (max-width:759px){');
    assert.ok(at > CSS.indexOf('@media (max-width:999px){'), 'comes after the 999px block');
    const block = CSS.slice(at, CSS.indexOf('\n}', at));
    assert.ok(block.includes(':root[data-style=keel] .mast .brand{width:auto;margin-right:0}'));
    assert.ok(block.includes(':root[data-style=keel] .mast{gap:6px}'));
});

test('the resize grip is bottom-left and the cursor matches the leftward widening', () => {
    const r = rule('.fkr');
    assert.ok(r.includes('nesw-resize'));
    assert.ok(!r.includes('nwse-resize'));
    assert.match(r, /margin:-16px auto 0 0[;\s]/);
    assert.ok(r.includes('225deg'));
    const JS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
    assert.ok(JS.includes('b.w - (e.clientX - fkDrag.sx)'));
});
