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

function readGate(file) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
    let last = null;
    for (const m of text.matchAll(BLOCK)) last = m[1];
    if (last === null) return null;
    try {
        const gate = JSON.parse(last);
        return gate && Array.isArray(gate.questions) && gate.questions.length ? gate : null;
    } catch (e) { return null; }
}

function writeAnswer(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, String(text));
}

module.exports = { handoffPath, commitPath, answerPath, readGate, writeAnswer, lapsUsed };
