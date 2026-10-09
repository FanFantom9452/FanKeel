## Task 1: trimDots

**Files:**
- Modify: `lib/dots.js` — trim the trailing dots
- Test: `spec/dots.spec.js`

**Interfaces:**
- Consumes: none
- Produces: `trimDots(text)`, a string

**Dispatch:** implementer, sonnet

1. Write the failing test in `spec/dots.spec.js`:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const { trimDots } = require('../lib/dots.js');

   test('trailing dots go', () => {
       assert.equal(trimDots('wait...'), 'wait');
   });

   test('a dot inside stays', () => {
       assert.equal(trimDots('a.b'), 'a.b');
   });
   ```

2. Run `node --test spec/dots.spec.js` and watch it fail.
3. Write the implementation in `lib/dots.js`:

   ```js
   'use strict';
   // A sentence without the dots it trails off with.
   function trimDots(text) {
       return String(text).replace(/\.+$/, '');
   }

   exports.trimDots = trimDots;
   ```

4. Run `node --test spec/dots.spec.js` and watch it pass.
5. Commit: `dots: trim trailing dots`.
