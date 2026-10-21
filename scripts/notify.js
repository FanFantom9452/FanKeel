#!/usr/bin/env node
'use strict';
// The child lib/notify.js `fire` starts, detached, for one ntfy publish:
//
//   node scripts/notify.js '<{"url":"https://ntfy.sh/","body":{…}}>'
//
// It sends that one request (lib/notify.js `send`, eight seconds at most) and
// exits 0 whatever happened — no topic, an unreachable server, a refusal —
// because nothing waits on it and nothing reads its exit code.
const { send } = require('../lib/notify.js');

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
    (req ? send(req, 8000) : Promise.resolve(false)).then(() => process.exit(0), () => process.exit(0));
}

module.exports = { parseRequest };
