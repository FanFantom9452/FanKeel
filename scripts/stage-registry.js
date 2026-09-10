#!/usr/bin/env node
'use strict';

// Writes skills/registry.json — the machine-readable half of what
// lib/stages.js and each skills/fankeel-<stage>/SKILL.md already say in
// prose: which sentence gates entry to a stage's skill, which sentence says
// it is done, and how many of its own budgeted bytes it spends today.
//
// This is about fankeel's own stages, not about whatever project the plugin
// is running against — unlike scripts/map.js, there is no separate "target
// project" root to resolve, so this does not go through lib/registry.js's
// resolveRoot. The root is this plugin's own checkout unless --root says
// otherwise, which only exists for pointing a test at a fixture tree.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');

const { buildRegistry } = require('../lib/stage-registry.js');

const OUT_REL = 'skills/registry.json';
const DEFAULT_ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
    const { values } = parseArgv({ args: argv, strict: false, allowPositionals: true, options: { root: { type: 'string' }, print: { type: 'boolean' } } });
    return {
        root: typeof values.root === 'string' ? values.root : DEFAULT_ROOT,
        print: values.print === true,
    };
}

function main(argv) {
    const { root, print } = parseArgs(argv);
    const text = JSON.stringify(buildRegistry(root), null, 2) + '\n';
    if (print) return text;
    fs.writeFileSync(path.join(root, OUT_REL), text);
    return OUT_REL + ' written.';
}

if (require.main === module) {
    process.stdout.write(main(process.argv.slice(2)) + '\n');
}
