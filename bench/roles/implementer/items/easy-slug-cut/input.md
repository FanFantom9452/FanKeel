## Task 1: maxLength in slugify

**Files:**
- Modify: `lib/slug.js` — read `opts.maxLength` and cut the slug
- Test: `spec/truncate.spec.js`

**Interfaces:**
- Consumes: none
- Produces: `slugify(text, opts)`, where `opts.maxLength` is an optional positive integer

**Dispatch:** implementer, haiku

1. Write the failing test in `spec/truncate.spec.js`:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const { slugify } = require('../lib/slug.js');

   test('maxLength cuts at the last whole word that fits', () => {
       assert.equal(slugify('Hello World Again', { maxLength: 13 }), 'hello-world');
   });

   test('a first word longer than maxLength is cut inside it', () => {
       assert.equal(slugify('Supercalifragilistic day', { maxLength: 5 }), 'super');
   });
   ```

2. Run `npm test` and watch the first new test fail.
3. Write the implementation in `lib/slug.js`:

   ```js
   'use strict';
   // A URL slug: lower case, runs of anything but a-z and 0-9 become one hyphen,
   // and no hyphen at either end. With `maxLength`, at most that many characters,
   // cut at the last whole word that fits; a first word longer than that is cut
   // inside the word.
   function slugify(text, opts) {
       const slug = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
       const max = opts && opts.maxLength;
       if (!max || slug.length <= max) return slug;
       const head = slug.slice(0, max);
       if (slug[max] === '-') return head;
       const at = head.lastIndexOf('-');
       return at > 0 ? head.slice(0, at) : head;
   }

   exports.slugify = slugify;
   ```

4. Run `npm test` and watch every test pass.
5. Commit: `slug: maxLength cuts at a word boundary`.

