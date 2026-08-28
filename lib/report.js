'use strict';

// The three things every scanner in this plugin does to turn a result into a
// report: name a size, agree with its own noun, and cut a list short without
// pretending the tail was never there.
//
// They lived four times over — `human` in `scripts/survey.js`,
// `scripts/residue.js` and `scripts/layout.js` byte for byte, `plural` under
// four spellings across those three and `scripts/docs-audit.js`, and `section`
// three times with two different ways of saying the same truncation. The
// comment beside one of the copies argued for keeping them apart: four lines in
// two scripts, held together by a test rather than an import. There were three
// scripts by then, and the wording had already drifted.

// A cap is a promise that what is above it is worth reading, not that what is
// below it does not exist.
const MAX_PER_SECTION = 25;

// `toFixed(1)` rounds anything from 1023.95 up, so the arithmetic tier boundary
// prints `1024.0K` — a unit that exists one line further down the same report.
// The boundary that matters is where the number stops being printable, which is
// slightly below where the tier changes.
const TIER = 1024 * 0.9995;
const K = 1024;
const M = K * 1024;
const G = M * 1024;
const T = G * 1024;

// Four tiers rather than three. `scripts/layout.js` printed `data/ 3071.0M` on a
// real project on 2026-08-29 for want of the G tier; a report that stops at G
// has the same gap one tier up, and closing the class costs one clause.
const human = (n) => (n < TIER ? n + 'B'
    : n < TIER * K ? (n / K).toFixed(1) + 'K'
    : n < TIER * M ? (n / M).toFixed(1) + 'M'
    : n < TIER * G ? (n / G).toFixed(1) + 'G'
    : (n / T).toFixed(1) + 'T');

const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

// Returns its lines rather than pushing into somebody's array, and leads with a
// blank so a caller can spread it wherever it belongs. An empty section returns
// nothing at all — a heading over no rows is a heading that reads as a finding.
//
// The cap is applied here rather than by the caller. A caller that slices first
// hands over a list already the right length, and the count of what was dropped
// — the one line that stops a cap reading as "that is all there is" — never gets
// printed. `scripts/docs-audit.js` did exactly that with its pairs list.
// `Infinity` is a cap somebody chose — `scripts/survey.js --all` is exactly that
// — so the test for "none given" cannot be `Number.isFinite`. It was, briefly,
// and `--all` silently went back to capping at twenty-five.
function section(title, rows, max) {
    if (!rows.length) return [];
    const cap = (typeof max === 'number' && max > 0) ? max : MAX_PER_SECTION;
    const out = ['', title];
    for (const row of rows.slice(0, cap)) out.push('  ' + row);
    if (rows.length > cap) {
        out.push('  ... and ' + (rows.length - cap) + ' more, not listed');
    }
    return out;
}

module.exports = { MAX_PER_SECTION, human, plural, section };
