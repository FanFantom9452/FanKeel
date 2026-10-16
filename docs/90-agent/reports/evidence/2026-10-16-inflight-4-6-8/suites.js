'use strict';
// Runs k full suites at once, one per worktree, and records per-suite wall
// clock, pass/fail counts and the names of failing tests.
// usage: node suites.js <k> <label> [--conc <n>]
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const k = Number(process.argv[2]);
const label = process.argv[3];
const ci = process.argv.indexOf('--conc');
const conc = ci > 0 ? process.argv[ci + 1] : null;
const base = __dirname;
const out = path.join(base, 'results');
fs.mkdirSync(out, { recursive: true });

function one(i) {
    return new Promise((resolve) => {
        const cwd = path.join(base, 'wt' + i);
        const args = ['--test'];
        if (conc) args.push('--test-concurrency=' + conc);
        const t0 = Date.now();
        const p = spawn(process.execPath, args, { cwd, env: Object.assign({}, process.env, { FANKEEL_BROWSER: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' }) });
        let buf = '';
        p.stdout.on('data', (d) => { buf += d; });
        p.stderr.on('data', (d) => { buf += d; });
        p.on('close', (code) => {
            const wall = (Date.now() - t0) / 1000;
            fs.writeFileSync(path.join(out, label + '-s' + i + '.txt'), buf);
            const num = (re) => { const m = buf.match(re); return m ? Number(m[1]) : null; };
            const fails = [...buf.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map((m) => m[1].trim());
            resolve({ suite: i, code, wall, pass: num(/^ℹ pass (\d+)/m), fail: num(/^ℹ fail (\d+)/m), fails });
        });
    });
}

(async () => {
    const t0 = Date.now();
    const rows = await Promise.all(Array.from({ length: k }, (_, j) => one(j + 1)));
    const res = { label, k, conc, totalWall: (Date.now() - t0) / 1000, rows };
    fs.writeFileSync(path.join(out, label + '.json'), JSON.stringify(res, null, 2));
    for (const r of rows) console.log(label, 's' + r.suite, 'wall', r.wall, 'pass', r.pass, 'fail', r.fail, r.fails.slice(0, 12).join(' | '));
})();
