'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { skillFiles, main } = require('../scripts/input-check.js');

// A ratchet, not a target: each cap sits just above the size measured on
// 2026-10-19 (`node scripts/input-check.js --skills`), so a skill can shrink
// freely and cannot grow unnoticed. Slimming lowers the number in the same
// change; growing past it is a decision, made by raising it here.
const CAPS = { 'fankeel': 65200, 'fankeel-build': 49000 };
const OTHER = 24000;

test('input-check --skills lists every stage skill with its size', () => {
    const root = path.join(__dirname, '..');
    const list = skillFiles(root);
    assert.ok(list.length >= 13, 'found ' + list.length);
    for (const s of list) assert.ok(s.bytes > 0 && s.lines > 0 && s.tokens > 0, s.file);
    const out = main(['--root', root, '--skills']).text;
    assert.match(out, /skills\/fankeel-build\/SKILL\.md/);
});

test('no SKILL.md grows past its byte cap', () => {
    for (const s of skillFiles(path.join(__dirname, '..'))) {
        const name = path.basename(path.dirname(s.file));
        const cap = CAPS[name] || OTHER;
        assert.ok(s.bytes <= cap, name + ' is ' + s.bytes + ' bytes, cap ' + cap);
    }
});
