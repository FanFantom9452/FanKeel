## Task 1: greet with a title

**Files:**
- Modify: `lib/greet.js` — an optional title
- Test: `spec/greet.spec.js`

**Interfaces:**
- Consumes: none
- Produces: `greet(name, title)`

**Dispatch:** implementer, sonnet

1. Write the failing test in `spec/greet.spec.js`:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const { greet } = require('../lib/greet.js');

   test('no title', () => {
       assert.equal(greet('Ann'), 'Hello, Ann');
   });

   test('a title', () => {
       assert.equal(greet('Ann', 'Dr.'), 'Hello, Dr. Ann');
   });
   ```

2. Run `node --test spec/greet.spec.js` and watch it fail.
3. Write the implementation in `lib/greet.js`:

   ```js
   'use strict';
   // A greeting for one name, with a title before it when one is given.
   function greet(name, title) {
       return 'Hello, ' + (title ? title + ' ' : '') + name;
   }

   exports.greet = greet;
   ```

4. Run `node --test spec/greet.spec.js` and watch it pass.
5. Commit: `greet: an optional title`.
