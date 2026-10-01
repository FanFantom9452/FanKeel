'use strict';
// Three listeners of station.js, each told apart from its neighbours: the page's
// hashchange listener (sel = null, draw(), scrollTo(0, 0)), qClose as the other
// hashchange listener and the search box's blur listener reach it, and the
// document's animationend listener (the click ring). The two hashchange
// listeners are picked by source (the one that is `function qClose` and the one
// that is not), so removing either reddens only its own tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const PK = 'F:\\ws\\alpha';

const session = (id, n) => ({ id, pkey: PK, root: PK, task: 'alpha ' + n, state: 'live', route: ['survey', 'build'], stage: 'build',
    stages: [], notes: [], claims: [], backtracks: 0, updated: NOW - 1000 * (n === 'one' ? 1 : n === 'two' ? 2 : 3), started: NOW - 60000, days: [] });

function boot(hash) {
    const winL = {}, docL = {}, els = {}, timers = [], cleared = [], scrolls = [], log = [];
    let tid = 0;
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', value: '', attrs: {}, style: {}, hidden: false, parentNode: null, ls: {},
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {},
        addEventListener(t, fn) { (this.ls[t] = this.ls[t] || []).push(fn); } });
    const box = el('input');
    const holder = el('div');
    holder.appendChild = (c) => { holder.kid = c; };
    box.parentNode = holder;
    els.q = box;
    const page = el('main');
    let pageHtml = '';
    Object.defineProperty(page, 'innerHTML', { get: () => pageHtml, set: (v) => { log.push('draw'); pageHtml = v; } });
    els.page = page;
    const createElement = (tag) => {
        const o = el(tag);
        let html = '';
        Object.defineProperty(o, 'innerHTML', { get: () => html, set: (v) => { html = v; } });
        o.querySelectorAll = (s) => {
            if (s !== '[data-qi]') return [];
            const rows = [];
            const re = /<a class="[^"]*" id="(qr-\d+)" data-qi="(\d+)" role="option" aria-selected="false" href="([^"]*)"/g;
            let m;
            while ((m = re.exec(html))) {
                rows.push({ attrs: { id: m[1], href: m[3], 'aria-selected': 'false' }, id: m[1],
                    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; }, scrollIntoView() {} });
            }
            return rows;
        };
        return o;
    };
    const win = { location: { hash: hash || '#/list', protocol: 'file:' },
        addEventListener(type, fn) { (winL[type] = winL[type] || []).push(fn); },
        scrollTo(x, y) { log.push('scroll'); scrolls.push([x, y]); },
        setInterval: () => 1,
        setTimeout: (fn, ms) => { const t = { id: ++tid, fn, ms }; timers.push(t); return t.id; },
        clearTimeout: (id) => { cleared.push(id); const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); },
        navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: PK, gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
            sessions: [session('k1', 'one'), session('k2', 'two'), session('k3', 'three')] } };
    const doc = { hidden: false, documentElement: el('html'), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (docL[type] = docL[type] || []).push(fn); }, createElement, querySelectorAll: () => [],
        querySelector: () => ({ parentNode: { insertBefore() {} }, nextSibling: null }), head: { appendChild() {} } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    const p = { win, winL, docL, els, box, timers, cleared, scrolls, log };
    p.page = () => {
        const fns = (winL.hashchange || []).filter((f) => !f.toString().includes('function qClose'));
        assert.equal(fns.length, 1, 'one hashchange listener that is not qClose');
        return fns[0];
    };
    p.closer = () => {
        const fns = (winL.hashchange || []).filter((f) => f.toString().includes('function qClose'));
        assert.equal(fns.length, 1, 'one hashchange listener that is qClose');
        return fns[0];
    };
    p.fire = (target, type, extra) => { const e = Object.assign({ target, preventDefault() {} }, extra); for (const fn of target.ls[type] || []) fn(e); return e; };
    p.open = (v) => { box.value = v || 'alpha'; p.fire(box, 'input'); timers.splice(0).forEach((t) => t.fn()); };
    p.key = (k) => p.fire(box, 'keydown', { key: k });
    p.pop = () => holder.kid;
    // The detail pane names the selected session by its task.
    p.selected = () => { const m = /alpha (one|two|three)/.exec(els.det.innerHTML); return m && m[1]; };
    p.click = (id) => {
        const row = { getAttribute: () => id };
        const tgt = { closest: (s) => (s === 'tr[data-id]' ? row : null), getAttribute: () => null, hasAttribute: () => false };
        const fns = (docL.click || []).filter((f) => f.toString().includes("'tr[data-id]'"));
        assert.equal(fns.length, 1, 'one click listener holds tr[data-id]');
        fns[0]({ target: tgt, preventDefault() {} });
    };
    return p;
}

// ---- the page's hashchange listener ---------------------------------------
test('hashchange: the first row is selected again after a row further down was picked', () => {
    const p = boot('#/list');
    assert.equal(p.selected(), 'one');
    p.click('k3');
    assert.equal(p.selected(), 'three');
    p.page()({});
    assert.equal(p.selected(), 'one');
});

