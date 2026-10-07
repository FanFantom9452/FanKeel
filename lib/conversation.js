'use strict';
// One session's conversation as text: what the user typed and what Claude
// wrote back, in order, with every compaction marked where it happened and the
// summary Claude Code wrote at it. A transcript is append-only — a compaction
// adds a `compact_boundary` line and a summary, and the lines before it stay —
// so the whole conversation is still on disk after any number of compactions.
//
// Everything else is left out and counted: tool calls and their results,
// thinking, system text (`isMeta`), hook output, background-task
// notifications, a subagent's hand-back, the output of a local slash command,
// Claude Code's own `<synthetic>` replies, and subagent lines (`isSidechain`).
// A subagent's own transcript is not read.
//
// A prompt the user types while Claude is busy is not a `user` line: it is an
// `attachment` line whose `attachment.type` is `queued_command`, and a
// subagent's hand-back arrives the same way, opening `<agent-message`.
const usage = require('./usage.js');

const COMMAND = /<command-name>([\s\S]*?)<\/command-name>/;
const ARGS = /<command-args>([\s\S]*?)<\/command-args>/;
const LOCAL = /^\s*<local-command-(stdout|stderr|caveat)>/;
const NOTE = /^\s*<task-notification>/;
const AGENT = /^\s*<agent-message\b/;
const INTERRUPT = /^\s*\[Request interrupted by user/;

function turnsOf(entries) {
    const turns = [];
    const skipped = { meta: 0, tool: 0, notification: 0, agent: 0, local: 0, synthetic: 0, sidechain: 0 };
    const seen = new Set();
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
        if (e.isSidechain === true) {
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
            if (a.commandMode === 'prompt' && typeof a.prompt === 'string') typed(a.prompt, at);
            else skipped.notification += 1;
            continue;
        }
        if (!e.message || typeof e.message !== 'object') continue;
        if (e.type === 'user') {
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
                if (b && b.type === 'tool_result') skipped.tool += 1;
                else if (b && b.type === 'text' && typeof b.text === 'string') typed(b.text, at);
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
    return { turns, skipped };
}

const stamp = (at) => (typeof at === 'string' && at.length >= 16 ? at.slice(0, 16).replace('T', ' ') + ' UTC' : 'no time');

function markdownOf(read, meta) {
    const m = meta || {};
    const turns = read.turns;
    const count = (k) => turns.filter((t) => t.kind === k).length;
    const out = [
        '# Conversation · session ' + m.session,
        '',
        'transcript: ' + m.file,
        'compactions: ' + count('compact') + ' · user turns: ' + count('user') + ' · Claude turns: ' + count('claude'),
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
        } else {
            out.push('## ' + (t.kind === 'user' ? 'User' : 'Claude') + ' · ' + stamp(t.at), '', t.text, '');
        }
    }
    return out.join('\n');
}

function jsonlOf(turns) {
    return turns.map((t) => JSON.stringify(t) + '\n').join('');
}

module.exports = { turnsOf, markdownOf, jsonlOf };
