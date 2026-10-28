'use strict';
// The 測站 sheet's grid rows: a grid-template-columns track for every direct child, or the
// last child wraps onto a new line / lands in the wrong track (cc66657b dropped a track).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../assets/station/mobile.js');

const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'mobile.css'), 'utf8');
const tracks = (sel) => {
    const rule = new RegExp('^' + sel.replace('.', '\\.') + '\\{([^}]*)\\}', 'm').exec(css);
    const v = /grid-template-columns:([^;}]+)/.exec(rule[1])[1].trim();
    return v.replace(/minmax\([^)]*\)/g, 'X').split(/\s+/).length;
};

// Direct children of the first element of `tag` carrying `cls`: walks the tags, depth by depth.
function children(html, tag, cls) {
    const start = new RegExp('<' + tag + ' [^>]*class="' + cls + '"[^>]*>').exec(html);
    let i = start.index + start[0].length, depth = 0, n = 0;
    const re = /<(\/?)([a-z0-9]+)[^>]*?(\/?)>/gi;
    re.lastIndex = i;
    for (let m; (m = re.exec(html)); ) {
        if (/^(br|img|path|circle|rect|line|polyline|use)$/i.test(m[2]) || m[3]) { if (depth === 0) n++; continue; }
        if (m[1]) { if (depth === 0) break; depth--; if (depth === 0) n++; } else depth++;
    }
    return n;
}

const NOW = Date.UTC(2026, 9, 28, 6, 0);
const html = P.screen({
    host: 'office-pc', at: NOW, device: { name: 'my phone', paired: NOW - 864e5 }, gates: [], done: [],
    tasks: [{ id: 't1', task: 'job', holdUntil: NOW + 6e5 }],
    machines: [
        { name: 'office-pc', url: 'https://office-pc.t.ts.net/m', state: 'on', me: true, n: 1 },
        { name: 'lab', url: 'https://lab.t.ts.net/m', state: 'on', paired: NOW - 864e5, n: 2 },
        { name: 'home', url: 'https://home.t.ts.net/m', state: 'unpaired' },
    ],
}, P.parseRoute('#/'), NOW, { mode: 'app', open: { 'rs:me': true }, sheet: true });

test('rows: .rs-row has 4 grid tracks and 4 direct children (icon, text, side, toggle)', () => {
    assert.equal(tracks('.rs-row'), 4);
    assert.equal(children(html, 'button', 'rs-row'), 4);
});

test('rows: .mm-row has as many direct children as grid tracks', () => {
    assert.equal(children(html, 'a', 'mm-row'), tracks('.mm-row'));
});

test('rows: an unpaired computer fold button.mm-row has as many direct children as grid tracks', () => {
    assert.equal(children(html, 'button', 'mm-row'), tracks('.mm-row'));
});
