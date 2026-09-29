'use strict';

// A /fankeel prompt makes a session visible before it has a task
// (.fankeel/build/task-20260929T104735/design.md §4).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const HOOKS = path.join(__dirname, '..', 'hooks');
const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
const A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const B = 'bbbbbbbb-0000-4000-8000-00000000000b';

function project() {
  const dir = tmp('fankeel-init-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  return { dir, cfg: tmp('fankeel-cfg-') };
}
function hook(name, payload, cfg) {
  const r = spawnSync(process.execPath, [path.join(HOOKS, name)], {
    input: JSON.stringify(payload), encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg, FANKEEL_SERVE: 'off' }),
  });
  assert.equal(r.status, 0, name + ': ' + r.stderr);
  return r.stdout;
}
function task(p, session, args) {
  const r = spawnSync(process.execPath, [TASK, ...args, '--session', session, '--root', p.dir, '--claude-dir', p.cfg], {
    encoding: 'utf8', cwd: p.dir, env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: p.cfg }),
  });
  return { out: r.stdout + r.stderr, code: r.status };
}
const fankeel = (p, session, prompt) => hook('inject.js', { session_id: session, cwd: p.dir, prompt: prompt || '/fankeel' }, p.cfg);

test('a /fankeel prompt from a session with no entry writes an init entry with no task', () => {
  const p = project();
  fankeel(p, A);
  const e = registry.readSession(p.dir, A);
  assert.equal(e.active, true);
  assert.equal(e.stage, 'init');
  assert.equal('task' in e, false);
});

test('another session sees the init entry: task.js show lists it, and readActive counts it', () => {
  const p = project();
  fankeel(p, A);
  const r = task(p, B, ['show']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /@ init/);
  assert.deepEqual(registry.readActive(p.dir).map((x) => x.sessionId), [A]);
});

test('the injected also-in-progress block of B names A as init', () => {
  const p = project();
  fankeel(p, A);
  assert.equal(task(p, B, ['start', '--task', 'b work', '--route', 'build,land']).code, 0);
  const out = JSON.parse(hook('inject.js', { session_id: B, cwd: p.dir, prompt: 'hello' }, p.cfg));
  assert.match(out.hookSpecificOutput.additionalContext, /also in progress:\n {2}- untitled @ init/);
});

test('an ordinary prompt from an init session says nothing and writes nothing; a second /fankeel still gets the init block', () => {
  const p = project();
  fankeel(p, A);
  const file = path.join(p.dir, '.fankeel', 'sessions', A + '.json');
  const before = fs.readFileSync(file, 'utf8');
  assert.equal(fankeel(p, A, 'hello'), '');
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.ok(JSON.parse(fankeel(p, A)).hookSpecificOutput.additionalContext.includes(A));
});

test('a second /fankeel from an init-only session leaves the init badge in place', () => {
  const p = project();
  fankeel(p, A);
  const badge = require('../lib/badge.js');
  assert.equal(badge.readBadge(p.cfg, A), 'init');
  fankeel(p, A);
  assert.equal(badge.readBadge(p.cfg, A), 'init');
});

test('start takes over this session\'s own init entry, and a second start is still refused', () => {
  const p = project();
  fankeel(p, A);
  const r = task(p, A, ['start', '--task', 'real work', '--route', 'build,land']);
  assert.equal(r.code, 0, r.out);
  const e = registry.readSession(p.dir, A);
  assert.equal(e.task, 'real work');
  assert.equal(e.stage, 'build');
  assert.match(task(p, A, ['start', '--task', 'again']).out, /already owns an active task/);
});

test('adopt refuses an init entry as its source and says there is nothing to carry', () => {
  const p = project();
  fankeel(p, A);
  const r = task(p, B, ['adopt', A]);
  assert.equal(r.code, 1);
  assert.match(r.out, /no task to adopt/);
});

test('every hook that reads the entry exits 0 on an init entry and prints no undefined', () => {
  const p = project();
  fankeel(p, A);
  const base = { session_id: A, cwd: p.dir, transcript_path: path.join(p.dir, 'none.jsonl') };
  const payloads = {
    'guard.js': { ...base, tool_name: 'Write', tool_input: { file_path: path.join(p.dir, 'x.txt'), content: 'x' } },
    'touch.js': { ...base, tool_name: 'Write', tool_input: { file_path: path.join(p.dir, 'x.txt') } },
    'brief.js': { ...base, hook_event_name: 'SubagentStart', agent_type: 'general-purpose' },
    'resume.js': { ...base, tool_name: 'AskUserQuestion', tool_input: {} },
    'gate.js': { ...base, tool_name: 'AskUserQuestion', tool_input: { questions: [] } },
    'leave.js': { ...base, hook_event_name: 'SessionEnd', reason: 'other' },
    'carry.js': { ...base, hook_event_name: 'SessionStart', source: 'clear' },
    'title.js': { ...base, tool_name: 'Agent', tool_input: { subagent_type: 'general-purpose', description: 'look', prompt: 'p' } },
  };
  for (const [name, payload] of Object.entries(payloads)) {
    const out = hook(name, payload, p.cfg);
    assert.doesNotMatch(out, /undefined|\[object/, name);
  }
});

test('carry offers an init entry a cleared session left behind, and names it untitled', () => {
  const p = project();
  fankeel(p, A);
  fs.mkdirSync(path.join(p.cfg, 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(p.cfg, 'sessions', process.pid + '.json'), JSON.stringify({ pid: process.pid, sessionId: B }) + '\n');
  const out = hook('carry.js', { session_id: B, cwd: p.dir, source: 'clear', hook_event_name: 'SessionStart' }, p.cfg);
  assert.match(out, /task: {2}untitled/);
  assert.doesNotMatch(out, /undefined|\[object/);
});

test('the station serves an init row as 初始化中 with an empty task, and its live rows equal the registry\'s active entries', () => {
  const p = project();
  fankeel(p, A);
  fankeel(p, B);
  const text = station.serialize(station.gather({ configDir: p.cfg }), {});
  const rows = JSON.parse(text.replace(/^window\.STATION = /, '').replace(/;\n$/, '')).sessions;
  const mine = rows.find((s) => s.id === A);
  assert.equal(mine.stage, '初始化中');
  assert.equal(mine.task, '');
  assert.equal(rows.filter((s) => s.state === 'live').length, registry.readActive(p.dir).length);
});
