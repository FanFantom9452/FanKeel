'use strict';

// The browser half of the page cannot be driven from `node --test` — there is
// no DOM here and no dependency may be added to get one. What can be tested is
// every function that decides a number or a string before any element is
// touched, so that is what the view file exports. The rendering itself is
// checked against the served page, which is what the plan's success criterion
// is for.

const test = require('node:test');
const assert = require('node:assert/strict');
const profile = require('../lib/profile.js');

// `clearStaleControl` reads `S.serve`/`S.nonce`/`S.plugin` off the
// module-scoped `S`, which the IIFE sets to `window.STATION` at load time
// (falling back to `{ sessions: [], projects: [] }` only when `window` is
// undefined, which it is not once this is set). `document` stays undefined,
// so the DOM half after the `module.exports` guard never runs — this is
// still the pure half of the file, just one that reads its input off
// `window.STATION` instead of a parameter, and the object below is the same
// one `S` closes over, so mutating it after require still reaches the
// function on every call.
global.window = { STATION: {} };
const V = require('../assets/station/station.js');

test('tokens rounds the way the page prints', () => {
    assert.equal(V.tokens(null), '—');
    assert.equal(V.tokens(0), '0');
    assert.equal(V.tokens(999), '999');
    assert.equal(V.tokens(1500), '2k');
    assert.equal(V.tokens(1500000), '1.5M');
    assert.equal(V.tokens(12000000), '12M');
});

test('mins climbs through hours into days', () => {
    assert.equal(V.mins(null), '—');
    assert.equal(V.mins(90 * 1000), '2m');
    assert.equal(V.mins(3600 * 1000), '1h');
    assert.equal(V.mins(5400 * 1000), '1h30m');
    assert.equal(V.mins(90000 * 1000), '1d1h');
});

test('hours keeps a decimal under ten hours and drops it above', () => {
    assert.equal(V.hours(9000000), '2.5h');
    assert.equal(V.hours(54000000), '15h');
});

test('usd prints cents under a hundred and none above', () => {
    assert.equal(V.usd(0), '—');
    assert.equal(V.usd(2.5), '$2.50');
    assert.equal(V.usd(239.37), '$239');
});

test('ago climbs from just now through minutes, hours and days', () => {
    const now = Date.now();
    assert.equal(V.ago(now - 5000), 'just now');
    assert.equal(V.ago(now - 5 * 60000), '5m ago');
    assert.equal(V.ago(now - 3 * 3.6e6), '3h ago');
    assert.equal(V.ago(now - 2 * 8.64e7), '2d ago');
    assert.equal(V.ago(null), '—');
});

test('day takes the first ten characters of an ISO string', () => {
    assert.equal(V.day('2026-09-08T12:34:56.000Z'), '2026-09-08');
    assert.equal(V.day(12345), '—');
});

test('stamp prints minute precision for a fixed epoch value', () => {
    assert.equal(V.stamp(Date.UTC(2026, 0, 9, 10, 50)), '2026-01-09 10:50');
    assert.equal(V.stamp(NaN), '—');
});

