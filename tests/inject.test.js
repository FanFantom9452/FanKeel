'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const HOOK = path.join(__dirname, '..', 'hooks', 'inject.js');

const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const THEIRS = 'bbbbbbbb-0000-4000-8000-000000000002';

const ago = (ms) => new Date(Date.now() - ms).toISOString();

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function seed(root, sessionId, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({
    task: 'rework the colour ramp',
    scope: ['statusline.ps1'],
    stage: 'implement',
    active: true,
    started: ago(2 * 3600e3),
    updated: ago(3600e3),
  }, over);
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

// The lead file is `key=value` a line at a time. Read back the same way the
// statusline reads it, so a test failure means the renderer would have seen it
// too.
function leadOf(cfg, sessionId) {
  try {
    const text = fs.readFileSync(path.join(cfg, 'modes', sessionId, 'fankeel.lead'), 'utf8');
    const out = {};
    for (const line of text.split('\n')) {
      const i = line.indexOf('=');
      if (i > 0) out[line.slice(0, i)] = line.slice(i + 1);
    }
    return out;
  } catch (e) {
    return null;
  }
}

// Runs the real hook the way Claude Code does: payload on stdin, everything else
// from the environment.
function run(payload, claudeDir) {
  const out = execFileSync(process.execPath, [HOOK], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: claudeDir || tmp('fankeel-cfg-') }),
  });
  return out;
}

const context = (out) => JSON.parse(out).hookSpecificOutput.additionalContext;
const readEntry = (root, sid) =>
  JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', sid + '.json'), 'utf8'));

test('a project with no .fankeel says nothing', () => {
  const root = tmp('fankeel-hook-');
  assert.equal(run({ session_id: MINE, cwd: root }), '');
});

test('a session with no entry of its own says nothing', () => {
  const root = tmp('fankeel-hook-');
  seed(root, THEIRS);
  assert.equal(run({ session_id: MINE, cwd: root }), '');
});

test('a stood-down entry says nothing', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE, { active: false });
  assert.equal(run({ session_id: MINE, cwd: root }), '');
});

test('an active entry injects its task', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  const ctx = context(run({ session_id: MINE, cwd: root }));
  assert.match(ctx, /FANKEEL ACTIVE — rework the colour ramp @ implement/);
  assert.match(ctx, /stage rules:/);
});

test('the payload shape is what Claude Code expects', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  const parsed = JSON.parse(run({ session_id: MINE, cwd: root }));
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.equal(typeof parsed.hookSpecificOutput.additionalContext, 'string');
});

test('another live session in the same file is reported as an overlap', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  seed(root, THEIRS, { task: 'retune the 5h ramp', scope: ['statusline.ps1'] });
  const ctx = context(run({ session_id: MINE, cwd: root }));
  assert.match(ctx, /also in progress:/);
  assert.match(ctx, /<< overlaps: statusline\.ps1/);
});

test('another live session elsewhere is listed without a marker', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  seed(root, THEIRS, { task: 'rewrite the installer', scope: ['install.ps1'] });
  const ctx = context(run({ session_id: MINE, cwd: root }));
  assert.match(ctx, /rewrite the installer/);
  assert.equal(ctx.includes('overlaps'), false);
});

test('this session never appears in its own also-in-progress block', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  const ctx = context(run({ session_id: MINE, cwd: root }));
  assert.equal(ctx.includes('also in progress'), false);
});

test('CLAUDE_PROJECT_DIR wins over cwd', () => {
  const root = tmp('fankeel-hook-');
  const elsewhere = tmp('fankeel-else-');
  seed(root, MINE);
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: MINE, cwd: elsewhere }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-'),
      CLAUDE_PROJECT_DIR: root,
    }),
  });
  assert.match(context(out), /rework the colour ramp/);
});

test('a payload that is not JSON says nothing and exits 0', () => {
  assert.equal(run('{ not json'), '');
});

