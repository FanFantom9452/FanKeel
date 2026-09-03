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

// ALWAYS[0] lets option two answer "none — never unfinished work", and the line
// that earns that answer is the stage's own stopping condition. Five of seven
// carried one; the two that did not were `build`, whose loop is the longest
// thing in the pipeline, and `audit`, whose reading has no natural end. Both
// stated the condition somewhere in their prose, which is exactly where it is
// not read at the moment the gate is asked.
test('every stage skill states when it is done', () => {
  const { FULL_ROUTE } = require('../lib/stages.js');
  for (const stage of FULL_ROUTE) {
    const want = stage === 'audit' ? 'fankeel-audit' : 'fankeel-' + stage;
    assert.match(read(want), /\*\*Done when\*\*/, want + ' states no stopping condition');
  }
});

// The stopping condition above named one denominator: the ledger. A ledger is
// named for a plan file, so `bounded` and `spike` — two of the three classes —
// reach `build` with nothing to count against, and the stage's own `Done when`
// then describes a state they cannot reach. The classes are read from
// `lib/stages.js` rather than listed here, so a fourth one arriving with no
// `plan` on its route fails this until the denominator covers it too.
test('build names a denominator for a route with no plan', () => {
  const { CLASSES, templateFor } = require('../lib/stages.js');
  const noPlan = Object.keys(CLASSES).filter((c) => !CLASSES[c].route.includes('plan'));
  assert.ok(noPlan.length, 'no class reaches build without a plan; this test is moot');
  assert.match(templateFor('build'), /file table/,
    'build\'s output shape can only be filled in from a ledger: ' + noPlan.join(', ') + ' have none');
  // Anchored past `**Done when**` because the frontmatter description carries
  // the same phrase, and a description is what routes to the skill rather than
  // what the stage is held to. Unanchored, a body that went back to naming only
  // the ledger would still pass on the description alone.
  assert.match(read('fankeel-build'), /\*\*Done when\*\*[\s\S]*?where there is no plan/,
    'fankeel-build names only the ledger as its denominator');
});

// The denominator above says what a no-plan route counts against. It does not say
// what order those rows run in, and there are two reasons rather than one: nothing
// parses a two-column file table into tasks at all, and a table taught to declare
// its paths would still leave the shared-cause half of `conflict()` with nothing
// to match. Both belong in the branch, because stopping at the first reads as
// though declaring paths would be the fix. Each assertion below names a different
// claim — one substring standing for all three would pass on a paragraph that
// mentioned Interfaces and said nothing about order.
test('build says the no-plan rows run in order', () => {
  const branch = /\*\*With no plan file there is no ledger[\s\S]*?\n\n### /.exec(read('fankeel-build'));
  assert.ok(branch, 'the no-plan branch is not where this test looks for it');
  assert.match(branch[0], /in order, one at a time/,
    'the no-plan branch does not say what order its rows run in');
  assert.match(branch[0], /Nothing groups them/,
    'the branch states an order without saying why nothing could group the rows');
  assert.match(branch[0], /shared-cause check has nothing to match/,
    'the branch stops at the parser and never reaches the missing Interfaces half');
});

// The branch above sends a no-plan route into `## The task loop`, and that loop
// talks about groups throughout: step 1's BASE rule turns on when a task's group
// went out, and step 2 sends a whole group in one response and names the `groups`
// command. A bounded reader told two paragraphs earlier that nothing groups their
// rows then arrives at an instruction to run a command that answers `No plan at`.
// The marking is one rule at the head of the loop rather than a note per step,
// the same way docs/pipeline.md marks its flowchart.
test('the task loop marks its group language as the plan path', () => {
  const loop = /\n## The task loop\n[\s\S]*?\n## /.exec(read('fankeel-build'));
  assert.ok(loop, 'the task loop is not where this test looks for it');
  assert.match(loop[0], /Where\s+there\s+is\s+no\s+plan\s+there\s+are\s+no\s+groups/,
    'the task loop never says its group language is the plan path');
  assert.match(loop[0], /one\s+row\s+per\s+pass/,
    'the loop marks the group language without saying what a no-plan route does instead');
});

