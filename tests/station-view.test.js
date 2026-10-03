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

test('serveLost stays quiet with no baseline or inside the grace window, and states the mockup\'s frozen sentence once stale', () => {
    // No successful poll yet: nothing to compare against, so no verdict.
    assert.equal(V.serveLost(null, Date.now(), 'a', 'r'), null);
    assert.equal(V.serveLost(undefined, Date.now(), 'a', 'r'), null);
    // A response 14s ago is still inside the 15s grace window.
    const now = Date.now();
    assert.equal(V.serveLost(now - 14000, now, 'a', 'r'), null);
    // Past the window: the mockup's sentence, with the absolute time and the
    // relative one in parentheses after it, not the whole footer line.
    const msg = V.serveLost(now - 15001, now, '2026-09-14 06:12', '8m ago');
    // It starts at 底下: the bar's heading says `serve 沒有回應` above this,
    // so a sentence that opened by saying the server is offline again would
    // put it on screen twice.
    assert.match(msg, /^底下所有數字/);
    assert.match(msg, /與狀態/);
    assert.match(msg, /2026-09-14 06:12/);
    assert.match(msg, /（8m ago）/);
    assert.match(msg, /每 5 秒重試一次/);
});

test('heroEyebrow carries the frozen moment, and says only 近 30 天 while the server answers', () => {
    // Mockup screen 3's hero reads 「近 30 天 · 凍結於 06:12」, so a reader who
    // has scrolled past the bar still sees the page is not live. The hh:mm is
    // the caller's, off the same `stamp()` the bar's absolute time comes from
    // — one clock read in two places rather than two clocks.
    assert.equal(V.heroEyebrow(null), '近 30 天');
    assert.equal(V.heroEyebrow(''), '近 30 天');
    assert.equal(V.heroEyebrow('06:12'), '近 30 天 · 凍結於 06:12');
    // The real call shape, so a slice off by one cannot pass: `stamp()`
    // returns `YYYY-MM-DD hh:mm` and the eyebrow wants its last five.
    assert.equal(V.heroEyebrow(V.stamp(Date.parse('2026-09-14T06:12:00Z')).slice(11)),
        '近 30 天 · 凍結於 06:12');
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
    const key = 'F:\\ymlab\\fankeel';
    assert.deepEqual(V.parseHash(''), { view: 'now' });
    assert.deepEqual(V.parseHash('#/'), { view: 'now' });
    assert.deepEqual(V.parseHash('#/days'), { view: 'days', day: null });
    assert.deepEqual(V.parseHash('#/d/2026-09-13'), { view: 'days', day: '2026-09-13' });
    assert.deepEqual(V.parseHash('#/d/yesterday'), { view: 'now' });
    for (const v of ['sessions', 'projects', 'docs', 'settings']) assert.deepEqual(V.parseHash('#/' + v), { view: v });
    assert.deepEqual(V.parseHash('#/p/' + encodeURIComponent(key)), { view: 'project', pkey: key });
    assert.deepEqual(V.parseHash('#/s/aaaa1111-0000'), { view: 'session', id: 'aaaa1111-0000', tab: 'timeline' });
    assert.deepEqual(V.parseHash('#/s/aaaa1111-0000/cost'), { view: 'session', id: 'aaaa1111-0000', tab: 'cost' });
    assert.deepEqual(V.parseHash('#/s/aaaa1111-0000/nope'), { view: 'session', id: 'aaaa1111-0000', tab: 'timeline' });
    assert.deepEqual(V.parseHash('#/list'), { view: 'list' });
    assert.deepEqual(V.parseHash('#/cmp'), { view: 'cmp' });
    assert.deepEqual(V.parseHash('#/p/%E0%A4%A'), { view: 'now' }, 'a key that does not decode is no route');
});

