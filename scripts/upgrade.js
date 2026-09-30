#!/usr/bin/env node
'use strict';

// What a project needs when fankeel has moved since it last looked.
//
//   node upgrade.js [--root <dir>]            what is pending; exits 1 when anything is
//   node upgrade.js --apply [--root <dir>]    runs the steps a script may run, writes the report
//
// Detected from the project's own shape, never from a recorded version: a
// version stamp says what was true when it was written, and a project that
// skipped a release or moved a file by hand would read as upgraded and not be.
// The report this writes carries `fankeel: <version>` only so the next run can
// say what landed since — it is never what decides a step.
//
// Steps a script may run: `todo-check --migrate` (idempotent, writes TODO.md).
// Steps it only prints: `todo.js migrate` throws on a second run, and moving a
// docs tree is a table for a person to read first.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');

const docs = require('../lib/docs.js');
const todo = require('../lib/todo.js');
const { resolveRoot } = require('../lib/registry.js');
const todoCheck = require('./todo-check.js');
const version = require('./version.js');

const PLUGIN = path.join(__dirname, '..');
const REPORT = /^\d{4}-\d{2}-\d{2}-fankeel-upgrade\.md$/;
const WAITING = new RegExp('^##\\s+' + todo.RETIRED + '\\s*$', 'm');
const RELEASE = /^\d+\.\d+\.\d+$/;

function readTodo(root) {
    try {
        return fs.readFileSync(path.join(root, 'TODO.md'), 'utf8');
    } catch (e) {
        return null;
    }
}

function holdsEntries(dir) {
    try {
        return fs.readdirSync(dir).some((n) => n.endsWith('.md'));
    } catch (e) {
        return false;
    }
}

// The bucket a report goes in: the report-role one named `reports` where there
// are several (this repository has `judgements` too, and longer paths sort
// first), else the first.
function reportBucket(root) {
    const { tree } = docs.read(root);
    if (!tree) return null;
    const all = tree.buckets.filter((b) => b.role === 'report');
    return all.find((b) => path.posix.basename(b.path) === 'reports') || all[0] || null;
}

// The `fankeel:` of the newest report this script wrote, or null.
function lastStamp(root) {
    const bucket = reportBucket(root);
    if (!bucket) return null;
    let names;
    try {
        names = fs.readdirSync(path.join(root, bucket.path));
    } catch (e) {
        return null;
    }
    const newest = names.filter((n) => REPORT.test(n)).sort().pop();
    if (!newest) return null;
    const fm = docs.frontmatter(fs.readFileSync(path.join(root, bucket.path, newest), 'utf8')) || {};
    return RELEASE.test(fm.fankeel || '') ? fm.fankeel : null;
}

// Pending steps, each `{ id, auto, what, next(applied), run }`.
function steps(root, plugin) {
    const out = [];
    const text = readTodo(root);
    if (text !== null && WAITING.test(text)) {
        out.push({
            id: 'waiting', auto: true, what: 'TODO.md still has a ## Waiting section', run: null,
            next: (applied) => (applied
                ? 'todo-check --migrate ran; what it could not place has no typed condition, file each by hand'
                : 'run with --apply (todo-check --migrate)'),
        });
    }
    const { tree } = docs.read(root);
    const bucket = tree ? tree.buckets.find((b) => b.role === 'todo') : null;
    if (bucket && text !== null && todo.entries(text).length && !holdsEntries(path.join(root, bucket.path))) {
        const run = 'node ' + path.join(plugin, 'scripts', 'todo.js') + ' migrate --root ' + root;
        out.push({
            id: 'todo-folder', auto: false, run,
            what: bucket.path + ' holds no entry file and TODO.md has entries',
            next: () => 'for a person, it runs once: ' + run,
        });
    }
    return out;
}

