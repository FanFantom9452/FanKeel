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

test('span5 is the newest 5h window that climbed MIN_POINTS or more, its first reading to its last', () => {
    const win = (vs) => ({ start: 0, end: 300 * M, steps: vs.map((v, i) => ({ from: i * 10 * M, to: (i + 1) * 10 * M, v, gap: false })) });
    assert.deepEqual(Q.span5([win([0, 12]), win([3, 8, 13])]), { from: 0, to: 20 * M, points: 10 });
    assert.deepEqual(Q.span5([win([0, 12]), win([3, 8])]), { from: 0, to: 10 * M, points: 12 }, 'the newer one climbed 5: the older one is used');
    assert.equal(Q.span5([win([4, 4 + Q.MIN_POINTS - 1])]), null, 'nine points is not enough');
    assert.equal(Q.span5([win([7])]), null);
    assert.equal(Q.span5([]), null);
    assert.equal(Q.span5(undefined), null);
    assert.equal(Q.MIN_POINTS, require('../lib/quota.js').MIN_POINTS);
});

test('quotaShare is the amount over each dollars-per-point, always an estimate; null when neither can be said', () => {
    assert.deepEqual(Q.quotaShare(3, 1.5, 0.25), { weekPct: 2, fiveHourPct: 12, estimated: true });
    assert.deepEqual(Q.quotaShare(3, 1.5, null), { weekPct: 2, fiveHourPct: null, estimated: true });
    assert.deepEqual(Q.quotaShare(0.3, 1, null), { weekPct: 0.3, fiveHourPct: null, estimated: true }, 'under 1% keeps one decimal');
    assert.equal(Q.quotaShare(3, null, null), null);
    assert.equal(Q.quotaShare(0, 1.5, 0.25), null);
});
