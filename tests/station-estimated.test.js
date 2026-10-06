'use strict';
// Every dollar figure the page prints that has an estimated-price request in it
// (a model priced from its family's newest row, `estimated`) carries 估. Each
// test renders through the view or page function that owns the figure, with a
// fixture holding an estimated case and a plain one, and asserts the mark at
// that one spot; the same render with nothing estimated must hold no 估 at all.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');

const NOW = Date.now();
const DAYS = V.lastDays(NOW, 30);
const PREV = V.lastDays(NOW - 30 * 864e5, 30);
const TODAY = V.localDay(NOW);
const tok = { input: 1000, output: 100, cacheRead: 4000, cacheWrite5m: 500, cacheWrite1h: 250 };
const costOf = (u) => ({ input: u / 4, output: u / 2, cacheRead: u / 8, cacheWrite5m: u / 16, cacheWrite1h: u / 16 });
const dr = (model, who, usd, est) => ({ day: TODAY, stage: 'build', model, who, tokens: tok, cost: costOf(usd), usd, estimated: est });
const sess = (id, days, extra) => Object.assign({
    id, root: 'F:\\ws\\a', project: null, pkey: 'F:\\ws\\a', task: 'task ' + id, state: 'down', stage: 'build', route: ['survey', 'build'],
    started: new Date(NOW - 3600000).toISOString(), updated: NOW - 60000, usd: 0, agentUsd: 0, estimated: [], unpriced: [], hasDetail: true,
    stages: [], notes: [], claims: [], conflicts: [], burn: 0, backtracks: 0, days, spans: [],
}, extra);
// est: main 2 + agent 1 estimated (haiku-5-5 is not in the table), main 1 plain. total 4, main 3, agent 1.
const EST_DAYS = [dr('claude-haiku-5-5', 'main', 2, true), dr('claude-haiku-5-5', 'agent', 1, true), dr('claude-opus-5', 'main', 1, false)];
const PLAIN_DAYS = [dr('claude-opus-5', 'main', 3, false), dr('claude-opus-5', 'agent', 1, false)];
const EST = [sess('est', EST_DAYS)];
const PLAIN = [sess('plain', PLAIN_DAYS)];
const O = { metric: 'usd', dim: 'model', sel: null, today: TODAY, days: DAYS, names: { 'F:\\ws\\a': 'a' }, pkeys: ['F:\\ws\\a'] };
const none = (html) => assert.doesNotMatch(html, /估/, 'nothing estimated, nothing marked');

test('kpiHtml marks the 30-day cost 估 only when an estimated row is in the window', () => {
    const k = (R) => V.kpiHtml(V.windowTotals(R, DAYS), V.windowTotals(R, PREV));
    assert.match(k(EST), /<div class="l">30 天花費<\/div><div class="v">\$4\.00 估<\/div>/);
    none(k(PLAIN));
});

const hist = (R) => V.histSvg(V.dayBars(R, 'usd', 'model', DAYS), O);
test('histSvg marks the day total in a column\'s label 估', () => {
    assert.match(hist(EST), /aria-label="[^"]*合計 \$4\.00 估；/);
    none(hist(PLAIN));
});

test('histSvg marks an estimated part in the column label and leaves a plain part of the same label bare', () => {
    assert.match(hist(EST), /；Haiku 5\.5 \$3\.00 估/);
    assert.match(hist(EST), /；Opus 5 \$1\.00(?! 估)/);
});

test('histSvg marks the total drawn over an estimated bar', () => {
    assert.match(hist(EST), /<text class="tick"[^>]*>\$4\.00 估<\/text>/);
});

