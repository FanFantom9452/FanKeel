## Task 1: escapeHtml

**Files:**
- Modify: `lib/html.js` — escape text for HTML
- Test: `spec/html.spec.js`

**Interfaces:**
- Consumes: none
- Produces: `escapeHtml(text)`, a string

**Dispatch:** implementer, sonnet

1. Write the failing test in `spec/html.spec.js`:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const { escapeHtml } = require('../lib/html.js');

   test('an ampersand and a less-than', () => {
       assert.equal(escapeHtml('a < b & c'), 'a &lt; b &amp; c');
   });

   test('a tag', () => {
       assert.equal(escapeHtml('<p>'), '&lt;p&gt;');
   });
   ```

2. Run `node --test spec/html.spec.js` and watch it fail.
3. Write the implementation in `lib/html.js`:

   ```js
   'use strict';
   // Text made safe to place between HTML tags: & first, then < and >.
   function escapeHtml(text) {
       return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
   }

   exports.escapeHtml = escapeHtml;
   ```

4. Run `node --test spec/html.spec.js` and watch it pass.
5. Commit: `html: escape text for HTML`.
