'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { renderBrief, RETURN_RULES } = require('../lib/render.js');
const { byName: stageByName } = require('../lib/stages.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'brief.js');
const SESSION = 'aaaaaaaa-0000-4000-8000-000000000001';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-brief-'));

function seed(root, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, SESSION + '.json'), JSON.stringify(Object.assign({
    task: 'rework the colour ramp',
    scope: ['statusline.ps1', 'statusline.sh'],
    stage: 'build',
    active: true,
    started: new Date(Date.now() - 3600e3).toISOString(),
    updated: new Date().toISOString(),
  }, over), null, 2) + '\n');
}

function run(root, payload) {
  return execFileSync(process.execPath, [HOOK], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
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
    scope: ['statusline.ps1'],
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

test('a live task names itself and its scope to the subagent', () => {
  const root = tmp();
  seed(root);
  const text = contextOf(run(root, start(root)));
  assert.match(text, /^FANKEEL — you are a subagent of: rework the colour ramp @ build$/m);
  assert.match(text, /^scope: statusline\.ps1, statusline\.sh$/m);
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
// style being in force, and the skill is gone — a style is picked in /config and
// arrives in the system prompt, where nothing here has to restate it.
test('a style is never restated in the brief', () => {
  assert.equal(renderBrief({ mine: entry({ style: 'review' }) }).includes('voice ('), false);
});

test('an empty scope drops the scope line and the rule that depends on it', () => {
  const text = renderBrief({ mine: entry({ scope: [] }) });
  assert.equal(text.includes('scope:'), false);
  assert.equal(text.includes('outside that scope'), false);
  assert.equal(text.includes('undefined'), false);
});

test('a scope brings the rule that tells the subagent to report leaving it', () => {
  assert.match(renderBrief({ mine: entry() }), /outside that scope, name the file and say why/);
});

test('no entry renders nothing rather than a header with holes in it', () => {
  assert.equal(renderBrief({ mine: null }), null);
  assert.equal(renderBrief({}), null);
});