test('histSvg axis ticks are a scale, not a spend, and are never marked', () => {
    const e = V.histSvg(V.dayBars(EST, 'usd', 'model', DAYS), O);
    const ticks = [...e.matchAll(/<text class="tick" x="42"[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    assert.ok(ticks.length >= 5, 'the five axis ticks were found');
    for (const t of ticks) assert.doesNotMatch(t, /估/);
});

const tipOf = (R, key) => V.segTip(V.dayBars(R, 'usd', 'model', DAYS), O, TODAY, key);
test('segTip marks the hovered segment\'s own figure 估', () => {
    assert.match(tipOf(EST, 'haiku-5-5'), /<div class="tt-val"><b>\$3\.00 估<\/b>/);
    assert.doesNotMatch(tipOf(EST, 'opus-5'), /<div class="tt-val"><b>\$1\.00 估/);
});

test('segTip marks each estimated segment in the stacked list and not a plain one', () => {
    assert.match(tipOf(EST, null), /<span class="tt-n">\$3\.00 估<\/span><\/li>/);
    assert.match(tipOf(EST, null), /<span class="tt-n">\$1\.00<\/span><\/li>/);
});

test('segTip marks the day sum 估', () => {
    assert.match(tipOf(EST, null), /<div class="tt-sum">當天合計 <b>\$4\.00 估<\/b>/);
    none(tipOf(PLAIN, 'opus-5'));
});

test('histSvg with the kind split carries the estimate onto each of the four kinds', () => {
    const e = V.histSvg(V.dayBars(EST, 'usd', 'kind', DAYS), Object.assign({}, O, { dim: 'kind' }));
    assert.match(e, /；output \$[\d.]+ 估/);
    none(V.histSvg(V.dayBars(PLAIN, 'usd', 'kind', DAYS), Object.assign({}, O, { dim: 'kind' })));
});

test('histSvg time and token metrics never carry the mark', () => {
    for (const metric of ['tokens', 'time']) {
        if (metric === 'time') { const R = [sess('t', EST_DAYS, { spans: [{ day: TODAY, stage: 'build', who: 'main', ms: 600000 }] })]; none(V.histSvg(V.dayBars(R, 'time', 'project', DAYS), Object.assign({}, O, { metric: 'time', dim: 'project' }))); }
        else none(V.histSvg(V.dayBars(EST, 'tokens', 'model', DAYS), Object.assign({}, O, { metric: 'tokens' })));
    }
});

test('projectsHtml marks a project\'s 30-day cost 估', () => {
    const html = (R) => V.projectsHtml(V.projectRows(R, DAYS), O);
    assert.match(html(EST), /<span class="r">\$4\.00 估<\/span><span class="r">1<\/span>/);
    none(html(PLAIN));
});

test('recentHtml marks a session row\'s cost 估', () => {
    const html = (R) => V.recentHtml(R, O, '');
    assert.match(html(EST), /<td class="r">\$4\.00 估<\/td><td class="r muted">/);
    none(html(PLAIN));
});

test('projectSessionsHtml marks the session cost cell and the estimated family in the model-mix tooltip', () => {
    const html = (R) => V.projectSessionsHtml(R, []);
    assert.match(html(EST), /<td class="r">\$4\.00 估<\/td><td class="r muted">/);
    assert.match(html(EST), /title="opus \$1\.00、haiku \$3\.00 估"/);
    none(html(PLAIN));
});

test('projectChart marks an estimated session point in its tooltip', () => {
    const chart = (R) => V.projectChart([{ name: 'a', colour: '#123', points: V.sessionPoints(R, 'usd', NOW - 864e5, NOW + 864e5) }],
        { metric: 'usd', t0: NOW - 864e5, t1: NOW + 864e5, days: DAYS, today: TODAY });
    assert.match(chart(EST), /<title>[^<]*\$4\.00 估<\/title>/);
    none(chart(PLAIN));
});

test('projectHead carries the estimate of the window it sums', () => {
    assert.equal(V.projectHead(EST, 'F:\\ws\\a', DAYS).estimated, true);
    assert.equal(V.projectHead(PLAIN, 'F:\\ws\\a', DAYS).estimated, false);
});

test('navHtml marks the 30-day badge 估 when navCounts says an estimated row is in the window', () => {
    const nav = (R) => V.navHtml('days', V.navCounts(R, [], DAYS));
    assert.match(nav(EST), /<span class="nb">\$4\.00 估<\/span>/);
    none(nav(PLAIN));
});

test('navCounts flags estimated from the window\'s rows', () => {
    assert.equal(V.navCounts(EST, [], DAYS).estimated, true);
    assert.equal(V.navCounts(PLAIN, [], DAYS).estimated, false);
});

// ---- the session page --------------------------------------------------------
const LOOPS = (est) => [{ stage: 'build', turns: 5, over: 2, overUsd: 0.5, estimated: est }];
const costOnly = (R, est) => V.costHtml(V.costModel(R[0].days), { loops: LOOPS(est) });
test('costHtml marks the session total in the sumline', () => {
    assert.match(costOnly(EST, false), /合計花費<b>\$4\.00 估<\/b>/);
    none(costOnly(PLAIN, false));
});

test('costHtml marks the main session in the sumline', () => {
    assert.match(costOnly(EST, false), /<div>主 session<b>\$3\.00 估<\/b>/);
});

test('costHtml marks the dispatch figure in the sumline', () => {
    assert.match(costOnly(EST, false), /派工（agent \+ workflow）<b>\$1\.00 估<\/b>/);
});

test('costHtml marks each per-kind USD cell and the row total of a stage x model row', () => {
    const e = costOnly(EST, false);
    const child = e.slice(e.indexOf('<tr class="child">'), e.indexOf('</tr>', e.indexOf('<tr class="child">')));
    assert.equal((child.match(/<td class="r">\$[\d.]+ 估<\/td>/g) || []).length, 5, 'a cost cell for each of the four kinds and the row total');
});

test('costHtml marks only the per-kind USD cells that carry money: a kind with none stays a dash', () => {
    const zero = [{ day: TODAY, stage: 'build', model: 'claude-haiku-5-5', who: 'main', tokens: tok, cost: { input: 2, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 }, usd: 2, estimated: true }];
    const e = V.costHtml(V.costModel(zero), { loops: LOOPS(false) });
    const child = e.slice(e.indexOf('<tr class="child">'), e.indexOf('</tr>', e.indexOf('<tr class="child">')));
    assert.equal((child.match(/<td class="r">—<\/td>/g) || []).length, 3);
    assert.equal((child.match(/估/g) || []).length, 2, 'the one kind with money and the row total');
});

test('costHtml marks the loop row of a stage whose over-turns were estimated', () => {
    assert.match(costOnly(PLAIN, true), /<b>\$0\.50 估<\/b>那些回合/);
    assert.match(costOnly(PLAIN, false), /<b>\$0\.50<\/b>那些回合/);
});

test('costHtml marks the foot rows (main, agent, total) in their USD cell', () => {
    const e = V.costHtml(V.costModel(EST_DAYS), { loops: LOOPS(false) });
    const foot = e.slice(e.indexOf('<tfoot>'));
    for (const label of ['主 session', 'agent', '合計']) {
        const tr = foot.match(new RegExp('<tr><td>' + label + '</td>[\\s\\S]*?</tr>'))[0];
        assert.match(tr, /<td class="r total">\$[\d.]+ 估<\/td><\/tr>/, label);
    }
});

test('costHtml marks the foot loop row\'s total from the loops it sums', () => {
    const e = V.costHtml(V.costModel(PLAIN_DAYS), { loops: LOOPS(true) });
    const foot = e.slice(e.indexOf('<tfoot>'));
    assert.match(foot, /<tr class="loop">[\s\S]*<b>\$0\.50 估<\/b>那些回合/);
    assert.doesNotMatch(e.slice(0, e.indexOf('<tfoot>')).replace(/<tr class="loop">[\s\S]*?<\/tr>/, ''), /估/);
});

test('sessionHeadHtml marks the cost readout 估', () => {
    const head = (R) => V.sessionHeadHtml(R[0], null);
    assert.match(head(EST), /<div class="l">花費<\/div><div class="v">\$4\.00 估<\/div>/);
    none(head(PLAIN));
});

const STG = (est) => [{ stage: 'build', from: 0, to: 600000, burn: 1, usd: 4, estimated: est }];
test('costShareHtml marks the total in its hint line', () => {
    const L = (R, est) => V.stageShare(Object.assign({}, R[0], { stages: STG(est) }), null);
    assert.match(V.costShareHtml(L(EST, true), null), /合計 \$4\.00 估；點一段/);
    none(V.costShareHtml(L(PLAIN, false), null));
});

test('dispatchStagesHtml marks the total beside its heading', () => {
    const L = (est) => ({ rows: [{ stage: 'build', agent: 1500, estimated: est }] });
    assert.match(V.dispatchStagesHtml(L(true), 's1', null), /<small>合計 \$1,?500 估<\/small>|<small>合計 \$1500 估<\/small>/);
    none(V.dispatchStagesHtml(L(false), 's1', null));
});

// ---- the timeline ------------------------------------------------------------
const T0 = new Date(2026, 8, 13, 22, 0).getTime();
const TL = {
    requests: 3, wakes: 0, peak: 90000, peakN: 3, noTime: 0, backtracks: 0, marks: [], rises: [], backs: [], tasks: [],
    points: [{ n: 1, t: T0 + 60000, y: 20000, model: 'claude-opus-5' }, { n: 2, t: T0 + 3000000, y: 60000, model: 'claude-opus-5' }],
    seq: [{ stage: 'build', at: T0, source: 'cmd' }, { stage: 'verify', at: T0 + 5400000, source: 'cmd' }],
    waits: [],
    dispatches: [{ key: 'd0', turn: 2, surface: 'agent', text: 'read', out: T0 + 1800000, back: T0 + 2400000, ret: 64, launch: 0, ids: ['a1'] }],
    rows: [{ id: 'a1', disp: 0, surface: 'agent', label: 'read:map', agentType: 'reader', model: 'claude-sonnet-5', phase: null,
        c: 190, k: 21, s: 600, unpriced: [], estimated: [], from: T0 + 1800000, to: T0 + 2400000 }],
    runs: [], agentCents: 190, agentsTotal: { cents: 190 }, unpriced: [], estimated: [], steps: {}, dropped: 0, events: [],
};
const withRowEst = (est) => Object.assign({}, TL, { rows: TL.rows.map((r) => Object.assign({}, r, { estimated: est ? ['claude-sonnet-9'] : [] })) });
const stagesOf = (est) => [{ stage: 'build', usd: 1.5, estimated: est }, { stage: 'verify', usd: 0.5, estimated: false }];
const tl = (est, rowEst) => V.timelineSvg(V.stageCost(V.timelineModel(withRowEst(rowEst)), { stages: stagesOf(est) }), {});

test('timelineSvg marks 估 in the stage column\'s own tooltip', () => {
    assert.match(tl(true, false), /<rect class="seg"[^>]*><title>build [^<]*\$1\.50 估<\/title>/);
    assert.doesNotMatch(tl(true, false), /<rect class="seg"[^>]*><title>verify [^<]*估/);
    none(tl(false, false));
});

test('timelineSvg marks 估 in the hover reading of a point inside an estimated stage, apart from the column tooltip', () => {
    const svg = tl(true, false);
    assert.match(svg, /<rect class="hitc"[^>]*><title>build · [^<]*這段 stage \$1\.50 估<\/title>/);
});

test('timelineSvg marks the dispatch bar cost 估 when its row was estimated, and not otherwise', () => {
    assert.match(tl(false, true), />sonnet-5 · [^<]*\$1\.90 估 · 回傳/);
    none(tl(false, false));
});

test('timelineSvg marks a workflow bar 估 when any agent under it was estimated, and a plain workflow not', () => {
    const wf = (est) => Object.assign({}, TL, {
        dispatches: [{ key: 'd0', turn: 2, surface: 'workflow', text: 'build', out: T0 + 1800000, back: T0 + 2400000, ret: 64, launch: 0, run: 'wf_1', ids: ['w1', 'w2'] }],
        rows: ['w1', 'w2'].map((id, i) => Object.assign({}, TL.rows[0], { id, disp: 0, surface: 'workflow', label: 'impl:' + id, estimated: i === 0 && est ? ['claude-sonnet-9'] : [] })),
    });
    const svg = (est) => V.timelineSvg(V.stageCost(V.timelineModel(wf(est)), { stages: stagesOf(false) }), {});
    assert.match(svg(true), />workflow · 2 個 agent · [^<]*\$3\.80 估 · /);
    none(svg(false));
});

// ---- the dispatch table, its chart and the replay ------------------------------
const DX = {
    dispatches: [
        { key: 't1', turn: 3, surface: 'agent', text: 'Review task 1', out: 1000, back: 61000, ret: 1873, launch: 1066, ids: ['a1'] },
        { key: 't2', turn: 5, surface: 'workflow', text: 'survey', out: 2000, back: 90000, ret: 9602, launch: 1198, run: 'wf_1', ids: ['w1', 'w2'] },
    ],
    rows: [
        { id: 'a1', disp: 0, surface: 'agent', label: 'Review task 1', agentType: 'r', model: 'claude-haiku-5-5', phase: null, c: 123, k: 45, s: 60, unpriced: [], estimated: ['claude-haiku-5-5'] },
        { id: 'w1', disp: 1, surface: 'workflow', label: 'read:a', agentType: 'r', model: 'claude-haiku-5-5', phase: 'Read', c: 40, k: 10, s: 30, unpriced: [], estimated: ['claude-haiku-5-5'] },
        { id: 'w2', disp: 1, surface: 'workflow', label: 'check', agentType: 'r', model: 'claude-sonnet-5', phase: 'Check', c: 10, k: 5, s: 20, unpriced: [], estimated: [] },
    ],
    runs: [{ run: 'wf_1', name: 'survey', agents: 2 }], agentCents: 173, agentsTotal: { cents: 173 }, unpriced: [], estimated: ['claude-haiku-5-5'],
    steps: {}, events: [], dropped: 0,
};
const DXP = Object.assign({}, DX, { rows: DX.rows.map((r) => Object.assign({}, r, { estimated: [] })), estimated: [] });
const cell = (html, label) => html.match(new RegExp('<tr class="[^"]*"[^>]*>(?:(?!</tr>)[\\s\\S])*' + label + '(?:(?!</tr>)[\\s\\S])*</tr>'))[0];

test('dispatchHtml marks the cost cell of an estimated agent row, and not the plain agent beside it', () => {
    const html = V.dispatchHtml(DX);
    assert.match(cell(html, 'class="lab">Review task 1'), /\$1\.23 估<\/td>/);
    assert.doesNotMatch(cell(html, 'class="lab">check'), /估/);
    none(V.dispatchHtml(DXP));
});

test('dispatchHtml marks the cost cell of a dispatch band that has an estimated agent under it', () => {
    const html = V.dispatchHtml(DX);
    const band = html.match(/<tr class="band">(?:(?!<\/tr>)[\s\S])*Review task 1(?:(?!<\/tr>)[\s\S])*<\/tr>/)[0];
    assert.match(band, /\$1\.23 估<\/td>/);
});

test('dispatchHtml marks the cost cell of a workflow phase row holding an estimated agent, and not a phase without one', () => {
    const html = V.dispatchHtml(DX);
    const ph = (n) => html.match(new RegExp('<tr class="phr"><td><div class="phl"><button[^>]*>' + n + '[\\s\\S]*?</tr>'))[0];
    assert.match(ph('Read'), /\$0\.40 估<\/td>/);
    assert.doesNotMatch(ph('Check'), /估/);
});

test('dispatchHtml marks the footer total 估', () => {
    const foot = V.dispatchHtml(DX).match(/<tfoot>[\s\S]*<\/tfoot>/)[0];
    assert.match(foot, /\$1\.73 估<\/td>/);
});

test('dispatchHtml marks both sums in the reconciliation sentence', () => {
    const tally = V.dispatchHtml(DX).match(/各列美元相加[\s\S]*?<\/p>/)[0];
    assert.match(tally, /各列美元相加 <b>\$1\.73 估<\/b>/);
    assert.match(tally, /agentsOf\(\) 的 \$1\.73 估/);
});

const chartOf = (x) => V.dispatchHtml(x, null, { view: 'chart', metric: 'c' }).match(/<div class="dxc">[\s\S]*?<details/)[0];
test('the dispatch chart marks a dispatch row\'s figure 估', () => {
    assert.match(chartOf(DX), /<b>\$1\.23 估<\/b><\/span><\/div>/);
    none(chartOf(DXP));
});

test('the dispatch chart marks its total 估', () => {
    assert.match(chartOf(DX), /合計 <b>\$1\.73 估<\/b>/);
});

test('the dispatch chart marks the cost in a dispatch row\'s tooltip', () => {
    assert.match(chartOf(DX), /class="dxr" role="listitem" title="Review task 1[^"]*\$1\.23 估 ·/);
});

test('the dispatch chart marks the cost in an agent segment\'s tooltip, and not a plain agent\'s', () => {
    assert.match(chartOf(DX), /<i class="done"[^>]*title="Review task 1\n[^"]*\$1\.23 估 ·/);
    assert.doesNotMatch(chartOf(DX), /<i class="done"[^>]*title="check\n[^"]*估/);
});