// A file-table row used to be run in session because it carried no
// `**Dispatch:**` line at all. Now the third cell of a `| file | change |
// dispatch |` row is that line, in the plan's own two forms, and the four
// things a dispatch carries map onto the row the same way they map onto a
// plan task. There is no report file on this path, because a no-plan route
// keeps nothing on disk for one to land in.
test('the task loop reads a no-plan row\'s dispatch cell where a plan\'s line would be', () => {
  const loop = /\n## The task loop\n[\s\S]*?\n## /.exec(read('fankeel-build'));
  assert.ok(loop, 'the task loop is not where this test looks for it');
  assert.match(loop[0], /\| file \| change \| dispatch \|/,
    'the task loop does not show the file table with its dispatch column');
  assert.match(loop[0], /`change` cell is the whole\s+brief/,
    'the task loop does not say the `change` cell is the whole brief');
  assert.match(loop[0], /no report file/,
    'the task loop does not say a no-plan route keeps no report file');
});

// The task loop above reads a dispatch cell that has to come from somewhere: the
// design stage writes the file table a no-plan build works from, so its template
// needs the same third column, both in the skill's own words and in the template
// text `lib/stages.js` injects at land time — one drifting from the other would
// leave a design that never produces a row a no-plan build can read.
test('the design\'s file table carries a dispatch column, in the skill and in the injected template', () => {
  assert.match(read('fankeel-design'), /\| file \| change \| dispatch \|/,
    'fankeel-design does not show the file table with its dispatch column');
  assert.match(read('fankeel-design'), /a row without one is a design failure/,
    'fankeel-design does not say a row without a dispatch cell is a design failure');
  const { templateFor } = require('../lib/stages.js');
  assert.match(templateFor('design'), /\| file \| change \| dispatch \|/,
    'the injected design template does not carry the dispatch column');
});

// Setup step 2 carries the no-plan branch and step 1 is route-neutral, which left
// step 3 as the only one of the three saying nothing. Its table has a row per pair
// of tasks sharing a file or interface and a row per task checking its own tests
// against its own code, and it ends by writing that table into the ledger — three
// things a two-column row does not have. The `groups` command inside it is already
// covered by step 2 branch; the table and the ledger write were not.
test('the plan scan says what a no-plan route does instead', () => {
  const step = /\n### 3\. Scan the plan before the first task\n[\s\S]*?\n## /.exec(read('fankeel-build'));
  assert.ok(step, 'the plan scan is not where this test looks for it');
  assert.match(step[0], /With\s+no\s+plan\s+there\s+is\s+nothing\s+here\s+to\s+scan/,
    'the plan scan never says it is the plan path');
  assert.match(step[0], /no\s+ledger\s+to\s+write\s+it\s+into/,
    'the scan is marked plan-only without naming the ledger write it also cannot do');
});

// Past the loop the page keeps speaking to the plan path only. The ruling verb is
// a `ledger.js` call, and the fourth of the four things that stop the loop is a
// plan so broken every path forward is a guess. The mechanism is disclaimed far
// above, in the setup branch that sends a completion line to the response and the
// commit message; the section that actually issues the ruling is where a reader
// stops, and nothing there said which route it was talking to.
test('the ruling section says where a no-plan ruling goes', () => {
  const section = /\n## Rulings, not stalls\n[\s\S]*?\n## /.exec(read('fankeel-build'));
  assert.ok(section, 'the ruling section is not where this test looks for it');
  assert.match(section[0], /With\s+no\s+plan\s+the\s+ruling\s+goes\s+in\s+the\s+response/,
    'the ruling section names only a ledger.js call and never the no-plan route');
  assert.match(section[0], /a\s+plan,\s+or\s+a\s+file\s+table,\s+so\s+broken/,
    'the fourth stopper still stops only on a broken plan, which a no-plan route has none of');
});

