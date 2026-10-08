'use strict';
// The whole numbers from 1 to n.
function range(n) {
    const out = [];
    for (let i = 1; i <= n; i++) out.push(i);
    return out;
}

exports.range = range;
