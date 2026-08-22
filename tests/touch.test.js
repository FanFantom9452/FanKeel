'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const registry = require('../lib/registry.js');
const HOOK = path.join(__dirname, '..', 'hooks', 'touch.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-touch-'));

function seed(root, sessionId, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({
    task: 'fix the ramp', scope: ['web'], stage: 'build', active: true,
    started: new Date(Date.now() - 3600e3).toISOString(),
    updated: new Date().toISOString(),
  }, over);
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

// The real hook, driven the way Claude Code drives it. CLAUDE_PROJECT_DIR is set
// explicitly rather than inherited: a stray one from the session running these
// tests would send the hook off to read a different repository's registry.
function run(root, payload) {
  const env = Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root });
  return execFileSync(process.execPath, [HOOK], { input: JSON.stringify(payload), env, encoding: 'utf8' });
}

const edit = (root, file, session) => ({
  session_id: session || MINE, cwd: root,
  tool_name: 'Edit', tool_input: { file_path: path.join(root, file) },
});

test('an edit outside the declared scope is recorded', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  run(root, edit(root, 'api/routes.js'));
  assert.deepEqual(registry.readSession(root, MINE).drift, ['api/routes.js']);
});

test('an edit inside the declared scope writes nothing at all', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  const before = fs.readFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), 'utf8');
  run(root, edit(root, 'web/page.js'));
  assert.equal(fs.readFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), 'utf8'), before);
});

test('NotebookEdit carries its path under another key', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  run(root, {
    session_id: MINE, cwd: root, tool_name: 'NotebookEdit',
    tool_input: { notebook_path: path.join(root, 'api/explore.ipynb') },
  });
  assert.deepEqual(registry.readSession(root, MINE).drift, ['api/explore.ipynb']);
});

test('a file outside the registry root is not this registry\'s business', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  run(root, { session_id: MINE, cwd: root, tool_name: 'Edit', tool_input: { file_path: path.join(os.tmpdir(), 'elsewhere.js') } });
  assert.equal(registry.readSession(root, MINE).drift, undefined);
});

test('a session with no entry is left alone', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  run(root, edit(root, 'api/routes.js'));
  assert.equal(fs.readdirSync(path.join(root, '.fankeel', 'sessions')).length, 0);
});

test('a stood-down entry records nothing', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'], active: false });
  run(root, edit(root, 'api/routes.js'));
  assert.equal(registry.readSession(root, MINE).drift, undefined);
});

test('it exits 0 on a malformed payload and on a tool with no path', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  const env = Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root });
  execFileSync(process.execPath, [HOOK], { input: 'not json', env, encoding: 'utf8' });
  run(root, { session_id: MINE, cwd: root, tool_name: 'Bash', tool_input: { command: 'ls' } });
  assert.equal(registry.readSession(root, MINE).drift, undefined);
});
