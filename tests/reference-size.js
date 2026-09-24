'use strict';

// Shared by tests/render.test.js and tests/resume.test.js. The pair lives in
// lib/render.js now, beside the `task.js profile set` measurement that uses it
// too: duplicating it is exactly the "two 2400s with different sources" the
// 2026-09-10 judgement found, and a copy that drifts defeats the cap on its own.
const { REFERENCE_ROOT, sizeAtReference } = require('../lib/render.js');

module.exports = { REFERENCE_ROOT, sizeAtReference };
