'use strict';
// The player page (assets/station/tour.html) in a real browser, read back
// with --dump-dom: a hash opens the promo at a frame and it stays there (no
// autoplay), the scrub bar carries one marker per beat in its stage's colour
// (no chapter chips — there is only the one video now), and ?record strips
// the page to the canvas. Same spawn shape as tests/station-wizard-motion
// .test.js: a profile per spawn, one retry for a starved renderer.
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

test('a hash opens the promo at a frame, and nothing plays it on', (t) => {
    if (!findBrowser()) { t.skip(NO_BROWSER); return; }
    const html = dom(PAGE + '#reel@1500');
    assert.match(html, /id="trFno"[^>]*>f 1500 \/ 3600 · 60 fps</);
    assert.match(html, /<b>0:25\.00<\/b> \/ 1:00\.00/);
    assert.match(html, /aria-valuenow="1500"/);
    assert.match(html, /aria-valuetext="0:25\.00，build"/);
    assert.match(html, /id="trPlay"[^>]*aria-pressed="false"|aria-pressed="false"[^>]*id="trPlay"/);
});

test('the scrub bar carries one marker per beat, coloured by its stage — no chapter chips', (t) => {
    if (!findBrowser()) { t.skip(NO_BROWSER); return; }
    const html = dom(PAGE);
    assert.equal(count(html, /class="tr-mk"/g), 13);
    for (const label of ['hook', 'logo', 'route', 'survey', 'design', 'plan', 'build', 'verify', 'audit', 'land', 'clash', 'numbers', 'outro']) {
        assert.match(html, new RegExp('<span>' + label + '</span>'));
    }
    assert.match(html, /--c: var\(--st-survey\)/);
    assert.equal(/id="trChips"/.test(html), false);
    assert.equal(/data-ch=/.test(html), false);
});

test('the page shows the promo\'s length, with no chapter chips to duplicate it', (t) => {
    if (!findBrowser()) { t.skip(NO_BROWSER); return; }
    const html = dom(PAGE);
    assert.match(html, /id="trFno"[^>]*>f 0 \/ 3600 · 60 fps</);
    assert.match(html, /<b>0:00\.00<\/b> \/ 1:00\.00/);
});

test('?record strips the page to the canvas', (t) => {
    if (!findBrowser()) { t.skip(NO_BROWSER); return; }
    const html = dom(PAGE + '?record#reel@0');
    assert.match(html, /<body class="rec"/);
});

// Criterion: the video speaks the language asked for, and the page has a
// mute button that starts unpressed. Red when: ?lang is ignored or the
// button is missing.
test('?lang picks the video\'s language, and the bar carries a mute button', (t) => {
    if (!findBrowser()) { t.skip(NO_BROWSER); return; }
    assert.match(dom(PAGE + '?lang=en#reel@300'), /data-lang="en"/);
    assert.match(dom(PAGE + '?lang=zh#reel@300'), /data-lang="zh"/);
    const html = dom(PAGE);
    assert.match(html, /id="trMute"[^>]*aria-pressed="false"|aria-pressed="false"[^>]*id="trMute"/);
    assert.match(html, /<script src="i18n\.js"><\/script>/);
    assert.match(html, /<script src="tour-music\.js"><\/script>/);
});

// Criterion (design, What proves it done): every string, zh and en, measured
// with the real fonts' measureText, fits its box. Red when: a box is
// narrower than its string in either language.
test('?check: with the real fonts, no string of either language overflows its box', (t) => {
    if (!findBrowser()) { t.skip(NO_BROWSER); return; }
    for (const lang of ['zh', 'en']) {
        const html = dom(PAGE + '?check&lang=' + lang);
        assert.match(html, /data-overflow="\[\]"/, lang + ': ' + (/data-overflow="([^"]*)"/.exec(html) || [])[1]);
        assert.match(html, /data-missing="\[\]"/, lang + ': ' + (/data-missing="([^"]*)"/.exec(html) || [])[1]);
    }
});
