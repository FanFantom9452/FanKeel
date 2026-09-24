#!/usr/bin/env node
'use strict';

// PreToolUse on AskUserQuestion. It marks the moment a gate opened, so the time
// the user spent at it can be told apart from the time the session spent
// working. `hooks/resume.js` is already the other end of the pair, because an
// answer arrives as a tool result rather than as a prompt.
//
// Stop was the obvious hook for this and is the wrong one. It fires when Claude
// finishes responding, and a session pausing on a tool call has not finished
// responding — this pipeline's gate is a tool call, so Stop never fires at one.
//
// Same two rules as guard.js: exit 0 on every path, and cost nothing for a
// session that is not in the mode. It writes a permission decision in two
// cases only: a stage agent's gate that AskUserQuestion would reject is
// denied, naming the field; and a question that looks like an attempted copy
// of that gate (headed with the stage's name) but does not match it word for
// word is denied too, pointing the controller back at the file. Otherwise
// `updatedInput` alone is not a decision — the probe behind this found that a
// PreToolUse hook returning only `updatedInput` still lets the user pick — and
// this file no longer writes one at all: on a controlled stage, the controller
// itself reads the handoff file's own gate and types the real AskUserQuestion
// call, word for word, so there is nothing left to substitute. This file's
// job is validation, not substitution.
//
// With `stage.agents` naming the task's own stage, a valid gate on disk is
// compared against what the controller actually asked (`gateMatches` in
// lib/handoff.js). A match reaching the user is the real gate, correctly
// typed: the in-flight mark clears and nothing more is written. A mismatch
// whose first question is headed with the stage's name reads as a botched
// copy attempt — a paraphrase, a typo, a stale draft — and is denied. Any
// other question, headed with something else entirely, is the controller's
// own and goes out as written, with a message saying so when there is
// something worth saying; every other session gets none of this, and only the
// time is noted.

const registry = require('../lib/registry.js');
const profileLib = require('../lib/profile.js');
const { controlling, nextStage, normaliseRoute, FULL_ROUTE } = require('../lib/stages.js');
const { handoffPath, readGate, skipReason, gateMatches } = require('../lib/handoff.js');
const { run, parse } = require('../lib/hook.js');

// `stage.agents` as the profile holds it, for a sentence.
const agentsText = (values) => {
    const raw = values ? values['stage.agents'] : undefined;
    if (Array.isArray(raw)) return raw.length ? raw.join(',') : 'none';
    return raw === undefined ? 'unset' : String(raw);
};

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;

    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;

    try {
        registry.gateOpen(root, payload.session_id);
    } catch (e) { /* housekeeping */ }

    // `stage.agents`: validate rather than substitute. The controller is the
    // one that typed the AskUserQuestion call now, so what reaches this hook
    // either copies the handoff's gate word for word or it does not.
    // docs/archive/2026-09-19-survey-brain-design.md §6.
    let gate = null;
    let skip = null;
    let file = null;
    let controlled = false;
    let agents = 'unset';
    try {
        const values = profileLib.profileFor(root, mine).values;
        controlled = controlling(mine.stage, values);
        agents = agentsText(values);
        file = handoffPath(root, mine, mine.stage);
        if (controlled) gate = readGate(file, nextStage(mine.stage, mine.route), normaliseRoute(mine.route) || FULL_ROUTE);
        if (!gate || gate.invalid) skip = skipReason({ stage: mine.stage, controlled, agents, inflight: mine.inflight, handoff: file });
    } catch (e) { /* housekeeping */ }

    // No file gate to check against at all — missing file, unreadable, or the
    // stage is not controlled. Silent before 2026-09-24, so a question that was
    // never checked left no trace of which condition failed. A message, not a
    // decision: the question still goes out.
    if (!gate) {
        if (skip) process.stdout.write(JSON.stringify({ systemMessage: 'fankeel: gate not confirmed — ' + skip + '.' }));
        return;
    }

    // A gate AskUserQuestion would reject: the file's own gate must be
    // well-formed even though the controller is the one typing it now. Deny
    // instead, naming the field, so the controller can send it back.
    if (gate.invalid) {
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: 'fankeel: the gate in ' + handoffPath(root, mine, mine.stage)
                    + ' cannot be asked — `' + gate.invalid + '`: ' + gate.detail + '. SendMessage the stage agent to'
                    + ' rewrite the gate block at the end of that file so `' + gate.invalid + '` holds (option one names'
                    + ' the next stage, or a stage on this route to send the work back to), then ask again when it returns the path. Do not write the question yourself.',
            },
        }));
        return;
    }

    const asked = (payload.tool_input && payload.tool_input.questions) || null;
    const matches = gateMatches(asked, gate.questions);

    if (!matches) {
        // Does the question in hand look like an attempt at this gate at all?
        // The same heuristic that used to pick out the placeholder — the first
        // question's header equalling the stage name, any case — now decides
        // whether a mismatch is worth denying (a paraphrase, a typo, a stale
        // copy) or is simply some other question the controller or its agent
        // is legitimately asking, which goes out untouched.
        const first = Array.isArray(asked) && asked[0];
        const looksLikeAttempt = !!first && typeof first.header === 'string'
            && first.header.toLowerCase() === String(mine.stage || '').toLowerCase();
        if (looksLikeAttempt) {
            process.stdout.write(JSON.stringify({
                hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    permissionDecision: 'deny',
                    permissionDecisionReason: 'fankeel: this question does not match ' + file
                        + '\'s `json gate` block word for word. Re-read the file and copy its `questions` array exactly'
                        + ' — do not retype or summarize it — then ask again.',
                },
            }));
            return;
        }
        skip = skipReason({ stage: mine.stage, controlled, matches: false, agents, inflight: mine.inflight, handoff: file });
        if (skip) process.stdout.write(JSON.stringify({ systemMessage: 'fankeel: gate not confirmed — ' + skip + '.' }));
        return;
    }

    // The controller's own AskUserQuestion call already copies the file's gate
    // word for word, so there is nothing to substitute. The stage agent has
    // handed its gate back, so it is no longer in flight. There is no
    // SubagentStop hook in .claude-plugin/plugin.json; this is the one place
    // the mark is cleared.
    try {
        registry.clearInflight(root, payload.session_id);
    } catch (e) { /* housekeeping */ }
}

// Deliberately silent. Whatever went wrong, the question still has to reach
// the user.
run(main);
