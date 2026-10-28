'use strict';
// The /m home cards after the 2026-10-27 redesign: one rounded .sc card per session — title,
// project, stage and one status line — with the rest behind the chevron.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../assets/station/mobile.js');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'mobile.css'), 'utf8');
const NOW = new Date(2026, 9, 26, 11, 2).getTime();
const rule = (sel) => {
    const at = CSS.indexOf('\n' + sel + '{');
    assert.ok(at >= 0, sel + ' rule');
    const from = at + sel.length + 2;
    return CSS.slice(from, CSS.indexOf('}', from));
};
const HOME = { host: 'h', at: NOW, gates: [], done: [], tasks: [
    { id: 'aaaaaaaa-1', root: '/w', task: 'a task', project: 'proj', stage: 'build', route: [], updated: NOW, state: 'running', background: [], last: null }] };

// red when: .sc loses its background, radius or ring
test('.sc is a card with its own background, radius and ring', () => {
    const r = rule('.sc');
    assert.match(r, /background:var\(--panel\)/);
    assert.match(r, /border-radius:var\(--r\)/);
    assert.match(r, /box-shadow:inset 0 0 0 1px var\(--rule\)/);
});

// red when: .sc-t stops clamping a long title at two lines
test('.sc-t clamps the title at two lines', () => {
    assert.match(rule('.sc-t'), /-webkit-line-clamp:2/);
});

// red when: the list wrapper gets a background or loses its 10px gap
test('.sc-list is a gap grid with no shared background', () => {
    const r = rule('.sc-list');
    assert.match(r, /display:grid/);
    assert.match(r, /gap:10px/);
    assert.doesNotMatch(r, /background|border|box-shadow/);
});

// red when: card() drops the title row, the meta row or the status line
test('a card is the title with its time, then project and stage, then one status line', () => {
    const html = P.screen(HOME, P.parseRoute('#/'), NOW, { mode: 'app' });
    assert.match(html, /<div class="sc" data-row="[^"]*"><a class="sc-main" href="#\/s\/aaaaaaaa-1"><span class="sc-top"><span class="sc-t">a task<\/span><time>.*?<\/time><\/span><span class="sc-meta">.*?<span class="pj">proj<\/span>.*?<\/span><span class="sc-stat">/);
});
