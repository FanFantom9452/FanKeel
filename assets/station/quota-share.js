// 額度分配 (FK_QSHARE): the 花費 page's quota tabs' arithmetic, with no markup so
// node can test it (docs/90-agent/plans/2026-10-30-spend-quota-design.md §3, §4).
// A step is `{ from, to, v, gap }` (lib/quota.js stepsOf); a segment is a task bar
// `{ start, end, bins }`, `bins` its session's `[[binStart, usd]]` (lib/detail.js binsOf).
// No text of its own and nothing touched at load.
(function (w) {
    'use strict';
    // How far a step line climbed over (a, b]: every step starting in it that stands
    // higher than the one before. A reset's fall to 0 takes nothing away and the climb
    // after it counts from 0, so a rise across a reset is its two parts added.
    function riseOf(steps, a, b) {
        var r = 0;
        for (var i = 1; i < steps.length; i++) {
            if (steps[i].from > a && steps[i].from <= b) r += Math.max(0, steps[i].v - steps[i - 1].v);
        }
        return r;
    }
    // What a session spent over [a, b): the bins that start inside it.
    function spendIn(bins, a, b) {
        var n = 0;
        (bins || []).forEach(function (x) { if (x[0] >= a && x[0] < b) n += x[1]; });
        return n;
    }
    // What `seg` earns of the rise over [a, b] (design §4): the span cut wherever a
    // segment of `segs` starts or ends, so the set of tasks running is the same across
    // each piece; each piece's rise split by what each of them spent in it, evenly when
    // none spent anything. `{ rise, share }`, both in points.
    function shareOf(steps, segs, seg, a, b) {
        var cuts = [a, b];
        segs.forEach(function (s) {
            [s.start, s.end].forEach(function (t) { if (t > a && t < b) cuts.push(t); });
        });
        cuts.sort(function (x, y) { return x - y; });
        var share = 0;
        for (var i = 1; i < cuts.length; i++) {
            var p = cuts[i - 1], q = cuts[i];
            if (q <= p) continue;
            var up = riseOf(steps, p, q);
            if (!up) continue;
            var on = segs.filter(function (s) { return s.start < q && s.end > p; });
            var me = on.indexOf(seg);
            if (me < 0) continue;
            var spent = on.map(function (s) { return spendIn(s.bins, p, q); });
            var total = spent.reduce(function (x, y) { return x + y; }, 0);
            share += total > 0 ? up * spent[me] / total : up / on.length;
        }
        return { rise: riseOf(steps, a, b), share: share };
    }
    // Lanes for overlapping bars: by start, each into the first lane free by then. The
    // lane of each segment in the order given, and how many lanes there are — the most
    // segments running at once.
    function lanesOf(segs) {
        var ends = [], lane = new Array(segs.length);
        segs.map(function (s, i) { return i; })
            .sort(function (x, y) { return segs[x].start - segs[y].start || x - y; })
            .forEach(function (i) {
                var l = -1;
                for (var k = 0; k < ends.length; k++) if (ends[k] <= segs[i].start) { l = k; break; }
                if (l < 0) { l = ends.length; ends.push(0); }
                lane[i] = l;
                ends[l] = segs[i].end;
            });
        return { lane: lane, count: ends.length };
    }
    // Dollars per point of the 7d window `span` (lib/quota.js span()): what the account's
    // sessions spent between its two readings over the points it climbed. null with no
    // span or nothing spent (design §3, 資料不足).
    function perPoint(span, binsList) {
        if (!span || !(span.points > 0)) return null;
        var usd = 0;
        (binsList || []).forEach(function (bins) { usd += spendIn(bins, span.from, span.to); });
        return usd > 0 ? usd / span.points : null;
    }
    // lib/quota.js MIN_POINTS: a reading is a whole percent, so under ten points the
    // error is more than a tenth of the answer. Copied rather than required, since this
    // file loads in the page too; tests/quota-share.test.js holds the two equal.
    var MIN_POINTS = 10;
    // The 5h counterpart of lib/quota.js span(): the newest of `windows` (windowsOf,
    // oldest first) whose line climbed MIN_POINTS or more from its first reading to its
    // last, as the `{ from, to, points }` perPoint reads; null when none did.
    function span5(windows) {
        var list = windows || [];
        for (var i = list.length - 1; i >= 0; i--) {
            var st = list[i].steps || [];
            if (st.length < 2) continue;
            var a = st[0], b = st[st.length - 1];
            if (b.v - a.v >= MIN_POINTS) return { from: a.from, to: b.from, points: b.v - a.v };
        }
        return null;
    }
    // One share in percent: from 1 up a whole number, under 1 one decimal; null with
    // nothing spent or no dollars-per-point.
    function pctOf(usd, pp) {
        if (!(usd > 0) || !(pp > 0)) return null;
        var p = usd / pp;
        return p >= 1 ? Math.round(p) : Math.round(p * 10) / 10;
    }
    // What `usd` is of one account's week and of its 5h window, from its dollars per 1%
    // of each (perPoint over span, and over span5). Always an estimate: API prices over
    // a dollars-per-point, not a reading of the quota line. null when neither is known.
    function quotaShare(usd, pp7, pp5) {
        var week = pctOf(usd, pp7), five = pctOf(usd, pp5);
        return week === null && five === null ? null : { weekPct: week, fiveHourPct: five, estimated: true };
    }
    var api = { riseOf: riseOf, spendIn: spendIn, shareOf: shareOf, lanesOf: lanesOf, perPoint: perPoint,
        span5: span5, quotaShare: quotaShare, MIN_POINTS: MIN_POINTS };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_QSHARE = api;
}(typeof window !== 'undefined' ? window : null));
