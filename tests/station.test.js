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
const tmp = require('./tmp.js');

const LIVE = 'aaaaaaaa-1111-4111-8111-111111111111';
const STALE = 'bbbbbbbb-2222-4222-8222-222222222222';
const DOWN = 'cccccccc-3333-4333-8333-333333333333';
const DAY = 24 * 3600e3;

// Two registries, one config dir. One session is running (this process's pid),
// one is active with nobody behind it, one is stood down with usage recorded.
function fixture() {
    const base = tmp('fankeel-station-');
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
// A registry of its own per test below, rather than the shared fixture: each
// one exercises a different shape of `clock`/`burn`/`spend` and none of them
// should shift the session counts the earlier tests already assert on.
function chartFixture(sessionId, data) {
    const base = tmp('fankeel-station-chart-');
    const root = path.join(base, 'ws');
    registry.ensureLayout(root);
    const now = Date.now();
    registry.writeSession(root, sessionId, Object.assign({
        project: 'ws', active: false, claims: [],
        started: new Date(now - 3600e3).toISOString(), updated: new Date(now).toISOString(),
    }, data));
    return station.gather({ configDir: path.join(base, 'cfg'), root });
}

// The defect this closes: the curve that used to sit over these rows plotted
// the parent's requests alone while the cost cell beside it printed
// `$X + $Y (N agents)`. Measured on a real run, the curve said $0.83 of a
// session that cost $2.22. Every figure below is chosen so the parent's own
// total, the agents' own total and the sum are three different numbers:
// reading either half alone cannot produce the right one.
const M = (model, input) => ({ [model]: { input, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } });

// This and the next two tests assert on `gather()`'s own return value —
// `stages[i].usd` — and nothing about a page. They were misfiled as markup
// tests once already, by a name that started with "the curve and the stage
// table": that render()-side coverage is gone with the curve and the table,
// but this arithmetic runs before either ever existed and still ships,
// verbatim, through `serialize()` into `station-data.js`.
test('a stage\'s usd sums the parent\'s spend and its agents\', even when the parent spent nothing that window', () => {
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
});

test('a stage priced on one side only keeps that side rather than falling to null', () => {
    // The agents' model has no rate; the parent's does. `priced.length` is zero
    // on one `costOf` and not the other, and reading only the agents' would
    // print an em dash over $2.50 that was really spent.
    const m = chartFixture('66666666-dddd-4ddd-8ddd-dddddddddddd', {
        task: 'half priced', stage: 'build', route: ['survey', 'build'],
        clock: { survey: [0, 1000], build: [1000, 2000] },
        burn: { survey: [0, 50000], build: [50000, 120000] },
        spend: {
            survey: { requests: 1, models: M('claude-opus-5', 500000), subagents: { requests: 1, models: M('claude-nonesuch-9', 9000000) } },
        },
    });
    assert.equal(m.registries[0].sessions[0].stages[0].usd, 2.5, 'the priced parent contributes all of it, the unpriced agents contribute nothing');
});

test('a stage priced by no rate anywhere gets null from gather(), not zero', () => {
    // Same shape as the test above, with the middle stage carrying a model
    // `lib/prices.js` has no rate for instead of carrying no spend at all.
    // `costOf` answers `usd: 0` for it — the same number a stage that
    // genuinely cost nothing would get — so reading `.usd` without checking
    // `priced.length` cannot tell the two apart.
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
});

// `serialize()` used to read a stage's two token counts and subtract them
// itself; a stage sampled backwards reached the page as a negative number.
// It now routes the pair through `registry.burnOf`, the helper that already
// nulls a spend that is not positive, so a record with a negative delta
// reads the same on the page as one never sampled at all.
test('serialize nulls a stage\'s burn when the token count runs backwards, and keeps a positive one', () => {
    const m = chartFixture('88888888-ffff-4fff-8fff-ffffffffffff', {
        task: 'burn clamp', stage: 'build', route: ['survey', 'build'],
        clock: { survey: [0, 1000], build: [1000, 2000] },
        burn: { survey: [50000, 20000], build: [50000, 120000] },
    });
    const data = JSON.parse(station.serialize(m, {})
        .replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
    const stages = data.sessions[0].stages;
    assert.equal(stages.find((s) => s.stage === 'survey').burn, null,
        'a token count that runs backwards reads as no burn, not a negative number');
    assert.equal(stages.find((s) => s.stage === 'build').burn, 70000,
        'a positive delta still reaches the page as a number');
});

test('serialize carries every task\'s text, the price date, and the plugin path for the offline clear command', () => {
    const f = fixture();
    const m = station.gather({ configDir: f.cfg });
    const data = JSON.parse(station.serialize(m, { plugin: 'C:/plug' })
        .replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
    for (const t of ['live one', 'stale one', 'down two']) {
        assert.ok(data.sessions.some((s) => s.task === t), t);
    }
    assert.match(data.pricesVerified, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(data.sessions.find((s) => s.id === DOWN).agents, 2);
    assert.equal(data.plugin, 'C:/plug');
    // The clear control itself is drawn in the browser from these two fields:
    // a session offline has no server to post `/clear` to and no nonce it
    // would need, so both are absent rather than empty strings.
    assert.equal(data.serve, false);
    assert.equal(data.nonce, undefined);
    const served = JSON.parse(station.serialize(m, { serve: true, nonce: 'n0nce' })
        .replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
    assert.equal(served.serve, true);
    assert.equal(served.nonce, 'n0nce');
});

test('write returns the counts and both paths, copies the four files into the caller\'s registry, and ignores them there', () => {
    const f = fixture();
    const out = station.write({ configDir: f.cfg, root: f.r1 });
    assert.equal(out.file, path.join(f.cfg, 'fankeel', 'index.html'));
    assert.equal(out.copy, path.join(f.r1, '.fankeel', 'index.html'));
    assert.deepEqual([out.registries, out.live, out.stale, out.down], [2, 1, 1, 1]);
    assert.ok(fs.readFileSync(path.join(f.r1, '.fankeel', 'station', 'station-data.js'), 'utf8').includes('live one'));
    assert.equal(fs.readFileSync(out.copy, 'utf8'), fs.readFileSync(out.file, 'utf8'));
    const gitignore = () => fs.readFileSync(path.join(f.r1, '.fankeel', '.gitignore'), 'utf8');
    for (const n of ['index.html', 'station/']) {
        assert.match(gitignore(), new RegExp('^' + n.replace('.', '\\.') + '$', 'm'));
    }
    station.write({ configDir: f.cfg, root: f.r1 });
    const lines = gitignore().split(/\r?\n/);
    for (const n of ['index.html', 'station/']) {
        assert.equal(lines.filter((l) => l === n).length, 1, 'a second write does not duplicate ' + n);
    }
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
    // Present on disk but with no `.fankeel/sessions/` — a directory that has
    // gone, not one that was deleted, and Task 3 only forgets the latter.
    fs.mkdirSync(gone);
    fs.mkdirSync(old);
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
    assert.equal(out.copy, path.join(r3, '.fankeel', 'index.html'));
    assert.ok(path.resolve(r3) in station.readRoots(f.cfg));
});

// `scanRoots` now returns `{ roots, depthCuts, timedOut }` rather than a bare
// array, and SCAN_DEPTH moved from 6 to 8 (Task 6), so the nine-level fixture
// below — one level past the new default — is what now proves depth still
// bounds the walk; a seven-level fixture no longer would, since 8 reaches it.
test('scanRoots finds a registry two levels down, skips node_modules and dot-directories, and stops at its depth', () => {
    const base = tmp('fankeel-station-scan-');
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
    const base = tmp('fankeel-station-scan-deep-');
    const deep = path.join(base, '1', '2', '3', '4', '5', '6', '7');
    registry.ensureLayout(deep);
    const found = station.scanRoots(base);
    assert.ok(found.roots.includes(path.resolve(deep)), 'depth 8 reaches seven levels down; depth 6 did not');
});

// The seven- and two-level tests above only prove SCAN_DEPTH is somewhere in
// {7, 8} — both still pass at depth 7. These two pin it to 8 from each side.
test('scanRoots finds a registry exactly eight levels down', () => {
    const base = tmp('fankeel-station-scan-depth8-');
    const deep = path.join(base, '1', '2', '3', '4', '5', '6', '7', '8');
    registry.ensureLayout(deep);
    const found = station.scanRoots(base);
    assert.ok(found.roots.includes(path.resolve(deep)), 'depth 8 reaches eight levels down; depth 7 would not');
});

test('scanRoots does not find a registry nine levels down', () => {
    const base = tmp('fankeel-station-scan-depth9-');
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
    const base = tmp('fankeel-station-scan-deadline-');
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
    const base = tmp('fankeel-station-scan-cuts-');
    registry.ensureLayout(path.join(base, '1', '2', '3', '4', '5', '6', '7', '8', '9'));
    const found = station.scanRoots(base, 2);
    assert.ok(found.depthCuts > 0, 'a walk nine deep at depth two is cut before it reaches the registry');
});

test('serialize carries a scan that ran out of time, and how many places depth cut it', () => {
    const model = {
        generatedAt: new Date().toISOString(), configDir: '', pricesVerified: 'n/a',
        registries: [], scanStats: { depthCuts: 3, timedOut: true },
    };
    const data = JSON.parse(station.serialize(model, {})
        .replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
    assert.deepEqual(data.scanStats, { depthCuts: 3, timedOut: true });
});


// Finding 1 of the whole-branch review: the two scan-cut lines in the header
// were reachable only from a model built by hand. `discover` called `scanRoots`
// with no options, so every `--scan` walk ran at `deadline: Infinity` and
// `timedOut` could not become true; and the one walk that did carry a deadline
// — `autoScan` in `scripts/station.js` — printed its counts and threw them
// away. These two tests take the two production routes.
test('discover forwards a deadline into the scan, and the data says the scan ran out of time', () => {
    const base = tmp('fankeel-station-scan-deadline-page-');
    registry.ensureLayout(path.join(base, 'a', 'b'));
    const m = station.gather({ configDir: path.join(base, 'cfg'), scan: [base], deadline: Date.now() - 1 });
    assert.equal(m.scanStats.timedOut, true, 'the deadline reaches scanRoots through discover');
    const data = JSON.parse(station.serialize(m, {})
        .replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
    assert.equal(data.scanStats.timedOut, true);
});

test('a caller that walked the machine itself hands its counts to the data write() produces', () => {
    const base = tmp('fankeel-station-scanstats-');
    const cfg = path.join(base, 'cfg');
    // No `scan` at all: these numbers can only have come from `opts.scanStats`,
    // which is how `scripts/station.js` hands `autoScan`'s own walk in.
    const out = station.write({ configDir: cfg, cwd: base, scanStats: { depthCuts: 7, timedOut: true } });
    const data = JSON.parse(
        fs.readFileSync(path.join(path.dirname(out.file), 'station', 'station-data.js'), 'utf8')
            .replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
    assert.deepEqual(data.scanStats, { depthCuts: 7, timedOut: true });
});

// `scripts/station.js` hands its first-run walk in *and* passes `--scan`
// through on the same call, so both walks can happen in one `gather`. The
// handed block used to win outright and the `--scan` walk's own counts were
// dropped: the header then described a walk that had not been the one to run
// short. Two gathers, one for each half of the merge — a fix that only ORed
// `timedOut` would pass the first assertion and fail the second.
test('a handed-in scan block and the walk discover did are added, not chosen between', () => {
    const base = tmp('fankeel-station-scanstats-merge-');
    registry.ensureLayout(path.join(base, 'a', 'b'));
    const spent = station.gather({
        configDir: path.join(base, 'cfg'), scan: [base], deadline: Date.now() - 1,
        scanStats: { depthCuts: 0, timedOut: false },
    });
    assert.equal(spent.scanStats.timedOut, true,
        'the handed block saying nothing went wrong does not erase a walk that ran out of time');
    const spentData = JSON.parse(station.serialize(spent, {})
        .replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
    assert.equal(spentData.scanStats.timedOut, true);

    // Ten directories below the base against a depth of eight: the walk cuts
    // one place of its own, and the handed block reports seven more.
    const deep = tmp('fankeel-station-scanstats-deep-');
    fs.mkdirSync(path.join(deep, 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'), { recursive: true });
    const cut = station.gather({
        configDir: path.join(deep, 'cfg'), scan: [deep],
        scanStats: { depthCuts: 7, timedOut: false },
    });
    assert.equal(cut.scanStats.depthCuts, 8, 'seven handed in plus the one this walk made');
    const cutData = JSON.parse(station.serialize(cut, {})
        .replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
    assert.equal(cutData.scanStats.depthCuts, 8);
});

// Finding 3 of the same review: `scripts/station.js` wrote `scannedAt` back
// after every run and claimed that was what made the record durable. It was
// not — the next `station.write()`, which every `/fankeel` prompt runs, rebuilt
// roots.json through `rememberRoots` and dropped the key. The durability is
// real now, and this is where it is pinned.
test('a write of the page keeps every key in roots.json that is not a root record', () => {
    const base = tmp('fankeel-station-scanrec-');
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

test('a gone root whose directory was deleted is forgotten', () => {
    const configDir = tmp('fankeel-roots-gone-');
    const alive = tmp('fankeel-roots-alive-');
    const deleted = tmp('fankeel-roots-deleted-');
    const unseen = tmp('fankeel-roots-unseen-');
    const first = Date.parse('2026-09-07T00:00:00Z');
    const later = Date.parse('2026-09-07T01:00:00Z');

    // Both roots recorded first, while neither is gone — a gone root is only
    // ever kept from its own past record, never given a fresh one.
    station.rememberRoots(configDir, [
        { root: alive, gone: false },
        { root: deleted, gone: false },
    ], first);

    fs.rmSync(deleted, { recursive: true, force: true });

    station.rememberRoots(configDir, [
        { root: alive, gone: true },
        { root: deleted, gone: true },
        { root: unseen, gone: true },
    ], later);

    const after = station.readRoots(configDir);
    assert.ok(Object.keys(after).includes(alive), 'a gone root that still exists is kept');
    assert.ok(!Object.keys(after).includes(deleted), 'a gone root that was deleted is dropped');
    // The discriminating case, and the only one here that is: `unseen` exists on
    // disk but was never recorded. Keeping a root's own old stamp drops it;
    // stamping any gone root whose directory happens to exist keeps it. The two
    // assertions above pass either way, which is how the first version of this
    // test came to pass against the bug it was written for.
    assert.ok(!Object.keys(after).includes(unseen),
        'a gone root never recorded before gains no entry, directory or no directory');
    assert.equal(after[alive], new Date(first).toISOString(),
        'alive keeps its first stamp, not a fresh one from the second call');
});

test('the page is the shell, byte for byte', () => {
    const shell = fs.readFileSync(
        path.join(__dirname, '..', 'assets', 'station', 'index.html'), 'utf8');
    assert.equal(station.render(), shell,
        'render() copies the shell; it does not template it');
});

test('the shell carries no session text and the data file carries all of it', () => {
    const f = fixture();
    station.write({ configDir: f.cfg, root: f.r1 });
    const read = (n) => fs.readFileSync(path.join(f.cfg, 'fankeel', n), 'utf8');
    assert.ok(!read('index.html').includes('live one'), 'a task line reached the shell');
    assert.ok(read('station/station-data.js').includes('live one'), 'the data file lost a task line');
});

// The shell moved to the top of the written directory and its three siblings
// moved under station/, so a flat four-name listing can no longer describe
// what write() leaves behind — it has to be read as a tree.
test('write leaves the shell at the top and its three siblings under station/', () => {
    const f = fixture();
    station.write({ configDir: f.cfg, root: f.r1 });
    const dir = path.join(f.cfg, 'fankeel');
    const top = fs.readdirSync(dir).filter((n) => n !== 'roots.json' && n !== 'station');
    const inner = fs.readdirSync(path.join(dir, 'station')).map((n) => 'station/' + n);
    const written = top.concat(inner);
    const { EMITTED } = require('../lib/station.js');
    assert.deepEqual(written.slice().sort(), EMITTED.slice().sort());
});

test('a second write with the same model rewrites only station/station-data.js', () => {
    const f = fixture();
    station.write({ configDir: f.cfg, root: f.r1 });
    const at = (n) => path.join(f.cfg, 'fankeel', n);
    // Stamped to a fixed past time rather than compared between two writes:
    // both writes land inside the same millisecond, so equal mtimes would
    // pass whether or not the file was rewritten.
    const PAST = new Date('2020-01-01T00:00:00Z');
    const copied = ['index.html', 'station/station.css', 'station/station.js'];
    for (const n of copied.concat(['station/station-data.js'])) fs.utimesSync(at(n), PAST, PAST);
    station.write({ configDir: f.cfg, root: f.r1 });
    for (const n of copied) {
        assert.equal(fs.statSync(at(n)).mtimeMs, PAST.getTime(), n + ' was rewritten');
    }
    assert.notEqual(fs.statSync(at('station/station-data.js')).mtimeMs, PAST.getTime(),
        'the data file was not rewritten');
});

test('serialize flattens the registries into one session list', () => {
    const f = fixture();
    const m = station.gather({ configDir: f.cfg });
    const line = station.serialize(m, {});
    assert.match(line, /^window\.STATION = /);
    const back = JSON.parse(line.replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
    assert.equal(back.registries, undefined, 'the page reads sessions, not registries');
    assert.equal(back.sessions.length,
        m.registries.reduce((n, r) => n + r.sessions.length, 0));
    assert.ok(back.sessions.every((s) => typeof s.root === 'string'),
        'a row lost the registry it came from');
});

test('serialize carries what only a server knows', () => {
    const f = fixture();
    const m = station.gather({ configDir: f.cfg });
    const read = (o) => JSON.parse(station.serialize(m, o)
        .replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
    const served = read({ serve: true, nonce: 'abc', cleared: 2 });
    assert.equal(served.serve, true);
    assert.equal(served.nonce, 'abc');
    assert.equal(served.cleared, 2);
    const onDisk = read({});
    assert.equal(onDisk.serve, false);
    assert.equal(onDisk.nonce, undefined);
});


