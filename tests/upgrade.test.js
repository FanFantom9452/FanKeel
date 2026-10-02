'use strict';

// scripts/upgrade.js: what a project needs when fankeel has moved since it last
// looked, read from the project's own shape and never from a recorded version.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const upgrade = require('../scripts/upgrade.js');
const lib = require('../lib/todo.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'upgrade.js');
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 8, 30, 12, 0, 0).getTime();
const TODAY = (() => {
  const t = new Date();
  return String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
})();

// A `## Waiting` file with one typed timing, which todo-check --migrate can place.
const WAITING = ['# TODO', '', '## Ready', '', '- r', '', '## Waiting', '', '### a release lands',
  'after: the 1.0 release. ' + TODAY + '.', '', '- a', ''].join('\n');

// `todoBucket: false` leaves TODO.md mode, where the folder step cannot apply.
function project(todoText, todoBucket) {
  const dir = tmp('fankeel-upgrade-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs', 'reports'), { recursive: true });
  const buckets = [{ path: 'docs/reports', role: 'report' }];
  if (todoBucket !== false) buckets.push({ path: 'docs/todo', role: 'todo' });
  fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify({ preset: 'flat', buckets }));
  if (todoText !== null) fs.writeFileSync(path.join(dir, 'TODO.md'), todoText);
  return dir;
}

// A stand-in plugin root: the two manifests version.js reads, and no .git.
function plugin(v) {
  const dir = tmp('fankeel-upgrade-plugin-');
  fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'fankeel', version: v }, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), JSON.stringify({ version: v }, null, 2) + '\n');
  return dir;
}

function pluginRepo(v, subjects) {
  const dir = plugin(v);
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a],
    { cwd: dir, stdio: 'ignore' });
  git('init', '-q');
  for (const s of subjects) git('commit', '-q', '--allow-empty', '-m', s);
  return dir;
}

const reports = (dir) => fs.readdirSync(path.join(dir, 'docs', 'reports')).sort();
const readReport = (dir, name) => fs.readFileSync(path.join(dir, 'docs', 'reports', name), 'utf8');

