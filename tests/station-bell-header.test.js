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
