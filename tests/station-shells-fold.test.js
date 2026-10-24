// tests/station-shells-fold.test.js
'use strict';
// The shells block no longer takes a header row of its own ("shells | 0 個在跑");
// the running count is the block's tooltip, and each row keeps its own pill.
const test = require('node:test');
const assert = require('node:assert/strict');
const { page } = require('./station-module.js');

const NOW = Date.parse('2026-10-21T01:00:00.000Z');
const ONE = [{ id: 'b2', command: 'node --test', state: 'running', code: null, startedAt: '2026-10-21T00:56:00.000Z' }];
const NONE_RUNNING = [{ id: 'b1', command: 'git log', state: 'ended', code: 0, startedAt: '2026-10-21T00:51:00.000Z' }];

test('no header row, and the first thing in the block is a shell row', () => {
    const { V } = page();
    const html = V.shellsHtml(ONE, NOW);
    assert.ok(!html.includes('class="sa-h"'));
    assert.match(html, /^<div class="s-shells" data-block="s-shells" title="1 個在跑"><div class="sa">/);
});

test('with none running the count is 0 in the tooltip and nowhere on the page', () => {
    const { V } = page();
    const html = V.shellsHtml(NONE_RUNNING, NOW);
    assert.match(html, /title="0 個在跑"/);
    assert.ok(!/<b>shells<\/b>/.test(html));
    assert.equal(V.shellsHtml([], NOW), '');
});
