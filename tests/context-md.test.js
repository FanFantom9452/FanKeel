'use strict';
// scripts/context.js: a task's verified facts, one per line — the fact, its
// path:line, and the short sha it was read at — capped at 40, oldest dropped.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ctx = require('../scripts/context.js');
const { contextPath } = require('../lib/handoff.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'context.js');
const SID = 'cccccccc-0000-4000-8000-000000000001';
const file = () => path.join(tmp('fankeel-ctx-'), 'context.md');

test('41 adds leave 40 lines, the oldest gone', () => {
  const f = file();
  for (let i = 1; i <= 41; i++) ctx.add(f, { fact: 'fact ' + i, at: 'lib/a.js:' + i, sha: 'abc1234' });
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n');
  assert.equal(lines.length, ctx.CAP);
  assert.equal(lines[0], '- fact 2 — lib/a.js:2 @ abc1234');
  assert.equal(lines[39], '- fact 41 — lib/a.js:41 @ abc1234');
  assert.equal(ctx.readEntries(f).length, ctx.CAP);
  assert.equal(ctx.readEntries(f)[0].fact, 'fact 2');
});

test('main refuses a call with no --session', () => {
  const r = ctx.main(['show']);
  assert.equal(r.code, 2);
  assert.match(r.text, /--session <id> is required/);
});

test('an exact duplicate adds nothing; the same fact read again at a new sha replaces its line', () => {
  const f = file();
  ctx.add(f, { fact: 'x is 3', at: 'lib/a.js:4', sha: 'abc1234' });
  assert.equal(ctx.add(f, { fact: 'x is 3', at: 'lib/a.js:4', sha: 'abc1234' }).added, false);
  assert.equal(fs.readFileSync(f, 'utf8'), '- x is 3 — lib/a.js:4 @ abc1234\n');
  ctx.add(f, { fact: 'x is 3', at: 'lib/a.js:4', sha: 'def5678' });
  assert.equal(fs.readFileSync(f, 'utf8'), '- x is 3 — lib/a.js:4 @ def5678\n');
});

test('show marks a line read at a sha that is not HEAD with (舊)', () => {
  const f = file();
  ctx.add(f, { fact: 'old', at: 'lib/a.js:1', sha: 'abc1234' });
  ctx.add(f, { fact: 'new', at: 'lib/a.js:2', sha: 'def5678' });
  assert.deepEqual(ctx.show(f, 'def5678'), ['- old — lib/a.js:1 @ abc1234 (舊)', '- new — lib/a.js:2 @ def5678']);
});

test('a fact with no path:line, or no text, is refused and writes nothing', () => {
  const f = file();
  assert.equal(ctx.add(f, { fact: 'x', at: 'lib/a.js', sha: 'abc1234' }).ok, false);
  assert.equal(ctx.add(f, { fact: '  ', at: 'lib/a.js:1', sha: 'abc1234' }).ok, false);
  assert.equal(fs.existsSync(f), false);
});

test('the CLI finds the task by session, stamps HEAD\'s short sha, and show reads it back', () => {
  const root = tmp('fankeel-ctx-root-');
  const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'test']);
  fs.writeFileSync(path.join(root, 'a.js'), 'x\n');
  git(['add', '-A']);
  git(['commit', '-qm', 'a']);
  const head = git(['rev-parse', '--short', 'HEAD']).trim();
  const data = { task: 't', stage: 'build', active: true, started: '2026-09-26T01:28:47.000Z', updated: new Date().toISOString() };
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SID + '.json'), JSON.stringify(data));
  const run = (...args) => execFileSync(process.execPath, [SCRIPT, ...args, '--session', SID, '--root', root], { encoding: 'utf8' });
  run('add', 'a.js holds x', '--at', 'a.js:1');
  const f = contextPath(root, data);
  assert.match(f, /\/\.fankeel\/build\/task-20260926T012847\/context\.md$/);
  assert.equal(fs.readFileSync(f, 'utf8'), '- a.js holds x — a.js:1 @ ' + head + '\n');
  assert.equal(run('show').trim(), '- a.js holds x — a.js:1 @ ' + head);
});
