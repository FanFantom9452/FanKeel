'use strict';
// One date range of this machine's Claude Code spend, taken apart for the
// station's 花費 page: by token kind with the main session and the agents
// apart and the two cache-write rates apart (station-30), by agent type
// (station-31), and the costliest sessions (station-33). Which sessions count
// is lib/compare.js's rule — a session belongs to the range its transcript's
// first line falls in, its agents with it — so `usd` here is the total
// `scripts/usage-compare.js` prints for the same range (station-32), and
// `prev` is the same number of days before it. Every dollar is lib/prices.js's,
// through lib/detail.js's `rowCost`. The registry is not read: most sessions
// on a machine are in none.
const path = require('node:path');
const usage = require('./usage.js');
const compare = require('./compare.js');
const detail = require('./detail.js');
const conversation = require('./conversation.js');
const prices = require('./prices.js');

const KINDS = ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'];
const blank = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
const addInto = (into, from) => {
    for (const k of KINDS) into[k] += (from && from[k]) || 0;
    return into;
};
const sum = (c) => KINDS.reduce((n, k) => n + c[k], 0);

// The range of the same number of whole days that ends where `range` starts:
// the week before a week, the thirty days before thirty.
function previous(range) {
    const start = new Date(range.from);
    const days = Math.round((range.to - range.from) / 864e5);
    const from = new Date(start.getFullYear(), start.getMonth(), start.getDate() - days).getTime();
    return { label: detail.dayOf(from) + '..' + detail.dayOf(range.from - 1), from, to: range.from };
}

// One session's own and its agents' spend, kept apart. Null exactly when
// compare's `sessionOf` is: no timestamp at all, or neither a request of its
// own nor an agent with one.
function sessionRow(file) {
    const span = usage.spanOf(file);
    if (!span) return null;
    const own = usage.summarise(file, { series: true });
    const dir = usage.sessionDirOf(file);
    const agents = [];
    for (const f of dir ? usage.agentFiles(dir) : []) {
        const seen = usage.summarise(f, { sidechain: true });
        if (!seen) continue;
        agents.push({ type: usage.agentTypeOf(f), cost: detail.rowCost(seen.usage.models) || blank(), tokens: usage.splitOf(seen.usage.models) });
    }
    if (!own && !agents.length) return null;
    const series = own && own.series ? own.series : [];
    const mainTokens = own ? usage.splitOf(own.usage.models) : blank();
    const turns = own ? own.usage.requests : 0;
    return {
        id: path.basename(file, '.jsonl'), file, project: path.basename(path.dirname(file)), start: span.first,
        main: (own && detail.rowCost(own.usage.models)) || blank(), mainTokens, agents, turns,
        // The judgement's measures: average context is the main session's
        // cache reads over its requests, the peak its largest single request.
        avgCtx: turns ? mainTokens.cacheRead / turns : 0,
        peak: series.reduce((m, r) => (r.context > m ? r.context : m), 0),
    };
}

// A session's first typed message, its first line, for the top list.
function firstLine(file) {
    const t = conversation.turnsOf(usage.entriesOf(file) || []).turns.find((x) => x.kind === 'user');
    return t ? t.text.split('\n')[0].slice(0, 80) : '';
}

// The report for `range` (`compare.parseRange`'s shape). `opts.memo` is a Map
// a server keeps across requests: a transcript's row is reused while
// `detail.keyOf` — the size and mtime of it and its agent files — has not
// changed. `opts.top` is how many sessions the top list keeps, 10 unless said.
function report(configDir, range, opts) {
    const o = opts || {};
    const memo = o.memo instanceof Map ? o.memo : null;
    const top = Number.isInteger(o.top) && o.top > 0 ? o.top : 10;
    const prev = previous(range);
    const rows = [];
    for (const file of compare.transcripts(configDir, prev.from)) {
        const key = memo ? detail.keyOf(file) : null;
        const held = memo ? memo.get(file) : null;
        let row;
        if (held && held.key === key) {
            row = held.row;
        } else {
            row = sessionRow(file);
            if (memo) memo.set(file, { key, row });
        }
        if (row) rows.push(row);
    }
    const inside = (r, w) => r.start >= w.from && r.start < w.to;
    const usdOf = (r) => sum(r.main) + r.agents.reduce((n, a) => n + sum(a.cost), 0);
    const mine = rows.filter((r) => inside(r, range));
    const before = rows.filter((r) => inside(r, prev));
    const kinds = { main: blank(), agent: blank() };
    const tokens = { main: blank(), agent: blank() };
    const byType = new Map();
    for (const r of mine) {
        addInto(kinds.main, r.main);
        addInto(tokens.main, r.mainTokens);
        for (const a of r.agents) {
            addInto(kinds.agent, a.cost);
            addInto(tokens.agent, a.tokens);
            const t = byType.get(a.type) || { type: a.type, count: 0, cost: blank() };
            t.count += 1;
            addInto(t.cost, a.cost);
            byType.set(a.type, t);
        }
    }
    const usd = sum(kinds.main) + sum(kinds.agent);
    const share = (v) => (usd ? v / usd : 0);
    const main = { type: 'main', count: mine.filter((r) => r.turns > 0).length, cost: kinds.main };
    const types = [main, ...byType.values()].filter((t) => t.count > 0)
        .map((t) => Object.assign(t, { usd: sum(t.cost), share: share(sum(t.cost)) }))
        .sort((a, b) => b.usd - a.usd || (a.type < b.type ? -1 : 1));
    const ranked = mine.map((r) => ({ r, usd: usdOf(r) }))
        .sort((a, b) => b.usd - a.usd || (a.r.id < b.r.id ? -1 : 1)).slice(0, top);
    return {
        range: { label: range.label, from: range.from, to: range.to },
        prev: { label: prev.label, from: prev.from, to: prev.to, sessions: before.length, usd: before.reduce((n, r) => n + usdOf(r), 0) },
        sessions: mine.length, usd, kinds, tokens, types,
        top: ranked.map(({ r, usd: u }) => ({
            id: r.id, project: r.project, first: firstLine(r.file), usd: u, share: share(u),
            mainUsd: sum(r.main), agentUsd: u - sum(r.main), agents: r.agents.length,
            turns: r.turns, avgCtx: r.avgCtx, peak: r.peak,
        })),
        verified: prices.verified,
    };
}

module.exports = { previous, report };
