'use strict';

// The hard half of collision handling. The injected warning tells you another
// session is in this file; this refuses the edit.
//
// It exists because the argument that killed the survey stage's discipline text
// applies here too: an instruction to check before editing is agreed with and
// then skipped, which is precisely how two terminals end up overwriting each
// other. A warning that only ever warns is that instruction wearing a hook.
//
// It is off by default, and that is not timidity. A block is only as good as the
// claims it reads, and a claim is recorded after the edit that earned it, so the
// first edit into a file is never claimed at the moment a neighbour looks. A
// plugin whose first act is to lock you out of your own repository does not get a
// second chance. Opt in per task, per session, with one field.

const path = require('node:path');

const { entriesOverlap } = require('./overlap.js');
const { claimsOf } = require('./registry.js');
const { isLive } = require('./live.js');

// Resolved from this file rather than left to the reader, for the reason
// `lib/render.js` gives about its own scripts: a command printed into a session
// has to run exactly as printed, from whatever directory that session is in.
const TASK_SCRIPT = path.join(__dirname, '..', 'scripts', 'task.js');

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
// root. A file elsewhere on the machine is not this registry's business, and no
// claim could have named it anyway.
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

const covers = (claims, rel) =>
    Array.isArray(claims) && claims.some((c) => entriesOverlap(c, rel));

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

// Whose claim on this file is older. Only asked when both sides hold the file,
// and it is what stops two sessions that both touched it from blocking each
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
// Dead sessions are deliberately not among them, and `liveState` is what says
// which those are: a process that exited holds nothing, and a terminal killed
// yesterday would otherwise hold a file shut until somebody found the JSON and
// edited it by hand. Liveness that could not be measured answers true for
// everyone, so an unreadable registry warns too much rather than too little.
function blockers(mine, others, rel, liveState) {
    if (!rel) return [];
    const mineHolds = covers(claimsOf(mine), rel);
    const out = [];
    for (const other of Array.isArray(others) ? others : []) {
        const data = other && other.data;
        if (!covers(claimsOf(data), rel)) continue;
        if (!isLive(liveState, other.sessionId)) continue;
        if (mineHolds && !claimedFirst(data, mine)) continue;
        out.push(other);
    }
    return out;
}

// Everything `blockers` hands back is live by measurement — its process is still
// running. `clear` refuses a claim it cannot see behind, so the command has to
// carry `--force` or it is a recommendation that fails on the first try, every
// time.
//
// `adopt` is not offered as a way out. A guarded session owns an active task by
// definition, and that is exactly the caller `cmdAdopt` refuses.
function reasonFor(rel, holders, sessionId) {
    const lines = [
        'fankeel: ' + rel + ' is claimed by ' +
        (holders.length === 1 ? 'another live session' : holders.length + ' other live sessions') + '.',
        '',
    ];
    for (const h of holders) {
        const data = (h && h.data) || {};
        const task = (typeof data.task === 'string' && data.task.trim()) || 'untitled';
        const stage = (typeof data.stage === 'string' && data.stage.trim()) || '?';
        lines.push('  - ' + task + ' @ ' + stage);
        lines.push('    node ' + TASK_SCRIPT + ' clear ' + h.sessionId + ' --force --session ' + sessionId);
    }
    lines.push('');
    lines.push('Wait for that task, or ask that session to move off the file. The command');
    lines.push('under it puts the claim down without taking the task over, for the case');
    lines.push('where you can see the terminal is gone and the registry cannot.');
    lines.push('');
    lines.push('`--force` is required there rather than optional: a claim only blocks while');
    lines.push('it is live, so `clear` refuses every entry named above without it. Forcing');
    lines.push('deletes nothing — the entry stays adoptable, though not by this session,');
    lines.push('which owns an active task of its own and would be refused.');
    lines.push('');
    lines.push('To go back to warnings only, remove `guard` from this session’s entry.');
    return lines.join('\n');
}

// null means say nothing, which is what every path that is not a live collision
// returns. A PreToolUse hook that answers "allow" on every unrelated edit is a
// hook that overrides the user's own permission rules for tools it knows nothing
// about.
function decide({ mine, sessionId, others, root, file, liveState }) {
    const mode = guardMode(mine);
    if (!mode) return null;
    const rel = relPath(root, file);
    if (!rel) return null;
    const holders = blockers(mine, others, rel, liveState);
    if (!holders.length) return null;
    return { decision: mode, reason: reasonFor(rel, holders, sessionId) };
}

module.exports = { guardMode, relPath, covers, targetOf, claimedFirst, blockers, reasonFor, decide };
