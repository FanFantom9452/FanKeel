'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const compare = require('../lib/compare.js');
const usage = require('../lib/usage.js');
const tmp = require('./tmp.js');

// Local wall-clock, the clock parseRange cuts whole days with.
const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi || 0).toISOString();
const line = (o) => JSON.stringify(o) + '\n';
const assistant = (requestId, timestamp, u, extra) => line(Object.assign({
    type: 'assistant', requestId, timestamp, message: { model: 'claude-sonnet-5', usage: u },
}, extra || {}));
// 10 + 100 + 1000 = 1110 tokens a request.
const U = { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 1000 };
const A = '2026-09-01..2026-09-07';
const B = '2026-09-15..2026-09-21';

function fixture() {
    const cfg = tmp('fankeel-compare-');
    const dir = path.join(cfg, 'projects', 'F--proj');
    fs.mkdirSync(path.join(dir, 's1', 'subagents'), { recursive: true });
    const write = (name, lines) => fs.writeFileSync(path.join(dir, name), lines.join(''));
    // s1, inside A: req_1 written twice, as a streamed line repeats; one agent.
    write('s1.jsonl', [assistant('req_1', at(2026, 9, 2, 10), U), assistant('req_1', at(2026, 9, 2, 10), U), assistant('req_2', at(2026, 9, 2, 11), U)]);
    fs.writeFileSync(path.join(dir, 's1', 'subagents', 'agent-ab12.jsonl'), assistant('req_a', at(2026, 9, 2, 10, 30), U, { isSidechain: true }));
    // s2, the last minute of A's last day: inside A.
    write('s2.jsonl', [assistant('req_3', at(2026, 9, 7, 23, 59), U)]);
    // s3, the first instant after A ends: outside A.
    write('s3.jsonl', [assistant('req_4', at(2026, 9, 8, 0, 0), U)]);
    // s4, inside B.
    write('s4.jsonl', [assistant('req_5', at(2026, 9, 16, 9), U)]);
    // s5, the evening before A starts: outside both.
    write('s5.jsonl', [assistant('req_6', at(2026, 8, 31, 23), U)]);
    // s6, exactly B's first midnight: inside B.
    write('s6.jsonl', [assistant('req_7', at(2026, 9, 15, 0, 0), U)]);
    return { cfg, dir };
}

test('a range is whole local days, its last day included', () => {
    const r = compare.parseRange(A);
    assert.equal(r.from, new Date(2026, 8, 1).getTime());
    assert.equal(r.to, new Date(2026, 8, 8).getTime());
    assert.equal(r.label, A);
    assert.throws(() => compare.parseRange('2026-09-07..2026-09-01'), /ends on or after/);
    assert.throws(() => compare.parseRange('2026-09-01'), /YYYY-MM-DD\.\.YYYY-MM-DD/);
});

test('a session belongs to the range its first line falls in, both edges', () => {
    const { cfg } = fixture();
    const [a, b] = compare.compare(cfg, compare.parseRange(A), compare.parseRange(B));
    assert.equal(a.sessions, 2, 's1 and s2; not s3 at the midnight after, not s5 the evening before');
    assert.equal(b.sessions, 2, 's4, and s6 at exactly the from of B');
});

test('a session is summarise() over its own file plus its agents\' files, a repeated requestId once', () => {
    const { dir } = fixture();
    const file = path.join(dir, 's1.jsonl');
    const s = compare.sessionOf(file);
    const own = usage.summarise(file);
    const agent = usage.summarise(path.join(dir, 's1', 'subagents', 'agent-ab12.jsonl'), { sidechain: true });
    assert.equal(own.usage.requests, 2, 'req_1 written twice is one request');
    assert.equal(s.requests, 3);
    assert.equal(s.agents, 1);
    assert.equal(s.tokens, usage.tokensOf(usage.splitOf(own.usage.models)) + usage.tokensOf(usage.splitOf(agent.usage.models)));
    assert.equal(s.tokens, 3 * 1110);
    assert.ok(s.agentUsd > 0 && s.agentUsd < s.usd, 'the agent is part of the session\'s dollars, not all of them');
});

test('the table prints both labels, a sessions row and each model\'s share', () => {
    const { cfg } = fixture();
    const out = compare.format(compare.compare(cfg, compare.parseRange(A), compare.parseRange(B)));
    assert.match(out, /2026-09-01\.\.2026-09-07\s+2026-09-15\.\.2026-09-21/);
    assert.match(out, /^sessions\s+2\s+2$/m);
    assert.match(out, /^claude-sonnet-5\s+100%\s+100%$/m);
});

test('the table pins every figure: usd and tokens per session, median, subagent share, total', () => {
    const cfg = tmp('fankeel-compare-');
    const dir = path.join(cfg, 'projects', 'p');
    fs.mkdirSync(path.join(dir, 'a1', 'subagents'), { recursive: true });
    const BIG = { input_tokens: 1e6, output_tokens: 1e6 }; // $12 on claude-sonnet-5
    fs.writeFileSync(path.join(dir, 'a1.jsonl'), assistant('r1', at(2026, 9, 2, 9), BIG));
    fs.writeFileSync(path.join(dir, 'a1', 'subagents', 'agent-ab12.jsonl'), assistant('r2', at(2026, 9, 2, 9, 5), BIG, { isSidechain: true }));
    fs.writeFileSync(path.join(dir, 'a2.jsonl'), assistant('r3', at(2026, 9, 3, 9), BIG));
    fs.writeFileSync(path.join(dir, 'a3.jsonl'), assistant('r4', at(2026, 9, 4, 9), BIG));
    fs.writeFileSync(path.join(dir, 'b1.jsonl'), assistant('r5', at(2026, 9, 16, 9), BIG));
    const out = compare.format(compare.compare(cfg, compare.parseRange(A), compare.parseRange(B)));
    assert.match(out, /^sessions\s+3\s+1$/m);
    assert.match(out, /^usd per session\s+\$16\.00\s+\$12\.00$/m);
    assert.match(out, /^median usd per session\s+\$12\.00\s+\$12\.00$/m);
    assert.match(out, /^tokens per session\s+2666667\s+2000000$/m);
    assert.match(out, /^subagent share of usd\s+25%\s+0%$/m);
    assert.match(out, /^total usd\s+\$48\.00\s+\$12\.00$/m);
});

test('an unreadable projects root throws, and the CLI exits non-zero', () => {
    const cfg = tmp('fankeel-compare-');
    assert.throws(() => compare.compare(cfg, compare.parseRange(A), compare.parseRange(B)), /cannot read/);
    const r = require('node:child_process').spawnSync(process.execPath,
        [path.join(__dirname, '..', 'scripts', 'usage-compare.js'), '--before', A, '--after', B, '--config-dir', cfg], { encoding: 'utf8' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /cannot read/);
});
