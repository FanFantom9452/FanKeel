'use strict';
// lib/json.js: readObject reads a JSON file whose absence or damage is not an
// error, and answers null for anything but a plain object.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readObject, readText } = require('../lib/json.js');
const tmp = require('./tmp.js');

test('a file holding a JSON object reads as that object', () => {
    const dir = tmp('fankeel-json-');
    const file = path.join(dir, 'a.json');
    fs.writeFileSync(file, '{"port":7817,"src":["a.js"]}');
    assert.deepEqual(readObject(file), { port: 7817, src: ['a.js'] });
});

test('no file, a directory and bytes that do not parse all read as null', () => {
    const dir = tmp('fankeel-json-');
    const bad = path.join(dir, 'bad.json');
    fs.writeFileSync(bad, '{"port":');
    assert.equal(readObject(path.join(dir, 'missing.json')), null);
    assert.equal(readObject(dir), null);
    assert.equal(readObject(bad), null);
});

test('JSON that parses to anything but a plain object reads as null', () => {
    const dir = tmp('fankeel-json-');
    for (const [name, body] of [['arr', '[1,2]'], ['nul', 'null'], ['num', '7'], ['str', '"x"'], ['yes', 'true']]) {
        const file = path.join(dir, name + '.json');
        fs.writeFileSync(file, body);
        assert.equal(readObject(file), null, name);
    }
});

test('a leading byte-order mark is dropped before parsing', () => {
    const dir = tmp('fankeel-json-');
    const file = path.join(dir, 'bom.json');
    fs.writeFileSync(file, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{"a":1}')]));
    assert.deepEqual(readObject(file), { a: 1 });
});

test('readText gives a file\'s UTF-8 text, and null when it cannot be read', () => {
    const dir = tmp('fankeel-json-');
    const file = path.join(dir, 'a.md');
    fs.writeFileSync(file, 'héllo\n');
    assert.equal(readText(file), 'héllo\n');
    assert.equal(readText(path.join(dir, 'missing.md')), null);
    assert.equal(readText(dir), null);
});
