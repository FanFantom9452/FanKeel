'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
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
// A root that has gone is already rendered as `gone` on the page; forgetting it
// as well would mean the page silently stops mentioning a registry the user may
// still be looking for, so nothing here is ever dropped for age any more.
test('discover reads roots.json; write stamps the present and keeps the gone, however old', () => {
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
    assert.ok(path.resolve(old) in roots, 'a root gone for 31 days is kept, not forgotten');
    assert.equal(roots[path.resolve(old)], new Date(now - 31 * DAY).toISOString(), 'and keeps its own old stamp, unchanged');
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

// `scanRoots` now returns `{ roots, depthCuts, timedOut }` rather than a bare
// array, and SCAN_DEPTH moved from 6 to 8 (Task 6), so the nine-level fixture
// below — one level past the new default — is what now proves depth still
// bounds the walk; a seven-level fixture no longer would, since 8 reaches it.
test('scanRoots finds a registry two levels down, skips node_modules and dot-directories, and stops at its depth', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-station-scan-'));
    const deep = path.join(base, 'a', 'b');
    registry.ensureLayout(deep);
    registry.ensureLayout(path.join(base, 'node_modules', 'pkg'));
    registry.ensureLayout(path.join(base, '.hidden', 'ws'));
    const far = path.join(base, '1', '2', '3', '4', '5', '6', '7', '8', '9');
    registry.ensureLayout(far);
    const found = station.scanRoots(base);
    assert.deepEqual(found.roots, [path.resolve(deep)],
        'the two-level registry is found; node_modules, dot-directories and the nine-level one are not');
    const discovered = station.discover({ configDir: path.join(base, 'cfg'), scan: [base] });
    assert.ok(discovered.roots.includes(path.resolve(deep)));
});

test('scanRoots finds a registry seven levels down', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-station-scan-deep-'));
    const deep = path.join(base, '1', '2', '3', '4', '5', '6', '7');
    registry.ensureLayout(deep);
    const found = station.scanRoots(base);
    assert.ok(found.roots.includes(path.resolve(deep)), 'depth 8 reaches seven levels down; depth 6 did not');
});

// The seven- and two-level tests above only prove SCAN_DEPTH is somewhere in
// {7, 8} — both still pass at depth 7. These two pin it to 8 from each side.
test('scanRoots finds a registry exactly eight levels down', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-station-scan-depth8-'));
    const deep = path.join(base, '1', '2', '3', '4', '5', '6', '7', '8');
    registry.ensureLayout(deep);
    const found = station.scanRoots(base);
    assert.ok(found.roots.includes(path.resolve(deep)), 'depth 8 reaches eight levels down; depth 7 would not');
});

test('scanRoots does not find a registry nine levels down', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-station-scan-depth9-'));
    const deep = path.join(base, '1', '2', '3', '4', '5', '6', '7', '8', '9');
    registry.ensureLayout(deep);
    const found = station.scanRoots(base);
    assert.ok(!found.roots.includes(path.resolve(deep)), 'depth 8 does not reach nine levels down; depth 9 would');
});

// A deadline already spent — `Date.now() - 1`, which is all this test used to
// pass — returns on the first line of `walk`, before a single `readdirSync`.
// An implementation that checked the deadline once before the walk began would
// have passed that identically, so the arm proved nothing about the check being
// inside the recursion. `opts.now` is the seam that fixes it: a counting clock
// spends the deadline *between* two directories, so the walk must have read
// `base`, descended a level, and checked again. Under the once-at-entry
// mutation the first tick passes, the walk runs to the end, and both
// `timedOut` and the empty root list below are wrong.
test('scanRoots stops mid-walk when its deadline is spent, and says so', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-station-scan-deadline-'));
    const deep = path.join(base, 'a', 'b');
    registry.ensureLayout(deep);
    let tick = 0;
    const found = station.scanRoots(base, undefined, { deadline: 1, now: () => ++tick });
    assert.equal(found.timedOut, true, 'the walk says it ran out of time');
    assert.ok(tick > 1, 'the clock was read more than once: the check sits inside the recursion');
    assert.deepEqual(found.roots, [], 'the registry two levels down is never reached');
    // The control on the fixture itself: the same tree, walked with a clock that
    // never passes the deadline, does find the registry — so the empty list
    // above is the deadline's doing and not an unfindable fixture.
    assert.deepEqual(station.scanRoots(base, undefined, { deadline: 1, now: () => 0 }).roots,
        [path.resolve(deep)], 'a clock that never passes the deadline walks the whole tree');
    // And a deadline already spent still returns nothing rather than a partial
    // list — the property the old arm did test, kept.
    const spent = station.scanRoots(base, undefined, { deadline: Date.now() - 1 });
    assert.equal(spent.timedOut, true);
    assert.deepEqual(spent.roots, [], 'a deadline already spent finds nothing, not a partial list');
});

