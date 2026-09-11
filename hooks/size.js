#!/usr/bin/env node
'use strict';

// PostToolUse，沒有 matcher——機上每個工具、每個 session 都會觸發。09-11 的量測
// （docs/reports/2026-09-11-hook-payload-probe.md 之前、scripts/sessions.js 的
// 09-11 量測）顯示主 session 自己的工具輸出才是 context 堆疊的大宗，多過 subagent
// 回傳；所以提醒放在來源，不是放在派工那一側。
//
// 同樣兩條規則：每條路徑都 exit 0，對不在模式裡的 session 不花任何成本。
// `agent_id` 有值代表這是在 subagent 內觸發的——docs/reports/2026-09-11-hook-payload-probe.md
// 是這個欄位真的會出現這件事被核對過的地方——一個 subagent 自己的輸出進了它自己的
// context 不是這裡要提醒的事，所以那裡不說話。

const registry = require('../lib/registry.js');
const live = require('../lib/live.js');
const { run, parse } = require('../lib/hook.js');
const fs = require('node:fs');
const path = require('node:path');

const THRESHOLD = 20000;

// `tool_response` 不是每個工具都同一個形狀——有的是字串，有的是帶
// content／stdout／stderr 的物件。這裡照可能的形狀各讀一次，讀不出來才退回量
// JSON 本身的長度，而不是猜一個零。
function responseText(response) {
  if (response == null) return '';
  if (typeof response === 'string') return response;
  if (Array.isArray(response)) return response.map(responseText).join('');
  if (typeof response === 'object') {
    if (typeof response.text === 'string') return response.text;
    if (Array.isArray(response.content)) return response.content.map(responseText).join('');
    if (typeof response.stdout === 'string' || typeof response.stderr === 'string') {
      return (response.stdout || '') + (response.stderr || '');
    }
    try { return JSON.stringify(response); } catch (e) { return ''; }
  }
  return String(response);
}

// 一個 session 一個標記檔，存的是上次講話時這個任務的 `updated`。`updated` 一個
// prompt 只變一次——只有 hooks/inject.js 和 hooks/resume.js 會寫它——所以標記檔
// 還等於現在的 `updated`，就代表還是同一個 prompt。
function markerFile(configDir, sessionId) {
  return configDir ? path.join(configDir, 'fankeel', 'size', sessionId + '.marker') : null;
}

function alreadySpoke(configDir, sessionId, stamp) {
  const file = markerFile(configDir, sessionId);
  if (!file) return false;
  try { return fs.readFileSync(file, 'utf8') === stamp; } catch (e) { return false; }
}

function markSpoke(configDir, sessionId, stamp) {
  const file = markerFile(configDir, sessionId);
  if (!file) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, stamp);
  } catch (e) { /* housekeeping */ }
}

function main(raw) {
  const payload = parse(raw);
  if (!payload) return;
  if (payload.agent_id) return;

  const root = registry.rootFor(payload);
  const mine = registry.readSession(root, payload.session_id);
  if (!mine || mine.active !== true) return;

  const text = responseText(payload.tool_response);
  if (text.length <= THRESHOLD) return;

  const stamp = typeof mine.updated === 'string' ? mine.updated : '';
  const configDir = live.liveConfigDir();
  if (stamp && alreadySpoke(configDir, payload.session_id, stamp)) return;
  if (stamp) markSpoke(configDir, payload.session_id, stamp);

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: (payload.tool_name || 'a tool') + ' returned ' + text.length
        + ' chars into this context — pipe it or send a fankeel-reader next time',
    },
  }));
}

// 刻意沉默。漏掉一次提醒不會多花一個 session 本來就要付的成本；一個會丟例外的
// hook 才會賠上它接在後面的那次工具呼叫。
run(main);
