'use strict';
// agents/fankeel-init-scout.md and skills/fankeel-init/SKILL.md
// (docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §3): the scout
// reads the CI workflows and drafts a suite.json it never writes; init asks
// once whether to push and open PRs, writes suite.json only after approval,
// and points at the nightly template without copying it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const flat = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\s+/g, ' ');
const scout = flat('agents/fankeel-init-scout.md');
const init = flat('skills/fankeel-init/SKILL.md');

test('the init scout reads CI workflows and the origin, read-only', () => {
    assert.match(scout, /`\.gitea\/workflows\/\*\.yml` and `\.github\/workflows\/\*\.yml`/);
    assert.match(scout, /`test`, `pytest` or `e2e`/);
    assert.match(scout, /`working-directory:` of its step/);
    assert.match(scout, /`git -C <root> remote get-url origin`/);
    assert.match(scout, /memory, worktrees, ci —/);
    assert.match(scout, /the five above/);
});

test('the init scout drafts suite lines and a suite.json it never writes', () => {
    assert.match(scout, /`suite daily\|nightly <dir> — <run> — <path:line>`/);
    assert.match(scout, /`--collect-only` line left out/);
    assert.match(scout, /which this scout never writes/);
    assert.match(scout, /`land pr — origin <host> is <github\|gitea>`/);
});

test('init asks once about PRs and writes suite.json only after approval', () => {
    assert.match(init, /`node <plugin>\/scripts\/task\.js profile set land\.integration pr --project <name>`/);
    assert.match(init, /`node <plugin>\/scripts\/task\.js profile set land\.push true --project <name>`/);
    assert.match(init, /only after the user approves it/);
    assert.match(init, /`<plugin>\/assets\/ci\/nightly\.yml`/);
    assert.match(init, /fankeel never writes it into a project/);
});
