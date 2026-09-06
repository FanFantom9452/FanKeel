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

const ROOT = path.join(__dirname, '..');

test('every flag the station CLI parses appears on docs/station.md', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts', 'station.js'), 'utf8');
    const flags = [...new Set([...src.matchAll(/a === '(--[a-z]+)'/g)].map((m) => m[1]))];
    assert.ok(flags.length >= 5, 'the parser moved: ' + flags.join(', '));
    const page = fs.readFileSync(path.join(ROOT, 'docs', 'station.md'), 'utf8');
    for (const flag of flags) {
        assert.ok(page.includes(flag), flag + ' is on no page');
    }
});
