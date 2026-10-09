## Task 1: toLine and fromLines

**Files:**
- Modify: `lib/jsonl.js` — one record per line, and back
- Test: `spec/jsonl.spec.js`

**Interfaces:**
- Consumes: none
- Produces: `toLine(record)`, `fromLines(text)`

**Dispatch:** implementer, sonnet

1. Write the failing test in `spec/jsonl.spec.js`:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const { toLine, fromLines } = require('../lib/jsonl.js');

   test('one line per record', () => {
       assert.equal(toLine({ a: 1 }), '{"a":1}\n');
   });

   test('lines back to records', () => {
       assert.deepEqual(fromLines('{"a":1}\n{"b":2}\n'), [{ a: 1 }, { b: 2 }]);
   });
   ```

2. Run `node --test spec/jsonl.spec.js` and watch it fail.
3. Write the implementation in `lib/jsonl.js`:

   ```js
   'use strict';
   // One record as a JSON Lines line, and a block of lines back as records.
   function toLine(record) {
       return JSON.stringify(record) + '\n';
   }

   function fromLines(text) {
       return text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
   }

   exports.toLine = toLine;
   exports.fromLines = fromLines;
   ```

4. Run `node --test spec/jsonl.spec.js` and watch it pass.
5. Commit: `jsonl: one record per line`.
