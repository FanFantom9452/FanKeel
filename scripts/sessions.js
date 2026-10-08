#!/usr/bin/env node
'use strict';

// 升格自 .fankeel/build/ask/measure-sessions.js（09-11 一次性量測腳本）。09-11 的
// 那張表——峰值中位數與 p90、subagent 回傳佔比、倒退次數——現在是這支腳本的輸出，
// 而不是一次跑完就丟的手稿：09-18 拿掉主 session 大輸出提醒的那個 PostToolUse hook
// 前，就是靠這支腳本改前跑一次、改後跑一次比較，量出 bigPerSession 不降反升。

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { parseArgs: parseArgv } = require('node:util');

const FULL_ROUTE = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
const routeIndex = new Map(FULL_ROUTE.map((s, i) => [s, i]));
// 拿掉的那個提醒 hook 用的同一個門檻：改前改後量的就是它曾經提醒的那一種輸出。
const BIG = 20000;
// --breakdowns, 2026-10-09: four things that count as the discipline failing,
// each kept with the transcript line's timestamp so it can be looked up.
//   backToBuild  a `task.js stage build` after a `task.js stage verify`
//   stoodDown    a `task.js down` in a transcript with no `task.js stage land`
//   refused      a tool_result whose text starts `fankeel: ` — every refusal
//                hooks/guard.js writes opens that way (its lines 91, 136, 163)
//   hookErrors   a `system` line whose text says a hook timed out or failed
// The last two are the shapes assumed, not measured; the first foreign-project
// week (docs/90-agent/todo/foreign-1.md) is where they get checked.
const REFUSED = /^fankeel: /;
const HOOK_ERROR = /\bhook\b.*\b(timed out|failed|error)\b/i;

function parseArgs(argv) {
  const { values } = parseArgv({
    args: argv, strict: false, allowPositionals: true,
    options: { 'config-dir': { type: 'string' }, project: { type: 'string' }, since: { type: 'string' }, breakdowns: { type: 'boolean' } },
  });
  const configDir = values['config-dir'] || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const since = values.since ? Date.parse(values.since) : null;
  if (Number.isNaN(since)) throw new Error('--since takes a date, YYYY-MM-DD.');
  return { configDir, project: values.project || null, since, breakdowns: Boolean(values.breakdowns) };
}

function dirFor({ configDir, project }) {
  if (!configDir) throw new Error('No config directory: pass --config-dir or set CLAUDE_CONFIG_DIR.');
  if (!project) throw new Error('--project <slug> is required — the same slug .claude/projects uses.');
  return path.join(configDir, 'projects', project);
}

function contentText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((item) => (item && item.type === 'text' && typeof item.text === 'string' ? item.text : JSON.stringify(item))).join('');
  }
  return JSON.stringify(content);
}

function extractStageName(tail) {
  const tokens = tail.split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '&&' || t === ';' || t === '|' || t === '||') break;
    if (t.startsWith('2>') || t.startsWith('1>') || t.startsWith('>')) break;
    if (t.startsWith('--')) { i++; continue; }
    return t.replace(/["'`]/g, '').toLowerCase();
  }
  return null;
}

function extractStagesFromCommand(cmd) {
  const out = [];
  for (const line of cmd.split('\n')) {
    const m = line.match(/task\.js\s+stage\s+(.*)/);
    if (!m) continue;
    const name = extractStageName(m[1]);
    if (name) out.push(name);
  }
  return out;
}

