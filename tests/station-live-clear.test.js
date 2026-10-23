'use strict';
// 可能停了 on the served #/live page (assets/station/live-page.js): each stale
// row has its own clear control from opts.clear, beside the row's <a>, never in it.
const test = require('node:test');
const assert = require('node:assert/strict');
const { page } = require('./station-module.js');

const NOW = Date.parse('2026-10-22T09:00:00.000Z');
const iso = (minAgo) => new Date(NOW - minAgo * 60000).toISOString();
const base = (o) => Object.assign({ root: 'F:\\w', project: 'app', pkey: 'F:\\w/app', route: ['survey', 'build'], stage: 'build', state: 'stale',
    started: iso(400), updated: iso(300), usd: 1, agentUsd: 0, model: 'claude-opus-4-1', gateAt: null, stages: [], days: null }, o);
const clear = (s) => (s.state === 'stale' ? '<form class="clearform"><input name="id" value="' + s.id + '"></form>' : '');
const draw = (sessions, o) => {
    const { win } = page(['tip.js', 'live-page.js'], {});
    return win.FK_LIVE.page({ sessions }, Object.assign({ names: {}, now: NOW }, o));
};
const stopCard = (html) => html.slice(html.indexOf('data-block="live-stop"'));

test('a stale row carries its clear control beside the link, not inside it', () => {
    const html = stopCard(draw([base({ id: 'aaaaaaaa-0001', task: 'Stale one' })], { clear }));
    const m = /<div class="lv-row"><a class="hm-lv sxr gone"(.*?)<\/a><div class="lv-row-clear"><form class="clearform">/.exec(html);
    assert.ok(m, html);
    assert.ok(!m[1].includes('clearform'));
});

test('a live row has no clear wrapper', () => {
    const html = draw([base({ id: 'bbbbbbbb-0002', task: 'Run', state: 'live' })], { clear });
    assert.ok(!html.includes('lv-row'));
    assert.ok(!html.includes('clearform'));
});

test('a folded unnamed stale row has its own clear control', () => {
    const html = stopCard(draw([base({ id: 'cccccccc-0003', task: null }), base({ id: 'dddddddd-0004', task: null })], { clear }));
    const at = html.indexOf('class="sx-sub"');
    assert.equal(html.slice(at).split('class="lv-row-clear"').length - 1, 2);
    assert.ok(!html.slice(0, at).includes('clearform'));
});

test('without opts.clear the row is the bare link', () => {
    const html = draw([base({ id: 'eeeeeeee-0005', task: 'Stale' })]);
    assert.ok(!html.includes('lv-row'));
    assert.ok(html.includes('<div class="dlist"><a class="hm-lv sxr gone"'));
});
