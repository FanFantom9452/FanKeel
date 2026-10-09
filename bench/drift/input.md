## Task 1: format() in place of oldFormat()

**Files:**
- Modify: `lib/invoice.js` — call `format` in place of `oldFormat`
- Test: `spec/invoice.spec.js` — the expected string
- Modify: `lib/receipt.js` — the same
- Test: `spec/receipt.spec.js` — the same
- Modify: `lib/refund.js` — the same
- Test: `spec/refund.spec.js` — the same
- Modify: `lib/quote.js` — the same
- Test: `spec/quote.spec.js` — the same
- Modify: `lib/ledger.js` — the same
- Test: `spec/ledger.spec.js` — the same
- Modify: `lib/payout.js` — the same
- Test: `spec/payout.spec.js` — the same
- Modify: `lib/tax.js` — the same
- Test: `spec/tax.spec.js` — the same
- Modify: `lib/discount.js` — the same
- Test: `spec/discount.spec.js` — the same

**Interfaces:**
- Consumes: `format(n, opts)` from `lib/format.js`. It returns the amount with `digits` decimals (2 by default), then a space and `currency` (TWD by default). A negative amount gets a leading `-`, or is wrapped in parentheses when `negative` is `'paren'`.
- Produces: none

**Dispatch:** implementer, sonnet

Each of the eight modules under `lib/` still calls the deprecated `oldFormat(n, style)` from `lib/legacy/format.js`, and each one calls it differently: its own argument expression and, in some modules, a style. The legacy styles mean:

- no style: a `$` sign and two decimals. That is currency `USD` in `format`.
- `'eur'`: a `€` sign and two decimals. That is currency `EUR`.
- `'paren'`: a negative amount in parentheses, with a `$` sign. That is currency `USD` with `negative: 'paren'`.
- `'int'`: the amount rounded to a whole number, with a `$` sign. That is currency `USD` with `digits: 0`.

Open each module and its spec to see which expression and style it uses; the same legacy style can mean a different expression in another module. Move the eight modules one at a time, in the order listed above. For each module `<m>`:

1. In `spec/<m>.spec.js`, change the expected string to the output the new `format` call will give for the same input.
2. Run `node --test spec/<m>.spec.js` and watch it fail.
3. In `lib/<m>.js`, replace the `oldFormat` require with `format`, and the call with the `format` call that gives that output.
4. Run `node --test spec/<m>.spec.js` and watch it pass.
5. Commit the module and its spec together, one commit per module.

Leave `lib/legacy/format.js` where it is; it is retired in a later task.
