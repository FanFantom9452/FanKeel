'use strict';
// The gate page's frame, /f/<id>/gate (assets/station/gate-frame.js; design
// 2026-10-21-station-redesign §5): a head with no tabs, the report station.js
// drew in the main column, the question in a sticky side column; an option
// shows its label, its description opens on click, number keys pick, and an
// open dialog or a focused field swallows the keys. Task 3's focusPageHtml
// calls frame() with { session, gate, tasks, reportHtml, shellsHtml }.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page, stringsLeft } = require('./station-module.js');

const SID = 'dddddddd-4444-4444-8444-444444444444';
const S = { id: SID, task: 'Gate frame', project: 'fankeel', pkey: 'F:\\ws/fankeel', state: 'live', stage: 'plan',
    route: ['survey', 'design', 'plan', 'build', 'land'], gateAt: Date.parse('2026-10-20T10:00:00.000Z') };
const GATE = { stage: 'plan', gate: { next: 'build the twelve tasks', questions: [{ question: 'Go to build?', header: 'plan', options: [
    { label: 'build (Recommended)', description: 'Approve the plan and start build.' },
    { label: 'rewrite', description: 'Send the plan back.' },
    { label: 'pause', description: '' }] }] } };
const REPORT = '<section class="panel pv gv gr" data-block="gate-report">REPORT</section>';
const SHELLS = '<section data-block="focus-shells">SHELLS</section>';
const boot = () => page(['gate-frame.js'], { sessions: [S] }).M['gate-frame.js'];
const args = (extra) => Object.assign({ session: S, gate: GATE, tasks: [], reportHtml: REPORT, shellsHtml: SHELLS }, extra);
// A key event; `inField` puts its target inside a text field, which only
// the frame's own field selector finds.
const FIELD = 'input,textarea,select,[contenteditable]';
const key = (k, o) => Object.assign({ key: k, target: { closest: (sel) => (o && o.inField && sel === FIELD ? {} : null) }, preventDefault() {} }, o && o.mods);
const quiet = { querySelector: () => null };
const dialogOpen = { querySelector: (sel) => (sel === 'dialog[open]' ? {} : null) };

test('the frame is the whole tab: head without tabs, the shells, then the report beside the question', () => {
    const html = boot().frame(args());
    assert.ok(html.startsWith('<main class="fm gt-frame" data-block="gate-frame">'));
    assert.ok(html.endsWith('</main>'));
    assert.ok(!html.includes('role="tablist"') && !html.includes('subtabs'), 'no tabs');
    assert.ok(html.includes('<a class="gh-link" href="/#/s/' + SID + '"'));
    assert.ok(html.indexOf('data-block="gate-head"') < html.indexOf(SHELLS));
    assert.ok(html.indexOf(SHELLS) < html.indexOf('data-block="gate-columns"'));
    assert.ok(html.indexOf('data-block="gate-main"') < html.indexOf(REPORT));
    assert.ok(html.indexOf(REPORT) < html.indexOf('data-block="gate-side"'));
    assert.ok(html.indexOf('data-block="gate-side"') < html.indexOf('data-block="gate-question"'));
    assert.ok(html.includes('<span class="of">3/5</span>'));
});

test('an option shows its label, the recommended one marked; every description starts open and a click closes it', () => {
    const G = boot();
    const html = G.frame(args());
    assert.match(html, /<li data-gq="1" class="is-rec is-open">[\s\S]*?<span class="gt-l">build<span class="gt-rec">建議<\/span><\/span>/);
    assert.ok(!html.includes('(Recommended)'));
    assert.ok(html.includes('<p class="gt-d" id="gq-d-1">Approve the plan and start build.</p>'));
    assert.ok(html.includes('<p class="gt-d" id="gq-d-2">Send the plan back.</p>'));
    assert.ok(html.includes('data-gq-more="1" aria-expanded="true"'));
    assert.ok(html.includes('data-gq-pick="3" aria-pressed="false">選這個<kbd>3</kbd>'));
    assert.ok(html.includes('<h2 class="gt-q">Go to build?</h2>'));
    assert.ok(html.includes('build the twelve tasks'));
    assert.ok(!html.includes('gq-opts') && !html.includes('class="gq-l"'), 'no station.css boxed-card classes');
    G.more(1);
    const shut = G.frame(args());
    assert.ok(shut.includes('<li data-gq="1" class="is-rec">'));
    assert.ok(shut.includes('id="gq-d-1" hidden'));
    assert.ok(shut.includes('id="gq-d-2">'), 'the others stay open');
    G.more(1);
    assert.ok(G.frame(args()).includes('<p class="gt-d" id="gq-d-1">Approve'));
});

test('a number key picks; the pick survives the repaint, names the label, and belongs to this session only', () => {
    const G = boot();
    G.frame(args());
    assert.equal(G.onKey(key('2'), quiet), true);
    const html = G.frame(args());
    assert.ok(html.includes('<li data-gq="2" class="on is-open">'));
    assert.ok(html.includes('data-gq-pick="2" aria-pressed="true"'));
    assert.ok(html.includes('你選了「rewrite」'));
    const other = G.frame(args({ session: Object.assign({}, S, { id: 'eeeeeeee-5555-4555-8555-555555555555' }) }));
    assert.ok(!other.includes('class="on'));
});

