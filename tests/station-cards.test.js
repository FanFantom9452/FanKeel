'use strict';
// The cards that leave 現在 for Sessions and 花費 (docs/90-agent/plans/
// 2026-10-21-station-focus-design.md §3), each called directly.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { SRC } = require('./station-src.js');

function page(sessions) {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const doc = { getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, head: { appendChild() {} }, querySelectorAll: () => [] };
    const win = { location: { hash: '#/' }, addEventListener() {}, scrollTo() {},
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date().toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-04', serve: false, projects: [],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: sessions || [] } };
    const box = { window: win, document: doc, URLSearchParams, fetch() {}, module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return box.module.exports;
}
const TODAY = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

test('a claim named like an Object method does not break the clash card', () => {
    const R = [{ id: 'a', state: 'live', claims: ['constructor', 'toString'], project: 'p', days: [] }, { id: 'b', state: 'live', claims: ['constructor'], project: 'p', days: [] }];
    const html = page(R).dashClash(R);
    assert.match(html, /constructor/);
    assert.doesNotMatch(html, /toString/);
});

test('the clash card lists a file two live sessions claim', () => {
    const R = [{ id: 'a', state: 'live', claims: ['x.js', 'y.js'], project: 'p', days: [] }, { id: 'b', state: 'live', claims: ['x.js'], project: 'p', days: [] }, { id: 'c', state: 'down', claims: ['y.js'], days: [] }];
    const html = page(R).dashClash(R);
    assert.match(html, /data-block="dash-clash"/);
    assert.match(html, /x\.js/);
    assert.doesNotMatch(html, /y\.js/);
});

test('依專案花費 sums each project\'s spend, most first', () => {
    const t = TODAY();
    const R = [{ id: 'a', pkey: 'F:\\w\\alpha', days: [{ day: t, usd: 3 }] }, { id: 'b', pkey: 'F:\\w\\beta', days: [{ day: t, usd: 4 }, { day: t, usd: 5 }] }];
    // Booted with no rows: NAMES built from rows with no `root` would label both projects "undefined".
    const html = page().dashByProj(R);
    assert.ok(html.indexOf('beta') < html.indexOf('alpha'), 'beta first');
    assert.match(html, /\$9\.00/);
});

test('近 7 天 token adds the five kinds and skips a day with no tokens', () => {
    const t = TODAY();
    const d = new Date(Date.now() - 10 * 864e5);
    const old = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const R = [{ id: 'a', days: [{ day: t, tokens: { input: 400000, output: 30000, cacheRead: 2000000, cacheWrite5m: 5000 } }, { day: t, tokens: null },
        { day: old, tokens: { input: 9000000, output: 0, cacheRead: 0, cacheWrite5m: 0 } }] }];
    const V = page(R);
    const html = V.dashTokens7(R);
    assert.match(html, new RegExp('<div class="dbig">' + V.tokens(2435000) + '<'));
    for (const [k, n] of [['input', 400000], ['output', 30000], ['cache read', 2000000], ['cache write 5m · agent', 5000], ['cache write 1h · 主對話', 0]]) assert.match(html, new RegExp(k + ' <b>' + V.tokens(n) + '</b>'), k);
});

test('模型用量分布 splits the spend by model', () => {
    const t = TODAY();
    const R = [{ id: 'a', days: [{ day: t, usd: 3, model: 'claude-opus-4-1' }, { day: t, usd: 1, model: 'claude-sonnet-4-5' }] }];
    const html = page(R).dashModels(R);
    assert.match(html, /Opus 4\.1 <b>75%<\/b>/);
    assert.match(html, /Sonnet 4\.5 <b>25%<\/b>/);
});

test('gate 平均等待 averages the stages that waited', () => {
    const now = Date.now();
    const R = [{ id: 'a', stages: [{ stage: 'design', from: now - 6e5, to: now, waited: 6e5 }, { stage: 'plan', from: now - 6e5, to: now, waited: 18e5 }, { stage: 'build', from: now - 6e5, to: now, waited: 0 },
        { stage: 'verify', from: now - 8 * 864e5, to: now - 8 * 864e5 + 1, waited: 36e6 }] }];
    assert.match(page(R).dashGateWait(R), /<div class="dbig">20 分/);
});

test('最近 land lists done TODO entries and sessions at land, not one still building', () => {
    const R = [{ id: 's1', state: 'down', stage: 'land', task: 'Land the thing', pkey: 'F:\\w\\a', updated: Date.now() }, { id: 's2', state: 'live', stage: 'build', task: 'Still going', pkey: 'F:\\w\\a', updated: Date.now() }];
    const S = { projects: [{ todos: [{ pkey: 'F:\\w\\a', open: [], done: [{ label: 'x', title: 'Shipped entry', at: '2026-10-01', sha: 'abcdef1234' }] }] }], sessions: R };
    const html = page(R).dashLanded(R, S);
    assert.ok(html.indexOf('Land the thing') >= 0 && html.indexOf('Land the thing') < html.indexOf('Shipped entry'), 'newest first');
    assert.doesNotMatch(html, /Still going/);
});
