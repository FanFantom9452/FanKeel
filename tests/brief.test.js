'use strict';

// A subagent starts with none of the parent's context, so the map is the one
// thing worth naming: reading a file costs a context that gets thrown away,
// where asking the parent costs one that does not.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const { renderBrief, RETURN_RULES, ANSWERED_MAX } = require('../lib/render.js');
const { byName: stageByName } = require('../lib/stages.js');
const mkTmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'brief.js');
const SESSION = 'aaaaaaaa-0000-4000-8000-000000000001';

const tmp = () => mkTmp('fankeel-brief-');

function seed(root, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, SESSION + '.json'), JSON.stringify(Object.assign({
    task: 'rework the colour ramp',
    claims: ['statusline.ps1', 'statusline.sh'],
    stage: 'build',
    active: true,
    started: new Date(Date.now() - 3600e3).toISOString(),
    updated: new Date().toISOString(),
  }, over), null, 2) + '\n');
}

// The project file, not the machine one: `hooks/brief.js` (copying
// hooks/resume.js) resolves the project root as `docs.projectRootsFor(root,
// mine.project ? [mine.project] : [])[0] || root`, and none of these records
// set `project`, so that call returns `root` itself. The machine file is the
// other half of the read, and `run` points `CLAUDE_CONFIG_DIR` at an empty
// tmp dir so the real one — shared, machine-wide — is never what a test reads.
function seedProfile(root, values) {
  const dir = path.join(root, '.fankeel');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify(values, null, 2) + '\n');
}

function run(root, payload) {
  return execFileSync(process.execPath, [HOOK], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: mkTmp('fankeel-cfg-') }),
  });
}

const start = (root, over) => Object.assign({
  session_id: SESSION,
  cwd: root,
  hook_event_name: 'SubagentStart',
  agent_id: 'agt_01',
  agent_type: 'general-purpose',
}, over);

const contextOf = (out) => {
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'SubagentStart');
  return parsed.hookSpecificOutput.additionalContext;
};

function briefFor(stage, values) {
  const root = tmp();
  seedProfile(root, Object.assign({ 'stage.agents': [stage] }, values));
  seed(root, { stage, started: '2026-09-19T09:30:12.345Z' });
  return contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
}

const entry = (over) => ({
  sessionId: SESSION,
  data: Object.assign({
    task: 'rework the colour ramp',
    claims: ['statusline.ps1'],
    stage: 'build',
    active: true,
  }, over),
});

// ---- the hook ------------------------------------------------------------

test('a session with no task briefs nobody', () => {
  const root = tmp();
  assert.equal(run(root, start(root)), '');
});

test('a stood-down task briefs nobody', () => {
  const root = tmp();
  seed(root, { active: false });
  assert.equal(run(root, start(root)), '');
});

test('a live task names itself and the files it is already in to the subagent', () => {
  const root = tmp();
  seed(root);
  const text = contextOf(run(root, start(root)));
  assert.match(text, /^FANKEEL — you are a subagent of: rework the colour ramp @ build$/m);
  assert.match(text, /^touched: statusline\.ps1, statusline\.sh$/m);
});

test('the brief says what the return value costs', () => {
  const root = tmp();
  seed(root);
  const text = contextOf(run(root, start(root)));
  for (const rule of RETURN_RULES) assert.ok(text.includes(rule), rule);
});

test('the agent type is carried through', () => {
  const root = tmp();
  seed(root);
  assert.match(contextOf(run(root, start(root, { agent_type: 'Explore' }))), /agent type: Explore/);
});

test('a build brain\'s brief names its group and the file a group writes instead of the gated one', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'a1' })));
  assert.match(text, /Your prompt names your case: task numbers for a group, or `build close`/);
  assert.match(text, /build-g1\.md instead of \S*build\.md/);
  assert.match(text, /the only gate this whole stage asks/);
  assert.ok(text.length < 10000, 'brain brief is ' + text.length + ' chars');
});

test('a grouped build brain is told to write its own commit file, not the plain one', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'a1' })));
  assert.match(text, /build-g1-commit\.md/);
  assert.equal(text.includes('build-commit.md'), false, 'must not also name the plain, ungrouped commit file');
});

test('two brains dispatched together for build get distinct groups, and both marks stay in flight until each reports', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const first = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'a1' })));
  const second = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'a2' })));
  assert.match(first, /build-g1\.md/);
  assert.match(second, /build-g2\.md/);
  const mark = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), 'utf8')).inflight;
  assert.equal(Array.isArray(mark), true);
  assert.deepEqual(mark.map((m) => m.group).sort(), [1, 2]);
});

function agentLine(root, id, prompt) {
  const sub = path.join(root, 'sess', 'subagents');
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, 'agent-' + id + '.jsonl'), JSON.stringify({ type: 'user', message: { role: 'user', content: prompt } }) + '\n');
}

test('a build brain sent as `build group 3` gets mark group 3 whatever order it started in; `build close` gets kind close', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const transcript = path.join(root, 'sess.jsonl');
  agentLine(root, 'c1', 'build close for this plan.');
  agentLine(root, 'g3', 'build group 3: tasks 4, 5.');
  run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'c1', transcript_path: transcript }));
  run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'g3', transcript_path: transcript }));
  const marks = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), 'utf8')).inflight;
  const close = marks.find((m) => m.agentId === 'c1');
  const group = marks.find((m) => m.agentId === 'g3');
  assert.equal(close.kind, 'close');
  assert.deepEqual([group.kind, group.group], ['group', 3]);
});

