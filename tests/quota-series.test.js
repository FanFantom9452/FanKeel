'use strict';
// Task 2 of docs/90-agent/plans/2026-10-30-spend-quota.md: every registry's limits
// files as one series per account — deduped by minute, stepped, windowed, forecast.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const quota = require('../lib/quota.js');
const tmp = require('./tmp.js');

// Local wall-clock times: the weekday and HH:MM a reset names must not move with the zone.
const T = (d, h, m, s) => new Date(2026, 9, d, h, m || 0, s || 0).getTime();
const R04 = new Date(2026, 10, 5, 4, 0, 7).toISOString(); // Thursday 04:00, seconds off as the payload is
const R19 = new Date(2026, 10, 5, 19, 0, 0).toISOString(); // Thursday 19:00
const row = (t, seven, sevenResets, extra) => JSON.stringify(Object.assign({
    at: new Date(t).toISOString(), task: 'x', stage: 'build', five: 10, fiveResets: new Date(t + 3 * 3600e3).toISOString(), seven, sevenResets,
}, extra || {})) + '\n';
function root(files) {
    const r = tmp('fankeel-quota-series-');
    const dir = path.join(r, '.fankeel', 'build', 'limits');
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, lines] of Object.entries(files)) fs.writeFileSync(path.join(dir, name + '.jsonl'), lines.join(''));
    return r;
}

test('two registries, three overlapping sessions: one reading per account per minute, the larger seven kept, five read', () => {
    const a = root({
        s1: [row(T(30, 9, 0, 5), 20, R04), row(T(30, 9, 1), 21, R04), row(T(30, 9, 2), 22, R04)],
        s2: [row(T(30, 9, 0, 40), 21, R04), row(T(30, 9, 2, 30), 22, R04)],
    });
    const b = root({ s3: [row(T(30, 9, 1, 10), 20, R04), row(T(30, 9, 3), 23, R04), row(T(30, 9, 0, 0), 50, R19)] });
    const rows = quota.limitsRows([a, b]);
    assert.equal(rows.length, 8);
    const { accounts, bySession } = quota.accountsOf(rows);
    assert.deepEqual(accounts.map((x) => [x.key, x.rows.length]), [['4 04:00', 4], ['4 19:00', 1]]);
    assert.deepEqual(accounts[0].rows.map((r) => r.seven), [21, 21, 22, 23]);
    assert.ok(accounts[0].rows.every((r) => r.five === 10 && Number.isFinite(r.fiveResets)));
    assert.deepEqual(bySession, { s1: '4 04:00', s2: '4 04:00', s3: '4 04:00' });
});

test('a file read before is not parsed again while its size and mtime hold', () => {
    const r = root({ s1: [row(T(30, 9), 20, R04)] });
    const file = path.join(r, '.fankeel', 'build', 'limits', 's1.jsonl');
    assert.equal(quota.limitsRows([r])[0].seven, 20);
    const st = fs.statSync(file);
    fs.writeFileSync(file, row(T(30, 9), 29, R04));
    fs.utimesSync(file, st.atime, st.mtime);
    assert.equal(quota.limitsRows([r])[0].seven, 20);
});

test('a reading with no account groups by its reset; a reset that contradicts the account wins', () => {
    const r = root({
        p: [row(T(29, 8), 10, R04, { account: 'uuid-A' }), row(T(29, 9), 30, R19, { account: 'uuid-A' }), row(T(29, 10), 11, R04, { account: 'uuid-A' })],
        q: [row(T(29, 11), 31, R19), row(T(29, 12), 12, null, { account: 'uuid-A' })],
    });
    const { accounts } = quota.accountsOf(quota.limitsRows([r]));
    assert.deepEqual(accounts.map((x) => [x.key, x.wd, x.hm, x.rows.map((y) => y.seven)]),
        [['4 04:00', 4, '04:00', [10, 11, 12]], ['4 19:00', 4, '19:00', [30, 31]]]);
});

