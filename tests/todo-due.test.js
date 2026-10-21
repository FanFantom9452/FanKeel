'use strict';
// Design §6: home's Blocked count uses lib/todo.js's due rule — `on:` from its
// date, otherwise seven days after the stamp — the rule scripts/todo-check.js
// reads through `timings`. `dueOf` is that rule for one entry, and the
// station's `todoOf` carries it on every open entry as `due` and `dueAt`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const station = require('../lib/station.js');
const todo = require('../lib/todo.js');
const tmp = require('./tmp.js');

const at = (y, m, d) => new Date(y, m - 1, d).getTime();
const NOW = at(2026, 10, 22) + 9 * 3600e3;
const BODY = 'From the station, 2026-10-22: a question raised in the middle of a session and parked here. '
    + 'It should become one decided change, written down where the next session can pick it up. '
    + 'Done when the change lands and this entry is closed by the sha that landed it.';

test('dueOf: on: from its date, otherwise seven days after the stamp; only Blocked is ever due', () => {
    assert.deepEqual(todo.dueOf('blocked', 'after: the release', '2026-10-15', NOW), { due: true, dueAt: at(2026, 10, 22) });
    assert.deepEqual(todo.dueOf('blocked', 'after: the release', '2026-10-16', NOW), { due: false, dueAt: at(2026, 10, 23) });
    assert.deepEqual(todo.dueOf('blocked', 'on: 10-20 the review', '2026-10-01', NOW), { due: true, dueAt: at(2026, 10, 20) });
    assert.deepEqual(todo.dueOf('blocked', 'on: 10-30', '2026-10-20', NOW), { due: false, dueAt: at(2026, 10, 30) });
    assert.deepEqual(todo.dueOf('watch', 'after: x', '2026-01-01', NOW), { due: false, dueAt: null });
    assert.deepEqual(todo.dueOf('ready', '', '2026-01-01', NOW), { due: false, dueAt: null });
    assert.deepEqual(todo.dueOf('blocked', 'after: x', '', NOW), { due: false, dueAt: null });
});

test('dueOf agrees with timings, the rule todo-check reads, on the same condition line', () => {
    const cases = [['after: the release', '2026-10-15'], ['after: the release', '2026-10-16'],
        ['on: 10-20 the review', '2026-10-01'], ['on: 10-30', '2026-10-20'], ['', '2026-10-01']];
    for (const [cond, stamp] of cases) {
        const text = '## Blocked\n\n### waiting\n\n' + (cond ? cond + '. ' : '') + stamp.slice(5) + '.\n';
        const [t] = todo.timings(text, NOW);
        assert.equal(todo.dueOf('blocked', cond, stamp, NOW).due, t.due, cond + ' / ' + stamp);
    }
});

test('the station\'s todoOf carries due and dueAt on every open entry', () => {
    const dir = tmp('fankeel-todo-due-');
    fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'docs', 'todo'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [{ path: 'docs/todo', role: 'todo' }] }));
    todo.add(dir, { id: 'late-1', title: 'late', description: 'waits on a review', state: 'blocked', timing: 'on: 10-20 the review', stamp: '2026-10-01', body: BODY });
    todo.add(dir, { id: 'fresh-1', title: 'fresh', description: 'waits on a release', state: 'blocked', timing: 'after: the release', stamp: '2026-10-16', body: BODY });
    todo.add(dir, { id: 'ready-1', title: 'ready', description: 'can start now', state: 'ready', body: BODY });
    const got = station.todoOf(dir, NOW);
    const by = Object.fromEntries(got.open.map((e) => [e.id, { due: e.due, dueAt: e.dueAt }]));
    assert.deepEqual(by, {
        'late-1': { due: true, dueAt: at(2026, 10, 20) },
        'fresh-1': { due: false, dueAt: at(2026, 10, 23) },
        'ready-1': { due: false, dueAt: null },
    });
});
