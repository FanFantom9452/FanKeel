'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderBrief, RETURN_RULES } = require('../lib/render.js');

const RULE = 'Write CJK characters directly in tool input — a `Write`, a commit file, a `todo.js new` body.';
const data = { task: 't', claims: [], stage: 'build', class: 'architectural',
    route: ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'], active: true, started: '2026-09-19T09:30:12.345Z' };

test('the rule is the last return rule, so the brain brief\'s indexes do not move', () => {
    assert.equal(RETURN_RULES[4], RULE);
    assert.equal(RETURN_RULES.length, 5);
});

test('every non-stage-agent brief carries it', () => {
    for (const type of ['fankeel:fankeel-reader', 'fankeel:fankeel-implementer', 'fankeel:fankeel-judge', 'general-purpose']) {
        const text = renderBrief({ mine: { sessionId: 's', data }, agentType: type, root: '/r', profile: null });
        assert.ok(text.includes('  - ' + RULE), type);
    }
});
