'use strict';
// The gate page once the gate is answered: no side column, one column. And the free answer's mic.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page } = require('./station-module.js');

const SID = 'dddddddd-4444-4444-8444-444444444444';
const S = { id: SID, task: 'Gate one', project: 'fankeel', state: 'live', stage: 'plan', route: ['survey', 'plan', 'build', 'land'] };
const GATE = { stage: 'plan', gate: { questions: [{ question: 'Go to build?', header: 'plan', options: [{ label: 'build', description: 'd' }] }] } };
const boot = (extra) => { const p = page(['gate-frame.js'], { sessions: [S] }); Object.assign(p.win, extra); return p.M['gate-frame.js']; };
const args = (session, answer) => ({ session, gate: GATE, tasks: [], reportHtml: '<p>R</p>', shellsHtml: '', answer });
const asked = { question: 'Go to build?', send() {} };

test('a session with neither gateAt nor pending draws one column and no side', () => {
    const html = boot().frame(args(S, null));
    assert.doesNotMatch(html, /gt-side/);
    assert.doesNotMatch(html, /data-block="gate-question"/);
    assert.match(html, /<div class="gt-grid gt-one" data-block="gate-columns">/);
});

test('gateAt, or a pending gate, keeps the side column', () => {
    const waiting = boot().frame(args(Object.assign({}, S, { gateAt: 1 }), null));
    assert.match(waiting, /<aside class="gt-side"/);
    assert.doesNotMatch(waiting, /gt-one/);
    assert.match(boot().frame(args(Object.assign({}, S, { pending: { questions: [] } }), null)), /<aside class="gt-side"/);
});

test('the free answer has a mic only where SpeechRecognition exists', () => {
    const held = Object.assign({}, S, { gateAt: 1 });
    assert.doesNotMatch(boot().frame(args(held, asked)), /data-gq-mic/);
    const html = boot({ SpeechRecognition: function () {} }).frame(args(held, asked));
    assert.match(html, /<div class="gfrow"><textarea id="gq-free"/);
    assert.match(html, /<button type="button" class="gmic" data-gq-mic aria-pressed="false"/);
    assert.match(html, /<p class="gsay" id="gq-say" role="status">/);
});

test('the mic button starts listening, fills the box without sending, and a second press stops', () => {
    const recs = [], sent = [];
    function SR() { this.calls = []; this.start = () => this.calls.push('start'); this.stop = () => this.calls.push('stop'); recs.push(this); }
    const G = boot({ SpeechRecognition: SR });
    const box = { value: 'so', classList: { toggle() {} }, dispatchEvent() {} };
    const D = { on: {}, addEventListener: (t, fn) => { D.on[t] = fn; }, querySelectorAll: () => [], getElementById: () => null, querySelector: (s) => (s === '[data-gq-free]' ? box : null) };
    G.listen(D);
    G.frame(args(Object.assign({}, S, { gateAt: 1 }), { question: 'Go to build?', send: (t) => sent.push(t) }));
    const mic = { closest: (s) => (s === '[data-gq-mic]' ? {} : null) };
    D.on.click({ target: mic });
    assert.deepEqual(recs[0].calls, ['start']);
    recs[0].onresult({ results: [Object.assign([{ transcript: 'hello' }], { isFinal: true }), Object.assign([{ transcript: ' there' }], { isFinal: false })] });
    assert.equal(box.value, 'so hello there');
    assert.deepEqual(sent, []);
    D.on.click({ target: mic });
    assert.deepEqual(recs[0].calls, ['start', 'stop']);
    assert.equal(recs.length, 1);
});

test('gate-frame.css gives the single column and the gate page mic their rules', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'gate-frame.css'), 'utf8');
    assert.match(css, /\.gt-grid\.gt-one\{grid-template-columns:minmax\(0,1fr\)\}/);
    assert.match(css, /\.gt-free \.gfrow \.gmic\{width:40px;height:40px\}/);
});