test('a prompt keeps its own case when it mentions the other phrase later', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const transcript = path.join(root, 'sess.jsonl');
  agentLine(root, 'g2', 'build group 2: tasks 3, 4. Do not do build close; that is another brain.');
  agentLine(root, 'c1', 'build close. Build group 2 has its own brain.');
  run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'g2', transcript_path: transcript }));
  run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'c1', transcript_path: transcript }));
  const marks = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), 'utf8')).inflight;
  assert.deepEqual([marks.find((m) => m.agentId === 'g2').kind, marks.find((m) => m.agentId === 'g2').group], ['group', 2]);
  assert.equal(marks.find((m) => m.agentId === 'c1').kind, 'close');
});

test('a build brain whose transcript cannot be read keeps today\'s numbering and carries no kind', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'u1', transcript_path: path.join(root, 'sess.jsonl') }));
  const mark = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), 'utf8')).inflight;
  assert.equal(mark.group, 1);
  assert.equal('kind' in mark, false);
});

function stderrOf(root, payload) {
  return spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: mkTmp('fankeel-cfg-') }),
  }).stderr;
}

test('a build brain whose transcript file cannot be opened records the reason on stderr', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const err = stderrOf(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'u1', transcript_path: path.join(root, 'sess.jsonl') }));
  assert.match(err, /fankeel brief: transcript of u1 unreadable: .*ENOENT/);
});

test('a build brain whose transcript line 1 is not JSON records the reason on stderr', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const sub = path.join(root, 'sess', 'subagents');
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, 'agent-b1.jsonl'), 'not json\n');
  const err = stderrOf(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'b1', transcript_path: path.join(root, 'sess.jsonl') }));
  assert.match(err, /fankeel brief: line 1 of transcript of b1 is not readable JSON: /);
});

test('a judge is told it answers once', () => {
  const root = tmp();
  seed(root);
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel-judge' })));
  assert.match(text, /Answer once\. The parent will not message you again/);
  assert.doesNotMatch(contextOf(run(root, start(root, { agent_type: 'Explore' }))), /Answer once/);
  // What the hook receives is the type as dispatched, and every skill dispatches
  // the judge as `fankeel:fankeel-judge` — the bare form above is what the
  // comparison used to match, and matching only that is how the line went
  // missing. docs/reports/2026-09-11-hook-payload-probe.md measured the prefix.
  assert.match(contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-judge' }))),
    /Answer once\. The parent will not message you again/,
    'the prefixed type is what a real dispatch sends');
});

test('a payload with no session id says nothing', () => {
  const root = tmp();
  seed(root);
  assert.equal(run(root, start(root, { session_id: undefined })), '');
});

test('a payload that is not JSON does not stop the subagent', () => {
  const root = tmp();
  seed(root);
  assert.equal(run(root, 'not json'), '');
});

test('the brief stays small — it is read by every subagent that starts', () => {
  const root = tmp();
  seed(root);
  const text = contextOf(run(root, start(root)));
  assert.ok(text.length < 1400, 'brief is ' + text.length + ' chars');
});

// The three rules that shipped first are all about the return value and the
// dispatch; none of them is about the tree the subagent is standing in. A
// parallel reader loses its work to one `git stash` and nothing warns it,
// because `guard.js` matches Edit|Write|NotebookEdit and no shell tool —
// which 2026-09-10's judgement decided to leave that way, naming this rule
// as the layer that carries it instead.
test('the brief tells a subagent not to change the working tree', () => {
  const root = tmp();
  seed(root);
  const text = contextOf(run(root, start(root)));
  assert.match(text, /working tree outside the job you were sent to do/,
    'the brief carries no working-tree rule');
});

test('no registry file is written on behalf of a subagent', () => {
  const root = tmp();
  seed(root);
  const before = fs.readdirSync(path.join(root, '.fankeel', 'sessions'));
  run(root, start(root));
  assert.deepEqual(fs.readdirSync(path.join(root, '.fankeel', 'sessions')), before,
    'a subagent got an entry of its own, which would put a second claimant on the parent’s files');
});

// ---- the text ------------------------------------------------------------

test('the brief is not the stage rules', () => {
  // A subagent is not running the pipeline; it is doing one bounded job inside
  // somebody else's stage. Handing it "commit the reason, not the diff" is
  // instructions for work it is not doing.
  const text = renderBrief({ mine: entry({ stage: 'land' }) });
  for (const rule of stageByName('land').rules) assert.equal(text.includes(rule), false, rule);
});

// The brief used to carry a digest of the chosen output style. That whole
// mechanism existed to bridge the gap between a skill setting a style and the
// style being in force. The skill went in 0.20.0 and the styles themselves on
// 2026-09-13; this keeps the digest from growing back.
test('a style is never restated in the brief', () => {
  assert.equal(renderBrief({ mine: entry({ style: 'review' }) }).includes('voice ('), false);
});

test('a task that has touched nothing yet drops the line rather than rendering an empty one', () => {
  const text = renderBrief({ mine: entry({ claims: [] }) });
  assert.equal(text.includes('touched:'), false);
  assert.equal(text.includes('undefined'), false);
});

// A rule used to sit here telling the subagent to name any file it wrote outside
// the declared scope. Nothing declares a scope now, the write is recorded under
// the parent's session id by `hooks/touch.js` whoever made it, and nothing in this
// plugin reads a return value — so the sentence only ever lengthened the one output
// the brief exists to keep short.
test('the brief asks for no report about which files were written', () => {
  const text = renderBrief({ mine: entry() });
  assert.equal(text.includes('outside that scope'), false);
  assert.equal(text.includes('name the file and say why'), false);
});

