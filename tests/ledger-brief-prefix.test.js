'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const { prefix } = require('../scripts/ledger.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'ledger.js');

const PLAN = [
    '# Sample Implementation Plan', '',
    '**Goal:** a fixture.', '**Architecture:** n/a.', '**Tech Stack:** n/a.', '**Spec:** design.md', '',
    '## Global Constraints', '', '- none', '',
    '## Task 1: first', '',
    '**Files:**', '- Modify: `lib/a.js` — adds a function', '- Test: `tests/a.test.js`', '',
    '**Interfaces:**', '- Consumes: none', '- Produces: `a()` — returns 1', '',
    '**Dispatch:** implementer, sonnet — mechanical.', '', '1. step', '',
].join('\n');

function setup() {
    const root = tmp('fankeel-ledger-prefix-');
    const dir = path.join(root, 'docs', 'plans');
    fs.mkdirSync(dir, { recursive: true });
    const plan = path.join(dir, 'sample.md');
    fs.writeFileSync(plan, PLAN);
    return { root, plan };
}

function run(root, plan) {
    return execFileSync(process.execPath, [SCRIPT, '--root', root, '--plan', plan, 'brief', '--group', '1', '--prefix'], { encoding: 'utf8' });
}

test('brief --group --prefix carries the group\'s Files and Interfaces, and the fixed rules', () => {
    const { root, plan } = setup();
    const out = run(root, plan);
    assert.match(out, /Task 1: first/);
    assert.match(out, /lib\/a\.js/);
    assert.match(out, /Produces: `a\(\)` — returns 1/);
    assert.match(out, /Rules you cannot infer/);
});

test('brief --group --prefix is byte-identical across two runs', () => {
    const { root, plan } = setup();
    assert.equal(run(root, plan), run(root, plan));
});

test('brief --group --prefix says so when nothing is active, rather than guessing', () => {
    const { root, plan } = setup();
    assert.match(run(root, plan), /No active task/);
});

test('prefix(root, plan, 1), called directly, matches the CLI\'s --prefix output', () => {
    const { root, plan } = setup();
    assert.equal(prefix(root, plan, 1), run(root, plan).replace(/\n$/, ''));
});
