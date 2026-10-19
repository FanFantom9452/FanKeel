'use strict';

// Two date ranges of Claude Code use, side by side, read from the transcripts
// under <configDir>/projects — the before and after of installing fankeel on a
// machine whose owner kept its transcripts. Per session, never totals: the two
// ranges did different work, and per-session figures are what can be set side
// by side. Every number is usage.summarise()'s (a session's own lines) or
// usage.agentsOf's (its agents'), so the requestId dedupe and the sidechain
// rule are the station's own; nothing here reads a registry, so the
// weeks before fankeel was installed read the same as the weeks after.

const fs = require('node:fs');
const path = require('node:path');
const usage = require('./usage.js');
const prices = require('./prices.js');

// 'YYYY-MM-DD..YYYY-MM-DD', whole days on this machine's clock, the last day
// included: `to` is the midnight after it.
function parseRange(text) {
    const m = /^(\d{4})-(\d{2})-(\d{2})\.\.(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || ''));
    if (!m) throw new Error('a range is YYYY-MM-DD..YYYY-MM-DD, got ' + text);
    const from = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    const to = new Date(+m[4], +m[5] - 1, +m[6] + 1).getTime();
    if (!(from < to)) throw new Error('a range ends on or after the day it starts: ' + text);
    return { label: text, from, to };
}

// Every main-session transcript under projects/. Agent files are reached
// through usage.agentsOf, never listed here, so none is counted twice. A file
// last written before `since` cannot hold a session that starts after it.
function transcripts(configDir, since) {
    const root = path.join(configDir, 'projects');
    let dirs;
    // A projects root that cannot be read is a wrong --config-dir, not an empty
    // history: say so rather than print a table of zeros.
    try {
        dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch (e) {
        throw new Error('cannot read ' + root + ': ' + e.message);
    }
    const out = [];
    for (const d of dirs) {
        let names;
        try {
            names = fs.readdirSync(path.join(root, d.name));
        } catch (e) {
            if (e.code !== 'ENOENT') throw e;
            continue;
        }
        for (const name of names) {
            if (!name.endsWith('.jsonl')) continue;
            const file = path.join(root, d.name, name);
            try {
                if (fs.statSync(file).mtimeMs < since) continue;
            } catch (e) {
                if (e.code !== 'ENOENT') throw e;
                continue;
            }
            out.push(file);
        }
    }
    return out.sort();
}

// One session: its own requests and its agents', in tokens and dollars. It
// starts at its transcript's first timestamp; null with none, or with neither
// an assistant line of its own nor an agent.
function sessionOf(file) {
    const span = usage.spanOf(file);
    if (!span) return null;
    const own = usage.summarise(file);
    const agents = usage.agentsOf(file);
    if (!own && !agents) return null;
    const models = {};
    usage.addModels(models, (own && own.usage.models) || {});
    usage.addModels(models, (agents && agents.models) || {});
    return {
        file,
        start: span.first,
        requests: (own ? own.usage.requests : 0) + (agents ? agents.requests : 0),
        tokens: usage.tokensOf(usage.splitOf(models)),
        usd: prices.costOf(models).usd,
        agentUsd: agents ? prices.costOf(agents.models).usd : 0,
        agents: agents ? agents.agents : 0,
        models,
    };
}

function median(xs) {
    if (!xs.length) return 0;
    const s = xs.slice().sort((a, b) => a - b);
    const h = s.length >> 1;
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

// One range's figures over the sessions that start inside it.
function summary(range, sessions) {
    const inside = sessions.filter((s) => s.start >= range.from && s.start < range.to);
    const usd = inside.reduce((n, s) => n + s.usd, 0);
    const tokens = inside.reduce((n, s) => n + s.tokens, 0);
    const agentUsd = inside.reduce((n, s) => n + s.agentUsd, 0);
    const models = {};
    for (const s of inside) {
        for (const [id, m] of Object.entries(s.models)) models[id] = (models[id] || 0) + prices.costOf({ [id]: m }).usd;
    }
    return {
        label: range.label,
        sessions: inside.length,
        usd,
        tokens,
        usdPerSession: inside.length ? usd / inside.length : 0,
        medianUsd: median(inside.map((s) => s.usd)),
        tokensPerSession: inside.length ? tokens / inside.length : 0,
        agentShare: usd ? agentUsd / usd : 0,
        models,
    };
}

function compare(configDir, a, b) {
    const sessions = transcripts(configDir, Math.min(a.from, b.from)).map(sessionOf).filter(Boolean);
    return [summary(a, sessions), summary(b, sessions)];
}

// The two summaries as aligned columns. A model's row is its share of that
// range's dollars; a model lib/prices.js cannot price shows 0%.
function format(rows) {
    const [a, b] = rows;
    const usd = (n) => '$' + n.toFixed(2);
    const pct = (n) => Math.round(n * 100) + '%';
    const share = (r, id) => pct(r.usd ? (r.models[id] || 0) / r.usd : 0);
    const table = [
        ['', a.label, b.label],
        ['sessions', String(a.sessions), String(b.sessions)],
        ['usd per session', usd(a.usdPerSession), usd(b.usdPerSession)],
        ['median usd per session', usd(a.medianUsd), usd(b.medianUsd)],
        ['tokens per session', String(Math.round(a.tokensPerSession)), String(Math.round(b.tokensPerSession))],
        ['subagent share of usd', pct(a.agentShare), pct(b.agentShare)],
        ['total usd', usd(a.usd), usd(b.usd)],
    ];
    const ids = [...new Set(Object.keys(a.models).concat(Object.keys(b.models)))].sort();
    for (const id of ids) table.push([id, share(a, id), share(b, id)]);
    const widths = [0, 1, 2].map((i) => Math.max(...table.map((r) => r[i].length)));
    return table.map((r) => r.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd()).join('\n');
}

module.exports = { parseRange, sessionOf, compare, format, transcripts };
