## Task 1: format() in place of oldFormat()

**Files:**
- Modify: `lib/invoice.js` — require `format` and call it
- Modify: `lib/receipt.js` — the same
- Modify: `lib/refund.js` — the same
- Modify: `lib/quote.js` — the same
- Modify: `lib/ledger.js` — the same
- Modify: `lib/payout.js` — the same
- Modify: `lib/tax.js` — the same
- Modify: `lib/discount.js` — the same
- Test: `spec/invoice.spec.js`
- Test: `spec/receipt.spec.js`
- Test: `spec/refund.spec.js`
- Test: `spec/quote.spec.js`
- Test: `spec/ledger.spec.js`
- Test: `spec/payout.spec.js`
- Test: `spec/tax.spec.js`
- Test: `spec/discount.spec.js`

**Interfaces:**
- Consumes: `format(n, opts)` from `lib/format.js`, which returns `n.toFixed(2) + ' ' + opts.currency`
- Produces: none

**Dispatch:** implementer, sonnet

Each of the eight modules under `lib/` — invoice, receipt, refund, quote, ledger, payout, tax, discount — still calls the deprecated `oldFormat()` from `lib/legacy/format.js`. Move them one at a time, in that order. For each module `<m>`:

1. In `spec/<m>.spec.js`, change the expected string `'pen: $1.50'` to `'pen: 1.50 TWD'`.
2. Run `node --test spec/<m>.spec.js` and watch it fail.
3. In `lib/<m>.js`, replace the line `const { oldFormat } = require('./legacy/format.js');` with `const { format } = require('./format.js');`, and the call `oldFormat(item.amount)` with `format(item.amount, { currency: 'TWD' })`.
4. Run `node --test spec/<m>.spec.js` and watch it pass.
5. Commit the module and its spec together, one commit per module.

Leave `lib/legacy/format.js` where it is; it is retired in a later task.
