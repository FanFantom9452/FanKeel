'use strict';
// The weekly reports' archive: <configDir>/fankeel/weekly/<until>.json and
// <until>.html, beside the station's own index.html and roots.json
// (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 輸出位置). Written by
// scripts/weekly.js render, listed by the station's #/weekly page, and never
// inside a repository: a report's content may not be committed anywhere.
const fs = require('node:fs');
const path = require('node:path');

const UNTIL_RE = /^\d{4}-\d{2}-\d{2}$/;

function weeklyDir(configDir) {
    return path.join(String(configDir), 'fankeel', 'weekly');
}

const fileOf = (configDir, until, ext) => path.join(weeklyDir(configDir), until + ext);

// Every until with a .json, newest first.
function untils(configDir) {
    let names;
    try {
        names = fs.readdirSync(weeklyDir(configDir));
    } catch (e) {
        return [];
    }
    return names.filter((n) => n.endsWith('.json') && UNTIL_RE.test(n.slice(0, -5))).map((n) => n.slice(0, -5)).sort().reverse();
}

function readArchive(configDir, until) {
    try {
        const o = JSON.parse(fs.readFileSync(fileOf(configDir, until, '.json'), 'utf8'));
        return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
    } catch (e) {
        return null;
    }
}

function list(configDir) {
    const out = [];
    for (const until of untils(configDir)) {
        const o = readArchive(configDir, until);
        if (!o) continue;
        const counts = o.counts && typeof o.counts === 'object' ? o.counts : {};
        out.push({
            until,
            since: String(o.since || ''),
            done: Number(counts.done) || 0,
            ongoing: Number(counts.ongoing) || 0,
            projects: Array.isArray(o.projects) ? o.projects.map(String) : [],
            html: fs.existsSync(fileOf(configDir, until, '.html')),
        });
    }
    return out;
}

function latest(configDir) {
    for (const until of untils(configDir)) {
        const o = readArchive(configDir, until);
        if (o) return { since: String(o.since || ''), until, next: Array.isArray(o.next) ? o.next : [] };
    }
    return null;
}

function htmlPath(configDir, until) {
    if (!UNTIL_RE.test(String(until))) return null;
    const p = fileOf(configDir, until, '.html');
    return fs.existsSync(p) ? p : null;
}

function neighbours(configDir, until) {
    const all = untils(configDir).filter((u) => fs.existsSync(fileOf(configDir, u, '.html'))).reverse();
    const i = all.indexOf(until);
    if (i < 0) return { prev: null, next: null };
    return { prev: i > 0 ? all[i - 1] : null, next: i < all.length - 1 ? all[i + 1] : null };
}

function save(configDir, until, files) {
    if (!UNTIL_RE.test(String(until))) throw new Error('until is YYYY-MM-DD, not ' + JSON.stringify(until));
    fs.mkdirSync(weeklyDir(configDir), { recursive: true });
    const json = fileOf(configDir, until, '.json');
    const html = fileOf(configDir, until, '.html');
    fs.writeFileSync(json, JSON.stringify(files.json, null, 1) + '\n');
    fs.writeFileSync(html, String(files.html));
    return { json, html };
}

// The bar the station puts on top of a report it serves (design, 進出): back
// to the list, and to the reports either side. Its own <style>, because the
// archived file knows nothing about it; hidden in print.
const NAV_CSS = '.wk-nav{position:sticky;top:0;z-index:10;display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center;padding:8px 18px;'
    + 'font:14px/1.4 system-ui,sans-serif;background:#18202c;color:#fbfcfc}.wk-nav a{color:#fbfcfc;text-decoration:none}'
    + '.wk-nav a:hover{text-decoration:underline}.wk-nav .off{opacity:.45}.wk-nav .sp{flex:1;min-width:0}.wk-nav a,.wk-nav span{white-space:nowrap}@media print{.wk-nav{display:none}}';

function navBar(n) {
    const o = n || {};
    const link = (until, text) => (until && UNTIL_RE.test(until) ? `<a href="/station/weekly/${until}.html">${text}</a>` : `<span class="off">${text}</span>`);
    return `<nav data-block="weekly-nav" class="wk-nav"><style>${NAV_CSS}</style><a href="/#/weekly">← 回週報列表</a>`
        + `<span class="sp"></span>${link(o.prev, '上一份')}${link(o.next, '下一份')}</nav>`;
}

function injectNav(html, nav) {
    const s = String(html);
    const m = /<body[^>]*>/i.exec(s);
    if (!m) return nav + s;
    const at = m.index + m[0].length;
    return s.slice(0, at) + nav + s.slice(at);
}

module.exports = { UNTIL_RE, weeklyDir, list, latest, readArchive, htmlPath, neighbours, save, navBar, injectNav };
