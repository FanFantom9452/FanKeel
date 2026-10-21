'use strict';
// The session page's 對話 tab (assets/station/session-talk.js; design
// 2026-10-21-station-redesign §4): the turns the station already loads, each
// one expandable, a stage rule where a stage began, 全部展開 / 收起, the
// load-more button station.js's talkLoad answers, the 專注 dialog with j / k
// / o / Esc, and the states a page with no turns can be in.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page, stringsLeft } = require('./station-module.js');

const MIN = 60e3;
const T0 = Date.parse('2026-10-20T10:00:00.000Z');
const at = (m) => new Date(T0 + m * MIN).toISOString();
const ID = 'cccccccc-3333-4333-8333-333333333333';
const HELD = { total: 7, state: '', turns: [
    { kind: 'user', at: at(1), text: 'look at the plan' },
    { kind: 'claude', at: at(2), text: 'Read it.\nTwo tasks.' },
    { kind: 'compact', at: at(12), trigger: 'auto', preTokens: 317000 },
    { kind: 'summary', at: at(12), text: 'Summary of what came before' },
    { kind: 'interrupt', at: at(13), text: '[Request interrupted by user]' }] };
const STAGES = [{ stage: 'survey', from: T0, to: T0 + 10 * MIN }, { stage: 'build', from: T0 + 10 * MIN, to: T0 + 70 * MIN }];
const T = () => page(['session-talk.js']).M['session-talk.js'];
const tab = (html) => html.slice(0, html.indexOf('<dialog'));

test('every turn is an expandable item, a compaction carries its summary, and a stage rule marks where a stage began', () => {
    const html = tab(T().html(ID, HELD, { stages: STAGES, task: 'talk' }));
    const items = html.match(/<details class="tx-it [^"]*" data-key="tk-\d+"/g) || [];
    assert.deepEqual(items.map((s) => /class="tx-it tx-(u|a|cut|n)"/.exec(s)[1]), ['u', 'a', 'cut', 'n']);
    assert.ok(html.includes('Summary of what came before'), 'the summary is the compaction\'s body');
    assert.ok(html.includes('317k'));
    assert.ok(html.indexOf('--st-survey') < html.indexOf('look at the plan'));
    assert.ok(html.indexOf('look at the plan') < html.indexOf('--st-build'));
    assert.ok(html.indexOf('--st-build') < html.indexOf('317k'));
});

test('全部展開 and 專注 sit on the head; more turns load through data-talk', () => {
    const html = tab(T().html(ID, HELD, {}));
    assert.ok(html.includes('data-stalk-all="1" aria-pressed="false">全部展開</button>'));
    assert.ok(html.includes('data-stalk-focus="1"'));
    assert.ok(html.includes('data-talk="' + ID + '"'));
    assert.ok(html.includes('再載入 100 輪'));
    assert.ok(html.includes('已顯示 5 / 7 輪'));
    const all = T().html(ID, Object.assign({}, HELD, { total: 5 }), {});
    assert.ok(!all.includes('再載入'), 'nothing left to load');
});

test('the 專注 dialog repeats the items with the cursor on the first, and names j, k, o and Esc', () => {
    const html = T().html(ID, HELD, { task: 'talk' });
    const dlg = html.slice(html.indexOf('<dialog'));
    assert.ok(dlg.startsWith('<dialog class="tdlg txf" id="stalk-focus"'));
    assert.equal((dlg.match(/txf-it/g) || []).length, 4);
    assert.match(dlg, /class="tx-it tx-u txf-it is-cur" data-key="fk-0"/);
    for (const k of ['<kbd>j</kbd>', '<kbd>k</kbd>', '<kbd>o</kbd>', '<kbd>Esc</kbd>']) assert.ok(dlg.includes(k), k);
});

test('j and k move the cursor one item and stop at either end', () => {
    const { step } = T();
    assert.equal(step(0, 4, 'j'), 1);
    assert.equal(step(3, 4, 'j'), 3);
    assert.equal(step(2, 4, 'k'), 1);
    assert.equal(step(0, 4, 'k'), 0);
    assert.equal(step(2, 4, 'o'), 2);
    assert.equal(step(5, 0, 'j'), 0);
});

test('a page with no turns says why: missing, static, loading, failed, empty', () => {
    const M = T();
    assert.ok(M.html(ID, { turns: [], total: null, state: 'missing' }).includes('這台機器上已經沒有這個 session 的 transcript'));
    assert.ok(M.html(ID, { turns: [], total: null, state: 'static' }).includes('要從 serve 開的頁面才讀得到對話'));
    assert.ok(M.html(ID, { turns: [], total: null, state: 'loading' }).includes('讀取中…'));
    const failed = M.html(ID, { turns: [], total: null, state: 'failed' });
    assert.ok(failed.includes('讀不到對話') && failed.includes('data-talk="' + ID + '"'));
    assert.ok(M.html(ID, { turns: [], total: 0, state: '' }).includes('transcript 裡沒有可列的對話'));
    assert.ok(M.html(ID, undefined).includes('讀取中…'));
});

test('every string has English, and the classes have rules in session-talk.css', () => {
    const M = T();
    assert.deepEqual(stringsLeft('session-talk.js', M.EN), []);
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'session-talk.css'), 'utf8');
    for (const name of ['.tx-it', '.tx-u', '.tx-a', '.tx-cut', '.tx-div', '.tx-tools', '.tdlg.txf', '.txf-it.is-cur', 'prefers-reduced-motion']) assert.ok(css.includes(name), name);
});

