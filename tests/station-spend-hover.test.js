'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');

test('the hover lift is CSS and respects reduced motion', () => {
    assert.match(CSS, /\.dspark \.db:hover/);
    assert.match(CSS, /\.dspark \.db:focus-visible/);
    assert.match(CSS, /\.dspark \.db\[data-tip\]::after\{/);
    assert.match(CSS, /@media\(prefers-reduced-motion:reduce\)\{[^}]*\.dspark/);
    // Outside keel --keel and --lift are unset: the lift falls back rather than going transparent.
    assert.doesNotMatch(CSS, /^\.dspark [^{]*\{[^}]*var\(--keel\)/m);
    assert.match(CSS, /\.dspark \.db:hover,\.dspark \.db:focus-visible\{[^}]*var\(--keel,var\(--ink\)\)/);
    assert.match(CSS, /\.dspark \.db\[data-tip\]::after\{[^}]*var\(--lift,none\)/);
    // An empty day stays a transparent hit area even under keel's longer bar selectors.
    assert.match(CSS, /\.dspark \.db\.none[^{]*\{background:transparent!important/);
});
