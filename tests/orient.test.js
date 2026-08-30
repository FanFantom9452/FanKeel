'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const orient = require('../scripts/orient.js');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'orient.js');

// A workspace is built rather than pointed at, because the interesting cases are
// the ones a real directory does not happen to have: a project that is not a
// repository next to one that is, and a root that is neither.
function workspace(tree) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-orient-'));
  for (const [rel, body] of Object.entries(tree)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return root;
}

const run = (args, cwd) =>
  execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', cwd: cwd || process.cwd() });

test('parseArgs consumes the value after --root instead of leaving it as a path', () => {
  const { root, named } = orient.parseArgs(['--root', '/tmp/x', 'Waypoint']);
  assert.equal(root, '/tmp/x');
  assert.deepEqual(named, ['Waypoint']);
});

test('parseArgs drops unknown flags and de-duplicates named paths', () => {
  const { named } = orient.parseArgs(['--quiet', 'a', 'a', 'b']);
  assert.deepEqual(named, ['a', 'b']);
});

// `--root=x` is the same flag. Every other script here spelt its own parser and
// only `todo-check.js` ever accepted the equals form, so the ten disagreed with
// each other about a form every CLI takes.
test('parseArgs reads --root=<dir> as the same flag', () => {
  const { root, named } = orient.parseArgs(['--root=/tmp/x', 'Waypoint']);
  assert.equal(root, '/tmp/x');
  assert.deepEqual(named, ['Waypoint']);
});

test('parseArgs defaults the root to the working directory', () => {
  assert.equal(orient.parseArgs([]).root, process.cwd());
});

test('a directory of projects lists each one, not the files under it', () => {
  const root = workspace({
    'alpha/a.js': 'x',
    'alpha/b.js': 'x',
    'beta/c.py': 'x',
  });
  const out = run(['--root', root]);
  assert.match(out, /2 under it:/);
  assert.match(out, /alpha\s+no git\s+2 files/);
  assert.match(out, /beta\s+no git\s+1 file/);
  // The failure this replaces: a survey with no terms, which reports every
  // declaration in the tree and is unreadable at workspace scale.
  assert.doesNotMatch(out, /declarations:/);
});

test('build output and dependencies are not projects', () => {
  const root = workspace({
    'alpha/a.js': 'x',
    'node_modules/pkg/index.js': 'x',
    'dist/bundle.js': 'x',
    '.hidden/thing.js': 'x',
  });
  const out = run(['--root', root]);
  assert.match(out, /1 under it:/);
  assert.match(out, /alpha/);
  assert.doesNotMatch(out, /node_modules/);
  assert.doesNotMatch(out, /dist/);
  assert.doesNotMatch(out, /hidden/);
});

test('a named path wins over listing the workspace', () => {
  const root = workspace({
    'alpha/a.js': 'x',
    'beta/b.js': 'x',
  });
  const out = run(['--root', root, 'beta']);
  assert.match(out, /named:/);
  assert.match(out, /beta/);
  assert.doesNotMatch(out, /alpha/);
});

test('a named path that is not there is reported, not silently dropped', () => {
  const root = workspace({ 'alpha/a.js': 'x' });
  const out = run(['--root', root, 'nope']);
  assert.match(out, /not found: nope/);
});

// The cap sat in front of `existsSync`, so a target past the fortieth was
// neither listed nor found: it went into a count and nothing else. The test
// above makes its claim inside the cap only, which is where a silent loss goes
// unnoticed for as long as nobody names forty-one things.
const many = (n) => {
  const tree = {};
  for (let i = 0; i < n; i++) tree['p' + String(i).padStart(2, '0') + '/a.js'] = 'x';
  return tree;
};

test('a named path that is not there is reported past the cap too', () => {
  const tree = many(40);
  const root = workspace(tree);
  const out = run(['--root', root, ...Object.keys(tree).map((f) => f.slice(0, 3)), 'nope']);
  assert.match(out, /not found: nope/);
});