test('no entry renders nothing rather than a header with holes in it', () => {
  assert.equal(renderBrief({ mine: null }), null);
  assert.equal(renderBrief({}), null);
});

// Observed by superpowers and reported as a real cost: every reviewer a worker
// spawned duplicated the review the parent dispatched anyway — a whole extra
// seat per task, at full price, for a verdict that counts for nothing. This is
// the one rule about dispatching that belongs in the brief, because it is the
// only one addressed to the subagent rather than to whoever dispatched it.
test('the brief tells a subagent not to dispatch subagents of its own', () => {
  assert.match(RETURN_RULES.join(' '), /not dispatch subagents of your own/i);
  // And it reaches a real subagent, not only the array.
  const root = tmp();
  seed(root);
  assert.match(contextOf(run(root, start(root))), /not dispatch subagents of your own/i);
});

test('a stage agent gets its stage\'s rules and shape, its skill, and where to write', () => {
  const { rulesFor, templateFor } = require('../lib/stages.js');
  const { SCRIPTS, PLUGIN_ROOT, RETURN_RULES } = require('../lib/render.js');
  const { landClause } = require('../lib/profile.js');
  const root = tmp();
  // Seeded with the land answers so the expected rules are built from the same
  // values the brief was rendered with. A survey brief has no rule that reads them,
  // so this test cannot tell a brief rendered without a profile from one rendered
  // with it; the land and design test below is the control for that.
  const values = { 'stage.agents': true, 'land.integration': 'merge', 'land.push': false, 'land.archivePlan': true };
  seedProfile(root, values);
  seed(root, { stage: 'survey', started: '2026-09-19T09:30:12.345Z' });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  const expected = rulesFor('survey', Object.assign({ next: 'design', profileLand: landClause(values) }, SCRIPTS), values);
  for (const rule of expected) assert.ok(text.includes('  - ' + rule), 'missing rule: ' + rule.slice(0, 60));
  for (const line of templateFor('survey').split('\n').filter(Boolean)) assert.ok(text.includes('  ' + line), 'missing shape line: ' + line);
  assert.ok(text.includes(PLUGIN_ROOT + '/skills/fankeel-survey/SKILL.md'));
  assert.ok(text.includes('/.fankeel/build/task-20260919T093012/survey.md'));
  assert.ok(text.includes(SESSION));
  assert.ok(!text.includes(RETURN_RULES[2]), 'the no-dispatch rule is left out');
  // The controller prints a survey's report above the gate, but the question
  // goes out on its own card, so a gate that says "the answer is above" still
  // points at nothing the card holds.
  assert.ok(text.includes('The controller prints your report above its gate block, but the question is asked on its own card'), 'the gate must stand on its own');
  assert.ok(!text.includes('The user sees only the path to your report'), 'a survey report is printed, so this would be false');
  // Run one command per call, the stage agent took 34 and 48 tool calls over a
  // survey a main session did in 5 and 6, each call re-sending its context.
  assert.ok(text.includes('Run independent commands in one Bash call'), 'the brief must ask for batched commands');
  // Batched, it still opened each cited place with a Read of its own, 18 and 17 of them.
  assert.ok(text.includes('Read the lines you cite with `sed -n'), 'the brief must ask for cited lines read in Bash');
  // The shape's own word cap said nothing about the file, and the handoffs ran 6–9 KB.
  assert.ok(text.includes("The output rule's word count is this file's"), 'the brief must bind the word cap to the handoff');
  assert.ok(text.length < 10000, 'brain brief is ' + text.length + ' chars');
});

test('a brain\'s stage rules are rendered with the profile: a land brain carries the clause and the archive rule the profile answers, a controlled design brain never the mockup rule', () => {
  const { landClause } = require('../lib/profile.js');
  const values = { 'land.integration': 'merge', 'land.push': false, 'land.archivePlan': true };
  const brief = (stage, over) => {
    const root = tmp();
    seedProfile(root, Object.assign({ 'stage.agents': [stage] }, over));
    seed(root, { stage, started: '2026-09-19T09:30:12.345Z' });
    return contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  };
  const land = brief('land', values);
  assert.ok(land.includes('  - Integration — ' + landClause(values) + '.'), 'the land brief must carry ' + landClause(values));
  assert.doesNotMatch(land, /open the menu/);
  assert.match(land, /archived; the profile said so, no question/);
  assert.doesNotMatch(land, /archived, after asking/);
  // The other side: with no land answer in the profile the menu is still what it says.
  const bare = brief('land', {});
  assert.match(bare, /Integration — no land answer in the profile: open the menu/);
  assert.match(bare, /archived, after asking/);
  // A controlled design brain has no agent that can Write or Edit a mockup
  // page (agentsFor('design') is reader and reviewer only), so the rule is
  // filtered out of its brief even with a model named — this `brief` helper
  // always controls the stage it asks for.
  const mockup = /Mockup first: one page at `design\.mockup`'s model/;
  const design = brief('design', { 'design.mockup': 'sonnet' });
  assert.doesNotMatch(design, mockup);
  assert.doesNotMatch(brief('design', {}), mockup);
  for (const [name, text] of [['land', land], ['design', design]]) assert.ok(text.length < 10000, name + ' brief is ' + text.length + ' chars');
});

