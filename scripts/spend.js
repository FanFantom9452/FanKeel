#!/usr/bin/env node
'use strict';

// The cost composition table: what every session's `spend` field prices out
// to, by component, and how that composition shifts with how long a task ran.
//
//   node scripts/spend.js [--root <dir>]
//
// A thin wrapper over `lib/spend.js`, which does the pricing: this only
// resolves the registry roots and prints two tables, one row per session and
// one per request-count bucket. `--root <dir>` overrides discovery with
// exactly that one root; with none, roots come from `lib/station.js`'s own
// `discover()` — the same leads, running sessions and remembered
// `roots.json` the station itself reads, so this table and the station agree
// on which registries exist without a second copy of that logic.
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');
const spend = require('../lib/spend.js');
const station = require('../lib/station.js');
const live = require('../lib/live.js');

const OPTIONS = { root: { type: 'string' } };

function parseArgs(argv) {
    const { values } = parseArgv({ args: argv, options: OPTIONS, allowPositionals: false, strict: true });
    return { root: values.root || null };
}

// `station.discover` when there is nothing to override it with — the route
// that says which leads, live sessions and remembered roots it found. The
// one-root override takes the other route: it names the registry directly
// and nothing is discovered.
function resolveRoots(overrideRoot) {
    if (overrideRoot) return { roots: [path.resolve(overrideRoot)], via: 'override' };
    const configDir = live.liveConfigDir();
    const found = station.discover({ configDir, cwd: process.cwd() });
    return { roots: found.roots, via: 'station.discover' };
}

const usd = (n) => (n == null ? '—' : '$' + n.toFixed(2));
const pct = (n) => (n == null ? '—' : Math.round(n * 1000) / 10 + '%');

function sessionsTable(rows) {
    const header = ['session', 'root', 'version', 'requests', 'own', 'agents', 'input', 'output', 'cacheRead', 'cacheWrite', 'usd', 'unpriced'];
    const lines = [header.join('\t')];
    for (const r of rows) {
        lines.push([
            r.sessionId, r.root, r.version == null ? '—' : r.version, r.requests,
            usd(r.own), usd(r.subagents), usd(r.cost.input), usd(r.cost.output),
            usd(r.cost.cacheRead), usd(r.cost.cacheWrite), usd(r.usd),
            r.unpriced.length ? r.unpriced.join(',') : '—',
        ].join('\t'));
    }
    return lines.join('\n');
}

function bucketsTable(list) {
    const header = ['range', 'sessions', 'total', 'median', 'input%', 'output%', 'cacheRead%', 'cacheWrite%'];
    const lines = [header.join('\t')];
    for (const b of list) {
        lines.push([
            b.range, b.count, usd(b.total), usd(b.median),
            pct(b.share.input), pct(b.share.output), pct(b.share.cacheRead), pct(b.share.cacheWrite),
        ].join('\t'));
    }
    return lines.join('\n');
}

function main(argv) {
    const { root: overrideRoot } = parseArgs(argv);
    const { roots, via } = resolveRoots(overrideRoot);
    const rows = spend.sessionsOf(roots);
    const bs = spend.buckets(rows);
    const text = 'roots (' + via + '): ' + (roots.length ? roots.join(', ') : '(none found)') + '\n\n'
        + 'sessions\n' + sessionsTable(rows) + '\n\n'
        + 'buckets by request count\n' + bucketsTable(bs);
    return { text };
}

if (require.main === module) {
    const { text } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
}

module.exports = { main, resolveRoots, parseArgs };
