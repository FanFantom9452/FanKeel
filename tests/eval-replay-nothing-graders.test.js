'use strict';

// The graders of the nothing-fired replay: a catch passes, a clean return and
// a wrong cause fail. Free; the paid run is scripts/eval.js, by hand.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ev = require('../lib/eval.js');

const CASE = path.join(__dirname, '..', 'evals', 'replay-nothing-fired');
const AGENT = { name: 'Agent', input: { subagent_type: 'fankeel:fankeel-reviewer', prompt: 'Review git diff HEAD~1..HEAD' } };
const run = (last, calls) => ({ calls: calls || [AGENT], last, texts: last });
const byName = (n) => ev.parseCase(CASE).graders.find((g) => g.name === n);

test('the reviewer must be dispatched', () => {
    const g = byName('dispatches-the-reviewer');
    assert.equal(ev.grade(g, run('x')).pass, true);
    assert.equal(ev.grade(g, run('x', [])).pass, false);
});

test('the miss grader passes the catch and fails clean or a wrong cause', () => {
    const g = byName('names-the-miss');
    const caught = 'test/menu.test.js:5 — the close test passes an empty dataset, so it never reaches the close branch; deleting src/menu.js:3 keeps it green.';
    assert.equal(ev.grade(g, run(caught)).pass, true);
    assert.equal(ev.grade(g, run('clean')).pass, false);
    assert.equal(ev.grade(g, run('test/menu.test.js:4 — prefer strictEqual.')).pass, false);
    assert.equal(ev.grade(g, run('the test never reaches the branch, deleting it stays green')).pass, false);
});
