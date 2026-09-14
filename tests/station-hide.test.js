'use strict';

// A project whose profile sets `station.hide: 'true'` must vanish from the
// station page entirely: no row, no total, no gate answer in the home page's
// swapped cell, no detail file, and no `--json` row either.
// `lib/station.js:hiddenPkeys()` is the one place that decides this, and
// every surface below reads its output rather than judging for itself — with
// one exception worth knowing, because it looks like a bug and is not:
// `serialize()`'s `profiles.projects` loop repeats the predicate inline
// (`lib/station.js:481`), since that loop is keyed by the raw profiles
// directory rather than by the forward-slash pkey `hiddenPkeys()` returns.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const station = require('../lib/station.js');
const registry = require('../lib/registry.js');
const profile = require('../lib/profile.js');
const detail = require('../lib/detail.js');
const tmp = require('./tmp.js');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');

// `station.serialize` returns the `window.STATION = {...};\n` line the page
// loads; every test below wants the object underneath it.
function serialize(model, opts) {
    return JSON.parse(station.serialize(model, opts || {})
        .replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
}

// ---- a hand-built model, for the pure functions ---------------------------

const ROOT = path.join('C:', 'fake', 'root1');
const OTHER_ROOT = path.join('C:', 'fake', 'root2');

function session(id, project) {
    return {
        sessionId: id, project, task: 't', state: 'down', unknown: false,
        stage: 'build', route: [], step: 0, steps: 0,
        started: new Date(0).toISOString(), updated: 0, ended: null, model: null,
        burn: null, clock: null, waited: null, cost: null, agentCost: null, agents: null,
        stages: [], claims: [], notes: [], next: null, guard: '', backtracks: 0, detail: null,
    };
}

// `profile.read()` always normalises a `['true', 'false']`-valued key to a
// real boolean (`lib/profile.js:parseValue`, the same as `land.push`), never
// the literal string — a fake model has to carry that shape too, or it tests
// a value `hiddenPkeys()` would never actually see.
function profileEntry(hidden) {
    return { values: hidden ? { 'station.hide': true } : {}, sources: {}, unreadable: [] };
}

function twoRegistryModel() {
    return {
        generatedAt: new Date(0).toISOString(), configDir: '', pricesVerified: 'n/a', scanStats: null,
        machineProfile: { values: {}, sources: {}, unreadable: [] },
        registries: [
            {
                root: ROOT, gone: false, unreadable: 0, build: [], mapAt: null,
                sessions: [session('11111111-0000-4000-8000-00000000000a', 'shown-project'),
                    session('11111111-0000-4000-8000-00000000000b', 'hidden-project')],
                profiles: {
                    [path.join(ROOT, 'shown-project')]: profileEntry(false),
                    [path.join(ROOT, 'hidden-project')]: profileEntry(true),
                },
            },
            { root: OTHER_ROOT, gone: false, unreadable: 0, build: [], mapAt: null, sessions: [], profiles: {} },
        ],
    };
}

test('hiddenPkeys finds the project whose profile sets station.hide, keyed with pkey\'s forward slash', () => {
    const hidden = station.hiddenPkeys(twoRegistryModel());
    assert.ok(hidden.has(ROOT + '/hidden-project'), [...hidden].join(', '));
    assert.equal(hidden.size, 1);
    // `r.profiles` is keyed by `path.join(root, project)` — backslashes on
    // Windows. Comparing that raw key against pkey's shape is the bug this
    // function exists to avoid.
    if (path.sep === '\\') assert.ok(!hidden.has(path.join(ROOT, 'hidden-project')));
});

test('serialize carries neither the hidden project\'s sessions nor its profile entry', () => {
    const data = serialize(twoRegistryModel());
    assert.ok(!data.sessions.some((s) => s.project === 'hidden-project'), 'a hidden session reached serialize()');
    assert.ok(data.sessions.some((s) => s.project === 'shown-project'), 'the shown project was filtered out too');
    assert.ok(!Object.keys(data.profiles.projects).includes(path.join(ROOT, 'hidden-project')));
    assert.ok(Object.keys(data.profiles.projects).includes(path.join(ROOT, 'shown-project')));
});

// `gateSummary()` is the fifth aggregation over the model, and it was added
// after `hiddenPkeys()` had already been threaded through the other four —
// so it walks `model.registries` directly, the way `write()`'s detail loop
// does, and needs the same check. What it feeds is the home page's
// 最常被換掉 cell, which makes a hidden project's answers arriving there the
// hidden project counting toward a total the page shows.
function withGate(s, firstLabel, answer) {
    return Object.assign({}, s, {
        detail: {
            events: [{
                t: 0, kind: 'gate', turn: 1, askedAt: 0,
                qs: [{ q: 'which?', a: answer, own: false, labels: [firstLabel, answer] }],
            }],
        },
    });
}

test('the hidden project\'s gate answers do not reach the home page\'s swapped cell', () => {
    const model = twoRegistryModel();
    const r = model.registries[0];
    r.sessions = [withGate(r.sessions[0], 'shown-first', 'shown-second'),
        withGate(r.sessions[1], 'hidden-first', 'hidden-second')];
    const labels = serialize(model).gates.swapped.map((row) => row.label);
    assert.deepEqual(labels, ['shown-first'], labels.join(', '));
});

// ---- a real registry on disk, for write() and the CLI ---------------------

function fixture() {
    const base = tmp('fankeel-station-hide-');
    const cfg = path.join(base, 'cfg');
    const root = path.join(base, 'ws');
    registry.ensureLayout(root);
    const now = Date.now();
    const at = (ms) => new Date(ms).toISOString();
    const shownId = '11111111-0000-4000-8000-00000000000a';
    const hiddenId = '11111111-0000-4000-8000-00000000000b';
    const shownDir = path.join(root, 'shown-project');
    const hiddenDir = path.join(root, 'hidden-project');
    fs.mkdirSync(shownDir, { recursive: true });
    fs.mkdirSync(hiddenDir, { recursive: true });
    registry.writeSession(root, shownId, { task: 'shown', project: 'shown-project', stage: 'build',
        route: ['survey', 'build'], active: false, claims: [], started: at(now - 3600e3), updated: at(now), configDir: cfg });
    registry.writeSession(root, hiddenId, { task: 'hidden', project: 'hidden-project', stage: 'build',
        route: ['survey', 'build'], active: false, claims: [], started: at(now - 3600e3), updated: at(now), configDir: cfg });
    const w = profile.write(profile.projectFile(hiddenDir), 'station.hide', 'true');
    assert.equal(w.ok, true, w.reason);
    // A cache for each session so `write()` reaches the branch that writes a
    // detail file at all: `detailOf` falls back to a cache when there is no
    // real transcript, which neither session here has.
    for (const id of [shownId, hiddenId]) {
        const file = detail.cachePath(cfg, id);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ v: 2, days: [], spans: [], peak: 0 }));
    }
    return { base, cfg, root, shownId, hiddenId, shownDir, hiddenDir };
}

