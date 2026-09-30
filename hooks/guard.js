#!/usr/bin/env node
'use strict';

// PreToolUse. Fires before every file-writing tool call in every session on the
// machine, so the same two rules that shape inject.js shape this one: exit 0 on
// every path, and cost nothing for a session that is not in the mode.
//
// It is stricter about staying quiet than inject.js is. A PreToolUse hook that
// answers on edits it has no opinion about would be overriding the user's own
// permission rules for tools this plugin knows nothing about, so silence is the
// answer everywhere except a live collision on a session that asked to be
// guarded.

const registry = require('../lib/registry.js');
const live = require('../lib/live.js');
const { decide, guardMode, targetOf, readOnlyAgentType, writesFiles, brainWriteReason } = require('../lib/guard.js');
const profileLib = require('../lib/profile.js');
const { controlling } = require('../lib/stages.js');
const { run, parse } = require('../lib/hook.js');
const { isCommit, commitVerdict } = require('../lib/sensitive.js');

// The tool names the controlled-stage matcher below cares about. A module
// constant rather than a literal in the condition, for the same reason
// `lib/guard.js`'s `READ_ONLY_AGENTS` is a set: six names compared once
// each read better than six `===`s repeated at every call site.
const WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit']);

// docs/90-agent/plans/2026-09-30-init-design.md §2c: every `git commit` that
// passes through Claude Code, in a task or not. A regex on the command is all
// any other shell call pays; git runs only for a commit.
function emitCommit(root, mine, payload) {
    const command = (payload.tool_input && payload.tool_input.command) || '';
    if (!isCommit(command)) return;
    let mode = 'warn';
    try {
        const values = mine ? profileLib.profileFor(root, mine).values : profileLib.read(root, profileLib.configDirOf()).values;
        if (values['sensitive.mode']) mode = values['sensitive.mode'];
    } catch (e) { /* the builtin, warn */ }
    let verdict = null;
    try {
        verdict = commitVerdict({ cwd: payload.cwd || root, command, mode });
    } catch (e) { /* housekeeping: the commit goes ahead unscanned */ }
    if (verdict) process.stdout.write(JSON.stringify({ hookSpecificOutput: verdict }));
}

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;

    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    const shell = payload.tool_name === 'Bash' || payload.tool_name === 'PowerShell';
    if (!mine || mine.active !== true) {
        if (shell) emitCommit(root, mine, payload);
        return;
    }

    // Asked here rather than left to `decide`, because everything below this line
    // reads a directory. It used to be the gate that mattered: the guard was off
    // unless a session opted in, so almost every edit stopped on this line. Since
    // 2026-08-30 it stops only the sessions that opted out, and the line above is
    // what keeps this off the machine's other terminals. `decide` asks again so
    // the module stays answerable on its own; two comparisons is not a price
    // worth a second entry point.
    //
    // What the default cost, measured 2026-08-30 against a three-entry registry:
    // the reads below run 1.7ms for a session on its own and 6ms where there is
    // a neighbour to check liveness for. Both are inside the noise of spawning
    // the node process this hook already is, which is why the gate moved rather
    // than grew.
    // A second matcher, `Bash|PowerShell`, checked before the collision guard
    // below: six named read-only agent types (READ_ONLY_AGENTS) are denied a command that writes,
    // regardless of `guard` mode — this is about a read-only contract, not
    // about two sessions overlapping a file.
    if (shell) {
        // `agent_type` is set inside a subagent AND on the main thread of a
        // session started with `--agent` — and that second one is a real
        // session that owns tasks and must be able to write. `agent_id` is
        // present only inside a subagent, so both are needed: the id says
        // whether this is a subagent at all, the type says whether it is a
        // read-only one. docs/subagents.md quotes Claude Code's own wording
        // on the field to use — search it for "offered one".
        const command = (payload.tool_input && payload.tool_input.command) || '';
        if (payload.agent_id && readOnlyAgentType(payload.agent_type) && writesFiles(command)) {
            process.stdout.write(JSON.stringify({
                hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    permissionDecision: 'deny',
                    permissionDecisionReason: 'fankeel: this is a subagent call (agent_id is set) with the '
                        + 'read-only agent_type ' + payload.agent_type + ', and this command writes to disk. '
                        + 'Redirect to /dev/null (or $null), or ask for a fankeel-verifier if the result needs '
                        + 'to be written.',
                },
            }));
            return;
        }
        emitCommit(root, mine, payload);
        return;
    }

    // Independent of `guard` mode like the two rules around it: a
    // fankeel-brain's Write lands only in its own session's
    // `.fankeel/build/task-*/`. Only `Write` is checked; `Edit` and
    // `NotebookEdit` are not. Anything outside that tree is untouched.
    if (payload.tool_name === 'Write') {
        const reason = brainWriteReason({ agentType: payload.agent_type, root, file: targetOf(payload), mine });
        if (reason) {
            process.stdout.write(JSON.stringify({
                hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
            }));
            return;
        }
    }

    // A third matcher, `Edit|Write|NotebookEdit`, checked before the collision
    // guard below and independent of `guard` mode entirely: during a stage
    // handed to a stage agent, the controller's own write is refused outright
    // rather than asked about, because the whole point of a controlled stage
    // is that the controller dispatches, relays a path and asks — it does not
    // edit. `agent_id` absent is the main thread, read the same way the
    // Bash|PowerShell matcher above reads it. The profile is read through
    // `profileFor` in lib/profile.js, the way every other hook reads it.
    if (!payload.agent_id && WRITE_TOOLS.has(payload.tool_name)) {
        let controlled = false;
        try {
            const values = profileLib.profileFor(root, mine).values;
            controlled = controlling(mine.stage, values);
        } catch (e) { /* housekeeping */ }
        if (controlled) {
            process.stdout.write(JSON.stringify({
                hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    permissionDecision: 'deny',
                    permissionDecisionReason: 'fankeel: ' + mine.stage + ' is a controlled stage — its stage '
                        + 'agent does the writing here, not the controller. Dispatch it, relay a path, ask.',
                },
            }));
            return;
        }
    }

    // A fourth matcher, `Agent|Task` — both names, because which one the host
    // sends for the subagent tool was not verified when this was added. A
    // `fankeel-brain` dispatched for a stage `stage.agents` does not name has no
    // gate hooks/gate.js will substitute, so the user would be asked the
    // controller's placeholder (2026-09-23, design). Denied before it starts.
    // A profile that cannot be read lets the dispatch through, as above.
    if (payload.tool_name === 'Agent' || payload.tool_name === 'Task') {
        const type = String((payload.tool_input && payload.tool_input.subagent_type) || '').replace(/^fankeel:/, '');
        if (type !== 'fankeel-brain') return;
        let values;
        try {
            values = profileLib.profileFor(root, mine).values;
        } catch (e) { return; }
        if (controlling(mine.stage, values)) return;
        const listed = Array.isArray(values['stage.agents']) && values['stage.agents'].length ? values['stage.agents'].join(',') : 'none';
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: 'fankeel: `' + (mine.stage || 'no stage') + '` is not on stage.agents (' + listed
                    + '), so no fankeel-brain runs it and its gate would never be substituted. Do the stage here, in this session.',
            },
        }));
        return;
    }

    if (!guardMode(mine)) return;

    const file = targetOf(payload);
    if (!file) return;

    const others = registry.readActive(root).filter((e) => e.sessionId !== payload.session_id);
    if (!others.length) return;

    // The official session directory, read once and only after every cheap gate
    // above has answered: no entry, no guard, no path, nobody else in this
    // registry. A session that never asked to be guarded never opens it, and a
    // session with no entry at all pays one failed `readSession` and exits.
    const liveState = live.readLive(live.liveConfigDir(), payload.session_id);

    // The session id goes in so the refusal can print a command that runs as
    // printed. Nothing reaches here without one: `readSession` returns null for a
    // missing id and the entry check above has already returned.
    const verdict = decide({ mine, sessionId: payload.session_id, others, root, file, liveState });
    if (!verdict) return;

    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: verdict.decision,
            permissionDecisionReason: verdict.reason,
        },
    }));
}

// Deliberately silent. Whatever went wrong, the edit still has to be allowed
// to reach the user's own permission rules.
run(main);
