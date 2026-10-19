'use strict';
// The cost of every break in a conversation (lib/conversation.js spendOf):
// each compaction, and each request that wrote the cache again after an hour
// away, with the context the request after it sent, its cache-write dollars
// and every request up to the next break. Head plus every segment is the
// main transcript's own total, priced by lib/prices.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const usage = require('../lib/usage.js');
const prices = require('../lib/prices.js');
const conversation = require('../lib/conversation.js');
const tmp = require('./tmp.js');

const T = (h, m) => new Date(2026, 9, 14, h, m).toISOString();
const ask = (text, h, m) => ({ type: 'user', timestamp: T(h, m), message: { role: 'user', content: text } });
const use = (input, output, read, w1h) => ({ input_tokens: input, output_tokens: output, cache_read_input_tokens: read,
    cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: w1h } });
const req = (id, h, m, u, model) => ({ type: 'assistant', requestId: id, timestamp: T(h, m),
    message: { id: 'msg_' + id, model: model || 'claude-opus-5-5', content: [{ type: 'text', text: 'ok ' + id }], usage: u } });
const LINES = [
    ask('開始', 10, 0),
    req('r1', 10, 1, use(10, 100, 0, 20000)),
    req('r2', 10, 5, use(5, 50, 20000, 1000)),
    { type: 'system', subtype: 'compact_boundary', timestamp: T(10, 10), compactMetadata: { trigger: 'auto', preTokens: 21000 } },
    { type: 'user', timestamp: T(10, 10), isCompactSummary: true, message: { role: 'user', content: 'Summary' } },
    req('r3', 10, 11, use(0, 200, 0, 8000)),
    ask('回來了', 11, 29),
    // 79 minutes after r3, and it writes more than it reads: the 1h cache expired.
    req('r4', 11, 30, use(0, 300, 0, 9000)),
    req('r5', 11, 31, use(0, 40, 9000, 500)),
    // 89 minutes after r5, but it reads more than it writes: the cache held.
    req('r6', 13, 0, use(0, 60, 9500, 300)),
];
const jsonl = (lines) => lines.map((l) => JSON.stringify(l) + '\n').join('');
const R = prices.perMillion['claude-opus-5-5'];
const cost = (u) => (u.input_tokens * R.input + u.output_tokens * R.output + u.cache_read_input_tokens * R.cacheRead
    + u.cache_creation.ephemeral_1h_input_tokens * R.cacheWrite1h) / 1e6;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' vs ' + b);

function transcript(lines) {
    const file = path.join(tmp('fankeel-conv-spend-'), 'ffffffff-6666-4666-8666-666666666666.jsonl');
    fs.writeFileSync(file, jsonl(lines || LINES));
    return file;
}
const spendOf = (file) => conversation.spendOf(usage.entriesOf(file), usage.summarise(file, { series: true }));

test('a compaction and a rewrite after an hour away are breaks; an hour gap whose cache was still read is not', () => {
    const sp = spendOf(transcript());
    assert.deepEqual(sp.marks.map((m) => [m.kind, m.trigger, m.n, m.context]), [['compact', 'auto', 3, 8000], ['expiry', 'away', 4, 9000]]);
    near(sp.marks[0].writeUsd, 8000 * R.cacheWrite1h / 1e6);
    near(sp.marks[1].writeUsd, 9000 * R.cacheWrite1h / 1e6);
    near(sp.head, cost(LINES[1].message.usage) + cost(LINES[2].message.usage));
    near(sp.marks[0].usd, cost(LINES[5].message.usage));
    near(sp.marks[1].usd, cost(LINES[7].message.usage) + cost(LINES[8].message.usage) + cost(LINES[9].message.usage));
    assert.equal(sp.marks[0].at, T(10, 10));
    assert.equal(sp.marks[1].at, T(11, 30));
});

test('head plus every segment is the session total lib/usage.js and lib/prices.js give', () => {
    const file = transcript();
    const seen = usage.summarise(file, { series: true });
    const sp = conversation.spendOf(usage.entriesOf(file), seen);
    near(sp.total, sp.head + sp.marks.reduce((n, m) => n + m.usd, 0));
    near(sp.sessionUsd, prices.costOf(seen.usage.models).usd);
    near(sp.total, sp.sessionUsd);
});

