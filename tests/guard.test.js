'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn, spawnSync } = require('node:child_process');

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
    claims: ['statusline.ps1'],
    stage: 'build',
    active: true,
    started: ago(2 * 3600e3),
    updated: ago(60e3),
  }, over);
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

// The official Claude Code registry, which is the only thing liveness is
// measured from: one file per pid, carrying the session that pid is running.
// Written into a temp CLAUDE_CONFIG_DIR so nothing here depends on which
// sessions happen to be open on the machine running the tests.
function seedLive(pairs) {
  const cfg = tmp();
  const dir = path.join(cfg, 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  for (const [pid, sessionId] of pairs) {
    fs.writeFileSync(path.join(dir, pid + '.json'), JSON.stringify({ pid, sessionId }) + '\n');
  }
  return cfg;
}

// A pid that has certainly exited: `spawnSync` returned, so the process it
// names is already gone.
const deadPid = () => spawnSync(process.execPath, ['-e', '0']).pid;

// A pid that is certainly running. This process is `MINE` by definition, and
// the other sessions need pids of their own — a pid is the only handle
// `readLive` has, so there is nothing to fake and a real child is the cheapest
// way to own one.
const sleepers = [];
function livePid() {
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 120e3)'], { stdio: 'ignore' });
  child.unref();
  sleepers.push(child);
  return child.pid;
}
test.after(() => { for (const child of sleepers) child.kill(); });

const LIVE = seedLive([[process.pid, MINE], [livePid(), THEIRS]]);

// The real hook, driven the way Claude Code drives it. Both directories are set
// explicitly rather than inherited: a stray CLAUDE_PROJECT_DIR would send the
// hook off to read a different repository's registry, and the real
// CLAUDE_CONFIG_DIR would make every liveness answer depend on the machine.
function run(root, payload, cfg) {
  const env = Object.assign({}, process.env, {
    CLAUDE_PROJECT_DIR: root,
    CLAUDE_CONFIG_DIR: cfg || LIVE,
  });
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

test('an active session that said nothing about the guard is asked', () => {
  const root = tmp();
  seed(root, MINE, { claims: ['README.md'] });
  seed(root, THEIRS, { task: 'retune the ramp', claims: ['statusline.ps1'] });
  assert.equal(decisionOf(run(root, edit(root, path.join(root, 'statusline.ps1')))), 'ask');
});

test('guard: "off" is the way out, and it is a stored value', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'off', claims: ['README.md'] });
  seed(root, THEIRS, { task: 'retune the ramp', claims: ['statusline.ps1'] });
  assert.equal(run(root, edit(root, path.join(root, 'statusline.ps1'))), '');
});

test('a guarded session editing a file nobody else claimed is not stopped', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'ask', claims: ['README.md'] });
  seed(root, THEIRS, { task: 'retune the ramp', claims: ['statusline.ps1'] });
  assert.equal(run(root, edit(root, path.join(root, 'README.md'))), '');
});

test('another live session’s file is put in front of the user', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'ask', claims: ['README.md'] });
  seed(root, THEIRS, { task: 'retune the 5h ramp', stage: 'verify', claims: ['statusline.ps1'] });
  const out = run(root, edit(root, path.join(root, 'statusline.ps1')));
  assert.equal(decisionOf(out), 'ask');
  const reason = reasonOf(out);
  assert.match(reason, /statusline\.ps1 is claimed by another live session/);
  assert.match(reason, /retune the 5h ramp @ verify/);
});

test('guard: "deny" refuses outright', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['README.md'] });
  seed(root, THEIRS, { claims: ['statusline.ps1'] });
  assert.equal(decisionOf(run(root, edit(root, path.join(root, 'statusline.ps1')))), 'deny');
});

test('a bare guard: true asks rather than denies', () => {
  const root = tmp();
  seed(root, MINE, { guard: true, claims: ['README.md'] });
  seed(root, THEIRS, { claims: ['statusline.ps1'] });
  assert.equal(decisionOf(run(root, edit(root, path.join(root, 'statusline.ps1')))), 'ask');
});

// The entry is identical in both halves and only the pid behind it differs,
// which is the whole point: age said nothing and the process says everything.
test('a claim whose process is gone does not block, and the same claim from a live one does', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['README.md'] });
  seed(root, THEIRS, { claims: ['statusline.ps1'] });
  const file = path.join(root, 'statusline.ps1');

  const gone = seedLive([[process.pid, MINE], [deadPid(), THEIRS]]);
  assert.equal(run(root, edit(root, file), gone), '',
    'the pid exited, so nothing is behind that claim');

  assert.equal(decisionOf(run(root, edit(root, file))), 'deny',
    'the same claim, from a pid that is still running');
});

