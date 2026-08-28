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
const live = require('../lib/live.js');
const { decide, guardMode, targetOf } = require('../lib/guard.js');
const { run, parse } = require('../lib/hook.js');

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;

    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;

    // Asked here rather than left to `decide`, because everything below this line
    // reads a directory and the guard is off unless a session opted in — which is
    // the default, on every Edit in every session on the machine. `decide` asks
    // again so the module stays answerable on its own; two comparisons is not a
    // price worth a second entry point.
    if (!guardMode(mine)) return;

    const file = targetOf(payload);
    if (!file) return;

    const others = registry.readActive(root).filter((e) => e.sessionId !== payload.session_id);
    if (!others.length) return;

    // The official session directory, read once and only after every cheap gate
    // above has answered: no entry, no guard, no path, nobody else in this
    // registry. A session that never asked to be guarded never opens it, and a
    // session with no entry at all pays one failed `readSession` and exits.
    const liveState = live.readLive(live.liveConfigDir(), payload.session_id);

    // The session id goes in so the refusal can print a command that runs as
    // printed. Nothing reaches here without one: `readSession` returns null for a
    // missing id and the entry check above has already returned.
    const verdict = decide({ mine, sessionId: payload.session_id, others, root, file, liveState });
    if (!verdict) return;

    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: verdict.decision,
            permissionDecisionReason: verdict.reason,
        },
    }));
}

// Deliberately silent. Whatever went wrong, the edit still has to be allowed
// to reach the user's own permission rules.
run(main);
