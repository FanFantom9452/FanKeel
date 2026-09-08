'use strict';

// The browser half of the page cannot be driven from `node --test` — there is
// no DOM here and no dependency may be added to get one. What can be tested is
// every function that decides a number or a string before any element is
// touched, so that is what the view file exports. The rendering itself is
// checked against the served page, which is what the plan's success criterion
// is for.

const test = require('node:test');
const assert = require('node:assert/strict');

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