test('scanRoots counts the places depth cut it', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-station-scan-cuts-'));
    registry.ensureLayout(path.join(base, '1', '2', '3', '4', '5', '6', '7', '8', '9'));
    const found = station.scanRoots(base, 2);
    assert.ok(found.depthCuts > 0, 'a walk nine deep at depth two is cut before it reaches the registry');
});

test('the header reports a scan that ran out of time', () => {
    const model = {
        generatedAt: new Date().toISOString(), configDir: '', pricesVerified: 'n/a',
        registries: [], scanStats: { depthCuts: 3, timedOut: true },
    };
    const page = station.render(model, {});
    assert.match(page, /the scan ran out of time/);
    assert.match(page, /depth stopped the scan in 3 places/);
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
    // Counting the points says nothing about where they are. Swapping the pair
    // in `burnPts.push` — `w.burn[1]` first, then `w.burn[0]` — still pushes six
    // points, and every burn curve on the page then descends through each stage
    // instead of climbing, which is the one series this whole change is for. So
    // the coordinates are pinned exactly, the way the spend polyline's are:
    // x is 4/108/212/316 across a 3000ms span, and y falls from 86 (0 tokens)
    // to 4 (400k, the maximum) as burn climbs.
    assert.equal(burnLine[1], '4.0,86.0 108.0,65.5 108.0,65.5 212.0,34.8 212.0,34.8 316.0,4.0',
        'the curve climbs: each stage opens where the last one closed, and y descends as burn rises');
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

// The design names five columns — stage, minutes, burn, spend, waited — and
// `waited` is the field addition it calls area 2's only one. Positions are
// pinned rather than the words alone: a `waited` header over a column printing
// something else, or the value landing in the spend cell, both satisfy a bare
// `includes('waited')`.
test('the stage table prints five columns, the last of them what the stage waited', () => {
    const m = chartFixture('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
        task: 'a gate in survey', stage: 'build', route: ['survey', 'build'],
        clock: { survey: [0, 60000], build: [60000, 180000] },
        burn: { survey: [0, 50000], build: [50000, 120000] },
        waited: { survey: 240000, build: 0 },
    });
    const page = station.render(m, {});
    assert.ok(page.includes('<tr><th>stage</th><th>mins</th><th>burn</th><th>spend</th><th>waited</th></tr>'),
        'five headers, waited last');
    assert.ok(page.includes('<tr><td>survey</td><td>1m</td><td>50k</td><td>—</td><td>4m</td></tr>'),
        'the four minutes survey spent at a gate print in the fifth cell, not the fourth');
    assert.ok(page.includes('<tr><td>build</td><td>2m</td><td>70k</td><td>—</td><td>—</td></tr>'),
        'a stage whose only wait measured zero prints an em dash, not 0m');
});

test('the spend polyline plots a running total across stages, not each stage\'s own usd', () => {
    // Three stages, one priced by `prices.costOf`, the middle one uninvoiced.
    // A running total of $1 then $3 only comes from `running += w.usd`
    // carrying the total across the null-usd stage; plotting each stage's own
    // usd, or letting a null-usd stage clear the total, both collapse the
    // final figure to $2 — see the mutation notes in the Task 4 report.
    const m = chartFixture('11111111-8888-4888-8888-888888888888', {
        task: 'real spend, three stages', stage: 'verify', route: ['survey', 'build', 'verify'],
        clock: { survey: [0, 1000], build: [1000, 2000], verify: [2000, 3000] },
        burn: { survey: [0, 50000], build: [50000, 90000], verify: [90000, 140000] },
        spend: {
            survey: { requests: 1, models: { 'claude-sonnet-5': { input: 500000, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } } },
            verify: { requests: 1, models: { 'claude-sonnet-5': { input: 1000000, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } } },
        },
    });
    const page = station.render(m, {});
    assert.ok(page.includes('spend</span> to $3.00'), 'the legend totals the running sum, not the last stage priced');
    const spendLine = page.match(/<polyline class="spend" points="([^"]+)"/);
    assert.ok(spendLine, 'a spend polyline is drawn');
    assert.equal(spendLine[1], '4.0,86.0 108.0,58.7 212.0,58.7 316.0,4.0',
        'the two middle points sit at the level survey alone reached ($1 of $3), not at $0 or at $2');
});

