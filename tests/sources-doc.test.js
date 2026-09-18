'use strict';
// docs/sources.md is the evidence ledger: one row per dated report at the top
// level of docs/reports/. A row is added by hand, and twice a report sat there
// without one until somebody counted — docs/archive/2026-09-09-gate-and-controls-design.md
// §4, and 2026-09-15-waiting-probes.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('every top-level report has exactly one row in docs/sources.md, and every row links a report that is there', () => {
    const reports = fs.readdirSync(path.join(ROOT, 'docs', 'reports')).filter((f) => f.endsWith('.md')).sort();
    const text = fs.readFileSync(path.join(ROOT, 'docs', 'sources.md'), 'utf8');
    const linked = [...text.matchAll(/^\|[^\n]*?\]\(reports\/([^)/]+\.md)\)/gm)].map((m) => m[1]).sort();
    assert.deepEqual(linked, reports);
});
