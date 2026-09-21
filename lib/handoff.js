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

function handoffPath(root, data, stage) {
    const dir = dirFor(root, data);
    return dir && stage ? dir + '/' + stage + '.md' : null;
}

function commitPath(root, data, stage) {
    const dir = dirFor(root, data);
    return dir && stage ? dir + '/' + stage + '-commit.md' : null;
}

function answerPath(root, data, stage) {
    const dir = dirFor(root, data);
    return dir && stage ? dir + '/' + stage + '-answer.md' : null;
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

module.exports = { handoffPath, commitPath, answerPath, readGate, writeAnswer };
