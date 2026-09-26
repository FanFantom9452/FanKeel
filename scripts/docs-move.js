#!/usr/bin/env node
'use strict';
// scripts/docs-move.js: move a docs tree from the preset its docs.json names
// to another preset's buckets — a table first, a move second.
//
//   node scripts/docs-move.js plan --to <preset> --out <moves.tsv> [--root <dir>] [--place <from>=<to>]...
//   node scripts/docs-move.js apply --to <preset> --table <moves.tsv> [--root <dir>]
//
// `plan` writes `<from>\t<to>`, one row per tracked file under the docs root
// that moves and one per page whether or not it moves (the index stays, from
// and to equal), and moves nothing: the gate shows the table. `apply` runs
// `git mv` for every row that moves, rewrites every relative link and every
// code-span file path in every tracked markdown file that pointed at a moved
// file, and writes the new `.fankeel/docs.json`.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const docs = require('../lib/docs.js');
const { trackedFiles } = require('../lib/tracked.js');
const { resolveRoot } = require('../lib/registry.js');
const { LINK, CODE, external, isMarkdown } = require('./docs-check.js');

const posix = path.posix;
const under = (p, dir) => p === dir || p.startsWith(dir + '/');

// Where each moving bucket of `from` goes under `to`. Parents are placed
// before their children, so a nested bucket rides inside its parent's move.
function bucketTargets(from, to) {
    const docRoot = to.index.split('/')[0];
    const kept = new Set(to.buckets.map((b) => b.path));
    const agent = to.buckets.find((b) => b.audience === 'agent');
    const agentRoot = agent ? posix.dirname(agent.path) : docRoot;
    const stockTree = docs.PRESETS[from.preset] ? docs.normalise(docs.PRESETS[from.preset]) : null;
    const stock = stockTree ? stockTree.buckets : [];
    const byRole = (role) => {
        const same = to.buckets.filter((b) => b.role === role);
        return same.find((b) => b.audience === 'agent') || same[0] || null;
    };
    const out = new Map();
    const sorted = from.buckets.slice().sort((a, b) => a.path.length - b.path.length || (a.path < b.path ? -1 : 1));
    for (const b of sorted) {
        if (!under(b.path, docRoot) || b.depth || kept.has(b.path)) continue;
        let parent = null;
        for (const p of out.keys()) if (b.path.startsWith(p + '/') && (!parent || p.length > parent.length)) parent = p;
        if (parent) { out.set(b.path, out.get(parent) + b.path.slice(parent.length)); continue; }
        const isStock = stock.some((s) => s.path === b.path && s.role === b.role);
        const target = isStock ? byRole(b.role) : null;
        out.set(b.path, target ? target.path : agentRoot + '/' + posix.basename(b.path));
    }
    return out;
}

// Where one tracked file goes: inside its bucket's move, or — a top-level
// page of a depth bucket such as flat's `docs` — into the target's bucket of
// the same role. The index stays; a file in no bucket stays.
function destination(rel, from, to, targets) {
    const b = docs.bucketOf(from, rel);
    if (!b || rel === to.index) return rel;
    if (targets.has(b.path)) return targets.get(b.path) + rel.slice(b.path.length);
    if (b.depth && under(b.path, to.index.split('/')[0])) {
        const same = to.buckets.filter((x) => x.role === b.role);
        const target = same.find((x) => x.audience === 'agent') || same[0];
        return target ? target.path + rel.slice(b.path.length) : rel;
    }
    return rel;
}

function planMoves(root, toName, place) {
    const to = docs.PRESETS[toName] ? docs.normalise(docs.PRESETS[toName]) : null;
    if (!to) throw new Error('no preset named ' + toName + ' — one of: ' + Object.keys(docs.PRESETS).join(', '));
    const { tree: from, error } = docs.read(root);
    if (!from) throw new Error(error || 'no .fankeel/docs.json under ' + root + ' — nothing says where the pages are now');
    const listed = trackedFiles(root);
    const docRoot = to.index.split('/')[0];
    const targets = bucketTargets(from, to);
    const placed = place || {};
    const rows = [];
    for (const rel of listed.files.slice().sort()) {
        if (!under(rel, docRoot)) continue;
        const dest = Object.prototype.hasOwnProperty.call(placed, rel) ? placed[rel] : destination(rel, from, to, targets);
        if (dest !== rel || isMarkdown(rel)) rows.push({ from: rel, to: dest });
    }
    for (const k of Object.keys(placed)) {
        if (!rows.some((r) => r.from === k)) throw new Error('--place names ' + k + ', which is not a tracked file under ' + docRoot);
    }
    return rows;
}

