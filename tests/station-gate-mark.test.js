'use strict';
// Marking nodes of a gate page's mermaid diagram writes one line, "標記：…",
// into the free-answer field (assets/station/gate-frame.js `mark`, `diagrams`):
// the reader's own words stay, an empty list removes the line, and the marks
// and the field survive the focus page's 5 s repaint.
const test = require('node:test');
const assert = require('node:assert/strict');
const { page, stringsLeft } = require('./station-module.js');

const SID = 'dddddddd-4444-4444-8444-444444444444';
const S = { id: SID, task: 'Gate mark', project: 'fankeel', state: 'live', stage: 'plan', route: ['survey', 'plan', 'build', 'land'] };
const GATE = { stage: 'plan', gate: { questions: [{ question: 'Go to build?', header: 'plan', options: [{ label: 'build', description: 'd' }] }] } };
const args = () => ({ session: S, gate: GATE, tasks: [], reportHtml: '', shellsHtml: '', answer: { question: 'Go to build?', send() {} } });
const A = { id: 'A', label: 'Start' }, B = { id: 'B', label: 'Done' };

function setup(value, lang) {
    const p = page(['gate-frame.js'], { sessions: [S] });
    if (lang) p.win.FK_I18N = { lang };
    const G = p.M['gate-frame.js'], D = { box: { value } };
    D.on = {};
    D.addEventListener = (t, f) => { D.on[t] = f; };
    D.querySelectorAll = () => [];
    D.querySelector = (sel) => (sel === '[data-gq-free]' ? D.box : null);
    D.getElementById = () => null;
    const draws = [];
    p.win.FK_DIAGRAM = { draw: (root, o) => draws.push({ root, o }) };
    G.listen(D);
    G.frame(args());
    return { G, D, draws, win: p.win };
}

test('marking two nodes writes one 標記 line after the reader\'s own text; unmarking one keeps the other; none removes the line', () => {
    const { G, D } = setup('my words');
    G.mark([A, B]);
    assert.equal(D.box.value, 'my words\n標記：A「Start」、B「Done」');
    G.mark([B]);
    assert.equal(D.box.value, 'my words\n標記：B「Done」');
    G.mark([]);
    assert.equal(D.box.value, 'my words');
});

test('mark touches only its own line: text typed around it stays, and an English page writes "Marked: "', () => {
    const { G, D } = setup('before\n標記：Z「old」\nafter');
    G.mark([A]);
    assert.equal(D.box.value, 'before\n標記：A「Start」\nafter');
    const en = setup('x', 'en');
    en.G.mark([A]);
    assert.equal(en.D.box.value, 'x\nMarked: A「Start」');
});

test('an empty field gets just the line', () => {
    const { G, D } = setup('');
    G.mark([A]);
    assert.equal(D.box.value, '標記：A「Start」');
});

test('diagrams draws with marks on, the ids already marked, and onMark wired; the repaint keeps both the line and the marks', () => {
    const { G, D, draws } = setup('hi');
    const root = {};
    G.diagrams(root);
    assert.equal(draws[0].root, root);
    assert.equal(draws[0].o.mark, true);
    assert.deepEqual([...draws[0].o.marked], []);
    draws[0].o.onMark([{ fig: 0, ...A }, { fig: 0, ...B }]);
    assert.equal(D.box.value, 'hi\n標記：A「Start」、B「Done」');
    const html = G.frame(args());
    assert.ok(html.includes('>hi\n標記：A「Start」、B「Done」</textarea>'), 'the repaint draws the field from STATE');
    G.diagrams(root);
    assert.deepEqual(JSON.parse(JSON.stringify(draws[1].o.marked)), [{ fig: 0, id: 'A' }, { fig: 0, id: 'B' }]);
});

test('gate-frame.js still has English for every Chinese string it shows', () => {
    const { G } = setup('');
    assert.deepEqual(stringsLeft('gate-frame.js', G.EN), []);
});

test('deleting the 標記 line by hand clears the marks, so the next repaint draws none; editing around it keeps them', () => {
    const { G, D, draws } = setup('hi');
    D.box.closest = () => D.box;
    G.diagrams({});
    draws[0].o.onMark([{ fig: 0, ...A }]);
    D.box.value += ' more';
    D.on.input({ target: D.box });
    G.diagrams({});
    assert.deepEqual(JSON.parse(JSON.stringify(draws[1].o.marked)), [{ fig: 0, id: 'A' }]);
    D.box.value = 'hi';
    D.on.input({ target: D.box });
    G.diagrams({});
    assert.deepEqual([...draws[2].o.marked], []);
});
