#!/usr/bin/env node
'use strict';

// What one session's own context did, turn by turn — the number a stage agent
// exists to keep down. It reads a transcript with the readers `lib/usage.js`
// already has and parses no line itself.
//
//   node scripts/ctx.js <transcript.jsonl | session-id> [--by-stage] [--claude-dir <dir>]
//   node scripts/ctx.js --compare <a> <b>
//
// An argument ending `.jsonl` is a transcript; anything else is a session id,
// which `transcriptOf` in `lib/detail.js` finds under every project directory
// of the config directory.
//
// `context` is one request's input plus cache reads plus cache writes, the
// figure `lib/usage.js` calls `contextOf`. A gate is a request whose reply calls
// AskUserQuestion; its figure is the context that question went out with.
const os = require('node:os');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');
const detail = require('../lib/detail.js');
const usage = require('../lib/usage.js');

const OPTIONS = { compare: { type: 'boolean' }, 'by-stage': { type: 'boolean' }, 'claude-dir': { type: 'string' } };
const USAGE = 'usage: node scripts/ctx.js <transcript.jsonl|session-id>  |  --compare <a> <b>   [--by-stage] [--claude-dir <dir>]';

function asksAQuestion(entry) {
    const content = entry && entry.message && entry.message.content;
    return Boolean(entry && entry.type === 'assistant' && entry.isSidechain !== true && Array.isArray(content)
        && content.some((c) => c && c.type === 'tool_use' && c.name === 'AskUserQuestion'));
}

// A dispatch's return reaches the main thread on a user line, not as a tool result:
// `peer` for a hand-back, `task-notification` for a background agent or a workflow.
const isWake = (entry) => usage.notificationOf(entry) || (entry.origin && entry.origin.kind === 'peer');

// The main thread cut by stage, at the `task.js` commands the session itself ran. A
// stage owns the requests after the command that entered it, up to and including the
// request that runs the next one: that request still belongs to the stage it leaves.
// Requests before the first command are `stage: null`. `woken` counts the requests where a
// subagent's return arrived since the previous request and no tool result did, before or
// after that return: a tool result would have led to the request anyway, so the return was
// not its only cause. That is what a dispatch cost the main thread, as against the turns
// it spent on its own tool loop. `gates` is
// `measure`'s list of turn numbers that asked a question, already one per request.
function stageRows(entries, turn, contexts, commands, gates) {
    const rows = [{ stage: null, from: 1 }];
    for (const c of commands) {
        if (c.stage && Number.isFinite(c.turn)) rows.push({ stage: c.stage, from: c.turn + 1 });
    }
    for (const r of rows) Object.assign(r, { turns: 0, woken: 0, gates: 0, first: null, last: 0, reread: 0 });
    const at = (t) => rows.reduce((found, r) => (r.from <= t ? r : found), rows[0]);
    contexts.forEach((context, i) => {
        const r = at(i + 1);
        r.turns++;
        r.reread += context;
        if (r.first === null) r.first = context;
        r.last = context;
    });
    let seen = 0;
    let sawResult = false;
    let sawWake = false;
    entries.forEach((entry, i) => {
        if (!entry || entry.isSidechain === true) return;
        if (entry.type === 'user') {
            const content = entry.message && entry.message.content;
            if (Array.isArray(content) && content.some((c) => c && c.type === 'tool_result')) sawResult = true;
            else if (isWake(entry)) sawWake = true;
            return;
        }
        const t = turn(i);
        if (t === null) return;
        if (t > seen) {
            seen = t;
            if (sawWake && !sawResult) at(t).woken++;
            sawResult = false;
            sawWake = false;
        }
    });
    for (const g of gates) at(g).gates++;
    return rows.filter((r) => r.turns > 0).map(({ from, ...row }) => row);
}

// A subagent's own transcript (`subagents/agent-<id>.jsonl`) marks every line `isSidechain: true`, so read
// as a session it has no request at all. It is told by its content, not its path: it has requests, and
// every one of them is a sidechain line. A session's file that carries a few sidechain lines among its main
// ones is still a session, and those lines stay ignored.
const isRequest = (entry) => Boolean(entry && entry.type === 'assistant' && entry.message && typeof entry.message === 'object'
    && typeof entry.message.model === 'string' && entry.message.usage && typeof entry.message.usage === 'object');
