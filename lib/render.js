'use strict';

// The text handed to every prompt while the mode is on.
//
// The rules are restated in full each turn rather than pointed at. caveman ships
// its ruleset once at SessionStart and thereafter sends only "CAVEMAN MODE ACTIVE
// (ultra) — session ruleset applies", a pointer whose strength is the salience of
// a target receding by thousands of tokens a turn. The ILS workspace re-injects
// the real rules for the current step on every prompt, and that is the version
// that holds.
//
// Only the current stage's rules are sent, never all five stages'. That is what
// keeps a per-turn restatement affordable, and it is also why the stage has to be
// accurate — rules for the stage you left are worse than none.

const { overlapPaths } = require('./overlap.js');
const { isStale, ageText, notesOf, nextOf } = require('./registry.js');
const { rulesFor } = require('./stages.js');

const scopeOf = (data) => (Array.isArray(data && data.scope) ? data.scope.filter((s) => typeof s === 'string' && s.trim()) : []);
const taskOf = (data) => ((data && typeof data.task === 'string' && data.task.trim()) || 'untitled');
const stageOf = (data) => ((data && typeof data.stage === 'string' && data.stage.trim()) || '?');

// One line per other session. The order is the caller's, which comes from the
// registry sorted by session id, so two runs over one directory read the same.
function otherLine(mineScope, other, now) {
    let line = '  - ' + taskOf(other.data) + ' @ ' + stageOf(other.data);

    const theirScope = scopeOf(other.data);
    if (theirScope.length) line += '  (scope: ' + theirScope.join(', ') + ')';

    const age = isStale(other.data, now) ? ageText(other.data, now) : null;
    if (age) line += '  (last seen ' + age + ' ago)';

    // Only the overlapping line is called out, and it names the specific paths.
    // Marking every line would make the block atmospheric, and a warning nobody
    // can act on is a warning everybody skips.
    const shared = overlapPaths(mineScope, theirScope);
    if (shared.length) line += '  << overlaps: ' + shared.join(', ');

    return line;
}

function render({ mine, others, now }) {
    const data = mine && mine.data;
    const mineScope = scopeOf(data);
    const lines = ['FANKEEL ACTIVE — ' + taskOf(data) + ' @ ' + stageOf(data)];

    if (mineScope.length) lines.push('scope: ' + mineScope.join(', '));

    // Capped at the source, so this is a handful of short lines rather than a
    // growing preamble competing with the work.
    const next = nextOf(data);
    if (next) lines.push('next: ' + next);

    const notes = notesOf(data);
    if (notes.length) {
        lines.push('');
        lines.push('so far:');
        for (const note of notes) lines.push('  - ' + note);
    }

    const rest = Array.isArray(others) ? others : [];
    if (rest.length) {
        lines.push('');
        lines.push('also in progress:');
        for (const other of rest) lines.push(otherLine(mineScope, other, now));
    }

    lines.push('');
    lines.push('stage rules:');
    for (const rule of rulesFor(data && data.stage)) lines.push('  - ' + rule);

    return lines.join('\n');
}

module.exports = { render };
