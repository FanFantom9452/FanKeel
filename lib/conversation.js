'use strict';
// One session's conversation as text: what the user typed and what Claude
// wrote back, in order, with every compaction marked where it happened and the
// summary Claude Code wrote at it. A transcript is append-only — a compaction
// adds a `compact_boundary` line and a summary, and the lines before it stay —
// so the whole conversation is still on disk after any number of compactions.
//
// Counted on the `left out:` line: tool results, system text (`isMeta`),
// background-task notifications, a subagent's hand-back, the output of a local
// slash command, Claude Code's own `<synthetic>` replies, and subagent lines
// (`isSidechain`); the CLI adds `unparsed`, lines that do not parse. Other blocks — thinking, tool calls — and lines of other
// types are dropped uncounted. A subagent's own transcript is not read unless { sidechain: true }.
// With { tools: true }, tool calls and tool results are turns of their own.
// With { acts: true } (and not tools), each run of tool calls between
// Claude's words is one `act` turn: its tools and its Agent dispatches with
// their state (lib/talkacts.js). With { sidechain: true }, `isSidechain`
// lines are read rather than skipped — a subagent's own transcript.
//
// A prompt the user types while Claude is busy is not a `user` line: it is an
// `attachment` line whose `attachment.type` is `queued_command`, and a
// subagent's hand-back arrives the same way, opening `<agent-message`.
const usage = require('./usage.js');
const prices = require('./prices.js');
const talkacts = require('./talkacts.js');

