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
