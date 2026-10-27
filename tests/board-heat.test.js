'use strict';
// lib/board-look.js: the change-heat ramp the weekly report paints its
// architecture maps, timeline and module chips with
// (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 架構圖).
const test = require('node:test');
const assert = require('node:assert/strict');
const { HEAT, HEAT_STEPS, heatLevel } = require('../lib/board-look.js');

test('heatLevel puts a share of the repo\'s change on five levels: above 0, 5%, 15% and 40%', () => {
    const cases = [[0, 0], [-0.1, 0], [NaN, 0], [0.001, 1], [0.0499, 1], [0.05, 2], [0.1499, 2], [0.15, 3], [0.3999, 3], [0.4, 4], [1, 4]];
    for (const [share, level] of cases) assert.equal(heatLevel(share), level, String(share));
    assert.deepEqual([...HEAT_STEPS], [0, 0.05, 0.15, 0.4]);
    assert.ok(Object.isFrozen(HEAT_STEPS));
});

test('HEAT has five light and five dark steps, each a fill, stroke and ink hex, frozen', () => {
    for (const mode of ['light', 'dark']) {
        assert.equal(HEAT[mode].length, 5, mode);
        for (const step of HEAT[mode]) for (const k of ['fill', 'stroke', 'ink']) assert.match(step[k], /^#[0-9a-f]{6}$/, mode + ' ' + k);
    }
    assert.ok(Object.isFrozen(HEAT) && Object.isFrozen(HEAT.light) && Object.isFrozen(HEAT.light[0]));
    assert.deepEqual(HEAT.light.map((s) => s.fill), ['#eaeef1', '#e3eafb', '#9db4ee', '#2d5bd8', '#1c3a8c']);
    assert.deepEqual(HEAT.dark.map((s) => s.fill), ['#202a38', '#25314a', '#3d5596', '#8fa9f2', '#cbd8fa']);
});

test('the light fills are distinct, because the report re-colours a drawn node by its fill', () => {
    assert.equal(new Set(HEAT.light.map((s) => s.fill)).size, 5);
});
