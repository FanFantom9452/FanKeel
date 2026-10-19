'use strict';
// The three pages that describe the completion record (task-record design).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('plain-language.md 完成紀錄 describes the six-field record, not the TODO-only one', () => {
    const sec = read('docs/90-agent/reference/plain-language.md').split('\n## 完成紀錄\n')[1];
    for (const f of ['要求', '做了什麼', '為什麼這樣做', '驗過・沒驗過', '花費', '還剩什麼']) assert.ok(sec.includes(f), f);
    assert.ok(sec.includes('docs/90-agent/records'));
    assert.ok(sec.includes('scripts/record.js'));
    assert.doesNotMatch(sec, /只顯示這一段/);
});

test('station.md closes What each row holds with the record, and its last_verified is today or later', () => {
    const md = read('docs/90-agent/reference/station.md');
    const row = md.split('## What each row holds')[1].split('\n### ')[0];
    for (const b of ['record', 'record-page', 'list-ask']) assert.ok(row.includes('`' + b + '`'), b);
    assert.ok(row.includes('docs/90-agent/records'));
    assert.match(md, /last_verified: 2026-10-(19|[23]\d)/);
});

test('docs/README.md has one question row for docs/90-agent/records', () => {
    const rows = read('docs/README.md').split('\n').filter((l) => l.startsWith('|') && l.includes('90-agent/records') && !l.startsWith('| `docs/'));
    assert.equal(rows.length, 1);
});