// `stage.agents` gates the brain branch itself, not just the mechanism around
// it: `renderBrief` never read a profile before this, so `hooks/brief.js`
// never passed one, and `fankeel-brain` got the controller's block regardless
// of the switch — a handoff nothing reads. docs/subagents.md's own opening
// sentence says otherwise.
// `stage.agents` can now hand the brain any stage, not only `survey`, and a
// stage's own rules can name a reviewer by name (`lib/stages.js:281,304`).
// The brief's Workflow override used to name only the reader as what
// replaces "one workflow" below, so a brain running `build` was handed a
// rule it had no legal way to follow. lib/render.js:412 is the fix.
test('a brain running a stage whose rules name a reviewer may dispatch one', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.match(text, /fankeel:fankeel-reviewer/, 'the brief must name fankeel:fankeel-reviewer as an Agent the brain may dispatch');
  // The brief is half of it. `## Tools` in the agent file is the other half —
  // the section a stage agent reads as its permission scope — and a brief
  // permitting what that section forbids is the silent rule collision this
  // test exists to prevent. Scoped to the section on purpose, though not
  // because an unscoped match was failing: the prefixed `fankeel:fankeel-…`
  // form appears only here, so matching the whole file happened to reach
  // this section and nothing else. That is an accident of how the
  // frontmatter is worded — write the prefix into the `description` and an
  // unscoped assertion goes slack with nothing to say so. Scoping makes it
  // hold by construction instead. `tools:`
  // carrying `Agent` is pinned by tests/agents.test.js off the parsed
  // frontmatter and is not restated here.
  const agentFile = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-brain.md'), 'utf8');
  const tools = agentFile.split(/^## /m).find((s) => s.startsWith('Tools'));
  assert.ok(tools, 'agents/fankeel-brain.md must have a ## Tools section');
  assert.match(tools, /fankeel:fankeel-reviewer/, 'its ## Tools must name the reviewer, or the brief permits what the contract forbids');
});

test('a stage agent with stage.agents off gets the ordinary brief', () => {
  const root = tmp();
  seed(root, { stage: 'survey', started: '2026-09-19T09:30:12.345Z' });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.ok(!text.includes('stage rules:'));
  assert.ok(!text.includes('survey.md'));
  assert.ok(text.length < 1400, 'brief is ' + text.length + ' chars');
});

test('a stage agent at a stage with no controller gets the ordinary brief', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': true });
  seed(root, { stage: 'design', started: '2026-09-19T09:30:12.345Z' });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.ok(!text.includes('stage rules:'));
  assert.ok(!text.includes('design.md'));
});

test('every other agent type at survey gets no stage rules', () => {
  const root = tmp();
  seed(root, { stage: 'survey', started: '2026-09-19T09:30:12.345Z' });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-reader' })));
  assert.ok(!text.includes('stage rules:'));
  assert.ok(text.length < 1400, 'brief is ' + text.length + ' chars');
});

test('a stage agent on a record with no started gets the ordinary brief', () => {
  const root = tmp();
  seed(root, { stage: 'survey', started: undefined });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.ok(!text.includes('stage rules:'));
});

test('a build brain may dispatch a fixer and an implementer, a verify brain a verifier, a fixer and an implementer, a survey brain neither', () => {
  const dispatchLine = (stage) => {
    const root = tmp();
    seedProfile(root, { 'stage.agents': [stage] });
    seed(root, { stage, started: '2026-09-19T09:30:12.345Z' });
    const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
    return text.match(/You cannot run Workflow\. Dispatch[^\n]*/)[0];
  };
  const build = dispatchLine('build');
  assert.match(build, /fankeel:fankeel-fixer/);
  assert.match(build, /implementer/);
  assert.match(build, /`fankeel:fankeel-reviewer`, `fankeel:fankeel-render-reviewer`, `fankeel:fankeel-fixer` or an implementer/);
  assert.match(dispatchLine('verify'), /fankeel:fankeel-verifier/);
  assert.match(dispatchLine('verify'), /`fankeel:fankeel-render-reviewer`, `fankeel:fankeel-verifier`, `fankeel:fankeel-fixer` or an implementer \(`general-purpose`, on the `dispatch.floor` model/);
  const survey = dispatchLine('survey');
  assert.match(survey, /fankeel:fankeel-reader/);
  assert.match(survey, /Dispatch `fankeel:fankeel-reader` or `fankeel:fankeel-reviewer` with the Agent tool/);
  assert.doesNotMatch(survey, /fankeel-fixer|fankeel-verifier|fankeel-render-reviewer|implementer/);
});

test('a build brain is told to ask for its commits through a commit file, a verify brain to send an implementer for a mutation', () => {
  const brief = (stage) => {
    const root = tmp();
    seedProfile(root, { 'stage.agents': [stage] });
    seed(root, { stage, started: '2026-09-19T09:30:12.345Z' });
    return contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  };
  const commitFile = /\.fankeel\/build\/task-20260919T093012\/build-g1-commit\.md/;
  const build = brief('build');
  assert.match(build, /You cannot commit: `git commit` and `git add` are refused to you\. Ask for a commit only when none of your implementers is still running[^\n]*write [^\n]*build-g1-commit\.md[^\n]*return `commit [^\n]*build-g1-commit\.md` and nothing else\. The controller commits and messages you `<base>\.\.<sha>`/);
  assert.match(build, commitFile);
  assert.match(build, /You have no Edit\. A task whose Dispatch line says in-session goes to an implementer on model `sonnet` like any other: send it the task's brief\./);
  assert.match(build, /relative to the repository root\. The reply is those lines or one line `commit\.js: <why>`; a failure stops at `commit\.js: block <n>: <why>` after the lines that landed\. A further line `profile: <file> does not parse — its values were skipped` may follow the range lines: a warning, not a failure, so name it in your report and do not treat it as a refusal\. If <why> is about your file or the paths you listed \([^)]*nothing to commit, cannot read\): fix it and ask again, but the same error twice means the stage is blocked\. If it is anything else \([^)]*usage\): the stage is blocked, so say so in the report\. Return the report path when the whole stage is done or blocked\./);
  assert.doesNotMatch(build, /You cannot edit or restore a file/);
  const verify = brief('verify');
  assert.match(verify, /You cannot edit or restore a file\. To apply a mutation, run the test and restore the file, send an implementer on model `sonnet`: it does all three, and you read what it returns/);
  assert.doesNotMatch(verify, /You cannot commit|You have no Edit/);
  assert.doesNotMatch(brief('survey'), /You cannot commit|You cannot edit or restore|You have no Edit/);
});