test('hashchange: the page is drawn again for the hash the window now holds', () => {
    const p = boot('#/s/k1');
    assert.ok(p.els.page.innerHTML.includes('alpha one'));
    assert.ok(!p.els.page.innerHTML.includes('alpha two'));
    p.win.location.hash = '#/s/k2';
    p.log.length = 0;
    p.page()({});
    assert.ok(p.log.includes('draw'), 'a draw ran');
    assert.ok(p.els.page.innerHTML.includes('alpha two'));
});

test('hashchange: the window is scrolled once', () => {
    const p = boot('#/list');
    p.page()({});
    assert.equal(p.scrolls.length, 1);
});

test('hashchange: every scroll goes to the top left, (0, 0)', () => {
    const p = boot('#/list');
    p.page()({});
    assert.ok(p.scrolls.every((c) => c.length === 2 && c[0] === 0 && c[1] === 0), JSON.stringify(p.scrolls));
});

test('hashchange: the scroll comes after the draw, with no draw after it', () => {
    const p = boot('#/list');
    p.log.length = 0;
    p.page()({});
    assert.ok(p.log.includes('draw'), 'drew');
    assert.equal(p.log[p.log.length - 1], 'scroll');
    assert.equal(p.log.indexOf('scroll'), p.log.length - 1);
});

test('hashchange: the page listener does not close an open search popover', () => {
    const p = boot('#/list');
    p.open('alpha');
    p.page()({});
    assert.equal(p.pop().hidden, false);
    assert.equal(p.box.attrs['aria-expanded'], 'true');
});

// ---- qClose, through both of its callers ----------------------------------
const CALLERS = {
    hashchange: (p) => p.closer()({}),
    blur: (p) => p.fire(p.box, 'blur'),
};
for (const name of Object.keys(CALLERS)) {
    const go = CALLERS[name];
    test(name + ' -> qClose: an open popover is hidden', () => {
        const p = boot();
        p.open('alpha');
        assert.equal(p.pop().hidden, false);
        go(p);
        assert.equal(p.pop().hidden, true);
    });
    test(name + ' -> qClose: aria-expanded goes back to false', () => {
        const p = boot();
        p.open('alpha');
        assert.equal(p.box.attrs['aria-expanded'], 'true');
        go(p);
        assert.equal(p.box.attrs['aria-expanded'], 'false');
    });
    test(name + ' -> qClose: the active descendant is dropped', () => {
        const p = boot();
        p.open('alpha');
        p.key('ArrowDown');
        assert.ok(p.box.attrs['aria-activedescendant']);
        go(p);
        assert.equal(p.box.getAttribute('aria-activedescendant'), null);
    });
    test(name + ' -> qClose: a draw still waiting on its 200 ms timer is cancelled', () => {
        const p = boot();
        p.box.value = 'alpha';
        p.fire(p.box, 'input');
        const id = p.timers[0].id;
        go(p);
        assert.deepEqual(p.cleared, [id]);
        assert.equal(p.timers.length, 0);
        assert.equal(p.pop(), undefined, 'the popover was never drawn');
    });
    test(name + ' -> qClose: a timer it cancelled is forgotten, a second close does not clear the stale id', () => {
        const p = boot();
        p.box.value = 'alpha';
        p.fire(p.box, 'input');
        const id = p.timers[0].id;
        go(p);
        go(p);
        assert.deepEqual(p.cleared, [id]);
    });
    test(name + ' -> qClose: a timer that already ran is not cleared again', () => {
        const p = boot();
        p.open('alpha');
        go(p);
        assert.deepEqual(p.cleared, []);
    });
    test(name + ' -> qClose: nothing to close (no popover ever drawn) does not throw', () => {
        const p = boot();
        assert.doesNotThrow(() => go(p));
        assert.equal(p.box.attrs['aria-expanded'], 'false');
    });
}

// ---- the click ring's animationend listener -------------------------------
const ring = (p) => {
    assert.equal((p.docL.animationend || []).length, 1, 'one animationend listener');
    return p.docL.animationend[0];
};
const classy = () => { const t = { removed: [], classList: { remove(c) { t.removed.push(c); } } }; return t; };

test('animationend: the kring animation of an element takes its rip class off', () => {
    const p = boot();
    const t = classy();
    ring(p)({ animationName: 'kring', target: t });
    assert.deepEqual(t.removed, ['rip']);
});

test('animationend: any other animation leaves the rip class on', () => {
    const p = boot();
    const t = classy();
    ring(p)({ animationName: 'fade', target: t });
    ring(p)({ animationName: '', target: t });
    assert.deepEqual(t.removed, []);
});

test('animationend: an event with no target does not throw', () => {
    const p = boot();
    assert.doesNotThrow(() => ring(p)({ animationName: 'kring' }));
});

test('animationend: a target with no classList does not throw', () => {
    const p = boot();
    assert.doesNotThrow(() => ring(p)({ animationName: 'kring', target: {} }));
});
