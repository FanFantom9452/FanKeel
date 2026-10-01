'use strict';
// Twelve more branches of the page's big click listener in assets/station/station.js,
// pressed through the listener itself with fake targets whose closest() answers
// only the selector a test names: `[data-ph]`, `[data-ag]`, `[data-prm]` (a phase,
// an agent, a prompt opens or shuts), `[data-rs]` (the replay jumps to a row),
// `[data-xall]` (全部展開), `[data-rk]` (a replay kind hidden or shown),
// `[data-seg] button` (a segmented control), `[data-wf]` (a workflow bar folds),
// `[data-href]` (a row link), `th[data-k]` (a column sort), `[data-gop]` (the
// floating gate's option posts an answer) and `[data-gho]` (its hand-off posts
// handoff=terminal), the last two through gatePost's fetch. One effect per
// test, so single-branch mutations of one branch redden different sets of tests.
//
// The listener keeps its state in a closure `view`; a setter for `ph` on the
// context's Object.prototype hands that object to the test (`p.view`), so state
// is read where it lives rather than guessed from a render.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(process.env.STATION_SRC || path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const PK = 'F:\\ws\\alpha';

const session = (id) => ({ id, pkey: PK, root: PK, task: 't-' + id, state: 'live', route: ['survey', 'build'], stage: 'build',
    stages: [], notes: [], claims: [], conflicts: [], burn: 0, backtracks: 0, updated: NOW - 1000, started: new Date(NOW - 120000).toISOString(), days: [] });

