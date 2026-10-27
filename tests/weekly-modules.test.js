'use strict';
// lib/weekly-modules.js: the modules a weekly report's architecture map draws
// (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 架構圖).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const wm = require('../lib/weekly-modules.js');
const { renderBoard } = require('../lib/board.js');
const { makeRepo, lines } = require('./weekly-fixture.js');
const tmp = require('./tmp.js');

const MAP = [
    '# demo — map',
    '',
    'tree — 5 rows from docs/02-architecture/layout.md, under What lives where',
    '  ├── docs/              reference pages',
    '  ├── lib/               the logic',
    '  │   ├── registry.js    one entry per session',
    '  │   └── board/         the drawing',
    '  └── README.md          read first',
    '',
    'orientation:',
].join('\n');

test('fromMap: a top directory with rows under it is a frame, the rest sit in the root frame', () => {
    const def = wm.fromMap(MAP);
    assert.deepEqual(def.frames.map((f) => f.id), ['f-top', 'f-lib']);
    assert.deepEqual(def.frames[0].nodes.map((n) => n.match), ['docs/', 'README.md', '(root)']);
    assert.deepEqual(def.frames[1].nodes.map((n) => [n.name, n.match]), [['registry.js', 'lib/registry.js'], ['board', 'lib/board/'], ['其他', 'lib/*']]);
    assert.equal(def.frames[1].label, 'lib');
    assert.equal(wm.fromMap('# no tree here\n'), null);
});

test('fromFiles: two levels, a directory with fewer than two subdirectories is one node', () => {
    const def = wm.fromFiles(['README.md', 'src/a/x.js', 'src/b/y.js', 'src/z.js', 'docs/p.md', 'docs/q/r.md']);
    assert.deepEqual(def.frames.map((f) => f.id), ['f-top', 'f-src']);
    assert.deepEqual(def.frames[0].nodes.map((n) => n.match), ['docs/', '(root)']);
    assert.deepEqual(def.frames[1].nodes.map((n) => n.match), ['src/a/', 'src/b/', 'src/*']);
});

test('resolver: exact file, longest directory prefix, the catch-all, then the root node', () => {
    const def = wm.fromMap(MAP);
    const res = wm.resolver(def);
    assert.equal(res('lib/registry.js'), 'n-lib-registry-js');
    assert.equal(res('lib/board/svg.js'), 'n-lib-board');
    assert.equal(res('lib/other.js'), 'n-lib-other');
    assert.equal(res('docs/a/b.md'), 'n-docs');
    assert.equal(res('README.md'), 'n-README-md');
    assert.equal(res('package.json'), 'n-root');
    assert.equal(res('bench/x.js'), null);
});

test('moduleStats counts code only toward modules and the main totals, every kind toward byKind', () => {
    const def = wm.fromFiles(['src/a/x.js', 'src/b/y.js', 'docs/p.md', 'data.json']);
    const list = [
        { h: '1', date: '2026-01-01', subj: 's', files: [{ p: 'src/a/x.js', a: 150, d: 60 }, { p: 'docs/p.md', a: 40, d: 0 }] },
        { h: '2', date: '2026-01-02', subj: 's', files: [{ p: 'src/a/x.js', a: 5, d: 0 }, { p: 'data.json', a: 3000, d: 0 }, { p: 'src/b/y.js', a: 1, d: 1 }] },
    ];
    const st = wm.moduleStats(def, list, { attrs: [] });
    assert.deepEqual([st.A, st.D, st.files], [156, 61, 2]);
    assert.deepEqual(st.byKind, { code: { a: 156, d: 61 }, doc: { a: 40, d: 0 }, data: { a: 3000, d: 0 } });
    const a = st.mods.find((m) => m.id === 'n-src-a');
    assert.deepEqual([a.a, a.d, a.files, a.level, a.frame], [155, 60, 1, 4, 'src'], '215 of 217 code lines is level 4');
    assert.equal(st.mods.find((m) => m.id === 'n-src-b').level, 1, '2 of 217 code lines is under 5%, level 1');
    assert.equal(st.mods.find((m) => m.id === 'n-docs').level, 0, 'docs never heat the map');
    assert.equal(st.mods.length, def.frames.flatMap((f) => f.nodes).length);
});

