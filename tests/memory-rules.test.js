'use strict';

// docs/90-agent/judgements/2026-10-18-tencentdb-agent-memory.md §5: the
// memory rules borrowed from TencentDB-Agent-Memory, as text the slimmer and
// land carry, and the report that set them beside pstack's.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const flat = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\s+/g, ' ');

test('the slimmer caps MEMORY.md at 20 entries, merges first, and removes at most a third per run', () => {
    const text = flat('agents/fankeel-slimmer.md');
    const job = text.slice(text.indexOf('## Job'), text.indexOf('## Return'));
    const refuse = text.slice(text.indexOf('## Refuse'));
    assert.match(job, /`MEMORY\.md` holds at most 20 entries/);
    assert.match(job, /the `merge` candidates come first under `needs approval:`/);
    assert.match(job, /`entries: N of 20`/);
    assert.match(refuse, /more than one third of the memory files/);
    assert.match(refuse, /`max\(1, floor\(n \/ 3\)\)`/);
});

test('land decides store, update, merge or skip before writing memory, and names four kinds never stored', () => {
    const text = flat('skills/fankeel-land/SKILL.md');
    const step = text.slice(text.indexOf('## 4. Land the notes'), text.indexOf('## 5. '));
    assert.match(step, /one of four decisions/);
    for (const d of ['`store`', '`update`', '`merge`', '`skip`']) assert.ok(step.includes(d + ' —'), d);
    assert.match(step, /Four kinds are never stored: a secret/);
    assert.match(step, /a raw log or command output/);
    assert.match(step, /a transient state that clears itself/);
    assert.match(step, /a fact another memory file already holds, which is an `update`/);
});

test('the comparison report sets each recommendation beside pstack and names the task that builds it', () => {
    const text = fs.readFileSync(path.join(ROOT, 'docs', '90-agent', 'reports', '2026-10-19-memory-vs-pstack.md'), 'utf8');
    assert.match(text, /^status: current$/m);
    assert.match(text, /^source_of_truth: agents\/fankeel-slimmer\.md$/m);
    for (const k of ['重疊', '衝突', '優先']) assert.ok(text.includes(k), k);
    for (const t of ['Task 2', 'Task 6', 'Task 7', 'Task 8', 'Task 9']) assert.ok(text.includes(t), t);
    for (const row of ['| 14 |', '| 15 |', '| 31 |', '| 36 |', '| 39 |']) assert.ok(text.includes(row), row);
});
