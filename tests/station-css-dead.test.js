'use strict';
// station-54: the seven-step wizard's rules (.wz, its .vg scenes and their
// keyframes) and the old docs card's (.dsx) left station.css with the code
// that drew them; the split bar docs-page.js draws keeps its rules.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');
const SCENES = ['cdn', 'scene', 'd1', 'd2', 'd3', 'd4', 'd5', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'rise',
    'mvR', 'mvDoc', 'mvA', 'mvBask', 'mvBdeny', 'mvBoff', 'warn', 'wait', 'fill'];

test('no .wz, .vg or .dsx rule, and none of the wizard scenes\' keyframes', () => {
    assert.doesNotMatch(CSS, /\.wz\b/);
    assert.doesNotMatch(CSS, /\.vg\b/);
    assert.doesNotMatch(CSS, /\.dsx/);
    for (const k of SCENES) assert.doesNotMatch(CSS, new RegExp('@keyframes ' + k + '\\{'), k);
});

test('the split bar docs-page.js draws keeps its rules', () => {
    for (const r of ['.split{', '.split-h{', '.split-bar{']) assert.ok(CSS.includes(r), r);
});
