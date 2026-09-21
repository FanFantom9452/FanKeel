#!/usr/bin/env node
'use strict';

// What one session's own context did, turn by turn — the number a stage agent
// exists to keep down. It reads a transcript with the readers `lib/usage.js`
// already has and parses no line itself.
//
//   node scripts/ctx.js <transcript.jsonl | session-id> [--claude-dir <dir>]
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

const OPTIONS = { compare: { type: 'boolean' }, 'claude-dir': { type: 'string' } };
const USAGE = 'usage: node scripts/ctx.js <transcript.jsonl|session-id>  |  --compare <a> <b>   [--claude-dir <dir>]';

function asksAQuestion(entry) {
    const content = entry && entry.message && entry.message.content;
    return Boolean(entry && entry.type === 'assistant' && entry.isSidechain !== true && Array.isArray(content)
        && content.some((c) => c && c.type === 'tool_use' && c.name === 'AskUserQuestion'));
}

function measure(file) {
    const entries = usage.entriesOf(file);
    const summary = entries && usage.summarise(file, { series: true });
    if (!summary) return null;
    const contexts = summary.series.map((row) => row.context);
    const turn = usage.turnIndex(entries);
    const gates = [];
    entries.forEach((entry, i) => {
        const n = asksAQuestion(entry) ? turn(i) : null;
        if (n && !gates.includes(n)) gates.push(n);
    });
    const peak = contexts.reduce((a, b) => Math.max(a, b), 0);
    const agents = usage.agentsOf(file);
    return {
        turns: contexts.length,
        perTurn: contexts,
        peak,
        peakTurn: contexts.indexOf(peak) + 1,
        last: contexts[contexts.length - 1],
        gates: gates.map((n) => contexts[n - 1]),
        agents: agents ? agents.agents : 0,
        agentTokens: agents ? usage.tokensOf(usage.splitOf(agents.models)) : 0,
    };
}

const n = (v) => v.toLocaleString('en-US');
const signed = (v) => (v > 0 ? '+' : '') + n(v);

function describe(label, m) {
    if (!m) return label + '\n  unreadable';
    return [
        label,
        '  turns ' + n(m.turns) + '   peak ' + n(m.peak) + ' (turn ' + m.peakTurn + ')   last ' + n(m.last),
        '  at ' + m.gates.length + ' gates: ' + (m.gates.length ? m.gates.map(n).join(' ') : '—'),
        '  each turn: ' + m.perTurn.join(' '),
        '  subagents ' + n(m.agents) + '   tokens ' + n(m.agentTokens),
    ].join('\n');
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
    const out = positionals.map((file, i) => describe(file, ms[i]));
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
