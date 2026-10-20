'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const tmp = require('./tmp.js');
const bundle = require('../lib/bundle.js');

const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const KEY = 'sk-ant-' + 'x'.repeat(24);

function seed() {
    const cfg = tmp('fankeel-bundle-');
    const dir = path.join(cfg, 'projects', 'p');
    fs.mkdirSync(path.join(dir, A, 'subagents'), { recursive: true });
    fs.writeFileSync(path.join(dir, A + '.jsonl'), [
        JSON.stringify({ type: 'user', message: { role: 'user', content: 'my key is ' + KEY } }),
        '{"torn',
        JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } }] } }),
    ].join('\n') + '\n');
    fs.writeFileSync(path.join(dir, A, 'subagents', 'agent-x.jsonl'), JSON.stringify({ type: 'user', message: { role: 'user', content: 'Trovara' } }) + '\n');
    return cfg;
}

test('filesOf names the main transcript first, then each subagent', () => {
    const files = bundle.filesOf(seed(), A);
    assert.deepEqual(files.map((f) => f.rel), [A + '.jsonl', A + '/subagents/agent-x.jsonl']);
});

test('pack masks every string, and unpack gives back every parsed line by part', () => {
    const cfg = seed();
    const counts = {};
    const gz = bundle.pack([A], bundle.filesOf(cfg, A), ['trovara'], counts);
    const text = zlib.gunzipSync(gz).toString('utf8');
    assert.ok(!text.includes(KEY), 'the key survived');
    assert.ok(text.includes('[REDACTED:key]'));
    assert.deepEqual(counts, { key: 1, word: 1 });
    const { head, parts } = bundle.unpack(gz);
    assert.deepEqual(head.sessions, [A]);
    assert.deepEqual(head.redacted, { key: 1, word: 1 });
    assert.equal(parts.get(A + '.jsonl').length, 2);
    assert.equal(parts.get(A + '/subagents/agent-x.jsonl')[0].message.content, '[REDACTED:word]');
    assert.ok(text.includes('"raw":"{\\"torn"'), 'a torn line is kept as raw text');
});

test('filesOf of an unknown session is empty', () => {
    assert.deepEqual(bundle.filesOf(seed(), 'bbbbbbbb-0000-0000-0000-000000000000'), []);
});
