'use strict';
// The dispatch table's two new columns (design §7's second bullet): a row's
// largest single request context ("context 峰值") and how many requests it
// made ("請求數"). The footer sums requests like every other numeric column;
// peak is not summed, sums() keeps the largest instead. `peak <= tokens` per
// row is a structural guarantee from how lib/usage.js builds `peak` and
// `tokens` (Task 20), not something this render layer re-derives.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const V = require('../assets/station/station.js');

const x = {
    dispatches: [
        { key: 't1', turn: 1, surface: 'agent', text: 'Review task 1', out: 1000, back: 61000, ret: 100, launch: 0, ids: ['a1'] },
        { key: 't2', turn: 2, surface: 'agent', text: 'Review task 2', out: 2000, back: 90000, ret: 100, launch: 0, ids: ['a2'] },
    ],
    rows: [
        { id: 'a1', disp: 0, surface: 'agent', label: 'Review task 1', agentType: 'fankeel-reviewer', model: 'claude-sonnet-5', phase: null, c: 100, k: 60, s: 60, split: { input: 0, output: 0 }, cost: { input: 0, output: 0 }, unpriced: [], peak: 160000, requests: 4 },
        { id: 'a2', disp: 1, surface: 'agent', label: 'Review task 2', agentType: 'fankeel-reviewer', model: 'claude-sonnet-5', phase: null, c: 50, k: 20, s: 30, split: { input: 0, output: 0 }, cost: { input: 0, output: 0 }, unpriced: [], peak: 90000, requests: 3 },
    ],
    runs: [],
    agentCents: 150,
    agentsTotal: { cents: 150 },
    unpriced: [],
    steps: {},
    events: [],
    dropped: 0,
};

test('the dispatch table shows a context-peak and a requests column, and the footer sums requests (not peak)', () => {
    const html = V.dispatchHtml(x);
    const head = html.slice(html.indexOf('<thead>'), html.indexOf('</thead>'));
    assert.match(head, /context 峰值/);
    assert.match(head, /請求數/);
    const foot = html.slice(html.indexOf('<tfoot>'), html.indexOf('</tfoot>'));
    assert.match(foot, />7</, 'footer requests is 4 + 3');
    assert.match(html, /160k/, "row a1's own peak, unabbreviated tokens() would be 160,000");
    assert.match(html, /90k/, "row a2's own peak");
});

test('the chart metric picker offers peak and requests beside cost/tokens/time/chars', () => {
    const html = V.dispatchHtml(x, undefined, { metric: 'peak' });
    assert.match(html, /data-v="peak"/);
    assert.match(html, /data-v="requests"/);
});
