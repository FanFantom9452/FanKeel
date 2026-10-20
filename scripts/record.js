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
const bundle = require('../lib/bundle.js');
const sensitive = require('../lib/sensitive.js');

// The literal table `lib/skills.js` reads a script's flags from.
const OPTIONS = {
    session: { type: 'string' },
    root: { type: 'string' },
    project: { type: 'string' },
    'config-dir': { type: 'string' },
    commit: { type: 'boolean' },
    list: { type: 'boolean' },
    transcript: { type: 'string' },
    cross: { type: 'boolean' },
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

// The station's own figure (lib/station.js:784-785, usd + agentUsd) read from
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

// A bundle over this stays on this machine even with --commit: a long session
// gzips to tens of MB (docs/90-agent/judgements/2026-10-20-retro-land-vs-skill.md).
const BUNDLE_MAX = 2 * 1024 * 1024;

function activeEntry(opts) {
    if (!opts.session) fail('--session <id> is required: the record belongs to one task.');
    const root = opts.root ? path.resolve(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const mine = registry.readSession(root, opts.session);
    if (!mine || mine.active !== true) fail('No active entry for ' + opts.session + ' under ' + root);
    const projectRoot = docs.projectRootsFor(root, opts.project ? [opts.project] : (mine.project ? [mine.project] : []))[0] || root;
    return { root, mine, projectRoot };
}

function recordsRel(projectRoot) {
    const { tree } = docs.read(projectRoot);
    const bucket = tree && tree.buckets.find((b) => /(^|\/)records$/.test(b.path));
    return bucket ? bucket.path : 'docs/90-agent/records';
}

// `text` goes at the end of the section `anchor` opens: before the next
// entry's anchor, or at the end of the file. False when the anchor is not there.
// A line of that section starting with `replace` is overwritten instead.
function appendUnder(file, anchor, text, replace) {
    let before;
    try { before = fs.readFileSync(file, 'utf8'); } catch (e) { return false; }
    const at = before.indexOf('<a id="' + anchor + '"></a>');
    if (at < 0) return false;
    const next = before.indexOf('\n<a id="', at + 1);
    const cut = next < 0 ? before.length : next + 1;
    const old = replace ? before.slice(at, cut).indexOf('\n' + replace) : -1;
    if (old >= 0) {
        const from = at + old + 1;
        const end = before.indexOf('\n', from);
        fs.writeFileSync(file, before.slice(0, from) + text.replace(/\n*$/, '') + (end < 0 ? '\n' : before.slice(end)));
        return true;
    }
    const head = before.slice(0, cut).replace(/\n*$/, '\n');
    const tail = before.slice(cut);
    fs.writeFileSync(file, head + text.replace(/\n*$/, '\n') + (tail ? '\n' + tail : ''));
    return true;
}

function write(opts) {
    const { root, mine, projectRoot } = activeEntry(opts);
    const fields = parse(fs.readFileSync(0, 'utf8'));
    const found = problems(fields, plain.todoIds(projectRoot).ids);
    if (found.length) fail('Nothing written. Fix these and pipe the record again:\n' + found.map((p) => '  - ' + p).join('\n'));
    const now = Date.now();
    fields.cost = costLine(mine, opts.session, opts['config-dir'] || mine.configDir || live.liveConfigDir(), now);
    const rel = recordsRel(projectRoot) + '/' + new Date(now).toISOString().slice(0, 7) + '.md';
    const file = path.join(projectRoot, ...rel.split('/'));
    const day = new Date(now).toISOString().slice(0, 10);
    const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const base = 'r-' + day + '-' + String(opts.session).slice(0, 8);
    const taken = (before.match(new RegExp('<a id="' + base + '(-\\d+)?"></a>', 'g')) || []).length;
    const anchor = taken ? base + '-' + (taken + 1) : base;
    const corrected = Boolean(mine.record);
    const head = before ? before.replace(/\n*$/, '\n\n') : '# 任務完成紀錄 ' + rel.slice(-10, -3) + '\n\n';
    // The entry first: a month section with no entry behind it would be filed
    // twice by the retry, the second time not marked as a correction.
    const saved = registry.update(root, opts.session, (d) => {
        d.record = { at: new Date(now).toISOString(), file: rel, anchor, fields };
    });
    if (!saved) fail('Nothing written: the registry entry for ' + opts.session + ' could not be updated (lock or read failed). Pipe the record again.');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, head + section(mine.task || opts.session, day, anchor, fields, corrected));
    const out = ['filed: ' + rel + '#' + anchor];
    for (const [name, key] of FIELDS) {
        if (key === 'did') out.push(name + ':', ...fields.did.map((d) => '  - ' + d));
        else out.push(name + ': ' + fields[key]);
    }
    process.stdout.write(out.join('\n') + '\n');
}

function exportSession(opts) {
    const { root, mine, projectRoot } = activeEntry(opts);
    if (!mine.record) fail('No record for ' + opts.session + ' yet: run `record.js write` first, so the bundle has an entry to hang under.');
    const list = sensitive.readList(projectRoot);
    if (list.error) fail('Nothing written: .fankeel/sensitive.txt exists but could not be read (' + list.error + '), so nothing could be masked against it.');
    const configDir = opts['config-dir'] || mine.configDir || live.liveConfigDir();
    const ids = (Array.isArray(mine.sessions) ? mine.sessions : []).concat(opts.session);
    const files = [].concat(...ids.map((id) => bundle.filesOf(configDir, id)));
    if (!files.length) fail('Nothing written: no transcript for ' + ids.join(', ') + ' under ' + configDir + '/projects.');
    const counts = {};
    const gz = bundle.pack(ids, files, list.words, counts);
    const name = new Date().toISOString().slice(0, 10) + '-' + String(opts.session).slice(0, 8) + '.jsonl.gz';
    const committed = Boolean(opts.commit) && gz.length <= BUNDLE_MAX;
    const rel = committed ? recordsRel(projectRoot) + '/sessions/' + name : '.fankeel/bundles/' + name;
    if (!committed) registry.ensureIgnored(projectRoot, ['bundles/']);
    const file = path.join(projectRoot, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, gz);
    const size = (gz.length / 1048576).toFixed(1) + ' MB';
    const month = path.join(projectRoot, ...mine.record.file.split('/'));
    const link = '- 對話紀錄：' + rel + '（';
    if (!appendUnder(month, mine.record.anchor, link + size + '，' + (committed ? 'committed' : 'local') + '）', link)) {
        fail('Bundle written to ' + rel + ', but ' + mine.record.file + ' has no #' + mine.record.anchor + ' to link it under.');
    }
    registry.update(root, opts.session, (d) => {
        d.record.bundle = { path: rel, bytes: gz.length, committed, sessions: ids, redacted: counts };
    });
    const out = ['bundle: ' + rel, 'size: ' + size + '，' + files.length + ' transcripts from ' + ids.length + ' sessions',
        'masked: ' + (Object.keys(counts).map((k) => k + ' ' + counts[k]).join(', ') || 'nothing')];
    if (opts.commit && !committed) out.push('kept local: over ' + BUNDLE_MAX / 1048576 + ' MB, so it was not put where git would carry it.');
    process.stdout.write(out.join('\n') + '\n');
}

function listBundles(opts) {
    const root = opts.root ? path.resolve(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const projectRoot = opts.project ? path.resolve(opts.project) : root;
    const records = recordsRel(projectRoot);
    const recordsDir = path.join(projectRoot, ...records.split('/'));
    let months = '';
    try {
        for (const n of fs.readdirSync(recordsDir)) if (n.endsWith('.md')) months += fs.readFileSync(path.join(recordsDir, n), 'utf8');
    } catch (e) { /* no records yet */ }
    const rows = [];
    for (const [dir, where] of [['.fankeel/bundles', 'local'], [records + '/sessions', 'committed']]) {
        let names = [];
        try { names = fs.readdirSync(path.join(projectRoot, ...dir.split('/'))).filter((n) => n.endsWith('.jsonl.gz')).sort(); } catch (e) { continue; }
        for (const n of names) {
            const bytes = fs.statSync(path.join(projectRoot, ...dir.split('/'), n)).size;
            const filed = months.includes('<summary>retro ' + n.slice(11, 19) + ' ');
            rows.push(dir + '/' + n + '  ' + (bytes / 1048576).toFixed(1) + ' MB  ' + where + '  retro: ' + (filed ? 'filed' : 'none'));
        }
    }
    process.stdout.write((rows.length ? rows.join('\n') : 'no bundles') + '\n');
}

const RETRO_HEAD = /^retro: (\S+) — (\d+) turns read, (\d+) hunks/;

// The retro's hand-back as it returned it, copied from its transcript the way
// judge.js copies a judgement, and the disposition the gate settled on stdin.
function fileRetro(opts) {
    const { root, mine, projectRoot } = activeEntry(opts);
    if (!mine.record) fail('No record for ' + opts.session + ' yet: a retro is filed under the task\'s record, so run `record.js write` first.');
    if (!opts.transcript) fail('--transcript <session>/subagents/agent-<id>.jsonl is required: the hand-back is copied from there, never retyped.');
    const { answerFromTranscript } = require('./judge.js');
    let answer;
    try { answer = answerFromTranscript(opts.transcript).trim(); } catch (e) { fail('Nothing written: ' + opts.transcript + ' could not be read (' + e.code + ').'); }
    const head = RETRO_HEAD.exec(answer);
    if (!head) fail('Nothing written: the hand-back does not open with `retro: <session> — <n> turns read, <n> hunks`, so it is not what the retro returned.');
    const disposition = fs.readFileSync(0, 'utf8').trim();
    const at = new Date().toISOString();
    const block = ['', '<details>', '<summary>retro ' + String(opts.session).slice(0, 8) + ' · ' + at + ' · 原文</summary>', '',
        '````text', answer, '````', '', '```text', disposition || '（沒有處置）', '```', '', '</details>'].join('\n');
    const month = path.join(projectRoot, ...mine.record.file.split('/'));
    if (!appendUnder(month, mine.record.anchor, block)) fail('Nothing written: ' + mine.record.file + ' has no #' + mine.record.anchor + '.');
    const saved = registry.update(root, opts.session, (d) => {
        d.record.retro = { at, turns: Number(head[2]), hunks: Number(head[3]) };
    });
    if (!saved) fail('Retro filed in ' + mine.record.file + '#' + mine.record.anchor + ', but the registry entry for ' + opts.session + ' could not be updated: do not file it again.');
    process.stdout.write('filed: ' + mine.record.file + '#' + mine.record.anchor + '\n');
}

// /fankeel-retro-all's ranked report, as its own section of the month file.
function fileCross(opts) {
    const root = opts.root ? path.resolve(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const projectRoot = opts.project ? path.resolve(opts.project) : root;
    const report = fs.readFileSync(0, 'utf8').trim();
    if (!/^(recurring: |clean$)/m.test(report)) fail('Nothing written: a cross-bundle report holds `recurring:` lines, or `clean`.');
    const day = new Date().toISOString().slice(0, 10);
    const rel = recordsRel(projectRoot) + '/' + day.slice(0, 7) + '.md';
    const file = path.join(projectRoot, ...rel.split('/'));
    const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const base = 'x-' + day;
    const taken = (before.match(new RegExp('<a id="' + base + '(-\\d+)?"></a>', 'g')) || []).length;
    const anchor = taken ? base + '-' + (taken + 1) : base;
    const head = before ? before.replace(/\n*$/, '\n\n') : '# 任務完成紀錄 ' + day.slice(0, 7) + '\n\n';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, head + ['<a id="' + anchor + '"></a>', '', '## ' + day + ' 跨 session 回顧', '', '````text', report, '````', ''].join('\n'));
    process.stdout.write('filed: ' + rel + '#' + anchor + '\n');
}

function main(argv) {
    const { values, positionals } = parseArgv({ args: argv, options: OPTIONS, allowPositionals: true });
    const verb = positionals[0];
    if (verb === 'write') return write(values);
    if (verb === 'session') return exportSession(values);
    if (verb === 'sessions' && values.list) return listBundles(values);
    if (verb === 'retro') return values.cross ? fileCross(values) : fileRetro(values);
    fail('record.js write|session|retro|sessions --list --session <id> [--commit] [--transcript <jsonl>] [--cross] [--root <dir>] [--project <dir>] [--config-dir <dir>]');
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { parse, problems, activeEntry, recordsRel, appendUnder };
