'use strict';
// lib/weekly-git.js: what the weekly report reads from git
// (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 收 and 架構圖).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const wg = require('../lib/weekly-git.js');
const { makeRepo, lines } = require('./weekly-fixture.js');
const tmp = require('./tmp.js');

function repo() {
    return makeRepo(path.join(tmp('fankeel-weekly-git-'), 'demo'), [
        { date: '2025-12-29', subj: 'chore: start', files: { 'README.md': lines(2) } },
        { date: '2025-12-30', subj: 'feat(api): add search', files: { 'src/api/a.js': lines(3) } },
        { date: '2025-12-31', subj: 'fix(api): paging', files: { 'src/api/a.js': lines(5) } },
        { date: '2026-01-01', subj: 'docs: guide', files: { 'docs/guide.md': lines(4) } },
        { date: '2026-01-02', subj: 'refactor(core)!: move a', mv: [['src/api/a.js', 'src/core/a.js']], files: { 'src/core/b.js': lines(1) } },
        { date: '2026-01-03', subj: 'feat: later', files: { 'x.js': lines(1) } },
    ]);
}

test('commits reads both ends of the range inclusive, with per-file added and removed lines', () => {
    const dir = repo();
    const got = wg.commits(dir, '2025-12-30', '2026-01-02');
    assert.deepEqual(got.map((c) => c.date), ['2026-01-02', '2026-01-01', '2025-12-31', '2025-12-30']);
    const add = got.find((c) => c.subj === 'feat(api): add search');
    assert.deepEqual(add.files, [{ p: 'src/api/a.js', a: 3, d: 0 }]);
    assert.deepEqual(got.find((c) => c.subj === 'fix(api): paging').files, [{ p: 'src/api/a.js', a: 2, d: 0 }]);
    assert.match(add.h, /^[0-9a-f]{7,}$/);
    assert.equal(wg.countCommits(dir, '2025-12-30', '2026-01-02'), 4);
    assert.deepEqual(wg.commits(path.join(dir, 'nope'), '2025-12-30', '2026-01-02'), []);
    assert.equal(wg.countCommits(path.join(dir, 'nope'), '2025-12-30', '2026-01-02'), 0);
});

test('a renamed file is counted under its new path, never as "a => b"', () => {
    const got = wg.commits(repo(), '2026-01-02', '2026-01-02');
    const paths = got[0].files.map((f) => f.p).sort();
    assert.deepEqual(paths, ['src/core/a.js', 'src/core/b.js']);
});

test('scopeOf reads the conventional-commit scope, and groupByScope puts the largest group first', () => {
    assert.equal(wg.scopeOf('feat(mip_extract): x'), 'mip_extract');
    assert.equal(wg.scopeOf('refactor(core)!: move'), 'core');
    assert.equal(wg.scopeOf('docs: guide'), null);
    assert.equal(wg.scopeOf('Merge branch x'), null);
    const groups = wg.groupByScope(wg.commits(repo(), '2025-12-30', '2026-01-02'));
    assert.deepEqual(groups.map((g) => [g.scope, g.commits.length]), [['api', 2], ['(其他)', 1], ['core', 1]]);
    assert.deepEqual(groups[0].files, ['src/api/a.js']);
    assert.deepEqual(Object.keys(groups[0].commits[0]).sort(), ['date', 'h', 'subj']);
});

test('dayRange crosses a year, and dailyCounts fills every day with 0', () => {
    assert.deepEqual(wg.dayRange('2025-12-30', '2026-01-01'), ['2025-12-30', '2025-12-31', '2026-01-01']);
    const counts = wg.dailyCounts(wg.commits(repo(), '2025-12-30', '2026-01-02'), '2025-12-29', '2026-01-02');
    assert.deepEqual(counts, { '2025-12-29': 0, '2025-12-30': 1, '2025-12-31': 1, '2026-01-01': 1, '2026-01-02': 1 });
});

test('scanRepos finds repositories one and two levels under each root, and nothing deeper or hidden', () => {
    const root = tmp('fankeel-weekly-scan-');
    makeRepo(path.join(root, 'a'), []);
    makeRepo(path.join(root, 'group', 'b'), []);
    makeRepo(path.join(root, 'group', 'deep', 'c'), []);
    makeRepo(path.join(root, '.hidden', 'd'), []);
    fs.mkdirSync(path.join(root, 'plain'));
    const slash = (p) => p.replace(/\\/g, '/');
    assert.deepEqual(wg.scanRepos([root]), [slash(path.join(root, 'a')), slash(path.join(root, 'group', 'b'))]);
    assert.deepEqual(wg.scanRepos([path.join(root, 'missing')]), []);
});

