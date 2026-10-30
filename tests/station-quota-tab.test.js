'use strict';
// Task 9 of docs/90-agent/plans/2026-10-30-spend-quota.md: 花費's 7d and 5h tabs — one
// account's step line over its task bars, a click's share of the rise, and the 5h windows.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { page, stringsLeft } = require('./station-module.js');
const { SRC } = require('./station-src.js');

// Local wall-clock times on the page's own today, so the range always holds them.
const T = (h, m) => new Date(2026, 9, 30, h, m || 0).getTime();
const NOW = T(12);
const seg = (task, a, b) => ({ task, start: a, end: b, stages: [{ stage: 'build', start: a, end: b }], gates: [] });
const row = (id, task, account, segment, bins) => ({ id, root: 'F:\\ws', project: 'ws', pkey: 'F:\\ws/ws', task, state: 'down', account,
    started: new Date(T(8)).toISOString(), updated: new Date(T(11)).toISOString(), days: [], spans: [], segments: [segment], bins });
// alpha and beta overlap on one account and spend 1:3 where its line climbs 8 points;
// gamma has no account and is only counted under the chart.
const SESS = [
    row('s1', 'alpha', '4 04:00', seg('alpha', T(9), T(10)), [[T(9, 30), 1]]),
    row('s2', 'beta', '4 04:00', seg('beta', T(9, 30), T(10, 30)), [[T(9, 30), 3]]),
    row('s3', 'gamma', null, seg('gamma', T(9), T(11)), [[T(9), 5]]),
];
const ACCOUNTS = [
    { key: '4 04:00', wd: 4, hm: '04:00', span: { from: T(9), to: T(10, 30), points: 8 },
        steps7: [{ from: T(9), to: T(9, 40), v: 10, gap: false }, { from: T(9, 40), to: NOW, v: 18, gap: true }],
        windows: [
            { start: T(4), end: T(9), steps: [{ from: T(5), to: T(9), v: 30, gap: true }] },
            { start: T(9), end: T(14), steps: [{ from: T(9), to: NOW, v: 12, gap: true }] },
        ],
        forecast: { at: T(9, 40), pct: 18, resets: T(9) + 6 * 864e5, perHour: 0, out: null } },
    { key: '4 19:00', wd: 4, hm: '19:00', span: null, steps7: [{ from: T(8), to: NOW, v: 40, gap: true }], windows: [], forecast: null },
];
function tab(accounts, sessions) {
    const { V, M } = page([], { generatedAt: new Date(NOW).toISOString(), sessions: sessions || SESS, quota: { accounts: accounts || ACCOUNTS } });
    const ctx = V.daysCtx();
    let draws = 0;
    ctx.draw = () => { draws++; };
    const D = M['days-page.js'];
    return { D, ctx, draws: () => draws, html: (mode) => D.quota(mode, { view: 'days', day: null }, ctx) };
}
// A click target: `closest(sel)` finds what `found` names for that selector.
const at = (found) => ({ closest: (sel) => found[sel] || null });
const bar = (id) => at({ '.qbar': { getAttribute: () => id }, '.qplot': {} });

