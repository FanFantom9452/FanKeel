'use strict';
// scripts/render.js `--viewport` and `--theme`, and the same two keys on a
// page in `.fankeel/render.json`: a true layout width below the browser's
// 500px window minimum, and the light or dark colour scheme.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { findBrowser } = require('../scripts/render.js');
const { parseTargets, cells } = require('../lib/shots.js');
const tmp = require('./tmp.js');

const CLI = path.join(__dirname, '..', 'scripts', 'render.js');
const run = (args, cwd) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', windowsHide: true, timeout: 90000, cwd });
const NO_BROWSER = findBrowser() ? false : 'no Chromium-family browser on this machine';

// Prints its own width and colour scheme, so the dumped DOM says what the
// browser laid out rather than what the flags asked for.
const PAGE = '<!DOCTYPE html><html><body><div id="o"></div><script>'
    + 'document.getElementById("o").textContent = "W" + innerWidth + "-" + (matchMedia("(prefers-color-scheme: dark)").matches ? "DARK" : "LIGHT");'
    + '</script></body></html>\n';

function fixture() {
    const dir = tmp('fankeel-render-look-');
    const file = path.join(dir, 'p.html');
    fs.writeFileSync(file, PAGE);
    return { dir, file };
}

test('a page in render.json carries its viewport and theme into the cell', () => {
    const conf = JSON.stringify({
        pages: [{ name: 'a', url: 'a.html' }, { name: 'a-412', url: 'a.html', viewport: '412,900', theme: 'light' }],
        roles: [{ name: 'guest' }],
    });
    const got = cells(parseTargets(conf), path.resolve('base'));
    assert.equal(got[0].viewport, undefined);
    assert.equal(got[0].theme, undefined);
    assert.equal(got[1].viewport, '412,900');
    assert.equal(got[1].theme, 'light');
});

test('a viewport that is not W,H and a theme that is not light or dark are refused in render.json', () => {
    const page = (extra) => JSON.stringify({ pages: [Object.assign({ name: 'a', url: 'a.html' }, extra)], roles: [{ name: 'g' }] });
    assert.throws(() => parseTargets(page({ viewport: '412' })), /"a"[)] has a `viewport`/);
    assert.throws(() => parseTargets(page({ theme: 'sepia' })), /"a"[)] has a `theme`/);
});

test('--viewport and --theme are refused on the command line before a browser is looked for', () => {
    const env = { FANKEEL_NO_FALLBACK: '1', FANKEEL_BROWSER: path.join(tmp('x-'), 'nope') };
    const run2 = (args) => spawnSync(process.execPath, [CLI, 'p.html', ...args], { encoding: 'utf8', env: Object.assign({}, process.env, env) });
    const a = run2(['--viewport', 'wide']);
    assert.equal(a.status, 2);
    assert.match(a.stderr, /--viewport takes W,H/);
    const b = run2(['--theme', 'sepia']);
    assert.equal(b.status, 2);
    assert.match(b.stderr, /--theme takes light or dark/);
});

test('--viewport 412,700 lays the page out 412 wide, below the 500px window minimum @slow', { skip: NO_BROWSER }, () => {
    const { dir, file } = fixture();
    const r = run([file, '--out', path.join(dir, 'out'), '--viewport', '412,700']);
    assert.equal(r.status, 0, r.stderr);
    const [png, html] = r.stdout.trim().split('\n');
    assert.match(fs.readFileSync(html, 'utf8'), /W412-/);
    assert.equal(fs.readFileSync(png).readUInt32BE(16), 412);
});

test('--theme dark and --theme light each set the colour scheme the page sees @slow', { skip: NO_BROWSER }, () => {
    const { dir, file } = fixture();
    for (const [theme, want] of [['dark', 'DARK'], ['light', 'LIGHT']]) {
        const r = run([file, '--out', path.join(dir, theme), '--theme', theme]);
        assert.equal(r.status, 0, r.stderr);
        assert.match(fs.readFileSync(r.stdout.trim().split('\n')[1], 'utf8'), new RegExp('-' + want));
    }
});

test('--config shoots a page with a viewport at that width and the others as before @slow', { skip: NO_BROWSER }, () => {
    const { dir } = fixture();
    const conf = path.join(dir, 'render.json');
    fs.writeFileSync(conf, JSON.stringify({
        pages: [{ name: 'plain', url: 'p.html' }, { name: 'narrow', url: 'p.html', viewport: '412,700', theme: 'dark' }],
        roles: [{ name: 'guest' }],
    }));
    const r = run(['--config', conf, '--out', path.join(dir, 'out'), '--size', '800,600']);
    assert.equal(r.status, 0, r.stderr);
    const rows = JSON.parse(fs.readFileSync(r.stdout.trim(), 'utf8')).cells;
    const by = Object.fromEntries(rows.map((c) => [c.page, c]));
    assert.equal(by.plain.ok, true);
    assert.equal(by.plain.width, 800);
    assert.equal(by.narrow.ok, true);
    assert.equal(by.narrow.width, 412);
    assert.equal(by.narrow.viewport, '412,700');
    assert.equal(by.narrow.theme, 'dark');
    assert.equal(by.plain.viewport, undefined);
    assert.match(fs.readFileSync(by.narrow.html, 'utf8'), /W412-DARK/);
});

test('--config fails a viewport cell for a non-guest role instead of shooting the login page @slow', { skip: NO_BROWSER }, () => {
    const { dir } = fixture();
    const conf = path.join(dir, 'render.json');
    fs.writeFileSync(conf, JSON.stringify({
        pages: [{ name: 'narrow', url: 'p.html', viewport: '412,700' }],
        roles: [{ name: 'guest' }, { name: 'admin' }],
    }));
    const r = run(['--config', conf, '--out', path.join(dir, 'out')]);
    assert.equal(r.status, 1);
    const rows = JSON.parse(fs.readFileSync(r.stdout.trim(), 'utf8')).cells;
    const by = Object.fromEntries(rows.map((c) => [c.role, c]));
    assert.equal(by.guest.ok, true);
    assert.equal(by.admin.ok, false);
    assert.match(by.admin.error, /not supported for role admin/);
});
