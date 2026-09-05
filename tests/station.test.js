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

// A registry of its own per test below, rather than the shared fixture: each
// one exercises a different shape of `clock`/`burn`/`spend` and none of them
// should shift the session counts the earlier tests already assert on.
function chartFixture(sessionId, data) {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-station-chart-'));
    const root = path.join(base, 'ws');
    registry.ensureLayout(root);
    const now = Date.now();
    registry.writeSession(root, sessionId, Object.assign({
        project: 'ws', active: false, claims: [],
        started: new Date(now - 3600e3).toISOString(), updated: new Date(now).toISOString(),
    }, data));
    return station.gather({ configDir: path.join(base, 'cfg'), root });
}

test('a session with burn on three stages draws a polyline of six points', () => {
    const m = chartFixture('dddddddd-4444-4444-8444-444444444444', {
        task: 'three stages', stage: 'verify', route: ['survey', 'build', 'verify'],
        clock: { survey: [0, 1000], build: [1000, 2000], verify: [2000, 3000] },
        burn: { survey: [0, 100000], build: [100000, 250000], verify: [250000, 400000] },
    });
    const page = station.render(m, {});
    assert.match(page, /<svg class="curve"/);
    const burnLine = page.match(/<polyline class="burn" points="([^"]+)"/);
    assert.ok(burnLine, 'a burn polyline is drawn');
    assert.equal(burnLine[1].trim().split(/\s+/).length, 6, 'two points per stage, three stages');
    assert.equal((page.match(/<line class="rule"/g) || []).length, 3, 'one rule per stage');
});

test('a session with burn on one stage draws no chart', () => {
    const m = chartFixture('eeeeeeee-5555-4555-8555-555555555555', {
        task: 'one stage burn', stage: 'build', route: ['survey', 'build'],
        clock: { survey: [0, 1000], build: [1000, 2000] },
        burn: { survey: [0, 50000] },
    });
    const page = station.render(m, {});
    assert.ok(page.includes('no burn recorded'));
    assert.ok(!page.includes('<svg'), 'a stage sampled once is not enough to draw a curve');
});

test('a session with no spend says so instead of drawing a spend line', () => {
    const m = chartFixture('ffffffff-6666-4666-8666-666666666666', {
        task: 'two stages no spend', stage: 'build', route: ['survey', 'build'],
        clock: { survey: [0, 1000], build: [1000, 2000] },
        burn: { survey: [0, 50000], build: [50000, 120000] },
    });
    const page = station.render(m, {});
    assert.ok(page.includes('spend arrives when the session ends'));
    assert.ok(!page.includes('polyline class="spend"'));
});

test('the stage table prints the burn distance, not the pair', () => {
    // Two stages, not one: `s.burn` (the existing route-summed total, already
    // rendered before this task) would otherwise happen to equal the single
    // stage's distance and pass whether or not the new table renders anything.
    // Here the total (550k) differs from each stage's own distance, so a
    // "400k" in the page can only have come from the stage table.
    const m = chartFixture('99999999-7777-4777-8777-777777777777', {
        task: 'distance not pair', stage: 'build', route: ['survey', 'build'],
        clock: { survey: [0, 1000], build: [1000, 2000] },
        burn: { survey: [100000, 500000], build: [500000, 650000] },
    });
    const page = station.render(m, {});
    assert.ok(page.includes('400k'), 'the distance between the pair, 500000 - 100000');
    assert.ok(!page.includes('500k'), 'not the raw upper value of the survey pair');
});

test('the page carries an inline script and still no script src', () => {
    const f = fixture();
    const m = station.gather({ configDir: f.cfg });
    const page = station.render(m, {});
    assert.ok(page.includes('<script>'), 'the controls ship as an inline script');
    assert.ok(!page.includes('<script src='), 'the page loads no external script');
});

test('each row carries the attributes the script sorts on', () => {
    const f = fixture();
    const m = station.gather({ configDir: f.cfg });
    const page = station.render(m, {});
    const rows = page.match(/<details class="s[^>]*>/g) || [];
    assert.equal(rows.length, 3, 'one details tag per session in the fixture');
    for (const r of rows) {
        assert.match(r, /data-updated="\d+"/, r);
        assert.match(r, /data-started="\d+"/, r);
        assert.match(r, /data-cost="[\d.]+"/, r);
        assert.match(r, /data-stage="[a-z]*"/, r);
    }
});

test('data-text is written lower-cased', () => {
    const m = chartFixture('12121212-1212-4212-8212-121212121212', {
        task: 'Live One', stage: 'Build', route: ['survey', 'build'],
    });
    const page = station.render(m, {});
    const found = page.match(/data-text="([^"]*)"/);
    assert.ok(found, 'a data-text attribute is present');
    assert.ok(found[1].includes('live one'), found[1]);
    assert.ok(!found[1].includes('Live One'), found[1]);
});

test('each registry wraps its rows in one .rows div', () => {
    const f = fixture();
    const gone = path.join(f.base, 'gone-registry');
    badge.writeLead(f.cfg, DOWN, { word: 'land', root: gone });
    const m = station.gather({ configDir: f.cfg });
    assert.ok(m.registries.some((r) => r.gone), 'the fixture includes a gone registry');
    const notGone = m.registries.filter((r) => !r.gone).length;
    const page = station.render(m, {});
    assert.equal((page.match(/<div class="rows">/g) || []).length, notGone);
});

test('the auto-refresh control appears only when serving', () => {
    const f = fixture();
    const m = station.gather({ configDir: f.cfg });
    const notServed = station.render(m, {});
    const served = station.render(m, { serve: true, nonce: 'n0nce' });
    assert.ok(!notServed.includes('id="auto"'), 'no auto-refresh outside serve');
    assert.ok(served.includes('id="auto"'), 'auto-refresh appears when serving');
});
