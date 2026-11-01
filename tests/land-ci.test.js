'use strict';
// skills/fankeel-land/SKILL.md step 7 (docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §2):
// a PR opens by the origin's host, and after any push ci-status.js's one line
// goes on the report beside `suite:`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const flat = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel-land', 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
const seven = flat.slice(flat.indexOf('## 7. Execute'), flat.indexOf('## Output'));

test('fankeel-land step 7 opens the PR by the origin host', () => {
    assert.match(seven, /`github\.com` → `gh pr create --base <base> --head <branch> --fill`/);
    assert.match(seven, /`tea pulls create --base <base> --head <branch> --title "<subject>"` when `tea` is on PATH/);
    assert.match(seven, /`https:\/\/<host>\/<owner>\/<repo>\/compare\/<base>\.\.\.<branch>`/);
});

test('fankeel-land reads CI once after a push and never waits on it', () => {
    assert.match(seven, /`node <plugin>\/scripts\/ci-status\.js <sha>`/);
    assert.match(seven, /never waits, and land never stops on it/);
    assert.match(seven, /neither is written or printed/);
});

test('the land report carries the ci line beside suite', () => {
    const out = flat.slice(flat.indexOf('## Output'));
    assert.match(out, /suite: <suite\.js line> ci: <ci-status\.js line, after a push>/);
    assert.match(out, /`ci:` from step 7 when this land pushed; no push, no line/);
});
