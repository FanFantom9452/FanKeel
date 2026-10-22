#!/usr/bin/env node
'use strict';

// PreToolUse and PostToolUse. For the main thread, each tool call is a step on
// the phone's conversation (lib/phone.js); for a subagent, its context never
// shrinks — every tool result it reads stays in its own transcript until it
// ends — so the only way to keep one from running the way session f44b1c61's
// i18n implementer did (409 requests, 36k to 544k tokens) is to end it before
// it gets there. This hook is design §3's two thresholds: nudge it to hand
// off at SOFT, refuse everything but that handoff at HARD; it also refuses a
// SubagentHandback while an agent the subagent dispatched has not stopped.
//
// Same discipline as every hook here: exit 0 on every path, and cost nothing
// for a call this plugin has no opinion about — which for this hook is
// almost every one, since `agent_id` absent (the main session, or a session
// started with `--agent`) writes its step and returns.

const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const { inspect, SOFT, HARD } = require('../lib/context.js');
const { relayPath, withCheckout } = require('../lib/handoff.js');
const { targetOf } = require('../lib/guard.js');
const { run, parse, refuse } = require('../lib/hook.js');
const { sessionDirOf, agentFiles } = require('../lib/usage.js');
const { outstanding, heldReason } = require('../lib/children.js');
const phone = require('../lib/phone.js');

// brain-1: a child's stop is written by its own SubagentStop hook, which can
// trail the result its parent already holds by a moment, so the hold looks
// once at once, then three more times after a 500 ms pause each (four looks
// over 1.5 s), before it refuses.
const SETTLE_TRIES = 3;
const SETTLE_MS = 500;

// What HARD still allows: writing the relay file this hook is about to tell
// the agent to write. Denying that too would leave it with no way to hand
// off at all, which defeats the mechanism rather than enforcing it.
const RELAY_TOOLS = new Set(['Write', 'Edit']);

// The phone's steps (docs/90-agent/plans/2026-10-22-mobile-session-design.md §3b):
// one chat.jsonl line before each main-thread tool call and one after it, for
// a session with a registry entry. AskUserQuestion is the gate card, no step.
function steps(payload) {
    const tool = String(payload.tool_name || '');
    if (!tool || tool === 'AskUserQuestion') return;
    const root = registry.rootFor(payload);
    if (!registry.readSession(root, payload.session_id)) return;
    const id = String(payload.tool_use_id || '');
    const at = Date.now();
    if (payload.hook_event_name === 'PostToolUse') {
        phone.append(root, payload.session_id, { role: 'tool-end', id, ok: phone.stepOk(payload.tool_response), at });
        return;
    }
    const step = phone.stepOf(tool, payload.tool_input, payload.cwd);
    phone.append(root, payload.session_id, Object.assign({ role: 'tool', id, tool, label: step.label, at }, step.background ? { background: true } : {}));
}

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;
    if (!payload.agent_id) {
        try { steps(payload); } catch (e) { /* housekeeping */ }
        return;
    }

    const root = registry.rootFor(payload);
    const mine = withCheckout(root, registry.readSession(root, payload.session_id), registry.launchRoot(payload));
    if (!mine || mine.active !== true) return;

    // brain-1: a hand-back while an agent this subagent dispatched has not
    // stopped is refused (lib/children.js). On PreToolUse of SubagentHandback
    // rather than as a SubagentStop block: a stage agent that waits ends its
    // turn with `waiting` (agents/fankeel-brain.md), and a stop hook that cannot
    // tell that turn end from a return would refuse the wait itself.
    if (payload.hook_event_name === 'PreToolUse' && payload.tool_name === 'SubagentHandback') {
        let held = outstanding(root, payload.session_id, payload.agent_id, payload.transcript_path);
        for (let i = 0; held.length && i < SETTLE_TRIES; i++) {
            registry.sleepMs(SETTLE_MS);
            held = outstanding(root, payload.session_id, payload.agent_id, payload.transcript_path);
        }
        if (held.length) {
            refuse(heldReason(held));
            return;
        }
    }

    const dir = sessionDirOf(payload.transcript_path);
    if (!dir) return;
    // A workflow's agents write under subagents/workflows/<run>/, not beside the
    // session's own — the layout lib/usage.js already walks. The direct path
    // first: this runs on every tool call of every subagent, and the walk reads
    // a directory.
    let agentFile = path.join(dir, 'subagents', 'agent-' + payload.agent_id + '.jsonl');
    if (!fs.existsSync(agentFile)) {
        const found = agentFiles(dir).find((f) => path.basename(f) === 'agent-' + payload.agent_id + '.jsonl');
        if (found) agentFile = found;
    }
    const info = inspect(agentFile);
    if (!info || !info.used) return;

    const relay = relayPath(root, mine, payload.agent_id)
        || '(no relay path — this session has no readable `started`)';

    if (payload.hook_event_name === 'PreToolUse') {
        if (info.used < HARD) return;
        // budget-1: a brain returns its relay path through SubagentHandback;
        // refusing that leaves its controller nothing to dispatch a fresh one from.
        if (payload.tool_name === 'SubagentHandback') return;
        if (RELAY_TOOLS.has(payload.tool_name)) {
            const target = String(targetOf(payload) || '').replace(/\\/g, '/');
            if (target.includes('.fankeel/build/')) return;
        }
        refuse('fankeel: this subagent is at ' + info.used + ' tokens, over the '
            + HARD + '-token budget hooks/budget.js enforces. Write your progress to ' + relay
            + ' and return that path; every tool but a Write or Edit under .fankeel/build/ is '
            + 'refused until this agent ends.');
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
