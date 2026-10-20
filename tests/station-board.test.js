'use strict';
// A task's boards on the station: each session serialises the *.board files
// in its build directory as boards[], and serve draws one at
// GET /station/board/<sessionId>/<name>.svg without the nonce
// (docs/99-archive/2026-10-20-chartroom-board-design.md §3, §4, §6).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const SID = 'aaaaaaaa-1111-4111-8111-111111111111';
const BARE = 'bbbbbbbb-2222-4222-8222-222222222222';
const NONE = 'cccccccc-3333-4333-8333-333333333333';
const T = (s) => '2026-09-11T10:00:' + String(s).padStart(2, '0') + '.000Z';
const BOARD = fs.readFileSync(path.join(__dirname, 'fixtures', 'levelmark.board'), 'utf8');
const plain = (v) => JSON.parse(JSON.stringify(v));

// SID started at T(0), so its build directory is task-20260911T100000 and
// holds a.board and broken.board; BARE started at T(5) and has none.
function fixture() {
    const base = tmp('fankeel-station-board-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    const common = { stage: 'build', route: ['build'], active: false, claims: [], updated: T(9), configDir: cfg, ended: { at: T(9), reason: 'exit' } };
    registry.writeSession(r1, SID, Object.assign({ task: 'with a board', started: T(0) }, common));
    registry.writeSession(r1, BARE, Object.assign({ task: 'without one', started: T(5) }, common));
    const dir = path.join(r1, '.fankeel', 'build', 'task-20260911T100000');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'a.board'), BOARD);
    fs.writeFileSync(path.join(dir, 'broken.board'), 'not json\n');
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: T(0) }) + '\n');
    return { cfg, r1 };
}

const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], csp: res.headers['content-security-policy'], text }));
    }).on('error', reject);
});

test('each session serialises the boards in its build directory, by name, and [] where it has none', () => {
    const f = fixture();
    const win = {};
    vm.runInNewContext(station.serialize(station.gather({ configDir: f.cfg, details: false })), { window: win });
    const by = Object.fromEntries(win.STATION.sessions.map((s) => [s.id, plain(s.boards)]));
    assert.deepEqual(by[SID].map((b) => b.name), ['a', 'broken']);
    assert.ok(by[SID].every((b) => Number.isInteger(b.updated) && b.updated > 0));
    assert.deepEqual(by[BARE], []);
});

test('serve draws a board as image/svg+xml without the nonce, 422 for a malformed one, 404 for anything else', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const ok = await get(s.url + 'station/board/' + SID + '/a.svg');
        assert.equal(ok.status, 200);
        assert.equal(ok.type, 'image/svg+xml');
        assert.match(ok.text, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
        assert.match(ok.csp, /default-src 'none'/);
        const broken = await get(s.url + 'station/board/' + SID + '/broken.svg');
        assert.equal(broken.status, 422);
        assert.match(broken.text, /JSON/);
        for (const bad of ['/../x.svg', '/..%2Fx.svg', '/missing.svg', '/a.board.svg']) {
            assert.equal((await get(s.url + 'station/board/' + SID + bad)).status, 404, bad);
        }
        assert.equal((await get(s.url + 'station/board/' + NONE + '/a.svg')).status, 404, 'an unknown session');
        assert.equal((await get(s.url + 'station/board/' + BARE + '/a.svg')).status, 404, 'another session\'s board');
    } finally {
        s.close();
    }
});

test('station.md documents the board route and marks the /chartroom/ section superseded for task diagrams', () => {
    const md = fs.readFileSync(path.join(__dirname, '..', 'docs', '90-agent', 'reference', 'station.md'), 'utf8');
    assert.match(md, /`GET \/station\/board\/<sessionId>\/<name>\.svg`/);
    assert.match(md, /Superseded for task diagrams by \[the 10-20 board decision\]\(\.\.\/\.\.\/03-decisions\/2026-10-20-task-boards-as-svg\.md\)/);
});
