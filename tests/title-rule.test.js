'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

for (const file of ['lib/render.js', 'agents/fankeel-brain.md']) {
    test(file + ' tells a dispatcher to write the title only; the hook adds the prefix', () => {
        const text = read(file);
        assert.doesNotMatch(text, /<alias> <version>/);
        assert.doesNotMatch(text, /environment block/);
        assert.match(text, /hooks\/title\.js/);
    });
}