test('esc closes every hole the page could open', () => {
    assert.equal(V.esc('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;');
    assert.equal(V.esc(null), '');
});

test('cost adds the session and its agents', () => {
    assert.equal(V.cost({ usd: 1.5, agentUsd: 2.25 }), 3.75);
    assert.equal(V.cost({}), 0);
});

test('labels give each root the shortest tail nothing else shares', () => {
    const out = V.labels(['/a/b/datapacks', '/c/d/datapacks', '/e/notes']);
    assert.equal(out['/e/notes'], 'notes');
    assert.equal(out['/a/b/datapacks'], 'b/datapacks');
    assert.equal(out['/c/d/datapacks'], 'd/datapacks');
});

test('labels lets two roots repeat a label when they normalize the same', () => {
    // Renamed from a case that never collided: '/a/b' and '/a/b/c' split into
    // ['a','b'] and ['a','b','c'], and their tails ('b' vs 'c') differ at
    // depth 1, so growth never runs and nothing here would have exercised the
    // `depth[i] < segs[i].length` bound. A real collision needs two roots
    // whose segments end up identical, which a mixed separator style can
    // produce: '/a/b' and '\\a\\b' both split (on `[\\/]+`) into ['a','b'].
    // Both start colliding at 'b', both grow to 'a/b', and there both are
    // already at their own full length — `depth[i] < segs[i].length` is what
    // stops them growing any further, so the collision never resolves and
    // the shorter (here, equal-length) label is allowed to repeat.
    const out = V.labels(['/a/b', '\\a\\b']);
    assert.equal(out['/a/b'], 'a/b');
    assert.equal(out['\\a\\b'], 'a/b');
});

// Two roots, one collision. `datapacks` alone cannot tell them apart, so both
// grow to `proj-a/datapacks` and `proj-b/datapacks` — distinct the moment the
// segment above joins the label — and stop there: growing a third time to
// `F:/proj-a/datapacks` would be `labels` refusing to believe two segments
// are enough once they plainly are.
test('two roots colliding on their last segment both grow one level and stop there', () => {
    const rootA = 'F:\\proj-a\\datapacks';
    const rootB = 'F:\\proj-b\\datapacks';
    const out = V.labels([rootA, rootB]);
    assert.equal(out[rootA], 'proj-a/datapacks');
    assert.equal(out[rootB], 'proj-b/datapacks');
});

// Three roots share `datapacks`; two of them, `alpha` and `beta`, also share
// `sub` one segment up, so `sub/datapacks` still collides between just those
// two after the first round of growth, while `solo/datapacks` is already on
// its own. `alpha` and `beta` need a third segment to separate; `solo` never
// needed a second collision resolved and stops at two.
test('three roots sharing a last segment: the two that also share the segment above grow further than the third', () => {
    const rootA = 'F:\\alpha\\sub\\datapacks';
    const rootB = 'F:\\beta\\sub\\datapacks';
    const rootC = 'F:\\solo\\datapacks';
    const out = V.labels([rootA, rootB, rootC]);
    assert.equal(out[rootA], 'alpha/sub/datapacks');
    assert.equal(out[rootB], 'beta/sub/datapacks');
    assert.equal(out[rootC], 'solo/datapacks');
});

// A fourth root whose own last segment nothing else shares — mixed in with
// the two-way collision above so the label is decided per root, not by the
// worst case anywhere on the page.
test('a root whose last segment is already unique keeps the one-segment label', () => {
    const rootA = 'F:\\proj-a\\datapacks';
    const rootB = 'F:\\proj-b\\datapacks';
    const rootD = 'F:\\myproject';
    const out = V.labels([rootA, rootB, rootD]);
    assert.equal(out[rootD], 'myproject');
});

test('delta says so rather than dividing by an empty window', () => {
    assert.match(V.delta(5, 0), /前期無資料/);
    assert.match(V.delta(12, 10), /\+20%/);
    assert.match(V.delta(8, 10), /-20%/);
});

test('delta in points reads a rise in waiting as bad', () => {
    const worse = V.delta(0.6, 0.4, 'pt');
    assert.match(worse, /\+20\.0 pt/);
    assert.match(worse, /class="delta dn"/);
    assert.match(V.delta(0.4, 0.6, 'pt'), /class="delta up"/);
});

test('statePill marks unmeasured liveness with a question mark and a reason', () => {
    // `unknown` is `serialize()`'s way of saying liveness could not be
    // measured — the config directory it would have to read was unreadable —
    // and `skills/fankeel/SKILL.md` tells every session to trust this page
    // about liveness, so the certain and the unmeasured case must read
    // differently.
    const known = V.statePill({ state: 'live', unknown: false });
    assert.equal(known, '<span class="pill live"><i class="dot live pulse"></i>live</span>');

    const unmeasured = V.statePill({ state: 'live', unknown: true });
    assert.match(unmeasured, />live\?</);
    assert.match(unmeasured, /title="[^"]+"/);
});

test('match reads state, registry, stage and free text', () => {
    const s = {
        state: 'live', root: '/a', stage: 'build', task: 'rework the ramp',
        project: 'Waypoint', id: 'abc', label: 'a', claims: ['lib/badge.js'],
        notes: [], next: '',
    };
    assert.equal(V.match(s, { q: '', state: 'live', project: '', stage: '' }), true);
    assert.equal(V.match(s, { q: '', state: 'down', project: '', stage: '' }), false);
    assert.equal(V.match(s, { q: 'badge.js', state: '', project: '', stage: '' }), true);
    assert.equal(V.match(s, { q: 'nothing here', state: '', project: '', stage: '' }), false);
});

test('match finds a session by the shortened label the page attaches to it', () => {
    // `serialize()` never emits `label` — the DOM half derives it once, right
    // after `LAB` is computed, as `s.label = LAB[s.root]`. This fixture
    // carries the same kind of value (a short, human tail, the way `labels()`
    // actually produces one) so this test would have caught the label slot
    // in `match()`'s haystack silently reading `undefined` for every real
    // session, which is what shipped before that assignment existed.
    const s = {
        state: 'live', root: '/home/dev/projects/waypoint', stage: 'build', task: 'x',
        project: 'p', id: 'i', label: 'waypoint', claims: [], notes: [], next: '',
    };
    assert.equal(V.match(s, { q: 'waypoint', state: '', project: '', stage: '' }), true);
});

test('the model and the state are still free-text terms', () => {
    // Both were terms on the page this replaces. A facet covers state; nothing
    // covers the model, so the search box has to.
    const s = {
        state: 'live', root: '/a', stage: 'build', task: 'x', project: 'p', id: 'i',
        label: 'a', model: 'claude-opus-5', claims: [], notes: [], next: '',
    };
    assert.equal(V.match(s, { q: 'opus', state: '', project: '', stage: '' }), true);
    assert.equal(V.match(s, { q: 'live', state: '', project: '', stage: '' }), true);
});

test('clearStaleControl prints nothing when no row is stale', () => {
    global.window.STATION.serve = true;
    const rows = [{ state: 'live' }, { state: 'down' }];
    assert.equal(V.clearStaleControl({ root: '/a' }, rows), '');
});

test('clearStaleControl posts to /clear-stale with the nonce when serving', () => {
    global.window.STATION.serve = true;
    global.window.STATION.nonce = 'tok-123';
    const rows = [{ state: 'stale' }, { state: 'stale' }, { state: 'live' }];
    const out = V.clearStaleControl({ root: 'F:\\proj' }, rows);
    assert.match(out, /<form method="post" action="\/clear-stale">/);
    assert.match(out, /name="nonce" value="tok-123"/);
});

test('clearStaleControl prints no form when the page is not served', () => {
    global.window.STATION.serve = false;
    const rows = [{ state: 'stale' }];
    const out = V.clearStaleControl({ root: 'F:\\proj' }, rows);
    assert.doesNotMatch(out, /<form/);
});

test('clearStaleControl escapes the root it interpolates into the form', () => {
    // `reg.root` is a filesystem path from a local scan and may legally hold
    // `<` or `"` outside Windows — `clearControl` escapes its own root value
    // twelve lines below this function, and this is the same hole.
    global.window.STATION.serve = true;
    global.window.STATION.nonce = 'tok-123';
    const out = V.clearStaleControl({ root: 'F:\\"><script>' }, [{ state: 'stale' }]);
    assert.match(out, /value="F:\\&quot;&gt;&lt;script&gt;"/);
    assert.doesNotMatch(out, /<script>/);
});

test('labels folds a trailing separator and case difference into one card', () => {
    // Windows only: `F:\a` and `f:\a\` are the same directory. The tail-growth
    // loop never sees this pair as two roots at all, so this is a count of
    // groups, not a check on which label wins.
    const out = V.labels(['F:\\a', 'f:\\a\\']);
    assert.equal(Object.keys(out).length, 1);
});

test('labels keeps a nested root as its own card', () => {
    // `F:\a` and `F:\a\b` fold to different keys — one is not a trailing
    // separator away from the other — so the fold must not merge them.
    const out = V.labels(['F:\\a', 'F:\\a\\b']);
    assert.equal(Object.keys(out).length, 2);
});

test('profileCard posts to /profile with a select when served, prints the command when not, and offers a machine-default button only when the machine profile has a machine-sourced key', () => {
    global.window.STATION.profileKeys = profile.KEYS;
    const projectProfile = { values: { 'land.push': false }, sources: { 'land.push': 'project' } };

    global.window.STATION.serve = true;
    global.window.STATION.nonce = 'tok-9';
    global.window.STATION.profiles = { machine: { values: {}, sources: {}, unreadable: [] } };
    let out = V.profileCard('project profile', 'project', '/proj', projectProfile);
    assert.match(out, /action="\/profile"/);
    assert.match(out, /<select name="value">/);
    assert.doesNotMatch(out, /套用機器預設/);
    // Not a fixed literal: `scope` and `project` are the function's own
    // arguments threaded into the hidden fields, so this is what tells apart
    // a project card from a machine card once served.
    assert.match(out, /name="scope" value="project"/);
    assert.match(out, /name="project" value="\/proj"/);

    const machineOut = V.profileCard('machine profile', 'machine', null, global.window.STATION.profiles.machine);
    assert.match(machineOut, /name="scope" value="machine"/);
    assert.doesNotMatch(machineOut, /name="project"/);

    global.window.STATION.profiles.machine = { values: { guard: 'ask' }, sources: { guard: 'machine' }, unreadable: [] };
    out = V.profileCard('project profile', 'project', '/proj', projectProfile);
    assert.match(out, /套用機器預設/);

    global.window.STATION.serve = false;
    out = V.profileCard('project profile', 'project', '/proj', projectProfile);
    assert.match(out, /profile set land\.push/);
    assert.doesNotMatch(out, /<form/);

    const staticMachineOut = V.profileCard('machine profile', 'machine', null, global.window.STATION.profiles.machine);
    assert.match(staticMachineOut, /--default/);
});

// --- the three levels: home -------------------------------------------------
// Sessions in the shape `serialize()` gives them from 2026-09-14 on: `days` rows
// per local day x stage x model x who, `spans` rows of milliseconds, and `pkey`.
// Every dollar amount is a binary fraction, so sums compare exactly. The
// registry's `usd` and `agentUsd` are 99 on purpose: a figure that reached the
// page from them would be off by a visible amount.
const count = (s, re) => (s.match(re) || []).length;
const tok5 = (n) => ({ input: n, output: n / 10, cacheRead: n * 4, cacheWrite5m: n / 2, cacheWrite1h: n / 4 });
const usd5 = (u) => ({ input: u / 4, output: u / 2, cacheRead: u / 8, cacheWrite5m: u / 16, cacheWrite1h: u / 16 });
const dayRow = (day, stage, model, who, usd, n) => ({ day, stage, model, who, tokens: tok5(n), cost: usd5(usd), usd });
const local = (mo, d, h) => new Date(2026, mo - 1, d, h).toISOString();
const NOW = new Date(2026, 8, 14, 21, 40).getTime();
const HOME = [
    { id: 'aaaa1111-0000', root: 'F:\\ws\\alpha', project: null, pkey: 'F:\\ws\\alpha', task: 'crosses midnight',
      state: 'down', stage: 'verify', route: ['survey', 'build', 'verify'], started: local(9, 13, 23),
      updated: NOW - 3600000, usd: 99, agentUsd: 99, hasDetail: true,
      days: [dayRow('2026-09-13', 'build', 'claude-opus-5', 'main', 1.25, 1000),
          dayRow('2026-09-13', 'build', 'claude-sonnet-5', 'agent', 0.5, 2000),
          dayRow('2026-09-14', 'verify', 'claude-opus-5', 'main', 2, 3000)],
      spans: [{ day: '2026-09-13', stage: 'build', who: 'main', ms: 3600000 },
          { day: '2026-09-13', stage: 'build', who: 'wait', ms: 1200000 },
          { day: '2026-09-13', stage: 'build', who: 'agent', ms: 600000 },
          { day: '2026-09-14', stage: 'verify', who: 'main', ms: 1800000 }] },
    { id: 'bbbb2222-0000', root: 'F:\\ws\\alpha', project: 'Beta', pkey: 'F:\\ws\\alpha/Beta', task: 'a plan day',
      state: 'live', stage: 'plan', route: ['survey', 'design', 'plan'], started: local(9, 14, 9),
      updated: NOW - 60000, usd: 99, agentUsd: 99, hasDetail: true,
      days: [dayRow('2026-09-14', null, 'claude-haiku-4-5-20251001', 'workflow', 0.75, 500),
          dayRow('2026-09-14', 'plan', 'claude-fable-5-1', 'main', 4, 800)],
      spans: [{ day: '2026-09-14', stage: null, who: 'workflow', ms: 300000 },
          { day: '2026-09-14', stage: 'plan', who: 'main', ms: 2400000 },
          { day: '2026-09-14', stage: 'plan', who: 'wait', ms: 600000 }] },
    { id: 'cccc3333-0000', root: 'F:\\ws\\alpha', project: null, pkey: 'F:\\ws\\alpha', task: 'no transcript here',
      state: 'down', stage: 'build', route: ['survey', 'build'], started: local(8, 20, 10),
      updated: NOW - 20 * 864e5, usd: 99, agentUsd: 99, hasDetail: false, days: null, spans: null },
    { id: 'dddd4444-0000', root: 'F:\\ws\\gamma', project: null, pkey: 'F:\\ws\\gamma', task: 'last month',
      state: 'down', stage: 'land', route: ['survey', 'land'], started: local(8, 1, 10),
      updated: NOW - 44 * 864e5, usd: 99, agentUsd: 99, hasDetail: false,
      days: [dayRow('2026-08-01', 'land', 'claude-sonnet-5', 'main', 8, 4000)],
      spans: [{ day: '2026-08-01', stage: 'land', who: 'main', ms: 7200000 },
          { day: '2026-08-01', stage: 'land', who: 'wait', ms: 7200000 }] },
];
// Guarded, so that before `lastDays` exists its own tests fail rather than the
// whole file throwing at load and taking the older tests down with it.
const DAYS = typeof V.lastDays === 'function' ? V.lastDays(NOW, 30) : [];
const PREV = typeof V.lastDays === 'function' ? V.lastDays(NOW - 30 * 864e5, 30) : [];
const O = { metric: 'usd', dim: 'model', sel: '2026-09-13', today: '2026-09-14', days: DAYS,
    names: { 'F:\\ws\\alpha': 'alpha', 'F:\\ws\\alpha/Beta': 'alpha / Beta', 'F:\\ws\\gamma': 'gamma' },
    pkeys: ['F:\\ws\\alpha/Beta', 'F:\\ws\\alpha', 'F:\\ws\\gamma'] };
// A session whose transcript is gone but whose v1 cache was kept: Task 4 gives
// it one `days` row carrying its whole `usd`, with no tokens and no per-kind cost.
const KEPT = { id: 'eeee5555-0000', root: 'F:\\ws\\gamma', project: null, pkey: 'F:\\ws\\gamma', task: 'kept cache',
    state: 'down', stage: 'build', route: ['survey', 'build'], started: local(9, 10, 10), updated: NOW - 4 * 864e5,
    usd: 99, agentUsd: 99, hasDetail: false, spans: null,
    days: [{ day: '2026-09-10', stage: null, model: 'claude-opus-5', who: 'main', tokens: null, cost: null, usd: 2.5 }] };

test('lastDays counts local calendar days back from now, today last, across a month', () => {
    assert.equal(DAYS.length, 30);
    assert.deepEqual([DAYS[0], DAYS[28], DAYS[29]], ['2026-08-16', '2026-09-13', '2026-09-14']);
    assert.deepEqual(V.lastDays(new Date(2026, 8, 1, 0, 30).getTime(), 2), ['2026-08-31', '2026-09-01']);
    assert.equal(V.localDay(new Date(2026, 8, 13, 23, 59).getTime()), '2026-09-13');
});

test('parseHash reads every route the three levels use and falls back to home', () => {
    const key = 'F:\\ws\\alpha/Beta';
    assert.deepEqual(V.parseHash(''), { view: 'home', day: null });
    assert.deepEqual(V.parseHash('#/'), { view: 'home', day: null });
    assert.deepEqual(V.parseHash('#/d/2026-09-13'), { view: 'home', day: '2026-09-13' });
    assert.deepEqual(V.parseHash('#/d/yesterday'), { view: 'home', day: null });
    assert.deepEqual(V.parseHash('#/p/' + encodeURIComponent(key)), { view: 'project', pkey: key });
    assert.deepEqual(V.parseHash('#/s/aaaa1111-0000'), { view: 'session', id: 'aaaa1111-0000', tab: 'timeline' });
    assert.deepEqual(V.parseHash('#/s/aaaa1111-0000/cost'), { view: 'session', id: 'aaaa1111-0000', tab: 'cost' });
    assert.deepEqual(V.parseHash('#/s/aaaa1111-0000/nope'), { view: 'session', id: 'aaaa1111-0000', tab: 'timeline' });
    assert.deepEqual(V.parseHash('#/list'), { view: 'list' });
    assert.deepEqual(V.parseHash('#/cmp'), { view: 'cmp' });
    assert.deepEqual(V.parseHash('#/p/%E0%A4%A'), { view: 'home', day: null }, 'a key that does not decode is no route');
});

test('family names the model line and calls anything else other', () => {
    assert.deepEqual(['claude-fable-5-1', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001', 'gpt-x', null].map(V.family),
        ['fable', 'opus', 'sonnet', 'haiku', 'other', 'other']);
});

test('dayBars stacks each day from days and spans, not from the registry, and time has no model split', () => {
    const usd = V.dayBars(HOME, 'usd', 'model', DAYS);
    assert.deepEqual([usd.days[29].day, usd.days[29].total, usd.days[29].parts], ['2026-09-14', 6.75, { opus: 2, haiku: 0.75, fable: 4 }]);
    assert.deepEqual([usd.days[28].total, usd.days[28].parts], [1.75, { opus: 1.25, sonnet: 0.5 }]);
    assert.deepEqual(usd.keys, ['fable', 'opus', 'sonnet', 'haiku'], 'model keys in price order');
    assert.equal(usd.max, 6.75);
    assert.equal(usd.days.reduce((n, b) => n + b.total, 0), 8.5, '08-01 is outside the window');
    assert.deepEqual(V.dayBars(HOME, 'time', 'who', DAYS).days[28].parts, { main: 3600000, agent: 600000 }, 'waiting is not time');
    const byStage = V.dayBars(HOME, 'usd', 'stage', DAYS);
    assert.deepEqual(byStage.days[29].parts, { verify: 2, none: 0.75, plan: 4 });
    assert.deepEqual(byStage.keys, ['plan', 'build', 'verify', 'none']);
    const off = V.dayBars(HOME, 'time', 'model', DAYS);
    assert.deepEqual([off.days.length, off.keys.length, off.max], [0, 0, 0]);
    assert.match(off.disabled, /model/);
    for (const b of V.dayBars(HOME, 'tokens', 'project', DAYS).days) {
        assert.equal(b.total, Object.values(b.parts).reduce((n, v) => n + v, 0), b.day + ': a bar is its segments');
    }
});

test('dayPanel splits one day four ways and lists the sessions that spent on it', () => {
    const p = V.dayPanel(HOME, '2026-09-14');
    assert.deepEqual([p.usd, p.active, p.wait], [6.75, 1800000 + 300000 + 2400000, 600000]);
    assert.deepEqual(p.by.who, { main: 6, workflow: 0.75 });
    assert.deepEqual(p.by.stage, { verify: 2, none: 0.75, plan: 4 });
    assert.deepEqual(p.by.project, { 'F:\\ws\\alpha': 2, 'F:\\ws\\alpha/Beta': 4.75 });
    assert.deepEqual(p.sessions.map((s) => [s.id, s.usd]), [['bbbb2222-0000', 4.75], ['aaaa1111-0000', 2]]);
});

test('頁面對帳：a day\'s bar total equals its day panel total equals that day\'s days[].usd across sessions', () => {
    for (const dim of ['model', 'project', 'stage', 'who']) {
        const bars = V.dayBars(HOME, 'usd', dim, DAYS);
        DAYS.forEach((day, i) => {
            let rows = 0;
            for (const s of HOME) for (const r of s.days || []) if (r.day === day) rows += r.usd;
            assert.equal(bars.days[i].total, rows, dim + ' ' + day + ': the bar');
            assert.equal(V.dayPanel(HOME, day).usd, rows, day + ': the day panel');
        });
    }
});

test('windowTotals and the four readouts: thirty days against the thirty before, waiting over main plus wait', () => {
    const cur = V.windowTotals(HOME, DAYS);
    const prev = V.windowTotals(HOME, PREV);
    assert.deepEqual(cur, { usd: 8.5, tokens: 42705, active: 8700000, main: 7800000, wait: 1800000 });
    assert.deepEqual(prev, { usd: 8, tokens: 23400, active: 7200000, main: 7200000, wait: 7200000 });
    const html = V.kpiHtml(cur, prev);
    assert.match(html, /\$8\.50/);
    assert.doesNotMatch(html, /\$99|\$198/);
    assert.match(html, /18\.8<span class="u">%<\/span>/);
    assert.match(html, /-31\.3 pt/);
    const none = V.kpiHtml(cur, V.windowTotals(HOME, V.lastDays(NOW - 60 * 864e5, 30)));
    assert.equal(count(none, /前期無資料/g), 4);
});

test('sessionTotals and projectRows sum days and spans per session and per project key', () => {
    assert.deepEqual(V.sessionTotals(HOME[0]), { usd: 3.75, tokens: 35100, active: 6000000, main: 5400000, wait: 1200000,
        models: { opus: 3.25, sonnet: 0.5 } });
    assert.deepEqual(V.sessionTotals(HOME[2]), { usd: 0, tokens: 0, active: 0, main: 0, wait: 0, models: {} });
    const rows = V.projectRows(HOME, DAYS);
    assert.deepEqual(rows.map((r) => [r.pkey, r.usd, r.n]),
        [['F:\\ws\\alpha/Beta', 4.75, 1], ['F:\\ws\\alpha', 3.75, 2], ['F:\\ws\\gamma', 0, 0]]);
    assert.equal(rows[1].daily[28], 1.75);
    assert.equal(rows[1].last, NOW - 3600000);
});

test('the home builders print dollars from days and link every row to its level', () => {
    const svg = V.histSvg(V.dayBars(HOME, 'usd', 'model', DAYS), O);
    assert.equal(count(svg, /<rect class="hit"/g), 30);
    assert.match(svg, /<rect class="hit" data-href="#\/"[^>]*><title>2026-09-13 /, 'the open day closes');
    assert.match(svg, /<rect class="hit" data-href="#\/d\/2026-09-14"/);
    assert.match(V.histSvg(V.dayBars(HOME, 'time', 'model', DAYS), O), /^<p class="note">時間沒有 model 可分/);
    const panel = V.dayPanelHtml(V.dayPanel(HOME, '2026-09-14'), O);
    assert.match(panel, /當日花費<\/div><div class="v">\$6\.75/);
    assert.match(panel, /href="#\/d\/2026-09-13"/);
    assert.doesNotMatch(panel, /#\/d\/2026-09-15/, 'no day after today');
    assert.match(panel, /data-href="#\/s\/bbbb2222-0000"/);
    assert.match(V.projectsHtml(V.projectRows(HOME, DAYS), O), /href="#\/p\/F%3A%5Cws%5Calpha%2FBeta"/);
    const recent = V.recentHtml(HOME.slice(0, 2), O);
    assert.match(recent, /data-href="#\/s\/aaaa1111-0000"[\s\S]*?\$3\.75/);
    assert.doesNotMatch(recent, /\$99|\$198/);
});

test('a kept v1 cache\'s single row counts its dollars and zero tokens, and breaks no home view', () => {
    const i = DAYS.indexOf('2026-09-10');
    assert.deepEqual(V.dayBars([KEPT], 'usd', 'stage', DAYS).days[i].parts, { none: 2.5 });
    const tok = V.dayBars([KEPT], 'tokens', 'model', DAYS);
    assert.deepEqual([tok.days[i].total, tok.keys, tok.max], [0, [], 0]);
    assert.deepEqual(V.dayBars([KEPT], 'time', 'who', DAYS).days[i].parts, {});
    assert.equal(V.dayPanel([KEPT], '2026-09-10').usd, 2.5);
    assert.deepEqual(V.sessionTotals(KEPT), { usd: 2.5, tokens: 0, active: 0, main: 0, wait: 0, models: { opus: 2.5 } });
    assert.deepEqual(V.windowTotals([KEPT], DAYS), { usd: 2.5, tokens: 0, active: 0, main: 0, wait: 0 });
    assert.match(V.recentHtml([KEPT], O), /\$2\.50<\/td><td class="r muted">0<\/td>/);
    assert.equal(count(V.histSvg(V.dayBars([KEPT], 'tokens', 'model', DAYS), O), /<rect class="hit"/g), 30);
});
