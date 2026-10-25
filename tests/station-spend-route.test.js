'use strict';
// serve's range route (the 花費 page's range report) answers lib/spendrange.js's
// report for the range asked, a bad range is a 400; the talk route carries the
// break records; the data file carries lib/prices.js's table; and the page's
// four modules are served, loaded by the shell and written beside it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const prices = require('../lib/prices.js');
const compare = require('../lib/compare.js');
const station = require('../lib/station.js');
const spendrange = require('../lib/spendrange.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const MODULES = ['spend-talk.js', 'spend-kinds.js', 'spend-range.js', 'spend-panel.js'];
const SID = 'ffffffff-6666-4666-8666-666666666666';
const at = (d, h, m) => new Date(2026, 9, d, h, m || 0).toISOString();
const call = (id, t, w1h, read) => JSON.stringify({ type: 'assistant', requestId: id, timestamp: t,
    message: { model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: read || 0, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: w1h || 0 } } } }) + '\n';

function fixture() {
    const base = tmp('fankeel-spend-route-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    const dir = path.join(cfg, 'projects', 'ws-slug');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(dir, { recursive: true });
    registry.ensureLayout(r1);
    // Two requests 90 minutes apart, the second writing more than it reads: one break.
    fs.writeFileSync(path.join(dir, SID + '.jsonl'), call('a', at(14, 10), 5000) + call('b', at(14, 11, 30), 6000, 100));
    fs.writeFileSync(path.join(dir, 'two.jsonl'), call('c', at(8, 10)));
    return { cfg, r1 };
}

const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    }).on('error', reject);
});
async function served(fn) {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        await fn(s, f);
    } finally {
        s.close();
    }
}

test('the range route answers the report for the range asked, with the range before it', () => served(async (s, f) => {
    const ok = await get(s.url + 'station/spend?from=2026-10-13&to=2026-10-19&top=5');
    assert.equal(ok.status, 200);
    assert.match(ok.headers['content-type'], /application\/json/);
    assert.equal(ok.headers['cache-control'], 'no-store');
    const rep = JSON.parse(ok.text);
    const range = compare.parseRange('2026-10-13..2026-10-19');
    assert.deepEqual(rep, JSON.parse(JSON.stringify(spendrange.report(f.cfg, range, { top: 5 }))));
    const [before, after] = compare.compare(f.cfg, spendrange.previous(range), range);
    assert.ok(Math.abs(rep.usd - after.usd) < 1e-9 && Math.abs(rep.prev.usd - before.usd) < 1e-9);
    assert.deepEqual([rep.sessions, rep.prev.sessions, rep.prev.label], [1, 1, '2026-10-06..2026-10-12']);
}));

test('a range that does not parse, or ends before it starts, is a 400', () => served(async (s) => {
    assert.equal((await get(s.url + 'station/spend?from=2026-10-19&to=2026-10-13')).status, 400);
    assert.equal((await get(s.url + 'station/spend?from=last-week')).status, 400);
}));

test('the talk route carries the break records beside the turns', () => served(async (s) => {
    const page = JSON.parse((await get(s.url + 'station/talk/' + SID)).text);
    assert.deepEqual(page.spend.marks.map((m) => [m.kind, m.trigger]), [['expiry', 'away']]);
    assert.ok(Math.abs(page.spend.total - page.spend.sessionUsd) < 1e-9);
}));

test('the four modules are served byte for byte, and the shell loads them before station.js', () => served(async (s) => {
    for (const name of MODULES) {
        const res = await get(s.url + 'station/' + name);
        assert.equal(res.status, 200, name);
        assert.match(res.headers['content-type'], /text\/javascript/, name);
        assert.equal(res.text, fs.readFileSync(path.join(ASSETS, name), 'utf8'), name);
    }
    const shell = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
    const order = [...shell.matchAll(/<script src="station\/([^"]+)"><\/script>/g)].map((m) => m[1]);
    const PAGES = ['tip', 'live-page', 'sessions-page', 'projects-page', 'project-page', 'session-page', 'session-dispatch', 'session-talk', 'talk-acts', 'diagram', 'docs-page', 'settings-page', 'settings-steps', 'settings-detail'].map((n) => n + '.js');
    assert.deepEqual(order, ['i18n.js'].concat(PAGES, MODULES, ['remote-card.js', 'station.js']));
}));

test('the data file carries lib/prices.js\'s table, and a written copy carries the modules', () => {
    const f = fixture();
    const S = JSON.parse(station.serialize(station.gather({ configDir: f.cfg }), {}).replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
    assert.deepEqual(S.prices, prices.perMillion);
    assert.equal(S.pricesVerified, prices.verified);
    for (const name of MODULES) assert.ok(station.EMITTED.includes('station/' + name), name);
    station.write({ configDir: f.cfg, root: f.r1 });
    for (const name of MODULES) assert.ok(fs.existsSync(path.join(f.cfg, 'fankeel', 'station', name)), name);
});
