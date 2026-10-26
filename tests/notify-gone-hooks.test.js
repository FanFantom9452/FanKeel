'use strict';
// notify-1 (docs/90-agent/judgements/2026-10-26-remove-ntfy.md): the three
// senders — a gate let out, a session ended, a stage left — no longer reach
// lib/notify.js or anything ntfy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

for (const rel of ['hooks/gate.js', 'hooks/leave.js', 'scripts/task.js']) {
    test(rel + ' sends no notification', () => {
        assert.doesNotMatch(read(rel), /lib\/notify\.js|notify\.fire|ntfy/i);
    });
}