const isAgentFile = (entries) => {
    const requests = entries.filter(isRequest);
    return requests.length > 0 && requests.every((entry) => entry.isSidechain === true);
};

// An agent file is measured as that agent's own main thread: `summarise` is told to count sidechain lines,
// and each line is copied with `isSidechain` false so `turnIndex`, `stageRows` and the gate scan, which skip
// sidechain lines, need no change. Its `stages` are normally the one `stage: null` row, an agent running no
// `task.js`.
function measure(file) {
    const raw = usage.entriesOf(file);
    if (!raw) return null;
    const agentFile = isAgentFile(raw);
    const summary = usage.summarise(file, agentFile ? { sidechain: true, series: true } : { series: true });
    if (!summary) return null;
    const entries = agentFile ? raw.map((entry) => (entry && entry.isSidechain === true ? { ...entry, isSidechain: false } : entry)) : raw;
    const contexts = summary.series.map((row) => row.context);
    const turn = usage.turnIndex(entries);
    const gates = [];
    entries.forEach((entry, i) => {
        const n = asksAQuestion(entry) ? turn(i) : null;
        if (n && !gates.includes(n)) gates.push(n);
    });
    const peak = contexts.reduce((a, b) => Math.max(a, b), 0);
    const agents = usage.agentsOf(file);
    const stages = stageRows(entries, turn, contexts, detail.stageCommands(entries, turn), gates);
    return {
        turns: contexts.length,
        perTurn: contexts,
        peak,
        peakTurn: contexts.indexOf(peak) + 1,
        last: contexts[contexts.length - 1],
        gates: gates.map((n) => contexts[n - 1]),
        stages,
        agents: agents ? agents.agents : 0,
        agentTokens: agents ? usage.tokensOf(usage.splitOf(agents.models)) : 0,
    };
}

const n = (v) => v.toLocaleString('en-US');
const signed = (v) => (v > 0 ? '+' : '') + n(v);

const stageLine = (r) => '    ' + (r.stage || '(before)').padEnd(9) + ' turns ' + String(r.turns).padStart(3)
    + '   woken ' + String(r.woken).padStart(2) + '   gates ' + String(r.gates).padStart(2)
    + '   context ' + n(r.first) + ' → ' + n(r.last) + '   re-read ' + n(r.reread);

function describe(label, m, byStage) {
    if (!m) return label + '\n  unreadable';
    const out = [
        label,
        '  turns ' + n(m.turns) + '   peak ' + n(m.peak) + ' (turn ' + m.peakTurn + ')   last ' + n(m.last),
        '  at ' + m.gates.length + ' gates: ' + (m.gates.length ? m.gates.map(n).join(' ') : '—'),
        '  each turn: ' + m.perTurn.join(' '),
        '  subagents ' + n(m.agents) + '   tokens ' + n(m.agentTokens),
    ];
    if (byStage) out.push('  by stage (woken: a subagent\'s return since the last request, and no tool result):', ...m.stages.map(stageLine));
    return out.join('\n');
}

function main(argv) {
    let parsed;
    try {
        parsed = parseArgv({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
    } catch (e) {
        return { text: USAGE, code: 2 };
    }
    const { values, positionals } = parsed;
    if (positionals.length !== (values.compare ? 2 : 1)) return { text: USAGE, code: 2 };
    const claudeDir = values['claude-dir'] || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    const files = positionals.map((p) => (p.endsWith('.jsonl') ? p : detail.transcriptOf(claudeDir, p)));
    const ms = files.map((file) => (file ? measure(file) : null));
    const out = positionals.map((file, i) => describe(file, ms[i], values['by-stage']));
    if (values.compare && ms[0] && ms[1]) {
        out.push('b minus a   peak ' + signed(ms[1].peak - ms[0].peak) + '   subagent tokens ' + signed(ms[1].agentTokens - ms[0].agentTokens));
    }
    // A lookup that found nothing is a failure a wrapping script must see; the
    // text still prints, with `unreadable` under the argument that failed. So does
    // a readable transcript with no assistant request: `summarise` gives null for it.
    return ms.some((m) => !m) ? { text: out.join('\n\n'), code: 1 } : { text: out.join('\n\n') };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { measure, main };
