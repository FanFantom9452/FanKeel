'use strict';

// docs/90-agent/plans/2026-09-30-init-design.md §2c: the judgement half of the
// sensitive check, defined once in the reviewer and asked for by name.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('the reviewer carries the sensitive lens: two tags, the word list, and its closing line', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reviewer.md'), 'utf8');
    assert.match(text, /^## Sensitive$/m);
    const lens = text.split('\n## Sensitive\n')[1].split('\n## ')[0];
    for (const tag of ['listed:', 'unlisted:']) assert.ok(lens.includes('`' + tag + '`'), 'the lens does not define ' + tag);
    assert.match(lens, /\.fankeel\/sensitive\.txt/);
    assert.match(lens, /sensitive: <N> findings\./);
    assert.match(lens, /lib\/sensitive\.js/);
});

test('the sensitive-lens eval cases parse: two findings planted, and a clean diff that must say none', () => {
    const ev = require('../lib/eval.js');
    const hit = ev.parseCase(path.join(ROOT, 'evals', 'sensitive-lens'));
    assert.equal(hit.name, 'sensitive-lens');
    assert.equal(hit.graders.length, 3);
    const clean = ev.parseCase(path.join(ROOT, 'evals', 'sensitive-lens-clean'));
    assert.equal(clean.name, 'sensitive-lens-clean');
    assert.equal(clean.graders.length, 2);
});

test('plan, build and verify ask for the Sensitive lens when sensitive.review is true', () => {
    for (const skill of ['fankeel-plan', 'fankeel-build', 'fankeel-verify']) {
        const text = fs.readFileSync(path.join(ROOT, 'skills', skill, 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
        assert.match(text, /`sensitive\.review` is `true`/, skill);
        assert.match(text, /`## Sensitive` lens/, skill);
    }
});
