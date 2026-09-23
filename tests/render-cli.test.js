'use strict';
// scripts/render.js: a screenshot and the DOM after JS ran, from whatever
// Chromium-family browser this machine already has — what
// `fankeel-reviewer`'s `render` lens runs. `tests/render.test.js` already
// covers `lib/render.js` (the injection block builder), an unrelated module
// this repository happens to also call "render" — this file is the CLI's
// own tests, named the way `tests/station-cli.test.js` is
// `scripts/station.js`'s.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { findBrowser } = require('../scripts/render.js');
const tmp = require('./tmp.js');

const CLI = path.join(__dirname, '..', 'scripts', 'render.js');

// A `<div>` the markup itself says `before`, and an inline script that
// overwrites it after load — the only way the dumped DOM can say `AFTER_JS`
// is if the browser actually ran the script rather than this tool reading
// the file's own bytes.
// The assigned value is split across two string literals ("AFTER" + "_JS")
// rather than written as one, so the contiguous substring "AFTER_JS" never
// appears in the fixture's own bytes — only in what the browser's JS engine
// computes and writes into the live DOM. A naive `render.js` that echoed the
// source file instead of actually executing it in a browser would fail the
// `doesNotMatch` check below.
const FIXTURE_HTML = '<!DOCTYPE html>\n<html><head><title>fixture</title></head>\n'
    + '<body><div id="out">before</div>\n'
    + '<script>document.getElementById("out").textContent = "AFTER" + "_JS";</script>\n'
    + '</body></html>\n';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// A fresh tmp dir with FIXTURE_HTML written into it, the way
// tests/station-cli.test.js's own fixture() hands each test a ready
// working directory instead of repeating tmp() plus the write.
function fixture() {
    const dir = tmp('fankeel-render-');
    const file = path.join(dir, 'fixture.html');
    fs.writeFileSync(file, FIXTURE_HTML);
    return { dir, file };
}

test('renders a PNG and a DOM that shows what the inline script wrote', (t) => {
    if (!findBrowser()) {
        t.skip('no Chromium-family browser on this machine (FANKEEL_BROWSER, Edge, Chrome, or an ms-playwright cache)');
        return;
    }
    const { dir, file } = fixture();
    const outDir = path.join(dir, 'out');
    const result = spawnSync(process.execPath, [CLI, file, '--out', outDir, '--size', '400,300'], { encoding: 'utf8' });
    assert.equal(result.status, 0, 'render exited ' + result.status + ': ' + result.stderr);
    const lines = result.stdout.trim().split('\n');
    assert.equal(lines.length, 2, 'stdout is not exactly two paths: ' + JSON.stringify(result.stdout));
    const [png, html] = lines;
    const bytes = fs.readFileSync(png);
    assert.deepEqual(bytes.subarray(0, 8), PNG_SIGNATURE, png + ' does not start with the PNG signature');
    const dom = fs.readFileSync(html, 'utf8');
    assert.match(dom, /AFTER_JS/, 'the dumped DOM does not show what the inline script wrote');
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /AFTER_JS/, 'the fixture source already said AFTER_JS; the test proves nothing');
});

test('a relative --out still lands the PNG, not just print a path nothing is at', (t) => {
    // `--out 'out'` with the CLI's cwd set to a tmp dir: if render.js hands
    // that relative path straight to the browser's own `--screenshot=`
    // flag, the browser can resolve it against its own working directory
    // instead of the one it was spawned with, and no PNG ever lands at the
    // path this test — and the CLI's own stdout — say it did.
    if (!findBrowser()) {
        t.skip('no Chromium-family browser on this machine (FANKEEL_BROWSER, Edge, Chrome, or an ms-playwright cache)');
        return;
    }
    const { dir, file } = fixture();
    const result = spawnSync(process.execPath, [CLI, file, '--out', 'out', '--size', '400,300'], { encoding: 'utf8', cwd: dir });
    assert.equal(result.status, 0, 'render exited ' + result.status + ': ' + result.stderr);
    const png = path.join(dir, 'out', 'render.png');
    assert.ok(fs.existsSync(png), png + ' was not written even though render.js exited 0 and printed a path for it');
    const bytes = fs.readFileSync(png);
    assert.deepEqual(bytes.subarray(0, 8), PNG_SIGNATURE, png + ' does not start with the PNG signature');
});

