#!/usr/bin/env node
'use strict';
// scripts/review-check.js: the mechanical part of build's per-task review.
//
//   node scripts/review-check.js --sha <sha> [--base <sha>] [--returned <file>] [--root <dir>]
//
// Prints lib/reviewcheck.js's three tables for <base>..<sha> (<base> defaults
// to <sha>^; <root> to the repository the cwd is in). Exit 0 when no row is a
// finding, 1 when one is, 2 on a usage error, a git refusal or a fault in the
// script itself (the message, or the stack, on stderr), so that 1 means
// findings and only findings. The reviewer pastes the output and judges only what the tables
// cannot: whether each cited test asserts the effect.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const { tables, render } = require('../lib/reviewcheck.js');

function topLevel() {
    try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return process.cwd(); }
}

const usage = (text) => ({ text: 'review-check: ' + text, ok: false, code: 2 });

function main(argv) {
    const { values } = parseArgs({
        args: argv, strict: false,
        options: { sha: { type: 'string' }, base: { type: 'string' }, returned: { type: 'string' }, root: { type: 'string' } },
    });
    if (!values.sha || typeof values.sha !== 'string') return usage('--sha <sha> is required.');
    // Handed to git as an argument: one starting with `-` would be read as an option.
    for (const k of ['sha', 'base']) {
        if (values[k] !== undefined && (typeof values[k] !== 'string' || values[k].startsWith('-'))) return usage('--' + k + ' takes a commit, not an option: ' + values[k]);
    }
    let returned = null;
    if (values.returned) {
        if (typeof values.returned !== 'string') return usage('--returned takes a file.');
        try { returned = fs.readFileSync(values.returned, 'utf8'); } catch (e) { return usage('cannot read ' + values.returned); }
    }
    let t;
    try {
        t = tables(values.root || topLevel(), { sha: values.sha, base: values.base || values.sha + '^', returned });
    } catch (e) {
        // An uncaught throw exits 1, the findings code: a fault must not read as one.
        return usage(e.git ? 'git refused — ' + e.message : e.stack || String(e));
    }
    return { text: render(t), ok: t.findings === 0, code: t.findings === 0 ? 0 : 1 };
}

if (require.main === module) {
    const r = main(process.argv.slice(2));
    if (r.code === 2) process.stderr.write(r.text + '\n');
    else process.stdout.write(r.text + '\n');
    process.exitCode = r.code;
}

module.exports = { main };
