'use strict';
// lib/shots.js: `.fankeel/render.json` read into the cells
// `scripts/render.js --config` shoots — one per role × page. Pure: text in,
// cells out; the browser and the exit code stay in the script. `loadTargets`
// and `renderFileRefusal` read the one file they are named, and
// `pagesReached` the render.json files above the changed paths, so the ledger
// and `task.js stage` refuse a page change by one rule, in one wording.
//
//   { "pages": [{ "name": "home", "url": "http://127.0.0.1:28888/", "src": ["site/**"] }],
//     "roles": [{ "name": "guest" }, { "name": "admin", "pages": ["home"] }] }
//
// `src`, optional on a page, is the globs of the files that draw it, relative
// to the directory holding `.fankeel/render.json` (not the repository root
// when that directory is a project under it): `pagesReached` reads each
// changed file against the nearest render.json above it, and the ledger and
// `task.js stage` refuse such a change without a render verdict.
//
// A name becomes a directory or a file name under `--out`, so it is held to
// letters, digits, `-` and `_`. A role with no `pages` gets every page.
// `profiles` is reserved: `<out>/profiles/<role>` is where `render.js login`
// keeps each role's browser profile, so a role of that name would shoot into it.
const fs = require('node:fs');
const path = require('node:path');
const { renderShips } = require('./ledger.js');

const NAME = /^[A-Za-z0-9_-]+$/;

function fail(msg) {
    throw new Error('render.json: ' + msg);
}

function parseTargets(text) {
    let conf;
    try {
        conf = JSON.parse(text);
    } catch (e) {
        fail('not JSON (' + e.message + ')');
    }
    if (!conf || !Array.isArray(conf.pages) || !conf.pages.length) fail('`pages` must be a non-empty array');
    if (!Array.isArray(conf.roles) || !conf.roles.length) fail('`roles` must be a non-empty array');
    const pages = new Map();
    const src = new Map();
    conf.pages.forEach((p, i) => {
        if (!p || !NAME.test(String(p.name || ''))) fail('pages[' + i + '] needs a `name` of letters, digits, - or _');
        if (typeof p.url !== 'string' || !p.url) fail('pages[' + i + '] ("' + p.name + '") needs a `url`');
        if (pages.has(p.name)) fail('page "' + p.name + '" is declared twice');
        if (p.src !== undefined) {
            if (!Array.isArray(p.src) || p.src.some((g) => typeof g !== 'string' || !g)) {
                fail('pages[' + i + '] ("' + p.name + '") has a `src` that is not an array of non-empty strings');
            }
            src.set(p.name, p.src);
        }
        pages.set(p.name, p.url);
    });
    const roles = [];
    conf.roles.forEach((r, i) => {
        if (!r || !NAME.test(String(r.name || ''))) fail('roles[' + i + '] needs a `name` of letters, digits, - or _');
        if (r.name === 'profiles') fail('role name "profiles" is reserved for the login profiles');
        if (roles.some((x) => x.name === r.name)) fail('role "' + r.name + '" is declared twice');
        const names = r.pages === undefined ? [...pages.keys()] : r.pages;
        if (!Array.isArray(names) || !names.length) fail('role "' + r.name + '" has a `pages` that is not a non-empty array');
        for (const n of names) if (!pages.has(n)) fail('role "' + r.name + '" names page "' + n + '" that `pages` does not declare');
        roles.push({ name: r.name, pages: names });
    });
    return { pages, roles, src };
}

