'use strict';
// The player page (assets/station/tour.html) in a real browser, read back
// with --dump-dom: a hash opens a chapter at a frame and it stays there (no
// autoplay), the scrub bar carries one marker per beat in its stage's colour,
// three chapter chips carry their lengths, and ?record strips the page to the
// canvas. Same spawn shape as tests/station-wizard-motion.test.js: a profile
// per spawn, one retry for a starved renderer.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { findBrowser } = require('../scripts/render.js');
const tmp = require('./tmp.js');

const PAGE = pathToFileURL(path.join(__dirname, '..', 'assets', 'station', 'tour.html')).href;
const NO_BROWSER = 'no Chromium-family browser on this machine (FANKEEL_BROWSER, Edge, Chrome, or an ms-playwright cache)';

function dom(url) {
    for (let attempt = 0; attempt < 2; attempt++) {
        const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + tmp('fankeel-tour-page-'),
            '--virtual-time-budget=3000', '--dump-dom', url];
        const r = spawnSync(findBrowser(), args, { encoding: 'utf8', timeout: 60000 });
        if (/data-ready="true"/.test(r.stdout || '')) return r.stdout;
        if (attempt === 1) assert.fail('the page never set data-ready: ' + String(r.stderr || '').slice(0, 300));
    }
    return '';
}
const count = (html, re) => (html.match(re) || []).length;

test('a hash opens a chapter at a frame, and nothing plays it on', (t) => {
    if (!findBrowser()) { t.skip(NO_BROWSER); return; }
    const html = dom(PAGE + '#quickstart@1380');
    assert.match(html, /id="trFno"[^>]*>f 1380 \/ 3480 · 60 fps</);
    assert.match(html, /<b>0:23\.00<\/b> \/ 0:58\.00/);
    assert.match(html, /aria-valuenow="1380"/);
    assert.match(html, /aria-valuetext="0:23\.00，survey"/);
    assert.match(html, /data-ch="quickstart" aria-pressed="true"/);
    assert.match(html, /id="trPlay"[^>]*aria-pressed="false"|aria-pressed="false"[^>]*id="trPlay"/);
});

test('the scrub bar carries one marker per beat, coloured by its stage', (t) => {
    if (!findBrowser()) { t.skip(NO_BROWSER); return; }
    const qs = dom(PAGE + '#quickstart@0');
    assert.equal(count(qs, /class="tr-mk"/g), 4);
    for (const label of ['pick', 'survey', 'gate', 'land']) assert.match(qs, new RegExp('<span>' + label + '</span>'));
    assert.match(qs, /--c: var\(--st-survey\)/);
    const wz = dom(PAGE + '#wizard');
    assert.equal(count(wz, /class="tr-mk"/g), 9);
    assert.match(wz, /id="trFno"[^>]*>f 0 \/ 3600 · 60 fps</);
    const st = dom(PAGE + '#stages@7560');
    assert.equal(count(st, /class="tr-mk"/g), 8);
    assert.match(st, /data-ch="stages" aria-pressed="true"/);
});

test('three chapter chips, with their lengths', (t) => {
    if (!findBrowser()) { t.skip(NO_BROWSER); return; }
    const html = dom(PAGE);
    assert.match(html, /Quick start<small>0:58<\/small>/);
    assert.match(html, /The stages<small>2:15<\/small>/);
    assert.match(html, /Setup wizard<small>1:00<\/small>/);
});

test('?record strips the page to the canvas', (t) => {
    if (!findBrowser()) { t.skip(NO_BROWSER); return; }
    const html = dom(PAGE + '?record#quickstart@0');
    assert.match(html, /<body class="rec"/);
});
