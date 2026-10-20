'use strict';

// A task's sessions as one file that can leave this machine: every line of
// each main transcript and of its subagents, every string masked by
// lib/sensitive.js's `redact`, gzip'd. Line one is the head; every other line
// is `{ f: <part>, e: <entry> }`, or `{ f, raw }` for a line that did not parse,
// so nothing the transcript held is dropped
// (docs/90-agent/plans/2026-10-20-retro-bundle-design.md §1).

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { transcriptOf } = require('./detail.js');
const { redact } = require('./sensitive.js');

function filesOf(configDir, sessionId) {
    const main = transcriptOf(configDir, sessionId);
    if (!main) return [];
    const out = [{ rel: sessionId + '.jsonl', file: main }];
    const dir = path.join(path.dirname(main), sessionId, 'subagents');
    let names = [];
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl')).sort();
    } catch (e) { /* no subagents */ }
    for (const n of names) out.push({ rel: sessionId + '/subagents/' + n, file: path.join(dir, n) });
    return out;
}

function pack(sessions, files, words, counts) {
    const c = counts || {};
    const lines = [];
    for (const f of files) {
        for (const raw of fs.readFileSync(f.file, 'utf8').split('\n')) {
            if (!raw) continue;
            let e;
            try { e = JSON.parse(raw); } catch (err) { e = undefined; }
            lines.push(JSON.stringify(e && typeof e === 'object' ? { f: f.rel, e: redact(e, words, c) } : { f: f.rel, raw: redact(raw, words, c) }));
        }
    }
    const head = JSON.stringify({ bundle: 1, sessions, files: files.map((f) => f.rel), redacted: c });
    return zlib.gzipSync(head + '\n' + lines.join('\n') + '\n');
}

function unpack(buf) {
    const rows = zlib.gunzipSync(buf).toString('utf8').split('\n').filter(Boolean);
    const head = JSON.parse(rows[0]);
    const parts = new Map(head.files.map((r) => [r, []]));
    for (const raw of rows.slice(1)) {
        const row = JSON.parse(raw);
        if (!parts.has(row.f)) parts.set(row.f, []);
        if (row.e !== undefined) parts.get(row.f).push(row.e);
    }
    return { head, parts };
}

module.exports = { filesOf, pack, unpack };
