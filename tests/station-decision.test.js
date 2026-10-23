'use strict';
// station-52 (e): the decision to keep the station vanilla classic scripts
// is written down, says what was turned down, and cites the judgement.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DECISION = path.join(__dirname, '..', 'docs', '03-decisions', '2026-10-24-station-vanilla-modules.md');

test('the decision names vanilla classic scripts, no build, no dependency, what it turned down, and cites the judgement', () => {
    const text = fs.readFileSync(DECISION, 'utf8');
    for (const s of ['classic script', '零依賴', '無 build', 'ESM', '框架', 'file://', 'node:vm', '../90-agent/judgements/2026-10-23-station-skeleton-stack.md']) assert.ok(text.includes(s), s);
    for (const h of ['## 決定', '## 為什麼', '## 放棄了什麼']) assert.ok(text.includes('\n' + h + '\n'), h);
    assert.match(text, /^---\nstatus: decision\nlast_verified: \d{4}-\d{2}-\d{2}\n---\n/);
});
