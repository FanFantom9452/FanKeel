#!/usr/bin/env node
'use strict';

// The completion record a task leaves at land, whether or not it closed a TODO
// entry (docs/90-agent/plans/2026-10-19-task-record-design.md). `write` reads
// five fields on stdin, works out 花費 itself, and files the record twice: on
// the registry entry, for the station, and in the month's file, for git.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { parseArgs: parseArgv } = require('node:util');
const { execFileSync, execSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const docs = require('../lib/docs.js');
const plain = require('../lib/plain.js');
const { sessionCost } = require('../lib/session-cost.js');
const live = require('../lib/live.js');
const bundle = require('../lib/bundle.js');
const sensitive = require('../lib/sensitive.js');
const zip = require('../lib/zip.js');

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
    bundle: { type: 'string' },
    bundles: { type: 'string' },
    'global-packages': { type: 'boolean' },
    'keep-home': { type: 'boolean' },
    closed: { type: 'boolean' },
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
    const seen = sessionCost(configDir, sessionId);
    if (!seen) return '對話紀錄找不到，金額沒算；從開始到現在 ' + time + '。';
    const usd = (n) => '$' + n.toFixed(2);
    const models = seen.agentModels.map(short);
    const main = '主 session' + (seen.model ? '（' + short(seen.model) + '）' : '') + usd(seen.mainUsd);
    const sub = seen.agents ? 'subagent ' + seen.agents + ' 個' + (models.length ? '（' + models.join('、') + '）' : '') + usd(seen.agentUsd) : '沒有派 subagent';
    return '合計 ' + usd(seen.usd) + '，' + time + '；' + main + '；' + sub + '。';
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

// `closed` lets a task that stood down (active=false) through: land only
// flips that flag, so its record, configDir and sessions are all still there.
function activeEntry(opts, closed) {
    if (!opts.session) fail('--session <id> is required: the record belongs to one task.');
    const root = opts.root ? path.resolve(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const mine = registry.readSession(root, opts.session);
    if (!mine || (mine.active !== true && !closed)) fail('No active entry for ' + opts.session + ' under ' + root);
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
    const { root, mine, projectRoot } = activeEntry(opts, opts.closed);
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

function monthsText(recordsDir) {
    let months = '';
    try {
        for (const n of fs.readdirSync(recordsDir)) if (n.endsWith('.md')) months += fs.readFileSync(path.join(recordsDir, n), 'utf8');
    } catch (e) { /* no records yet */ }
    return months;
}

function listBundles(opts) {
    const root = opts.root ? path.resolve(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const projectRoot = opts.project ? path.resolve(opts.project) : root;
    const records = recordsRel(projectRoot);
    const recordsDir = path.join(projectRoot, ...records.split('/'));
    const months = monthsText(recordsDir);
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

// A retro of a bundle with no registry entry, from /fankeel-retro-all: the
// hand-back arrives on stdin and is filed once per id8 as its own section.
function fileBundleRetro(opts) {
    const id8 = String(opts.bundle);
    if (!/^[0-9a-f]{8}$/.test(id8)) fail('Nothing written: --bundle takes the 8-character hex session id, got "' + id8 + '".');
    const root = opts.root ? path.resolve(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const projectRoot = opts.project ? path.resolve(opts.project) : root;
    const answer = fs.readFileSync(0, 'utf8').trim();
    if (!RETRO_HEAD.test(answer)) fail('Nothing written: the hand-back does not open with `retro: <session> — <n> turns read, <n> hunks`, so it is not what the retro returned.');
    const dir = path.join(projectRoot, ...recordsRel(projectRoot).split('/'));
    if (monthsText(dir).includes('<summary>retro ' + id8 + ' ')) fail('Nothing written: a retro for ' + id8 + ' is already filed.');
    const day = new Date().toISOString().slice(0, 10);
    const file = path.join(dir, day.slice(0, 7) + '.md');
    const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const head = before ? before.replace(/\n*$/, '\n\n') : '# 任務完成紀錄 ' + day.slice(0, 7) + '\n\n';
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, head + ['<a id="r-' + id8 + '"></a>', '', '## ' + day + ' retro ' + id8, '', '<details>',
        '<summary>retro ' + id8 + ' · ' + new Date().toISOString() + ' · 原文</summary>', '', '````text', answer, '````', '', '</details>', ''].join('\n'));
    process.stdout.write('filed: ' + path.relative(projectRoot, file).split(path.sep).join('/') + '#r-' + id8 + '\n');
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

// docs/90-agent/plans/2026-11-02-retro-zip-design.md: a retro-all run goes back
// as one ZIP sent privately instead of a push — the report, the bundles it read
// and a whitelisted manifest of the machine it ran on.
const BUNDLE_NAME = /^\d{4}-\d{2}-\d{2}-[0-9a-f]{8}\.jsonl\.gz$/;
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// The section `anchor` opens in any month file under `dir`, up to the next anchor.
function sectionIn(dir, anchor) {
    let names = [];
    try { names = fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort(); } catch (e) { return null; }
    for (const n of names) {
        const text = fs.readFileSync(path.join(dir, n), 'utf8');
        const at = text.indexOf('<a id="' + anchor + '"></a>');
        if (at < 0) continue;
        const next = text.indexOf('\n<a id="', at + 1);
        return text.slice(at, next < 0 ? text.length : next + 1).replace(/\n*$/, '\n');
    }
    return null;
}

// The `<details>` block of a bundle's retro: filed on its own by `retro
// --bundle`, or under a task's record by `retro --session`.
function retroBlock(months, id8) {
    const at = months.indexOf('<summary>retro ' + id8 + ' ');
    if (at < 0) return null;
    const end = months.indexOf('</details>', at);
    return months.slice(months.lastIndexOf('<details>', at), end < 0 ? months.length : end + '</details>'.length);
}

// os.homedir() as a transcript spells it: native, with forward slashes, and as
// Git Bash's /c/Users/<name>. Windows paths match in any case; the lookahead
// keeps C:\Users\ann from matching inside C:\Users\anna or C:\Users\ann.bob,
// yet still masks it before a sentence-ending dot. A backslash matches a
// run of them: JSON held in a string, and a { f, raw } row's line, spell
// C:\Users\ann as C:\\Users\\ann, or C:\\\\Users\\\\ann once more inside.
function homePattern(home) {
    const forms = new Set([home, home.split('\\').join('/')]);
    const drive = /^([A-Za-z]):[\\/](.*)$/.exec(home);
    if (drive) forms.add('/' + drive[1].toLowerCase() + '/' + drive[2].split('\\').join('/'));
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').split('\\\\').join('\\\\+');
    const alts = [...forms].sort((a, b) => b.length - a.length).map(esc).join('|');
    return new RegExp('(?:' + alts + ')(?![\\w-]|\\.\\w)', process.platform === 'win32' ? 'gi' : 'g');
}

function mapStrings(value, fn) {
    if (typeof value === 'string') return fn(value);
    if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
    if (value && typeof value === 'object') {
        const out = {};
        for (const k of Object.keys(value)) out[k] = mapStrings(value[k], fn);
        return out;
    }
    return value;
}

// A bundle as it goes into the ZIP: every string's home directory turned into
// [HOME] unless `re` is null, the head line kept as written, gzip'd again; the
// file in .fankeel/bundles/ is not touched. Also the Claude Code versions its
// entries carry, for the manifest.
function maskBundle(buf, re) {
    const lines = zlib.gunzipSync(buf).toString('utf8').split('\n').filter(Boolean);
    const versions = new Set();
    const out = [lines[0]];
    for (const raw of lines.slice(1)) {
        let row;
        try { row = JSON.parse(raw); } catch (e) { out.push(re ? raw.replace(re, '[HOME]') : raw); continue; }
        if (row && row.e && typeof row.e.version === 'string') versions.add(row.e.version);
        out.push(re ? JSON.stringify(mapStrings(row, (s) => s.replace(re, '[HOME]'))) : raw);
    }
    return { gz: re ? zlib.gzipSync(out.join('\n') + '\n') : buf, versions };
}

// Null for a file that is missing or does not parse, and for a buffer that does not.
function readJson(file) {
    try { return JSON.parse(Buffer.isBuffer(file) ? file.toString('utf8') : fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}

// Names and versions only. npm exits non-zero over an extraneous package and
// still prints the JSON, so stdout is read from the failure too.
function globalPackages() {
    let text;
    try {
        text = execSync('npm ls -g --depth=0 --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000, windowsHide: true });
    } catch (e) {
        text = e && e.stdout;
        if (!text) return 'unavailable: ' + (String((e && (e.stderr || e.message)) || e).trim().split(/\r?\n/)[0] || 'npm failed');
    }
    try {
        const deps = JSON.parse(text).dependencies || {};
        const out = {};
        for (const k of Object.keys(deps)) out[k] = deps[k].version || null;
        return out;
    } catch (e) { return 'unavailable: npm printed no JSON'; }
}

function exportZip(opts, cross) {
    if (opts.cross && !cross) fail('record.js export --cross <anchor> --bundles <id8,...>: the anchor is the #x-<date> `retro --cross` printed.');
    const anchor = opts.cross ? String(cross).replace(/^.*#/, '') : null;
    const ids = String(opts.bundles || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!ids.length) fail('Nothing written: --bundles <id8,...> names the bundles this retro read.');
    if (!anchor && ids.length > 1) fail('Nothing written: several bundles need --cross <anchor>, the report that ties them together; one bundle goes without.');
    const root = opts.root ? path.resolve(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const projectRoot = opts.project ? path.resolve(opts.project) : root;
    const list = sensitive.readList(projectRoot);
    if (list.error) fail('Nothing written: .fankeel/sensitive.txt exists but could not be read (' + list.error + '), so the manifest could not be masked against it.');
    const records = recordsRel(projectRoot);
    const recordsDir = path.join(projectRoot, ...records.split('/'));
    const missing = [];
    const report = anchor ? sectionIn(recordsDir, anchor) : '';
    if (anchor && !report) missing.push('#' + anchor + ' in ' + records);
    const found = [];
    for (const id8 of ids) {
        let hit = null;
        for (const dir of ['.fankeel/bundles', records + '/sessions']) {
            let names = [];
            try { names = fs.readdirSync(path.join(projectRoot, ...dir.split('/'))).filter((n) => BUNDLE_NAME.test(n) && n.slice(11, 19) === id8).sort(); } catch (e) { continue; }
            if (names.length) hit = path.join(projectRoot, ...dir.split('/'), names[names.length - 1]);
        }
        if (hit) found.push({ id8, file: hit });
        else missing.push('bundle ' + id8);
    }
    if (missing.length) fail('Nothing written: not found — ' + missing.join(', ') + '.');
    const re = opts['keep-home'] ? null : homePattern(os.homedir());
    // The manifest and report.md too, so homeMasked speaks for the whole ZIP.
    const mask = (s) => (re ? s.replace(re, '[HOME]') : s);
    const months = monthsText(recordsDir);
    const versions = new Set();
    const bundles = [];
    for (const b of found) {
        let masked;
        try { masked = maskBundle(fs.readFileSync(b.file), re); } catch (e) { fail('Nothing written: ' + path.basename(b.file) + ' is not a gzip\'d bundle (' + (e.code || e.message) + ').'); }
        for (const v of masked.versions) versions.add(v);
        bundles.push({ id8: b.id8, name: path.basename(b.file), gz: masked.gz });
    }
    const text = sensitive.redact(mask([report.trim(), ...bundles.map((b) => '## retro ' + b.id8 + '\n\n' + (retroBlock(months, b.id8) || '（月檔裡沒有這個包的 retro）'))].filter(Boolean).join('\n\n') + '\n'), list.words, {});
    const working = readJson(path.join(root, 'package.json'));
    const installed = readJson(path.join(__dirname, '..', 'package.json')) || {};
    const project = readJson(path.join(projectRoot, 'package.json')) || {};
    let gitHead = null;
    try { gitHead = execFileSync('git', ['-C', projectRoot, 'rev-parse', '--short', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8', timeout: 15000, windowsHide: true }).trim() || null; } catch (e) { /* not a repository */ }
    const manifest = {
        export: 1,
        created: new Date().toISOString(),
        fankeel: { working: working && working.name === 'fankeel' ? working.version : null, installed: installed.version || null },
        node: process.version,
        engines: installed.engines || null,
        platform: process.platform,
        arch: process.arch,
        osRelease: os.release(),
        claudeCode: [...versions].sort(),
        gitHead,
        packages: { dependencies: project.dependencies || {}, devDependencies: project.devDependencies || {} },
        homeMasked: Boolean(re),
    };
    if (opts['global-packages']) manifest.globalPackages = globalPackages();
    manifest.bundles = bundles.map((b) => ({ name: b.name, bytes: b.gz.length, sha256: sha256(b.gz) }));
    const body = zip.write([
        { name: 'manifest.json', data: Buffer.from(JSON.stringify(sensitive.redact(mapStrings(manifest, mask), list.words, {}), null, 2) + '\n') },
        { name: 'report.md', data: Buffer.from(text) },
        ...bundles.map((b) => ({ name: 'bundles/' + b.name, data: b.gz })),
    ]);
    const rel = '.fankeel/exports/retro-' + manifest.created.slice(0, 10) + '-' + sha256(text).slice(0, 8) + '.zip';
    registry.ensureIgnored(projectRoot, ['exports/']);
    const file = path.join(projectRoot, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
    process.stdout.write(['export: ' + rel, 'size: ' + (body.length / 1048576).toFixed(1) + ' MB，' + bundles.length + ' bundles，homeMasked: ' + manifest.homeMasked,
        '把這個檔案用私下管道傳回去，不要上傳到 Gitea。'].join('\n') + '\n');
}

function importZip(opts, zipFile) {
    if (!zipFile) fail('record.js import <zip>: name the ZIP to read.');
    const root = opts.root ? path.resolve(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const projectRoot = opts.project ? path.resolve(opts.project) : root;
    let entries;
    try { entries = zip.read(fs.readFileSync(zipFile)); } catch (e) { fail('Nothing written: ' + zipFile + ' — ' + (e.code || e.message) + '.'); }
    const byName = new Map(entries.map((e) => [e.name, e.data]));
    const manifest = byName.has('manifest.json') ? readJson(byName.get('manifest.json')) : null;
    if (!manifest || manifest.export !== 1 || !Array.isArray(manifest.bundles)) fail('Nothing written: ' + zipFile + ' holds no export manifest.json, so it is not a retro export.');
    const bad = [];
    for (const b of manifest.bundles) {
        const data = byName.get('bundles/' + b.name);
        if (!BUNDLE_NAME.test(String(b.name))) bad.push(b.name + ' is not a bundle name');
        else if (!data) bad.push(b.name + ' is missing');
        else if (sha256(data) !== b.sha256) bad.push(b.name + ' does not match its sha256');
    }
    if (bad.length) fail('Nothing written: ' + bad.join('; ') + '.');
    // `...zip` leaves `..`, which would put manifest.json in .fankeel/ itself.
    const stem = path.basename(zipFile).replace(/\.zip$/i, '');
    if (/^\.*$|[\\/]/.test(stem)) fail('Nothing written: ' + JSON.stringify(path.basename(zipFile)) + ' leaves no folder under .fankeel/imports/ to file it in; rename it, e.g. retro-<date>.zip.');
    registry.ensureIgnored(projectRoot, ['bundles/', 'imports/']);
    const dir = path.join(projectRoot, '.fankeel', 'bundles');
    fs.mkdirSync(dir, { recursive: true });
    const written = [];
    const skipped = [];
    for (const b of manifest.bundles) {
        const target = path.join(dir, b.name);
        if (fs.existsSync(target)) { skipped.push(b.name); continue; }
        fs.writeFileSync(target, byName.get('bundles/' + b.name));
        written.push(b.name);
    }
    const into = path.join(projectRoot, '.fankeel', 'imports', stem);
    fs.mkdirSync(into, { recursive: true });
    fs.writeFileSync(path.join(into, 'manifest.json'), byName.get('manifest.json'));
    if (byName.has('report.md')) fs.writeFileSync(path.join(into, 'report.md'), byName.get('report.md'));
    const fk = manifest.fankeel || {};
    const out = ['imported: ' + written.length + ' bundles into .fankeel/bundles/'];
    if (skipped.length) out.push('skipped: ' + skipped.join(', ') + ' (already here, not overwritten)');
    out.push('report: .fankeel/imports/' + stem + '/report.md',
        'manifest: fankeel ' + (fk.installed || fk.working || '?') + ' · node ' + manifest.node + ' · ' + manifest.platform + ' ' + manifest.osRelease
        + ' · Claude Code ' + ((manifest.claudeCode || []).join(', ') || '?') + ' · ' + manifest.bundles.length + ' bundles');
    process.stdout.write(out.join('\n') + '\n');
}

// docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §7, after the
// 2026-11-01 shared-session-state judgement (option A): the state of a stage in
// progress stays on this machine, but its conclusion goes into version control
// at the stage change rather than at land. `report` is the handoff file the
// stage left; it is copied, masked the way a session bundle is, to
// `<records>/<slug>/<its name>` and committed alone with `git commit -o`, so
// whatever else is staged stays staged. Never throws: a stage change must not
// fail over a record. Returns the line `task.js stage` prints, or null when
// the stage left no report.
function fileStageReport({ projectRoot, report, slug, stage }) {
    let text;
    try { text = fs.readFileSync(report, 'utf8'); } catch (e) { return null; }
    const list = sensitive.readList(projectRoot);
    if (list.error) return 'record: not copied — .fankeel/sensitive.txt could not be read (' + list.error + '), so nothing could be masked against it.';
    const rel = recordsRel(projectRoot) + '/' + slug + '/' + path.basename(report);
    try {
        const file = path.join(projectRoot, ...rel.split('/'));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, sensitive.redact(text, list.words, {}));
    } catch (e) {
        return 'record: not copied — ' + ((e && e.code) || 'write failed') + '.';
    }
    const git = (args) => execFileSync('git', ['-C', projectRoot, ...args], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 15000, windowsHide: true });
    try {
        git(['add', '--', rel]);
        git(['commit', '-o', '-m', 'docs: ' + slug + ' ' + stage + ' conclusion\n\n- ' + stage + '\'s report, masked — ' + rel, '--', rel]);
        return 'record: ' + rel + ' committed';
    } catch (e) {
        try { git(['reset', '-q', '--', rel]); } catch (e2) { /* best effort */ }
        const why = String((e && (e.stderr || e.message)) || e).trim().split(/\r?\n/)[0];
        return 'record: ' + rel + ' written, not committed — ' + (why || 'git failed') + '.';
    }
}

function main(argv) {
    const { values, positionals } = parseArgv({ args: argv, options: OPTIONS, allowPositionals: true });
    const verb = positionals[0];
    if (verb === 'write') return write(values);
    if (verb === 'session') return exportSession(values);
    if (verb === 'sessions' && values.list) return listBundles(values);
    if (verb === 'retro') return values.cross ? fileCross(values) : values.bundle ? fileBundleRetro(values) : fileRetro(values);
    if (verb === 'export') return exportZip(values, positionals[1]);
    if (verb === 'import') return importZip(values, positionals[1]);
    fail('record.js write|session [--closed]|retro|sessions --list|export [--cross <anchor>] --bundles <id8,...>|import <zip> --session <id> [--commit] [--transcript <jsonl>] [--cross] [--bundle <id8>] [--global-packages] [--keep-home] [--root <dir>] [--project <dir>] [--config-dir <dir>]');
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { parse, problems, appendUnder, fileStageReport, homePattern };
