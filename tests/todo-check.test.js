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

// Every fixture below carries a heading, because an entry under none of the three
// is now a problem in its own right and would otherwise be reported by each of
// these tests instead of the one thing it is checking.
test('an index whose links all resolve passes', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- Publishing — see [the record](docs/why.md).\n', { 'docs/why.md': '# why\n' });
  const { out, code } = run(file);
  assert.equal(code, 0);
  assert.match(out, /1 entries — 1 ready, 0 needs a decision, 0 waiting/);
  assert.match(out, /All links resolve, none over the cap/);
});

test('a link to a file that no longer exists is a dead entry', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- Publishing — see [the plan](docs/plans/gone.md).\n');
  const { out, code } = run(file);
  assert.equal(code, 1);
  assert.match(out, /dead link/);
  assert.match(out, /docs\/plans\/gone\.md does not exist/);
});

test('the line number points at the entry, not at the file', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- fine\n- [gone](nope.md)\n');
  assert.equal(todo.check(file).problems[0].line, 6);
});

test('an entry longer than the cap is detail, not an index entry', () => {
  const long = 'x'.repeat(todo.MAX_ENTRY_CHARS + 1);
  const file = fixture('# TODO\n\n## Ready\n\n- ' + long + '\n');
  const { out, code } = run(file);
  assert.equal(code, 1);
  assert.match(out, /too long/);
  assert.match(out, new RegExp(todo.MAX_ENTRY_CHARS + 1 + ' characters'));
});

test('an entry exactly at the cap passes', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- ' + 'x'.repeat(todo.MAX_ENTRY_CHARS) + '\n');
  assert.deepEqual(kinds(file), []);
});

test('an indented continuation counts toward the entry it belongs to', () => {
  const half = 'x'.repeat(Math.ceil(todo.MAX_ENTRY_CHARS * 0.6));
  const file = fixture('# TODO\n\n## Ready\n\n- ' + half + '\n  ' + half + '\n');
  assert.deepEqual(kinds(file), ['too long']);
  assert.equal(todo.check(file).count, 1, 'the continuation is not a second entry');
});

test('an external link is not something this can check', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- see [upstream](https://example.com/x) and [mail](mailto:a@b.c)\n');
  assert.deepEqual(kinds(file), []);
});

test('a bare in-page anchor is not a file', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- see [below](#deferred)\n');
  assert.deepEqual(kinds(file), []);
});

test('a fragment on a real path is stripped before the file is checked', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- see [there](docs/why.md#the-heading)\n', { 'docs/why.md': '# why\n' });
  assert.deepEqual(kinds(file), []);
});

test('an entry with no link at all is allowed', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- a one-line thing with nowhere to point\n');
  assert.deepEqual(kinds(file), []);
});

test('headings and prose are not entries', () => {
  const file = fixture('# TODO\n\nAn index. Entries point at where the detail lives.\n\n## Ready\n\n- one\n');
  assert.equal(todo.check(file).count, 1);
});

test('no TODO.md is not a failure', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-todo-'));
  const { out, code } = run(path.join(root, 'TODO.md'));
  assert.equal(code, 0);
  assert.match(out, /Nothing to check/);
});

test('every problem in a file is reported, not just the first', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- [a](one.md)\n- [b](two.md)\n- ' + 'x'.repeat(todo.MAX_ENTRY_CHARS + 1) + '\n');
  assert.deepEqual(kinds(file), ['dead link', 'dead link', 'too long']);
});

test('linksIn keeps only in-repository targets', () => {
  assert.deepEqual(todo.linksIn('[a](docs/a.md) [b](https://x/y) [c](#z) [d](../up.md)'), ['docs/a.md', '../up.md']);
});

// The classification is by decision state, and the heading carries it. An entry
// filed nowhere is one nobody said the state of, which is exactly the entry
// `/fankeel` cannot decide whether to offer as a task.
test('an entry under a heading that is not one of the three is unclassified', () => {
  const file = fixture('# TODO\n\n## Someday\n\n- a thing\n');
  const { out, code } = run(file);
  assert.equal(code, 1);
  assert.match(out, /unclassified/);
  assert.match(out, /under "Someday"/);
});

test('an entry under no heading at all is unclassified', () => {
  const file = fixture('- a thing with no heading above it\n');
  assert.deepEqual(kinds(file), ['unclassified']);
  assert.match(todo.check(file).problems[0].detail, /under no heading/);
});

test('the entry names the three headings it could have sat under', () => {
  const file = fixture('# TODO\n\n## Someday\n\n- a thing\n');
  const detail = todo.check(file).problems[0].detail;
  for (const name of todo.SECTIONS) assert.match(detail, new RegExp('## ' + name));
});

test('all three headings are accepted', () => {
  const body = todo.SECTIONS.map((s) => '## ' + s + '\n\n- one under ' + s + '\n').join('\n');
  const file = fixture('# TODO\n\n' + body);
  assert.deepEqual(kinds(file), []);
  assert.deepEqual(todo.check(file).counts, { Ready: 1, 'Needs a decision': 1, Waiting: 1 });
});

// The split is the reason to run this on a file with nothing wrong with it: a
// backlog of thirty is unreadable as one list, and the ready count is the number
// that says whether there is a task to start.
test('a clean run reports the count under each heading', () => {
  const file = fixture('# TODO\n\n## Ready\n\n- a\n- b\n\n## Needs a decision\n\n- c\n\n## Waiting\n\n- d\n');
  const { out, code } = run(file);
  assert.equal(code, 0);
  assert.match(out, /4 entries — 2 ready, 1 needs a decision, 1 waiting/);
});

test('this project’s own TODO.md is an index', () => {
  const { out, code } = run(path.join(__dirname, '..', 'TODO.md'));
  assert.equal(code, 0, out);
});

// Every other script here takes `--root <dir>`, so this is the form a person
// reaches for and the form a gate gets written with. It used to take the flag's
// value as the file to read: `--root .` handed a directory to `check`, reading
// it threw EISDIR, `check` reported it missing, and missing counted as success.
// A green run that examined nothing.
test('--root names the directory holding TODO.md', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-todo-root-'));
  fs.writeFileSync(path.join(dir, 'TODO.md'), '# TODO\n\n## Ready\n\n- [a](one.md)\n');
  const out = todo.main(['--root', dir]);
  assert.equal(out.ok, false, 'the dead link in that file is a problem');
  assert.match(out.text, /one\.md does not exist/);
});

test('--root=<dir> is the same flag', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-todo-eq-'));
  fs.writeFileSync(path.join(dir, 'TODO.md'), '# TODO\n\n## Ready\n\n- [a](one.md)\n');
  assert.equal(todo.main(['--root=' + dir]).ok, false);
});

test('--root on a directory with no TODO.md names the file it looked for', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-todo-bare-'));
  const out = todo.main(['--root', dir]);
  assert.match(out.text, /TODO\.md/, 'named the directory rather than the file');
  assert.equal(out.ok, true);
});

// A path is still a path. The flag's value is not one.
test('a positional argument is still the file to check', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-todo-pos-'));
  const file = path.join(dir, 'OTHER.md');
  fs.writeFileSync(file, '# TODO\n\n## Ready\n\n- [a](one.md)\n');
  assert.equal(todo.main([file]).ok, false);
});
