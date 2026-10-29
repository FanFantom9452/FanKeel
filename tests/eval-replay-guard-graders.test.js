'use strict';

// The graders of the revert-5e2e621d replay: a catch passes, a clean return
// and a wrong cause fail. Free; the paid run is scripts/eval.js, by hand.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ev = require('../lib/eval.js');

const CASE = path.join(__dirname, '..', 'evals', 'replay-guard-always-true');
const AGENT = { name: 'Agent', input: { subagent_type: 'fankeel:fankeel-reviewer', prompt: 'Review git diff HEAD~1..HEAD' } };
const run = (last, calls) => ({ calls: calls || [AGENT], last, texts: last });
const byName = (n) => ev.parseCase(CASE).graders.find((g) => g.name === n);

test('the reviewer must be dispatched', () => {
    const g = byName('dispatches-the-reviewer');
    assert.equal(ev.grade(g, run('x')).pass, true);
    assert.equal(ev.grade(g, run('x', [])).pass, false);
});

test('the cause grader passes the catch and fails clean or a wrong cause', () => {
    const g = byName('names-the-cause');
    const caught = 'inflight.js:11 — `o.group` is always set by markInflight (inflight.js:4), so the handoff condition clears the closing brain too.';
    assert.equal(ev.grade(g, run(caught)).pass, true);
    assert.equal(ev.grade(g, run('clean')).pass, false);
    assert.equal(ev.grade(g, run('inflight.js:9 — the comment has a typo.')).pass, false);
});

test('the cause grader fails a wrong cause that cites the file and uses generic words', () => {
    const g = byName('names-the-cause');
    for (const wrong of [
        'inflight.js:11 — the group is always logged regardless of the state, which is noisy.',
        'inflight.js:11 — every call reads group from the registry, so the lookup is slow.',
        'inflight.js:4 — group should be validated, it is never checked for a string type, always throw on bad input.',
        'inflight.js:6 — the group name is never documented and the mark is always cleared late.',
    ]) assert.equal(ev.grade(g, run(wrong)).pass, false, wrong);
    assert.equal(ev.grade(g, run('inflight.js:4 — markInflight gives every mark a group, so the guard never spares the brain.')).pass, true);
});
