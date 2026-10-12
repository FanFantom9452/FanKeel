'use strict';
// serve's GET /station/talk/<id>?from=<n> (the session page's 對話 tab): a page
// of a session's turns and the counts of the whole conversation, the counts
// being the ones scripts/conversation.js prints in its file header.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const conversation = require('../lib/conversation.js');
const { entriesOf } = require('../lib/usage.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const SID = 'cccccccc-3333-4333-8333-333333333333';
const MANY = 'dddddddd-4444-4444-8444-444444444444';
const NONE = 'eeeeeeee-5555-4555-8555-555555555555';
const LONG = 'x'.repeat(5000);
const T = (m) => '2026-10-01T10:' + String(m % 60).padStart(2, '0') + ':00.000Z';
const typed = (text, m) => ({ type: 'user', timestamp: T(m), message: { role: 'user', content: text } });
const said = (id, text, m) => ({ type: 'assistant', timestamp: T(m), message: { id, model: 'claude-opus-5-5', content: [{ type: 'text', text }] } });
const jsonl = (lines) => lines.map((l) => JSON.stringify(l) + '\n').join('');

// One compaction, a tool result and a system line left out, an interruption,
// and a line that does not parse: every count the file header prints is not 0.
const LINES = [
    typed('第一個問題', 1),
    said('msg_1', LONG, 2),
    { type: 'system', subtype: 'compact_boundary', timestamp: T(3), compactMetadata: { trigger: 'manual', preTokens: 349064 } },
    { type: 'user', timestamp: T(3), isCompactSummary: true, message: { role: 'user', content: 'Summary: 前情' } },
    { type: 'user', timestamp: T(4), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'x' }] } },
    { type: 'user', timestamp: T(4), isMeta: true, message: { role: 'user', content: 'skill text' } },
    typed('[Request interrupted by user]', 5),
    typed('壓縮後的問題', 6),
    said('msg_2', '壓縮後的回答', 7),
];

function fixture() {
    const base = tmp('fankeel-station-talk-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'projects', 'ws-slug'), { recursive: true });
    registry.ensureLayout(r1);
    const put = (id, text) => fs.writeFileSync(path.join(cfg, 'projects', 'ws-slug', id + '.jsonl'), text);
    put(SID, jsonl(LINES) + 'not json\n');
    put(MANY, jsonl(Array.from({ length: 105 }, (_, i) => typed('問題 ' + i, i))));
    return { cfg, r1, put, file: path.join(cfg, 'projects', 'ws-slug', SID + '.jsonl') };
}

const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    }).on('error', reject);
});

test('the route answers the counts markdownOf prints in the file header, and a reply whole', async () => {
    const f = fixture();
    const stats = { unparsed: 0 };
    const read = conversation.turnsOf(entriesOf(f.file, stats));
    read.skipped.unparsed = stats.unparsed;
    const header = conversation.markdownOf(read, { session: SID, file: f.file }).split('\n');
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const ok = await get(s.url + 'station/talk/' + SID);
        assert.equal(ok.status, 200);
        assert.match(ok.headers['content-type'], /application\/json/);
        assert.equal(ok.headers['cache-control'], 'no-store');
        const page = JSON.parse(ok.text);
        assert.deepEqual([page.total, page.from], [7, 0]);
        assert.equal('compactions: ' + page.counts.compact + ' · user turns: ' + page.counts.user + ' · Claude turns: ' + page.counts.claude, header[3]);
        assert.equal('left out: ' + Object.keys(page.skipped).map((k) => k + ' ' + page.skipped[k]).join(', '), header[4]);
        assert.deepEqual([page.skipped.tool, page.skipped.meta, page.skipped.unparsed], [1, 1, 1]);
        assert.deepEqual(page.turns.map((t) => t.kind), ['user', 'claude', 'compact', 'summary', 'interrupt', 'user', 'claude']);
        assert.equal(page.turns[1].text.length, 5000, 'the reply is not cut');
        assert.deepEqual([page.turns[2].trigger, page.turns[2].preTokens], ['manual', 349064]);
    } finally {
        s.close();
    }
});

test('the route pages 100 turns at a time from the index asked for, and 404s a session with no transcript', async () => {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const first = JSON.parse((await get(s.url + 'station/talk/' + MANY)).text);
        assert.deepEqual([first.total, first.from, first.turns.length], [105, 0, 100]);
        const rest = JSON.parse((await get(s.url + 'station/talk/' + MANY + '?from=100')).text);
        assert.deepEqual([rest.total, rest.from, rest.turns.length, rest.turns[0].text], [105, 100, 5, '問題 100']);
        assert.equal(JSON.parse((await get(s.url + 'station/talk/' + MANY + '?from=500')).text).turns.length, 0);
        assert.equal(JSON.parse((await get(s.url + 'station/talk/' + MANY + '?from=abc')).text).from, 0);
        assert.equal((await get(s.url + 'station/talk/' + NONE)).status, 404);
    } finally {
        s.close();
    }
});

test('a transcript that exists but cannot be read is a 500, and a session with none is a 404', async () => {
    const f = fixture();
    // A file that stats fine but fails to read (a lock, a permission) cannot be
    // made the same way on Windows and Linux, so the read is made to throw.
    const read = fs.readFileSync;
    fs.readFileSync = (p, ...a) => { if (String(p).endsWith(SID + '.jsonl')) throw Object.assign(new Error('locked'), { code: 'EACCES' }); return read(p, ...a); };
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const locked = await get(s.url + 'station/talk/' + SID);
        assert.deepEqual([locked.status, locked.text], [500, 'cannot read that transcript\n']);
        assert.equal((await get(s.url + 'station/talk/' + NONE)).status, 404);
    } finally {
        fs.readFileSync = read;
        s.close();
    }
});

test('the route reads a transcript again once it has grown', async () => {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        assert.equal(JSON.parse((await get(s.url + 'station/talk/' + SID)).text).total, 7);
        fs.appendFileSync(f.file, jsonl([typed('後來又問了一個', 9)]));
        assert.equal(JSON.parse((await get(s.url + 'station/talk/' + SID)).text).total, 8);
    } finally {
        s.close();
    }
});
