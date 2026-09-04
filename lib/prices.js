'use strict';
// USD per million tokens, and the day the figures were read. This is the one
// thing in the station that goes stale on a schedule nobody here controls, so
// the page prints `verified` next to every dollar figure rather than letting a
// number look current because it looks precise.
//
// Read on 2026-09-04 from platform.claude.com/docs/en/build-with-claude/prompt-caching
// (the pricing page itself returned 404 that day). Cache reads are 0.1× input
// on every model but Claude Fable 5.1, where they are 0.025×; five-minute cache
// writes are 1.25× input and one-hour writes 2×. The dated Haiku id is what a
// transcript carries; `rateFor` also answers the undated alias.
const verified = '2026-09-04';

const perMillion = {
    'claude-fable-5-1':          { input: 10, output: 50, cacheRead: 0.25, cacheWrite5m: 12.5, cacheWrite1h: 20 },
    'claude-opus-5':             { input: 5,  output: 25, cacheRead: 0.5,  cacheWrite5m: 6.25, cacheWrite1h: 10 },
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
