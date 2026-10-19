'use strict';

// gate-14: answering 要離開 no longer stops the work. The answer records
// leavingAt, and the question says what each answer does.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');
const registry = require('../lib/registry.js');
const { AWAY_QUESTION } = require('../lib/context.js');

const SID = 'aaaaaaaa-0000-4000-8000-0000000000a1';

function project(over) {
  const root = tmp('fankeel-away-');
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(dir, SID + '.json'), JSON.stringify(Object.assign({
    task: 't', stage: 'design', active: true, started: now, updated: now,
  }, over), null, 2) + '\n');
  return root;
}

test('the 離開 question says the work goes on and where it stops', () => {
  assert.equal(AWAY_QUESTION.header, '離開');
  assert.equal(AWAY_QUESTION.question, '接下來要離開超過 1 小時嗎？');
  const [stay, leave] = AWAY_QUESTION.options;
  assert.equal(stay.label, '不離開');
  assert.equal(leave.label, '要離開，繼續做');
  assert.match(leave.description, /不停手/);
  assert.match(leave.description, /壓縮/);
  assert.match(leave.description, /回來/);
});

test('setLeaving records leavingAt and leaves awayAt alone', () => {
  const root = project();
  assert.equal(registry.setLeaving(root, SID), true);
  const data = registry.readSession(root, SID);
  assert.ok(Number.isFinite(data.leavingAt));
  assert.equal(data.awayAt, undefined);
});

test('clearAway takes leavingAt and awayAt away together', () => {
  const root = project({ leavingAt: 1, awayAt: 2 });
  assert.equal(registry.clearAway(root, SID), true);
  const data = registry.readSession(root, SID);
  assert.equal(data.leavingAt, undefined);
  assert.equal(data.awayAt, undefined);
  assert.equal(registry.clearAway(root, SID), true);
  assert.equal(registry.readSession(root, SID).task, 't');
  const only = project({ leavingAt: 1 });
  assert.equal(registry.clearAway(only, SID), true);
  assert.equal(registry.readSession(only, SID).leavingAt, undefined);
});