function writeTable(file, rows) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, rows.map((r) => r.from + '\t' + r.to).join('\n') + '\n');
}

function readTable(file) {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
        const [from, to] = line.split('\t');
        if (!from || !to) throw new Error(file + ': a row is not <from>\\t<to>: ' + line);
        return { from, to };
    });
}

// The directories that moved whole: every row under the old directory landed
// under one new one. `docs` itself never qualifies while its index stays.
function dirMoves(rows) {
    const cand = new Map();
    for (const r of rows) {
        if (r.from === r.to || posix.basename(r.from) !== posix.basename(r.to)) continue;
        let a = posix.dirname(r.from);
        let b = posix.dirname(r.to);
        while (a !== '.' && b !== '.' && a !== b) {
            if (!cand.has(a)) cand.set(a, b);
            if (posix.basename(a) !== posix.basename(b)) break;
            a = posix.dirname(a);
            b = posix.dirname(b);
        }
    }
    const out = new Map();
    for (const [a, b] of cand) {
        const inside = rows.filter((r) => r.from.startsWith(a + '/'));
        if (inside.length && inside.every((r) => r.to === b + r.from.slice(a.length))) out.set(a, b);
    }
    return out;
}

function mapPath(p, files, dirs) {
    if (files.has(p)) return files.get(p);
    if (dirs.has(p)) return dirs.get(p);
    let best = null;
    for (const d of dirs.keys()) if (p.startsWith(d + '/') && (!best || d.length > best.length)) best = d;
    return best ? dirs.get(best) + p.slice(best.length) : null;
}

// One page's text after the move. `oldRel` is where it was, `newRel` where it
// is now; a link is re-pointed when its target moved or the page did. A code
// span is rewritten only when it names a moved file exactly.
function rewriteText(text, oldRel, newRel, files, dirs) {
    const oldDir = posix.dirname(oldRel);
    const newDir = posix.dirname(newRel);
    const link = new RegExp(LINK.source, 'g');
    let out = text.replace(link, (whole, ref, anchor) => {
        if (external(ref) || ref.startsWith('/')) return whole;
        const target = posix.normalize(posix.join(oldDir, ref)).replace(/\/$/, '');
        if (target.startsWith('..')) return whole;
        const moved = mapPath(target, files, dirs);
        if (moved === null && oldDir === newDir) return whole;
        let next = posix.relative(newDir, moved === null ? target : moved) || posix.basename(target);
        if (ref.endsWith('/')) next += '/';
        const at = whole.lastIndexOf('(' + ref);
        return whole.slice(0, at) + '(' + next + whole.slice(at + 1 + ref.length);
    });
    const code = new RegExp(CODE.source, 'g');
    out = out.replace(code, (whole, inner) => {
        const m = /^(.*?)(:\d+(?:-\d+)?)?$/.exec(inner);
        return files.has(m[1]) ? '`' + files.get(m[1]) + (m[2] || '') + '`' : whole;
    });
    return out;
}

