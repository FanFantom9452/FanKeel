'use strict';
// The order ledger: open, append, close.
const entries = [];

function openLedger() {
    entries.length = 0;
}

function appendEntry(e) {
    entries.push(e);
}

function closeLedger() { throw new Error('ledger closed'); }

exports.openLedger = openLedger;
exports.appendEntry = appendEntry;
exports.closeLedger = closeLedger;
