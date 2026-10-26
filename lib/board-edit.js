'use strict';
// Editing a task's board from the station's gate page
// (docs/90-agent/plans/2026-10-27-board-upgrade-design.md §3): a Chartroom op
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

function readChanges(file) {
    let text;
    try { text = fs.readFileSync(changesFile(file), 'utf8'); } catch (e) {
        if (e.code === 'ENOENT') return [];
        throw e;
    }
    return text.split('\n').filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
}

function writeChanges(file, list) {
    fs.writeFileSync(changesFile(file), list.map((c) => JSON.stringify(c)).join('\n') + (list.length ? '\n' : ''));
}

function append(file, change) {
    fs.appendFileSync(changesFile(file), JSON.stringify(change) + '\n');
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

async function editBoard(file, batch, text) {
    const { r, after, svg } = await applyTo(file, batch);
    fs.writeFileSync(file, after);
    const change = append(file, { at: Date.now(), kind: 'edit', text: String(text || '') || r.summary.text, target: null, inverse: r.inverse, sent: false, dropped: false });
    return { svg, change };
}

function markBoard(file, target, note) {
    return append(file, { at: Date.now(), kind: 'mark', text: '標記 ' + target + '：' + String(note || ''), target: String(target), inverse: null, sent: false, dropped: false });
}

function dropTarget(file, at) {
    const list = readChanges(file);
    const c = list[at];
    if (!c || c.dropped) throw Object.assign(new Error('no change ' + at + ' to drop'), { name: 'NoChange' });
    return { list, c };
}

async function dropChange(file, at) {
    const { c } = dropTarget(file, at);
    const undo = c.kind === 'edit' && c.inverse ? await applyTo(file, c.inverse) : null;
    // Re-read after the await: an append made meanwhile is in the fresh list,
    // and a drop of the same entry meanwhile refuses this one.
    const fresh = dropTarget(file, at);
    if (undo) fs.writeFileSync(file, undo.after);
    fresh.c.dropped = true;
    writeChanges(file, fresh.list);
    return fresh.c;
}

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
        const list = readChanges(b.file);
        let hit = false;
        for (const c of list) if (!c.sent && !c.dropped) { c.sent = true; hit = true; n++; }
        if (hit) writeChanges(b.file, list);
    }
    return n;
}

module.exports = { changesFile, readChanges, editBoard, markBoard, dropChange, pendingChanges, markSent };
