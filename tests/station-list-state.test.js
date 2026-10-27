'use strict';
// station-52: 清單's shared state — the selected row, the sort, the 比較 ticks
// and which station/detail/<id>.js scripts were asked for — as its own
// module, assets/station/list-state.js (FK_LIST).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const SRC = fs.readFileSync(path.join(ASSETS, 'list-state.js'), 'utf8');

function load(win, doc) {
    vm.runInNewContext(SRC, { window: win, document: doc, module: { exports: {} } });
    return win.FK_LIST;
}
function fakeDoc() {
    const added = [], scripts = [];
    return { added, scripts, addEventListener(t) { added.push(t); }, createElement: () => ({}), head: { appendChild(el) { scripts.push(el); } } };
}

test('list-state.js sets FK_LIST on updated, newest first, nothing picked, and adds no listener at load', () => {
    const doc = fakeDoc();
    const L = load({}, doc);
    assert.deepEqual(doc.added, []);
    assert.equal(L.sel, null);
    assert.equal(L.sortKey, 'updated');
    assert.equal(L.sortDir, -1);
    assert.deepEqual([...L.picked], []);
});

test('sortBy flips the same column; a new one starts ascending for task, descending otherwise', () => {
    const L = load({}, fakeDoc());
    L.sortBy('updated');
    assert.equal(L.sortDir, 1);
    L.sortBy('task');
    assert.deepEqual([L.sortKey, L.sortDir], ['task', 1]);
    L.sortBy('cost');
    assert.deepEqual([L.sortKey, L.sortDir], ['cost', -1]);
});

test('tick keeps the two newest ticks, oldest first, and an untick drops one', () => {
    const L = load({}, fakeDoc());
    L.tick('a', true);
    L.tick('b', true);
    L.tick('c', true);
    assert.deepEqual([...L.picked], ['b', 'c']);
    L.tick('b', false);
    assert.deepEqual([...L.picked], ['c']);
});

test('need loads station/detail/<id>.js once, shares window.STATION_DETAIL, and records how it ended', () => {
    const win = { STATION_DETAIL: { have: { requests: 1 } } };
    const doc = fakeDoc();
    const L = load(win, doc);
    assert.equal(L.details, win.STATION_DETAIL);
    let redraws = 0;
    L.need({ id: 'have', hasDetail: true }, () => redraws++);
    L.need({ id: 'none', hasDetail: false }, () => redraws++);
    assert.equal(doc.scripts.length, 0);
    L.need({ id: 'a b', hasDetail: true }, () => redraws++);
    L.need({ id: 'a b', hasDetail: true }, () => redraws++);
    assert.equal(doc.scripts.length, 1);
    assert.equal(doc.scripts[0].src, 'station/detail/a%20b.js');
    assert.equal(L.status('a b'), 'loading');
    doc.scripts[0].onerror();
    assert.equal(L.status('a b'), 'failed');
    assert.equal(redraws, 1);
    assert.equal(L.status('never'), null);
});
