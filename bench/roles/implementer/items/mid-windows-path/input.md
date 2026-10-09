## Task 1: toWindows and toPosix

**Files:**
- Modify: `lib/winpath.js` — slashes both ways
- Test: `spec/winpath.spec.js`

**Interfaces:**
- Consumes: none
- Produces: `toWindows(p)`, `toPosix(p)`

**Dispatch:** implementer, sonnet

1. Write the failing test in `spec/winpath.spec.js`:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const { toWindows, toPosix } = require('../lib/winpath.js');

   test('to Windows', () => {
       assert.equal(toWindows('a/b/c'), 'a\\b\\c');
   });

   test('back', () => {
       assert.equal(toPosix('C:\\x\\y'), 'C:/x/y');
   });
   ```

2. Run `node --test spec/winpath.spec.js` and watch it fail.
3. Write the implementation in `lib/winpath.js`:

   ```js
   'use strict';
   // A path with forward slashes written the Windows way, and back.
   function toWindows(p) {
       return p.split('/').join('\\');
   }

   function toPosix(p) {
       return p.split('\\').join('/');
   }

   exports.toWindows = toWindows;
   exports.toPosix = toPosix;
   ```

4. Run `node --test spec/winpath.spec.js` and watch it pass.
5. Commit: `winpath: slashes both ways`.
