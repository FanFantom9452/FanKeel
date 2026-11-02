'use strict';

// docs/90-agent/todo/compact-8.md: Claude Code 2.1.314's Desktop idle
// compaction acts before a compact.at of 350000 or more, and the documents
// say who goes first.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const flat = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\s+/g, ' ');

test('profile.md says Claude Code compacts an idle 200K+ conversation first', () => {
    const page = flat('docs/01-guide/profile.md');
    assert.match(page, /2\.1\.314/);
    assert.match(page, /Idle compaction/);
    assert.match(page, /`350000` 以上時，只在你沒離開的時候才輪到 fankeel/);
    assert.match(page, /沒有 1M 的帳號，`compact\.at` 在 `350000` 以上永遠不會先觸發/);
});

test('what-runs.md compact line names the host compaction', () => {
    const page = flat('docs/01-guide/what-runs.md');
    assert.match(page, /\*\*compact\*\*：[^-]*Idle compaction/);
});

test('the fankeel skill says compact.at 350000 and above waits its turn', () => {
    const skill = flat('skills/fankeel/SKILL.md');
    assert.match(skill, /Claude Code 2\.1\.314 compacts a 200K\+ conversation by itself/);
    assert.match(skill, /`\/config` → Idle compaction/);
    assert.match(skill, /never reaches it before the host does/);
});
