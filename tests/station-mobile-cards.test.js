'use strict';
// The /m home list as cards: one rounded card per session, a one-line title, a gap grid between cards.
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

// red when: .ha-row loses its background or border-radius, or gets border-top back
test('.ha-row is a card with its own background, radius and ring, and no top rule', () => {
    const r = rule('.ha-row');
    assert.match(r, /background:var\(--panel\)/);
    assert.match(r, /border-radius:var\(--r\)/);
    assert.match(r, /box-shadow:inset 0 0 0 1px var\(--rule\)/);
    assert.doesNotMatch(r, /border-top/);
});

// red when: .ha-t goes back to -webkit-line-clamp or drops nowrap/ellipsis
test('.ha-t keeps the title on one line with an ellipsis, at the base and on the phone', () => {
    for (const sel of ['.ha-t', 'body.m .ha-t']) {
        const r = rule(sel);
        assert.match(r, /white-space:nowrap/, sel);
        assert.match(r, /text-overflow:ellipsis/, sel);
        assert.doesNotMatch(r, /line-clamp/, sel);
    }
});

// red when: the list wrapper gets a background, border or shadow again, or loses gap:12px
test('.ha-list and .ha-ask are gap grids with no shared background or border', () => {
    const r = rule('.ha-list,.ha-ask');
    assert.match(r, /display:grid/);
    assert.match(r, /gap:12px/);
    assert.doesNotMatch(r, /background|border|box-shadow/);
});

// red when: homeRow drops ha-t, the time, or the ha-sub line
test('homeRow still emits ha-top with ha-t and time, then the ha-sub line', () => {
    const html = P.screen(HOME, P.parseRoute('#/'), NOW, { mode: 'app' });
    assert.match(html, /<a class="ha-row"[^>]*>.*<span class="ha-top"><span class="ha-t">a task<\/span><time>[^<]+<\/time><\/span><span class="ha-sub">/);
});
