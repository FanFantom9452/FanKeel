'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const tmp = require('./tmp.js');
const { handoffPath, answerPath, readGate, writeAnswer } = require('../lib/handoff.js');

const DATA = { started: '2026-09-19T09:30:12.345Z' };
const TICKS = '`'.repeat(3);
const block = (gate) => TICKS + 'json gate\n' + JSON.stringify(gate) + '\n' + TICKS + '\n';
const gateOf = (s) => ({
  questions: [{ question: s, header: 'survey', multiSelect: false, options: [{ label: 'a', description: 'a' }, { label: 'b', description: 'b' }] }],
  next: 'pick up ' + s,
});

test('the handoff lives under .fankeel/build, keyed by started', () => {
  assert.equal(handoffPath('/r', DATA, 'survey'), '/r/.fankeel/build/task-20260919T093012/survey.md');
  assert.equal(answerPath('/r', DATA, 'survey'), '/r/.fankeel/build/task-20260919T093012/survey-answer.md');
});

test('no started, no path: a guess would be somebody else\'s directory', () => {
  assert.equal(handoffPath('/r', {}, 'survey'), null);
  assert.equal(handoffPath('/r', { started: 'yesterday' }, 'survey'), null);
  assert.equal(answerPath('/r', {}, 'survey'), null);
});

test('the gate is the last json gate block, parsed', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'survey.md');
  fs.writeFileSync(file, '# report\n\n' + block(gateOf('old')) + '\nrewritten\n\n' + block(gateOf('new')));
  const gate = readGate(file);
  assert.equal(gate.questions[0].question, 'new');
  assert.equal(gate.next, 'pick up new');
});

test('a missing file, no block, bad json or no questions read as no gate', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'survey.md');
  assert.equal(readGate(file), null);
  fs.writeFileSync(file, 'no block here\n');
  assert.equal(readGate(file), null);
  fs.writeFileSync(file, TICKS + 'json gate\n{not json\n' + TICKS + '\n');
  assert.equal(readGate(file), null);
  fs.writeFileSync(file, block({ questions: [] }));
  assert.equal(readGate(file), null);
});

test('the answer is written where answerPath says, directories made', () => {
  const file = answerPath(tmp('fankeel-handoff-'), DATA, 'survey');
  writeAnswer(file, 'Other: read lib/ first');
  assert.equal(fs.readFileSync(file, 'utf8'), 'Other: read lib/ first');
});
