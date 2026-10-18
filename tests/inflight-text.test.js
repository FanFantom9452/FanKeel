'use strict';
// profile `dispatch.inflight` went from four to eight by default on 2026-10-19
// (docs/90-agent/todo/speed-5.md). Every page that states the default says
// eight; a sentence about AskUserQuestion's four options is not one of them.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const flat = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\s+/g, ' ');

const PAGES = {
  'skills/fankeel/SKILL.md': {
    gone: [/how many go in one response, four by default/, /\(four by default\) has one exception/, /Four is where guessing/, /a four-agent batch/],
    now: [/how many go in one response, eight by default/, /\(eight by default\) has one exception/, /Eight is where guessing/, /an eight-agent batch/],
  },
  'skills/fankeel-build/SKILL.md': {
    gone: [/how many are in flight, four by default/, /listing six sends four/],
    now: [/how many are in flight, eight by default/, /listing ten sends eight/],
  },
  'skills/fankeel-survey/SKILL.md': {
    gone: [/`dispatch\.inflight`, four by default/],
    now: [/`dispatch\.inflight`, eight by default/],
  },
  'skills/fankeel-verify/SKILL.md': {
    gone: [/`dispatch\.inflight`, four by default/, /\(four by default\)/, /a plan of six goes four then two/],
    now: [/`dispatch\.inflight`, eight by default/, /\(eight by default\)/, /a plan of ten goes eight then two/],
  },
  'skills/fankeel-audit/SKILL.md': {
    gone: [/\(four by default\)/, /Four in one response is the default/],
    now: [/\(eight by default\)/, /Eight in one response is the default/],
  },
  'skills/fankeel-init/SKILL.md': {
    gone: [/\(four by default\)/],
    now: [/\(eight by default\)/],
  },
  'skills/fankeel-ask/SKILL.md': {
    gone: [/plus up to four readers/, /sends at most four `fankeel:fankeel-reader`/],
    now: [/plus up to eight readers/, /sends at most eight `fankeel:fankeel-reader`/],
  },
  'agents/fankeel-judge.md': {
    gone: [/at most four in that response/, /default four; a fifth/],
    now: [/at most eight in that response/, /default eight; a ninth/],
  },
  'agents/fankeel-brain.md': {
    gone: [/\(four by default\)/],
    now: [/\(eight by default\)/],
  },
  'docs/02-architecture/pipeline.md': {
    gone: [/in flight, four by default/, /`?dispatch\.inflight`?, four by default; dispatch\.floor/],
    now: [/in flight, eight by default/, /dispatch\.inflight, eight by default; dispatch\.floor/],
  },
  'docs/90-agent/reference/subagents.md': {
    gone: [/sends at most four `fankeel:fankeel-reader`/, /Four in one response is the default/, /past four you are guessing/, /a builtin of 4,/],
    now: [/sends at most eight `fankeel:fankeel-reader`/, /Eight in one response is the default/, /past eight you are guessing/, /a builtin of 8,/],
  },
};

test('the pages that state the dispatch.inflight default say eight', () => {
  for (const [file, { gone, now }] of Object.entries(PAGES)) {
    const text = flat(file);
    for (const re of gone) assert.doesNotMatch(text, re, file + ' still says four: ' + re);
    for (const re of now) assert.match(text, re, file + ' does not say eight: ' + re);
  }
});
