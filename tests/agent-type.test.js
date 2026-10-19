'use strict';
// station-31: an agent's type is the `agentType` Claude Code writes in the
// agent's `.meta.json`, with the plugin's `fankeel:` namespace and `fankeel-`
// prefix dropped so one agent is one type; and every per-day row of a
// session's detail is filed under its agent type.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const usage = require('../lib/usage.js');
const detail = require('../lib/detail.js');
const tmp = require('./tmp.js');

const SID = 'abababab-7777-4777-8777-777777777777';
const at = (h) => new Date(2026, 9, 14, h).toISOString();
const line = (o) => JSON.stringify(o) + '\n';
const call = (id, h, side, input) => line(Object.assign({ type: 'assistant', requestId: id, timestamp: at(h),
    message: { model: 'claude-sonnet-5-5', usage: { input_tokens: input, output_tokens: 10, cache_read_input_tokens: 0 } } }, side ? { isSidechain: true } : {}));

function fixture() {
    const cfg = tmp('fankeel-agent-type-');
    const dir = path.join(cfg, 'projects', 'F--p');
    const sub = path.join(dir, SID, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(dir, SID + '.jsonl'), call('m1', 10, false, 1));
    const agent = (id, type, input) => {
        fs.writeFileSync(path.join(sub, 'agent-' + id + '.jsonl'), call('r' + id, 11, true, input));
        if (type !== null) fs.writeFileSync(path.join(sub, 'agent-' + id + '.meta.json'), JSON.stringify({ agentType: type }));
    };
    agent('a1', 'fankeel:fankeel-reviewer', 100);
    agent('b2', 'implementer', 200);
    agent('c3', 'fankeel-implementer', 300);
    agent('d4', null, 400);
    return { cfg, sub };
}

test('agentTypeKey drops the fankeel: namespace and the fankeel- prefix; nothing is unknown', () => {
    assert.equal(usage.agentTypeKey('fankeel:fankeel-implementer'), 'implementer');
    assert.equal(usage.agentTypeKey('fankeel-implementer'), 'implementer');
    assert.equal(usage.agentTypeKey('implementer'), 'implementer');
    assert.equal(usage.agentTypeKey('fankeel:fankeel-implementer-high'), 'implementer-high');
    assert.equal(usage.agentTypeKey('general-purpose'), 'general-purpose');
    assert.equal(usage.agentTypeKey('Explore'), 'Explore');
    for (const none of [undefined, null, '', '  ', 7]) assert.equal(usage.agentTypeKey(none), 'unknown');
});

test('agentTypeOf reads the meta.json beside an agent transcript', () => {
    const f = fixture();
    assert.equal(usage.agentTypeOf(path.join(f.sub, 'agent-a1.jsonl')), 'reviewer');
    assert.equal(usage.agentTypeOf(path.join(f.sub, 'agent-c3.jsonl')), 'implementer');
    assert.equal(usage.agentTypeOf(path.join(f.sub, 'agent-d4.jsonl')), 'unknown');
});

test('a session\'s days rows are filed by agent type, two spellings of one type in one row, at VERSION 10', () => {
    const f = fixture();
    const got = detail.detailOf(f.cfg, SID, {});
    assert.equal(got.detail.v, 10);
    const rows = got.detail.days.map((r) => [r.who, r.type, r.tokens.input]).sort((a, b) => String(a[1]).localeCompare(String(b[1])));
    assert.deepEqual(rows, [['agent', 'implementer', 500], ['main', null, 1], ['agent', 'reviewer', 100], ['agent', 'unknown', 400]]);
});
