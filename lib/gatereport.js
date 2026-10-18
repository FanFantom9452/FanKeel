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
    const seen = new Set();
    // The lead line: the first prose line that is not a `key:` line.
    const lead = stage === 'survey' ? 'conclusion' : stage === 'design' ? 'approach' : null;
    let list = false;
    for (const line of String(text || '').replace(GATE_BLOCK, '').split(/\r?\n/)) {
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
        if (name && !seen.has(name)) {
            seen.add(name);
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
        if (lead && !(lead in parts) && !name && PROSE.test(line)) {
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

function read(root, data) {
    const stage = data && typeof data.stage === 'string' ? data.stage : '';
    const plain = stage ? handoffPath(root, data, stage) : null;
    if (!plain) return null;
    const rel = (f) => path.relative(root, f).split(path.sep).join('/');
    let file;
    try { file = newest(plain); } catch (e) { return { error: 'unreadable', stage, path: rel(e.file || plain) }; }
    if (!file) return { error: 'none', stage, path: rel(plain) };
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return { error: 'unreadable', stage, path: rel(file) }; }
    const gate = readGate(file);
    const parts = parseReport(stage, text);
    // design §4: the `spec:` mockup is linked when it is a page under .fankeel/build/.
    if (stage === 'design') {
        const spec = String(parts.spec || '').replace(/`/g, '').trim();
        parts.mockup = /^\.fankeel\/build\/.+\.html$/.test(spec) ? { path: spec, href: pathToFileURL(path.join(root, spec)).href } : null;
    }
    return { stage, path: rel(file), text, gate: gate && !gate.invalid ? gate : null, parts };
}

module.exports = { read, parseReport };
