'use strict';

// model-6: the raised floor reaches the rules plan, build and verify are
// injected with, and a build stage agent's brief — not survey's.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { render, renderBrief, renderResume } =require('../lib/render.js');
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

test('render: an architectural plan, build and verify carry the raised floor', () => {
    for (const stage of ['plan', 'build', 'verify']) {
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

const brief = (stage, cls) => {
    const root = tmp('fankeel-render-dispatch-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    const values = Object.assign({}, BUILTIN, { 'stage.agents': [stage], 'dispatch.floor': 'sonnet' });
    return renderBrief({ mine: entry({ stage, class: cls }), agentType: 'fankeel:fankeel-brain', root, profile: { values } });
};
const once = (text) => assert.equal(text.split('class architectural: floor').length - 1, 1, 'the line appears exactly once');

test('renderBrief: an architectural plan brain and verify brain carry the clause once; verify names the mutator on opus', () => {
    once(brief('plan', 'architectural'));
    const verify = brief('verify', 'architectural');
    once(verify);
    assert.match(verify, /fankeel-mutator` on model `opus`/);
});

test('renderBrief: the mover runs on opus for architectural and on the profile floor for bounded', () => {
    assert.match(brief('audit', 'architectural'), /fankeel-mover` on model `opus`/);
    assert.match(brief('audit', 'bounded'), /fankeel-mover` on model `sonnet`/);
});

test('renderResume: an architectural build entry shows the raised floor on the class line', () => {
    assert.match(renderResume({ mine: entry({ stage: 'build' }), profile: { values: BUILTIN } }), /class: architectural — floor `opus`, effort `high`/);
    // fable is above opus, so only the profile's own values can put it there.
    const out = renderResume({ mine: entry({ stage: 'build' }), profile: { values: Object.assign({}, BUILTIN, { 'dispatch.floor': 'fable' }) } });
    assert.match(out, /class: architectural — floor `fable`, effort `high`/);
});