const COMMAND = /<command-name>([\s\S]*?)<\/command-name>/;
const ARGS = /<command-args>([\s\S]*?)<\/command-args>/;
const LOCAL = /^\s*<local-command-(stdout|stderr|caveat)>/;
const NOTE = /^\s*<task-notification>/;
const AGENT = /^\s*<agent-message\b/;
const INTERRUPT = /^\s*\[Request interrupted by user/;

function turnsOf(entries, opts) {
    const tools = Boolean(opts && opts.tools);
    const acts = Boolean(opts && opts.acts) && !tools;
    const side = Boolean(opts && opts.sidechain);
    const turns = [];
    const skipped = { meta: 0, tool: 0, notification: 0, agent: 0, local: 0, synthetic: 0, sidechain: 0 };
    const seen = new Set();
    // With acts: each tool result by the tool_use it answers, and every
    // tool_use a task-notification has come back for (lib/talkacts.js `settle`).
    const results = new Map();
    const notes = new Set();
    let lastId = null;
    const typed = (raw, at) => {
        lastId = null;
        if (NOTE.test(raw)) return void (skipped.notification += 1);
        if (AGENT.test(raw)) return void (skipped.agent += 1);
        if (LOCAL.test(raw)) return void (skipped.local += 1);
        if (INTERRUPT.test(raw)) return void turns.push({ kind: 'interrupt', at, text: raw.trim() });
        const cmd = COMMAND.exec(raw);
        if (cmd) {
            const args = ARGS.exec(raw);
            return void turns.push({ kind: 'user', at, text: (cmd[1].trim() + ' ' + (args ? args[1].trim() : '')).trim() });
        }
        if (raw.trim()) turns.push({ kind: 'user', at, text: raw.trim() });
    };
    for (const e of entries || []) {
        if (!e || typeof e !== 'object') continue;
        const at = typeof e.timestamp === 'string' ? e.timestamp : null;
        if (e.isSidechain === true && !side) {
            skipped.sidechain += 1;
            continue;
        }
        if (e.type === 'system' && e.subtype === 'compact_boundary') {
            const m = e.compactMetadata || {};
            turns.push({ kind: 'compact', at, text: '', trigger: typeof m.trigger === 'string' ? m.trigger : null,
                preTokens: Number.isFinite(m.preTokens) ? m.preTokens : null });
            lastId = null;
            continue;
        }
        if (e.type === 'attachment') {
            const a = e.attachment || {};
            if (a.type !== 'queued_command') continue;
            if (acts && typeof a.prompt === 'string') {
                const done = talkacts.noteIdOf(a.prompt);
                if (done) notes.add(done);
            }
            if (a.commandMode === 'prompt' && typeof a.prompt === 'string') typed(a.prompt, at);
            else skipped.notification += 1;
            continue;
        }
        if (!e.message || typeof e.message !== 'object') continue;
        if (e.type === 'user') {
            if (acts) {
                const done = talkacts.noteIdOf(usage.textOf(e.message.content));
                if (done) notes.add(done);
            }
            if (e.isCompactSummary === true) {
                turns.push({ kind: 'summary', at, text: usage.textOf(e.message.content).trim() });
                lastId = null;
                continue;
            }
            if (e.isMeta === true) {
                skipped.meta += 1;
                continue;
            }
            if (e.origin && e.origin.kind === 'task-notification') {
                skipped.notification += 1;
                continue;
            }
            const content = e.message.content;
            if (typeof content === 'string') {
                typed(content, at);
                continue;
            }
            for (const b of Array.isArray(content) ? content : []) {
                if (b && b.type === 'tool_result') {
                    if (acts && typeof b.tool_use_id === 'string') {
                        results.set(b.tool_use_id, { error: b.is_error === true,
                            meta: e.toolUseResult && typeof e.toolUseResult === 'object' ? e.toolUseResult : {} });
                    }
                    if (tools) turns.push({ kind: 'result', at, text: usage.textOf(b.content).trim(), id: b.tool_use_id || null });
                    else skipped.tool += 1;
                } else if (b && b.type === 'text' && typeof b.text === 'string') typed(b.text, at);
            }
            continue;
        }
        if (e.type !== 'assistant') continue;
        if (e.message.model === '<synthetic>') {
            skipped.synthetic += 1;
            continue;
        }
        const id = typeof e.message.id === 'string' ? e.message.id : null;
        for (const b of Array.isArray(e.message.content) ? e.message.content : []) {
            if (tools && b && b.type === 'tool_use') {
                turns.push({ kind: 'tool', at, name: String(b.name || ''), text: JSON.stringify(b.input || {}), id: b.id || null });
                lastId = null;
                continue;
            }
            if (acts && b && b.type === 'tool_use') {
                const last = turns[turns.length - 1];
                let act = last && last.kind === 'act' ? last : null;
                if (!act) {
                    act = { kind: 'act', at, tools: [], agents: [] };
                    turns.push(act);
                }
                if (talkacts.AGENT_TOOLS.has(b.name)) act.agents.push(talkacts.agentOf(b));
                else act.tools.push({ id: b.id || null, name: String(b.name || ''), brief: talkacts.briefOf(b.name, b.input), at });
                lastId = null;
                continue;
            }
            if (!b || b.type !== 'text' || typeof b.text !== 'string' || !b.text.trim()) continue;
            const said = b.text.trim();
            if (id && seen.has(id + '\0' + said)) continue;
            if (id) seen.add(id + '\0' + said);
            const last = turns[turns.length - 1];
            if (id && id === lastId && last && last.kind === 'claude') last.text += '\n\n' + said;
            else turns.push({ kind: 'claude', at, text: said });
            lastId = id;
        }
    }
    if (acts) talkacts.settle(turns, results, notes);
    return { turns, skipped };
}

// What each break in the conversation cost: every compaction, and every
// request that rewrote the cache after an hour away — the one-hour cache had
// expired, so the request wrote more than it read. A compact break carries the
// context of the request after it, while an expiry break's `n` is the expiring
// request itself; each carries that request's cache-write dollars and
// `usd`, every request from it up to the next break; `head` is the requests
// before the first. The segments split the main transcript's requests, so
// `head` plus every `usd` is `total`, and `total` is `sessionUsd`, which is
// `prices.costOf` of `summarise`'s own models. `seen`
// is `usage.summarise(file, { series: true })` over the file `entries` came
// from; turn n and `series[n - 1]` are one request (`usage.turnIndex`).
const AWAY_MS = 3600e3;

function spendOf(entries, seen) {
    const list = Array.isArray(entries) ? entries : [];
    const series = seen && Array.isArray(seen.series) ? seen.series : [];
    const turnAt = usage.turnIndex(list);
    const firstLine = [];
    list.forEach((e, i) => {
        const n = turnAt(i);
        if (n !== null && firstLine[n] === undefined) firstLine[n] = i;
    });
    const price = (r, t) => prices.costOf({ [r.billed || r.model]: t }).usd;
    const writes = (t) => ({ input: 0, output: 0, cacheRead: 0, cacheWrite5m: t.cacheWrite5m, cacheWrite1h: t.cacheWrite1h });
    const marks = [];
    const taken = new Set();
    list.forEach((e, i) => {
        if (!e || e.type !== 'system' || e.subtype !== 'compact_boundary') return;
        let n = null;
        for (let k = 1; k <= series.length; k++) {
            if (firstLine[k] > i) { n = k; break; }
        }
        if (n !== null) taken.add(n);
        const m = e.compactMetadata || {};
        marks.push({ kind: 'compact', trigger: typeof m.trigger === 'string' ? m.trigger : null,
            at: typeof e.timestamp === 'string' ? e.timestamp : null, n });
    });
    for (let n = 2; n <= series.length; n++) {
        const a = series[n - 2];
        const b = series[n - 1];
        const t = b.tokens;
        if (taken.has(n) || !(b.at - a.at >= AWAY_MS)) continue;
        if (t.cacheWrite5m + t.cacheWrite1h <= t.cacheRead) continue;
        marks.push({ kind: 'expiry', trigger: 'away', at: new Date(b.at).toISOString(), n });
    }
    const place = (m) => (m.n === null ? Infinity : m.n);
    marks.sort((x, y) => place(x) - place(y));
    const segment = (from, to) => {
        let usd = 0;
        for (let k = from; k < to && k <= series.length; k++) usd += price(series[k - 1], series[k - 1].tokens);
        return usd;
    };
    const head = segment(1, marks.length && marks[0].n !== null ? marks[0].n : series.length + 1);
    let total = head;
    for (let i = 0; i < marks.length; i++) {
        const m = marks[i];
        const r = m.n === null ? null : series[m.n - 1];
        const next = i + 1 < marks.length && marks[i + 1].n !== null ? marks[i + 1].n : series.length + 1;
        m.context = r ? r.context : null;
        m.writeUsd = r ? price(r, writes(r.tokens)) : 0;
        m.usd = r ? segment(m.n, next) : 0;
        total += m.usd;
    }
    return { head, marks, total, sessionUsd: seen ? prices.costOf(seen.usage.models).usd : 0 };
}

// What the file header counts and what the station's tab counts: one
// function, so the two cannot disagree.
function countsOf(turns) {
    const count = (k) => turns.filter((t) => t.kind === k).length;
    return { compact: count('compact'), user: count('user'), claude: count('claude') };
}

// One page of a read for the station: the counts and the skips of the whole
// conversation, and `size` of its turns from index `from`.
const PAGE = 100;
function pageOf(read, from, size) {
    const start = Number.isInteger(from) && from > 0 ? from : 0;
    return { total: read.turns.length, from: start, counts: countsOf(read.turns), skipped: read.skipped, turns: read.turns.slice(start, start + size), spend: read.spend || null };
}

const stamp = (at) => (typeof at === 'string' && at.length >= 16 ? at.slice(0, 16).replace('T', ' ') + ' UTC' : 'no time');

function markdownOf(read, meta) {
    const m = meta || {};
    const turns = read.turns;
    const c = countsOf(turns);
    const out = [
        '# Conversation · session ' + m.session,
        '',
        'transcript: ' + m.file,
        'compactions: ' + c.compact + ' · user turns: ' + c.user + ' · Claude turns: ' + c.claude,
        'left out: ' + Object.keys(read.skipped).map((k) => k + ' ' + read.skipped[k]).join(', '),
        '',
    ];
    let n = 0;
    for (const t of turns) {
        if (t.kind === 'compact') {
            n += 1;
            const how = [t.trigger, t.preTokens == null ? null : t.preTokens.toLocaleString('en-US') + ' tokens before']
                .filter(Boolean).join(', ');
            out.push('---', '', '## Compaction ' + n + ' · ' + stamp(t.at) + (how ? ' · ' + how : ''), '', '---', '');
        } else if (t.kind === 'summary') {
            out.push('<details><summary>Compaction summary</summary>', '', t.text, '', '</details>', '');
        } else if (t.kind === 'interrupt') {
            out.push('*' + t.text + '*', '');
        } else if (t.kind === 'tool') {
            out.push('### Tool · ' + t.name + ' · ' + stamp(t.at), '', '````json', t.text, '````', '');
        } else if (t.kind === 'result') {
            out.push('<details><summary>Result</summary>', '', '````text', t.text, '````', '', '</details>', '');
        } else {
            out.push('## ' + (t.kind === 'user' ? 'User' : 'Claude') + ' · ' + stamp(t.at), '', t.text, '');
        }
    }
    return out.join('\n');
}

function jsonlOf(turns) {
    return turns.map((t) => JSON.stringify(t) + '\n').join('');
}

module.exports = { turnsOf, markdownOf, jsonlOf, countsOf, pageOf, spendOf, PAGE };
