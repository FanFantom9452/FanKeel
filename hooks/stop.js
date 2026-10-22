#!/usr/bin/env node
'use strict';

// Stop, main thread only: a controller that ends its turn while its stage is
// open and nothing in the background will wake the session is refused once,
// with lib/stop.js's reason. stop_hook_active says this stop already followed
// a refusal, so it passes — a turn really waiting on the user ends on its
// second try.
//
// Then the phone (docs/99-archive/2026-10-22-mobile-session-design.md §2):
// every Stop of a registry session records the turn's reply and its
// background_tasks; while the phone has attached the session, the hook holds
// up to phone.hold seconds for its next message and returns it as a block —
// whether or not stop_hook_active is set, since every phone message is one.
//
// Same rules as every hook here: exit 0 on every path, and nothing at all for
// a session the registry does not know; a registry session with no active task
// still has its reply and background recorded, but is never refused. Two things
// go to stdout: the refusal, or a phone message.

const registry = require('../lib/registry.js');
const phone = require('../lib/phone.js');
const { profileFor } = require('../lib/profile.js');
const { refusal } = require('../lib/stop.js');
const { run, parse } = require('../lib/hook.js');

const HOLD_DEFAULT = 1800;

function holdSeconds(root, mine) {
    try {
        const n = Number(profileFor(root, mine).values['phone.hold']);
        return Number.isInteger(n) && n > 0 ? n : HOLD_DEFAULT;
    } catch (e) {
        return HOLD_DEFAULT;
    }
}

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;
    if (payload.hook_event_name !== undefined && payload.hook_event_name !== 'Stop') return;
    const root = registry.rootFor(payload);
    const sid = payload.session_id;
    const mine = registry.readSession(root, sid);
    if (!mine) return;
    const now = Date.now();
    try {
        phone.append(root, sid, { role: 'assistant', text: String(payload.last_assistant_message || ''), at: now });
        phone.writeBackground(root, sid, payload.background_tasks, now);
    } catch (e) { /* housekeeping */ }
    if (payload.stop_hook_active !== true) {
        const reason = refusal(mine, payload.transcript_path);
        if (reason) {
            process.stdout.write(JSON.stringify({ decision: 'block', reason }));
            return;
        }
    }
    let got = null;
    try {
        if (!phone.isAttached(root, sid)) return;
        got = phone.hold(root, sid, holdSeconds(root, mine) * 1000);
    } catch (e) {
        process.stderr.write('fankeel stop: phone hold failed: ' + (e && e.message) + '\n');
        // Left attached, the phone would keep sending into a hook that is gone.
        try {
            phone.detach(root, sid);
        } catch (e2) { /* nothing left to do */ }
        return;
    }
    if (!got || typeof got.text !== 'string') return;
    try {
        phone.append(root, sid, { role: 'phone', text: got.text, at: Date.now() });
    } catch (e) { /* housekeeping */ }
    process.stdout.write(JSON.stringify({ decision: 'block', reason: '（手機）' + got.text }));
}

run(main);
