'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');
const todo = require('../lib/todo.js');
const registry = require('../lib/registry.js');
const { main } = require('../scripts/gate-check.js');

const ID = 'cccccccc-0000-4000-8000-000000000003';
const TICKS = '`'.repeat(3);
const GATE = { questions: [{ header: '下一站', question: 'plan?', multiSelect: false, options: [{ label: 'plan', description: 'a' }, { label: 'stay', description: 'b' }, { label: 'pause', description: 'c' }] }], next: 'plan' };

test('gate-check refuses a patrol survey report that skips an open entry', () => {
  const dir = tmp('fankeel-gcpatrol-');
  fs.mkdirSync(path.join(dir, '.fankeel', 'sessions'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs', 'todo'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [
    { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
  todo.add(dir, { label: 'a', title: 'one', description: 'first', state: 'ready' });
  todo.add(dir, { label: 'b', title: 'two', description: 'second', state: 'ready' });
  const [first, second] = todo.load(dir).all;
  fs.writeFileSync(path.join(dir, '.fankeel', 'sessions', ID + '.json'), JSON.stringify({
    task: 'TODO 全表盤點', stage: 'survey', route: ['survey', 'plan', 'build', 'verify', 'land'], active: true, started: '2026-10-17T00:00:00.000Z' }));
  const f = path.join(dir, 'survey.md');
  const write = (report) => fs.writeFileSync(f, report + '\n\n' + TICKS + 'json gate\n' + JSON.stringify(GATE) + '\n' + TICKS + '\n');
  write('- ' + first.id + ' — do now');
  const bad = main([f, '--session', ID, '--root', dir]);
  assert.equal(bad.code, 1, bad.text);
  assert.match(bad.text, new RegExp(second.id));
  write('- ' + first.id + ' — do now\n- ' + second.id + ' — waiting on upstream');
  const good = main([f, '--session', ID, '--root', dir]);
  assert.equal(good.code, 0, good.text);
  assert.ok(registry.readSession(dir, ID));
});

// hooks/gate.js needs a controlled stage, a profile and a live gate hash to
// reach its readGate call; this holds the one argument this task adds there.
test('hooks/gate.js passes the patrol list to its controlled readGate', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'gate.js'), 'utf8');
  assert.match(src, /ids: todo\.ids, patrol: patrolEntries\(root, mine\) \}/);
});
