'use strict';
// A /fankeel prompt still starts the station, but never opens a browser: hooks/inject.js passes
// `open: false` to ensureServe (lib/serve.js reads `o.open !== false`).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'inject.js'), 'utf8');

test('the hook asks ensureServe for a station without a browser', () => {
    const call = /serveLib\.ensureServe\(\{([^}]*)\}\)/.exec(SRC);
    assert.ok(call, 'the hook calls serveLib.ensureServe({...})');
    assert.match(call[1], /\bopen:\s*false\b/);
    assert.match(call[1], /\bconfigDir:\s*dir\b/, 'the station is still started');
});

test('the comment above it no longer says the prompt opens the browser', () => {
    assert.doesNotMatch(SRC, /starts `station\.js serve --open` detached/);
});
