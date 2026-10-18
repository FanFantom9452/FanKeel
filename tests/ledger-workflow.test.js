'use strict';

// `workflow --group <N>` is the one place a build group becomes a file the
// session holding the Workflow tool opens by `scriptPath`.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const { parseTasks, workflowScript } = require('../lib/plantasks.js');

// `groups` reads the profile, and the machine profile lives under the config
// directory: pinned to an empty one so no test reads the real machine's.
process.env.CLAUDE_CONFIG_DIR = tmp('fankeel-ledger-wf-cfg-');
delete process.env.CLAUDE_PROJECT_DIR;

const SCRIPT = path.join(__dirname, '..', 'scripts', 'ledger.js');

const task = (n, file, dispatch) => [
  '## Task ' + n + ': task ' + n, '',
  '**Files:**', '- Modify: `' + file + '`', '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  '**Dispatch:** ' + dispatch, '',
].join('\n');

const HEADER = ['# P', '', '**Goal:** g.', '**Spec:** d.md', '', '## Global Constraints', '', '- none', ''].join('\n');

// Tasks 1-3 are disjoint, so group 1 is `workflow`; Task 4 shares lib/a.js
// with Task 1, so group 2 is `agent`.
const plan = (d2, d3) => [
  HEADER,
  task(1, 'lib/a.js', 'implementer, sonnet'),
  task(2, 'lib/b.js', d2 || 'implementer, sonnet'),
  task(3, 'lib/c.js', d3 || 'implementer, sonnet'),
  task(4, 'lib/a.js', 'implementer, sonnet'),
].join('\n');

function setup(text) {
  const dir = tmp('fankeel-ledger-wf-');
  const file = path.join(dir, 'p.md');
  fs.writeFileSync(file, text);
  return { dir, file };
}

function run(dir, file, args) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', file, ...args], { encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status, out: String(e.stdout) };
  }
}

test('workflow --group 1 prints the path of the script it wrote, beside the ledger', () => {
  const { dir, file } = setup(plan());
  const { code, out } = run(dir, file, ['workflow', '--group', '1']);
  assert.equal(code, 0, out);
  const written = /^fankeel ledger — (.+)$/m.exec(out)[1];
  assert.equal(written, path.join(dir, '.fankeel', 'build', 'p', 'workflow-g1.js'));
  assert.match(fs.readFileSync(written, 'utf8'), /^export const meta = /);
  assert.match(out, /scriptPath/);
  assert.match(out, /1, 2, 3\.$/m);
});

test('the script it writes is workflowScript\'s output for that group, byte for byte', () => {
  const { dir, file } = setup(plan());
  assert.equal(run(dir, file, ['workflow', '--group', '1']).code, 0);
  const build = path.join(dir, '.fankeel', 'build', 'p');
  const written = fs.readFileSync(path.join(build, 'workflow-g1.js'), 'utf8');
  const briefs = {};
  for (const n of [1, 2, 3]) briefs[n] = path.join(build, 'task-' + n + '-brief.md');
  const direct = workflowScript(parseTasks(fs.readFileSync(file, 'utf8')), [1, 2, 3],
    { root: dir, plan: file, stem: 'p', group: 1, briefs });
  assert.equal(written, direct);
});

test('each brief it writes is the one brief <n> writes from nothing', () => {
  const { dir, file } = setup(plan());
  run(dir, file, ['workflow', '--group', '1']);
  for (const n of [1, 2, 3]) {
    const briefFile = path.join(dir, '.fankeel', 'build', 'p', 'task-' + n + '-brief.md');
    const fromWorkflow = fs.readFileSync(briefFile, 'utf8');
    fs.rmSync(briefFile);
    assert.equal(run(dir, file, ['brief', String(n)]).code, 0);
    assert.equal(fs.readFileSync(briefFile, 'utf8'), fromWorkflow, 'Task ' + n);
  }
});

test('it refuses a group that is not workflow, a group outside the plan, and no group at all', () => {
  const { dir, file } = setup(plan());
  const agent = run(dir, file, ['workflow', '--group', '2']);
  assert.equal(agent.code, 1);
  assert.match(agent.out, /group 2 is `agent`, not `workflow`/);
  const outside = run(dir, file, ['workflow', '--group', '3']);
  assert.equal(outside.code, 1);
  assert.match(outside.out, /--group 1\.\.2/);
  const none = run(dir, file, ['workflow']);
  assert.equal(none.code, 1);
  assert.match(none.out, /workflow wants --group/);
  assert.ok(!fs.existsSync(path.join(dir, '.fankeel', 'build', 'p', 'workflow-g2.js')));
});

test('it refuses a group sending fewer than two implementers', () => {
  const { dir, file } = setup(plan('in-session — one shell call.', 'in-session — one shell call.'));
  const { code, out } = run(dir, file, ['workflow', '--group', '1']);
  assert.equal(code, 1);
  assert.match(out, /sends 1 implementers, fewer than two/);
});

test('it writes a script for a group sending two implementers', () => {
  const { dir, file } = setup(plan(undefined, 'in-session — one shell call.'));
  const { code, out } = run(dir, file, ['workflow', '--group', '1']);
  assert.equal(code, 0, out);
  assert.match(out, /1, 2\.$/m);
});

test('it refuses a task with no model on its Dispatch line by name', () => {
  const { dir, file } = setup(plan('implementer — no model named.'));
  const { code, out } = run(dir, file, ['workflow', '--group', '1']);
  assert.equal(code, 1);
  assert.match(out, /Task 2/);
});

test('a brain build still gets the script, while groups still prints agents', () => {
  const { dir, file } = setup(plan());
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': ['build'] }));
  assert.match(run(dir, file, ['groups']).out, /1: 1, 2, 3 {2}— agents/);
  const { code, out } = run(dir, file, ['workflow', '--group', '1']);
  assert.equal(code, 0, out);
});
