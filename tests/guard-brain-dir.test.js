'use strict';

// brief-1: two group brains of one build wrote into another session's
// `.fankeel/build/task-*/`. The cause could not be pinned from the source, so
// the wrong directory is refused instead: a brain's Write lands only in the
// directory `dirFor` gives for its own session's record.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { brainWriteReason } = require('../lib/guard.js');
const mkTmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'guard.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const STARTED = '2026-09-29T13:50:57.123Z';
const OWN = 'task-20260929T135057';
const OTHER = 'task-20260929T120000';

function seed(root) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = { task: 'ready four', stage: 'build', active: true, started: STARTED, updated: STARTED };
  fs.writeFileSync(path.join(dir, MINE + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

function run(root, payload) {
  return execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: mkTmp('fankeel-guard-brain-cfg-') }),
  });
}

const write = (root, file, agentType) => ({
  session_id: MINE,
  cwd: root,
  agent_id: 'b1',
  agent_type: agentType,
  tool_name: 'Write',
  tool_input: { file_path: file, content: 'x' },
});

const inBuild = (root, dir) => path.join(root, '.fankeel', 'build', dir, 'prefix-g2.md');
const decisionOf = (out) => JSON.parse(out).hookSpecificOutput.permissionDecision;
const reasonOf = (out) => JSON.parse(out).hookSpecificOutput.permissionDecisionReason;

test('a brain\'s Write into another session\'s task directory is denied, naming both directories', () => {
  const root = mkTmp('fankeel-guard-brain-');
  seed(root);
  const out = run(root, write(root, inBuild(root, OTHER), 'fankeel:fankeel-brain'));
  assert.equal(decisionOf(out), 'deny');
  assert.match(reasonOf(out), new RegExp(OTHER));
  assert.match(reasonOf(out), new RegExp(OWN));
});

test('a brain\'s Write into its own session\'s task directory is let through', () => {
  const root = mkTmp('fankeel-guard-brain-');
  seed(root);
  assert.equal(run(root, write(root, inBuild(root, OWN), 'fankeel:fankeel-brain')), '');
});

test('the bare name fankeel-brain is held to the same rule', () => {
  const root = mkTmp('fankeel-guard-brain-');
  seed(root);
  assert.equal(decisionOf(run(root, write(root, inBuild(root, OTHER), 'fankeel-brain'))), 'deny');
});

test('another agent type, or a brain writing outside .fankeel/build/task-*/, is not this rule\'s business', () => {
  const root = mkTmp('fankeel-guard-brain-');
  seed(root);
  assert.equal(run(root, write(root, inBuild(root, OTHER), 'fankeel:fankeel-verifier')), '');
  assert.equal(run(root, write(root, path.join(root, 'notes.md'), 'fankeel:fankeel-brain')), '');
  assert.equal(run(root, write(root, path.join(root, '.fankeel', 'build', '2026-09-29-ready-four', 'progress.md'), 'fankeel:fankeel-brain')), '');
});

test('a record with no started stamp has no directory of its own, so every task directory is refused', () => {
  const root = mkTmp('fankeel-guard-brain-');
  const reason = brainWriteReason({ agentType: 'fankeel:fankeel-brain', root, file: inBuild(root, OWN), mine: {} });
  assert.match(reason, /\(none/);
  assert.equal(brainWriteReason({ agentType: 'fankeel:fankeel-brain', root, file: inBuild(root, OWN), mine: { started: STARTED } }), null);
});
