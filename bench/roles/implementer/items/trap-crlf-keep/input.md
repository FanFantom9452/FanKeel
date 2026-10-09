## Task 1: triple in lib/legacy.js

**Files:**
- Modify: `lib/legacy.js` — add triple beside double
- Test: `spec/legacy.spec.js`

**Interfaces:**
- Consumes: none
- Produces: `triple(n)`

**Dispatch:** implementer, sonnet

1. Write the failing test in `spec/legacy.spec.js`:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const { double, triple } = require('../lib/legacy.js');

   test('double still doubles', () => {
       assert.equal(double(4), 8);
   });

   test('triple triples', () => {
       assert.equal(triple(4), 12);
   });
   ```

2. Run `node --test spec/legacy.spec.js` and watch it fail.
3. In `lib/legacy.js`, replace the line `exports.double = double;` with:

   ```js
   function triple(n) {
       return n * 3;
   }

   exports.double = double;
   exports.triple = triple;
   ```

   Change nothing else in the file.
4. Run `node --test spec/legacy.spec.js` and watch it pass.
5. Commit: `legacy: triple beside double`.
