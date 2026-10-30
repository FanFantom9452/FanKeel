'use strict';

// PreToolUse on AskUserQuestion, for a session with a judgement waiting on a
// person (`ask human:`, lib/askhuman.js). Run as a process, the way gate.test.js
// runs hooks/gate.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(ROOT, 'hooks', 'gate.js');

const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const ago = (ms) => new Date(Date.now() - ms).toISOString();

function seed(root) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = { task: 'rework the colour ramp', stage: 'design', active: true, started: ago(2 * 3600e3), updated: ago(3600e3) };
  fs.writeFileSync(path.join(dir, MINE + '.json'), JSON.stringify(data, null, 2) + '\n');
}

// A judgement record as judge.js writes it: frontmatter, the judge's text, and
// an `ask human:` block of two questions (lib/askhuman.js's own shape).
function judgement(root, { answered = false } = {}) {
  const text = [
    '---',
    'judged: 2026-10-30T09:00:00.000Z',
    'model: fable',
    'agent: fankeel-judge',
    'task: "rework the colour ramp"',
    'session: ' + MINE,
    'stage: design',
    'human: yes',
    '---',
    '',
    '# Which ramp?',
    '',
    'pick: 拿掉',
    '',
    'ask human:',
    '  - q: 要不要留舊路徑？',
    '    option: 留著 → 分支甲',
    '      pro: 老客戶不壞',
    '      con: 多一條維護線',
    '    option: 拿掉 (assumed)',
    '      pro: 老客戶不壞',
    '      con: 多一條維護線',
    '    reason: 只有產品負責人知道',
    '  - q: 色票用哪一組？',
    '    option: 暖色 → 走 warm',
    '      pro: 偏暖',
    '      con: 偏黃',
    '    option: 冷色 (assumed)',
    '      pro: 偏冷',
    '      con: 偏藍',
    '    reason: 色彩偏好只有設計師知道',
    '',
  ].join('\n') + (answered ? '\n## 人類的回答\n\nanswered: 2026-10-30T10:00:00.000Z\n' : '');
  const dir = path.join(root, 'docs', 'judgements');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '2026-10-30-ramp.md'), text);
}

const option = (label, description) => ({ label, description });

// What the controller asks when it copies the judgement's `questions` JSON.
const VERBATIM = [
  {
    question: '要不要留舊路徑？（無路徑可答：只有產品負責人知道）',
    header: '判官 1/2',
    multiSelect: false,
    options: [option('留著', '→ 分支甲'), option('拿掉', '判決假設這個 — 照 pick:')],
  },
  {
    question: '色票用哪一組？（無路徑可答：色彩偏好只有設計師知道）',
    header: '判官 2/2',
    multiSelect: false,
    options: [option('暖色', '→ 走 warm'), option('冷色', '判決假設這個 — 照 pick:')],
  },
];

// The same two questions, retyped: the wording moved, the options did not.
const PARAPHRASE = JSON.parse(JSON.stringify(VERBATIM));
PARAPHRASE[0].question = '要不要把舊路徑留下？（無路徑可答：只有產品負責人知道）';
PARAPHRASE[1].question = '色票要用哪一組？（無路徑可答：色彩偏好只有設計師知道）';

const UNRELATED = [{
  question: '今天要帶傘出門嗎？',
  header: 'Survey',
  multiSelect: false,
  options: [option('帶', 'a'), option('不帶', 'b')],
}];

function ask(root, questions) {
  return execFileSync(process.execPath, [GATE], {
    input: JSON.stringify({
      session_id: MINE,
      cwd: root,
      tool_name: 'AskUserQuestion',
      tool_input: { questions },
    }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
  });
}

const refusal = (out) => {
  const parsed = out.trim() ? JSON.parse(out) : null;
  return parsed && parsed.hookSpecificOutput && parsed.hookSpecificOutput.permissionDecision === 'deny'
    ? parsed.hookSpecificOutput.permissionDecisionReason
    : null;
};

test('a verbatim copy of the judgement questions goes out with no refusal and no gate message', () => {
  const root = tmp('fankeel-gate-askhuman-');
  seed(root);
  judgement(root);
  const out = ask(root, VERBATIM);
  assert.equal(refusal(out), null, out);
  assert.doesNotMatch(out, /gate not confirmed/);
});

test('a paraphrase of the judgement questions is refused, naming the record file', () => {
  const root = tmp('fankeel-gate-askhuman-');
  seed(root);
  judgement(root);
  const reason = refusal(ask(root, PARAPHRASE));
  assert.ok(reason, 'expected a refusal');
  assert.ok(reason.includes(path.join('docs', 'judgements', '2026-10-30-ramp.md')), reason);
  assert.match(reason, /questions` JSON verbatim/);
});

test('a question unrelated to the judgement falls through to the old behaviour', () => {
  const root = tmp('fankeel-gate-askhuman-');
  seed(root);
  judgement(root);
  const bare = tmp('fankeel-gate-askhuman-bare-');
  seed(bare);
  const out = ask(root, UNRELATED);
  assert.equal(refusal(out), null, out);
  assert.equal(out, ask(bare, UNRELATED));
});

test('no pending judgement, or one already answered, lets a paraphrase fall through', () => {
  const none = tmp('fankeel-gate-askhuman-');
  seed(none);
  assert.equal(refusal(ask(none, PARAPHRASE)), null);

  const answered = tmp('fankeel-gate-askhuman-');
  seed(answered);
  judgement(answered, { answered: true });
  const out = ask(answered, PARAPHRASE);
  assert.equal(refusal(out), null, out);
  assert.doesNotMatch(out, /docs[\\/]judgements/);
});
