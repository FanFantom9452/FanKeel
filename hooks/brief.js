#!/usr/bin/env node
'use strict';

// SubagentStart. Fires when a subagent is spawned, background ones included,
// and hands it the part of the parent's situation it has no way to work out for
// itself.
//
// A subagent starts with its own context and none of the parent's. The
// `UserPromptSubmit` injection never reaches it — that one rides on the user's
// prompt, and a subagent does not have one. So without this it does not know
// which task it belongs to, which files are spoken for, or that its own output
// is about to be pasted into somebody else's context forever.
//
// Same two rules as the other hooks: exit 0 on every path, and cost nothing for
// a session that is not in the mode.
//
// A subagent started with an isolated context does not receive this, and that is
// Claude Code's decision rather than something to work around.
//
// The agent type is passed through, and one type — fankeel-judge — gets a
// line of its own in lib/render.js.

const registry = require('../lib/registry.js');
const { renderBrief } = require('../lib/render.js');
const docs = require('../lib/docs.js');
const profileLib = require('../lib/profile.js');
const { run, parse } = require('../lib/hook.js');

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;

    // The subagent inherits its parent's session, so the parent's entry is the
    // one to read. `agent_id` identifies the subagent and is deliberately not
    // used as a registry key: a subagent is not a session, it does not own a
    // task, and giving it an entry would put a second claimant on the parent's
    // own files.
    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;

    // The project's standing answers, read exactly the way hooks/resume.js
    // does: a read failure costs one line, never the brief. Without this,
    // `renderBrief` cannot tell whether `stage.agents` is on, and the brain
    // branch it gates would have to guess.
    let profile;
    try {
        const projectRoot = docs.projectRootsFor(root, mine.project ? [mine.project] : [])[0] || root;
        profile = profileLib.read(projectRoot, mine.configDir || profileLib.configDirOf());
    } catch (e) { /* housekeeping */ }

    const text = renderBrief({ mine: { sessionId: payload.session_id, data: mine }, agentType: payload.agent_type, root, profile });
    if (!text) return;

    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'SubagentStart',
            additionalContext: text,
        },
    }));
}

// Deliberately silent. A subagent that starts without the brief is worse
// informed; a subagent that fails to start is worse than that.
run(main);
