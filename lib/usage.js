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

// Fold one already-summed model map into another, in place. `addUsage` folds a
// raw transcript `usage` object in; this folds a map `addUsage` already built,
// which is what a second transcript hands over.
function addModels(into, from) {
    for (const [id, m] of Object.entries(from)) {
        const t = into[id] || (into[id] = blank());
        for (const k of Object.keys(t)) t[k] += m[k];
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

// The context one request carried: everything it sent, read from the cache or
// written into it. Its own output is not context until the next request reads
// it back, so it is counted there and not here.
function contextOf(usage) {
    const split = usage.cache_creation;
    const writes = split && typeof split === 'object'
        ? num(split.ephemeral_5m_input_tokens) + num(split.ephemeral_1h_input_tokens)
        : num(usage.cache_creation_input_tokens);
    return num(usage.input_tokens) + num(usage.cache_read_input_tokens) + writes;
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
    const out = { model, usage: stages ? { requests: byRequest.size, models, stages } : { requests: byRequest.size, models } };
    // The station's context curve, one row per request in the order the
    // requests were first written — `byRequest` already holds them, so the
    // curve and the request count cannot disagree. Only when asked: every
    // other caller wants exactly the shape above.
    if (opts && opts.series) {
        out.series = [];
        for (const [id, r] of byRequest) {
            out.series.push({ id, at: r.at, model: r.model, context: contextOf(r.usage), output: num(r.usage.output_tokens) });
        }
    }
    return out;
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

// `opts.stages` is forwarded to each agent's own `summarise` and the buckets
// summed across agents into `out.stages`, in the same shape the parent's
// `usage.stages` has. Without it the return is exactly what it was before.
//
// The forwarding is the whole point: an agent's requests are timestamped in the
// same wall-clock the parent's windows are cut from, so the same windows bucket
// them, and a per-stage figure that leaves them out is a fraction of the truth.
// Measured on this repository 2026-09-06: a session whose parent cost $0.83 ran
// four agents costing $1.39 between them, and one whose parent cost $57.43 ran
// twenty-one costing $91.56.
function agentsOf(transcriptPath, opts) {
    const dir = sessionDirOf(transcriptPath);
    if (!dir) return null;
    const stages = Array.isArray(opts && opts.stages) && opts.stages.length ? opts.stages : null;
    const out = { agents: 0, requests: 0, models: {}, wallMs: 0 };
    const perStage = {};
    for (const file of agentFiles(dir)) {
        const seen = summarise(file, stages ? { sidechain: true, stages } : { sidechain: true });
        if (!seen) continue;
        out.agents += 1;
        out.requests += seen.usage.requests;
        addModels(out.models, seen.usage.models);
        for (const [name, bucket] of Object.entries(seen.usage.stages || {})) {
            const t = perStage[name] || (perStage[name] = { requests: 0, models: {} });
            t.requests += bucket.requests;
            addModels(t.models, bucket.models);
        }
        const span = spanOf(file);
        if (span) out.wallMs += span.last - span.first;
    }
    if (!out.agents) return null;
    if (Object.keys(perStage).length) out.stages = perStage;
    return out;
}

// The parent and its agents, as one record. `usage.requests` and
// `usage.models` stay the parent's own — that is what every reader of the
// field already expects — and the agents sit beside them under `subagents`,
// present only when there were any.
//
// `opts` goes to both halves. It used to go to the parent alone, which made
// `usage.stages` — and so the station's per-stage curve — the parent's requests
// only, while the row above that curve printed the agents' cost beside it.
//
// Nothing is counted twice: `agentsOf` reads only files under the session's own
// `subagents/` directory, never the transcript itself, and `summarise` skips
// `isSidechain` lines unless asked for them, which only `agentsOf` asks.
function summariseTree(transcriptPath, opts) {
    const own = summarise(transcriptPath, opts);
    const agents = agentsOf(transcriptPath, opts);
    if (!own && !agents) return null;
    const usage = own ? own.usage : { requests: 0, models: {} };
    if (agents) usage.subagents = agents;
    return { model: own ? own.model : null, usage };
}

// Every line of a transcript that parses, in order; null when the file cannot
// be read. The station's readers walk the lines `summarise` walks, and one
// parser is how they agree on what a line is.
function entriesOf(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
    const out = [];
    for (const raw of text.split('\n')) {
        if (!raw) continue;
        try {
            const e = JSON.parse(raw);
            if (e && typeof e === 'object') out.push(e);
        } catch (e) { /* a torn last line */ }
    }
    return out;
}

// Which request each line belongs to, numbered from 1 in the order `summarise`
// first meets the requests — so turn n and `series[n - 1]` are one request. A
// line with no `requestId` is its own request, as it is there. Returns a
// function of the line's index in `entries`; null for a line in no request.
function turnIndex(entries) {
    const byRequest = new Map();
    const byLine = new Map();
    let n = 0;
    entries.forEach((e, i) => {
        if (!e || e.type !== 'assistant' || e.isSidechain === true) return;
        const m = e.message;
        if (!m || typeof m !== 'object' || typeof m.model !== 'string' || !m.usage || typeof m.usage !== 'object') return;
        const rid = typeof e.requestId === 'string' && e.requestId ? e.requestId : null;
        if (!rid) byLine.set(i, ++n);
        else if (!byRequest.has(rid)) byRequest.set(rid, ++n);
    });
    return (i) => {
        const e = entries[i];
        if (!e) return null;
        const rid = typeof e.requestId === 'string' && e.requestId ? e.requestId : null;
        if (rid) return byRequest.has(rid) ? byRequest.get(rid) : null;
        return byLine.has(i) ? byLine.get(i) : null;
    };
}

// A tool result's text, whether it arrived as a string or as blocks.
function textOf(content) {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content.map((b) => (b && typeof b.text === 'string' ? b.text : '')).join('');
}

// A background agent's or a workflow's return is not a tool result: it comes
// back later as a user line flagged `origin.kind: "task-notification"`, naming
// the tool_use that launched it. Older transcripts carry no `origin`, so the
// opening tag is read too.
const TOOL_USE_ID = /<tool-use-id>([^<]+)<\/tool-use-id>/;
function notificationOf(entry) {
    if (!entry || entry.type !== 'user' || !entry.message) return null;
    const text = textOf(entry.message.content);
    const flagged = entry.origin && entry.origin.kind === 'task-notification';
    if (!flagged && !text.trimStart().startsWith('<task-notification>')) return null;
    const m = TOOL_USE_ID.exec(text);
    return m ? { toolUseId: m[1].trim(), chars: text.length, at: Date.parse(entry.timestamp) } : null;
}

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return null;
    }
}

// Every workflow run the session made — all of them, not only the newest:
// `05de9a54` has two — keyed by run id, each with its `workflow_agent` rows by
// agent id. Filtered on `type`, never by position: the same array holds the
// `workflow_phase` rows.
function runsOf(sessionDir) {
    const out = new Map();
    let names;
    try {
        names = fs.readdirSync(path.join(sessionDir, 'workflows'));
    } catch (e) {
        return out;
    }
    for (const name of names.sort()) {
        if (!name.endsWith('.json')) continue;
        const data = readJson(path.join(sessionDir, 'workflows', name));
        if (!data || typeof data !== 'object') continue;
        const run = typeof data.runId === 'string' && data.runId ? data.runId : name.slice(0, -'.json'.length);
        const agents = new Map();
        for (const r of Array.isArray(data.workflowProgress) ? data.workflowProgress : []) {
            if (r && r.type === 'workflow_agent' && typeof r.agentId === 'string') agents.set(r.agentId, r);
        }
        out.set(run, { name: typeof data.workflowName === 'string' ? data.workflowName : run, agents });
    }
    return out;
}

const FIELDS = ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'];
function splitOf(models) {
    const out = blank();
    for (const m of Object.values(models || {})) for (const k of FIELDS) out[k] += m[k] || 0;
    return out;
}
const tokensOf = (split) => FIELDS.reduce((n, k) => n + split[k], 0);

const DISPATCH_TOOLS = new Set(['Agent', 'Task']);

// Every dispatch the parent made and every agent it ran, as two lists.
//
// `dispatches` is one row per Agent or Workflow tool_use: the turn it went out
// on, when it came back and how many characters its return put into the
// parent's context. A background agent's tool result is only the launch
// acknowledgement, so that is `launch` and its task-notification is `ret`;
// a foreground agent's tool result is its return. Two or more Agent calls in
// one request are `agents`.
//
// `rows` is one row per agent file `agentFiles()` finds — the same files
// `agentsOf` sums, so the rows add up to its total — plus a zero row for any
// `workflow_agent` a run file names that left no transcript. Tokens come from
// the agent's own transcript, split by kind so the caller can price them;
// `workflow_agent.tokens` is one undivided number and cannot be priced.
function dispatchesOf(transcriptPath) {
    const entries = entriesOf(transcriptPath);
    const dir = sessionDirOf(transcriptPath);
    if (!entries || !dir) return null;
    const turnAt = turnIndex(entries);
    const uses = [];
    const results = new Map();
    const notes = new Map();
    entries.forEach((e, i) => {
        if (e.isSidechain === true || !e.message || typeof e.message !== 'object') return;
        const content = Array.isArray(e.message.content) ? e.message.content : [];
        if (e.type === 'assistant') {
            for (const b of content) {
                if (!b || b.type !== 'tool_use' || !(DISPATCH_TOOLS.has(b.name) || b.name === 'Workflow')) continue;
                uses.push({
                    key: b.id, name: b.name, input: b.input && typeof b.input === 'object' ? b.input : {},
                    request: typeof e.requestId === 'string' && e.requestId ? e.requestId : 'line-' + i,
                    turn: turnAt(i), at: Date.parse(e.timestamp),
                });
            }
            return;
        }
        if (e.type !== 'user') return;
        const note = notificationOf(e);
        if (note) {
            if (!notes.has(note.toolUseId)) notes.set(note.toolUseId, note);
            return;
        }
        for (const b of content) {
            if (!b || b.type !== 'tool_result' || typeof b.tool_use_id !== 'string') continue;
            results.set(b.tool_use_id, {
                chars: textOf(b.content).length, at: Date.parse(e.timestamp),
                meta: e.toolUseResult && typeof e.toolUseResult === 'object' ? e.toolUseResult : {},
            });
        }
    });
    const perRequest = new Map();
    for (const u of uses) if (DISPATCH_TOOLS.has(u.name)) perRequest.set(u.request, (perRequest.get(u.request) || 0) + 1);
    const dispatches = uses.map((u) => {
        const res = results.get(u.key) || null;
        const note = notes.get(u.key) || null;
        const meta = res ? res.meta : {};
        const later = meta.status === 'async_launched' || meta.isAsync === true;
        const flow = u.name === 'Workflow';
        return {
            key: u.key, turn: u.turn,
            surface: flow ? 'workflow' : perRequest.get(u.request) > 1 ? 'agents' : 'agent',
            text: flow ? String(meta.workflowName || 'workflow') : String(u.input.description || ''),
            agentType: !flow && typeof u.input.subagent_type === 'string' ? u.input.subagent_type : null,
            alias: !flow && typeof u.input.model === 'string' ? u.input.model : null,
            out: u.at,
            back: later ? (note ? note.at : null) : (res ? res.at : null),
            ret: later ? (note ? note.chars : null) : (res ? res.chars : null),
            launch: later && res ? res.chars : 0,
            run: flow && typeof meta.runId === 'string' ? meta.runId : null,
            agentId: !flow && typeof meta.agentId === 'string' ? meta.agentId : null,
            ids: [], phases: [],
        };
    });
    const runs = runsOf(dir);
    const rows = [];
    const seen = new Set();
    const place = (row, di) => {
        if (di >= 0) {
            row.disp = di;
            row.turn = dispatches[di].turn;
            dispatches[di].ids.push(row.id);
            if (row.phase && !dispatches[di].phases.includes(row.phase)) dispatches[di].phases.push(row.phase);
        }
        seen.add(row.id);
        rows.push(row);
    };
    for (const file of agentFiles(dir)) {
        const id = path.basename(file, '.jsonl').slice('agent-'.length);
        const parent = path.dirname(file);
        const inRun = path.basename(path.dirname(parent)) === 'workflows';
        const run = inRun ? path.basename(parent) : null;
        const own = summarise(file, { sidechain: true });
        const models = own ? own.usage.models : {};
        const split = splitOf(models);
        const span = spanOf(file);
        const row = {
            id, file, surface: inRun ? 'workflow' : 'agent', disp: null, turn: null,
            label: '', agentType: null, alias: null, phase: null, run,
            requests: own ? own.usage.requests : 0, model: own ? own.model : null, models, split,
            tokens: tokensOf(split), first: span ? span.first : null, last: span ? span.last : null,
            durMs: span ? span.last - span.first : 0,
        };
        let di;
        if (inRun) {
            const p = runs.has(run) ? runs.get(run).agents.get(id) : null;
            if (p) {
                row.label = String(p.label || '');
                row.agentType = typeof p.agentType === 'string' ? p.agentType : null;
                row.alias = typeof p.model === 'string' ? p.model : null;
                row.phase = typeof p.phaseTitle === 'string' ? p.phaseTitle : null;
            }
            di = dispatches.findIndex((d) => d.run === run);
        } else {
            const meta = readJson(path.join(parent, 'agent-' + id + '.meta.json')) || {};
            di = dispatches.findIndex((d) => d.agentId === id);
            if (di < 0 && typeof meta.toolUseId === 'string') di = dispatches.findIndex((d) => d.key === meta.toolUseId);
            const d = di >= 0 ? dispatches[di] : null;
            row.surface = d ? d.surface : 'agent';
            row.label = d && d.text ? d.text : String(meta.description || '');
            row.agentType = (d && d.agentType) || (typeof meta.agentType === 'string' ? meta.agentType : null);
            row.alias = (d && d.alias) || (typeof meta.model === 'string' ? meta.model : null);
        }
        place(row, di);
    }
    for (const [run, r] of runs) {
        for (const [id, p] of r.agents) {
            if (seen.has(id)) continue;
            place({
                id, file: null, surface: 'workflow', disp: null, turn: null,
                label: String(p.label || ''), agentType: typeof p.agentType === 'string' ? p.agentType : null,
                alias: typeof p.model === 'string' ? p.model : null,
                phase: typeof p.phaseTitle === 'string' ? p.phaseTitle : null, run,
                requests: 0, model: null, models: {}, split: blank(), tokens: 0, first: null, last: null, durMs: 0,
            }, dispatches.findIndex((d) => d.run === run));
        }
    }
    return { dispatches, rows, runs: [...runs].map(([run, r]) => ({ run, name: r.name, agents: r.agents.size })) };
}

module.exports = {
    summarise, agentsOf, summariseTree, spanOf, agentFiles, sessionDirOf,
    entriesOf, turnIndex, textOf, notificationOf, dispatchesOf, splitOf, tokensOf,
};
