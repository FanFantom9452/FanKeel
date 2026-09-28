#!/usr/bin/env node
'use strict';

// PreToolUse and PostToolUse, subagent-only. A subagent's context never
// shrinks — every tool result it reads stays in its own transcript until it
// ends — so the only way to keep one from running the way session f44b1c61's
// i18n implementer did (409 requests, 36k to 544k tokens) is to end it before
// it gets there. This hook is design §3's two thresholds: nudge it to hand
// off at SOFT, refuse everything but that handoff at HARD.
//
// Same discipline as every hook here: exit 0 on every path, and cost nothing
// for a call this plugin has no opinion about — which for this hook is
// almost every one, since `agent_id` absent (the main session, or a session
// started with `--agent`) returns before anything else runs.

const registry = require('../lib/registry.js');
const { inspect, SOFT, HARD } = require('../lib/context.js');
const { relayPath } = require('../lib/handoff.js');
const { targetOf } = require('../lib/guard.js');
const { run, parse } = require('../lib/hook.js');

// What HARD still allows: writing the relay file this hook is about to tell
// the agent to write. Denying that too would leave it with no way to hand
// off at all, which defeats the mechanism rather than enforcing it.
const RELAY_TOOLS = new Set(['Write', 'Edit']);

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;
    if (!payload.agent_id) return;

    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;

    const info = inspect(payload.transcript_path);
    if (!info || !info.used) return;

    const relay = relayPath(root, mine, payload.agent_id)
        || '(no relay path — this session has no readable `started`)';

    if (payload.hook_event_name === 'PreToolUse') {
        if (info.used < HARD) return;
        if (RELAY_TOOLS.has(payload.tool_name)) {
            const target = String(targetOf(payload) || '').replace(/\\/g, '/');
            if (target.includes('.fankeel/build/')) return;
        }
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: 'fankeel: this subagent is at ' + info.used + ' tokens, over the '
                    + HARD + '-token budget hooks/budget.js enforces. Write your progress to ' + relay
                    + ' and return that path; every tool but a Write or Edit under .fankeel/build/ is '
                    + 'refused until this agent ends.',
            },
        }));
        return;
    }

    if (payload.hook_event_name === 'PostToolUse') {
        if (info.used < SOFT) return;
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'PostToolUse',
                additionalContext: 'fankeel: this subagent is at ' + info.used + ' tokens, over the ' + SOFT
                    + '-token soft budget. Finish this step, then write your progress to ' + relay
                    + ' and report that path so a fresh agent can continue from it.',
            },
        }));
    }
}

run(main);
