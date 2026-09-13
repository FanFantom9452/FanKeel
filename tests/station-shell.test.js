'use strict';

// The shell is the half of the page that must not vary. Everything a machine
// knows about itself — a task line, a count, a timestamp — travels in
// station-data.js, so this file can be copied byte for byte to two places and
// still be the same file. A single session id leaking into it would make the
// copy machine-specific and the byte-equality test in tests/station.test.js
// would start passing for the wrong reason.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SHELL = path.join(ROOT, 'assets', 'station', 'index.html');
const CSS = path.join(ROOT, 'assets', 'station', 'station.css');

const shell = () => fs.readFileSync(SHELL, 'utf8');

test('the shell references its three siblings under station/', () => {
    const html = shell();
    assert.match(html, /<link rel="stylesheet" href="station\/station\.css">/);
    assert.match(html, /station\/station-data\.js/);
    assert.match(html, /<script src="station\/station\.js"><\/script>/);
});

test('the data request carries the page query through', () => {
    // /clear-stale answers 303 -> /?cleared=2 and the shell is static, so the
    // count reaches the data file only if the src picks it up. Digits only,
    // which is the rule scripts/station.js already applies at the other end:
    // the whole query string went into the src until 2026-09-09.
    const html = shell();
    assert.match(html, /new URLSearchParams\(location\.search\)\.get\('cleared'\)/);
    assert.match(html, /document\.write\([^)]*station-data\.js/);
});

test('station-data.js is loaded before station.js', () => {
    const html = shell();
    assert.ok(html.indexOf('station-data.js') < html.indexOf('src="station/station.js"'),
        'the view script reads window.STATION at load');
});

test('the shell carries no absolute path', () => {
    // A path into the plugin directory carries its version, so a shell holding
    // one breaks on the next update and the .fankeel/ copy points outside the
    // repository it sits in.
    assert.doesNotMatch(shell(), /file:\/\/|[A-Za-z]:[\\/]|\/Users\/|\/home\//);
});

test('the shell holds every id the view script looks up', () => {
    const html = shell();
    for (const id of ['side', 'q', 'gen', 'nreg', 'cfg', 'page']) {
        assert.ok(html.includes('id="' + id + '"'), 'missing id=' + id);
    }
});

test('the stylesheet defines both themes', () => {
    const css = fs.readFileSync(CSS, 'utf8');
    assert.match(css, /^:root\{/m);
    assert.match(css, /@media\(prefers-color-scheme:dark\)/);
});

test('neither file holds a CRLF', () => {
    // .gitattributes is `* text=auto eol=lf`; a CRLF file diffs whole.
    for (const f of [SHELL, CSS]) {
        assert.ok(!fs.readFileSync(f, 'utf8').includes('\r'), f + ' has CRLF');
    }
});

test('the shell\'s three references all begin station/', () => {
    const html = shell();
    assert.match(html, /href="station\//, 'the stylesheet link does not begin station/');
    assert.match(html, /write\('<script src="station\//, 'the data script does not begin station/');
    assert.match(html, /<script src="station\/station\.js">/, 'the view script does not begin station/');
});

// The 2026-09-14 redesign: the mockup's masthead replaces the side bar, and the
// six ids above stay as the view script's mount points. The class list is the
// one Tasks 6-8 render; a class with no rule is a component the port dropped.
test('the shell is the mockup\'s masthead: a home link, the crumbs on #side, the page main', () => {
    const html = shell();
    assert.match(html, /<header class="mast">/);
    assert.match(html, /<a class="brand" href="#\/"/);
    assert.match(html, /<nav class="crumbs" id="side"/);
    assert.match(html, /<main class="page" id="page"><\/main>/);
    assert.match(html, /<a class="btn" href="#\/list">/);
    assert.match(html, /<footer class="foot">/);
});

test('the page loads nothing from outside', () => {
    // docs/decisions/2026-09-04-session-station-design.md:120
    const css = fs.readFileSync(CSS, 'utf8');
    assert.doesNotMatch(shell(), /(?:src|href)="(?:https?:)?\/\//);
    assert.doesNotMatch(css, /@import|url\(/);
});

test('every palette token the three levels colour by is defined in both themes', () => {
    const css = fs.readFileSync(CSS, 'utf8');
    const at = css.indexOf('@media(prefers-color-scheme:dark)');
    const light = css.slice(0, at);
    const dark = css.slice(at, css.indexOf('}}', at));
    const names = ['--panel', '--inset', '--ink', '--ink2', '--muted', '--faint', '--rule', '--rule2', '--grid',
        '--hatch', '--hatch-bg', '--good', '--bad',
        '--st-survey', '--st-design', '--st-plan', '--st-build', '--st-verify', '--st-audit', '--st-land', '--st-none',
        '--m-fable', '--m-opus', '--m-sonnet', '--m-haiku', '--m-other', '--s-main', '--s-agent', '--s-workflow',
        '--t-in', '--t-out', '--t-cr', '--t-cw', '--ctx', '--ctx-wash',
        '--p-0', '--p-1', '--p-2', '--p-3', '--p-4', '--p-5'];
    for (const n of names) {
        assert.ok(light.includes(n + ':'), 'light theme lacks ' + n);
        assert.ok(dark.includes(n + ':'), 'dark theme lacks ' + n);
    }
});

test('every class the three levels render has a rule', () => {
    const css = fs.readFileSync(CSS, 'utf8');
    const classes = ['mast', 'crumbs', 'search', 'foot', 'page', 'fixed', 'panel', 'eyebrow', 'h2', 'readouts', 'ro',
        'hatchsw', 'controls', 'ctlgrp', 'seg', 'legend', 'sw', 'chart', 'hit', 'tbl-wrap', 't', 'link', 'chip',
        'pchip', 'bar-in', 'route', 'grid2', 'hero-top', 'projrow', 'pth', 'day', 'day-head', 'day-nav', 'btn',
        'day-body', 'split', 'split-h', 'split-bar', 'split-leg', 's-title', 's-meta', 'tabs',
        'lane-legend', 'tl', 'note', 'sumline', 'mixbar', 'mini-mix', 'ev', 'filters',
        'card', 'phead', 'ctl', 'listwrap', 'det', 'sec', 'tally', 'seq', 'rp', 'cmpcard', 'pill', 'delta', 'mute'];
    for (const c of classes) {
        assert.match(css, new RegExp('\\.' + c + '[\\s{,:.>\\[)]'), 'no rule for .' + c);
    }
    // `^` because the kept `.seq .ar.bk{` is not the mockup's bare `.bk{`.
    assert.doesNotMatch(css, /^\.bk\{|\.bk-h|\.demo|\.tip\{|\.xh-read|\.strip24|\.teamcard|\.scrollmain/m,
        'a renamed or dropped rule is still there');
});
