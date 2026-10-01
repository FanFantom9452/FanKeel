'use strict';
// #/live under the 2026-10-01 layout (docs/90-agent/plans/2026-10-01-station-layout.md
// Task 4): the film's page head, each lane led by its glyph, the maybe-stopped
// lanes in one card.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: false } };
const V = require('../assets/station/station.js');

const T = Date.now();
const lane = (id, state, unknown, extra) => Object.assign({ id, root: 'F:\\ws\\alpha', project: null, state, unknown, task: 'task ' + id, stage: 'build',
    route: ['survey', 'design', 'plan', 'build'], started: new Date(T - 600000).toISOString(), updated: T - 60000, stages: [], pending: null }, extra);
const P = [{ root: 'F:\\ws\\alpha', gone: false }];
const ROWS = [lane('r1', 'live', false), lane('m1', 'live', true), lane('m2', 'stale', false)];

test('#/live opens with the film\'s head: running, maybe stopped, the gate line, and the tabs on its right', () => {
    const html = V.nowHtml(P, ROWS, '<nav class="subtabs" data-block="subtabs"></nav>');
    const head = html.slice(0, html.indexOf('data-block="now"'));
    assert.match(head, /^<div class="phead khead" data-block="live-head"><h1>/);
    assert.match(head, /<p class="kcap"><span>正在跑<b>1<\/b><\/span><span>可能已經停了<b>2<\/b><\/span><span class="ok">沒有 gate 在等你<\/span><\/p><span class="spacer"><\/span><nav class="subtabs"/);
    assert.match(html, /<div class="lv klv" data-block="now">/);
    const gated = V.nowHtml(P, [lane('g1', 'live', false, { pending: { questions: [{ header: 'h' }] } })], '');
    assert.match(gated, /<span><b>1<\/b>個 gate 在等你<\/span>/);
});

test('a running lane leads with the glyph and its stage count; the maybe-stopped lanes share one card', () => {
    const html = V.nowHtml(P, ROWS, '');
    assert.match(html, /<a class="lane live wsubs" data-state="live" href="#\/s\/r1"><svg class="glyph k-only prog"[^>]*>[\s\S]*?<\/svg><span class="kst k-only" style="--c:var\(--st-build\)"><b>04<\/b><i>&nbsp;\/&nbsp;04<\/i><u>build<\/u><\/span><div class="lane-who">/);
    const maybe = html.slice(html.indexOf('data-block="live-maybe"'));
    assert.equal((maybe.match(/<div class="lv-card">/g) || []).length, 1);
    const card = maybe.slice(maybe.indexOf('<div class="lv-card">'));
    assert.equal((card.match(/<a class="lane unsure"/g) || []).length, 2, 'both lanes in the one card');
});
