'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const todo = require('../scripts/todo-check.js');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'todo-check.js');

function fixture(body, extra) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-todo-'));
  fs.writeFileSync(path.join(root, 'TODO.md'), body);
  for (const [name, text] of Object.entries(extra || {})) {
    const full = path.join(root, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  }
  return path.join(root, 'TODO.md');
}

// The script exits non-zero on a problem, so a failing run has to be caught to be
// read. Its own output is what is being asserted, not the exit path.
function run(file) {
  try {
    return { out: execFileSync(process.execPath, [SCRIPT, file], { encoding: 'utf8' }), code: 0 };
  } catch (e) {
    return { out: e.stdout, code: e.status };
  }
}

const kinds = (file) => todo.check(file).problems.map((p) => p.kind);

test('an index whose links all resolve passes', () => {
  const file = fixture('# TODO\n\n- Publishing — see [the record](docs/why.md).\n', { 'docs/why.md': '# why\n' });
  const { out, code } = run(file);
  assert.equal(code, 0);
  assert.match(out, /1 entries, all links resolve, none over the cap/);
});

test('a link to a file that no longer exists is a dead entry', () => {
  const file = fixture('# TODO\n\n- Publishing — see [the plan](docs/plans/gone.md).\n');
  const { out, code } = run(file);
  assert.equal(code, 1);
  assert.match(out, /dead link/);
  assert.match(out, /docs\/plans\/gone\.md does not exist/);
});

test('the line number points at the entry, not at the file', () => {
  const file = fixture('# TODO\n\n## Deferred\n\n- fine\n- [gone](nope.md)\n');
  assert.equal(todo.check(file).problems[0].line, 6);
});

test('an entry longer than the cap is detail, not an index entry', () => {
  const long = 'x'.repeat(todo.MAX_ENTRY_CHARS + 1);
  const file = fixture('# TODO\n\n- ' + long + '\n');
  const { out, code } = run(file);
  assert.equal(code, 1);
  assert.match(out, /too long/);
  assert.match(out, new RegExp(todo.MAX_ENTRY_CHARS + 1 + ' characters'));
});

test('an entry exactly at the cap passes', () => {
  const file = fixture('# TODO\n\n- ' + 'x'.repeat(todo.MAX_ENTRY_CHARS) + '\n');
  assert.deepEqual(kinds(file), []);
});

test('an indented continuation counts toward the entry it belongs to', () => {
  const half = 'x'.repeat(Math.ceil(todo.MAX_ENTRY_CHARS * 0.6));
  const file = fixture('# TODO\n\n- ' + half + '\n  ' + half + '\n');
  assert.deepEqual(kinds(file), ['too long']);
  assert.equal(todo.check(file).count, 1, 'the continuation is not a second entry');
});

test('an external link is not something this can check', () => {
  const file = fixture('# TODO\n\n- see [upstream](https://example.com/x) and [mail](mailto:a@b.c)\n');
  assert.deepEqual(kinds(file), []);
});

test('a bare in-page anchor is not a file', () => {
  const file = fixture('# TODO\n\n- see [below](#deferred)\n');
  assert.deepEqual(kinds(file), []);
});

test('a fragment on a real path is stripped before the file is checked', () => {
  const file = fixture('# TODO\n\n- see [there](docs/why.md#the-heading)\n', { 'docs/why.md': '# why\n' });
  assert.deepEqual(kinds(file), []);
});

test('an entry with no link at all is allowed', () => {
  const file = fixture('# TODO\n\n- a one-line thing with nowhere to point\n');
  assert.deepEqual(kinds(file), []);
});

test('headings and prose are not entries', () => {
  const file = fixture('# TODO\n\nAn index. Entries point at where the detail lives.\n\n## Deferred\n\n- one\n');
  assert.equal(todo.check(file).count, 1);
});

test('no TODO.md is not a failure', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-todo-'));
  const { out, code } = run(path.join(root, 'TODO.md'));
  assert.equal(code, 0);
  assert.match(out, /Nothing to check/);
});

test('every problem in a file is reported, not just the first', () => {
  const file = fixture('# TODO\n\n- [a](one.md)\n- [b](two.md)\n- ' + 'x'.repeat(todo.MAX_ENTRY_CHARS + 1) + '\n');
  assert.deepEqual(kinds(file), ['dead link', 'dead link', 'too long']);
});

test('linksIn keeps only in-repository targets', () => {
  assert.deepEqual(todo.linksIn('[a](docs/a.md) [b](https://x/y) [c](#z) [d](../up.md)'), ['docs/a.md', '../up.md']);
});

test('this project’s own TODO.md is an index', () => {
  const { out, code } = run(path.join(__dirname, '..', 'TODO.md'));
  assert.equal(code, 0, out);
});
