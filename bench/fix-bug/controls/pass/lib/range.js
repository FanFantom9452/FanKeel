'use strict';
// The sum of every integer from a to b inclusive.
function sumRange(a, b) {
    let s = 0;
    for (let i = a; i <= b; i++) s += i;
    return s;
}

exports.sumRange = sumRange;
