'use strict';
// Four `input` listeners of assets/station/station.js, each pinned so that a
// one-branch mutation of one of them reddens a set of tests no other mutation
// of the same listener reddens: the docs search box (#dq), the facet popover's
// filter ([data-pickq]), the header box (#q) and the gate form's 其他 box
// ([data-pg-other]). The listeners are anonymous, so each test picks its own
// by a phrase of its source.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const settle = () => new Promise((r) => { setImmediate(r); });

function boot(o) {
    const opts = o || {};
    const docInput = [], docClick = [], qInput = [], winEvents = {}, timers = [], fetches = [];
    let seq = 0, writes = 0;
    const els = {};
    const el = () => ({ tagName: 'DIV', innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, hidden: false, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const mk = (id) => {
        const x = el();
        if (id === 'q') x.addEventListener = (type, fn) => { if (type === 'input') qInput.push(fn); };
        if (id === 'page') {
            let html = '';
            Object.defineProperty(x, 'innerHTML', { get: () => html, set: (v) => { writes++; html = v; } });
        }
        return x;
    };
    const doc = { hidden: false, documentElement: el(), title: '', getElementById: (id) => els[id] || (els[id] = mk(id)),
        addEventListener(type, fn) { if (type === 'input') docInput.push(fn); if (type === 'click') docClick.push(fn); }, createElement: el,
        querySelectorAll: (sel) => (opts.qsa ? opts.qsa(sel) : []), querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash: opts.hash || '#/', protocol: 'http:' }, scrollTo() {}, setInterval: () => 1,
        addEventListener(type, fn) { (winEvents[type] = winEvents[type] || []).push(fn); },
        setTimeout: (fn, ms) => { const id = ++seq; timers.push({ id, fn, ms }); return id; },
        clearTimeout: (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); },
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-04', serve: opts.serve !== false,
            projects: [], profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
            sessions: opts.sessions || [] } };
    const fetchImpl = (url) => new Promise((resolve, reject) => { fetches.push({ url: String(url), resolve, reject }); });
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: fetchImpl, module: { exports: {} } });
    // A listener is found by any phrase of its source, so a mutation that removes one phrase still leaves it found.
    const by = (list, phrases) => list.filter((fn) => [].concat(phrases).some((p) => fn.toString().includes(p)))[0];
    return {
        els, win, doc, timers, fetches, draws: () => writes, page: () => els.page.innerHTML,
        dq: by(docInput, ["'dq'", 'dsxTimer']), pickq: by(docInput, ['data-pickq', 'pickQ', '.rpop']),
        pg: by(docInput, ['data-pg-other', 'pgSync']), q: by(qInput, ['f.q', 'draw()']),
        docInput, qInput,
        press: (attrs) => docClick.forEach((fn) => fn({ target: { getAttribute: (k) => (k in attrs ? attrs[k] : null), hasAttribute: (k) => k in attrs,
            closest(sel) { return Object.keys(attrs).some((k) => sel.includes('[' + k + ']')) ? this : null; } }, preventDefault() {}, stopPropagation() {} })),
        redraw: () => { (winEvents.hashchange || []).forEach((fn) => fn({})); },
        fire: (fn, target) => fn({ target }),
        debounce: () => { const t = timers.pop(); t.fn(); return t; },
    };
}
const dqTarget = (v) => ({ id: 'dq', value: v });
const hit = (title) => ({ q: 'x', n: 1, hits: [{ pkey: 'k', path: 'p.md', title, role: 'reference', before: 'a', hit: 'x', after: 'b', project: 'pj' }] });
const ok = (res) => ({ ok: true, json: () => Promise.resolve(res) });

// ---- 1. #dq ---------------------------------------------------------------

test('dq: an input event with no target is left alone', () => {
    const b = boot();
    assert.doesNotThrow(() => b.dq({ target: null }));
});

test('dq: a target with another id starts no search', () => {
    const b = boot();
    b.fire(b.dq, { id: 'other', value: 'zzz' });
    assert.equal(b.timers.length, 0, 'nothing was scheduled');
    assert.equal(b.fetches.length, 0);
});

