'use strict';

// The statusline flag. TokenBar renders anything it finds in
// modes/<session_id>/, so this needs no change on that side: its CollectModes
// accepts any filename matching ^[a-z0-9][a-z0-9-]{0,31}$ and validates a plugin
// it has never heard of on shape alone.
//
// The word is the stage rather than an intensity. An intensity is a constant set
// once and then never looked at, while a statusline earns its space by showing
// what changes. `clash` takes the slot when it applies, because at that moment
// the collision outranks the stage, and the stage is still in the injected text.

const fs = require('node:fs');
const path = require('node:path');

// TokenBar's ReadMode lowercases, strips to [a-z0-9-] and rejects anything longer
// than 16 characters from a plugin it does not know. Doing the same here means
// what lands on disk is what renders, rather than a word silently dropped.
const MAX_WORD = 16;
const SESSION_ID = /^[0-9a-fA-F][0-9a-fA-F-]{7,63}$/;

function badgeWord(stage, clash) {
    if (clash) return 'clash';
    const word = String(stage == null ? '' : stage)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, MAX_WORD);
    return word || 'on';
}

function badgePath(claudeDir, sessionId) {
    if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) return null;
    return path.join(claudeDir, 'modes', sessionId, 'fankeel');
}

function writeBadge(claudeDir, sessionId, word) {
    const file = badgePath(claudeDir, sessionId);
    if (!file) return false;
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, word + '\n');
        return true;
    } catch (e) {
        return false;
    }
}

// Sessions end without warning and their flag files outlive them. Only this
// plugin's own flag is ever removed, and the enclosing directory only when
// nothing else is left in it — caveman and ponytail keep their flags in the same
// place, and tidying is no reason to delete another plugin's state.
//
// Best effort throughout. Pruning is housekeeping; a prompt must never fail over
// it.
function pruneBadges(claudeDir, keepSessionId, maxAgeMs) {
    const modes = path.join(claudeDir, 'modes');
    let names;
    try {
        names = fs.readdirSync(modes);
    } catch (e) {
        return 0;
    }
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;
    for (const name of names) {
        if (name === keepSessionId || !SESSION_ID.test(name)) continue;
        const dir = path.join(modes, name);
        const file = path.join(dir, 'fankeel');
        try {
            if (fs.statSync(file).mtimeMs > cutoff) continue;
            fs.rmSync(file);
            removed++;
            if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
        } catch (e) {
            // No flag of ours here, or it vanished between the read and the
            // unlink. Either way there is nothing to report.
        }
    }
    return removed;
}

module.exports = { MAX_WORD, badgeWord, badgePath, writeBadge, pruneBadges };
