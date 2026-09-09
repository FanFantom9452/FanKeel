#!/usr/bin/env node
'use strict';

// The thin shell over lib/skills.js: fail-closed because a scan that names
// nothing is treated as the extractor having broken rather than a quiet tree
// (`classify()`'s own `empty-scan`, not judged again here).
//
//   node skills-check.js [--root <dir>]
//
// Two places are scanned for a script or flag mention: every `skills/**/
// SKILL.md`, and `lib/stages.js` — the same two lib/skills.js's own header
// names as what a skill or a stage rule can point at. What each script
// accepts is read off its own source in scripts/, the same three shapes
// `acceptedFlags()` already knows.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');

const { REQUIRED_CORE, references, acceptedFlags, classify } = require('../lib/skills.js');
const { resolveRoot } = require('../lib/registry.js');

// Shape from scripts/docs-check.js:442-454: `strict: false` keeps an unknown
// flag silent, `allowPositionals: true` leaves a bare argument unrejected.
function parseArgs(argv) {
    const { values } = parseArgv({
        args: argv,
        strict: false,
        allowPositionals: true,
        options: { root: { type: 'string' } },
    });
    return { root: resolveRoot(values.root) };
}

// skills/**/SKILL.md, walked by hand — this tree is shallow enough that a
// hand-rolled walk is cheaper than a dependency, and it is the same bargain
// scripts/survey.js already makes. An unreadable directory is not here, not a
// crash: a fresh `--root` with no skills/ yet is a real state to scan.
function walkSkillMd(dir, out) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return out;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkSkillMd(full, out);
        else if (entry.name === 'SKILL.md') out.push(full);
    }
    return out;
}

// The two places a script or flag can be named. Order does not matter to
// `classify()` — every finding it returns already carries its own file and
// line — but `lib/stages.js` is scanned last so a skill's citation is what a
// reader sees first in the printed findings for the common case of one file
// naming a script twice.
function scanTargets(root) {
    const files = walkSkillMd(path.join(root, 'skills'), []);
    const stagesFile = path.join(root, 'lib', 'stages.js');
    if (fs.existsSync(stagesFile)) files.push(stagesFile);
    return files;
}

// A `.js` scan target's own comments talk *about* the shape a script mention
// takes — `lib/stages.js` explains its token substitution by showing
// `<plugin>/scripts/x.js` as a stand-in for any of them — and that stand-in
// reads to the SCRIPT regex exactly like a real citation of a script named
// `x.js`. Blanked rather than dropped, the same reason `docs-check.js` blanks
// a fenced block instead of removing it: every finding is reported as a line
// number, and cutting lines would move every one of them after the comment.
// A trailing comment survives, because this tree's style is a comment on its
// own line, and a narrower filter that also caught those would risk blanking
// a real reference sitting in prose after code on the same line.
function withoutLineComments(text) {
    return text.split('\n').map((line) => (/^\s*\/\//.test(line) ? '' : line)).join('\n');
}

function run(root) {
    const files = scanTargets(root);
    const refs = { scripts: [], flags: [] };
    for (const file of files) {
        const rel = path.relative(root, file).split(path.sep).join('/');
        const text = fs.readFileSync(file, 'utf8');
        const scanned = file.endsWith('.js') ? withoutLineComments(text) : text;
        const found = references(scanned, rel);
        refs.scripts.push(...found.scripts);
        refs.flags.push(...found.flags);
    }

    const scriptsDir = path.join(root, 'scripts');
    let names = [];
    try {
        names = fs.readdirSync(scriptsDir).filter((n) => n.endsWith('.js'));
    } catch (e) {
        names = [];
    }
    const present = new Set(names);

    const accepted = new Map();
    for (const name of present) {
        accepted.set(name, acceptedFlags(fs.readFileSync(path.join(scriptsDir, name), 'utf8')));
    }

    const findings = classify({ refs, present, accepted, core: REQUIRED_CORE });
    return { findings, scanned: { skills: files.length, scripts: present.size } };
}

function main(argv) {
    const { root } = parseArgs(argv);
    const { findings } = run(root);

    // exit code 由 fail 為真的 findings 決定，形狀照 scripts/docs-check.js:431,462-469。
    // empty-scan 是 classify() 回來的其中一條，不是這裡另外判的——同一件事判兩次，零個
    // 引用就會印出兩行說同一件事，而互相矛盾的報告比沒有報告更難用。
    const bad = findings.some((f) => f.fail);
    for (const f of findings) console.log(f.tag + ': ' + f.file + ':' + f.line + '  ' + f.what);
    process.exit(bad ? 1 : 0);
}

if (require.main === module) {
    main(process.argv.slice(2));
}

module.exports = { parseArgs, run };
