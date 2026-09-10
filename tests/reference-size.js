'use strict';

// Shared by tests/render.test.js and tests/resume.test.js. Duplicating this
// pair between the two files is exactly the "two 2400s with different
// sources" the 2026-09-10 judgement found: render()'s cap and renderResume()'s
// cap must measure against the same reference root, and a copy that drifts
// from the original defeats that on its own.

const { PLUGIN_ROOT } = require('../lib/render.js');

// An installed plugin does not live where this checkout does. It lives under
// ~/.claude/plugins/cache/<marketplace>/<plugin>/<version> — 59 characters once
// expanded, as in C:\Users\Owner\.claude\plugins\cache\fankeel\fankeel\0.24.0 —
// against the 16 this repository happens to sit at. Sizing a block where the
// tests run sizes a condition no user is in: measured against a real root,
// `survey`, `build` and `audit` were all over render()'s cap while this file
// reported them passing, and two of them had been over since before the branch
// that raised it.
const REFERENCE_ROOT = 59;

// The root reaches a block as a run-time string, so every place it appears
// grows by the difference between this checkout's root and a real one.
// Counting occurrences rather than tokens is what keeps this honest if a path
// ever gets inlined back into a rule.
function sizeAtReference(out) {
  const roots = out.split(PLUGIN_ROOT).length - 1;
  return out.length + roots * (REFERENCE_ROOT - PLUGIN_ROOT.length);
}

module.exports = { REFERENCE_ROOT, sizeAtReference };
