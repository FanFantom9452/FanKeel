'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('the guide tells how to hand a session to the phone and how to talk past eight messages', () => {
    const guide = read('docs', '01-guide', 'station.md');
    for (const s of ['CLAUDE_CODE_STOP_HOOK_BLOCK_CAP', '/fankeel-phone', 'phone.hold', '交還電腦']) assert.ok(guide.includes(s), s);
});

test('the layout names the phone channel and keeps its pinned sentences', () => {
    const layout = read('docs', '02-architecture', 'layout.md');
    assert.ok(layout.includes("mobile.js and phone.js are the phone page's data and its channel to a session"));
    assert.ok(layout.includes('a SubagentHandback is refused while an agent that subagent dispatched has not stopped'));
});

test('version.js counts seventeen files', () => {
    const src = read('scripts', 'version.js');
    assert.match(src, /seventeen/);
    assert.doesNotMatch(src, /sixteen|fourteen skills/);
});
