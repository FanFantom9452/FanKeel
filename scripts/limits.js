#!/usr/bin/env node
'use strict';
// The 5h and 7d readings hooks/pane.ts recorded for one session
// (.fankeel/build/limits/<session>.jsonl, rows from hooks/pane-limits.ts), as a
// table or an SVG chart — how the two windows moved while a task ran.
//
//   node scripts/limits.js --session <id> [--root <dir>] [--task <name>] [--svg <file>]
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');

const USAGE = 'usage: node scripts/limits.js --session <id> [--root <dir>] [--task <name>] [--svg <file>]';

function readRows(file) {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
        try { return JSON.parse(l); } catch { return null; }
    }).filter((r) => r && typeof r.at === 'string');
}

const pct = (n) => (typeof n === 'number' ? n.toFixed(0) + '%' : '-');

function table(rows) {
    const out = ['at                        stage       5h    7d'];
    for (const r of rows) out.push(r.at.padEnd(26) + String(r.stage || '').padEnd(10) + pct(r.five).padStart(4) + '  ' + pct(r.seven).padStart(4));
    return out.join('\n');
}

// Two lines on one 0–100% axis over the rows' time span: 5h in orange, 7d in blue.
function svg(rows) {
    const W = 720, H = 240, P = 32;
    const ts = rows.map((r) => Date.parse(r.at));
    const t0 = Math.min(...ts), t1 = Math.max(...ts);
    const x = (t) => P + (t1 > t0 ? (t - t0) / (t1 - t0) : 0) * (W - 2 * P);
    const y = (v) => H - P - (v / 100) * (H - 2 * P);
    const line = (key, color) => {
        const pts = rows.filter((r) => typeof r[key] === 'number').map((r) => x(Date.parse(r.at)).toFixed(1) + ',' + y(r[key]).toFixed(1));
        return pts.length ? `<polyline fill="none" stroke="${color}" stroke-width="2" points="${pts.join(' ')}"/>` : '';
    };
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`
        + `<line x1="${P}" y1="${y(0)}" x2="${W - P}" y2="${y(0)}" stroke="#999"/>`
        + `<line x1="${P}" y1="${y(100)}" x2="${W - P}" y2="${y(100)}" stroke="#ddd"/>`
        + `<text x="2" y="${y(100) + 4}" font-size="11">100%</text><text x="2" y="${y(0) + 4}" font-size="11">0%</text>`
        + line('five', '#d9480f') + line('seven', '#1864ab')
        + `<text x="${P}" y="14" font-size="12" fill="#d9480f">5h</text><text x="${P + 30}" y="14" font-size="12" fill="#1864ab">7d</text>`
        + '</svg>\n';
}

function main(argv) {
    const { values } = parseArgs({ args: argv, options: { session: { type: 'string' }, root: { type: 'string' }, task: { type: 'string' }, svg: { type: 'string' } } });
    if (!values.session) throw new Error(USAGE);
    const file = path.join(values.root || process.cwd(), '.fankeel', 'build', 'limits', values.session + '.jsonl');
    let rows = readRows(file);
    if (values.task) rows = rows.filter((r) => r.task === values.task);
    if (!rows.length) return 'no readings in ' + file;
    if (values.svg) {
        fs.writeFileSync(values.svg, svg(rows));
        return values.svg + ' — ' + rows.length + ' readings';
    }
    return table(rows);
}

if (require.main === module) {
    try {
        process.stdout.write(main(process.argv.slice(2)) + '\n');
    } catch (err) {
        process.stderr.write(err.message + '\n');
        process.exit(1);
    }
}

module.exports = { readRows, table, svg, main };