test('moduleStats heats by share of the repo change, not by lines: 150 lines all in one module is level 4', () => {
    const def = wm.fromFiles(['src/a/x.js', 'src/b/y.js']);
    const st = wm.moduleStats(def, [{ h: '1', date: '2026-01-01', subj: 's', files: [{ p: 'src/a/x.js', a: 100, d: 50 }] }], { attrs: [] });
    const a = st.mods.find((m) => m.id === 'n-src-a');
    assert.deepEqual([a.share, a.level], [1, 4]);
    assert.deepEqual(st.mods.find((m) => m.id === 'n-src-b').level, 0);
    const none = wm.moduleStats(def, [], { attrs: [] });
    assert.ok(none.mods.every((m) => m.share === 0 && m.level === 0), 'no code change, no heat');
});

test('module ids are unique within a repo: every frame 其他 and a slug collision get their own id', () => {
    const def = wm.fromMap(MAP.replace('  └── README.md          read first', [
        '  ├── src/               more logic',
        '  │   ├── api/           the api',
        '  │   └── ui/            the ui',
        '  ├── lib-board          a file whose slug collides',
        '  └── README.md          read first',
    ].join('\n')));
    const ids = def.frames.flatMap((f) => f.nodes.map((n) => n.id));
    assert.equal(new Set(ids).size, ids.length, ids.join(' '));
    assert.ok(ids.includes('n-lib-other') && ids.includes('n-src-other'), 'two 其他 nodes, two ids');
    assert.ok(ids.includes('n-lib-board') && ids.includes('n-lib-board-2'), 'the second of two equal slugs is suffixed');
    const st = wm.moduleStats(def, [], { attrs: [] });
    assert.deepEqual(st.mods.map((m) => m.id), ids);
});

test('boardText draws through renderBoard: one node per module, coloured by level', async () => {
    const def = Object.assign({ title: 'demo 架構' }, wm.fromFiles(['src/a/x.js', 'src/b/y.js', 'README.md']));
    const st = wm.moduleStats(def, [{ h: '1', date: '2026-01-01', subj: 's', files: [{ p: 'src/a/x.js', a: 6000, d: 0 }] }], {});
    const text = wm.boardText(def, st.mods);
    const recs = text.trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(recs[0].chartroom, 1);
    const nodes = recs.filter((r) => r.node && r.shape === 'round');
    assert.equal(nodes.length, st.mods.length);
    const hot = nodes.find((r) => r.node === 'n-src-a');
    assert.deepEqual([hot.fill, hot.label], ['#1c3a8c', 'a\n+6,000 −0']);
    assert.equal(nodes.find((r) => r.node === 'n-src-b').label, 'b\n本期未改動');
    const svg = await renderBoard(text);
    assert.match(svg, /^<svg /);
    assert.ok(svg.includes('#1c3a8c') && svg.includes('#eaeef1'));
});

test('moduleDef reads .fankeel/map.md when there is one, else git ls-files', () => {
    const dir = makeRepo(path.join(tmp('fankeel-weekly-mod-'), 'demo'), [{ date: '2026-01-01', subj: 'x', files: { 'src/a/x.js': lines(1), 'src/b/y.js': lines(1) } }]);
    const plain = wm.moduleDef(dir, 'demo');
    assert.equal(plain.title, 'demo 架構');
    assert.deepEqual(plain.frames.map((f) => f.id), ['f-src']);
    fs.mkdirSync(path.join(dir, '.fankeel'));
    fs.writeFileSync(path.join(dir, '.fankeel', 'map.md'), MAP);
    assert.deepEqual(wm.moduleDef(dir, 'demo').frames.map((f) => f.id), ['f-top', 'f-lib']);
});
