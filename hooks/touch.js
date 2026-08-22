#!/usr/bin/env node
'use strict';

// PostToolUse on Edit|Write|NotebookEdit. It records the edits that landed
// outside the scope this task declared, and does nothing else.
//
// It is not on PreToolUse, where guard.js already sits, and the reason is that
// hook's own discipline: silence everywhere except a live collision on a session
// that asked to be guarded, because a PreToolUse hook answering on edits it has
// no opinion about overrides the user's own permission rules. Drift is not a
// permission question and must never gate an edit. This observes something that
// already happened.
//
// Same two rules as every other hook here: exit 0 on every path, and cost nothing
// for a session that is not in the mode. It writes no stdout on any path — a
// PostToolUse hook that speaks appends to the transcript, and this fires on every
// edit in every session on the machine.

const registry = require('../lib/registry.js');
const { relPath, covers, targetOf } = require('../lib/guard.js');

function main(raw) {
    let payload;
    try {
        payload = JSON.parse(raw);
    } catch (e) {
        return;
    }
    if (!payload || typeof payload !== 'object') return;

    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;

    const file = targetOf(payload);
    if (!file) return;

    // Outside the registry root is not this registry's business, and a scope
    // entry could not have named it anyway.
    const rel = relPath(root, file);
    if (!rel) return;

    // The common case, and it ends here without a write.
    if (covers(mine.scope, rel)) return;

    try {
        registry.addDrift(root, payload.session_id, rel);
    } catch (e) { /* housekeeping */ }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
    try {
        main(input);
    } catch (e) {
        // Deliberately silent. Whatever went wrong, it happened after the edit
        // landed, and there is nothing left to protect.
    }
});
process.stdin.on('error', () => {});