test('the dispatch chart marks the cost in its total\'s tooltip', () => {
    assert.match(chartOf(DX), /class="dxsum" title="[^"]*\$1\.73 估 ·/);
});

test('the dispatch chart marks only the cost metric, not tokens', () => {
    const html = V.dispatchHtml(DX, null, { view: 'chart', metric: 'k' });
    const chart = html.match(/<div class="dxc">[\s\S]*?<details/)[0];
    assert.doesNotMatch(chart.replace(/title="[^"]*"/g, ''), /估/);
});

const RP = { burn: 3500, stages: [
    { stage: 'survey', from: 0, to: 900, burn: 1000, usd: 0.5, waited: null, estimated: false },
    { stage: 'build', from: 900, to: 70000, burn: 2500, usd: 1.25, waited: 15000, estimated: true },
] };
const RPX = Object.assign({}, DX, { events: [
    { t: 500, kind: 'prompt', text: 'fix it', cmd: '/fankeel:fankeel' },
    { t: 1000, kind: 'out', disp: 0, surface: 'agent', text: 'Review task 1', agentType: 'r', alias: 'sonnet' },
    { t: 61000, kind: 'back', disp: 0, ret: 1873, text: 'Review task 1' },
] });
const replayStrip = (stages) => V.replayHtml(RPX, {}, Object.assign({}, RP, { stages })).match(/<div class="rpcs"[\s\S]*?<div class="key">/)[0];
const RP_PLAIN = RP.stages.map((w) => Object.assign({}, w, { estimated: false }));
test('the replay cost strip marks the estimated segment\'s button title, and not the plain one\'s', () => {
    assert.match(replayStrip(RP.stages), /<button type="button" class="rs" data-rs="rs-1"[^>]*title="build · [^"]*\$1\.25 估">/);
    assert.doesNotMatch(replayStrip(RP.stages), /<button[^>]*title="survey · [^"]*估/);
    none(replayStrip(RP_PLAIN));
});

