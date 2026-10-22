'use strict';

// The desktop side of the phone channel
// (docs/90-agent/plans/2026-10-22-mobile-session-design.md §3): every prompt
// typed at the desktop is a `desktop` line, and takes the session back.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const phone = require('../lib/phone.js');

const INJECT = path.join(__dirname, '..', 'hooks', 'inject.js');
const MINE = 'aaaaaaaa-0000-4000-8000-0000000000c4';
const ago = (ms) => new Date(Date.now() - ms).toISOString();

function seed(over) {
  const root = tmp('fankeel-phone-inject-');
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, MINE + '.json'), JSON.stringify(Object.assign({
    task: 'rework the colour ramp', stage: 'design', active: true, started: ago(2 * 3600e3), updated: ago(3600e3),
  }, over), null, 2) + '\n');
  return root;
}

function fire(hook, root, payload) {
  return execFileSync(process.execPath, [hook], {
    input: JSON.stringify(Object.assign({ session_id: MINE, cwd: root }, payload)),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') }),
  });
}

test('a prompt typed at the desktop is a desktop line and takes the session back', () => {
  const root = seed({});
  phone.attach(root, MINE, 'my-pc', 1);
  fire(INJECT, root, { prompt: '先停一下', hook_event_name: 'UserPromptSubmit' });
  assert.deepEqual(phone.chat(root, MINE, 0).map((x) => [x.role, x.text]), [['desktop', '先停一下']]);
  assert.equal(phone.isAttached(root, MINE), false);
});

test('an inactive or init-only entry still records the prompt and detaches', () => {
  for (const over of [{ active: false }, { stage: 'init', task: undefined }]) {
    const root = seed(over);
    phone.attach(root, MINE, 'my-pc', 1);
    fire(INJECT, root, { prompt: '我回來了', hook_event_name: 'UserPromptSubmit' });
    assert.deepEqual(phone.chat(root, MINE, 0).map((x) => [x.role, x.text]), [['desktop', '我回來了']], JSON.stringify(over));
    assert.equal(phone.isAttached(root, MINE), false, JSON.stringify(over));
  }
});

test('a task notification and the phone\'s own message touch nothing', () => {
  for (const prompt of ['<task-notification>done</task-notification>', '（手機）跑吧']) {
    const root = seed({});
    phone.attach(root, MINE, 'my-pc', 1);
    fire(INJECT, root, { prompt, hook_event_name: 'UserPromptSubmit' });
    assert.deepEqual(phone.chat(root, MINE, 0), [], prompt);
    assert.equal(phone.isAttached(root, MINE), true, prompt);
  }
});