test('when liveness cannot be measured, every active claim blocks', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['README.md'] });
  seed(root, THEIRS, { claims: ['statusline.ps1'] });
  // This session's own id is absent from the directory being read, so that
  // directory is not the one this machine uses and every answer from it would
  // be wrong in the dangerous direction. Unknown warns rather than suppresses,
  // even over a pid that is certainly gone.
  const blind = seedLive([[deadPid(), THEIRS]]);
  assert.equal(decisionOf(run(root, edit(root, path.join(root, 'statusline.ps1')), blind)), 'deny');
});

// Regression guard: nothing here checks `updated` any more, and this proves it
// by seeding the field with the exact value the old 12h staleness cutoff would
// have refused — `ago(20 * 3600e3)`, the old fixture for "a stale claim warns
// but never blocks". If an age filter ever gets reintroduced beside the
// liveness check, this is the test that catches it; every other seed in this
// file leaves `updated` at its fresh default, so none of them would notice.
test('an old claim from a running session still blocks — age is not the test any more', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['README.md'] });
  seed(root, THEIRS, { claims: ['statusline.ps1'], updated: ago(20 * 3600e3) });
  assert.equal(decisionOf(run(root, edit(root, path.join(root, 'statusline.ps1')))), 'deny');
});

test('a stood-down claim does not block', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['README.md'] });
  seed(root, THEIRS, { claims: ['statusline.ps1'], active: false });
  assert.equal(run(root, edit(root, path.join(root, 'statusline.ps1'))), '');
});

test('when both hold the file, the older claim holds and the newer yields', () => {
  const early = tmp();
  seed(early, MINE, { guard: 'deny', claims: ['statusline.ps1'], started: ago(5 * 3600e3) });
  seed(early, THEIRS, { claims: ['statusline.ps1'], started: ago(1 * 3600e3) });
  assert.equal(run(early, edit(early, path.join(early, 'statusline.ps1'))), '',
    'the older claim is mine, so nothing stops me');

  const late = tmp();
  seed(late, MINE, { guard: 'deny', claims: ['statusline.ps1'], started: ago(1 * 3600e3) });
  seed(late, THEIRS, { claims: ['statusline.ps1'], started: ago(5 * 3600e3) });
  assert.equal(decisionOf(run(late, edit(late, path.join(late, 'statusline.ps1')))), 'deny',
    'they claimed it first, so I yield');
});

test('a file outside the project root is none of its business', () => {
  const root = tmp();
  const elsewhere = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['statusline.ps1'] });
  seed(root, THEIRS, { claims: ['statusline.ps1'], started: ago(9 * 3600e3) });
  assert.equal(run(root, edit(root, path.join(elsewhere, 'statusline.ps1'))), '');
});

test('a bare directory claim covers what is under it', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['README.md'] });
  seed(root, THEIRS, { claims: ['src'] });
  assert.equal(decisionOf(run(root, edit(root, path.join(root, 'src', 'a.ts')))), 'deny');
});

test('NotebookEdit’s own path field is read', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['README.md'] });
  seed(root, THEIRS, { claims: ['analysis.ipynb'] });
  const out = run(root, edit(root, path.join(root, 'analysis.ipynb'), 'NotebookEdit'));
  assert.equal(decisionOf(out), 'deny');
});

test('a tool call carrying no path says nothing', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['statusline.ps1'] });
  seed(root, THEIRS, { claims: ['statusline.ps1'], started: ago(9 * 3600e3) });
  assert.equal(run(root, { session_id: MINE, cwd: root, tool_name: 'Bash', tool_input: { command: 'ls' } }), '');
});

test('a payload that is not JSON does not block the edit', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['statusline.ps1'] });
  assert.equal(run(root, 'not json at all'), '');
});

test('two holders are both named', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'ask', claims: ['README.md'] });
  seed(root, THEIRS, { task: 'first task', claims: ['statusline.ps1'] });
  seed(root, THIRD, { task: 'second task', claims: ['statusline.ps1'] });
  const cfg = seedLive([[process.pid, MINE], [livePid(), THEIRS], [livePid(), THIRD]]);
  const reason = reasonOf(run(root, edit(root, path.join(root, 'statusline.ps1')), cfg));
  assert.match(reason, /2 other live sessions/);
  assert.match(reason, /first task/);
  assert.match(reason, /second task/);
});

