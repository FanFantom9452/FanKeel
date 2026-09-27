'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { apply } = require('../scripts/profile-table.js');
const { profileTableMarkdown, KEYS } = require('../lib/profile.js');

const PAGE = path.join(__dirname, '..', 'docs', '01-guide', 'profile.md');

test('docs/01-guide/profile.md holds exactly what regenerating the table produces', () => {
    const committed = fs.readFileSync(PAGE, 'utf8');
    const fresh = apply(committed, profileTableMarkdown());
    assert.equal(committed, fresh,
        'docs/01-guide/profile.md is stale — a KEYS entry or PRESETS.balanced changed without regenerating it (run: node scripts/profile-table.js)');
});

// A stale-detector that cannot go red is not a test. `desc` on a live KEYS
// entry moved, regenerated against the committed page, and the mismatch this
// exists to catch has to show up — restored in a `finally` so no later test
// in this file, or one sharing this process, sees the tampered value.
test('a changed desc actually fails the check it exists for', () => {
    const saved = KEYS.guard.desc;
    KEYS.guard.desc = saved + ' (changed)';
    try {
        const committed = fs.readFileSync(PAGE, 'utf8');
        const fresh = apply(committed, profileTableMarkdown());
        assert.notEqual(committed, fresh);
    } finally {
        KEYS.guard.desc = saved;
    }
});
