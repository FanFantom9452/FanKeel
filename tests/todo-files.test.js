'use strict';

// TODO entries as files (docs/99-archive/2026-09-29-todo-files-design.md):
// the entry-file format, todo.js as the one writer, and load() giving the
// folder the same shapes a hand-written TODO.md gives.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const lib = require('../lib/todo.js');
const { main } = require('../scripts/todo.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'todo.js');
const NOW = new Date(2026, 8, 25, 12, 0).getTime();

const TODO = [
  '# TODO', '', 'A hand-written index.', '',
  '## Ready', '', '- 〔alpha〕Do the thing — [a.md](docs/a.md).', '',
  '## Needs a decision', '', '- 〔beta〕Decide that — [a.md](docs/a.md).', '',
  '## Blocked', '', '### Waits for release', 'upstream: lib 2.0. 09-20.', '',
  '- 〔gamma〕After release — [a.md](docs/a.md).', '- 〔gamma〕Second one — [a.md](docs/a.md).', '',
  '## Watch', '', '### If it recurs', 'if: it happens again. 09-21.', '',
  '- no label here — [a.md](docs/a.md).', '',
].join('\n');

const COMPLETIONS = [
  '# TODO completions', '', '```',
  '- original: 〔delta〕Closed last week — [a.md](docs/a.md).', '  disposition: done',
  '  sha: 0123456789abcdef0123456789abcdef01234567', '',
  '- original: <the entry\'s text, verbatim>', '  disposition: done | measured-no-change | abandoned',
  '  sha: <the commit that closed it>', '```', '',
].join('\n');

function project(withBucket) {
  const dir = tmp('fankeel-todofiles-');
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  put('TODO.md', TODO);
  put('docs/a.md', '# a\n');
  put(lib.COMPLETIONS_PAGE, COMPLETIONS);
  const buckets = [{ path: 'docs', role: 'reference', depth: 1 }];
  if (withBucket) buckets.push({ path: 'docs/todo', role: 'todo' });
  put('.fankeel/docs.json', JSON.stringify({ buckets }));
  return dir;
}

const shape = (loaded) => ({
  entries: loaded.entries.map((e) => ({ section: e.section, text: e.text })),
  timings: loaded.timings.map((t) => ({ section: t.section, title: t.title, kind: t.kind, event: t.event,
    stamp: t.stamp, items: t.items.length })),
});

test('an entry file round-trips through serialize and parse', () => {
  const e = { label: 'x', title: 'A title', description: 'a line with `code` — [a.md](docs/a.md).', state: 'blocked',
    link: 'docs/a.md', group: 'Waits', timing: 'after: y', stamp: '2026-09-20',
    done: { at: '2026-09-29', sha: 'abcdef1', disposition: 'done', session: 's-1' }, body: 'Background.\n\nTried z.' };
  assert.deepEqual(lib.parse(lib.serialize(e)), e);
  const bare = { label: '', title: 't', description: 'd', state: 'ready', link: '', group: '', timing: '', stamp: '',
    done: null, body: '' };
  assert.deepEqual(lib.parse(lib.serialize(bare)), bare);
  assert.ok(lib.ID.test('stage-agents-12') && !lib.ID.test('Stage_1'));
  assert.ok(lib.ISO.test('2026-09-29') && lib.STATES.includes('done'));
  assert.equal(lib.isoDay(NOW), '2026-09-25');
});

test('migrate turns TODO.md and the completions page into entry files, and load() reads both in one shape', () => {
  const file = project(false);
  const folder = project(true);
  const before = lib.load(file, NOW);
  assert.equal(before.mode, 'file');
  assert.equal(lib.folderOf(file), null);
  const r = lib.migrate(folder, NOW);
  assert.deepEqual([r.open, r.done, r.left.length], [5, 1, 0]);
  assert.equal(fs.existsSync(path.join(folder, 'TODO.md')), false, 'migrate removed TODO.md');
  const alpha = lib.readFolder(folder, 'docs/todo').find((e) => e.id === 'alpha-1');
  assert.match(alpha.body, /^〔alpha〕Do the thing — \[a\.md\]\(docs\/a\.md\)\.\n\n從 TODO\.md 遷移，2026-09-25，/);
  const delta = lib.readFolder(folder, 'docs/todo').find((e) => e.id === 'delta-1');
  assert.match(delta.body, /^〔delta〕Closed last week — \[a\.md\]\(docs\/a\.md\)\.\n\n從 TODO\.md 遷移，/);
  const after = lib.load(folder, NOW);
  assert.equal(after.mode, 'folder');
  assert.equal(lib.folderOf(folder), 'docs/todo');
  assert.deepEqual(shape(after), shape(before));
  assert.deepEqual(after.entries.map((e) => e.id), ['alpha-1', 'beta-1', 'gamma-1', 'gamma-2', 'entry-1']);
  assert.deepEqual(after.done.map((d) => [d.id, d.sha, d.disposition]),
    [['delta-1', '0123456789abcdef0123456789abcdef01234567', 'done']]);
  const gamma = lib.readFolder(folder, 'docs/todo').find((e) => e.id === 'gamma-2');
  assert.deepEqual([gamma.group, gamma.timing, gamma.stamp], ['Waits for release', 'upstream: lib 2.0', '2026-09-20']);
  assert.equal(lib.render(folder, lib.readFolder(folder, 'docs/todo'), 'docs/todo').text, after.text);
  assert.throws(() => lib.migrate(folder, NOW), /runs once/);
});

const BODY = 'From session 9a6a429a on 2026-10-02: the generated index was read by nobody and drifted from the files. '
  + 'It should become one entry file per deferred thing, with a body like this one saying why it exists. '
  + 'Done when todo-check passes with no TODO.md at the root of the project.';

test('new and done write entry files and no TODO.md; new refuses a missing or short --body', () => {
  const dir = project(true);
  lib.migrate(dir, NOW);
  assert.equal(fs.existsSync(path.join(dir, 'TODO.md')), false, 'migrate removed TODO.md');
  const args = ['new', '--root', dir, '--label', 'eps', '--title', 'New one', '--description', 'a new entry', '--state', 'ready'];
  const bare = main(args, NOW);
  assert.equal(bare.ok, false);
  assert.match(bare.text, /--body <text> is required/);
  const short = main(args.concat(['--body', 'x'.repeat(199)]), NOW);
  assert.equal(short.ok, false);
  assert.match(short.text, /199 characters, at least 200/);
  const made = main(args.concat(['--body', BODY]), NOW);
  assert.equal(made.ok, true, made.text);
  assert.equal(fs.existsSync(path.join(dir, 'TODO.md')), false, 'add wrote no TODO.md');
  assert.equal(lib.readFolder(dir, 'docs/todo').find((e) => e.id === 'eps-1').body, BODY);

  const shut = main(['done', 'eps-1', '--root', dir, '--sha', 'abcdef1', '--session', 'sess-1'], NOW);
  assert.equal(shut.ok, true, shut.text);
  assert.equal(fs.existsSync(path.join(dir, 'TODO.md')), false, 'close wrote no TODO.md');
  const done = lib.load(dir, NOW).done.find((d) => d.id === 'eps-1');
  assert.deepEqual([done.sha, done.session, done.disposition, done.at], ['abcdef1', 'sess-1', 'done', '2026-09-25']);
  assert.equal(main(['done', 'eps-1', '--root', dir, '--sha', 'abcdef1'], NOW).ok, false, 'closed once, not twice');
  assert.equal(main(['done', 'alpha-1', '--root', dir], NOW).ok, false, 'no sha, no close');
  assert.equal(main(['index', '--root', dir], NOW).ok, false, 'index is gone');
});

test('todo.js list prints one line per open entry and the total last', () => {
  const dir = project(true);
  lib.migrate(dir, NOW);
  const r = main(['list', '--root', dir], NOW);
  assert.equal(r.ok, true, r.text);
  const lines = r.text.split('\n');
  assert.equal(lines[lines.length - 1], '5 open');
  assert.ok(lines.includes('ready alpha-1 — Do the thing'), r.text);
  assert.ok(!r.text.includes('delta-1'), 'a done entry is not listed');
  assert.equal(main(['list', '--root', project(false)], NOW).ok, false, 'no folder, nothing to list');
});

test('fromLine and add make an entry out of one TODO.md-style line', () => {
  const dir = project(true);
  fs.mkdirSync(path.join(dir, 'docs', 'todo'));
  const f = lib.fromLine('  〔station〕a  question：with detail ', 'docs/a.md', 'decision');
  assert.deepEqual(f, { label: 'station', title: 'a question', description: 'a question：with detail',
    state: 'decision', link: 'docs/a.md' });
  const made = lib.add(dir, f);
  assert.deepEqual([made.id, made.file], ['station-1', 'docs/todo/station-1.md']);
  assert.equal(fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8'), TODO, 'add left the hand-written TODO.md alone');
  assert.match(lib.load(dir, NOW).text, /^- 〔station〕a question：with detail — \[a\.md\]\(docs\/a\.md\)\.$/m);
  const shut = lib.close(dir, 'station-1', { sha: 'abcdef1', at: '2026-09-29' });
  assert.equal(shut.file, 'docs/todo/station-1.md');
  assert.throws(() => lib.add(dir, Object.assign({}, f, { id: 'station-1' })), /never reused/);
});

test('ids collate numerically: x-2 before x-10 in readFolder, x-10 before x-2 in done', () => {
  const dir = project(true);
  fs.mkdirSync(path.join(dir, 'docs', 'todo'));
  for (const id of ['x-10', 'x-2']) {
    const e = { label: 'x', title: id, description: id, state: 'done', link: '', group: '', timing: '', stamp: '',
      done: { at: '2026-09-29', sha: 'abcdef1', disposition: 'done', session: '' }, body: '' };
    fs.writeFileSync(path.join(dir, 'docs', 'todo', id + '.md'), lib.serialize(e));
  }
  assert.deepEqual(lib.readFolder(dir, 'docs/todo').map((e) => e.id), ['x-2', 'x-10']);
  assert.deepEqual(lib.load(dir, NOW).done.map((d) => d.id), ['x-10', 'x-2']);
});

test('this repository keeps entry files and no TODO.md', () => {
  const root = path.join(__dirname, '..');
  const loaded = lib.load(root);
  assert.equal(loaded.mode, 'folder');
  assert.equal(loaded.folder, 'docs/90-agent/todo');
  assert.equal(fs.existsSync(path.join(root, 'TODO.md')), false);
});

test('readFolder: a missing folder is empty, but a path that is not a folder throws', () => {
  const dir = tmp('fankeel-readfolder-');
  assert.deepEqual(lib.readFolder(dir, 'docs/todo'), []);
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'todo'), 'a file where the folder should be\n');
  assert.throws(() => lib.readFolder(dir, 'docs/todo'), (e) => e.code !== 'ENOENT');
});

