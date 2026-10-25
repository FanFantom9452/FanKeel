'use strict';
// The station's panels as the approved mockup draws them (.fankeel/build/2026-10-26-station-resize/mockup.html):
// the notification panel is wider and its grip is a 24px tile, the other expanded panels get room,
// and under 600px the panel is a bottom sheet.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');
const rule = (sel) => {
    const at = CSS.indexOf('\n' + sel + '{');
    assert.ok(at > -1, sel + ' has its own rule');
    return CSS.slice(at + 1, CSS.indexOf('}', at));
};
const sheet = () => {
    const at = CSS.indexOf('/* ---- gate panel: phone bottom sheet ---- */');
    assert.ok(at > -1, 'the phone sheet block is marked');
    const from = CSS.indexOf('@media (max-width:599px){', at);
    assert.ok(from > -1, 'the sheet is a max-width:599px media block');
    return CSS.slice(from, CSS.indexOf('\n}\n', from));
};

test('.fkp opens at min(560px, 100vw - 32px)', () => {
    assert.ok(rule('.fkp').includes('width:min(560px,calc(100vw - 32px))'));
});

test('.fkr is a visible 24px grip that turns keel blue on hover', () => {
    const r = rule('.fkr');
    assert.match(r, /width:24px/);
    assert.match(r, /height:24px/);
    assert.match(r, /nesw-resize/);
    assert.match(rule('.fkr:hover'), /var\(--keel\)/);
});

test('.fkf leaves room for the grip', () => {
    assert.match(rule('.fkp .fkf'), /padding-left:36px/);
});

test('.qpop is 720px wide and 80vh tall at most', () => {
    const r = rule('.qpop');
    assert.ok(r.includes('width:min(720px,calc(100vw - 48px))'));
    assert.match(r, /max-height:80vh/);
});

test('.claims is 320px tall, resizes vertically, and the cap lifts once dragged', () => {
    const r = rule('.claims');
    assert.match(r, /max-height:320px/);
    assert.match(r, /resize:vertical/);
    assert.match(rule('.claims[style*="height"]'), /max-height:none/);
});

test('.fpanel may be 60vh tall', () => {
    assert.match(rule('.fpanel'), /max-height:60vh/);
});

test('under 600px .fkp is a fixed bottom sheet that overrides the saved size, with no grip', () => {
    const s = sheet();
    assert.match(s, /\.fkp\{[^}]*position:fixed/);
    assert.match(s, /\.fkp\{[^}]*bottom:0/);
    assert.match(s, /\.fkp\{[^}]*width:auto!important/);
    assert.match(s, /\.fkp\{[^}]*height:auto!important/);
    assert.match(s, /\.fkp\{[^}]*max-height:85dvh!important/);
    assert.match(s, /\.fkp\{[^}]*border-radius:12px 12px 0 0/);
    assert.match(s, /\.fkr\{display:none\}/);
    assert.match(s, /\.fkg\{display:grid/);
    assert.match(s, /\.fkx\{display:grid/);
});

test('the drag bar and the close button are hidden above 599px', () => {
    assert.match(rule('.fkg,.fkx'), /display:none/);
});

test('the free answer and its mic have rules', () => {
    for (const sel of ['.gc .gfree', '.gfrow', '.gfrow .gmic', '.gfrow .gmic.on', '.gsay', '.gc .gfree .gfs']) assert.ok(CSS.includes('\n' + sel + '{'), sel);
});
