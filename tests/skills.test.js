'use strict';

// A skill is loaded by its frontmatter and chosen by its description, so both are
// always-on cost and neither is checked by anything else. `claude plugin validate`
// checks the manifest, not what is inside `skills/`.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'skills');

const names = fs.readdirSync(DIR).filter((d) => fs.statSync(path.join(DIR, d)).isDirectory());
const read = (n) => fs.readFileSync(path.join(DIR, n, 'SKILL.md'), 'utf8');

function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

test('every skill directory holds a SKILL.md', () => {
  assert.ok(names.length >= 1, 'skills/ is empty');
  for (const n of names) {
    assert.ok(fs.existsSync(path.join(DIR, n, 'SKILL.md')), n + ' has no SKILL.md');
  }
});

for (const n of names) {
  test(n + ': the frontmatter names the skill after its directory', () => {
    const fm = frontmatter(read(n));
    assert.ok(fm, n + ' has no frontmatter');
    // The directory is what Claude Code shows; a name that disagrees with it
    // produces two plausible spellings of one command.
    assert.equal(fm.name, n);
    assert.match(fm.name, /^[a-z0-9-]+$/, 'ids have to be kebab-case for the marketplace sync');
  });

  test(n + ': the description says when to reach for it, and stays short', () => {
    const fm = frontmatter(read(n));
    // Read on every request to decide whether the skill applies, so it is the
    // most expensive line in the file.
    assert.ok(fm.description.length > 60, n + ' description is too thin to route on');
    assert.ok(fm.description.length < 500, n + ' description is ' + fm.description.length + ' chars');
    assert.match(fm.description, /Use for|Use when/, n + ' never says when to use it');
  });
}

// The two skills do different jobs and the split is the point: one owns a task
// through a route, the other reads documentation and needs no task at all.
test('the audit skill runs both scanners and ends at the gate', () => {
  const text = read('fankeel-audit');
  assert.match(text, /scripts\/docs-check\.js/);
  assert.match(text, /scripts\/docs-audit\.js/);
  assert.match(text, /AskUserQuestion/);
  assert.match(text, /ponytail-audit/, 'the code half goes unmentioned');
  // The one thing it must never do on its own.
  assert.match(text, /Never move a document unasked/);
});

test('the entry skill points at the audit skill rather than repeating it', () => {
  assert.match(read('fankeel'), /\/fankeel-audit/);
});

// The style skill was removed in 0.20.0. Nothing should have been left behind
// pointing at it, because a reference to a skill that is not installed reads as
// a command the user typed wrong.
test('nothing still offers a skill that was removed', () => {
  assert.equal(names.includes('fankeel-style'), false);
  for (const n of names) {
    assert.equal(/fankeel-style/.test(read(n)), false, n + ' still names fankeel-style');
  }
  for (const f of ['scripts/style.js', 'lib/styles.js', 'lib/settings.js']) {
    assert.equal(fs.existsSync(path.join(ROOT, f)), false, f + ' outlived the skill it served');
  }
});

// Seven stages, and both layers carry the format. Written when only the skill
// did, this said the injected layer could not — false since `3dfad64` shipped a
// template beside every stage's rules. The skill is read once on entering a
// stage; the template rides every prompt, which is the copy that still exists
// three hundred entries later. The test below keeps the two equal.
test('every stage on the full route has a skill', () => {
  const { FULL_ROUTE } = require('../lib/stages.js');
  for (const stage of FULL_ROUTE) {
    const want = stage === 'audit' ? 'fankeel-audit' : 'fankeel-' + stage;
    assert.ok(names.includes(want), 'no skill for ' + stage);
  }
});

test('each stage skill ends at the gate rather than trailing off', () => {
  const { FULL_ROUTE } = require('../lib/stages.js');
  for (const stage of FULL_ROUTE) {
    const want = stage === 'audit' ? 'fankeel-audit' : 'fankeel-' + stage;
    assert.match(read(want), /AskUserQuestion/, want + ' never names the gate');
  }
});

// Two copies of every stage's output shape: `template` in lib/stages.js,
// restated on every prompt, and the `## Output` block in the skill, read once on
// entering the stage. Both have to exist — a skill is also read with no task
// open, `/fankeel-audit` being the shipped case, and then nothing is being
// injected at all — so the duplication is deliberate and this is what stops it
// drifting.
//
// Five of seven had drifted, and every one the same way: the injected copy was
// the short one. The fuller version sat in the copy that recedes by thousands of
// tokens a turn, and the thin one in the copy that never does.
const outputBlock = (text) => {
  const m = /\n## Output\r?\n([\s\S]*?)(?:\r?\n## |$)/.exec(text);
  return m ? m[1] : '';
};