// Each series is normalised to its own maximum, so on every row carrying both
// they end at the same pixel and colour alone has to carry the distinction
// where they overlap. The dash is what the ruling settled on instead of a
// fallback to one series: the burn line stays solid, so the pair is told apart
// by shape as well as by hue.
test('the spend polyline is drawn dashed and the burn polyline is not', () => {
    const m = chartFixture('44444444-bbbb-4bbb-8bbb-bbbbbbbbbbbb', {
        task: 'both series', stage: 'build', route: ['survey', 'build'],
        clock: { survey: [0, 1000], build: [1000, 2000] },
        burn: { survey: [0, 50000], build: [50000, 120000] },
        spend: {
            survey: { requests: 1, models: { 'claude-sonnet-5': { input: 500000, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } } },
            build: { requests: 1, models: { 'claude-sonnet-5': { input: 1000000, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } } },
        },
    });
    const page = station.render(m, {});
    assert.match(page, /<polyline class="burn"/, 'the fixture draws both series');
    assert.match(page, /<polyline class="spend"/, 'the fixture draws both series');
    const spendRule = /svg\.curve polyline\.spend\{([^}]*)\}/.exec(page);
    assert.ok(spendRule, 'the spend polyline has a rule of its own');
    assert.match(spendRule[1], /stroke-dasharray:\s*\S/, 'the spend line is dashed');
    const burnRule = /svg\.curve polyline\.burn\{([^}]*)\}/.exec(page);
    assert.ok(burnRule, 'the burn polyline has a rule of its own');
    assert.ok(!/stroke-dasharray/.test(burnRule[1]), 'the burn line stays solid, so the dash means spend');
});

// The defect this closes: the curve plotted the parent's requests alone while
// the cost cell directly above it printed `$X + $Y (N agents)`. Measured on a
// real run, the curve said $0.83 of a session that cost $2.22. Every figure
// below is chosen so the parent's own total, the agents' own total and the sum
// are three different numbers: reading either half alone cannot produce $4.00.
const M = (model, input) => ({ [model]: { input, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } });

test('the curve and the stage table price the agents of a stage as well as its parent', () => {
    const m = chartFixture('55555555-cccc-4ccc-8ccc-cccccccccccc', {
        task: 'parent and agents', stage: 'build', route: ['survey', 'build'],
        clock: { survey: [0, 1000], build: [1000, 2000] },
        burn: { survey: [0, 50000], build: [50000, 120000] },
        spend: {
            // $1 of parent and $1 of agents.
            survey: { requests: 1, models: M('claude-sonnet-5', 500000), subagents: { requests: 3, models: M('claude-sonnet-5', 500000) } },
            // No parent requests at all in this window: $2 of agents alone.
            build: { requests: 0, models: {}, subagents: { requests: 2, models: M('claude-sonnet-5', 1000000) } },
        },
    });
    const stages = m.registries[0].sessions[0].stages;
    assert.equal(stages[0].usd, 2, 'the parent\'s dollar and the agents\' dollar, added');
    assert.equal(stages[1].usd, 2, 'a stage the parent spent nothing in still carries what its agents spent');

    const page = station.render(m, {});
    assert.ok(page.includes('spend</span> to $4.00'), 'the legend totals both halves; the parent alone is $1.00');
    assert.ok(page.includes('<tr><td>survey</td><td>0m</td><td>50k</td><td>$2.00</td><td>—</td></tr>'),
        'one spend column, parent and agents together, in the fourth cell');
    assert.ok(page.includes('<tr><td>build</td><td>0m</td><td>70k</td><td>$2.00</td><td>—</td></tr>'));
    const spendLine = page.match(/<polyline class="spend" points="([^"]+)"/);
    assert.ok(spendLine, 'a spend polyline is drawn');
    // Four points across a 2000ms span, climbing $0 → $2 → $4 against a $4
    // maximum: the midpoint sits at half height. Plotting the parent alone puts
    // it at 45.0 with the same point count, so the coordinates are pinned.
    assert.equal(spendLine[1], '4.0,86.0 160.0,45.0 160.0,45.0 316.0,4.0');
});

