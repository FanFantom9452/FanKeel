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

test('renders a PNG and a DOM that shows what the inline script wrote', (t) => {
    if (!findBrowser()) {
        t.skip('no Chromium-family browser on this machine (FANKEEL_BROWSER, Edge, Chrome, or an ms-playwright cache)');
        return;
    }
    const dir = tmp('fankeel-render-');
    const fixture = path.join(dir, 'fixture.html');
    fs.writeFileSync(fixture, FIXTURE_HTML);
    const outDir = path.join(dir, 'out');
    const result = spawnSync(process.execPath, [CLI, fixture, '--out', outDir, '--size', '400,300'], { encoding: 'utf8' });
    assert.equal(result.status, 0, 'render exited ' + result.status + ': ' + result.stderr);
    const lines = result.stdout.trim().split('\n');
    assert.equal(lines.length, 2, 'stdout is not exactly two paths: ' + JSON.stringify(result.stdout));
    const [png, html] = lines;
    const bytes = fs.readFileSync(png);
    assert.deepEqual(bytes.subarray(0, 8), PNG_SIGNATURE, png + ' does not start with the PNG signature');
    const dom = fs.readFileSync(html, 'utf8');
    assert.match(dom, /AFTER_JS/, 'the dumped DOM does not show what the inline script wrote');
    assert.doesNotMatch(fs.readFileSync(fixture, 'utf8'), /AFTER_JS/, 'the fixture source already said AFTER_JS; the test proves nothing');
});

test('FANKEEL_BROWSER at a path that does not exist, with fallback off, fails and says why', () => {
    const dir = tmp('fankeel-render-');
    const fixture = path.join(dir, 'fixture.html');
    fs.writeFileSync(fixture, FIXTURE_HTML);
    const env = Object.assign({}, process.env, {
        FANKEEL_BROWSER: path.join(dir, 'no-such-browser.exe'),
        FANKEEL_NO_FALLBACK: '1',
    });
    const result = spawnSync(process.execPath, [CLI, fixture, '--out', path.join(dir, 'out')], { encoding: 'utf8', env });
    assert.notEqual(result.status, 0, 'a missing FANKEEL_BROWSER with fallback off exited 0');
    assert.match(result.stderr, /no Chromium-family browser found/);
});