test('FANKEEL_BROWSER at a path that does not exist, with fallback off, fails and says why', () => {
    const { dir, file } = fixture();
    const env = Object.assign({}, process.env, {
        FANKEEL_BROWSER: path.join(dir, 'no-such-browser.exe'),
        FANKEEL_NO_FALLBACK: '1',
    });
    const result = spawnSync(process.execPath, [CLI, file, '--out', path.join(dir, 'out')], { encoding: 'utf8', env });
    assert.notEqual(result.status, 0, 'a missing FANKEEL_BROWSER with fallback off exited 0');
    assert.match(result.stderr, /no Chromium-family browser found/);
});

// Two pages and two roles, each page a file whose inline script writes its
// own name, so a cell that shot the wrong page is visible in its DOM.
function configFixture() {
    const dir = tmp('fankeel-render-conf-');
    for (const name of ['a', 'b']) {
        fs.writeFileSync(path.join(dir, name + '.html'), '<!DOCTYPE html><html><body><div id="o"></div>'
            + '<script>document.getElementById("o").textContent = "PAGE_" + "' + name + '";</script></body></html>\n');
    }
    const conf = path.join(dir, 'render.json');
    fs.writeFileSync(conf, JSON.stringify({
        pages: [{ name: 'a', url: 'a.html' }, { name: 'b', url: 'b.html' }],
        roles: [{ name: 'guest' }, { name: 'admin' }],
    }));
    return { dir, conf };
}

function pngsUnder(dir) {
    let n = 0;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory() && e.name !== 'profiles') n += pngsUnder(path.join(dir, e.name));
        else if (e.isFile() && e.name.endsWith('.png')) n += 1;
    }
    return n;
}

test('a render.json of two roles and two pages writes four cells and an index that counts them', (t) => {
    if (!findBrowser()) {
        t.skip('no Chromium-family browser on this machine (FANKEEL_BROWSER, Edge, Chrome, or an ms-playwright cache)');
        return;
    }
    const { dir, conf } = configFixture();
    const out = path.join(dir, 'out');
    const result = spawnSync(process.execPath, [CLI, '--config', conf, '--out', out, '--size', '400,300'], { encoding: 'utf8' });
    assert.equal(result.status, 0, 'render --config exited ' + result.status + ': ' + result.stderr);
    assert.equal(result.stdout.trim(), path.join(out, 'index.json'));
    const index = JSON.parse(fs.readFileSync(path.join(out, 'index.json'), 'utf8'));
    assert.deepEqual(index.cells.map((c) => c.role + '/' + c.page), ['guest/a', 'guest/b', 'admin/a', 'admin/b']);
    for (const c of index.cells) {
        assert.equal(c.ok, true, c.role + '/' + c.page + ': ' + c.error);
        assert.deepEqual(fs.readFileSync(c.png).subarray(0, 8), PNG_SIGNATURE, c.png);
        assert.match(fs.readFileSync(c.html, 'utf8'), new RegExp('PAGE_' + c.page), c.html + ' is not page ' + c.page);
        assert.ok(c.width > 0 && c.height > 0, c.png + ' has no recorded size');
    }
    assert.equal(pngsUnder(out), index.cells.length, 'index.json and the PNGs on disk disagree');
    for (const role of ['guest', 'admin']) assert.ok(fs.existsSync(path.join(out, 'profiles', role)), 'no profile dir for ' + role);
});

test('a role naming an undeclared page fails before any browser is looked for', () => {
    const { dir, conf } = configFixture();
    fs.writeFileSync(conf, JSON.stringify({ pages: [{ name: 'a', url: 'a.html' }], roles: [{ name: 'admin', pages: ['c'] }] }));
    const env = Object.assign({}, process.env, { FANKEEL_BROWSER: path.join(dir, 'no-such-browser.exe'), FANKEEL_NO_FALLBACK: '1' });
    const result = spawnSync(process.execPath, [CLI, '--config', conf], { encoding: 'utf8', env });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /role "admin" names page "c"/);
});

test('login without a role says what it needs, and opens nothing', () => {
    const env = Object.assign({}, process.env, { FANKEEL_NO_FALLBACK: '1', FANKEEL_BROWSER: 'no-such-browser' });
    const result = spawnSync(process.execPath, [CLI, 'login'], { encoding: 'utf8', env });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /login needs <role> <url-or-file>/);
});
