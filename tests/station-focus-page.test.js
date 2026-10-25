'use strict';
// The focus page as station.js draws it (docs/90-agent/plans/2026-10-21-station-focus-design.md §1,
// mockup .fankeel/build/2026-10-21-station-focus/mockup.html): a slim header,
// every task of the plan in its group, and the gate's question above its
// report. The last test is the design's done line, end to end.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const { page } = require('./station-module.js');
const F = page(['focus-page.js'], {}).M['focus-page.js'];
const detail = require('../lib/detail.js');
const plantasks = require('../lib/plantasks.js');
const registry = require('../lib/registry.js');
const { parseReport, derive } = require('../lib/gatereport.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const SID = 'efefefef-9999-4999-8999-999999999999';
const REAL = path.join(__dirname, '..', 'docs', '99-archive', '2026-10-18-deny-posix-helpers.md');
const TASKS = plantasks.parseTasks(fs.readFileSync(REAL, 'utf8')).length;
const count = (s, re) => (s.match(re) || []).length;
const ROW = { id: SID, task: 'focus page', stage: 'plan', route: ['survey', 'plan', 'build', 'verify', 'land'], state: 'live', step: 2, steps: 5 };

function claimed(root) {
    fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
    fs.copyFileSync(REAL, path.join(root, 'docs', 'plans', 'x.md'));
    return detail.tasksOf(root, { claims: ['docs/plans/x.md'] }, []);
}

test('plan: the header, then every task of the plan once, in its group, with its ledger state', () => {
    const tasks = claimed(tmp('fankeel-focus-page-'));
    const html = F.page({ sessions: [ROW] }, { [SID]: { tasks, gate: null } }, { id: SID, tab: 'plan' });
    assert.match(html, /^<header class="fh" data-block="focus-header">/);
    assert.ok(html.includes('href="/#/s/' + SID + '/plan"'), 'the full-station link');
    for (const b of ['plan-summary', 'plan-list']) assert.match(html, new RegExp('data-block="' + b + '"'), b);
    assert.equal(count(html, /<li class="fp-row/g), TASKS);
    assert.equal(count(html, /data-block="plan-g\d+"/g), tasks[0].groups.length);
    assert.equal(count(html, /<span class="pill sm pend">/g), TASKS, 'no ledger: every task says so');
    assert.doesNotMatch(html, /data-block="(nav|mast|dash)/);
});

test('gate: the question and its options come first, the recommended one marked, the report under them', () => {
    const g = { stage: 'survey', path: '.fankeel/build/task-20261021T100000/survey.md', text: 'what is here\n',
        gate: { questions: [{ header: 'Survey', question: 'Go on to design?', multiSelect: false,
            options: [{ label: 'Design next (Recommended)', description: 'the route goes on' }, { label: 'Stop here', description: 'stand down' }] }], next: 'design' },
        parts: derive('survey', parseReport('survey', 'what is here\n')) };
    const html = F.page({ sessions: [Object.assign({}, ROW, { stage: 'survey' })] }, { [SID]: { tasks: [], gate: g } }, { id: SID, tab: 'gate' });
    const q = html.indexOf('data-block="gate-question"');
    const r = html.indexOf('data-block="gate-report"');
    assert.ok(q > 0 && r > q, 'question before report');
    assert.ok(html.includes('Go on to design?'));
    assert.equal(count(html, /<span class="gq-n num">/g), 2);
    assert.equal(count(html, /<li class="is-rec">/g), 1);
    assert.ok(html.includes('Design next<span class="gq-rec">'), 'the (Recommended) suffix becomes the mark');
    assert.ok(html.includes('.fankeel/build/task-20261021T100000/survey.md'), 'the report names its file');
});

test('an id the payload does not hold says so, and a session with no gate report says that', () => {
    assert.match(F.page({ sessions: [] }, {}, { id: 'nope', tab: 'plan' }), /class="note"/);
    const none = F.page({ sessions: [Object.assign({}, ROW, { stage: 'design' })] }, { [SID]: { tasks: [], gate: { error: 'none', stage: 'design', path: 'x/design.md' } } }, { id: SID, tab: 'gate' });
    assert.match(none, /data-block="gate-question"/);
    assert.match(none, /class="pv-empty"/);
});

test('background shells sit between the header and the page', () => {
    const shells = [{ id: 'bg1', state: 'running', command: 'node scripts/suite.js', startedAt: new Date().toISOString(), code: null }];
    const html = F.page({ sessions: [ROW] }, { [SID]: { tasks: [], gate: null, shells } }, { id: SID, tab: 'plan' });
    const h = html.indexOf('</header>');
    const sh = html.indexOf('data-block="s-shells"');
    const m = html.indexOf('<main class="fm"');
    assert.ok(h > 0 && sh > h && m > sh, 'header, shells, main');
    assert.ok(html.includes('node scripts/suite.js'));
});

// station.js loaded as the focus shell loads it: STATION_FOCUS set, one
// session's row and detail, a #focus to draw into.
function focusDom() {
    const asked = [], heads = [], ticks = [], listened = [], waits = [];
    const cls = new Set();
    const clicks = [];
    const focus = { innerHTML: '', addEventListener: (type, fn) => { if (type === 'click') clicks.push(fn); }, classList: { toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); }, contains: (c) => cls.has(c) } };
    const head = { appendChild(t) { t.parentNode = head; heads.push(t); }, removeChild(t) { t.parentNode = null; } };
    const doc = { hidden: false, head, getElementById: (id) => { asked.push(id); return id === 'focus' ? focus : null; },
        createElement: () => ({}), addEventListener() { listened.push('doc'); }, querySelectorAll: () => [] };
    const win = { STATION_FOCUS: { id: SID, tab: 'plan' }, STATION: { serve: true, pricesVerified: '2026-09-04', sessions: [ROW] },
        STATION_DETAIL: { [SID]: { tasks: [], gate: null } }, location: { hash: '' },
        setInterval: (fn) => ticks.push(fn), setTimeout: (fn, ms) => waits.push(ms), clearTimeout() {}, addEventListener() { listened.push('win'); } };
    // As focusShell loads them: the focus module, then station.js, in one page.
    const box = vm.createContext({ window: win, document: doc, URLSearchParams });
    for (const n of ['focus-page.js', 'station.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', n), 'utf8'), box);
    return { focus, asked, heads, ticks, listened, win, waits, clicks };
}

test('boot: STATION_FOCUS draws the focus page into #focus and the full station never boots', () => {
    const d = focusDom();
    assert.match(d.focus.innerHTML, /^<header class="fh" data-block="focus-header">/);
    assert.deepEqual(d.asked, ['focus'], 'no other element looked up');
    assert.deepEqual(d.listened, [], 'no listener of the full page');
    assert.equal(d.ticks.length, 1, 'one re-read timer');
});

test('boot: a re-read that fails dims the page as stale, the next one that loads clears it', () => {
    const d = focusDom();
    d.ticks[0]();
    d.heads[0].onerror();
    assert.ok(d.focus.classList.contains('fm-stale'), 'stale after an error');
    assert.equal(d.heads[0].parentNode, null, 'the failed tag is removed');
    d.ticks[0]();
    d.win.STATION = Object.assign({}, d.win.STATION, { sessions: [Object.assign({}, ROW, { task: 'renamed' })] });
    d.heads[1].onload();
    assert.ok(!d.focus.classList.contains('fm-stale'), 'fresh after a load');
    assert.ok(d.focus.innerHTML.includes('renamed'), 'the load repaints');
    assert.ok(d.heads[1].src.startsWith('/station/focus/' + SID + '.js?t='), 'the one session script, cache-busted');
    // reload's give-up timer: the full page's RELOAD_TIMEOUT_MS is still unassigned when focusBoot runs.
    assert.deepEqual(d.waits, [4000, 4000], 'each re-read gives up after four seconds');
});

const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, text }));
    }).on('error', reject);
});