test('a stage priced on one side only keeps that side rather than falling to null', () => {
    // The parent's model has no rate; the agents' does. `priced.length` is zero
    // on one `costOf` and not the other, and reading only the parent's would
    // print an em dash over $2.50 that was really spent.
    const m = chartFixture('66666666-dddd-4ddd-8ddd-dddddddddddd', {
        task: 'half priced', stage: 'build', route: ['survey', 'build'],
        clock: { survey: [0, 1000], build: [1000, 2000] },
        burn: { survey: [0, 50000], build: [50000, 120000] },
        spend: {
            survey: { requests: 1, models: M('claude-nonesuch-9', 9000000), subagents: { requests: 1, models: M('claude-opus-5', 500000) } },
        },
    });
    assert.equal(m.registries[0].sessions[0].stages[0].usd, 2.5, 'the unpriced parent contributes nothing, the priced agents contribute all of it');
    const page = station.render(m, {});
    assert.ok(page.includes('spend</span> to $2.50'));
});

test('a stage priced by no rate in the table is blank, not free', () => {
    // Same three stages and the same two priced figures as the test above, with
    // the middle stage carrying a model `lib/prices.js` has no rate for instead
    // of carrying no spend at all. `costOf` answers `usd: 0` for it — the same
    // number a stage that genuinely cost nothing would get — so reading `.usd`
    // without checking `priced.length` prints `$0.00` in the table and plants a
    // real point on the cumulative curve. Both are checked here: the fixed
    // spend polyline is the four-point one, identical to the no-spend case
    // above, because an unpriced stage is stepped over rather than plotted.
    const m = chartFixture('22222222-9999-4999-8999-999999999999', {
        task: 'one unpriced stage', stage: 'verify', route: ['survey', 'build', 'verify'],
        clock: { survey: [0, 1000], build: [1000, 2000], verify: [2000, 3000] },
        burn: { survey: [0, 50000], build: [50000, 90000], verify: [90000, 140000] },
        spend: {
            survey: { requests: 1, models: { 'claude-sonnet-5': { input: 500000, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } } },
            build: { requests: 1, models: { 'claude-nonesuch-9': { input: 9000000, output: 9000000, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } } },
            verify: { requests: 1, models: { 'claude-sonnet-5': { input: 1000000, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } } },
        },
    });
    assert.equal(m.registries[0].sessions[0].stages[1].usd, null,
        'the unpriced stage carries no dollar figure at all, rather than zero');
    const page = station.render(m, {});
    assert.ok(!page.includes('$0.00'), 'no stage is printed as having cost nothing');
    assert.match(page, /<td>build<\/td>[\s\S]*?<td>—<\/td><\/tr>/, 'the unpriced stage prints an em dash in the spend column');
    assert.ok(page.includes('spend</span> to $3.00'), 'the two priced stages still total $3');
    const spendLine = page.match(/<polyline class="spend" points="([^"]+)"/);
    assert.ok(spendLine, 'a spend polyline is still drawn from the stages that are priced');
    assert.equal(spendLine[1], '4.0,86.0 108.0,58.7 212.0,58.7 316.0,4.0',
        'the unpriced stage contributes no point: four, not six');
});

// Finding 1 of the whole-branch review: the two scan-cut lines in the header
// were reachable only from a model built by hand. `discover` called `scanRoots`
// with no options, so every `--scan` walk ran at `deadline: Infinity` and
// `timedOut` could not become true; and the one walk that did carry a deadline
// — `autoScan` in `scripts/station.js` — printed its counts and threw them
// away. These two tests take the two production routes.
test('discover forwards a deadline into the scan, and the header says the scan ran out of time', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-station-scan-deadline-page-'));
    registry.ensureLayout(path.join(base, 'a', 'b'));
    const m = station.gather({ configDir: path.join(base, 'cfg'), scan: [base], deadline: Date.now() - 1 });
    assert.equal(m.scanStats.timedOut, true, 'the deadline reaches scanRoots through discover');
    assert.match(station.render(m, {}), /the scan ran out of time/);
});

