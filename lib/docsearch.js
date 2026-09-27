'use strict';
// Full-text search over this machine's project docs, for the station's 文件
// page (`GET /station/search?q=` in scripts/station.js). Only the pages a
// project files as current knowledge are read — role `reference` or
// `decision` in its `.fankeel/docs.json`, or in the preset its layout matches
// when it has none. `plan`, `report`, `archive` and `fixture` pages record a
// moment, and a hit in one would read as current when it is not.
const fs = require('node:fs');
const path = require('node:path');
const docs = require('./docs.js');
const { hiddenPkeys } = require('./station.js');

const SEARCHED = ['reference', 'decision'];
const LIMIT = 20;
const MAX_FILES = 4000; // per bucket walked
const MAX_BYTES = 512 * 1024; // a page larger than this is not read
const SPAN = 60; // snippet characters each side of the first hit
const SKIP = new Set(['node_modules', '.git', '.fankeel']);

// Every registry root that is not gone, and every project under it a session
// names, once each — minus what `station.hide` takes off the page.
function searchDirs(model) {
    const hidden = hiddenPkeys(model);
    const out = [];
    const seen = new Set();
    for (const r of model.registries || []) {
        if (r.gone) continue;
        const names = [''].concat([...new Set((r.sessions || []).map((s) => s.project).filter(Boolean))]);
        for (const p of names) {
            const pkey = p ? r.root + '/' + p : r.root;
            if (hidden.has(pkey)) continue;
            const dir = p ? path.join(r.root, p) : r.root;
            const key = path.resolve(dir);
            if (seen.has(key)) continue;
            try {
                if (!fs.statSync(dir).isDirectory()) continue;
            } catch (e) {
                continue;
            }
            seen.add(key);
            out.push({ dir, pkey, name: path.basename(key) });
        }
    }
    return out;
}

function treeOf(dir) {
    const declared = docs.read(dir).tree;
    if (declared) return declared;
    const preset = docs.detect(dir);
    return preset ? docs.normalise(docs.PRESETS[preset]) : null;
}

function mdUnder(dir, rel, out) {
    let entries;
    try {
        entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
    } catch (e) {
        return;
    }
    for (const d of entries) {
        if (out.length >= MAX_FILES) return;
        const child = rel + '/' + d.name;
        if (d.isDirectory()) {
            if (!SKIP.has(d.name)) mdUnder(dir, child, out);
        } else if (d.isFile() && d.name.endsWith('.md')) {
            out.push(child);
        }
    }
}

// Each searchable page once, with the label the page shows: a reference page
// written for people (`audience: 'human'`) is a guide.
function pagesOf(dir) {
    const tree = treeOf(dir);
    if (!tree) return [];
    const seen = new Set();
    const out = [];
    for (const b of tree.buckets) {
        if (!SEARCHED.includes(b.role)) continue;
        const found = [];
        mdUnder(dir, b.path, found);
        for (const rel of found) {
            if (seen.has(rel)) continue;
            seen.add(rel);
            const role = docs.roleOf(tree, rel);
            if (!SEARCHED.includes(role)) continue;
            const bucket = docs.bucketOf(tree, rel);
            out.push({ rel, role: role === 'reference' && bucket && bucket.audience === 'human' ? 'guide' : role });
        }
    }
    return out;
}

function bodyOf(text) {
    return text.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
}

function titleOf(text, rel) {
    const m = /^#\s+(.+?)\s*$/m.exec(text);
    return m ? m[1] : path.posix.basename(rel, '.md');
}

function occurrences(hay, needle) {
    let n = 0;
    for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + needle.length)) n++;
    return n;
}

function snippet(text, at, len) {
    const from = Math.max(0, at - SPAN);
    const to = Math.min(text.length, at + len + SPAN);
    const flat = (s) => s.replace(/\s+/g, ' ');
    return {
        before: (from > 0 ? '… ' : '') + flat(text.slice(from, at)).trimStart(),
        hit: text.slice(at, at + len),
        after: flat(text.slice(at + len, to)).trimEnd() + (to < text.length ? ' …' : ''),
    };
}

function search(dirs, q, opts) {
    const limit = opts && Number.isInteger(opts.limit) ? opts.limit : LIMIT;
    const needle = String(q == null ? '' : q).replace(/\s+/g, ' ').trim().slice(0, 100);
    if (!needle) return { q: '', n: 0, hits: [] };
    const low = needle.toLowerCase();
    const found = [];
    for (const d of dirs) {
        for (const p of pagesOf(d.dir)) {
            const file = path.join(d.dir, p.rel);
            let text;
            try {
                if (fs.statSync(file).size > MAX_BYTES) continue;
                text = bodyOf(fs.readFileSync(file, 'utf8'));
            } catch (e) {
                continue;
            }
            const hay = text.toLowerCase();
            const at = hay.indexOf(low);
            if (at < 0) continue;
            found.push(Object.assign({ project: d.name, pkey: d.pkey, path: p.rel, title: titleOf(text, p.rel), role: p.role,
                count: occurrences(hay, low) }, snippet(text, at, needle.length)));
        }
    }
    const by = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
    found.sort((a, b) => b.count - a.count || by(a.project, b.project) || by(a.path, b.path));
    return { q: needle, n: found.length, hits: found.slice(0, limit) };
}

module.exports = { search, searchDirs };
