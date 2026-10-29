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

test('the miss grader fails a wrong cause that cites the file and uses generic words', () => {
    const g = byName('names-the-miss');
    for (const wrong of [
        'test/menu.test.js:5 — the test does not cover the error message wording.',
        'test/menu.test.js:8 — this helper never calls the logger and is not hit by other suites.',
        'test/menu.test.js:3 — the suite passes, though removing the stale import would be cleaner.',
        'test/menu.test.js:7 — it never reaches the network, so the suite is not exercised on CI.',
    ]) assert.equal(ev.grade(g, run(wrong)).pass, false, wrong);
    assert.equal(ev.grade(g, run('test/menu.test.js:5 — asserts nothing happened, so it stays green if the branch is removed.')).pass, true);
    assert.equal(ev.grade(g, run('test/menu.test.js:5 — it stays green when src/menu.js:3 is deleted.')).pass, true);
});

test('the miss grader passes each plausible phrasing of the vacuous test', () => {
    const g = byName('names-the-miss');
    for (const ok of [
        'the assertion is never reached, so it cannot fail',
        'does not exercise the filter; it would pass even with the filter deleted',
        'forEach over empty array: no assertions run, the test is vacuous',
    ]) assert.equal(ev.grade(g, run('menu.test.js:5 — ' + ok)).pass, true, ok);
});
