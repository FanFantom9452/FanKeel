#!/usr/bin/env node
'use strict';

// PreToolUse on the desktop app's next-step box, mcp__ccd_turn__wrap_up.
// Its `ask` and `actions` put a decision to the user inside the app's own
// card, which the station gate never sees and which does not mark the session
// as waiting (docs/90-agent/todo/station-48.md). While a fankeel task is
// active a call that carries either is refused, and AskUserQuestion — the tool
// hooks/gate.js watches — is asked for instead. A recap alone passes: the box
// keeps its job of closing a turn.
//
// "ask" as a permissionDecision would raise the host's tool-permission prompt,
// which is neither the station gate nor a question; a refusal is what sends
// the session to the right tool.
//
// Same rules as every hook here: exit 0 on every path, and nothing at all for
// a session that owns no active task.

const registry = require('../lib/registry.js');
const { run, parse, refuse } = require('../lib/hook.js');

function asksDecision(input) {
    if (!input || typeof input !== 'object') return false;
    if (typeof input.ask === 'string' && input.ask.trim() !== '') return true;
    return Array.isArray(input.actions) && input.actions.length > 0;
}

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;
    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;
    if (!asksDecision(payload.tool_input)) return;
    refuse('fankeel: the next-step box is for a recap, not a decision — its ask and buttons never reach the station gate, and the sidebar does not show the session as waiting. '
        + 'Put the question to the user with AskUserQuestion, and call wrap_up again with the recap alone.');
}

run(main);