test('an empty payload says nothing and exits 0', () => {
  assert.equal(run(''), '');
});

test('a payload with no session_id says nothing', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  assert.equal(run({ cwd: root }), '');
});

test('a malformed session_id says nothing', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  assert.equal(run({ session_id: '../../etc/passwd', cwd: root }), '');
});

test('a broken sibling entry is skipped and the rest still renders', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  fs.writeFileSync(
    path.join(root, '.fankeel', 'sessions', 'cccccccc-0000-4000-8000-000000000003.json'),
    '{ truncated',
  );
  seed(root, THEIRS, { task: 'still here', scope: ['install.ps1'] });
  const ctx = context(run({ session_id: MINE, cwd: root }));
  assert.match(ctx, /still here/);
});

test('running advances this entry updated and nothing else', () => {
  const root = tmp('fankeel-hook-');
  const before = seed(root, MINE);
  run({ session_id: MINE, cwd: root });
  const after = readEntry(root, MINE);
  assert.ok(Date.parse(after.updated) > Date.parse(before.updated));
  for (const k of Object.keys(before)) {
    if (k === 'updated') continue;
    assert.deepEqual(after[k], before[k], 'field ' + k + ' changed');
  }
});

test('another session entry is byte-identical after a run', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  seed(root, THEIRS, { task: 'untouched', scope: ['install.ps1'] });
  const file = path.join(root, '.fankeel', 'sessions', THEIRS + '.json');
  const before = fs.readFileSync(file);
  run({ session_id: MINE, cwd: root });
  assert.deepEqual(fs.readFileSync(file), before);
});

test('with the mode off nothing at all is written', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  run({ session_id: MINE, cwd: root }, cfg);
  assert.equal(fs.existsSync(path.join(root, '.fankeel')), false);
  assert.equal(fs.existsSync(path.join(cfg, 'modes')), false);
});

test('the badge carries the stage', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, MINE, { stage: 'design' });
  run({ session_id: MINE, cwd: root }, cfg);
  assert.equal(fs.readFileSync(path.join(cfg, 'modes', MINE, 'fankeel'), 'utf8'), 'design\n');
});

test('the badge carries clash when another live session overlaps', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, MINE);
  seed(root, THEIRS, { scope: ['statusline.ps1'] });
  run({ session_id: MINE, cwd: root }, cfg);
  assert.equal(fs.readFileSync(path.join(cfg, 'modes', MINE, 'fankeel'), 'utf8'), 'clash\n');
});

test('a clash takes the badge slot, and leaves the lead line its stage', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, MINE, { stage: 'build' });
  seed(root, THEIRS, { scope: ['statusline.ps1'] });
  run({ session_id: MINE, cwd: root }, cfg);

  // One word is all the shared line has, so there the collision outranks the
  // stage.
  assert.equal(fs.readFileSync(path.join(cfg, 'modes', MINE, 'fankeel'), 'utf8'), 'clash\n');

  // The lead line has a field of its own for the collision, and it is already
  // filled. Spending the word on it as well would state one fact twice while
  // destroying the only copy of another — the stage has nowhere else to live.
  const lead = leadOf(cfg, MINE);
  assert.equal(lead.word, 'build');
  assert.equal(lead.others, '1');
});

test('a stale overlapping session still counts as a clash', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, MINE);
  seed(root, THEIRS, { scope: ['statusline.ps1'], updated: ago(19 * 24 * 3600e3) });
  run({ session_id: MINE, cwd: root }, cfg);
  assert.equal(fs.readFileSync(path.join(cfg, 'modes', MINE, 'fankeel'), 'utf8'), 'clash\n');
});

test('an unreadable sessions directory costs nothing but the extras', () => {
  const root = tmp('fankeel-hook-');
  seed(root, MINE);
  fs.rmSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'));
  assert.equal(run({ session_id: MINE, cwd: root }), '');
});
