'use strict';
// The bell panel (station-50): a read note turns grey and stays, only unread
// ones count on the bell, an Editing row can be dismissed, and the panel's
// bookkeeping is pure so it can be driven without a page.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = { STATION: { serve: true } };
const V = require('../assets/station/station.js');

const NOW = Date.UTC(2026, 9, 23, 1, 0, 0);
const PK = 'F:\\ws\\alpha';
const editing = (id) => ({ id: 's-' + id, pkey: PK, root: '/r', tune: { open: 1, done: 0, items: [{ id, block: 'b-' + id, status: 'taken' }] } });

test('an Editing row has a close button, and a read note carries the read class', () => {
    assert.match(V.noteHtml({ id: 'r-1', block: 'b', status: 'edit' }), /class="nt edit"[\s\S]*data-note-x/);
    assert.match(V.noteHtml({ id: 'r-2', block: 'b', status: 'done', read: true }), /class="nt done read"/);
    assert.doesNotMatch(V.noteHtml({ id: 'r-2', block: 'b', status: 'done' }), / read"/);
});

test('floatNotes leaves out an editing row the reader dismissed, and only that one', () => {
    const s = { pkey: PK, tune: { items: [{ id: 'r-1', block: 'b1', status: 'taken' }, { id: 'r-2', block: 'b2', status: 'taken' }] } };
    assert.deepEqual(V.floatNotes([s], [], { [PK + '|r-1']: true }), [{ id: PK + '|r-2', block: 'b2', status: 'edit' }]);
    assert.equal(V.floatNotes([s], []).length, 2);
});

test('the bell counts unread notes and editing rows; a read note is still listed', () => {
    const notes = [{ id: 'a', block: 'x', status: 'done', read: true }, { id: 'b', block: 'y', status: 'rejected' }];
    const some = V.floatHtml([], notes, true, NOW, {}, 'denied');
    assert.match(some, /<span class="fkn">1<\/span>/);
    assert.match(some, /data-note="a"/);
    assert.match(some, /通知 <b>2<\/b>/);
    const all = V.floatHtml([], [notes[0]], true, NOW, {}, 'denied');
    assert.match(all, /<span class="fkn"><\/span>/);
    assert.match(all, /class="nt done read"/);
});

test('清掉通知 shows whenever there is any row, and a dismissed editing row is not drawn', () => {
    const s = editing('r-9');
    assert.match(V.floatHtml([s], [], true, NOW, {}, 'denied'), /data-note-clear/);
    const hidden = V.floatHtml([s], [], true, NOW, {}, 'denied', null, { [PK + '|r-9']: true });
    assert.match(V.floatHtml([s], [], true, NOW, {}, 'denied'), /data-note="[^"]*r-9"/);
    assert.doesNotMatch(hidden, /data-note="[^"]*r-9"/);
    assert.match(hidden, /沒有新通知/);
    assert.doesNotMatch(hidden, /data-note-clear/);
});

test('readAll, dismissNote, clearNotes and the stored id set', () => {
    const notes = [{ id: 'a', block: 'x', status: 'done' }, { id: 'b', block: 'y', status: 'rejected', read: true }];
    const read = V.readAll(notes);
    assert.deepEqual(read.map((n) => n.read), [true, true]);
    assert.equal(notes[0].read, undefined, 'readAll copied');
    assert.deepEqual(V.dismissNote(notes, {}, 'a'), { notes: [notes[1]], gone: {} });
    assert.deepEqual(V.dismissNote(notes, {}, 'r-7'), { notes, gone: { 'r-7': true } });
    const s = editing('r-8');
    assert.deepEqual(V.clearNotes([s], notes, { 'r-1': true }), { notes: [], gone: { 'r-1': true, [PK + '|r-8']: true } });
    assert.deepEqual(V.goneParse('not json'), {});
    assert.deepEqual(V.goneParse(null), {});
    const ids = []; for (let i = 0; i < 105; i++) ids.push('id' + i);
    const parsed = V.goneParse(JSON.stringify(ids));
    assert.equal(Object.keys(parsed).length, 100);
    assert.ok(parsed.id104 && !parsed.id4);
    assert.deepEqual(V.goneKeys({ a: true, b: true }), ['a', 'b']);
});

test('station.css greys a read note', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');
    assert.match(css, /\.nt\.read\{[^}]*opacity:/);
});
