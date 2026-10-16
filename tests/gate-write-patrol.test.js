'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const todo = require('../lib/todo.js');
const { handoffPath } = require('../lib/handoff.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'gate-write.js');
const MINE = 'dddddddd-0000-4000-8000-000000000004';
const AGENT = 'b7e1d0';
const TICKS = '`'.repeat(3);
const GATE = { questions: [{ header: '下一站', question: 'plan?', multiSelect: false, options: [{ label: 'plan', description: 'a' }, { label: 'stay', description: 'b' }, { label: 'pause', description: 'c' }] }], next: 'plan' };

test('a patrol stage agent writing a report that skips an entry hears which one', () => {
  const root = tmp('fankeel-gwpatrol-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'todo'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [
    { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
  todo.add(root, { label: 'a', title: 'one', description: 'first', state: 'ready' });
  todo.add(root, { label: 'b', title: 'two', description: 'second', state: 'ready' });
  const [first, second] = todo.load(root).all;
  const data = { task: 'TODO 全表盤點', stage: 'survey', route: ['survey', 'plan', 'build', 'verify', 'land'], active: true,
    started: '2026-10-17T00:00:00.000Z', inflight: { stage: 'survey', at: 1758000000000, agentId: AGENT } };
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), JSON.stringify(data));
  const file = handoffPath(root, data, 'survey');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '- ' + first.id + ' — do now\n\n' + TICKS + 'json gate\n' + JSON.stringify(GATE) + '\n' + TICKS + '\n');
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: MINE, cwd: root, hook_event_name: 'PostToolUse', tool_name: 'Write', agent_id: AGENT, tool_input: { file_path: file } }),
    encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
  });
  const said = JSON.parse(out).hookSpecificOutput.additionalContext;
  assert.match(said, /invalid at report/);
  assert.match(said, new RegExp(second.id));
});
