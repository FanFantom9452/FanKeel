'use strict';

// lib/hook.js and lib/report.js are shared by more callers than any one
// reference page named — grep before this task found both only in decision
// and report pages, never in a reference page's own source_of_truth. This
// checks that against the real tree, the way tests/stage-registry.test.js
// checks a real generated file rather than a fixture.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const docs = require('../lib/docs.js');
const { trackedFiles } = require('../lib/tracked.js');
const { isMarkdown } = require('../scripts/docs-check.js');

const ROOT = path.join(__dirname, '..');

test('lib/hook.js and lib/report.js are each named as source_of_truth by some reference page', () => {
    const markdown = trackedFiles(ROOT).files.filter(isMarkdown);
    const owners = docs.sourcesOf(ROOT, markdown);
    assert.ok((owners['lib/hook.js'] || []).length > 0, 'lib/hook.js is named nowhere');
    assert.ok((owners['lib/report.js'] || []).length > 0, 'lib/report.js is named nowhere');
});
