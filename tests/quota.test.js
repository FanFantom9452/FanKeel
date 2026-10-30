'use strict';
// lib/quota.js: the 7-day readings, the limits files joined, and the newest window that moved enough.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mkTmp = require('./tmp.js');
const quota = require('../lib/quota.js');

const line = (at, pct, resetsAt) => JSON.stringify({ at, seven_day_pct: pct, seven_day_resets_at: resetsAt, five_hour_pct: null, cost_usd: null });

test('readings keep only lines carrying a 7-day percent and reset, oldest first', () => {
    const text = [line(200, 12, 9000), '{"at":150,"seven_day_pct":null,"seven_day_resets_at":null}', 'torn{', line(100, 10, 9000)].join('\n');
    assert.deepEqual(quota.readings(text), [{ at: 100, pct: 10, resetsAt: 9000 }, { at: 200, pct: 12, resetsAt: 9000 }]);
});

test('readings take a limits row too: ISO times become seconds, seven is the percent', () => {
    const row = JSON.stringify({ at: '2026-10-27T05:23:13.593Z', task: 't', stage: 'survey', five: 9, fiveResets: null, seven: 40, sevenResets: '2026-10-29T19:00:00.000Z' });
    assert.deepEqual(quota.readings([row, line(100, 10, 9000)].join('\n')), [
        { at: 100, pct: 10, resetsAt: 9000 },
        { at: Date.parse('2026-10-27T05:23:13.593Z') / 1000, pct: 40, resetsAt: Date.parse('2026-10-29T19:00:00.000Z') / 1000 },
    ]);
});

test('limitsText joins every session file under .fankeel/build/limits', () => {
    const root = mkTmp('fankeel-quota-limits-');
    const dir = path.join(root, '.fankeel', 'build', 'limits');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'a.jsonl'), '{"x":1}\n');
    fs.writeFileSync(path.join(dir, 'b.jsonl'), '{"x":2}\n');
    fs.writeFileSync(path.join(dir, 'skip.txt'), 'no');
    assert.equal(quota.limitsText(root).split('\n').filter(Boolean).length, 2);
    assert.equal(quota.limitsText(path.join(root, 'none')), '');
});

test('span takes the newest window that moved MIN_POINTS or more, first reading to last', () => {
    const list = quota.readings([line(100, 5, 9000), line(400, 40, 9030), line(10000, 1, 700000), line(10100, 3, 700000)].join('\n'));
    assert.deepEqual(quota.span(list), { from: 100000, to: 400000, points: 35 }, 'a reset seconds apart is the same window; the newer one moved too little');
    assert.equal(quota.span(quota.readings(line(100, 5, 9000) + '\n' + line(200, 5 + quota.MIN_POINTS - 1, 9000))), null);
});

test('the calibration is gone: no perWeek, spentBetween or calibrate, and no scripts/quota.js', () => {
    for (const k of ['perWeek', 'spentBetween', 'calibrate']) assert.equal(quota[k], undefined, k);
    assert.equal(fs.existsSync(path.join(__dirname, '..', 'scripts', 'quota.js')), false);
});