// A hint, not a step: it never counts toward the exit code and is never run.
function hint(root, plugin) {
    const { tree } = docs.read(root);
    if (tree && tree.preset !== 'custom') return null;
    return 'docs shape: .fankeel/docs.json names none; to file by a preset, `node '
        + path.join(plugin, 'scripts', 'docs-move.js') + ' plan --to <' + Object.keys(docs.PRESETS).join('|')
        + '> --out <moves.tsv> --root ' + root + '` prints a table and moves nothing';
}

// `--changes`, from the newest report's release when there is one. version.js
// answers for the plugin's own git history, so an installed copy with no .git
// says so here and the run carries on.
function changesOf(root, plugin) {
    const since = lastStamp(root);
    const r = version.main(['--changes'].concat(since ? ['--since', since] : []), plugin);
    if (r.code !== 0) return ['changes unavailable: ' + r.text.replace(/^fankeel version — /, '').split('\n')[0]];
    return r.text.split('\n');
}

function writeReport(root, plugin, day, ran, left) {
    const bucket = reportBucket(root);
    if (!bucket) return { file: null, note: 'no report bucket in .fankeel/docs.json; no report written' };
    const dir = path.join(root, bucket.path);
    const file = path.join(dir, day + '-fankeel-upgrade.md');
    const v = JSON.parse(fs.readFileSync(path.join(plugin, 'package.json'), 'utf8')).version;
    const body = [
        '---', 'status: current', 'fankeel: ' + v, '---', '',
        '# fankeel upgrade — ' + day, '',
        '## Ran', ...(ran.length ? ran.map((r) => '- ' + r) : ['- nothing: no step was pending']), '',
        '## Still needs a human', ...(left.length ? left.map((s) => '- ' + s.what + ' — ' + s.next(true)) : ['- nothing']), '',
        'Nothing to do for the old `scope` field: `claims` reads it where it needs to.', '',
    ].join('\n');
    fs.mkdirSync(dir, { recursive: true });
    try {
        fs.writeFileSync(file, body, { flag: 'wx' });
    } catch (e) {
        if (e && e.code === 'EEXIST') return { file: null, note: file + ' already exists; not overwritten' };
        throw e;
    }
    return { file, note: null };
}

function run(root, opts) {
    const o = opts || {};
    const plugin = o.plugin || PLUGIN;
    const day = todo.isoDay(o.now === undefined ? Date.now() : o.now);
    const lines = ['fankeel upgrade — ' + root, ''].concat(changesOf(root, plugin), ['']);
    let found = steps(root, plugin);
    const ran = [];
    if (o.apply) {
        for (const s of found.filter((x) => x.auto)) {
            ran.push(s.what + ' — ' + todoCheck.main(['--migrate', '--root', root]).text.split('\n')[0]);
        }
        found = steps(root, plugin);
        lines.push('ran:', ...(ran.length ? ran.map((r) => '  ' + r) : ['  nothing']), '');
    }
    if (found.length) lines.push('pending:', ...found.map((s) => '  ' + s.what + ' — ' + s.next(o.apply === true)));
    else lines.push('nothing pending.');
    const h = hint(root, plugin);
    if (h) lines.push('', h);
    lines.push('', 'scope → claims needs no step: lib/registry.js reads the old field where it needs to.');
    let file = null;
    if (o.apply) {
        const w = writeReport(root, plugin, day, ran, found);
        file = w.file;
        lines.push('', w.file ? 'report: ' + w.file : w.note);
    }
    return { text: lines.join('\n'), code: found.length ? 1 : 0, report: file };
}

function main(argv, opts) {
    const { values } = parseArgs({
        args: argv, strict: false, allowPositionals: true,
        options: { root: { type: 'string' }, apply: { type: 'boolean' } },
    });
    const root = resolveRoot(typeof values.root === 'string' ? values.root : undefined);
    return run(root, Object.assign({ apply: values.apply === true }, opts));
}

module.exports = { steps, lastStamp, run };

if (require.main === module) {
    const r = main(process.argv.slice(2));
    process.stdout.write(r.text + '\n');
    process.exit(r.code);
}
