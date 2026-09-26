'use strict';
// The floating icon (docs/plans/2026-09-26-ready-five-design.md §3-§4): one
// place for notifications and held gates, replacing the toasts, the tune
// chip and the session page's own held-gate form.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = { STATION: { serve: true } };
const V = require('../assets/station/station.js');

const Q1 = [{ question: '往 plan 走嗎？', header: 'mockup', multiSelect: false, options: [
    { label: '可以', description: 'a' }, { label: '改一個 block', description: 'b' }, { label: '整個重畫', description: 'c' }] }];
const NOW = Date.UTC(2026, 8, 26, 1, 0, 0);
const held = (questions, left) => ({ id: 's1', root: '/r', project: 'fankeel', stage: 'design', task: 'Ready 五條',
    pending: { questions, at: NOW - (60 - left) * 1000, until: NOW + left * 1000 } });

test('a held single-choice gate is its options as buttons, a countdown, and 交給終端／手機', () => {
    const html = V.floatHtml([held(Q1, 44)], [], false, NOW, {}, 'granted');
    assert.match(html, /data-block="gate-countdown"/);
    for (let i = 0; i < 3; i++) assert.match(html, new RegExp('data-gop="' + i + '"'));
    assert.match(html, /<span class="gsec">0:44<\/span>/);
    assert.match(html, /style="width:73\.3%"/);
    assert.match(html, /data-gho>交給終端／手機</);
    assert.match(html, /<span class="fkn">1<\/span>/);
    assert.match(html, /aria-label="通知與 gate：1 件，1 個 gate 在等"/);
});

test('a gate of two questions, or a multi-select one, keeps the full form inside the panel', () => {
    const two = [Q1[0], { question: '哪些？', header: '範圍', multiSelect: true, options: [{ label: 'a', description: '' }, { label: 'b', description: '' }] }];
    const html = V.floatHtml([held(two, 30)], [], false, NOW, {}, 'granted');
    assert.match(html, /data-block="pending-gate"/);
    assert.doesNotMatch(html, /data-gop=/);
    assert.match(html, /data-gho/);
});

test('settled tune requests and a block being edited are notes; with nothing, the panel says so and the badge is empty', () => {
    const s = { id: 's2', root: '/r', tune: { open: 1, done: 3, rejected: 0, url: 'http://127.0.0.1:7819/',
        items: [{ id: 'r-0004', block: 'wizard-steps', status: 'taken' }] } };
    const html = V.floatHtml([s], [{ id: 'r-0003', block: 'dash-live', status: 'done' }], true, NOW, {}, 'default');
    assert.match(html, /class="nt edit"[\s\S]*編輯中：<code>wizard-steps<\/code>/);
    assert.match(html, /class="nt done"[\s\S]*已修改完成：<code>dash-live<\/code>/);
    assert.match(html, /tune 完成 <b>3<\/b>/);
    assert.match(html, />127\.0\.0\.1:7819</);
    assert.match(html, /data-tune-notify/);
    assert.match(html, /<span class="fkn">2<\/span>/);
    const none = V.floatHtml([], [], false, NOW, {}, 'granted');
    assert.match(none, /沒有新通知/);
    assert.match(none, /<span class="fkn"><\/span>/);
});

test('clock says m:ss, floatNotes puts what tune is editing before the settled notes, and a gate with no at counts down from 60 s', () => {
    assert.equal(V.clock(65), '1:05');
    assert.equal(V.clock(0), '0:00');
    const s = { tune: { items: [{ id: 'r-2', block: 'b2', status: 'taken' }, { id: 'r-1', block: 'b1', status: 'queued' }] } };
    assert.deepEqual(V.floatNotes([s], [{ id: 'r-0', block: 'b0', status: 'done' }]),
        [{ id: 'r-2', block: 'b2', status: 'edit' }, { id: 'r-0', block: 'b0', status: 'done' }]);
    const g = held(Q1, 30);
    g.pending.at = null;
    const html = V.gateCountdownHtml(g, NOW, {});
    assert.match(html, /data-total="60"/);
    assert.match(html, /style="width:50\.0%"/);
});

test('the page has one floating icon and no toast box, tune chip or session-page gate form left', () => {
    const page = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'index.html'), 'utf8');
    assert.match(page, /<div class="fk" id="fk" data-block="float-icon"><\/div>/);
    assert.doesNotMatch(page, /id="toasts"|id="tunechip"/);
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
    assert.doesNotMatch(src, /\+ pendingGateHtml\(s, view\.pg\)/, 'the session page still draws its own held gate');
    assert.equal(V.toastHtml, undefined);
    assert.equal(V.tuneChipHtml, undefined);
});
