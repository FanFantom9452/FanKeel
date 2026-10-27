'use strict';
// What the weekly report reads from git (docs/90-agent/plans/
// 2026-10-27-weekly-skill-design.md, 收 and 架構圖): which repositories sit
// under the roots, the commits of a range with their per-file numstat, the
// conventional-commit scopes a git-only repository's work is grouped by, the
// commits per day the timeline draws, and whether a path is code, doc or data.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const slash = (p) => String(p).replace(/\\/g, '/');

function git(repo, args) {
    return execFileSync('git', ['-C', repo, '-c', 'core.quotePath=false', ...args],
        { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
}

function subdirs(dir) {
    try {
        return fs.readdirSync(dir, { withFileTypes: true })
            .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
            .map((d) => path.join(dir, d.name));
    } catch (e) {
        return [];
    }
}

const isRepo = (dir) => fs.existsSync(path.join(dir, '.git'));

function scanRepos(roots) {
    const found = new Set();
    for (const root of roots || []) {
        for (const one of subdirs(root)) {
            if (isRepo(one)) found.add(slash(one));
            for (const two of subdirs(one)) if (isRepo(two)) found.add(slash(two));
        }
    }
    return [...found].sort();
}

const rangeArgs = (since, until) => ['--no-merges', '--since=' + since + 'T00:00:00', '--until=' + until + 'T23:59:59'];

// `a/{x => y}/b` and `x => y` are numstat's rename forms; the new path is the one kept.
const newPath = (p) => (p.includes('=>') ? p.replace(/\{[^}]*=> ([^}]*)\}/, '$1').replace(/^.* => /, '').replace(/\/\//g, '/') : p);

function commits(repo, since, until) {
    let out;
    try {
        out = git(repo, ['log', ...rangeArgs(since, until), '--numstat', '--date=short', '--pretty=format:@@%h%x09%ad%x09%s']);
    } catch (e) {
        return [];
    }
    const list = [];
    let cur = null;
    for (const line of out.split('\n')) {
        if (line.startsWith('@@')) {
            const [h, date, ...subj] = line.slice(2).split('\t');
            cur = { h, date, subj: subj.join('\t'), files: [] };
            list.push(cur);
            continue;
        }
        const m = line.split('\t');
        if (m.length < 3 || !cur) continue;
        cur.files.push({ p: newPath(m.slice(2).join('\t')), a: m[0] === '-' ? 0 : Number(m[0]), d: m[1] === '-' ? 0 : Number(m[1]) });
    }
    return list;
}

function countCommits(repo, since, until) {
    try {
        return Number(git(repo, ['rev-list', '--count', ...rangeArgs(since, until), 'HEAD']).trim()) || 0;
    } catch (e) {
        return 0;
    }
}

function lsFiles(repo) {
    try {
        return git(repo, ['ls-files', '-z']).split('\0').filter(Boolean).map(slash);
    } catch (e) {
        return [];
    }
}

function scopeOf(subj) {
    const m = /^[A-Za-z]+\(([^)]+)\)!?:/.exec(String(subj));
    return m ? m[1].trim() : null;
}

const OTHER = '(其他)';

function groupByScope(list) {
    const groups = new Map();
    for (const c of list) {
        const scope = scopeOf(c.subj) || OTHER;
        const g = groups.get(scope) || { scope, commits: [], files: new Set() };
        groups.set(scope, g);
        g.commits.push({ h: c.h, date: c.date, subj: c.subj });
        for (const f of c.files) g.files.add(f.p);
    }
    return [...groups.values()]
        .map((g) => ({ scope: g.scope, commits: g.commits, files: [...g.files].sort() }))
        .sort((a, b) => b.commits.length - a.commits.length || (a.scope < b.scope ? -1 : a.scope > b.scope ? 1 : 0));
}

function dayRange(since, until) {
    const out = [];
    const d = new Date(since + 'T00:00:00Z');
    const end = new Date(until + 'T00:00:00Z');
    while (d <= end) {
        out.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
}

function dailyCounts(list, since, until) {
    const counts = Object.fromEntries(dayRange(since, until).map((d) => [d, 0]));
    for (const c of list) if (Object.prototype.hasOwnProperty.call(counts, c.date)) counts[c.date]++;
    return counts;
}

// .gitattributes patterns whose files are generated output: `linguist-generated`
// (with or without `=true`) or `-diff` (design: 資料目錄的判定).
function readAttrs(repo) {
    let text;
    try {
        text = fs.readFileSync(path.join(repo, '.gitattributes'), 'utf8');
    } catch (e) {
        return [];
    }
    const out = [];
    for (const line of text.split(/\r?\n/)) {
        const parts = line.trim().split(/\s+/);
        if (!parts[0] || parts[0].startsWith('#')) continue;
        if (parts.slice(1).some((a) => a === 'linguist-generated' || a === 'linguist-generated=true' || a === '-diff')) out.push(parts[0]);
    }
    return out;
}

// A gitattributes pattern as a regular expression (character classes such as
// [ch] are not supported: brackets match literally): no slash matches at any
// depth, a slash anchors it at the top, `**/` is any directories, a match also
// covers everything under a matched directory.
const globs = new Map();
function globRe(pattern) {
    if (globs.has(pattern)) return globs.get(pattern);
    let p = pattern.replace(/^\//, '');
    if (p.endsWith('/')) p = p.slice(0, -1);
    let re = '';
    for (let i = 0; i < p.length; i++) {
        const ch = p[i];
        if (ch === '*' && p[i + 1] === '*') {
            if (p[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
        } else if (ch === '*') re += '[^/]*';
        else if (ch === '?') re += '[^/]';
        else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
    const lead = pattern.startsWith('/') || p.includes('/') ? '^' : '(?:^|/)';
    const out = new RegExp(lead + re + '(?:$|/)');
    globs.set(pattern, out);
    return out;
}

const DATA_EXT = /\.(csv|json|jsonl|tsv)$/i;
const DATA_LINES = 1000;

function kindOf(p, opts) {
    const o = opts || {};
    if ((o.attrs || []).some((pat) => globRe(pat).test(p))) return 'data';
    if (DATA_EXT.test(p) && (Number(o.lines) || 0) > DATA_LINES) return 'data';
    if (/\.md$/i.test(p) || /(^|\/)docs\//.test(p)) return 'doc';
    return 'code';
}

module.exports = { scanRepos, commits, countCommits, lsFiles, scopeOf, groupByScope, dayRange, dailyCounts, readAttrs, kindOf };
