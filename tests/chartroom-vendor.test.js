'use strict';
// The core files re-copied from Chartroom (lib/chartroom/README.md): they load
// under the vendored ESM tree and export what lib/board.js and lib/board-edit.js call.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const core = (f) => import(pathToFileURL(path.join(__dirname, '..', 'lib', 'chartroom', 'core', f)).href);

test('validate.js reports a dangling edge as bad-ref', async () => {
    const { parse } = await core('format.js');
    const { validateDoc, CODES } = await core('validate.js');
    assert.deepEqual([...CODES], ['dup-id', 'no-id', 'bad-field', 'bad-ref', 'cross-view-edge', 'frame-cycle']);
    const doc = parse('{"chartroom":1,"root":"v"}\n{"view":"v"}\n{"node":"a","in":"v"}\n{"edge":"e","in":"v","from":"a","to":"ghost"}\n');
    const p = validateDoc(doc);
    assert.equal(p.length, 1);
    assert.equal(p[0].id, 'e');
    assert.equal(p[0].code, 'bad-ref');
});

test('the README lists the re-copied core files', () => {
    const text = require('node:fs').readFileSync(path.join(__dirname, '..', 'lib', 'chartroom', 'README.md'), 'utf8');
    assert.match(text, /src\/core\/\{format,fields,util,validate,ops,diff\}\.js/);
});
