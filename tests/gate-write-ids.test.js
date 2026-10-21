'use strict';

// gate-16: hooks/gate-write.js ran readGate with no `ids`, so a gate naming a
// TODO entry by its id passed when the brain wrote it and was refused only
// when the controller asked it, twice in the 2026-10-21 patrol.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const todo = require('../lib/todo.js');
const { handoffPath } = require('../lib/handoff.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'gate-write.js');
const MINE = 'eeeeeeee-0000-4000-8000-000000000005';
const AGENT = 'c8f2e1';
const TICKS = '`'.repeat(3);

function written(question) {
  const root = tmp('fankeel-gwids-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'todo'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [
    { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
  todo.add(root, { label: 'a', title: '修好一件事', description: 'first', state: 'ready' });
  const [entry] = todo.load(root).all;
  const data = { task: 'fix one', stage: 'survey', route: ['survey', 'plan'], active: true,
    started: '2026-10-21T00:00:00.000Z', inflight: { stage: 'survey', at: 1758000000000, agentId: AGENT } };
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), JSON.stringify(data));
  const gate = { questions: [{ header: '下一站', question: question(entry), multiSelect: false,
    options: [{ label: 'plan', description: 'a' }, { label: 'stay', description: 'b' }, { label: 'pause', description: 'c' }] }], next: 'plan' };
  const file = handoffPath(root, data, 'survey');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'report\n\n' + TICKS + 'json gate\n' + JSON.stringify(gate) + '\n' + TICKS + '\n');
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: MINE, cwd: root, hook_event_name: 'PostToolUse', tool_name: 'Write', agent_id: AGENT, tool_input: { file_path: file } }),
    encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
  });
  return { out, entry };
}

test('a gate naming a TODO entry by its bare id is flagged when it is written', () => {
  const { out, entry } = written((e) => '先做 ' + e.id + ' 嗎？');
  const said = JSON.parse(out).hookSpecificOutput.additionalContext;
  assert.match(said, /stands where its name should be/);
  assert.match(said, new RegExp('"' + entry.id + '"'));
});

test('the same gate naming the entry by its title produces nothing', () => {
  const { out } = written((e) => '先做「' + e.title + '」嗎？');
  assert.equal(out, '');
});
