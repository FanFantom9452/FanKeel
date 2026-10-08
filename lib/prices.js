'use strict';
// USD per million tokens, and the day the figures were read. This is the one
// thing in the station that goes stale on a schedule nobody here controls, so
// the page prints `verified` next to every dollar figure rather than letting a
// number look current because it looks precise.
//
// First read on 2026-09-04 from
// platform.claude.com/docs/en/build-with-claude/prompt-caching, because the
// pricing page itself returned 404 that day. Re-read on 2026-09-21 from
// platform.claude.com/docs/en/about-claude/pricing, which answered — and that
// read is where the two rows below it come from. Cache reads are 0.1× input on
// every model but Claude Fable 5.1, where they are 0.025×, and Claude Opus 5.5,
// where they are 0.05× (read 2026-09-24, the page's footnote 2); five-minute
// cache writes are 1.25× input and one-hour writes 2×. `tests/prices.test.js`
// asserts those three ratios over every row, so a mistyped rate breaks a test
// rather than a total. The dated Haiku id is what a transcript carries;
// `rateFor` also answers the undated alias.
//
// The rows are the model ids this machine's transcripts actually carry, not the
// published table in full. `claude-fable-5` and `claude-opus-4-8` were added on
// 2026-09-21, after a pass over every transcript found both going unpriced —
// `costOf` names an id it cannot price rather than charging it zero, so they had
// been showing as `unpriced` on the station and in `scripts/spend.js` the whole
// time rather than quietly costing nothing. What each carried is block 4 of
// `docs/reports/evidence/2026-09-21-quota-calibration/windows-at-<sha>.txt`,
// which prints the per-model token split of every segment; the read of the
// published table is quoted in `pricing-read-260921.txt` beside it.
//
// `claude-opus-5-5` was added on 2026-09-24; every transcript that day carries
// it. `claude-sonnet-5-5` was added on 2026-09-29 from the published table the
// user pasted. An id the table lacks is priced at the newest row of its family
// and flagged `estimated`; only a family with no row at all stays `unpriced`.
//
// `claude-haiku-5-5` and `claude-haiku-5-5>100k` were added on 2026-10-08 from
// the approved design docs/90-agent/plans/2026-10-08-haiku-bench-design.md,
// section 1; this change did not re-read the pricing page. Haiku 5.5 is priced
// per request: one whose prompt is over 100K tokens pays the `>100k` row.
// That id is not a model; `lib/usage.js` (`billedAs`) files such a request
// under it, because `costOf` prices model totals and cannot see a request.
const verified = '2026-10-08';

const perMillion = {
    'claude-opus-5-5':           { input: 4,  output: 20, cacheRead: 0.2,  cacheWrite5m: 5,    cacheWrite1h: 8 },
    'claude-fable-5-1':          { input: 10, output: 50, cacheRead: 0.25, cacheWrite5m: 12.5, cacheWrite1h: 20 },
    'claude-fable-5':            { input: 10, output: 50, cacheRead: 1,    cacheWrite5m: 12.5, cacheWrite1h: 20 },
    'claude-opus-5':             { input: 5,  output: 25, cacheRead: 0.5,  cacheWrite5m: 6.25, cacheWrite1h: 10 },
    'claude-opus-4-8':           { input: 5,  output: 25, cacheRead: 0.5,  cacheWrite5m: 6.25, cacheWrite1h: 10 },
    'claude-sonnet-5-5':         { input: 2,  output: 10, cacheRead: 0.2,  cacheWrite5m: 2.5,  cacheWrite1h: 4 },
    'claude-sonnet-5':           { input: 2,  output: 10, cacheRead: 0.2,  cacheWrite5m: 2.5,  cacheWrite1h: 4 },
    'claude-haiku-5-5':          { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite5m: 0.125, cacheWrite1h: 0.2 },
    'claude-haiku-5-5>100k':     { input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite5m: 0.625, cacheWrite1h: 1 },
    'claude-haiku-4-5-20251001': { input: 1,  output: 5,  cacheRead: 0.1,  cacheWrite5m: 1.25, cacheWrite1h: 2 },
};

const undated = (id) => id.replace(/-\d{8}$/, '');
const familyOf = (id) => (/^(claude-[a-z]+)-\d/.exec(id) || [])[1];

function rateFor(modelId) {
    if (typeof modelId !== 'string' || !modelId) return null;
    if (perMillion[modelId]) return perMillion[modelId];
    const want = undated(modelId);
    for (const id of Object.keys(perMillion)) {
        if (undated(id) === want) return perMillion[id];
    }
    // Rows are newest-first within a family, so the first match is the newest.
    const family = familyOf(modelId);
    const near = family && Object.keys(perMillion).find((id) => familyOf(id) === family);
    return near ? { ...perMillion[near], estimated: true } : null;
}

function costOf(models) {
    const out = { usd: 0, priced: [], unpriced: [], estimated: [] };
    for (const [id, m] of Object.entries(models || {})) {
        const r = rateFor(id);
        if (!r) {
            out.unpriced.push(id);
            continue;
        }
        out.priced.push(id);
        if (r.estimated) out.estimated.push(id);
        out.usd += (m.input * r.input + m.output * r.output + m.cacheRead * r.cacheRead
            + m.cacheWrite5m * r.cacheWrite5m + m.cacheWrite1h * r.cacheWrite1h) / 1e6;
    }
    return out;
}

module.exports = { verified, perMillion, rateFor, costOf };
