// tests/station-talk-oldlist-act.test.js
'use strict';
// The old talk list in station.js (talkHtml → talkRow) draws an act turn as
// the act row from talk-acts.js, with no session id, so nothing in it opens,
// and never as an empty Claude row.
const test = require('node:test');
const assert = require('node:assert/strict');
const { page } = require('./station-module.js');

const T0 = Date.parse('2026-10-20T10:00:00.000Z');
const at = (s) => new Date(T0 + s * 1000).toISOString();
const TURNS = [
    { kind: 'user', at: at(0), text: 'fix it' },
    { kind: 'claude', at: at(125), text: 'Looking.' },
    { kind: 'act', at: at(126), tools: [{ id: 't1', name: 'Bash', brief: 'npm test', at: at(126) }],
        agents: [{ id: 'tu_a', description: 'review', agentType: 'Explore', model: null, background: false, state: 'finished', agentId: 'a1' }] },
    { kind: 'claude', at: at(4000), text: 'Done.' },
];

test('the old list in station.js draws an act turn with nothing to open', () => {
    const { V } = page([]);
    const html = V.talkHtml('abc', { state: '', total: 4, counts: { compact: 0, user: 1, claude: 2 }, skipped: {}, turns: TURNS });
    assert.ok(html.includes('<li class="tk-act"><div class="tx-act" data-block="talk-act">'));
    assert.ok(!html.includes('data-tact-agent='));
    assert.ok(!/<li class="tk-claude"[^>]*>[^]*?<div class="tx"><\/div>/.test(html), 'no empty Claude row');
});
