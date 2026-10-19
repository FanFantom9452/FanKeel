'use strict';
// station-30 and station-31 in station.js: every component split keeps cache
// write 1h (the main session's one-hour cache) and cache write 5m (the
// agents' five-minute cache) apart, each named for its side; the 花費 chart
// splits by agent type; and the helpers the page's modules draw with are on
// window.FK_KIT.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');

const DAY = '2026-10-19';
const ROW = { day: DAY, stage: 'build', model: 'claude-opus-5-5', who: 'main', type: null, usd: 10,
    tokens: { input: 1, output: 2, cacheRead: 3, cacheWrite5m: 4, cacheWrite1h: 5 },
    cost: { input: 0.5, output: 1, cacheRead: 2, cacheWrite5m: 2.5, cacheWrite1h: 4 } };

test('dayBars splits kind into five segments, 1h before 5m, under 花費 and under token', () => {
    const usd = V.dayBars([{ pkey: 'p', days: [ROW] }], 'usd', 'kind', [DAY]);
    assert.deepEqual(usd.days[0].parts, { input: 0.5, output: 1, cacheRead: 2, cacheWrite1h: 4, cacheWrite5m: 2.5 });
    assert.deepEqual(usd.keys, ['input', 'output', 'cacheRead', 'cacheWrite1h', 'cacheWrite5m']);
    assert.equal(usd.days[0].total, 10);
    const tok = V.dayBars([{ pkey: 'p', days: [ROW] }], 'tokens', 'kind', [DAY]);
    assert.deepEqual(tok.days[0].parts, { input: 1, output: 2, cacheRead: 3, cacheWrite1h: 5, cacheWrite5m: 4 });
});

test('costModel keeps both writes apart on the main session, the agents and the total', () => {
    const m = V.costModel([ROW, Object.assign({}, ROW, { who: 'agent' })]);
    assert.deepEqual(m.main.cost, { input: 0.5, output: 1, cacheRead: 2, cacheWrite1h: 4, cacheWrite5m: 2.5 });
    assert.deepEqual(m.agent.tokens, { input: 1, output: 2, cacheRead: 3, cacheWrite1h: 5, cacheWrite5m: 4 });
    assert.deepEqual(m.total.cost, { input: 1, output: 2, cacheRead: 4, cacheWrite1h: 8, cacheWrite5m: 5 });
});

test('costHtml heads a column pair per kind, names the side of each write, and the 主迴圈 row spans all ten cells', () => {
    const html = V.costHtml(V.costModel([ROW]), { loops: [{ stage: 'build', turns: 3, over: 0, overUsd: 0, estimated: false }] });
    assert.match(html, /<\/i> cache write 1h · 主對話<\/th>/);
    assert.match(html, /<\/i> cache write 5m · agent<\/th>/);
    assert.match(html, /var\(--t-cw1h\)/);
    assert.equal((html.match(/<th class="r">token<\/th><th class="r">USD<\/th>/g) || []).length, 5);
    assert.match(html, /<td colspan="10"><div class="lf">/);
    assert.doesNotMatch(html, /colspan="8"/);
    assert.doesNotMatch(html, /<th colspan="2" title=/, 'no note without the kinds module');
});

const TROWS = [{ pkey: 'p', days: [row('main', null, 6), row('agent', 'implementer', 2.5), row('workflow', 'reviewer', 1), row('agent', 'reviewer', 0.5), row('agent', undefined, 0.25)] }];
function row(who, type, usd) { return { day: DAY, stage: 'build', model: 'claude-opus-5-5', who, type, usd, tokens: { input: usd }, cost: null }; }

test('dayBars splits by agent type: the main session, each type, unknown for none, largest first', () => {
    const bars = V.dayBars(TROWS, 'usd', 'type', [DAY]);
    assert.deepEqual(bars.days[0].parts, { main: 6, implementer: 2.5, reviewer: 1.5, unknown: 0.25 });
    assert.deepEqual(bars.keys, ['main', 'implementer', 'reviewer', 'unknown']);
    const off = V.dayBars(TROWS, 'time', 'type', [DAY]);
    assert.deepEqual([off.days.length, off.keys.length], [0, 0]);
    assert.match(off.disabled, /agent 類型/);
});

test('the type legend names and colours the main session as everywhere else, and each type from the palette', () => {
    const html = V.legendHtml(V.dayBars(TROWS, 'usd', 'type', [DAY]), { dim: 'type', off: {}, pkeys: [] });
    assert.match(html, /var\(--s-main\)/);
    assert.match(html, /主 session/);
    assert.match(html, /var\(--p-1\)[\s\S]*implementer/);
    assert.match(html, /未記類型/);
});

test('the cost readout takes a range\'s label, and keeps 30 天花費 without one', () => {
    const t = { usd: 1, tokens: 1, active: 1, main: 1, wait: 0, estimated: false };
    assert.match(V.kpiHtml(t, t, '區間花費'), /<div class="l">區間花費<\/div>/);
    assert.match(V.kpiHtml(t, t), /<div class="l">30 天花費<\/div>/);
});

test('the kit carries the helpers and the five kinds, and usd2 prints to the cent', () => {
    const K = global.window.FK_KIT;
    for (const k of ['esc', 'tokens', 'usd2', 'comma', 'delta', 'roHtml', 'segHtml', 'sessionHash', 'localDay', 'lastDays', 'fillVars']) assert.equal(typeof K[k], 'function', k);
    assert.deepEqual(K.KIND_KEYS, ['input', 'output', 'cacheRead', 'cacheWrite1h', 'cacheWrite5m']);
    assert.deepEqual([K.usd2(2522.254), K.usd2(0), K.usd2(0.068)], ['$2522.25', '$0.00', '$0.07']);
});
