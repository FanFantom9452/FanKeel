#!/usr/bin/env node
'use strict';

// UserPromptSubmit. Runs before every single prompt in every session on the
// machine, which fixes two things about how it is written.
//
// It exits 0 on every path. A UserPromptSubmit hook that throws blocks the prompt
// it was called for, and a plugin that can wedge your terminal is worse than no
// plugin. Anything unexpected means say nothing and get out of the way.
//
// A session not in the mode must stay cheap. No entry and an ordinary prompt, and
// the process reads two files that are not there and exits — the registry entry
// and its own statusline flag — with no directories created, no flags written and
// no output.

const path = require('node:path');

const registry = require('../lib/registry.js');
const live = require('../lib/live.js');
const badge = require('../lib/badge.js');
const { render, renderInit } = require('../lib/render.js');
const { overlapPaths } = require('../lib/overlap.js');
const { positionIn } = require('../lib/stages.js');

// The one prompt trying to turn the mode on. Everything else in this hook keys
// off the registry, and at this moment there is nothing in it: `/fankeel` runs
// orient, reads the map and runs the scanner before it writes an entry, and on a
// large project that is minutes of a statusline saying nothing at all.
//
// `/fankeel-audit` deliberately does not match. It starts no task, so a badge for
// it would have nothing to become.
const startsFankeel = (prompt) =>
    /^[/@$]fankeel(:fankeel)?(\s|$)/i.test(String(prompt == null ? '' : prompt).trim());

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
    const launch = registry.launchRoot(payload);
    const root = registry.rootFor(payload);

    // The mode is on for this session exactly when this session owns an active
    // entry. There is no second flag to disagree with, and no way to be in the
    // mode without having said what you are working on.
    const mine = registry.readSession(root, sessionId);
    if (!mine || mine.active !== true) {
        const starting = startsFankeel(payload.prompt);

        // The one prompt where the id is about to be typed into `task.js`, and
        // the only moment anything here can say what it is. Nothing else on
        // screen can be trusted to: a background task's output directory and a
        // scratch directory both carry a session id in this exact shape, and
        // they are not always this session's. One real session wrote its whole
        // entry under one of those while every hook here read the other — two
        // hours, no injections, no claims, and nothing anywhere said so, because
        // a miss is what a session that never used the plugin looks like and
        // that is the common case worth staying quiet for.
        //
        // Output before the side effects, the same order the injection below
        // keeps and for the same reason.
        //
        // `sessionPath` is the shape check, borrowed rather than repeated: it
        // answers null for anything that is not a session id. What it is doing
        // here is refusing to read an unvalidated payload field back into the
        // conversation — the id is Claude Code's to send, not this hook's to
        // vouch for.
        if (starting && registry.sessionPath(root, sessionId)) {
            process.stdout.write(JSON.stringify({
                hookSpecificOutput: {
                    hookEventName: 'UserPromptSubmit',
                    additionalContext: renderInit({ sessionId }),
                },
            }));
        }

        const dir = claudeConfigDir();
        if (dir) {
            try {
                if (!mine && starting) {
                    // Step 0 of a route nobody has chosen, so there is no
                    // denominator either. Seven used to go here, being what
                    // `task.js start` defaults to with no class given, and a
                    // `bounded` task then showed five where it had just shown
                    // seven. A count the next command contradicts is worse than
                    // no count: with `steps` absent the statusline draws none
                    // until a route exists to draw. TokenBar's `StepDots`
                    // returns nothing without a denominator and says why —
                    // "inventing a denominator would draw a progress bar out of
                    // nothing" — so this is its contract, not a workaround.
                    badge.writeBadge(dir, sessionId, 'init');
                    badge.writeLead(dir, sessionId, { word: 'init', step: 0 });
                } else if (mine || badge.readBadge(dir, sessionId) === 'init') {
                    // An entry that exists but is stood down means this session
                    // *was* in the mode and its badge still says otherwise. An
                    // `init` with no entry behind it is one this hook raised for a
                    // `/fankeel` that never started anything. Only those two — a
                    // session that never used the plugin is left alone, which is
                    // what keeps it free.
                    badge.clearBadge(dir, sessionId);
                    badge.clearLead(dir, sessionId);
                }
            } catch (e) { /* housekeeping */ }
        }
        return;
    }

    const others = registry.readActive(root).filter((e) => e.sessionId !== sessionId);
    const now = Date.now();

    // One scan, read three times. Staleness used to soften a claim here and
    // withdraw it in the guard, and both readings were defensible while liveness
    // was a guess: a warning should err loud, a block should err quiet. It is
    // measured now, and a session whose process has exited is not in your files
    // under any reading. So the badge, the lead count and the text below are all
    // taken from this one filter, and a prompt can no longer say a neighbour is
    // in your files and gone from them at once.
    const liveState = live.readLive(live.liveConfigDir(), sessionId);
    const mineClaims = registry.claimsOf(mine);
    const alive = others.filter((o) => live.isLive(liveState, o.sessionId, o.data && o.data.configDir));
    const overlapping = alive.filter((o) => overlapPaths(mineClaims, registry.claimsOf(o.data)).length > 0).length;

    // Output first, side effects after. A failure while refreshing a timestamp or
    // writing a statusline flag must not cost the injection, which is the only
    // reason this process was started. The scan above is not a side effect: it
    // reads the official registry and writes nothing anywhere.
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'UserPromptSubmit',
            additionalContext: render({ mine: { sessionId, data: mine }, others: alive, now, root, launch, transcript: payload.transcript_path }),
        },
    }));

    try {
        registry.touch(root, sessionId);
    } catch (e) { /* housekeeping */ }

    const cfg = claudeConfigDir();
    if (cfg) {
        try {
            badge.writeBadge(cfg, sessionId, badge.badgeWord(mine.stage, overlapping > 0));
            // The lead line, kept current from here because only this hook sees
            // a collision that appeared after the task was last touched. The
            // count is of live sessions actually overlapping, not of live
            // sessions — a number nobody can act on is decoration.
            //
            // The badge collapses to `clash` because a shared line has room for
            // one word and at that moment the collision outranks the stage. The
            // lead line has no such shortage: it states the collision in its own
            // field, and `others` is where a reader already looks for it. Sending
            // the collapsed word here too would say the same thing twice while
            // destroying the one fact with nowhere else on the line to live.
            const at = positionIn(mine.route, mine.stage) || {};
            badge.writeLead(cfg, sessionId, {
                word: badge.badgeWord(mine.stage, false),
                step: at.step,
                steps: at.steps,
                title: mine.task,
                where: mineClaims.join(' '),
                guard: mine.guard,
                others: overlapping > 0 ? overlapping : '',
            });
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
