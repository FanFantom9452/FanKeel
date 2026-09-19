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
// session that is not in the mode. It never writes a permission decision:
// `updatedInput` alone is not one — the probe behind this found that a
// PreToolUse hook returning only `updatedInput` still lets the user pick.
// With `stage.agents` on at survey, that is the field it uses to replace the
// placeholder question with the gate block a stage agent left in its handoff;
// every other session gets none of this, and only the time is noted.

const registry = require('../lib/registry.js');
const docs = require('../lib/docs.js');
const profileLib = require('../lib/profile.js');
const { controlling } = require('../lib/stages.js');
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
    // have mistyped reaches the user. docs/plans/2026-09-19-survey-brain-design.md §6.
    let gate = null;
    try {
        const projectRoot = docs.projectRootsFor(root, mine.project ? [mine.project] : [])[0] || root;
        const values = profileLib.read(projectRoot, mine.configDir || profileLib.configDirOf()).values;
        if (controlling(mine.stage, values)) gate = readGate(handoffPath(root, mine, mine.stage));
    } catch (e) { /* housekeeping */ }
    if (!gate) return;

    const updatedInput = Object.assign({}, payload.tool_input || {}, { questions: gate.questions });
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput } }));
}

// Deliberately silent. Whatever went wrong, the question still has to reach
// the user.
run(main);
