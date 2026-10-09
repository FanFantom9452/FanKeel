## Task 1: priceLabel

**Files:**
- Modify: `lib/price.js` — the till's label for a price
- Test: `spec/price.spec.js`

**Interfaces:**
- Consumes: none
- Produces: `priceLabel(n)`, a string

**Dispatch:** implementer, sonnet

1. Write the failing test in `spec/price.spec.js`:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const { priceLabel } = require('../lib/price.js');

   test('five', () => {
       assert.equal(priceLabel(5), 'NT$5.00');
   });

   test('twelve and a half', () => {
       assert.equal(priceLabel(12.5), 'NT$12.50');
   });
   ```

2. Run `node --test spec/price.spec.js` and watch it fail.
3. Write the implementation in `lib/price.js`:

   ```js
   'use strict';
   // A price as the till prints it: NT$ and two decimals.
   function priceLabel(n) {
       return `NT$${n.toFixed(2)}`;
   }

   exports.priceLabel = priceLabel;
   ```

4. Run `node --test spec/price.spec.js` and watch it pass.
5. Commit: `price: the till's label`.
