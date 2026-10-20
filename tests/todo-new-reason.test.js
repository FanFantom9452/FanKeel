'use strict';

// docs/90-agent/todo/todo-6.md: todo.js new refuses a body whose reason —
// what is left once the migration template and the description are taken
// out — is under 200 characters, writes no file, and says how many it lacks;
// one with enough is filed and todo-check finds no `no reason` in it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { main } = require('../scripts/todo.js');
const check = require('../scripts/todo-check.js');
const tmp = require('./tmp.js');

const NOW = new Date(2026, 9, 21, 12, 0).getTime();
const DESC = 'the line the index shows for this entry, long enough to count';

function root() {
  const dir = tmp('fankeel-todo-new-reason-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs', 'todo'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [
    { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
  return dir;
}
const args = (dir, body) => ['new', '--root', dir, '--label', 'r', '--title', 'reason', '--description', DESC,
  '--state', 'ready', '--body', body];

test('todo.js new refuses a short reason before writing, and says how many characters it lacks', () => {
  const dir = root();
  const r = main(args(dir, DESC + '\n\n' + 'r'.repeat(150)), NOW);
  assert.equal(r.ok, false);
  assert.equal(r.text, 'fankeel todo: --body has 150 characters of reason once the migration template and the description'
    + ' are taken out, at least 200 — 50 short: say why it is still open, the incident, session or sha it came from,'
    + ' and what done looks like');
  assert.deepEqual(fs.readdirSync(path.join(dir, 'docs', 'todo')), [], 'no file was written');
});

test('todo.js new files 200 characters of reason, and todo-check reports nothing on it', () => {
  const dir = root();
  const r = main(args(dir, DESC + '\n\n' + 'r'.repeat(200)), NOW);
  assert.equal(r.ok, true, r.text);
  assert.equal(r.text, 'fankeel todo: docs/todo/r-1.md');
  assert.deepEqual(check.check(path.join(dir, 'TODO.md')).problems.map((p) => p.kind), []);
});
