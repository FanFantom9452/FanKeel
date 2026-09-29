'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// 2026-09-29: the gate no longer asks 方向 or 逐塊. A frontend design always
// draws the mockup with the tune overlay; the user's OK at the gate approves it.
test('the design skill asks no 方向／逐塊 question', () => {
    const design = read('skills/fankeel-design/SKILL.md');
    assert.doesNotMatch(design, /方向/);
    assert.doesNotMatch(design, /逐塊/);
    assert.match(design, /tune/);
});

test('build tunes the real page wherever the task changed one, not where a gate chose', () => {
    const build = read('skills/fankeel-build/SKILL.md').replace(/\s+/g, ' ');
    assert.doesNotMatch(build, /design gate chose/);
    assert.doesNotMatch(build, /逐塊/);
    assert.match(build, /Where the task changed a page/);
});
