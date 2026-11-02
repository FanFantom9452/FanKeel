'use strict';
// The shelf is written down where the registry and the land stage are.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('registry.md names the shelf, its option and the threshold', () => {
    const doc = read('docs/90-agent/reference/registry.md');
    assert.match(doc, /^# 架子$/m);
    assert.match(doc, /readAll\(root, \{ shelf: true \}\)/);
    assert.match(doc, /scripts\/shelf\.js run/);
    assert.match(doc, /14 天/);
});

test('the land skill names the shelf command', () => {
    assert.match(read('skills/fankeel-land/SKILL.md'), /`node <plugin>\/scripts\/shelf\.js run`/);
});

test('invariant 4 says a shelved entry is not a deleted one', () => {
    assert.match(read('skills/fankeel/SKILL.md'), /moving an ended entry to the shelf \(`scripts\/shelf\.js`\) is not deleting it\./);
});
