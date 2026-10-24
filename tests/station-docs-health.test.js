'use strict';
// station-38: the 文件 page's health matrix and its reader, read off
// scripts/docs-audit.js's sweep and scripts/docs-check.js's scan. Dates come
// from mtime (no git here), as tests/docs-audit.test.js does.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const docs = require('../lib/docs.js');
const health = require('../scripts/docs-health.js');
const tmp = require('./tmp.js');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 21, 12, 0, 0);

function tree(files) {
    const root = tmp('fankeel-docs-health-');
    for (const [rel, spec] of Object.entries(files)) {
        const full = path.join(root, ...rel.split('/'));
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, spec.body);
        const at = (NOW - spec.age * DAY) / 1000;
        fs.utimesSync(full, at, at);
    }
    docs.write(root, docs.PRESETS.flat);
    return root;
}

const ROOT = tree({
    'docs/README.md': { body: '# docs\n\n- [architecture](01-architecture.md)\n- [old](gone.md)\n', age: 60 },
    'docs/01-architecture.md': { body: 'the badge is written by `lib/badge.js`\n', age: 60 },
    'docs/02-other.md': { body: '# other\n', age: 60 },
    'lib/badge.js': { body: 'x\n', age: 3 },
});
const DIRS = [{ pkey: 'p', name: 'proj', dir: ROOT }];

test('a project reads as six cells: drift, index and broken here, the rest null', () => {
    const out = health.health(DIRS, NOW);
    assert.equal(out.at, new Date(NOW).toISOString());
    assert.equal(out.projects.length, 1);
    const p = out.projects[0];
    assert.equal(p.pkey, 'p');
    assert.equal(p.name, 'proj');
    assert.equal(p.index, 'docs/README.md');
    assert.equal(p.noTree, false, 'docs.json declares the flat tree');
    assert.ok(p.files >= 3, 'markdown count from the sweep');
    assert.equal(typeof p.last, 'string');
    assert.deepEqual(Object.keys(p.cells).sort(), ['broken', 'diagram', 'drift', 'index', 'landed', 'unfiled']);
    assert.equal(p.cells.drift.n, 1);
    const d = p.cells.drift.items[0];
    assert.deepEqual({ path: d.path, target: d.target, gap: d.gap }, { path: 'docs/01-architecture.md', target: 'lib/badge.js', gap: 57 });
    assert.ok(p.cells.index.items.some((i) => i.path === 'docs/02-other.md' && i.target === undefined), 'a page the index never links');
    assert.ok(p.cells.index.items.some((i) => i.path === 'docs/README.md' && /gone\.md/.test(i.target)), 'a dead link in the index');
    assert.ok(p.cells.broken.items.some((i) => i.tag === 'gone' && i.path.startsWith('docs/README.md:')), 'docs-check findings carry file:line');
    assert.equal(p.cells.landed, null);
    assert.equal(p.cells.diagram, null);
});

test('a cell lists at most 50 items and still counts them all', () => {
    let body = '# many\n\n';
    for (let i = 0; i < 60; i++) body += '- [x' + i + '](n' + i + '.md)\n';
    const root = tree({ 'docs/README.md': { body: '# docs\n\n- [many](many.md)\n', age: 5 }, 'docs/many.md': { body, age: 5 } });
    const p = health.health([{ pkey: 'm', name: 'many', dir: root }], NOW).projects[0];
    assert.ok(p.cells.broken.n >= 60);
    assert.equal(p.cells.broken.items.length, 50);
});

test('readDoc answers a tracked markdown page and nothing else', () => {
    assert.equal(health.readDoc(DIRS, 'p', 'docs/02-other.md'), '# other\n');
    for (const bad of ['../x.md', 'docs/../docs/02-other.md', 'lib/badge.js', 'docs/none.md', 'docs\\02-other.md', '/docs/02-other.md', '']) {
        assert.equal(health.readDoc(DIRS, 'p', bad), null, bad);
    }
    assert.equal(health.readDoc(DIRS, 'nobody', 'docs/02-other.md'), null, 'an unknown pkey');
});

test('cached answers the same object inside ten minutes, and fresh reads again', () => {
    const a = health.cached(DIRS, NOW, false);
    assert.equal(health.cached(DIRS, NOW + 60e3, false), a);
    const b = health.cached(DIRS, NOW + 120e3, true);
    assert.notEqual(b, a);
    assert.equal(b.at, new Date(NOW + 120e3).toISOString());
    assert.notEqual(health.cached(DIRS, NOW + 120e3 + 600001, false), b, 'past ten minutes it reads again');
});
