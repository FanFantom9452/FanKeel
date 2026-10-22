'use strict';

// hooks/stop.js end to end: a real Stop payload against a project with a
// session record and a transcript on disk.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const mkTmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'stop.js');
const SESSION = 'aaaaaaaa-0000-4000-8000-0000000000f1';

function project(active) {
  const root = mkTmp('fankeel-stop-hook-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), JSON.stringify({
    task: 't', claims: [], stage: 'build', active, started: '2026-10-22T00:00:00.000Z', updated: new Date().toISOString(),
  }));
  const transcript = path.join(root, 'transcript.jsonl');
  fs.writeFileSync(transcript, JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: '等 station 遠端 session 收工' }] } }) + '\n');
  return { root, transcript };
}

function fire({ root, transcript }, extra) {
  return execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify(Object.assign({ session_id: SESSION, cwd: root, hook_event_name: 'Stop', stop_hook_active: false, transcript_path: transcript }, extra)),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: mkTmp('fankeel-cfg-') }),
  });
}

test('a stop with the build stage open and nothing pending is refused', () => {
  const out = JSON.parse(fire(project(true)));
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /build is open/);
});

test('a stop that already followed a refusal goes through', () => {
  assert.equal(fire(project(true), { stop_hook_active: true }), '');
});

test('a session with no active task prints nothing', () => {
  assert.equal(fire(project(false)), '');
});

test('the manifest runs stop.js on Stop', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude-plugin', 'plugin.json'), 'utf8'));
  const commands = manifest.hooks.Stop.flatMap((m) => m.hooks.map((h) => h.command));
  assert.ok(commands.some((c) => c.includes('hooks/stop.js')));
});
