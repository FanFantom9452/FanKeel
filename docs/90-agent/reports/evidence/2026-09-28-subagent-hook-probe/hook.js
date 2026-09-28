#!/usr/bin/env node
'use strict';
// One-shot: answers the two questions docs/90-agent/plans/2026-09-28-agent-lifetime-design.md's
// "尚未證實" section names, copying the shape docs/90-agent/reports/2026-09-11-hook-payload-probe.md's
// probe-hook.js used — one script, no matcher, appending one JSON line per event to
// probe-log.jsonl beside it. Three behaviours that script did not have: a nonce in
// SubagentStart's own additionalContext, a nonce in a PostToolUse additionalContext after a
// subagent's Read, and a nonce in a PreToolUse deny reason for a subagent's Glob — each
// prefixed so a search for `PROBE-` finds every one of them at once. The nonce is a fixed
// literal rather than a random value, the same reason 2026-09-07's probe used a fixed NEEDLE
// rather than one generated per run: what matters is that it could not already be in a
// subagent's context by coincidence, not that it differs between runs.
//
// `node hook.js summarise` reads the log back and prints the table the report's findings
// section quotes; every other invocation is Claude Code itself, feeding the payload on stdin.
const fs = require('fs');
const path = require('path');

const LOG = path.join(__dirname, 'probe-log.jsonl');
const NONCE = 'lifetime-2026-09-28';

function parseLog(text) {
    const rows = String(text || '').split(/\r?\n/).filter(Boolean).map((l) => {
        try { return JSON.parse(l); } catch (e) { return null; }
    }).filter(Boolean);
    const emitted = rows.map((r) => r.emitted).filter(Boolean);
    const has = (p) => emitted.some((e) => String(e).startsWith(p));
    const subagentRows = rows.filter((r) => r.agent_id);
    const subagentTranscriptPaths = [...new Set(subagentRows.map((r) => r.transcript_path).filter(Boolean))];
    return {
        rows,
        subagentStartEmitted: has('PROBE-SUBAGENTSTART-'),
        postToolUseEmitted: has('PROBE-POSTTOOLUSE-'),
        preToolUseDenyEmitted: has('PROBE-PRETOOLUSE-DENY-'),
        subagentTranscriptPaths,
    };
}

function runHook() {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { input += c; });
    process.stdin.on('end', () => {
        let payload;
        try { payload = JSON.parse(input); } catch (e) { return; }
        const event = payload.hook_event_name;
        let out = null;
        if (event === 'SubagentStart') {
            out = { hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: 'PROBE-SUBAGENTSTART-' + NONCE } };
        } else if (event === 'PostToolUse' && payload.agent_id && payload.tool_name === 'Read') {
            out = { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 'PROBE-POSTTOOLUSE-' + NONCE } };
        } else if (event === 'PreToolUse' && payload.agent_id && payload.tool_name === 'Glob') {
            out = { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'PROBE-PRETOOLUSE-DENY-' + NONCE } };
        }
        const record = {
            event, tool: payload.tool_name || null, agent_id: payload.agent_id || null,
            transcript_path: payload.transcript_path || null,
            emitted: out ? (out.hookSpecificOutput.additionalContext || out.hookSpecificOutput.permissionDecisionReason) : null,
        };
        fs.appendFileSync(LOG, JSON.stringify(record) + '\n');
        if (out) process.stdout.write(JSON.stringify(out));
    });
}

if (require.main === module) {
    if (process.argv[2] === 'summarise') {
        let text = '';
        try { text = fs.readFileSync(LOG, 'utf8'); } catch (e) { /* no log yet */ }
        process.stdout.write(JSON.stringify(parseLog(text), null, 2) + '\n');
    } else {
        runHook();
    }
}

module.exports = { parseLog };
