'use strict';

// Where the build stage keeps its place.
//
// The stage runs a task loop without stopping to ask, which is the right shape
// and also the shape that loses everything to a compaction. superpowers names
// this as the most expensive failure they observed: a controller that lost its
// place re-dispatched an entire sequence of already-committed tasks. So progress
// goes in a file, and the file says which plan it belongs to on its first line —
// a ledger for a different plan is somebody else's progress, not a head start.
//
// Two plans can share a basename. That is the one case where reusing a file
// would silently skip tasks nobody ran, so the header is checked rather than the
// path, and a foreign ledger is replaced rather than appended to.

const fs = require('node:fs');
const path = require('node:path');

const HEADER_PREFIX = '# fankeel build ledger — plan: ';
const COMPLETE = /^Task (\d+): complete\b/;

function ledgerPath(root, planFile) {
    const base = path.basename(String(planFile || 'plan'), '.md');
    return path.join(root, '.fankeel', 'build', base, 'progress.md');
}

const header = (planFile) => HEADER_PREFIX + String(planFile || '');

// Exact match on the first line. Merging two plans' progress is how a task gets
// skipped, so anything that is not this plan's header reads as not ours.
function owns(text, planFile) {
    const first = String(text || '').split(/\r?\n/)[0];
    return first === header(planFile);
}

function completed(text) {
    const out = [];
    for (const line of String(text || '').split(/\r?\n/)) {
        const m = COMPLETE.exec(line.trim());
        if (m) out.push(Number(m[1]));
    }
    return out;
}

const completionLine = (n, note) => 'Task ' + n + ': complete — ' + String(note || '').trim();

// A ruling with no cost attached is an opinion. The third field is what makes it
// reviewable later by somebody who was not here when it was made.
const rulingLine = (what, why, cost) =>
    'Ruling: ' + what + ' — ' + why + ' — costs if wrong: ' + cost;

// Creates it if missing, leaves it exactly as it is if it already belongs to this
// plan. Never truncates one of ours: the whole point is that it outlives the
// context that wrote it.
function init(root, planFile) {
    const file = ledgerPath(root, planFile);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let existing = null;
    try {
        existing = fs.readFileSync(file, 'utf8');
    } catch (e) { /* first run */ }
    if (existing === null || !owns(existing, planFile)) {
        fs.writeFileSync(file, header(planFile) + '\n');
    }
    return file;
}

function append(root, planFile, line) {
    const file = init(root, planFile);
    fs.appendFileSync(file, String(line).replace(/\s+$/, '') + '\n');
    return file;
}

module.exports = { ledgerPath, header, owns, completed, completionLine, rulingLine, init, append };
