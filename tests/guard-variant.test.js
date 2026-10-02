'use strict';

// docs/90-agent/plans/2026-10-02-docs-writer.md Task 4: an effort variant is
// guarded exactly as its base agent is.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { readOnlyAgentType, brainWriteReason } = require('../lib/guard.js');
const mkTmp = require('./tmp.js');

test('a reviewer variant is read-only like the reviewer; an implementer variant is not', () => {
    assert.equal(readOnlyAgentType('fankeel:fankeel-reviewer-high'), true);
    assert.equal(readOnlyAgentType('fankeel-reviewer-xhigh'), true);
    assert.equal(readOnlyAgentType('fankeel:fankeel-implementer-high'), false);
});

test('a brain variant is held to its own task directory like the brain', () => {
    const root = mkTmp('fankeel-guard-variant-');
    const file = path.join(root, '.fankeel', 'build', 'task-20260929T135057', 'x.md');
    assert.match(brainWriteReason({ agentType: 'fankeel:fankeel-brain-high', root, file, mine: {} }), /\(none/);
});
