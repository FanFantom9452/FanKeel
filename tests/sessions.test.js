'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'sessions.js');
// Literal-string require (not the SCRIPT variable) so tests/source.test.js's
// static import scan — which only follows require() calls with a quoted
// string literal — sees every one of these five names as imported once
// scripts/sessions.js is tracked.
const { parseArgs, dirFor, percentile, processFile, main } = require('../scripts/sessions.js');
const tmp = require('./tmp.js');

// 一個最小的 transcript：一則 assistant 訊息帶 usage，一則 user 訊息帶
// task-notification，讓 peakContext 與 subagentChars 都不是零。
function writeTranscript(dir, name, lines) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
}

test('--config-dir and --project point sessions.js at a fixture directory', () => {
  const cfg = tmp('fankeel-sessions-');
  const dir = path.join(cfg, 'projects', 'my-project');
  writeTranscript(dir, 'a.jsonl', [
    { type: 'assistant', message: { usage: { input_tokens: 1000, cache_read_input_tokens: 500 }, content: [] } },
    { type: 'user', message: { content: '<task-notification>x</task-notification>' } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'read-1', content: 'x'.repeat(20001) }] } },
  ]);
  const out = execFileSync(process.execPath, [SCRIPT, '--config-dir', cfg, '--project', 'my-project'], { encoding: 'utf8' });
  const payload = JSON.parse(out);
  assert.equal(payload.out.totalSessions, 1);
  assert.equal(payload.out.medianPeak, 1500);
  assert.equal(payload.out.sumBigToolResults, 1);
  assert.equal(payload.out.bigPerSession, 1);
});

test('--since drops transcripts last written before that day', () => {
  const cfg = tmp('fankeel-sessions-');
  const dir = path.join(cfg, 'projects', 'p');
  writeTranscript(dir, 'old.jsonl', [{ type: 'assistant', message: { usage: { input_tokens: 10 }, content: [] } }]);
  const old = new Date('2020-01-01T00:00:00Z');
  fs.utimesSync(path.join(dir, 'old.jsonl'), old, old);
  writeTranscript(dir, 'new.jsonl', [{ type: 'assistant', message: { usage: { input_tokens: 20 }, content: [] } }]);
  const out = JSON.parse(execFileSync(process.execPath, [SCRIPT, '--config-dir', cfg, '--project', 'p', '--since', '2021-01-01'], { encoding: 'utf8' }));
  assert.equal(out.out.totalSessions, 1);
  assert.equal(out.out.medianPeak, 20);
});

test('percentile and processFile are exported for a fixture-driven test, not only the CLI', async () => {
  assert.equal(percentile([1, 2, 3, 4], 50), 3);
  assert.equal(percentile([], 50), 0);

  const dir = tmp('fankeel-sessions-fixture-');
  const file = path.join(dir, 'fixture.jsonl');
  fs.writeFileSync(file, [
    JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 5 }, content: [] } }),
    JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'r-1', content: 'y'.repeat(20001) }] } }),
  ].join('\n') + '\n');
  const result = await processFile(file);
  assert.equal(result.bigToolResults, 1);
});

test('parseArgs and dirFor compose the fixture directory from flags', () => {
  const cfg = tmp('fankeel-sessions-args-');
  const opts = parseArgs(['--config-dir', cfg, '--project', 'p2', '--since', '2024-06-01']);
  assert.equal(opts.configDir, cfg);
  assert.equal(opts.project, 'p2');
  assert.equal(opts.since, Date.parse('2024-06-01'));
  assert.equal(dirFor(opts), path.join(cfg, 'projects', 'p2'));
});

test('a main-session tool_result of exactly 20,000 chars is not counted as big', async () => {
  const dir = tmp('fankeel-sessions-boundary-');
  const file = path.join(dir, 'boundary.jsonl');
  fs.writeFileSync(file, [
    JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 1 }, content: [] } }),
    JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'r-2', content: 'z'.repeat(20000) }] } }),
  ].join('\n') + '\n');
  const result = await processFile(file);
  assert.equal(result.bigToolResults, 0);
});

test('a subagent tool_result of 25,000 chars is not counted as big', async () => {
  const dir = tmp('fankeel-sessions-subagent-');
  const file = path.join(dir, 'subagent.jsonl');
  fs.writeFileSync(file, [
    JSON.stringify({
      type: 'assistant',
      message: {
        usage: { input_tokens: 1 },
        content: [{ type: 'tool_use', id: 'agent-1', name: 'Agent', input: {} }],
      },
    }),
    JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'agent-1', content: 'w'.repeat(25000) }] } }),
  ].join('\n') + '\n');
  const result = await processFile(file);
  assert.equal(result.bigToolResults, 0);
});

test('main is exported and returns fankeelSessions from a session that ran task.js start', async () => {
  const cfg = tmp('fankeel-sessions-main-');
  const dir = path.join(cfg, 'projects', 'q');
  writeTranscript(dir, 'a.jsonl', [
    {
      type: 'assistant',
      message: {
        usage: { input_tokens: 42 },
        content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'node scripts/task.js start' } }],
      },
    },
  ]);
  const out = JSON.parse(await main(['--config-dir', cfg, '--project', 'q']));
  assert.equal(out.out.totalSessions, 1);
  assert.equal(out.out.fankeelSessions, 1);
});
