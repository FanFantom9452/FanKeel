'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const dirty = require('../lib/dirty.js');
const registry = require('../lib/registry.js');

const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const ago = (ms) => new Date(Date.now() - ms).toISOString();

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-dirty-'));

function git(dir, args) {
  execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'ignore', 'ignore'] });
}

// A repository with one committed file, so there is something for a later write
// to make dirty. `commit.gpgsign` off and an explicit identity: the machine
// running these may have neither, and a repository that cannot commit is not
// the thing under test.
function repo() {
  const dir = tmp();
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'test@example.invalid']);
  git(dir, ['config', 'user.name', 'test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(dir, 'kept.js'), 'one\n');
  // Committed, the way this repository has it: `.fankeel/.gitignore` is version
  // controlled and `sessions/` is the one thing under it that is not. Leaving it
  // untracked would make the registry's own file read as a write of this task's.
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', '.gitignore'), 'sessions/\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'base']);
  return dir;
}

function seed(root, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({
    task: 'claim what escapes', stage: 'build', active: true,
    started: ago(3600e3), updated: ago(60e3),
  }, over);
  fs.writeFileSync(path.join(dir, MINE + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

const claims = (root) => registry.claimsOf(registry.readSession(root, MINE));

// A write through no tool at all. Every case this module exists for looks like
// this from the outside: nothing called Edit, so nothing called `hooks/touch.js`.
const writeBehindTheHooks = (dir, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};

test('a rename record does not swallow the path after it', () => {
  // `XY PATH\0ORIG\0` for a rename, plain `XY PATH\0` for everything else.
  const out = 'R  new.js\0old.js\0 M kept.js\0';
  assert.deepEqual(dirty.parsePorcelain(out), ['new.js', 'kept.js']);
});

test('untracked, modified and added all read as one list', () => {
  const out = '?? fresh.js\0 M kept.js\0A  staged.js\0';
  assert.deepEqual(dirty.parsePorcelain(out), ['fresh.js', 'kept.js', 'staged.js']);
});

test('an empty field is not a path', () => {
  assert.deepEqual(dirty.parsePorcelain(''), []);
  assert.deepEqual(dirty.parsePorcelain('\0\0'), []);
});

test('a path with a space survives, because -z does not quote', () => {
  assert.deepEqual(dirty.parsePorcelain('?? docs/two words.md\0'), ['docs/two words.md']);
});

test('a directory that is not a repository has no answer, not an empty one', () => {
  assert.equal(dirty.dirtyPaths(tmp()), null);
  assert.equal(dirty.dirtyPaths(''), null);
});

test('a file written behind the hooks is dirty', () => {
  const dir = repo();
  writeBehindTheHooks(dir, 'api/routes.js', 'added\n');
  fs.appendFileSync(path.join(dir, 'kept.js'), 'two\n');
  assert.deepEqual(dirty.dirtyPaths(dir).sort(), ['api/routes.js', 'kept.js']);
});

// Not a gap to close. `dirtyPaths` shells `git status`, so the repository's own
// ignore rules apply and a generated file is not this task's work — which is the
// answer wanted. Pinned because nothing else in this file says so, and this is
// the test that fails the day `dirtyPaths` starts reporting a path git itself
// was told to ignore.
test('a write to a gitignored path is invisible, because git says so', () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, '.gitignore'), 'build/\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'ignore build output']);
  writeBehindTheHooks(dir, 'build/out.js', 'generated\n');
  assert.deepEqual(dirty.dirtyPaths(dir), []);
});

test('a file dirtied before the cutoff is not this task\'s', () => {
  const dir = repo();
  writeBehindTheHooks(dir, 'old.js', 'yesterday\n');
  const then = Date.now() - 48 * 3600e3;
  fs.utimesSync(path.join(dir, 'old.js'), then / 1000, then / 1000);
  writeBehindTheHooks(dir, 'now.js', 'today\n');
  assert.deepEqual(dirty.writtenSince(dir, Date.now() - 3600e3), ['now.js']);
});

test('writtenSince has no answer outside a repository either', () => {
  assert.equal(dirty.writtenSince(tmp(), Date.now()), null);
});

test('a write no hook saw is claimed', () => {
  const dir = repo();
  seed(dir);
  writeBehindTheHooks(dir, 'api/routes.js', 'sed did this\n');
  assert.equal(dirty.claimWrites(dir, MINE, registry.readSession(dir, MINE)).added, 1);
  assert.deepEqual(claims(dir), ['api/routes.js']);
});

test('a path already claimed is not claimed twice', () => {
  const dir = repo();
  seed(dir, { claims: ['api/routes.js'] });
  writeBehindTheHooks(dir, 'api/routes.js', 'sed did this\n');
  const before = fs.readFileSync(path.join(dir, '.fankeel', 'sessions', MINE + '.json'), 'utf8');
  assert.equal(dirty.claimWrites(dir, MINE, registry.readSession(dir, MINE)).added, 0);
  assert.equal(fs.readFileSync(path.join(dir, '.fankeel', 'sessions', MINE + '.json'), 'utf8'), before);
});

test('an entry with no readable started claims nothing', () => {
  const dir = repo();
  seed(dir, { started: 'not a date' });
  writeBehindTheHooks(dir, 'api/routes.js', 'sed did this\n');
  assert.equal(dirty.claimWrites(dir, MINE, registry.readSession(dir, MINE)).added, 0);
  assert.deepEqual(claims(dir), []);
});

test('a registry root that is not a repository claims nothing', () => {
  const dir = tmp();
  seed(dir);
  writeBehindTheHooks(dir, 'api/routes.js', 'sed did this\n');
  assert.equal(dirty.claimWrites(dir, MINE, registry.readSession(dir, MINE)).added, 0);
  assert.deepEqual(claims(dir), []);
});

// One registry over several projects. The claim has to be relative to the
// registry, the way every other claim is, while git only ever answers relative
// to the repository it was asked about.
test('a project under the registry root is claimed with its prefix', () => {
  const root = tmp();
  seed(root, { project: 'Waypoint' });
  const project = path.join(root, 'Waypoint');
  fs.mkdirSync(project);
  git(project, ['init', '-q']);
  git(project, ['config', 'user.email', 'test@example.invalid']);
  git(project, ['config', 'user.name', 'test']);
  writeBehindTheHooks(project, 'statusline.ps1', 'sed did this\n');
  assert.equal(dirty.claimWrites(root, MINE, registry.readSession(root, MINE)).added, 1);
  assert.deepEqual(claims(root), ['Waypoint/statusline.ps1']);
});

test('a project that escapes the registry root claims nothing', () => {
  const dir = repo();
  seed(dir, { project: '../elsewhere' });
  writeBehindTheHooks(dir, 'api/routes.js', 'sed did this\n');
  assert.equal(dirty.claimWrites(dir, MINE, registry.readSession(dir, MINE)).added, 0);
  assert.deepEqual(claims(dir), []);
});

// `-uall` is what makes a claim a file path rather than a directory name, and it
// is also what turns an unignored build directory into three hundred of them.
const writeMany = (dir, n) => {
  fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
  for (let i = 0; i < n; i++) fs.writeFileSync(path.join(dir, 'dist', 'part' + i + '.js'), 'chunk\n');
};

test('a pass bigger than the record can hold claims none of it', () => {
  const dir = repo();
  seed(dir, { claims: ['api/routes.js'] });
  writeMany(dir, registry.MAX_CLAIMS + 1);
  const found = dirty.claimWrites(dir, MINE, registry.readSession(dir, MINE));
  assert.equal(found.added, 0);
  assert.equal(found.declined, registry.MAX_CLAIMS + 1, 'a refusal nobody is told about is the hole');
  assert.deepEqual(claims(dir), ['api/routes.js'], 'the claims an edit earned survive it');
});

test('a pass the record can hold is taken whole', () => {
  const dir = repo();
  seed(dir);
  writeMany(dir, registry.MAX_CLAIMS);
  const found = dirty.claimWrites(dir, MINE, registry.readSession(dir, MINE));
  assert.deepEqual(found, { added: registry.MAX_CLAIMS, declined: 0 });
  assert.equal(claims(dir).length, registry.MAX_CLAIMS);
});
