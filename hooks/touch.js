#!/usr/bin/env node
'use strict';

// PostToolUse on Edit|Write|NotebookEdit. It records the files this task has
// actually touched, and does nothing else.
//
// It is not on PreToolUse, where guard.js already sits, and the reason is that
// hook's own discipline: silence everywhere except a live collision on a session
// that asked to be guarded, because a PreToolUse hook answering on edits it has
// no opinion about overrides the user's own permission rules. A claim is not a
// permission question and must never gate an edit. This observes something that
// already happened.
//
// Same two rules as every other hook here: exit 0 on every path, and cost nothing
// for a session that is not in the mode. It writes no stdout on any path — a
// PostToolUse hook that speaks appends to the transcript, and this fires on every
// edit in every session on the machine.

const registry = require('../lib/registry.js');
const { relPath, covers, targetOf } = require('../lib/guard.js');
const { run, parse } = require('../lib/hook.js');

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;

    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;

    const file = targetOf(payload);
    if (!file) return;

    // Outside the registry root is not this registry's business, and nothing
    // reading this registry could resolve a claim on it.
    const rel = relPath(root, file);
    if (!rel) return;

    // The common case, and it ends here without a write. A task editing one file
    // two hundred times touches the registry once, which is what makes this
    // affordable on a hook that fires for every edit in every session.
    if (covers(registry.claimsOf(mine), rel)) return;

    try {
        registry.addClaim(root, payload.session_id, rel);
    } catch (e) { /* housekeeping */ }
}

// Deliberately silent. Whatever went wrong, it happened after the edit
// landed, and there is nothing left to protect.
run(main);
