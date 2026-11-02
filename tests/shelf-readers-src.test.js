'use strict';
// station history, profile and settingsuggest read the shelf (lib/shelf.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('the station, profile and settingsuggest readers ask for the shelf', () => {
    const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'lib', f), 'utf8');
    assert.match(src('station.js'), /registry\.readAll\(root, \{ shelf: true \}\)/);
    assert.match(src('profile.js'), /registryLib\.readAll\(registryRoot, \{ shelf: true \}\)/);
    assert.match(src('settingsuggest.js'), /registry\.readAll\(registryRoot, \{ shelf: true \}\)/);
});
