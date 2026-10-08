#!/usr/bin/env bash
# Prints spec/range.spec.js for one seed: the bounds move with the seed, so
# the second and third runs do not repeat the first one's numbers.
set -eu
seed="$1"
a=$(( seed % 5 + 1 ))
b=$(( a + 3 + seed % 4 ))
sum=$(( (a + b) * (b - a + 1) / 2 ))
cat <<EOF
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { sumRange } = require('../lib/range.js');

test('sumRange adds every integer from a to b inclusive', () => {
    assert.equal(sumRange($a, $b), $sum);
});

test('sumRange of one number is that number', () => {
    assert.equal(sumRange($b, $b), $b);
});
EOF
