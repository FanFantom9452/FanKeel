'use strict';
// Counts the calls made to it.
let count = 0;
function tick() {
    count++;
    return count;
}

exports.tick = tick;
