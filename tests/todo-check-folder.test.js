'use strict';

// todo-check, blame and orient in folder mode
// (docs/99-archive/2026-09-29-todo-files-design.md §3).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const check = require('../scripts/todo-check.js');
const lib = require('../lib/todo.js');
const blame = require('../lib/blame.js');
const tmp = require('./tmp.js');

const ORIENT = path.join(__dirname, '..', 'scripts', 'orient.js');

function root() {
  const dir = tmp('fankeel-todofolder-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs', 'todo'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'a.md'), '# a\n');
  fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [
    { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
  return dir;
}
const git = (dir, args, when) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
  cwd: dir, stdio: 'ignore',
  env: Object.assign({}, process.env, when ? { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when } : {}),
});
const problems = (dir) => check.check(path.join(dir, 'TODO.md')).problems;
const kinds = (dir) => problems(dir).map((p) => p.kind);

test('a TODO.md that is what index writes is clean; a hand edit is a stale index', () => {
  const dir = root();
  lib.add(dir, { label: 'a', title: 'one', description: 'first — [a.md](docs/a.md).', state: 'ready' });
  assert.deepEqual(kinds(dir), []);
  fs.appendFileSync(path.join(dir, 'TODO.md'), '- a hand line\n');
  assert.deepEqual(kinds(dir), ['stale index']);
  lib.writeIndex(dir);
  assert.deepEqual(kinds(dir), []);
});

test('frontmatter rules land on the entry file', () => {
  const dir = root();
  const put = (id, fields) => fs.writeFileSync(path.join(dir, 'docs', 'todo', id + '.md'), lib.serialize(Object.assign(
    { label: '', title: 't', description: 'd', state: 'ready', link: '', group: '', timing: '', stamp: '', done: null, body: '' },
    fields)));
  put('wide-1', { title: '這是一個超過二十八欄寬的標題文字啊啊' });
  put('odd-1', { state: 'someday' });
  put('wait-1', { state: 'blocked', group: 'g', timing: 'after: x' });
  put('shut-1', { state: 'done', done: { at: '2026-09-29', sha: 'nope', disposition: 'done', session: '' } });
  put('Bad_Id', {});
  lib.writeIndex(dir);
  const got = problems(dir).map((p) => (p.file || '') + ' ' + p.kind);
  for (const want of ['docs/todo/wide-1.md long title', 'docs/todo/odd-1.md bad state', 'docs/todo/wait-1.md undated',
    'docs/todo/shut-1.md bad done', 'docs/todo/Bad_Id.md bad id']) {
    assert.ok(got.includes(want), want + ' not in ' + JSON.stringify(got));
  }
  const text = check.report(check.check(path.join(dir, 'TODO.md')));
  assert.match(text, /docs\/todo\/wide-1\.md:1 {2}long title/);
});

test('a committed entry file that is gone is a deleted entry', () => {
  const dir = root();
  lib.add(dir, { label: 'a', title: 'one', description: 'first', state: 'ready' });
  git(dir, ['init', '-q']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'x']);
  fs.unlinkSync(path.join(dir, 'docs', 'todo', 'a-1.md'));
  lib.writeIndex(dir);
  assert.deepEqual(kinds(dir), ['deleted entry']);
});

test('in folder mode Needs a decision is ordered by each file\'s last commit', () => {
  const dir = root();
  lib.add(dir, { label: 'a', title: 'old', description: 'old one', state: 'decision' });
  lib.add(dir, { label: 'a', title: 'new', description: 'new one', state: 'decision' });
  git(dir, ['init', '-q']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'x'], '2026-01-01T00:00:00Z');
  const f = path.join(dir, 'docs', 'todo', 'a-1.md');
  // The body is not in the index, so blame of TODO.md sees no edit to a-1.
  fs.appendFileSync(f, '\nmore detail\n');
  assert.equal(blame.fileTime(dir, 'docs/todo/a-1.md'), Infinity);
  lib.writeIndex(dir);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'y'], '2026-01-05T00:00:00Z');
  const needs = lib.load(dir).entries.filter((e) => e.section === 'Needs a decision');
  assert.deepEqual(blame.orderByEdit(dir, 'TODO.md', needs).map((e) => e.id), ['a-1', 'a-2']);
  assert.equal(blame.fileTime(dir, 'docs/todo/a-2.md'), Date.parse('2026-01-01T00:00:00Z'));
});

