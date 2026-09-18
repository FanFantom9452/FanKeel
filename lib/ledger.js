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

// The same line, with the optional field the range lives in. Two expressions
// rather than one because `completed()` answers "which tasks are done" for a
// loop resuming after a compaction, and that answer must not change shape when
// a ledger predates the field. The bracket sits before the em dash: the note is
// free text, so a trailing field would have to be found by the last delimiter
// the note itself can produce.
//
// The shape is spelled once because both ends read it: this parses it back out,
// and `scripts/ledger.js` refuses anything else on the way in. Two spellings of
// it would drift, and the drift is silent — a range that reaches the file but
// not this regex is reported as a task that recorded none, which is the one
// thing `ranges` exists to tell apart.
const RANGE = '[0-9a-f]{7,40}\\.\\.[0-9a-f]{7,40}';
const COMPLETE_RANGE = new RegExp('^Task (\\d+): complete(?: \\[(' + RANGE + ')\\])?');
const RANGE_ONLY = new RegExp('^' + RANGE + '$');

// A fix that came back from verify, committed and reviewed like a task. It has
// no task number, so it is its own line shape; the range is required on the
// way in — `scripts/ledger.js` refuses without it — because a fix with no
// range is exactly the unreviewed commit this line exists to rule out.
const FIX_RANGE = new RegExp('^Fix:(?: \\[(' + RANGE + ')\\])? — (.*)$');

// What the writer must satisfy. Null and undefined are not ranges: a caller with
// nothing to record passes nothing, and `completionLine` leaves the field out.
const isRange = (s) => RANGE_ONLY.test(String(s || ''));

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

// Every line of `text` that `re` matches once trimmed, as its match array, in order.
function matching(text, re) {
    return String(text || '').split(/\r?\n/).map((line) => re.exec(line.trim())).filter(Boolean);
}

function completed(text) {
    return matching(text, COMPLETE).map((m) => Number(m[1]));
}

// Every completion, with the range it recorded or null. Null is a real answer
// and not a failure: a task completed before this field existed, or by a caller
// that passed no range, is still a completed task.
function completions(text) {
    return matching(text, COMPLETE_RANGE).map((m) => ({ n: Number(m[1]), range: m[2] || null }));
}

function fixes(text) {
    return matching(text, FIX_RANGE).map((m) => ({ what: m[2].trim(), range: m[1] || null }));
}

const fixLine = (what, range) => 'Fix:'
    + (range ? ' [' + range + ']' : '')
    + ' — ' + String(what || '').trim();

// The plan stage's own commit range, recorded once by `init --range` before
// any task runs. It has no task number and no note — `Fix:`'s shape without
// the `— what` half, because there is nothing a range this early could be
// reporting other than "this range is the plan." `ranges` lists it beside
// the tasks and fixes so verify never reads the plan stage's own commits as
// a range nobody claimed.
const PLAN_RANGE = new RegExp('^Plan: \\[(' + RANGE + ')\\]$');

const planLine = (range) => 'Plan: [' + range + ']';

// The recorded range, or null when `init` was never given one — the same
// "real answer, not a failure" reading `completions()` gives a task with no
// range. At most one is ever written; the first is the one `init` wrote.
function planRange(text) {
    const m = matching(text, PLAN_RANGE)[0];
    return m ? m[1] : null;
}

const completionLine = (n, note, range) => 'Task ' + n + ': complete'
    + (range ? ' [' + range + ']' : '')
    + ' — ' + String(note || '').trim();

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

module.exports = { ledgerPath, header, owns, completed, completions, completionLine, isRange, rulingLine, fixLine, fixes, planLine, planRange, init, append };