// station.js booted on `hash`. p.byId overrides getElementById (null = absent),
// p.qsa answers querySelectorAll, p.asked logs its selectors. opts (optional):
// { pending } gives session s1 that pending gate, { notification: true } gives the
// window a Notification whose requestPermission counts in p.notified. p.fetched
// logs every fetch as { url, method, body } (body as a string).
function boot(hash, opts) {
    const listeners = {}, els = {}, writes = { page: 0 };
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {} });
    const page = el('div');
    let html = '';
    Object.defineProperty(page, 'innerHTML', { get: () => html, set: (v) => { html = v; writes.page++; } });
    els.page = page;
    const p = { writes, byId: {}, asked: [], qsa: () => [], els, view: null, fetched: [], notified: 0 };
    const win = { location: { hash }, addEventListener() {}, scrollTo() {}, setInterval: () => 1, setTimeout: () => 1, clearTimeout() {},
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: true, nonce: 'N0NCE',
            projects: [{ root: PK, gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
            sessions: [session('s1')] } };
    if (opts && opts.pending) win.STATION.sessions[0].pending = opts.pending;
    if (opts && opts.notification) win.Notification = { requestPermission() { p.notified++; return Promise.resolve(); } };
    const doc = { hidden: false, documentElement: el('html'), body: el('body'), title: '', head: { appendChild() {} },
        getElementById: (id) => (id in p.byId ? p.byId[id] : els[id] || (els[id] = el())),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el,
        querySelectorAll: (sel) => { p.asked.push(sel); return p.qsa(sel); }, querySelector: () => null };
    const ctx = vm.createContext({ window: win, document: doc, URLSearchParams, fetch: (url, init) => { p.fetched.push({ url, method: init && init.method, body: init && init.body ? init.body.toString() : null }); return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') }); }, module: { exports: {} }, grab: (v) => { p.view = v; } });
    vm.runInContext("Object.defineProperty(Object.prototype, 'ph', { configurable: true, set(v) { Object.defineProperty(this, 'ph', { value: v, writable: true, enumerable: true, configurable: true }); grab(this); } });", ctx);
    vm.runInContext(SRC, ctx);
    const fns = (listeners.click || []).filter((fn) => String(fn).includes('[data-tune-notify]'));
    assert.equal(fns.length, 1, 'one click listener holds [data-tune-notify]');
    assert.ok(p.view && p.view.ph, 'the closure view was captured');
    const click = fns[0];
    p.closestAsked = [];
    p.press = (answers) => click({ target: { closest: (sel) => { p.closestAsked.push(sel); return sel in answers ? answers[sel] : null; } } });
    p.reset = () => { writes.page = 0; p.asked.length = 0; };
    p.hash = () => win.location.hash;
    return p;
}

// A target answering getAttribute from `attrs`.
const node = (attrs, extra) => Object.assign({ attrs, getAttribute: (k) => (k in attrs ? attrs[k] : null), setAttribute(k, v) { attrs[k] = v; } }, extra);
// The listener's objects come from the vm's realm; compare them as plain JSON.
const J = (o) => JSON.parse(JSON.stringify(o));
// A later branch that would act were the listener to fall through to it.
const wfProbe = () => node({ 'data-wf': 'probe' });

// ---- [data-ph], [data-ag], [data-prm] ---------------------------------------
// The three are the same shape over three maps: view.ph, view.open, view.prm.
const FOLDS = [
    ['ph', '[data-ph]', 'data-ph', 'ph'],
    ['ag', '[data-ag]', 'data-ag', 'open'],
    ['prm', '[data-prm]', 'data-prm', 'prm'],
];
for (const [name, sel, attr, map] of FOLDS) {
    const target = (expanded) => node(expanded === null ? { [attr]: 'k1' } : { [attr]: 'k1', 'aria-expanded': expanded });

    test(name + ': a closed one (aria-expanded false) is opened in view.' + map + ' under its key', () => {
        const p = boot('#/');
        p.press({ [sel]: target('false') });
        assert.deepEqual(J(p.view[map]), { k1: true });
    });

    test(name + ': an open one (aria-expanded true) is shut in view.' + map, () => {
        const p = boot('#/');
        p.press({ [sel]: target('true') });
        assert.deepEqual(J(p.view[map]), { k1: false });
    });

    test(name + ': one with no aria-expanded counts as closed and is opened', () => {
        const p = boot('#/');
        p.press({ [sel]: target(null) });
        assert.equal(p.view[map].k1, true);
    });

    test(name + ': the press repaints the page once', () => {
        const p = boot('#/');
        p.reset();
        p.press({ [sel]: target('false') });
        assert.equal(p.writes.page, 1);
    });

    test(name + ': it returns before the later branches (a [data-wf] answer is not acted on)', () => {
        const p = boot('#/');
        p.press({ [sel]: target('false'), '[data-wf]': wfProbe() });
        assert.deepEqual(J(p.view.closed), {});
    });

    test(name + ': it writes only its own map', () => {
        const p = boot('#/');
        p.press({ [sel]: target('false') });
        for (const other of ['ph', 'open', 'prm']) if (other !== map) assert.deepEqual(J(p.view[other]), {});
    });
}

// ---- [data-rs] ---------------------------------------------------------------
function rsTarget(id) { return { '[data-rs]': node({ 'data-rs': id }) }; }
function rsRow(seg) {
    const row = { scrolled: [], closest: (sel) => (sel === 'details.rpseg' ? seg : null), scrollIntoView(o) { this.scrolled.push(o); } };
    return row;
}

test('rs: the row is found by the id in data-rs and scrolled to the top', () => {
    const p = boot('#/');
    const row = rsRow(null);
    p.byId['rs-3'] = row;
    p.press(rsTarget('rs-3'));
    assert.deepEqual(J(row.scrolled), [{ block: 'start' }]);
});

test('rs: another id (rv-7) finds its own row, not the first one', () => {
    const p = boot('#/');
    const a = rsRow(null), b = rsRow(null);
    p.byId['rs-3'] = a;
    p.byId['rv-7'] = b;
    p.press(rsTarget('rv-7'));
    assert.equal(a.scrolled.length + ':' + b.scrolled.length, '0:1');
});

test('rs: the segment the row sits in is opened', () => {
    const p = boot('#/');
    const seg = { open: false };
    p.byId['rs-3'] = rsRow(seg);
    p.press(rsTarget('rs-3'));
    assert.equal(seg.open, true);
});

test('rs: the segment is looked up from the row as details.rpseg', () => {
    const p = boot('#/');
    const asked = [];
    p.byId['rs-3'] = { closest: (sel) => { asked.push(sel); return null; }, scrollIntoView() {} };
    p.press(rsTarget('rs-3'));
    assert.deepEqual(asked, ['details.rpseg']);
});

test('rs: a row outside any segment is still scrolled to', () => {
    const p = boot('#/');
    const row = rsRow(null);
    p.byId['rs-3'] = row;
    p.press(rsTarget('rs-3'));
    assert.equal(row.scrolled.length, 1);
});

test('rs: an id with no element returns quietly (nothing thrown, nothing repainted)', () => {
    const p = boot('#/');
    p.byId['rs-9'] = null;
    p.reset();
    p.press(rsTarget('rs-9'));
    assert.equal(p.writes.page, 0);
});

test('rs: a missing element does not reach the later branches (an [data-xall] answer is not acted on)', () => {
    const p = boot('#/');
    p.byId['rs-9'] = null;
    p.press(Object.assign(rsTarget('rs-9'), { '[data-xall]': {} }));
    assert.deepEqual(p.asked, []);
});

test('rs: a found row returns before the later branches (an [data-xall] answer is not acted on)', () => {
    const p = boot('#/');
    p.byId['rs-3'] = rsRow(null);
    p.press(Object.assign(rsTarget('rs-3'), { '[data-xall]': {} }));
    assert.deepEqual(p.asked, []);
});

test('rs: the press does not repaint the page', () => {
    const p = boot('#/');
    p.byId['rs-3'] = rsRow(null);
    p.reset();
    p.press(rsTarget('rs-3'));
    assert.equal(p.writes.page, 0);
});

// ---- [data-xall] -------------------------------------------------------------
const XALL = '.rpw details.tc, .rpw details.stw';
const folds = (...opens) => opens.map((open) => ({ open }));
const xall = (p, ds) => { p.qsa = (sel) => (sel === XALL ? ds : []); p.press({ '[data-xall]': {} }); };

test('xall: it asks for the tool-call and step folds of the replay', () => {
    const p = boot('#/');
    xall(p, folds());
    assert.deepEqual(p.asked, [XALL]);
});

test('xall: with one fold shut every fold is opened', () => {
    const p = boot('#/');
    const ds = folds(true, false, true);
    xall(p, ds);
    assert.deepEqual(ds.map((d) => d.open), [true, true, true]);
});

test('xall: with every fold shut every fold is opened', () => {
    const p = boot('#/');
    const ds = folds(false, false);
    xall(p, ds);
    assert.deepEqual(ds.map((d) => d.open), [true, true]);
});

test('xall: with every fold open every fold is shut', () => {
    const p = boot('#/');
    const ds = folds(true, true);
    xall(p, ds);
    assert.deepEqual(ds.map((d) => d.open), [false, false]);
});

test('xall: with no folds on the page nothing is thrown', () => {
    const p = boot('#/');
    xall(p, []);
});

test('xall: it returns before the later branches (a [data-rk] answer is not acted on)', () => {
    const p = boot('#/');
    p.qsa = () => [];
    p.press({ '[data-xall]': {}, '[data-rk]': node({ 'data-rk': 'k', 'aria-pressed': 'true' }) });
    assert.deepEqual(J(p.view.kinds), {});
});

test('xall: the press does not repaint the page', () => {
    const p = boot('#/');
    p.reset();
    xall(p, folds(false));
    assert.equal(p.writes.page, 0);
});

// ---- [data-rk] ---------------------------------------------------------------
const LI = '.rp > li[data-kind="tool"]';
function rk(pressed) {
    const p = boot('#/');
    const lis = [{ hidden: null }, { hidden: null }];
    p.qsa = (sel) => (sel === LI ? lis : []);
    const btn = node({ 'data-rk': 'tool', 'aria-pressed': pressed }, { setAttribute(k, v) { this.attrs[k] = v; } });
    p.press({ '[data-rk]': btn });
    return { p, lis, btn };
}

test('rk: a pressed kind (aria-pressed true) is un-pressed: aria-pressed becomes the string false', () => {
    assert.equal(rk('true').btn.attrs['aria-pressed'], 'false');
});

test('rk: an un-pressed kind (aria-pressed false) is pressed: aria-pressed becomes the string true', () => {
    assert.equal(rk('false').btn.attrs['aria-pressed'], 'true');
});

test('rk: un-pressing a kind records it hidden in view.kinds', () => {
    assert.deepEqual(J(rk('true').p.view.kinds), { tool: true });
});

test('rk: pressing a kind again records it shown in view.kinds', () => {
    assert.deepEqual(J(rk('false').p.view.kinds), { tool: false });
});

test('rk: un-pressing a kind hides every row of that kind', () => {
    assert.deepEqual(rk('true').lis.map((l) => l.hidden), [true, true]);
});

test('rk: pressing a kind shows every row of that kind', () => {
    assert.deepEqual(rk('false').lis.map((l) => l.hidden), [false, false]);
});

test('rk: the rows are asked for by the kind in data-rk', () => {
    assert.deepEqual(rk('true').p.asked, [LI]);
});

test('rk: it returns before the later branches (a [data-goto] answer is not acted on)', () => {
    const p = boot('#/');
    p.press({ '[data-rk]': node({ 'data-rk': 'tool', 'aria-pressed': 'true' }), '[data-goto]': node({ 'data-goto': '1', 'data-until': '2' }) });
    assert.equal(p.els['s-rp'], undefined);
});

test('rk: the press does not repaint the page', () => {
    const p = boot('#/');
    p.reset();
    p.press({ '[data-rk]': node({ 'data-rk': 'tool', 'aria-pressed': 'true' }) });
    assert.equal(p.writes.page, 0);
});

// ---- [data-seg] button -------------------------------------------------------
const segBtn = (key, v) => ({ '[data-seg] button': node({ 'data-v': v }, { parentNode: node({ 'data-seg': key }) }) });

test('seg: the control named by the parent takes the button\'s data-v', () => {
    const p = boot('#/');
    p.press(segBtn('metric', 'time'));
    assert.equal(p.view.metric, 'time');
});

test('seg: a different control (dim) takes its own value and leaves metric alone', () => {
    const p = boot('#/');
    p.press(segBtn('dim', 'project'));
    assert.equal(p.view.dim, 'project');
    assert.equal(p.view.metric, 'usd');
});

test('seg: the press redraws the page once', () => {
    const p = boot('#/');
    p.reset();
    p.press(segBtn('metric', 'time'));
    assert.equal(p.writes.page, 1);
});

test('seg: it returns before the later branches (a [data-wf] answer is not acted on)', () => {
    const p = boot('#/');
    p.press(Object.assign(segBtn('metric', 'time'), { '[data-wf]': wfProbe() }));
    assert.deepEqual(J(p.view.closed), {});
});

// ---- [data-wf] ---------------------------------------------------------------
test('wf: an open bar (nothing recorded) is closed under its key', () => {
    const p = boot('#/');
    p.press({ '[data-wf]': node({ 'data-wf': 'b1' }) });
    assert.deepEqual(J(p.view.closed), { b1: true });
});

test('wf: a second press on the same bar opens it again', () => {
    const p = boot('#/');
    p.press({ '[data-wf]': node({ 'data-wf': 'b1' }) });
    p.press({ '[data-wf]': node({ 'data-wf': 'b1' }) });
    assert.deepEqual(J(p.view.closed), { b1: false });
});

test('wf: a bar already recorded closed is opened by one press', () => {
    const p = boot('#/');
    p.view.closed.b1 = true;
    p.press({ '[data-wf]': node({ 'data-wf': 'b1' }) });
    assert.equal(p.view.closed.b1, false);
});

test('wf: another bar is not touched', () => {
    const p = boot('#/');
    p.press({ '[data-wf]': node({ 'data-wf': 'b1' }) });
    assert.equal('b2' in p.view.closed, false);
});

test('wf: the press redraws the page once', () => {
    const p = boot('#/');
    p.reset();
    p.press({ '[data-wf]': node({ 'data-wf': 'b1' }) });
    assert.equal(p.writes.page, 1);
});

test('wf: it returns before the later branches (a [data-href] answer is not followed)', () => {
    const p = boot('#/');
    p.press({ '[data-wf]': node({ 'data-wf': 'b1' }), '[data-href]': node({ 'data-href': '#/elsewhere' }) });
    assert.equal(p.hash(), '#/');
});

// ---- [data-href] -------------------------------------------------------------
const href = (h) => node({ 'data-href': h });

test('href: a click on a linked row sets the location hash to its data-href', () => {
    const p = boot('#/');
    p.press({ '[data-href]': href('#/s/s1') });
    assert.equal(p.hash(), '#/s/s1');
});

// A hit for the inner closest('a,button,input') row (that mutated to false navigates: red); against
// the outer [data-href] branch it is a guard (hash stays '#/' when that branch is deleted too).
test('href: a click that lands on a link, button or input inside the row does not navigate', () => {
    const p = boot('#/');
    p.press({ '[data-href]': href('#/s/s1'), 'a,button,input': {} });
    assert.equal(p.hash(), '#/');
});

test('href: a linked row consults the link-or-control guard before it navigates', () => {
    const p = boot('#/');
    p.press({ '[data-href]': href('#/s/s1') });
    assert.ok(p.closestAsked.some((s) => s.startsWith('a,')), p.closestAsked.join(' | '));
});

test('href: the guard asks for a, button and input together (a bare button answer does not stop it)', () => {
    const p = boot('#/');
    p.press({ '[data-href]': href('#/s/s1'), button: {} });
    assert.equal(p.hash(), '#/s/s1');
});

test('href: the navigation returns before the later branches (a th[data-k] answer is not acted on)', () => {
    const p = boot('#/list');
    p.els.lh.innerHTML = 'SENTINEL';
    p.press({ '[data-href]': href('#/s/s1'), 'th[data-k]': node({ 'data-k': 'task' }) });
    assert.equal(p.els.lh.innerHTML, 'SENTINEL');
});

test('href: a guarded click falls through to the later branches (a th[data-k] answer is then acted on)', () => {
    const p = boot('#/list');
    p.els.lh.innerHTML = 'SENTINEL';
    p.press({ '[data-href]': href('#/s/s1'), 'a,button,input': {}, 'th[data-k]': node({ 'data-k': 'task' }) });
    assert.notEqual(p.els.lh.innerHTML, 'SENTINEL');
});

test('guard: href: the press does not repaint the page', () => {
    const p = boot('#/');
    p.reset();
    p.press({ '[data-href]': href('#/s/s1') });
    assert.equal(p.writes.page, 0);
});

// ---- th[data-k] --------------------------------------------------------------
// The list page boots sorted by `updated`, newest first.
const th = (k) => ({ 'th[data-k]': node({ 'data-k': k }) });
const header = (p) => p.els.lh.innerHTML;
const dirOf = (p, k) => { const m = new RegExp('data-k="' + k + '"[^>]*data-dir="(asc|desc)"').exec(header(p)); return m && m[1]; };

test('th: the list boots sorted by updated, descending', () => {
    const p = boot('#/list');
    assert.equal(dirOf(p, 'updated'), 'desc');
});

test('th: a press on the sorted column flips its direction to ascending', () => {
    const p = boot('#/list');
    p.press(th('updated'));
    assert.equal(dirOf(p, 'updated'), 'asc');
});

test('th: a second press on the same column flips it back to descending', () => {
    const p = boot('#/list');
    p.press(th('updated'));
    p.press(th('updated'));
    assert.equal(dirOf(p, 'updated'), 'desc');
});

test('th: a press on the task column sorts by it ascending', () => {
    const p = boot('#/list');
    p.press(th('task'));
    assert.equal(dirOf(p, 'task'), 'asc');
});

test('th: a press on another column (cost) sorts by it descending', () => {
    const p = boot('#/list');
    p.press(th('cost'));
    assert.equal(dirOf(p, 'cost'), 'desc');
});

test('th: a press on a new column leaves no mark on the old one', () => {
    const p = boot('#/list');
    p.press(th('cost'));
    assert.equal(dirOf(p, 'updated'), null);
});

test('th: a second press on the new task column flips it to descending', () => {
    const p = boot('#/list');
    p.press(th('task'));
    p.press(th('task'));
    assert.equal(dirOf(p, 'task'), 'desc');
});

test('th: the press redraws the list header (drawList runs)', () => {
    const p = boot('#/list');
    p.els.lh.innerHTML = 'SENTINEL';
    p.press(th('task'));
    assert.notEqual(header(p), 'SENTINEL');
});

test('th: the press redraws only the list, not the whole page', () => {
    const p = boot('#/list');
    p.reset();
    p.press(th('task'));
    assert.equal(p.writes.page, 0);
});

test('th: it returns before the later branch (a tr[data-id] answer selects no row)', () => {
    const p = boot('#/list');
    p.press(Object.assign(th('task'), { 'tr[data-id]': node({ 'data-id': 's1' }) }));
    assert.equal(p.asked.includes('#lb tr'), false);
});

// ---- [data-gop], [data-gho] --------------------------------------------------
// gatePost reads the session named by the .gc's data-pg-id, needs its `pending`,
// and POSTs to 'answer'. p.fetched logs the call; the .gend node takes the result.
const PENDING = { questions: [{ question: 'Q?', options: [{ label: 'A' }, { label: 'B' }] }] };
const gcOf = (id, root) => {
    const gend = { className: '', textContent: '' };
    return node({ 'data-pg-id': id === undefined ? 's1' : id, 'data-pg-root': root === undefined ? PK : root },
        { querySelector: (sel) => (sel === '.gend' ? gend : null), gend });
};
// gop finds its .gc from the button (gop.closest); gho from the event target.
const gopBtn = (i, gc) => node({ 'data-gop': String(i) }, { closest: (sel) => (sel === '.gc' ? gc : null) });
const bodyOf = (call) => new URLSearchParams(call.body);
const settle = () => new Promise((r) => setImmediate(r));

test('gop: it posts once to answer with method POST', () => {
    const p = boot('#/', { pending: PENDING });
    p.press({ '[data-gop]': gopBtn(0, gcOf()) });
    assert.deepEqual(p.fetched.map((c) => c.url + ' ' + c.method), ['answer POST']);
});

test('gop: option 0 answers the question with its label A', () => {
    const p = boot('#/', { pending: PENDING });
    p.press({ '[data-gop]': gopBtn(0, gcOf()) });
    assert.deepEqual(JSON.parse(bodyOf(p.fetched[0]).get('answers')), { 'Q?': 'A' });
});

test('gop: option 1 answers the question with its label B', () => {
    const p = boot('#/', { pending: PENDING });
    p.press({ '[data-gop]': gopBtn(1, gcOf()) });
    assert.deepEqual(JSON.parse(bodyOf(p.fetched[0]).get('answers')), { 'Q?': 'B' });
});

test('gop: the body carries the nonce, and the id and root of the .gc', () => {
    const p = boot('#/', { pending: PENDING });
    p.press({ '[data-gop]': gopBtn(0, gcOf('s1', 'F:\\other')) });
    const b = bodyOf(p.fetched[0]);
    assert.equal(b.get('nonce') + '|' + b.get('id') + '|' + b.get('root'), 'N0NCE|s1|F:\\other');
});

test('gop: it takes the .gc from the button, not from the event target', () => {
    const p = boot('#/', { pending: PENDING });
    p.press({ '[data-gop]': gopBtn(0, gcOf('s1', 'F:\\mine')), '.gc': gcOf('s1', 'F:\\wrong') });
    assert.equal(bodyOf(p.fetched[0]).get('root'), 'F:\\mine');
});

test('gop: it returns before the later branches (a [data-gho] answer posts no second fetch)', () => {
    const p = boot('#/', { pending: PENDING });
    p.press({ '[data-gop]': gopBtn(0, gcOf()), '[data-gho]': node({}), '.gc': gcOf() });
    assert.equal(p.fetched.length, 1);
});

test('gop: it returns before [data-tune-notify] (no permission request)', () => {
    const p = boot('#/', { pending: PENDING, notification: true });
    p.press({ '[data-gop]': gopBtn(0, gcOf()), '[data-tune-notify]': node({}) });
    assert.equal(p.notified, 0);
});

test('gop: with no pending on the session nothing is fetched', () => {
    const p = boot('#/');
    p.press({ '[data-gop]': gopBtn(0, gcOf()) });
    assert.equal(p.fetched.length, 0);
});

test('gop: once the fetch resolves .gend reads 已送出：', async () => {
    const p = boot('#/', { pending: PENDING });
    const gc = gcOf();
    p.press({ '[data-gop]': gopBtn(0, gc) });
    await settle();
    assert.equal(gc.gend.textContent.startsWith('已送出：'), true);
});

test('gho: it posts once to answer with method POST', () => {
    const p = boot('#/', { pending: PENDING });
    p.press({ '[data-gho]': node({}), '.gc': gcOf() });
    assert.deepEqual(p.fetched.map((c) => c.url + ' ' + c.method), ['answer POST']);
});

test('gho: the body says handoff=terminal', () => {
    const p = boot('#/', { pending: PENDING });
    p.press({ '[data-gho]': node({}), '.gc': gcOf() });
    assert.equal(bodyOf(p.fetched[0]).get('handoff'), 'terminal');
});

test('gho: the body has no answers field', () => {
    const p = boot('#/', { pending: PENDING });
    p.press({ '[data-gho]': node({}), '.gc': gcOf() });
    assert.equal(bodyOf(p.fetched[0]).has('answers'), false);
});

test('gho: the body carries the nonce, and the id and root of the .gc taken from the event target', () => {
    const p = boot('#/', { pending: PENDING });
    p.press({ '[data-gho]': node({}), '.gc': gcOf('s1', 'F:\\other') });
    const b = bodyOf(p.fetched[0]);
    assert.equal(b.get('nonce') + '|' + b.get('id') + '|' + b.get('root'), 'N0NCE|s1|F:\\other');
});

test('gho: it returns before [data-tune-notify] (no permission request)', () => {
    const p = boot('#/', { pending: PENDING, notification: true });
    p.press({ '[data-gho]': node({}), '.gc': gcOf(), '[data-tune-notify]': node({}) });
    assert.equal(p.notified, 0);
});

test('gho: with no pending on the session nothing is fetched', () => {
    const p = boot('#/');
    p.press({ '[data-gho]': node({}), '.gc': gcOf() });
    assert.equal(p.fetched.length, 0);
});

test('gho: once the fetch resolves .gend reads 已交給終端：', async () => {
    const p = boot('#/', { pending: PENDING });
    const gc = gcOf();
    p.press({ '[data-gho]': node({}), '.gc': gc });
    await settle();
    assert.equal(gc.gend.textContent.startsWith('已交給終端：'), true);
});
