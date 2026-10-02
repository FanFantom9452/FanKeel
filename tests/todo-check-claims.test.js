'use strict';

// docs-check-1, second step: a body line `count:` or `refs:` states a number
// the tree can recount — "about 23 places", "the only caller" — and
// todo-check recounts it, so a claim that stopped being true fails.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const check = require('../scripts/todo-check.js');
const lib = require('../lib/todo.js');
const tmp = require('./tmp.js');

// An open entry's body is at least 200 characters (lib/todo.js MIN_BODY_CHARS).
const PAD = 'p'.repeat(200);

function project() {
  const dir = tmp('fankeel-todoclaims-');
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  put('.fankeel/docs.json', JSON.stringify({ buckets: [{ path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
  put('docs/a.md', '# a\n');
  put('lib/a.js', 'function helper() {}\nconst x = JSON.parse(fs.readFileSync(f));\n');
  put('lib/b.js', 'helper();\nconst y = JSON.parse(fs.readFileSync(g));\n');
  put('scripts/c.js', 'const z = JSON.parse(fs.readFileSync(h));\n');
  fs.mkdirSync(path.join(dir, 'docs', 'todo'), { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['add', '-A'], { cwd: dir });
  return dir;
}

const entry = (dir, claims) => lib.add(dir, { label: 'c', title: 'claims', description: 'claims', state: 'ready', body: claims + PAD });
const kinds = (dir) => check.check(dir).problems.map((p) => p.file + ' ' + p.kind);

test('refs: and count: lines the tree agrees with pass', () => {
  const dir = project();
  entry(dir, 'refs: 1 `helper`\ncount: 2 `JSON.parse(fs.readFileSync` in `lib/`\ncount: 3 `JSON.parse(fs.readFileSync`\n');
  assert.deepEqual(kinds(dir), []);
});

test('a refs: or count: the tree no longer agrees with fails, naming what it found', () => {
  const dir = project();
  entry(dir, 'refs: 0 `helper`\ncount: 23 `JSON.parse(fs.readFileSync` in `lib/`\n');
  assert.deepEqual(kinds(dir), ['docs/todo/c-1.md stale refs', 'docs/todo/c-1.md stale count']);
  const details = check.check(dir).problems.map((p) => p.detail).join('\n');
  assert.match(details, /`refs: 0 `helper`` — the tree has 1 now\./);
  assert.match(details, /`count: 23 `JSON\.parse\(fs\.readFileSync` in `lib\/`` — the tree has 2 now\./);
});

test('a done entry\'s claims are of the day it closed, and are not recounted', () => {
  const dir = project();
  entry(dir, 'refs: 0 `helper`\n');
  lib.close(dir, 'c-1', { sha: 'abcdef1', at: '2026-10-03' });
  assert.deepEqual(kinds(dir), []);
});