test('a key is swallowed by an open dialog, a focused field, a modifier, or a number past the options', () => {
    const G = boot();
    G.frame(args());
    assert.equal(G.pickable(key('1'), quiet), true);
    assert.equal(G.pickable(key('1'), dialogOpen), false);
    assert.equal(G.pickable(key('1', { inField: true }), quiet), false);
    assert.equal(G.pickable(key('1', { mods: { ctrlKey: true } }), quiet), false);
    assert.equal(G.onKey(key('1'), dialogOpen), false);
    assert.equal(G.onKey(key('4'), quiet), false);
    assert.equal(G.onKey(key('x'), quiet), false);
    assert.ok(!G.frame(args()).includes('class="on'));
});

test('without a question the frame says so, and the page never sends an answer', () => {
    const html = boot().frame(args({ gate: null, shellsHtml: '' }));
    assert.ok(html.includes('報告裡沒有讀得出的 gate 問題'));
    assert.ok(!html.includes('data-gq='));
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'gate-frame.js'), 'utf8');
    assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|sendBeacon/);
});

test('every string has English, and the frame has its rules in gate-frame.css', () => {
    assert.deepEqual(stringsLeft('gate-frame.js', boot().EN), []);
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'gate-frame.css'), 'utf8');
    for (const name of ['.gt-frame', '.gt-grid', '.gt-pin', 'position:sticky', '.gq-pick', '.gt-d', '.gt-more', 'prefers-reduced-motion']) assert.ok(css.includes(name), name);
});

// A document the frame listens on: its handlers by event type, one <li> per
// option with the parts paint() touches, the status line, and a dialog that
// can be open.
function fakeDoc(n) {
    const part = () => ({ attrs: {}, hidden: true, setAttribute(k, v) { this.attrs[k] = v; } });
    const lis = Array.from({ length: n }, (_, i) => {
        const cls = new Set(), parts = { '[data-gq-more]': part(), '.gt-d': part(), '[data-gq-pick]': part() };
        return { cls, parts, getAttribute: (a) => (a === 'data-gq' ? String(i + 1) : null),
            classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) }, querySelector: (sel) => parts[sel] || null };
    });
    const D = { lis, on: {}, dialog: false, line: { textContent: '' } };
    D.addEventListener = (type, fn) => { D.on[type] = fn; };
    D.querySelectorAll = (sel) => (sel === '[data-gq]' ? lis : []);
    D.querySelector = (sel) => (sel === 'dialog[open]' && D.dialog ? {} : null);
    D.getElementById = (id) => (id === 'gq-line' ? D.line : null);
    return D;
}
// A click target inside the button `sel` names, for option n.
const inside = (sel, n) => ({ closest: (s) => (s === sel ? { getAttribute: (a) => (a === sel.slice(1, -1) ? String(n) : null) } : null) });
const listening = () => { const G = boot(), D = fakeDoc(3); G.listen(D); G.frame(args()); return { G, D }; };

test('a click on an option label closes its open description in place, and a second click opens it again', () => {
    const { D } = listening();
    D.on.click({ target: inside('[data-gq-more]', 1) });
    const li = D.lis[0];
    assert.ok(!li.cls.has('is-open'));
    assert.equal(li.parts['[data-gq-more]'].attrs['aria-expanded'], 'false');
    assert.equal(li.parts['.gt-d'].hidden, true);
    D.on.click({ target: inside('[data-gq-more]', 1) });
    assert.ok(li.cls.has('is-open'));
    assert.equal(li.parts['.gt-d'].hidden, false);
    assert.equal(li.parts['[data-gq-more]'].attrs['aria-expanded'], 'true');
});

test('a click on Pick this marks that option in place and names it on the status line', () => {
    const { D } = listening();
    D.on.click({ target: inside('[data-gq-pick]', 2) });
    assert.ok(D.lis[1].cls.has('on'));
    assert.equal(D.lis[1].parts['[data-gq-pick]'].attrs['aria-pressed'], 'true');
    assert.ok(!D.lis[0].cls.has('on'));
    assert.ok(D.line.textContent.includes('你選了「rewrite」'));
    assert.doesNotThrow(() => D.on.click({ target: {} }));
});

test('a number key on the document picks, unless a field has focus or a dialog is open', () => {
    const field = listening();
    field.D.on.keydown(key('2', { inField: true }));
    assert.ok(!field.D.lis[1].cls.has('on'), 'a key typed in a field is not a pick');
    const dialog = listening();
    dialog.D.dialog = true;
    dialog.D.on.keydown(key('2'));
    assert.ok(!dialog.D.lis[1].cls.has('on'), 'a key under an open dialog is not a pick');
    const { D } = listening();
    D.on.keydown(key('3'));
    assert.ok(D.lis[2].cls.has('on'));
    assert.ok(D.line.textContent.includes('你選了「pause」'));
});

test('a new gate in the same session starts with no pick; the same gate keeps it', () => {
    const G = boot();
    G.frame(args());
    G.pick(2);
    const asked = (q, stage) => ({ stage, gate: Object.assign({}, GATE.gate, { questions: [Object.assign({}, GATE.gate.questions[0], { question: q })] }) });
    assert.ok(!G.frame(args({ gate: asked('Go to land?', 'plan') })).includes('class="on'), 'new question');
    assert.ok(!G.frame(args({ gate: asked('Go to build?', 'build') })).includes('class="on'), 'new stage');
    assert.ok(G.frame(args()).includes('<li data-gq="2" class="on is-open">'));
});

test('the options render no further than the nine a number key can pick', () => {
    const options = Array.from({ length: 11 }, (_, i) => ({ label: 'o' + (i + 1), description: '' }));
    const html = boot().frame(args({ gate: { stage: 'plan', gate: { questions: [{ question: 'Which?', options }] } } }));
    assert.ok(html.includes('data-gq="9"'));
    assert.ok(!html.includes('data-gq="10"'));
});
