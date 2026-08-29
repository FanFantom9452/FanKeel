'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const tracked = require('../lib/tracked.js');

// A `--stage` record is `<mode> <sha> <stage>\t<path>`; an `--others` entry is
// the bare path, and both arrive on the one stream.
test('parseStaged separates the paths from the modes', () => {
  const records = [
    '100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0\tlib/a.js',
    '160000 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 0\tvendor/sub',
    'untracked.js',
    'nested-repo/',
  ];
  const got = tracked.parseStaged(records);
  assert.deepEqual(got.files, ['lib/a.js', 'vendor/sub', 'untracked.js', 'nested-repo/']);
  // The gitlink is a whole repository standing in as one entry, so it is listed
  // and not known to be a file. The trailing slash means the same for an
  // untracked nested repository.
  assert.ok(got.known.has('lib/a.js'));
  assert.ok(got.known.has('untracked.js'));
  assert.equal(got.known.has('vendor/sub'), false, 'a gitlink was reported as a file');
  assert.equal(got.known.has('nested-repo/'), false, 'an untracked repository was reported as a file');
});

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { fanout } = require('../lib/fanout.js');

const FANOUT = path.join(__dirname, '..', 'lib', 'fanout.js');

// A root holding `n` repositories, each with one file naming itself, plus one
// directory that is not a repository at all.
function workspace(n) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-fanout-'));
  for (let i = 0; i < n; i++) {
    const dir = path.join(root, 'p' + i);
    fs.mkdirSync(dir);
    execFileSync('git', ['init', '-q'], { cwd: dir });
    fs.writeFileSync(path.join(dir, 'a' + i + '.js'), 'x\n');
    execFileSync('git', ['add', '-A'], { cwd: dir });
  }
  fs.mkdirSync(path.join(root, 'loose'));
  fs.writeFileSync(path.join(root, 'loose', 'b.js'), 'x\n');
  return root;
}

test('fanout answers for every repository it is given, and null for one that is not', async () => {
  const root = workspace(3);
  const got = await fanout(root, ['p0', 'p1', 'p2', 'loose']);
  assert.deepEqual(Object.keys(got).sort(), ['loose', 'p0', 'p1', 'p2']);
  assert.equal(got.loose, null, 'a directory with no .git in it was answered for');
  for (const p of ['p0', 'p1', 'p2']) {
    assert.equal(got[p].staged, true, p + ' fell back off --stage for no reason');
    assert.match(got[p].out, /a\d\.js/, p + ' came back with no file in it');
  }
});

test('fanout is the same answer whatever the width', async () => {
  const root = workspace(5);
  const repos = ['p0', 'p1', 'p2', 'p3', 'p4'];
  const one = await fanout(root, repos, 1);
  const many = await fanout(root, repos, 8);
  assert.deepEqual(one, many);
});

test('lib/fanout.js run as a process reads stdin and writes JSON', () => {
  const root = workspace(2);
  const out = execFileSync(process.execPath, [FANOUT], {
    input: JSON.stringify({ root, repos: ['p0', 'p1'] }),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const got = JSON.parse(out);
  assert.deepEqual(Object.keys(got).sort(), ['p0', 'p1']);
  assert.match(got.p0.out, /a0\.js/);
});

test('lib/fanout.js writes an empty object rather than dying on bad input', () => {
  const out = execFileSync(process.execPath, [FANOUT], {
    input: 'not json',
    encoding: 'utf8',
  });
  assert.equal(out, '{}');
});

const { trackedFiles } = require('../lib/tracked.js');

// The one test here that fails before the walk is rewritten rather than after
// it. The three around it are regression guards — they describe what must not
// change, and they pass today because today's walk already has those
// properties. This one is the driver: nothing spawns a pool yet.
test('a root above the threshold spawns the pool exactly once', (t) => {
  const root = workspace(6);
  const cp = require('node:child_process');
  const real = cp.execFileSync;
  const nodes = [];
  t.mock.method(cp, 'execFileSync', (file, args, opts) => {
    if (file === process.execPath) nodes.push(args[0]);
    return real.call(cp, file, args, opts);
  });
  const got = trackedFiles(root);
  assert.deepEqual(nodes, [path.join(__dirname, '..', 'lib', 'fanout.js')],
    'six repositories were read one at a time');
  assert.equal(got.repos.length, 6);
});

// Six is above the threshold, so this root takes the pooled path. Blocking the
// child process sends the same root down the serial path instead, and the two
// have to agree exactly — including the order, which is the property no test in
// this repository covered before this one.
test('the pooled path and the serial path return the same list, in the same order', (t) => {
  const root = workspace(6);
  const pooled = trackedFiles(root);

  const cp = require('node:child_process');
  const real = cp.execFileSync;
  t.mock.method(cp, 'execFileSync', (file, args, opts) => {
    if (file === process.execPath) throw new Error('no pool for you');
    return real.call(cp, file, args, opts);
  });
  const serial = trackedFiles(root);

  assert.deepEqual(serial.files, pooled.files, 'the two paths disagree on the list or its order');
  assert.deepEqual(serial.repos, pooled.repos, 'the two paths disagree on which repositories were read');
  assert.deepEqual([...serial.known].sort(), [...pooled.known].sort());
  assert.equal(pooled.walked, true);
});

test('a root below the threshold never spawns the pool', (t) => {
  const root = workspace(2);
  const cp = require('node:child_process');
  const real = cp.execFileSync;
  const nodes = [];
  t.mock.method(cp, 'execFileSync', (file, args, opts) => {
    if (file === process.execPath) nodes.push(args[0]);
    return real.call(cp, file, args, opts);
  });
  const got = trackedFiles(root);
  assert.deepEqual(nodes, [], 'two repositories are not worth a process start');
  assert.equal(got.repos.length, 2);
});

test('the files of a repository are listed under it, in walk order', () => {
  const root = workspace(6);
  const got = trackedFiles(root);
  assert.deepEqual(got.repos, ['p0', 'p1', 'p2', 'p3', 'p4', 'p5']);
  const positions = got.repos.map((p) => got.files.indexOf(p + '/a' + p.slice(1) + '.js'));
  assert.deepEqual(positions, positions.slice().sort((a, b) => a - b), 'the repositories came back out of order');
  assert.ok(got.files.includes('loose/b.js'), 'the directory that is not a repository was dropped');
});