test('the step line holds between readings, falls to 0 at the reset, and marks a step with no reading as gap', () => {
    const reset = T(29, 4);
    const rows = [
        { at: T(29, 1), seven: 60, sevenResets: reset },
        { at: T(29, 1, 10), seven: 62, sevenResets: reset },
        { at: T(29, 5), seven: 3, sevenResets: T(36, 4) },
    ];
    assert.deepEqual(quota.stepsOf(rows, 'seven', T(29, 5, 20)), [
        { from: T(29, 1), to: T(29, 1, 10), v: 60, gap: false },
        { from: T(29, 1, 10), to: reset, v: 62, gap: true },
        { from: reset, to: T(29, 5), v: 0, gap: false },
        { from: T(29, 5), to: T(29, 5, 20), v: 3, gap: false },
    ]);
});

test('the 7d forecast carries the last 24 hours\' climb per hour to 100; no climb, or 100 after the reset, is null', () => {
    const far = T(35, 4);
    const rows = [{ at: T(29, 12), seven: 40, sevenResets: far }, { at: T(30, 0), seven: 46, sevenResets: far }, { at: T(30, 12), seven: 52, sevenResets: far }];
    const f = quota.forecast(rows, quota.stepsOf(rows, 'seven', T(30, 12)));
    // 6 + 6 points over 24 hours is 0.5 an hour; 48 points left is 96 hours
    assert.deepEqual([f.at, f.pct, f.perHour, f.out, f.resets], [T(30, 12), 52, 0.5, T(30, 12) + 96 * 3600e3, far]);
    const flat = [{ at: T(29, 12), seven: 52, sevenResets: far }, { at: T(30, 12), seven: 52, sevenResets: far }];
    assert.equal(quota.forecast(flat, quota.stepsOf(flat, 'seven', T(30, 12))).out, null);
    const soon = rows.map((x) => Object.assign({}, x, { sevenResets: T(30, 20) }));
    assert.equal(quota.forecast(soon, quota.stepsOf(soon, 'seven', T(30, 12))).out, null);
    assert.equal(quota.forecast([], []), null);
});

test('quotaOf gives each account its 7d steps, its 5h windows and its forecast, and each session its account', () => {
    const r = root({ s1: [row(T(30, 9), 20, R04), row(T(30, 10), 25, R04)] });
    const q = quota.quotaOf([r], T(30, 11));
    assert.deepEqual(q.bySession, { s1: '4 04:00' });
    const a = q.accounts[0];
    assert.deepEqual([a.key, a.wd, a.hm, a.steps7.length, a.windows.length, a.forecast.pct], ['4 04:00', 4, '04:00', 2, 2, 25]);
    assert.deepEqual(a.windows.map((x) => [x.end - x.start, x.steps[0].v]), [[5 * 3600e3, 10], [5 * 3600e3, 10]]);
    assert.equal(quota.resetKey(Date.parse(R04)), '4 04:00');
});

test('a 7d reset a few minutes off its mark names one account whichever way it wanders', () => {
    const r = root({
        s1: [row(T(30, 9), 20, new Date(2026, 10, 5, 4, 2, 0).toISOString())],
        s2: [row(T(30, 10), 21, new Date(2026, 10, 5, 3, 58, 0).toISOString())],
    });
    const { accounts, bySession } = quota.accountsOf(quota.limitsRows([r]));
    assert.deepEqual(accounts.map((x) => [x.key, x.rows.map((y) => y.seven)]), [['4 04:00', [20, 21]]]);
    assert.deepEqual(bySession, { s1: '4 04:00', s2: '4 04:00' });
});

test('5h readings whose fiveResets wander a minute or two off one mark are one window ending on the mark', () => {
    const mark = T(30, 13);
    const r = root({ s1: [
        row(T(30, 9), 20, R04, { five: 10, fiveResets: new Date(mark - 2 * 60e3).toISOString() }),
        row(T(30, 10), 21, R04, { five: 14, fiveResets: new Date(mark + 80e3).toISOString() }),
    ] });
    const a = quota.quotaOf([r], T(30, 11)).accounts[0];
    assert.deepEqual(a.windows.map((x) => [x.start, x.end, x.steps.map((s) => s.v)]), [[mark - 5 * 3600e3, mark, [10, 14]]]);
});
