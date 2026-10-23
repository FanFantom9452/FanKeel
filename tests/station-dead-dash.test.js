'use strict';
// station-52: the 儀表板 and project page that only the OLD.* fallback drew
// are gone, with their TODO panel and its listeners; the .tdlg dialog
// listener the session page and the remote card still use stays.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const JS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');

test('the old dashboard, project page and TODO panel are not defined any more', () => {
    for (const n of ['todoPanelHtml', 'todoGloss', 'todoChip', 'dashPage', 'dashRecent', 'dashXList', 'dashClash', 'dashGateWait', 'dashLanded',
        'dashTodoDialog', 'tdBack', 'homeLive', 'homeLiveRow', 'homeRunning', 'homeTodo', 'homeSpend', 'waitFor', 'waitsOnYou', 'dashRowName',
        'sessionsPage', 'projectsPage', 'projectPage', 'inWindow']) {
        assert.doesNotMatch(JS, new RegExp('function ' + n + '\\('), n);
    }
    assert.doesNotMatch(JS, /data-tdmore|data-tdbody|\[data-tdlg\]/);
});

test('the .tdlg dialog listener and its tabs stay', () => {
    assert.match(JS, /function tdShow\(/);
    assert.match(JS, /t\.closest\('\.tdlg'\)/);
    assert.match(JS, /closest\('\.tdlg \[role=tab\]'\)/);
});

// The .tdlg click listener as the page runs it: station.js booted in a vm
// with a stub document, then its own handler pressed on fake nodes.
const vm = require('node:vm');
const { SRC } = require('./station-src.js');

function press(pick) {
    const listeners = {}, els = {};
    const el = () => ({ tagName: 'DIV', innerHTML: '', textContent: '', className: '', title: '', placeholder: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() { this.focused = true; } });
    const win = { location: { hash: '#/', protocol: 'file:' }, addEventListener() {}, scrollTo() {}, setInterval: () => 1, setTimeout: () => 1, clearTimeout() {},
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        Notification: { permission: 'denied', requestPermission() { return { then() {} }; } }, STATION: { sessions: [], projects: [], profiles: {} } };
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
        createElement: el, querySelectorAll: () => [], querySelector: () => null, head: { appendChild() {} } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => new Promise(() => {}), module: { exports: {} } });
    const click = (listeners.click || []).filter((f) => String(f).includes("closest('.tdlg')"))[0];
    assert.equal(typeof click, 'function', 'a click listener holds the .tdlg branches');

    const tabA = el(), tabB = el(), panelA = el(), panelB = el(), x = el(), inner = el(), dlg = el();
    tabA.attrs['data-st'] = 'a'; tabB.attrs['data-st'] = 'b'; panelA.attrs['data-st'] = 'a'; panelB.attrs['data-st'] = 'b';
    panelB.hidden = true;
    dlg.closed = 0;
    dlg.close = () => { dlg.closed++; };
    dlg.querySelectorAll = (s) => (s === '[role=tab]' ? [tabA, tabB] : s === '[role=tabpanel]' ? [panelA, panelB] : []);
    // a node answers closest() with itself for the one selector it matches
    const within = (n, own) => { n.closest = (s) => (s === '.tdlg' ? dlg : s === own ? n : null); };
    within(tabB, '[role=tab]'); within(x, '[data-tdlg-close]'); within(inner, null);
    dlg.closest = (s) => (s === '.tdlg' ? dlg : null);
    click({ target: { tab: tabB, close: x, backdrop: dlg, inner }[pick] });
    return { dlg, tabA, tabB, panelA, panelB };
}

test('a click on a tab inside a .tdlg dialog shows its panel', () => {
    const r = press('tab');
    assert.equal(r.panelB.hidden, false);
    assert.equal(r.panelA.hidden, true);
    assert.equal(r.tabB.attrs['aria-selected'], 'true');
    assert.equal(r.tabA.attrs['aria-selected'], 'false');
    assert.equal(r.dlg.closed, 0, 'a tab does not close the dialog');
});

test('a click on a [data-tdlg-close] control closes its .tdlg dialog', () => {
    assert.equal(press('close').dlg.closed, 1);
});

test('a click on the .tdlg backdrop itself closes it, one on its content does not', () => {
    assert.equal(press('backdrop').dlg.closed, 1);
    assert.equal(press('inner').dlg.closed, 0);
});
