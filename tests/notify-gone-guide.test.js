'use strict';
// notify-1: the user guide no longer tells anyone to set up ntfy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (const page of ['station.md', 'tailscale-setup.md', 'what-runs.md']) {
    test('docs/01-guide/' + page + ' names no ntfy and no notify.* key', () => {
        const text = fs.readFileSync(path.join(__dirname, '..', 'docs', '01-guide', page), 'utf8');
        assert.doesNotMatch(text, /ntfy|notify\.(server|topic|gate|stage|end)/i);
    });
}
