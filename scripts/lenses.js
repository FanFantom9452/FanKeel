#!/usr/bin/env node
'use strict';

// Which of build's and verify's two extra reviewer lenses — the
// `## Silent failure` and `## Comment` sections of agents/fankeel-reviewer.md
// — a range's diff is worth dispatching. The classifier is `lib/lenses.js`'s
// `lensesFor`, kept there so a test can call it directly; this script is the
// dispatch step's own CLI, run before sending the reviewer:
//
//   node scripts/lenses.js <range> [--root <dir>]
//
// Prints one lens name per line — `silent-failure`, `comment`, both, or
// neither — then, when a changed file has `verify.blast` or more requirers, a
// `## Blast radius` block listing them; `none` when nothing fired. Exit 0 whatever it
// finds; 1 when `git diff` fails; 2 on a usage error.

const { execFileSync } = require('node:child_process');
const util = require('node:util');
const { lensesFor, blastFor } = require('../lib/lenses.js');
const profile = require('../lib/profile.js');

const USAGE = 'usage: lenses.js <range> [--root <dir>]';

function parseArgs(argv) {
    let parsed;
    try {
        parsed = util.parseArgs({ args: argv, options: { root: { type: 'string' } }, allowPositionals: true });
    } catch (e) {
        return { error: USAGE + ': ' + e.message };
    }
    const range = parsed.positionals[0] || null;
    if (!range) return { error: USAGE };
    // Handed to git as an argument: one starting with `-` would be read as an option.
    if (range.startsWith('-')) return { error: '<range> is <a>..<b>, not an option: ' + range };
    return { range, root: parsed.values.root || process.cwd() };
}

function main(argv) {
    const args = parseArgs(argv);
    if (args.error) {
        process.stderr.write(args.error + '\n');
        return 2;
    }
    let diff;
    try {
        diff = execFileSync('git', ['diff', args.range], { windowsHide: true, cwd: args.root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        process.stderr.write('git diff ' + args.range + ' failed in ' + args.root + ': ' + String(e.stderr || e.message).trim() + '\n');
        return 1;
    }
    const lenses = lensesFor(diff);
    // verify-5: the profile's fan-in threshold; a range that changed no file
    // anything else requires prints nothing here.
    let blast = [];
    try {
        const names = execFileSync('git', ['diff', '--name-only', '--no-renames', args.range], { windowsHide: true, cwd: args.root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
        const threshold = profile.read(args.root, profile.configDirOf()).values['verify.blast'];
        blast = blastFor(args.root, names.split(/\r?\n/).filter(Boolean), threshold);
    } catch (e) {
        process.stderr.write('blast radius skipped in ' + args.root + ': ' + String(e.stderr || e.message).trim() + '\n');
    }
    const lines = [...lenses];
    if (blast.length) {
        lines.push('## Blast radius');
        for (const b of blast) {
            lines.push(b.file + ' — ' + b.callers.length + ' callers');
            for (const c of b.callers) lines.push('  ' + c);
        }
    }
    process.stdout.write((lines.length ? lines.join('\n') : 'none') + '\n');
    return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { parseArgs };