// Capping after the split is also what makes this sentence true: it counts what
// was cut from the table it sits under, so it can be the one `lib/report.js`
// prints for every other capped list rather than a fifth spelling of it.
test('the cut targets are said in the same sentence as every other capped list', () => {
  const out = run(['--root', workspace(many(41))]);
  assert.match(out, /^ {2}\.\.\. and 1 more, not listed$/m);
  assert.doesNotMatch(out, /\(1 more not listed\)/);
});

test('a single target is broken down one level, so the task can be named from what is in it', () => {
  const root = workspace({
    'alpha/web/src/a.js': 'x',
    'alpha/web/src/b.js': 'x',
    'alpha/api/app/c.py': 'x',
  });
  const out = run(['--root', root, 'alpha']);
  assert.match(out, /inside it:/);
  assert.match(out, /alpha\/web\/\s+2 files/);
  assert.match(out, /alpha\/api\/\s+1 file/);
});

test('loose top-level files collapse into a count instead of taking a row each', () => {
  const root = workspace({
    'alpha/web/a.js': 'x',
    'alpha/README.md': 'x',
    'alpha/package.json': 'x',
    'alpha/LICENSE': 'x',
  });
  const out = run(['--root', root, 'alpha']);
  assert.match(out, /alpha[/]web[/]\s+1 file/);
  assert.match(out, /[(]and 3 files loose at the top[)]/);
  assert.doesNotMatch(out, /README[.]md\s+1 file/);
});

test('a workspace is not broken down, because two targets would be a wall', () => {
  const root = workspace({
    'alpha/web/a.js': 'x',
    'beta/api/b.py': 'x',
  });
  const out = run(['--root', root]);
  assert.doesNotMatch(out, /inside it:/);
});

test('a root that is itself one project reports as one project', () => {
  const root = workspace({ 'web/a.js': 'x', 'api/b.py': 'x' });
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  const out = run(['--root', root]);
  assert.match(out, /one project:/);
  assert.doesNotMatch(out, /under it:/);
});

test('the registry is named when it is somewhere else, and says what its paths are relative to', () => {
  const root = workspace({ 'alpha/a.js': 'x' });
  const inner = path.join(root, 'alpha');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  const out = run(['--root', inner]);
  assert.match(out, /registry: /);
  assert.match(out, /relative to that directory, not this one/);
});

test('no registry anywhere says where one would be created', () => {
  const root = workspace({ 'alpha/a.js': 'x' });
  const out = run(['--root', root]);
  assert.match(out, /registry: none at or above here/);
  assert.match(out, new RegExp('creates one at'));
});

test('active entries are counted, and only the active ones', () => {
  const root = workspace({ 'alpha/a.js': 'x' });
  const sessions = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(sessions, { recursive: true });
  const live = { task: 'live', scope: [], stage: 'build', active: true };
  const done = { task: 'done', scope: [], stage: 'land', active: false };
  fs.writeFileSync(path.join(sessions, 'aaaaaaaa-1111-2222-3333-444444444444.json'), JSON.stringify(live));
  fs.writeFileSync(path.join(sessions, 'bbbbbbbb-1111-2222-3333-444444444444.json'), JSON.stringify(done));
  const out = run(['--root', root]);
  assert.match(out, /registry: here, 1 active/);
});

test('ageText reads in the unit the number deserves', () => {
  const now = Date.parse('2026-08-21T12:00:00Z');
  const day = 86400e3;
  assert.equal(orient.ageText(now - 3600e3, now), 'today');
  assert.equal(orient.ageText(now - day, now), 'yesterday');
  assert.equal(orient.ageText(now - 3 * day, now), '3d ago');
  assert.equal(orient.ageText(now - 40 * day, now), '1mo ago');
  assert.equal(orient.ageText(now - 400 * day, now), '1y ago');
  assert.equal(orient.ageText(null, now), '');
});

test('a project with no commit date sorts last rather than first', () => {
  const root = workspace({ 'alpha/a.js': 'x', 'beta/b.js': 'x' });
  const result = orient.scan(root, []);
  // Neither is a repository, so both are null and the tie falls back to the name.
  assert.deepEqual(result.entries.map((e) => e.rel), ['alpha', 'beta']);
});

