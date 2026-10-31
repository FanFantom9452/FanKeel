'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { formatProblem, gateHeader } = require('../lib/handoff.js');

const gate = (header, question, one) => ({ questions: [{ header, question, multiSelect: false, options: [{ label: one, description: 'a' }, { label: 'Stay in Survey', description: 'b' }, { label: '暫停', description: 'c' }] }] });

test('gateHeader is the move with an arrow, or the destination alone past twelve columns', () => {
  assert.equal(gateHeader('survey', 'plan'), 'Survey→Plan');
  assert.equal(gateHeader('Build', 'Verify'), 'Build→Verify');
  assert.equal(gateHeader('Land', '收工'), 'Land→收工');
  assert.equal(gateHeader('Survey', 'Design'), '→Design');
  assert.equal(gateHeader('Verify', 'Design'), '→Design');
});

test('formatProblem takes the move as the header and refuses the bare stage', () => {
  const route = ['survey', 'plan', 'build', 'verify', 'land'];
  assert.equal(formatProblem(gate('Survey→Plan', 'Survey -> Plan | fankeel : t', 'Go to Plan'), 'plan', route), null);
  const bare = formatProblem(gate('Survey', 'Survey -> Plan | fankeel : t', 'Go to Plan'), 'plan', route);
  assert.equal(bare.at, 'questions[0].header');
  assert.match(bare.detail, /Survey→Plan/);
});

test('past twelve columns the header is the destination alone', () => {
  const route = ['survey', 'design', 'build'];
  assert.equal(formatProblem(gate('→Design', 'Survey -> Design | fankeel : t', 'Go to Design'), 'design', route), null);
  assert.equal(formatProblem(gate('Survey→Design', 'Survey -> Design | fankeel : t', 'Go to Design'), 'design', route).at, 'questions[0].header');
});

test('the question is checked before the header, so a gate wrong on both is reported on the question', () => {
  const both = formatProblem(gate('Survey', 'SURVEY -> PLAN | fankeel : t', 'Go to Plan'), 'plan', ['survey', 'plan']);
  assert.equal(both.at, 'questions[0].question');
});
