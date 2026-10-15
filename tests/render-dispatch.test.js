'use strict';

// model-6: the raised floor reaches the rules plan, build and verify are
// injected with, and a build stage agent's brief — not survey's.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { render, renderBrief } = require('../lib/render.js');
const { KEYS } = require('../lib/profile.js');
const tmp = require('./tmp.js');

const NOW = Date.parse('2026-10-15T12:00:00.000Z');
const BUILTIN = Object.fromEntries(Object.entries(KEYS).map(([k, v]) => [k, v.builtin]));
const entry = (over) => ({
    sessionId: 'aaaaaaaa-0000-4000-8000-000000000001',
    data: Object.assign({
        task: 't',
        claims: [],
        stage: 'plan',
        class: 'architectural',
        route: ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'],
        active: true,
        started: new Date(NOW - 3600e3).toISOString(),
        updated: new Date(NOW - 60e3).toISOString(),
    }, over),
});
const LINE = /floor `opus`, effort `high`/;

test('render: an architectural plan and build carry the raised floor', () => {
    for (const stage of ['plan', 'build']) {
        const out = render({ mine: entry({ stage }), others: [], now: NOW, profile: { values: BUILTIN } });
        assert.match(out, LINE, stage);
    }
});

test('render: a bounded build and an architectural survey carry no raised floor', () => {
    const bounded = render({ mine: entry({ stage: 'build', class: 'bounded', route: ['survey', 'design', 'build', 'verify', 'land'] }), others: [], now: NOW, profile: { values: BUILTIN } });
    assert.doesNotMatch(bounded, LINE);
    const survey = render({ mine: entry({ stage: 'survey' }), others: [], now: NOW, profile: { values: BUILTIN } });
    assert.doesNotMatch(survey, LINE);
});

test('renderBrief: an architectural build stage agent sends on opus at high', () => {
    const root = tmp('fankeel-render-dispatch-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    const values = Object.assign({}, BUILTIN, { 'stage.agents': ['build'] });
    const text = renderBrief({ mine: entry({ stage: 'build' }), agentType: 'fankeel:fankeel-brain', root, profile: { values } });
    assert.match(text, /floor model: `opus`/);
    assert.equal(text.split('class architectural: floor').length - 1, 1, 'the line appears exactly once');
});
