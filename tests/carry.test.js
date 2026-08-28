'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const HOOK = path.join(ROOT, 'hooks', 'carry.js');

const NEW = 'aaaaaaaa-0000-4000-8000-000000000001';
const GONE = 'bbbbbbbb-0000-4000-8000-000000000002';
const GONE_PID = 2147483646;

const ago = (ms) => new Date(Date.now() - ms).toISOString();

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function seed(root, sessionId, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({
    task: 'rework the colour ramp',
    claims: ['statusline.ps1', 'lib/badge.js'],
    route: ['survey', 'design', 'build', 'verify', 'land'],
    stage: 'build',
    notes: ['ANSI 256 has no true mid green'],
    next: 'wire the badge word into TokenBar',
    active: true,
    started: ago(2 * 3600e3),
    updated: ago(60e3),
  }, over);
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

// Claude Code's own session registry, which is not fankeel's: one file per
// running session, named for the pid that owns it. This session goes into it
// every time, because a directory `readLive` cannot find itself in is the wrong
// directory and everything in it counts live.
function seedLive(cfg, entries) {
  const dir = path.join(cfg, 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  for (const [sessionId, pid] of entries) {
    fs.writeFileSync(path.join(dir, pid + '.json'), JSON.stringify({ pid, sessionId }) + '\n');
  }
}

// Runs the real hook the way Claude Code does: the SessionStart payload on
// stdin, everything else from the environment.
function run(payload, claudeDir) {
  return execFileSync(process.execPath, [HOOK], {
    input: typeof payload === 'string' ? payload : JSON.stringify(Object.assign({
      hook_event_name: 'SessionStart',
      source: 'clear',
    }, payload)),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: claudeDir || tmp('fankeel-cfg-') }),
  });
}

const context = (out) => JSON.parse(out).hookSpecificOutput.additionalContext;

test('an entry whose session is gone is offered, with the adopt line filled in', () => {
  const root = tmp('fankeel-carry-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, GONE);
  seedLive(cfg, [[NEW, process.pid], [GONE, GONE_PID]]);

  const out = context(run({ session_id: NEW, cwd: root }, cfg));
  assert.match(out, /left a task behind/);
  assert.match(out, /rework the colour ramp/);
  assert.match(out, new RegExp('adopt ' + GONE));
  assert.match(out, new RegExp('--session ' + NEW));
  // The command has to be runnable as it stands. Every other block defines
  // `<plugin>` on a line above the rules that use it; this one has no such line,
  // so a placeholder here is a command nobody can copy.
  assert.doesNotMatch(out, /<plugin>/);
  assert.match(out, /node \S+[/\\]scripts[/\\]task\.js adopt /);
  assert.match(out, /ANSI 256 has no true mid green/);
  assert.match(out, /wire the badge word into TokenBar/);
});

// The route, not just the stage: `build` of five is a different thing to pick up
// than `build` of seven, and the entry records which one this task chose.
test('the offer says where on its own route the task got to', () => {
  const root = tmp('fankeel-carry-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, GONE);
  seedLive(cfg, [[NEW, process.pid], [GONE, GONE_PID]]);

  const out = context(run({ session_id: NEW, cwd: root }, cfg));
  assert.match(out, /stage: build \(3 of 5\)/);
  assert.match(out, /touched 2 files/);
});

test('an entry whose session is still running is left alone', () => {
  const root = tmp('fankeel-carry-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, GONE);
  seedLive(cfg, [[NEW, process.pid], [GONE, process.pid]]);

  assert.equal(run({ session_id: NEW, cwd: root }, cfg), '');
});

test('an entry older than STALE_MS is an ordinary abandoned record, not this clear’s', () => {
  const root = tmp('fankeel-carry-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, GONE, { updated: ago(13 * 3600e3) });
  seedLive(cfg, [[NEW, process.pid], [GONE, GONE_PID]]);

  assert.equal(run({ session_id: NEW, cwd: root }, cfg), '');
});

test('a subagent is never offered a task, whatever the registry holds', () => {
  const root = tmp('fankeel-carry-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, GONE);
  seedLive(cfg, [[NEW, process.pid], [GONE, GONE_PID]]);

  assert.equal(run({ session_id: NEW, cwd: root, agent_id: 'agent-1' }, cfg), '');
});

test('a stood-down entry is not a task anybody lost', () => {
  const root = tmp('fankeel-carry-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, GONE, { active: false });
  seedLive(cfg, [[NEW, process.pid], [GONE, GONE_PID]]);

  assert.equal(run({ session_id: NEW, cwd: root }, cfg), '');
});

// This session's own entry is not a task it lost. A `/clear` gives a new id, so
// the case is theoretical — but an adopt line naming the reader is nonsense, and
// nothing else stops it.
test('a session is never offered its own entry', () => {
  const root = tmp('fankeel-carry-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, NEW);
  seedLive(cfg, [[NEW, process.pid]]);

  assert.equal(run({ session_id: NEW, cwd: root }, cfg), '');
});

test('a project with no .fankeel says nothing', () => {
  const root = tmp('fankeel-carry-');
  assert.equal(run({ session_id: NEW, cwd: root }), '');
});

test('nothing on stdin, and nothing that parses, are both survivable', () => {
  assert.equal(run('', tmp('fankeel-cfg-')), '');
  assert.equal(run('not json', tmp('fankeel-cfg-')), '');
});

test('the manifest runs it on a clear and on nothing else', () => {
  const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  const starts = plugin.hooks.SessionStart;
  assert.equal(starts.length, 1);
  assert.equal(starts[0].matcher, 'clear');
  assert.equal(starts[0].hooks.length, 1);
  assert.equal(starts[0].hooks[0].timeout, 5);
  assert.match(starts[0].hooks[0].command, /hooks\/carry\.js/);
});

test('the hook writes nothing to the registry it reads', () => {
  const root = tmp('fankeel-carry-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, GONE);
  seedLive(cfg, [[NEW, process.pid], [GONE, GONE_PID]]);
  const file = path.join(root, '.fankeel', 'sessions', GONE + '.json');
  const before = fs.readFileSync(file, 'utf8');

  run({ session_id: NEW, cwd: root }, cfg);

  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.equal(fs.existsSync(path.join(root, '.fankeel', 'sessions', NEW + '.json')), false);
});
