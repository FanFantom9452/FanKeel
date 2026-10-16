'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');

test('the keel header styles the page title, the serve icon and hides the language codes', () => {
    assert.match(CSS, /:root\[data-style=keel\] \.mast \.ptitle\{/);
    assert.match(CSS, /:root\[data-style=keel\] \.srv\.up \.dot\{/);
    assert.match(CSS, /:root\[data-style=keel\] \.srv\.down\{/);
    assert.match(CSS, /:root\[data-style=keel\] \.langpop [^{]*i\{display:none\}/);
});
