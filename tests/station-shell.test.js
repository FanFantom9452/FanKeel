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
const SHELL = path.join(ROOT, 'assets', 'station', 'station.html');
const CSS = path.join(ROOT, 'assets', 'station', 'station.css');

const shell = () => fs.readFileSync(SHELL, 'utf8');

test('the shell references its three siblings by bare name', () => {
    const html = shell();
    assert.match(html, /<link rel="stylesheet" href="station\.css">/);
    assert.match(html, /station-data\.js/);
    assert.match(html, /<script src="station\.js"><\/script>/);
});

test('the data request carries the page query through', () => {
    // /clear-stale answers 303 -> /?cleared=2 and the shell is static, so the
    // count reaches the data file only if the src picks up location.search.
    assert.match(shell(), /document\.write\([^)]*location\.search/);
});

test('station-data.js is loaded before station.js', () => {
    const html = shell();
    assert.ok(html.indexOf('station-data.js') < html.indexOf('src="station.js"'),
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
