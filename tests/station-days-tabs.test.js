'use strict';
// Task 10 of docs/90-agent/plans/2026-10-30-spend-quota.md: 花費 is one frame over four
// tabs — 總覽's total by account and its five costliest tasks, the 額度 tabs, and 明細.
const test = require('node:test');
const assert = require('node:assert/strict');
const { page, stringsLeft } = require('./station-module.js');

const T = (h, m) => new Date(2026, 9, 30, h, m || 0).getTime();
const NOW = T(12);
const DAY = '2026-10-30';
const day = (usd) => ({ day: DAY, stage: 'build', model: 'claude-opus-5', who: 'main', type: null, usd,
    tokens: { input: 1000, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } });
// One segment a session, its whole spend in one bin at its start and in one days row.
const row = (id, task, account, a, b, usd) => ({ id, root: 'F:\\ws', project: 'ws', pkey: 'F:\\ws/ws', task, state: 'down', account,
    started: new Date(a).toISOString(), updated: new Date(b).toISOString(), days: [day(usd)], spans: [],
    segments: [{ task, start: a, end: b, stages: [{ stage: 'build', start: a, end: b }], gates: [] }], bins: [[a, usd]] });
const SESS = [
    row('s1', 'alpha', '4 04:00', T(9), T(10), 1),
    row('s2', 'beta', '4 04:00', T(9, 30), T(10, 30), 3),
    row('s3', 'gamma', '4 19:00', T(10), T(11), 2),
    row('s4', 'delta', null, T(10), T(11), 0.5),
];
const ACCOUNTS = [
    { key: '4 04:00', wd: 4, hm: '04:00', span: null, forecast: null,
        steps7: [{ from: T(9), to: T(9, 40), v: 10, gap: false }, { from: T(9, 40), to: NOW, v: 18, gap: true }],
        windows: [{ start: T(9), end: T(14), steps: [{ from: T(9), to: NOW, v: 12, gap: true }] }] },
    { key: '4 19:00', wd: 4, hm: '19:00', span: null, forecast: null, steps7: [{ from: T(10), to: NOW, v: 40, gap: true }], windows: [] },
];
function boot() {
    const { V, M } = page([], { generatedAt: new Date(NOW).toISOString(), sessions: SESS, quota: { accounts: ACCOUNTS } });
    const ctx = V.daysCtx();
    ctx.draw = () => {};
    return { V, D: M['days-page.js'], ctx };
}
const panels = (html) => [...html.matchAll(/data-panel="(\w+)"( hidden)?>/g)].map((m) => [m[1], Boolean(m[2])]);
const between = (html, a, b) => html.slice(html.indexOf(a), html.indexOf(b));

test('the four tabs are drawn every time under one frame, the chosen one shown and three hidden', () => {
    const { D, ctx } = boot();
    const html = D.page({ view: 'days', day: null }, ctx);
    assert.deepEqual(panels(html), [['overview', false], ['quota7', true], ['quota5h', true], ['detail', true]]);
    assert.match(html, /^<div class="dtabs" data-block="days"><header class="dframe" data-block="days-head"><div class="dstrip"><nav class="dtablist" data-block="days-tabs" aria-label="花費分頁"><a href="#\/days" aria-current="page">總覽<\/a><a href="#\/days\/quota7">7d 額度<\/a><a href="#\/days\/quota5h">5h 額度<\/a><a href="#\/days\/detail">明細<\/a><\/nav><nav class="subtabs" data-block="page-filter"/);
    assert.match(html, /<div class="dbar hero-top"><div class="dat"><div class="eyebrow">/);
    assert.match(html, /<div class="vbar controls"><div class="ctlgrp"><label>區間<\/label><div class="seg" role="group" data-seg="range">/);
    assert.deepEqual(panels(D.page({ view: 'days', day: null, tab: 'quota5h' }, ctx)).map((p) => p[1]), [true, true, false, true]);
    assert.deepEqual(panels(D.page({ view: 'days', day: DAY }, ctx)).map((p) => p[1]), [true, true, true, false], 'a day in the hash opens 明細');
    assert.ok(html.indexOf('data-block="days"') < html.indexOf('data-block="spend-cards"'));
});

test('總覽: each account and the unknown add up to the total with no (x%), and the five costliest tasks fit under it', () => {
    const { D, ctx } = boot();
    const html = D.page({ view: 'days', day: null }, ctx);
    const head = html.match(/<div class="ovtotal">[\s\S]*?<\/p><\/div>/)[0];
    assert.doesNotMatch(head, /%/);
    const total = Number(head.match(/<div class="ovnum">\$([\d.]+)<\/div>/)[1]);
    assert.equal(total, 6.5);
    const split = head.match(/<p class="ovsplit">([\s\S]*?)<\/p>/)[1];
    assert.match(split, /04:00 帳號 \$4\.00.*19:00 帳號 \$2\.00.*未知 \$0\.50/);
    assert.equal([...split.matchAll(/\$([\d.]+)/g)].reduce((n, m) => n + Number(m[1]), 0), total);
    const top = [...html.matchAll(/<td class="task">(?:<a href="[^"]+">|<span title="[^"]+">)([^<]+)<\/(?:a|span)><\/td><td>ws<\/td><td class="r">\$([\d.]+)<\/td>/g)];
    assert.deepEqual(top.map((m) => m[1]), ['beta', 'gamma', 'alpha', 'delta']);
    for (const m of top) assert.ok(Number(m[2]) <= total, m[2]);
    assert.doesNotMatch(between(html, 'data-panel="overview"', 'data-panel="quota7"'), /class="chart/);
});

test('a 最貴 row opens 7d 額度 on its account with its task selected', () => {
    const { V, D, ctx } = boot();
    const html = D.page({ view: 'days', day: null }, ctx);
    const href = html.match(/<td class="task"><a href="([^"]+)">beta</)[1].replace(/&amp;/g, '&');
    assert.equal(href, '#/days/quota7?acc=4%2004%3A00&task=s2%3A0');
    const next = D.page(V.parseHash(href), ctx);
    assert.deepEqual(panels(next).map((p) => p[1]), [true, false, true, true]);
    const q7 = between(next, 'data-panel="quota7"', 'data-panel="quota5h"');
    assert.match(q7, /<svg class="qsvg qwid" data-cur="s2:0"/);
    assert.match(q7, /data-v="4 04:00" aria-pressed="true"/);
});

test('明細 keeps every split and adds 依 task, which time disables with the reason', () => {
    const { D, ctx } = boot();
    let html = D.page({ view: 'days', day: null, tab: 'detail' }, ctx);
    for (const t of ['依 model', '依專案', '依 stage', '主 session 對 agent', '依 agent 類型', '依版本', '依成分', '依 task']) {
        assert.match(html, new RegExp('>' + t + '</button>'), t);
    }
    assert.match(html, /data-seg="metric"/);
    assert.match(html, /要從 serve 開的頁面才算得到/);
    assert.match(html, /data-block="kind-notes"/);
    ctx.view.metric = 'time';
    ctx.view.dim = 'task';
    html = D.page({ view: 'days', day: null, tab: 'detail' }, ctx);
    const why = '時間沒有 task 可分：spans 只記 stage 與誰在跑，不記 task';
    assert.ok(html.includes('<button type="button" data-v="task" aria-pressed="true" disabled title="' + why + '">依 task</button>'));
    assert.ok(html.includes('<p class="note">' + why + '</p>'));
    assert.deepEqual(stringsLeft('days-page.js', D.EN), []);
});
