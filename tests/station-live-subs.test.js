'use strict';
// 進行中 draws what runs under a confirmed-live session again — the stage agent
// in flight and the subagents mid-turn — the rows the old #/live drew in
// nav.js's liveSubsHtml and the redesign dropped (station-63 survey, 2026-10-30).
const test = require('node:test');
const assert = require('node:assert/strict');
const { page, stringsLeft } = require('./station-module.js');

const NOW = Date.parse('2026-10-30T09:00:00.000Z');
const iso = (minAgo) => new Date(NOW - minAgo * 60000).toISOString();
const base = (o) => Object.assign({ root: 'F:\\w', project: 'app', pkey: 'F:\\w/app', route: ['survey', 'build'], stage: 'build', state: 'live',
    started: iso(60), updated: iso(1), usd: 1, agentUsd: 1, model: 'claude-opus-4-1', gateAt: null, stages: [], days: null, task: 'T' }, o);
const AGENTS = [
    { id: 'stage-1', agentType: 'fankeel:fankeel-brain', description: 'sonnet 5.5 · medium: build stage agent', ranModel: 'claude-sonnet-4-5', startedAt: NOW - 8 * 60000 },
    { id: 'impl-2', agentType: 'fankeel:fankeel-implementer', description: 'sonnet 5.5 · medium: <Task 2>', ranModel: 'claude-sonnet-4-5', effort: 'medium', startedAt: NOW - 3 * 60000 },
];
const draw = (sessions, lang) => {
    const { win } = page(['tip.js', 'live-page.js'], {});
    if (lang) win.FK_I18N = { lang };
    return win.FK_LIVE.page({ sessions }, { names: {}, now: NOW });
};
const block = (html) => {
    const i = html.indexOf('data-block="live-subagents"');
    return i < 0 ? null : html.slice(i, html.indexOf('</div></div>', i));
};

test('a live row lists the stage agent in flight once and every other subagent', () => {
    const html = draw([base({ id: 'aaaaaaaa-1', inflight: { stage: 'build', at: NOW - 8 * 60000, agentId: 'stage-1' }, subagents: AGENTS })]);
    const b = block(html);
    assert.ok(b, 'the live-subagents block is drawn');
    assert.equal((b.match(/<div class="sa inflight">/g) || []).length, 1);
    assert.equal((b.match(/<div class="sa">/g) || []).length, 1, 'the stage agent is not listed again as a subagent');
    assert.match(b, /stage agent 1 個 · subagent 1 個/);
    assert.match(b, /fankeel:fankeel-implementer/);
    assert.match(b, /&lt;Task 2&gt;/, 'the description is escaped and loses its model prefix');
    assert.match(b, /<span class="sa-desc" title="[^"]*">&lt;Task 2&gt;<\/span>/, 'saShort cuts the title prefix from the visible text');
    assert.match(b, /class="sa-for">3m</);
});

test('an inflight mark for another stage is not a stage agent row', () => {
    const b = block(draw([base({ id: 'aaaaaaaa-1', inflight: { stage: 'survey', at: NOW, agentId: 'stage-1' }, subagents: AGENTS })]));
    assert.ok(!b.includes('sa inflight'));
    assert.equal((b.match(/<div class="sa">/g) || []).length, 2);
});

test('nothing running, a stale row, an unknown row and an ended row draw no subagent block', () => {
    assert.equal(block(draw([base({ id: 'aaaaaaaa-1', subagents: [] })])), null);
    assert.equal(block(draw([base({ id: 'bbbbbbbb-2', state: 'stale', updated: iso(300), subagents: AGENTS })])), null);
    assert.equal(block(draw([base({ id: 'cccccccc-3', unknown: true, subagents: AGENTS })])), null);
});

test('a row with subagents stays one link, the block sits beside it inside .sx-wsubs', () => {
    const html = draw([base({ id: 'aaaaaaaa-1', subagents: AGENTS.slice(1) })]);
    assert.match(html, /<div class="sx-wsubs"><a class="hm-lv sxr"[\s\S]*?<\/a><div class="lane-subs sx-subs" data-block="live-subagents">/);
});

test('EN: the subagent block carries no CJK, and every string has an EN key', () => {
    const b = block(draw([base({ id: 'aaaaaaaa-1', inflight: { stage: 'build', at: NOW - 60000, agentId: 'x' }, subagents: AGENTS.slice(1) })], 'en'));
    assert.ok(!/[\u3400-\u9fff]/.test(b), b);
    const { win } = page(['tip.js', 'live-page.js'], {});
    assert.deepEqual(stringsLeft('live-page.js', win.FK_LIVE.EN), []);
});
