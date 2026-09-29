'use strict';
// The project page's TODO panel (mockup blocks todo-head, todo-open,
// todo-done): counts off the data file, a done entry's session linked where
// this machine has it and its sha shown where it does not.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: false } };
const V = require('../assets/station/station.js');

const ROW = { pkey: 'F:\\ws', mode: 'folder', folder: 'docs/todo', open: [
    { id: 'a-1', label: 'a', title: 'Ready one', description: 'do `x`', state: 'ready', condition: '', stamp: '' },
    { id: 'b-1', label: 'b', title: 'Blocked one', description: 'wait', state: 'blocked', condition: 'after: y', stamp: '2026-09-20' },
    { id: 'b-2', label: 'b', title: 'Blocked two', description: 'wait more', state: 'blocked', condition: 'after: y', stamp: '2026-09-20' },
], done: [
    { id: 'c-1', label: 'c', title: 'Here', at: '2026-09-29', sha: 'abcdef1234', disposition: 'done', session: 'ssss1111-0000' },
    { id: 'c-2', label: '', title: 'Elsewhere', at: '2026-09-28', sha: '1234567abc', disposition: 'abandoned', session: 'gone0000-0000' },
] };

test('the panel counts open and done entries and carries the three mockup blocks', () => {
    const html = V.todoPanelHtml(ROW, [{ id: 'ssss1111-0000' }]);
    for (const b of ['todo-head', 'todo-open', 'todo-done']) assert.match(html, new RegExp('data-block="' + b + '"'));
    assert.match(html, /未完成 3/);
    assert.match(html, /已完成 2/);
    assert.equal((html.match(/<li class="td-row">/g) || []).length, 5);
    assert.match(html, /<code>x<\/code>/);
    assert.match(html, /class="td-tm rep"/, 'a second entry under the same timing is muted');
    assert.match(html, /href="#\/s\/ssss1111-0000"/);
    assert.match(html, /sha 1234567/);
    assert.doesNotMatch(html, /#\/s\/gone0000/);
});

test('a TODO.md-mode project shows its open entries only, and nothing makes no panel', () => {
    const html = V.todoPanelHtml({ pkey: 'p', mode: 'file', folder: null, open: [ROW.open[0]], done: [] }, []);
    assert.match(html, /未完成 1/);
    assert.doesNotMatch(html, /已完成|data-block="todo-done"/);
    assert.match(html, /td-src[^>]*>TODO\.md</);
    assert.equal(V.todoPanelHtml({ pkey: 'p', mode: 'file', folder: null, open: [], done: [] }, []), '');
    assert.equal(V.todoPanelHtml(null, []), '');
});