test('a repository with no commits is a repository, not "no git"', () => {
  const root = workspace({ 'solo/a.js': 'x' });
  execFileSync('git', ['init', '-q'], { cwd: path.join(root, 'solo'), stdio: 'ignore' });

  // `rev-parse --abbrev-ref HEAD` fails on an unborn branch, and reading that
  // failure as "not a repository" is the wrong half: the directory has a .git,
  // it just has nothing in it yet. That is the first commit anyone is about to
  // make, so it is exactly when orient gets run.
  const out = run(['--root', root]);
  const line = out.split(/\r?\n/).find((l) => l.trim().startsWith('solo'));
  assert.ok(line, 'no solo row in: ' + out);
  assert.doesNotMatch(line, /no git/);
  assert.ok(line.includes('git '), 'reported: ' + line);
});

test('stateText says clean rather than saying nothing', () => {
  assert.equal(orient.stateText({ branch: 'main', changed: 0, untracked: 0 }), 'git main, clean');
  assert.equal(orient.stateText({ branch: 'x', changed: 2, untracked: 1 }), 'git x, 2 uncommitted, 1 untracked');
  assert.equal(orient.stateText(null), 'no git');
});

test('topLevel counts by first segment and marks directories with a slash', () => {
  const rows = orient.topLevel(['web/a.js', 'web/b.js', 'README.md', 'api/x/y.py']);
  assert.deepEqual(rows, [['README.md', 1], ['api/', 1], ['web/', 2]]);
});

test('signposts are reported, and their absence is reported too', () => {
  const root = workspace({ 'CLAUDE.md': 'x', 'README.md': 'x', 'web/a.js': 'x' });
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  const out = run(['--root', root]);
  assert.match(out, /read first: CLAUDE[.]md, README[.]md/);

  const bare = workspace({ 'web/a.js': 'x' });
  fs.mkdirSync(path.join(bare, '.git'), { recursive: true });
  assert.match(run(['--root', bare]), /read first: nothing/);
});

test('signposts must be files, not directories with the same name', () => {
  const root = workspace({ 'web/a.js': 'x' });
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'README.md'), { recursive: true });
  assert.deepEqual(orient.signposts(root), []);
});

test('a workspace listing gathers no commits — five git logs is a screen nobody reads', () => {
  const root = workspace({ 'alpha/a.js': 'x', 'beta/b.js': 'x' });
  const out = run(['--root', root]);
  assert.doesNotMatch(out, /last \d+ commits:/);
  assert.doesNotMatch(out, /read first:/);
});

test('recent returns nothing for a directory that is not a repository', () => {
  const root = workspace({ 'a.js': 'x' });
  assert.deepEqual(orient.recent(root, 5), []);
});

test('it writes nothing — orientation that changes the tree is not orientation', () => {
  const root = workspace({ 'alpha/a.js': 'x' });
  const before = fs.readdirSync(root).sort();
  run(['--root', root]);
  assert.deepEqual(fs.readdirSync(root).sort(), before);
  assert.equal(fs.existsSync(path.join(root, '.fankeel')), false);
});

test('a real repository reports its branch, and git never speaks on stderr', () => {
  const root = workspace({ 'a.js': 'x' });
  const opts = { cwd: root, stdio: ['ignore', 'ignore', 'ignore'] };
  try {
    execFileSync('git', ['init', '-q'], opts);
    execFileSync('git', ['config', 'user.email', 't@example.com'], opts);
    execFileSync('git', ['config', 'user.name', 'test'], opts);
    execFileSync('git', ['add', '-A'], opts);
    execFileSync('git', ['commit', '-qm', 'init'], opts);
  } catch (e) {
    return; // no git on this machine; the rest of the suite still means something
  }
  const out = execFileSync(process.execPath, [SCRIPT, '--root', root], { encoding: 'utf8' });
  assert.match(out, /one project:/);
  assert.match(out, /git \S+, clean/);
  assert.doesNotMatch(out, /fatal:/);
});

test('an unreadable root does not throw', () => {
  const root = workspace({});
  const missing = path.join(root, 'gone');
  assert.doesNotThrow(() => orient.report(orient.scan(missing, [])));
});

