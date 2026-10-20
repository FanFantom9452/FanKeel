'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { redact } = require('../lib/sensitive.js');

const KEY = 'sk-ant-' + 'x'.repeat(24);

test('redact masks a key shape and a listed word in every string, and leaves keys and numbers alone', () => {
    const counts = {};
    const out = redact({ a: 'use ' + KEY + ' now', b: [{ c: 'Trovara ships' }], n: 3, ok: true, sk: 'plain' }, ['trovara'], counts);
    assert.equal(out.a, 'use [REDACTED:key] now');
    assert.equal(out.b[0].c, '[REDACTED:word] ships');
    assert.equal(out.n, 3);
    assert.equal(out.ok, true);
    assert.equal(out.sk, 'plain');
    assert.deepEqual(counts, { key: 1, word: 1 });
});

test('a listed word with regex characters is matched literally', () => {
    const out = redact('a.b and axb', ['a.b'], {});
    assert.equal(out, '[REDACTED:word] and axb');
});

test('a private key block is masked whole', () => {
    const block = '-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----';
    assert.equal(redact('x ' + block + ' y', [], {}), 'x [REDACTED:private-key] y');
});