test('dq: the search waits 250 ms after the keystroke', () => {
    const b = boot();
    b.fire(b.dq, dqTarget('abc'));
    assert.equal(b.timers.length, 1);
    assert.equal(b.timers[0].ms, 250);
    assert.equal(b.fetches.length, 0, 'the fetch waits for the debounce');
});

test('dq: the query goes to the search url encoded', () => {
    const b = boot();
    b.fire(b.dq, dqTarget('a b&c'));
    b.debounce();
    assert.equal(b.fetches[0].url, 'station/search?q=a%20b%26c');
});

test('dq: a typed query\'s hits and count are painted', async () => {
    const b = boot();
    b.fire(b.dq, dqTarget('abc'));
    b.debounce();
    b.fetches[0].resolve(ok(hit('Found page')));
    await settle(); await settle();
    assert.match(b.els.dsxOut.innerHTML, /Found page/);
    assert.equal(b.els.dsxN.textContent, '1 頁');
});

test('dq: a second keystroke cancels the first one\'s timer', () => {
    const b = boot();
    b.fire(b.dq, dqTarget('a'));
    b.fire(b.dq, dqTarget('ab'));
    assert.equal(b.timers.length, 1, 'only the last keystroke\'s timer is left');
    b.debounce();
    assert.equal(b.fetches.length, 1);
    assert.match(b.fetches[0].url, /q=ab$/);
});

test('dq: a search success is kept in view, so a redraw of the docs page draws the hits again', async () => {
    const b = boot();
    b.fire(b.dq, dqTarget('x'));
    b.debounce();
    b.fetches[0].resolve(ok(hit('Kept page')));
    await settle(); await settle();
    b.win.location.hash = '#/docs';
    b.redraw();
    assert.match(b.page(), /Kept page/);
});

test('dq: a failed search is kept in view as the error, so a redraw of the docs page draws it again', async () => {
    const b = boot();
    b.fire(b.dq, dqTarget('x'));
    b.debounce();
    b.fetches[0].reject(new Error('down'));
    await settle(); await settle();
    b.win.location.hash = '#/docs';
    b.redraw();
    assert.match(b.page(), /搜尋失敗/);
});

test('dq: a failed search paints the failure message over the hits a success had shown', async () => {
    const b = boot();
    b.fire(b.dq, dqTarget('x'));
    b.debounce();
    b.fetches[0].resolve(ok(hit('First')));
    await settle(); await settle();
    b.fire(b.dq, dqTarget('xy'));
    b.debounce();
    b.fetches[1].reject(new Error('down'));
    await settle(); await settle();
    assert.match(b.els.dsxOut.innerHTML, /搜尋失敗/);
});

test('dq: a failed search clears the count a success had shown', async () => {
    const b = boot();
    b.fire(b.dq, dqTarget('x'));
    b.debounce();
    b.fetches[0].resolve(ok(hit('First')));
    await settle(); await settle();
    assert.equal(b.els.dsxN.textContent, '1 頁');
    b.fire(b.dq, dqTarget('xy'));
    b.debounce();
    b.fetches[1].reject(new Error('down'));
    await settle(); await settle();
    assert.equal(b.els.dsxN.textContent, '');
});

test('dq: after a success, a failed search leaves a page that redraws without throwing', async () => {
    const b = boot();
    b.fire(b.dq, dqTarget('x'));
    b.debounce();
    b.fetches[0].resolve(ok(hit('First')));
    await settle(); await settle();
    b.fire(b.dq, dqTarget('xy'));
    b.debounce();
    b.fetches[1].reject(new Error('down'));
    await settle(); await settle();
    b.win.location.hash = '#/docs';
    assert.doesNotThrow(() => b.redraw());
});

test('dq: an answer for a query the box has moved past paints nothing', async () => {
    const b = boot();
    b.fire(b.dq, dqTarget('x'));
    b.debounce();
    b.fire(b.dq, dqTarget('xy'));
    b.debounce();
    b.fetches[0].resolve(ok(hit('Stale page')));
    await settle(); await settle();
    assert.equal(b.els.dsxOut, undefined, 'the stale answer painted nothing');
});

