## Task 1: parse

**Files:**
- Modify: `lib/semver.js` — parse a version string
- Test: `spec/semver.spec.js`

**Interfaces:**
- Consumes: none
- Produces: `parse(v)`, `{ major, minor, patch, pre }` or null

**Dispatch:** implementer, sonnet

1. Write the failing test in `spec/semver.spec.js`:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const { parse } = require('../lib/semver.js');

   test('plain', () => {
       assert.deepEqual(parse('1.2.3'), { major: 1, minor: 2, patch: 3, pre: null });
   });

   test('prerelease', () => {
       assert.equal(parse('10.0.1-rc.1').pre, 'rc.1');
   });

   test('two parts', () => {
       assert.equal(parse('1.2'), null);
   });

   test('dots are dots', () => {
       assert.equal(parse('1x2x3'), null);
   });
   ```

2. Run `node --test spec/semver.spec.js` and watch it fail.
3. Write the implementation in `lib/semver.js`:

   ```js
   'use strict';
   // A version string's parts: major.minor.patch and an optional -prerelease.
   const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?$/;

   function parse(v) {
       const m = SEMVER.exec(String(v));
       if (!m) return null;
       return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre: m[4] || null };
   }

   exports.parse = parse;
   ```

4. Run `node --test spec/semver.spec.js` and watch it pass.
5. Commit: `semver: parse a version string`.
