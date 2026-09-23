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
// session that is not in the mode. It writes a permission decision in one case
// only: a stage agent's gate that AskUserQuestion would reject is denied,
// naming the field. Otherwise `updatedInput` alone is not a decision — the
// probe behind this found that a PreToolUse hook returning only `updatedInput`
// still lets the user pick.
// With `stage.agents` naming the task's own stage, that is the field it uses to replace the
// placeholder question with the gate block a stage agent left in its handoff;
// every other session gets none of this, and only the time is noted.

const registry = require('../lib/registry.js');
const docs = require('../lib/docs.js');
const profileLib = require('../lib/profile.js');
const { controlling, nextStage } = require('../lib/stages.js');
const { handoffPath, readGate } = require('../lib/handoff.js');
const { run, parse } = require('../lib/hook.js');

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;

    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;

    try {
        registry.gateOpen(root, payload.session_id);
    } catch (e) { /* housekeeping */ }

    // `stage.agents`: the question is the stage agent's, word for word. What the
    // controller sent is a placeholder and does not count, so nothing it could
    // have mistyped reaches the user. docs/archive/2026-09-19-survey-brain-design.md §6.
    let gate = null;
    try {
        const projectRoot = docs.projectRootsFor(root, mine.project ? [mine.project] : [])[0] || root;
        const values = profileLib.read(projectRoot, mine.configDir || profileLib.configDirOf()).values;
        if (controlling(mine.stage, values)) gate = readGate(handoffPath(root, mine, mine.stage), nextStage(mine.stage, mine.route));
    } catch (e) { /* housekeeping */ }
    if (!gate) return;

    // A gate AskUserQuestion would reject: substituting it would fail the call
    // with a schema error the controller cannot read back to its agent. Deny
    // instead, naming the field, so the controller can send it back.
    if (gate.invalid) {
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: 'fankeel: the gate in ' + handoffPath(root, mine, mine.stage)
                    + ' cannot be asked — `' + gate.invalid + '`: ' + gate.detail + '. SendMessage the stage agent to'
                    + ' rewrite the gate block at the end of that file so `' + gate.invalid + '` holds (option one names'
                    + ' the next stage), then ask again when it returns the path. Do not write the question yourself.',
            },
        }));
        return;
    }

    // The stage agent has handed its gate back, so it is no longer in flight.
    // There is no SubagentStop hook in .claude-plugin/plugin.json; this is the
    // one place the mark is cleared.
    try {
        registry.clearInflight(root, payload.session_id);
    } catch (e) { /* housekeeping */ }

    const updatedInput = Object.assign({}, payload.tool_input || {}, { questions: gate.questions });
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput } }));
}

// Deliberately silent. Whatever went wrong, the question still has to reach
// the user.
run(main);
