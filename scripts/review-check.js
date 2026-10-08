#!/usr/bin/env node
'use strict';
// scripts/review-check.js: the mechanical part of build's per-task review.
//
//   node scripts/review-check.js --sha <sha> [--base <sha>] [--returned <file>] [--root <dir>]
//
// Prints lib/reviewcheck.js's three tables for <base>..<sha> (<base> defaults
// to <sha>^; <root> to the repository the cwd is in) and exits 1 when any row
// is a finding, 0 when none is. The reviewer pastes the output and judges only
// what the tables cannot: whether each cited test asserts the effect.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const { tables, render } = require('../lib/reviewcheck.js');

function topLevel() {
    try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim(); } catch (e) { return process.cwd(); }
}

function main(argv) {
    const { values } = parseArgs({
        args: argv, strict: false,
        options: { sha: { type: 'string' }, base: { type: 'string' }, returned: { type: 'string' }, root: { type: 'string' } },
    });
    if (!values.sha) return { text: 'review-check: --sha <sha> is required.', ok: false };
    let returned = null;
    if (values.returned) {
        try { returned = fs.readFileSync(values.returned, 'utf8'); } catch (e) { return { text: 'review-check: cannot read ' + values.returned, ok: false }; }
    }
    let t;
    try {
        t = tables(values.root || topLevel(), { sha: values.sha, base: values.base || values.sha + '^', returned });
    } catch (e) {
        return { text: 'review-check: git refused — ' + String(e.message || e).split('\n')[0], ok: false };
    }
    const findings = [].concat(t.selectors, t.tests, t.cites).filter((r) => r.finding).length;
    return { text: render(t), ok: findings === 0 };
}

if (require.main === module) {
    const r = main(process.argv.slice(2));
    process.stdout.write(r.text + '\n');
    process.exit(r.ok ? 0 : 1);
}

module.exports = { main };