test('dq: a failure for a query the box has moved past paints nothing and keeps no error', async () => {
    const c = boot();
    c.fire(c.dq, dqTarget('x'));
    c.debounce();
    c.fire(c.dq, dqTarget('xy'));
    c.debounce();
    c.fetches[0].reject(new Error('late'));
    await settle(); await settle();
    assert.equal(c.els.dsxOut, undefined, 'the stale failure painted nothing');
    c.win.location.hash = '#/docs';
    c.redraw();
    assert.doesNotMatch(c.page(), /搜尋失敗/, 'and kept no error');
});

test('dq: a blank query starts no fetch', async () => {
    const b = boot();
    b.fire(b.dq, dqTarget('x'));
    b.debounce();
    b.fetches[0].resolve(ok(hit('Old page')));
    await settle(); await settle();
    b.fire(b.dq, dqTarget('   '));
    b.debounce();
    assert.equal(b.fetches.length, 1, 'no second fetch');
});

test('dq: a blank query clears the results and the count a query had painted', async () => {
    const b = boot();
    b.fire(b.dq, dqTarget('x'));
    b.debounce();
    b.fetches[0].resolve(ok(hit('Old page')));
    await settle(); await settle();
    b.fire(b.dq, dqTarget('   '));
    b.debounce();
    assert.equal(b.els.dsxOut.innerHTML, '');
    assert.equal(b.els.dsxN.textContent, '');
});

test('dq: a blank query also drops the kept result, so a redraw of the docs page draws no hits', async () => {
    const b = boot();
    b.fire(b.dq, dqTarget('x'));
    b.debounce();
    b.fetches[0].resolve(ok(hit('Old page')));
    await settle(); await settle();
    b.fire(b.dq, dqTarget(''));
    b.debounce();
    b.win.location.hash = '#/docs';
    b.redraw();
    assert.doesNotMatch(b.page(), /Old page/);
});

// ---- 2. [data-pickq] ------------------------------------------------------

function rows() {
    const row = (text, title) => ({ textContent: text, title, hidden: false });
    const inside = [row('Alpha', ''), row('beta', 'Gamma note'), row('delta', undefined), row('ab', 'cd')];
    const outside = row('Zulu', '');
    return { inside, outside,
        qsa: (sel) => (sel === '.rpop [data-v]' ? inside : sel === '[data-v]' ? inside.concat([outside]) : []) };
}
const pq = (v) => ({ value: v, hasAttribute: (k) => k === 'data-pickq' });
const hiddenOf = (r) => r.inside.map((x) => x.hidden);

test('pickq: a target with no hasAttribute is left alone', () => {
    const r = rows();
    const b = boot({ qsa: r.qsa });
    assert.doesNotThrow(() => b.pickq({ target: {} }));
});

test('pickq: a target without data-pickq hides nothing', () => {
    const r = rows();
    const b = boot({ qsa: r.qsa });
    b.fire(b.pickq, { value: 'zzz', hasAttribute: () => false });
    assert.deepEqual(hiddenOf(r), [false, false, false, false]);
});

test('pickq: a query every row holds hides none', () => {
    const r = rows();
    const b = boot({ qsa: r.qsa });
    b.fire(b.pickq, pq('a'));
    assert.deepEqual(hiddenOf(r), [false, false, false, false]);
});

test('pickq: a query hides the rows whose text and title do not hold it, and only inside the popover', () => {
    const r = rows();
    const b = boot({ qsa: r.qsa });
    b.fire(b.pickq, pq('alp'));
    assert.deepEqual(hiddenOf(r), [false, true, true, true]);
    assert.equal(r.outside.hidden, false, 'a [data-v] outside .rpop is not a row of it');
});

test('pickq: the title is searched too, and a missing title adds no word', () => {
    const r = rows();
    const b = boot({ qsa: r.qsa });
    b.fire(b.pickq, pq('gamma'));
    assert.deepEqual(hiddenOf(r), [true, false, true, true]);
    b.fire(b.pickq, pq('undefined'));
    assert.deepEqual(hiddenOf(r), [true, true, true, true]);
});

test('pickq: text and title are joined by a space, so a query cannot span them', () => {
    const r = rows();
    const b = boot({ qsa: r.qsa });
    b.fire(b.pickq, pq('bc'));
    assert.deepEqual(hiddenOf(r), [true, true, true, true]);
    b.fire(b.pickq, pq('b c'));
    assert.deepEqual(hiddenOf(r), [true, true, true, false]);
});