test('the replay cost strip marks the estimated segment\'s label', () => {
    assert.match(replayStrip(RP.stages), /\$1\.25 估<\/button>/);
});

test('the replay cost strip marks its total when any segment is estimated', () => {
    assert.match(replayStrip(RP.stages), /<span class="val">\$1\.75 估<\/span>/);
});

test('the replay table of contents marks the estimated segment\'s cost 估 and the plain one not', () => {
    const toc = V.replayHtml(RPX, {}, RP).match(/<nav class="rptoc"[\s\S]*?<\/nav>/)[0];
    assert.match(toc, /<b>build<\/b>[\s\S]*?\$1\.25 估 · \d+ 列/);
    assert.doesNotMatch(toc, /<b>survey<\/b>[^]*?\$0\.50 估/);
});

test('the replay segment header marks the estimated segment\'s cost 估', () => {
    assert.match(V.replayHtml(RPX, {}, RP), /<dt>花費<\/dt><dd>\$1\.25 估<\/dd>/);
});

const cmp = () => V.compareHtml({ id: 'aaaaaaaa', state: 'down', stage: 'build', route: ['build'], task: 'a' }, withRowEst(true),
    { id: 'bbbbbbbb', state: 'down', stage: 'build', route: ['build'], task: 'b' }, withRowEst(false));
