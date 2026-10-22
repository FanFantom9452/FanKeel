'use strict';

// lib/stop.js: whether a main-session turn ending now leaves an open stage with
// nothing in the background to wake it (docs/90-agent/judgements/2026-10-22-stage-agent-pause.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mkTmp = require('./tmp.js');
const { refusal, pendingWork } = require('../lib/stop.js');

const asst = (...blocks) => ({ type: 'assistant', message: { role: 'assistant', content: blocks } });
const user = (content) => ({ type: 'user', message: { role: 'user', content } });
const bg = (id) => asst({ type: 'tool_use', id, name: 'Bash', input: { command: 'node scripts/await.js --session s', run_in_background: true } });
const note = (id) => user('<task-notification>\n<task-id>x</task-id>\n<tool-use-id>' + id + '</tool-use-id>\n<status>completed</status>\n</task-notification>');
const ACTIVE = { active: true, stage: 'build' };

function transcript(list) {
  const file = path.join(mkTmp('fankeel-stop-'), 't.jsonl');
  fs.writeFileSync(file, list.map((e) => JSON.stringify(e)).join('\n') + '\n');
  return file;
}

test('a turn ending on text with an open stage and nothing pending is refused', () => {
  const file = transcript([user('繼續'), asst({ type: 'text', text: '等 station 遠端 session 收工' })]);
  assert.match(refusal(ACTIVE, file), /build is open/);
});

test('a background Bash with no notification yet lets the stop through', () => {
  const file = transcript([user('go'), bg('toolu_bg'), user([{ type: 'tool_result', tool_use_id: 'toolu_bg', content: 'Command running in background' }])]);
  assert.equal(refusal(ACTIVE, file), null);
});

test('a background Bash whose notification arrived no longer counts', () => {
  const file = transcript([bg('toolu_bg'), note('toolu_bg'), asst({ type: 'text', text: '舊通知，沒有新內容' })]);
  assert.match(refusal(ACTIVE, file), /build is open/);
});

test('an async Agent is pending until its notification', () => {
  const launch = [
    asst({ type: 'tool_use', id: 'toolu_ag', name: 'Agent', input: { prompt: 'build' } }),
    user([{ type: 'tool_result', tool_use_id: 'toolu_ag', content: [{ type: 'text', text: 'Async agent launched successfully.' }] }]),
  ];
  assert.equal(pendingWork(launch), true);
  assert.equal(pendingWork([...launch, note('toolu_ag')]), false);
});

test('a foreground Agent that already returned is not pending', () => {
  assert.equal(pendingWork([
    asst({ type: 'tool_use', id: 'toolu_fg', name: 'Agent', input: { prompt: 'read' } }),
    user([{ type: 'tool_result', tool_use_id: 'toolu_fg', content: 'the reader found three lines' }]),
  ]), false);
});

test('a SendMessage with no notification after it is pending', () => {
  const sent = asst({ type: 'tool_use', id: 'toolu_sm', name: 'SendMessage', input: { to: 'a1', message: 'go on' } });
  assert.equal(pendingWork([note('toolu_old'), sent]), true);
  assert.equal(pendingWork([sent, note('toolu_old')]), false);
});

test('no active task, no stage, an away user or an unreadable transcript lets the stop through', () => {
  const file = transcript([asst({ type: 'text', text: 'done' })]);
  assert.equal(refusal(null, file), null);
  assert.equal(refusal({ active: false, stage: 'build' }, file), null);
  assert.equal(refusal({ active: true }, file), null);
  assert.equal(refusal({ active: true, stage: 'plan', awayAt: Date.now() }, file), null);
  assert.equal(refusal(ACTIVE, path.join(mkTmp('fankeel-stop-'), 'missing.jsonl')), null);
});
