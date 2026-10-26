'use strict';
// skills/fankeel-design/catalog/: the 162 blocks the user kept on
// 2026-10-27, read only by fankeel-mockup when it draws.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'skills', 'fankeel-design', 'catalog');
const load = (n) => JSON.parse(fs.readFileSync(path.join(DIR, n), 'utf8'));

test('the catalogue holds 69 exclusions and 93 inclusions, each with a source', () => {
    const ex = load('exclude.json');
    const inc = load('include.json');
    assert.equal(ex.items.length, 69);
    assert.equal(inc.items.length, 93);
    const all = ex.items.concat(inc.items);
    const ids = all.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
    for (const e of all) {
        assert.ok(Array.isArray(e.src) && e.src.length, e.id + ' has no src');
        assert.match(e.src[0], /^(T|I|D)\//, e.id);
    }
    for (const f of [ex, inc]) for (const k of ['T', 'I', 'D']) assert.ok(f.notice.sources[k], 'notice lacks ' + k);
    assert.match(ex.notice.sources.T, /MIT/);
    assert.match(ex.notice.sources.D, /MC Dean/);
});

test('an exclusion with a lint rule carries the sample that shows it', () => {
    for (const e of load('exclude.json').items) {
        assert.equal(typeof e.check, 'string', e.id);
        if (e.check !== 'review') assert.ok(e.html && e.css, e.id + ' has a rule but no sample');
    }
});

test('palettes, type pairings, app styles and directions carry the values a mockup draws with', () => {
    const inc = load('include.json').items;
    for (const p of inc.filter((e) => e.kind === 'palette')) {
        for (const k of ['bg', 'surface', 'ink', 'muted', 'accent']) assert.match(p.value[k], /^#[0-9a-f]{3,8}$/i, p.id + ' ' + k);
    }
    for (const t of inc.filter((e) => e.kind === 'type')) assert.ok(t.value.fallback.display && t.value.fallback.text, t.id);
    assert.equal(inc.filter((e) => e.kind === 'app').length, 7);
    assert.equal(inc.filter((e) => e.kind === 'direction').length, 20);
});
