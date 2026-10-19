'use strict';

// escape-1 step 3: the rule says only to write CJK characters directly. It no
// longer spells out an escape — a prompt that shows one is copied (Giskard's
// analysis of structured output, cited in docs/90-agent/todo/escape-1.md) —
// nor names a half of the consequence ("fail to parse") the silent slip lacks.

const test = require('node:test');
const assert = require('node:assert/strict');
const { ALWAYS, NAMES, rulesFor } = require('../lib/stages.js');

test('ALWAYS[3] says only to write CJK characters directly', () => {
    assert.equal(ALWAYS[3], 'Write CJK characters directly in tool input. Name a code concept in code — `overdue`, not a translation of it.');
});

test('no ALWAYS rule spells out an escape or says "fail to parse"', () => {
    for (const rule of ALWAYS) {
        assert.doesNotMatch(rule, /\\u/, rule);
        assert.doesNotMatch(rule, /fail to parse/, rule);
    }
});

test('every stage still carries it', () => {
    for (const stage of NAMES) assert.ok(rulesFor(stage).includes(ALWAYS[3]), stage);
});
