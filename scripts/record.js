#!/usr/bin/env node
'use strict';

// The completion record a task leaves at land, whether or not it closed a TODO
// entry (docs/90-agent/plans/2026-10-19-task-record-design.md). `write` reads
// five fields on stdin, works out 花費 itself, and files the record twice: on
// the registry entry, for the station, and in the month's file, for git.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');
const registry = require('../lib/registry.js');
const docs = require('../lib/docs.js');
const plain = require('../lib/plain.js');
const usage = require('../lib/usage.js');
const detail = require('../lib/detail.js');
const prices = require('../lib/prices.js');
const live = require('../lib/live.js');

// The literal table `lib/skills.js` reads a script's flags from.
const OPTIONS = {
    session: { type: 'string' },
    root: { type: 'string' },
    project: { type: 'string' },
    'config-dir': { type: 'string' },
};

// Field name as the user reads it, and as the registry stores it.
const FIELDS = [['要求', 'ask'], ['做了什麼', 'did'], ['為什麼這樣做', 'why'], ['驗過・沒驗過', 'checked'], ['花費', 'cost'], ['還剩什麼', 'left']];
const TYPED = FIELDS.filter(([, k]) => k !== 'cost');
const KEY = /^(要求|做了什麼|為什麼這樣做|驗過・沒驗過|花費|還剩什麼)[:：][ \t]*(.*)$/;
const ITEM = /^\s+- (.+)$/;

function fail(msg) {
    process.stdout.write(msg + '\n');
    process.exit(1);
}

// 花費 is never taken from the model: a typed one is dropped here.
function parse(text) {
    const byName = new Map(FIELDS);
    const out = { did: [] };
    let list = false;
    for (const line of String(text || '').split(/\r?\n/)) {
        const item = list ? ITEM.exec(line) : null;
        if (item) { out.did.push(item[1].trim()); continue; }
        list = false;
        const m = KEY.exec(line);
        if (!m) continue;
        const key = byName.get(m[1]);
        if (key === 'cost') continue;
        if (key === 'did') {
            list = true;
            if (m[2].trim()) out.did.push(m[2].trim());
        } else {
            out[key] = m[2].trim();
        }
    }
    return out;
}

function problems(fields, ids) {
    const out = [];
    for (const [name, key] of TYPED) {
        const v = fields[key];
        const empty = key === 'did' ? !v || !v.length : !v;
        if (empty) out.push(name + ' is missing or empty.');
    }
    for (const [name, key] of TYPED) {
        const text = key === 'did' ? (fields.did || []).join('\n') : fields[key] || '';
        for (const s of plain.longSentences(text)) out.push(name + ': a sentence ' + s.width + ' columns wide, ' + plain.MAX_SENTENCE_WIDTH + ' at most: split it.');
        for (const b of plain.bareCodes(text, ids)) out.push(name + ': "' + b.code + '" stands where its name should be.');
    }
    return out;
}

function duration(ms) {
    const m = Math.max(Math.round(ms / 60000), 0);
    return m >= 60 ? Math.floor(m / 60) + ' 小時 ' + (m % 60) + ' 分' : m + ' 分';
}

const short = (id) => String(id).replace(/^claude-/, '');

// The station's own figure (lib/station.js:775-776, usd + agentUsd) read from
// the same transcript, plus the time since the task started.
function costLine(data, sessionId, configDir, now) {
    const time = duration(now - Date.parse(data.started));
    const file = detail.transcriptOf(configDir, sessionId);
    const seen = file ? usage.summariseTree(file) : null;
    if (!seen) return '對話紀錄找不到，金額沒算；從開始到現在 ' + time + '。';
    const own = prices.costOf(seen.usage.models);
    const sub = seen.usage.subagents || null;
    const theirs = sub && sub.models ? prices.costOf(sub.models) : null;
    const usd = (own.priced.length ? own.usd : 0) + (theirs && theirs.priced.length ? theirs.usd : 0);
    const agents = sub ? sub.agents || 0 : 0;
    const models = sub && sub.models ? Object.keys(sub.models).map(short) : [];
    const who = seen.model ? '主 session ' + short(seen.model) + (models.length ? '，agent 用 ' + models.join('、') : '') : '';
    return '$' + usd.toFixed(2) + '，' + time + '，' + agents + ' 個 agent' + (who ? '（' + who + '）' : '') + '。';
}

function section(title, day, anchor, fields, corrected) {
    const lines = ['<a id="' + anchor + '"></a>', '', '## ' + day + ' ' + title + (corrected ? '（更正）' : ''), ''];
    for (const [name, key] of FIELDS) {
        if (key === 'did') {
            lines.push('- ' + name + '：');
            for (const d of fields.did) lines.push('  - ' + d);
        } else {
            lines.push('- ' + name + '：' + fields[key]);
        }
    }
    return lines.join('\n') + '\n';
}

function write(opts) {
    if (!opts.session) fail('--session <id> is required: the record belongs to one task.');
    const root = opts.root ? path.resolve(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const mine = registry.readSession(root, opts.session);
    if (!mine || mine.active !== true) fail('No active entry for ' + opts.session + ' under ' + root);
    const projectRoot = docs.projectRootsFor(root, opts.project ? [opts.project] : (mine.project ? [mine.project] : []))[0] || root;
    const fields = parse(fs.readFileSync(0, 'utf8'));
    const found = problems(fields, plain.todoIds(projectRoot).ids);
    if (found.length) fail('Nothing written. Fix these and pipe the record again:\n' + found.map((p) => '  - ' + p).join('\n'));
    const now = Date.now();
    fields.cost = costLine(mine, opts.session, opts['config-dir'] || mine.configDir || live.liveConfigDir(), now);
    const { tree } = docs.read(projectRoot);
    const bucket = tree && tree.buckets.find((b) => /(^|\/)records$/.test(b.path));
    const rel = (bucket ? bucket.path : 'docs/90-agent/records') + '/' + new Date(now).toISOString().slice(0, 7) + '.md';
    const file = path.join(projectRoot, ...rel.split('/'));
    const day = new Date(now).toISOString().slice(0, 10);
    const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const base = 'r-' + day + '-' + String(opts.session).slice(0, 8);
    const taken = (before.match(new RegExp('<a id="' + base + '(-\\d+)?"></a>', 'g')) || []).length;
    const anchor = taken ? base + '-' + (taken + 1) : base;
    const corrected = Boolean(mine.record);
    const head = before ? before.replace(/\n*$/, '\n\n') : '# 任務完成紀錄 ' + rel.slice(-10, -3) + '\n\n';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, head + section(mine.task || opts.session, day, anchor, fields, corrected));
    registry.update(root, opts.session, (d) => {
        d.record = { at: new Date(now).toISOString(), file: rel, anchor, fields };
    });
    const out = ['filed: ' + rel + '#' + anchor];
    for (const [name, key] of FIELDS) {
        if (key === 'did') out.push(name + ':', ...fields.did.map((d) => '  - ' + d));
        else out.push(name + ': ' + fields[key]);
    }
    process.stdout.write(out.join('\n') + '\n');
}

function main(argv) {
    const { values, positionals } = parseArgv({ args: argv, options: OPTIONS, allowPositionals: true });
    if (positionals[0] !== 'write') fail('record.js write --session <id> [--root <dir>] [--project <dir>] [--config-dir <dir>] < record');
    write(values);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { parse, problems };
