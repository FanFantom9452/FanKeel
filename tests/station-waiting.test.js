'use strict';
// The dashboard's waiting card and #/live's lanes (design §5; mockup blocks
// waiting-card and live-subagents): a gate's wait runs from `gateAt`, the
// moment the question went out, and a live lane lists the stage agent in
// flight and the subagents running now.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');

const NOW = new Date(2026, 8, 27, 16, 0).getTime();
const MIN = 60000;
// The page with a document, so `freshen()` has filled NAMES before the
// exports are taken — `dashRowName` reads it (the DASH harness of
// tests/station-view.test.js).
const DASH = (() => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const doc = { getElementById: (id) => els[id] || (els[id] = el()), addEventListener: () => {}, createElement: el,
        head: { appendChild() {} }, querySelectorAll: () => [] };
    const win = { location: { hash: '#/' }, addEventListener() {}, scrollTo() {},
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-04', serve: false,
            projects: [{ root: 'F:\\ws\\alpha', gone: false, unreadable: 0, build: [], mapAt: null }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    const sandbox = { window: win, document: doc, URLSearchParams, fetch() {}, module: { exports: {} } };
    vm.runInNewContext(src, sandbox);
    return sandbox.module.exports;
})();

const gated = (extra) => Object.assign({ id: 'w1', pkey: 'F:\\ws\\alpha', task: 'the task', stage: 'design', updated: NOW - 90 * MIN,
    pending: { questions: [{ header: 'design done' }], at: NOW - 40 * MIN, until: NOW + 48 * MIN } }, extra);

test('the waiting card counts a gate from gateAt, not from the pending file or the last write', () => {
    const html = DASH.dashGate([gated({ gateAt: NOW - 12 * MIN })], NOW);
    assert.match(html, /<section class="dcard" data-block="waiting-card">/);
    assert.match(html, /<div class="dbig warn">1<small>個 gate 在等<span class="dfrom">從問題送出那一刻算起<\/span><\/small><\/div>/);
    assert.ok(html.includes('<a class="drow" href="#/s/w1"><span class="dp">'), html);
    assert.ok(html.includes('<span class="chip dstage"><i class="sw" style="background:var(--st-design)"></i>design</span>'
        + '<span class="dt">design done</span><span class="dw" title="問題 15:48 送出，還剩 48 分">等了 12 分</span></a>'), html);
});

test('without gateAt the wait falls back to pending.at, then to the last write; past an hour it reads hours and minutes', () => {
    assert.match(DASH.dashGate([gated({})], NOW), /等了 40 分<\/span>/);
    assert.match(DASH.dashGate([gated({ pending: { questions: [{ header: 'h' }] } })], NOW), /等了 1 時 30 分<\/span>/);
    assert.match(DASH.dashGate([gated({ gateAt: NOW - 65 * MIN })], NOW), /等了 1 時 5 分<\/span>/);
    assert.match(DASH.dashGate([gated({ gateAt: NOW - 120 * MIN })], NOW), /等了 2 時<\/span>/);
    assert.match(DASH.dashGate([], NOW), /<div class="dbig">0<small>個 gate 在等<\/small><\/div>/);
});

test('#/live counts its gate rows from gateAt too', () => {
    const t = Date.now();
    const html = V.nowHtml([{ root: 'F:\\ws\\alpha', gone: false }], [{ id: 'g1', root: 'F:\\ws\\alpha', project: null, state: 'live',
        unknown: false, task: 'g', stage: 'design', route: ['survey', 'design'], started: new Date(t - 60 * MIN).toISOString(),
        updated: t - 50 * MIN, stages: [], gateAt: t - 12 * MIN - 5000,
        pending: { questions: [{ header: 'pick one' }], at: t - 40 * MIN } }]);
    const at = html.indexOf('data-block="live-gate"');
    assert.match(html.slice(at, html.indexOf('</section>', at)), /等了 12m/);
});

const RUN = {
    stage: 'design', model: 'claude-opus-5-5',
    inflight: { stage: 'design', at: NOW - 8 * MIN, agentId: 'a1' },
    subagents: [
        { id: 'a1', agentType: 'fankeel:fankeel-brain', description: 'the stage agent itself', model: null, startedAt: NOW - 8 * MIN },
        { id: 'a2', agentType: 'fankeel:fankeel-mockup', description: 'opus 5.5 · inherit: station batch mockup', model: null, startedAt: NOW - 6 * MIN },
        { id: 'a3', agentType: 'fankeel:fankeel-reader', description: 'sonnet 5 · inherit: station data-side facts', model: 'sonnet', startedAt: NOW - 3 * MIN },
    ],
};

test('a lane lists the stage agent in flight and each subagent, once each, as the mockup draws them', () => {
    const html = V.liveSubsHtml(RUN, NOW);
    assert.ok(html.startsWith('<div class="lane-subs" data-block="live-subagents"><div class="sa-h"><b>現在在跑</b>'
        + '<span>stage agent 1 個 · subagent 2 個</span></div>'), html);
    assert.ok(html.includes('<div class="sa inflight"><span class="sa-type">stage agent</span><span class="chip"><i class="sw" '
        + 'style="background:var(--st-design)"></i>design</span><span class="sa-desc">15:52 送出，還沒交回</span><span class="sa-for">8m</span></div>'), html);
    assert.ok(html.includes('<div class="sa"><span class="sa-type" title="fankeel:fankeel-mockup">fankeel:fankeel-mockup</span>'
        + '<span class="chip"><i class="sw" style="background:var(--m-opus)"></i>opus</span>'
        + '<span class="sa-desc" title="opus 5.5 · inherit: station batch mockup">station batch mockup</span><span class="sa-for">6m</span></div>'), html);
    assert.ok(html.includes('<i class="sw" style="background:var(--m-sonnet)"></i>sonnet</span>'
        + '<span class="sa-desc" title="sonnet 5 · inherit: station data-side facts">station data-side facts</span><span class="sa-for">3m</span>'), html);
    assert.doesNotMatch(html, /fankeel-brain/, 'the stage agent is not listed a second time as a subagent');
});

test('a lane with nothing running says the main session is working alone; an inflight mark for another stage is not shown', () => {
    const none = '<div class="lane-subs" data-block="live-subagents"><p class="sa-none">沒有 stage agent 或 subagent 在跑，主 session 自己在做。</p></div>';
    assert.equal(V.liveSubsHtml({ stage: 'build', subagents: [] }, NOW), none);
    assert.equal(V.liveSubsHtml({ stage: 'build', inflight: { stage: 'design', at: NOW }, subagents: [] }, NOW), none);
});

test('#/live gives a confirmed-live lane the subagent row and an unconfirmed one none', () => {
    const t = Date.now();
    const row = (id, unknown) => ({ id, root: 'F:\\ws\\alpha', project: null, state: 'live', unknown, task: id, stage: 'build',
        route: ['survey', 'build'], started: new Date(t - 30 * MIN).toISOString(), updated: t - MIN, stages: [], pending: null, subagents: [] });
    const html = V.nowHtml([{ root: 'F:\\ws\\alpha', gone: false }], [row('sure', false), row('unsure', true)]);
    assert.match(html, /<a class="lane live wsubs" data-state="live" href="#\/s\/sure">/);
    assert.match(html, /<a class="lane unsure" data-state="live" href="#\/s\/unsure">/);
    assert.equal((html.match(/data-block="live-subagents"/g) || []).length, 1);
});
