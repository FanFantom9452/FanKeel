'use strict';
// The page plays the timeline the hash names. Red when: #promo30@N shows
// reel's frame counter, or an unknown name stops falling back to reel.
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

test('#promo30@900 shows promo30\'s frame 900 of 1800', (t) => {
    if (!findBrowser()) { t.skip(NO_BROWSER); return; }
    assert.match(dom(PAGE + '#promo30@900'), /id="trFno"[^>]*>f 900 \/ 1800 · 60 fps</);
});

test('an unknown name falls back to reel', (t) => {
    if (!findBrowser()) { t.skip(NO_BROWSER); return; }
    assert.match(dom(PAGE + '#intro@10'), /id="trFno"[^>]*>f 0 \/ 3600 · 60 fps</);
});
