// Where each transcript's output tokens went. Thinking text is not stored — a thinking
// block keeps only its signature — so per assistant message (deduplicated by message id,
// output_tokens taken at its largest) this prints the output tokens beside what is visible:
// CJK and other characters of text and tool input, the Write input on its own, and the
// signature length. Arms and sessions come from each <dir>/provenance.txt.
// usage: node ab-output.js <dir>... — prints one line per transcript, then the fit
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const P = path.join(os.homedir(), '.claude', 'projects', 'F--ymlab-fankeel');
const CJK = /[⺀-鿿豈-﫿＀-￯]/g;

function messages(file) {
    const byId = new Map();
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        let o; try { o = JSON.parse(line); } catch (e) { continue; }
        if (o.type !== 'assistant' || !o.message || !o.message.id) continue;
        const m = byId.get(o.message.id) || { out: 0, cjk: 0, other: 0, write: 0, sig: 0 };
        m.out = Math.max(m.out, (o.message.usage && o.message.usage.output_tokens) || 0);
        for (const b of o.message.content || []) {
            let s = '';
            if (b.type === 'text') s = b.text;
            else if (b.type === 'tool_use') s = JSON.stringify(b.input);
            else if (b.type === 'thinking') m.sig += (b.signature || '').length;
            const cjk = (s.match(CJK) || []).length;
            m.cjk += cjk; m.other += s.length - cjk;
            if (b.type === 'tool_use' && b.name === 'Write') m.write += s.length;
        }
        byId.set(o.message.id, m);
    }
    return [...byId.values()];
}

const rows = [];
function report(label, file) {
    const ms = messages(file);
    const sum = (k) => ms.reduce((a, m) => a + m[k], 0);
    const w = ms.filter((m) => m.write > 0);
    rows.push(...ms.map((m) => Object.assign({ label }, m)));
    console.log(label + ': messages ' + ms.length + ', output tokens ' + sum('out') +
        ', visible chars ' + (sum('cjk') + sum('other')) + ' (CJK ' + sum('cjk') + '), signature chars ' + sum('sig') +
        (w.length ? ', the Write message: output tokens ' + w.reduce((a, m) => a + m.out, 0) + ', Write input chars ' + sum('write') : ''));
}

for (const dir of process.argv.slice(2)) {
    const log = fs.readFileSync(path.join(__dirname, dir, 'provenance.txt'), 'utf8');
    for (const m of log.matchAll(/^--- (\S+) .*session ([0-9a-f-]{36})$/gm)) {
        report(m[1] + ' main', path.join(P, m[2] + '.jsonl'));
        const sub = path.join(P, m[2], 'subagents');
        let names = [];
        try { names = fs.readdirSync(sub).filter((n) => /^agent-[0-9a-f]+\.jsonl$/.test(n)); } catch (e) { /* none */ }
        for (const n of names) report(m[1] + ' brain', path.join(sub, n));
    }
}

// Least squares, no intercept: output ≈ a·CJK + b·other + c·signature, over every message.
const X = rows.map((r) => [r.cjk, r.other, r.sig]);
const y = rows.map((r) => r.out);
const A = [0, 1, 2].map((i) => [0, 1, 2].map((j) => X.reduce((s, x) => s + x[i] * x[j], 0)));
const b = [0, 1, 2].map((i) => X.reduce((s, x, k) => s + x[i] * y[k], 0));
for (let i = 0; i < 3; i++) for (let k = i + 1; k < 3; k++) {
    const f = A[k][i] / A[i][i];
    for (let j = i; j < 3; j++) A[k][j] -= f * A[i][j];
    b[k] -= f * b[i];
}
const c = [0, 0, 0];
for (let i = 2; i >= 0; i--) c[i] = (b[i] - [0, 1, 2].slice(i + 1).reduce((s, j) => s + A[i][j] * c[j], 0)) / A[i][i];
const fit = y.map((v, k) => X[k][0] * c[0] + X[k][1] * c[1] + X[k][2] * c[2]);
const mean = y.reduce((a, v) => a + v, 0) / y.length;
const r2 = 1 - y.reduce((s, v, k) => s + (v - fit[k]) ** 2, 0) / y.reduce((s, v) => s + (v - mean) ** 2, 0);
console.log('\nfit over ' + rows.length + ' messages: tokens per CJK char ' + c[0].toFixed(3) + ', per other char ' + c[1].toFixed(3) + ', per signature char ' + c[2].toFixed(3) + ', R² ' + r2.toFixed(3));
const labels = [...new Set(rows.map((r) => r.label))];
for (const label of labels) {
    const rs = rows.filter((r) => r.label === label);
    const think = rs.reduce((s, r) => s + r.sig * c[2], 0);
    const seen = rs.reduce((s, r) => s + r.cjk * c[0] + r.other * c[1], 0);
    const write = rs.reduce((s, r) => s + (r.write ? r.write * (r.cjk / (r.cjk + r.other)) * c[0] + r.write * (r.other / (r.cjk + r.other)) * c[1] : 0), 0);
    console.log('  ' + label + ': output ' + rs.reduce((s, r) => s + r.out, 0) + ' ≈ thinking ' + Math.round(think) + ' + visible ' + Math.round(seen) + ' (of which the handoff Write ' + Math.round(write) + ')');
}