test('pickq: the query is matched without case, in both directions', () => {
    const r = rows();
    const b = boot({ qsa: r.qsa });
    b.fire(b.pickq, pq('ALPHA'));
    assert.deepEqual(hiddenOf(r), [false, true, true, true], 'a capital query finds a capital row');
    b.fire(b.pickq, pq('BETA'));
    assert.deepEqual(hiddenOf(r), [true, false, true, true], 'a capital query finds a lowercase row');
    b.fire(b.pickq, pq('alpha'));
    assert.deepEqual(hiddenOf(r), [false, true, true, true], 'a lowercase query finds a capital row');
});

test('pickq: a match at the very start of the text still shows the row', () => {
    const r = rows();
    const b = boot({ qsa: r.qsa });
    b.fire(b.pickq, pq('ab'));
    assert.equal(r.inside[3].hidden, false);
    assert.equal(r.inside[0].hidden, true);
});

test('pickq: a shorter or empty query shows again the rows a longer one hid', () => {
    const r = rows();
    const b = boot({ qsa: r.qsa });
    b.fire(b.pickq, pq('alpha'));
    assert.deepEqual(hiddenOf(r), [false, true, true, true]);
    b.fire(b.pickq, pq('a'));
    assert.deepEqual(hiddenOf(r), [false, false, false, false]);
    b.fire(b.pickq, pq('alpha'));
    b.fire(b.pickq, pq(''));
    assert.deepEqual(hiddenOf(r), [false, false, false, false]);
});

test('pickq: what was typed is kept, so the next redraw of the open popover carries it in the box', () => {
    const b = boot({ hash: '#/list', sessions: [S('s1', 'one')] });
    b.win.STATION.projects = [1, 2, 3, 4, 5, 6, 7].map((i) => ({ root: 'F:\ws\p' + i, gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }));
    b.redraw();
    b.press({ 'data-pick': 'project' });
    assert.match(b.page(), /data-pickq[^>]*value=""/, 'the popover opens with an empty box');
    b.fire(b.pickq, pq('typed-here'));
    b.fire(b.q, { value: '' });
    assert.match(b.page(), /data-pickq[^>]*value="typed-here"/);
});

// ---- 3. #q ----------------------------------------------------------------

const S = (id, task) => ({ id, root: 'F:\\ws\\alpha', project: 'alpha', task, label: 'lbl', state: 'live', stage: 'build', updated: NOW - 1000, started: NOW - 5000, days: [], spans: [], stages: [], notes: [], claims: [], route: [] });

test('q: typing in the header box filters the list and repaints, and the filter stays for the next redraw', () => {
    const b = boot({ hash: '#/list', sessions: [S('s1', 'zebra task'), S('s2', 'apple task')] });
    assert.ok(b.q, 'the header box has its input listener');
    b.win.location.hash = '#/list';
    b.redraw();
    assert.match(b.els.lb.innerHTML, /zebra task/);
    assert.match(b.els.lb.innerHTML, /apple task/);
    const before = b.draws();
    b.fire(b.q, { value: 'zebra' });
    assert.match(b.els.lb.innerHTML, /zebra task/);
    assert.doesNotMatch(b.els.lb.innerHTML, /apple task/);
    assert.equal(b.draws(), before + 1, 'one repaint');
});

test('q: the value typed is kept in the filter, so a later redraw still narrows by it', () => {
    const b = boot({ hash: '#/list', sessions: [S('s1', 'zebra task'), S('s2', 'apple task')] });
    b.fire(b.q, { value: 'apple' });
    b.redraw();
    assert.match(b.els.lb.innerHTML, /apple task/);
    assert.doesNotMatch(b.els.lb.innerHTML, /zebra task/);
});

test('q: the box\'s text is used as typed, so a leading space is part of the query', () => {
    const b = boot({ hash: '#/list', sessions: [S('s1', 'zebra task'), S('s2', 'apple task')] });
    b.fire(b.q, { value: ' zebra' });
    assert.doesNotMatch(b.els.lb.innerHTML, /zebra task/);
    assert.doesNotMatch(b.els.lb.innerHTML, /apple task/);
});

// ---- 4. [data-pg-other] ---------------------------------------------------

