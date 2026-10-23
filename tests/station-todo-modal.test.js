'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SRC } = require('./station-src.js');

test('1 to 4 do not answer a held gate behind an open dialog', () => {
    const at = SRC.indexOf("// 1–4 pick an option of the first held gate");
    const body = SRC.slice(at, SRC.indexOf('\n    });', at));
    const guard = body.indexOf("querySelector('dialog[open]')");
    assert.ok(guard > -1 && guard < body.indexOf('.click()'), 'the handler returns while a dialog is open, before it clicks');
});
