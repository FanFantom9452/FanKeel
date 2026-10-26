'use strict';
// Editing a board on disk (design §3): a batch applied whole or not at all,
// every write and mark logged beside the board, a drop undoing an edit.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');
const E = require('../lib/board-edit.js');

const B = '{"chartroom":1,"root":"v"}\n{"view":"v"}\n{"node":"a","in":"v","label":"A"}\n{"node":"b","in":"v","label":"B"}\n';
function board() {
    const dir = tmp('fankeel-board-edit-');
    const file = path.join(dir, 'arch.board');
    fs.writeFileSync(file, B);
    return { dir, file };
}

test('a rename is written to the file and logged with its text and inverse', async () => {
    const { file } = board();
    const r = await E.editBoard(file, { ops: [{ op: 'set', id: 'a', f: { label: 'Gateway' } }] }, '改名 a：A → Gateway');
    assert.match(fs.readFileSync(file, 'utf8'), /"label":"Gateway"/);
    assert.match(r.svg, /^<svg /);
    const log = E.readChanges(file);
    assert.equal(log.length, 1);
    assert.equal(log[0].kind, 'edit');
    assert.equal(log[0].text, '改名 a：A → Gateway');
    assert.ok(log[0].inverse && Array.isArray(log[0].inverse.ops));
    assert.equal(E.changesFile(file), file.replace(/\.board$/, '.changes.jsonl'));
});

test('a batch that leaves a dangling edge is refused and the file is unchanged', async () => {
    const { file } = board();
    await assert.rejects(E.editBoard(file, { ops: [{ op: 'add', rec: { edge: 'e', in: 'v', from: 'a', to: 'ghost' } }] }, ''),
        (e) => e.name === 'BatchError' && e.errors.some((x) => x.code === 'bad-ref'));
    assert.equal(fs.readFileSync(file, 'utf8'), B);
    assert.deepEqual(E.readChanges(file), []);
});

test('a mark is logged, not written; dropping an edit puts the file back', async () => {
    const { file } = board();
    E.markBoard(file, 'b', '拆成兩個？');
    await E.editBoard(file, { ops: [{ op: 'del', id: 'b' }] }, '刪除節點 b');
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /"node":"b"/);
    await E.dropChange(file, 1);
    assert.match(fs.readFileSync(file, 'utf8'), /"node":"b"/);
    const log = E.readChanges(file);
    assert.deepEqual(log.map((c) => [c.kind, c.dropped]), [['mark', false], ['edit', true]]);
});

test('pendingChanges lists what is not sent or dropped, by board; markSent clears it', async () => {
    const { dir, file } = board();
    E.markBoard(file, 'a', 'one');
    E.markBoard(file, 'b', 'two');
    await E.dropChange(file, 1);
    assert.deepEqual(E.pendingChanges(dir).map((p) => [p.board, p.change.text]), [['arch', '標記 a：one']]);
    assert.equal(E.markSent(dir), 1);
    assert.deepEqual(E.pendingChanges(dir), []);
});

// board-edit reads renderBoard off the module object, so the swap reaches it.
async function withRender(stub, fn) {
    const B2 = require('../lib/board.js');
    const real = B2.renderBoard;
    B2.renderBoard = (text) => stub(text, real);
    try { return await fn(); } finally { B2.renderBoard = real; }
}

test('an edit whose render throws leaves the board untouched and the log empty', async () => {
    const { file } = board();
    await withRender(async () => { throw new Error('render broke'); }, () =>
        assert.rejects(E.editBoard(file, { ops: [{ op: 'set', id: 'a', f: { label: 'Gateway' } }] }, ''), /render broke/));
    assert.equal(fs.readFileSync(file, 'utf8'), B);
    assert.deepEqual(E.readChanges(file), []);
});

test('a mark logged while a drop renders survives the drop', async () => {
    const { file } = board();
    await E.editBoard(file, { ops: [{ op: 'del', id: 'b' }] }, '刪除節點 b');
    await withRender(async (text, real) => { E.markBoard(file, 'a', '途中'); return real(text); }, () => E.dropChange(file, 0));
    assert.match(fs.readFileSync(file, 'utf8'), /"node":"b"/);
    assert.deepEqual(E.readChanges(file).map((c) => [c.kind, c.dropped]), [['edit', true], ['mark', false]]);
});

test('a changes log that cannot be read throws instead of reading as empty', () => {
    const { file } = board();
    fs.mkdirSync(E.changesFile(file));
    assert.throws(() => E.readChanges(file), (e) => e.code === 'EISDIR');
});

test('two edits started together on one board both land', async () => {
    const { file } = board();
    await Promise.all([
        E.editBoard(file, { ops: [{ op: 'set', id: 'a', f: { label: 'Gateway' } }] }, ''),
        E.editBoard(file, { ops: [{ op: 'set', id: 'b', f: { label: 'Store' } }] }, ''),
    ]);
    const text = fs.readFileSync(file, 'utf8');
    assert.match(text, /"label":"Gateway"/);
    assert.match(text, /"label":"Store"/);
    assert.equal(E.readChanges(file).length, 2);
});

test('an edit refused on a board does not hold up the next one on it', async () => {
    const { file } = board();
    const bad = E.editBoard(file, { ops: [{ op: 'add', rec: { edge: 'e', in: 'v', from: 'a', to: 'ghost' } }] }, '');
    const good = E.editBoard(file, { ops: [{ op: 'set', id: 'a', f: { label: 'Gateway' } }] }, '');
    await assert.rejects(bad, (e) => e.name === 'BatchError');
    await good;
    assert.match(fs.readFileSync(file, 'utf8'), /"label":"Gateway"/);
    assert.equal(E.readChanges(file).length, 1);
});
