#!/usr/bin/env node
'use strict';

// PreToolUse. Fires before every file-writing tool call in every session on the
// machine, so the same two rules that shape inject.js shape this one: exit 0 on
// every path, and cost nothing for a session that is not in the mode.
//
// It is stricter about staying quiet than inject.js is. A PreToolUse hook that
// answers on edits it has no opinion about would be overriding the user's own
// permission rules for tools this plugin knows nothing about, so silence is the
// answer everywhere except a live collision on a session that asked to be
// guarded.

const registry = require('../lib/registry.js');
const { decide, targetOf } = require('../lib/guard.js');

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

    const others = registry.readActive(root).filter((e) => e.sessionId !== payload.session_id);
    const verdict = decide({ mine, others, root, file, now: Date.now() });
    if (!verdict) return;

    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: verdict.decision,
            permissionDecisionReason: verdict.reason,
        },
    }));
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
    try {
        main(input);
    } catch (e) {
        // Deliberately silent. Whatever went wrong, the edit still has to be
        // allowed to reach the user's own permission rules.
    }
});
process.stdin.on('error', () => {});
