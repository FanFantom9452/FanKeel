'use strict';

// A subagent starts with none of the parent's context, so the map is the one
// thing worth naming: reading a file costs a context that gets thrown away,
// where asking the parent costs one that does not.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { renderBrief, RETURN_RULES } = require('../lib/render.js');
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
  seedProfile(root, { 'stage.agents': true });
  seed(root, { stage: 'survey', started: '2026-09-19T09:30:12.345Z' });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  const expected = rulesFor('survey', Object.assign({ next: 'design', profileLand: landClause({}) }, SCRIPTS));
  for (const rule of expected) assert.ok(text.includes('  - ' + rule), 'missing rule: ' + rule.slice(0, 60));
  for (const line of templateFor('survey').split('\n').filter(Boolean)) assert.ok(text.includes('  ' + line), 'missing shape line: ' + line);
  assert.ok(text.includes(PLUGIN_ROOT + '/skills/fankeel-survey/SKILL.md'));
  assert.ok(text.includes('/.fankeel/build/task-20260919T093012/survey.md'));
  assert.ok(text.includes(SESSION));
  assert.ok(!text.includes(RETURN_RULES[2]), 'the no-dispatch rule is left out');
  // The controller prints the path and never the report, so a gate that says
  // "the answer is above" points at a line holding nothing but a path.
  assert.ok(text.includes('The user sees only the path to your report'), 'the gate must stand on its own');
  // Run one command per call, the stage agent took 34 and 48 tool calls over a
  // survey a main session did in 5 and 6, each call re-sending its context.
  assert.ok(text.includes('Run independent commands in one Bash call'), 'the brief must ask for batched commands');
  // Batched, it still opened each cited place with a Read of its own, 18 and 17 of them.
  assert.ok(text.includes('Read the lines you cite with `sed -n'), 'the brief must ask for cited lines read in Bash');
  // The shape's own word cap said nothing about the file, and the handoffs ran 6–9 KB.
  assert.ok(text.includes("The output rule's word count is this file's"), 'the brief must bind the word cap to the handoff');
  assert.ok(text.length < 10000, 'brain brief is ' + text.length + ' chars');
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

test('a build brain may dispatch a fixer and an implementer, a verify brain a verifier, a survey brain neither', () => {
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
  assert.match(dispatchLine('verify'), /fankeel:fankeel-verifier/);
  const survey = dispatchLine('survey');
  assert.match(survey, /fankeel:fankeel-reader/);
  assert.doesNotMatch(survey, /fankeel-fixer|fankeel-verifier|implementer/);
});

test('the brain\'s own ## Tools names every plugin agent its stage table lets it dispatch', () => {
  const { agentsFor } = require('../lib/stages.js');
  const agentFile = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-brain.md'), 'utf8');
  const tools = agentFile.split(/^## /m).find((s) => s.startsWith('Tools'));
  for (const stage of ['survey', 'build', 'verify']) {
    for (const agent of agentsFor(stage).filter((a) => a.startsWith('fankeel:'))) {
      assert.ok(tools.includes(agent), '## Tools must name ' + agent + ', which the ' + stage + ' brief lists');
    }
  }
});