// The same one heading later. A file table can be wrong exactly as a plan can, and
// is ruled on the same way; what does not carry over is the task-boundary half,
// because a row is a line in a table rather than a task with its own test cycle.
// Saying only the first would leave a reader ruling a row back to a document that
// does not exist.
test('the plan-is-wrong section covers a file table too', () => {
  const section = /\n## When the plan is wrong\n[\s\S]*?\n## /.exec(read('fankeel-build'));
  assert.ok(section, 'the plan-is-wrong section is not where this test looks for it');
  assert.match(section[0], /A\s+file\s+table\s+is\s+wrong\s+the\s+same\s+way/,
    'the section speaks only to a plan, which a bounded route reaching it does not have');
  assert.match(section[0], /task-boundary\s+half\s+has\s+nothing\s+to\s+say/,
    'the section carries the file table over without saying which half does not carry');
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

// On 2026-09-01 a session read the Workflow tool's `ultracode` gate as though it
// applied to the Agent tool too, stopped dispatching, and two builds ran in
// session on that misreading. On 2026-09-02 the mistake was written down as a
// property of the host — "a host that allows a subagent only on the user's own
// word" — across four pages. The Agent tool has no gate; only Workflow does.
// This test forbids that sentence from coming back, and pins the sentence that
// replaced it: in-session is the user's call for that session, not the host's.
test('in-session is the user\'s call for this session, never the host\'s', () => {
  const texts = [read('fankeel'), read('fankeel-plan'), read('fankeel-build'),
    fs.readFileSync(path.join(ROOT, 'docs', 'subagents.md'), 'utf8')];
  for (const text of texts) {
    assert.doesNotMatch(text, /allows a subagent only on the user's own word/,
      'the host-property misreading is back in one of the four pages');
    assert.match(text, /the user said so this\s+session/,
      'a page is missing the sentence that replaced the host-property misreading');
  }
  const top = read('fankeel');
  assert.match(top, /not a third way/,
    'the skill no longer says this is not a third exception to dispatch-by-default');
  assert.match(top, /has no\s+gate/,
    'the skill does not say the Agent tool has no gate');
  assert.match(top, /ultracode/,
    'the skill does not name the Workflow tool\'s ultracode gate');
  const mirror = fs.readFileSync(path.join(ROOT, 'docs', 'subagents.md'), 'utf8');
  assert.match(mirror, /neither case/,
    'docs/subagents.md does not say neither case is a third exception');
  assert.match(mirror, /has no\s+gate/,
    'docs/subagents.md does not say the Agent tool has no gate');
  assert.match(mirror, /ultracode/,
    'docs/subagents.md does not name the Workflow tool\'s ultracode gate');
  const plan = read('fankeel-plan');
  assert.match(plan, /same reason as Task 1/,
    'fankeel-plan does not point the decision back at the same reason as Task 1');
  assert.match(plan, /has no\s+gate/,
    'fankeel-plan does not say the Agent tool has no gate');
  const build = read('fankeel-build');
  assert.match(build, /a ruling, not a stopper/,
    'fankeel-build does not call the reviewer location a ruling, not a stopper');
  assert.match(build, /has no\s+gate/,
    'fankeel-build does not say the Agent tool has no gate');
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
  const docsLeadIn = /^(\w+) things that fail silently when missed:([\s\S]*?)\r?\n\r?\n/m.exec(docsText);
  assert.ok(docsLeadIn, 'docs/subagents.md has no matching lead-in to compare');
  assert.equal(WORDS[docsLeadIn[1].toLowerCase()], bulletCount,
    `docs/subagents.md says "${docsLeadIn[1]}" but the skill lists ${bulletCount} rules`);

  // The word alone was half a check: both lead-ins could be edited to "Six"
  // while the prose under one of them still listed five. The page runs its list
  // as one sentence with exactly one bold phrase naming each item, so the items
  // are countable the same way the bullets are.
  const docsItems = (docsLeadIn[2].match(/\*\*/g) || []).length / 2;
  assert.equal(docsItems, bulletCount,
    `docs/subagents.md says "${docsLeadIn[1]}" but its prose names ${docsItems} things`);
});

// The ceiling paragraph said four and stopped, which reads as "past four, don't"
// — and the one tool that covers the case past four went unnamed in both files
// for four releases. Naming it is only half the rule. Until 0.43.0 the other
// half was "never launch it": the host's gate was read as `ultracode` alone,
// when the host opens the tool on five things and the fourth is a skill the
// user invoked whose instructions say to run one — which `/fankeel` is. So the
// pin is now the valve and where the spend is authorised, the old sentence is
// forbidden, and the admission of no control stays: two chains have run, none
// against a four-dispatch arm.
test('both dispatch surfaces name the Workflow tool, and bound it', () => {
  const surfaces = [
    ['skills/fankeel/SKILL.md', read('fankeel')],
    ['docs/subagents.md', fs.readFileSync(path.join(ROOT, 'docs', 'subagents.md'), 'utf8')],
  ];
  for (const [label, text] of surfaces) {
    const flat = text.replace(/\s+/g, ' ');
    assert.match(flat, /\bWorkflow\b/, label + ' never names the Workflow tool');
    assert.match(flat, /fan-out whose output feeds another fan-out/,
      label + ' does not say which shape the ceiling cannot cover');
    assert.match(flat, /a skill the user invoked whose instructions say to run one/,
      label + ' does not name the valve a stage rule opens');
    assert.match(flat, /the host's own run dialog/,
      label + ' does not say where the spend is authorised');
    assert.doesNotMatch(flat, /offered rather than launched/,
      label + ' still says the tool may not be started here');
    assert.match(flat, /\bunmeasured\b/i,
      label + ' argues the case without admitting no control was run');
    // The old sentence is banned only in the paragraph that carried it: the
    // same words describe a probe cell elsewhere on the docs page, and a
    // file-wide ban made an implementer rewrite that sentence to pass.
    const start = flat.indexOf('fan-out whose output feeds another fan-out');
    const block = flat.slice(start, start + 1600);
    assert.doesNotMatch(block, /never launch(ed)?\b/i,
      label + ' still says the tool may not be started here');
    // Four exact figures have already rotted in the block above this one. The
    // runs behind this paragraph live in a dated report; a figure appearing
    // here is one nobody will re-measure.
    assert.equal(/\b\d{2},\d{3}\b/.test(block), false,
      label + ' grew a figure for a comparison nobody ran');
  }
});

// The two chains in this repository that are that shape — verifiers then an
// adversary, pair readers then an adversary — were written as Agent dispatches
// in both stage skills while the page above said only a workflow covers the
// shape. Each skill now says when the chain is one workflow, carries the model
// floor into the script, and keeps the Agent form for a declined dialog.
test('verify and audit run their chain as one workflow where the host opens it', () => {
  for (const n of ['fankeel-verify', 'fankeel-audit']) {
    const flat = read(n).replace(/\s+/g, ' ');
    assert.match(flat, /\bWorkflow\b/, n + ' never names the Workflow tool');
    assert.match(flat, /where the host opens it/i,
      n + ' does not say when the chain is a workflow');
    assert.match(flat, /`model`[^.]{0,160}`sonnet`/,
      n + ' does not carry the model floor into the script');
    assert.match(flat, /\bAgent\b[^.]{0,200}\bfallback\b/,
      n + ' keeps no Agent form for a declined dialog');
    assert.doesNotMatch(flat, /`(agent|pipeline|parallel|phase)\(\)`/,
      n + ' writes a script call as a symbol this repository would have to declare');
  }
});

// The same shape, in a second file, found the same way. The plan skill's list of
// rules about the `Dispatch:` line went from Three to Four when the disclosure
// arrived, and nothing recounted it — which is exactly the gap the test above
// was written to close for its own list.
test('the plan skill counts its own rules about the Dispatch line', () => {
  const leadIn = /^(\w+) rules about that line:\r?\n\r?\n([\s\S]*?)\r?\n\r?\n\*\*/m.exec(read('fankeel-plan'));
  assert.ok(leadIn, 'the Dispatch rules lead-in is not where this test expects it');
  const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  const claimed = WORDS[leadIn[1].toLowerCase()];
  assert.ok(claimed, `"${leadIn[1]}" is not a recognised count word`);
  const items = (leadIn[2].match(/^\d+\. /gm) || []).length;
  assert.equal(claimed, items, `the lead-in says "${leadIn[1]}" but ${items} rules follow it`);
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

// `survey` has said what a fan-out costs since the day it started dispatching,
// and the four stages that dispatch after it never did. The asymmetry reads as
// though only survey costs anything: a verify stage that sends four readers, or
// a build task that dispatches an implementer, bills for a tier nobody named.
// The contract lives in one place and the stages that use it repeat it, so this
// checks both ends — the rule, and every stage skill that dispatches under it.
//
// Derived, not listed. A hand-written array is the thing that rots: the day
// `fankeel-design` or `fankeel-land` starts dispatching, a list would go on
// passing while the new dispatcher said nothing about what it costs. A skill
// that names dispatching at all is one that has to say what it costs, which is
// the same shape as `tests/docs-audit.test.js` counting from `defects()` rather
// than from the prose beside it. Today that derives to five of the seven;
// `design` and `land` do not mention it, and the floor below catches the
// derivation collapsing.
//
// Derived inside the test, not at module load. A skill directory with no
// SKILL.md has its own named failure at the top of this file; reading every one
// of them while the module evaluates turns that into an ENOENT stack trace that
// aborts the whole file and diagnoses nothing.
//
// A negative mention is not a dispatch. `fankeel-verify` says "What you do not
// dispatch is this stage", and a bare /dispatch/i would read a page saying it
// dispatches nothing as a page that has to disclose what it dispatches — and
// the disclosure it was then made to carry would cost injected characters four
// stages cannot spare.
const dispatchers = () => names.filter((n) => n.startsWith('fankeel-')
    && /dispatch/i.test(read(n).replace(/do(es)? not dispatch[^.]*\./gi, '')));

test('every stage that dispatches says how many and on which model', () => {
  const DISPATCHERS = dispatchers();
  assert.ok(DISPATCHERS.length >= 5,
    'only ' + DISPATCHERS.length + ' skills name dispatching; the derivation has collapsed');
  for (const name of DISPATCHERS) {
    // Both halves, and in the same breath. Asserting only the model passed a
    // build skill that named the task instead of the count; asserting the two
    // anywhere in the file passes a skill that lost the disclosure entirely and
    // happens to use "how many" elsewhere — `skills/fankeel/SKILL.md` uses that
    // phrase five times. The prose wraps at 80 columns, so the gap between them
    // has to allow a newline.
    assert.match(read(name).replace(/\s+/g, ' '), /how many[^.]{0,80}on which model/i,
      name + ' never says how many and on which model in one sentence');
  }
  assert.match(read('fankeel'), /\*\*Say\s+how\s+many,\s+and\s+on\s+which\s+model/,
    'the dispatch contract does not carry the disclosure as a rule of its own');
  // Both halves here too. `/said out loud/` on its own passed a page that could
  // drop "the count and the model" and keep the phrase.
  const page = fs.readFileSync(path.join(ROOT, 'docs', 'subagents.md'), 'utf8');
  assert.match(page, /count\s+and\s+(the\s+)?model/i, 'the reference page drops the count');
  assert.match(page, /said\s+out\s+loud/i, 'the reference page states the contract without the disclosure');
});

// The commit moved to the parent so that two implementations can overlap while
// their commits do not. A skill that still tells the implementer to commit is
// the one sentence that undoes it, and `groups` is how the loop knows which
// tasks may overlap at all — a build skill naming neither has lost both halves.
test('the build skill moves the commit to the parent', () => {
  const text = read('fankeel-build');
  assert.match(text, /does not commit/);
  assert.match(text, /groups/);
});

// The commit skeleton is injected at land and not at build — build's injection
// has no room, and a cap there is displaced into rather than raised — so the
// only place build reads it is step 4 of its skill. `tests/stages.test.js` pins
// land's injected copy; this pins the one build depends on, and the fence the
// land skill shows.
test('the build skill carries the commit skeleton its injection cannot', () => {
  const step = /\n4\. Commit[\s\S]*?\n5\. /.exec(read('fankeel-build'));
  assert.ok(step, 'step 4 of the build loop is not where this test looks for it');
  const text = step[0].replace(/\s+/g, ' ');
  assert.match(text, /`type: what changed` under 60 characters/);
  assert.match(text, /one bullet per change with the module it landed in/);
  assert.match(text, /one paragraph only for what a bullet cannot hold/);
  assert.match(read('fankeel-land'), /\ntype: what changed, under 60 characters/);
});
