'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const guard = require('../lib/guard.js');
const { render } = require('../lib/render.js');

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';
const UNKNOWN = { known: false, ids: new Set() };
const older = new Date(Date.now() - 7200e3).toISOString();
const newer = new Date(Date.now() - 3600e3).toISOString();
const WA = { path: '.fankeel/worktrees/aaaaaaaa', branch: 'fk/aaaaaaaa' };
const WB = { path: '.fankeel/worktrees/bbbbbbbb', branch: 'fk/bbbbbbbb' };

test('two live sessions that only saw f in git neither block nor clash', () => {
  const mine = { seen: ['f.js'], started: newer };
  const theirs = { sessionId: B, data: { seen: ['f.js'], started: older } };
  assert.deepEqual(guard.blockers(mine, [theirs], 'f.js', UNKNOWN), []);
  assert.deepEqual(guard.sharedWith(mine, theirs, [theirs]), { clash: [], merge: [] });
});

test('a path one side touched through a hook collides only with the other side\'s claim', () => {
  const mine = { claims: ['f.js'], started: newer };
  const sawIt = { sessionId: B, data: { seen: ['f.js'], started: older } };
  assert.deepEqual(guard.sharedWith(mine, sawIt, [sawIt]).clash, []);
  assert.deepEqual(guard.blockers(mine, [sawIt], 'f.js', UNKNOWN), []);
  const editedIt = { sessionId: B, data: { claims: ['f.js'], started: older } };
  assert.deepEqual(guard.sharedWith(mine, editedIt, [editedIt]).clash, ['f.js']);
  assert.equal(guard.blockers(mine, [editedIt], 'f.js', UNKNOWN).length, 1);
});

test('a path only git saw warns but never blocks', () => {
  const mine = { started: newer };
  const theirs = { sessionId: B, data: { seen: ['f.js'], started: older } };
  assert.deepEqual(guard.blockers(mine, [theirs], 'f.js', UNKNOWN), []);
  assert.deepEqual(guard.effectiveClaims(theirs.data, [{ data: mine }, theirs]), ['f.js']);
  assert.deepEqual(guard.sharedWith(mine, theirs, [theirs]).clash, []);
});

test('two trees on one path neither block nor clash; the path is a merge', () => {
  const mine = { claims: ['lib/x.js'], worktree: WA, started: newer };
  const theirs = { sessionId: B, data: { claims: ['lib/x.js'], worktree: WB, started: older } };
  assert.deepEqual(guard.blockers(mine, [theirs], 'lib/x.js', UNKNOWN), []);
  assert.deepEqual(guard.sharedWith(mine, theirs, [theirs]), { clash: [], merge: ['lib/x.js'] });
  const onMain = { sessionId: B, data: { claims: ['lib/x.js'], started: older } };
  assert.deepEqual(guard.blockers(mine, [onMain], 'lib/x.js', UNKNOWN), [], 'one side on the main tree is another tree');
});

test('the block names a merge path once and draws no overlap for it', () => {
  const mine = { task: 'mine', stage: 'build', active: true, claims: ['lib/x.js'], worktree: WA, started: newer };
  const theirs = { sessionId: B, data: { task: 'theirs', stage: 'build', active: true, claims: ['lib/x.js'], worktree: WB, started: older } };
  const out = render({ mine: { sessionId: A, data: mine }, others: [theirs], now: Date.now() });
  assert.match(out, /^merge: lib\/x\.js — also edited in another worktree; they meet at land$/m);
  assert.doesNotMatch(out, /<< overlaps:/);
});

test('worktreeOf reads the record field or answers null', () => {
  assert.deepEqual(guard.worktreeOf({ worktree: WA }), WA);
  assert.equal(guard.worktreeOf({ worktree: { branch: 'x' } }), null);
  assert.equal(guard.worktreeOf(null), null);
});