const cmpRow = (id) => cmp().match(new RegExp('<tr><td class="sid">' + id + '[\\s\\S]*?</tr>'))[0];
test('compareHtml marks the dispatch USD cell of an estimated session, and not the plain one beside it', () => {
    assert.match(cmpRow('aaaaaaaa'), /<td class="v r">\$1\.90 估<span class="s2">/);
    none(cmpRow('bbbbbbbb'));
});

test('compareHtml marks the agentsOf figure it sets the sum against', () => {
    assert.match(cmpRow('aaaaaaaa'), /agentsOf\(\) \$1\.90 估<\/span>/);
});

// ---- tune ledger, dashboard and the pages that need the DOM ------------------------
const ledgerSes = (id, est, back) => Object.assign(sess(id, []), {
    route: ['build', 'verify'], backtracks: back,
    stages: [{ stage: 'build', from: 0, to: 600000, burn: 10, usd: 2, estimated: est, waited: 0 }, { stage: 'verify', from: 600000, to: 900000, burn: 10, usd: 1, estimated: false, waited: 0 }],
});
const ledgerRow = (html, label) => html.match(new RegExp('<tr><td><span class="chip"[^>]*>' + label + '</span>[\\s\\S]*?</tr>'))[0];
test('routeLedger marks an estimated stage\'s average cost 估 and a plain stage beside it not', () => {
    const html = V.routeLedger([ledgerSes('a', true, 0)]);
    assert.match(ledgerRow(html, 'build'), /<td class="r num">\$2\.00 估<\/td>/);
    assert.doesNotMatch(ledgerRow(html, 'verify'), /估/);
    none(V.routeLedger([ledgerSes('c', false, 0)]));
});

