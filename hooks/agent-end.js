#!/usr/bin/env node
'use strict';

// SubagentStop and SubagentStart, for the Pane's agent tree only: a stop
// records when that agent stopped, a start takes the record away again — a
// SendMessage to a stopped agent starts it once more. It never reads or
// writes the registry's `inflight` marks; docs/90-agent/reference/subagents.md
// says why no SubagentStop clears those.
//
// Same rules as every hook here: exit 0 on every path, nothing on stdout, and
// nothing at all for a session that owns no active task.

const registry = require('../lib/registry.js');
const { markEnded, clearEnded } = require('../lib/agentends.js');
const { run, parse } = require('../lib/hook.js');

function main(raw) {
    const payload = parse(raw);
    if (!payload || typeof payload.agent_id !== 'string' || !payload.agent_id) return;
    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;
    try {
        if (payload.hook_event_name === 'SubagentStop') markEnded(root, payload.session_id, payload.agent_id, Date.now());
        else if (payload.hook_event_name === 'SubagentStart') clearEnded(root, payload.session_id, payload.agent_id);
    } catch (e) {
        process.stderr.write('fankeel agent-end: ' + e.message + '\n');
    }
}

run(main);
