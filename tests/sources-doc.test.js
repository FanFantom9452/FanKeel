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

// "Cites" means the page's text holds the row's own ID or the basename of
// its report file — the same thing `sources.md:4`'s "filled by hand from
// grep" convention already means. Both directions: a citing page not listed
// is a `Cited by` cell that has not been filled; a listed path that does not
// exist is a name nothing points at any more (this is what catches
// `hooks/size.js` the day it is deleted).
const REPORT_ROW = /^\|\s*`([A-Z0-9-]+)`\s*\|/;

function reportRows(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const m = REPORT_ROW.exec(line);
    if (!m) continue;
    const cells = line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
    const linkMatch = /\]\(reports\/([^)]+\.md)\)/.exec(cells[2] || '');
    const citedByCell = cells[cells.length - 1];
    rows.push({
      id: m[1],
      reportBase: linkMatch ? linkMatch[1] : null,
      citedBy: (citedByCell.match(/`([^`]+)`/g) || []).map((s) => s.slice(1, -1)),
    });
  }
  return rows;
}

// Every `docs/` markdown file outside `docs/archive/` and `docs/plans/`,
// `docs/sources.md` itself excluded. A plan quotes report IDs as the targets of
// its own edits and is archived at `land`, so a `Cited by` entry naming it
// would point at a path that moves the day the plan lands.
function citablePages(dir, base) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(base, full).split(path.sep).join('/');
    if (/^docs\/(archive|plans)(\/|$)/.test(rel)) continue;
    if (fs.statSync(full).isDirectory()) { out.push(...citablePages(full, base)); continue; }
    if (rel.endsWith('.md') && rel !== 'docs/sources.md') out.push(rel);
  }
  return out;
}

test('every docs/ page that cites a sources.md report is in that row\'s Cited by, and every Cited by path exists', () => {
  const rows = reportRows(fs.readFileSync(path.join(ROOT, 'docs', 'sources.md'), 'utf8'));
  const pages = citablePages(path.join(ROOT, 'docs'), ROOT);
  const texts = new Map(pages.map((p) => [p, fs.readFileSync(path.join(ROOT, p), 'utf8')]));

  for (const row of rows) {
    const citing = pages.filter((p) => {
      const t = texts.get(p);
      return t.includes(row.id) || (row.reportBase && t.includes(row.reportBase));
    });
    const missing = citing.filter((p) => !row.citedBy.includes(p));
    assert.deepEqual(missing, [], row.id + ' cites-but-not-listed: ' + missing.join(', '));

    const gone = row.citedBy.filter((p) => !fs.existsSync(path.join(ROOT, p)));
    assert.deepEqual(gone, [], row.id + ' Cited by names a path that does not exist: ' + gone.join(', '));
  }
});
