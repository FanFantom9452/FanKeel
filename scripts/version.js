#!/usr/bin/env node
'use strict';

// The release number, in the ten places that carry it.
//
//   node version.js              what they say, and whether they agree
//   node version.js 0.35.0       set all ten
//   node version.js --changes    what has landed since the last release commit
//
// Two manifests and one frontmatter line in each of the eight skills. Nothing
// used to set them together, so a release was ten edits and a miss left a skill
// announcing a version the plugin is not — wrong in a way nobody reads carefully
// enough to catch, because the number is right in nine places.
//
// `tests/contract.test.js` is the other half and the one that runs unasked: it
// fails when the ten disagree. This is what makes them agree without ten edits.
// Neither is enough alone — a check with no fixer is a chore, and a fixer with no
// check is one somebody forgets to run.
//
// It does not tag, commit or publish. What a release is remains the person's
// decision; this only writes the number they picked.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const MANIFESTS = ['package.json', '.claude-plugin/plugin.json'];
const SEMVER = /^\d+\.\d+\.\d+$/;

// The skills are found rather than listed, because adding a stage means adding a
// skill and that should not need this file edited to be covered. The manifests
// are listed, because a third one is a decision rather than a directory entry.
function skillFiles(root) {
    const dir = path.join(root, 'skills');
    let names;
    try {
        names = fs.readdirSync(dir);
    } catch (e) {
        return [];
    }
    return names
        .map((n) => 'skills/' + n + '/SKILL.md')
        .filter((rel) => fs.existsSync(path.join(root, rel)))
        .sort();
}

const VERSION_LINE = /^version:[ \t]*(\S+)[ \t]*$/m;

// One entry per file, in the order a reader would check them. A file that cannot
// be read or carries no version line is reported as `null` rather than skipped —
// a place the number should be and is not is the same defect as one that
// disagrees.
function readAll(root) {
    const out = [];
    for (const rel of MANIFESTS) {
        let version = null;
        try {
            version = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')).version || null;
        } catch (e) {
            version = null;
        }
        out.push({ file: rel, version });
    }
    for (const rel of skillFiles(root)) {
        let version = null;
        try {
            const m = fs.readFileSync(path.join(root, rel), 'utf8').match(VERSION_LINE);
            version = m ? m[1] : null;
        } catch (e) {
            version = null;
        }
        out.push({ file: rel, version });
    }
    return out;
}

// The manifests are rewritten by editing the one line rather than by
// re-serialising the parsed object: `JSON.stringify` would reformat a file
// somebody hand-maintains, and a version bump that reflows a manifest is a diff
// nobody can review.
function writeOne(root, rel, next) {
    const file = path.join(root, rel);
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return false;
    }
    const after = rel.endsWith('.json')
        ? text.replace(/("version"\s*:\s*")[^"]*(")/, '$1' + next + '$2')
        : text.replace(VERSION_LINE, 'version: ' + next);
    if (after === text) return false;
    try {
        fs.writeFileSync(file, after);
    } catch (e) {
        return false;
    }
    return true;
}

// What a release would contain, which is the second half of the same gap: the
// number was in ten places and what changed between two of them was in none.
//
// Derived rather than written down. A release commit is `chore: <x.y.z> ...`, so
// the commits after the newest one are this release — a hand-kept changelog is a
// second copy of that, and the copy is the one that goes stale.
//
// Subjects only. A body belongs to the commit that carries it, and a list nobody
// can read to the end says less than a shorter one somebody does.
const RELEASE = /^chore: \d+\.\d+\.\d+\b/;

function changes(root) {
    let out;
    try {
        out = execFileSync('git', ['log', '--format=%H%x09%s', '-n', '400'], {
            cwd: root || ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch (e) {
        return null;
    }
    const rows = out.split('\n').filter(Boolean).map((l) => {
        const at = l.indexOf('\t');
        return { sha: l.slice(0, at), subject: l.slice(at + 1) };
    });
    const at = rows.findIndex((r) => RELEASE.test(r.subject));
    // No release commit in reach is not an error — it is a repository that has
    // not made one, and every commit is what the first one would contain.
    return { since: at === -1 ? null : rows[at], commits: rows.slice(0, at === -1 ? rows.length : at) };
}

function changeReport(found, current) {
    if (!found) return { text: 'fankeel version — no git history here to read a release out of.', code: 1 };
    const { since, commits } = found;
    const head = since
        ? 'fankeel version — ' + commits.length + ' commit(s) since ' + since.subject
        : 'fankeel version — no release commit found; all ' + commits.length + ' commit(s) would be the first';
    if (!commits.length) {
        return { text: head + '.\nNothing has landed since; ' + current + ' is what is out.', code: 0 };
    }
    return {
        text: [head + ':', ''].concat(commits.map((c) => '  ' + c.sha.slice(0, 7) + '  ' + c.subject)).join('\n'),
        code: 0,
    };
}

function report(rows) {
    const versions = [...new Set(rows.map((r) => r.version))];
    const lines = [];
    if (versions.length === 1 && versions[0]) {
        lines.push('fankeel version — ' + versions[0] + ', in all ' + rows.length + ' places.');
        return { text: lines.join('\n'), code: 0 };
    }
    lines.push('fankeel version — ' + versions.length + ' different answers across '
        + rows.length + ' files:');
    lines.push('');
    for (const r of rows) lines.push('  ' + (r.version || '(none)').padEnd(10) + r.file);
    lines.push('');
    lines.push('`node scripts/version.js <x.y.z>` sets them all.');
    return { text: lines.join('\n'), code: 1 };
}

function main(argv, root) {
    const at = root || ROOT;
    const args = argv || [];
    if (args.includes('--changes')) {
        const rows = readAll(at);
        const versions = [...new Set(rows.map((r) => r.version))];
        return changeReport(changes(at), versions.length === 1 ? versions[0] : 'the version');
    }
    const next = args.find((a) => !a.startsWith('-'));
    if (!next) return report(readAll(at));

    if (!SEMVER.test(next)) {
        return { text: 'Not a release number: ' + next + '. Three dot-separated numbers.', code: 1 };
    }

    const before = readAll(at);
    const changed = [];
    for (const row of before) {
        if (row.version === next) continue;
        if (writeOne(at, row.file, next)) changed.push(row.file);
    }

    const after = readAll(at);
    const wrong = after.filter((r) => r.version !== next);
    if (wrong.length) {
        return {
            text: 'fankeel version — ' + wrong.length + ' file(s) did not take it:\n'
                + wrong.map((r) => '  ' + (r.version || '(none)') + '  ' + r.file).join('\n'),
            code: 1,
        };
    }
    return {
        text: 'fankeel version — ' + next + ', in all ' + after.length + ' places'
            + (changed.length ? ' (' + changed.length + ' changed)' : ' (already)') + '.',
        code: 0,
    };
}

module.exports = { MANIFESTS, RELEASE, skillFiles, readAll, changes, changeReport, main };

if (require.main === module) {
    const r = main(process.argv.slice(2));
    process.stdout.write(r.text + '\n');
    process.exit(r.code);
}