// Inside the fences only. What sits under them is advice about the stage — the
// word limit, what option one approves — and is not part of the shape. `verify`
// splits its shape across two fences, so they are read as one run.
const fenced = (text) => {
  const out = [];
  let inside = false;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '```') { inside = !inside; continue; }
    if (inside && line) out.push(line);
  }
  return out;
};

// A template is all shape, so its own fence markers are the only thing to drop.
const shape = (text) => String(text).split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && l !== '```');

test('each stage template is exactly the shape its skill shows', () => {
  const { FULL_ROUTE, templateFor } = require('../lib/stages.js');
  for (const stage of FULL_ROUTE) {
    const want = stage === 'audit' ? 'fankeel-audit' : 'fankeel-' + stage;
    const block = fenced(outputBlock(read(want)));
    assert.ok(block.length, want + ' has no fenced shape under ## Output');
    assert.deepEqual(shape(templateFor(stage)), block, stage);
  }
});

test('the survey skill names the map generator, which is the step that was missing', () => {
  assert.match(read('fankeel-survey'), /scripts\/map\.js/);
  assert.match(read('fankeel-survey'), /design-intent/);
});

test('the plan skill refuses placeholders by listing them', () => {
  const text = read('fankeel-plan');
  assert.match(text, /TBD/);
  assert.match(text, /Global Constraints/);
});

// The opening question was a stance the agent improvised a sentence from, and
// what reached the user priced a declaration nobody makes any more. Nothing is
// declared now, so the only question left is which repository — and it is only
// worth asking when the registry root holds more than one.
test('the opening question asks which project, in the words the design fixed', () => {
  const text = read('fankeel');
  assert.ok(text.includes('Ask `Which project?` with **AskUserQuestion**'),
    'the question is not asked in the words the design fixed');
  assert.ok(/Skip the question entirely when there\s+is only one\./.test(text),
    'it never says to skip the question when the root holds one project');
  assert.equal(text.includes('Which part of it?'), false, 'the scope question is still there');
  assert.equal(/--add/.test(text), false, 'a scope --add remedy survived');
});

// `--scope` stops being a flag `scripts/task.js` parses. A stale sentence is
// survivable; a runnable command line carrying a dead flag is not, because
// somebody pastes it and the task refuses to start. docs-audit grades a page by
// when it was last touched rather than by whether its flags exist, so nothing
// else here notices.
test('no live page offers a flag the task script no longer takes', () => {
  const pages = names.map((n) => [path.join('skills', n, 'SKILL.md'), read(n)]);
  for (const name of fs.readdirSync(path.join(ROOT, 'docs')).filter((n) => n.endsWith('.md'))) {
    pages.push([path.join('docs', name), fs.readFileSync(path.join(ROOT, 'docs', name), 'utf8')]);
  }
  for (const [rel, text] of pages) {
    assert.equal(text.includes('--scope'), false, rel + ' still offers --scope');
  }
});

// It rested on one measurement of filtering a command's output, and was used to
// bar three stages from a different kind of delegation entirely. Two neighbouring
// pages in this same plugin contradicted it: fankeel-plan writes an Interfaces
// block "for a task's implementer", and fankeel-survey says reading wide for a
// narrow answer is what a subagent is for.
test('the delegation rule is a principle, not a list of barred stages', () => {
  const text = read('fankeel');
  assert.equal(text.includes('Do not route the pipeline through subagents'), false,
    'the prohibition is still there');
  assert.match(text, /Dispatch by default, never the filtering/);
  // The measurement it cites is one this repository actually produced, and the
  // block says when. Two figures have already gone stale here undetected — a
  // number with no date reads as current however old it is, so the date is the
  // part a test can hold.
  assert.match(text, /measured 20\d\d-\d\d-\d\d/, 'the measurement block carries no date');

  // Four exact figures have rotted here — 34,150, then 49,074, 49,742, 51,457 —
  // every one of them falsified by the next commit that added a test, and every
  // one of them past a guard that barred only its predecessors by name. So the
  // shape is barred rather than the literals: no exact character count in the
  // block at all. It states the size rounded and keeps the date, which is the
  // half of a measurement that cannot go stale.
  //
  // The window was the two paragraphs from `measured 20`, which is the fence and
  // the paragraph under it — so a figure one paragraph either side of that was
  // invisible to the guard that exists to bar it. It is the whole measurement
  // now: the section heading down to the sentence that pivots to the other
  // measurement, whose figures are a one-off fan-out that cannot go stale.
  const start = text.indexOf('### Dispatch by default, never the filtering');
  const end = text.indexOf('But that measures', start);
  assert.ok(start !== -1 && end > start, 'the measurement section is not where the guard looks');
  const block = text.slice(start, end);
  assert.equal(/\d[\d,]*\s+characters/.test(block), false, 'an exact character count is back in the block');
  assert.equal(/\b\d{2},\d{3}\b/.test(block), false, 'an exact figure is back in the block');
});

