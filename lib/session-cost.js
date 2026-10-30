'use strict';
// What one session spent, the parent and its agents together: the path
// scripts/record.js costLine always took (detail.transcriptOf →
// usage.summariseTree → prices.costOf), taken out so the weekly report's
// 製作成本 reads the same figure without a registry entry
// (docs/90-agent/plans/2026-10-30-weekly-facets-design.md §4). Null when no
// transcript for that id is under configDir.
const detail = require('./detail.js');
const usage = require('./usage.js');
const prices = require('./prices.js');

function sessionCost(configDir, sessionId) {
    const file = detail.transcriptOf(configDir, sessionId);
    const seen = file ? usage.summariseTree(file) : null;
    if (!seen) return null;
    const own = prices.costOf(seen.usage.models);
    const sub = seen.usage.subagents || null;
    const theirs = sub && sub.models ? prices.costOf(sub.models) : null;
    const merged = {};
    usage.addModels(merged, seen.usage.models);
    if (sub && sub.models) usage.addModels(merged, sub.models);
    const models = Object.keys(merged).map((id) => {
        const c = prices.costOf({ [id]: merged[id] });
        return Object.assign({ id, usd: c.priced.length ? c.usd : null }, merged[id]);
    });
    return {
        file,
        usd: (own.priced.length ? own.usd : 0) + (theirs && theirs.priced.length ? theirs.usd : 0),
        model: seen.model,
        agents: sub ? sub.agents || 0 : 0,
        agentModels: sub && sub.models ? Object.keys(sub.models) : [],
        requests: seen.usage.requests + (sub ? sub.requests || 0 : 0),
        models,
        unpriced: own.unpriced.concat(theirs ? theirs.unpriced : []),
        verified: prices.verified,
    };
}

module.exports = { sessionCost };
