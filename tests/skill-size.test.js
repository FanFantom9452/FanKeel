'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { skillFiles, main } = require('../scripts/input-check.js');

// A ratchet, not a target: each cap is the smallest multiple of 100 above the
// size measured on 2026-10-20 (`node scripts/input-check.js --skills`;
// skills-4: measure first, then cap), so a skill can shrink freely and cannot
// grow unnoticed. Slimming lowers the number in the same change; growing past
// it is a decision, made by raising it here. One per skill: a shared fallback
// let the smallest skill grow fifteen-fold unnoticed.
const CAPS = {
    'fankeel': 66800,
    'fankeel-build': 43100,
    'fankeel-survey': 24000,
    'fankeel-land': 25600,
    'fankeel-audit': 20800,
    'fankeel-plan': 21900,
    'fankeel-verify': 20100,
    'fankeel-design': 17100,
    'fankeel-init': 14000,
    'fankeel-ask': 9000,
    'fankeel-explain': 4700,
    'fankeel-weekly': 10900,
    'fankeel-retro-all': 3700,
    'fankeel-upgrade': 2100,
    'fankeel-phone': 1600,
    'fankeel-station': 1600,
};

test('input-check --skills lists every stage skill with its size', () => {
    const root = path.join(__dirname, '..');
    const list = skillFiles(root);
    assert.ok(list.length >= 13, 'found ' + list.length);
    for (const s of list) assert.ok(s.bytes > 0 && s.lines > 0 && s.tokens > 0, s.file);
    const out = main(['--root', root, '--skills']).text;
    assert.match(out, /skills\/fankeel-build\/SKILL\.md/);
});

test('every SKILL.md has its own byte cap, and none grows past it', () => {
    const list = skillFiles(path.join(__dirname, '..'));
    const names = list.map((s) => path.basename(path.dirname(s.file))).sort();
    assert.deepEqual(names, Object.keys(CAPS).sort(), 'a skill with no cap of its own, or a cap for no skill');
    for (const s of list) {
        const name = path.basename(path.dirname(s.file));
        assert.ok(s.bytes <= CAPS[name], name + ' is ' + s.bytes + ' bytes, cap ' + CAPS[name]);
    }
});