test('a caller that walked the machine itself hands its counts to the page write() produces', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-station-scanstats-'));
    const cfg = path.join(base, 'cfg');
    // No `scan` at all: these numbers can only have come from `opts.scanStats`,
    // which is how `scripts/station.js` hands `autoScan`'s own walk in.
    const out = station.write({ configDir: cfg, cwd: base, scanStats: { depthCuts: 7, timedOut: true } });
    const page = fs.readFileSync(out.file, 'utf8');
    assert.match(page, /depth stopped the scan in 7 places/);
    assert.match(page, /the scan ran out of time/);
});

// Finding 3 of the same review: `scripts/station.js` wrote `scannedAt` back
// after every run and claimed that was what made the record durable. It was
// not — the next `station.write()`, which every `/fankeel` prompt runs, rebuilt
// roots.json through `rememberRoots` and dropped the key. The durability is
// real now, and this is where it is pinned.
test('a write of the page keeps every key in roots.json that is not a root record', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-station-scanrec-'));
    const cfg = path.join(base, 'cfg');
    const ws = path.join(base, 'ws');
    registry.ensureLayout(ws);
    const file = station.rootsPath(cfg);
    const scannedAt = { at: new Date().toISOString(), roots: 4, depthCuts: 2, timedOut: true };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ [path.resolve(ws)]: new Date().toISOString(), scannedAt }, null, 2) + '\n');

    station.write({ configDir: cfg, roots: [ws], cwd: base });

    const after = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(after.scannedAt, scannedAt, 'the scan record survives a write of the page');
    assert.ok(typeof after[path.resolve(ws)] === 'string', 'and the root it was sitting beside is still remembered');
    assert.deepEqual(Object.keys(station.readRoots(cfg)), [path.resolve(ws)],
        'readRoots still sees one root: the carried key is not mistaken for one');
});

// `includes('<script>')` proves a tag exists and nothing about what is in it:
// an empty pair satisfies it and the page ships with no controls at all. What
// the page has to carry is the exact string `lib/station.js` exports and the
// vm tests below execute.
test('the page carries the exported SCRIPT inline, as its only script, and no script src', () => {
    const f = fixture();
    const m = station.gather({ configDir: f.cfg });
    const page = station.render(m, {});
    assert.ok(station.SCRIPT.length > 200, 'SCRIPT is the controls, not an empty string');
    assert.ok(page.includes('<script>' + station.SCRIPT + '</script>'),
        'the tag holds the exported SCRIPT, character for character');
    assert.equal((page.match(/<script/g) || []).length, 1, 'and it is the only script on the page');
    assert.ok(!page.includes('<script src='), 'the page loads no external script');
});

// `lib/station.js` explains the inline script by naming the assertion above by
// file and line. A line number in a comment drifts every time a test is added
// above it, and nothing executes a comment, so it drifted once already — it
// said `:91` after the assertion had moved to `:92`. This reads the citation
// out of the source and checks the line it points at, so the next drift is a
// red test rather than a reader sent to the wrong line.
test('the source comment explaining the inline script cites the line that actually asserts it', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'station.js'), 'utf8');
    const cited = source.match(/tests\/station\.test\.js:(\d+)/);
    assert.ok(cited, 'lib/station.js cites the assertion by file and line');
    const lines = fs.readFileSync(__filename, 'utf8').split('\n');
    assert.ok(lines[Number(cited[1]) - 1].includes("'<script src='"),
        `lib/station.js cites tests/station.test.js:${cited[1]}, which does not assert on '<script src='`);
});

// `class="bar"` appearing once counts the wrapper div and nothing inside it:
// the bar could ship empty — no filter box, no buttons, no counter — and still
// satisfy that count. These are the controls themselves.
test('the control bar carries the filter box, four sort buttons and the shown counter', () => {
    const f = fixture();
    const m = station.gather({ configDir: f.cfg });
    const page = station.render(m, {});
    assert.equal((page.match(/<div class="bar">/g) || []).length, 1, 'one bar for the whole page');
    const bar = /<div class="bar">([\s\S]*?)<\/div>/.exec(page);
    assert.ok(bar, 'the bar is a closed div');
    assert.match(bar[1], /<input type="search" id="q"/, 'the filter box the script reads');
    assert.deepEqual(bar[1].match(/data-sort="[a-z]+"/g) || [],
        ['data-sort="updated"', 'data-sort="started"', 'data-sort="cost"', 'data-sort="stage"'],
        'four sort buttons, in the order the design names them');
    assert.equal((bar[1].match(/aria-pressed="true"/g) || []).length, 1,
        'exactly one of them starts pressed');
    assert.match(bar[1], /id="shown"/, 'the counter the script writes the shown total into');
    assert.ok(!bar[1].includes('id="auto"'), 'and no auto-refresh box on the static page');
    const served = /<div class="bar">([\s\S]*?)<\/div>/
        .exec(station.render(m, { serve: true, nonce: 'n0nce' }))[1];
    assert.match(served, /id="auto"/, 'the served page adds the auto-refresh checkbox to the same bar');
});

