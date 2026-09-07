'use strict';

// The browser half of the page cannot be driven from `node --test` — there is
// no DOM here and no dependency may be added to get one. What can be tested is
// every function that decides a number or a string before any element is
// touched, so that is what the view file exports. The rendering itself is
// checked against the served page, which is what the plan's success criterion
// is for.

const test = require('node:test');
const assert = require('node:assert/strict');

const V = require('../assets/station/station.js');

test('tokens rounds the way the page prints', () => {
    assert.equal(V.tokens(null), '—');
    assert.equal(V.tokens(0), '0');
    assert.equal(V.tokens(999), '999');
    assert.equal(V.tokens(1500), '2k');
    assert.equal(V.tokens(1500000), '1.5M');
    assert.equal(V.tokens(12000000), '12M');
});

test('mins climbs through hours into days', () => {
    assert.equal(V.mins(null), '—');
    assert.equal(V.mins(90 * 1000), '2m');
    assert.equal(V.mins(3600 * 1000), '1h');
    assert.equal(V.mins(5400 * 1000), '1h30m');
    assert.equal(V.mins(90000 * 1000), '1d1h');
});

test('usd prints cents under a hundred and none above', () => {
    assert.equal(V.usd(0), '—');
    assert.equal(V.usd(2.5), '$2.50');
    assert.equal(V.usd(239.37), '$239');
});

test('esc closes every hole the page could open', () => {
    assert.equal(V.esc('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;');
    assert.equal(V.esc(null), '');
});

test('cost adds the session and its agents', () => {
    assert.equal(V.cost({ usd: 1.5, agentUsd: 2.25 }), 3.75);
    assert.equal(V.cost({}), 0);
});

test('labels give each root the shortest tail nothing else shares', () => {
    const out = V.labels(['/a/b/datapacks', '/c/d/datapacks', '/e/notes']);
    assert.equal(out['/e/notes'], 'notes');
    assert.equal(out['/a/b/datapacks'], 'b/datapacks');
    assert.equal(out['/c/d/datapacks'], 'd/datapacks');
});

test('labels stop growing when one root nests inside another', () => {
    // TODO.md files this under "Needs a decision": growing cannot separate a
    // root from its own parent, because one runs out of segments first. The
    // guard is what stops the loop; the shorter label is allowed to repeat.
    const out = V.labels(['/a/b', '/a/b/c']);
    assert.equal(typeof out['/a/b'], 'string');
    assert.equal(typeof out['/a/b/c'], 'string');
});

test('delta says so rather than dividing by an empty window', () => {
    assert.match(V.delta(5, 0), /前期無資料/);
    assert.match(V.delta(12, 10), /\+20%/);
    assert.match(V.delta(8, 10), /-20%/);
});

test('delta in points reads a rise in waiting as bad', () => {
    const worse = V.delta(0.6, 0.4, 'pt');
    assert.match(worse, /\+20\.0 pt/);
    assert.match(worse, /class="delta dn"/);
    assert.match(V.delta(0.4, 0.6, 'pt'), /class="delta up"/);
});

test('match reads state, registry, stage and free text', () => {
    const s = {
        state: 'live', root: '/a', stage: 'build', task: 'rework the ramp',
        project: 'Waypoint', id: 'abc', label: 'a', claims: ['lib/badge.js'],
        notes: [], next: '',
    };
    assert.equal(V.match(s, { q: '', state: 'live', project: '', stage: '' }), true);
    assert.equal(V.match(s, { q: '', state: 'down', project: '', stage: '' }), false);
    assert.equal(V.match(s, { q: 'badge.js', state: '', project: '', stage: '' }), true);
    assert.equal(V.match(s, { q: 'nothing here', state: '', project: '', stage: '' }), false);
});

test('the model and the state are still free-text terms', () => {
    // Both were terms on the page this replaces. A facet covers state; nothing
    // covers the model, so the search box has to.
    const s = {
        state: 'live', root: '/a', stage: 'build', task: 'x', project: 'p', id: 'i',
        label: 'a', model: 'claude-opus-5', claims: [], notes: [], next: '',
    };
    assert.equal(V.match(s, { q: 'opus', state: '', project: '', stage: '' }), true);
    assert.equal(V.match(s, { q: 'live', state: '', project: '', stage: '' }), true);
});
