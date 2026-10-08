## Task 1: money

**Files:**
- Modify: `lib/money.js` — a dollar amount and back
- Test: `spec/money.spec.js`

**Interfaces:**
- Consumes: none
- Produces: `money(n)`, `parseMoney(text)`

**Dispatch:** implementer, sonnet

1. Write the failing test in `spec/money.spec.js`:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const { money, parseMoney } = require('../lib/money.js');

   test('one and a half', () => {
       assert.equal(money(1.5), '$1.50');
   });

   test('back to a number', () => {
       assert.equal(parseMoney('$2.25'), 2.25);
   });
   ```

2. Run `node --test spec/money.spec.js` and watch it fail.
3. Write the implementation in `lib/money.js`:

   ```js
   'use strict';
   // An amount in dollars. The sign is the string '$' — never $'...', which is
   // bash's quoting, not JavaScript's.
   const SIGN = '$';

   function money(n) {
       return SIGN + n.toFixed(2);
   }

   function parseMoney(text) {
       return Number(String(text).replace(/^\$/, ''));
   }

   exports.money = money;
   exports.parseMoney = parseMoney;
   ```

4. Run `node --test spec/money.spec.js` and watch it pass.
5. Commit: `money: a dollar amount and back`.
