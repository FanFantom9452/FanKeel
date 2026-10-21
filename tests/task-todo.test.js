'use strict';

// start --todo, and the land step that closes what it named
// (docs/99-archive/2026-09-29-todo-files-design.md §4).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const registry = require('../lib/registry.js');
const lib = require('../lib/todo.js');
const { byName } = require('../lib/stages.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'task.js');
const A = 'aaaaaaaa-5555-4555-8555-555555555555';

function task(dir, args) {
  const cfg = path.join(dir, 'cfg');
  return execFileSync(process.execPath, [SCRIPT, ...args, '--session', A, '--root', dir, '--claude-dir', cfg],
    { encoding: 'utf8', cwd: dir, env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
}

function root(withFolder) {
  const dir = tmp('fankeel-tasktodo-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  if (withFolder) {
    fs.mkdirSync(path.join(dir, 'docs', 'todo'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [
      { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
  }
  return dir;
}

test('start --todo, repeated, records every id and the start output says them', () => {
  const dir = root(true);
  const out = task(dir, ['start', '--task', 'close two', '--route', 'build,land', '--todo', 'a-1', '--todo', 'a-2']);
  assert.deepEqual(registry.todosOf(registry.readSession(dir, A)), ['a-1', 'a-2']);
  assert.match(out, /^ {2}todo:\n {4}a-1\n {4}a-2$/m);
  task(dir, ['task', 'something else']);
  assert.deepEqual(registry.todosOf(registry.readSession(dir, A)), [], 'a new task names no entry');
});

test('stage land prints the todo.js done line for each id where the project keeps entry files', () => {
  const dir = root(true);
  lib.add(dir, { label: 'a', title: 'one', description: 'first', state: 'ready' });
  task(dir, ['start', '--task', 'close one', '--route', 'build,land', '--todo', 'a-1']);
  const out = task(dir, ['stage', 'land']);
  assert.match(out, new RegExp('todo\\.js done a-1 --sha <sha> --session ' + A));
  // 2026-10-21 land-close-order judgement: close only after the record is filed, and carry it.
  assert.match(out, /close at land once `record\.js write` has printed `filed:`/);
  assert.match(out, new RegExp('todo\\.js done a-1 --sha <sha> --session ' + A + ' --root .+ --record "[^"]+" --commits <sha,sha>'));
  // The closing block sits under land's rules, and the same-turn line ends the output.
  assert.ok(out.includes('stage rules:'), out);
  assert.ok(out.indexOf('stage rules:') < out.indexOf('close at land'), out);
  assert.ok(out.trimEnd().endsWith('進到這一站後在同一回合開工，不要先收回合。'), out);
});

test('a titled entry prints id：title, above its done line at land and under todo: in the description', () => {
  const dir = root(true);
  lib.add(dir, { label: 'demo', title: '示範標題', description: 'first', state: 'ready' });
  const started = task(dir, ['start', '--task', 'close demo', '--route', 'build,land', '--todo', 'demo-1']);
  assert.match(started, /^ {2}todo:\n {4}demo-1：示範標題$/m);
  const lines = task(dir, ['stage', 'land']).split('\n');
  const at = lines.findIndex((l) => l.includes('todo.js done demo-1'));
  assert.ok(at > 0, 'the done line is printed');
  assert.equal(lines[at - 1], '  demo-1：示範標題');
});

test('an entry folder that cannot be read prints bare ids at start and at land instead of throwing', () => {
  const dir = root(true);
  // A directory where an entry file belongs: readdir lists it and reading it throws EISDIR.
  fs.mkdirSync(path.join(dir, 'docs', 'todo', 'broken-1.md'));
  const started = task(dir, ['start', '--task', 'close demo', '--route', 'build,land', '--todo', 'demo-1']);
  assert.match(started, /^ {2}todo:\n {4}demo-1$/m);
  const lines = task(dir, ['stage', 'land']).split('\n');
  const at = lines.findIndex((l) => l.includes('todo.js done demo-1'));
  assert.ok(at > 0, 'the done line is printed');
  assert.equal(lines[at - 1], '  demo-1');
});

test('with no entry folder stage land prints no todo.js line', () => {
  const dir = root(false);
  task(dir, ['start', '--task', 'plain', '--route', 'build,land', '--todo', 'x-1']);
  // The land rules name `todo.js done` themselves; what must be absent is the
  // closing block and a line for this task's id.
  const out = task(dir, ['stage', 'land']);
  assert.doesNotMatch(out, /close at land/);
  assert.doesNotMatch(out, /todo\.js done x-1/);
});

test('the land rule names the todo.js done lines and still runs todo-check', () => {
  const rule = byName('land').rules.find((r) => r.includes('Close the TODO entries'));
  assert.match(rule, /`todo\.js done`/);
  assert.match(rule, /`node \{\{TODO_CHECK\}\}`/);
  assert.match(rule, /only after `record\.js write` prints `filed:`/);
  assert.match(rule, /--record/);
});

test('adopt carries the todo ids to the successor session', () => {
  const dir = root(true);
  const B = 'bbbbbbbb-5555-4555-8555-555555555555';
  task(dir, ['start', '--task', 'close two', '--route', 'build,land', '--todo', 'a', '--todo', 'b']);
  const cfg = path.join(dir, 'cfg');
  execFileSync(process.execPath, [SCRIPT, 'adopt', A, '--session', B, '--root', dir, '--claude-dir', cfg],
    { encoding: 'utf8', cwd: dir, env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
  assert.deepEqual(registry.todosOf(registry.readSession(dir, B)), ['a', 'b']);
});

test('the stage rules say TODO, not TODO.md, where both modes are meant', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'stages.js'), 'utf8');
  assert.doesNotMatch(src, /Read `TODO\.md` at the root|TODO\.md clusters|one TODO\.md entry|<TODO\.md entry|Close the TODO\.md entries/);
});