test('done line: /f/<id>/plan answers under 200 ms with no station-data.js, and draws as many tasks as the plan has', async () => {
    const base = tmp('fankeel-focus-e2e-');
    const cfg = path.join(base, 'cfg');
    const root = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    registry.ensureLayout(root);
    claimed(root);
    registry.writeSession(root, SID, { active: false, task: 'focus page', stage: 'plan', route: ROW.route,
        started: '2026-10-21T10:00:00.000Z', claims: ['docs/plans/x.md'], configDir: cfg });
    const s = await serve({ configDir: cfg, roots: [root], port: 0, idleMs: 60e3, open: false });
    try {
        const t0 = performance.now();
        const page = await get(s.url + 'f/' + SID + '/plan');
        const data = await get(s.url + 'station/focus/' + SID + '.js');
        const ms = performance.now() - t0;
        assert.ok(ms < 200, 'took ' + Math.round(ms) + ' ms');
        assert.doesNotMatch(page.text, /station-data\.js/);
        const box = { window: {} };
        vm.runInNewContext(data.text, box);
        const html = F.page(box.window.STATION, box.window.STATION_DETAIL, { id: SID, tab: 'plan' });
        assert.equal(count(html, /<li class="fp-row/g), TASKS);
    } finally {
        s.close();
    }
});

test('keepOpen marks the folds the reader opened and leaves the rest', () => {
    const html = '<details class="gv-more" data-gv="rest"><summary>a</summary></details><details class="gv-more" data-gv="patrol"><summary>b</summary></details>';
    const out = F.keepOpen(html, { rest: true, patrol: false });
    assert.match(out, /data-gv="rest" open>/);
    assert.doesNotMatch(out, /data-gv="patrol" open/);
});

test('the focus page listens for clicks on #focus, and a click on a fold keeps it open through the repaint', () => {
    const d = focusDom();
    assert.equal(d.clicks.length, 1);
    assert.deepEqual(d.listened, []);
    d.win.STATION_FOCUS.tab = 'gate';
    d.win.STATION_DETAIL[SID].gate = { stage: 'survey', path: 'x/survey.md', parts: { rest: ['left over'] } };
    const repaint = () => { d.ticks[0](); d.heads[d.heads.length - 1].onload(); };
    repaint();
    assert.match(d.focus.innerHTML, /data-gv="rest"><summary/);
    assert.doesNotMatch(d.focus.innerHTML, /data-gv="rest" open/);
    const asked = [];
    const details = { open: false, getAttribute: (k) => (k === 'data-gv' ? 'rest' : null) };
    d.clicks[0]({ target: { closest: (sel) => { asked.push(sel); return { parentNode: details }; } } });
    assert.deepEqual(asked, ['details[data-gv] > summary']);
    repaint();
    assert.match(d.focus.innerHTML, /data-gv="rest" open/);
});

test('gateRest and gatePatrol carry a data-gv key', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
    assert.match(src, /<details class="gv-more" data-gv="rest"' \+ \(dg \? ' open' : ''\)/);
    assert.match(src, /<details class="gv-more" data-gv="patrol" data-block="gate-patrol">/);
});
