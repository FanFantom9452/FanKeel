## Task 1: countWords

**Files:**
- Modify: `lib/words.js` — count the words of a line
- Test: `spec/words.spec.js`

**Interfaces:**
- Consumes: none
- Produces: `countWords(text)`, a number

**Dispatch:** implementer, sonnet

1. Write the failing test in `spec/words.spec.js`:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const { countWords } = require('../lib/words.js');

   test('three words make three', () => {
       assert.equal(countWords('one two three'), 3);
   });

   test('spaces and tabs add no words', () => {
       assert.equal(countWords('  one \t two '), 2);
   });
   ```

2. Run `node --test spec/words.spec.js` and watch it fail.
3. Write the implementation in `lib/words.js`:

   ```js
   'use strict';
   // How many words a line holds: runs of anything but whitespace.
   function countWords(text) {
       return String(text).trim().split(/\s+/).filter(Boolean).length;
   }

   exports.countWords = countWords;
   ```

4. Run `node --test spec/words.spec.js` and watch it pass.
5. Commit: `words: count the words of a line`.
