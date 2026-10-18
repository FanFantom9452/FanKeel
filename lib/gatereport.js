'use strict';

// gate tab §2 (docs/90-agent/plans/2026-10-18-gate-tab-design.md): the report
// a session's current stage waits at its gate with, for the station's gate
// tab. The newest of the stage's handoff file (`handoffPath`, lap included)
// and its group brains' `-g<N>` siblings, parsed by that stage's report
// template in lib/stages.js. A line no rule here recognises is kept in
// `parts.rest` and drawn as report text, never dropped.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { handoffPath, readGate } = require('./handoff.js');
const suite = require('./suite.js');
const registry = require('./registry.js');

// The gate block is the question, not report text; readGate reads it apart.
const GATE_BLOCK = /`{3}json gate\r?\n[\s\S]*?\r?\n`{3}/g;
const KEY = /^([A-Za-z][A-Za-z ,-]*|白話)[:：][ \t]*(.*)$/;
const FINDING = /^- (\S+?):(\d+)(?:-\d+)? — (.+)$/;
const PROSE = /^(?!#|- |\||```|fankeel )\S/;
const SHA = /^([0-9a-f]{7,40}) (\S.*)$/;
const CHANGED = /^- (\S+) \+(\d+)\/-(\d+) — (.+)$/;
const ADDED = /^- (\S+) \(new\) — (.+)$/;
const ITEM = /^\s+- (.+)$/;

// Each stage's `key:` lines as its template spells them, to the name the
// station reads them by.
const KEYS = {
    survey: { 'planned, not built': 'planned', 'not found': 'notFound', unknown: 'unknown', skipped: 'skipped', class: 'class', route: 'route' },
    design: { 'proves it done': 'proves', 'against the map': 'map', unverified: 'unverified', spec: 'spec' },
    build: { done: 'done', 'docs-check': 'docsCheck', deferred: 'deferred' },
    land: { shipped: 'shipped', suite: 'suite', cost: 'cost', open: 'open', '白話': 'plain' },
};
// The lists a stage's parts hold even when its report has none.
const LISTS = { survey: ['findings'], design: ['files'], build: ['files'], land: ['shipped'] };

// A `| a | b | c |` row's cells, trimmed, or null for any other line.
function cells(line) {
    const m = /^\|(.*)\|\s*$/.exec(line);
    return m ? m[1].split('|').map((c) => c.trim()) : null;
}

function parseReport(stage, text) {
    const parts = { rest: [] };
    for (const k of LISTS[stage] || []) parts[k] = [];
    const keys = KEYS[stage] || {};
    const lines = String(text || '').replace(GATE_BLOCK, '').split(/\r?\n/);
    // A key the report repeats is the stage's own on its last line: a survey
    // quotes the scanner block first, whose `skipped:` is the scanner's.
    const last = new Map();
    lines.forEach((line, i) => {
        const key = KEY.exec(line);
        const name = key ? keys[key[1].trim().toLowerCase()] : undefined;
        if (name) last.set(name, i);
    });
    // The lead line: the first prose line, never a lowercase `key: value` line
    // such as the quoted scanner block's `source: git`.
    const lead = stage === 'survey' ? 'conclusion' : stage === 'design' ? 'approach' : null;
    let list = false;
    for (const [i, line] of lines.entries()) {
        if (!line.trim() || line.trim() === 'then AskUserQuestion') continue;
        const item = list ? ITEM.exec(line) : null;
        if (item) { parts.shipped.push(item[1]); continue; }
        list = false;
        let m;
        if (stage === 'land' && !('sha' in parts) && (m = SHA.exec(line))) {
            parts.sha = m[1];
            parts.subject = m[2];
            continue;
        }
        const key = KEY.exec(line);
        const name = key ? keys[key[1].trim().toLowerCase()] : undefined;
        if (name && last.get(name) === i) {
            if (name === 'shipped') {
                list = true;
                if (key[2]) parts.shipped.push(key[2]);
            } else if (name === 'done') {
                const d = /^(\d+) of (\d+)/.exec(key[2]);
                parts.done = { n: d ? Number(d[1]) : null, m: d ? Number(d[2]) : null, text: key[2] };
            } else {
                parts[name] = key[2];
            }
            continue;
        }
        if (stage === 'survey' && (m = FINDING.exec(line))) {
            parts.findings.push({ path: m[1], line: Number(m[2]), what: m[3] });
            continue;
        }
        if (stage === 'build' && (m = CHANGED.exec(line))) {
            parts.files.push({ path: m[1], add: Number(m[2]), del: Number(m[3]), isNew: false, what: m[4] });
            continue;
        }
        if (stage === 'build' && (m = ADDED.exec(line))) {
            parts.files.push({ path: m[1], add: null, del: null, isNew: true, what: m[2] });
            continue;
        }
        const row = stage === 'design' ? cells(line) : null;
        if (row && row.length === 3) {
            // The header and the separator are the table's, not a file.
            if (row[0].toLowerCase() === 'file' || row.every((c) => /^:?-+:?$/.test(c))) continue;
            parts.files.push({ path: row[0].replace(/`/g, ''), change: row[1], dispatch: row[2] });
            continue;
        }
        if (lead && !(lead in parts) && !(key && /^[a-z]/.test(key[1])) && PROSE.test(line)) {
            parts[lead] = line;
            continue;
        }
        parts.rest.push(line);
    }
    return parts;
}

// The newest of `plain` and its `-g<N>` siblings by mtime, or null for none.
// Only ENOENT means none; any other error is thrown, `file` set when a stat
// failed, so a report that is there but will not open never reads as absent.
function newest(plain) {
    const dir = path.dirname(plain);
    const name = path.basename(plain);
    const stem = path.basename(plain, '.md').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const group = new RegExp('^' + stem + '-g\\d+\\.md$');
    let names;
    try { names = fs.readdirSync(dir); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    let best = null;
    let at = -Infinity;
    for (const n of names) {
        if (n !== name && !group.test(n)) continue;
        const file = path.join(dir, n);
        let ms;
        try { ms = fs.statSync(file).mtimeMs; } catch (e) { if (e.code === 'ENOENT') continue; e.file = file; throw e; }
        if (ms > at) { best = file; at = ms; }
    }
    return best;
}

// What the gate tab counts that no template field carries (gate-11,
// docs/90-agent/judgements/2026-10-18-gate-report-fields.md, option C): read out
// of the parsed report's own strings, so the templates in lib/stages.js stay
// inside their 2400-character cap. A copy of `parts` with the additions.
const NONE = /^(none|nothing|無)(?![\w])/i;
const OPENS = '(（[「';
const CLOSES = ')）]」';
// A value's items: split at `；` and `;` always, at `、` only outside brackets
// when `commas`; "none", "nothing", "無" or nothing at all is no items.
function items(text, commas) {
    const s = String(text || '').trim();
    if (!s || NONE.test(s)) return [];
    const out = [];
    let depth = 0;
    let cur = '';
    for (const ch of s) {
        if (OPENS.includes(ch)) depth += 1;
        if (CLOSES.includes(ch)) depth = Math.max(0, depth - 1);
        if (ch === ';' || ch === '；' || (commas && depth === 0 && ch === '、')) {
            if (cur.trim()) out.push(cur.trim());
            cur = '';
            continue;
        }
        cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}
// The file count a `skipped:` line names: `1528 個檔`, `1528 files`.
const FILES_N = /(\d[\d,]*)\s*個?\s*(?:檔|files?\b)/i;
// The survey lead split at its numbered points, `(1)` or `（1）`: the words before
// the first as the head; fewer than two points is the lead whole, with none.
function pointsOf(lead) {
    const s = String(lead || '');
    const marks = [...s.matchAll(/[(（](\d{1,2})[)）]\s*/g)];
    if (marks.length < 2) return { head: s, points: [] };
    const points = marks.map((m, i) => s.slice(m.index + m[0].length, i + 1 < marks.length ? marks[i + 1].index : undefined).trim());
    return { head: s.slice(0, marks[0].index).trim(), points };
}
// A TODO patrol inside a survey (skills/fankeel-survey/SKILL.md "Every entry,
// one line each"): its `entries: <n> listed, <m> in TODO` line, each entry line's
// disposition — the words after its last colon — counted, and the
// `- do now：…`, `- needs the user：…`, `- waiting on：…` group lines. Null when
// the report has none of it.
const DISPOSITIONS = ['do now', 'needs the user', 'waiting on', 'keep'];
function patrolOf(rest) {
    let listed = null;
    let inTodo = null;
    const counts = { 'do now': 0, 'needs the user': 0, 'waiting on': 0, keep: 0 };
    const groups = [];
    for (const line of rest) {
        const e = /^entries:\s*(\d+)\s+listed(?:,\s*(\d+)\s+in TODO)?/i.exec(line.trim());
        if (e) {
            listed = Number(e[1]);
            inTodo = e[2] ? Number(e[2]) : null;
            continue;
        }
        if (!/^- /.test(line)) continue;
        const g = /^- (do now|needs the user|waiting on)\s*[：:]\s*(.*)$/i.exec(line);
        if (g) {
            groups.push({ name: g[1].toLowerCase(), text: g[2].trim() });
            continue;
        }
        const at = Math.max(line.lastIndexOf('：'), line.lastIndexOf(':'));
        const tail = at >= 0 ? line.slice(at + 1).trim().toLowerCase() : '';
        const d = DISPOSITIONS.find((k) => tail.startsWith(k));
        if (d) counts[d] += 1;
    }
    return listed === null && !Object.values(counts).some(Boolean) ? null : { listed, inTodo, counts, groups };
}
function derive(stage, parts) {
    const out = Object.assign({}, parts);
    if (stage === 'survey') {
        out.lead = pointsOf(parts.conclusion);
        out.unknownList = items(parts.unknown, true);
        out.skippedList = items(parts.skipped, false);
        const n = FILES_N.exec(String(parts.skipped || ''));
        out.skippedFiles = n ? Number(n[1].replace(/,/g, '')) : null;
        out.patrol = patrolOf(parts.rest || []);
    }
    if (stage === 'design') {
        out.provesList = items(parts.proves, false);
        out.unverifiedList = items(parts.unverified, false);
    }
    return out;
}

// The mockup's screenshot beside it — the widest `shot-<width>/render.png`
// scripts/render.js left in the mockup's directory — or null, or `{ unreadable: dir }`
// when the directory is there but cannot be read (only `read` unwraps that).
function shotOf(root, spec) {
    const dir = path.posix.dirname(spec);
    let names = [];
    try { names = fs.readdirSync(path.join(root, dir)); } catch (e) { return e.code === 'ENOENT' ? null : { unreadable: dir }; }
    const widths = names.map((n) => /^shot-(\d+)$/.exec(n)).filter(Boolean).map((m) => Number(m[1])).sort((a, b) => b - a);
    for (const w of widths) {
        const rel = dir + '/shot-' + w + '/render.png';
        if (fs.existsSync(path.join(root, rel))) return { path: rel, href: pathToFileURL(path.join(root, rel)).href };
    }
    return null;
}

// The task's suite record (lib/suite.js), its last run, for land's gate beside
// the report's own `suite:` line. Null with no record, or one that does not parse.
// The files it ran are recorded nowhere: `tree` is the directory it ran in.
function runOf(root, data) {
    const rec = suite.readRecord(root, data);
    if (!rec || rec.unreadable) return null;
    return {
        pass: Number.isFinite(rec.pass) ? rec.pass : null,
        fail: Number.isFinite(rec.fail) ? rec.fail : null,
        ok: rec.ok === true,
        fast: rec.fast === true,
        command: typeof rec.command === 'string' ? rec.command : '',
    };
}

function read(root, data) {
    const stage = data && typeof data.stage === 'string' ? data.stage : '';
    // Only these four have a gate page: plan has its own tab, and no other
    // stage's handoff is copied into the detail.
    const plain = Object.hasOwn(LISTS, stage) ? handoffPath(root, data, stage) : null;
    if (!plain) return null;
    const rel = (f) => path.relative(root, f).split(path.sep).join('/');
    let file;
    try { file = newest(plain); } catch (e) { return { error: 'unreadable', stage, path: rel(e.file || plain) }; }
    if (!file) return { error: 'none', stage, path: rel(plain) };
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return { error: 'unreadable', stage, path: rel(file) }; }
    const gate = readGate(file);
    const parts = derive(stage, parseReport(stage, text));
    // design §4: the `spec:` mockup is linked when it is a page under .fankeel/build/, with its screenshot when one is there.
    if (stage === 'design') {
        const spec = String(parts.spec || '').replace(/`/g, '').trim();
        parts.mockup = null;
        if (/^\.fankeel\/build\/.+\.html$/.test(spec)) {
            const shot = shotOf(root, spec);
            parts.mockup = { path: spec, href: pathToFileURL(path.join(root, spec)).href, shot: shot && shot.unreadable ? null : shot };
            if (shot && shot.unreadable) parts.mockup.shotUnreadable = shot.unreadable;
        }
    }
    if (stage === 'land') {
        parts.run = runOf(root, data);
        const rec = suite.readRecord(root, data);
        if (rec && rec.unreadable) parts.runUnreadable = rec.unreadable;
    }
    // The build gate's verify count: how often the session went verify → build (judgement row B1); `moves` is the only record of it.
    if (stage === 'build') parts.rounds = registry.returnsTo(data, 'verify', 'build');
    return { stage, path: rel(file), text, gate: gate && !gate.invalid ? gate : null, parts };
}

module.exports = { read, parseReport, derive };
