#!/usr/bin/env node
'use strict';
// Run one eval case with `claude -p`, today, on this tree.
//
//   node scripts/eval.js <case dir> [--model <m>] [--runs <n>] [--plugin-dir <dir>] [--json <path>] [--keep-temp]
//
// `claude plugin eval` is the runner these case files are written for, and it
// is early access — on a machine where it answers "currently in early access"
// this is the runner that answers instead. Same files, fewer graders: it grades
// tool_used and regex, and reports an llm grader as skipped.
//
// Each run is one `claude -p` in a fresh temp directory with the case's
// scaffold_script applied, and with only this plugin loaded:
// --setting-sources project keeps the user's own plugins out (measured
// 2026-09-08: without it haiku took another plugin's skill), --plugin-dir
// loads the tree rather than the installed cache. The prompt goes in on stdin,
// which is what keeps a prompt with quotes and CJK out of a Windows shell line.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseArgs: parseArgv } = require('node:util');
const ev = require('../lib/eval.js');

const ROOT = path.join(__dirname, '..');

function usage() {
    return [
        'usage: node scripts/eval.js <case dir> [--model <m>] [--runs <n>] [--plugin-dir <dir>] [--json <path>] [--keep-temp]',
        '',
        '  runs claude -p once per run in a scaffolded temp directory, with only',
        '  --plugin-dir loaded (--setting-sources project), and grades the',
        '  stream-json transcript against <case dir>/graders/*.md.',
        '  --model defaults to sonnet; --runs to the case\'s `runs`, else 1;',
        '  --plugin-dir to this repository. Any failed grader exits 1.',
    ].join('\n');
}

function parseArgs(argv) {
    const { values, positionals } = parseArgv({
        args: argv,
        strict: false,
        allowPositionals: true,
        options: {
            model: { type: 'string' },
            runs: { type: 'string' },
            'plugin-dir': { type: 'string' },
            json: { type: 'string' },
            'keep-temp': { type: 'boolean' },
            help: { type: 'boolean' },
        },
    });
    return {
        dir: positionals[0] || null,
        model: typeof values.model === 'string' ? values.model : 'sonnet',
        runs: typeof values.runs === 'string' ? Number(values.runs) : null,
        pluginDir: typeof values['plugin-dir'] === 'string' ? values['plugin-dir'] : ROOT,
        json: typeof values.json === 'string' ? values.json : null,
        keepTemp: Boolean(values['keep-temp']),
        help: Boolean(values.help),
    };
}

function scaffold(dir, script) {
    if (!script) return null;
    const r = spawnSync('bash', ['-c', script], { cwd: dir, encoding: 'utf8' });
    return r.status === 0 ? null : 'scaffold_script exited ' + r.status + ': ' + (r.stderr || '').trim();
}

function runOnce(c, opts) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-eval-'));
    const meta = c.prompt.meta;
    const out = { graders: [], toolCalls: 0, lastMessage: '', exit: null, error: null, dir };
    try {
        out.error = scaffold(dir, c.scaffold);
        if (out.error) return out;
        const args = ['-p', '--output-format', 'stream-json', '--verbose', '--setting-sources', 'project',
            '--plugin-dir', opts.pluginDir, '--max-turns', String(meta.max_turns || 10), '--model', opts.model];
        const tools = ev.listValue(meta.allowed_tools);
        if (tools.length) args.push('--allowedTools', tools.join(','));
        const r = spawnSync('claude', args, {
            cwd: dir,
            input: c.prompt.body.trim(),
            encoding: 'utf8',
            timeout: Number(meta.timeout_seconds || 300) * 1000,
            maxBuffer: 64 * 1024 * 1024,
            shell: process.platform === 'win32',
        });
        out.exit = r.status;
        if (r.error) out.error = r.error.code === 'ETIMEDOUT' ? 'timed out after ' + (meta.timeout_seconds || 300) + 's' : String(r.error.message);
        else if (r.status !== 0) out.error = 'claude exited ' + r.status + ': ' + (r.stderr || '').trim().slice(0, 300);
        const lines = String(r.stdout || '').split(/\r?\n/).filter(Boolean);
        out.raw = lines;
        const run = { calls: ev.toolCalls(lines), last: ev.lastMessage(lines) };
        out.toolCalls = run.calls.length;
        out.lastMessage = run.last;
        out.graders = c.graders.map((g) => ev.grade(g, run));
        return out;
    } finally {
        if (!opts.keepTemp) fs.rmSync(dir, { recursive: true, force: true });
    }
}

function render(c, runs) {
    const lines = [];
    let passed = 0;
    let graded = 0;
    runs.forEach((r, i) => {
        if (r.error) lines.push(c.name + ' run ' + (i + 1) + ' error — ' + r.error);
        for (const g of r.graders) {
            const word = g.pass === null ? 'skipped' : g.pass ? 'pass' : 'fail';
            lines.push(c.name + ' run ' + (i + 1) + ' ' + g.name + ' ' + word + ' — ' + g.detail);
            if (g.pass !== null) graded += 1;
            if (g.pass === true) passed += 1;
        }
    });
    lines.push('score ' + passed + '/' + graded);
    return lines.join('\n');
}

function verdict(runs) {
    for (const r of runs) {
        if (r.error) return 1;
        if (r.graders.some((g) => g.pass === false)) return 1;
    }
    return 0;
}

function main(argv) {
    const a = parseArgs(argv);
    if (a.help) { console.log(usage()); return 0; }
    if (!a.dir) { console.error('eval.js: a case dir is required\n' + usage()); return 1; }
    let c;
    try { c = ev.parseCase(path.resolve(a.dir)); } catch (e) { console.error('eval.js: ' + e.message); return 1; }
    const n = a.runs || Number(c.prompt.meta.runs || 1);
    const runs = [];
    for (let i = 0; i < n; i += 1) runs.push(runOnce(c, a));
    console.log(render(c, runs));
    if (a.json) {
        const doc = { case: c.name, model: a.model, pluginDir: a.pluginDir, runs: runs.map((r) => ({ graders: r.graders, toolCalls: r.toolCalls, lastMessage: r.lastMessage, exit: r.exit, error: r.error, raw: r.raw || [] })) };
        fs.writeFileSync(a.json, JSON.stringify(doc, null, 2) + '\n');
    }
    return verdict(runs);
}

if (require.main === module) {
    process.exit(main(process.argv.slice(2)));
}

module.exports = { usage, parseArgs, runOnce, render, verdict, main };
