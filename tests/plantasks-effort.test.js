'use strict';

// docs/90-agent/plans/2026-10-02-docs-writer.md Task 10: `implementer, <model>,
// <effort>` names a shipped effort variant of fankeel-implementer.
const test = require('node:test');
const assert = require('node:assert/strict');

const plantasks = require('../lib/plantasks.js');
const { parseTasks } = plantasks;

const body = (dispatchLine) => [
  '## Task 1: name', '',
  '**Files:**', '- Modify: `lib/a.js`', '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  dispatchLine, '',
].join('\n');

test('parsePlan reads model and effort off an implementer, <model>, <effort> Dispatch line', () => {
  const [t] = parseTasks(body('**Dispatch:** implementer, sonnet, high — the lock protocol has to be reasoned about.'));
  assert.equal(t.model, 'sonnet');
  assert.equal(t.effort, 'high');
});

test('parsePlan leaves effort empty where the line names none, and the model as before', () => {
  const [t] = parseTasks(body('**Dispatch:** implementer, sonnet — transcription.'));
  assert.equal(t.model, 'sonnet');
  assert.equal(t.effort, '');
  assert.equal(parseTasks(body('**Dispatch:** in-session — the user said so.'))[0].effort, '');
});

test('lint names an effort with no shipped variant, and passes high and xhigh', () => {
  assert.deepEqual(plantasks.lint(body('**Dispatch:** implementer, sonnet, xhigh — a design judgement.'), '# A design\n'), []);
  const out = plantasks.lint(body('**Dispatch:** implementer, sonnet, max — why.'), '# A design\n');
  assert.ok(out.includes('Task 1: effort `max` has no fankeel-implementer variant — one of high, xhigh, or none for the agent file\'s own medium'), out.join('\n'));
});
