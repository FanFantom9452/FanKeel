#!/usr/bin/env node
'use strict';
// The child lib/notify.js `fire` starts, detached, for one ntfy publish:
//
//   node scripts/notify.js '<{"url":"https://ntfy.sh/","body":{…}}>'
//
// It sends that one request (lib/notify.js `send`, eight seconds at most) and
// exits 0 whatever happened — no topic, an unreachable server, a refusal —
// because nothing waits on it and nothing reads its exit code.
const fs = require('node:fs');
const path = require('node:path');
const { send } = require('../lib/notify.js');

// A publish that did not go out is one line in notify-failed.log beside the
// machine profile, so a mistyped notify.server leaves a trace rather than a
// phone that never rings. The host alone: the topic is the subscription's only
// secret and the body is the task. Kept to 20 lines; a record that cannot be
// written is dropped, never an exit code.
function recordFailure(req) {
    try {
        const file = path.join(path.dirname(require('../lib/profile.js').machineFile(req.configDir)), 'notify-failed.log');
        let lines = [];
        try { lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean); } catch (e) { /* none yet */ }
        lines.push(new Date().toISOString() + ' ' + new URL(req.url).host + ' unreachable or refused');
        fs.writeFileSync(file, lines.slice(-20).join('\n') + '\n');
    } catch (e) { /* no record; still exit 0 */ }
}

// The request off argv, or null for anything but an http(s) url and a body object.
function parseRequest(arg) {
    try {
        const req = JSON.parse(String(arg));
        if (req && typeof req.url === 'string' && /^https?:\/\//.test(req.url)
            && req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return req;
    } catch (e) { /* not a request */ }
    return null;
}

if (require.main === module) {
    const req = parseRequest(process.argv[2]);
    (req ? send(req, 8000) : Promise.resolve(true)).catch(() => false).then((ok) => {
        if (!ok) recordFailure(req);
        process.exit(0);
    });
}

module.exports = { parseRequest };