test('the reason says how to get out of it', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['README.md'] });
  seed(root, THEIRS, { claims: ['statusline.ps1'] });
  const reason = reasonOf(run(root, edit(root, path.join(root, 'statusline.ps1'))));
  assert.match(reason, /move off the file/);
  assert.match(reason, /task\.js clear/);
  assert.match(reason, /guard off/);
});

// ---- the pieces ----------------------------------------------------------

// Two ways to say off and one to say deny; everything else asks. The direction
// the unrecognised value falls is the whole point of the default: somebody who
// wrote a word this does not know did not ask to be unguarded, and `ask` is the
// reading they can undo with one keypress.
test('guardMode takes two words for off, one for deny, and asks otherwise', () => {
  assert.equal(guard.guardMode({ guard: 'off' }), null);
  assert.equal(guard.guardMode({ guard: false }), null);
  assert.equal(guard.guardMode({ guard: 'deny' }), 'deny');
  assert.equal(guard.guardMode({ guard: true }), 'ask');
  assert.equal(guard.guardMode({ guard: 'ask' }), 'ask');
  assert.equal(guard.guardMode({ guard: 'yes' }), 'ask');
  assert.equal(guard.guardMode({}), 'ask');
  assert.equal(guard.guardMode(null), 'ask');
});

test('relPath normalises to forward slashes and refuses anything outside the root', () => {
  const root = path.join(os.tmpdir(), 'fankeel-rel');
  assert.equal(guard.relPath(root, path.join(root, 'src', 'a.ts')), 'src/a.ts');
  assert.equal(guard.relPath(root, path.join(root, '..', 'a.ts')), null);
  assert.equal(guard.relPath(root, root), null);
  assert.equal(guard.relPath(root, ''), null);
  assert.equal(guard.relPath('', 'a.ts'), null);
});

// The clock is gone from this signature entirely. Unknown is the only state
// that adds a blocker rather than removing one.
test('blockers reads liveness, not age', () => {
  const mine = { claims: ['README.md'] };
  const others = [{ sessionId: THEIRS, data: { claims: ['a.ts'] } }];
  assert.equal(guard.blockers(mine, others, 'a.ts', { known: true, ids: new Set([THEIRS]) }).length, 1);
  assert.equal(guard.blockers(mine, others, 'a.ts', { known: true, ids: new Set() }).length, 0);
  assert.equal(guard.blockers(mine, others, 'a.ts', { known: false, ids: new Set() }).length, 1);
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

// The hook asks this question too, one line above the directory read it guards.
// `decide` still asks it on its own, so the module stays answerable without the
// hook and this stays the test of that.
test('decide says nothing at all when the guard is off', () => {
  const root = path.join(os.tmpdir(), 'fankeel-decide');
  const mine = { guard: 'off', claims: ['README.md'] };
  const others = [{ sessionId: THEIRS, data: { claims: ['a.ts'], started: ago(3600e3) } }];
  const liveState = { known: true, ids: new Set([THEIRS]) };
  assert.equal(guard.decide({ mine, others, root, file: path.join(root, 'a.ts'), liveState }), null);
});

test('the refusal names the command that clears a claim nobody is behind', () => {
  const text = guard.reasonFor('web/a.js', [{ sessionId: THEIRS, data: { task: 't', stage: 'build' } }], MINE);
  assert.match(text, /task\.js clear/);
});

// `blockers` drops the sessions whose process is gone, so every holder this text
// can ever name is live. `clear` does not read liveness — it reads the age of the
// entry — so one of those holders is refused without --force and another, quiet
// for longer than the age gate, is not. The printed command has to run for both,
// which is why --force is in it rather than left to the reader to add.
test('the refusal prints the clear command whole, and says why --force is part of it', () => {
  const text = guard.reasonFor('web/a.js', [{ sessionId: THEIRS, data: { task: 't', stage: 'build' } }], MINE);
  assert.match(text, new RegExp('node .*task\\.js clear ' + THEIRS + ' --force --session ' + MINE));
  assert.match(text, /`--force` is printed rather than left to you/);
  // The premise the old wording carried: that a claim only blocks while it is
  // live and `clear` therefore refuses every holder named here. It does not.
  assert.doesNotMatch(text, /a claim only blocks while/);
  // adopt is named only with the precondition attached: a guarded session owns an
  // active task, which is exactly the caller cmdAdopt refuses.
  assert.match(text, /adoptable, though not by this session/);
});