// Three stage skills cite that heading by name to borrow its argument rather
// than restate it, and a citation is a link with no checker. Renaming the
// heading left two of them — fankeel-audit and fankeel-verify — pointing at a
// section that no longer existed, and nothing went red: every one of those
// pages still read as though it said something. So the tail of the heading is
// the anchor, and every page that uses it has to spell the whole thing the way
// the fankeel skill spells it.
test('every skill citing the dispatch section spells its heading correctly', () => {
  const heading = /^### (Dispatch by default,[^\r\n]*)$/m.exec(read('fankeel'));
  assert.ok(heading, 'the fankeel skill has no dispatch heading to cite');
  const tail = 'never the filtering';
  for (const name of names) {
    const flat = read(name).replace(/\s+/g, ' ');
    let at = flat.indexOf(tail);
    while (at !== -1) {
      assert.ok(flat.slice(0, at + tail.length).endsWith(heading[1]),
        `${name} cites the dispatch section as something other than "${heading[1]}"`);
      at = flat.indexOf(tail, at + 1);
    }
  }
});

// The principle replaced a prohibition, and the prohibition was the only thing
// that had said a whole stage must not be dispatched. A subagent gets the brief
// and no prompt, so the stage rules a UserPromptSubmit hook injects never reach
// it — the reason has to be on the page, not only the rule.
test('the delegation rule bars the stage itself and says why', () => {
  const text = read('fankeel');
  assert.match(text, /never the stage itself/);
  assert.match(text, /no prompt/);
});

// The stage that already said delegating was right, and then offered the user a
// manual re-run instead.
test('survey no longer offers a fourth option to authorise more reading', () => {
  const text = read('fankeel-survey');
  assert.equal(/fourth option/i.test(text), false, 'the fourth option survived');
  // The rule itself, not the word. `/dispatch/i` matched four unrelated uses of
  // "dispatching" elsewhere on the page, so replacing this sentence with **Ask
  // the user for permission before reading any wider.** — the exact thing the
  // test is named for barring — left it green.
  assert.match(text, /\*\*Dispatch when the reading is wide, or when nothing matched at all\.\*\*/);
  assert.match(text, /Never ask permission for either/);
  // Added in the pre-flight scan: the option also had a row in the main skill's
  // question-shape table, and a manual grep in a step is a check that goes
  // missing after a compaction.
  assert.equal(/read wider/i.test(read('fankeel')), false,
    'the read wider row survives in the question-shape table');
});

// The plan stage has written an Interfaces block "for a task's implementer"
// since it shipped, while the build stage never dispatched one. This is the
// field that closes that gap, and it has to be spelled the same in the rule,
// in the template that writes it, and in the loop that reads it.
test('the plan template carries the dispatch slot and names its floor', () => {
  const text = read('fankeel-plan');
  assert.match(text, /\*\*Dispatch:\*\*/);
  // The floor rule, not the word. `/sonnet/` matched the worked example in the
  // template above it, so deleting the rule that makes sonnet the floor left
  // this green — the one thing the test is named for.
  assert.match(text, /\*\*`sonnet` is the floor and the default\*\*/);
  assert.match(text, /\*\*Anything above `sonnet` names why on that same line\.\*\*/);
  assert.match(text, /opus/);
});

test('the build loop reads the dispatch line rather than always implementing', () => {
  const text = read('fankeel-build');
  assert.match(text, /\*\*Dispatch:\*\*/);
  // A returned diff would land the whole change in the parent — the one cost
  // dispatching exists to avoid.
  assert.match(text, /never a diff/i);
});

// The two skills spell the boundary differently — one bolds the "not", one does
// not — and prose reflows. Matched on the words with the bold optional, so both
// tests assert the same sentence in the same form.
const BOUNDARY = /do\s+(?:\*\*)?not(?:\*\*)?\s+dispatch\s+is\s+this\s+stage/;

// The branch that replaced the delegation ban used audit's own job as its
// example of the good case, and this skill said nothing about dispatch at all —
// so the stage most likely to reach for one had no guidance where it would
// actually be read.
test('the audit skill names its dispatch case and the line around it', () => {
  const text = read('fankeel-audit');
  assert.match(text, /one reader per pair/);
  assert.match(text, /several in one response/i);
  // And the boundary, in the stage where the temptation is strongest.
  assert.match(text, BOUNDARY);
});

