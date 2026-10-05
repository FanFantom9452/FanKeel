'use strict';

// plain-1: the `/fankeel` write's 2800ms threshold was a sentence on the
// station reference page and nothing else — no code held it and no test failed
// if it moved. It is a constant now, the page names it, and it stays above the
// slowest write measured when the user chose it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DETAIL_BUDGET_MS, WRITE_THRESHOLD_MS } = require('../lib/station.js');

// docs/90-agent/reference/station.md, measured 2026-10-05: 1954–2664ms.
const SLOWEST_MEASURED_MS = 2664;

test('the /fankeel write threshold is 2800ms, above the detail budget and the slowest measured write', () => {
    assert.equal(WRITE_THRESHOLD_MS, 2800);
    assert.ok(DETAIL_BUDGET_MS < WRITE_THRESHOLD_MS);
    assert.ok(SLOWEST_MEASURED_MS < WRITE_THRESHOLD_MS);
});

test('the station reference page names the same threshold and the constant holding it', () => {
    const page = fs.readFileSync(path.join(__dirname, '..', 'docs', '90-agent', 'reference', 'station.md'), 'utf8');
    assert.match(page, new RegExp('its threshold is ' + WRITE_THRESHOLD_MS + 'ms \\(`WRITE_THRESHOLD_MS` in `lib/station\\.js`\\)'));
});
