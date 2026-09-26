'use strict';
// docs/plans/2026-09-26-station-redesign.md Task 11: every new animation in
// the wizard rests under prefers-reduced-motion. Checked in a real browser —
// a rule that parses is not a rule that applies — with the same page shot
// twice: without the preference something must be running, or this test
// measures nothing; with it, nothing may be.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const profile = require('../lib/profile.js');
const { findBrowser } = require('../scripts/render.js');
const tmp = require('./tmp.js');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');

const CSS = pathToFileURL(path.join(__dirname, '..', 'assets', 'station', 'station.css')).href;
const PROFILES = { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} };

// Step 0, 收尾, with merge chosen: its card is the one that plays.
function page() {
    let W = V.wizLoad(PROFILES, profile.WIZARD_KEYS, 'machine');
    W = V.wizApply(W, profile.WIZARD_KEYS, PROFILES, { k: 'land.integration', o: 'merge' });
    const body = V.wizHtml(profile.WIZARD_KEYS, W, PROFILES, { serve: false, plugin: '/p', configDir: '/cfg' });
    return '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="' + CSS + '"></head><body>' + body
        + '<pre id="out"></pre><script>requestAnimationFrame(function(){requestAnimationFrame(function(){'
        + 'var run=document.getAnimations().filter(function(a){return a.playState==="running";}).length;'
        + 'document.getElementById("out").textContent="RUN="+run+" RM="+matchMedia("(prefers-reduced-motion: reduce)").matches;});});'
        + '</script></body></html>';
}

// Its own profile per spawn. Two Chromium processes on the default profile
// hand the second one's URL to the first, and the second exits with nothing
// on stdout — the `the page never reported` failure the suite saw on 09-26.
function shoot(file, reduce) {
    const profileDir = tmp('fankeel-wizmotion-profile-');
    const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + profileDir, '--virtual-time-budget=2000'];
    if (reduce) args.push('--force-prefers-reduced-motion');
    const r = spawnSync(findBrowser(), args.concat(['--dump-dom', pathToFileURL(file).href]), { encoding: 'utf8', timeout: 60000 });
    const m = /RUN=(\d+) RM=(true|false)/.exec(r.stdout || '');
    assert.ok(m, 'the page never reported: ' + String(r.stderr || '').slice(0, 300));
    return { running: Number(m[1]), reduced: m[2] === 'true' };
}

test('the chosen card animates, and under reduced motion nothing is running', (t) => {
    if (!findBrowser()) {
        t.skip('no Chromium-family browser on this machine (FANKEEL_BROWSER, Edge, Chrome, or an ms-playwright cache)');
        return;
    }
    const file = path.join(tmp('fankeel-wizmotion-'), 'wizard.html');
    fs.writeFileSync(file, page());
    const plain = shoot(file, false);
    assert.equal(plain.reduced, false);
    assert.ok(plain.running > 0, 'the control: without reduced motion the chosen card plays');
    const reduced = shoot(file, true);
    assert.equal(reduced.reduced, true, '--force-prefers-reduced-motion did not reach the page');
    assert.equal(reduced.running, 0, reduced.running + ' animations still running under reduced motion');
});