// Verify is the one stage where both halves of the delegation rule apply at
// once: the suite is what a pipe removes for nothing, and "which page did this
// make false" is exactly the wide-read-narrow-answer case. The skill said
// neither, so the stage with the clearest example taught nothing.
test('the verify skill separates what a pipe removes from what a reader answers', () => {
  const text = read('fankeel-verify');
  assert.match(text, /one reader per page/);
  assert.match(text, /several in one response/i);
  assert.match(text, BOUNDARY);
});

// Measured on this branch: a reviewer told to return three lines returned three
// plus a twelve-bullet log; the next, told the same and why, returned three. The
// clause that carries the reason is the whole rule, so that is what gets pinned —
// not the word "contract", which appears elsewhere in both files.
test('a dispatch is told to state what it wants back and why that costs', () => {
  assert.match(read('fankeel'), /State the return contract, and say what it costs/);
  assert.match(read('fankeel'), /re-read on every later turn/);
  assert.match(read('fankeel-build'), /Say what you want back, and why it costs/);
  assert.match(read('fankeel-build'), /spend words\s+on the dispatch and buy them back on the return/);
});

// The section read as a list of cases where dispatching was allowed. The cost is
// residue in the parent, so the default inverts: dispatch unless the leftovers
// come out another way, and there are exactly two ways they can.
test('dispatching is the default and the two exceptions are named', () => {
  const text = read('fankeel');
  assert.match(text, /Dispatch is the default\. Doing it here is what needs a reason\./);
  assert.match(text, /a pipe already removes them/);
  assert.match(text, /it is one tool call/);
  // The same default has to land where the standalone doc states the rule, not
  // just in the skill.
  const docsText = fs.readFileSync(path.join(ROOT, 'docs', 'subagents.md'), 'utf8');
  assert.match(docsText, /\*\*dispatch\*\* \| by default/);
  assert.match(docsText, /a pipe already removes the residue/);
  assert.match(docsText, /a single tool call/);
});

// A fourth rule landed in the bullet list without anybody touching the lead-in
// that counts it, and nothing went red: "Three rules" sat above four bullets for
// a whole build, and docs/subagents.md's mirror of the same list still said
// three too. A count has no checker unless something recounts it.
test('the dispatch rule count agrees with the bullet list under it, and with the docs mirror', () => {
  const text = read('fankeel');
  const leadIn = /^(\w+) rules that make it work, each of which fails silently when missed:\r?\n\r?\n([\s\S]*?)\r?\n\r?\n\*\*/m.exec(text);
  assert.ok(leadIn, 'the dispatch rules lead-in is not where this test expects it');
  const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  const claimed = WORDS[leadIn[1].toLowerCase()];
  assert.ok(claimed, `"${leadIn[1]}" is not a recognised count word`);
  const bulletCount = (leadIn[2].match(/^- /gm) || []).length;
  assert.equal(claimed, bulletCount,
    `the lead-in says "${leadIn[1]}" but ${bulletCount} bullets follow it`);

  const docsText = fs.readFileSync(path.join(ROOT, 'docs', 'subagents.md'), 'utf8');
  const docsLeadIn = /^(\w+) things that fail silently when missed:/m.exec(docsText);
  assert.ok(docsLeadIn, 'docs/subagents.md has no matching lead-in to compare');
  assert.equal(WORDS[docsLeadIn[1].toLowerCase()], bulletCount,
    `docs/subagents.md says "${docsLeadIn[1]}" but the skill lists ${bulletCount} rules`);
});

// The stage rule carries the trigger; the skill carries the step. Without the
// step, a scope decided from the tree reads as one more thing to remember rather
// than as a move with a place in the sequence.
test('survey names the tree scope step and says what the dispatch costs', () => {
  const text = read('fankeel-survey');
  const treeAt = text.indexOf('Before you type the terms');
  const scanAt = text.indexOf('survey.js [--root <dir>] <term>...');
  assert.ok(treeAt > -1, 'the tree step has no place in the sequence');
  assert.ok(scanAt > -1, 'the scan invocation moved; this test no longer measures anything');
  assert.ok(treeAt < scanAt, 'the tree step no longer comes before the scan it scopes');
  assert.match(text, /how many readers, and on which model/i, 'the dispatch never says what it costs');
});

// The main skill's account of the scanner went straight to the terms. A step the
// stage skill carries and the page people read first does not is a step that gets
// skipped by whoever read that page first.
test('the main skill puts the tree ahead of the terms too', () => {
  const text = read('fankeel');
  const treeAt = text.indexOf('**Before the terms, the tree.**');
  const scannerAt = text.indexOf('carries a scanner rather than an instruction to search');
  assert.ok(treeAt > -1, 'the main skill still goes straight to the terms');
  assert.ok(scannerAt > -1, 'the scanner section moved; this test no longer measures anything');
  assert.ok(treeAt < scannerAt, 'the tree note no longer leads the scanner section');
});
