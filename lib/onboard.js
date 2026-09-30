'use strict';

// First-use onboarding, the cheap half: is this project's filing in a state a
// later stage can read as true? Three checks that list files and never read a
// page's body — docs/90-agent/plans/2026-09-30-init-design.md §1. The two
// expensive ones, docs-check and drift, are `full` in scripts/onboard.js,
// because they live in scripts/ and nothing under lib/ reaches into scripts/.
//
// Measured 09-30 on this repository: docs.read 0.4 ms, layoutBlock 1.1 ms,
// the listing and roleOf 27 ms — cheap enough for `task.js start`.

const docs = require('./docs.js');
const { layoutBlock } = require('./map.js');
const profile = require('./profile.js');

const NAMES = { docsJson: 'docs.json', unfiled: 'unfiled', tree: 'tree' };

function docsJsonCheck(declared) {
    if (declared.tree) return { pass: true, evidence: '.fankeel/docs.json, ' + declared.tree.buckets.length + ' buckets' };
    return { pass: false, evidence: declared.error || '.fankeel/docs.json missing' };
}

function unfiledCheck(root) {
    const n = docs.unfiledCount(root);
    if (n === null) return { pass: false, evidence: 'nothing under ' + root + ' could be listed' };
    return { pass: n === 0, evidence: n + ' markdown file' + (n === 1 ? '' : 's') + ' in no bucket' };
}

// `layoutBlock`'s own verdict: null is no tree of three rows or more in any
// signpost, and `unfilled` is the rows with a path and nothing after it.
function treeCheck(root, tree) {
    const block = layoutBlock(root, tree);
    if (!block) return { pass: false, evidence: 'no directory tree of 3 rows or more in CLAUDE.md, AGENTS.md or README.md' };
    return { pass: block.unfilled === 0, evidence: block.file + ': ' + block.total + ' rows, ' + block.unfilled + ' with no responsibility' };
}

// `init.skip` true answers `skipped` and reads nothing else, unless
// `opts.force` — scripts/onboard.js, run by hand, always checks.
function cheap(root, configDir, opts) {
    const skip = profile.read(root, configDir).values['init.skip'] === true;
    if (skip && !(opts && opts.force)) return { skip, skipped: true, docsJson: null, unfiled: null, tree: null, failing: [] };
    const declared = docs.read(root);
    const out = { skip, skipped: false, docsJson: docsJsonCheck(declared), unfiled: unfiledCheck(root), tree: treeCheck(root, declared.tree) };
    out.failing = Object.keys(NAMES).filter((k) => !out[k].pass).map((k) => NAMES[k] + ' — ' + out[k].evidence);
    return out;
}

module.exports = { cheap, NAMES };
