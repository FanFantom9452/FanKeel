// tests/station-footer-version.test.js
'use strict';
// The station footer names the fankeel plugin's own version: a #fkver span
// in index.html, filled from window.STATION.fankeel (lib/station.js serialize).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page } = require('./station-module.js');

test('the footer has the span and the page fills it', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'index.html'), 'utf8');
    assert.match(html, /<footer class="foot">[^]*<span id="fkver"><\/span>[^]*<\/footer>/);
    const { doc } = page([], { fankeel: '9.8.7' });
    assert.equal(doc.getElementById('fkver').textContent, 'fankeel 9.8.7');
});
