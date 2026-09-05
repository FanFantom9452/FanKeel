'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const registry = require('../lib/registry.js');
const badge = require('../lib/badge.js');
const station = require('../lib/station.js');

const LIVE = 'aaaaaaaa-1111-4111-8111-111111111111';
const STALE = 'bbbbbbbb-2222-4222-8222-222222222222';
const DOWN = 'cccccccc-3333-4333-8333-333333333333';
const DAY = 24 * 3600e3;

// Two registries, one config dir. One session is running (this process's pid),
// one is active with nobody behind it, one is stood down with usage recorded.
function fixture() {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-station-'));
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws-one');
    const r2 = path.join(base, 'ws-two');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    registry.ensureLayout(r2);
    const now = Date.now();
    const at = (ms) => new Date(ms).toISOString();
    registry.writeSession(r1, LIVE, { task: 'live one', project: 'ws-one', stage: 'build', route: ['survey', 'build', 'verify'],
        active: true, claims: ['a.js'], started: at(now - 3600e3), updated: at(now - 60e3), configDir: cfg });
    registry.writeSession(r1, STALE, { task: 'stale one', stage: 'design', route: ['survey', 'design', 'build'],
        active: true, claims: [], started: at(now - 40 * DAY), updated: at(now - 30 * DAY), configDir: cfg,
        ended: { at: at(now - 30 * DAY), reason: 'clear' } });
    registry.writeSession(r2, DOWN, { task: 'down two', stage: 'land', route: ['survey', 'build', 'land'],
        active: false, claims: [], started: at(now - 2 * DAY), updated: at(now - DAY), configDir: cfg,
        notes: ['a note'], next: 'nothing',
        model: 'claude-sonnet-5', usage: { requests: 3, models: { 'claude-sonnet-5': { input: 1e6, output: 1e6, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } },
            subagents: { agents: 2, requests: 5, wallMs: 60000, models: { 'claude-sonnet-5': { input: 1e6, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } } } } });
    fs.writeFileSync(path.join(r2, '.fankeel', 'sessions', 'deadbeef-0000-4000-8000-000000000000.json'), '{not json');
    fs.mkdirSync(path.join(r1, '.fankeel', 'build', '2026-09-04-thing'), { recursive: true });
    fs.writeFileSync(path.join(r1, '.fankeel', 'build', '2026-09-04-thing', 'ledger.md'), '# ledger\n');
    // Discovery: r1 through a lead, r2 through a running session's cwd.
    badge.writeLead(cfg, STALE, { word: 'design', step: 2, steps: 3, root: r1 });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({
        pid: process.pid, sessionId: LIVE, cwd: path.join(r2, 'deeper'), startedAt: at(now - 3600e3),
        procStart: 0, version: '2.0.0', kind: 'interactive', entrypoint: 'cli', status: 'idle',
    }));
    return { base, cfg, r1, r2 };
}

test('discover finds a registry through a lead, one through a running cwd, and one by --root; a gone one is named', () => {
    const f = fixture();
    const gone = path.join(f.base, 'gone');
    badge.writeLead(f.cfg, DOWN, { word: 'land', root: gone });
    const out = station.discover({ configDir: f.cfg, roots: [f.r2], cwd: os.tmpdir() });
    assert.deepEqual(out.roots, [f.r1, f.r2].map((p) => path.resolve(p)).sort());
    assert.deepEqual(out.gone, [path.resolve(gone)]);
});

test('gather classifies live, stale and down, counts unreadable, prices usage, lists build/', () => {
    const f = fixture();
    const m = station.gather({ configDir: f.cfg });
    assert.equal(m.registries.length, 2);
    const one = m.registries.find((r) => r.root === path.resolve(f.r1));
    const two = m.registries.find((r) => r.root === path.resolve(f.r2));
    assert.deepEqual(one.sessions.map((s) => [s.sessionId, s.state]), [[LIVE, 'live'], [STALE, 'stale']]);
    assert.equal(one.sessions[0].unknown, false);
    assert.deepEqual(one.build, [{ name: '2026-09-04-thing', files: 1 }]);
    assert.equal(one.unreadable, 0);
    assert.equal(two.unreadable, 1);
    const down = two.sessions[0];
    assert.equal(down.state, 'down');
    assert.equal(down.ended, null);
    assert.equal(down.cost.usd, 12);
    assert.deepEqual(down.cost.unpriced, []);
    assert.equal(down.agentCost.usd, 2);
    assert.equal(down.agents.agents, 2);
    assert.equal(one.sessions[1].ended.reason, 'clear');
    assert.equal(m.pricesVerified.length, 10);
});

