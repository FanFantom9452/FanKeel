'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'float.js'), 'utf8');

test('drawFloat reads #fkp scrollTop before the rebuild and writes it back after', () => {
    const at = SRC.indexOf('function drawFloat(');
    const open = SRC.indexOf('{', SRC.indexOf(')', at));
    let depth = 0, end = -1;
    for (let i = open; i < SRC.length && end < 0; i++) {
        if (SRC[i] === '{') depth++;
        else if (SRC[i] === '}' && --depth === 0) end = i + 1;
    }
    assert.ok(end > open, 'drawFloat body has a balanced end');
    const body = SRC.slice(at, end);
    const read = body.search(/getElementById\('fkp'\)[\s\S]*?scrollTop/);
    const write = body.indexOf('fk.innerHTML');
    assert.ok(read > -1 && read < write, 'scrollTop is read before innerHTML is replaced');
    assert.match(body.slice(write), /scrollTop\s*=/);
});
