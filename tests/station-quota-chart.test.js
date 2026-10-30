'use strict';
// Task 7 of docs/90-agent/plans/2026-10-30-spend-quota.md: fmt.js and chart.js learn
// 花費's tab hash, the task and account dims, and the overview and quota drawings.
const test = require('node:test');
const assert = require('node:assert/strict');
const { page } = require('./station-module.js');

// The modules run in a vm context: their objects and arrays carry its prototypes.
const plain = (v) => JSON.parse(JSON.stringify(v));
// A JSON round trip drops undefined-valued keys, which would hide a key parseHash should not add.
const own = (v) => Object.assign({}, v);

const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v ? String(v[k]) : m));
const loc = (k, zh, v) => fill(zh, v);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const usd = (n) => (!n ? '—' : '$' + (n >= 100 ? n.toFixed(0) : n.toFixed(2)));
function helpers() {
    const { M } = page([]);
    const S = () => ({});
    const F = M['fmt.js'].make({ w: {}, loc, tokens: String, hours: String, usd, estMark: () => '', labels: () => ({}),
        ROUTE: ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'], TABS: ['timeline'],
        PAGES: ['live', 'sessions', 'projects', 'docs', 'weekly', 'settings', 'tour'],
        MODEL_KEYS: ['fable', 'opus', 'sonnet', 'haiku'], TOKEN_KEYS: ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'],
        KIND_KEYS: ['input', 'output', 'cacheRead', 'cacheWrite1h', 'cacheWrite5m'], KIND_LABEL: {}, KIND_COLOR: {}, WHO_LABEL: { main: '主 session' }, S });
    const C = M['chart.js'].make(Object.assign({}, F, { loc, esc, usd, tokens: String, hours: String, estMark: () => '', delta: () => '',
        METRIC_LABEL: { usd: '花費', tokens: 'token', time: '時間' }, DIM_LABEL: {}, NO_TIME_TYPE: 'no type',
        KIND_KEYS: [], MODEL_KEYS: ['fable', 'opus', 'sonnet', 'haiku'], S }));
    return { F, C };
}
const DAY = '2026-10-30';
const row = (n, task) => Object.assign({ day: DAY, stage: 'build', model: 'claude-opus-5', who: 'main', type: null, usd: n,
    tokens: { input: 1, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } }, task ? { task } : {});
const SESS = [
    { id: 'a', pkey: 'p', account: '4 19:00', days: [row(2, 'beta')], spans: [] },
    { id: 'b', pkey: 'p', account: '4 04:00', days: [row(3, 'alpha')], spans: [] },
    { id: 'c', pkey: 'p', account: null, days: [row(1)], spans: [] },
];

test('parseHash reads 花費\'s tab and the account and task a row opens, and adds no key it was not given', () => {
    const { F } = helpers();
    assert.deepEqual(own(F.parseHash('#/days')), { view: 'days', day: null });
    assert.deepEqual(own(F.parseHash('#/days/quota7')), { view: 'days', day: null, tab: 'quota7' });
    assert.deepEqual(own(F.parseHash('#/days/quota7?acc=4%2004%3A00&task=s1%3A0')), { view: 'days', day: null, tab: 'quota7', acc: '4 04:00', task: 's1:0' });
    assert.deepEqual(own(F.parseHash('#/days/detail')), { view: 'days', day: null, tab: 'detail' });
    assert.deepEqual(own(F.parseHash('#/days/nope')), { view: 'days', day: null });
    assert.deepEqual(own(F.parseHash('#/d/2026-10-30')), { view: 'days', day: '2026-10-30' });
});

test('dayBars splits by account with unknown last, by task with none last, and time cannot split by task', () => {
    const { C } = helpers();
    const acc = C.dayBars(SESS, 'usd', 'account', [DAY]);
    assert.deepEqual(plain(acc.keys), ['4 04:00', '4 19:00', 'unknown']);
    assert.deepEqual(plain(acc.days[0].parts), { '4 19:00': 2, '4 04:00': 3, unknown: 1 });
    assert.deepEqual(plain(C.dayBars(SESS, 'usd', 'task', [DAY]).keys), ['alpha', 'beta', 'none']);
    assert.equal(C.dayBars(SESS, 'time', 'task', [DAY], { task: 'no task in a span' }).disabled, 'no task in a span');
});

