'use strict';
// Editing a task's board from the station's gate page
// (docs/99-archive/2026-10-27-board-upgrade-design.md §3): a Chartroom op
// batch applied with the vendored ops.js — the whole batch or nothing, and
// nothing that adds a reference problem — then the file rewritten. Every
// write and every mark is one line of `<name>.changes.jsonl` beside the
// board; hooks/resume.js reads the ones not yet sent into the gate's answer.
const fs = require('node:fs');
const path = require('node:path');
const board = require('./board.js');

let core = null;
function loadCore() {
    if (!core) {
        core = Promise.all([board.load(), import('./chartroom/core/format.js'), import('./chartroom/core/ops.js')])
            .then(([m, format, ops]) => ({ parse: m.parse, serialize: format.serialize, apply: ops.apply }), (e) => {
                core = null;
                throw e;
            });
    }
    return core;
}

const changesFile = (file) => file.replace(/\.board$/, '.changes.jsonl');

function readLog(file) {
    try { return fs.readFileSync(changesFile(file), 'utf8'); } catch (e) {
        if (e.code === 'ENOENT') return '';
        throw e;
    }
}

// Each line with its raw text: a line that does not parse to a JSON object (a
// write cut short, a stray value) is no change, but a rewrite puts it back as
// it was rather than drop it.
function readEntries(file) {
    return readLog(file).split('\n').filter((l) => l.trim()).map((raw) => {
        let c = null;
        try { c = JSON.parse(raw); } catch (e) { /* kept as raw */ }
        return { raw, c: c && typeof c === 'object' && !Array.isArray(c) ? c : null };
    });
}

const parsed = (entries) => entries.map((e) => e.c).filter(Boolean);
const readChanges = (file) => parsed(readEntries(file));

function writeChanges(file, entries) {
    fs.writeFileSync(changesFile(file), entries.map((e) => (e.c ? JSON.stringify(e.c) : e.raw)).join('\n') + (entries.length ? '\n' : ''));
}

// A torn tail has no newline; without one first the change would glue onto it
// and neither would parse.
function append(file, change) {
    const log = readLog(file);
    fs.appendFileSync(changesFile(file), (log && !log.endsWith('\n') ? '\n' : '') + JSON.stringify(change) + '\n');
    return change;
}

// Applies and renders without writing: each caller writes the board and its
// log line in one synchronous step after the last await, so a render that
// throws changes nothing and no append can land between the two writes.
async function applyTo(file, batch) {
    const m = await loadCore();
    const r = m.apply(m.parse(fs.readFileSync(file, 'utf8')), batch);
    const after = m.serialize(r.doc);
    return { r, after, svg: await board.renderBoard(after) };
}

// applyTo reads the board before its render await, so two writers on one file
// that overlap would each write over the other's change; each call waits for
// the one before it on the same file, and a rejection does not stop the next.
const queues = new Map();
function serial(fn) {
    return (file, ...args) => {
        const key = path.resolve(file);
        const run = (queues.get(key) || Promise.resolve()).then(() => fn(file, ...args));
        const tail = run.catch(() => {});
        queues.set(key, tail);
        tail.then(() => { if (queues.get(key) === tail) queues.delete(key); });
        return run;
    };
}

const editBoard = serial(async (file, batch, text) => {
    const { r, after, svg } = await applyTo(file, batch);
    fs.writeFileSync(file, after);
    const change = append(file, { at: Date.now(), kind: 'edit', text: String(text || '') || r.summary.text, target: null, inverse: r.inverse, sent: false, dropped: false });
    return { svg, change };
});

function markBoard(file, target, note) {
    return append(file, { at: Date.now(), kind: 'mark', text: '標記 ' + target + '：' + String(note || ''), target: String(target), inverse: null, sent: false, dropped: false });
}

function dropTarget(file, at) {
    const entries = readEntries(file);
    const c = parsed(entries)[at];
    if (!c || c.dropped) throw Object.assign(new Error('no change ' + at + ' to drop'), { name: 'NoChange' });
    return { entries, c };
}

const dropChange = serial(async (file, at) => {
    const { c } = dropTarget(file, at);
    const undo = c.kind === 'edit' && c.inverse ? await applyTo(file, c.inverse) : null;
    // Re-read after the await: an append made meanwhile is in the fresh list,
    // and a drop of the same entry meanwhile refuses this one.
    const fresh = dropTarget(file, at);
    if (undo) fs.writeFileSync(file, undo.after);
    fresh.c.dropped = true;
    writeChanges(file, fresh.entries);
    return fresh.c;
});

function boardsIn(dir) {
    return board.listBoards(dir).map((b) => ({ name: b.name, file: path.join(dir, b.name + '.board') }));
}

function pendingChanges(dir) {
    const out = [];
    for (const b of boardsIn(dir)) {
        for (const c of readChanges(b.file)) if (!c.sent && !c.dropped) out.push({ board: b.name, change: c });
    }
    return out;
}

function markSent(dir) {
    let n = 0;
    for (const b of boardsIn(dir)) {
        const entries = readEntries(b.file);
        let hit = false;
        for (const c of parsed(entries)) if (!c.sent && !c.dropped) { c.sent = true; hit = true; n++; }
        if (hit) writeChanges(b.file, entries);
    }
    return n;
}

module.exports = { changesFile, readChanges, editBoard, markBoard, dropChange, pendingChanges, markSent };
