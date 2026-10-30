'use strict';
// Task 4 of docs/90-agent/plans/2026-10-30-spend-quota.md: the quota tabs' arithmetic —
// a rise across a reset, a rise split by spend (design §4), lanes and the price of a point.
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../assets/station/quota-share.js');

const M = 60e3;

test('a rise across a reset is the climb before it plus the climb after it', () => {
    const steps = [{ from: 0, v: 60 }, { from: 10 * M, v: 64 }, { from: 20 * M, v: 0 }, { from: 30 * M, v: 5 }];
    assert.equal(Q.riseOf(steps, 0, 40 * M), 9);
    assert.equal(Q.riseOf(steps, 15 * M, 40 * M), 5);
});

test('two tasks overlapping, spending 1:3 while the line climbs 8 points: 2 and 6 points', () => {
    const steps = [{ from: 0, v: 10 }, { from: 40 * M, v: 18 }];
    const A = { start: 0, end: 60 * M, bins: [[30 * M, 1]] };
    const B = { start: 30 * M, end: 90 * M, bins: [[30 * M, 3]] };
    assert.deepEqual(Q.shareOf(steps, [A, B], A, 0, 60 * M), { rise: 8, share: 2 });
    assert.deepEqual(Q.shareOf(steps, [A, B], B, 30 * M, 90 * M), { rise: 8, share: 6 });
});

test('tasks that spent nothing in a piece split its rise evenly; a rise no task ran in goes to none', () => {
    const steps = [{ from: 0, v: 0 }, { from: 10 * M, v: 4 }, { from: 70 * M, v: 9 }];
    const A = { start: 0, end: 60 * M, bins: [] };
    const B = { start: 0, end: 60 * M, bins: [] };
    assert.deepEqual(Q.shareOf(steps, [A, B], A, 0, 80 * M), { rise: 9, share: 2 });
});

test('lanes stack overlapping bars, as many as the most at once, and reuse a lane once it is free', () => {
    const segs = [{ start: 0, end: 10 }, { start: 5, end: 20 }, { start: 12, end: 30 }, { start: 21, end: 25 }];
    assert.deepEqual(Q.lanesOf(segs), { lane: [0, 1, 0, 1], count: 2 });
});

test('the price of a point is what the account spent in the span over the points it climbed', () => {
    const span = { from: 0, to: 60 * M, points: 10 };
    assert.equal(Q.perPoint(span, [[[5 * M, 30], [70 * M, 99]], [[10 * M, 20]]]), 5);
    assert.equal(Q.perPoint(null, []), null);
    assert.equal(Q.perPoint(span, [[]]), null);
    assert.equal(Q.spendIn([[0, 1], [5 * M, 2]], 0, 5 * M), 1);
});
