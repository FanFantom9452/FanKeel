'use strict';

// The main-thread Stop check behind hooks/stop.js. A controller that ends its
// turn on a status line while its stage is open, with nothing in the background
// that will notify the session, leaves it idle until the user types — the top
// cause in docs/90-agent/judgements/2026-10-22-stage-agent-pause.md. The rules
// schedule a wake-up for three cases only (lib/stages.js AWAIT_RULE); this is
// the catch for the rest.

const fs = require('node:fs');

const ASYNC_AGENT = /Async agent launched/;
const NOTIFIED = /<tool-use-id>([^<]+)<\/tool-use-id>/g;

// Every line of the session transcript, or null when it cannot be read — a
// payload with no transcript is a stop let through, never one refused blind.
function entries(transcriptPath) {
    let raw;
    try {
        raw = fs.readFileSync(transcriptPath, 'utf8');
    } catch (e) {
        return null;
    }
    const out = [];
    for (const line of raw.split('\n')) {
        if (!line) continue;
        try {
            out.push(JSON.parse(line));
        } catch (e) {
            // a half-written last line
        }
    }
    return out;
}

function blocks(entry) {
    const c = entry && entry.message && entry.message.content;
    if (typeof c === 'string') return [{ type: 'text', text: c }];
    return Array.isArray(c) ? c : [];
}

function textOf(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.map((b) => (b && typeof b.text === 'string' ? b.text : '')).join('\n');
    return '';
}

// Work the harness will report on: a Bash or PowerShell call run in the
// background, or an Agent whose result says it launched async — each pending
// until a <task-notification> names its tool-use-id — and a SendMessage, which
// restarts an agent, pending until any notification follows it.
function pendingWork(list) {
    const launched = new Set();
    const agents = new Set();
    let sentAt = -1;
    let notifiedAt = -1;
    list.forEach((entry, i) => {
        if (!entry || entry.isSidechain) return;
        for (const b of blocks(entry)) {
            if (!b || typeof b !== 'object') continue;
            if (entry.type === 'assistant' && b.type === 'tool_use') {
                const input = b.input || {};
                if ((b.name === 'Bash' || b.name === 'PowerShell') && input.run_in_background === true) launched.add(b.id);
                else if (b.name === 'Agent') agents.add(b.id);
                else if (b.name === 'SendMessage') sentAt = i;
            } else if (entry.type === 'user' && b.type === 'tool_result') {
                if (agents.has(b.tool_use_id) && ASYNC_AGENT.test(textOf(b.content))) launched.add(b.tool_use_id);
            } else if (entry.type === 'user' && b.type === 'text' && b.text.includes('<task-notification>')) {
                for (const m of b.text.matchAll(NOTIFIED)) launched.delete(m[1].trim());
                notifiedAt = i;
            }
        }
    });
    return launched.size > 0 || sentAt > notifiedAt;
}

// The reason to refuse this stop, or null. No active task, no stage, a user
// marked away (hooks/gate.js held the question and this turn is meant to end),
// an unreadable transcript or work still pending all let it through.
function refusal(data, transcriptPath) {
    if (!data || data.active !== true || !data.stage) return null;
    if (typeof data.awayAt === 'number') return null;
    const list = entries(transcriptPath);
    if (!list || pendingWork(list)) return null;
    return 'fankeel: ' + data.stage + ' is open and nothing in the background will wake this session.'
        + ' Do the next step now: dispatch it (then run await.js in the background), or ask the stage\'s gate with AskUserQuestion.'
        + ' If you are answering the user or waiting on them, end the turn again; this is asked once.';
}

module.exports = { entries, pendingWork, refusal };
