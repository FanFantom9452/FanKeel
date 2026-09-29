'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

for (const file of ['skills/fankeel/SKILL.md', 'docs/90-agent/reference/subagents.md']) {
    test(file + ' says the hook writes the prefix, with no version to infer', () => {
        const text = read(file);
        assert.doesNotMatch(text, /sonnet 5 ·/);
        assert.doesNotMatch(text, /environment block/);
        assert.match(text, /hooks\/title\.js/);
    });
}
