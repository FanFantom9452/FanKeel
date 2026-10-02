'use strict';

// The two launchers at the repository root: each runs the station.js beside it
// with serve --detach --open (docs/90-agent/plans/2026-10-02-todo-folder-only-design.md §5).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('station.bat runs scripts\\station.js beside it, serve --detach --open', () => {
    const text = fs.readFileSync(path.join(ROOT, 'station.bat'), 'utf8');
    assert.match(text, /^@node "%~dp0scripts\\station\.js" serve --detach --open %\*\r?\n?$/);
});

test('station.sh runs scripts/station.js beside it, serve --detach --open', () => {
    const text = fs.readFileSync(path.join(ROOT, 'station.sh'), 'utf8');
    assert.match(text, /^#!\/bin\/sh\nexec node "\$\(dirname "\$0"\)\/scripts\/station\.js" serve --detach --open "\$@"\n$/);
});
