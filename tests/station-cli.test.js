'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const badge = require('../lib/badge.js');

const CLI = path.join(__dirname, '..', 'scripts', 'station.js');
const LIVE = 'aaaaaaaa-1111-4111-8111-111111111111';
const STALE = 'bbbbbbbb-2222-4222-8222-222222222222';
const DAY = 24 * 3600e3;

function fixture() {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-station-cli-'));
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    const now = Date.now();
    const at = (ms) => new Date(ms).toISOString();
    registry.writeSession(r1, LIVE, { task: 'live', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: at(now - 40 * DAY), updated: at(now - 30 * DAY), configDir: cfg });
    registry.writeSession(r1, STALE, { task: 'stale', stage: 'design', route: ['survey', 'design'], active: true, claims: [],
        started: at(now - 40 * DAY), updated: at(now - 30 * DAY), configDir: cfg });
    badge.writeLead(cfg, STALE, { word: 'design', root: r1 });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({
        pid: process.pid, sessionId: LIVE, cwd: r1, startedAt: at(now), procStart: 0, version: '2.0.0',
        kind: 'interactive', entrypoint: 'cli', status: 'idle',
    }));
    return { base, cfg, r1 };
}

const request = (url, opts, body) => new Promise((resolve, reject) => {
    const req = http.request(url, opts, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
});

test('the default form writes the page, prints its path and the counts', () => {
    const f = fixture();
    const out = execFileSync(process.execPath, [CLI], { cwd: f.base, env: { ...process.env, CLAUDE_CONFIG_DIR: f.cfg }, encoding: 'utf8' });
    const file = path.join(f.cfg, 'fankeel', 'station.html');
    assert.ok(out.includes(file));
    assert.match(out, /1 registries · 1 live, 1 stale, 0 down/);
    assert.ok(fs.readFileSync(file, 'utf8').includes('stale'));
});

test('--scan walks a directory for registries, and the next run remembers what it found', () => {
    const f = fixture();
    const far = path.join(f.base, 'elsewhere', 'deep', 'ws2');
    registry.ensureLayout(far);
    registry.writeSession(far, 'cccccccc-3333-4333-8333-333333333333', { task: 'scanned', stage: 'land', route: ['survey', 'land'],
        active: false, claims: [], started: new Date().toISOString(), updated: new Date().toISOString(), configDir: f.cfg });
    const env = { ...process.env, CLAUDE_CONFIG_DIR: f.cfg };
    const out = execFileSync(process.execPath, [CLI, '--scan', path.join(f.base, 'elsewhere')], { cwd: f.base, env, encoding: 'utf8' });
    assert.match(out, /2 registries · 1 live, 1 stale, 1 down/);
    assert.ok(fs.readFileSync(path.join(f.cfg, 'fankeel', 'station.html'), 'utf8').includes('scanned'));
    const again = execFileSync(process.execPath, [CLI], { cwd: f.base, env, encoding: 'utf8' });
    assert.match(again, /2 registries/, 'roots.json remembered the scanned registry');
    const inside = execFileSync(process.execPath, [CLI], { cwd: far, env, encoding: 'utf8' });
    assert.match(inside, /copy at /);
    assert.ok(fs.existsSync(path.join(far, '.fankeel', 'station.html')), 'run from inside a registry, the copy lands there');
});

test('serve renders live, refuses a bad nonce, refuses a live row, clears a stale one, then exits when idle', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const page = await request(s.url, { method: 'GET' });
        assert.equal(page.status, 200);
        assert.ok(page.text.includes('action="/clear"'));
        const nonce = /name="nonce" value="([^"]+)"/.exec(page.text)[1];
        const form = (o) => new URLSearchParams(o).toString();
        const post = (body) => request(s.url + 'clear', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } }, body);
        assert.equal((await post(form({ root: f.r1, id: STALE, nonce: 'wrong' }))).status, 403);
        const refused = await post(form({ root: f.r1, id: LIVE, nonce }));
        assert.equal(refused.status, 409);
        assert.match(refused.text, /running/);
        assert.equal(registry.readSession(f.r1, LIVE).active, true);
        const ok = await post(form({ root: f.r1, id: STALE, nonce }));
        assert.equal(ok.status, 303);
        assert.equal(ok.headers.location, '/');
        assert.equal(registry.readSession(f.r1, STALE).active, false);
        assert.equal((await request(s.url + 'nowhere', { method: 'GET' })).status, 404);
    } finally {
        s.close();
    }
});
