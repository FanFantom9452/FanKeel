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
// A key event; `inField` puts its target inside a text field.
const key = (k, o) => Object.assign({ key: k, target: { closest: () => (o && o.inField ? {} : null) }, preventDefault() {} }, o && o.mods);
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

test('an option shows its label, the recommended one marked; its description is hidden until opened', () => {
    const G = boot();
    const html = G.frame(args());
    assert.match(html, /<li data-gq="1" class="is-rec">[\s\S]*?<span class="gt-l">build<span class="gt-rec">建議<\/span><\/span>/);
    assert.ok(!html.includes('(Recommended)'));
    assert.ok(html.includes('<p class="gt-d" id="gq-d-1" hidden>Approve the plan and start build.</p>'));
    assert.ok(html.includes('data-gq-pick="3" aria-pressed="false">選這個<kbd>3</kbd>'));
    assert.ok(html.includes('<h2 class="gt-q">Go to build?</h2>'));
    assert.ok(html.includes('build the twelve tasks'));
    G.more(1);
    const open = G.frame(args());
    assert.ok(open.includes('<li data-gq="1" class="is-rec is-open">'));
    assert.ok(open.includes('<p class="gt-d" id="gq-d-1">Approve the plan'));
    G.more(1);
    assert.ok(G.frame(args()).includes('id="gq-d-1" hidden'));
});

test('a number key picks; the pick survives the repaint, names the label, and belongs to this session only', () => {
    const G = boot();
    G.frame(args());
    assert.equal(G.onKey(key('2'), quiet), true);
    const html = G.frame(args());
    assert.ok(html.includes('<li data-gq="2" class="on">'));
    assert.ok(html.includes('data-gq-pick="2" aria-pressed="true"'));
    assert.ok(html.includes('你選了「rewrite」'));
    const other = G.frame(args({ session: Object.assign({}, S, { id: 'eeeeeeee-5555-4555-8555-555555555555' }) }));
    assert.ok(!other.includes('class="on"'));
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
    assert.ok(!G.frame(args()).includes('class="on"'));
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
    for (const name of ['.gt-frame', '.gt-grid', '.gt-pin', 'position:sticky', '.gq-pick', '.gt-d', '.gq-l', 'prefers-reduced-motion']) assert.ok(css.includes(name), name);
});
