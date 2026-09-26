'use strict';

// PreToolUse on AskUserQuestion, and the PostToolUse hook that closes what it
// opened. Run as processes, because a hook that works when required and wedges
// when spawned is a hook that works nowhere.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');

const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(ROOT, 'hooks', 'gate.js');
const RESUME = path.join(ROOT, 'hooks', 'resume.js');

const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';

const ago = (ms) => new Date(Date.now() - ms).toISOString();

function seed(root, sessionId, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({
    task: 'rework the colour ramp',
    stage: 'design',
    active: true,
    started: ago(2 * 3600e3),
    updated: ago(3600e3),
  }, over);
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

function readEntry(root, sessionId) {
  const file = path.join(root, '.fankeel', 'sessions', sessionId + '.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function run(hook, root, payload) {
  return execFileSync(process.execPath, [hook], {
    input: JSON.stringify(Object.assign({
      session_id: MINE,
      cwd: root,
      tool_name: 'AskUserQuestion',
    }, payload)),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
  });
}

test('the gate hook stamps gateAt on a session in the mode', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE);
  run(GATE, root, {});
  assert.equal(Number.isFinite(readEntry(root, MINE).gateAt), true);
});

// A PreToolUse hook that answers on a tool it has no opinion about overrides the
// user's own permission rules. This one has an opinion about none of them.
test('the gate hook writes nothing to stdout', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE);
  assert.equal(run(GATE, root, {}).trim(), '');
});

test('a session not in the mode is left alone', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { active: false });
  run(GATE, root, {});
  assert.equal(readEntry(root, MINE).gateAt, undefined);
});

test('no entry at all is not an error', () => {
  const root = tmp('fankeel-gate-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  assert.equal(run(GATE, root, {}).trim(), '');
});

test('malformed stdin is not an error', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE);
  const out = execFileSync(process.execPath, [GATE], {
    input: 'not json',
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
  });
  assert.equal(out.trim(), '');
});

const context = (out) => JSON.parse(out).hookSpecificOutput.additionalContext;

// The pair, in the order Claude Code runs it.
test('the gate opened then answered accumulates into the stage', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'design' });
  run(GATE, root, {});
  const out = run(RESUME, root, {});
  const after = readEntry(root, MINE);
  assert.equal(after.gateAt, undefined);
  assert.equal(Number.isFinite(after.waited.design), true);
  assert.doesNotMatch(context(out), /^gate: /m);
});

// The second half on its own is what a process registered before `gate.js`
// existed looks like: Claude Code reads its hook list at process start, so a
// session opened later in that process — `/clear` included — runs `resume.js`
// and never `gate.js`. `waited` then stays empty for as long as the process
// lives, and `resume.js` is the only place that can see it. It says so in the
// one block it already sends.
test('an answer with no stamp says the gate hook did not run', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'design' });
  const out = run(RESUME, root, {});
  assert.match(context(out), /^gate: .*hooks\/gate\.js did not run/m);
  assert.equal(readEntry(root, MINE).waited, undefined);
});

