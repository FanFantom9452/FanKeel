#!/usr/bin/env node
'use strict';

// escape-1, step 1: how often tool input that should carry Chinese carries a
// character nobody meant (lib/cjk.js says which), per tool, over every
// transcript under <config dir>/projects, subagents included — beside what the
// user typed, as the baseline for how often a meant character reads as rare —
// and how many tool calls did not parse at all (`__unparsedToolInput`). Run it
// again with --since to compare a later week against the first numbers.
//
//   node escape-scan.js [--config-dir <dir>] [--since <YYYY-MM-DD | ISO time with Z or ±HH:MM>]

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { liveConfigDir } = require('../lib/live.js');
const { rareChars, hasCjk } = require('../lib/cjk.js');

const USAGE = 'escape-scan.js: usage: escape-scan.js [--config-dir <dir>] [--since <YYYY-MM-DD | YYYY-MM-DDTHH:MM[:SS]Z | ...±HH:MM>]';
const TOOLS = ['AskUserQuestion', 'TodoWrite', 'Write', 'update_plan', 'wrap_up'];

// An MCP tool is mcp__<server>__<tool>: update_plan and wrap_up are matched on
// the last part, whichever server carries them.
function bucketOf(name) {
    const n = String(name || '');
    const last = n.startsWith('mcp__') ? n.slice(n.lastIndexOf('__') + 2) : n;
    return TOOLS.includes(last) ? last : null;
}

function jsonlFiles(dir, out) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
    for (const d of entries) {
        const p = path.join(dir, d.name);
        if (d.isDirectory()) jsonlFiles(p, out);
        else if (d.name.endsWith('.jsonl')) out.push(p);
    }
    return out;
}

function tally(row, text) {
    row.calls += 1;
    if (hasCjk(text)) row.cjk += 1;
    const found = rareChars(text);
    if (!found.length) return;
    row.flagged += 1;
    for (const ch of found) row.chars[ch] = (row.chars[ch] || 0) + 1;
}

function scan(configDir, opts) {
    const since = opts && opts.since ? Date.parse(opts.since) : NaN;
    const rows = {};
    for (const name of TOOLS.concat(['user'])) rows[name] = { calls: 0, cjk: 0, flagged: 0, chars: {} };
    const unparsed = {};
    const files = jsonlFiles(path.join(configDir, 'projects'), []);
    for (const file of files) {
        let text;
        try { text = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
        for (const raw of text.split('\n')) {
            // Parsing every line of a tree this size is the whole cost; only
            // these two kinds of line are counted.
            if (!raw.includes('"tool_use"') && !raw.includes('"type":"user"')) continue;
            let e;
            try { e = JSON.parse(raw); } catch (x) { continue; }
            if (!e || typeof e !== 'object' || !e.message || typeof e.message !== 'object') continue;
            if (Number.isFinite(since) && !(Date.parse(e.timestamp) >= since)) continue;
            const content = e.message.content;
            if (e.type === 'user') {
                if (typeof content === 'string') tally(rows.user, content);
                continue;
            }
            if (e.type !== 'assistant' || !Array.isArray(content)) continue;
            for (const part of content) {
                if (!part || part.type !== 'tool_use') continue;
                const input = part.input && typeof part.input === 'object' ? part.input : {};
                if (Object.hasOwn(input, '__unparsedToolInput')) unparsed[part.name] = (unparsed[part.name] || 0) + 1;
                const bucket = bucketOf(part.name);
                if (bucket) tally(rows[bucket], JSON.stringify(input));
            }
        }
    }
    return { files: files.length, rows, unparsed };
}

function report(configDir, res, since) {
    const pct = (a, b) => (b ? (100 * a / b).toFixed(2) + '%' : '-');
    const label = (name) => (name === 'user' ? 'user prompt' : name);
    const lines = ['fankeel escape-scan — ' + path.join(configDir, 'projects').replace(/\\/g, '/') + ', ' + res.files + ' transcripts' + (since ? ', since ' + since : ''),
        '  ' + 'tool'.padEnd(18) + 'calls'.padStart(7) + 'with CJK'.padStart(10) + 'flagged'.padStart(9) + 'rate'.padStart(9)];
    for (const [name, row] of Object.entries(res.rows)) {
        lines.push('  ' + label(name).padEnd(18) + String(row.calls).padStart(7) + String(row.cjk).padStart(10)
            + String(row.flagged).padStart(9) + pct(row.flagged, row.cjk).padStart(9));
    }
    for (const [name, row] of Object.entries(res.rows)) {
        const top = Object.entries(row.chars).sort((a, b) => b[1] - a[1]).slice(0, 12);
        if (top.length) lines.push('flagged in ' + label(name) + ': ' + top.map(([ch, n]) => ch + ' ' + n).join(', '));
    }
    const un = Object.entries(res.unparsed).sort((a, b) => b[1] - a[1]);
    lines.push('__unparsedToolInput: ' + un.reduce((sum, [, n]) => sum + n, 0) + (un.length ? ' (' + un.map(([k, n]) => k + ' ' + n).join(', ') + ')' : ''));
    return lines.join('\n');
}

function main(argv) {
    let parsed;
    try {
        parsed = parseArgs({ args: argv, options: { 'config-dir': { type: 'string' }, since: { type: 'string' } }, strict: true });
    } catch (e) {
        return { text: USAGE + ': ' + e.message, code: 2 };
    }
    const since = parsed.values.since;
    const shape = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;
    if (since !== undefined && !(shape.test(since) && Number.isFinite(Date.parse(since)))) return { text: USAGE + ': --since is a date, or a time with Z or an offset', code: 2 };
    const configDir = parsed.values['config-dir'] || liveConfigDir();
    return { text: report(configDir, scan(configDir, { since }), since), code: 0 };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { scan, main };
