'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const prices = require('../lib/prices.js');

test('the table carries a date and five rates per model', () => {
    assert.match(prices.verified, /^\d{4}-\d{2}-\d{2}$/);
    for (const [id, r] of Object.entries(prices.perMillion)) {
        for (const k of ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h']) {
            assert.equal(typeof r[k], 'number', id + '.' + k);
            assert.ok(r[k] > 0, id + '.' + k);
        }
    }
});

test('rateFor matches an exact id, then the same id without its date', () => {
    assert.equal(prices.rateFor('claude-sonnet-5'), prices.perMillion['claude-sonnet-5']);
    assert.equal(prices.rateFor('claude-haiku-4-5'), prices.perMillion['claude-haiku-4-5-20251001']);
    assert.equal(prices.rateFor('claude-haiku-4-5-20251001'), prices.perMillion['claude-haiku-4-5-20251001']);
    assert.equal(prices.rateFor('claude-nothing-9'), null);
    assert.equal(prices.rateFor(undefined), null);
});

test('costOf prices what it knows and names what it does not', () => {
    const out = prices.costOf({
        'claude-sonnet-5': { input: 1e6, output: 1e6, cacheRead: 1e6, cacheWrite5m: 1e6, cacheWrite1h: 1e6 },
        'claude-nothing-9': { input: 1e6, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 },
    });
    assert.equal(out.usd, 2 + 10 + 0.2 + 2.5 + 4);
    assert.deepEqual(out.priced, ['claude-sonnet-5']);
    assert.deepEqual(out.unpriced, ['claude-nothing-9']);
    assert.deepEqual(prices.costOf(undefined), { usd: 0, priced: [], unpriced: [] });
});
