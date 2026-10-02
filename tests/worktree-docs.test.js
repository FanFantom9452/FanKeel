'use strict';

// docs/99-archive/2026-10-02-worktree-habit-design.md §3, §5 and §6.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const flat = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\s+/g, ' ');

test('land merges with land.js, cleans after a green suite, and clears only spent agent branches with -D', () => {
    const t = flat('skills/fankeel-land/SKILL.md');
    assert.match(t, /scripts\/land\.js merge --session <id>/);
    assert.match(t, /scripts\/land\.js clean --session <id>/);
    assert.doesNotMatch(t, /`git merge fk\/<id8>`/);
    assert.match(t, /`Fankeel-Task` and `Fankeel-Class`/);
    assert.match(t, /never retried with `-D`/);
    assert.match(t, /spent agent branches/);
    assert.match(t, /`git branch -D <name>`/);
});

test('init step 7 offers worktree\'s four values and the suggested commit.format; step 8 asks about residue', () => {
    const t = flat('skills/fankeel-init/SKILL.md');
    const seven = t.slice(t.indexOf('## 7. Profile'), t.indexOf('## 8. Close'));
    const eight = t.slice(t.indexOf('## 8. Close'));
    assert.match(seven, /`worktree` — `false`.*`true`.*`bounded`.*`architectural`/);
    assert.match(seven, /task\.js profile suggest --project <name>/);
    assert.match(seven, /`commit\.format`/);
    assert.match(seven, /a pattern without `merge` refuses `land\.js merge`/);
    assert.match(eight, /`worktrees` row/);
    assert.match(eight, /nothing is deleted unasked/);
});

test('the init scout runs residue.js and returns a worktrees row', () => {
    const t = flat('agents/fankeel-init-scout.md');
    assert.match(t, /node <plugin>\/scripts\/residue\.js --root <root>/);
    assert.match(t, /`\.claude\/worktrees\/`/);
    assert.match(t, /memory, profile, worktrees/);
    assert.match(t, /the five above/);
});
