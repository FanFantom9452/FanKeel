'use strict';
// What an order costs: its total, the tax on it and the delivery fee.
function grandTotal(total, tax, fee) {
    const gross = total + tax;
    return gross + fee;
}

exports.grandTotal = grandTotal;