// The module booted on a document that keeps the listeners it adds and hands
// back stand-ins built from the drawn markup: the <dialog> under the id the
// markup gives it, its .txf-it items, the section carrying data-stalk and its
// tab items. A redraw replaces the dialog with a new, closed one, as the
// page's innerHTML does; `gone()` removes it without a close event, as a
// route change does.
function bootDoc() {
    const els = {};
    const listeners = [];
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    let dlgId = null;
    let dlg = null;
    let card = null;
    const document = { getElementById: (id) => (id === dlgId ? dlg : els[id] || (els[id] = el())),
        addEventListener(type, fn) { listeners.push([type, fn]); }, createElement: el, head: { appendChild() {} }, querySelectorAll: () => [] };
    const p = page(['session-talk.js'], {}, { document });
    const timers = [];
    p.win.setTimeout = (fn) => { timers.push(fn); };
    const booted = listeners.length;
    const M = p.M['session-talk.js'];
    const items = (html, pre) => [...html.matchAll(new RegExp('<details class="([^"]*)" data-key="' + pre + '-\\d+"( open)?', 'g'))].map((m) => {
        const cls = new Set(m[1].split(' '));
        return { open: !!m[2], cls, classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) } };
    });
    const draw = (id = ID) => {
        const html = M.html(id, HELD, {});
        dlgId = (html.match(/<dialog[^>]*\bid="([^"]+)"/) || [])[1];
        const fk = items(html, 'fk');
        dlg = { open: false, onclose: null, fk, showModal() { this.open = true; }, close() { this.open = false; if (this.onclose) this.onclose(); },
            querySelectorAll: (sel) => (sel === '.txf-it' ? fk : []) };
        const tk = items(html.slice(html.indexOf('class="tx-scroll"'), html.indexOf('<dialog')), 'tk');
        const cid = (html.match(/<section[^>]*\bdata-stalk="([^"]+)"/) || [])[1];
        card = cid && { tk, getAttribute: (n) => (n === 'data-stalk' ? cid : null), querySelectorAll: (sel) => (sel === '.tx-scroll .tx-it' ? tk : []) };
        timers.splice(0).forEach((fn) => fn());
        return html;
    };
    // A click on the drawn button carrying `attr`: its closest() matches the
    // attributes that button has, and the section around it.
    const click = (html, attr) => {
        const tag = html.match(new RegExp('<button[^>]*\\b' + attr + '="[^"]*"[^>]*>'));
        assert.ok(tag, attr + ' is drawn');
        const names = new Set([...tag[0].matchAll(/([\w-]+)="/g)].map((m) => m[1]));
        const target = { textContent: '', setAttribute(k, v) { this[k] = v; },
            closest: (sel) => { const m = /^\[([\w-]+)\]$/.exec(sel); return !m ? null : names.has(m[1]) ? target : m[1] === 'data-stalk' ? card : null; } };
        for (const [type, fn] of listeners.slice(booted)) if (type === 'click') fn({ target });
        return target;
    };
    const key = (k) => { for (const [type, fn] of listeners.slice(booted)) if (type === 'keydown') fn({ key: k, preventDefault() {} }); };
    const gone = () => { dlgId = null; dlg = null; };
    return { draw, click, key, gone, dialog: () => dlg, card: () => card };
}

test('全部展開 opens every item in the tab and turns into 全部收起; pressed again it shuts them', () => {
    const { draw, click, card } = bootDoc();
    const html = draw();
    const b = click(html, 'data-stalk-all');
    assert.equal(card().tk.length, 4);
    assert.deepEqual(card().tk.map((d) => d.open), [true, true, true, true]);
    assert.equal(b['aria-pressed'], 'true');
    assert.equal(b.textContent, '全部收起');
    const again = draw();
    assert.deepEqual(card().tk.map((d) => d.open), [true, true, true, true], 'a redraw keeps them open');
    click(again, 'data-stalk-all');
    assert.deepEqual(card().tk.map((d) => d.open), [false, false, false, false]);
});

test('專注 opens the dialog, a redraw while open shows the new one, and its close button shuts it', () => {
    const { draw, click, dialog } = bootDoc();
    let html = draw();
    click(html, 'data-stalk-focus');
    assert.equal(dialog().open, true, 'the 專注 button shows the dialog');
    html = draw();
    assert.equal(dialog().open, true, 'the 3 s redraw shows the dialog it drew');
    click(html, 'data-stalk-close');
    assert.equal(dialog().open, false, 'the close button shuts it');
    draw();
    assert.equal(dialog().open, false, 'a redraw after closing leaves it shut');
});

test('in the open dialog j and k move the cursor and o opens and shuts the item under it', () => {
    const { draw, click, key, dialog } = bootDoc();
    click(draw(), 'data-stalk-focus');
    const cur = () => dialog().fk.findIndex((d) => d.cls.has('is-cur'));
    key('j');
    key('j');
    assert.equal(cur(), 2);
    key('k');
    assert.equal(cur(), 1);
    assert.equal(dialog().fk.filter((d) => d.cls.has('is-cur')).length, 1);
    key('o');
    assert.equal(dialog().fk[1].open, true);
    key('o');
    assert.equal(dialog().fk[1].open, false);
    draw();
    assert.equal(cur(), 1, 'the cursor survives the redraw');
});

test('a dialog removed without closing, by a route change, is not reopened when the tab is drawn again', () => {
    const { draw, click, gone, dialog } = bootDoc();
    click(draw(), 'data-stalk-focus');
    assert.equal(dialog().open, true);
    gone();
    draw();
    assert.equal(dialog().open, false, 'the user left the dialog; drawing the tab again does not show it');
    draw();
    assert.equal(dialog().open, false);
});