test('render names every task, marks state, shows the price date, and draws the clear control only under serve and only on stale rows', () => {
    const f = fixture();
    const m = station.gather({ configDir: f.cfg });
    const page = station.render(m, { plugin: 'C:/plug' });
    assert.match(page, /<!doctype html>/i);
    for (const t of ['live one', 'stale one', 'down two']) assert.ok(page.includes(t), t);
    assert.match(page, /prices 2026-\d{2}-\d{2}|prices \d{4}-\d{2}-\d{2}/);
    assert.ok(page.includes('task.js clear ' + STALE));
    assert.ok(page.includes('2 agents'));
    assert.ok(!page.includes('<form'));
    assert.ok(!page.includes('<script src='));
    const served = station.render(m, { serve: true, nonce: 'n0nce' });
    assert.ok(served.includes('name="nonce" value="n0nce"'));
    assert.equal((served.match(/action="\/clear"/g) || []).length, 1);
    assert.ok(served.includes('value="' + STALE + '"'));
    assert.ok(!served.includes('value="' + LIVE + '"'));
});

test('write returns the counts and both paths, copies the page into the caller\'s registry, and ignores it there', () => {
    const f = fixture();
    const out = station.write({ configDir: f.cfg, root: f.r1 });
    assert.equal(out.file, path.join(f.cfg, 'fankeel', 'station.html'));
    assert.equal(out.copy, path.join(f.r1, '.fankeel', 'station.html'));
    assert.deepEqual([out.registries, out.live, out.stale, out.down], [2, 1, 1, 1]);
    assert.ok(fs.readFileSync(out.file, 'utf8').includes('live one'));
    assert.equal(fs.readFileSync(out.copy, 'utf8'), fs.readFileSync(out.file, 'utf8'));
    assert.match(fs.readFileSync(path.join(f.r1, '.fankeel', '.gitignore'), 'utf8'), /^station\.html$/m);
    station.write({ configDir: f.cfg, root: f.r1 });
    const lines = fs.readFileSync(path.join(f.r1, '.fankeel', '.gitignore'), 'utf8').split(/\r?\n/);
    assert.equal(lines.filter((l) => l === 'station.html').length, 1, 'a second write does not duplicate the line');
    // A root with no registry gets no copy and no .fankeel/ — a hook handing
    // over its launch directory must not create one there.
    const bare = path.join(f.base, 'no-registry');
    fs.mkdirSync(bare);
    assert.equal(station.write({ configDir: f.cfg, root: bare }).copy, null);
    assert.equal(fs.existsSync(path.join(bare, '.fankeel')), false);
});

// What the lead forgets. A lead is cleared with its badge, so a registry with no
// task running in it had nothing pointing at it: 3 of at least 11 on 2026-09-05.
test('discover reads roots.json; write stamps the present, keeps the gone for thirty days, then drops them', () => {
    const f = fixture();
    const now = Date.now();
    const r3 = path.join(f.base, 'ws-three');
    registry.ensureLayout(r3);
    const gone = path.join(f.base, 'gone');
    const old = path.join(f.base, 'older');
    fs.mkdirSync(path.join(f.cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(station.rootsPath(f.cfg), JSON.stringify({
        [r3]: new Date(now - 5 * DAY).toISOString(),
        [gone]: new Date(now - 5 * DAY).toISOString(),
        [old]: new Date(now - 31 * DAY).toISOString(),
    }));
    const found = station.discover({ configDir: f.cfg });
    assert.ok(found.roots.includes(path.resolve(r3)), 'a root only roots.json names');
    assert.deepEqual(found.gone, [gone, old].map((p) => path.resolve(p)).sort());
    station.write({ configDir: f.cfg, now });
    const roots = station.readRoots(f.cfg);
    assert.equal(roots[path.resolve(r3)], new Date(now).toISOString());
    assert.equal(roots[path.resolve(f.r1)], new Date(now).toISOString(), 'a root found through a lead is remembered');
    assert.equal(roots[path.resolve(gone)], new Date(now - 5 * DAY).toISOString(), 'gone keeps its stamp');
    assert.equal(path.resolve(old) in roots, false, 'gone for 31 days is dropped');
    fs.writeFileSync(station.rootsPath(f.cfg), '{not json');
    assert.deepEqual(station.readRoots(f.cfg), {}, 'an unreadable file is empty, not fatal');
});

// `hideBadge` clears the lead before it calls `write`, so the registry a verb
// is writing into must be in the union on its own name, not through a lead.
test('the root a caller writes into is listed and remembered even with no lead and no running session', () => {
    const f = fixture();
    const r3 = path.join(f.base, 'ws-three');
    registry.ensureLayout(r3);
    const out = station.write({ configDir: f.cfg, root: r3 });
    assert.equal(out.registries, 3);
    assert.equal(out.copy, path.join(r3, '.fankeel', 'station.html'));
    assert.ok(path.resolve(r3) in station.readRoots(f.cfg));
});

test('scanRoots finds a registry two levels down, skips node_modules and dot-directories, and stops at its depth', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-station-scan-'));
    const deep = path.join(base, 'a', 'b');
    registry.ensureLayout(deep);
    registry.ensureLayout(path.join(base, 'node_modules', 'pkg'));
    registry.ensureLayout(path.join(base, '.hidden', 'ws'));
    registry.ensureLayout(path.join(base, '1', '2', '3', '4', '5', '6', '7'));
    assert.deepEqual(station.scanRoots(base), [path.resolve(deep)]);
    const found = station.discover({ configDir: path.join(base, 'cfg'), scan: [base] });
    assert.ok(found.roots.includes(path.resolve(deep)));
});