test('add does not write an entry into a folder it could not read', () => {
  const dir = project(true);
  fs.mkdirSync(path.join(dir, 'docs', 'todo'), { recursive: true });
  const real = fs.readdirSync;
  const denied = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
  fs.readdirSync = (p, ...rest) => {
    if (path.resolve(String(p)) === path.join(dir, 'docs', 'todo')) throw denied;
    return real.call(fs, p, ...rest);
  };
  try {
    assert.throws(() => lib.add(dir, { label: 'a', description: 'd', state: 'ready' }), (e) => e === denied);
  } finally {
    fs.readdirSync = real;
  }
  assert.deepEqual(real.call(fs, path.join(dir, 'docs', 'todo')), []);
});

test('bodyChars folds whitespace and counts a CJK character once', () => {
  assert.equal(lib.MIN_BODY_CHARS, 200);
  assert.equal(lib.bodyChars('  a \n\n b  '), 3);
  assert.equal(lib.bodyChars('從哪來'), 3);
  assert.equal(lib.bodyChars(''), 0);
});

test('load: a TODO.md that cannot be read throws, and only a missing one is "no TODO"', () => {
  const dir = tmp('fankeel-loadfile-');
  assert.equal(lib.load(dir), null);
  fs.mkdirSync(path.join(dir, 'TODO.md'));
  assert.throws(() => lib.load(dir), (e) => e.code === 'EISDIR');
});