// orient is where the remaining question gets its options, so its own closing
// instruction is the nearest thing to that question in the agent's context. It
// used to end by telling the reader to pick a scope, which after this design is
// an instruction to declare something nothing accepts.
test('the closing instruction asks for a project and a task, and never for a file list', () => {
  const root = workspace({ 'alpha/a.js': 'x', 'beta/b.js': 'x' });
  const out = run(['--root', root]);
  assert.equal(/scope/i.test(out), false, 'orient still tells the reader to pick a scope');
  assert.equal(out.includes('Pick the project from this'), true, 'it never says to pick the project');
});

// `readActive` reports intent; `lib/live.js` reports fact. Both readings are
// right, and orient was the only one of five callers printing a number without
// saying which it was — so `orient: 1 active` beside `task.js show` listing none
// read as a contradiction rather than as the two answers it is.
test('the registry line says how many entries are live, not only how many are active', () => {
  const root = workspace({ 'a/.git/HEAD': 'ref: refs/heads/main\n' });
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.fankeel', 'sessions', 'deadbeef-0000-0000-0000-000000000000.json'),
    JSON.stringify({ task: 'gone', stage: 'land', active: true }),
  );
  // A config dir of its own, so the count does not depend on what is running on
  // the machine the tests happen to be on.
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-cfg-'));
  fs.mkdirSync(path.join(cfg, 'sessions'));
  const env = Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg });
  const out = execFileSync(process.execPath, [SCRIPT, '--root', root], { encoding: 'utf8', env });
  assert.match(out, /1 active, 0 live/);
});

test('a session directory it cannot read is reported as unknown, not as zero', () => {
  const root = workspace({ 'a/.git/HEAD': 'ref: refs/heads/main\n' });
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.fankeel', 'sessions', 'deadbeef-0000-0000-0000-000000000000.json'),
    JSON.stringify({ task: 'gone', stage: 'land', active: true }),
  );
  const env = Object.assign({}, process.env, {
    CLAUDE_CONFIG_DIR: path.join(os.tmpdir(), 'fankeel-no-such-config-dir'),
  });
  const out = execFileSync(process.execPath, [SCRIPT, '--root', root], { encoding: 'utf8', env });
  assert.match(out, /1 active, liveness unknown/);
});

// Step 1 and step 4 of the same stage over the same root: survey says "1
// directory that could not be listed" and orient said `0 files` — that it holds
// nothing, which is a different fact and the wrong one. The counter was there;
// only survey read it.
test('a directory that cannot be listed says so, rather than reporting no files', (t) => {
  const root = workspace({ 'locked/deep.js': 'function widgetSealed() {}\n' });
  const real = fs.readdirSync;
  t.mock.method(fs, 'readdirSync', (dir, opts) => {
    if (String(dir).endsWith('locked')) throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
    return real.call(fs, dir, opts);
  });

  const out = orient.main(['--root', root]);
  assert.match(out, /could not be listed/);
  assert.equal(/0 files/.test(out), false, 'an unlistable directory reported as holding nothing');

  // And it stops one line short of asserting what is not in there. `read first:
  // nothing — no CLAUDE.md, AGENTS.md or README.md here.` printed directly under
  // `could not be listed`: absence read off a directory that would not open.
  assert.equal(/read first: nothing/.test(out), false,
    'absence claimed about a directory that could not be read');
});

// The same disagreement, with the other counter. survey reports "2 documents and
// binaries dropped by extension" over a root of nothing but archives and images;
// orient said `nothing readable`, which is what it says about a root that does
// not exist. A directory holding two files is not one of those.
test('a root of nothing but skipped extensions says how many, not that it is unreadable', () => {
  const root = workspace({ 'photo.png': 'x', 'notes.pdf': 'x' });
  const out = orient.main(['--root', root]);
  assert.equal(/nothing readable/.test(out), false, 'a root holding two files read as unreadable');
  assert.match(out, /2 skipped/);
});

