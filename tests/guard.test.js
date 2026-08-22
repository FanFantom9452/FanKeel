'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const guard = require('../lib/guard.js');
const HOOK = path.join(__dirname, '..', 'hooks', 'guard.js');

const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const THEIRS = 'bbbbbbbb-0000-4000-8000-000000000002';
const THIRD = 'cccccccc-0000-4000-8000-000000000003';

const ago = (ms) => new Date(Date.now() - ms).toISOString();
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-guard-'));

function seed(root, sessionId, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({
    task: 'rework the colour ramp',
    scope: ['statusline.ps1'],
    stage: 'build',
    active: true,
    started: ago(2 * 3600e3),
    updated: ago(60e3),
  }, over);
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

// The real hook, driven the way Claude Code drives it. CLAUDE_PROJECT_DIR is set
// explicitly rather than inherited: a stray one from the session running these
// tests would send the hook off to read a different repository's registry.
function run(root, payload) {
  const env = Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root });
  return execFileSync(process.execPath, [HOOK], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
    env,
  });
}

const edit = (root, file, tool) => ({
  session_id: MINE,
  cwd: root,
  tool_name: tool || 'Edit',
  tool_input: tool === 'NotebookEdit' ? { notebook_path: file } : { file_path: file },
});

const decisionOf = (out) => JSON.parse(out).hookSpecificOutput.permissionDecision;
const reasonOf = (out) => JSON.parse(out).hookSpecificOutput.permissionDecisionReason;

// ---- the hook, end to end ------------------------------------------------

test('a session with no entry is not guarded', () => {
  const root = tmp();
  assert.equal(run(root, edit(root, path.join(root, 'statusline.ps1'))), '');
});

test('an active session that did not ask for the guard is not guarded', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['README.md'] });
  seed(root, THEIRS, { task: 'retune the ramp', scope: ['statusline.ps1'] });
  assert.equal(run(root, edit(root, path.join(root, 'statusline.ps1'))), '');
});

test('a guarded session editing a file nobody else claimed is not stopped', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'ask', scope: ['README.md'] });
  seed(root, THEIRS, { task: 'retune the ramp', scope: ['statusline.ps1'] });
  assert.equal(run(root, edit(root, path.join(root, 'README.md'))), '');
});

test('another live session’s file is put in front of the user', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'ask', scope: ['README.md'] });
  seed(root, THEIRS, { task: 'retune the 5h ramp', stage: 'verify', scope: ['statusline.ps1'] });
  const out = run(root, edit(root, path.join(root, 'statusline.ps1')));
  assert.equal(decisionOf(out), 'ask');
  const reason = reasonOf(out);
  assert.match(reason, /statusline\.ps1 is inside the declared scope of another live session/);
  assert.match(reason, /retune the 5h ramp @ verify/);
});

test('guard: "deny" refuses outright', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', scope: ['README.md'] });
  seed(root, THEIRS, { scope: ['statusline.ps1'] });
  assert.equal(decisionOf(run(root, edit(root, path.join(root, 'statusline.ps1')))), 'deny');
});

test('a bare guard: true asks rather than denies', () => {
  const root = tmp();
  seed(root, MINE, { guard: true, scope: ['README.md'] });
  seed(root, THEIRS, { scope: ['statusline.ps1'] });
  assert.equal(decisionOf(run(root, edit(root, path.join(root, 'statusline.ps1')))), 'ask');
});

test('a stale claim warns but never blocks', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', scope: ['README.md'] });
  seed(root, THEIRS, { scope: ['statusline.ps1'], updated: ago(20 * 3600e3) });
  assert.equal(run(root, edit(root, path.join(root, 'statusline.ps1'))), '');
});

test('a stood-down claim does not block', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', scope: ['README.md'] });
  seed(root, THEIRS, { scope: ['statusline.ps1'], active: false });
  assert.equal(run(root, edit(root, path.join(root, 'statusline.ps1'))), '');
});

test('when both declared the file, the older claim holds and the newer yields', () => {
  const root = tmp();
  const file = path.join(root, 'statusline.ps1');

  const early = tmp();
  seed(early, MINE, { guard: 'deny', scope: ['statusline.ps1'], started: ago(5 * 3600e3) });
  seed(early, THEIRS, { scope: ['statusline.ps1'], started: ago(1 * 3600e3) });
  assert.equal(run(early, edit(early, path.join(early, 'statusline.ps1'))), '',
    'the older claim is mine, so nothing stops me');

  const late = tmp();
  seed(late, MINE, { guard: 'deny', scope: ['statusline.ps1'], started: ago(1 * 3600e3) });
  seed(late, THEIRS, { scope: ['statusline.ps1'], started: ago(5 * 3600e3) });
  assert.equal(decisionOf(run(late, edit(late, path.join(late, 'statusline.ps1')))), 'deny',
    'they claimed it first, so I yield');

  assert.ok(file);
});

test('a file outside the project root is none of its business', () => {
  const root = tmp();
  const elsewhere = tmp();
  seed(root, MINE, { guard: 'deny', scope: ['statusline.ps1'] });
  seed(root, THEIRS, { scope: ['statusline.ps1'], started: ago(9 * 3600e3) });
  assert.equal(run(root, edit(root, path.join(elsewhere, 'statusline.ps1'))), '');
});

