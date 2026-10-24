'use strict';
// scripts/docs-health.js — the 文件 page's health matrix and its reader
// (station-38). One row per project the station knows (lib/docsearch.js
// searchDirs), six cells read off scripts/docs-audit.js's sweep and
// scripts/docs-check.js's scan; scripts/station.js serves both. Here rather
// than in lib/ because lib/ never requires scripts/ (CONTRIBUTING.md).
const fs = require('node:fs');
const path = require('node:path');
const audit = require('./docs-audit.js');
const check = require('./docs-check.js');
const { trackedFiles } = require('../lib/tracked.js');

const TTL_MS = 600000;          // a sweep per project is seconds; the page asks every visit
const MAX_ITEMS = 50;           // the findings card lists this many and says how many more
const MAX_BYTES = 512 * 1024;   // the reader shows a page, not a dump

function cell(items, n) {
    const count = n === undefined ? items.length : n;
    return count ? { n: count, items: items.slice(0, MAX_ITEMS) } : null;
}

// The newest markdown page's mtime, for the row's `N 份 · last`.
function newest(dir, files) {
    let at = 0;
    for (const rel of files) {
        if (!/\.md$/i.test(rel)) continue;
        try {
            at = Math.max(at, fs.statSync(path.join(dir, ...rel.split('/'))).mtimeMs);
        } catch (e) {
            // listed a moment ago, gone now
        }
    }
    return at ? new Date(at).toISOString() : null;
}

function one(d, now) {
    const a = audit.sweep(d.dir, audit.DEFAULT_SINCE, now);
    const c = check.scan(d.dir);
    if (!a || !c) return null;
    const listed = trackedFiles(d.dir);
    const index = a.index;
    // An index that is navigation rather than a manifest is not expected to
    // list every page (docs-audit's own rule), so its missing pages are not counted.
    const indexItems = index.dead.map((target) => ({ path: index.path, target }))
        .concat(index.navigation ? [] : index.missing.map((rel) => ({ path: rel })));
    return {
        pkey: d.pkey, name: d.name, dir: d.dir,
        files: a.markdown,
        index: index.exists ? index.path : null,
        noTree: !a.tree || Boolean(a.implied),
        last: newest(d.dir, listed ? listed.files : []),
        cells: {
            drift: cell(a.drift.map((x) => ({ path: x.file, target: x.target, gap: x.gap, docAge: x.docAge, declared: x.declared, sub: (x.subjects || [])[0] || null }))),
            landed: cell(a.landed.map((x) => ({ path: x.file, age: x.age, named: x.named }))),
            index: cell(indexItems),
            diagram: cell(a.diagrams.map((x) => ({ path: x.file + ':' + x.line, dir: x.dir, named: x.named, total: x.total, missing: x.missing.join(', ') }))),
            broken: cell(c.findings.map((f) => ({ path: f.file + ':' + f.line, tag: f.tag, note: f.what }))),
            unfiled: cell((c.unfiled || []).map((rel) => ({ path: rel })), a.unfiled),
        },
    };
}

function health(dirs, now) {
    const projects = [];
    for (const d of dirs) {
        let row = null;
        try {
            row = one(d, now);
        } catch (e) {
            row = null;   // one unreadable project does not blank the page
        }
        if (row) projects.push(row);
    }
    return { at: new Date(now).toISOString(), projects };
}

// The reader's text: a tracked markdown page of a project on this page, by a
// posix path relative to it — never `..`, never a path the tracked list lacks.
function readDoc(dirs, pkey, rel) {
    const d = dirs.find((x) => x.pkey === pkey);
    rel = String(rel || '');
    if (!d || !/\.md$/i.test(rel) || rel.includes('\\') || rel.startsWith('/') || rel.split('/').includes('..')) return null;
    const listed = trackedFiles(d.dir);
    if (!listed || !listed.files.includes(rel)) return null;
    const full = path.join(d.dir, ...rel.split('/'));
    try {
        if (fs.statSync(full).size > MAX_BYTES) return null;
        return fs.readFileSync(full, 'utf8');
    } catch (e) {
        return null;
    }
}

let memo = null;
function cached(dirs, now, fresh) {
    const key = JSON.stringify(dirs.map((d) => d.pkey + '\0' + d.dir));
    if (!fresh && memo && memo.key === key && now - memo.at < TTL_MS) return memo.value;
    memo = { key, at: now, value: health(dirs, now) };
    return memo.value;
}

module.exports = { health, readDoc, cached };