test('routeLedger marks the 有倒退 row from the estimated windows of the sessions that stepped back', () => {
    const html = V.routeLedger([ledgerSes('a', false, 0), ledgerSes('b', true, 1)]);
    assert.match(html, /<td class="r num">\$3\.00 估<\/td>/);
    assert.doesNotMatch(html, /<td class="r num">\$3\.00 估<\/td>[\s\S]*<td class="r num">\$3\.00 估<\/td>/);
    none(V.routeLedger([ledgerSes('a', false, 0), ledgerSes('b', false, 1)]));
});

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
function boot(hash, sessions, detail) {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, hidden: false, addEventListener() {}, setAttribute() {}, getAttribute() { return null; }, hasAttribute() { return false; }, removeAttribute() {}, appendChild() {} });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', head: { appendChild() {} },
        getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null };
    const win = { location: { hash }, addEventListener() {}, scrollTo() {}, setInterval: () => 1, setTimeout: () => 1, clearTimeout() {},
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION_DETAIL: detail || {},
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: 'F:\\ws\\a', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions } };
    const ctx = vm.createContext({ window: win, document: doc, URLSearchParams, fetch() { return Promise.resolve({ ok: true, text: () => Promise.resolve('') }); }, module: { exports: {} } });
    vm.runInContext(SRC, ctx);
    return { els, x: ctx.module.exports };
}
const flat = (sessions) => sessions.map((s) => Object.assign({}, s, { usd: 0, agentUsd: 0 }));

