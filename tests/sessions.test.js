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

// Shapes measured on real transcripts 2026-10-09: Claude Code wraps a hook
// denial as `PreToolUse:<Tool> hook error: fankeel: …`, the gate hook's refusal
// is bare, and a stop_hook_summary system line carries a hookErrors array.
test('--breakdowns counts the refusal and hook-error shapes real transcripts carry', async () => {
  const cfg = tmp('fankeel-sessions-');
  const dir = path.join(cfg, 'projects', 'p');
  const res = (content, t) => ({ type: 'user', timestamp: t, message: { content: [{ type: 'tool_result', tool_use_id: 'e', content }] } });
  writeTranscript(dir, 'x.jsonl', [
    res('PreToolUse:Write hook error: fankeel: build is a controlled stage — use fankeel-brain', '2026-10-09T01:00:00.000Z'),
    res('fankeel: gate not confirmed — stage.agents names `build`, but nothing was confirmed', '2026-10-09T01:01:00.000Z'),
    res('some other tool output mentioning fankeel: in the middle', '2026-10-09T01:02:00.000Z'),
    { type: 'system', subtype: 'stop_hook_summary', timestamp: '2026-10-09T01:03:00.000Z', hookInfos: [], hookErrors: [{}, {}] },
    { type: 'system', subtype: 'stop_hook_summary', timestamp: '2026-10-09T01:04:00.000Z', hookInfos: [], hookErrors: [] },
  ]);
  const result = await processFile(path.join(dir, 'x.jsonl'));
  assert.deepEqual(result.refused, [{ at: '2026-10-09T01:00:00.000Z' }, { at: '2026-10-09T01:01:00.000Z' }]);
  assert.deepEqual(result.hookErrors, [{ at: '2026-10-09T01:03:00.000Z' }, { at: '2026-10-09T01:03:00.000Z' }]);
});

// The four breakdowns the 2026-10-09 review asked to count on a project that
// is not fankeel: verify sent back to build, a task stood down before land, a
// tool call a fankeel hook refused, and a hook that timed out or failed. The
// shapes of the last two are the ones measured above; this proves the
// counting, and the week's run on another project is where the item shape
// inside a non-empty hookErrors gets checked, the one thing still assumed.
test('--breakdowns counts the four kinds per transcript, each with its time', async () => {
  const cfg = tmp('fankeel-sessions-');
  const dir = path.join(cfg, 'projects', 'p');
  const bash = (command, t) => ({ type: 'assistant', timestamp: t, message: { usage: { input_tokens: 1 }, content: [{ type: 'tool_use', id: 'b', name: 'Bash', input: { command } }] } });
  writeTranscript(dir, 'x.jsonl', [
    bash('node scripts/task.js start --session s --task t', '2026-10-09T01:00:00.000Z'),
    bash('node scripts/task.js stage survey --session s', '2026-10-09T01:30:00.000Z'),
    bash('node scripts/task.js stage build --session s', '2026-10-09T01:40:00.000Z'),
    bash('node scripts/task.js stage verify --session s', '2026-10-09T02:00:00.000Z'),
    bash('node scripts/task.js stage build --session s', '2026-10-09T03:00:00.000Z'),
    { type: 'user', timestamp: '2026-10-09T03:30:00.000Z', message: { content: [{ type: 'tool_result', tool_use_id: 'e', content: 'fankeel: `build` is not on stage.agents (survey) — no fankeel-brain here' }] } },
    { type: 'system', timestamp: '2026-10-09T03:40:00.000Z', content: 'UserPromptSubmit hook timed out after 5000ms' },
    bash('node scripts/task.js down --session s', '2026-10-09T04:00:00.000Z'),
  ]);
  const result = await processFile(path.join(dir, 'x.jsonl'));
  assert.deepEqual(result.backToBuild, [{ at: '2026-10-09T03:00:00.000Z' }]);
  assert.deepEqual(result.stoodDown, [{ at: '2026-10-09T04:00:00.000Z' }]);
  assert.deepEqual(result.refused, [{ at: '2026-10-09T03:30:00.000Z' }]);
  assert.deepEqual(result.hookErrors, [{ at: '2026-10-09T03:40:00.000Z' }]);
  const out = JSON.parse(execFileSync(process.execPath, [SCRIPT, '--config-dir', cfg, '--project', 'p', '--breakdowns'], { encoding: 'utf8' }));
  assert.equal(out.breakdowns.length, 1);
  assert.deepEqual(out.totals, { sessions: 1, backToBuild: 1, stoodDown: 1, refused: 1, hookErrors: 1 });
  // A task that lands is not stood down; a stood-down task still counts when a
  // later task in the same transcript lands.
  writeTranscript(dir, 'y.jsonl', [
    bash('node scripts/task.js start --session s --task t', '2026-10-09T05:00:00.000Z'),
    bash('node scripts/task.js stage land --session s', '2026-10-09T05:10:00.000Z'),
    bash('node scripts/task.js down --session s', '2026-10-09T05:20:00.000Z'),
  ]);
  assert.deepEqual((await processFile(path.join(dir, 'y.jsonl'))).stoodDown, []);
  writeTranscript(dir, 'w.jsonl', [
    bash('node scripts/task.js start --session s --task a', '2026-10-09T07:00:00.000Z'),
    bash('node scripts/task.js stage land --session s', '2026-10-09T07:10:00.000Z'),
    bash('node scripts/task.js down --session s', '2026-10-09T07:20:00.000Z'),
    bash('node scripts/task.js start --session s --task b', '2026-10-09T07:30:00.000Z'),
  ]);
  assert.deepEqual((await processFile(path.join(dir, 'w.jsonl'))).stoodDown, []);
  writeTranscript(dir, 'z.jsonl', [
    bash('node scripts/task.js start --session s --task a', '2026-10-09T06:00:00.000Z'),
    bash('node scripts/task.js down --session s', '2026-10-09T06:10:00.000Z'),
    bash('node scripts/task.js start --session s --task b', '2026-10-09T06:20:00.000Z'),
    bash('node scripts/task.js stage land --session s', '2026-10-09T06:30:00.000Z'),
  ]);
  assert.deepEqual((await processFile(path.join(dir, 'z.jsonl'))).stoodDown, [{ at: '2026-10-09T06:10:00.000Z' }]);
});
