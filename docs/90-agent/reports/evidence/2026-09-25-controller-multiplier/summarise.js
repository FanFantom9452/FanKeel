// `docs/reports/evidence/2026-09-25-controller-multiplier/summarise.js`
'use strict';

// k, the way docs/reports/2026-09-21-long-task-projection.md §4 uses it: the
// non-survey stages cost `old × r × k`. `old × r` is the Opus arm's own token
// mix priced at Sonnet's rates, so k is what Sonnet actually spent over that.
// A model that is not Opus in the Opus arm (a subagent on another model) keeps
// the price the CLI charged for it.
const fs = require('node:fs');
const path = require('node:path');
const { costOf } = require('../../../../../lib/prices.js');

const dir = process.argv[2];
const SONNET = 'claude-sonnet-5';

function mix(u) {
    return {
        input: u.inputTokens || 0,
        output: u.outputTokens || 0,
        cacheRead: u.cacheReadInputTokens || 0,
        cacheWrite5m: u.cacheCreationInputTokens || 0,
        cacheWrite1h: 0,
    };
}

// `--resume` reports `total_cost_usd` and `modelUsage` cumulative since the
// session's own start, not per stage — so the run's real total is whichever
// stage file comes last in the pipeline, read once, never summed across files.
const ORDER = ['start', 'design', 'plan', 'build', 'verify'];
function arm(name) {
    const out = { usd: 0, tokens: 0, stages: {}, models: {} };
    let last = null;
    for (const f of fs.readdirSync(dir).filter((f) => f.startsWith(name + '-') && f.endsWith('.json')).sort()) {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const stage = f.slice(name.length + 1, -5);
        out.stages[stage] = j.total_cost_usd || 0;
        if (!last || ORDER.indexOf(stage) > ORDER.indexOf(last.stage)) last = { stage, j };
    }
    if (last) {
        out.usd = last.j.total_cost_usd || 0;
        for (const [id, u] of Object.entries(last.j.modelUsage || {})) {
            const m = out.models[id] || (out.models[id] = { usd: 0, input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
            const t = mix(u);
            for (const k of Object.keys(t)) m[k] += t[k];
            m.usd += u.costUSD || 0;
            out.tokens += t.input + t.output + t.cacheRead + t.cacheWrite5m;
        }
    }
    return out;
}

const opus = arm('opus');
const sonnet = arm('sonnet');
let oldAtSonnetRates = 0;
for (const [id, m] of Object.entries(opus.models)) {
    oldAtSonnetRates += /opus/.test(id) ? costOf({ [SONNET]: m }).usd : m.usd;
}
const summary = {
    base: '9e54e1b70a1dd0ad943b2534d8113bacbee0b7f4',
    arms: { opus, sonnet },
    oldAtSonnetRates,
    k: oldAtSonnetRates ? sonnet.usd / oldAtSonnetRates : null,
    kTokens: opus.tokens ? sonnet.tokens / opus.tokens : null,
};
process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
