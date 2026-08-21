'use strict';

// Where documents live, and — the part that matters — which of them are allowed
// to be out of date.
//
// A checker that treats every markdown file the same is a checker nobody keeps.
// An archive is *supposed* to reference code that no longer exists; that is what
// an archive is. Shout about it and the real finding, a dead path in a document
// that claims to describe the current system, arrives buried in a hundred lines
// nobody reads to the end.
//
// So a bucket is a path plus a role, and the role decides what gets checked. The
// tree itself is the project's business: it lives in `.fankeel/docs.json`, which
// is version-controlled — `.fankeel/.gitignore` excludes only `sessions/`, and
// this is exactly the kind of thing that exception was left open for.

const fs = require('node:fs');
const path = require('node:path');

// Five roles, by how long a document is meant to stay true.
//
//   reference  describes the system as it is now. Must match the code. A dead
//              path here is a bug, and the one this whole thing exists to find.
//   decision   why something is the way it is. Written once, not maintained. It
//              may name code that has since gone; that is the record being
//              honest about when it was made.
//   plan       what is about to be done. Stops being true the moment it lands,
//              which is the failure everybody has and nobody notices.
//   report     a dated snapshot — an audit, a benchmark, a meeting. Never edited
//              after the day it describes.
//   archive    retired. Kept so history survives, checked only for one thing:
//              that nothing current still points at it.
const ROLES = ['reference', 'decision', 'plan', 'report', 'archive'];

// Two shapes, both taken from real repositories rather than invented.
//
// `flat` is a project with one docs directory and a numbered series in it. It is
// what a project that has not needed more looks like, and forcing six empty
// directories on it makes filing feel like paperwork — which is how documents
// end up at the repository root instead.
//
// `phased` is a project whose documentation has outgrown one directory and
// separated by lifecycle. The numbers are a reading order, and `99-archive` last
// is not decoration: it is the bucket you must not read as current.
const PRESETS = {
    flat: {
        preset: 'flat',
        index: 'docs/README.md',
        buckets: [
            { path: 'docs', role: 'reference', depth: 1 },
            { path: 'docs/plans', role: 'plan' },
            { path: 'docs/decisions', role: 'decision' },
            { path: 'docs/reports', role: 'report' },
            { path: 'docs/archive', role: 'archive' },
        ],
    },
    phased: {
        preset: 'phased',
        index: 'docs/README.md',
        buckets: [
            { path: 'docs/01-vision', role: 'reference' },
            { path: 'docs/02-business', role: 'reference' },
            { path: 'docs/03-prd', role: 'reference' },
            { path: 'docs/04-architecture', role: 'reference' },
            { path: 'docs/04-architecture/adr', role: 'decision' },
            { path: 'docs/05-design', role: 'reference' },
            { path: 'docs/06-quality', role: 'report' },
            { path: 'docs/plans', role: 'plan' },
            { path: 'docs/meetings', role: 'report' },
            { path: 'docs/99-archive', role: 'archive' },
        ],
    },
};

// Anything at the repository root that is not in a bucket. These are read by
// everyone and everything, so they are reference whether or not the project ever
// declares a tree.
const ROOT_REFERENCE = ['README.md', 'CLAUDE.md', 'AGENTS.md', 'TODO.md', 'CONTRIBUTING.md'];

const CONFIG = ['.fankeel', 'docs.json'];

function configPath(root) {
    return path.join(root, ...CONFIG);
}

// A tree that does not parse is not a reason to fail. The caller is running a
// check, and refusing to run one because its configuration has a stray comma
// helps nobody — say which file, fall back, carry on.
function read(root) {
    const file = configPath(root);
    let raw;
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return { tree: null, error: null };
    }
    let data;
    try {
        data = JSON.parse(raw.replace(/^﻿/, ''));
    } catch (e) {
        return { tree: null, error: file + ' does not parse as JSON' };
    }
    const tree = normalise(data);
    if (!tree) return { tree: null, error: file + ' has no usable buckets' };
    return { tree, error: null };
}

// Buckets are sorted longest path first so `docs/04-architecture/adr` wins over
// `docs/04-architecture`. Without that the more specific rule never fires and
// every decision record gets checked as reference — the precise mistake this
// module exists to avoid.
function normalise(data) {
    if (!data || typeof data !== 'object') return null;
    const buckets = [];
    for (const b of Array.isArray(data.buckets) ? data.buckets : []) {
        if (!b || typeof b !== 'object') continue;
        const p = String(b.path || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
        if (!p || p.startsWith('/') || p.includes('..')) continue;
        if (!ROLES.includes(b.role)) continue;
        const bucket = { path: p, role: b.role };
        if (Number.isInteger(b.depth) && b.depth > 0) bucket.depth = b.depth;
        buckets.push(bucket);
    }
    if (!buckets.length) return null;
    buckets.sort((a, b) => b.path.length - a.path.length || (a.path < b.path ? -1 : 1));

    const index = typeof data.index === 'string' && data.index.trim()
        ? data.index.replace(/\\/g, '/').replace(/^\.\//, '')
        : 'docs/README.md';
    return { preset: typeof data.preset === 'string' ? data.preset : 'custom', index, buckets };
}

function write(root, tree) {
    const file = configPath(root);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const ignore = path.join(root, '.fankeel', '.gitignore');
    if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, 'sessions/\n');
    fs.writeFileSync(file, JSON.stringify(tree, null, 2) + '\n');
    return file;
}

// The role a file falls under, or null for a markdown file in no bucket at all.
// Null is a finding rather than a default: an undeclared document is one nobody
// decided the lifetime of, and those are the ones that rot.
//
// `depth` exists for the flat shape, where `docs` is reference but `docs/plans`
// is not. Without it the parent bucket would swallow every subdirectory that has
// no bucket of its own.
function roleOf(tree, rel) {
    const p = String(rel || '').replace(/\\/g, '/').replace(/^\.\//, '');
    if (!p) return null;
    if (!p.includes('/') && ROOT_REFERENCE.includes(p)) return 'reference';
    if (!tree) return null;

    for (const b of tree.buckets) {
        if (p === b.path) continue;
        if (!p.startsWith(b.path + '/')) continue;
        if (b.depth) {
            const rest = p.slice(b.path.length + 1);
            if (rest.split('/').length > b.depth) continue;
        }
        return b.role;
    }
    return null;
}

// Which bucket a new document of this role belongs in — the first declared, so
// the tree's own order decides. Used when something has to be filed rather than
// checked.
function bucketFor(tree, role) {
    if (!tree) return null;
    const found = tree.buckets.filter((b) => b.role === role);
    if (!found.length) return null;
    return found.reduce((a, b) => (a.path.length <= b.path.length ? a : b)).path;
}

// Which preset a repository already looks like, so the question at Start can be
// "this one?" rather than "which of these?". Counting directories that exist
// rather than files in them: an empty `99-archive` still says which shape the
// author had in mind.
function detect(root) {
    const has = (rel) => {
        try {
            return fs.statSync(path.join(root, rel.split('/').join(path.sep))).isDirectory();
        } catch (e) {
            return false;
        }
    };
    let phased = 0;
    for (const b of PRESETS.phased.buckets) if (has(b.path)) phased++;
    if (phased >= 3) return 'phased';
    if (has('docs')) return 'flat';
    return null;
}

module.exports = { ROLES, PRESETS, ROOT_REFERENCE, configPath, read, write, normalise, roleOf, bucketFor, detect };