function handoff(root, gate) {
  const file = path.join(root, '.fankeel', 'build', 'task-20260919T093012', 'survey.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const TICKS = '`'.repeat(3);
  fs.writeFileSync(file, '# report\n\n' + TICKS + 'json gate\n' + JSON.stringify(gate) + '\n' + TICKS + '\n');
}
const QUESTIONS = [{ question: 'survey 的結論可以進 design 嗎？', header: 'survey', multiSelect: false, options: [{ label: '進 design', description: 'a' }, { label: '暫停', description: 'b' }] }];
// What the controller now sends when it does its job correctly: an exact
// copy of the handoff file's own `json gate` block, never a placeholder.
const askOf = (questions) => ({ questions: JSON.parse(JSON.stringify(questions)) });
const agentsOn = (root) => fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'true' }));

test('stage.agents at survey: a verbatim copy of the handoff gate produces no updatedInput, and stamps gateAt', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  agentsOn(root);
  handoff(root, { questions: QUESTIONS, next: 'n' });
  const out = run(GATE, root, { tool_input: askOf(QUESTIONS) }).trim();
  assert.equal(out, '', 'the input was already correct: nothing to substitute');
  assert.equal(Number.isFinite(readEntry(root, MINE).gateAt), true);
});

test('stage.agents: a gate AskUserQuestion would reject is denied, naming the field', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-gate-cfg-') });
  agentsOn(root);
  const questions = JSON.parse(JSON.stringify(QUESTIONS));
  delete questions[0].header;
  handoff(root, { questions, next: 'n' });
  const out = JSON.parse(run(GATE, root, { tool_input: askOf(questions) }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /questions\[0\]\.header/);
  assert.equal(out.hookSpecificOutput.updatedInput, undefined);
});

test('stage.agents: an over-wide header is denied with its width and the cap, not "missing or wrong"', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-gate-cfg-') });
  agentsOn(root);
  const questions = JSON.parse(JSON.stringify(QUESTIONS));
  questions[0].header = '15 條一起 design';
  handoff(root, { questions, next: 'n' });
  const reason = JSON.parse(run(GATE, root, { tool_input: askOf(questions) })).hookSpecificOutput.permissionDecisionReason;
  assert.match(reason, /is 16 columns, 12 is the cap/);
  assert.doesNotMatch(reason, /missing or wrong/);
});

test('stage.agents off: the question goes out as sent, even with a gate on disk', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  handoff(root, { questions: QUESTIONS, next: 'n' });
  assert.equal(run(GATE, root, { tool_input: askOf(QUESTIONS) }).trim(), '');
});

test('stage.agents at survey: the answer is written beside the handoff', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', gateAt: Date.now(), configDir: tmp('fankeel-cfg-') });
  agentsOn(root);
  run(RESUME, root, { tool_response: { answers: { 'q?': '暫停' } } });
  const file = path.join(root, '.fankeel', 'build', 'task-20260919T093012', 'survey-answer.md');
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { answers: { 'q?': '暫停' } });
});

test('stage.agents at survey: a matching gate clears the in-flight mark; with no gate on disk the mark stays', () => {
  const mark = { stage: 'survey', at: 1758000000000, agentId: 'a3f9c2' };
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-'), inflight: mark });
  agentsOn(root);
  run(GATE, root, { tool_input: askOf(QUESTIONS) });
  assert.deepEqual(readEntry(root, MINE).inflight, mark, 'no handoff yet: still in flight');
  handoff(root, { questions: QUESTIONS, next: 'n' });
  run(GATE, root, { tool_input: askOf(QUESTIONS) });
  assert.equal(readEntry(root, MINE).inflight, undefined);
});

// 2026-09-23: a question the controller asked on its own while its stage
// agent was still working was written to `<stage>-answer.md`, where the agent
// reads a gate answer. gate.js clears `inflight` only when the question
// reaching the user matches the file's gate, so a mark still standing when
// the answer arrives is the controller's.
test('stage.agents: an answer while the stage agent is still in flight is not written as the gate answer', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', gateAt: Date.now(), configDir: tmp('fankeel-cfg-'), inflight: { stage: 'survey', at: 1758000000000, agentId: 'a3f9c2' } });
  agentsOn(root);
  run(RESUME, root, { tool_response: { answers: { 'q?': 'yes' } } });
  assert.equal(fs.existsSync(path.join(root, '.fankeel', 'build', 'task-20260919T093012', 'survey-answer.md')), false);
});

test('stage.agents: the pair in order, a matching gate clears the mark and its answer is written', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-'), inflight: { stage: 'survey', at: 1758000000000, agentId: 'a3f9c2' } });
  agentsOn(root);
  handoff(root, { questions: QUESTIONS, next: 'n' });
  run(GATE, root, { tool_input: askOf(QUESTIONS) });
  run(RESUME, root, { tool_response: { answers: { 'q?': '進 design' } } });
  assert.ok(fs.existsSync(path.join(root, '.fankeel', 'build', 'task-20260919T093012', 'survey-answer.md')));
});

test('stage.agents at survey with no handoff yet: the gate hook says why it confirmed nothing', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  agentsOn(root);
  const out = JSON.parse(run(GATE, root, { tool_input: askOf(QUESTIONS) }));
  assert.match(out.systemMessage, /^fankeel: gate not confirmed — .*survey\.md does not exist yet/);
  assert.equal(out.hookSpecificOutput, undefined);
});

test('a brain dispatched for a stage stage.agents does not name: the gate hook says so by name', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'design', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-'), inflight: { stage: 'design', at: 1758000000000, agentId: 'b1' } });
  fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'survey,build,verify' }));
  const out = JSON.parse(run(GATE, root, { tool_input: askOf(QUESTIONS) }));
  assert.match(out.systemMessage, /dispatched for `design`, but stage\.agents \(survey,build,verify\) does not name `design`/);
});

function verifyGate(root, label) {
  const file = path.join(root, '.fankeel', 'build', 'task-20260919T093012', 'verify.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const questions = [{ question: 'verify 抓到兩條，怎麼辦？', header: 'verify', multiSelect: false, options: [{ label, description: 'a' }, { label: '暫停', description: 'b' }] }];
  fs.writeFileSync(file, '# report\n\n' + '`'.repeat(3) + 'json gate\n' + JSON.stringify({ questions, next: 'n' }) + '\n' + '`'.repeat(3) + '\n');
  return questions;
}

test('verify sending the work back to build on its own route is asked, not denied', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'verify', route: ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'], started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'all' }));
  const questions = verifyGate(root, '退回 build');
  const out = run(GATE, root, { tool_input: askOf(questions) }).trim();
  assert.equal(out, '', 'a verbatim copy of a route-back gate is asked, not substituted or denied');
});

test('a stage the route does not have is still denied', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'verify', route: ['build', 'verify', 'audit'], started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'all' }));
  const questions = verifyGate(root, '退回 design');
  const out = JSON.parse(run(GATE, root, { tool_input: askOf(questions) }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
});

// 2026-09-24, verify: the controller asked its own question mid-stage and the
// user was shown the stage's old gate instead. Now nothing is substituted, so
// the risk is inverted: a question the controller wrote for itself, headed
// with something other than the stage's name, must be left alone rather than
// mistaken for a botched gate copy.
test('stage.agents at survey: a question headed with something other than the stage goes out as written, and says why', () => {
  const root = tmp('fankeel-gate-');
  const mark = { stage: 'survey', at: 1758000000000, agentId: 'a3f9c2' };
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-'), inflight: mark });
  agentsOn(root);
  handoff(root, { questions: QUESTIONS, next: 'n' });
  const own = { questions: [{ header: '開新任務', question: '要不要先開一個新任務？', options: [{ label: '要', description: 'a' }, { label: '不要', description: 'b' }] }] };
  const out = JSON.parse(run(GATE, root, { tool_input: own }));
  assert.equal(out.hookSpecificOutput, undefined);
  assert.match(out.systemMessage, /^fankeel: gate not confirmed — .*does not copy the handoff's gate word for word/);
  assert.deepEqual(readEntry(root, MINE).inflight, mark, 'a question the controller asked itself does not clear the mark');
});

// The deny-on-mismatch path: the first question is headed with the stage's
// name — this looks like an attempt to copy the gate — but the content is
// not a word-for-word match (a paraphrase here). Denied, naming the file and
// telling the controller to copy the file's `questions` array exactly.
test('a question headed with the stage that does not match the file word for word is denied', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  agentsOn(root);
  handoff(root, { questions: QUESTIONS, next: 'n' });
  const paraphrased = JSON.parse(JSON.stringify(QUESTIONS));
  paraphrased[0].question = '要不要繼續往 design 走？'; // same header, reworded question
  const out = JSON.parse(run(GATE, root, { tool_input: { questions: paraphrased } }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /survey\.md/);
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /word for word/);
});

test('two questions headed with the stage do not match a one-question gate, and are denied', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  agentsOn(root);
  handoff(root, { questions: QUESTIONS, next: 'n' });
  const one = QUESTIONS[0];
  const out = JSON.parse(run(GATE, root, { tool_input: { questions: [one, one] } }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /word for word/);
});

test('the header match deciding whether a mismatch is an attempted gate copy is case-insensitive', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  agentsOn(root);
  handoff(root, { questions: QUESTIONS, next: 'n' });
  const upper = JSON.parse(JSON.stringify(QUESTIONS));
  upper[0].header = 'SURVEY';
  const out = JSON.parse(run(GATE, root, { tool_input: { questions: upper } }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny', 'SURVEY still reads as an attempt at the survey gate');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /word for word/);
});

// Header equality alone used to deny this: every question asked during a
// controlled stage carries the stage's own header by convention, gate or
// not, so a genuinely different question — different `question` text,
// different option labels, low overlap with the seeded gate — headed with
// the stage's name must still go out untouched. .fankeel/build/task-
// 20260923T194111/verify-3.md, "New finding, still open".
test('stage.agents at survey: a genuinely different question headed with the stage still goes out as written', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  agentsOn(root);
  handoff(root, { questions: QUESTIONS, next: 'n' });
  const different = { questions: [{ header: 'survey', question: '要不要先開一個新任務？', options: [{ label: '要', description: 'a' }, { label: '不要', description: 'b' }] }] };
  const out = JSON.parse(run(GATE, root, { tool_input: different }));
  assert.equal(out.hookSpecificOutput, undefined, 'a low-overlap question sharing only the header is not an attempted copy');
});

// gate.station: the hook holds the question while the station can answer it.
function runAsync(hook, root, payload) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [hook], { env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }) });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('close', () => resolve(out));
    child.stdin.end(JSON.stringify(Object.assign({ session_id: MINE, cwd: root, tool_name: 'AskUserQuestion' }, payload)));
  });
}
const stationOn = (root, secs) => fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'gate.station': secs }));
const taskDir = (root) => path.join(root, '.fankeel', 'build', 'task-20260919T093012');

test('gate.station: an answer the station writes while the hook waits goes out as the answer', async () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'design', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  stationOn(root, 5);
  const pending = path.join(taskDir(root), 'design-pending.json');
  const answer = path.join(taskDir(root), 'design-answer.md');
  const asked = askOf(QUESTIONS);
  const done = runAsync(GATE, root, { tool_input: asked });
  let seen = null;
  for (let i = 0; i < 50 && !seen; i++) {
    await new Promise((r) => setTimeout(r, 100));
    if (fs.existsSync(pending)) seen = JSON.parse(fs.readFileSync(pending, 'utf8'));
  }
  assert.ok(seen, 'the hook never wrote the pending file');
  assert.deepEqual(seen.questions, asked.questions);
  fs.writeFileSync(answer, JSON.stringify({ answers: { [QUESTIONS[0].question]: '暫停' } }));
  const out = JSON.parse(await done);
  assert.equal(out.hookSpecificOutput.permissionDecision, 'allow');
  assert.deepEqual(out.hookSpecificOutput.updatedInput.answers, { [QUESTIONS[0].question]: '暫停' });
  assert.deepEqual(out.hookSpecificOutput.updatedInput.questions, asked.questions);
  assert.equal(fs.existsSync(pending), false, 'the pending file outlived the wait');
});

test('gate.station: no answer in time leaves the question to the terminal, and an older answer file is not this gate\'s', async () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'design', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  stationOn(root, 1);
  const answer = path.join(taskDir(root), 'design-answer.md');
  fs.mkdirSync(taskDir(root), { recursive: true });
  fs.writeFileSync(answer, JSON.stringify({ answers: { [QUESTIONS[0].question]: '進 design' } }));
  const past = new Date(Date.now() - 60e3);
  fs.utimesSync(answer, past, past);
  const started = Date.now();
  const out = await runAsync(GATE, root, { tool_input: askOf(QUESTIONS) });
  assert.equal(out.trim(), '', 'an answer written before the wait was taken for this gate');
  assert.ok(Date.now() - started >= 900, 'the hook did not wait');
  assert.equal(fs.existsSync(path.join(taskDir(root), 'design-pending.json')), false);
});

test('gate.station off: the hook neither waits nor writes a pending file', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'design', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  stationOn(root, 'off');
  const started = Date.now();
  assert.equal(run(GATE, root, { tool_input: askOf(QUESTIONS) }).trim(), '');
  assert.ok(Date.now() - started < 3000);
  assert.equal(fs.existsSync(path.join(taskDir(root), 'design-pending.json')), false);
});

// 「交給終端／手機」 on the page: the hook stops waiting at once and the
// question goes to the terminal, where Remote Control already carries it.
test('gate.station: a hand-off the page writes ends the wait at once, and the question goes to the terminal', async () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'design', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  stationOn(root, 30);
  const pending = path.join(taskDir(root), 'design-pending.json');
  const answer = path.join(taskDir(root), 'design-answer.md');
  const started = Date.now();
  const done = runAsync(GATE, root, { tool_input: askOf(QUESTIONS) });
  for (let i = 0; i < 50 && !fs.existsSync(pending); i++) await new Promise((r) => setTimeout(r, 100));
  assert.ok(fs.existsSync(pending), 'the hook never wrote the pending file');
  fs.writeFileSync(answer, JSON.stringify({ handoff: 'terminal' }) + '\n');
  const out = await done;
  assert.equal(out.trim(), '', 'a hand-off is not an answer');
  assert.ok(Date.now() - started < 15000, 'the hook waited out its 30 s instead of stopping');
  assert.equal(fs.existsSync(pending), false, 'the pending file outlived the wait');
});