test('dashSpend marks the 30-day total 估', () => {
    assert.match(boot('#/', flat(EST)).x.dashSpend(EST), /<div class="dbig">\$4\.00 估<\/div>/);
    none(boot('#/', PLAIN).x.dashSpend(PLAIN));
});

test('dashSpend marks the day\'s bar title 估', () => {
    assert.match(boot('#/', flat(EST)).x.dashSpend(EST), new RegExp('<title>' + TODAY + ' \\$4\\.00 估</title>'));
});

test('dashSpend marks today\'s figure 估 and yesterday\'s empty one not', () => {
    const html = boot('#/', flat(EST)).x.dashSpend(EST);
    assert.match(html, /今天 <b>\$4\.00 估<\/b>/);
    assert.match(html, /昨天 <b>—<\/b>/);
});

test('dashSpend marks yesterday\'s figure when yesterday holds the estimated row', () => {
    const y = V.localDay(NOW - 864e5);
    const R = [sess('y', [Object.assign(dr('claude-haiku-5-5', 'main', 2, true), { day: y })])];
    assert.match(boot('#/', R).x.dashSpend(R), /昨天 <b>\$2\.00 估<\/b>/);
});

test('dashRecent marks a session\'s cost 估', () => {
    const html = boot('#/', EST).x.dashRecent(EST);
    assert.match(html, /<span class="dc mono">\$4\.00 估<\/span>/);
    none(boot('#/', PLAIN).x.dashRecent(PLAIN));
});

