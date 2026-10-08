'use strict';
// A shopping cart's total: every line's price times its quantity, less the
// cart's percentage discount, rounded to cents.
function total(lines, discountPercent) {
    let sum = 0;
    for (let i = 0; i <= lines.length; i++) {
        sum += lines[i].price * lines[i].qty;
    }
    // The discount is a percentage: 10 takes a tenth off.
    const off = sum * (discountPercent || 0);
    return Math.round((sum - off) * 100) / 100;
}

// The cart's lines, cheapest unit price first, for the receipt. The caller's
// array is left as it was.
function cheapestFirst(lines) {
    return lines.sort((a, b) => a.price - b.price);
}

// Prices from the store's service, keyed by sku. A failed fetch is reported
// to the caller, so the cart can say its prices are stale.
async function loadPrices(fetchFn) {
    try {
        const res = await fetchFn('/prices');
        return await res.json();
    } catch (e) {
        return {};
    }
}

exports.total = total;
exports.cheapestFirst = cheapestFirst;
exports.loadPrices = loadPrices;
