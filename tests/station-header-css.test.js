'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');

test('the keel header styles the page title, the serve icon and hides the language codes', () => {
    assert.match(CSS, /:root\[data-style=keel\] \.mast \.ptitle\{/);
    assert.match(CSS, /:root\[data-style=keel\] :is\(\.srv,#servedown\) \.dot\{/);
    assert.match(CSS, /:root\[data-style=keel\] :is\(\.srv\.down,#servedown\)\{color:var\(--down\)\}/);
    // #servedown is index.html's own pill with no .srv class: it must still be the square in the right group.
    assert.match(CSS, /:root\[data-style=keel\] :is\(\.srv,#servedown\)\{[^}]*order:3/);
    // Language and theme are one frame: the theme half has no left edge, so the language ring's right side is the one hairline between.
    assert.match(CSS, /:root\[data-style=keel\] header\.mast \.langsw\{border-radius:8px 0 0 8px\}/);
    assert.match(CSS, /:root\[data-style=keel\] header\.mast \.appear\{margin-left:-8px;[^}]*box-shadow:inset 0 1px 0 var\(--rule\),inset -1px 0 0 var\(--rule\),inset 0 -1px 0 var\(--rule\)\}/);
    assert.match(CSS, /:root\[data-style=keel\] \.langpop [^{]*i\{display:none\}/);
});
