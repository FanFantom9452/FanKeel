'use strict';
// GET /station/search (design §5): only the pages a project files as current —
// role reference or decision — are searched; archive, plan and report pages
// are not. At most 20 hits, each with a snippet around the first match.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const { search, searchDirs } = require('../lib/docsearch.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

function write(dir, rel, text) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
}

// A project filed the audience way, with the word in six places: three it
// must find and three it must not.
function project(dir) {
    write(dir, '.fankeel/docs.json', JSON.stringify({ preset: 'audience', buckets: [
        { path: 'docs/01-guide', role: 'reference', audience: 'human' },
        { path: 'docs/03-decisions', role: 'decision', audience: 'human' },
        { path: 'docs/90-agent/reference', role: 'reference', audience: 'agent' },
        { path: 'docs/90-agent/plans', role: 'plan', audience: 'agent' },
        { path: 'docs/90-agent/reports', role: 'report', audience: 'agent' },
        { path: 'docs/99-archive', role: 'archive' },
    ] }));
    write(dir, 'docs/90-agent/reference/registry.md',
        '---\nstatus: current\n---\n# The registry\n\n`inflight` — `{ stage, at }` is the other transient field.\n');
    write(dir, 'docs/90-agent/reference/quiet.md', '---\nsummary: inflight\n---\n# Quiet\n\nNothing here.\n');
    write(dir, 'docs/01-guide/dev.md', '# Development\n\nan inflight task comes across\n');
    write(dir, 'docs/03-decisions/d.md', '# A decision\n\ninflight, inflight and INFLIGHT\n');
    write(dir, 'docs/99-archive/old.md', '# Old\n\ninflight\n');
    write(dir, 'docs/90-agent/plans/p.md', '# Plan\n\ninflight\n');
    write(dir, 'docs/90-agent/reports/r.md', '# Report\n\ninflight\n');
    return dir;
}

test('search finds reference, guide and decision pages, most matches first, and never an archive, plan or report page', () => {
    const dir = project(tmp('fankeel-search-'));
    const out = search([{ dir, pkey: dir, name: 'proj' }], 'InFlight');
    assert.equal(out.q, 'InFlight');
    assert.equal(out.n, 3);
    assert.deepEqual(out.hits.map((h) => h.path),
        ['docs/03-decisions/d.md', 'docs/01-guide/dev.md', 'docs/90-agent/reference/registry.md']);
    assert.deepEqual(out.hits.map((h) => h.role), ['decision', 'guide', 'reference']);
    assert.equal(out.hits[0].count, 3);
    const reg = out.hits[2];
    assert.equal(reg.title, 'The registry');
    assert.equal(reg.project, 'proj');
    assert.equal(reg.before, '# The registry `');
    assert.equal(reg.hit, 'inflight');
    assert.equal(reg.after, '` — `{ stage, at }` is the other transient field.');
    assert.ok(!out.hits.some((h) => /archive|plans|reports|quiet/.test(h.path)), 'frontmatter alone is not a match');
});

test('search caps the hits but counts every page, and an empty query is no search', () => {
    const dir = project(tmp('fankeel-search-cap-'));
    const out = search([{ dir, pkey: dir, name: 'proj' }], 'inflight', { limit: 1 });
    assert.equal(out.n, 3);
    assert.equal(out.hits.length, 1);
    assert.deepEqual(search([{ dir, pkey: dir, name: 'proj' }], '   '), { q: '', n: 0, hits: [] });
});

test('a project with no docs.json is read through the preset its layout matches', () => {
    const dir = tmp('fankeel-search-flat-');
    write(dir, 'docs/a.md', '# A\n\nwidget\n');
    write(dir, 'docs/plans/p.md', '# P\n\nwidget\n');
    const out = search([{ dir, pkey: dir, name: 'flat' }], 'widget');
    assert.deepEqual(out.hits.map((h) => h.path), ['docs/a.md']);
});

test('searchDirs takes each live registry root and its sessions\' projects, minus the hidden ones', () => {
    const root = tmp('fankeel-search-dirs-');
    fs.mkdirSync(path.join(root, 'P'));
    fs.mkdirSync(path.join(root, 'Q'));
    const model = { registries: [
        { root, gone: false, sessions: [{ project: 'P' }, { project: 'Q' }, { project: 'P' }],
            profiles: { [path.join(root, 'Q')]: { values: { 'station.hide': true } } } },
        { root: path.join(root, 'gone'), gone: true, sessions: [], profiles: {} },
    ] };
    assert.deepEqual(searchDirs(model).map((d) => d.pkey), [root, root + '/P']);
    assert.equal(searchDirs(model)[1].name, 'P');
});

const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    }).on('error', reject);
});

test('GET /station/search answers JSON: the reference page, not the archive page', async () => {
    const base = tmp('fankeel-search-serve-');
    const cfg = path.join(base, 'cfg');
    const ws = project(path.join(base, 'ws'));
    registry.ensureLayout(ws);
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(ws)]: new Date().toISOString() }) + '\n');
    const s = await serve({ configDir: cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const res = await get(s.url + 'station/search?q=' + encodeURIComponent('inflight'));
        assert.equal(res.status, 200);
        assert.match(res.headers['content-type'], /application\/json/);
        assert.equal(res.headers['cache-control'], 'no-store');
        const body = JSON.parse(res.text);
        assert.ok(body.hits.some((h) => h.path === 'docs/90-agent/reference/registry.md'));
        assert.ok(!body.hits.some((h) => h.path === 'docs/99-archive/old.md'));
    } finally {
        s.close();
    }
});
