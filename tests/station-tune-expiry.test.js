'use strict';
// The station's view of a project's tune queue (station-50): a taken request
// older than 24 hours is `expired`, a dropped one is `dropped`, and neither
// counts as in progress, so the 編輯中 row for it no longer renders.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tuneOf } = require('../lib/station.js');
const tmp = require('./tmp.js');

const H = 60 * 60 * 1000;
const NOW = Date.parse('2026-10-23T12:00:00.000Z');
const line = (id, status, ms, extra) => Object.assign({ id, status, at: new Date(ms).toISOString() }, extra || {});

function queue(rows) {
    const dir = tmp('fankeel-station-tune-');
    const state = path.join(dir, '.fankeel', 'build', 'tune');
    fs.mkdirSync(state, { recursive: true });
    fs.writeFileSync(path.join(state, 'queue.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    return dir;
}

test('tuneOf: an expired taken request and a dropped one are not in progress', () => {
    const dir = queue([
        line('r-0001', 'queued', NOW - 30 * H, { block: 'old' }), line('r-0001', 'taken', NOW - 25 * H),
        line('r-0002', 'queued', NOW - 2 * H, { block: 'fresh' }), line('r-0002', 'taken', NOW - 1 * H),
        line('r-0003', 'queued', NOW - 3 * H, { block: 'gone' }), line('r-0003', 'taken', NOW - 2 * H), line('r-0003', 'dropped', NOW - 1 * H),
        line('r-0004', 'queued', NOW - 1 * H, { block: 'next' }),
        line('r-0005', 'queued', NOW - 5 * H, { block: 'fin' }), line('r-0005', 'done', NOW - 4 * H),
    ]);
    const t = tuneOf(dir, NOW);
    assert.deepEqual(t.items.map((x) => [x.id, x.status]), [['r-0001', 'expired'], ['r-0002', 'taken'], ['r-0003', 'dropped'], ['r-0004', 'queued'], ['r-0005', 'done']]);
    assert.equal(t.open, 2);
    assert.equal(t.done, 1);
});

test('tuneOf: a taken request with no readable time stays taken, and no queue is null', () => {
    const dir = queue([{ id: 'r-0001', status: 'queued', block: 'a' }, { id: 'r-0001', status: 'taken' }]);
    assert.equal(tuneOf(dir, NOW).items[0].status, 'taken');
    assert.equal(tuneOf(tmp('fankeel-station-tune-none-'), NOW), null);
});
