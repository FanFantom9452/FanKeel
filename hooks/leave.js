#!/usr/bin/env node
'use strict';

// SessionEnd. It records that this session ended, what it spent, and
// regenerates the station page — and does nothing else.
//
// A session ending is not the user standing a task down. `active` is never
// written here: an entry left `active: true` with `ended` on it is exactly what
// the station shows as `stale`, and what `clear` exists to put down on the
// user's say-so. Invariant 2, and the reason a session that dies at a gate is
// still a session somebody has to decide about.
//
// The transcript is read whole, once. `lib/context.js` reads a tail because it
// runs before every prompt; this runs once, when nothing is waiting on it. What
// it costs is the one thing this plan could not measure under `node --test`:
// whether an `async` hook gets to finish a thirteen-megabyte read before the
// process is gone. `verify` measures it by ending a real session.
//
// Same two rules as every hook here: exit 0 on every path, and no stdout —
// a SessionEnd hook that speaks has nobody to speak to.

const registry = require('../lib/registry.js');
const usage = require('../lib/usage.js');
const station = require('../lib/station.js');
const live = require('../lib/live.js');
const { run, parse } = require('../lib/hook.js');

function main(raw) {
    const payload = parse(raw);
    if (!payload || typeof payload.session_id !== 'string') return;

    const sessionId = payload.session_id;
    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, sessionId);
    if (mine) {
        const seen = typeof payload.transcript_path === 'string' ? usage.summariseTree(payload.transcript_path) : null;
        const reason = typeof payload.reason === 'string' && payload.reason ? payload.reason.slice(0, 32) : 'other';
        try {
            registry.update(root, sessionId, (d) => {
                d.ended = { at: new Date().toISOString(), reason };
                if (seen) {
                    if (seen.model) d.model = seen.model;
                    d.usage = seen.usage;
                }
            });
        } catch (e) { /* housekeeping */ }
    }

    try {
        station.write({ configDir: live.liveConfigDir(), cwd: registry.launchRoot(payload) });
    } catch (e) { /* housekeeping */ }
}

// Deliberately silent: whatever went wrong, the session is already over.
run(main);
