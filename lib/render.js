'use strict';

// The text handed to every prompt while the mode is on.
//
// The rules are restated in full each turn rather than pointed at. caveman ships
// its ruleset once at SessionStart and thereafter sends only "CAVEMAN MODE ACTIVE
// (ultra) — session ruleset applies", a pointer whose strength is the salience of
// a target receding by thousands of tokens a turn. ILS re-injects the real rules
// for the current step on every prompt, and that is the version that holds.

const { overlapPaths } = require('./overlap.js');
const { isStale, ageText } = require('./registry.js');

// Sub-project 3 replaces these with the full discipline. They are a placeholder
// only in the sense of being short: R2, R3 and R4 are already agreed, so what is
// here is real and worth obeying rather than filler proving the wiring works.
const STAGE_RULES = [
    'Finish the step you are on. Do not stop where the happy path works and the rest is "later".',
    'When a step completes, ask the next question instead of wrapping up. Always offer a pause option.',
    'Put a question’s background inside the question itself, not in the message above it.',
    'Give every option its trade-off, recommended one first.',
];

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

    const rest = Array.isArray(others) ? others : [];
    if (rest.length) {
        lines.push('');
        lines.push('also in progress:');
        for (const other of rest) lines.push(otherLine(mineScope, other, now));
    }

    lines.push('');
    lines.push('stage rules:');
    for (const rule of STAGE_RULES) lines.push('  - ' + rule);

    return lines.join('\n');
}

module.exports = { render, STAGE_RULES };
