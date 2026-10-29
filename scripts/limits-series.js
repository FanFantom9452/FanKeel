#!/usr/bin/env node
'use strict';

// quota-1: the 7-day readings in `.fankeel/build/limits`, grouped by the
// window they report, so a reset and two overlapping windows can be read.
//
//   node scripts/limits-series.js [--root <dir>] [--window <ISO>]
//
// Without --window: one line per window — its reset, rows, sessions, first
// and last reading. With --window: every reading of the window whose reset
// rounds to that hour, oldest first, with the session it came from. Exit 0
// when something printed, 1 when nothing matched, 2 on a usage error.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { readings } = require('../lib/quota.js');
const registry = require('../lib/registry.js');

const USAGE = 'usage: limits-series.js [--root <dir>] [--window <ISO>]';
const iso = (s) => new Date(s * 1000).toISOString().replace('.000Z', 'Z');

// Every reading of every session file, tagged with the file's name (the
// session id), oldest first.
function tagged(root) {
    const dir = path.join(root, '.fankeel', 'build', 'limits');
    let names;
    try {
        names = fs.readdirSync(dir);
    } catch (e) {
        return [];
    }
    const out = [];
    for (const n of names.filter((x) => x.endsWith('.jsonl')).sort()) {
        for (const r of readings(fs.readFileSync(path.join(dir, n), 'utf8'))) out.push(Object.assign({ session: n.slice(0, -6) }, r));
    }
    return out.sort((a, b) => a.at - b.at);
}

// Readings grouped by their reset rounded to the hour, the way lib/quota.js
// span() groups them; oldest window first. `resets` is in seconds.
function windows(list) {
    const m = new Map();
    for (const r of list) {
        const k = Math.round(r.resetsAt / 3600);
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(r);
    }
    return [...m.keys()].sort((a, b) => a - b).map((k) => {
        const rows = m.get(k);
        return { resets: k * 3600, rows, sessions: new Set(rows.map((r) => r.session)).size };
    });
}

function main(argv) {
    let values;
    try {
        ({ values } = parseArgs({ args: argv, options: { root: { type: 'string' }, window: { type: 'string' } } }));
    } catch (e) {
        return { text: 'limits-series.js: ' + e.message + '\n' + USAGE, code: 2 };
    }
    let t = null;
    if (values.window) {
        t = Date.parse(values.window) / 1000;
        if (!Number.isFinite(t)) return { text: 'limits-series.js: --window is not a date: ' + values.window + '\n' + USAGE, code: 2 };
    }
    const root = values.root || registry.rootFor({ cwd: process.cwd() });
    const ws = windows(tagged(root));
    if (!ws.length) return { text: 'limits-series.js: no readings under ' + path.join(root, '.fankeel', 'build', 'limits'), code: 1 };
    if (t !== null) {
        const w = ws.find((x) => x.resets === Math.round(t / 3600) * 3600);
        if (!w) return { text: 'limits-series.js: no window resets at ' + values.window + '; windows: ' + ws.map((x) => iso(x.resets)).join(', '), code: 1 };
        return { text: w.rows.map((r) => iso(r.at) + '  ' + r.pct + '%  ' + r.session).join('\n'), code: 0 };
    }
    return {
        text: ws.map((w) => {
            const a = w.rows[0], b = w.rows[w.rows.length - 1];
            return 'resets ' + iso(w.resets) + '  ' + w.rows.length + ' rows  ' + w.sessions + ' sessions  '
                + iso(a.at) + ' ' + a.pct + '% -> ' + iso(b.at) + ' ' + b.pct + '%';
        }).join('\n'),
        code: 0,
    };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { tagged, windows, main };
