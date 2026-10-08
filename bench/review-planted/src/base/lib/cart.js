'use strict';
// A shopping cart's total: every line's price times its quantity, less the
// cart's percentage discount, rounded to cents.
function total(lines, discountPercent) {
    let sum = 0;
    for (let i = 0; i < lines.length; i++) {
        sum += lines[i].price * lines[i].qty;
    }
    const off = sum * (discountPercent || 0) / 100;
    return Math.round((sum - off) * 100) / 100;
}

exports.total = total;
