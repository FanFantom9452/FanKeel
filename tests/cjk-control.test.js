'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { controlFor, NAMES } = require('../lib/stages.js');
const { render, renderResume, sizeAtReference } = require('../lib/render.js');

const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const NOW = Date.parse('2026-08-21T12:00:00.000Z');
const entry = (over) => ({ sessionId: MINE, data: Object.assign({
    task: 'rework the colour ramp', claims: ['statusline.ps1', 'statusline.sh'], stage: 'build', class: 'architectural',
    route: ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'], active: true,
    started: '2026-09-19T09:30:12.345Z', updated: new Date(NOW - 60e3).toISOString(),
}, over) });

test('every controller is told to write CJK directly, right after who it is', () => {
    for (const stage of NAMES) {
        const first = controlFor(stage, { 'stage.agents': NAMES.slice() }, { handoff: '/r/h.md' }).rules[0];
        assert.ok(first.startsWith('You are the controller for ' + stage + '. Write CJK directly. Do not do its work'), stage + ': ' + first);
        assert.ok(first.endsWith('Name TODO entries by title, never by id.'), stage + ': ' + first);
    }
});

test('the commit rule ends at "No gate; wait."', () => {
    const rules = controlFor('build', { 'stage.agents': ['build'] }, { commit: '<plugin>/scripts/commit.js' }).rules;
    assert.ok(rules.some((r) => r.endsWith('what that printed, exactly. No gate; wait.')), rules.join('\n'));
});

test('the controlled build block with a running mark still fits under 2400 at the reference root', () => {
    const on = { values: { 'stage.agents': NAMES.slice() }, sources: {}, unreadable: [] };
    const mine = entry({ inflight: { stage: 'build', at: 1, agentId: 'a3f9c2' } });
    for (const out of [render({ mine, others: [], now: NOW, root: '/r', profile: on }), renderResume({ mine, profile: on, root: '/r' })]) {
        assert.ok(out.includes('Write CJK directly.'), out);
        assert.doesNotMatch(out, /\\u[0-9A-Fa-fX]/);
        assert.ok(sizeAtReference(out) < 2400, 'a controlled build block with a mark is ' + sizeAtReference(out));
    }
});