function mv(root, srcs, dest) {
    execFileSync('git', ['mv', '--', ...srcs, dest], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
}

// The tree to write after the move: the target preset's buckets, every
// source bucket that moved under its new path, every bucket outside the docs
// root as it was, and the docs root itself at depth 1 while the index sits
// directly in it — or the index is filed nowhere.
function nextTree(from, to, targets) {
    const docRoot = to.index.split('/')[0];
    const buckets = to.buckets.map((b) => Object.assign({}, b));
    const has = (p) => buckets.some((b) => b.path === p);
    for (const b of from.buckets) {
        const moved = targets.get(b.path);
        if (!moved && under(b.path, docRoot)) continue;
        const p = moved || b.path;
        if (!has(p)) buckets.push(Object.assign({}, b, { path: p }));
    }
    if (posix.dirname(to.index) === docRoot && !has(docRoot)) buckets.push({ path: docRoot, role: 'reference', depth: 1 });
    const out = { preset: to.preset, index: to.index, buckets };
    if (from.layout) out.layout = from.layout;
    return out;
}

function applyMoves(root, rows, toName, opts) {
    const rewrite = !(opts && opts.rewrite === false);
    const to = docs.PRESETS[toName] ? docs.normalise(docs.PRESETS[toName]) : null;
    const { tree: from } = docs.read(root);
    if (!to || !from) throw new Error('apply needs a preset to move to and a .fankeel/docs.json to move from');
    const moving = rows.filter((r) => r.from !== r.to);
    const files = new Map(moving.map((r) => [r.from, r.to]));
    const dirs = dirMoves(rows);
    const byDir = new Map();
    for (const r of moving) {
        if (posix.basename(r.from) !== posix.basename(r.to)) {
            fs.mkdirSync(path.join(root, posix.dirname(r.to)), { recursive: true });
            mv(root, [r.from], r.to);
            continue;
        }
        const dir = posix.dirname(r.to);
        if (!byDir.has(dir)) byDir.set(dir, []);
        byDir.get(dir).push(r.from);
    }
    for (const [dir, srcs] of byDir) {
        fs.mkdirSync(path.join(root, dir), { recursive: true });
        for (let i = 0; i < srcs.length; i += 50) mv(root, srcs.slice(i, i + 50), dir);
    }
    let rewritten = 0;
    if (rewrite) {
        const back = new Map(moving.map((r) => [r.to, r.from]));
        for (const rel of trackedFiles(root).files.filter(isMarkdown)) {
            const full = path.join(root, rel);
            const text = fs.readFileSync(full, 'utf8');
            const next = rewriteText(text, back.get(rel) || rel, rel, files, dirs);
            if (next !== text) { fs.writeFileSync(full, next); rewritten++; }
        }
    }
    docs.write(root, nextTree(from, to, bucketTargets(from, to)));
    return { moved: moving.length, rewritten, dirs: dirs.size };
}

const fail = (msg) => ({ text: 'docs-move: ' + msg, code: 2 });

function main(argv) {
    let parsed;
    try {
        parsed = parseArgs({ args: argv, allowPositionals: true, strict: true, options: {
            root: { type: 'string' }, to: { type: 'string' }, out: { type: 'string' }, table: { type: 'string' }, place: { type: 'string', multiple: true },
        } });
    } catch (e) {
        return fail(e.message);
    }
    const { values, positionals } = parsed;
    const root = resolveRoot(values.root);
    if (!values.to || !docs.PRESETS[values.to]) return fail('--to is one of: ' + Object.keys(docs.PRESETS).join(', '));
    try {
        if (positionals[0] === 'plan') {
            if (!values.out) return fail('plan needs --out <moves.tsv>');
            const place = {};
            for (const p of values.place || []) {
                const i = p.indexOf('=');
                if (i < 1) return fail('--place is <from>=<to>: ' + p);
                place[p.slice(0, i)] = p.slice(i + 1);
            }
            const rows = planMoves(root, values.to, place);
            const out = path.resolve(values.out);
            writeTable(out, rows);
            const pages = rows.filter((r) => isMarkdown(r.from)).length;
            const moving = rows.filter((r) => r.from !== r.to).length;
            return { text: 'docs-move: ' + rows.length + ' rows — ' + pages + ' pages, ' + moving + ' files move — ' + out, code: 0 };
        }
        if (positionals[0] === 'apply') {
            if (!values.table) return fail('apply needs --table <moves.tsv>');
            const r = applyMoves(root, readTable(path.resolve(values.table)), values.to);
            return { text: 'docs-move: moved ' + r.moved + ' files, ' + r.dirs + ' directories whole, rewrote ' + r.rewritten + ' pages; wrote .fankeel/docs.json', code: 0 };
        }
    } catch (e) {
        return fail(e.message);
    }
    return fail('usage: docs-move.js plan --to <preset> --out <moves.tsv> [--place <from>=<to>]... | apply --to <preset> --table <moves.tsv>');
}

if (require.main === module) {
    const r = main(process.argv.slice(2));
    process.stdout.write(r.text + '\n');
    process.exit(r.code);
}

module.exports = { bucketTargets, planMoves, dirMoves, rewriteText, applyMoves, nextTree, readTable, writeTable, main };