test('check reports a ## Waiting section, exits 1 and touches nothing', () => {
  const dir = project(WAITING, false);
  const r = upgrade.run(dir, { plugin: plugin('1.2.3'), now: NOW });
  assert.equal(r.code, 1, r.text);
  assert.match(r.text, /pending:\n {2}TODO\.md still has a ## Waiting section/);
  assert.match(r.text, /changes unavailable: no git history here/);
  assert.equal(fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8'), WAITING);
  assert.deepEqual(reports(dir), []);
});

test('--apply runs todo-check --migrate, writes the report with the plugin version, and the next run finds nothing', () => {
  const dir = project(WAITING, false);
  const p = plugin('1.2.3');
  const first = upgrade.run(dir, { plugin: p, apply: true, now: NOW });
  assert.equal(first.code, 0, first.text);
  const after = fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8');
  assert.match(after, /## Blocked/);
  assert.doesNotMatch(after, /## Waiting/);
  assert.match(first.text, /ran:\n {2}TODO\.md still has a ## Waiting section — fankeel todo-check --migrate: 1 timing to ## Blocked, 0 to ## Watch, 0 left under ## Waiting\./);
  assert.deepEqual(reports(dir), ['2026-09-30-fankeel-upgrade.md']);
  const body = readReport(dir, '2026-09-30-fankeel-upgrade.md');
  assert.match(body, /^---\nstatus: current\nfankeel: 1\.2\.3\n---\n/);
  assert.match(body, /## Ran\n- TODO\.md still has a ## Waiting section/);
  assert.match(body, /## Still needs a human\n- nothing/);
  assert.match(body, /old `scope` field/);
  assert.equal(upgrade.lastStamp(dir), '1.2.3');

  const second = upgrade.run(dir, { plugin: p, apply: true, now: NOW + DAY });
  assert.equal(second.code, 0, second.text);
  assert.match(second.text, /nothing pending/);
  assert.equal(fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8'), after, 'a second run rewrote TODO.md');
  assert.match(readReport(dir, '2026-10-01-fankeel-upgrade.md'), /## Ran\n- nothing: no step was pending/);
});

test('an empty todo folder with entries in TODO.md is printed for a person and never run', () => {
  const text = '# TODO\n\n## Ready\n\n- one\n';
  const dir = project(text);
  const r = upgrade.run(dir, { plugin: plugin('1.2.3'), apply: true, now: NOW });
  assert.equal(r.code, 1, r.text);
  assert.match(r.text, /node .*todo\.js migrate --root /);
  assert.equal(fs.existsSync(path.join(dir, 'docs', 'todo')), false, '--apply ran todo.js migrate');
  assert.equal(fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8'), text);
  assert.match(readReport(dir, '2026-09-30-fankeel-upgrade.md'), /## Still needs a human\n- .*todo\.js migrate --root /);
});

// The control for the test above: the same project once the folder holds an entry.
test('a project already on entry files has nothing pending', () => {
  const dir = project(null);
  fs.mkdirSync(path.join(dir, 'docs', 'todo'), { recursive: true });
  lib.add(dir, { label: 'a', title: 'one', description: 'first', state: 'ready' });
  assert.equal(fs.existsSync(path.join(dir, 'TODO.md')), false, 'add writes no TODO.md');
  const r = upgrade.run(dir, { plugin: plugin('1.2.3'), now: NOW });
  assert.equal(r.code, 0, r.text);
  assert.match(r.text, /nothing pending/);
  assert.deepEqual(upgrade.steps(dir, plugin('1.2.3')), []);
});

test('a project whose docs.json names no shape gets the docs-move hint, which is not a step', () => {
  const bare = tmp('fankeel-upgrade-');
  const r = upgrade.run(bare, { plugin: plugin('1.2.3'), now: NOW });
  assert.equal(r.code, 0, r.text);
  assert.match(r.text, /docs-move\.js plan --to <flat\|phased\|audience>/);
  assert.doesNotMatch(upgrade.run(project('# TODO\n'), { plugin: plugin('1.2.3'), now: NOW }).text, /docs-move/);
});

test('--apply with no report bucket still runs the steps and says no report was written', () => {
  const dir = tmp('fankeel-upgrade-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify({ preset: 'flat', buckets: [{ path: 'docs', role: 'reference' }] }));
  fs.writeFileSync(path.join(dir, 'TODO.md'), WAITING);
  const r = upgrade.run(dir, { plugin: plugin('1.2.3'), apply: true, now: NOW });
  assert.equal(r.report, null);
  assert.match(r.text, /no report bucket in \.fankeel\/docs\.json/);
  assert.doesNotMatch(fs.readFileSync(path.join(dir, 'TODO.md'), 'utf8'), /## Waiting/);
});

test('the changes listed start after the newest report\'s release, and a stamp the log lacks is unavailable, not an error', () => {
  const p = pluginRepo('0.2.0', ['chore: 0.1.0 — first', 'feat: middle', 'chore: 0.2.0 — second', 'fix: latest']);
  const dir = project('# TODO\n');
  fs.writeFileSync(path.join(dir, 'docs', 'reports', '2026-09-01-fankeel-upgrade.md'), '---\nstatus: current\nfankeel: 0.1.0\n---\n\n# earlier\n');
  const since = upgrade.run(dir, { plugin: p, now: NOW });
  assert.match(since.text, /3 commit\(s\) since chore: 0\.1\.0/);
  assert.match(since.text, /fix: latest/);

  const fresh = upgrade.run(project('# TODO\n'), { plugin: p, now: NOW });
  assert.match(fresh.text, /1 commit\(s\) since chore: 0\.2\.0/, 'no report means plain --changes');

  fs.writeFileSync(path.join(dir, 'docs', 'reports', '2026-09-02-fankeel-upgrade.md'), '---\nstatus: current\nfankeel: 9.9.9\n---\n');
  const lost = upgrade.run(dir, { plugin: p, now: NOW });
  assert.match(lost.text, /changes unavailable: no release commit for 9\.9\.9/);
  assert.equal(lost.code, 0, 'unavailable changes do not fail the run');
});

function cli(dir, args) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', dir], { encoding: 'utf8', cwd: dir }) };
  } catch (e) {
    return { code: e.status, out: String(e.stdout) };
  }
}

test('the CLI exits 1 while a step is pending and 0 when none is', () => {
  const pending = cli(project(WAITING, false), []);
  assert.equal(pending.code, 1, pending.out);
  assert.match(pending.out, /^fankeel upgrade — /);
  const clean = cli(project('# TODO\n'), []);
  assert.equal(clean.code, 0, clean.out);
});
