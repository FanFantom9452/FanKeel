#!/usr/bin/env node
'use strict';

// PreToolUse on SendMessage and the session send_message tool. A message to
// another session or agent lands in the receiver's context and is re-read on
// every turn it has left: the 2026-10-18 judgement counted about 0.65M tokens
// of cross-session SendMessage in three days of main-session cache writes
// (docs/90-agent/judgements/2026-10-18-main-session-cost.md). Past RELAY_CAP
// characters the send is refused, and a file with its path asked for instead,
// which is what hooks/resume.js already asks of a controller's relays.
//
// The tools spell the body differently, so no field name is pinned here: the
// longest string among the input's values, one level of nesting deep, is what
// is measured.
//
// Same rules as every hook here: exit 0 on every path, and nothing at all for
// a session that owns no active task.

const registry = require('../lib/registry.js');
const { run, parse, refuse } = require('../lib/hook.js');

const RELAY_CAP = 2000;

function longest(input) {
    let n = 0;
    for (const v of input && typeof input === 'object' ? Object.values(input) : []) {
        if (typeof v === 'string') n = Math.max(n, v.length);
        else if (v && typeof v === 'object') {
            for (const w of Object.values(v)) if (typeof w === 'string') n = Math.max(n, w.length);
        }
    }
    return n;
}

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;
    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;
    const n = longest(payload.tool_input);
    if (n <= RELAY_CAP) return;
    refuse('fankeel: this message is ' + n + ' characters; one to another session or agent stays under ' + RELAY_CAP
        + ', because the receiver carries it for the rest of its session. Write the detail to a file and send its path, with one line on what it holds.');
}

run(main);
