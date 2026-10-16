'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const IDS = ['dash-clash', 'dash-byproj', 'dash-tokens7', 'dash-models', 'dash-gatewait', 'dash-landed', 'dash-blocked', 'dash-agents'];
const DEF = ['dash-live', 'waiting-card', 'dash-todo', 'dash-spend', 'dash-recent'];

function page(kept, sessions, projects) {
    kept = kept || {};
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const doc = { getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, head: { appendChild() {} }, querySelectorAll: () => [] };
    const win = { location: { hash: '#/' }, addEventListener() {}, scrollTo() {},
        localStorage: { getItem: (k) => (k in kept ? kept[k] : null), setItem: (k, v) => { kept[k] = String(v); }, removeItem: (k) => { delete kept[k]; } },
        STATION: { generatedAt: new Date().toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-04', serve: false, projects: projects || [],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: sessions || [] } };
    const box = { window: win, document: doc, URLSearchParams, fetch() {}, module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return box.module.exports;
}

// page() with the document's listeners kept, a body to append to, and a
// dialog `createElement('div').firstChild` hands back, so a press can be
// followed to what it stored, drew and opened.
function editor(kept) {
    const listeners = {}, els = {}, opened = [];
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {},
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute() {}, appendChild() {}, addEventListener() {},
        get firstChild() { const html = this.innerHTML; return { html, addEventListener() {}, showModal() { opened.push(html); } }; } });
    const doc = { hidden: false, documentElement: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el, querySelectorAll: () => [],
        querySelector: () => null, head: { appendChild() {} }, body: { appendChild() {} } };
    const win = { location: { hash: '#/', protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: (k) => (k in kept ? kept[k] : null), setItem: (k, v) => { kept[k] = String(v); }, removeItem: (k) => { delete kept[k]; } },
        STATION: { generatedAt: new Date().toISOString(), configDir: 'cfg', pricesVerified: '2026-09-04', serve: false, projects: [],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    const press = (attrs) => { for (const fn of listeners.click || []) fn({ preventDefault() {}, stopPropagation() {}, target: { getAttribute: (k) => (k in attrs ? attrs[k] : null), hasAttribute: (k) => k in attrs,
        closest(sel) { return Object.keys(attrs).some((k) => sel.includes('[' + k + ']')) ? this : null; } } }); };
    return { press, opened, page: () => els.page.innerHTML };
}

test('every new card kind is known to the order and has a builder', () => {
    const V = page();
    const known = V.dashOrder(JSON.stringify({ order: IDS, off: [] })).map((c) => c.id);
    for (const id of IDS) assert.ok(known.includes(id), id);
    for (const id of IDS) assert.equal(typeof V.dashKinds()[id].render, 'function', id);
});

test('new cards are off by default and offered by the library', () => {
    const V = page();
    const list = V.dashOrder(null);
    for (const id of IDS) assert.equal(list.find((c) => c.id === id).on, false, id);
    const lib = V.dashLibrary(list);
    for (const id of IDS) assert.match(lib, new RegExp('data-dadd="' + id + '"'));
});

test('a claim named like an Object method does not break the clash card', () => {
    const V = page();
    const R = [{ id: 'a', state: 'live', claims: ['constructor', 'toString'], project: 'p', days: [] }, { id: 'b', state: 'live', claims: ['constructor'], project: 'p', days: [] }];
    const html = V.dashKinds()['dash-clash'].render(R, { projects: [], sessions: R });
    assert.match(html, /constructor/);
    assert.doesNotMatch(html, /toString/);
});

test('the clash card lists a file two live sessions claim', () => {
    const V = page();
    const R = [{ id: 'a', state: 'live', claims: ['x.js', 'y.js'], project: 'p', days: [] }, { id: 'b', state: 'live', claims: ['x.js'], project: 'p', days: [] }, { id: 'c', state: 'down', claims: ['y.js'], days: [] }];
    const html = V.dashKinds()['dash-clash'].render(R, { projects: [], sessions: R });
    assert.match(html, /x\.js/);
    assert.doesNotMatch(html, /y\.js/);
});

test('dashOrder brings a non-default kind the stored order lacks back off, and one it lists on', () => {
    const got = page().dashOrder(JSON.stringify({ order: DEF.concat(['dash-models']), off: [] }));
    assert.equal(got.find((c) => c.id === 'dash-models').on, true, 'listed and not off');
    for (const id of IDS.filter((x) => x !== 'dash-models')) assert.equal(got.find((c) => c.id === id).on, false, id);
});

test('outside edit mode an off kind is not drawn; in edit mode the slot offers 新增卡片 with how many are left', () => {
    const c = editor({});
    assert.doesNotMatch(c.page(), /data-block="dash-clash"|class="dadd"/);
    c.press({ 'data-dchtog': '1' });
    assert.match(c.page(), /<button type="button" class="dadd" data-dlib="1"[^>]*aria-haspopup="dialog"[^>]*>[\s\S]*新增卡片[\s\S]*還有 8 種卡片可加/);
    assert.doesNotMatch(c.page(), /data-block="dash-clash"/, 'an off kind is offered, not drawn');
});

test('pressing 加入 puts the card on and last, and the page draws it', () => {
    const kept = {};
    const c = editor(kept);
    c.press({ 'data-dchtog': '1' });
    c.press({ 'data-dadd': 'dash-models' });
    const saved = JSON.parse(kept['station.dash']);
    assert.equal(saved.order[saved.order.length - 1], 'dash-models');
    assert.ok(!saved.off.includes('dash-models'));
    assert.match(c.page(), /data-block="dash-models"/);
});

test('pressing 新增卡片 opens the library dialog', () => {
    const c = editor({});
    c.press({ 'data-dchtog': '1' });
    c.press({ 'data-dlib': '1' });
    assert.equal(c.opened.length, 1);
    assert.match(c.opened[0], /^<dialog class="dlib" data-block="dash-library"/);
});

test('the library marks an added kind 已加入 and offers a hidden default card back in place', () => {
    const V = page();
    const list = V.dashOrder(JSON.stringify({ order: DEF.concat(['dash-models']), off: ['dash-spend'] }));
    const lib = V.dashLibrary(list);
    assert.doesNotMatch(lib, /data-dadd="dash-models"/);
    assert.match(lib, /<button type="button" class="btn" disabled[^>]*>[\s\S]*?已加入/);
    assert.match(lib, /data-dhide="dash-spend"/);
    assert.doesNotMatch(lib, /data-dhide="dash-live"/);
});

const TODAY = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

test('依專案花費 sums each project\'s spend, most first', () => {
    const t = TODAY();
    const R = [{ id: 'a', pkey: 'F:\\w\\alpha', days: [{ day: t, usd: 3 }] }, { id: 'b', pkey: 'F:\\w\\beta', days: [{ day: t, usd: 4 }, { day: t, usd: 5 }] }];
    const html = page().dashKinds()['dash-byproj'].render(R, { projects: [], sessions: R });
    assert.ok(html.indexOf('beta') < html.indexOf('alpha'), 'beta first');
    assert.match(html, /\$9\.00/);
});

test('近 7 天 token adds the four kinds and skips a day with no tokens', () => {
    const t = TODAY();
    const d = new Date(Date.now() - 10 * 864e5);
    const old = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    // Four distinct sizes, so losing any one kind changes a figure; a day ten days back is outside the window.
    const R = [{ id: 'a', days: [{ day: t, tokens: { input: 400000, output: 30000, cacheRead: 2000000, cacheWrite5m: 5000 } }, { day: t, tokens: null },
        { day: old, tokens: { input: 9000000, output: 0, cacheRead: 0, cacheWrite5m: 0 } }] }];
    const V = page({}, R);
    const html = V.dashKinds()['dash-tokens7'].render(R, { projects: [], sessions: R });
    assert.match(html, new RegExp('<div class="dbig">' + V.tokens(2435000) + '<'));
    for (const [k, n] of [['input', 400000], ['output', 30000], ['cache read', 2000000], ['cache write', 5000]]) assert.match(html, new RegExp(k + ' <b>' + V.tokens(n) + '</b>'), k);
});

test('模型用量分布 splits the spend by model', () => {
    const t = TODAY();
    const R = [{ id: 'a', days: [{ day: t, usd: 3, model: 'claude-opus-4-1' }, { day: t, usd: 1, model: 'claude-sonnet-4-5' }] }];
    const V = page({}, R);
    const html = V.dashKinds()['dash-models'].render(R, { projects: [], sessions: R });
    assert.match(html, /Opus 4\.1 <b>75%<\/b>/);
    assert.match(html, /Sonnet 4\.5 <b>25%<\/b>/);
});

test('gate 平均等待 averages the stages that waited', () => {
    const now = Date.now();
    // A long gate eight days back is outside the 近 7 天 window and must not move the average.
    const R = [{ id: 'a', stages: [{ stage: 'design', from: now - 6e5, to: now, waited: 6e5 }, { stage: 'plan', from: now - 6e5, to: now, waited: 18e5 }, { stage: 'build', from: now - 6e5, to: now, waited: 0 },
        { stage: 'verify', from: now - 8 * 864e5, to: now - 8 * 864e5 + 1, waited: 36e6 }] }];
    const V = page({}, R);
    const html = V.dashKinds()['dash-gatewait'].render(R, { projects: [], sessions: R });
    assert.match(html, /<div class="dbig">20 分/);
});

test('最近 land lists done TODO entries and sessions at land, not one still building', () => {
    const R = [{ id: 's1', state: 'down', stage: 'land', task: 'Land the thing', pkey: 'F:\\w\\a', updated: Date.now() }, { id: 's2', state: 'live', stage: 'build', task: 'Still going', pkey: 'F:\\w\\a', updated: Date.now() }];
    const S = { projects: [{ todos: [{ pkey: 'F:\\w\\a', open: [], done: [{ label: 'x', title: 'Shipped entry', at: '2026-10-01', sha: 'abcdef1234' }] }] }], sessions: R };
    const html = page({}, R).dashKinds()['dash-landed'].render(R, S);
    assert.ok(html.indexOf('Land the thing') >= 0 && html.indexOf('Land the thing') < html.indexOf('Shipped entry'), 'newest first');
    assert.doesNotMatch(html, /Still going/);
});

test('TODO Blocked lists blocked entries by stamp, soonest first', () => {
    const e = (id, state, stamp) => ({ id, label: 'l', title: 'T ' + id, state, stamp });
    const S = { projects: [{ todos: [{ pkey: 'F:\\w\\a', done: [], open: [e('b-2', 'blocked', '2026-10-20'), e('b-1', 'blocked', '2026-10-12'), e('r-1', 'ready', '2026-10-01')] }] }], sessions: [] };
    const html = page().dashKinds()['dash-blocked'].render([], S);
    assert.ok(html.indexOf('T b-1') >= 0 && html.indexOf('T b-1') < html.indexOf('T b-2'));
    assert.doesNotMatch(html, /T r-1/);
});

test('子代理派工 counts each live session\'s subagents', () => {
    const R = [{ id: 'a', state: 'live', task: 'Busy one', pkey: 'p', subagents: [{ id: '1' }, { id: '2' }] }, { id: 'b', state: 'down', task: 'Gone one', pkey: 'p', subagents: [{ id: '3' }] }];
    const html = page({}, R).dashKinds()['dash-agents'].render(R, { projects: [], sessions: R });
    assert.match(html, /Busy one[\s\S]*2 個在跑/);
    assert.doesNotMatch(html, /Gone one/);
});
