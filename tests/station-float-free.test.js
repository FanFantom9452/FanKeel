'use strict';
// A held single-choice gate in the notification panel also takes a free answer, with a mic where the
// browser has SpeechRecognition, and the panel carries the drag bar and close button the phone sheet uses.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: true } };
const V = require('../assets/station/station.js');

const NOW = Date.UTC(2026, 8, 26, 1, 0, 0);
const one = [{ question: 'Q?', header: 'h', multiSelect: false, options: [{ label: 'A', description: '' }, { label: 'B', description: '' }] }];
const two = [one[0], { question: 'R?', header: 'r', multiSelect: false, options: [{ label: 'C', description: '' }] }];
const held = (questions) => ({ id: 's1', root: '/r', project: 'p', stage: 'build', task: 't', pending: { questions, at: NOW - 10000, until: NOW + 50000 } });

test('a single-choice held gate draws a free-text box and a send button under its options', () => {
    const html = V.gateCountdownHtml(held(one), NOW, {});
    assert.match(html, /<div class="gfree" data-block="gate-free">/);
    assert.match(html, /<textarea id="gfree-s1" data-gfree="s1"/);
    assert.match(html, /<button type="button" class="gfs" data-gfs disabled>/);
    assert.ok(html.indexOf('data-gop="1"') < html.indexOf('data-gfree="s1"'), 'the box sits after the options');
});

test('no mic button without SpeechRecognition; with it, a data-mic button for the box', () => {
    delete global.window.SpeechRecognition;
    assert.doesNotMatch(V.gateCountdownHtml(held(one), NOW, {}), /data-mic/);
    global.window.SpeechRecognition = function () {};
    try {
        const html = V.gateCountdownHtml(held(one), NOW, {});
        assert.match(html, /<button type="button" class="gmic" data-mic="gfree-s1" aria-pressed="false"/);
        assert.match(html, /<p class="gsay" role="status">/);
    } finally {
        delete global.window.SpeechRecognition;
    }
});

test('a draft kept in view.pg comes back in the box and enables the send button', () => {
    const html = V.gateCountdownHtml(held(one), NOW, { 's1:free': '我要的答案' });
    assert.match(html, /<textarea id="gfree-s1" data-gfree="s1"[^>]*>我要的答案<\/textarea>/);
    assert.match(html, /data-gfs>/);
});

test('a send in flight disables the send button; a two-question gate keeps the full form with no free box', () => {
    const busy = V.gateCountdownHtml(held(one), NOW, { 's1:free': 'x', 's1:send': { gate: NOW + 50000, busy: true, cls: 'wait', text: '送出中…' } });
    assert.match(busy, /data-gfs disabled>/);
    assert.doesNotMatch(V.gateCountdownHtml(held(two), NOW, {}), /data-gfree/);
});

test('the panel carries the drag bar and a close button for the phone sheet', () => {
    const html = V.floatHtml([held(one)], [], false, NOW, {}, 'granted');
    assert.match(html, /<div class="fkg" aria-hidden="true" data-fkg><i><\/i><\/div>/);
    assert.match(html, /<button type="button" class="fkx" data-fkx aria-label="關閉通知與 gate">/);
});

test('a held gate keeps the panel open unless it was shut, and a shut panel is hidden', () => {
    assert.doesNotMatch(V.floatHtml([held(one)], [], false, NOW, {}, 'granted'), /id="fkp"[^>]* hidden/);
    assert.match(V.floatHtml([held(one)], [], false, NOW, { 'fk:shut': true }, 'granted'), /id="fkp"[^>]* hidden/);
    assert.match(V.floatHtml([held(one)], [], true, NOW, { 'fk:shut': true }, 'granted'), /aria-expanded="true"/);
});
