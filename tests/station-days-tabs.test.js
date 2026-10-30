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
function boot(sessions, more) {
    const { V, M } = page([], Object.assign({ generatedAt: new Date(NOW).toISOString(), sessions: sessions || SESS, quota: { accounts: ACCOUNTS } }, more));
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

test('總覽 marks 估 on the total, on the account whose rows are estimated and on that day\'s bar, and nowhere when none is', () => {
    const est = SESS.map((s) => s.id === 's3' ? Object.assign({}, s, { days: [Object.assign(day(2), { estimated: true })] }) : s);
    const { D, ctx } = boot(est);
    const ov = between(D.page({ view: 'days', day: null }, ctx), 'data-panel="overview"', 'data-panel="quota7"');
    assert.match(ov, /<div class="ovnum">\$6\.50 估<\/div>/);
    assert.match(ov, /<\/i>19:00 帳號 \$2\.00 估<\/span>/);
    assert.match(ov, /<\/i>04:00 帳號 \$4\.00<\/span>/);
    assert.match(ov, /<title>2026-10-30 合計 \$6\.50 估；[^<]*19:00 帳號 \$2\.00 估/);
    const plain = boot();
    assert.doesNotMatch(between(plain.D.page({ view: 'days', day: null }, plain.ctx), 'data-panel="overview"', 'data-panel="quota7"'), /估/);
});

test('明細 has one kpi row, 全機花費 first and 最常被換掉 marked, and the frame title has no 近 30 天 of its own', () => {
    const { D, ctx } = boot();
    const html = D.page({ view: 'days', day: null, tab: 'detail' }, ctx);
    const row = html.match(/<div class="readouts" data-block="kpi">([\s\S]*?)<\/section>/);
    assert.ok(row, 'the readouts row is data-block="kpi"');
    assert.equal([...html.slice(html.indexOf('data-panel="detail"')).matchAll(/class="readouts/g)].length, 1,'全機花費 sits inside the kpi row, not in a row of its own');
    assert.match(row[1], /^<div class="ro"><div class="l">全機花費/);
    assert.match(row[1], /<div class="ro" data-block="most-swapped"><div class="l">最常被換掉<\/div>/);
    assert.doesNotMatch(between(html, '<div class="dbar', '</h1>'), /近 30 天/);
});

test('總覽\'s bar chart lets the panel show through its hover columns, so the gridlines show', () => {
    const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'assets', 'station', 'days-page.css'), 'utf8');
    assert.match(css, /\.ovsvg \.hit\{fill:transparent/);
});

test('總覽\'s split under the total gives each account the swatch its bars are filled with', () => {
    const { D, ctx } = boot();
    const ov = between(D.page({ view: 'days', day: null }, ctx), 'data-panel="overview"', 'data-panel="quota7"');
    const split = ov.match(/<p class="ovsplit">([\s\S]*?)<\/p>/)[1];
    const sw = [...split.matchAll(/<span><i class="sw" style="background:([^"]+)"><\/i>([^<]+?) \$/g)].map((m) => [m[2], m[1]]);
    assert.deepEqual(sw.map((p) => p[0]), ['04:00 帳號', '19:00 帳號', '未知']);
    const bar = ov.match(/<title>2026-10-30 [^<]*<\/title><\/rect><g class="bar">([\s\S]*?)<\/g>/)[1];
    assert.deepEqual(sw.map((p) => p[1]), [...bar.matchAll(/style="fill:([^";]+)/g)].map((m) => m[1]));
});

test('總覽\'s bar axis names the month under the first day, wide and narrow', () => {
    const { D, ctx } = boot();
    const ov = between(D.page({ view: 'days', day: null }, ctx), 'data-panel="overview"', 'data-panel="quota7"');
    for (const cls of ['qwid', 'qnar']) {
        const svg = ov.match(new RegExp('<svg class="ovsvg ' + cls + '"[\\s\\S]*?</svg>'))[0];
        const m = svg.match(/<text class="tick" x="([\d.]+)" y="[\d.]+" text-anchor="middle">1<\/text><text class="tick" x="([\d.]+)" y="([\d.]+)" text-anchor="middle">10月<\/text>/);
        assert.ok(m, cls + ' has 10月 under day 1');
        assert.equal(m[1], m[2]);
        assert.ok(Number(m[3]) < Number(svg.match(/viewBox="0 0 \d+ ([\d.]+)"/)[1]), cls + ' 10月 sits inside the drawing');
        assert.equal(svg.split('10月').length, 2, cls + ' names the month once');
    }
});

test('明細 on a served page has six kpi cells once the range spend arrives, 全機花費 and session leading', async () => {
    const rep = { usd: 12.5, sessions: 4, prev: { usd: 0, sessions: 0 } };
    const { V, M, win } = page([], { generatedAt: new Date(NOW).toISOString(), serve: true, sessions: SESS, quota: { accounts: ACCOUNTS } },
        { fetch: () => Promise.resolve({ ok: true, json: () => rep }) });
    win.FK_PANEL = null; // its tables want a whole /station/spend report; this test reads only the kpi row
    const ctx = V.daysCtx();
    ctx.draw = () => {};
    const D = M['days-page.js'];
    D.page({ view: 'days', day: null, tab: 'detail' }, ctx);
    await new Promise((r) => setImmediate(r));
    const html = D.page({ view: 'days', day: null, tab: 'detail' }, ctx);
    const row = html.match(/<div class="readouts" data-block="kpi">([\s\S]*?)<\/section>/)[1];
    assert.deepEqual([...row.matchAll(/<div class="ro"[^>]*><div class="l">(?:<i class="hatchsw"><\/i>)?([^<]+)<\/div>/g)].map((m) => m[1]),
        ['全機花費（usage-compare 規則）', 'session', 'token', 'active 時間', '等待佔比', '最常被換掉']);
});

// 明細's kpi row as [label, value] per cell, so a second "—" cell or
// a stray session cell changes the array the tests compare whole.
const kpiCells = (html) => [...html.match(/<div class="readouts" data-block="kpi">([\s\S]*?)<\/section>/)[1]
    .matchAll(/<div class="ro"[^>]*><div class="l">(?:<i class="hatchsw"><\/i>)?([^<]+)<\/div><div class="v">([\s\S]*?)<\/div><div class="d">/g)]
    .map((m) => [m[1], m[2]]);
const FIVE = ['全機花費（usage-compare 規則）', 'token', 'active 時間', '等待佔比', '最常被換掉'];
async function servedDetail(fetch) {
    const { V, M } = page([], { generatedAt: new Date(NOW).toISOString(), serve: true, sessions: SESS, quota: { accounts: ACCOUNTS } }, { fetch });
    const ctx = V.daysCtx();
    ctx.draw = () => {};
    const D = M['days-page.js'];
    D.page({ view: 'days', day: null, tab: 'detail' }, ctx);
    await new Promise((r) => setImmediate(r));
    return D.page({ view: 'days', day: null, tab: 'detail' }, ctx);
}
function assertFive(html, why) {
    const cells = kpiCells(html);
    assert.deepEqual(cells.map((c) => c[0]), FIVE);
    assert.equal(cells[0][1], '—');
    assert.ok(html.includes(why), why);
}

test('明細 on a static page has five kpi cells, 全機花費 alone at "—" and no session cell', () => {
    const { D, ctx } = boot();
    assertFive(D.page({ view: 'days', day: null, tab: 'detail' }, ctx), '要從 serve 開的頁面才算得到');
});

test('明細 on a served page has five kpi cells while the range spend is still loading', async () => {
    assertFive(await servedDetail(() => new Promise(() => {})), '計算中…');
});

test('明細 on a served page has five kpi cells once the range spend fails, by a bad status or a rejected fetch', async () => {
    assertFive(await servedDetail(() => Promise.resolve({ ok: false, status: 500 })), '讀不到區間花費，重新整理再試');
    assertFive(await servedDetail(() => Promise.reject(new Error('offline'))), '讀不到區間花費，重新整理再試');
});

test('總覽 shows no share on its total or its split', () => {
    const { D, ctx } = boot();
    const head = D.page({ view: 'days', day: null }, ctx).match(/<div class="ovtotal">[\s\S]*?<\/p><\/div>/)[0];
    assert.match(head, /<div class="ovnum">\$6\.50<\/div>/);
    assert.match(head, /04:00 帳號 \$4\.00/);
    assert.doesNotMatch(head, /%|≈/);
});

test('總覽\'s row for a task with no account is plain text with the reason, not a link', () => {
    const { D, ctx } = boot();
    const ov = between(D.page({ view: 'days', day: null }, ctx), 'data-panel="overview"', 'data-panel="quota7"');
    assert.ok(ov.includes('<td class="task"><span title="帳號未知的 task 不在額度圖上">delta</span></td>'));
    assert.doesNotMatch(ov, /<a [^>]*>delta<\/a>/);
});

test('總覽\'s 帳號 seg keeps one account: its total, its tasks only, the others\' bars faded', () => {
    const { D, ctx } = boot();
    let ov = between(D.page({ view: 'days', day: null }, ctx), 'data-panel="overview"', 'data-panel="quota7"');
    assert.match(ov, /data-seg="ovacc"[\s\S]*?<button type="button" data-v="4 19:00"/);
    ctx.view.ovacc = '4 19:00';
    ov = between(D.page({ view: 'days', day: null }, ctx), 'data-panel="overview"', 'data-panel="quota7"');
    assert.match(ov, /<div class="ovnum">\$2\.00<\/div>/);
    assert.deepEqual([...ov.matchAll(/<td class="task">(?:<a href="[^"]+">|<span title="[^"]+">)([^<]+)</g)].map((m) => m[1]), ['gamma']);
    const bar = ov.match(/<title>2026-10-30 [^<]*<\/title><\/rect><g class="bar">([\s\S]*?)<\/g>/)[1];
    assert.deepEqual([...bar.matchAll(/style="fill:[^";]+(;opacity:\.16)?"/g)].map((m) => Boolean(m[1])), [true, false, true]);
});

test('總覽\'s bars, wide and narrow, give each account its own colour, the one its swatch shows', () => {
    const { D, ctx } = boot();
    const ov = between(D.page({ view: 'days', day: null }, ctx), 'data-panel="overview"', 'data-panel="quota7"');
    const sw = [...ov.match(/<p class="ovsplit">([\s\S]*?)<\/p>/)[1].matchAll(/background:([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(sw).size, 3, 'two accounts and the unknown, three colours');
    for (const cls of ['qwid', 'qnar']) {
        const svg = ov.match(new RegExp('<svg class="ovsvg ' + cls + '"[\\s\\S]*?</svg>'))[0];
        const today = svg.match(/<title>2026-10-30 [^<]*<\/title><\/rect><g class="bar">([\s\S]*?)<\/g>/)[1];
        assert.deepEqual([...today.matchAll(/style="fill:([^";]+)/g)].map((m) => m[1]), sw, cls);
    }
});

test('明細\'s kpi labels wrap on a phone rather than run into the next cell', () => {
    const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'assets', 'station', 'days-page.css'), 'utf8');
    const phone = css.slice(css.indexOf('@media (max-width:720px)'));
    assert.match(phone, /\.dmain \.readouts \.ro \.l,\.dmain \.readouts \.ro \.d\{white-space:normal\}/);
});
