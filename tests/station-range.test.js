'use strict';
// station-32: the 花費 page's range — 本週 (the seven days to today), 上週
// (the seven before), 近 30 天, or 自訂 from..to — each against the same
// number of days before it, as lib/compare.js compares two ranges; and the
// machine-wide total from serve's range report (assets/station/spend-range.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { page, stringsLeft } = require('./station-module.js');

const NOW = new Date(2026, 9, 19, 15, 0).getTime();
const G = () => page(['spend-range.js']);

test('本週 is 10-13..10-19 against 10-06..10-12; 上週 is the week before that', () => {
    const R = G().M['spend-range.js'];
    const w = R.rangeOf('week', NOW);
    assert.deepEqual([w.kind, w.from, w.to, w.days.length, w.prev[0], w.prev[6]], ['week', '2026-10-13', '2026-10-19', 7, '2026-10-06', '2026-10-12']);
    const l = R.rangeOf('lastweek', NOW);
    assert.deepEqual([l.from, l.to, l.prev[0], l.prev[6]], ['2026-10-06', '2026-10-12', '2026-09-29', '2026-10-05']);
});

test('近 30 天 is the page\'s own thirty days and the thirty before them', () => {
    const p = G();
    const r = p.M['spend-range.js'].rangeOf('30d', NOW);
    assert.deepEqual(r.days, p.V.lastDays(NOW, 30));
    assert.deepEqual(r.prev, p.V.lastDays(NOW - 30 * 864e5, 30));
});

test('自訂 runs from..to, last day included, against as many days before it; a backwards or missing end is 近 30 天', () => {
    const R = G().M['spend-range.js'];
    const c = R.rangeOf('custom', NOW, '2026-10-13', '2026-10-19');
    assert.deepEqual([c.kind, c.days.length, c.prev[0], c.prev[c.prev.length - 1]], ['custom', 7, '2026-10-06', '2026-10-12']);
    assert.deepEqual([...R.rangeOf('custom', NOW, '2026-09-28', '2026-10-02').days], ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
    assert.equal(R.rangeOf('custom', NOW, '2026-10-19', '2026-10-13').kind, '30d');
    assert.equal(R.rangeOf('custom', NOW, '', '').kind, '30d');
});

test('the controls: a seg named range, and the two date boxes only for 自訂', () => {
    const R = G().M['spend-range.js'];
    const rng = R.rangeOf('week', NOW);
    const html = R.controlsHtml('week', rng, '', '');
    assert.match(html, /data-seg="range"/);
    assert.match(html, /<button type="button" data-v="week" aria-pressed="true">本週<\/button>/);
    assert.doesNotMatch(html, /data-range=/);
    const own = R.controlsHtml('custom', rng, '2026-10-13', '');
    assert.match(own, /<input type="date" data-range="from" value="2026-10-13"/);
    assert.match(own, /<input type="date" data-range="to" value="2026-10-19"/);
});

test('the machine-wide readout prints the range total and the range before it to the cent, with the change', () => {
    const R = G().M['spend-range.js'];
    const html = R.kpiHtml({ state: '', rep: { usd: 2522.25, sessions: 4306, prev: { usd: 777.39, sessions: 588 } } }, true);
    assert.match(html, /^<div class="readouts" data-block="range-kpi">/);
    assert.match(html, /\$2522\.25/);
    assert.match(html, /前一段 \$777\.39/);
    assert.match(html, /\+224% /);
    assert.match(html, /4,306/);
    assert.match(R.kpiHtml(null, false), /要從 serve 開的頁面才算得到/);
    assert.match(R.kpiHtml({ state: 'loading', rep: null }, true), /計算中/);
    assert.match(R.kpiHtml({ state: 'failed', rep: null }, true), /讀不到區間花費/);
});

test('load asks serve once per range and redraws when the report is in', async () => {
    const asked = [];
    const rep = { usd: 1, sessions: 1, prev: { usd: 1, sessions: 1 } };
    const p = page(['spend-range.js'], {}, { fetch: (url) => { asked.push(url); return Promise.resolve({ ok: true, json: () => Promise.resolve(rep) }); } });
    const R = p.M['spend-range.js'];
    const rng = R.rangeOf('week', NOW);
    let drawn = 0;
    assert.equal(R.load(rng, () => { drawn += 1; }).state, 'loading');
    R.load(rng, () => { drawn += 1; });
    await new Promise((r) => setTimeout(r, 10));
    assert.deepEqual(asked, ['station/spend?from=2026-10-13&to=2026-10-19&top=10']);
    assert.equal(drawn, 1);
    // Spread into this realm: the module's objects carry the vm context's prototypes.
    assert.deepEqual({ ...R.held(rng) }, { state: '', rep });
});

test('listen adds its change listener once, and a date box picks the range', () => {
    const p = G();
    const R = p.M['spend-range.js'];
    const heard = [];
    const doc = { addEventListener: (type, fn) => heard.push([type, fn]) };
    let picked = null;
    R.listen(doc, (a, b) => { picked = [a, b]; });
    R.listen(doc, () => {});
    assert.equal(heard.length, 1);
    assert.equal(heard[0][0], 'change');
    const box = (v) => ({ value: v });
    const group = { querySelector: (s) => (s.includes('from') ? box('2026-10-01') : box('2026-10-05')) };
    heard[0][1]({ target: { getAttribute: () => 'from', parentNode: group } });
    assert.deepEqual(picked, ['2026-10-01', '2026-10-05']);
});

test('a seven-day range draws seven columns, and every string has English', () => {
    const p = G();
    const r = p.M['spend-range.js'].rangeOf('week', NOW);
    const svg = p.V.histSvg(p.V.dayBars([], 'usd', 'model', r.days), { metric: 'usd', dim: 'model', days: r.days, today: r.to, names: {}, pkeys: [] });
    assert.equal(new Set(svg.match(/data-day="[^"]+"/g) || []).size, 7);
    assert.deepEqual(stringsLeft('spend-range.js', p.M['spend-range.js'].EN), []);
});
