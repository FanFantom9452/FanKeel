'use strict';
// lib/weekly-store.js: the weekly reports' archive under <configDir>/fankeel/weekly/
// (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 輸出位置 and 監控站整合).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const store = require('../lib/weekly-store.js');
const tmp = require('./tmp.js');

const archive = (since, until, extra) => Object.assign({ since, until, generated: until, projects: ['alpha'], counts: { done: 2, ongoing: 1 }, events: [], carry: [], next: [{ repo: 'alpha', text: '做完匯出' }] }, extra);

function three() {
    const cfg = tmp('fankeel-weekly-store-');
    store.save(cfg, '2025-12-19', { json: archive('2025-12-13', '2025-12-19'), html: '<body>a</body>' });
    store.save(cfg, '2026-01-02', { json: archive('2025-12-27', '2026-01-02', { next: [{ repo: 'beta', text: '補測試' }] }), html: '<html><body class="x">c</body></html>' });
    store.save(cfg, '2025-12-26', { json: archive('2025-12-20', '2025-12-26'), html: '<body>b</body>' });
    return cfg;
}

test('save writes <until>.json and <until>.html under fankeel/weekly and returns both paths', () => {
    const cfg = tmp('fankeel-weekly-store-');
    const got = store.save(cfg, '2026-01-02', { json: archive('2025-12-27', '2026-01-02'), html: '<p>x</p>' });
    assert.equal(store.weeklyDir(cfg), path.join(cfg, 'fankeel', 'weekly'));
    assert.equal(got.json, path.join(cfg, 'fankeel', 'weekly', '2026-01-02.json'));
    assert.equal(fs.readFileSync(got.html, 'utf8'), '<p>x</p>');
    assert.equal(JSON.parse(fs.readFileSync(got.json, 'utf8')).since, '2025-12-27');
    assert.throws(() => store.save(cfg, '../x', { json: {}, html: '' }), /YYYY-MM-DD/);
});

test('list is newest first with the counts and projects, and skips an archive that does not parse', () => {
    const cfg = three();
    fs.writeFileSync(path.join(store.weeklyDir(cfg), '2026-01-09.json'), '{not json');
    fs.unlinkSync(path.join(store.weeklyDir(cfg), '2025-12-19.html'));
    const got = store.list(cfg);
    assert.deepEqual(got.map((r) => r.until), ['2026-01-02', '2025-12-26', '2025-12-19']);
    assert.deepEqual(got[0], { until: '2026-01-02', since: '2025-12-27', done: 2, ongoing: 1, projects: ['alpha'], html: true });
    assert.equal(got[2].html, false);
    assert.deepEqual(store.list(tmp('fankeel-weekly-store-none-')), []);
});

test('latest is the newest archive with its next list, or null', () => {
    assert.deepEqual(store.latest(three()), { since: '2025-12-27', until: '2026-01-02', next: [{ repo: 'beta', text: '補測試' }] });
    const cfg = three();
    fs.writeFileSync(path.join(store.weeklyDir(cfg), '2026-01-09.json'), '{not json');
    assert.equal(store.latest(cfg).until, '2026-01-02');
    assert.equal(store.latest(tmp('fankeel-weekly-store-none-')), null);
});

test('htmlPath answers only a well-formed until whose html exists', () => {
    const cfg = three();
    assert.equal(store.htmlPath(cfg, '2025-12-26'), path.join(cfg, 'fankeel', 'weekly', '2025-12-26.html'));
    assert.equal(store.htmlPath(cfg, '2025-12-25'), null);
    assert.equal(store.htmlPath(cfg, '../../x'), null);
    assert.equal(store.htmlPath(cfg, '2025-12-26.html'), null);
    assert.ok(store.UNTIL_RE.test('2025-12-26'));
});

test('neighbours are the adjacent archives by until: prev older, next newer', () => {
    const cfg = three();
    assert.deepEqual(store.neighbours(cfg, '2025-12-26'), { prev: '2025-12-19', next: '2026-01-02' });
    assert.deepEqual(store.neighbours(cfg, '2025-12-19'), { prev: null, next: '2025-12-26' });
    assert.deepEqual(store.neighbours(cfg, '2026-01-02'), { prev: '2025-12-26', next: null });
    assert.deepEqual(store.neighbours(cfg, '2030-01-01'), { prev: null, next: null });
    fs.unlinkSync(path.join(store.weeklyDir(cfg), '2025-12-26.html'));
    assert.deepEqual(store.neighbours(cfg, '2026-01-02'), { prev: '2025-12-19', next: null });
});

test('navBar links back to the list and to each neighbour, and injectNav puts it right after <body>', () => {
    const nav = store.navBar({ prev: '2025-12-19', next: null });
    assert.match(nav, /^<nav data-block="weekly-nav" class="wk-nav">/);
    assert.ok(nav.includes('<a href="/#/weekly">← 回週報列表</a>'));
    assert.ok(nav.includes('<a href="/station/weekly/2025-12-19.html">上一份</a>'));
    assert.ok(nav.includes('<span class="off">下一份</span>'));
    assert.equal(store.injectNav('<html><body class="x"><p>c</p></body></html>', '<nav></nav>'), '<html><body class="x"><nav></nav><p>c</p></body></html>');
    assert.equal(store.injectNav('<p>c</p>', '<nav></nav>'), '<nav></nav><p>c</p>');
});
