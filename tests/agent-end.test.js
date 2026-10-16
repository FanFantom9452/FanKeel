'use strict';

// The Pane's agent tree tells a running subagent from a stopped one by the
// stops hooks/agent-end.js records: SubagentStop writes one, SubagentStart
// (a SendMessage starting a stopped agent again) takes it away.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const mkTmp = require('./tmp.js');
const { readEnds } = require('../lib/agentends.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'agent-end.js');
const SESSION = 'aaaaaaaa-0000-4000-8000-0000000000e1';

function project(active) {
  const root = mkTmp('fankeel-agent-end-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), JSON.stringify({
    task: 't', claims: [], stage: 'build', active, started: '2026-10-16T00:00:00.000Z', updated: new Date().toISOString(),
  }));
  return root;
}

function fire(root, event, id) {
  return execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: SESSION, cwd: root, hook_event_name: event, agent_id: id, agent_type: 'fankeel:fankeel-reader' }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: mkTmp('fankeel-cfg-') }),
  });
}

test('a SubagentStop records when the agent stopped, and its SubagentStart takes the record away', () => {
  const root = project(true);
  const before = Date.now();
  assert.equal(fire(root, 'SubagentStop', 'a1'), '');
  fire(root, 'SubagentStop', 'a2');
  const ended = readEnds(root, SESSION);
  assert.deepEqual(Object.keys(ended).sort(), ['a1', 'a2']);
  assert.ok(ended.a1 >= before && ended.a1 <= Date.now());
  assert.equal(fire(root, 'SubagentStart', 'a1'), '');
  assert.deepEqual(Object.keys(readEnds(root, SESSION)), ['a2']);
});

test('a session with no active task gets no file', () => {
  const root = project(false);
  fire(root, 'SubagentStop', 'a1');
  assert.equal(fs.existsSync(path.join(root, '.fankeel', 'build', 'agents-' + SESSION + '.json')), false);
});

test('the manifest runs agent-end.js on SubagentStart and on SubagentStop', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude-plugin', 'plugin.json'), 'utf8'));
  for (const event of ['SubagentStart', 'SubagentStop']) {
    const commands = manifest.hooks[event].flatMap((m) => m.hooks.map((h) => h.command));
    assert.ok(commands.some((c) => c.includes('hooks/agent-end.js')), event);
  }
});

test('stops landing at the same moment are all kept', async () => {
  const root = project(true);
  const lib = path.join(__dirname, '..', 'lib', 'agentends.js');
  const go = Date.now() + 400;
  const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
  // Each child spins to the same instant, then writes its stop.
  const code = (id) => 'const a=require(' + JSON.stringify(lib) + ');while(Date.now()<' + go + ');a.markEnded(' + JSON.stringify(root) + ',' + JSON.stringify(SESSION) + ',' + JSON.stringify(id) + ',Date.now())';
  await Promise.all(ids.map((id) => new Promise((resolve, reject) => {
    spawn(process.execPath, ['-e', code(id)], { stdio: 'inherit' }).on('exit', (c) => (c === 0 ? resolve() : reject(new Error(id + ' exited ' + c))));
  })));
  assert.deepEqual(Object.keys(readEnds(root, SESSION)).sort(), ids);
});
