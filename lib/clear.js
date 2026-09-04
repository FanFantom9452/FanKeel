'use strict';
// The checks `task.js clear` makes, in the order it makes them, ending in the
// one write it does. Returned rather than printed so that the station's server
// can make exactly the same decision from a button that the CLI makes from a
// command line — two copies of this list would be two lists.
//
// Age and not liveness, on purpose, and `docs/collisions.md` says why: a recent
// timestamp is the one sign the owner may simply have stepped away, and
// `--force` exists for the case a reader can see and the registry cannot. The
// server adds a liveness check of its own before calling this, because it has
// just measured liveness for the page; the CLI does not, and keeps its rule.
//
// It never deletes. `active: false` is the whole write, so a claim cleared by
// mistake can be adopted back with its notes and its `next` intact.
const registry = require('./registry.js');

function clearEntry(root, targetId, opts) {
    const { callerId, force, now } = opts || {};
    if (!targetId) return { ok: false, reason: 'none' };
    if (callerId && targetId === callerId) return { ok: false, reason: 'self' };
    if (!registry.sessionPath(root, targetId)) return { ok: false, reason: 'invalid' };

    const data = registry.readSession(root, targetId);
    if (!data) return { ok: false, reason: 'missing' };
    if (data.active !== true) return { ok: false, reason: 'inactive', data };

    const at = typeof now === 'number' ? now : Date.now();
    if (!registry.isStale(data, at) && force !== true) {
        return { ok: false, reason: 'fresh', data, age: registry.ageText(data, at) };
    }

    // The age gate ran on the read a moment ago; the write goes under the
    // target's lock, so a hook of theirs still firing keeps its claim rather
    // than having it rolled back by this deactivation.
    if (!registry.update(root, targetId, (d) => { d.active = false; })) {
        return { ok: false, reason: 'write', data };
    }
    return { ok: true, data };
}

module.exports = { clearEntry };
