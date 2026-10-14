'use strict';
// transcriptIndex: one read of projects/ for a whole gather, so a session whose
// transcript is gone costs nothing instead of one stat per project directory.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const detail = require('../lib/detail.js');
const tmp = require('./tmp.js');

const SID = '11111111-2222-4333-8444-555555555555';
const line = (o) => JSON.stringify(o) + '\n';
const T = (s) => '2026-09-11T10:00:' + String(s).padStart(2, '0') + '.000Z';
const said = (rid, s, context) => line({ type: 'assistant', requestId: rid, timestamp: T(s),
    message: { model: 'claude-sonnet-5', usage: { input_tokens: context, output_tokens: 10 }, content: [] } });
const DATA = { route: ['survey', 'build'], stage: 'survey', started: '2026-09-11T10:00:00.000Z', project: 'p', claims: [] };

function setup() {
    const cfg = tmp('fankeel-detail-index-');
    for (const d of ['a', 'b']) fs.mkdirSync(path.join(cfg, 'projects', d), { recursive: true });
    const t = path.join(cfg, 'projects', 'a', SID + '.jsonl');
    fs.writeFileSync(t, said('r1', 1, 1000) + said('r2', 3, 5000));
    return { cfg, t };
}

// Count the calls that touch a path under projects/<dir>.
function counting(cfg, fn) {
    const base = path.join(cfg, 'projects') + path.sep;
    const real = { readdirSync: fs.readdirSync, statSync: fs.statSync };
    let n = 0;
    for (const k of Object.keys(real)) {
        fs[k] = function (p, ...rest) {
            if (typeof p === 'string' && p.startsWith(base)) n++;
            return real[k].call(this, p, ...rest);
        };
    }
    try {
        fn();
    } finally {
        Object.assign(fs, real);
    }
    return n;
}

test('transcriptIndex maps each session id to its absolute transcript, and a missing projects/ is an empty Map', () => {
    const cfg = tmp('fankeel-detail-index-');
    fs.mkdirSync(path.join(cfg, 'projects', 'a'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'projects', 'b'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'projects', 'a', 's1.jsonl'), '');
    fs.writeFileSync(path.join(cfg, 'projects', 'b', 's2.jsonl'), '');
    fs.writeFileSync(path.join(cfg, 'projects', 'b', 'notes.txt'), '');
    const index = detail.transcriptIndex(cfg);
    assert.ok(index instanceof Map);
    assert.deepEqual([...index].sort(), [
        ['s1', path.join(cfg, 'projects', 'a', 's1.jsonl')],
        ['s2', path.join(cfg, 'projects', 'b', 's2.jsonl')],
    ]);
    const empty = detail.transcriptIndex(tmp('fankeel-detail-index-'));
    assert.ok(empty instanceof Map);
    assert.equal(empty.size, 0);
});

test('a session missing from the index reads no project directory and answers as it would without one', () => {
    const f = setup();
    const index = detail.transcriptIndex(f.cfg);
    let withIndex;
    const touched = counting(f.cfg, () => { withIndex = detail.detailOf(f.cfg, 'nobody', DATA, { memo: new Map(), transcripts: index }); });
    assert.equal(touched, 0);
    assert.deepEqual(withIndex, detail.detailOf(f.cfg, 'nobody', DATA, { memo: new Map() }));
    assert.equal(withIndex, null);
});

test('a session in the index reads the same detail as without one', () => {
    const f = setup();
    const plain = detail.detailOf(f.cfg, SID, DATA, { now: 1000 });
    const indexed = detail.detailOf(f.cfg, SID, DATA, { now: 1000, memo: new Map(), transcripts: detail.transcriptIndex(f.cfg) });
    assert.deepEqual(indexed.detail, plain.detail);
    assert.equal(indexed.detail.requests, 2);
});