test('a brain is told the profile\'s dispatch.floor as the model for the implementer it sends itself', () => {
  const brief = (stage, values) => {
    const root = tmp();
    seedProfile(root, Object.assign({ 'stage.agents': [stage] }, values));
    seed(root, { stage, started: '2026-09-19T09:30:12.345Z' });
    return contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  };
  assert.match(brief('verify', {}), /send an implementer on model `sonnet`: it does all three/);
  assert.match(brief('verify', { 'dispatch.floor': 'opus' }), /send an implementer on model `opus`: it does all three/);
  assert.match(brief('build', { 'dispatch.floor': 'opus' }), /in-session goes to an implementer on model `opus` like any other/);
});

test('the brain agent file names the commit file it may write and refuses to run commit.js itself', () => {
  const file = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-brain.md'), 'utf8');
  const section = (name) => file.split(/^## /m).find((s) => s.startsWith(name));
  assert.match(section('Tools'), /on a build stage, the commit\s+file it names/);
  assert.match(section('Refusals'), /on a build\s+stage the commit file/);
  assert.match(section('Refusals'), /Do not run `scripts\/commit\.js`/);
  assert.match(section('Return'), /`commit <path>` for the tasks that returned since the last commit/);
});

test('a controlled build\'s brain brief stays under the 10,000-character cap on one additionalContext', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.ok(text.length < 10000, 'brain brief is ' + text.length + ' chars');
});

test('the brain\'s own ## Tools names every plugin agent its stage table lets it dispatch', () => {
  const { agentsFor } = require('../lib/stages.js');
  const agentFile = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-brain.md'), 'utf8');
  const tools = agentFile.split(/^## /m).find((s) => s.startsWith('Tools'));
  for (const stage of ['survey', 'build', 'verify', 'audit', 'land']) {
    for (const agent of agentsFor(stage).filter((a) => a.startsWith('fankeel:'))) {
      assert.ok(tools.includes(agent), '## Tools must name ' + agent + ', which the ' + stage + ' brief lists');
    }
    if (agentsFor(stage).some((a) => !a.startsWith('fankeel:'))) assert.match(tools, /implementer/, '## Tools must permit an implementer, which the ' + stage + ' brief lists');
  }
});

test('a brain is told what to read first: the last stage\'s report and the lines it left under reads:', () => {
  const { handoffPath } = require('../lib/handoff.js');
  const started = '2026-09-19T09:30:12.345Z';
  const moves = [['build', 1], ['verify', 2], ['build', 3]];
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started, moves });
  const verifyFile = handoffPath(root, { started, moves: moves.slice(0, 2) }, 'verify');
  fs.mkdirSync(path.dirname(verifyFile), { recursive: true });
  fs.writeFileSync(verifyFile, 'report\n\nreads:\n- lib/a.js — the row that failed\n- docs/b.md — the contract it broke\n\n');
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.match(text, /read first: \S+\/\.fankeel\/build\/task-20260919T093012\/verify\.md/);
  assert.ok(text.includes('lib/a.js — the row that failed'));
  assert.ok(text.includes('docs/b.md — the contract it broke'));
  assert.ok(text.includes('The next brief copies them for it'), 'the brain is told to write the block');
  assert.ok(text.length < 10000, 'brain brief is ' + text.length + ' chars');
});

test('read first says none when no earlier stage left a report, and says how many lines it left out', () => {
  const { handoffPath } = require('../lib/handoff.js');
  const started = '2026-09-19T09:30:12.345Z';
  const brief = (reads) => {
    const moves = [['verify', 1], ['build', 2]];
    const root = tmp();
    seedProfile(root, { 'stage.agents': ['build'] });
    seed(root, { stage: 'build', started, moves });
    if (reads) {
      const file = handoffPath(root, { started, moves: moves.slice(0, 1) }, 'verify');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'reads:\n' + reads.map((r) => '- ' + r).join('\n') + '\n\n');
    }
    return contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  };
  assert.match(brief(null), /read first: none — the map \(\.fankeel\/map\.md\) and the task line/);
  const many = brief(Array.from({ length: 30 }, (_, i) => 'f' + i + '.js — why'));
  assert.ok(many.includes('f11.js — why') && !many.includes('f12.js — why'), 'twelve lines are shown');
  assert.ok(many.includes('18 more not listed'));
  const long = brief(['x'.repeat(600) + ' — a', 'y'.repeat(600) + ' — b']);
  assert.ok(long.includes('x'.repeat(600)) && !long.includes('y'.repeat(600)), 'the character budget stops the second');
  assert.ok(long.includes('1 more not listed'));
});

