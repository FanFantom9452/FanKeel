'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const docs = require('../lib/docs.js');
const { checkFile } = require('../scripts/docs-check.js');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('docs.json files .fankeel/verify as an agent reference bucket', () => {
    const { tree, error } = docs.read(ROOT);
    assert.equal(error, null);
    assert.ok(tree.buckets.some((b) => b.path === '.fankeel/verify' && b.role === 'reference' && b.audience === 'agent'),
        JSON.stringify(tree.buckets));
    assert.equal(docs.roleOf(tree, '.fankeel/verify/station.md'), 'reference');
});

test('verify: the verifier is handed the feature files its range reaches', () => {
    const text = read('skills/fankeel-verify/SKILL.md');
    const para = /\*\*A feature file covers the change: the verifier cites it\.\*\*[\s\S]*?(?=\r?\n\r?\nA row reading)/.exec(text);
    assert.ok(para, 'the paragraph is not between "dispatching exists to avoid." and "A row reading"');
    assert.match(para[0], /node <plugin>\/scripts\/verify-map\.js --range <range>/);
    assert.match(para[0], /`pagesTouched\(\)`/);
    assert.match(para[0], /`## Doctor` first/);
    assert.match(para[0], /`blocked` row/);
});

test('audit: a reader reconciles each feature file as clean, changed or blocked; the live pass is not here', () => {
    const text = read('skills/fankeel-audit/SKILL.md');
    const para = /\*\*The verification map, reconciled\.\*\*[\s\S]*?(?=\r?\n\r?\nQuote what came back\.)/.exec(text);
    assert.ok(para, 'the paragraph is not between the --record paragraph and "Quote what came back."');
    assert.match(para[0], /node <plugin>\/scripts\/verify-map\.js/);
    assert.match(para[0], /fankeel:fankeel-reader/);
    for (const word of ['clean', 'changed', 'blocked']) assert.match(para[0], new RegExp('`' + word + '`'));
    assert.match(para[0], /live pass/);
});

test('both skill pages still pass docs-check as reference', () => {
    for (const rel of ['skills/fankeel-verify/SKILL.md', 'skills/fankeel-audit/SKILL.md']) {
        assert.deepEqual(checkFile(ROOT, rel, 'reference'), [], rel);
    }
});
