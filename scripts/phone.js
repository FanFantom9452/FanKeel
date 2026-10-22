#!/usr/bin/env node
'use strict';
// /fankeel-phone (docs/99-archive/2026-10-22-mobile-session-design.md §3):
// attach hands a session to the phone — when its turn ends, hooks/stop.js
// holds it for the phone's next message; detach takes it back.
const { parseArgs } = require('node:util');
const registry = require('../lib/registry.js');
const phone = require('../lib/phone.js');
const path = require('node:path');
const profile = require('../lib/profile.js');
const live = require('../lib/live.js');

const GUIDE = path.join(__dirname, '..', 'docs/01-guide/tailscale-setup.md').replace(/\\/g, '/');

const USAGE = 'usage: phone.js attach|detach --session <id> [--root <dir>]';

function main(argv, opts) {
    let parsed;
    try {
        parsed = parseArgs({ args: argv, allowPositionals: true, options: { session: { type: 'string' }, root: { type: 'string' } } });
    } catch (e) {
        return { text: USAGE, code: 2 };
    }
    const verb = parsed.positionals[0];
    const sid = parsed.values.session;
    if ((verb !== 'attach' && verb !== 'detach') || !sid) return { text: USAGE, code: 2 };
    const root = parsed.values.root ? registry.resolveRoot(parsed.values.root) : registry.findStateRoot(process.cwd()) || process.cwd();
    if (!registry.readSession(root, sid)) return { text: 'phone: no fankeel session ' + sid + ' in ' + root, code: 2 };
    if (verb === 'detach') {
        phone.detach(root, sid);
        return { text: 'phone: detached — the session is the desktop\'s again', code: 0 };
    }
    // The phone reaches the station only through Tailscale; attaching while
    // station.remote is off would hold the session for a phone that cannot
    // connect (station-44).
    const configDir = (opts && opts.configDir) || live.liveConfigDir();
    if (profile.read(null, configDir).values['station.remote'] !== true) {
        return { text: 'phone: station.remote is off, so no phone can reach this machine — turn it on as ' + GUIDE + ' describes, then attach again', code: 1 };
    }
    phone.attach(root, sid, 'desktop', Date.now());
    return { text: 'phone: attached — when this turn ends the session waits for the phone (/m), up to phone.hold seconds', code: 0 };
}

if (require.main === module) {
    const out = main(process.argv.slice(2));
    process.stdout.write(out.text + '\n');
    process.exitCode = out.code;
}

module.exports = { main };