// A url that is not http(s) is a file path, resolved against the directory
// render.json sits in, so the file means the same thing from any cwd.
function cells(targets, baseDir) {
    const out = [];
    for (const role of targets.roles) {
        for (const page of role.pages) {
            const url = targets.pages.get(page);
            out.push({ role: role.name, page, url: /^https?:\/\//.test(url) ? url : path.resolve(baseDir, url) });
        }
    }
    return out;
}

// The names of the pages whose `src` globs match any of `paths`, in
// declaration order. Paths are relative to the directory holding
// `.fankeel/render.json`, as `src` is; a `\` is read as `/`, and
// the posix matcher is used so one glob means the same on every platform.
function pagesTouched(targets, paths) {
    const files = (paths || []).map((p) => String(p).replace(/\\/g, '/'));
    const out = [];
    for (const [name, globs] of targets.src) {
        if (files.some((f) => globs.some((g) => path.posix.matchesGlob(f, g)))) out.push(name);
    }
    return out;
}

// A render.json at `file`: `{ targets }`, `{ refusal }` when it cannot be
// read or parsed — the check fails closed — or null when there is none, since
// a project with no render.json is never checked.
function loadTargets(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        if (e.code === 'ENOENT') return null;
        return { refusal: 'render.json: could not read ' + file + ' (' + e.code + ').' };
    }
    try {
        return { targets: parseTargets(text) };
    } catch (e) {
        return { refusal: e.message };
    }
}

// `--render <file>`, the render reviewer's return: null when it ships, else
// the refusal. Relative to the cwd, as the flag was typed.
function renderFileRefusal(file) {
    let text;
    try {
        text = fs.readFileSync(path.resolve(file), 'utf8');
    } catch (e) {
        return '--render: no file at ' + path.resolve(file) + '.';
    }
    return renderShips(text) ? null
        : '--render ' + file + ': its first line is not `disposition: ship`. What it found goes back to the implementer before this is recorded.';
}

// Whether `dir` is `stop` or under it.
function within(stop, dir) {
    const rel = path.relative(stop, dir);
    return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel));
}

// The nearest `.fankeel/render.json` at or above `dir`, no higher than `stop`:
// `loadTargets`'s answer with the `dir` it sits in, or null when there is
// none. `cache` holds each directory's answer across calls.
function nearestTargets(dir, stop, cache) {
    if (!within(stop, dir)) return null;
    for (let d = path.resolve(dir); ; d = path.dirname(d)) {
        if (!cache.has(d)) cache.set(d, loadTargets(path.join(d, '.fankeel', 'render.json')));
        const got = cache.get(d);
        if (got) return Object.assign({ dir: d }, got);
        if (path.relative(stop, d) === '' || path.dirname(d) === d) return null;
    }
}

// Which pages the absolute `files` reach, each read against the nearest
// render.json above it with `src` relative to that file's directory:
// `{ pages, hits }`, or `{ refusal }` when one cannot be read or parsed. With
// more than one render.json reached, each page is qualified by its directory
// relative to `stop`, and each path is given relative to `stop`.
function pagesReached(files, stop) {
    const cache = new Map();
    const reached = new Map();
    for (const file of files) {
        const found = nearestTargets(path.dirname(path.resolve(file)), stop, cache);
        if (!found) continue;
        if (found.refusal) return { refusal: found.refusal };
        const rel = path.relative(found.dir, path.resolve(file)).split(path.sep).join('/');
        if (!pagesTouched(found.targets, [rel]).length) continue;
        if (!reached.has(found.dir)) reached.set(found.dir, { targets: found.targets, rels: [] });
        reached.get(found.dir).rels.push(rel);
    }
    const many = reached.size > 1;
    const pages = [];
    const hits = [];
    for (const [dir, { targets, rels }] of reached) {
        const at = path.relative(stop, dir).split(path.sep).join('/');
        for (const p of pagesTouched(targets, rels)) pages.push(many ? p + ' (' + (at || '.') + ')' : p);
        for (const r of rels) hits.push(many && at ? at + '/' + r : r);
    }
    return { pages, hits };
}

// git names the toplevel by its real path, so the registry root is read the
// same way before the two are compared (a temp directory behind a symlink).
function realPath(p) {
    try { return fs.realpathSync.native(p); } catch (e) { return path.resolve(p); }
}

// The stop `pagesReached` walks up to: the registry root when it holds the
// git toplevel (a workspace of several repositories), else the toplevel; the
// registry root alone when there is no git.
function renderStop(root, top) {
    if (!top) return path.resolve(root);
    return within(root, top) ? path.resolve(root) : path.resolve(top);
}

// `pagesReached`'s pages and hits, with no render verdict: the refusal, or
// null when they reach none. `pass` and `skip` are how the caller's command
// takes a `--render <file>` and records a skip ruling.
function verdictRefusal(reached, pass, skip) {
    if (!reached.pages.length) return null;
    return 'fankeel — this change reaches ' + reached.pages.join(', ') + ' (' + reached.hits.join(', ') + ') and carries no render verdict.'
        + '\nPass ' + pass + ', the render reviewer\'s return, whose first line is `disposition: ship`;'
        + '\nor ' + skip + ' first: one `Ruling: render skipped — <why>` covers this task alone.';
}

module.exports = { parseTargets, cells, pagesTouched, loadTargets, renderFileRefusal, nearestTargets, pagesReached, renderStop, realPath, verdictRefusal, NAME };
