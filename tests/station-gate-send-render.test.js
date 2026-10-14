'use strict';
// A poll redraw while a POST /answer is out draws the gate from
// `view.pg[<id>:send]`: buttons disabled while busy or after an ok, enabled
// after a failure, and the status line carrying the send's own text.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: true } };
const V = require('../assets/station/station.js');

const NOW = Date.UTC(2026, 8, 26, 1, 0, 0);
const one = [{ question: 'Q?', header: 'h', multiSelect: false, options: [{ label: 'A', description: '' }, { label: 'B', description: '' }] }];
const two = [one[0], { question: 'R?', header: 'r', multiSelect: false, options: [{ label: 'C', description: '' }] }];
const held = (questions) => ({ id: 's1', root: '/r', project: 'p', stage: 'build', task: 't', pending: { questions, at: NOW - 10000, until: NOW + 50000 } });
const all = { 's1:0': ['A'], 's1:1': ['C'] };

test('float: a busy send draws every option and the hand-off disabled, and the line reads its text', () => {
    const html = V.gateCountdownHtml(held(one), NOW, { 's1:send': { busy: true, cls: '', text: '送出中…' } });
    assert.match(html, /data-gop="0" disabled>/);
    assert.match(html, /data-gop="1" disabled>/);
    assert.match(html, /data-gho disabled>/);
    assert.match(html, /<p class="gend" role="status" aria-live="polite">送出中…<\/p>/);
});

test('float: an ok send stays disabled; a failed one is enabled with class gend bad', () => {
    assert.match(V.gateCountdownHtml(held(one), NOW, { 's1:send': { busy: false, cls: 'ok', text: '已送出：x' } }), /data-gop="0" disabled>/);
    const bad = V.gateCountdownHtml(held(one), NOW, { 's1:send': { busy: false, cls: 'bad', text: '還沒確認送到：可以再按一次' } });
    assert.match(bad, /data-gop="0">/);
    assert.match(bad, /<p class="gend bad" role="status" aria-live="polite">還沒確認送到：可以再按一次<\/p>/);
});

test('float: with no send the gate draws as before', () => {
    const html = V.gateCountdownHtml(held(one), NOW, {});
    assert.match(html, /data-gop="0">/);
    assert.match(html, /<p class="gend" role="status" aria-live="polite"><\/p>/);
});

test('form: a busy send disables 送出答案 even with every question answered', () => {
    const html = V.pendingGateHtml(held(two), Object.assign({ 's1:send': { busy: true, cls: '', text: '送出中…' } }, all));
    assert.match(html, /data-answer disabled>/);
    assert.match(html, /<div class="pgr" role="status" aria-live="polite">送出中…<\/div>/);
});

test('form: a failed send leaves 送出答案 enabled when every question is answered', () => {
    const html = V.pendingGateHtml(held(two), Object.assign({ 's1:send': { busy: false, cls: 'bad', text: 'x' } }, all));
    assert.match(html, /data-answer>/);
    assert.match(html, /<div class="pgr bad"/);
});
