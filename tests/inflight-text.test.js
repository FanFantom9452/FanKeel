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
    gone: [/how many are in flight, four by default/, /listing six sends four/, /how many are in flight, eight by default/],
    now: [/how many go out in one response, eight by default/, /listing ten sends eight/, /cut by dependency depth, so one group can hold more than eight: its brain sends eight, then one more as each returns/],
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
    gone: [/plus up to four readers/, /sends at most four `fankeel:fankeel-reader`/, /plus up to eight readers/, /sends at most eight `fankeel:fankeel-reader`/],
    now: [/plus the readers its profile allows \(`dispatch\.inflight`\)/, /sends as many `fankeel:fankeel-reader` as `dispatch\.inflight` allows/, /the judge's brief carries `inflight: <value>` \(the hook adds it from the profile\)/],
  },
  'agents/fankeel-judge.md': {
    gone: [/at most four in that response/, /default four; a fifth/, /at most eight in that response/, /default eight; a ninth/],
    now: [/the `inflight:` value the dispatch brief carries/, /`unlimited` means no cap/, /not a fixed eight/],
  },
  'agents/fankeel-brain.md': {
    gone: [/\(four by default\)/],
    now: [/\(eight by default\)/],
  },
  'docs/02-architecture/pipeline.md': {
    gone: [/in flight, four by default/, /`?dispatch\.inflight`?, four by default; dispatch\.floor/, /dispatch\.inflight in flight, eight by default/],
    now: [/dispatch\.inflight in one response, eight by default/, /dispatch\.inflight, eight by default; dispatch\.floor/],
  },
  'docs/90-agent/reference/subagents.md': {
    gone: [/sends at most four `fankeel:fankeel-reader`/, /sends at most eight `fankeel:fankeel-reader`/, /Four in one response is the default/, /past four you are guessing/, /a builtin of 4,/],
    now: [/sends as many `fankeel:fankeel-reader` as `dispatch.inflight` allows/, /unlimited means no cap/, /Eight in one response is the default/, /past eight you are guessing/, /a builtin of 8,/],
  },
};

test('the judge pages cap readers by profile, not by a number', () => {
  const cap = /(?:at most|up to|no more than) (?:eight|8|four|4|twelve|\d+) (?:`?fankeel:fankeel-reader`?|readers)/;
  for (const f of ['agents/fankeel-judge.md', 'skills/fankeel-ask/SKILL.md', 'docs/90-agent/reference/subagents.md']) {
    assert.doesNotMatch(flat(f), cap, f + ' caps the judge readers at a number');
  }
  assert.match(flat('skills/fankeel-ask/SKILL.md'), /the judge's brief carries `inflight: <value>` \(the hook adds it from the profile\)/);
  assert.match(flat('agents/fankeel-judge.md'), /task.js profile show`/);
  assert.match(flat('agents/fankeel-judge.md'), /`unlimited` means no cap/);
});

test('the pages that state the dispatch.inflight default say eight', () => {
  for (const [file, { gone, now }] of Object.entries(PAGES)) {
    const text = flat(file);
    for (const re of gone) assert.doesNotMatch(text, re, file + ' still says four: ' + re);
    for (const re of now) assert.match(text, re, file + ' does not say eight: ' + re);
  }
});
