'use strict';

// The hard half of collision handling. The injected warning tells you another
// session declared this file; this refuses the edit.
//
// It exists because the argument that killed the survey stage's discipline text
// applies here too: an instruction to check before editing is agreed with and
// then skipped, which is precisely how two terminals end up overwriting each
// other. A warning that only ever warns is that instruction wearing a hook.
//
// It is off by default, and that is not timidity. A block is only as good as the
// `scope` field it reads, nobody yet knows how accurately scope gets declared,
// and a plugin whose first act is to lock you out of your own repository does not
// get a second chance. Opt in per task, per session, with one field.

const path = require('node:path');

const { entriesOverlap } = require('./overlap.js');
const { isStale } = require('./registry.js');

// `ask` puts the collision in front of the user at the moment of the edit and
// lets them decide; `deny` refuses outright. Anything else, the field missing
// included, is off. A bare `true` reads as the cautious one — someone who wrote
// yes without picking a strictness did not ask to be locked out.
function guardMode(data) {
    const raw = data && data.guard;
    if (raw === true) return 'ask';
    if (raw === 'ask' || raw === 'deny') return raw;
    return null;
}

// Repository-relative, forward slashes, or null for anything outside the project
// root. A file elsewhere on the machine is not this registry's business, and a
// scope entry could not have named it anyway.
function relPath(root, file) {
    if (typeof root !== 'string' || typeof file !== 'string' || !root || !file) return null;
    let rel;
    try {
        rel = path.relative(root, path.resolve(root, file));
    } catch (e) {
        return null;
    }
    if (!rel || rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) return null;
    return rel.split(path.sep).join('/');
}

const covers = (scope, rel) =>
    Array.isArray(scope) && scope.some((s) => entriesOverlap(s, rel));

// Edit and Write carry `file_path`; NotebookEdit carries `notebook_path`. A tool
// with neither is not a write this can reason about.
function targetOf(payload) {
    const input = (payload && payload.tool_input) || {};
    for (const key of ['file_path', 'notebook_path']) {
        if (typeof input[key] === 'string' && input[key]) return input[key];
    }
    return null;
}

const startedAt = (data) => {
    const t = Date.parse((data && data.started) || '');
    return Number.isNaN(t) ? null : t;
};

// Whose claim on this file is older. Only asked when both sides declared the
// file, and it is what stops two sessions that both named it from blocking each
// other into a stalemate: the first claim holds, the second yields.
//
// A claim with no readable start time cannot win one of these. Mine having none
// loses by the same rule, so the tie-break never depends on which side is asking.
function claimedFirst(theirs, mine) {
    const t = startedAt(theirs);
    if (t === null) return false;
    const m = startedAt(mine);
    if (m === null) return true;
    return t < m;
}

// The live sessions that hold this file against me, newest claim last.
//
// Stale entries are deliberately not among them. Staleness softens a claim
// rather than withdrawing it, which is right for a warning and wrong for a
// block: a terminal killed yesterday would otherwise hold a file shut until
// somebody found the JSON and edited it by hand.
function blockers(mine, others, rel, now) {
    if (!rel) return [];
    const mineHolds = covers(mine && mine.scope, rel);
    const out = [];
    for (const other of Array.isArray(others) ? others : []) {
        const data = other && other.data;
        if (!covers(data && data.scope, rel)) continue;
        if (isStale(data, now)) continue;
        if (mineHolds && !claimedFirst(data, mine)) continue;
        out.push(other);
    }
    return out;
}

function reasonFor(rel, holders) {
    const lines = [
        'fankeel: ' + rel + ' is inside the declared scope of ' +
        (holders.length === 1 ? 'another live session' : holders.length + ' other live sessions') + '.',
        '',
    ];
    for (const h of holders) {
        const data = (h && h.data) || {};
        const task = (typeof data.task === 'string' && data.task.trim()) || 'untitled';
        const stage = (typeof data.stage === 'string' && data.stage.trim()) || '?';
        lines.push('  - ' + task + ' @ ' + stage);
    }
    lines.push('');
    lines.push('Ways forward: wait for that task, ask it to narrow its scope, or run');
    lines.push('/fankeel and adopt or clear the entry if that session is gone. To go back');
    lines.push('to warnings only, remove `guard` from this session’s entry.');
    return lines.join('\n');
}

// null means say nothing, which is what every path that is not a live collision
// returns. A PreToolUse hook that answers "allow" on every unrelated edit is a
// hook that overrides the user's own permission rules for tools it knows nothing
// about.
function decide({ mine, others, root, file, now }) {
    const mode = guardMode(mine);
    if (!mode) return null;
    const rel = relPath(root, file);
    if (!rel) return null;
    const holders = blockers(mine, others, rel, now);
    if (!holders.length) return null;
    return { decision: mode, reason: reasonFor(rel, holders) };
}

module.exports = { guardMode, relPath, covers, targetOf, claimedFirst, blockers, reasonFor, decide };