test('family names the model line and calls anything else other', () => {
    assert.deepEqual(['claude-fable-5-1', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001', 'gpt-x', null].map(V.family),
        ['fable', 'opus', 'sonnet', 'haiku', 'other', 'other']);
});

// docs/plans/2026-09-26-station-redesign.md Task 9: the model dimension is
// the version; `family` stays the colour.
test('modelKey tells versions of one family apart, and modelLabel names them', () => {
    assert.deepEqual(['claude-opus-5-5', 'claude-opus-5', 'claude-opus-5-5[1m]', 'claude-haiku-4-5-20251001', 'claude-opus-4-20250514', 'gpt-x', null].map(V.modelKey),
        ['opus-5-5', 'opus-5', 'opus-5-5', 'haiku-4-5', 'opus-4', 'other', 'other']);
    assert.notEqual(V.modelKey('claude-opus-5-5'), V.modelKey('claude-opus-5'));
    assert.equal(V.modelLabel('opus-5-5'), 'Opus 5.5');
    assert.equal(V.modelLabel('sonnet-5'), 'Sonnet 5');
    assert.equal(V.modelLabel('other'), 'other');
});

const TWO = [{ id: 'vvvv1111-0000', root: 'F:\\ws\\alpha', project: null, pkey: 'F:\\ws\\alpha', task: 'two opus',
    state: 'down', stage: 'build', route: ['survey', 'build'], started: local(9, 13, 10), updated: NOW, usd: 9, agentUsd: 9, hasDetail: true,
    days: [dayRow('2026-09-13', 'build', 'claude-opus-5-5', 'main', 1.25, 100), dayRow('2026-09-13', 'build', 'claude-opus-5-5', 'agent', 2, 100),
        dayRow('2026-09-13', 'build', 'claude-opus-5', 'main', 0.5, 100)], spans: [] }];

test('the Opus 5.5 segment is the sum of its own rows, in the family hue, the older version lighter', () => {
    const bars = V.dayBars(TWO, 'usd', 'model', DAYS);
    const i = DAYS.indexOf('2026-09-13');
    assert.equal(bars.days[i].parts['opus-5-5'], 3.25);
    assert.equal(bars.days[i].parts['opus-5'], 0.5);
    assert.deepEqual(bars.keys, ['opus-5-5', 'opus-5'], 'newest first');
    const o = Object.assign({}, O, { sel: null });
    const tip = V.segTip(bars, o, '2026-09-13', 'opus-5-5');
    assert.match(tip, /Opus 5\.5/);
    assert.match(tip, /\$3\.25/);
    const svg = V.histSvg(bars, o);
    assert.match(svg, /fill:var\(--m-opus\)/, 'the newest version is the family colour itself');
    assert.match(svg, /fill:color-mix\(in oklab, var\(--m-opus\) 70%, var\(--panel\)\)/, 'the older one is derived from it');
    assert.match(V.legendHtml(bars, o), /Opus 5\.5/);
});

test('dayBars stacks each day from days and spans, not from the registry, and time has no model split', () => {
    const usd = V.dayBars(HOME, 'usd', 'model', DAYS);
    assert.deepEqual([usd.days[29].day, usd.days[29].total, usd.days[29].parts], ['2026-09-14', 6.75, { 'opus-5': 2, 'haiku-4-5': 0.75, 'fable-5-1': 4 }]);
    assert.deepEqual([usd.days[28].total, usd.days[28].parts], [1.75, { 'opus-5': 1.25, 'sonnet-5': 0.5 }]);
    assert.deepEqual(usd.keys, ['fable-5-1', 'opus-5', 'sonnet-5', 'haiku-4-5'], 'model keys in price order, then newest version first');
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

test('頁面對帳：a day\'s bar total equals its day panel total equals that day\'s days[].usd across sessions', () => {
    for (const dim of ['model', 'project', 'stage', 'who']) {
        const bars = V.dayBars(HOME, 'usd', dim, DAYS);
        DAYS.forEach((day, i) => {
            let rows = 0;
            for (const s of HOME) for (const r of s.days || []) if (r.day === day) rows += r.usd;
            assert.equal(bars.days[i].total, rows, dim + ' ' + day + ': the bar');
        });
    }
});

test('windowTotals and the five readouts: thirty days against the thirty before, waiting over main plus wait', () => {
    // `S.gates` (the module-scoped `global.window.STATION` object `kpiHtml`
    // closes over) carries nothing here, on purpose: this test is about the
    // first four readouts, and the fifth — 最常被換掉 — prints its em-dash
    // placeholder rather than disappearing, which is what the assertions
    // below check for.
    global.window.STATION.gates = undefined;
    const cur = V.windowTotals(HOME, DAYS);
    const prev = V.windowTotals(HOME, PREV);
    assert.deepEqual(cur, { usd: 8.5, tokens: 42705, active: 8700000, main: 7800000, wait: 1800000 });
    assert.deepEqual(prev, { usd: 8, tokens: 23400, active: 7200000, main: 7200000, wait: 7200000 });
    const html = V.kpiHtml(cur, prev);
    assert.match(html, /\$8\.50/);
    assert.doesNotMatch(html, /\$99|\$198/);
    assert.match(html, /18\.8<span class="u">%<\/span>/);
    assert.match(html, /-31\.3 pt/);
    const cells = [...html.matchAll(/<div class="ro"><div class="l">(.*?)<\/div><div class="v">(.*?)<\/div><div class="d">(.*?)<\/div><\/div>/g)];
    assert.deepEqual(cells.map((m) => m[1]),
        ['30 天花費', 'token', 'active 時間', '<i class="hatchsw"></i>等待佔比', '最常被換掉'],
        'every readout carries its own label, and nothing else, in the label cell');
    assert.deepEqual(cells.map((m) => [/class="delta/.test(m[2]), /class="delta/.test(m[3])]),
        [[false, true], [false, true], [false, true], [false, true], [false, false]],
        'each one keeps the figure in the value cell and the comparison in the line under it; the gate cell has no window to compare against');
    assert.match(html, /30 天花費<\/div><div class="v">\$8\.50<\/div><div class="d">/,
        'the spend readout puts the figure in the value cell and the comparison under it');
    assert.match(html, /token<\/div><div class="v">43k<\/div>/, 'the token readout reads this window, not the one before it');
    assert.match(html, /active 時間<\/div><div class="v">2\.4h<\/div>/, 'so does active 時間');
    assert.match(html, /等待佔比<\/div><div class="v">18\.8<span class="u">%<\/span><\/div><div class="d">[^<]*<span class="delta[^>]*>[^<]*-31\.3 pt/,
        'so does the waiting share');
    assert.match(html, /最常被換掉<\/div><div class="v">—<\/div><div class="d"><\/div>/,
        'with no gate data, the fifth readout prints an em dash rather than dropping out of the row');
    const none = V.kpiHtml(cur, V.windowTotals(HOME, V.lastDays(NOW - 60 * 864e5, 30)));
    assert.equal(count(none, /前期無資料/g), 4);
});

test('kpiHtml reads S.gates.swapped[0] for the fifth readout: which option one loses most, and how often', () => {
    // Mutation that reddens this: in `kpiHtml()`, drop the `var top = ...`
    // line and the `out += roHtml('最常被換掉', ...)` line that follows it —
    // the output then has only four `ro` cells and neither `最常被換掉` nor
    // `進 build` nor `3 / 5` appears anywhere in it.
    global.window.STATION.gates = { swapped: [{ label: '進 build', lost: 3, total: 5 }] };
    const cur = V.windowTotals(HOME, DAYS);
    const prev = V.windowTotals(HOME, PREV);
    const html = V.kpiHtml(cur, prev);
    assert.match(html, /最常被換掉/);
    assert.match(html, /進 build/);
    assert.match(html, /3 \/ 5/);
    global.window.STATION.gates = undefined;
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
    assert.match(svg, /<rect class="hit" data-href="#\/"[^>]*aria-label="2026-09-13 /, 'the open day closes');
    assert.doesNotMatch(svg, /<title>/, 'no native tooltip: the card replaces it');
    assert.match(svg, /<rect class="hit" data-href="#\/d\/2026-09-14"/);
    assert.match(V.histSvg(V.dayBars(HOME, 'time', 'model', DAYS), O), /^<p class="note">時間沒有 model 可分/);
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
    const keptKind = V.dayBars([KEPT], 'usd', 'kind', DAYS);
    assert.deepEqual([keptKind.days[i].total, keptKind.keys], [0, []], 'a null cost split gives kind nothing, not a crash');
    assert.deepEqual(V.sessionTotals(KEPT), { usd: 2.5, tokens: 0, active: 0, main: 0, wait: 0, models: { opus: 2.5 } });
    assert.deepEqual(V.windowTotals([KEPT], DAYS), { usd: 2.5, tokens: 0, active: 0, main: 0, wait: 0 });
    assert.match(V.recentHtml([KEPT], O), /\$2\.50<\/td><td class="r muted">0<\/td>/);
    assert.equal(count(V.histSvg(V.dayBars([KEPT], 'tokens', 'model', DAYS), O), /<rect class="hit"/g), 30);
});

// Two sessions with different fankeel versions and one with none recorded, on
// the same day, so a version split can be checked for the two things a
// biggest-group-first sort would get backwards: `'none'` — the biggest slice,
// since every session before this field existed lands there — pushed to the
// back instead of the front, and the newer real version read ahead of the
// older one instead of both landing in alphabetical order.
//
// Each carries spans as well, and their millisecond figures share no value
// with the `usd` figures beside them, so a `時間` split that came out of
// `s.days` by mistake could not produce the numbers a span split does.
const VER = [
    { id: 'ffff6666-0000', root: 'F:\\ws\\alpha', project: null, pkey: 'F:\\ws\\alpha', task: 'old version',
      state: 'down', stage: 'build', route: ['survey', 'build'], started: local(9, 10, 10), updated: NOW,
      usd: 99, agentUsd: 99, hasDetail: true, version: '0.74.0',
      spans: [{ day: '2026-09-10', stage: 'build', who: 'main', ms: 600000 }],
      days: [dayRow('2026-09-10', 'build', 'claude-opus-5', 'main', 1, 100)] },
    { id: 'gggg7777-0000', root: 'F:\\ws\\alpha', project: null, pkey: 'F:\\ws\\alpha', task: 'new version',
      state: 'down', stage: 'build', route: ['survey', 'build'], started: local(9, 10, 11), updated: NOW,
      usd: 99, agentUsd: 99, hasDetail: true, version: '0.80.0',
      spans: [{ day: '2026-09-10', stage: 'build', who: 'main', ms: 1200000 }],
      days: [dayRow('2026-09-10', 'build', 'claude-opus-5', 'main', 1, 100)] },
    { id: 'hhhh8888-0000', root: 'F:\\ws\\alpha', project: null, pkey: 'F:\\ws\\alpha', task: 'no version recorded',
      state: 'down', stage: 'build', route: ['survey', 'build'], started: local(9, 10, 12), updated: NOW,
      usd: 99, agentUsd: 99, hasDetail: true, version: null,
      spans: [{ day: '2026-09-10', stage: 'build', who: 'main', ms: 300000 },
          { day: '2026-09-10', stage: 'build', who: 'wait', ms: 999000 }],
      days: [dayRow('2026-09-10', 'build', 'claude-opus-5', 'main', 5, 100)] },
];

test('dayBars splits kind into the cost tab\'s four segments and folds the two cache-write rates into one', () => {
    const i = DAYS.indexOf('2026-09-14');
    const bars = V.dayBars(HOME, 'usd', 'kind', DAYS);
    assert.deepEqual(bars.days[i].parts, { input: 1.6875, output: 3.375, cacheRead: 0.84375, cacheWrite: 0.84375 });
    assert.equal(bars.days[i].total, 6.75, 'a kind bar is still the sum of its four segments');
    assert.deepEqual(bars.keys, ['input', 'output', 'cacheRead', 'cacheWrite'], 'the cost tab\'s own fixed order');
});

test('a kind split under token counts reads r.tokens, not r.cost, and folds the two cache writes the same way', () => {
    const i = DAYS.indexOf('2026-09-14');
    const bars = V.dayBars(HOME, 'tokens', 'kind', DAYS);
    // 4,300 input tokens over the day's three rows, and `tok5`'s fixed ratios
    // off that: output a tenth, cache read four times, the 5m and 1h writes a
    // half and a quarter folded into one. Reading `r.cost` here instead would
    // give the 花費 figures above, which share no value with these.
    assert.deepEqual(bars.days[i].parts, { input: 4300, output: 430, cacheRead: 17200, cacheWrite: 3225 });
    assert.equal(bars.days[i].total, 25155, 'a kind bar is its four segments summed under tokens as under 花費');
});

test('kind is disabled under 時間, like model: a span carries no cost or tokens to split by kind', () => {
    const off = V.dayBars(HOME, 'time', 'kind', DAYS);
    assert.deepEqual([off.days.length, off.keys.length, off.max], [0, 0, 0]);
    assert.match(off.disabled, /成分/);
});

test('a kind split\'s segments across the whole window sum to the same 花費 the hero KPI shows for it, because both come from s.days', () => {
    const bars = V.dayBars(HOME, 'usd', 'kind', DAYS);
    const total = bars.days.reduce((n, b) => n + b.total, 0);
    assert.equal(total, V.windowTotals(HOME, DAYS).usd, 'a fold or a dropped segment would show up here as a mismatch');
});

test('a version split takes version from the session, sorts real versions newest first, and puts a null-recorded version last though it is by far the biggest group', () => {
    const i = DAYS.indexOf('2026-09-10');
    const bars = V.dayBars(VER, 'usd', 'version', DAYS);
    assert.deepEqual(bars.days[i].parts, { '0.74.0': 1, '0.80.0': 1, none: 5 });
    assert.deepEqual(bars.keys, ['0.80.0', '0.74.0', 'none']);
});

test('version colours \'none\' the quiet grey rather than a palette slot, so it never reads as a colour peer of a real version', () => {
    const bars = V.dayBars(VER, 'usd', 'version', DAYS);
    const o = { metric: 'usd', dim: 'version', sel: null, today: '2026-09-14', days: DAYS, names: {}, pkeys: [] };
    const svg = V.histSvg(bars, o);
    assert.match(svg, /未記版本/);
    assert.match(svg, /0\.74\.0/);
    assert.match(svg, /0\.80\.0/);
    assert.equal(count(svg, /fill:var\(--st-none\)/g), 1, '\'none\' never claims a palette slot');
});

// The mockup this row implements (`.fankeel/build/2026-09-20-cost-composition/
// mockup.html`, panel A) draws the three real versions in `--p-0`, `--p-1` and
// `--p-2` — distinct slots, newest first — with `未記版本` quiet and separate.
// `colorOf`'s fallback indexes into whichever array it is handed, so this is
// really a test of what `histSvg`/`legendHtml` hand it for `version`: the
// bar's own `bars.keys`, already newest-first from `orderKeys`, in place of
// the project list a version is never found in.
test('version gives each real version its own palette slot in newest-first order, not the same slot for every version', () => {
    const bars = V.dayBars(VER, 'usd', 'version', DAYS);
    const o = { metric: 'usd', dim: 'version', sel: null, today: '2026-09-14', days: DAYS, names: {}, pkeys: [] };
    const svg = V.histSvg(bars, o);
    assert.match(svg, /fill:var\(--p-0\)/, 'the newest version, 0.80.0, is --p-0');
    assert.match(svg, /fill:var\(--p-1\)/, 'the older version, 0.74.0, gets a different slot from the newest');
    assert.doesNotMatch(svg, /fill:var\(--p-5\)/, 'with only two real versions, neither falls through to the overflow slot');
});

// The grey says "not a real version" and cannot say why, so the legend entry
// carries the why. It matters which why: every row on this page is built from
// a registry entry and only this plugin writes those, so `'none'` is a session
// older than the field, never a session from somewhere else.
test('the 未記版本 legend entry carries the reason for its grey, and a real version carries no tooltip', () => {
    const bars = V.dayBars(VER, 'usd', 'version', DAYS);
    const o = { metric: 'usd', dim: 'version', sel: null, today: '2026-09-14', days: DAYS, names: {}, pkeys: [] };
    const html = V.legendHtml(bars, o);
    assert.match(html, /<span data-key="none" title="[^"]*registry 還沒有 version[^"]*"><i class="sw" style="background:var\(--st-none\)"><\/i>未記版本<\/span>/);
    assert.equal(count(html, /<span[^>]* title=/g), 1, 'only \'none\' is annotated — 0.80.0 and 0.74.0 are their own explanation');
});

// `colorOf` caps a version's fallback slot at `--p-5` the same way it caps
// `project`'s, once there are more than five real versions — but before this
// fix `legendHtml` only narrowed `own` for `dim: 'project'`, so `version`'s
// `own` stayed `bars.keys` itself and the overflow line never triggered:
// every version beyond the fifth still printed its own row even though
// several of them shared the same `--p-5` swatch.
const MANY_VER = ['0.81.0', '0.82.0', '0.83.0', '0.84.0', '0.85.0', '0.86.0', '0.87.0', '0.88.0'].map((v, i) => ({
    id: 'iiii' + (9000 + i) + '-0000', root: 'F:\\ws\\alpha', project: null, pkey: 'F:\\ws\\alpha', task: 'version ' + v,
    state: 'down', stage: 'build', route: ['survey', 'build'], started: local(9, 10, 10), updated: NOW,
    usd: 1, agentUsd: 1, hasDetail: true, version: v,
    spans: [{ day: '2026-09-10', stage: 'build', who: 'main', ms: 60000 }],
    days: [dayRow('2026-09-10', 'build', 'claude-opus-5', 'main', 1, 100)],
}));

test('a version legend with more than five real versions collapses the overflow into 其他 N 個 the same way project does', () => {
    const bars = V.dayBars(MANY_VER, 'usd', 'version', DAYS);
    const o = { metric: 'usd', dim: 'version', sel: null, today: '2026-09-14', days: DAYS, names: {}, pkeys: [] };
    const html = V.legendHtml(bars, o);
    assert.equal(bars.keys.length, 8, 'eight distinct real versions, newest first');
    assert.match(html, /0\.88\.0/, 'the newest version keeps its own legend row');
    assert.doesNotMatch(html, /0\.83\.0/, 'the third version past the fifth slot falls into the overflow instead of its own row');
    assert.match(html, /其他 3 個/, 'three versions past the fifth slot collapse into one line');
    assert.equal(count(html, /class="sw"/g), 6, 'five kept versions plus one overflow swatch, not eight individual rows');
});

// `version` is the one of the two new dims that `時間` keeps. A span records
// only a stage and who was running, so it carries nothing to split by model
// or by kind — but a version belongs to the session rather than to the row,
// so it applies to a span as much as to a day row. That is the mockup's
// panel C: `依成分` greyed out under 時間 and `依版本` still live.
test('a version split under 時間 comes from the spans, keeps the newest-first order, and is not disabled the way model and kind are', () => {
    const i = DAYS.indexOf('2026-09-10');
    const bars = V.dayBars(VER, 'time', 'version', DAYS);
    assert.equal(bars.disabled, null, 'version survives 時間 where model and kind are turned off');
    assert.deepEqual(bars.days[i].parts, { '0.74.0': 600000, '0.80.0': 1200000, none: 300000 });
    assert.equal(bars.days[i].total, 2100000, 'the wait span is left out here as it is for every other dim');
    assert.deepEqual(bars.keys, ['0.80.0', '0.74.0', 'none']);
});

// --- the three levels: project -----------------------------------------------
test('projectHead and sessionPoints take one project key\'s figures from days, one point per session start', () => {
    assert.deepEqual(V.projectHead(HOME, 'F:\\ws\\alpha', DAYS),
        { pkey: 'F:\\ws\\alpha', usd: 3.75, tokens: 35100, active: 6000000, n: 2 });
    assert.equal(V.dayStart('2026-09-14'), new Date(2026, 8, 14).getTime());
    const t0 = V.dayStart(DAYS[0]), t1 = V.dayStart(DAYS[29]) + 864e5;
    const alpha = HOME.filter((s) => s.root === 'F:\\ws\\alpha');
    assert.deepEqual(V.sessionPoints(alpha, 'usd', t0, t1).map((p) => [p.id, p.v]),
        [['cccc3333-0000', 0], ['aaaa1111-0000', 3.75], ['bbbb2222-0000', 4.75]]);
    assert.deepEqual(V.sessionPoints(HOME, 'tokens', t0, t1).map((p) => p.v), [0, 35100, 7605], 'last month\'s session is off the axis');
});

test('projectChart draws a line per project on one y axis, and every point links to its session', () => {
    const t0 = V.dayStart(DAYS[0]), t1 = V.dayStart(DAYS[29]) + 864e5;
    const of = (k) => V.sessionPoints(HOME.filter((s) => s.pkey === k), 'tokens', t0, t1);
    const beta = { pkey: 'F:\\ws\\alpha/Beta', name: 'alpha / Beta', colour: 'var(--p-0)', points: of('F:\\ws\\alpha/Beta') };
    const alpha = { pkey: 'F:\\ws\\alpha', name: 'alpha', colour: 'var(--p-1)', points: of('F:\\ws\\alpha') };
    const o = { metric: 'tokens', t0, t1, days: DAYS, today: DAYS[29] };
    const svg = V.projectChart([beta, alpha], o);
    assert.equal(count(svg, /<polyline /g), 2);
    assert.equal(count(svg, /<circle class="hit" data-href="#\/s\//g), 3);
    assert.match(svg, /data-href="#\/s\/bbbb2222-0000"/);
    assert.match(svg, />50k<\/text>/, 'alpha\'s 35k sets the shared axis');
    assert.doesNotMatch(V.projectChart([beta], o), />50k<\/text>/, 'alone, Beta\'s 8k does not reach it');
});

test('the project sessions table ticks for 比較, and prints dollars and a model mix from days', () => {
    const html = V.projectSessionsHtml(HOME.slice(0, 3), ['aaaa1111-0000']);
    assert.match(html, /data-cmp="aaaa1111-0000" aria-label="選來比較" checked>/);
    assert.match(html, /data-cmp="cccc3333-0000" aria-label="選來比較" disabled/);
    assert.match(html, /data-href="#\/s\/aaaa1111-0000"[\s\S]*?\$3\.75[\s\S]*?<span class="mini-mix" title="opus \$3\.25、sonnet \$0\.50">/);
    assert.doesNotMatch(html, /\$99/);
});

// --- the three levels: session -----------------------------------------------
// A detail in the shape `serializeDetail()` writes from 2026-09-14 on: `points`
// carry their model, `waits` their two moments, dispatch rows `from`, `to` and
// a five-key `cost` (one of them null, as an unpriced row arrives), and the
// five-key token `split` every row already carries (lib/usage.js:468, defined at :366).
const T0 = new Date(2026, 8, 13, 22, 0).getTime();
const DETAIL_X = {
    requests: 3, wakes: 4, peak: 90000, peakN: 3, noTime: 0, backtracks: 0, marks: [], rises: [], backs: [], tasks: [],
    points: [{ n: 1, t: T0 + 60000, y: 20000, model: 'claude-opus-5' }, { n: 2, t: T0 + 3000000, y: 60000, model: 'claude-sonnet-5' },
        { n: 3, t: T0 + 7200000, y: 90000, model: 'claude-opus-5' }],
    seq: [{ stage: 'build', at: T0, source: 'cmd' }, { stage: 'verify', at: T0 + 5400000, source: 'cmd' }],
    waits: [{ askedAt: T0 + 600000, answeredAt: T0 + 1500000, stage: 'build' },
        { askedAt: T0 + 6000000, answeredAt: T0 + 6120000, stage: 'verify' }],
    dispatches: [
        { key: 'd0', turn: 2, surface: 'agent', text: 'read the map', out: T0 + 1800000, back: T0 + 2400000, ret: 6400, launch: 0, ids: ['a1'] },
        { key: 'd1', turn: 4, surface: 'workflow', text: 'build', out: T0 + 2500000, back: T0 + 4800000, ret: 9200, launch: 800, run: 'wf_1', ids: ['w1', 'w2'] },
    ],
    rows: [
        { id: 'a1', disp: 0, surface: 'agent', label: 'read:map', agentType: 'reader', model: 'claude-sonnet-5', phase: null,
          c: 19, k: 218, s: 600, unpriced: [], from: T0 + 1800000, to: T0 + 2400000,
          split: { input: 1500, output: 12000, cacheRead: 200000, cacheWrite5m: 4500, cacheWrite1h: 0 },
          cost: { input: 0.04, output: 0.1, cacheRead: 0.03, cacheWrite5m: 0.02, cacheWrite1h: 0 } },
        { id: 'w1', disp: 1, surface: 'workflow', label: 'impl:a', agentType: 'implementer', model: 'claude-sonnet-5', phase: 'Build',
          c: 164, k: 2820, s: 2000, unpriced: [], from: T0 + 2600000, to: T0 + 4600000,
          split: { input: 3000, output: 45000, cacheRead: 2700000, cacheWrite5m: 72000, cacheWrite1h: 0 },
          cost: { input: 0.5, output: 0.75, cacheRead: 0.25, cacheWrite5m: 0.14, cacheWrite1h: 0 } },
        { id: 'w2', disp: 1, surface: 'workflow', label: 'impl:b', agentType: 'implementer', model: 'claude-sonnet-5', phase: 'Build',
          c: 61, k: 889, s: 1200, unpriced: [], from: T0 + 3000000, to: T0 + 4200000, cost: null,
          split: { input: 800, output: 9000, cacheRead: 850000, cacheWrite5m: 29200, cacheWrite1h: 0 } },
    ],
    runs: [{ run: 'wf_1', name: 'build', agents: 2 }], agentCents: 244, agentsTotal: { cents: 244 }, unpriced: [], steps: {}, dropped: 0,
    events: [{ t: T0 + 1500000, kind: 'gate', askedAt: T0 + 600000, qs: [{ q: 'go?', a: 'yes', own: false }] }],
};

test('timelineModel: stages as wide as the time they took, each wait, a tick per request, a bar per agent and workflow', () => {
    const m = V.timelineModel(DETAIL_X);
    assert.deepEqual([m.t0, m.t1], [T0, T0 + 7200000], 'from the first step to the last request');
    assert.deepEqual(m.segs.map((g) => [g.stage, g.to - g.from]), [['build', 5400000], ['verify', 1800000]]);
    assert.deepEqual(m.waits.map((w) => [w.stage, w.ms]), [['build', 900000], ['verify', 120000]]);
    assert.deepEqual(m.ticks.map((q) => q.family), ['opus', 'sonnet', 'opus']);
    assert.deepEqual(m.bars.map((b) => [b.kind, b.label, b.from - T0, b.to - T0]), [['agent', 'read:map', 1800000, 2400000],
        ['wf', 'build', 2500000, 4800000], ['kid', 'impl:a', 2600000, 4600000], ['kid', 'impl:b', 3000000, 4200000]]);
    assert.deepEqual([m.bars[1].tokens, m.bars[1].cents, m.bars[1].n], [3709000, 225, 2], 'a workflow is the sum of its agents');
    assert.deepEqual(m.rets.map((q) => [q.t - T0, q.chars]), [[2400000, 6400], [4800000, 9200]]);
});

test('timelineSvg hatches each wait with its length, colours a tick per request, and folds a workflow shut', () => {
    const m = V.timelineModel(DETAIL_X);
    const svg = V.timelineSvg(m, {});
    assert.equal(count(svg, /<rect class="wait"/g), 2);
    assert.match(svg, />等 15m<\/text>/);
    assert.match(svg, />等 2m<\/text>/);
    assert.equal(count(svg, /<rect class="seg" /g), 2);
    assert.equal(count(svg, /<rect class="rq" /g), 3);
    assert.match(svg, /<rect class="rq" [^>]*style="fill:var\(--m-sonnet\)"/);
    assert.match(svg, />\+6\.4k 字元<\/text>/);
    assert.match(svg, /data-wf="wf-1"/);
    assert.match(svg, />impl:b</);
    assert.doesNotMatch(V.timelineSvg(m, { 'wf-1': true }), />impl:b</, 'a closed workflow hides its agents');
    assert.match(svg, />sonnet-5 · 218k tok · \$0\.19 · 回傳 6,400 字元<\/text>/, 'an agent bar names its model, tokens and cost');
    assert.match(svg, />sonnet-5 · 889k tok · \$0\.61<\/text>/, 'so does an agent inside a workflow');
    const ctx = svg.match(/<path d="([^"]+)" style="fill:none;stroke:var\(--ctx\)/);
    assert.ok(ctx, 'the context line is drawn');
    const ticks = [...svg.matchAll(/<rect class="rq" x="([\d.]+)"/g)].map((q) => +q[1] + 0.75);
    assert.deepEqual([...ctx[1].matchAll(/[ML]([\d.]+),/g)].map((v, i) => Math.abs(+v[1] - ticks[i]) < 0.11), [true, true, true],
        'the context line puts each request where its tick is, on one time axis');
});

test('a crowded timeline keeps the labels it can read and turns the one at the right edge around', () => {
    const t1 = T0 + 3600000, at = (f) => T0 + (t1 - T0) * f;
    const m = {
        t0: T0, t1,
        segs: [{ stage: 'build', from: T0, to: t1 }],
        waits: [{ stage: 'build', from: at(0.10), to: at(0.105), ms: 60000 },
            { stage: 'build', from: at(0.11), to: at(0.115), ms: 120000 },
            { stage: 'build', from: at(0.60), to: at(0.70), ms: 360000 },
            { stage: 'build', from: at(0.98), to: at(1), ms: 180000 }],
        ticks: [],
        points: [{ t: T0, y: 1000 }, { t: t1, y: 2000 }],
        rets: [{ t: at(0.20), chars: 1000 }, { t: at(0.205), chars: 2000 }, { t: at(0.80), chars: 3000 }],
        bars: [{ kind: 'agent', key: 'a', label: 'late', from: at(0.93), to: at(0.99),
            model: 'claude-sonnet-5', tokens: 218000, cents: 19, ret: 6400 }],
    };
    const svg = V.timelineSvg(m, {});
    assert.equal(count(svg, /<\/path>/g), 3, 'every agent return is still marked');
    assert.equal(count(svg, />\+[\d.]+k? 字元<\/text>/g), 2, 'but two returns that land together label only one');
    assert.match(svg, /<title>\+2\.0k 字元<\/title>/, 'and the label it dropped is on the mark itself');
    assert.equal(count(svg, />等 \d+m<\/text>/g), 3, 'two waits that land together label only one');
    assert.match(svg, /<title>等 2m<\/title>/, 'and that one is on the band');
    const waitLab = [...svg.matchAll(/<text x="([\d.]+)" y="[\d.]+" text-anchor="middle"[^>]*>等 (\d+m)<\/text>/g)].map((w) => ({ x: +w[1], s: w[2] }));
    const bands = [...svg.matchAll(/<rect class="waitst" x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g)].map((w) => +w[1] + +w[2] / 2);
    const lastLab = waitLab[waitLab.length - 1];
    assert.equal(lastLab.s, '3m', 'the wait at the very end of the session is labelled');
    // That the whole label box lands inside the chart was measured in a browser,
    // not here: this asserts only that the clamp moved it off the band's centre.
    assert.ok(lastLab.x < bands[bands.length - 1] - 1, 'and its label is pulled in from the edge rather than centred off it');
    const bar = svg.match(/<rect x="([\d.]+)" y="[\d.]+" width="[\d.]+" height="12"/);
    const lab = svg.match(/<text x="([\d.]+)" y="[\d.]+"( text-anchor="end")? style="font-size:11\.5px;fill:var\(--ink2\)">sonnet-5 · 218k/);
    assert.ok(bar && lab, 'the bar and its label are drawn');
    assert.ok(lab[2], 'a bar with no room on its right turns its label around');
    assert.ok(+lab[1] < +bar[1], 'so the label sits to the left of the bar, inside the chart');
});

test('costModel lays a session\'s days out stage by model, subtotals main and agent, and totals', () => {
    const m = V.costModel(HOME[0].days);
    assert.deepEqual(m.stages.map((g) => [g.stage, g.sub.usd, g.models.map((x) => x.model)]),
        [['build', 1.75, ['claude-opus-5', 'claude-sonnet-5']], ['verify', 2, ['claude-opus-5']]]);
    assert.deepEqual([m.main.usd, m.agent.usd, m.total.usd], [3.25, 0.5, 3.75]);
    assert.deepEqual(m.total.tokens, { input: 6000, output: 600, cacheRead: 24000, cacheWrite: 4500 });
    assert.deepEqual([m.stages[0].sub.cost.output, m.stages[0].sub.cost.cacheWrite], [0.875, 0.21875]);
    assert.deepEqual(V.costModel(null).total.usd, 0);
});

test('頁面對帳：the session cost tab\'s total equals the sum of that session\'s days[].usd', () => {
    for (const s of HOME.filter((x) => x.days)) {
        const rows = s.days.reduce((n, r) => n + r.usd, 0);
        const m = V.costModel(s.days);
        assert.equal(m.total.usd, rows, s.id + ': the model');
        assert.equal(m.main.usd + m.agent.usd, rows, s.id + ': its two subtotals');
        const foot = V.costHtml(m).split('<tfoot>')[1];
        const shown = V.usd(rows).replace(/[$.]/g, '\\$&');
        assert.match(foot, new RegExp('<td>合計</td>[\\s\\S]*?<td class="r total">' + shown + '</td>'), s.id + ': the page');
    }
});

test('costHtml gains a 主迴圈 row per stage from x.loops, and the row rendered proves two things: turns sum to the page\'s total, and no stage\'s BUSY-and-over cost exceeds that stage\'s own total', () => {
    const days = [
        dayRow('2026-09-14', 'survey', 'claude-sonnet-5', 'main', 1, 100),
        dayRow('2026-09-14', 'build', 'claude-sonnet-5', 'main', 2, 1000),
        dayRow('2026-09-14', 'build', 'claude-opus-5', 'agent', 1, 500),
        dayRow('2026-09-14', 'verify', 'claude-sonnet-5', 'main', 2, 800),
    ];
    const m = V.costModel(days);
    const x = { loops: [
        { stage: 'survey', turns: 4, over: 0, overUsd: 0 },
        { stage: 'build', turns: 5, over: 2, overUsd: 0.5 },
        { stage: 'verify', turns: 3, over: 3, overUsd: 1.2 },
    ] };
    const html = V.costHtml(m, x);
    const blocks = html.split('<tfoot>')[0].split('<tr class="sub">').slice(1);
    assert.equal(blocks.length, 3, 'one block per stage in m.stages, survey/build/verify in route order');
    const toNum = (s) => (s === '—' ? 0 : Number(s.replace(/[$,]/g, '')));
    let sumTurns = 0;
    blocks.forEach((b) => {
        const subRow = b.slice(0, b.indexOf('</tr>'));
        const cells = [...subRow.matchAll(/<td class="r[^"]*">(\$[\d.,]+|—)<\/td>/g)];
        const stageUsd = toNum(cells[cells.length - 1][1]);
        const turns = Number(b.match(/<span><b>(\d+)<\/b>回合<\/span>/)[1]);
        const overUsd = toNum(b.match(/<b>(\$[\d.,]+|—)<\/b>那些回合/)[1]);
        sumTurns += turns;
        assert.ok(overUsd <= stageUsd + 1e-9, 'a stage\'s BUSY-and-over cost does not exceed its own total: ' + overUsd + ' vs ' + stageUsd);
    });
    const foot = html.split('<tfoot>')[1];
    const footTurns = Number(foot.match(/<span><b>(\d+)<\/b>回合<\/span>/)[1]);
    assert.equal(sumTurns, footTurns, 'the per-stage turn counts sum to the page\'s total main-loop turn count');
    assert.equal(footTurns, 4 + 5 + 3);
    // The footer row sits under 主 session / agent / 合計, so its label takes the
    // first cell as theirs do, and its share is of the session, not of a stage.
    assert.match(foot, /<tr class="loop"><td><span class="lp">主迴圈<\/span><\/td><td><\/td>/);
    assert.match(foot, /<\/b>佔 session<\/span>/);
    assert.match(blocks[1], /<tr class="loop"><td><\/td><td><span class="lp">主迴圈<\/span><\/td>[\s\S]*<\/b>佔這一站<\/span>/);
    assert.match(blocks[0], /<span class="zero"><b>0<\/b>回合 ≥ 400k<\/span>/, 'a stage with no BUSY-and-over turn is styled zero');
    assert.match(blocks[0], /<span class="zero"><b>—<\/b>那些回合<\/span>/, 'and its dollar figure is a dash, not $0.00');
});

test('costHtml with no detail loaded yet renders no 主迴圈 row and no stray NaN or undefined', () => {
    const m = V.costModel([dayRow('2026-09-14', 'build', 'claude-sonnet-5', 'main', 1, 100)]);
    const html = V.costHtml(m);
    assert.doesNotMatch(html, /主迴圈|NaN|undefined/);
});

test('the dispatch tab adds input and output tokens and USD per row, and the events tab says how long each gate waited', () => {
    const html = V.dispatchHtml(DETAIL_X);
    assert.match(html, /<th class="r">input<\/th><th class="r">input USD<\/th><th class="r">output<\/th><th class="r">output USD<\/th>/);
    assert.match(html, /read:map[\s\S]*?<td class="r">2k<\/td><td class="r">\$0\.04<\/td><td class="r">12k<\/td><td class="r">\$0\.10<\/td>/,
        'tokens from split, dollars from cost');
    const foot = html.slice(html.indexOf('<tfoot>'), html.indexOf('</tfoot>'));
    assert.match(foot, /<td class="r">5k<\/td><td class="r">\$0\.54<\/td><td class="r">66k<\/td><td class="r">\$0\.85<\/td>/,
        'the footer sums the rows; a null cost adds no dollars but its tokens still count');
    assert.match(V.replayHtml(DETAIL_X), /<span class="tg gate">gate<\/span>等了 15m00s/);
});

test('the session header reads dollars from days and time from the timeline; the four tabs link by hash', () => {
    const head = V.sessionHeadHtml(HOME[0], DETAIL_X);
    assert.match(head, /花費<\/div><div class="v">\$3\.75/);
    assert.match(head, /歷時<\/div><div class="v">2h</);
    assert.match(head, /2 次 gate/);
    assert.match(head, /叫醒<\/div><div class="v">4<span class="u">次<\/span>/);
    assert.match(V.sessionHeadHtml(HOME[0], Object.assign({}, DETAIL_X, { wakes: undefined })), /叫醒<\/div><div class="v">—</, 'a cache from before wakes shows a dash, not a zero');
    assert.doesNotMatch(head, /\$99|\$198/);
    const tabs = V.tabsHtml(HOME[0], 'dispatch', DETAIL_X);
    assert.deepEqual([...tabs.matchAll(/href="([^"]+)"/g)].map((x) => x[1]),
        ['#/s/aaaa1111-0000', '#/s/aaaa1111-0000/dispatch', '#/s/aaaa1111-0000/events']);
    assert.match(tabs, /<a href="#\/s\/aaaa1111-0000\/dispatch" class="on" aria-current="page">派工</);
    // The 花費 tab folded into 概覽: an old `/cost` link still parses, and opens 概覽.
    assert.match(V.tabsHtml(HOME[0], V.parseHash('#/s/aaaa1111-0000/cost').tab, DETAIL_X),
        /<a href="#\/s\/aaaa1111-0000" class="on" aria-current="page">概覽</);
});

test('a kept v1 cache\'s single row: the cost tab counts its dollars, zero tokens and no per-kind dollars', () => {
    const m = V.costModel(KEPT.days);
    assert.deepEqual([m.total.usd, m.main.usd, m.agent.usd], [2.5, 2.5, 0]);
    assert.deepEqual(m.total.tokens, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
    assert.deepEqual(m.total.cost, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
    assert.deepEqual(m.stages.map((g) => [g.stage, g.sub.usd]), [['none', 2.5]]);
    const html = V.costHtml(m);
    assert.match(html.split('<tfoot>')[1], /<td>合計<\/td>[\s\S]*?<td class="r total">\$2\.50<\/td>/);
    assert.doesNotMatch(html, /NaN|undefined/);
    assert.match(V.sessionHeadHtml(KEPT, null), /花費<\/div><div class="v">\$2\.50/);
});

// --- fix: a selected registry's card on 清單, and the header it narrows -----
// `listPage()`, `genText()` and the click handler that sets `f.project` all
// live below the `module.exports` guard, so `require()` never reaches them —
// `f` and `route` are never assigned once `doc` is null. `smoke-page.js`
// proves the same file runs those DOM-touching parts fine when handed a stub
// `document` through `vm.runInNewContext`, so this test drives it the same
// way instead of restating `registryNote()`'s or `genText()`'s logic inline.
test('selecting a registry on 清單 keeps its unreadable-session count on the card once the header stops showing the total', () => {
    const vm = require('node:vm');
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
    const els = {};
    const listeners = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const doc = {
        getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener: (type, fn) => { listeners[type] = fn; },
        createElement: el,
        head: { appendChild() {} },
        querySelectorAll: () => [],
    };
    const win = {
        location: { hash: '#/list' }, addEventListener() {}, scrollTo() {},
        STATION: {
            generatedAt: new Date(2026, 8, 14, 21).toISOString(), configDir: 'C:\\cfg',
            pricesVerified: '2026-09-04', serve: false,
            projects: [{ root: 'F:\\ws\\alpha', gone: false, unreadable: 2, build: [], mapAt: null }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} },
            profileKeys: {}, classes: {}, sessions: [],
        },
    };
    vm.runInNewContext(src, { window: win, document: doc, URLSearchParams, fetch() {} });
    assert.match(els.gen.textContent, /2 個 session 檔案讀不到/, 'nothing selected: the header carries the total');

    // The same click the facet segment's `[data-facet] button` sends.
    listeners.click({
        target: {
            closest: (sel) => (sel === '[data-facet] button'
                ? { parentNode: { getAttribute: () => 'project' }, getAttribute: () => 'F:\\ws\\alpha' }
                : null),
        },
    });
    assert.match(els.page.innerHTML, /2 個 session 檔案讀不到/, 'the selected registry carries its own count on the card');
    assert.doesNotMatch(els.gen.textContent, /個 session 檔案讀不到/, 'the header drops the total once that card is on screen');
});

// --- fix: the health poll must never arm on a page opened as a bare file ---
// `--open` (scripts/station.js:758) writes the page and opens it with no
// server behind it, so the poll has to switch itself off there rather than
// show a permanent death banner. The smoke test above stubs `document` but
// gives `win` no `setInterval` at all, which is exactly why the poll block
// is skipped there and the suite stayed green either way — that proves
// nothing about the `file:` guard itself. This test arms a `setInterval` spy
// on both a `file:` and an `http:` `location.protocol` so a guard that
// stopped checking the protocol would show up on the `file:` arm, not just
// vanish into an already-skipped block.
test('under file: nothing arms; served, the page re-reads every 3s, ticks every second and polls health every 5s', () => {
    const vm = require('node:vm');
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
    const armed = (protocol) => {
        const els = {};
        const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
        const doc = {
            getElementById: (id) => els[id] || (els[id] = el()),
            addEventListener: () => {},
            createElement: el,
            head: { appendChild() {} },
            querySelectorAll: () => [],
        };
        const calls = [];
        const win = {
            location: { hash: '#/', protocol }, addEventListener() {}, scrollTo() {},
            setInterval: (fn, ms) => { calls.push(ms); return 1; },
            STATION: {
                generatedAt: new Date(2026, 8, 14, 21).toISOString(), configDir: 'C:\\cfg',
                pricesVerified: '2026-09-04', serve: protocol !== 'file:',
                projects: [{ root: 'F:\\ws\\alpha', gone: false, unreadable: 2, build: [], mapAt: null }],
                profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} },
                profileKeys: {}, classes: {}, sessions: [],
            },
        };
        vm.runInNewContext(src, { window: win, document: doc, URLSearchParams, fetch() {} });
        return calls;
    };
    assert.deepEqual(armed('file:'), [], 'a bare file open schedules no poll at all');
    assert.deepEqual(armed('http:'), [3000, 1000, 5000], 'a served page re-reads, ticks and polls, in that order');
});

// The frozen eyebrow is rendered rather than patched, so the flip into and
// out of frozen has to call `draw()` — and a poll that finds nothing changed
// must not, because a redraw every five seconds throws away a scroll position
// and an opened row on a page whose numbers cannot move any more. Nothing
// else reaches that gate: the smoke test gives `win` no `setInterval`, and
// the test above captures the interval's period without ever invoking its
// callback. So this one drives the callback, with a `Date` it moves and a
// `#page` that counts how often it is written — `draw()` assigns
// `p.innerHTML` (assets/station/station.js:2471), which is what the counter
// below is on.
test('a poll finding no change does not redraw, and each state flip redraws once', async () => {
    const vm = require('node:vm');
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');

    // The page reads `Date.now()` for the poll's baseline and `Date.parse`
    // for every `started`. The subclass inherits the second as a static, so
    // only the first is overridden — and moving it is how this test spends
    // fifteen seconds without waiting them.
    let skew = 0;
    class Clock extends Date {
        static now() { return Date.now() + skew; }
    }

    let draws = 0, tick = null, alive = true;
    const el = () => ({
        innerHTML: '', textContent: '', className: '', title: '', style: {}, hidden: false,
        setAttribute() {}, appendChild() {}, addEventListener() {},
    });
    const page = el();
    Object.defineProperty(page, 'innerHTML', { get() { return ''; }, set() { draws++; } });
    const els = { page: page };
    const doc = {
        getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, head: { appendChild() {} },
        querySelectorAll: () => [],
        // `showDead` inserts the bar after `.mast`, unguarded.
        querySelector: () => ({ parentNode: { insertBefore() {} }, nextSibling: null }),
    };
    const win = {
        location: { hash: '#/', protocol: 'http:' }, addEventListener() {}, scrollTo() {},
        setInterval: (fn) => { tick = fn; return 1; },
        STATION: {
            generatedAt: new Date(2026, 8, 14, 21).toISOString(), configDir: 'C:\\cfg',
            pricesVerified: '2026-09-04', serve: true,
            projects: [{ root: 'F:\\ws\\alpha', gone: false, unreadable: 2, build: [], mapAt: null }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} },
            profileKeys: {}, classes: {}, sessions: [],
        },
    };
    vm.runInNewContext(src, {
        window: win, document: doc, URLSearchParams, Date: Clock,
        fetch: () => (alive ? Promise.resolve({ ok: true }) : Promise.reject(new Error('refused'))),
    });

    // Awaiting a macrotask drains the fetch chain's microtasks.
    const settle = () => new Promise((r) => { setImmediate(r); });
    const atLoad = draws;
    // The counter is on the real thing, and this is what says so: a stub the
    // page never writes would leave this at zero and every count below would
    // pass vacuously.
    assert.ok(atLoad > 0, 'the page drew on load');
    assert.equal(typeof tick, 'function', 'the poll armed');

    // The server goes quiet and the grace window passes: the flip redraws.
    alive = false;
    skew = 16000;
    tick(); await settle(); await settle();
    assert.equal(draws, atLoad + 1, 'the flip into frozen did not redraw exactly once');
    // Five seconds later it is still gone. Nothing has changed, so nothing
    // may be redrawn — this is the assertion the whole gate exists for.
    skew = 21000;
    tick(); await settle(); await settle();
    assert.equal(draws, atLoad + 1, 'a poll that found nothing changed redrew the page');
    // It answers again: one redraw to take the eyebrow back, then none.
    alive = true;
    tick(); await settle(); await settle();
    assert.equal(draws, atLoad + 2, 'the flip back to live did not redraw exactly once');
    tick(); await settle(); await settle();
    assert.equal(draws, atLoad + 2, 'a poll on a live server redrew the page');
});

const DOC_A = {
    pkey: 'F:\\ws\\alpha', generatedAt: '2026-09-18T16:16:00.000Z', total: 201,
    buckets: [{ label: 'current', count: 89 }, { label: 'planned', count: 2 }, { label: 'retired', count: 102 }, { label: 'undeclared', count: 8 }],
    plannedNotBuilt: ['docs/improvement-brief.md'],
    undeclared: { count: 2, note: 'dated by git rather than by anyone reading them', paths: ['docs/a.md', 'docs/b.md'] },
    filing: { index: 'docs/README.md', rows: [
        { bucket: 'docs/archive', role: 'archive', note: '102, the whole archive bucket' },
        { bucket: 'docs/plans', role: 'plan', note: null },
    ] },
};

test('docsCardHtml quotes one project\'s map.md into a section: counts, both lists, the filing table with its retired note, and when it was generated', () => {
    const o = { names: { 'F:\\ws\\alpha': 'alpha' }, pkeys: ['F:\\ws\\alpha'] };
    const html = V.docsCardHtml([DOC_A], o);
    assert.match(html, /<div class="h2">文件 /);
    assert.match(html, />alpha</);
    assert.match(html, /201 markdown files/);
    assert.match(html, /current <b>89<\/b>/);
    assert.match(html, /docs\/improvement-brief\.md/);
    assert.match(html, /docs\/a\.md/);
    assert.match(html, /dated by git rather than by anyone reading them/);
    assert.match(html, /docs\/archive[\s\S]*archive[\s\S]*retired — 102, the whole archive bucket/);
    assert.match(html, /docs\/plans[\s\S]*plan/);
    assert.match(html, /2026-09-18 16:16/);
    // Every bar segment and every legend swatch carries a real `background:`
    // declaration — the retired one's hatch too, which a bare value would drop.
    const split = html.slice(html.indexOf('<div class="split-bar"'), html.indexOf('</div></div>', html.indexOf('<div class="split-leg">')));
    const styles = split.match(/style="[^"]*"/g);
    assert.equal(styles.length, DOC_A.buckets.length * 2, 'one bar segment and one legend swatch per bucket');
    for (const style of styles) {
        assert.equal((style.match(/background:/g) || []).length, 1, style);
    }
    assert.match(html, /<i title="retired 102" style="flex:102 1 0;background:var\(--hatch-bg\)/);
});

test('docsCardHtml is empty with no project map, so the whole card is left out', () => {
    assert.equal(V.docsCardHtml([], { names: {}, pkeys: [] }), '');
});

const NAV_DAYS = ['2026-09-22', '2026-09-23'];
const NAV_SESSIONS = [
    { id: 'n1', root: '/r', pkey: 'p', state: 'live', task: 'one', stage: 'build', updated: 30, days: [{ day: '2026-09-23', usd: 2, tokens: {} }] },
    { id: 'n2', root: '/r', pkey: 'p', state: 'stale', task: 'two', stage: 'plan', updated: 20, days: [{ day: '2026-09-22', usd: 1, tokens: {} }] },
    { id: 'n3', root: '/r', pkey: 'p', state: 'down', task: 'three', stage: 'land', updated: 10, days: [{ day: '2026-09-01', usd: 5, tokens: {} }] },
];
const NAV_PROJECTS = [{ root: '/r', gone: false, docs: [{ pkey: 'p' }] }, { root: '/gone', gone: true, docs: [] }];

test('navHtml marks the current page, links every page, and has no dropdown', () => {
    const out = V.navHtml('days', { live: 2, usd: 12.5, sessions: 3, projects: 1, docs: 0 });
    assert.match(out, /<a href="#\/days" aria-current="page">/);
    for (const h of ['#/', '#/sessions', '#/projects', '#/docs', '#/settings', '#/list', '#/cmp']) {
        assert.ok(out.includes('<a href="' + h + '"'), h);
    }
    assert.match(out, /data-block="nav"/);
    assert.match(out, /2 live/);
    assert.ok(!out.includes('<select'));
    assert.match(V.navHtml('project', { live: 0, usd: 0, sessions: 0, projects: 0, docs: 0 }), /<a href="#\/projects" aria-current="page">/);
    assert.match(V.navHtml('session', { live: 0, usd: 0, sessions: 0, projects: 0, docs: 0 }), /<a href="#\/sessions" aria-current="page">/);
});

// NAV_TREE's five categories, unreachable directly (it is not in
// module.exports), so this reads them off what navHtml renders instead.
test('navHtml renders all five NAV_TREE categories', () => {
    const out = V.navHtml('now', { live: 0, usd: 0, sessions: 0, projects: 0, docs: 0 });
    for (const label of ['儀表板', 'Sessions', '花費', '文件', '設定']) {
        assert.ok(out.includes('<span>' + label + '</span>'), label);
    }
});

test('navHtml folds a shut category under aria-expanded="false" and leaves an unshut one open, while the fold-less 設定 category never gets a toggle button', () => {
    const c = { live: 0, usd: 0, sessions: 0, projects: 0, docs: 0 };
    const shut = V.navHtml('live', c, { shut: { sessions: true } });
    // Sessions is shut and its active page ('live') is inside it: both classes apply.
    assert.match(shut, /<li class="navcat in shut" data-fold="sessions">/);
    assert.match(shut, /<button type="button" class="navrow navhd" data-navfold="sessions"[^>]*aria-expanded="false"/);
    // 花費 was not named in `ui.shut`, so it stays open even though it too has a fold key.
    assert.match(shut, /<button type="button" class="navrow navhd" data-navfold="spend"[^>]*aria-expanded="true"/);
    // Its kids still render in the markup either way — CSS, not the server, hides them.
    assert.match(shut, /<span>進行中<\/span>/);
    assert.match(shut, /<span>最近<\/span>/);
    // 設定 has no `fold`, so it is always a plain link to its first (only) kid, never a button.
    assert.doesNotMatch(shut, /data-navfold="settings"/);
    assert.match(shut, /<a class="navhd" href="#\/settings">/);
    assert.match(shut, /<span>精靈<\/span>/);
    // With no `ui` at all every fold defaults open.
    const open = V.navHtml('now', c);
    assert.match(open, /data-navfold="sessions"[^>]*aria-expanded="true"/);
});

test('navHtml badges follow the new `badges` map: live gets a live-class count, 儀表板 and 文件 carry no badge at all', () => {
    const out = V.navHtml('days', { live: 3, usd: 12.5, sessions: 0, projects: 0, docs: 4 });
    assert.match(out, /<a href="#\/live"><span>進行中<\/span><span class="nb live">3 live<\/span><\/a>/);
    // `v: 'now'` (儀表板) maps to `badges.now === null` — no badge span at all.
    const dashLink = out.match(/<a href="#\/">[\s\S]*?<\/a>/)[0];
    assert.match(dashLink, /<span>儀表板<\/span><\/a>$/, '儀表板\'s label is the last thing in its link, nothing after it');
    assert.doesNotMatch(dashLink, /class="nb/, '儀表板 never gets a badge');
    // 文件 (`v: 'docs'`) does carry a badge, the doc count.
    const docsLink = out.match(/<a href="#\/docs">[\s\S]*?<\/a>/)[0];
    assert.match(docsLink, /<span>文件<\/span><span class="nb">4<\/span><\/a>$/);
    assert.equal(V.navCounts([{ state: 'live' }], [], []).live, 1, 'the count navHtml\'s live badge is built from');
});

// --- fix: stageShare, costShareHtml, subtabsHtml and the four 儀表板 cards —
// seven functions the reviewer flagged as defined but not covered, and it
// turned out `module.exports` did not even carry them to `require()`. Fixed
// alongside these tests: the nine missing keys (these seven plus `NAV_TREE`
// and the session detail page had already reached `navHtml`'s tests above).

// Matches the reachability check from the fix's own step 2 (`typeof V.x ===
// 'function'`/`'object'` off a bare `require()`), and doubles as
// tests/source.test.js's control: that test flags an exported name nobody's
// `V.<name>` (or a bound require's own alias) ever reaches, and
// `dashSpend`/`dashRecent`/`dashPage` below are only driven through `DASH.
// <name>`, never `V.<name>`, because calling them off the plain `require()`
// crashes (see `DASH` below) — this line is what keeps their names counted
// as used without adding a crashing call.
test('the nine newly exported names are reachable off a plain require()', () => {
    assert.equal(typeof V.stageShare, 'function');
    assert.equal(typeof V.costShareHtml, 'function');
    assert.equal(typeof V.subtabsHtml, 'function');
    assert.equal(typeof V.dashLive, 'function');
    assert.equal(typeof V.dashGate, 'function');
    assert.equal(typeof V.dashSpend, 'function');
    assert.equal(typeof V.dashRecent, 'function');
    assert.equal(typeof V.dashPage, 'function');
    assert.ok(Array.isArray(V.NAV_TREE));
});

// `stageShare`'s `s.stages` windows accumulate onto the same row when a stage
// is visited twice (`design` below visits once with a zero-length window, on
// purpose, so it has no `usd`/`ms`/`req` at all and drops out of `L.rows`);
// `s.days` and `s.stages` are inserted out of `ROUTE` order (`build`,
// `verify`, `survey`, then `design`) so a `L.rows` order that just matched
// insertion order would show up here as a failure.
const STAGE_S = {
    days: [
        { stage: 'build', who: 'main', usd: 1 },
        { stage: 'verify', who: 'main', usd: 2 },
        { stage: 'build', who: 'agent', usd: 0.5 },
        { stage: 'survey', who: 'main', usd: 0.3 },
    ],
    stages: [
        { stage: 'verify', from: 1000000, to: 1300000 },
        { stage: 'build', from: 0, to: 600000 },
        { stage: 'build', from: 700000, to: 1000000 },
        { stage: 'design', from: 500, to: 500 },
    ],
};
const STAGE_X = {
    points: [{ t: 100 }, { t: 700 }, { t: 1200 }],
    seq: [{ at: 0, stage: 'survey' }, { at: 600, stage: 'build' }, { at: 1000, stage: 'verify' }],
};

test('stageShare sums usd across days, splits main/agent by who, sums ms across a stage\'s two windows, orders by ROUTE and drops a stage with nothing in it', () => {
    const L = V.stageShare(STAGE_S, STAGE_X);
    assert.equal(L.total, 3.8, 'every days row\'s usd, regardless of stage');
    assert.deepEqual(L.rows.map((r) => r.stage), ['survey', 'build', 'verify'], 'ROUTE order (survey, build, verify), not insertion order, and design is gone');
    assert.deepEqual(L.rows[0], { stage: 'survey', ms: null, usd: 0.3, main: 0.3, agent: 0, req: 1 });
    assert.deepEqual(L.rows[1], { stage: 'build', ms: 900000, usd: 1.5, main: 1, agent: 0.5, req: 1 },
        'build\'s two stages windows (600000 + 300000) summed onto one row — confirmed correct, not a bug');
    assert.deepEqual(L.rows[2], { stage: 'verify', ms: 300000, usd: 2, main: 2, agent: 0, req: 1 });
});

test('stageShare with x omitted leaves req null on every row rather than 0', () => {
    const L = V.stageShare(STAGE_S, null);
    assert.equal(L.rows.length, 3);
    for (const r of L.rows) assert.equal(r.req, null);
});

test('costShareHtml marks the bar segment and table row matching hi with on/aria-pressed, and leaves every other stage plain', () => {
    const L = V.stageShare(STAGE_S, null);
    const html = V.costShareHtml(L, 'build');
    assert.match(html, /<button type="button" class="csseg on" data-hist="build" aria-pressed="true"/);
    assert.match(html, /<tr class="csrow on" data-hist="build" tabindex="0" aria-pressed="true"/);
    assert.doesNotMatch(html, /class="csseg on" data-hist="survey"/);
    assert.doesNotMatch(html, /class="csrow on" data-hist="survey"/);
    assert.match(html, /<button type="button" class="csseg" data-hist="survey" aria-pressed="false"/);
    assert.match(html, /<tr class="csrow" data-hist="survey" tabindex="0" aria-pressed="false"/);
});

test('costShareHtml with no paid stage prints the 沒有按日的花費 line instead of a bar', () => {
    const empty = V.costShareHtml({ total: 0, rows: [] }, null);
    assert.match(empty, /這個 session 沒有按日的花費/);
    assert.doesNotMatch(empty, /<div class="csbar"/);
    const zero = V.costShareHtml({ total: 0, rows: [{ stage: 'build', ms: null, usd: 0, main: 0, agent: 0, req: null }] }, null);
    assert.match(zero, /這個 session 沒有按日的花費/);
    assert.doesNotMatch(zero, /<div class="csbar"/);
});

test('subtabsHtml is empty for a single-link category and a strip with aria-current for a multi-kid one', () => {
    assert.equal(V.subtabsHtml('now'), '', '儀表板 has no kids');
    assert.equal(V.subtabsHtml('docs'), '', '文件 has no kids');
    const live = V.subtabsHtml('live');
    assert.match(live, /<nav class="subtabs" data-block="subtabs" aria-label="Sessions">/);
    for (const label of ['進行中', '最近', '全部清單', '比較']) assert.ok(live.includes(label));
    assert.match(live, /<a href="#\/live" aria-current="page">進行中<\/a>/);
    assert.doesNotMatch(live, /<a href="#\/sessions" aria-current="page">/);
    const days = V.subtabsHtml('days');
    assert.match(days, /<a href="#\/days" aria-current="page">近 30 天<\/a>/);
    assert.match(days, /<a href="#\/projects">依專案<\/a>/);
});

// `dashLive`, `dashGate`, `dashSpend` and `dashRecent` all read at least one
// module-scoped var (`NAMES` via `dashRowName`, or `DAYS` via `dayBars`/
// `recentRows`) that only `freshen()` sets, behind the `if (!doc) return`
// guard `require()` never crosses — `doc` is `window.document`, undefined in
// this file's plain Node `require()`, so calling any of them off the `V`
// above throws ("Cannot read properties of undefined"). `DASH` runs the same
// source through `vm.runInNewContext` the way the smoke tests further down
// already do for DOM-touching code, but also hands the sandbox a `module`
// object — with `document` truthy too, `freshen()` runs before the IIFE
// returns, so the closures `module.exports` captures are the ones with
// `NAMES`/`DAYS` already filled in. `DASH.dashLive` etc. can then be called
// directly, the same as any function on the plain `V`.
const DASH = (() => {
    const vm = require('node:vm');
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const doc = {
        getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener: () => {},
        createElement: el,
        head: { appendChild() {} },
        querySelectorAll: () => [],
    };
    const win = {
        location: { hash: '#/' }, addEventListener() {}, scrollTo() {},
        STATION: {
            generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg',
            pricesVerified: '2026-09-04', serve: false,
            projects: [{ root: 'F:\\ws\\alpha', gone: false, unreadable: 0, build: [], mapAt: null }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} },
            profileKeys: {}, classes: {}, sessions: [],
        },
    };
    const sandbox = { window: win, document: doc, URLSearchParams, fetch() {}, module: { exports: {} } };
    vm.runInNewContext(src, sandbox);
    return sandbox.module.exports;
})();

const DASH_LIVE = [
    { id: 'dl-live', pkey: 'F:\\ws\\alpha', task: 'live one', state: 'live', updated: NOW - 1000, started: NOW - 120000, route: [], stage: 'build' },
    { id: 'dl-stale', pkey: 'F:\\ws\\alpha', task: 'stale one', state: 'stale', updated: NOW - 2000, started: NOW - 90000, route: [], stage: 'plan' },
    { id: 'dl-down', pkey: 'F:\\ws\\alpha', task: 'down one', state: 'down', updated: NOW - 3000, started: NOW - 60000, route: [], stage: 'verify' },
];

test('dashLive counts and lists only the live rows, each linking to its session hash', () => {
    const html = DASH.dashLive(DASH_LIVE);
    assert.match(html, /data-block="dash-live"/);
    assert.match(html, /<b>進行中<\/b><span class="kn">1<\/span>/);
    assert.doesNotMatch(html, /class="dbig"/);
    assert.equal(count(html, /class="drow"/g), 1);
    assert.match(html, /<a class="drow" href="#\/s\/dl-live"/);
    assert.doesNotMatch(html, /#\/s\/dl-stale|#\/s\/dl-down/);
    assert.match(DASH.dashLive([]), /沒有進行中的 session/);
});

const DASH_GATE = [
    { id: 'dg-open', pkey: 'F:\\ws\\alpha', task: 'waiting', updated: NOW - 500000,
      pending: { questions: [{ header: 'q1' }], at: NOW - 400000, until: NOW + 600000 } },
    { id: 'dg-none', pkey: 'F:\\ws\\alpha', task: 'no pending field', updated: NOW - 500000, pending: undefined },
    { id: 'dg-empty', pkey: 'F:\\ws\\alpha', task: 'empty questions', updated: NOW - 500000, pending: { questions: [] } },
];

test('dashGate counts and lists only rows with a non-empty pending.questions', () => {
    const html = DASH.dashGate(DASH_GATE);
    assert.match(html, /data-block="waiting-card"/);
    assert.match(html, /<b>等你回答<\/b><span class="kn warn">1<\/span>/);
    assert.equal(count(html, /class="drow"/g), 1);
    assert.match(html, /<a class="drow" href="#\/s\/dg-open"/);
    assert.doesNotMatch(html, /#\/s\/dg-none|#\/s\/dg-empty/);
    assert.match(DASH.dashGate([]), /沒有在等你的 gate/);
});

const DASH_SPEND_R = [
    { id: 'ds1', pkey: 'F:\\ws\\alpha', days: [dayRow('2026-09-14', 'build', 'claude-opus-5', 'main', 3, 100)] },
    { id: 'ds2', pkey: 'F:\\ws\\alpha', days: [dayRow('2026-09-13', 'build', 'claude-opus-5', 'main', 2, 100)] },
];

test('dashSpend does not throw on an empty or single-session R, and its dbig total matches windowTotals(R, DAYS).usd', () => {
    assert.doesNotThrow(() => DASH.dashSpend([]));
    assert.doesNotThrow(() => DASH.dashSpend([DASH_SPEND_R[0]]));
    const html = DASH.dashSpend(DASH_SPEND_R);
    assert.match(html, /data-block="dash-spend"/);
    const tot = V.windowTotals(DASH_SPEND_R, DAYS).usd;
    assert.equal(tot, 5);
    assert.ok(html.includes('<div class="dbig">' + V.usd(tot) + '</div>'), html);
});

const DASH_RECENT_R = Array.from({ length: 7 }, (_, i) => ({
    id: 'rec' + i, pkey: 'F:\\ws\\alpha', task: 'task ' + i, state: 'down', stage: 'build',
    updated: NOW - i * 60000, days: [dayRow('2026-09-14', 'build', 'claude-opus-5', 'main', 1, 10)],
}));

test('dashRecent lists exactly 5 rows out of more than 5 eligible ones, newest first by recentRows\' own order', () => {
    const html = DASH.dashRecent(DASH_RECENT_R);
    assert.match(html, /data-block="dash-recent"/);
    assert.equal(count(html, /class="drow"/g), 5);
    const ids = [...html.matchAll(/href="#\/s\/(rec\d)"/g)].map((m) => m[1]);
    assert.deepEqual(ids, ['rec0', 'rec1', 'rec2', 'rec3', 'rec4'],
        'the five most recently updated, in the same order recentRows sorts them');
    assert.match(DASH.dashRecent([]), /近 30 天沒有 session/);
});

// `dashPage()` reads `S`/`homeRows()` the same way `sessionsPage`/`nowPage`
// do, and this file has no existing pattern for driving that class of
// function directly (no other test calls `nowHtml`/`sessionsPage` through
// module state rather than a plain parameter list). `DASH.dashPage()` is
// reachable here only because building `DASH` above already routes around
// the same `doc`/`freshen()` gap; boot-time `STATION.sessions` is `[]`, so
// this checks assembly and order rather than card content, which the four
// tests above already cover directly off explicit rows.
test('dashPage assembles all four cards in dashLive, dashGate, dashSpend, dashRecent order', () => {
    const html = DASH.dashPage();
    assert.match(html, /<h1>.*儀表板<\/h1>/);
    for (const key of ['dash-live', 'waiting-card', 'dash-spend', 'dash-recent']) {
        assert.match(html, new RegExp('data-block="' + key + '"'));
    }
    const wide = html.slice(0, html.indexOf('data-col="side"'));
    assert.ok(wide.indexOf('dash-live') < wide.indexOf('dash-spend'));
    assert.ok(wide.indexOf('dash-spend') < wide.indexOf('dash-recent'));
    assert.ok(html.indexOf('data-col="side"') < html.indexOf('waiting-card'), 'the gate card sits in the narrow column');
});

test('recentRows keeps what spent inside the window or is still live, newest first', () => {
    const rows = V.recentRows(NAV_SESSIONS, NAV_DAYS);
    assert.deepEqual(rows.map((s) => s.id), ['n1', 'n2']);
});

test('the live badge counts exactly the rows 現在 marks live', () => {
    global.window.STATION.serve = false;
    const c = V.navCounts(NAV_SESSIONS, NAV_PROJECTS, NAV_DAYS);
    const now = V.nowHtml(NAV_PROJECTS, NAV_SESSIONS);
    assert.equal(c.live, 1);
    assert.equal((now.match(/data-state="live"/g) || []).length, c.live);
    assert.equal((now.match(/data-state="stale"/g) || []).length, 1);
    assert.ok(!now.includes('data-state="down"'), 'a session that is down is not on 現在');
    assert.ok(!now.includes('/gone'), 'a gone registry gets no card');
    assert.match(now, /data-block="now"/);
    assert.ok(!now.includes('<select'));
    assert.equal(c.sessions, V.recentRows(NAV_SESSIONS, NAV_DAYS).length);
    assert.equal(c.usd, 3);
    assert.equal(c.docs, 1);
});

// docs/90-agent/plans/2026-09-27-five-items-design.md §1: `#/live` is four
// blocks — the gates waiting, the sessions confirmed running, the ones that
// may have stopped, and one line of chips for every registry with neither.
const LV_T = Date.now();
const LV_PROJECTS = [
    { root: 'F:\\ws\\alpha', gone: false }, { root: 'F:\\ws\\beta', gone: false },
    { root: 'F:\\ws\\quiet', gone: false }, { root: 'F:\\ws\\gone', gone: true },
];
const LV_SESSIONS = [
    { id: 'lv-run', root: 'F:\\ws\\alpha', project: null, state: 'live', unknown: false, task: 'running one', stage: 'plan',
      route: ['survey', 'design', 'plan', 'build'], started: new Date(LV_T - 20 * 60000).toISOString(), updated: LV_T - 2 * 60000,
      stages: [{ stage: 'survey', from: LV_T - 20 * 60000, to: LV_T - 8 * 60000 },
          { stage: 'design', from: LV_T - 8 * 60000, to: LV_T - 3 * 60000 },
          { stage: 'plan', from: LV_T - 3 * 60000, to: LV_T - 2 * 60000 }], pending: null },
    { id: 'lv-gate', root: 'F:\\ws\\alpha', project: 'Beta', state: 'live', unknown: false, task: 'gated one', stage: 'design',
      route: ['survey', 'design'], started: new Date(LV_T - 10 * 60000).toISOString(), updated: LV_T - 4 * 60000, stages: [],
      pending: { questions: [{ header: '選一個方向', question: '哪一個？' }], at: LV_T - 4 * 60000, until: LV_T + 26 * 60000 } },
    { id: 'lv-unsure', root: 'F:\\ws\\beta', project: null, state: 'live', unknown: true, task: 'unsure one', stage: 'verify',
      route: ['survey', 'build', 'verify'], started: new Date(LV_T - 86400000).toISOString(), updated: LV_T - 3 * 86400000,
      stages: [], pending: null },
    { id: 'lv-stale', root: 'F:\\ws\\beta', project: null, state: 'stale', unknown: false, task: 'stale one', stage: 'build',
      route: ['survey', 'build'], started: new Date(LV_T - 86400000).toISOString(), updated: LV_T - 3 * 3600000,
      stages: [], pending: null },
    { id: 'lv-down', root: 'F:\\ws\\quiet', project: null, state: 'down', unknown: false, task: 'down one', stage: 'land',
      route: ['survey', 'land'], started: new Date(LV_T - 86400000).toISOString(), updated: LV_T - 86400000,
      stages: [], pending: null },
];
// One block's markup: from its `data-block` to the first `</section>` after it.
const lvBlock = (html, name) => {
    const at = html.indexOf('data-block="' + name + '"');
    return at < 0 ? '' : html.slice(at, html.indexOf('</section>', at));
};

test('#/live draws four blocks in order, and an idle registry is a chip rather than a card', () => {
    global.window.STATION.serve = false;
    const html = V.nowHtml(LV_PROJECTS, LV_SESSIONS);
    const order = ['live-gate', 'live-run', 'live-maybe', 'live-idle'].map((n) => html.indexOf('data-block="' + n + '"'));
    assert.ok(order.every((i) => i > 0), order.join(','));
    assert.deepEqual([...order].sort((a, b) => a - b), order, 'gate, run, maybe, idle, top to bottom');
    assert.ok(html.indexOf('data-block="now"') < order[0], 'all four inside the page block');
    assert.doesNotMatch(html, /沒有進行中的 session/);
    assert.doesNotMatch(html, /class="reg"/, 'no registry card');

    const gate = lvBlock(html, 'live-gate');
    assert.match(gate, /href="#\/s\/lv-gate"/);
    assert.match(gate, /選一個方向/);
    assert.match(gate, /等了 4m · 還剩 26m/);

    const run = lvBlock(html, 'live-run');
    assert.match(run, /href="#\/s\/lv-run"/);
    assert.match(run, /href="#\/s\/lv-gate"/);
    assert.doesNotMatch(run, /lv-unsure|lv-stale|lv-down/);
    assert.match(run, /<li class="done" style="--c:var\(--st-survey\)" title="survey 12m">/);
    assert.match(run, /<li class="now live" style="--c:var\(--st-plan\)" aria-current="step"><i><\/i><span>plan<\/span><em>3m<\/em><\/li>/);
    assert.match(run, /<li class="todo"><i><\/i><span>build<\/span><\/li>/);

    const maybe = lvBlock(html, 'live-maybe');
    assert.match(maybe, /href="#\/s\/lv-unsure"/);
    assert.match(maybe, /href="#\/s\/lv-stale"/);
    assert.match(maybe, />live\?</);
    assert.doesNotMatch(maybe, /lv-run|lv-down/);
    assert.match(maybe, /task\.js clear/, 'offline, the registry with a stale row prints the clear command');

    const idle = lvBlock(html, 'live-idle');
    assert.match(idle, /<a href="#\/p\/F%3A%5Cws%5Cquiet" title="F:\\ws\\quiet">quiet<\/a>/);
    assert.doesNotMatch(idle, /alpha|beta|gone/);
});

test('#/live with nothing waiting says so in one line, and every block is written literally in the source', () => {
    global.window.STATION.serve = true;
    global.window.STATION.nonce = 'tok-lv';
    const html = V.nowHtml(LV_PROJECTS, LV_SESSIONS.filter((s) => s.id !== 'lv-gate'));
    assert.match(html, /<section class="lv-gate is-empty" data-block="live-gate"/);
    assert.match(lvBlock(html, 'live-gate'), /沒有在等你的 gate/);
    assert.match(lvBlock(html, 'live-maybe'),
        /<form method="post" action="\/clear-stale">[\s\S]*name="root" value="F:\\ws\\beta"[\s\S]*clear 1 stale/);
    const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
    for (const n of ['live-gate', 'live-run', 'live-maybe', 'live-idle']) {
        assert.ok(src.includes('data-block="' + n + '"'), n + ' is not written literally in assets/station/station.js');
    }
    global.window.STATION.serve = false;
});

test('every non-zero segment is its own hover target, behind nothing', () => {
    const bars = V.dayBars(HOME, 'usd', 'model', DAYS);
    const svg = V.histSvg(bars, O);
    const parts = bars.days.reduce((n, b) => n + bars.keys.filter((k) => b.parts[k]).length, 0);
    assert.ok(parts > 1);
    assert.equal(count(svg, /<rect class="hseg" data-day="/g), parts);
    assert.match(svg, /<line class="hguide"/);
    // The column's hit rect comes before its bar group, so a segment is on top of it.
    assert.ok(svg.indexOf('<rect class="hit" data-href="#/d/2026-09-14"') < svg.indexOf('<rect class="hseg" data-day="2026-09-14"'));
    assert.match(V.legendHtml(bars, O), /<span data-key="/);
});

test('segTip lists the day\'s segments, marks the hovered one, and its parts add up to the total', () => {
    const bars = V.dayBars(HOME, 'usd', 'model', DAYS);
    const b = bars.days.find((d) => bars.keys.filter((k) => d.parts[k]).length >= 2);
    assert.ok(b, 'the fixture has a day with two segments');
    const keys = bars.keys.filter((k) => b.parts[k]);
    const tip = V.segTip(bars, O, b.day, keys[0]);
    assert.match(tip, new RegExp(b.day));
    assert.equal(count(tip, /<li/g), keys.length);
    assert.equal(count(tip, /<li data-hot/g), 1);
    assert.match(tip, /class="tt-main"/);
    assert.ok(Math.abs(keys.reduce((s, k) => s + b.parts[k], 0) - b.total) < 1e-9);
    assert.match(tip, /當天合計/);
    assert.doesNotMatch(V.segTip(bars, O, b.day, null), /class="tt-main"/, 'the column alone: no segment headline');
    assert.equal(V.segTip(bars, O, '1999-01-01', null), '');
});

test('usd appends the share of the weekly quota when profile quota.week is set, and only then', () => {
    const S = global.window.STATION;
    S.gates = undefined;
    const html = () => V.kpiHtml(V.windowTotals(HOME, DAYS), V.windowTotals(HOME, PREV));
    try {
        S.profiles = { machine: { values: { 'quota.week': 2000 } } };
        assert.equal(V.usd(20), '$20.00 (1%)');
        assert.equal(V.usd(5.4), '$5.40 (0.27%)');
        assert.equal(V.usd(0), '—');
        const m = html().match(/30 天花費<\/div><div class="v">\$(\d+\.\d+) \((\d+(?:\.\d+)?)%\)/);
        assert.ok(m, 'the spend readout carries its percent');
        assert.ok(Math.abs(Number(m[2]) * 2000 / 100 - Number(m[1])) < 2000 * 0.005 / 100, 'percent times quota is the amount on the same row');
        for (const none of [undefined, {}, { machine: {} }, { machine: { values: {} } }, { machine: { values: { 'quota.week': 0 } } }]) {
            S.profiles = none;
            assert.equal(V.usd(20), '$20.00');
            assert.doesNotMatch(html(), /%\)/);
        }
    } finally { S.profiles = undefined; }
});

test('quota share stays off text in a fixed box: ticks, bar totals, nav badge, cost-share bar; the session cost readout moves it to its sub-line', () => {
    const S = global.window.STATION;
    const bare = (h) => h.replace(/<title>[\s\S]*?<\/title>/g, '');
    try {
        S.profiles = { machine: { values: { 'quota.week': 2000 } } };
        const hist = bare(V.histSvg(V.dayBars(HOME, 'usd', 'model', DAYS), O));
        assert.match(hist, /class="tick"[^>]*>\$/, 'the usd ticks are still there');
        assert.doesNotMatch(hist, /class="tick"[^>]*>[^<]*%\)/, 'no tick or bar total carries a share');
        const t0 = V.dayStart(DAYS[0]), t1 = V.dayStart(DAYS[29]) + 864e5;
        const pts = V.sessionPoints(HOME, 'usd', t0, t1);
        const chart = V.projectChart([{ pkey: 'p', name: 'p', colour: 'var(--p-0)', points: pts }], { metric: 'usd', t0, t1, days: DAYS, today: DAYS[29] });
        assert.match(bare(chart), /class="tick"[^>]*>\$/);
        assert.doesNotMatch(bare(chart), /class="tick"[^>]*>[^<]*%\)/);
        assert.match(V.navHtml('days', { live: 0, usd: 12.5, sessions: 0, projects: 0, docs: 0 }), /<span class="nb">\$12\.50<\/span>/);
        const cs = V.costShareHtml(V.stageShare(STAGE_S, null), null);
        assert.doesNotMatch(cs.replace(/<tr[\s\S]*<\/tr>/g, '').replace(/<small>[\s\S]*?<\/small>/, ''), /%\) ·/, 'bar label and title read "$ · stage share%", not two percents');
        assert.match(V.sessionHeadHtml(HOME[0], DETAIL_X), /花費<\/div><div class="v">\$[\d.]+<\/div><div class="d">\([\d.]+%\) · /);
    } finally { S.profiles = undefined; }
});

test('quota share stays off the dispatch cost strip: track label and segment text are plain, only the hover title carries it', () => {
    const S = global.window.STATION;
    const stages = [{ stage: 'build', from: T0, to: T0 + 3000000, usd: 1500, burn: 1 }, { stage: 'verify', from: T0 + 3000000, to: T0 + 6000000, usd: 500, burn: 1 }];
    try {
        S.profiles = { machine: { values: { 'quota.week': 4000 } } };
        const html = V.replayHtml(DETAIL_X, {}, { stages, burn: 2 });
        const strip = html.match(/data-block="cost-strip">[\s\S]*?<p class="tally">/)[0];
        const bare = strip.replace(/ title="[^"]*"/g, '');
        assert.match(bare, /<span class="val">\$2000<\/span>/, 'the cost track label is the plain total');
        assert.match(bare, /\$1500/, 'a segment text is there');
        assert.doesNotMatch(bare, /%\)/, 'neither the label nor a segment text carries a share');
        assert.match(strip, /title="[^"]*\$1500 \([\d.]+%\)"/, 'the hover title still does');
    } finally { S.profiles = undefined; }
});

test('usd reads a project-level quota.week: wins over machine, first project wins, inherited or invalid falls back', () => {
    const S = global.window.STATION;
    const pj = (v, src) => ({ values: { 'quota.week': v }, sources: { 'quota.week': src } });
    try {
        S.profiles = { machine: {}, projects: { a: pj(2000, 'project') } };
        assert.equal(V.usd(20), '$20.00 (1%)');
        S.profiles = { machine: { values: { 'quota.week': 4000 } }, projects: { a: pj(2000, 'project') } };
        assert.equal(V.usd(20), '$20.00 (1%)', 'project beats machine');
        S.profiles = { machine: { values: { 'quota.week': 4000 } }, projects: { a: pj(2000, 'project'), b: pj(1000, 'project') } };
        assert.equal(V.usd(20), '$20.00 (1%)', 'first project with a value wins');
        S.profiles = { machine: { values: { 'quota.week': 4000 } }, projects: { a: pj(2000, 'machine') } };
        assert.equal(V.usd(20), '$20.00 (0.5%)', 'an inherited entry does not override machine');
        for (const bad of [pj(0, 'project'), { values: {}, sources: { 'quota.week': 'project' } }]) {
            S.profiles = { machine: { values: { 'quota.week': 4000 } }, projects: { a: bad } };
            assert.equal(V.usd(20), '$20.00 (0.5%)');
        }
    } finally { S.profiles = undefined; }
});

