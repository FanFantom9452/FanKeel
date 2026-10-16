'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');

test('drawFloat reads #fkp scrollTop before the rebuild and writes it back after', () => {
    const at = SRC.indexOf('function drawFloat(');
    const body = SRC.slice(at, SRC.indexOf('\n    function ', at + 1));
    const read = body.search(/getElementById\('fkp'\)[\s\S]*?scrollTop/);
    const write = body.indexOf('fk.innerHTML');
    assert.ok(read > -1 && read < write, 'scrollTop is read before innerHTML is replaced');
    assert.match(body.slice(write), /scrollTop\s*=/);
});