function gate(text) {
    const sessions = [Object.assign(S('g1', 'gated'), { pending: { until: NOW + 60000, questions: [{ question: 'Which?', multiSelect: false, options: [{ label: 'A' }] }] } })];
    const out = { box: { checked: false }, decoy: { checked: false }, btn: { disabled: false }, cnt: { textContent: '' } };
    const tgt = { value: text };
    const pgb = { getAttribute: (k) => (k === 'data-pg-id' ? 'g1' : null),
        querySelectorAll: () => [], querySelector: (sel) => (sel === '[data-pg-other="0"]' ? tgt : sel === '[data-answer]' ? out.btn : sel === '.pgn' ? out.cnt : null) };
    // A selector other than the real one finds a decoy, the way a looser selector would find another element.
    const hold = { querySelector: (sel) => (sel === 'input[value="__other"]' ? out.box : out.decoy) };
    const state = { inPg: true };
    tgt.closest = (sel) => (sel === '.pg [data-pg-other]' ? (state.inPg ? tgt : null) : sel === '[data-pg-other]' ? tgt
        : sel === '.o' ? hold : sel === '.pg' ? pgb : null);
    return { sessions, out, tgt, hold, pgb, state };
}
const quiet = (fn) => { try { fn(); } catch (e) { /* the mutation under test may throw here */ } };

test('pg: a target of null is left alone', () => {
    const b = boot({ sessions: [] });
    assert.doesNotThrow(() => b.pg({ target: null }));
});

test('pg: a target with no closest is left alone', () => {
    const b = boot({ sessions: [] });
    assert.doesNotThrow(() => b.pg({ target: {} }));
});

test('pg: a target that is inside no gate form is left alone', () => {
    const b = boot({ sessions: [] });
    assert.doesNotThrow(() => b.pg({ target: { closest: () => null } }));
});

test('pg: a 其他 box outside .pg ticks nothing and counts nothing', () => {
    const g = gate('x');
    g.state.inPg = false;
    const b = boot({ sessions: g.sessions });
    quiet(() => b.fire(b.pg, g.tgt));
    assert.equal(g.out.box.checked, false);
    assert.equal(g.out.cnt.textContent, '');
});

test('pg: typing in 其他 ticks its box', () => {
    const g = gate('x');
    const b = boot({ sessions: g.sessions });
    quiet(() => b.fire(b.pg, g.tgt));
    assert.equal(g.out.box.checked, true);
});

test('pg: typing in 其他 touches no other input', () => {
    const g = gate('x');
    const b = boot({ sessions: g.sessions });
    quiet(() => b.fire(b.pg, g.tgt));
    assert.equal(g.out.decoy.checked, false);
});

test('pg: clearing 其他 unticks its box', () => {
    const g = gate('');
    g.out.box.checked = true;
    const b = boot({ sessions: g.sessions });
    quiet(() => b.fire(b.pg, g.tgt));
    assert.equal(g.out.box.checked, false);
});

test('pg: blanks in 其他 are not an answer, so its box stays unticked', () => {
    const g = gate('   ');
    const b = boot({ sessions: g.sessions });
    quiet(() => b.fire(b.pg, g.tgt));
    assert.equal(g.out.box.checked, false);
});

test('pg: typing in 其他 hands the gate form to the re-count, so it does not throw', () => {
    const g = gate('x');
    const b = boot({ sessions: g.sessions });
    assert.doesNotThrow(() => b.fire(b.pg, g.tgt));
});

test('pg: 其他 with no box of its own still re-counts', () => {
    const g = gate('x');
    g.hold.querySelector = () => null;
    const b = boot({ sessions: g.sessions });
    assert.doesNotThrow(() => b.fire(b.pg, g.tgt));
    assert.equal(g.out.cnt.textContent, '1 / 1');
});

test('pg: typing in 其他 re-counts the answered questions and enables the send button', () => {
    const g = gate('');
    const b = boot({ sessions: g.sessions });
    b.fire(b.pg, g.tgt);
    assert.equal(g.out.cnt.textContent, '0 / 1');
    assert.equal(g.out.btn.disabled, true);
    g.tgt.value = 'my own answer';
    b.fire(b.pg, g.tgt);
    assert.equal(g.out.cnt.textContent, '1 / 1');
    assert.equal(g.out.btn.disabled, false);
});
