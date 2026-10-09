'use strict';
// Ten percent off an order over 100.
function discounted(total) {
    if (total >= 100) return total * 0.9;
    return total;
}

exports.discounted = discounted;
