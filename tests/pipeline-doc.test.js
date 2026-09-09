'use strict';

// docs/pipeline.md draws each stage; lib/stages.js holds the rules it draws.
// Nothing kept the two together — the verify node had lost "the chain is one
// workflow" and the audit node had paraphrased every line of its own rule, and
// both read as current. One anchor phrase per stage is what is pinned, not the
// whole wording: a diagram label is meant to be shorter than the rule.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { byName } = require('../lib/stages.js');

const PIPELINE = path.join(__dirname, '..', 'docs', 'pipeline.md');

const ANCHOR = {
  survey: 'Nothing matched is a finding',
  design: 'the test that fails now and passes after',
  plan: 'the smallest unit carrying its own test cycle',
  build: 'do not improve adjacent code',
  verify: 'the chain is one workflow',
  audit: 'dead references, never opinions',
  land: 'Option one stands the task down',
};

// A `<br/>` inside a mermaid label breaks a phrase across two lines, and the
// labels carry HTML entities where the rules carry the characters themselves.
const flat = (s) => s
  .replace(/<br\s*\/?>/g, ' ')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .toLowerCase();

function section(text, stage) {
  const start = text.indexOf('\n### ' + stage + '\n');
  assert.notEqual(start, -1, 'no `### ' + stage + '` heading in docs/pipeline.md');
  const after = text.indexOf('\n### ', start + 1);
  return text.slice(start, after === -1 ? text.length : after);
}

test('every anchor is a contiguous substring of its own stage rule', () => {
  for (const stage of Object.keys(ANCHOR)) {
    const rules = flat(byName(stage).rules.join('\n'));
    assert.ok(rules.includes(flat(ANCHOR[stage])),
      stage + ': the anchor is not in that stage\'s rules in lib/stages.js');
  }
});

test('every stage diagram quotes one line of its own rule', () => {
  const doc = fs.readFileSync(PIPELINE, 'utf8');
  for (const stage of Object.keys(ANCHOR)) {
    assert.ok(flat(section(doc, stage)).includes(flat(ANCHOR[stage])),
      stage + ': docs/pipeline.md does not carry "' + ANCHOR[stage] + '"');
  }
});
