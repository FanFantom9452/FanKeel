'use strict';
// The gate page's free-text answer (Claude Desktop's AskUserQuestion always
// allows "Other"): a field and a send button under the options, offered only
// when the page was handed an `answer`; what is typed survives the repaint;
// sending hands the text to the page's `send`; gate-frame itself never fetches.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page, stringsLeft } = require('./station-module.js');

const SID = 'dddddddd-4444-4444-8444-444444444444';
const S = { id: SID, task: 'Gate free', project: 'fankeel', state: 'live', stage: 'plan', route: ['survey', 'plan', 'build', 'land'] };
const GATE = { stage: 'plan', gate: { questions: [{ question: 'Go to build?', header: 'plan', options: [{ label: 'build', description: 'd' }] }] } };
const boot = () => page(['gate-frame.js'], { sessions: [S] }).M['gate-frame.js'];
const asked = (sent) => ({ question: 'Go to build?', send: (t) => sent.push(t) });
const args = (answer) => ({ session: S, gate: GATE, tasks: [], reportHtml: '', shellsHtml: '', answer });

test('no answer, no field: the side column is unchanged', () => {
    const html = boot().frame(args(null));
    assert.ok(!html.includes('data-gq-free') && !html.includes('data-gq-send'));
});

test('an answer draws the field and the send button under the options', () => {
    const html = boot().frame(args(asked([])));
    assert.match(html, /<form class="gt-free" data-block="gate-free"[\s\S]*<textarea id="gq-free" class="gt-free-t" data-gq-free rows="3"[^>]*><\/textarea>/);
    assert.ok(html.includes('data-gq-send'));
    assert.ok(html.indexOf('class="gt-opts"') < html.indexOf('data-block="gate-free"'));
    assert.ok(html.includes('id="gq-sent"'));
});

function fakeDoc(value) {
    const D = { on: {}, box: { value } };
    D.addEventListener = (type, fn) => { D.on[type] = fn; };
    D.querySelectorAll = () => [];
    D.querySelector = (sel) => (sel === '[data-gq-free]' ? D.box : null);
    D.getElementById = () => null;
    return D;
}
const inside = (sel, el) => ({ closest: (s) => (s === sel ? el || {} : null) });

test('typed text survives the repaint, and belongs to this gate only', () => {
    const G = boot(), D = fakeDoc('');
    G.listen(D);
    G.frame(args(asked([])));
    D.on.input({ target: inside('[data-gq-free]', { value: 'my own answer' }) });
    assert.ok(G.frame(args(asked([]))).includes('>my own answer</textarea>'));
    const other = Object.assign({}, GATE, { gate: { questions: [{ question: 'Another?', options: [] }] } });
    assert.ok(!G.frame(Object.assign(args(asked([])), { gate: other })).includes('my own answer'));
});

test('send hands the trimmed text to the page, and an empty field sends nothing', () => {
    const G = boot(), D = fakeDoc('  hello  '), sent = [];
    G.listen(D);
    G.frame(args(asked(sent)));
    D.on.click({ target: inside('[data-gq-send]') });
    assert.deepEqual(sent, ['hello']);
    D.box.value = '   ';
    D.on.click({ target: inside('[data-gq-send]') });
    assert.deepEqual(sent, ['hello']);
});

test('say() keeps the sent line through a repaint, and a refusal gives the button back', () => {
    const G = boot();
    G.frame(args(asked([])));
    G.say('ok', 'answered 1 question');
    const html = G.frame(args(asked([])));
    assert.ok(html.includes('id="gq-sent" class="gt-sent ok"'));
    assert.ok(html.includes('已送出：answered 1 question'));
    assert.match(html, /data-gq-send disabled/);
    G.say('bad', '409 - no gate is waiting');
    const again = G.frame(args(asked([])));
    assert.ok(!/data-gq-send disabled/.test(again));
    assert.ok(again.includes('送不出去：409 - no gate is waiting'));
});

test('the page text has English, the CSS has the rules, and gate-frame still never fetches', () => {
    assert.deepEqual(stringsLeft('gate-frame.js', boot().EN), []);
    const dir = path.join(__dirname, '..', 'assets', 'station');
    const css = fs.readFileSync(path.join(dir, 'gate-frame.css'), 'utf8');
    for (const name of ['.gt-free', '.gt-free-t', '.gt-sent']) assert.ok(css.includes(name), name);
    assert.doesNotMatch(fs.readFileSync(path.join(dir, 'gate-frame.js'), 'utf8'), /fetch\(|XMLHttpRequest|sendBeacon/);
});

const PICKG = { stage: 'plan', gate: { questions: [{ question: 'Go to build?', header: 'plan', options: [{ label: 'build (Recommended)', description: 'd' }, { label: 'wait' }] }] } };
const pargs = (answer) => Object.assign(args(answer), { gate: PICKG });

test('with an answer, pick(n) sends the raw label, suffix kept, and the hint says so', () => {
    const G = boot(), sent = [];
    G.frame(pargs(asked(sent)));
    assert.equal(G.pick(1), true);
    assert.deepEqual(sent, ['build (Recommended)']);
    assert.match(G.frame(pargs(asked(sent))), /data-gq-pick="2"[^>]*disabled/);
    assert.ok(G.frame(pargs(asked(sent))).includes('已當成答案送出'));
});

test('with an answer, the click on 選這個 and the key send that option once; a second pick posts nothing', () => {
    const G = boot(), D = fakeDoc(''), sent = [];
    G.listen(D);
    G.frame(pargs(asked(sent)));
    D.on.click({ target: inside('[data-gq-pick]', { getAttribute: () => '2' }) });
    assert.deepEqual(sent, ['wait']);
    G.say('ok', 'answered');
    D.on.keydown({ key: '1', target: {} });
    G.pick(1);
    assert.deepEqual(sent, ['wait']);
});

test('a failed send lets the reader pick again', () => {
    const G = boot(), sent = [];
    G.frame(pargs(asked(sent)));
    G.pick(2);
    G.say('bad', '409');
    G.pick(1);
    assert.deepEqual(sent, ['wait', 'build (Recommended)']);
});

test('the key sends the option label', () => {
    const G = boot(), D = fakeDoc(''), sent = [];
    G.listen(D);
    G.frame(pargs(asked(sent)));
    D.on.keydown({ key: '1', target: {} });
    assert.deepEqual(sent, ['build (Recommended)']);
});

test('without an answer a pick only marks: nothing is sent and the Desktop line stays', () => {
    const G = boot();
    const html0 = G.frame(pargs(null));
    assert.ok(html0.includes('Claude Desktop'));
    assert.equal(G.pick(1), true);
    const html = G.frame(pargs(null));
    assert.ok(html.includes('你選了「build」，到 Claude Desktop 回答'));
});