test('write() writes no detail file for a hidden session, and still writes the shown one\'s', () => {
    const f = fixture();
    station.write({ configDir: f.cfg, root: f.root });
    const details = path.join(f.cfg, 'fankeel', 'station', 'detail');
    assert.equal(fs.existsSync(path.join(details, f.hiddenId + '.js')), false);
    assert.equal(fs.existsSync(path.join(details, f.shownId + '.js')), true);
});

test('write()\'s counts exclude a hidden session, and its return carries how many pkeys are hidden', () => {
    const f = fixture();
    const out = station.write({ configDir: f.cfg, root: f.root });
    assert.equal(out.live + out.stale + out.down, 1, 'only the shown session is tallied');
    assert.equal(out.hidden, 1);
});

const STATION_CLI = path.join(__dirname, '..', 'scripts', 'station.js');

test('the --json CLI carries neither the hidden session nor its profile entry', () => {
    const f = fixture();
    const out = execFileSync(process.execPath, [STATION_CLI, '--json', '--root', f.root], {
        encoding: 'utf8',
        env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: f.cfg }),
    });
    const model = JSON.parse(out);
    assert.ok(model.registries.length > 0);
    for (const r of model.registries) {
        assert.ok(!r.sessions.some((s) => s.sessionId === f.hiddenId), 'the hidden session reached --json');
        assert.ok(!Object.keys(r.profiles || {}).includes(f.hiddenDir), 'the hidden project\'s profile entry reached --json');
    }
    assert.ok(model.registries.some((r) => r.sessions.some((s) => s.sessionId === f.shownId)),
        'the shown session is still there');
});

// ---- the artefact itself, mechanically -------------------------------------

// Unit tests all green while the two on-page figures differed by 3x happened
// on 2026-09-06, so this step is not optional: it derives both figures from
// the page's own arithmetic (assets/station/station.js's windowTotals,
// kpiHtml) rather than trusting serialize()'s shape by inspection.
test('hiding a project with spend lowers the page\'s own 30-day total, and the rendered cell carries the lower figure', () => {
    const NOW = Date.parse('2026-09-15T12:00:00Z');
    const DAYS = V.lastDays(NOW, 30);
    const day = V.localDay(NOW);
    const inside = {};
    DAYS.forEach((d) => { inside[d] = true; });

    function daySession(id, project, usd) {
        return Object.assign(session(id, project), {
            detail: { days: [{ day, stage: 'build', model: 'claude-sonnet-5', who: 'main', tokens: null, cost: null, usd }], spans: [], peak: 0 },
        });
    }

    function model(hideB) {
        return {
            generatedAt: new Date(NOW).toISOString(), configDir: '', pricesVerified: 'n/a', scanStats: null,
            machineProfile: { values: {}, sources: {}, unreadable: [] },
            registries: [{
                root: ROOT, gone: false, unreadable: 0, build: [], mapAt: null,
                sessions: [daySession('22222222-0000-4000-8000-00000000000a', 'shown-project', 10),
                    daySession('22222222-0000-4000-8000-00000000000b', 'hidden-project', 5)],
                profiles: {
                    [path.join(ROOT, 'shown-project')]: profileEntry(false),
                    [path.join(ROOT, 'hidden-project')]: profileEntry(hideB),
                },
            }],
        };
    }

    const modelWithProjectShown = model(false);
    const modelWithProjectHidden = model(true);

    function summed(sessions) {
        let usd = 0;
        sessions.forEach((s) => (s.days || []).forEach((r) => { if (inside[r.day]) usd += r.usd || 0; }));
        return usd;
    }

    // Two figures the artefact derives from one source: what the page's own
    // arithmetic totals, and an independent sum over the same day window.
    // They have to agree with a project shown and with it hidden, and the
    // hidden run has to be smaller — equal-and-unchanged would pass while
    // the filter never fired at all.
    const shown = V.windowTotals(serialize(modelWithProjectShown).sessions, DAYS).usd;
    assert.equal(shown, summed(serialize(modelWithProjectShown).sessions));
    const hid = V.windowTotals(serialize(modelWithProjectHidden).sessions, DAYS).usd;
    assert.equal(hid, summed(serialize(modelWithProjectHidden).sessions));
    assert.ok(hid < shown, 'hiding a project with spend must lower the total');
    assert.ok(V.kpiHtml(V.windowTotals(serialize(modelWithProjectHidden).sessions, DAYS),
        V.windowTotals([], DAYS)).includes(V.usd(hid)), 'the rendered cell carries that figure');
});
