'use strict';

// --migrate reports what it could not read or date (docs/90-agent/todo/todo-2.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const lib = require('../lib/todo.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'todo.js');

function project() {
  const dir = tmp('fankeel-migrate-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [
    { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
  fs.writeFileSync(path.join(dir, 'TODO.md'), '# TODO\n');
  return dir;
}

test('a completions page that cannot be read stops migrate and says which page', () => {
  const dir = project();
  fs.mkdirSync(path.join(dir, lib.COMPLETIONS_PAGE), { recursive: true });
  assert.throws(() => lib.migrate(dir, Date.parse('2026-09-29T00:00:00Z')), (e) => e.message.includes(lib.COMPLETIONS_PAGE));
});

test('a completions record whose commit cannot be dated is reported, and dated today', () => {
  const dir = project();
  const page = path.join(dir, lib.COMPLETIONS_PAGE);
  fs.mkdirSync(path.dirname(page), { recursive: true });
  fs.writeFileSync(page, '- original: shipped the thing\n  disposition: done\n  sha: abcdef1\n');
  const r = lib.migrate(dir, Date.parse('2026-09-29T00:00:00Z'));
  assert.equal(r.done, 1);
  assert.equal(r.warned.length, 1);
  assert.equal(r.warned[0].sha, 'abcdef1');
  assert.ok(r.warned[0].why.length > 0);
  assert.equal(lib.load(dir, Date.parse('2026-09-29T00:00:00Z')).done[0].at, '2026-09-29');
});

test('todo.js migrate prints a line for each record it could not date', () => {
  const dir = project();
  const page = path.join(dir, lib.COMPLETIONS_PAGE);
  fs.mkdirSync(path.dirname(page), { recursive: true });
  fs.writeFileSync(page, '- original: shipped the thing\n  disposition: done\n  sha: abcdef1\n');
  const out = execFileSync(process.execPath, [SCRIPT, 'migrate', '--root', dir], { encoding: 'utf8', cwd: dir });
  assert.match(out, /could not date abcdef1/);
});
