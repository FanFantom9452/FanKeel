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

test('the cause grader passes each plausible phrasing of the always-set cause', () => {
    const g = byName('names-the-cause');
    for (const ok of [
        'o.group is set on every record, so the guard never discriminates',
        'group is never unset, so the guard is always true',
        'the group check is always satisfied since every inflight entry carries a group',
        'every brain has a group so the condition is a tautology',
        'markInflight always assigns a group',
        'group is always truthy because markInflight always sets it',
        'group is always defined once marked',
    ]) assert.equal(ev.grade(g, run('inflight.js:11 — ' + ok)).pass, true, ok);
});

test('the cause grader fails the inverted claim that group is never set', () => {
    const g = byName('names-the-cause');
    assert.equal(ev.grade(g, run('inflight.js:11 — group is never set when the brain starts, so the guard skips it')).pass, false);
});

test('the cause grader fails a negated always-set claim', () => {
    const g = byName('names-the-cause');
    for (const neg of [
        'inflight.js:11 — group is not always set so the guard fails',
        "inflight.js:11 — group isn't always set so the guard fails",
    ]) assert.equal(ev.grade(g, run(neg)).pass, false, neg);
});

test('the cause grader fails a negation placed elsewhere in the always-set sentence', () => {
    const g = byName('names-the-cause');
    for (const neg of [
        'group is not set on every record',
        'group is not in every record',
        'group is rarely always set',
        'group is no longer always set',
        'group cannot be always set',
        'group is not guaranteed to be always set',
    ]) assert.equal(ev.grade(g, run('inflight.js:11 — ' + neg)).pass, false, neg);
});