test('kpiHtml opens the row with the lead it is given; histSvg names a dim it has no label for by the one it is given', () => {
    const { C } = helpers();
    const t = { usd: 5, tokens: 10, active: 3600e3, main: 3600e3, wait: 0 };
    assert.match(C.kpiHtml(t, t, '<div class="ro">LEAD</div>'), /^<div class="readouts" data-block="kpi"><div class="ro">LEAD<\/div><div class="ro"><div class="l">token</);
    const bars = C.dayBars(SESS, 'usd', 'task', [DAY]);
    assert.match(C.histSvg(bars, { metric: 'usd', dim: 'task', dimLabel: '依 task', today: DAY, names: { none: '沒有 task' } }), /aria-label="近 1 天每日花費，依 task"/);
});

test('ovBarsSvg stacks each day by account, titles every column, and fades the accounts not picked', () => {
    const { C } = helpers();
    const bars = C.dayBars(SESS, 'usd', 'account', [DAY]);
    const o = { dim: 'account', today: DAY, names: { '4 04:00': '04:00 帳號', '4 19:00': '19:00 帳號', unknown: '未知' }, L: { aria: 'daily', today: '今天' } };
    const svg = C.ovBarsSvg(bars, o);
    assert.match(svg, /^<svg class="ovsvg qwid"/);
    assert.match(svg, /<title>2026-10-30 合計 \$6\.00；04:00 帳號 \$3\.00；19:00 帳號 \$2\.00；未知 \$1\.00<\/title>/);
    assert.match(svg, /fill:var\(--st-none\)/);
    assert.match(C.ovBarsSvg(bars, Object.assign({ narrow: true }, o)), /^<svg class="ovsvg qnar"/);
    assert.equal((C.ovBarsSvg(bars, Object.assign({ only: '4 04:00' }, o)).match(/opacity:\.16/g) || []).length, 2);
});

test('quotaSvg draws the line faded where no reading was, the lanes, a gate hatched, and the selected bar\'s callout', () => {
    const { C } = helpers();
    const H1 = 3600e3;
    const q = { t0: 0, t1: 10 * H1, now: 9 * H1, lanes: 2, sel: 's1:0',
        steps: [{ from: 0, to: H1, v: 10, gap: false }, { from: H1, to: 5 * H1, v: 12, gap: true }, { from: 5 * H1, to: 9 * H1, v: 20, gap: false }],
        segs: [
            { id: 's1:0', n: 0, lane: 0, name: 'alpha', title: 'alpha · ws', start: H1, end: 6 * H1, stages: [{ stage: 'build', start: H1, end: 6 * H1 }], gates: [{ start: 2 * H1, end: 3 * H1 }] },
            { id: 's2:0', n: 1, lane: 1, name: 'beta', title: 'beta · ws', start: 4 * H1, end: 8 * H1, stages: [{ stage: 'verify', start: 4 * H1, end: 8 * H1 }], gates: [] },
        ],
        ticks: [{ t: 5 * H1, text: '10-30', today: true }], resets: [{ t: 5 * H1, text: 'reset' }],
        call: { a0: H1, a1: 6 * H1, v0: 10, v1: 20, text: ['rise +10%', 'share 4%'] }, L: { aria: 'acc 7d', join: ', ' } };
    const svg = C.quotaSvg(q, { id: 'k7dw', W: 1200, L: 52, R: 1150, top: 12, bot: 150, laneTop: 174, pitch: 32, barH: 13, fs: 14 });
    assert.match(svg, /^<svg class="qsvg qwid" data-cur="s1:0"/);
    assert.match(svg, /<path class="qfade" d="M[^"]+"/);
    assert.match(svg, /fill:url\(#hatch-k7dw\)/);
    assert.equal((svg.match(/<g class="qbar/g) || []).length, 2);
    assert.match(svg, /<g class="qbar sel" data-task="s1:0"/);
    assert.match(svg, /<g class="qov on" data-task="s1:0">/);
    assert.match(svg, /rise \+10%, share 4%/);
    assert.match(svg, /<line class="qnow"/);
    const none = C.quotaSvg(Object.assign({}, q, { sel: null, call: null }),
        { id: 'k', W: 360, L: 36, R: 330, top: 10, bot: 130, laneTop: 152, pitch: 26, barH: 13, fs: 13, narrow: true });
    assert.match(none, /^<svg class="qsvg qnar" data-cur="none"/);
    assert.doesNotMatch(none, /qov/);
});
