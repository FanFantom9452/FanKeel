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
// every model but Claude Fable 5.1, where they are 0.025×; five-minute cache
// writes are 1.25× input and one-hour writes 2×. `tests/prices.test.js` asserts
// those three ratios over every row, so a mistyped rate breaks a test rather
// than a total. The dated Haiku id is what a transcript carries; `rateFor` also
// answers the undated alias.
//
// The rows are the model ids this machine's transcripts actually carry, not the
// published table in full. `claude-fable-5` and `claude-opus-4-8` were added on
// 2026-09-21 after a pass over all 427 transcripts found them going unpriced on
// 8,649,431 and 33,335,478 tokens — `costOf` names an id it cannot price rather
// than charging it zero, and both surfaced as `unpriced` on the station and in
// `scripts/spend.js` the whole time. Mythos 5 and 5.1 are deliberately absent:
// limited availability, and no transcript here has ever held one.
//
// 1M context carries no premium. The published page's long-context section says
// Claude 4.6 and later include the full window at standard pricing, so a
// transcript's `claude-opus-5` is the same rate whether the request was 9k or
// 900k — which is why no `[1m]` variant appears here.
const verified = '2026-09-21';

const perMillion = {
    'claude-fable-5-1':          { input: 10, output: 50, cacheRead: 0.25, cacheWrite5m: 12.5, cacheWrite1h: 20 },
    'claude-fable-5':            { input: 10, output: 50, cacheRead: 1,    cacheWrite5m: 12.5, cacheWrite1h: 20 },
    'claude-opus-5':             { input: 5,  output: 25, cacheRead: 0.5,  cacheWrite5m: 6.25, cacheWrite1h: 10 },
    'claude-opus-4-8':           { input: 5,  output: 25, cacheRead: 0.5,  cacheWrite5m: 6.25, cacheWrite1h: 10 },
    'claude-sonnet-5':           { input: 2,  output: 10, cacheRead: 0.2,  cacheWrite5m: 2.5,  cacheWrite1h: 4 },
    'claude-haiku-4-5-20251001': { input: 1,  output: 5,  cacheRead: 0.1,  cacheWrite5m: 1.25, cacheWrite1h: 2 },
};

const undated = (id) => id.replace(/-\d{8}$/, '');

function rateFor(modelId) {
    if (typeof modelId !== 'string' || !modelId) return null;
    if (perMillion[modelId]) return perMillion[modelId];
    const want = undated(modelId);
    for (const id of Object.keys(perMillion)) {
        if (undated(id) === want) return perMillion[id];
    }
    return null;
}

function costOf(models) {
    const out = { usd: 0, priced: [], unpriced: [] };
    for (const [id, m] of Object.entries(models || {})) {
        const r = rateFor(id);
        if (!r) {
            out.unpriced.push(id);
            continue;
        }
        out.priced.push(id);
        out.usd += (m.input * r.input + m.output * r.output + m.cacheRead * r.cacheRead
            + m.cacheWrite5m * r.cacheWrite5m + m.cacheWrite1h * r.cacheWrite1h) / 1e6;
    }
    return out;
}

module.exports = { verified, perMillion, rateFor, costOf };
