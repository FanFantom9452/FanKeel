#!/usr/bin/env node
'use strict';

// Two sessions' main-thread context side by side: a baseline and one controlled
// run, so a person can judge the run against the baseline by reading the rows.
//
//   node docs/reports/evidence/2026-09-22-controlled-run/compare.js <baseline> <run> [--claude-dir <dir>]
//
// Each argument is a session id or a `.jsonl` path, resolved as `scripts/ctx.js`
// resolves one. The run's preconditions, the terminal it must be started in and
// the route it must take, are in docs/plans/2026-09-21-all-stages-brain-held.md:47-53.
// This script only reads a run; it starts none.
//
// Nothing is parsed here: `measure` in `scripts/ctx.js` gives the per-stage rows,
// gates and peak, and `lib/usage.js` finds the run's agent files. Rows that
// share a stage name (a baseline visits build and verify twice) are summed.
//
// Exit 0 with the tables; 1 when an argument resolves to no transcript or to one
// `measure` cannot read, naming that argument; 2 on a wrong argument count.
const os = require('node:os');
const path = require('node:path');
const { parseArgs } = require('node:util');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const ctx = require(path.join(REPO, 'scripts', 'ctx.js'));
const detail = require(path.join(REPO, 'lib', 'detail.js'));
const usage = require(path.join(REPO, 'lib', 'usage.js'));
const { BUSY } = require(path.join(REPO, 'lib', 'context.js'));

// The author's proposal, held plan line 53, not a standard: the same route in at
// most 60 main-thread turns, and the last gate asked with under 200,000 context.
const MAX_TURNS = 60;
const MAX_LAST_GATE = 200000;

const USAGE = 'usage: node compare.js <baseline> <run>   [--claude-dir <dir>]   (each a session id or a .jsonl path)';
const DASH = '—';
const n = (v) => v.toLocaleString('en-US');

// One row per stage name, in order of first visit, same-name visits summed.
function merged(m) {
    const byName = new Map();
    for (const r of m.stages) {
        const name = r.stage || '(before)';
        if (!byName.has(name)) byName.set(name, { turns: 0, woken: 0, gates: 0, reread: 0 });
        const row = byName.get(name);
        row.turns += r.turns;
        row.woken += r.woken;
        row.gates += r.gates;
        row.reread += r.reread;
    }
    return byName;
}

const sumOf = (rows) => [...rows.values()].reduce((t, r) => ({
    turns: t.turns + r.turns, woken: t.woken + r.woken, gates: t.gates + r.gates, reread: t.reread + r.reread,
}), { turns: 0, woken: 0, gates: 0, reread: 0 });

const cells = (row) => (row
    ? [String(row.turns), String(row.woken), String(row.gates), n(row.reread)]
    : [DASH, DASH, DASH, DASH]);

function table(header, body) {
    const all = [header, ...body];
    const widths = header.map((_, c) => Math.max(...all.map((r) => r[c].length)));
    return all.map((r) => r.map((cell, c) => (c === 0 ? cell.padEnd(widths[c]) : cell.padStart(widths[c]))).join('  ')).join('\n');
}

function stageTable(a, b) {
    const ra = merged(a);
    const rb = merged(b);
    const names = [...new Set([...ra.keys(), ...rb.keys()])];
    const header = ['stage', 'turns', 'woken', 'gates', 're-read', '|', 'turns', 'woken', 'gates', 're-read'];
    const line = (name, x, y) => [name, ...cells(x), '|', ...cells(y)];
    const body = names.map((name) => line(name, ra.get(name), rb.get(name)));
    body.push(line('total', sumOf(ra), sumOf(rb)));
    body.push(['last context', n(a.last), '', '', '', '|', n(b.last), '', '', '']);
    return 'stages (left: baseline, right: run; a stage on one side only shows ' + DASH + ' on the other)\n' + table(header, body);
}

function thresholds(m) {
    const lastGate = m.gates.length ? m.gates[m.gates.length - 1] : null;
    const verdict = (ok) => (ok ? 'PASS' : 'FAIL');
    return [
        'thresholds (the author\'s proposal, held plan line 53, not a standard)',
        '  main-thread turns at most ' + MAX_TURNS + ':   run ' + n(m.turns) + '   ' + verdict(m.turns <= MAX_TURNS),
        '  last gate context under ' + n(MAX_LAST_GATE) + ':   run ' + (lastGate === null ? 'no gate' : n(lastGate) + '   ' + verdict(lastGate < MAX_LAST_GATE)),
    ].join('\n');
}

function agentLines(runFile) {
    const files = usage.agentFiles(usage.sessionDirOf(runFile));
    const out = ['agent files of the run (turns, peak context; ≥' + n(BUSY / 1000) + 'k marks a peak at or above ' + n(BUSY) + ')'];
    if (!files.length) return out.concat('  no agent files');
    for (const file of files) {
        const m = ctx.measure(file);
        out.push('  ' + path.basename(file) + (m
            ? '   turns ' + n(m.turns) + '   peak ' + n(m.peak) + (m.peak >= BUSY ? '   ≥' + n(BUSY / 1000) + 'k' : '')
            : '   unreadable'));
    }
    return out;
}

function main(argv) {
    let parsed;
    try {
        parsed = parseArgs({ args: argv, options: { 'claude-dir': { type: 'string' } }, allowPositionals: true, strict: true });
    } catch (e) {
        return { text: USAGE, code: 2 };
    }
    const { values, positionals } = parsed;
    if (positionals.length !== 2) return { text: USAGE, code: 2 };
    const claudeDir = values['claude-dir'] || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    const files = positionals.map((p) => (p.endsWith('.jsonl') ? p : detail.transcriptOf(claudeDir, p)));
    const ms = files.map((file) => (file ? ctx.measure(file) : null));
    const bad = positionals.filter((_, i) => !ms[i]);
    if (bad.length) {
        return { text: bad.map((p) => 'no readable transcript for argument: ' + p).join('\n'), code: 1 };
    }
    return {
        text: [
            'baseline ' + positionals[0] + '\nrun      ' + positionals[1],
            stageTable(ms[0], ms[1]),
            thresholds(ms[1]),
            agentLines(files[1]).join('\n'),
        ].join('\n\n'),
    };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    (code ? process.stderr : process.stdout).write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { main };
