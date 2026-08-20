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

test('a single target is broken down one level, which is where a scope gets written', () => {
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

test('the registry is named when it is somewhere else, with the warning about scope paths', () => {
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

test('stateText says clean rather than saying nothing', () => {
  assert.equal(orient.stateText({ branch: 'main', changed: 0, untracked: 0 }), 'git main, clean');
  assert.equal(orient.stateText({ branch: 'x', changed: 2, untracked: 1 }), 'git x, 2 uncommitted, 1 untracked');
  assert.equal(orient.stateText(null), 'no git');
});

test('topLevel counts by first segment and marks directories with a slash', () => {
  const rows = orient.topLevel(['web/a.js', 'web/b.js', 'README.md', 'api/x/y.py']);
  assert.deepEqual(rows, [['README.md', 1], ['api/', 1], ['web/', 2]]);
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