async function processFile(file) {
  const stat = fs.statSync(file);
  const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity });

  let peakContext = 0;
  let agentCalls = 0;
  let subagentChars = 0;
  let allToolResultChars = 0;
  let bigToolResults = 0;
  let notifChars = 0;
  let hadStart = false;
  const rawStages = [];
  const idKind = new Map();
  const backToBuild = []; const stoodDown = []; const refused = []; const hookErrors = [];
  let sawDown = null; let sawLand = false;

  for await (const line of rl) {
    if (!line) continue;
    let o;
    try { o = JSON.parse(line); } catch (e) { continue; }

    if (o.type === 'assistant' && o.message) {
      const u = o.message.usage;
      if (u) {
        const total = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
        if (total > peakContext) peakContext = total;
      }
      const content = o.message.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c.type !== 'tool_use') continue;
          if (c.name === 'Agent' || c.name === 'Task') { agentCalls++; idKind.set(c.id, 'agent'); }
          else if (c.name === 'Bash') {
            const cmd = c.input && c.input.command;
            if (typeof cmd === 'string') {
              if (/task\.js\s+start(\s|$)/.test(cmd)) hadStart = true;
              for (const s of extractStagesFromCommand(cmd)) {
                rawStages.push(s);
                if (s === 'build' && rawStages.length > 1 && rawStages[rawStages.length - 2] === 'verify') backToBuild.push({ at: o.timestamp || null });
                if (s === 'land') sawLand = true;
              }
              if (/task\.js\s+down(\s|$)/.test(cmd)) sawDown = { at: o.timestamp || null };
            }
          }
        }
      }
    } else if (o.type === 'user' && o.message) {
      const content = o.message.content;
      if (typeof content === 'string' && content.indexOf('<task-notification>') !== -1) {
        notifChars += content.length;
        const m = content.match(/<tool-use-id>([^<]*)<\/tool-use-id>/);
        const srcId = m ? m[1] : null;
        if (srcId && idKind.get(srcId) === 'agent') subagentChars += content.length;
      } else if (Array.isArray(content)) {
        for (const c of content) {
          if (c.type !== 'tool_result') continue;
          const txt = contentText(c.content);
          allToolResultChars += txt.length;
          if (REFUSED.test(txt)) refused.push({ at: o.timestamp || null });
          if (idKind.get(c.tool_use_id) === 'agent' && txt.indexOf('Async agent launched successfully') === -1) {
            subagentChars += txt.length;
          } else if (txt.length > BIG) {
            // 已拿掉的那個提醒 hook 盯的就是這一種：主 session 自己的一次工具輸出超過 20,000 字元。
            bigToolResults++;
          }
        }
      }
    } else if (o.type === 'system') {
      const txt = contentText(o.content !== undefined ? o.content : (o.message && o.message.content));
      if (HOOK_ERROR.test(txt)) hookErrors.push({ at: o.timestamp || null });
    }
  }
  if (sawDown && !sawLand) stoodDown.push(sawDown);

  let backwardCount = 0;
  for (let i = 1; i < rawStages.length; i++) {
    const pi = routeIndex.has(rawStages[i - 1]) ? routeIndex.get(rawStages[i - 1]) : null;
    const ci = routeIndex.has(rawStages[i]) ? routeIndex.get(rawStages[i]) : null;
    if (pi !== null && ci !== null && ci < pi) backwardCount++;
  }

  return { size: stat.size, peakContext, agentCalls, subagentChars, allToolResultChars, bigToolResults, notifChars, hadStart, backwardCount, backToBuild, stoodDown, refused, hookErrors };
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main(argv) {
  const opts = parseArgs(argv);
  const dir = dirFor(opts);
  const files = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.jsonl'))
    .map((d) => path.join(dir, d.name))
    // --since：只算那一天之後還寫過的 transcript，改後那一次量測靠它排掉改前的 session。
    .filter((f) => opts.since == null || fs.statSync(f).mtimeMs >= opts.since);

  const results = [];
  for (const f of files) results.push(await processFile(f));
  if (opts.breakdowns) {
    const breakdowns = results.map((r, i) => ({ file: path.basename(files[i]), backToBuild: r.backToBuild, stoodDown: r.stoodDown, refused: r.refused, hookErrors: r.hookErrors }));
    const sum = (k) => breakdowns.reduce((a, b) => a + b[k].length, 0);
    const totals = { sessions: results.length, backToBuild: sum('backToBuild'), stoodDown: sum('stoodDown'), refused: sum('refused'), hookErrors: sum('hookErrors') };
    return JSON.stringify({ breakdowns, totals }, null, 2);
  }

  const out = {
    totalSessions: results.length,
    fankeelSessions: results.filter((r) => r.hadStart).length,
    medianPeak: percentile(results.map((r) => r.peakContext), 50),
    p90Peak: percentile(results.map((r) => r.peakContext), 90),
    sumSubagentChars: results.reduce((a, r) => a + r.subagentChars, 0),
    sumAllToolResultChars: results.reduce((a, r) => a + r.allToolResultChars, 0),
    sumNotifChars: results.reduce((a, r) => a + r.notifChars, 0),
    sessionsWithBackward: results.filter((r) => r.backwardCount > 0).length,
    sumBigToolResults: results.reduce((a, r) => a + r.bigToolResults, 0),
  };
  // 改前改後比的是這一個：每個 session 平均有幾次超過 20,000 字元的主 session 工具輸出。
  out.bigPerSession = results.length ? out.sumBigToolResults / results.length : 0;
  out.adjustedDenominator = out.sumAllToolResultChars + out.sumNotifChars;
  out.share = out.adjustedDenominator ? out.sumSubagentChars / out.adjustedDenominator : null;

  return JSON.stringify({ out }, null, 2);
}

if (require.main === module) {
  main(process.argv.slice(2)).then((s) => process.stdout.write(s + '\n'));
}

module.exports = { parseArgs, dirFor, percentile, processFile, main };
