'use strict';
// The 對話 tab with act turns (assets/station/session-talk.js): an act row
// sits between the items without taking an item key or a 專注 cursor slot, and a Claude item says the time to the second
// and how long since the user turn it answers.
const test = require('node:test');
const assert = require('node:assert/strict');
const { page } = require('./station-module.js');

const ID = 'cccccccc-3333-4333-8333-333333333333';
const T0 = Date.parse('2026-10-20T10:00:00.000Z');
const at = (s) => new Date(T0 + s * 1000).toISOString();
const two = (n) => String(n).padStart(2, '0');
const clock = (iso) => { const d = new Date(iso); return two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds()); };
const TURNS = [
    { kind: 'user', at: at(0), text: 'fix it' },
    { kind: 'claude', at: at(125), text: 'Looking.' },
    { kind: 'act', at: at(126), tools: [{ id: 't1', name: 'Bash', brief: 'npm test', at: at(126) }],
        agents: [{ id: 'tu_a', description: 'review', agentType: 'Explore', model: null, background: false, state: 'finished', agentId: 'a1' }] },
    { kind: 'claude', at: at(4000), text: 'Done.' },
];
const HELD = { total: 4, state: '', turns: TURNS };

test('an act turn is a row between the items and takes no item key and no 專注 slot', () => {
    const html = page([]).M['session-talk.js'].html(ID, HELD, {});
    const tab = html.slice(0, html.indexOf('<dialog'));
    assert.deepEqual(tab.match(/data-key="tk-\d+"/g), ['data-key="tk-0"', 'data-key="tk-1"', 'data-key="tk-2"']);
    const act = tab.indexOf('data-block="talk-act"');
    assert.ok(tab.indexOf('Looking.') < act && act < tab.indexOf('Done.'));
    assert.ok(tab.includes('data-tact-sid="' + ID + '" data-tact-agent="a1"'));
    const dlg = html.slice(html.indexOf('<dialog'));
    assert.equal((dlg.match(/txf-it/g) || []).length, 3);
    assert.ok(dlg.includes('data-block="talk-act"'));
});

test('a Claude item says its time to the second and how long since the user turn', () => {
    const html = page([]).M['session-talk.js'].html(ID, HELD, {});
    assert.ok(html.includes('<time datetime="' + at(125) + '">' + clock(at(125)) + '<span class="tx-took"> · +2m 05s</span></time>'));
    assert.ok(html.includes('<span class="tx-took"> · +1h 06m</span>'));
    const quick = page([]).M['session-talk.js'].html(ID, { total: 2, state: '', turns: [TURNS[0], { kind: 'claude', at: at(9), text: 'Hi.' }] }, {});
    assert.ok(quick.includes('<span class="tx-took"> · +9s</span>'));
});
