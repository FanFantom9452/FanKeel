#!/usr/bin/env node
'use strict';

// build-3, the first of build close's three tiers: a `moved` citation that
// docs-check found at exactly one new line is rewritten to it, with no agent.
// Nothing else is touched — a quote found at two places, or at none, is left
// for the fixer round or the user, because a guessed line is what docs-check
// itself refuses to report.
//
//   node docs-moved.js [--root <dir>]

const fs = require('node:fs');
const path = require('node:path');
const { scan, parseArgs, resolveRef, PATHISH, CODE } = require('./docs-check.js');

// The two shapes docs-check writes a `moved` with one place to send it:
// `<file>:<n> does not hold `<quote>` — it is at :<m>`, and for a range
// `<file>:<a>-<b> does not hold `<quote>` — it is at :<m>, try :<m>-<k>`.
const AT = /^(\S+?):(\d+)(?:-(\d+))? does not hold `[^`]*` — it is at :(\d+)(?:, try :\d+-(\d+))?$/;

// The cited file, the numbers cited and the numbers to write, or null.
function target(what) {
    const m = AT.exec(String(what));
    if (!m) return null;
    const ranged = m[3] !== undefined;
    if (ranged !== (m[5] !== undefined)) return null;
    return { file: m[1], cited: ranged ? m[2] + '-' + m[3] : m[2], to: ranged ? m[4] + '-' + m[5] : m[4] };
}

// The finding's line, with its one code span citing `t.file` at `t.cited`
// given `t.to`. False when the line holds no such span, or more than one:
// then nothing is written.
function rewrite(root, f, t) {
    const full = path.join(root, f.file);
    const lines = fs.readFileSync(full, 'utf8').split('\n');
    const line = lines[f.line - 1];
    if (line === undefined) return false;
    const spans = [];
    for (const m of line.matchAll(new RegExp(CODE.source, 'g'))) {
        const hit = PATHISH.exec(m[1].trim());
        if (!hit || !hit[2]) continue;
        const cited = hit[3] ? hit[2] + '-' + hit[3] : hit[2];
        if (cited === t.cited && resolveRef(root, f.file, hit[1]) === t.file) spans.push(m);
    }
    if (spans.length !== 1) return false;
    const m = spans[0];
    const span = m[0].replace(/:\d+(?:[-–]\d+)?`$/, ':' + t.to + '`');
    lines[f.line - 1] = line.slice(0, m.index) + span + line.slice(m.index + m[0].length);
    fs.writeFileSync(full, lines.join('\n'));
    return true;
}

function main(argv) {
    const { root } = parseArgs(argv);
    const result = scan(root, []);
    if (!result) return { text: 'docs-moved: no file list for ' + root, code: 1 };
    const out = [];
    for (const f of result.findings.filter((x) => x.tag === 'moved')) {
        const t = target(f.what);
        if (t !== null && rewrite(root, f, t)) out.push('fixed ' + f.file + ':' + f.line + ' ' + t.file + ':' + t.cited + ' → :' + t.to);
        else out.push('left ' + f.file + ':' + f.line + '  ' + f.what);
    }
    return { text: out.length ? out.join('\n') : 'docs-moved: no moved citation', code: 0 };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { main, target };
