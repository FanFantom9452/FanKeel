'use strict';

// Where a stage agent leaves its report, and where the user's answer to its
// gate is left for it. One directory per task, keyed by `started`: `task.js
// adopt` carries it over (`started: source.started`) and `task` keeps it, so a
// renamed or adopted task keeps its handoffs. docs/archive/2026-09-19-survey-brain-design.md §5.

const fs = require('node:fs');
const path = require('node:path');

function dirFor(root, data) {
    const started = data && typeof data.started === 'string' ? data.started : '';
    const stamp = started.replace(/[-:]/g, '').slice(0, 15);
    if (!root || !/^\d{8}T\d{6}$/.test(stamp)) return null;
    return path.join(root, '.fankeel', 'build', 'task-' + stamp).replace(/\\/g, '/');
}

// A rename keeps `started`, so the new task's files sit in the old task's directory.
// `lapped` is the highest lap the old task used, written by `task.js task`; the new
// task's laps are numbered from there. 0 for a task that was never renamed.
const lappedOf = (data) => (data && Number.isInteger(data.lapped) && data.lapped > 0 ? data.lapped : 0);

// How many times a task has entered `stage`, counted from the registry's `moves` — the
// order it entered stages in, stamped by `task.js stage` before anything is dispatched,
// so the visit in progress is already in it.
const visitsOf = (data, stage) => (data && Array.isArray(data.moves) ? data.moves : [])
    .filter((m) => Array.isArray(m) && m[0] === stage).length;

// The lap of a stage: `lapped` plus its visits, and at least the first. `moves` keeps the
// newest 60, so a stage entered more often than that within them repeats a number: a
// known limit, not handled.
function lapOf(data, stage) {
    return lappedOf(data) + Math.max(1, visitsOf(data, stage));
}

// The highest lap number this record has used, for `task.js task` to store as `lapped`
// before it forgets `moves`. At least 1: a record with no moves may still have written
// the first lap of its stage.
function lapsUsed(data) {
    const moves = data && Array.isArray(data.moves) ? data.moves : [];
    const most = Math.max(0, ...moves.filter(Array.isArray).map((m) => visitsOf(data, m[0])));
    return lappedOf(data) + Math.max(1, most);
}

// The first visit keeps the name a stage has always had; the n-th, n >= 2, is
// `<stage>-<n>`, so a return to a stage is a file of its own and never the last lap's.
function fileFor(root, data, stage, suffix) {
    const dir = dirFor(root, data);
    if (!dir || !stage) return null;
    const lap = lapOf(data, stage);
    return dir + '/' + stage + (lap > 1 ? '-' + lap : '') + suffix;
}

function handoffPath(root, data, stage) {
    return fileFor(root, data, stage, '.md');
}

function commitPath(root, data, stage) {
    return fileFor(root, data, stage, '-commit.md');
}

function answerPath(root, data, stage) {
    return fileFor(root, data, stage, '-answer.md');
}

// The last `json gate` block in the report. The last, because a stage agent
// sent back rewrites its report, and a stale block above the new one must not
// win. Null for anything that is not a list of questions: the gate hook then
// leaves the question alone, which is all it did before this file existed.
const BLOCK = /`{3}json gate\r?\n([\s\S]*?)\r?\n`{3}/g;

// Terminal columns rather than characters: a CJK or full-width character takes
// two. Moved here from scripts/todo-check.js so readGate can hold a gate's
// header to AskUserQuestion's cap; todo-check imports it back.
const WIDE = /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/;

function width(s) {
    let n = 0;
    for (const c of String(s).replace(/`/g, '')) n += WIDE.test(c) ? 2 : 1;
    return n;
}

// AskUserQuestion's own cap: twelve characters, six in CJK.
const MAX_HEADER_WIDTH = 12;

// The first field of a gate AskUserQuestion would reject, as a path into it, or
// null. `next` undefined skips option one; a string is the stage option one must
// name; null is the route's end, where option one stands the task down.
function gateProblem(gate, next) {
    for (const [i, q] of gate.questions.entries()) {
        const at = 'questions[' + i + '].';
        if (!q || typeof q.header !== 'string' || !q.header.trim() || width(q.header) > MAX_HEADER_WIDTH) return at + 'header';
        if (typeof q.question !== 'string' || !q.question.trim()) return at + 'question';
        if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4) return at + 'options';
        for (const [j, o] of q.options.entries()) {
            if (!o || typeof o.label !== 'string' || !o.label.trim() || typeof o.description !== 'string') return at + 'options[' + j + ']';
        }
        if ('multiSelect' in q && typeof q.multiSelect !== 'boolean') return at + 'multiSelect';
    }
    if (next !== undefined) {
        const label = gate.questions[0].options[0].label.toLowerCase();
        const want = next ? [String(next).toLowerCase()] : ['down', '收工'];
        if (!want.some((w) => label.includes(w))) return 'questions[0].options[0].label';
    }
    return null;
}

function readGate(file, next) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
    let last = null;
    for (const m of text.matchAll(BLOCK)) last = m[1];
    if (last === null) return null;
    let gate;
    try { gate = JSON.parse(last); } catch (e) { return null; }
    if (!gate || !Array.isArray(gate.questions) || !gate.questions.length) return null;
    // `next` rides along so a pause (`task.js next --from-gate`) still works on
    // a gate the user cannot be shown.
    const bad = gateProblem(gate, next);
    return bad ? { invalid: bad, next: gate.next } : gate;
}

// The `reads:` block a report ends with: one `<path> — <why>` per line, from the last
// line that is exactly `reads:` to the next blank line or fence. The last, for the reason
// `readGate` reads the last block: a rewritten report can carry an older one above it.
function readsOf(file) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return []; }
    const marks = [...text.matchAll(/^reads:[ \t]*$/gm)];
    if (!marks.length) return [];
    const out = [];
    for (const raw of text.slice(marks[marks.length - 1].index).split(/\r?\n/).slice(1)) {
        const l = raw.trim();
        if (!l || l.startsWith('```')) break;
        out.push(l.replace(/^[-*]\s+/, ''));
    }
    return out;
}

// The newest report an earlier stage left for the stage being entered: walk `moves` back
// from the entry before the current one and take the first stage whose report is on disk.
// Each entry is judged as of its own lap, so `moves` is cut at that entry. Null when
// nothing exists — a route whose earlier stages ran in the session itself.
function previousHandoff(root, data) {
    const moves = (data && Array.isArray(data.moves) ? data.moves : []).filter((m) => Array.isArray(m) && typeof m[0] === 'string');
    for (let i = moves.length - 2; i >= 0; i--) {
        const file = handoffPath(root, { started: data.started, lapped: data.lapped, moves: moves.slice(0, i + 1) }, moves[i][0]);
        if (file && fs.existsSync(file)) return file;
    }
    return null;
}

function writeAnswer(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, String(text));
}

module.exports = { handoffPath, commitPath, answerPath, readGate, writeAnswer, lapsUsed, readsOf, previousHandoff, width };
