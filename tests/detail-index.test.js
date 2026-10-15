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

test('a directory named <id>.jsonl is not indexed, as transcriptOf skips it', () => {
    const f = setup();
    fs.mkdirSync(path.join(f.cfg, 'projects', 'b', 'dir.jsonl'));
    const index = detail.transcriptIndex(f.cfg);
    assert.equal(index.has('dir'), false);
    assert.equal(index.get(SID), f.t);
});

test('a projects/ that cannot be read for a reason but absence is null, and detailOf falls back to transcriptOf', () => {
    const f = setup();
    const real = fs.readdirSync;
    const base = path.join(f.cfg, 'projects');
    fs.readdirSync = function (p, ...rest) {
        if (p === base) throw Object.assign(new Error('denied'), { code: 'EACCES' });
        return real.call(this, p, ...rest);
    };
    let index;
    try {
        index = detail.transcriptIndex(f.cfg);
    } finally {
        fs.readdirSync = real;
    }
    assert.equal(index, null);
    const got = detail.detailOf(f.cfg, SID, DATA, { now: 1000, memo: new Map(), transcripts: index });
    assert.equal(got.detail.requests, 2);
});

test('gather builds one index per config dir and hands detailOf that Map for every session', () => {
    const station = require('../lib/station.js');
    const registry = require('../lib/registry.js');
    const f = setup();
    const root = path.join(f.cfg, 'ws');
    registry.ensureLayout(root);
    const common = { stage: 'survey', route: ['survey', 'build'], active: false, claims: [], started: T(0), updated: T(9), configDir: f.cfg };
    registry.writeSession(root, SID, Object.assign({ task: 'a' }, common));
    registry.writeSession(root, 'cccccccc-2222-4333-8444-555555555555', Object.assign({ task: 'b' }, common));
    const real = { index: detail.transcriptIndex, of: detail.detailOf };
    let built = 0;
    const seen = [];
    detail.transcriptIndex = (d) => { built++; return real.index(d); };
    detail.detailOf = (d, id, data, o) => { seen.push(o.transcripts); return real.of(d, id, data, o); };
    try {
        station.gather({ configDir: f.cfg, roots: [root] });
    } finally {
        Object.assign(detail, { transcriptIndex: real.index, detailOf: real.of });
    }
    assert.equal(seen.length, 2);
    assert.ok(seen.every((m) => m instanceof Map && m === seen[0]));
    assert.equal(built, 1);
});

test('a dangling <id>.jsonl link is not indexed and does not shadow a later real file', (t) => {
    const f = setup();
    try {
        fs.symlinkSync(path.join(f.cfg, 'nowhere.jsonl'), path.join(f.cfg, 'projects', 'a', 'dang.jsonl'));
    } catch (e) {
        return t.skip('cannot create a symlink here: ' + e.code);
    }
    fs.writeFileSync(path.join(f.cfg, 'projects', 'b', 'dang.jsonl'), '');
    assert.equal(detail.transcriptIndex(f.cfg).get('dang'), path.join(f.cfg, 'projects', 'b', 'dang.jsonl'));
});
