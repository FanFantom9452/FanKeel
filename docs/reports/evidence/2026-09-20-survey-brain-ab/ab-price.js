// Per-token prices backed out of modelUsage: for each model, least squares of costUSD on
// input, output, cache read and cache write over every per-model row of the ab*-table.txt
// files, then each named arm's cost split by that price. The input column is a handful of
// tokens per row, so its price is not determined; it is printed and not used.
// usage: node ab-price.js <arm>... — the arms whose cost to split
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const rows = [];
for (const f of fs.readdirSync(__dirname).filter((n) => /^ab\d*-table\.txt$/.test(n)).sort()) {
    for (const line of fs.readFileSync(path.join(__dirname, f), 'utf8').split('\n')) {
        const m = /^  (\S+)  (\S+)  \$([\d.]+)  in (\d+)  out (\d+)  cacheR (\d+)  cacheW (\d+)/.exec(line);
        if (m) rows.push({ arm: m[1], model: m[2], cost: Number(m[3]), x: [m[4], m[5], m[6], m[7]].map(Number) });
    }
}

function solve(rs) {
    const n = 4;
    const A = [...Array(n)].map((_, i) => [...Array(n)].map((_, j) => rs.reduce((s, r) => s + r.x[i] * r.x[j], 0)));
    const b = [...Array(n)].map((_, i) => rs.reduce((s, r) => s + r.x[i] * r.cost, 0));
    for (let i = 0; i < n; i++) for (let k = i + 1; k < n; k++) {
        const f = A[k][i] / A[i][i];
        for (let j = i; j < n; j++) A[k][j] -= f * A[i][j];
        b[k] -= f * b[i];
    }
    const c = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        let s = b[i];
        for (let j = i + 1; j < n; j++) s -= A[i][j] * c[j];
        c[i] = s / A[i][i];
    }
    return c;
}

const wanted = new Set(process.argv.slice(2));
for (const model of [...new Set(rows.map((r) => r.model))]) {
    const rs = rows.filter((r) => r.model === model);
    const c = solve(rs);
    const err = Math.max(...rs.map((r) => Math.abs(r.x.reduce((s, v, i) => s + v * c[i], 0) - r.cost)));
    console.log(model + ' (' + rs.length + ' rows): $ per million — output ' + (c[1] * 1e6).toFixed(2) +
        ', cache read ' + (c[2] * 1e6).toFixed(3) + ', cache write ' + (c[3] * 1e6).toFixed(3) +
        ' (input ' + (c[0] * 1e6).toFixed(2) + ', not determined); largest error $' + err.toFixed(4));
    for (const r of rs.filter((row) => wanted.has(row.arm))) {
        const part = (i) => r.x[i] * c[i];
        console.log('    ' + r.arm + ' $' + r.cost.toFixed(4) + ': output $' + part(1).toFixed(3) + ' (' + Math.round(100 * part(1) / r.cost) +
            '%), cache read $' + part(2).toFixed(3) + ' (' + Math.round(100 * part(2) / r.cost) +
            '%), cache write $' + part(3).toFixed(3) + ' (' + Math.round(100 * part(3) / r.cost) + '%)');
    }
}
