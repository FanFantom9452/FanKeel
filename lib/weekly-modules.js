'use strict';
// A repository's modules for the weekly report's architecture map
// (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 架構圖): from the
// project's own .fankeel/map.md tree when it has one, else two directory levels
// of `git ls-files`; each module's lines changed in the range, code only; and
// the chartroom .board text lib/board.js draws, coloured by lib/board-look.js's
// HEAT ramp. Layout follows the approved mockup's generator
// (.fankeel/build/2026-10-27-weekly-skill/gen/boards.js).
const fs = require('node:fs');
const path = require('node:path');
const { HEAT, heatLevel } = require('./board-look.js');
const git = require('./weekly-git.js');

const slug = (s) => String(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
const OTHER = '其他';
const ROOT_FILES = '根目錄檔案';
const MAX_NODES = 12;

// Names repeat (every frame has a 其他) and slugs can collide (`lib/board/`
// and a top-level `lib-board`), but the model names a module by its id and the
// board draws one node per id, so a repeated id takes `-2`, `-3`, ….
function uniqueIds(def) {
    const seen = new Map();
    for (const f of def.frames) {
        for (const n of f.nodes) {
            const k = (seen.get(n.id) || 0) + 1;
            seen.set(n.id, k);
            if (k > 1) n.id = n.id + '-' + k;
        }
    }
    return def;
}

// map.md's tree rows: `  ├── lib/   text` at the top, `  │   ├── x.js   text` one down.
const ROW = /^ {2}((?:│ {3}| {4})*)(?:├──|└──) (\S+)/;

function fromMap(text) {
    const lines = String(text).split(/\r?\n/);
    const start = lines.findIndex((l) => /^tree\b/.test(l));
    if (start < 0) return null;
    const top = [];
    for (const line of lines.slice(start + 1)) {
        if (!line.trim()) break;
        const m = ROW.exec(line);
        if (!m) continue;
        const depth = m[1].length / 4;
        if (depth === 0) top.push({ name: m[2], kids: [] });
        else if (depth === 1 && top.length) top[top.length - 1].kids.push(m[2]);
    }
    if (!top.length) return null;
    const loose = { id: 'f-top', label: '專案根目錄', nodes: [] };
    const frames = [];
    for (const t of top) {
        if (t.name.endsWith('/') && t.kids.length) {
            const nodes = t.kids.map((k) => ({ id: 'n-' + slug(t.name + k), name: k.replace(/\/$/, ''), match: t.name + k }));
            nodes.push({ id: 'n-' + slug(t.name) + '-other', name: OTHER, match: t.name + '*' });
            frames.push({ id: 'f-' + slug(t.name), label: t.name.slice(0, -1), nodes });
        } else {
            loose.nodes.push({ id: 'n-' + slug(t.name), name: t.name.replace(/\/$/, ''), match: t.name });
        }
    }
    loose.nodes.push({ id: 'n-root', name: ROOT_FILES, match: '(root)' });
    return uniqueIds({ frames: [loose].concat(frames) });
}

function fromFiles(paths) {
    const tops = new Map();
    let rootFiles = 0;
    for (const p of paths) {
        const parts = p.split('/');
        if (parts.length === 1) { rootFiles++; continue; }
        const t = tops.get(parts[0]) || { subs: new Map(), direct: 0 };
        tops.set(parts[0], t);
        if (parts.length === 2) t.direct++;
        else t.subs.set(parts[1], (t.subs.get(parts[1]) || 0) + 1);
    }
    const loose = { id: 'f-top', label: '專案根目錄', nodes: [] };
    const frames = [];
    for (const [dir, t] of [...tops].sort((a, b) => a[0].localeCompare(b[0]))) {
        if (t.subs.size < 2) {
            loose.nodes.push({ id: 'n-' + slug(dir), name: dir, match: dir + '/' });
            continue;
        }
        const subs = [...t.subs].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        const kept = subs.slice(0, MAX_NODES - 1).sort((a, b) => a[0].localeCompare(b[0]));
        const nodes = kept.map(([s]) => ({ id: 'n-' + slug(dir + '/' + s), name: s, match: dir + '/' + s + '/' }));
        if (t.direct || subs.length > kept.length) nodes.push({ id: 'n-' + slug(dir) + '-other', name: OTHER, match: dir + '/*' });
        frames.push({ id: 'f-' + slug(dir), label: dir, nodes });
    }
    if (rootFiles) loose.nodes.push({ id: 'n-root', name: ROOT_FILES, match: '(root)' });
    return uniqueIds({ frames: (loose.nodes.length ? [loose] : []).concat(frames) });
}

function moduleDef(repo, name) {
    let def = null;
    try {
        def = fromMap(fs.readFileSync(path.join(repo, '.fankeel', 'map.md'), 'utf8'));
    } catch (e) {
        def = null;
    }
    if (!def) def = fromFiles(git.lsFiles(repo));
    return Object.assign({ title: name + ' 架構' }, def);
}

function resolver(def) {
    const nodes = def.frames.flatMap((f) => f.nodes);
    const isPrefix = (m) => m.endsWith('/');
    const isRest = (m) => m.endsWith('/*');
    const exact = new Map(nodes.filter((n) => !isPrefix(n.match) && !isRest(n.match) && n.match !== '(root)').map((n) => [n.match, n.id]));
    const longest = (a, b) => b.match.length - a.match.length;
    const prefix = nodes.filter((n) => isPrefix(n.match)).sort(longest);
    const rest = nodes.filter((n) => isRest(n.match)).sort(longest);
    const root = nodes.find((n) => n.match === '(root)');
    return (p) => {
        if (exact.has(p)) return exact.get(p);
        for (const n of prefix) if (p.startsWith(n.match)) return n.id;
        for (const n of rest) if (p.startsWith(n.match.slice(0, -1))) return n.id;
        if (root && !p.includes('/')) return root.id;
        return null;
    };
}

function moduleStats(def, list, opts) {
    const attrs = (opts && opts.attrs) || [];
    const res = resolver(def);
    const per = new Map();
    const byKind = { code: { a: 0, d: 0 }, doc: { a: 0, d: 0 }, data: { a: 0, d: 0 } };
    const files = new Set();
    let A = 0;
    let D = 0;
    for (const c of list) {
        for (const f of c.files) {
            const kind = git.kindOf(f.p, { attrs, lines: f.a + f.d });
            byKind[kind].a += f.a;
            byKind[kind].d += f.d;
            if (kind !== 'code') continue;
            A += f.a;
            D += f.d;
            files.add(f.p);
            const id = res(f.p);
            if (!id) continue;
            const s = per.get(id) || { a: 0, d: 0, files: new Set() };
            per.set(id, s);
            s.a += f.a;
            s.d += f.d;
            s.files.add(f.p);
        }
    }
    // Heat is each module's share of the repo's code change (design, 架構圖:
    // 「依改動占比分四級」), so a small repo's one busy module is as dark as a
    // big repo's.
    const total = A + D;
    const mods = [];
    for (const fr of def.frames) {
        for (const n of fr.nodes) {
            const s = per.get(n.id) || { a: 0, d: 0, files: new Set() };
            const share = total ? (s.a + s.d) / total : 0;
            mods.push({ id: n.id, name: n.name, frame: fr.label, a: s.a, d: s.d, files: s.files.size, share, level: heatLevel(share) });
        }
    }
    return { mods, A, D, files: files.size, byKind };
}

// Node and frame sizes from the mockup's generator; frames shelf-packed into
// rows no wider than WIDTH. Node coordinates are relative to their frame.
const NW = 136; const NH = 52; const GX = 10; const GY = 10;
const PADX = 14; const PADT = 40; const PADB = 14; const FG = 20; const WIDTH = 1100;
const fmt = (n) => Number(n).toLocaleString('en-US');
const colsOf = (f) => Math.max(1, f.id === 'f-top' ? Math.min(5, f.nodes.length) : f.nodes.length > 6 ? 3 : f.nodes.length > 2 ? 2 : 1);

function boardText(def, mods) {
    const by = new Map(mods.map((m) => [m.id, m]));
    const out = [
        JSON.stringify({ chartroom: 1, title: def.title, root: 'arch', lang: 'zh-TW' }),
        JSON.stringify({ view: 'arch', title: def.title }),
    ];
    let x = 0;
    let y = 0;
    let rowH = 0;
    for (const f of def.frames) {
        const cols = colsOf(f);
        const rows = Math.max(1, Math.ceil(f.nodes.length / cols));
        const w = PADX * 2 + cols * NW + (cols - 1) * GX;
        const h = PADT + PADB + rows * NH + (rows - 1) * GY;
        if (x > 0 && x + w > WIDTH) { x = 0; y += rowH + FG; rowH = 0; }
        out.push(JSON.stringify({ node: f.id, in: 'arch', label: f.label, shape: 'frame', x, y, w, h }));
        f.nodes.forEach((n, i) => {
            const m = by.get(n.id) || { a: 0, d: 0, level: 0 };
            const look = HEAT.light[m.level];
            const sub = m.level ? '+' + fmt(m.a) + ' −' + fmt(m.d) : '本期未改動';
            out.push(JSON.stringify({
                node: n.id, in: 'arch', label: n.name + '\n' + sub, shape: 'round',
                x: PADX + (i % cols) * (NW + GX), y: PADT + Math.floor(i / cols) * (NH + GY), w: NW, h: NH, frame: f.id,
                fill: look.fill, stroke: look.stroke, color: look.ink,
            }));
        });
        x += w + FG;
        rowH = Math.max(rowH, h);
    }
    return out.join('\n') + '\n';
}

module.exports = { fromMap, fromFiles, moduleDef, resolver, moduleStats, boardText };
