'use strict';
// What a session's transcript says it spent, summed once at the end of the
// session rather than on every prompt — `lib/context.js` reads a tail sixty
// times an hour; this reads the whole file once, when nothing is waiting on it.
//
// Every `type: "assistant"` line carries `message.model` and `message.usage`.
// One request writes several such lines with the same usage on each: measured
// 2026-09-04, 76 assistant lines for 25 `requestId`s, one of them six times
// with `output_tokens: 1061` on every copy. Summing lines over-counts
// threefold, so the sum is over distinct `requestId`, last line winning. A line
// with no `requestId` at all is counted on its own — there is nothing to
// de-duplicate it against.
//
// Cache writes arrive split by TTL under `cache_creation` on current
// transcripts, and as one `cache_creation_input_tokens` figure on older ones;
// the undivided figure is counted as five-minute writes, the cheaper rate.
const fs = require('node:fs');
const path = require('node:path');

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

const blank = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });

function addUsage(models, model, usage) {
    const m = models[model] || (models[model] = blank());
    m.input += num(usage.input_tokens);
    m.output += num(usage.output_tokens);
    m.cacheRead += num(usage.cache_read_input_tokens);
    const split = usage.cache_creation;
    if (split && typeof split === 'object') {
        m.cacheWrite5m += num(split.ephemeral_5m_input_tokens);
        m.cacheWrite1h += num(split.ephemeral_1h_input_tokens);
    } else {
        m.cacheWrite5m += num(usage.cache_creation_input_tokens);
    }
}

// A stage is a half-open window. The windows come from `clock`, and the last
// one runs to Infinity so that nothing a session spent falls outside the record
// of what it spent.
function stageAt(stages, at) {
    if (!Array.isArray(stages) || !Number.isFinite(at)) return null;
    for (const w of stages) {
        if (at >= w.from && at < w.to) return w.stage;
    }
    return null;
}

function summarise(transcriptPath, opts) {
    const sidechain = Boolean(opts && opts.sidechain);
    let text;
    try {
        text = fs.readFileSync(transcriptPath, 'utf8');
    } catch (e) {
        return null;
    }
    const byRequest = new Map();
    let anonymous = 0;
    for (const raw of text.split('\n')) {
        if (!raw) continue;
        let entry;
        try {
            entry = JSON.parse(raw);
        } catch (e) {
            continue;
        }
        if (!entry || entry.type !== 'assistant') continue;
        if (!sidechain && entry.isSidechain === true) continue;
        const message = entry.message;
        if (!message || typeof message !== 'object') continue;
        if (typeof message.model !== 'string' || !message.usage || typeof message.usage !== 'object') continue;
        const key = typeof entry.requestId === 'string' && entry.requestId
            ? entry.requestId
            : 'anonymous-' + (anonymous++);
        const at = typeof entry.timestamp === 'string' ? Date.parse(entry.timestamp) : NaN;
        byRequest.set(key, { model: message.model, usage: message.usage, at });
    }
    if (!byRequest.size) return null;

    const models = {};
    for (const { model: id, usage } of byRequest.values()) {
        addUsage(models, id, usage);
    }
    let model = null;
    for (const id of Object.keys(models)) {
        if (model === null || models[id].output > models[model].output) model = id;
    }

    let stages;
    if (Array.isArray(opts && opts.stages) && opts.stages.length) {
        stages = {};
        for (const { model: id, usage, at } of byRequest.values()) {
            const name = stageAt(opts.stages, at);
            if (name === null) continue;
            const bucket = stages[name] || (stages[name] = { requests: 0, models: {} });
            bucket.requests += 1;
            addUsage(bucket.models, id, usage);
        }
    }
    return { model, usage: stages ? { requests: byRequest.size, models, stages } : { requests: byRequest.size, models } };
}

// The session's own agents. Claude Code keeps each Background Agent's and each
// Workflow agent's transcript beside the parent's, under a directory named for
// the session, and every line in those files is flagged `isSidechain` — the
// flag `summarise` skips for the parent, where an older Claude Code wrote
// subagent turns inline. So the same reader runs over them with the skip
// lifted, and what it finds is the part of a session's cost the parent
// transcript never sees: measured 2026-09-04, twenty-six agents on one
// session, one of them alone 6.3 million tokens of input and cache.
const AGENT_FILE = /^agent-[0-9a-f]+\.jsonl$/;

function sessionDirOf(transcriptPath) {
    return typeof transcriptPath === 'string' && transcriptPath.endsWith('.jsonl')
        ? transcriptPath.slice(0, -'.jsonl'.length)
        : null;
}

function agentFiles(sessionDir) {
    const out = [];
    const sub = path.join(sessionDir, 'subagents');
    let names;
    try {
        names = fs.readdirSync(sub);
    } catch (e) {
        return out;
    }
    for (const name of names) {
        if (AGENT_FILE.test(name)) out.push(path.join(sub, name));
    }
    let runs;
    try {
        runs = fs.readdirSync(path.join(sub, 'workflows'));
    } catch (e) {
        return out;
    }
    for (const run of runs) {
        let inner;
        try {
            inner = fs.readdirSync(path.join(sub, 'workflows', run));
        } catch (e) {
            continue;
        }
        for (const name of inner) {
            if (AGENT_FILE.test(name)) out.push(path.join(sub, 'workflows', run, name));
        }
    }
    return out;
}

// First and last timestamp in one transcript, in milliseconds; null with none.
// The agent's own wall-clock, which its `.meta.json` does not record.
function spanOf(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
    let first = null;
    let last = null;
    for (const raw of text.split('\n')) {
        if (!raw) continue;
        let entry;
        try {
            entry = JSON.parse(raw);
        } catch (e) {
            continue;
        }
        const t = entry && typeof entry.timestamp === 'string' ? Date.parse(entry.timestamp) : NaN;
        if (!Number.isFinite(t)) continue;
        if (first === null || t < first) first = t;
        if (last === null || t > last) last = t;
    }
    return first === null ? null : { first, last };
}

function agentsOf(transcriptPath) {
    const dir = sessionDirOf(transcriptPath);
    if (!dir) return null;
    const out = { agents: 0, requests: 0, models: {}, wallMs: 0 };
    for (const file of agentFiles(dir)) {
        const seen = summarise(file, { sidechain: true });
        if (!seen) continue;
        out.agents += 1;
        out.requests += seen.usage.requests;
        for (const [id, m] of Object.entries(seen.usage.models)) {
            const t = out.models[id] || (out.models[id] = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
            for (const k of Object.keys(t)) t[k] += m[k];
        }
        const span = spanOf(file);
        if (span) out.wallMs += span.last - span.first;
    }
    return out.agents ? out : null;
}

// The parent and its agents, as one record. `usage.requests` and
// `usage.models` stay the parent's own — that is what every reader of the
// field already expects — and the agents sit beside them under `subagents`,
// present only when there were any.
function summariseTree(transcriptPath, opts) {
    const own = summarise(transcriptPath, opts);
    const agents = agentsOf(transcriptPath);
    if (!own && !agents) return null;
    const usage = own ? own.usage : { requests: 0, models: {} };
    if (agents) usage.subagents = agents;
    return { model: own ? own.model : null, usage };
}

module.exports = { summarise, agentsOf, summariseTree };
