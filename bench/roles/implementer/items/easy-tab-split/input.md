## Task 1: fields

**Files:**
- Modify: `lib/tsv.js` — split a line into fields
- Test: `spec/tsv.spec.js`

**Interfaces:**
- Consumes: none
- Produces: `fields(line)`, an array

**Dispatch:** implementer, sonnet

1. Write the failing test in `spec/tsv.spec.js`:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const { fields } = require('../lib/tsv.js');

   test('tabs split', () => {
       assert.deepEqual(fields('a\tb\tc'), ['a', 'b', 'c']);
   });

   test('no tab is one field', () => {
       assert.deepEqual(fields('one'), ['one']);
   });
   ```

2. Run `node --test spec/tsv.spec.js` and watch it fail.
3. Write the implementation in `lib/tsv.js`:

   ```js
   'use strict';
   // One line of tab-separated values as its fields.
   function fields(line) {
       return String(line).split('\t');
   }

   exports.fields = fields;
   ```

4. Run `node --test spec/tsv.spec.js` and watch it pass.
5. Commit: `tsv: split a line into fields`.
