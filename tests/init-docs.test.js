'use strict';

// docs/90-agent/plans/2026-09-30-init-design.md §7: the reference pages the
// init work made false.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REF = path.join(__dirname, '..', 'docs', '90-agent', 'reference');
const flat = (name) => fs.readFileSync(path.join(REF, name), 'utf8').replace(/\s+/g, ' ');

test('documents.md: the docs.json question is asked at init and at survey, and data has a row', () => {
    const text = flat('documents.md');
    assert.match(text, /asked in two places — `fankeel-init`/);
    assert.equal((text.match(/\| `data` \| raw data/g) || []).length, 1);
    assert.doesNotMatch(text, /it is asked once, at survey/);
});

test('subagents.md and collisions.md name fankeel-init-scout as read-only', () => {
    assert.match(flat('subagents.md'), /## The twenty agents this plugin defines/);
    assert.match(flat('subagents.md'), /`fankeel-init-scout`, `fankeel-reviewer-high` and `fankeel-reviewer-xhigh` — carry `tools: \[Read, Grep, Glob, Bash\]`/);
    assert.match(flat('collisions.md'), /`fankeel-slimmer` or `fankeel-init-scout`, and the command/);
    assert.match(flat('collisions.md'), /\.fankeel\/sensitive\.txt/);
});

// docs/90-agent/plans/2026-10-02-docs-writer.md Task 12.
test('subagents.md names every agent the plugin ships', () => {
    const text = flat('subagents.md');
    const names = fs.readdirSync(path.join(__dirname, '..', 'agents')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
    assert.equal(names.length, 20);
    for (const n of names) assert.ok(text.includes('`' + n + '`'), n);
    assert.match(flat('model-choice.md'), /implementer, <model>, <effort>/);
    assert.match(flat('model-choice.md'), /asks the user before it sends a brain/);
});
