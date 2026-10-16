'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');

const e = (id, title, state) => ({ id, label: 'x', title, description: '', state, condition: '', stamp: '' });
const T = { pkey: 'F:\\ws\\a', mode: 'folder', folder: 'docs/todo', open: [e('1', 'R1', 'ready'), e('2', 'B1', 'blocked'), e('3', 'W1', 'watch'), e('4', 'R2', 'ready')],
    done: [{ id: '9', label: 'x', title: 'D1', at: '2026-10-16', sha: 'abc', disposition: 'done' }] };

function page() {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const doc = { getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, head: { appendChild() {} }, querySelectorAll: () => [] };
    const win = { location: { hash: '#/' }, addEventListener() {}, scrollTo() {},
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date().toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-04', serve: false,
            projects: [{ root: 'F:\\ws\\a', todos: [T], gone: false, unreadable: 0, build: [], mapAt: null }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    const box = { window: win, document: doc, URLSearchParams, fetch() {}, module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return box.module.exports;
}

test('the dialog groups a project TODO into four tabs with counts', () => {
    const html = page().dashTodoDialog([T], '#/p/x');
    assert.match(html, /<dialog class="tdlg"/);
    for (const [name, n] of [['Ready', 2], ['Blocked', 1], ['Watch', 1], ['Done', 1]]) assert.match(html, new RegExp('role="tab"[^>]*>' + name + ' <b>' + n + '</b>'));
    assert.match(html, /R1/);
    assert.match(html, /D1/);
});

test('the dialog links on to the page the row pointed at, and each row names its project', () => {
    const V = page();
    assert.match(V.dashTodoDialog([T], '#/p/x'), /<a [^>]*href="#\/p\/x"/);
    assert.match(V.dashTodo([{ root: 'F:\\ws\\a', todos: [T] }]), /class="drow trow" data-tdlg="[^"]+"/);
});

test('a decision entry gets its own tab, and only when there is one', () => {
    const V = page();
    const D = Object.assign({}, T, { open: T.open.concat([e('5', 'X1', 'decision')]) });
    assert.match(V.dashTodoDialog([D], '#/p/x'), /role="tab"[^>]*>Decision <b>1<\/b>/);
    assert.doesNotMatch(V.dashTodoDialog([T], '#/p/x'), />Decision </);
});

test('1 to 4 do not answer a held gate behind an open dialog', () => {
    const at = SRC.indexOf("// 1–4 pick an option of the first held gate");
    const body = SRC.slice(at, SRC.indexOf('\n    });', at));
    const guard = body.indexOf("querySelector('dialog[open]')");
    assert.ok(guard > -1 && guard < body.indexOf('.click()'), 'the handler returns while a dialog is open, before it clicks');
});