test('with no earlier report, a brain is pointed at the plan this task wrote after it started', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const plans = path.join(root, 'docs', 'plans');
  fs.mkdirSync(plans, { recursive: true });
  const old = path.join(plans, '2026-09-01-old.md');
  fs.writeFileSync(old, '# old\n');
  fs.utimesSync(old, new Date('2026-09-01T00:00:00Z'), new Date('2026-09-01T00:00:00Z'));
  fs.writeFileSync(path.join(plans, '2026-09-19-x-design.md'), '# design\n');
  fs.writeFileSync(path.join(plans, '2026-09-19-x.md'), '# plan\n');
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.match(text, /read first: \S*2026-09-19-x\.md — the plan/);
  assert.doesNotMatch(text, /2026-09-01-old/);
});

test('a verify brain is given the subagents directory; other stages are not', () => {
  const brief = (stage) => {
    const root = tmp();
    seedProfile(root, { 'stage.agents': [stage] });
    seed(root, { stage, started: '2026-09-19T09:30:12.345Z' });
    return contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain', transcript_path: path.join(root, 'sess.jsonl') })));
  };
  assert.match(brief('verify'), /subagents: \S*sess[\\/]subagents/);
  assert.doesNotMatch(brief('build'), /subagents: /);
});

test('a brain is told the gate shape and that option one names the next stage', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['survey'] });
  seed(root, { stage: 'survey', started: '2026-09-19T09:30:12.345Z' });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.match(text, /carries `header` \(12 columns at most/);
  assert.match(text, /option one's label names `design`/);
  // readGate refuses a gate with no pause option and a non-empty `next` is
  // required (lib/handoff.js ruleProblem); on 09-30 two verify gates were
  // refused for the pause because the brief never said so.
  assert.match(text, /one option's label says `暫停`/);
  assert.match(text, /`next` is never empty/);
});

// The test above only proves the cap lies somewhere between a line that fits
// (604 chars) and two lines whose sum does not (1208) — a gap of hundreds of
// characters. A single line of exactly the cap, and one of cap+1, pin the
// constant itself: the first must always be kept whole (nothing "over" a cap
// it does not exceed), the second must always be replaced by the count.
test('read first\'s character cap is exactly 1000: one line of 1000 characters prints in full, one of 1001 does not', () => {
  const { handoffPath } = require('../lib/handoff.js');
  const started = '2026-09-19T09:30:12.345Z';
  const brief = (reads) => {
    const moves = [['verify', 1], ['build', 2]];
    const root = tmp();
    seedProfile(root, { 'stage.agents': ['build'] });
    seed(root, { stage: 'build', started, moves });
    const file = handoffPath(root, { started, moves: moves.slice(0, 1) }, 'verify');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'reads:\n' + reads.map((r) => '- ' + r).join('\n') + '\n\n');
    return contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  };
  const atCap = brief(['x'.repeat(1000)]);
  assert.ok(atCap.includes('x'.repeat(1000)), 'a single line of exactly 1000 characters must print in full');
  assert.ok(!atCap.includes('more not listed'), 'nothing is left out when the one line fits the cap exactly');
  const overCap = brief(['x'.repeat(1001)]);
  assert.ok(!overCap.includes('x'.repeat(1001)), 'a single line of 1001 characters must not print in full');
  assert.ok(overCap.includes('1 more not listed'), 'the one line over the cap is counted as left out');
});

