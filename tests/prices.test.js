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

// Two ids this machine's transcripts carry that the table could not price:
// `claude-fable-5`, on 8,649,431 tokens, and `claude-opus-4-8`, on 33,335,478 —
// both found on 2026-09-21 while bucketing all 427 transcripts into a rate-limit
// window, and both only in requests older than that window, so no figure already
// published was short. The rows are what the table published says; this pins
// them so a hand-edit cannot quietly move one.
test('the two ids found unpriced on 2026-09-21 carry the published rates', () => {
    assert.deepEqual(prices.rateFor('claude-fable-5'),
        { input: 10, output: 50, cacheRead: 1, cacheWrite5m: 12.5, cacheWrite1h: 20 });
    assert.deepEqual(prices.rateFor('claude-opus-4-8'),
        { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10 });
});

// The published multipliers, asserted over every row rather than row by row: a
// cache read is 0.1x that row's own input, a five-minute write 1.25x and an hour
// write 2x. Fable 5.1 is the single exception and the reason this is a ratio test
// at all — 0.025x there, per the page's own footnote, and 0.1x on Fable 5, so the
// exception is the version and not the family. A typo in any rate breaks a ratio.
test('every row carries the published cache multipliers of its own input rate', () => {
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    for (const [id, r] of Object.entries(prices.perMillion)) {
        const read = id === 'claude-fable-5-1' ? 0.025 : 0.1;
        assert.ok(near(r.cacheRead / r.input, read), id + ' cacheRead / input = ' + (r.cacheRead / r.input));
        assert.ok(near(r.cacheWrite5m / r.input, 1.25), id + ' cacheWrite5m / input = ' + (r.cacheWrite5m / r.input));
        assert.ok(near(r.cacheWrite1h / r.input, 2), id + ' cacheWrite1h / input = ' + (r.cacheWrite1h / r.input));
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