// Step 1 and step 4 of one stage, over one root, disagreeing by two: survey's
// header excludes subtrees — a submodule is one entry standing for a whole
// repository, not one file — and orient counted entries. It read `11 files`
// where survey read `9`.
test('the file count matches the one survey puts in its header', () => {
  const root = workspace({ 'a.js': 'x\n', 'b.js': 'x\n', 'c.js': 'x\n' });
  execFileSync('git', ['init', '-q'], { cwd: root });
  // Both shapes git reports a nested repository in: a bare name for a submodule,
  // a trailing slash for an untracked one.
  for (const name of ['sub', 'vendor.js']) {
    const inner = path.join(root, name);
    fs.mkdirSync(inner);
    fs.writeFileSync(path.join(inner, 'deep.js'), 'x\n');
    execFileSync('git', ['init', '-q'], { cwd: inner });
    execFileSync('git', ['add', '-A'], { cwd: inner });
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'x'], { cwd: inner });
  }
  execFileSync('git', ['add', '-A'], { cwd: root, stdio: ['ignore', 'ignore', 'ignore'] });

  const survey = require('../scripts/survey.js');
  const header = survey.report(survey.scan(root, []), []).split('\n')[0];
  assert.match(header, /— 3 files/, 'survey counted the subtrees after all');
  assert.match(orient.main(['--root', root]), /\b3 files\b/);
});

// `walk` reads every directory with `withFileTypes`, so it already holds a
// dirent saying file-or-directory for everything it pushes — and then threw it
// away, leaving `isSubtree` to ask the disk the same question again. On a
// workspace of fifteen that was 18,423 stats and a quarter of the whole run.
//
// Only entries with no extension, or an extension no declaration pattern
// claims, ever reached the stat, so the fixture is named to hit exactly those.
test('a file the walk already identified is not stat-ed again', (t) => {
  const root = workspace({
    'alpha/README': 'x',
    'alpha/Makefile': 'x',
    'alpha/notes.txt': 'x',
    'beta/b.js': 'x',
  });

  const real = fs.statSync;
  const statted = [];
  t.mock.method(fs, 'statSync', (p, ...rest) => {
    if (String(p).split(path.sep).includes('alpha')) statted.push(String(p));
    return real.call(fs, p, ...rest);
  });

  orient.scan(root, []);
  assert.deepEqual(statted, [], 'the walk knew these were files and asked the disk anyway');
});

// The other half of the same saving, and the half the walk could not reach. Every
// entry it did not produce itself came from `git ls-files`, where a gitlink and a
// file with no extension are the same string — so the count stat-ed all of them
// to tell the two apart, 8,585 times on a workspace of fifteen. `--stage` prints
// the mode git already had, `160000` is the gitlink, and the disk is not asked.
//
// The gitlink itself is the one entry still stat-ed, and deliberately: `known`
// says which entries are files, so the whole repository standing as one of them
// is what is left over, and `isSubtree` is what reads it. Buying that one back
// costs a second set in a return shape six callers read, for the handful of
// submodules a workspace holds — 3 stats here become 1, and 8,585 become 30.
//
// A workspace of two rather than one project, because a single target is read
// deeply and `signposts` stats the five names it looks for — which is a question
// about the project rather than about its file list, and it is not this one.
test('a project read by git is counted without stat-ing the files git named', (t) => {
  const root = workspace({ 'alpha/a.js': 'x\n', 'alpha/README': 'x\n', 'beta/b.js': 'x\n' });
  const alpha = path.join(root, 'alpha');
  execFileSync('git', ['init', '-q'], { cwd: alpha });

  const sub = path.join(alpha, 'sub');
  fs.mkdirSync(sub);
  fs.writeFileSync(path.join(sub, 'deep.js'), 'x\n');
  execFileSync('git', ['init', '-q'], { cwd: sub });
  execFileSync('git', ['add', '-A'], { cwd: sub });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'x'], { cwd: sub });
  execFileSync('git', ['add', '-A'], { cwd: alpha, stdio: ['ignore', 'ignore', 'ignore'] });

  const real = fs.statSync;
  const statted = [];
  t.mock.method(fs, 'statSync', (p, ...rest) => {
    if (String(p).split(path.sep).includes('alpha')) statted.push(String(p));
    return real.call(fs, p, ...rest);
  });

  const out = orient.report(orient.scan(root, []));
  assert.match(out, /^\s*alpha\b.*\b2 files\b/m, 'the gitlink was counted as a file, or a file was lost');
  assert.deepEqual(statted.map((p) => path.basename(p)), ['sub'],
    'a file git had already named was stat-ed to be told the same thing');
});
