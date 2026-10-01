'use strict';

// Every flag `scripts/station.js` parses is on the station page. On
// 2026-09-07 `--port`, `--idle` and `--open` were on no page at all, and a
// flag nobody can find is a flag nobody uses. The flags are read off the
// parser rather than listed here, so a new one has to be documented to stay
// green.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { acceptedFlags } = require('../lib/skills.js');

const ROOT = path.join(__dirname, '..');

test('every flag the station CLI parses appears on docs/station.md', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts', 'station.js'), 'utf8');
    const flags = [...acceptedFlags(src)];
    assert.ok(flags.length >= 5, 'the parser moved: ' + flags.join(', '));
    const page = fs.readFileSync(path.join(ROOT, 'docs', '90-agent', 'reference', 'station.md'), 'utf8');
    for (const flag of flags) {
        assert.ok(page.includes(flag), flag + ' is on no page');
    }
});

// Every path `serve` answers by name is on the page too. On 2026-09-27
// `/station/search` arrived with the 文件 box; a route nobody can find is a
// route nobody knows the page depends on.
test('every route scripts/station.js answers by name appears on docs/station.md', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts', 'station.js'), 'utf8');
    const routes = [...new Set([...src.matchAll(/url\.pathname === '(\/[^']+)'/g)].map((m) => m[1]))];
    assert.ok(routes.length >= 8, 'the handler moved: ' + routes.join(', '));
    const page = fs.readFileSync(path.join(ROOT, 'docs', '90-agent', 'reference', 'station.md'), 'utf8');
    for (const r of routes) assert.ok(page.includes(r.slice(1)), r + ' is on no page');
});

// Every localStorage key the page keeps is on the page's reference. On
// 2026-10-01 the dashboard chooser and the style switch added two, and the
// page still said "Two keys".
test('every localStorage key station.js stores appears on docs/station.md', () => {
    const src = fs.readFileSync(path.join(ROOT, 'assets', 'station', 'station.js'), 'utf8');
    const keys = [...new Set([...src.matchAll(/\bstored?\('(station\.[a-zA-Z.]+)'/g)].map((m) => m[1]))];
    assert.ok(keys.includes('station.theme'), 'the pattern moved: ' + keys.join(', '));
    const page = fs.readFileSync(path.join(ROOT, 'docs', '90-agent', 'reference', 'station.md'), 'utf8');
    for (const k of keys) assert.ok(page.includes('`' + k + '`'), k + ' is on no page');
    assert.doesNotMatch(page, /Two keys in `localStorage`/);
});

// The 2026-10-01 layout: the page reference names each new page head, the
// three newest done entries, the theme in the masthead, and no classic look.
test('station.md describes the 2026-10-01 layout and no longer the classic look', () => {
    const page = fs.readFileSync(path.join(ROOT, 'docs', '90-agent', 'reference', 'station.md'), 'utf8');
    assert.doesNotMatch(page, /newest ten|station\.style|style-classic|foot of the sidenav/);
    for (const b of ['dash-head', 'sessions-head', 'live-head', 'session-head', 'session-tabs']) {
        assert.ok(page.includes('`data-block="' + b + '"`'), b + ' is not on the page');
    }
    assert.match(page, /newest three/);
});
