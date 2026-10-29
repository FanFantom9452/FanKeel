'use strict';
// scripts/limits-series.js: the 7-day readings grouped by the window they report.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mkTmp = require('./tmp.js');
const { tagged, windows, main } = require('../scripts/limits-series.js');

const row = (at, seven, sevenResets) => JSON.stringify({ at, task: 't', stage: 'build', five: 1, fiveResets: '2026-10-27T08:00:00.000Z', seven, sevenResets });

function root(files) {
    const r = mkTmp('fankeel-limits-series-');
    const dir = path.join(r, '.fankeel', 'build', 'limits');
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, rows] of Object.entries(files)) fs.writeFileSync(path.join(dir, name + '.jsonl'), rows.join('\n') + '\n');
    return r;
}

const R = root({
    a: [row('2026-10-27T01:00:00.000Z', 20, '2026-10-29T04:00:00.000Z'), row('2026-10-28T01:00:00.000Z', 60, '2026-10-29T04:00:12.000Z')],
    b: [row('2026-10-27T02:00:00.000Z', 40, '2026-10-29T19:00:00.000Z'), row('2026-10-29T05:00:00.000Z', 2, '2026-11-05T04:00:00.000Z')],
});

test('tagged keeps each reading\'s session, oldest first', () => {
    assert.deepEqual(tagged(R).map((r) => [r.session, r.pct]), [['a', 20], ['b', 40], ['a', 60], ['b', 2]]);
});

test('windows group by the reset rounded to the hour, oldest window first', () => {
    const ws = windows(tagged(R));
    assert.deepEqual(ws.map((w) => [new Date(w.resets * 1000).toISOString(), w.rows.length, w.sessions]),
        [['2026-10-29T04:00:00.000Z', 2, 1], ['2026-10-29T19:00:00.000Z', 1, 1], ['2026-11-05T04:00:00.000Z', 1, 1]]);
});

test('main prints one line per window, and --window every reading in one', () => {
    const all = main(['--root', R]);
    assert.equal(all.code, 0);
    assert.match(all.text, /^resets 2026-10-29T04:00:00Z  2 rows  1 sessions  2026-10-27T01:00:00Z 20% -> 2026-10-28T01:00:00Z 60%$/m);
    const one = main(['--root', R, '--window', '2026-10-29T04:00Z']);
    assert.deepEqual(one.text.split('\n'), ['2026-10-27T01:00:00Z  20%  a', '2026-10-28T01:00:00Z  60%  a']);
});

test('main refuses a window nothing reports, and an empty directory', () => {
    const miss = main(['--root', R, '--window', '2026-10-30T00:00Z']);
    assert.equal(miss.code, 1);
    assert.match(miss.text, /no window resets at 2026-10-30T00:00Z; windows: 2026-10-29T04:00:00Z/);
    assert.equal(main(['--root', mkTmp('fankeel-limits-series-none-')]).code, 1);
    assert.equal(main(['--root', R, '--window', 'soon']).code, 2);
});