test('a glob scope covers what is under it', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', scope: ['README.md'] });
  seed(root, THEIRS, { scope: ['src/**'] });
  assert.equal(decisionOf(run(root, edit(root, path.join(root, 'src', 'a.ts')))), 'deny');
});

test('a bare directory scope covers what is under it', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', scope: ['README.md'] });
  seed(root, THEIRS, { scope: ['src'] });
  assert.equal(decisionOf(run(root, edit(root, path.join(root, 'src', 'a.ts')))), 'deny');
});

test('NotebookEdit’s own path field is read', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', scope: ['README.md'] });
  seed(root, THEIRS, { scope: ['analysis.ipynb'] });
  const out = run(root, edit(root, path.join(root, 'analysis.ipynb'), 'NotebookEdit'));
  assert.equal(decisionOf(out), 'deny');
});

test('a tool call carrying no path says nothing', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', scope: ['statusline.ps1'] });
  seed(root, THEIRS, { scope: ['statusline.ps1'], started: ago(9 * 3600e3) });
  assert.equal(run(root, { session_id: MINE, cwd: root, tool_name: 'Bash', tool_input: { command: 'ls' } }), '');
});

test('a payload that is not JSON does not block the edit', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', scope: ['statusline.ps1'] });
  assert.equal(run(root, 'not json at all'), '');
});

test('two holders are both named', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'ask', scope: ['README.md'] });
  seed(root, THEIRS, { task: 'first task', scope: ['statusline.ps1'] });
  seed(root, THIRD, { task: 'second task', scope: ['statusline.*'] });
  const reason = reasonOf(run(root, edit(root, path.join(root, 'statusline.ps1'))));
  assert.match(reason, /2 other live sessions/);
  assert.match(reason, /first task/);
  assert.match(reason, /second task/);
});

test('the reason says how to get out of it', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', scope: ['README.md'] });
  seed(root, THEIRS, { scope: ['statusline.ps1'] });
  const reason = reasonOf(run(root, edit(root, path.join(root, 'statusline.ps1'))));
  assert.match(reason, /narrow its scope/);
  assert.match(reason, /task\.js clear/);
  assert.match(reason, /remove `guard`/);
});

// ---- the pieces ----------------------------------------------------------

test('guardMode reads only the three values it accepts', () => {
  assert.equal(guard.guardMode({ guard: true }), 'ask');
  assert.equal(guard.guardMode({ guard: 'ask' }), 'ask');
  assert.equal(guard.guardMode({ guard: 'deny' }), 'deny');
  assert.equal(guard.guardMode({ guard: 'yes' }), null);
  assert.equal(guard.guardMode({ guard: false }), null);
  assert.equal(guard.guardMode({}), null);
  assert.equal(guard.guardMode(null), null);
});

test('relPath normalises to forward slashes and refuses anything outside the root', () => {
  const root = path.join(os.tmpdir(), 'fankeel-rel');
  assert.equal(guard.relPath(root, path.join(root, 'src', 'a.ts')), 'src/a.ts');
  assert.equal(guard.relPath(root, path.join(root, '..', 'a.ts')), null);
  assert.equal(guard.relPath(root, root), null);
  assert.equal(guard.relPath(root, ''), null);
  assert.equal(guard.relPath('', 'a.ts'), null);
});

test('a claim with no readable start time cannot win the tie-break', () => {
  const when = ago(3600e3);
  assert.equal(guard.claimedFirst({}, { started: when }), false);
  assert.equal(guard.claimedFirst({ started: 'nonsense' }, { started: when }), false);
  assert.equal(guard.claimedFirst({ started: when }, {}), true);
  assert.equal(guard.claimedFirst({ started: when }, { started: when }), false, 'an exact tie blocks nobody');
});

test('targetOf reads file_path, falls back to notebook_path, and gives up on neither', () => {
  assert.equal(guard.targetOf({ tool_input: { file_path: 'a.ts' } }), 'a.ts');
  assert.equal(guard.targetOf({ tool_input: { notebook_path: 'a.ipynb' } }), 'a.ipynb');
  assert.equal(guard.targetOf({ tool_input: { command: 'ls' } }), null);
  assert.equal(guard.targetOf({ tool_input: {} }), null);
  assert.equal(guard.targetOf({}), null);
});

test('decide says nothing at all when the guard is off', () => {
  const root = path.join(os.tmpdir(), 'fankeel-decide');
  const mine = { scope: ['README.md'] };
  const others = [{ sessionId: THEIRS, data: { scope: ['a.ts'], updated: ago(60e3), started: ago(3600e3) } }];
  assert.equal(guard.decide({ mine, others, root, file: path.join(root, 'a.ts'), now: Date.now() }), null);
});

test('the refusal names the command that clears a claim nobody is behind', () => {
  const text = guard.reasonFor('web/a.js', [{ sessionId: THEIRS, data: { task: 't', stage: 'build' } }]);
  assert.match(text, /task\.js clear/);
});