test('the dashboard caption marks today\'s cost 估', () => {
    const p = boot('#/', EST);
    p.x.dashPage();
    const cap = (R, sessions) => boot('#/', sessions).x.dashPage();
    assert.match(cap(EST, EST), /今天<b>\$4\.00 估<\/b>|今天<b>\$4\.00 估/);
    none(cap(PLAIN, PLAIN).match(/<p class="kcap">[\s\S]*?<\/p>/)[0]);
});

test('the session list row marks the cost 估 from the session\'s estimated ids, the plain row not', () => {
    const E = sess('est', [], { usd: 2, agentUsd: 1, estimated: ['claude-haiku-5-5'] });
    const P = sess('plain', [], { usd: 2, agentUsd: 1, updated: NOW - 120000 });
    const p = boot('#/list', [E, P]);
    p.x.drawList();
    const lb = p.els.lb.innerHTML;
    const row = (id) => lb.match(new RegExp('<tr data-id="' + id + '"[\\s\\S]*?</tr>'))[0];
    assert.match(row('est'), /<td class="r num">\$3\.00 估<\/td>/);
    assert.doesNotMatch(row('plain'), /估/);
});

const DET = {
    requests: 3, wakes: 0, peak: 9, peakN: 1, noTime: 0, backtracks: 0, marks: [], rises: [], backs: [], tasks: [], points: [], seq: [], waits: [],
    dispatches: DX.dispatches, rows: DX.rows, runs: DX.runs, agentCents: 173, agentsTotal: { cents: 173 }, unpriced: [], estimated: ['claude-haiku-5-5'],
    steps: {}, dropped: 0, events: [], loops: [], states: {},
};
const detailPanel = (E, extra) => {
    const p = boot('#/list', [E], { [E.id]: Object.assign({}, DET, extra) });
    p.x.drawList();
    return p.els.det.innerHTML;
};
test('the session detail panel marks the total line with the count of estimated models', () => {
    const E = sess('est', [], { usd: 2, agentUsd: 1, estimated: ['claude-haiku-5-5'] });
    assert.match(detailPanel(E), /<dt>總計<\/dt><dd class="num">[^<]*· \$3\.00 \(1 估\)/);
});

test('the session detail panel marks the dispatch section title 估 when an agent row was estimated, and nothing when none was', () => {
    const E = sess('est', [], { usd: 2, agentUsd: 1, estimated: ['claude-haiku-5-5'] });
    assert.match(detailPanel(E), /3 個 agent · \$1\.73 估/);
    const P = sess('plain', [], { usd: 2, agentUsd: 1 });
    assert.doesNotMatch(detailPanel(P, { rows: DXP.rows, estimated: [] }), /估/);
});

test('the project page marks the 30-day cost readout 估', () => {
    const p = boot('#/p/' + encodeURIComponent('F:\\ws\\a'), EST);
    const html = p.els.page.innerHTML;
    assert.match(html, /近 30 天花費<\/div><div class="v">\$4\.00 估<\/div>/);
    const q = boot('#/p/' + encodeURIComponent('F:\\ws\\a'), PLAIN);
    none(q.els.page.innerHTML.match(/<div class="readouts">[\s\S]*?<\/div><\/div><\/div>/)[0]);
});
