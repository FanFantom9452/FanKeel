'use strict';

// gate-14: after 要離開 the work goes on until the next question that needs
// the user. That question is held (hooks/gate.js), the session compacts when
// that turn ends (hooks/compact.ts), and the user's next real message has it
// asked again (hooks/inject.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(ROOT, 'hooks', 'gate.js');
const INJECT = path.join(ROOT, 'hooks', 'inject.js');
const MINE = 'aaaaaaaa-0000-4000-8000-0000000000b2';
const ago = (ms) => new Date(Date.now() - ms).toISOString();

function seed(over) {
  const root = tmp('fankeel-hold-');
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, MINE + '.json'), JSON.stringify(Object.assign({
    task: 'rework the colour ramp', stage: 'design', active: true, started: ago(2 * 3600e3), updated: ago(3600e3),
  }, over), null, 2) + '\n');
  return root;
}

const entry = (root) => JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), 'utf8'));

function fire(hook, root, payload) {
  return execFileSync(process.execPath, [hook], {
    input: JSON.stringify(Object.assign({ session_id: MINE, cwd: root }, payload)),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') }),
  });
}

const ASK = {
  tool_name: 'AskUserQuestion',
  tool_input: { questions: [{ question: 'Which ramp?', header: 'design', multiSelect: false,
    options: [{ label: 'warm', description: 'a' }, { label: 'cool', description: 'b' }] }] },
};

test('a question asked after 要離開 is held: denied with what to do, and awayAt is written', () => {
  const root = seed({ leavingAt: Date.now() - 1000 });
  const out = JSON.parse(fire(GATE, root, ASK));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  const reason = out.hookSpecificOutput.permissionDecisionReason;
  assert.match(reason, /held, not asked/);
  assert.match(reason, /written out as text/);
  assert.match(reason, /ask it again with AskUserQuestion/);
  assert.ok(Number.isFinite(entry(root).awayAt));
});

test('without leavingAt the same question goes out and no awayAt is written', () => {
  const root = seed({});
  const out = fire(GATE, root, ASK);
  assert.doesNotMatch(out, /held, not asked/);
  assert.equal(entry(root).awayAt, undefined);
});

test('the user\'s next message clears both marks and asks for the held question', () => {
  const root = seed({ leavingAt: 1, awayAt: 2 });
  const out = JSON.parse(fire(INJECT, root, { prompt: '回來了' }));
  assert.match(out.hookSpecificOutput.additionalContext, /the user is back\. Before anything else, ask again/);
  assert.equal(entry(root).awayAt, undefined);
  assert.equal(entry(root).leavingAt, undefined);
});

test('a background task notification is not the user: both marks stay and nothing is asked', () => {
  const root = seed({ leavingAt: 1, awayAt: 2 });
  const out = fire(INJECT, root, { prompt: '<task-notification>\n<task-id>b1</task-id>\n</task-notification>' });
  assert.doesNotMatch(out, /the user is back/);
  assert.equal(entry(root).awayAt, 2);
  assert.equal(entry(root).leavingAt, 1);
});

test('a real message with only leavingAt clears it and asks nothing', () => {
  const root = seed({ leavingAt: 1 });
  const out = fire(INJECT, root, { prompt: 'still here' });
  assert.doesNotMatch(out, /the user is back/);
  assert.equal(entry(root).leavingAt, undefined);
});

test('the compaction summary keeps the held question, and the plugin-scripts line stays last', async () => {
  const { instructionsFor } = await import(pathToFileURL(path.join(ROOT, 'hooks', 'compact.ts')).href);
  const live = { task: 'demo', stage: 'build', class: 'bounded', active: true };
  const held = instructionsFor(MINE, { ...live, awayAt: 1 }, 'F:/plugin').split('\n');
  assert.ok(held.some((l) => /the question held back while the user was away, word for word/.test(l)), held.join(' | '));
  assert.equal(held[held.length - 1], '- the plugin scripts live under F:/plugin/scripts');
  const plain = instructionsFor(MINE, live, 'F:/plugin');
  assert.doesNotMatch(plain, /held back/);
});