test('orient\'s todo: block in folder mode names the folder and every id it offers', () => {
  const dir = root();
  lib.add(dir, { label: 'r', title: 'ready', description: 'ready one', state: 'ready' });
  lib.add(dir, { label: 'q', title: 'question', description: 'a question', state: 'decision' });
  // A repository, so orient reads dir as the one project rather than docs/ inside it.
  git(dir, ['init', '-q']);
  const out = execFileSync(process.execPath, [ORIENT, '--root', dir], { encoding: 'utf8', cwd: dir });
  assert.match(out, /^todo: TODO\.md, from docs\/todo\/$/m);
  assert.match(out, /^ {2}Ready 1 — ids: r-1$/m);
  assert.match(out, /^ {4}\[q-1\] 〔q〕a question$/m);
  assert.match(out, /--todo <id>/);
});

test('trackedIn: no repository and no commit yet are nothing tracked, a broken repository throws', () => {
  const plain = tmp('fankeel-tracked-');
  assert.deepEqual(check.trackedIn(plain, 'docs/todo'), []);
  const fresh = tmp('fankeel-tracked-');
  git(fresh, ['init', '-q']);
  assert.deepEqual(check.trackedIn(fresh, 'docs/todo'), []);
  const dir = root();
  lib.add(dir, { label: 'a', title: 'one', description: 'first', state: 'ready' });
  git(dir, ['init', '-q']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'x']);
  for (const d of fs.readdirSync(path.join(dir, '.git', 'objects'))) {
    if (/^[0-9a-f]{2}$/.test(d)) fs.rmSync(path.join(dir, '.git', 'objects', d), { recursive: true, force: true });
  }
  assert.throws(() => check.trackedIn(dir, 'docs/todo'), /git ls-tree failed/);
  assert.ok(check.check(path.join(dir, 'TODO.md')).problems.some((p) => p.kind === 'unchecked'));
});

test('an entry folder that cannot be read is an unreadable folder problem, not a crash', () => {
  const dir = root();
  fs.mkdirSync(path.join(dir, 'docs', 'todo', 'broken.md'));
  const r = check.check(path.join(dir, 'TODO.md'));
  assert.ok(r.problems.some((p) => p.kind === 'unreadable folder'), JSON.stringify(r.problems));
});

test('trackedIn asks git in the C locale, so its nothing-tracked match cannot be translated away', () => {
  const bin = tmp('fankeel-fakegit-');
  fs.copyFileSync(process.execPath, path.join(bin, process.platform === 'win32' ? 'git.exe' : 'git'));
  const stub = path.join(bin, 'stub.js');
  const marker = path.join(bin, 'ran.txt');
  fs.writeFileSync(stub, [
    "require('node:fs').appendFileSync(" + JSON.stringify(marker) + ", 'ran\\n');",
    "process.stderr.write(process.env.LC_ALL === 'C' ? 'fatal: not a git repository\\n' : 'fatal: pas un depot git\\n');",
    'process.exit(128);',
  ].join('\n'));
  const keep = { PATH: process.env.PATH, NODE_OPTIONS: process.env.NODE_OPTIONS, LC_ALL: process.env.LC_ALL };
  try {
    process.env.PATH = bin + path.delimiter + keep.PATH;
    process.env.NODE_OPTIONS = '--require "' + stub.replace(/\\/g, '/') + '"';
    process.env.LC_ALL = 'fr_FR.UTF-8';
    assert.deepEqual(check.trackedIn(tmp('fankeel-tracked-'), 'docs/todo'), []);
    assert.ok(fs.existsSync(marker), 'the stub never ran, so the locale was never seen');
  } finally {
    for (const k of Object.keys(keep)) {
      if (keep[k] === undefined) delete process.env[k]; else process.env[k] = keep[k];
    }
  }
});

test('trackedIn lists only .md files under the folder', () => {
  const dir = root();
  lib.add(dir, { label: 'a', title: 'one', description: 'first', state: 'ready' });
  fs.writeFileSync(path.join(dir, 'docs', 'todo', 'notes.txt'), 'x\n');
  git(dir, ['init', '-q']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'x']);
  assert.deepEqual(check.trackedIn(dir, 'docs/todo'), ['docs/todo/a-1.md']);
});

test('trackedIn: a deleted tracked entry is still listed and reported as a deleted entry problem', () => {
  const dir = root();
  lib.add(dir, { label: 'a', title: 'one', description: 'first', state: 'ready' });
  git(dir, ['init', '-q']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'x']);
  fs.rmSync(path.join(dir, 'docs', 'todo', 'a-1.md'));
  assert.deepEqual(check.trackedIn(dir, 'docs/todo'), ['docs/todo/a-1.md']);
  assert.ok(check.check(path.join(dir, 'TODO.md')).problems.some((p) => p.kind === 'deleted entry'));
});