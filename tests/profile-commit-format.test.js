'use strict';

// commit-2: the commit message format is a profile setting. `commit.format` is
// free text like `security.local` — a regular expression, not a choice — so it
// has no station wizard row, and its table row says what it takes.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

test('commit.format takes one line that compiles as a regular expression', () => {
    assert.equal(profile.parseValue('commit.format', ' ^(feat|fix|docs|test): \\S ').value, '^(feat|fix|docs|test): \\S');
    for (const bad of ['', '(', 'a\nb', 'x'.repeat(201)]) {
        assert.ok(profile.parseValue('commit.format', bad).error, JSON.stringify(bad.slice(0, 20)));
    }
    assert.match(profile.parseValue('commit.format', '(').error, /^commit\.format is one line/);
});

test('commit.format is unset by default, and a project profile sets it', () => {
    const d = tmp('fankeel-profile-format-');
    assert.equal(profile.read(d, null).values['commit.format'], undefined);
    fs.mkdirSync(path.join(d, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(d, '.fankeel', 'profile.json'), JSON.stringify({ 'commit.format': '^(feat|fix): \\S' }));
    assert.equal(profile.read(d, null).values['commit.format'], '^(feat|fix): \\S');
});

test('commit.format is not a wizard key, and its table row says what it takes', () => {
    assert.ok(!Object.keys(profile.WIZARD_KEYS).includes('commit.format'));
    const row = profile.profileTable().find((r) => r[0] === '`commit.format`');
    assert.ok(row, 'no table row for commit.format');
    assert.equal(row[2], '一個 JavaScript 正規式，比對訊息第一行');
    assert.equal(profile.profileTable().find((r) => r[0] === '`security.local`')[2], '一個 ollama 模型名稱');
});