// docs-check-1: an open entry is checked as a reference page is when it is
// filed; a path that is gone refuses it and leaves no file behind.
test('new refuses an entry naming a path the tree does not have, and leaves no file', () => {
  const dir = project(true);
  lib.migrate(dir, NOW);
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'lib', 'here.js'), 'function here() {}\n');
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['add', '-A'], { cwd: dir });
  const base = ['new', '--root', dir, '--label', 'eps', '--state', 'ready', '--body', BODY];
  const out = main(base.concat(['--title', 'Gone path', '--description', 'names `lib/gone.js`']), NOW);
  assert.equal(out.ok, false, out.text);
  assert.match(out.text, /^fankeel todo: not filed/);
  assert.match(out.text, /gone: names lib\/gone\.js/);
  assert.equal(fs.existsSync(path.join(dir, 'docs', 'todo', 'eps-1.md')), false, 'the refused entry is not left on disk');
  const ok = main(base.concat(['--title', 'Here path', '--description', 'names `lib/here.js`']), NOW);
  assert.equal(ok.ok, true, ok.text);
});

test('close with a record appends 完成紀錄 with every commit, and recordOf reads it back', () => {
  const dir = project(true);
  fs.mkdirSync(path.join(dir, 'docs', 'todo'));
  const made = lib.add(dir, { label: 'x', title: 'a thing', description: 'a thing', state: 'ready', link: 'docs/a.md' });
  lib.close(dir, made.id, { sha: 'abcdef1', at: '2026-10-05', record: '刪掉了重複的讀檔函式。', commits: ['abcdef1', '1234abc'] });
  const text = fs.readFileSync(path.join(dir, made.file), 'utf8');
  assert.match(text, /\n## 完成紀錄\n\n刪掉了重複的讀檔函式。\n\n- commit abcdef1\n- commit 1234abc\n$/);
  assert.equal(lib.recordOf(lib.parse(text).body), '刪掉了重複的讀檔函式。\n\n- commit abcdef1\n- commit 1234abc');
  assert.equal(lib.recordOf('no record here'), '');
});

test('close with a record and no commits lists the sha alone', () => {
  const dir = project(true);
  fs.mkdirSync(path.join(dir, 'docs', 'todo'));
  const made = lib.add(dir, { label: 'x', title: 'b thing', description: 'b thing', state: 'ready', link: 'docs/a.md' });
  lib.close(dir, made.id, { sha: 'abcdef1', at: '2026-10-05', record: '做完了。' });
  assert.match(fs.readFileSync(path.join(dir, made.file), 'utf8'), /\n- commit abcdef1\n$/);
});
