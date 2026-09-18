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
// resolveRoot. The root is always this plugin's own checkout; tests call
// lib/stage-registry.js's buildRegistry with their own root instead.

const fs = require('node:fs');
const path = require('node:path');

const { buildRegistry } = require('../lib/stage-registry.js');

const OUT_REL = 'skills/registry.json';
const ROOT = path.join(__dirname, '..');

function main() {
    fs.writeFileSync(path.join(ROOT, OUT_REL), JSON.stringify(buildRegistry(ROOT), null, 2) + '\n');
    return OUT_REL + ' written.';
}

if (require.main === module) {
    process.stdout.write(main() + '\n');
}
