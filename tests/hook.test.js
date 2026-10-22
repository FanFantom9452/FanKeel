'use strict';

// What all fifteen hooks do before they do anything of their own. The hooks
// themselves are tested as subprocesses with real payloads, which is where the
// behaviour is; this covers the inputs a real payload never has and a malformed
// one might.

const test = require('node:test');
const assert = require('node:assert/strict');

const { parse, run, deny, refuse } = require('../lib/hook.js');

test('a payload is an object or it is nothing', () => {
  assert.deepEqual(parse('{"session_id":"a"}'), { session_id: 'a' });
  assert.equal(parse(''), null);
  assert.equal(parse('not json'), null);
  assert.equal(parse('null'), null);
  assert.equal(parse(undefined), null);
});

// `typeof [] === 'object'`, so the check every hook carried let an array
// through. Nothing broke — the next line read `.session_id` off it, got
// undefined and returned — but it returned two steps later than it meant to,
// and a payload that is not a payload should not reach a hook's own logic at
// all.
test('an array is not a payload, whatever typeof says', () => {
  assert.equal(parse('[]'), null);
  assert.equal(parse('[{"session_id":"a"}]'), null);
});

// A number or a string parses as JSON and is not an object. The old check
// caught these too; this says so out loud rather than leaving it to be rederived.
test('a bare scalar is not a payload either', () => {
  assert.equal(parse('42'), null);
  assert.equal(parse('"a string"'), null);
  assert.equal(parse('true'), null);
});

test('run is what every hook ends with, and it takes the function', () => {
  assert.equal(typeof run, 'function');
  assert.equal(run.length, 1);
});

test('deny is the PreToolUse refusal, keys in the order the hooks always printed them', () => {
  const d = deny('fankeel: no');
  assert.deepEqual(Object.keys(d), ['hookEventName', 'permissionDecision', 'permissionDecisionReason']);
  assert.deepEqual(d, { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'fankeel: no' });
});

test('refuse writes the deny as the hook output, and nothing else', (t) => {
  const written = [];
  t.mock.method(process.stdout, 'write', (s) => { written.push(s); return true; });
  refuse('fankeel: no');
  t.mock.restoreAll();
  assert.deepEqual(written, [JSON.stringify({ hookSpecificOutput: deny('fankeel: no') })]);
});