test('7d draws the first account\'s line over its own bars, counts the bar with no account, and is no .chart', () => {
    const h = tab().html('7d');
    assert.match(h, /data-seg="qacc"><button type="button" data-v="4 04:00" aria-pressed="true">週四 04:00 重置<\/button><button type="button" data-v="4 19:00" aria-pressed="false">週四 19:00 重置<\/button>/);
    assert.match(h, /<svg class="qsvg qwid" data-cur="none"/);
    assert.match(h, /<svg class="qsvg qnar" data-cur="none"/);
    assert.equal((h.match(/<g class="qbar/g) || []).length, 4, 'alpha and beta, wide and narrow');
    assert.doesNotMatch(h, /data-task="s3:0"/);
    assert.match(h, /未知帳號的 session 不畫：1 條/);
    assert.match(h, /18<span class="u">%<\/span>/);
    assert.match(h, /重置前用不完/);
    assert.match(h, /≈ \$0\.50/, '$4 spent over the 8 points of the span');
    assert.doesNotMatch(h, /class="chart|class="[^"]* chart[ "]/);
});

// The first account with its forecast swapped for `f`.
const withForecast = (f) => [Object.assign({}, ACCOUNTS[0], { forecast: Object.assign({}, ACCOUNTS[0].forecast, f) })].concat(ACCOUNTS.slice(1));

test('7d says when it runs out at the last 24 hours pace, and warns', () => {
    const h = tab(withForecast({ at: T(11), out: T(20, 15) })).html('7d');
    assert.match(h, /<div class="d qwarn">照近 24 小時速度 10-30 20:15 用完<\/div>/);
    assert.doesNotMatch(h, /重置前用不完/);
});

test('a 7d reading over 6 hours old shows its reading time, not a forecast', () => {
    const h = tab(withForecast({ at: T(5), out: T(20, 15) })).html('7d');
    assert.match(h, /<div class="d">讀數時間 10-30 05:00<\/div>/);
    assert.doesNotMatch(h, /用完|重置前用不完/);
});

test('7d names where its axis starts when the range opens before the first reading of the account', () => {
    const h = tab().html('7d');
    assert.match(h, /區間 \d\d-\d\d 到 10-30；這個帳號第一筆讀數在 10-30 09:00，時間軸從那裡開始/);
});

test('a click on a bar selects it and calls its share; again, or on the blank, clears it', () => {
    const { D, ctx, draws, html } = tab();
    assert.equal(D.pick(bar('s1:0'), ctx), true);
    assert.equal(draws(), 1);
    assert.match(html('7d'), /<svg class="qsvg qwid" data-cur="s1:0"/);
    assert.match(html('7d'), /這段額度 \+8%，這個 task 約佔 2%/);
    D.pick(bar('s2:0'), ctx);
    assert.match(html('7d'), /這段額度 \+8%，這個 task 約佔 6%/);
    D.pick(bar('s2:0'), ctx);
    assert.match(html('7d'), /<svg class="qsvg qwid" data-cur="none"/);
    D.pick(bar('s1:0'), ctx);
    assert.equal(D.pick(at({ '.qplot': {} }), ctx), true);
    assert.match(html('7d'), /<svg class="qsvg qwid" data-cur="none"/);
    assert.equal(D.pick(at({}), ctx), false, 'a click outside the quota chart is not this page\'s');
});

test('5h opens on the newest window; ‹ moves to the one before', () => {
    const { D, ctx, draws, html } = tab();
    let h = html('5h');
    assert.match(h, /<span>10-30 09:00–14:00<\/span>/);
    assert.match(h, /12<span class="u">%<\/span>/);
    assert.match(h, /14:00 重置，還有 2 小時 0 分/);
    assert.match(h, /data-qwin="0" aria-label="上一個 5h 窗口">/);
    assert.match(h, /data-qwin="2" aria-label="下一個 5h 窗口" disabled>/);
    D.pick(at({ '.qnav': { disabled: false, getAttribute: () => '0' } }), ctx);
    assert.equal(draws(), 1);
    h = html('5h');
    assert.match(h, /<span>10-30 04:00–09:00<\/span>/);
    assert.match(h, /data-qwin="-1" aria-label="上一個 5h 窗口" disabled>/);
    assert.match(h, /data-qwin="1" aria-label="下一個 5h 窗口">/);
});

test('the account seg picks whose line is drawn; every Chinese string has English', () => {
    const { D, ctx, html } = tab();
    ctx.view.qacc = '4 19:00';
    const h = html('7d');
    assert.match(h, /data-v="4 19:00" aria-pressed="true"/);
    assert.match(h, /data-acc="4 19:00"/);
    assert.equal((h.match(/<g class="qbar/g) || []).length, 0);
    assert.match(h, /資料不足/);
    assert.deepEqual(stringsLeft('days-page.js', D.EN), []);
});

// One account's 7d line alone, `steps7` its only field that differs.
const only7 = (steps7) => [Object.assign({}, ACCOUNTS[0], { steps7 })];

test('7d notes under the chart that the range has no reading before the axis starts, and only then', () => {
    const h = tab().html('7d');
    const note = h.indexOf('<p class="qnote">'), plot = h.indexOf('<div class="qplot">');
    assert.ok(plot >= 0 && note > plot, 'the note sits under the chart');
    assert.match(h.slice(note), /^<p class="qnote">區間 \d\d-\d\d 到 10-30；這個帳號第一筆讀數在 10-30 09:00，時間軸從那裡開始，之前沒有讀數不畫。/);
    assert.match(h, /aria-label="04:00 帳號 7d 用量，10-30 09:00 到/, 'the axis opens at the first reading');
    // A reading from before the range carried into it: the line covers the range's start.
    const held = tab(only7([{ from: T(9) - 60 * 864e5, to: NOW, v: 5, gap: true }])).html('7d');
    assert.doesNotMatch(held, /之前沒有讀數不畫/);
});

test('5h counts only the part of a bar inside its window: the rise and the spend before the window start stay out', () => {
    // The window opens at 09:00; alpha runs from 08:00, beta from 09:15, and the line
    // carries a reading from 08:30. Inside the window the line climbs 6 → 10 after
    // beta joins, split 1:1; from 08:00 it would also climb 4 → 6 at 09:00, alpha's alone.
    const acc = Object.assign({}, ACCOUNTS[0], { windows: [{ start: T(9), end: T(14), steps: [
        { from: T(8, 30), to: T(9), v: 4, gap: false }, { from: T(9), to: T(9, 30), v: 6, gap: false }, { from: T(9, 30), to: NOW, v: 10, gap: true }] }] });
    const sess = [
        row('s1', 'alpha', '4 04:00', seg('alpha', T(8), T(10)), [[T(8, 30), 9], [T(9, 40), 1]]),
        row('s2', 'beta', '4 04:00', seg('beta', T(9, 15), T(10)), [[T(9, 40), 1]]),
    ];
    const { D, ctx, html } = tab([acc], sess);
    D.pick(bar('s1:0'), ctx);
    const h = html('5h');
    assert.match(h, /<svg class="qsvg qwid" data-cur="s1:0"/);
    assert.match(h, /這段額度 \+4%，這個 task 約佔 2%/);
    assert.doesNotMatch(h, /\+6%|約佔 4%/);
});

test('an account is named by its 7d reset, never by its key, uuid or email', () => {
    const named = [
        Object.assign({}, ACCOUNTS[0], { key: '0 23:55', wd: 0, hm: '23:55', uuid: '3f2a9c1e-uuid', email: 'me@example.com' }),
        Object.assign({}, ACCOUNTS[1], { key: '6 04:00', wd: 6, hm: '04:00' }),
    ];
    const h = tab(named).html('7d');
    const names = [...h.matchAll(/data-seg="qacc">(.*?)<\/div>/g)].map((m) => [...m[1].matchAll(/>([^<]*)<\/button>/g)].map((b) => b[1]));
    assert.deepEqual(names, [['週日 23:55 重置', '週六 04:00 重置']]);
    assert.doesNotMatch(h, /3f2a9c1e|me@example\.com/);
});

// station.js's own document listeners, booted as tests/station-days-scroll.test.js does,
// with FK_DAYS.pick swapped for a spy: a real keydown on a `.qbar` and a real click
// inside `.qplot` / on `.qnav` must reach it.
function boot(hash) {
    const docListeners = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {} });
    const els = {};
    const win = { location: { hash }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date().toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: false, projects: [],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    const fallback = Object.assign(el(), { parentNode: { insertBefore() {} }, nextSibling: null, click() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (docListeners[type] = docListeners[type] || []).push(fn); },
        createElement: el, querySelectorAll: () => [], querySelector: (sel) => (sel === 'dialog[open]' ? null : fallback), head: { appendChild() {} } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    const picked = [];
    win.FK_DAYS.pick = (target) => { picked.push(target); return true; };
    const fire = (type, e) => (docListeners[type] || []).forEach((fn) => fn(Object.assign({ preventDefault() {}, stopPropagation() {} }, e)));
    return { picked, fire };
}
// A target inside whatever `found` names: `closest(sel)` answers for those selectors only.
const node = (found) => ({ closest: (sel) => found[sel] || null, getAttribute: () => null, hasAttribute: () => false, id: '', tagName: 'G' });

test('station.js hands a keydown Enter or Space on a .qbar to FK_DAYS.pick', () => {
    const b = boot('#/days/quota7');
    const t = node({ '.qbar': {} });
    b.fire('keydown', { key: 'Enter', target: t });
    b.fire('keydown', { key: ' ', target: t });
    assert.equal(b.picked.length, 2);
    b.fire('keydown', { key: 'Enter', target: node({}) });
    assert.equal(b.picked.length, 2, 'Enter off a bar is not the quota chart\'s');
});

test('station.js hands a click inside .qplot or on .qnav to FK_DAYS.pick', () => {
    const b = boot('#/days/quota5h');
    const t = node({ '.qplot, .qnav': {} });
    b.fire('click', { target: t, button: 0 });
    assert.ok(b.picked.includes(t));
    const before = b.picked.length;
    b.fire('click', { target: node({}), button: 0 });
    assert.equal(b.picked.length, before, 'a click outside the quota chart never reaches pick');
});
