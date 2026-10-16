'use strict';

// hooks/gate.js on a patrol's controlled survey: the controller's copy of a
// report that skips an open TODO entry is denied before the question goes out.
// Run as a process, the way tests/gate.test.js runs the same hook.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tmp = require('./tmp.js');
const todo = require('../lib/todo.js');
const { handoffPath } = require('../lib/handoff.js');

const GATE = path.join(__dirname, '..', 'hooks', 'gate.js');
const MINE = 'eeeeeeee-0000-4000-8000-000000000005';
const TICKS = '`'.repeat(3);
const QUESTIONS = [{ header: '下一站', question: 'plan?', multiSelect: false, options: [
  { label: 'plan', description: 'a' }, { label: '留在 survey', description: 'b' }, { label: '暫停', description: 'c' }] }];

function patrol() {
  const root = tmp('fankeel-gatepatrol-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'todo'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [
    { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
  fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'true' }));
  todo.add(root, { label: 'a', title: 'one', description: 'first', state: 'ready' });
  todo.add(root, { label: 'b', title: 'two', description: 'second', state: 'ready' });
  const data = { task: 'TODO 全表盤點', stage: 'survey', route: ['survey', 'plan', 'build', 'verify', 'land'], active: true,
    started: '2026-10-17T00:00:00.000Z', updated: new Date().toISOString(), configDir: tmp('fankeel-gatepatrol-cfg-') };
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), JSON.stringify(data));
  return { root, data, entries: todo.load(root).all };
}

function ask(root, data, report) {
  const file = handoffPath(root, data, 'survey');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, report + '\n\n' + TICKS + 'json gate\n' + JSON.stringify({ questions: QUESTIONS, next: 'plan' }) + '\n' + TICKS + '\n');
  return execFileSync(process.execPath, [GATE], {
    input: JSON.stringify({ session_id: MINE, cwd: root, tool_name: 'AskUserQuestion', tool_input: { questions: JSON.parse(JSON.stringify(QUESTIONS)) } }),
    encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
  }).trim();
}

test('the controller\'s copy of a patrol report that skips an entry is denied, naming it', () => {
  const { root, data, entries: [first, second] } = patrol();
  const out = JSON.parse(ask(root, data, '- ' + first.id + ' — do now'));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /report/);
  assert.match(out.hookSpecificOutput.permissionDecisionReason, new RegExp(second.id));
});

test('a patrol report naming every open entry goes out', () => {
  const { root, data, entries: [first, second] } = patrol();
  const out = ask(root, data, '- ' + first.id + ' — do now\n- ' + second.id + ' — waiting on upstream');
  assert.equal(out ? JSON.parse(out).hookSpecificOutput : undefined, undefined, out);
});
