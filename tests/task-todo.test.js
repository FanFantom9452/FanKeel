'use strict';

// start --todo, and the land step that closes what it named
// (docs/90-agent/plans/2026-09-29-todo-files-design.md §4).
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
  assert.match(out, /^ {2}todo: a-1, a-2$/m);
  task(dir, ['task', 'something else']);
  assert.deepEqual(registry.todosOf(registry.readSession(dir, A)), [], 'a new task names no entry');
});

test('stage land prints the todo.js done line for each id where the project keeps entry files', () => {
  const dir = root(true);
  lib.add(dir, { label: 'a', title: 'one', description: 'first', state: 'ready' });
  task(dir, ['start', '--task', 'close one', '--route', 'build,land', '--todo', 'a-1']);
  const out = task(dir, ['stage', 'land']);
  assert.match(out, new RegExp('todo\\.js done a-1 --sha <sha> --session ' + A));
});

test('with no entry folder stage land prints no todo.js line', () => {
  const dir = root(false);
  task(dir, ['start', '--task', 'plain', '--route', 'build,land', '--todo', 'x-1']);
  assert.doesNotMatch(task(dir, ['stage', 'land']), /todo\.js done/);
});

test('the land rule names the todo.js done lines and still runs todo-check', () => {
  const rule = byName('land').rules.find((r) => r.includes('TODO.md entries'));
  assert.match(rule, /`todo\.js done`/);
  assert.match(rule, /`node \{\{TODO_CHECK\}\}`/);
});
