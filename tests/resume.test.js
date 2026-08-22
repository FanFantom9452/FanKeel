'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const HOOK = path.join(ROOT, 'hooks', 'resume.js');
const INJECT = path.join(ROOT, 'hooks', 'inject.js');

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
    stage: 'build',
    notes: ['ANSI 256 has no true mid green'],
    active: true,
    started: ago(2 * 3600e3),
    updated: ago(3600e3),
  }, over);
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

// Runs the real hook the way Claude Code does: the PostToolUse payload on stdin,
// everything else from the environment.
function run(payload, hook, claudeDir) {
  return execFileSync(process.execPath, [hook || HOOK], {
    input: typeof payload === 'string' ? payload : JSON.stringify(Object.assign({
      tool_name: 'AskUserQuestion',
    }, payload)),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: claudeDir || tmp('fankeel-cfg-') }),
  });
}

const context = (out) => JSON.parse(out).hookSpecificOutput.additionalContext;
const readEntry = (root, sid) =>
  JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', sid + '.json'), 'utf8'));

test('a project with no .fankeel says nothing', () => {
  const root = tmp('fankeel-resume-');
  assert.equal(run({ session_id: MINE, cwd: root }), '');
});

test('a session with no entry of its own says nothing', () => {
  const root = tmp('fankeel-resume-');
  seed(root, THEIRS);
  assert.equal(run({ session_id: MINE, cwd: root }), '');
});

test('a stood-down entry says nothing', () => {
  const root = tmp('fankeel-resume-');
  seed(root, MINE, { active: false });
  assert.equal(run({ session_id: MINE, cwd: root }), '');
});

test('the payload shape is what Claude Code expects for PostToolUse', () => {
  const root = tmp('fankeel-resume-');
  seed(root, MINE);
  const parsed = JSON.parse(run({ session_id: MINE, cwd: root }));
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'PostToolUse');
  assert.equal(typeof parsed.hookSpecificOutput.additionalContext, 'string');
});

// The whole reason the hook exists. An answer to an AskUserQuestion arrives as a
// tool result, so UserPromptSubmit does not fire, and without this the rules the
// next turn is generated against are however many thousand tokens back the last
// typed prompt happens to be.
test('an answered question brings the stage rules back', () => {
  const root = tmp('fankeel-resume-');
  seed(root, MINE);
  const ctx = context(run({ session_id: MINE, cwd: root }));
  assert.match(ctx, /FANKEEL ACTIVE — rework the colour ramp @ build/);
  assert.match(ctx, /route: survey → design → plan → \[build\] → verify → audit → land/);
  assert.match(ctx, /stage rules:/);
  assert.match(ctx, /AskUserQuestion/);
  assert.match(ctx, /output shape:/);
});

// It is the short form on purpose. Everything the full block carries that cannot
// have moved between a question and its answer stays out, because this runs
// several times a stage and each copy is permanent in the context.
test('the short form leaves out what has not moved since the last prompt', () => {
  const root = tmp('fankeel-resume-');
  seed(root, MINE);
  seed(root, THEIRS, { task: 'retune the 5h ramp' });
  const ctx = context(run({ session_id: MINE, cwd: root }));
  assert.equal(ctx.includes('scope:'), false);
  assert.equal(ctx.includes('so far:'), false);
  assert.equal(ctx.includes('also in progress:'), false);
  assert.equal(ctx.includes('retune the 5h ramp'), false);
});

test('the short form really is shorter than the block a prompt gets', () => {
  const root = tmp('fankeel-resume-');
  seed(root, MINE);
  seed(root, THEIRS, { task: 'retune the 5h ramp' });
  const short = context(run({ session_id: MINE, cwd: root }));
  const full = context(run({ session_id: MINE, cwd: root }, INJECT));
  assert.ok(short.length < full.length, short.length + ' is not under ' + full.length);
});

