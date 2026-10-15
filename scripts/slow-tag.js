#!/usr/bin/env node
'use strict';
// scripts/slow-tag.js: tag the tests a timed run found slow with @slow, the
// tag package.json's test:fast skips.
//
//   node --test --test-reporter=tap > run.tap
//   node scripts/slow-tag.js run.tap [--min <seconds>] [--dir tests]
//
// Reads every test point's duration_ms from the TAP, and for each one at or
// over --min (default 10) appends " @slow" to its name where a *.test.js in
// --dir spells that name as a string literal. Prints `tagged <n> in <file>`
// per file it changed, then `not found: <name>` for each slow name no literal
// spells — a name built at run time, which is tagged by hand.
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');

const TAG = '@slow';

function durations(tap) {
    const out = [];
    let name = null;
    for (const line of String(tap).split(/\r?\n/)) {
        const point = /^\s*(?:not )?ok \d+ - (.+)$/.exec(line);
        if (point) { name = point[1].replace(/\s+#\s*(TODO|SKIP)\b.*$/i, ''); continue; }
        const d = /^\s*duration_ms: ([\d.]+)/.exec(line);
        if (d && name !== null) { out.push({ name, ms: Number(d[1]) }); name = null; }
    }
    return out;
}

// The source with the first literal spelling `name` tagged, or null where none does.
function tag(source, name) {
    for (const q of ["'", '"', '`']) {
        const lit = q + name.replace(/\\/g, '\\\\').split(q).join('\\' + q) + q;
        const at = source.indexOf(lit);
        if (at !== -1) return source.slice(0, at + lit.length - 1) + ' ' + TAG + source.slice(at + lit.length - 1);
    }
    return null;
}

function main(argv) {
    const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, strict: false, options: { min: { type: 'string' }, dir: { type: 'string' } } });
    if (!positionals[0]) return { text: 'slow-tag: usage: slow-tag.js <run.tap> [--min <seconds>] [--dir <tests dir>]', ok: false };
    const min = values.min === undefined ? 10 : Number(values.min);
    if (!(min > 0)) return { text: 'slow-tag: --min needs a number of seconds', ok: false };
    const dir = path.resolve(values.dir || 'tests');
    const slow = durations(fs.readFileSync(positionals[0], 'utf8')).filter((t) => t.ms >= min * 1000 && !t.name.includes(TAG));
    const files = fs.readdirSync(dir).filter((f) => /\.test\.[cm]?js$/.test(f)).sort();
    const text = new Map(files.map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
    const changed = new Map();
    const missing = [];
    for (const t of slow) {
        const hit = files.find((f) => tag(text.get(f), t.name) !== null);
        if (!hit) { missing.push(t.name); continue; }
        text.set(hit, tag(text.get(hit), t.name));
        changed.set(hit, (changed.get(hit) || 0) + 1);
    }
    for (const f of changed.keys()) fs.writeFileSync(path.join(dir, f), text.get(f));
    const lines = [...changed].map(([f, n]) => 'tagged ' + n + ' in ' + path.basename(dir) + '/' + f)
        .concat(missing.map((n) => 'not found: ' + n));
    return { text: lines.length ? lines.join('\n') : 'slow-tag: nothing at or over ' + min + 's', ok: true };
}

if (require.main === module) {
    const r = main(process.argv.slice(2));
    process.stdout.write(r.text + '\n');
    process.exit(r.ok ? 0 : 1);
}

module.exports = { durations, tag, main };
