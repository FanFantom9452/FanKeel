#!/usr/bin/env node
'use strict';

// Whether a project is organised enough for the stages to read it as true:
//
//   node scripts/onboard.js [--full] [--root <dir>]
//
// One line per check, `pass|fail <name> · <evidence>`; exit 1 when any fails.
// Three cheap checks from lib/onboard.js — docs.json, unfiled pages, the
// directory tree — and with --full two more: docs-check reports nothing, and
// docs-audit finds no drift. docs/90-agent/plans/2026-09-30-init-design.md §1.
// `full` lives here rather than in lib/onboard.js because it runs two scripts,
// and nothing under lib/ reaches into scripts/. `init.skip` is ignored: a run
// by hand is a question about the project, not a nag.

const { parseArgs } = require('node:util');

const onboard = require('../lib/onboard.js');
const profile = require('../lib/profile.js');
const { resolveRoot } = require('../lib/registry.js');
const check = require('./docs-check.js');
const audit = require('./docs-audit.js');

const LABELS = Object.assign({}, onboard.NAMES, { docsCheck: 'docs-check', drift: 'drift' });

function base(root, configDir) {
    const c = onboard.cheap(root, configDir, { force: true });
    return { docsJson: c.docsJson, unfiled: c.unfiled, tree: c.tree };
}

function full(root, configDir) {
    const out = base(root, configDir);
    const scanned = check.scan(root);
    out.docsCheck = scanned
        ? { pass: scanned.findings.length === 0, evidence: scanned.findings.length + ' findings over ' + scanned.markdown + ' markdown files' }
        : { pass: false, evidence: 'nothing under ' + root + ' could be read' };
    const swept = audit.sweep(root, audit.DEFAULT_SINCE, Date.now());
    out.drift = swept
        ? { pass: swept.drift.length === 0, evidence: swept.drift.length + ' pages drifted from the code they describe' }
        : { pass: false, evidence: 'nothing under ' + root + ' could be read' };
    return out;
}

function main(argv) {
    let values;
    try {
        ({ values } = parseArgs({ args: argv, strict: true, options: { full: { type: 'boolean' }, root: { type: 'string' } } }));
    } catch (e) {
        return { text: 'onboard.js: ' + e.message + '\nusage: onboard.js [--full] [--root <dir>]', code: 2 };
    }
    const root = resolveRoot(values.root);
    const checks = values.full ? full(root, profile.configDirOf()) : base(root, profile.configDirOf());
    const lines = Object.keys(checks).map((k) => (checks[k].pass ? 'pass ' : 'fail ') + LABELS[k] + ' · ' + checks[k].evidence);
    return { text: lines.join('\n'), code: Object.values(checks).every((c) => c.pass) ? 0 : 1 };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    process.exitCode = code;
}

module.exports = { full, main };
