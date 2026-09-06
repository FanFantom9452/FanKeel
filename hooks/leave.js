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

const path = require('node:path');
const registry = require('../lib/registry.js');
const usage = require('../lib/usage.js');
const station = require('../lib/station.js');
const live = require('../lib/live.js');
const { run, parse } = require('../lib/hook.js');

// `spend[stage]` carries the parent's own `{requests, models}` and, when agents
// ran in that stage, a `subagents` sub-object of that same pair — the two fields
// pricing needs, and not the `agents` count or the `wallMs` that
// `usage.subagents` also carries for the whole session. The two are kept apart rather
// than summed because the station's row prints them apart, as `$X + $Y (N
// agents)`; `lib/station.js` prices both for the curve, so the curve totals
// what that cell totals.
//
// A stage where only agents ran still gets an entry, with a zero parent, so
// that `registry.spendOf` — which asks for `models` — finds it rather than
// dropping the stage's whole cost.
function stageSpend(usage) {
    // Both sides are read for keys rather than for presence. `summarise`
    // allocates its `stages` object before the per-request loop, so
    // `usage.stages` is `{}` — present, and truthy — when windows were given
    // and no request could be placed in one, and `main()`'s `if (spend)` would
    // write that straight into the entry as `spend: {}`.
    //
    // The agents' side cannot be `{}` today: `agentsOf` attaches `stages` only
    // once it has a key, so `usage.subagents.stages` is either absent or has
    // one. It is read the same way regardless, because which of the two
    // `lib/usage.js` does is `lib/usage.js`'s business and this hook should not
    // hold an opinion that breaks quietly when it changes. The consequence is
    // worth writing down: no mutation of the agents' half reddens a test, and
    // that is the expected result rather than a gap somebody should go and fill.
    const keyed = (o) => (o && Object.keys(o).length ? o : null);
    const own = keyed(usage.stages);
    const theirs = keyed(usage.subagents && usage.subagents.stages);
    if (!own && !theirs) return null;
    const spend = {};
    for (const [stage, bucket] of Object.entries(own || {})) {
        spend[stage] = { requests: bucket.requests, models: bucket.models };
    }
    for (const [stage, bucket] of Object.entries(theirs || {})) {
        const at = spend[stage] || (spend[stage] = { requests: 0, models: {} });
        at.subagents = { requests: bucket.requests, models: bucket.models };
    }
    return spend;
}

function main(raw) {
    const payload = parse(raw);
    if (!payload || typeof payload.session_id !== 'string') return;

    const sessionId = payload.session_id;
    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, sessionId);
    if (mine) {
        const windows = registry.windowsFrom(mine.clock);
        const seen = typeof payload.transcript_path === 'string'
            ? usage.summariseTree(payload.transcript_path, windows.length ? { stages: windows } : undefined)
            : null;
        const reason = typeof payload.reason === 'string' && payload.reason ? payload.reason.slice(0, 32) : 'other';
        try {
            registry.update(root, sessionId, (d) => {
                d.ended = { at: new Date().toISOString(), reason };
                if (seen) {
                    if (seen.model) d.model = seen.model;
                    d.usage = seen.usage;
                    const spend = stageSpend(seen.usage);
                    if (spend) d.spend = spend;
                    // `d.usage` and `seen.usage` are the same object, so these
                    // deletes remove `stages` from both — but `d.spend` is an
                    // object `stageSpend` built, holding each bucket's `models`
                    // by its own reference and not by a path through `usage`,
                    // so the deletes cannot reach it. Both sides are cleared,
                    // the parent's and the agents', so `usage` keeps exactly
                    // the shape every reader of it already expects.
                    delete d.usage.stages;
                    if (d.usage.subagents) delete d.usage.subagents.stages;
                }
            });
        } catch (e) { /* housekeeping */ }
    }

    try {
        station.write({ configDir: live.liveConfigDir(), cwd: registry.launchRoot(payload), root, plugin: path.resolve(__dirname, '..') });
    } catch (e) { /* housekeeping */ }
}

// Deliberately silent: whatever went wrong, the session is already over.
run(main);