test('kindOf: generated or -diff paths and big data files are data, markdown and docs/ are doc, the rest code', () => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, '.gitattributes'), '# generated\nout/** linguist-generated\n*.bin -diff\nsrc/*.js text\n');
    const attrs = wg.readAttrs(dir);
    assert.deepEqual(attrs, ['out/**', '*.bin']);
    assert.equal(wg.kindOf('out/runs/1.txt', { attrs }), 'data');
    assert.equal(wg.kindOf('deep/x.bin', { attrs }), 'data');
    assert.equal(wg.kindOf('big.jsonl', { attrs, lines: 1500 }), 'data');
    assert.equal(wg.kindOf('package.json', { attrs, lines: 12 }), 'code');
    assert.equal(wg.kindOf('docs/a.txt', { attrs }), 'doc');
    assert.equal(wg.kindOf('README.md', {}), 'doc');
    assert.equal(wg.kindOf('src/a.js'), 'code');
    assert.deepEqual(wg.readAttrs(tmp('fankeel-weekly-noattrs-')), []);
});

test('lsFiles lists the tracked paths with forward slashes', () => {
    const files = wg.lsFiles(repo());
    assert.ok(files.includes('src/core/a.js') && files.includes('docs/guide.md') && !files.includes('src/api/a.js'));
});

test('newPath: a rename across top-level directories, into a subdirectory and back out keeps the new path', () => {
    const dir = makeRepo(path.join(tmp('fankeel-weekly-git-mv-'), 'demo'), [
        { date: '2026-02-01', subj: 'chore: seed', files: { 'src/m.js': lines(10, 'm'), 'top.js': lines(10, 't'), 'src/n.js': lines(10, 'n') } },
        { date: '2026-02-02', subj: 'refactor: across', mv: [['src/m.js', 'lib/m.js']] },
        { date: '2026-02-03', subj: 'refactor: whole path', mv: [['top.js', 'sub/c.js']] },
        { date: '2026-02-04', subj: 'refactor: into', mv: [['src/n.js', 'src/x/n.js']] },
        { date: '2026-02-05', subj: 'refactor: out', mv: [['src/x/n.js', 'src/n.js']] },
    ]);
    const only = (d) => wg.commits(dir, d, d)[0].files.map((f) => f.p);
    assert.deepEqual(only('2026-02-02'), ['lib/m.js']);
    assert.deepEqual(only('2026-02-03'), ['sub/c.js']);
    assert.deepEqual(only('2026-02-04'), ['src/x/n.js']);
    assert.deepEqual(only('2026-02-05'), ['src/n.js']);
});

test('gitattributes patterns: ? is one non-slash char, a leading / anchors, trailing / is a directory, **/ is any depth, metacharacters are literal, a match covers what is under it', () => {
    const k = (p, pat) => wg.kindOf(p, { attrs: [pat] });
    assert.equal(k('a1.bin', 'a?.bin'), 'data');
    assert.equal(k('a12.bin', 'a?.bin'), 'code');
    assert.equal(k('a/.bin', 'a?.bin'), 'code');
    assert.equal(k('top.bin', '/top.bin'), 'data');
    assert.equal(k('deep/top.bin', '/top.bin'), 'code');
    assert.equal(k('deep/top.bin', 'top.bin'), 'data');
    assert.equal(k('gen/a.js', 'gen/'), 'data');
    assert.equal(k('src/gen/a.js', 'gen/'), 'data');
    assert.equal(k('a/b/gen.js', 'a/**/gen.js'), 'data');
    assert.equal(k('a/gen.js', 'a/**/gen.js'), 'data');
    assert.equal(k('ab/gen.js', 'a/**/gen.js'), 'code');
    assert.equal(k('a+b.js', 'a+b.js'), 'data');
    assert.equal(k('aab.js', 'a+b.js'), 'code');
    assert.equal(k('axb.js', 'a.b.js'), 'code');
    assert.equal(k('out/x', 'out'), 'data');
    assert.equal(k('outer/x', 'out'), 'code');
    assert.equal(k('a.c', '*.[ch]'), 'code');
});

test('kindOf: a data extension turns to data above 1000 lines only, case-insensitively, and docs/ is a whole directory name', () => {
    assert.equal(wg.kindOf('x.json', { lines: 1000 }), 'code');
    assert.equal(wg.kindOf('x.json', { lines: 1001 }), 'data');
    assert.equal(wg.kindOf('X.CSV', { lines: 1001 }), 'data');
    assert.equal(wg.kindOf('X.CSV', { lines: 5 }), 'code');
    assert.equal(wg.kindOf('docs/a.txt'), 'doc');
    assert.equal(wg.kindOf('mydocs/a.txt'), 'code');
    assert.equal(wg.kindOf('src/docs/a.txt'), 'doc');
});
