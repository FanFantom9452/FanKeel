'use strict';
// Cost composition: what a session's `spend` field (`lib/registry.js`'s
// `spendOf`/`burnOf` neighbourhood) turns into once `lib/prices.js`'s rates
// are applied — the same four dollar components the station's cost tab
// already shows, `cacheWrite5m` and `cacheWrite1h` folded together the way
// `assets/station/station.js:978`'s `costHtml` folds them, so the two must
// agree on one session's numbers.
//
// `lib/detail.js`'s `costSplit`/`rowCost` do this same per-kind pricing for
// one dispatch row already; this repeats it at the whole-session level,
// because nothing there sums every stage of one record into one row.
const registry = require('./registry.js');
const prices = require('./prices.js');

// The four displayed components, in the order `costHtml`'s own `KINDS` lists
// them — one name, looped over everywhere this module adds or divides all
// four alike, the way `lib/detail.js:384`'s `KINDS` is looped over there.
const KINDS = ['input', 'output', 'cacheRead', 'cacheWrite'];

function blankCost() {
    return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
}

// One model's tokens priced into the four displayed components; null when
// `lib/prices.js` has no rate for it. `prices.costOf` already tells `priced`
// from `unpriced` apart at the whole-usd level — this keeps that same
// distinction while splitting the usd by kind, which `costOf` does not.
function priceModel(modelId, tokens) {
    const r = prices.rateFor(modelId);
    if (!r) return null;
    const t = tokens || {};
    return {
        input: (t.input || 0) * r.input / 1e6,
        output: (t.output || 0) * r.output / 1e6,
        cacheRead: (t.cacheRead || 0) * r.cacheRead / 1e6,
        cacheWrite: ((t.cacheWrite5m || 0) * r.cacheWrite5m + (t.cacheWrite1h || 0) * r.cacheWrite1h) / 1e6,
    };
}

// Every model in one `models` map (a stage's own, or its `subagents.models`),
// priced and added into `into`; a model with no rate is named in `unpriced`
// instead of being folded in as zero.
function addModels(into, models, unpriced) {
    for (const [id, tokens] of Object.entries(models || {})) {
        const c = priceModel(id, tokens);
        if (!c) {
            unpriced.add(id);
            continue;
        }
        for (const k of KINDS) into[k] += c[k];
    }
}

const sumOf = (c) => c.input + c.output + c.cacheRead + c.cacheWrite;

// One session's row, or null when the record has no `spend` at all — that is
// the normal shape of a session still running, or one written before
// `hooks/leave.js` learned to bucket cost, and it is skipped rather than
// reported as zero spend.
function rowFor(root, sessionId, data) {
    const spend = data && typeof data.spend === 'object' && data.spend && !Array.isArray(data.spend) ? data.spend : null;
    if (!spend) return null;
    const own = blankCost();
    const sub = blankCost();
    const unpriced = new Set();
    let requests = 0;
    for (const stage of Object.keys(spend)) {
        // `registry.spendOf` is the one place that already knows a spend
        // entry's shape — present, an object, carrying `models` — so a stage
        // written any other way is skipped here exactly as it is there.
        const seen = registry.spendOf(data, stage);
        if (!seen) continue;
        if (Number.isFinite(seen.requests)) requests += seen.requests;
        addModels(own, seen.models, unpriced);
        const theirs = seen.subagents;
        if (theirs && typeof theirs === 'object') {
            if (Number.isFinite(theirs.requests)) requests += theirs.requests;
            addModels(sub, theirs.models, unpriced);
        }
    }
    const cost = {
        input: own.input + sub.input,
        output: own.output + sub.output,
        cacheRead: own.cacheRead + sub.cacheRead,
        cacheWrite: own.cacheWrite + sub.cacheWrite,
    };
    return {
        sessionId,
        root,
        version: data.version !== undefined ? data.version : null,
        requests,
        cost,
        usd: sumOf(cost),
        own: sumOf(own),
        subagents: sumOf(sub),
        unpriced: [...unpriced].sort(),
    };
}

// Every session under every registry root with a `spend` field, as rows —
// alongside the counts that say what the rows are a fraction of, so a reader
// of `scripts/spend.js`'s table never has to take "94 priced sessions" on
// faith. `scanned` is every session file looked at, including one that did
// not parse; `unreadable` is `registry.readAll`'s own count of those, already
// kept apart from a file that parsed but had nothing usable in it; `noSpend`
// is the parsed files `rowFor` returned null for — a session still running,
// or one written before `hooks/leave.js` learned to bucket cost — which is
// the normal shape of most of a registry, not an error.
function sessionsOf(roots) {
    const rows = [];
    let scanned = 0;
    let noSpend = 0;
    let unreadable = 0;
    for (const root of roots || []) {
        const { entries, unreadable: bad } = registry.readAll(root);
        unreadable += bad;
        scanned += entries.length + bad;
        for (const { sessionId, data } of entries) {
            const row = rowFor(root, sessionId, data);
            if (row) rows.push(row);
            else noSpend += 1;
        }
    }
    return { rows, scanned, noSpend, unreadable };
}

// Four ranges by total request count: a short task, a medium one, one long
// enough to likely have dispatched agents, and one long enough that its cost
// composition is worth a second look on its own.
const RANGES = [
    { label: '<50', min: 0, max: 49 },
    { label: '50-199', min: 50, max: 199 },
    { label: '200-799', min: 200, max: 799 },
    { label: '800+', min: 800, max: Infinity },
];

function rangeFor(requests) {
    for (const r of RANGES) {
        if (requests >= r.min && requests <= r.max) return r.label;
    }
    return RANGES[RANGES.length - 1].label;
}

function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// One bucket per range: how many sessions fell in it, the bucket's total
// dollar spend, the median session's spend, and each of the four components'
// share of that total — the composition a longer task's cost skews toward.
// A bucket with no priced spend at all keeps `share` at zero rather than
// dividing by it.
function buckets(rows) {
    const by = new Map(RANGES.map((r) => [r.label, []]));
    for (const row of rows || []) {
        by.get(rangeFor(row.requests)).push(row);
    }
    return RANGES.map((r) => {
        const list = by.get(r.label);
        const total = list.reduce((n, row) => n + row.usd, 0);
        const share = blankCost();
        for (const row of list) {
            for (const k of KINDS) share[k] += row.cost[k];
        }
        if (total > 0) {
            for (const k of KINDS) share[k] /= total;
        }
        return {
            range: r.label,
            count: list.length,
            total,
            median: median(list.map((row) => row.usd)),
            share,
        };
    });
}

module.exports = { sessionsOf, buckets };