test('a compaction with no request after it is a break with no context and no dollars', () => {
    const sp = spendOf(transcript(LINES.slice(0, 5)));
    assert.deepEqual(sp.marks.map((m) => [m.kind, m.n, m.context, m.usd, m.writeUsd]), [['compact', null, null, 0, 0]]);
    near(sp.total, sp.sessionUsd);
});

test('a series row names the price row it is billed at: a Haiku 5.5 request over 100K tokens', () => {
    const file = transcript([req('h1', 10, 1, use(0, 10, 150000, 0), 'claude-haiku-5-5'), req('h2', 10, 2, use(0, 10, 1000, 0), 'claude-haiku-5-5')]);
    const seen = usage.summarise(file, { series: true });
    assert.deepEqual(seen.series.map((r) => [r.model, r.billed]), [['claude-haiku-5-5', 'claude-haiku-5-5>100k'], ['claude-haiku-5-5', 'claude-haiku-5-5']]);
    near(conversation.spendOf(usage.entriesOf(file), seen).total, prices.costOf(seen.usage.models).usd);
});

test('pageOf carries the breaks a read holds, and null when it holds none', () => {
    const file = transcript();
    const read = conversation.turnsOf(usage.entriesOf(file));
    assert.equal(conversation.pageOf(read, 0, 100).spend, null);
    read.spend = spendOf(file);
    assert.deepEqual(conversation.pageOf(read, 0, 100).spend, read.spend);
});

const compact = (h, m) => [
    { type: 'system', subtype: 'compact_boundary', timestamp: T(h, m), compactMetadata: { trigger: 'manual', preTokens: 21000 } },
    { type: 'user', timestamp: T(h, m), isCompactSummary: true, message: { role: 'user', content: 'Summary' } },
];

test('a request after a compaction that is also an hour later and writes more than it reads is one compact break, not an expiry too', () => {
    const sp = spendOf(transcript([
        ask('開始', 10, 0),
        req('r1', 10, 1, use(10, 100, 0, 20000)),
        req('r2', 10, 5, use(5, 50, 20000, 1000)),
        ...compact(10, 10),
        // 85 minutes after r2 and it writes more than it reads, but the compaction already explains the rewrite.
        req('r3', 11, 30, use(0, 200, 0, 8000)),
    ]));
    assert.deepEqual(sp.marks.map((m) => [m.kind, m.n]), [['compact', 3]]);
    near(sp.total, sp.head + sp.marks.reduce((n, m) => n + m.usd, 0));
    near(sp.total, sp.sessionUsd);
});

test('an expiry before a later compaction comes first, and head plus every segment is still the session total', () => {
    const sp = spendOf(transcript([
        ask('開始', 10, 0),
        req('r1', 10, 1, use(10, 100, 0, 20000)),
        req('r2', 11, 30, use(0, 300, 0, 9000)),
        req('r3', 11, 31, use(0, 40, 9000, 500)),
        ...compact(11, 40),
        req('r4', 11, 41, use(0, 200, 0, 8000)),
    ]));
    assert.deepEqual(sp.marks.map((m) => [m.kind, m.n]), [['expiry', 2], ['compact', 4]]);
    near(sp.marks[0].usd, cost(use(0, 300, 0, 9000)) + cost(use(0, 40, 9000, 500)));
    near(sp.total, sp.head + sp.marks.reduce((n, m) => n + m.usd, 0));
    near(sp.total, sp.sessionUsd);
});

test('two compactions with no request between them: the first carries no dollars and the total holds', () => {
    const sp = spendOf(transcript([
        ask('開始', 10, 0),
        req('r1', 10, 1, use(10, 100, 0, 20000)),
        ...compact(10, 10),
        ...compact(10, 20),
        req('r2', 10, 21, use(0, 200, 0, 8000)),
    ]));
    assert.deepEqual(sp.marks.map((m) => [m.kind, m.n, m.at]), [['compact', 2, T(10, 10)], ['compact', 2, T(10, 20)]]);
    assert.equal(sp.marks[0].usd, 0);
    near(sp.marks[1].usd, cost(use(0, 200, 0, 8000)));
    near(sp.total, sp.head + sp.marks.reduce((n, m) => n + m.usd, 0));
    near(sp.total, sp.sessionUsd);
});