test('the rules it sends are the ones for the stage the task is actually in', () => {
  const root = tmp('fankeel-resume-');
  seed(root, MINE, { stage: 'survey' });
  const ctx = context(run({ session_id: MINE, cwd: root }));
  assert.match(ctx, /@ survey/);
  assert.match(ctx, /route: \[survey\] →/);
});

// The one side effect. A session that drives itself entirely through its own
// questions would otherwise go quiet in the registry for as long as it behaves.
test('an answer advances this entry updated and nothing else', () => {
  const root = tmp('fankeel-resume-');
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
  const root = tmp('fankeel-resume-');
  seed(root, MINE);
  seed(root, THEIRS, { task: 'untouched' });
  const file = path.join(root, '.fankeel', 'sessions', THEIRS + '.json');
  const before = fs.readFileSync(file);
  run({ session_id: MINE, cwd: root });
  assert.deepEqual(fs.readFileSync(file), before);
});

// inject.js owns the badge, and nothing here can have changed what it reads: the
// stage moves through task.js, which writes the badge itself.
test('it does not touch the statusline', () => {
  const root = tmp('fankeel-resume-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, MINE);
  run({ session_id: MINE, cwd: root }, HOOK, cfg);
  assert.equal(fs.existsSync(path.join(cfg, 'modes')), false);
});

test('with the mode off nothing at all is written', () => {
  const root = tmp('fankeel-resume-');
  const cfg = tmp('fankeel-cfg-');
  run({ session_id: MINE, cwd: root }, HOOK, cfg);
  assert.equal(fs.existsSync(path.join(root, '.fankeel')), false);
  assert.equal(fs.existsSync(path.join(cfg, 'modes')), false);
});

test('CLAUDE_PROJECT_DIR wins over cwd', () => {
  const root = tmp('fankeel-resume-');
  const elsewhere = tmp('fankeel-else-');
  seed(root, MINE);
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: MINE, cwd: elsewhere, tool_name: 'AskUserQuestion' }),
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
  const root = tmp('fankeel-resume-');
  seed(root, MINE);
  assert.equal(run({ cwd: root }), '');
});

test('a malformed session_id says nothing', () => {
  const root = tmp('fankeel-resume-');
  seed(root, MINE);
  assert.equal(run({ session_id: '../../etc/passwd', cwd: root }), '');
});

// The matcher is the whole cost control. Widened to every tool, this would append
// the stage rules after each Read and each Bash, which is a bill rather than a
// fix — so the manifest is asserted rather than trusted.
test('the manifest runs it on AskUserQuestion and on nothing else', () => {
  const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  const post = plugin.hooks.PostToolUse;
  const mine = post.filter((e) => e.hooks.some((h) => /hooks\/resume\.js/.test(h.command)));
  assert.equal(mine.length, 1, 'resume.js is registered more than once');
  assert.equal(mine[0].matcher, 'AskUserQuestion');
  assert.equal(mine[0].hooks.length, 1);
  assert.equal(mine[0].hooks[0].timeout, 5);
});

test('the drift hook runs on writes and on nothing else', () => {
  const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  const post = plugin.hooks.PostToolUse;
  const touch = post.filter((e) => e.hooks.some((h) => /hooks\/touch\.js/.test(h.command)));
  assert.equal(touch.length, 1);
  assert.equal(touch[0].matcher, 'Edit|Write|NotebookEdit');
  assert.equal(touch[0].hooks[0].timeout, 5);
});

test('every hook the manifest names is a file that exists', () => {
  const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  for (const entries of Object.values(plugin.hooks)) {
    for (const entry of entries) {
      for (const hook of entry.hooks) {
        const name = /hooks\/([a-z-]+\.js)/.exec(hook.command);
        assert.ok(name, 'no hook file in: ' + hook.command);
        assert.ok(fs.existsSync(path.join(ROOT, 'hooks', name[1])), 'missing hooks/' + name[1]);
      }
    }
  }
});
