'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseTargets, pagesReached } = require('../lib/shots.js');

const root = path.join(__dirname, '..');

test('the repo render.json parses', () => {
    const t = parseTargets(fs.readFileSync(path.join(root, '.fankeel', 'render.json'), 'utf8'));
    assert.ok(t.pages.size >= 8);
    assert.ok(t.roles.some((r) => r.name === 'guest'));
});

test('a station css change reaches pages', () => {
    const r = pagesReached([path.join(root, 'assets', 'station', 'station.css')], root);
    assert.ok(!r.refusal, r.refusal);
    assert.ok(r.pages.length > 0);
});

test('the three rule files say no render.json is not a reason to skip', () => {
    for (const f of ['skills/fankeel-build/SKILL.md', 'skills/fankeel-verify/SKILL.md', 'agents/fankeel-brain.md']) {
        const t = fs.readFileSync(path.join(root, f), 'utf8');
        assert.ok(t.includes('is not a reason to skip the render reviewer'), f);
        assert.ok(t.includes('Ruling: render skipped'), f);
    }
});
