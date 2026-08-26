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
  assert.match(text, /Delegate the reading, never the filtering/);
  // The measurement it cites is the one this repository actually produces.
  assert.match(text, /49,074/);
  assert.equal(text.includes('34,150'), false, 'the stale figure survived');
});

// The stage that already said delegating was right, and then offered the user a
// manual re-run instead.
test('survey no longer offers a fourth option to authorise more reading', () => {
  const text = read('fankeel-survey');
  assert.equal(/fourth option/i.test(text), false, 'the fourth option survived');
  assert.match(text, /dispatch/i);
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
  assert.match(text, /sonnet/);
  assert.match(text, /opus/);
});

test('the build loop reads the dispatch line rather than always implementing', () => {
  const text = read('fankeel-build');
  assert.match(text, /\*\*Dispatch:\*\*/);
  // A returned diff would land the whole change in the parent — the one cost
  // dispatching exists to avoid.
  assert.match(text, /never a diff/i);
});
