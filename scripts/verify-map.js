#!/usr/bin/env node
'use strict';
// scripts/verify-map.js: the verification map's lint, and the feature files a
// change reaches.
//
//   node scripts/verify-map.js [--root <dir>]
//   node scripts/verify-map.js [--root <dir>] --range <a>..<b>
//
// `.fankeel/verify/README.md` states the format this reads. The first form
// prints one `warn:` line per problem in `.fankeel/verify/<feature>.md` and a
// count, and exits 0 whatever it found: a first slice that refused on a prose
// map would be a gate nobody decided on. The second prints the feature files
// whose globs match a path `git diff --name-only --relative <a>..<b>` names,
// one per line, or `none`. The match is `pagesTouched` in lib/shots.js run on
// the features' globs, so a glob means here what it means in render.json, and
// a `kind: page` file's `render:` stands for the `src` of the render.json
// pages it names rather than a second copy of them.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseArgsOrExit } = require('../lib/cli.js');
const { frontmatter } = require('../lib/docs.js');
const { pagesTouched, loadTargets } = require('../lib/shots.js');
const { trackedFiles } = require('../lib/tracked.js');

const REL = '.fankeel/verify';
const KINDS = ['page', 'cli', 'hook'];
const STATUSES = ['clean', 'changed', 'blocked'];
const SECTIONS = ['Sub-features', 'Reach', 'Drive', 'Gotchas', 'Doctor'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EXIT_CODE = /\bexits?\s+\d+/;

// `[a, b]`, or one bare value: the list shape lib/docs.js's reader hands back
// as a string. Null when the key is absent, so "absent" and "empty" differ.
function list(value) {
    if (value === undefined) return null;
    return String(value).trim().replace(/^\[/, '').replace(/\]$/, '')
        .split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
}

// Every `## ` heading outside a fence, with the text under it.
function sections(text) {
    const out = new Map();
    let name = null;
    let fence = false;
    for (const line of String(text).split(/\r?\n/)) {
        if (/^(```|~~~)/.test(line)) fence = !fence;
        const h = fence ? null : /^##\s+(.+?)\s*$/.exec(line);
        if (h) {
            name = h[1];
            out.set(name, '');
        } else if (name !== null) {
            out.set(name, out.get(name) + line + '\n');
        }
    }
    return out;
}

// The feature files, sorted by name. README.md is the format, not a feature.
function featureFiles(root) {
    let names;
    try {
        names = fs.readdirSync(path.join(root, REL));
    } catch (e) {
        return [];
    }
    return names.filter((n) => n.endsWith('.md') && n !== 'README.md').sort();
}

function renderTargets(root) {
    return loadTargets(path.join(root, '.fankeel', 'render.json'));
}

// The globs a feature stands for: its own `src`, then the `src` of each
// render.json page its `render:` names.
function globsOf(front, targets) {
    const out = (list(front.src) || []).slice();
    for (const page of list(front.render) || []) {
        const globs = targets && targets.src.get(page);
        if (globs) out.push(...globs);
    }
    return out;
}

function lint(root) {
    const files = featureFiles(root);
    const warnings = [];
    const loaded = files.length ? renderTargets(root) : null;
    const targets = loaded && loaded.targets ? loaded.targets : null;
    if (loaded && loaded.refusal) warnings.push('.fankeel/render.json: ' + loaded.refusal);
    let tracked = null;
    for (const name of files) {
        const rel = REL + '/' + name;
        const warn = (what) => warnings.push(rel + ': ' + what);
        const text = fs.readFileSync(path.join(root, REL, name), 'utf8');
        const front = frontmatter(text);
        if (!front) {
            warn('no frontmatter');
            continue;
        }
        const feature = name.slice(0, -'.md'.length);
        if (front.feature !== feature) warn('`feature` is "' + (front.feature || '') + '" and the file name says "' + feature + '"');
        if (!KINDS.includes(front.kind)) warn('`kind` is "' + (front.kind || '') + '", not one of ' + KINDS.join(', '));
        if (!STATUSES.includes(front.status)) warn('`status` is "' + (front.status || '') + '", not one of ' + STATUSES.join(', '));
        if (!DATE.test(front.last_checked || '')) warn('`last_checked` is "' + (front.last_checked || '') + '", not a YYYY-MM-DD date');
        const own = list(front.src) || [];
        const pages = list(front.render) || [];
        if (pages.length && front.kind !== 'page') warn('`render` belongs to a `kind: page` file only');
        if (front.kind === 'page' && !own.length && !pages.length) warn('a page needs `render` naming render.json pages, or `src` where render.json does not declare it');
        if ((front.kind === 'cli' || front.kind === 'hook') && !own.length) warn('a ' + front.kind + ' needs `src`');
        for (const page of pages) {
            if (!targets) warn('`render` names "' + page + '" and there is no readable .fankeel/render.json');
            else if (!targets.pages.has(page)) warn('`render` names "' + page + '", which .fankeel/render.json does not declare');
            else if (!targets.src.has(page)) warn('render.json page "' + page + '" has no `src`, so no change reaches this file through it');
        }
        if (own.length) {
            if (tracked === null) {
                const result = trackedFiles(root);
                tracked = result ? result.files.map((f) => f.replace(/\\/g, '/')) : [];
            }
            for (const glob of own) {
                if (!tracked.some((f) => path.posix.matchesGlob(f, glob))) warn('`src` glob ' + glob + ' matches no file');
            }
        }
        const body = sections(text);
        for (const s of SECTIONS) if (!body.has(s)) warn('no `## ' + s + '` section');
        if ((front.kind === 'cli' || front.kind === 'hook') && body.has('Doctor') && !EXIT_CODE.test(body.get('Doctor'))) {
            warn('a ' + front.kind + "'s `## Doctor` names no exit code to check (`<command>` exits 0)");
        }
    }
    return { files: files.map((n) => REL + '/' + n), warnings };
}

// The feature files whose globs match any of `paths` (relative to `root`).
// What hides a feature from the match (a render.json refusal, a file with no
// frontmatter) goes into `warnings` when given, so `none` is not a silent miss.
function touched(root, paths, warnings = []) {
    const loaded = renderTargets(root);
    const targets = loaded && loaded.targets ? loaded.targets : null;
    if (loaded && loaded.refusal) warnings.push('.fankeel/render.json: ' + loaded.refusal);
    const src = new Map();
    for (const name of featureFiles(root)) {
        const rel = REL + '/' + name;
        const front = frontmatter(fs.readFileSync(path.join(root, REL, name), 'utf8'));
        if (!front) {
            warnings.push(rel + ': no frontmatter, so no change reaches it');
            continue;
        }
        const globs = globsOf(front, targets);
        if (globs.length) src.set(rel, globs);
    }
    return pagesTouched({ src }, paths);
}

function main(argv) {
    const { values } = parseArgsOrExit('verify-map', argv, { root: { type: 'string' }, range: { type: 'string' } });
    const root = path.resolve(values.root || process.cwd());
    if (values.range !== undefined) {
        let changed;
        try {
            changed = execFileSync('git', ['diff', '--name-only', '--relative', values.range],
                { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/).filter(Boolean);
        } catch (e) {
            return 'verify-map: git could not read ' + values.range;
        }
        const warnings = [];
        const hit = touched(root, changed, warnings);
        return warnings.map((w) => 'warn: ' + w).concat(hit.length ? hit : ['none']).join('\n');
    }
    const { files, warnings } = lint(root);
    const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
    return warnings.map((w) => 'warn: ' + w)
        .concat('verify-map: ' + plural(files.length, 'feature file') + ', ' + plural(warnings.length, 'warning'))
        .join('\n');
}

if (require.main === module) process.stdout.write(main(process.argv.slice(2)) + '\n');

module.exports = { lint, touched };