// Split into three tests, one per brief, rather than one test asserting all of
// them in sequence. In the single-test version, `assert.doesNotMatch(plan, ...)`
// sat after an `assert.match` on the same rendered text, and once any earlier
// assertion in the function threw — a node:test function stops at its first
// throw — nothing after it, including that doesNotMatch, ever ran. Splitting
// means a mutation that only breaks plan's rendering cannot stop design's
// assertions from running, and vice versa; each test's own doesNotMatch is
// also placed before its confirmatory match, so a mutation that corrupts that
// brief's own sentence cannot hide a doesNotMatch that would otherwise redden.
test('a design brain may write one file under docs/plans/ and commit it through a commit file', () => {
  const design = briefFor('design');
  assert.doesNotMatch(design, /Its path is the first line of your report\./, 'design must not carry the plan\'s artifact sentence');
  assert.match(design, /artifact: besides your report you may Write one file, docs\/plans\/<date>-<topic>-design\.md, and only where the design skill calls for a spec/);
  assert.match(design, /\(the architectural class\)\. Put its path on the report's `spec:` line\./);
  assert.match(design, /You cannot commit: `git commit` and `git add` are refused to you\. When that file is written, write [^\n]*design-commit\.md/);
  assert.ok(design.length < 10000, 'design brief is ' + design.length + ' chars');
});

test('a plan brain may write one file under docs/plans/ and commit it through a commit file', () => {
  const plan = briefFor('plan');
  assert.doesNotMatch(plan, /Put its path on the report's/, 'plan must not carry the design\'s artifact sentence');
  assert.match(plan, /artifact: besides your report you may Write one file, docs\/plans\/<date>-<topic>\.md\. Its path is the first line of your report\./);
  assert.match(plan, /write [^\n]*plan-commit\.md/);
  assert.ok(plan.length < 10000, 'plan brief is ' + plan.length + ' chars');
});

test('no stage besides design and plan may write an artifact', () => {
  for (const stage of ['survey', 'build', 'verify']) assert.doesNotMatch(briefFor(stage), /artifact: besides your report/, stage);
});

test('an audit brain sends page corrections to the fixer, a land brain sends moves and git to an implementer', () => {
  assert.match(briefFor('audit'), /You cannot edit a page or run a git write\. Send one change at a time to `fankeel:fankeel-fixer` \(a page correction\) or an implementer on model `sonnet` \(a move, a merge, a cleanup\), and read what it returns before you send the next\./);
  const land = briefFor('land', { 'dispatch.floor': 'opus' });
  assert.match(land, /You cannot edit a page or run a git write\. Send one change at a time to an implementer on model `opus` \(a move, a merge, a cleanup\)/);
  assert.doesNotMatch(land, /fankeel-fixer` \(a page correction\)/);
  assert.ok(land.length < 10000, 'land brief is ' + land.length + ' chars');
  for (const stage of ['survey', 'build']) assert.doesNotMatch(briefFor(stage), /You cannot edit a page or run a git write/, stage);
});

test('a stage agent starting marks its stage in flight on the parent\'s record; any other agent marks nothing', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const read = () => JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), 'utf8'));
  run(root, start(root, { agent_type: 'fankeel:fankeel-reader', agent_id: 'a0b1' }));
  assert.equal(read().inflight, undefined);
  const before = Date.now();
  run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'a3f9c2' }));
  const mark = read().inflight;
  assert.deepEqual([mark.stage, mark.agentId], ['build', 'a3f9c2']);
  assert.ok(mark.at >= before && mark.at <= Date.now(), String(mark.at));
});

// .fankeel/build/task-20260928T011854/verify.md item 2: a brain dispatching a
// nested brain of its own (build's fixer-round resume) fired this same
// SubagentStart for the inner one, and the old code marked inflight on every
// `fankeel-brain` regardless of depth — a spurious extra `group` mark. The
// inner one's own `agent-<id>.meta.json` says `spawnDepth: 2`, the shape
// lib/usage.js already reads for this.
test('a nested brain (spawnDepth 2) does not mark inflight', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const sub = path.join(root, 'sess', 'subagents');
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, 'agent-a9.meta.json'), JSON.stringify({
    agentType: 'fankeel:fankeel-brain', parentAgentId: 'a1', spawnDepth: 2,
  }));
  run(root, start(root, {
    agent_type: 'fankeel:fankeel-brain', agent_id: 'a9',
    transcript_path: path.join(root, 'sess.jsonl'),
  }));
  const data = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), 'utf8'));
  assert.equal(data.inflight, undefined, 'a nested brain must not add an inflight mark');
});

// docs/90-agent/reports/2026-09-28-spawndepth-timing.md, measured twice: the
// meta file is not there while SubagentStart runs, even to a hook that waits
// 500 ms. So a brain with a transcript path but no meta file yet is read as
// depth 1 and marks inflight — the fallback nestedBrain()'s comment names.
test('a brain whose meta file is not there when the hook runs is read as depth 1 and marks inflight', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  fs.mkdirSync(path.join(root, 'sess', 'subagents'), { recursive: true });
  run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'a7', transcript_path: path.join(root, 'sess.jsonl') }));
  const data = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), 'utf8'));
  assert.equal(data.inflight.agentId, 'a7');
});

// 2026-09-24: a controlled build of 14 tasks sent its controller 19 commits,
// one round trip each; then one per `ledger.js groups` group, which waited on
// the slowest task of each group. Now: whenever nothing it sent is running.
test('a build brain asks for a commit only when none of its implementers is running, never per task', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const build = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.match(build, /Ask for a commit only when none of your implementers is still running, never per task: then write /);
  assert.match(build, /one block per task that returned since the last commit, the paths it owns one per line, a blank line, then its commit message, and a line `---` between blocks/);
  assert.doesNotMatch(build, /once per group `ledger\.js groups`/);
  assert.doesNotMatch(build, /may share one file/);
  const file = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-brain.md'), 'utf8');
  assert.match(file, /on build each time none of the implementers you sent is\s+still running, one block per task that returned since the last one, never per\s+task/);
  assert.match(file, /`ledger\.js ready`/);
  assert.doesNotMatch(file, /once per `ledger\.js groups` group/);
  assert.doesNotMatch(file, /first for each task or file/);
});

// docs/90-agent/plans/2026-09-28-spawndepth-worktree-design.md §2: a build
// brain sends every implementer into its own worktree, names that worktree at
// the head of the task's block, and re-dispatches a conflict once on its own.
test('a build brain sends implementers into worktrees, names the worktree in the commit file, and re-dispatches a conflict once', () => {
  const build = briefFor('build');
  assert.match(build, /Send every implementer with `isolation: "worktree"`/);
  assert.match(build, /the first line of its task's block is `worktree <path>`/);
  assert.match(build, /`conflict <paths>`[^\n]*dispatch it once more, fresh, on the new HEAD, without asking\. The same task conflicting a second time: stop the build/);
  assert.match(build, /`ledger\.js --plan <f> ready --worktree`/);
  assert.match(build, /`kept <path> — <why>`/);
  assert.match(build, /an implementer \(`general-purpose`, on the model named in the task Dispatch line, with `isolation: "worktree"`\)/);
  assert.match(build, /run `git rev-parse HEAD` yourself and tell every worktree-isolated implementer, before its first edit, to run `git reset --hard <that sha>` in its own worktree.*origin\/main/);
  assert.doesNotMatch(briefFor('verify'), /isolation: "worktree"/);
  const file = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-brain.md'), 'utf8');
  assert.match(file, /`ledger\.js --plan <f> ready --worktree`/);
  assert.match(file, /`isolation: "worktree"`/);
  assert.match(file, /Do not run `git worktree`/);
  assert.match(file, /run\s+`git rev-parse HEAD` yourself and tell every worktree-isolated implementer,\s+before its first edit, to run `git reset --hard <that sha>` in its own\s+worktree.*origin\/main/s);
});

test('a build brain is told a user task is not its to send', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const build = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.match(build, /One whose Dispatch line says user is not yours to send: `ledger\.js ready` never lists it, the controller runs it with the user after your report, and your report names it on a line `hands: <n>, <n>`\./);
});

// docs/plans/2026-09-26-three-ready.md Task 1, the artefact row: the path the
// design block names is the file the build brain is told to read first.
test('the file a design block names for a controlled build is what the build brain reads first', () => {
  const { render } = require('../lib/render.js');
  const started = '2026-09-19T09:30:12.345Z';
  const route = ['survey', 'design', 'build', 'verify', 'land'];
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  const design = { task: 'rework the colour ramp', claims: [], stage: 'design', route, active: true, started, moves: [['survey', 1], ['design', 2]] };
  const block = render({ mine: { sessionId: SESSION, data: design }, others: [], now: Date.parse(started) + 60e3, root, profile: { values: { 'stage.agents': ['build'] }, sources: {}, unreadable: [] } });
  const m = /Write the approved output shape to `([^`]+)`/.exec(block);
  assert.ok(m, 'the design block names no file');
  const file = path.join(root, m[1]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'the approach, one sentence\n');
  seed(root, { stage: 'build', started, route, moves: [['survey', 1], ['design', 2], ['build', 3]] });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.match(text, /read first: \S+\/\.fankeel\/build\/task-20260919T093012\/design\.md — the last stage's report/);
});

// docs/90-agent/plans/2026-09-28-agent-lifetime.md Task 6 / lib/render.js's
// pushContext: the brief inlines context.md's content directly, so a
// subagent never has to Read the file itself.
test('the brief inlines the task\'s context.md content, not just its path', () => {
  const root = tmp();
  seed(root, { started: '2026-09-19T09:30:12.345Z' });
  const file = path.join(root, '.fankeel', 'build', 'task-20260919T093012', 'context.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '- a secret fact — lib/a.js:1 @ abc1234\n');
  const text = contextOf(run(root, start(root)));
  assert.match(text, /scripts\/context\.js add/);
  assert.ok(text.includes('a secret fact'), 'the brief did not inline the file');
});

// docs gate answers: an earlier stage's gate answer reaches the later briefs
// as one "already answered" line per question.
const TASK_DIR = (root) => path.join(root, '.fankeel', 'build', 'task-20260919T093012');
function answerFile(root, stage, answers) {
  const file = path.join(TASK_DIR(root), stage + '-answer.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ questions: [], answers }, null, 2));
  return file;
}
const ROUTE = ['survey', 'design', 'build'];
const ALREADY = /^  - already answered \(/;
const answeredLines = (text) => text.split('\n').filter((l) => ALREADY.test(l));

test('an ordinary brief carries one already-answered line per earlier gate question', () => {
  const root = tmp();
  seed(root, { started: '2026-09-19T09:30:12.345Z', route: ROUTE, stage: 'build' });
  answerFile(root, 'survey', { 'Which palette base should the ramp use?': 'OKLCH' });
  const text = contextOf(run(root, start(root)));
  assert.ok(text.includes('already answered (survey): Which palette base should the ramp use? -> OKLCH. Do not re-ask.'), text);
});

test('a brain brief carries the same already-answered line', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { started: '2026-09-19T09:30:12.345Z', route: ROUTE, stage: 'build' });
  answerFile(root, 'design', { 'Ship the mockup as drawn?': 'Yes' });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.ok(text.includes('already answered (design): Ship the mockup as drawn? -> Yes. Do not re-ask.'), text);
});

test('the already-answered lines are capped at ANSWERED_MAX, keeping the latest', () => {
  const root = tmp();
  seed(root, { started: '2026-09-19T09:30:12.345Z', route: ROUTE, stage: 'build' });
  const answers = {};
  for (let i = 1; i <= 9; i++) answers['question number ' + i + '?'] = 'answer ' + i;
  answerFile(root, 'survey', answers);
  const lines = answeredLines(contextOf(run(root, start(root))));
  assert.equal(lines.length, ANSWERED_MAX);
  assert.ok(lines[lines.length - 1].includes('question number 9?'));
  assert.ok(!lines.some((l) => l.includes('question number 1?')));
});

test('an answer older than its stage report is not carried: the gate was rewritten', () => {
  const root = tmp();
  seed(root, { started: '2026-09-19T09:30:12.345Z', route: ROUTE, stage: 'build' });
  const file = answerFile(root, 'survey', { 'Which palette base should the ramp use?': 'OKLCH' });
  const report = path.join(TASK_DIR(root), 'survey.md');
  fs.writeFileSync(report, '# report, rewritten\n');
  const later = new Date(Date.now() + 10000);
  fs.utimesSync(report, later, later);
  assert.equal(fs.statSync(report).mtimeMs > fs.statSync(file).mtimeMs, true);
  assert.equal(answeredLines(contextOf(run(root, start(root)))).length, 0);
});

test('the stage being briefed contributes no already-answered line of its own lap', () => {
  const root = tmp();
  seed(root, { started: '2026-09-19T09:30:12.345Z', route: ROUTE, stage: 'build' });
  answerFile(root, 'build', { 'Merge the branch now?': 'Yes' });
  assert.equal(answeredLines(contextOf(run(root, start(root)))).length, 0);
});
