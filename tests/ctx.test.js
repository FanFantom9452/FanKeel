'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ctx = require('../scripts/ctx.js');
const tmp = require('./tmp.js');

const line = (o) => JSON.stringify(o) + '\n';
const assistant = (requestId, usage, content) => line({
    type: 'assistant', requestId, timestamp: '2026-09-21T00:00:00.000Z',
    message: { model: 'claude-sonnet-5', usage, content: content || [] },
});

// Three requests, counted by hand. A request's context is input + cache read +
// cache write:  r1 10 + 1000 + 500 = 1510   r2 20 + 3000 = 3020   r3 30 + 2000 + 100 = 2130.
// r2 is written on two lines, as a real response is, and it asks a question.
function session(dir, name) {
    const file = path.join(dir, name || 's.jsonl');
    const ask = [{ type: 'tool_use', name: 'AskUserQuestion', input: {} }];
    fs.writeFileSync(file, [
        assistant('r1', { input_tokens: 10, cache_read_input_tokens: 1000, cache_creation_input_tokens: 500, output_tokens: 5 }),
        assistant('r2', { input_tokens: 20, cache_read_input_tokens: 3000, output_tokens: 7 }, ask),
        assistant('r2', { input_tokens: 20, cache_read_input_tokens: 3000, output_tokens: 7 }, ask),
        assistant('r3', { input_tokens: 30, cache_read_input_tokens: 2000, cache_creation_input_tokens: 100, output_tokens: 9 }),
    ].join(''));
    return file;
}

test('measure counts each request once: peak, last, and the context at a gate', () => {
    const file = session(tmp('fankeel-ctx-'));
    const m = ctx.measure(file);
    assert.equal(m.turns, 3);
    assert.deepEqual(m.perTurn, [1510, 3020, 2130]);
    assert.match(ctx.main([file]).text, /each turn: 1510 3020 2130/);
    assert.equal(m.peak, 3020);
    assert.equal(m.peakTurn, 2);
    assert.equal(m.last, 2130);
    assert.deepEqual(m.gates, [3020]);
    assert.equal(m.agents, 0);
});

test('measure puts the subagents beside the session, never into it', () => {
    const dir = tmp('fankeel-ctx-');
    const file = session(dir);
    const sub = path.join(dir, 's', 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(sub, 'agent-ab12.jsonl'), line({
        type: 'assistant', isSidechain: true, requestId: 'a1', timestamp: '2026-09-21T00:00:01.000Z',
        message: { model: 'claude-sonnet-5', usage: { input_tokens: 100, output_tokens: 50 } },
    }));
    const m = ctx.measure(file);
    assert.equal(m.turns, 3);
    assert.equal(m.peak, 3020);
    assert.equal(m.last, 2130);
    assert.equal(m.agents, 1);
    assert.equal(m.agentTokens, 150);
});

test('a session id is looked up under every project directory of the config directory', () => {
    const cfg = tmp('fankeel-ctx-');
    const dir = path.join(cfg, 'projects', 'some-slug');
    fs.mkdirSync(dir, { recursive: true });
    session(dir, '11111111-2222-4333-8444-555555555555.jsonl');
    const known = ctx.main(['11111111-2222-4333-8444-555555555555', '--claude-dir', cfg]);
    assert.match(known.text, /peak 3,020/);
    assert.equal(known.code, undefined);
    const unknown = ctx.main(['22222222-2222-4333-8444-555555555555', '--claude-dir', cfg]);
    assert.match(unknown.text, /unreadable/);
    assert.equal(unknown.code, 1);
});

test('measure is null for a file that cannot be read', () => {
    const missing = path.join(tmp('fankeel-ctx-'), 'missing.jsonl');
    assert.equal(ctx.measure(missing), null);
    const out = ctx.main([missing]);
    assert.match(out.text, /unreadable/);
    assert.equal(out.code, 1);
});

test('--compare prints both sessions and the difference in peak', () => {
    const a = session(tmp('fankeel-ctx-'));
    const b = path.join(tmp('fankeel-ctx-'), 's.jsonl');
    fs.writeFileSync(b, assistant('r1', { input_tokens: 1000, output_tokens: 1 }));
    const { text } = ctx.main(['--compare', a, b]);
    assert.match(text, /3,020/);
    assert.match(text, /1,000/);
    assert.match(text, /-2,020/);
    // One unreadable side fails the run, whichever side it is, and prints no difference.
    const half = ctx.main(['--compare', a, path.join(path.dirname(b), 'missing.jsonl')]);
    assert.equal(half.code, 1);
    assert.doesNotMatch(half.text, /b minus a/);
    const first = ctx.main(['--compare', path.join(path.dirname(b), 'missing.jsonl'), b]);
    assert.equal(first.code, 1);
    assert.match(first.text, /unreadable/);
    assert.match(first.text, /peak 1,000/);
    assert.doesNotMatch(first.text, /b minus a/);
});

test('a wrong number of paths is a usage line and a non-zero code', () => {
    assert.equal(ctx.main([]).code, 2);
    assert.equal(ctx.main(['--compare', 'only-one.jsonl']).code, 2);
});

test('a flag that does not exist is the usage line and code 2, not a stack trace', () => {
    for (const argv of [['--bogus'], ['x.jsonl', '--claude-dir']]) {
        const out = ctx.main(argv);
        assert.equal(out.code, 2);
        assert.match(out.text, /^usage: node scripts\/ctx\.js/);
    }
});
