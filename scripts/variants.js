#!/usr/bin/env node
'use strict';

// Writes agents/<base>-<effort>.md from agents/<base>.md for every base in
// BASES, or the one --base names, and every effort in VARIANT_EFFORTS. Run it
// after editing a base file: tests/agents.test.js fails while a shipped
// variant differs from what this would write.
//
//   node scripts/variants.js [--root <plugin root>] [--base <name>]

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { PLUGIN_ROOT, VARIANT_EFFORTS, renderVariant } = require('../lib/agentfile.js');

const BASES = ['fankeel-brain', 'fankeel-implementer', 'fankeel-reviewer'];

function write(root, only) {
    if (only && !BASES.includes(only)) throw new Error('variants: --base is one of ' + BASES.join(', ') + ', got ' + only);
    const out = [];
    for (const base of only ? [only] : BASES) {
        const source = fs.readFileSync(path.join(root, 'agents', base + '.md'), 'utf8');
        for (const effort of VARIANT_EFFORTS) {
            const rel = 'agents/' + base + '-' + effort + '.md';
            fs.writeFileSync(path.join(root, rel), renderVariant(source, effort));
            out.push('wrote ' + rel);
        }
    }
    return out;
}

if (require.main === module) {
    const { values } = parseArgs({ options: { root: { type: 'string' }, base: { type: 'string' } } });
    process.stdout.write(write(values.root || PLUGIN_ROOT, values.base).join('\n') + '\n');
}

module.exports = { BASES, write };
