#!/usr/bin/env node
'use strict';

// Stop, main thread only: a controller that ends its turn while its stage is
// open and nothing in the background will wake the session is refused once,
// with lib/stop.js's reason. stop_hook_active says this stop already followed
// a refusal, so it passes — a turn really waiting on the user ends on its
// second try.
//
// Same rules as every hook here: exit 0 on every path, and nothing at all for
// a session that owns no active task. One thing goes to stdout: the refusal.

const registry = require('../lib/registry.js');
const { refusal } = require('../lib/stop.js');
const { run, parse } = require('../lib/hook.js');

function main(raw) {
    const payload = parse(raw);
    if (!payload || payload.stop_hook_active === true) return;
    if (payload.hook_event_name !== undefined && payload.hook_event_name !== 'Stop') return;
    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    const reason = refusal(mine, payload.transcript_path);
    if (reason) process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

run(main);
