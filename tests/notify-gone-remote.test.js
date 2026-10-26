'use strict';
// notify-1: the 手機遠端 card has no ntfy triggers or topic, and the
// stylesheet keeps no rule for them.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', name), 'utf8');

test('remote-card.js draws no trigger and names no ntfy', () => {
    assert.doesNotMatch(read('remote-card.js'), /ntfy|data-rm="trigger"|notify\./i);
});

test('station.css has no rule for the trigger row or the topic', () => {
    assert.doesNotMatch(read('station.css'), /\.rm-(?:trg|topic)\b/);
});