// A shape-only regex (`\d+`, `[a-z]*`) passes on "0" everywhere or on an empty
// `data-stage=""` — `*` allows zero characters. This checks the value each
// attribute actually carries against what that session's own record says, so
// a wrong field, a swapped session, or a blanked-out value fails it.
test('each row carries the attributes belonging to that session, not just numeric shape', () => {
    const f = fixture();
    const m = station.gather({ configDir: f.cfg });
    const page = station.render(m, {});
    const blocks = page.match(/<details class="s[^"]*"[^>]*>[\s\S]*?<\/details>/g) || [];
    assert.equal(blocks.length, 3, 'one details block per session in the fixture');
    const cases = [
        { id: LIVE, root: f.r1, cost: '0', state: 'live' },
        { id: STALE, root: f.r1, cost: '0', state: 'stale' },
        { id: DOWN, root: f.r2, cost: '12', state: 'down' },
    ];
    for (const c of cases) {
        const block = blocks.find((b) => b.includes('<code>' + c.id + '</code>'));
        assert.ok(block, 'a details block exists for ' + c.id);
        const data = registry.readSession(c.root, c.id);
        const updated = String(Date.parse(data.updated) || 0);
        const started = String(Date.parse(data.started) || 0);
        assert.match(block, new RegExp('data-updated="' + updated + '"'), c.id + ' data-updated should be ' + updated);
        assert.match(block, new RegExp('data-started="' + started + '"'), c.id + ' data-started should be ' + started);
        assert.match(block, new RegExp('data-cost="' + c.cost + '"'), c.id + ' data-cost should be ' + c.cost);
        assert.match(block, new RegExp('data-stage="' + data.stage + '"'), c.id + ' data-stage should be ' + data.stage);
        assert.match(block, new RegExp('data-state="' + c.state + '"'), c.id + ' data-state should be ' + c.state);
    }
    // The stages differ across the three fixture sessions (build/design/land),
    // so a bug that writes the same stage everywhere, or an empty string,
    // could not satisfy all three assertions above.
    assert.equal(new Set(cases.map((c) => registry.readSession(c.root, c.id).stage)).size, 3);
    // The same argument for the sixth attribute: the fixture's three sessions
    // are one of each state, so `data-state` cannot be satisfied by a constant.
    assert.equal(new Set(cases.map((c) => c.state)).size, 3);
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

test('a registry with a stale row gets a /clear-stale button, naming the count, only when serving', () => {
    const f = fixture();
    const m = station.gather({ configDir: f.cfg });
    const notServed = station.render(m, {});
    const served = station.render(m, { serve: true, nonce: 'n0nce' });
    assert.ok(!notServed.includes('action="/clear-stale"'), 'no bulk-clear form outside serve');
    assert.ok(served.includes('action="/clear-stale"'), 'a bulk-clear form appears when serving');
    assert.match(served, /clear all 1 stale/, 'the button names the stale count for that registry');
    // Only r1 has a stale row (STALE); r2 (down two) has none, so it gets no button.
    assert.equal((served.match(/action="\/clear-stale"/g) || []).length, 1,
        'only the registry that actually has a stale row gets the button');
});

test('the auto-refresh control appears only when serving', () => {
    const f = fixture();
    const m = station.gather({ configDir: f.cfg });
    const notServed = station.render(m, {});
    const served = station.render(m, { serve: true, nonce: 'n0nce' });
    assert.ok(!notServed.includes('id="auto"'), 'no auto-refresh outside serve');
    assert.ok(served.includes('id="auto"'), 'auto-refresh appears when serving');
});

// The markup tests above prove the DOM contract exists; they never run the
// script that reads it, so a reversed comparator or a broken filter would
// leave all of them green. This stub implements only what `station.SCRIPT`
// actually calls: getElementById, querySelectorAll, addEventListener,
// getAttribute, setAttribute, appendChild, `.hidden` and `.textContent`.
// The script itself runs for real, inside `node:vm` (built in, no
// dependency), as the exact string `lib/station.js` exports and ships —
// never a re-typed copy that could drift from it.
function makeEl(attrs) {
    const el = {
        attrs: Object.assign({}, attrs),
        children: [],
        parent: null,
        hidden: false,
        textContent: '',
        value: '',
        checked: false,
        listeners: {},
        getAttribute(name) {
            return Object.prototype.hasOwnProperty.call(el.attrs, name) ? el.attrs[name] : null;
        },
        setAttribute(name, v) { el.attrs[name] = String(v); },
        addEventListener(type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
        fire(type) { (el.listeners[type] || []).forEach((fn) => fn.call(el)); },
        appendChild(child) {
            if (child.parent) {
                const i = child.parent.children.indexOf(child);
                if (i !== -1) child.parent.children.splice(i, 1);
            }
            child.parent = el;
            el.children.push(child);
            return child;
        },
    };
    return el;
}

// Four sort keys, each producing a different order, so a mis-sort on any one
// key cannot hide behind another key happening to land on the same order:
// updated desc -> [b,c,a]; started desc -> [a,b,c]; cost desc -> [c,a,b];
// stage asc -> [b,a,c].
// `opts.auto` adds the auto-refresh checkbox the served page carries and the
// static file does not, so both sides of SCRIPT's `if(auto)` are reachable.
function buildStub(opts) {
    // No `data-text` contains the word in its own `data-state`, so a filter term
    // of `live`, `stale` or `down` can only match through the state attribute.
    const a = makeEl({ 'data-updated': '100', 'data-started': '500', 'data-cost': '2', 'data-stage': 'build', 'data-state': 'live', 'data-text': 'alpha one' });
    const b = makeEl({ 'data-updated': '300', 'data-started': '200', 'data-cost': '1', 'data-stage': 'ares', 'data-state': 'stale', 'data-text': 'beta two' });
    const c = makeEl({ 'data-updated': '200', 'data-started': '100', 'data-cost': '3', 'data-stage': 'verify', 'data-state': 'down', 'data-text': 'gamma three' });
    const group = makeEl({});
    group.appendChild(a); group.appendChild(b); group.appendChild(c);
    const q = makeEl({});
    const shown = makeEl({});
    const mkBtn = (k, pressed) => makeEl({ 'data-sort': k, 'aria-pressed': pressed ? 'true' : 'false' });
    const buttons = {
        updated: mkBtn('updated', true),
        started: mkBtn('started', false),
        cost: mkBtn('cost', false),
        stage: mkBtn('stage', false),
    };
    const auto = opts && opts.auto ? makeEl({ type: 'checkbox' }) : null;
    const byId = { q, shown };
    if (auto) byId.auto = auto;
    const doc = {
        getElementById: (id) => byId[id] || null,
        querySelectorAll: (sel) => {
            if (sel === '.rows') return [group];
            if (sel === '.bar button[data-sort]') return Object.values(buttons);
            throw new Error('stub does not implement selector: ' + sel);
        },
    };
    return { doc, group, rows: { a, b, c }, q, shown, buttons, auto };
}

// Runs the real, exported SCRIPT string against the stub DOM. The three globals
// the auto-refresh branch uses are recorded rather than swallowed: that branch
// is a timer, a cancel and a reload, and a stub returning nothing from all
// three leaves it with nothing to assert against.
function runScript(doc) {
    const timers = { set: [], cleared: [], reloads: 0 };
    let handle = 0;
    const sandbox = {
        document: doc,
        setTimeout: (fn, ms) => { timers.set.push({ fn, ms }); return ++handle; },
        clearTimeout: (t) => { timers.cleared.push(t); },
        location: { reload: () => { timers.reloads += 1; } },
    };
    vm.createContext(sandbox);
    vm.runInContext(station.SCRIPT, sandbox);
    sandbox.timers = timers;
    return sandbox;
}

const textOrder = (group) => group.children.map((el) => el.attrs['data-text']);

test('SCRIPT sorts by updated, descending, as soon as it loads', () => {
    const s = buildStub();
    runScript(s.doc);
    assert.deepEqual(textOrder(s.group), ['beta two', 'gamma three', 'alpha one']);
    assert.equal(s.shown.textContent, '3 shown');
});

test('typing in the filter hides non-matching rows and updates the shown count', () => {
    const s = buildStub();
    runScript(s.doc);
    s.q.value = 'beta';
    s.q.fire('input');
    assert.equal(s.rows.a.hidden, true);
    assert.equal(s.rows.b.hidden, false);
    assert.equal(s.rows.c.hidden, true);
    assert.equal(s.shown.textContent, '1 of 3 shown');
});

// This is what reads `data-state`. The design lists it as the sixth attribute
// on every row and names no consumer; written and read by nothing it would be
// markup nobody can use, so the filter matches it beside `data-text` and the
// three state words become filter terms.
test('the filter matches a row on its state as well as on its text', () => {
    const s = buildStub();
    runScript(s.doc);
    s.q.value = 'stale';
    s.q.fire('input');
    assert.equal(s.rows.b.hidden, false, 'the stale row matches, and no data-text contains "stale"');
    assert.equal(s.rows.a.hidden, true);
    assert.equal(s.rows.c.hidden, true);
    assert.equal(s.shown.textContent, '1 of 3 shown');
    s.q.value = 'down';
    s.q.fire('input');
    assert.deepEqual([s.rows.a.hidden, s.rows.b.hidden, s.rows.c.hidden], [true, true, false],
        'a second state term picks out a different single row');
});

test('clicking a sort button reorders the rows within its .rows group', () => {
    const s = buildStub();
    runScript(s.doc);
    s.buttons.cost.fire('click');
    assert.deepEqual(textOrder(s.group), ['gamma three', 'alpha one', 'beta two'], 'cost descending: c(3), a(2), b(1)');
    assert.equal(s.buttons.cost.attrs['aria-pressed'], 'true');
    assert.equal(s.buttons.updated.attrs['aria-pressed'], 'false');
});

test('clicking the same sort button twice reverses the order', () => {
    const s = buildStub();
    runScript(s.doc);
    s.buttons.cost.fire('click');
    const first = textOrder(s.group);
    s.buttons.cost.fire('click');
    const second = textOrder(s.group);
    assert.deepEqual(first, ['gamma three', 'alpha one', 'beta two']);
    assert.deepEqual(second, ['beta two', 'alpha one', 'gamma three'], 'reversed: b(1), a(2), c(3)');
});

test('stage starts ascending on its first click while a numeric key starts descending', () => {
    const stageStub = buildStub();
    runScript(stageStub.doc);
    stageStub.buttons.stage.fire('click');
    assert.deepEqual(textOrder(stageStub.group), ['beta two', 'alpha one', 'gamma three'], 'ares < build < verify');

    const numericStub = buildStub();
    runScript(numericStub.doc);
    numericStub.buttons.started.fire('click');
    assert.deepEqual(textOrder(numericStub.group), ['alpha one', 'beta two', 'gamma three'], 'started descending: a(500), b(200), c(100)');
});

test('ticking auto-refresh arms a thirty-second reload, and unticking it cancels', () => {
    const s = buildStub({ auto: true });
    const sandbox = runScript(s.doc);
    assert.deepEqual(sandbox.timers.set, [], 'nothing is scheduled while the box is clear');
    s.auto.checked = true;
    s.auto.fire('change');
    assert.equal(sandbox.timers.set.length, 1, 'ticking it schedules exactly one timer');
    assert.equal(sandbox.timers.set[0].ms, 30000, 'thirty seconds, the interval the served page promises');
    sandbox.timers.set[0].fn();
    assert.equal(sandbox.timers.reloads, 1, 'and what it scheduled is a reload of the page');
    s.auto.checked = false;
    s.auto.fire('change');
    assert.deepEqual(sandbox.timers.cleared, [1], 'unticking cancels the timer that ticking armed');
    assert.equal(sandbox.timers.set.length, 1, 'and schedules nothing in its place');
});

test('the static page has no auto-refresh control and the script runs without one', () => {
    const s = buildStub();
    assert.equal(s.doc.getElementById('auto'), null, 'the file on disk ships no checkbox');
    const sandbox = runScript(s.doc);
    assert.deepEqual(sandbox.timers.set, [], 'so nothing is ever scheduled');
    assert.equal(s.shown.textContent, '3 shown', 'and the rest of the script still ran');
});
