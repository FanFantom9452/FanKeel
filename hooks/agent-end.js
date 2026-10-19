#!/usr/bin/env node
'use strict';

// SubagentStop and SubagentStart, for the Pane's agent tree only: a stop
// records when that agent stopped, a start takes the record away again — a
// SendMessage to a stopped agent starts it once more. It never reads or
// writes the registry's `inflight` marks; docs/90-agent/reference/subagents.md
// says why no SubagentStop clears those.
//
// Same rules as every hook here: exit 0 on every path, and nothing at all for
// a session that owns no active task. One thing goes to stdout: the SubagentStop
// refusal below, for a final message past RETURN_CAP.

const registry = require('../lib/registry.js');
const { markEnded, clearEnded } = require('../lib/agentends.js');
const { RETURN_CAP } = require('../lib/render.js');
const { run, parse } = require('../lib/hook.js');

// spend-6: a return stays in the parent's context for the rest of its session.
// Past RETURN_CAP the stop is refused once — stop_hook_active says this stop
// already followed a refusal, so it passes. The judge is left alone: its long
// answer is the record judge.js files (agents/fankeel-judge.md), and
// lib/render.js already leaves RETURN_RULES[0] out of its brief.
function overCap(payload) {
    if (payload.hook_event_name !== 'SubagentStop' || payload.stop_hook_active === true) return null;
    if (/fankeel-judge$/.test(String(payload.agent_type || ''))) return null;
    const text = typeof payload.last_assistant_message === 'string' ? payload.last_assistant_message : '';
    if (text.length <= RETURN_CAP) return null;
    return 'fankeel: your final message is ' + text.length + ' characters, over the ' + RETURN_CAP
        + ' a return may hold, and it stays in the parent\'s context for the rest of the session. Send it again under '
        + RETURN_CAP + ': conclusions and their path:line evidence, no narration. If you can write files, put the detail in one and name its path.';
}

function main(raw) {
    const payload = parse(raw);
    if (!payload || typeof payload.agent_id !== 'string' || !payload.agent_id) return;
    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;
    const refused = overCap(payload);
    if (refused) {
        process.stdout.write(JSON.stringify({ decision: 'block', reason: refused }));
        return;
    }
    try {
        if (payload.hook_event_name === 'SubagentStop') markEnded(root, payload.session_id, payload.agent_id, Date.now());
        else if (payload.hook_event_name === 'SubagentStart') clearEnded(root, payload.session_id, payload.agent_id);
    } catch (e) {
        process.stderr.write('fankeel agent-end: ' + e.message + '\n');
    }
}

run(main);
