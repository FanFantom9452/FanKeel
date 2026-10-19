'use strict';
// station-29: every place a cost component is shown carries a note on what it
// is, and the 花費 page holds a 成分說明 table. Every unit price in a note is
// read from the table lib/prices.js exports; none is written into a station
// file (assets/station/spend-kinds.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const prices = require('../lib/prices.js');
const { page, stringsLeft } = require('./station-module.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const newest = (fam) => prices.perMillion[Object.keys(prices.perMillion).find((k) => k.startsWith('claude-' + fam + '-'))];
const N = () => page(['spend-kinds.js']).M['spend-kinds.js'];

test('each note carries its unit price from lib/prices.js, and the 1h-to-read ratio is computed', () => {
    const o = newest('opus'), s = newest('sonnet');
    const n = N().notes(prices.perMillion);
    assert.ok(n.cacheRead.includes('單價最低（Opus $' + o.cacheRead + '/M）'), n.cacheRead);
    assert.ok(n.cacheWrite1h.includes('（Opus $' + o.cacheWrite1h + '/M，cache read 的 ' + Math.round(o.cacheWrite1h / o.cacheRead) + ' 倍）'), n.cacheWrite1h);
    assert.ok(n.cacheWrite5m.includes('（Opus $' + o.cacheWrite5m + '/M、Sonnet $' + s.cacheWrite5m + '/M）'), n.cacheWrite5m);
    assert.ok(n.output.includes('單價最高（Opus $' + o.output + '/M）'), n.output);
    assert.match(n.input, /^最後一小段沒落在快取的輸入，通常接近 0。$/);
    assert.match(n.cacheRead, /^每回合從頭重讀到目前為止的整段對話/);
    assert.match(n.cacheWrite1h, /整段重寫的情況：離開超過 1 小時快取過期、壓縮後新前綴、前段內容變動。$/);
    assert.match(n.cacheWrite5m, /派越多 agent 越高。$/);
});

test('another table prints other prices: nothing is typed into a station file', () => {
    const fake = { 'claude-opus-9': { input: 1, output: 77, cacheRead: 0.3, cacheWrite5m: 6, cacheWrite1h: 9 },
        'claude-sonnet-9': { input: 1, output: 7, cacheRead: 0.1, cacheWrite5m: 3.5, cacheWrite1h: 5 } };
    const n = N().notes(fake);
    assert.ok(n.output.includes('Opus $77/M') && n.cacheWrite1h.includes('30 倍') && n.cacheWrite5m.includes('Sonnet $3.5/M'));
    assert.ok(N().notes({}).output.includes('Opus —'), 'no table, no price, and no guess');
    for (const f of ['station.js', 'spend-kinds.js']) {
        assert.doesNotMatch(fs.readFileSync(path.join(ASSETS, f), 'utf8'), /\$(?:0\.2|8|5|2\.5|20)\/M/, 'a unit price is written into ' + f);
    }
});

test('with the module on the page, the cost tab\'s headers and the kind legend carry each note', () => {
    const day = '2026-10-19';
    const p = page(['spend-kinds.js']);
    const rows = [{ day, stage: 'build', model: 'claude-opus-5-5', who: 'main', usd: 1,
        tokens: { input: 1, output: 2, cacheRead: 3, cacheWrite5m: 4, cacheWrite1h: 5 }, cost: { input: 0.1, output: 0.2, cacheRead: 0.3, cacheWrite5m: 0.2, cacheWrite1h: 0.2 } }];
    const n = p.M['spend-kinds.js'].notes(prices.perMillion);
    const cost = p.V.costHtml(p.V.costModel(rows));
    const legend = p.V.legendHtml(p.V.dayBars([{ pkey: 'p', days: rows }], 'usd', 'kind', [day]), { dim: 'kind', off: {}, pkeys: [] });
    for (const k of ['input', 'output', 'cacheRead', 'cacheWrite1h', 'cacheWrite5m']) {
        assert.ok(cost.includes('title="' + n[k] + '"'), 'cost tab ' + k);
        assert.ok(legend.includes(n[k]), 'legend ' + k);
    }
});

test('the 成分說明 table lists the five components with Opus and Sonnet unit prices and the note', () => {
    const html = N().table(prices.perMillion, prices.verified);
    const o = newest('opus'), s = newest('sonnet');
    assert.match(html, /^<section class="panel" data-block="kind-notes"><div class="h2">成分說明 <small>/);
    assert.ok(html.includes(prices.verified));
    assert.equal((html.match(/<tr data-kind="/g) || []).length, 5);
    assert.ok(html.includes('<tr data-kind="cacheWrite1h"><td><i class="sw" style="background:var(--t-cw1h)"></i> cache write 1h · 主對話</td><td class="r">$' + o.cacheWrite1h + '/M</td><td class="r">$' + s.cacheWrite1h + '/M</td>'));
    assert.ok(html.includes(N().notes(prices.perMillion).output));
});

test('--t-cw1h is defined in the light theme and in the dark one, and every string has English', () => {
    const css = fs.readFileSync(path.join(ASSETS, 'station.css'), 'utf8');
    const at = css.indexOf('@media(prefers-color-scheme:dark)');
    assert.ok(css.slice(0, at).includes('--t-cw1h:'), 'light');
    assert.ok(css.slice(at).includes('--t-cw1h:'), 'dark');
    assert.deepEqual(stringsLeft('spend-kinds.js', N().EN), []);
});
