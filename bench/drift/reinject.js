#!/usr/bin/env node
'use strict';
// The drift bench's reinjection hook (design section 8): PostToolUse, mounted
// with --settings on the reinject arms only. It answers only a call made by
// a subagent — a payload carrying agent_id, the implementer, never the relay —
// counts that agent's calls in .bench/reinject-count-<agent_id>, and on every
// fifth hands constraints.md back as additionalContext, logging
// {step, chars} to .bench/reinject.log. Like every hook here it exits 0 on
// every path.
const fs = require('node:fs');
const path = require('node:path');

const EVERY = 5;

function decide(payload, dir, text) {
    if (!payload || !payload.agent_id || payload.hook_event_name !== 'PostToolUse') return null;
    const bench = path.join(dir, '.bench');
    fs.mkdirSync(bench, { recursive: true });
    const counter = path.join(bench, 'reinject-count-' + String(payload.agent_id).replace(/[^\w-]/g, '_'));
    let n = 0;
    try {
        n = Number(fs.readFileSync(counter, 'utf8')) || 0;
    } catch (e) {
        // The agent's first call: no counter yet.
    }
    n += 1;
    fs.writeFileSync(counter, String(n));
    if (n % EVERY !== 0) return null;
    fs.appendFileSync(path.join(bench, 'reinject.log'), JSON.stringify({ step: n, chars: text.length }) + '\n');
    return { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text } };
}

if (require.main === module) {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => { raw += d; });
    process.stdin.on('end', () => {
        try {
            const payload = JSON.parse(raw);
            const text = fs.readFileSync(path.join(__dirname, 'constraints.md'), 'utf8').trim();
            const out = decide(payload, payload.cwd || process.cwd(), text);
            if (out) process.stdout.write(JSON.stringify(out));
        } catch (e) {
            // A hook never fails the call it follows.
        }
        process.exit(0);
    });
}

module.exports = { decide, EVERY };
