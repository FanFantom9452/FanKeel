#!/usr/bin/env node
'use strict';

// UserPromptSubmit. Runs before every single prompt in every session on the
// machine, which fixes two things about how it is written.
//
// It exits 0 on every path. A UserPromptSubmit hook that throws blocks the prompt
// it was called for, and a plugin that can wedge your terminal is worse than no
// plugin. Anything unexpected means say nothing and get out of the way.
//
// A session not in the mode must cost nothing. No entry, or an entry stood down,
// and the process reads one file that is not there and exits — no directories
// created, no flags written, no output.

const path = require('node:path');

const registry = require('../lib/registry.js');
const badge = require('../lib/badge.js');
const { render } = require('../lib/render.js');
const { overlapPaths } = require('../lib/overlap.js');

// Flags belonging to sessions that ended a month ago are litter, not state.
const BADGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function claudeConfigDir() {
    if (process.env.CLAUDE_CONFIG_DIR) return process.env.CLAUDE_CONFIG_DIR;
    const home = process.env.HOME || process.env.USERPROFILE;
    return home ? path.join(home, '.claude') : null;
}

function main(raw) {
    let payload;
    try {
        payload = JSON.parse(raw);
    } catch (e) {
        return;
    }
    if (!payload || typeof payload !== 'object') return;

    const sessionId = payload.session_id;
    const root = registry.rootFor(payload);

    // The mode is on for this session exactly when this session owns an active
    // entry. There is no second flag to disagree with, and no way to be in the
    // mode without having said what you are working on.
    const mine = registry.readSession(root, sessionId);
    if (!mine || mine.active !== true) return;

    const others = registry.readActive(root).filter((e) => e.sessionId !== sessionId);
    const now = Date.now();

    // Output first, side effects after. A failure while refreshing a timestamp or
    // writing a statusline flag must not cost the injection, which is the only
    // reason this process was started.
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'UserPromptSubmit',
            additionalContext: render({ mine: { sessionId, data: mine }, others, now }),
        },
    }));

    try {
        registry.touch(root, sessionId);
    } catch (e) { /* housekeeping */ }

    // Staleness softens a claim rather than withdrawing it, so a stale entry in
    // the same files is still a clash. The other session may be gone, or may be
    // back in a minute; either way you are both editing that file.
    const clash = others.some((o) => overlapPaths(mine.scope, o.data && o.data.scope).length > 0);
    const cfg = claudeConfigDir();
    if (cfg) {
        try {
            badge.writeBadge(cfg, sessionId, badge.badgeWord(mine.stage, clash));
            badge.pruneBadges(cfg, sessionId, BADGE_TTL_MS);
        } catch (e) { /* housekeeping */ }
    }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
    try {
        main(input);
    } catch (e) {
        // Deliberately silent. Whatever went wrong, the prompt still has to go
        // through.
    }
});
process.stdin.on('error', () => {});
