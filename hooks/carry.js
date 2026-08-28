#!/usr/bin/env node
'use strict';

// SessionStart, matcher `clear`. It exists because `/clear` is the one
// continuation that changes the session id.
//
// A resumed or compacted session is the same session, and `docs/registry.md`
// says so — which for two releases was the whole list. `/clear` is the third
// case and behaves the other way: it keeps the process and takes a new id, so
// Claude Code rewrites `<config>/sessions/<pid>.json` and the old id leaves the
// running set. The entry it owned is judged dead by every reader at once while
// staying `active: true`, because nothing but the user closes a task. Nothing is
// corrupted and no collision appears — the task simply stops being read, and
// nothing said so.
//
// The matcher is the whole cost control, and it is exact rather than trusted:
// Claude Code matches it against `source`, whose five values are `startup`,
// `resume`, `clear`, `compact` and `fork`. On `clear` alone this never runs at
// an ordinary startup, and `tests/carry.test.js` asserts the manifest rather
// than believing this comment.
//
// It writes nothing. Not the registry, not a badge, not the entry it names.
// Adopting is a decision and standing an entry down is the user's, so a hook
// that did either would be the one thing this registry is built not to do.

const registry = require('../lib/registry.js');
const live = require('../lib/live.js');
const { renderCarry } = require('../lib/render.js');

// At most three, though in practice there is one: the session cleared a second
// ago. More than that is a workspace carrying several abandoned records, and
// listing all of them here would be doing `/fankeel`'s job badly on the one
// prompt where nobody asked for it.
const MOST = 3;

function main(raw) {
    let payload;
    try {
        payload = JSON.parse(raw);
    } catch (e) {
        return;
    }
    if (!payload || typeof payload !== 'object') return;

    // A subagent owns no task and must never be offered one. `agent_id` is the
    // field Claude Code names for exactly this, and it is not `agent_type`: the
    // main thread of an `--agent` session carries a type without an id, and that
    // is a real session which does get the offer.
    if (payload.agent_id) return;

    const sessionId = payload.session_id;
    if (typeof sessionId !== 'string' || !sessionId) return;

    const root = registry.rootFor(payload);
    const now = Date.now();
    const state = live.readLive(live.liveConfigDir(), sessionId);

    const orphans = [];
    for (const entry of registry.readActive(root)) {
        // Reading its own entry back would produce an adopt line naming the
        // reader. A clear gives a new id so this is theoretical, and nothing
        // else stops it.
        if (entry.sessionId === sessionId) continue;
        if (live.isLive(state, entry.sessionId, entry.data.configDir)) continue;
        // Twelve hours is `registry.STALE_MS`, and it is what separates this
        // clear's casualty from a record abandoned last week. The second one is
        // `/fankeel` → Clear out's business and not this hook's.
        if (registry.isStale(entry.data, now)) continue;
        orphans.push(entry);
    }
    if (!orphans.length) return;

    // `readActive` returns the directory sorted by session id, which is stable
    // and says nothing about which task was just put down. Recency does.
    orphans.sort((a, b) => (registry.updatedAt(b.data) || 0) - (registry.updatedAt(a.data) || 0));

    const context = renderCarry({ orphans: orphans.slice(0, MOST), sessionId, now });
    if (!context) return;

    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext: context,
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
        // Deliberately silent. This runs before the first prompt of a session,
        // so an error here would be the first thing that session showed — and
        // the task it is about is not lost by staying unmentioned, only by
        // being forgotten.
    }
});
process.stdin.on('error', () => {});
