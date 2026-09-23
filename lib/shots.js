'use strict';
// lib/shots.js: `.fankeel/render.json` read into the cells
// `scripts/render.js --config` shoots — one per role × page. Pure: text in,
// cells out; the browser, the files and the exit code stay in the script.
//
//   { "pages": [{ "name": "home", "url": "http://127.0.0.1:7817/" }],
//     "roles": [{ "name": "guest" }, { "name": "admin", "pages": ["home"] }] }
//
// A name becomes a directory or a file name under `--out`, so it is held to
// letters, digits, `-` and `_`. A role with no `pages` gets every page.
// `profiles` is reserved: `<out>/profiles/<role>` is where `render.js login`
// keeps each role's browser profile, so a role of that name would shoot into it.
const path = require('node:path');

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
    conf.pages.forEach((p, i) => {
        if (!p || !NAME.test(String(p.name || ''))) fail('pages[' + i + '] needs a `name` of letters, digits, - or _');
        if (typeof p.url !== 'string' || !p.url) fail('pages[' + i + '] ("' + p.name + '") needs a `url`');
        if (pages.has(p.name)) fail('page "' + p.name + '" is declared twice');
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
    return { pages, roles };
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

module.exports = { parseTargets, cells, NAME };
