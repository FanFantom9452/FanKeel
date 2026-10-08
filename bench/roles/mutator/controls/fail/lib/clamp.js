'use strict';
// Clamps n into [lo, hi].
function clamp(n, lo, hi) {
    if (n < lo) return lo;
    if (n < hi) return hi;
    return n;
}

exports.clamp = clamp;
