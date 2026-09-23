#!/usr/bin/env node
'use strict';

// Archive a landed plan, or its design, and say on the page that it is what
// shipped.
//
//   node archive.js [--root <dir>] <page.md>...
//
// Land used to move the file and nothing else, so an archived plan kept
// `status: design-intent` — six pages on 2026-09-23 — and `docs-audit.js`,
// which skips every archived page by role, never looked again. The write is
// what was wrong, not the read. docs/archive/2026-09-23-needs-a-decision-batch-design.md §2.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseArgs: parseArgv } = require('node:util');
const docs = require('../lib/docs.js');
const { resolveRoot } = require('../lib/registry.js');

const FRONT = /^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/;
const STATUS = /^status:[ \t]*design-intent(?=[ \t]*\r?$)/m;

// `status: design-intent` becomes `status: current` inside the opening
// frontmatter and nowhere else; a line ending is left as it was found.
function flipStatus(text) {
    const m = FRONT.exec(text);
    if (!m) return { text, flipped: false };
    const head = m[0];
    const line = STATUS.exec(head);
    if (!line) return { text, flipped: false };
    const next = head.slice(0, line.index) + 'status: current' + head.slice(line.index + line[0].length);
    return { text: next + text.slice(head.length), flipped: true };
}

function archiveDir(root) {
    const { tree } = docs.read(root);
    const bucket = tree ? tree.buckets.find((b) => b.role === 'archive') : null;
    return bucket ? bucket.path : null;
}

const git = (root, args) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });

function check(root, rel, dir) {
    const from = String(rel).replace(/\\/g, '/').replace(/^\.\//, '');
    if (!fs.existsSync(path.join(root, from))) return { error: from + ' is not there' };
    if (from.startsWith(dir + '/')) return { error: from + ' is already under ' + dir };
    const to = dir + '/' + path.posix.basename(from);
    if (fs.existsSync(path.join(root, to))) return { error: to + ' already exists' };
    return { from, to };
}

function archive(root, rel, dir) {
    const plan = check(root, rel, dir);
    if (plan.error) return plan;
    git(root, ['mv', '--', plan.from, plan.to]);
    // After the move, not before: `git mv` stages the blob it found, so an
    // edit made first stays in the working tree and never reaches the index.
    const file = path.join(root, plan.to);
    const { text, flipped } = flipStatus(fs.readFileSync(file, 'utf8'));
    if (flipped) {
        fs.writeFileSync(file, text);
        git(root, ['add', '--', plan.to]);
    }
    return { from: plan.from, to: plan.to, flipped };
}

function main(argv) {
    const { values, positionals } = parseArgv({ args: argv, allowPositionals: true, strict: false, options: { root: { type: 'string' } } });
    const root = resolveRoot(values.root);
    if (!positionals.length) return { text: 'usage: node scripts/archive.js [--root <dir>] <page.md>...', code: 2 };
    const dir = archiveDir(root);
    if (!dir) return { text: 'fankeel archive: .fankeel/docs.json declares no archive bucket under ' + root, code: 1 };
    // Every page is checked before any moves, so a refused batch moves nothing.
    const refused = positionals.map((p) => check(root, p, dir)).filter((r) => r.error);
    if (refused.length) return { text: refused.map((r) => 'fankeel archive: ' + r.error).join('\n'), code: 1 };
    const lines = positionals.map((p) => {
        const r = archive(root, p, dir);
        return 'archived ' + r.from + ' -> ' + r.to + (r.flipped ? ', status: design-intent -> current' : ', status left as it was');
    });
    return { text: lines.join('\n'), code: 0 };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    process.exit(code);
}

module.exports = { flipStatus, archiveDir, archive, main };
