#!/usr/bin/env node
'use strict';

// PreToolUse on `Agent|Task`: four Agent calls in one response is the
// default, and the fifth and later in the same assistant message are asked
// of the user first, with what they are likely to cost (dispatch-1). Claude
// Code writes one transcript line per content block, so one message's calls
// are the assistant lines sharing `message.id` — the grouping `pendingTool`
// in lib/handoff.js uses. At four or fewer it writes nothing, so those calls
// reach the user's own permission rules untouched. Exits 0 on every path.

const fs = require('node:fs');
const path = require('node:path');
const { run, parse } = require('../lib/hook.js');
const registry = require('../lib/registry.js');
const { costOf } = require('../lib/prices.js');
const { sessionDirOf, agentFiles } = require('../lib/usage.js');
const { tailEntries } = require('../lib/handoff.js');

const DEFAULT = 4;
const DISPATCH = new Set(['Agent', 'Task']);
const EVIDENCE = path.join(__dirname, '..', 'docs', '90-agent', 'reports', 'evidence');

const blocksOf = (e) => (e && e.message && Array.isArray(e.message.content) ? e.message.content : []);
const callsIn = (e) => blocksOf(e).filter((b) => b && b.type === 'tool_use' && DISPATCH.has(b.name));
const sameMessage = (a, b) => a === b || Boolean(a.message && b.message && a.message.id && a.message.id === b.message.id);

// Which Agent call of its assistant message this one is, from 1. Found by
// its own id where the transcript holds it already; otherwise it is the next
// block of the message still being written, or the first of a new message
// when a user line has come after the last assistant line.
function positionOf(entries, toolUseId) {
    const assistant = entries.filter((e) => e && e.type === 'assistant');
    const owner = toolUseId ? assistant.find((e) => callsIn(e).some((b) => b.id === toolUseId)) : null;
    if (owner) {
        const calls = assistant.filter((e) => sameMessage(e, owner)).flatMap(callsIn);
        return calls.findIndex((b) => b.id === toolUseId) + 1;
    }
    let last = -1;
    entries.forEach((e, i) => { if (e && e.type === 'assistant') last = i; });
    if (last < 0 || entries.slice(last + 1).some((e) => e && e.type === 'user')) return 1;
    return assistant.filter((e) => sameMessage(e, entries[last])).flatMap(callsIn).length + 1;
}

// The transcript the calls are in: a subagent's own file when a subagent
// dispatches (`agent_id`, the path hooks/budget.js reads), else the session's.
function transcriptFor(payload) {
    const main = typeof payload.transcript_path === 'string' ? payload.transcript_path : '';
    if (!main) return null;
    if (!payload.agent_id) return main;
    const dir = sessionDirOf(main);
    if (!dir) return null;
    // A workflow's agents write under subagents/workflows/<run>/ (hooks/budget.js
    // walks there too); the direct path first, since the walk reads a directory.
    const name = 'agent-' + payload.agent_id + '.jsonl';
    const direct = path.join(dir, 'subagents', name);
    if (fs.existsSync(direct)) return direct;
    return agentFiles(dir).find((f) => path.basename(f) === name) || direct;
}

// `fankeel:fankeel-reader-high` is the bench's `reader`.
const roleOf = (type) => String(type || '').replace(/^fankeel:/, '').replace(/^fankeel-/, '').replace(/-(high|xhigh)$/, '');

// One dispatch of `role`, from the newest bench summary that ran it:
// `bench.js tally` writes <evidence>/<date>-*/role-<role>-<stamp>/summary.json,
// whose `arms` carry `roleUsd` over `runs` (lib/bench.js roleTally). The arm
// is the dispatch's own `model` where the summary ran one, else all of them.
function benchPerDispatch(evidenceRoot, role, model) {
    const prefix = 'role-' + role + '-';
    let best = null;
    let dates;
    try { dates = fs.readdirSync(evidenceRoot); } catch (e) { return null; }
    for (const d of dates) {
        let batches;
        try { batches = fs.readdirSync(path.join(evidenceRoot, d)); } catch (e) { continue; }
        for (const b of batches) {
            if (!b.startsWith(prefix)) continue;
            if (!best || b > best.batch) best = { batch: b, file: path.join(evidenceRoot, d, b, 'summary.json') };
        }
    }
    if (!best) return null;
    let arms;
    try { arms = JSON.parse(fs.readFileSync(best.file, 'utf8')).arms; } catch (e) { return null; }
    if (!Array.isArray(arms)) return null;
    const own = arms.filter((a) => a && a.arm === model);
    const pick = own.length ? own : arms.filter(Boolean);
    const runs = pick.reduce((n, a) => n + (a.runs || 0), 0);
    const usd = pick.reduce((n, a) => n + (a.roleUsd || 0), 0);
    return runs ? { usd: usd / runs, batch: best.batch } : null;
}

// What this task has spent, priced by lib/prices.js from the registry's
// `spend` — written by hooks/leave.js when a session ends, so a resumed
// session is the one that has it — or null when no stage has any.
function spentSoFar(data) {
    const spend = data && data.spend && typeof data.spend === 'object' ? data.spend : null;
    if (!spend) return null;
    let usd = 0;
    let any = false;
    for (const stage of Object.keys(spend)) {
        const s = registry.spendOf(data, stage);
        if (!s) continue;
        any = true;
        usd += costOf(s.models).usd + (s.subagents ? costOf(s.subagents.models).usd : 0);
    }
    return any ? usd : null;
}

function decide(payload, opts) {
    if (!payload || !DISPATCH.has(payload.tool_name)) return null;
    const file = transcriptFor(payload);
    if (!file) return null;
    const n = positionOf(tailEntries(file) || [], payload.tool_use_id);
    if (n <= DEFAULT) return null;
    const input = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : {};
    const role = roleOf(input.subagent_type);
    const head = 'fankeel: this is Agent call ' + n + ' in one response, past the default of four. ';
    const spent = spentSoFar(opts && opts.data);
    if (spent !== null) return { reason: head + 'This task has spent $' + spent.toFixed(2) + ' so far (registry spend, priced by lib/prices.js).' };
    const bench = benchPerDispatch(opts && opts.evidenceRoot, role, input.model);
    if (bench) return { reason: head + 'About $' + (bench.usd * n).toFixed(3) + ' for these ' + n + ' dispatches: $' + bench.usd.toFixed(4) + ' each for ' + role + ' in ' + bench.batch + '.' };
    return { reason: head + 'No figure: no stage has recorded spend and no bench ran ' + role + '.' };
}

function main(raw) {
    const payload = parse(raw);
    if (!payload || !DISPATCH.has(payload.tool_name)) return;
    let data = null;
    try { data = registry.readSession(registry.rootFor(payload), payload.session_id); } catch (e) { /* no registry: the bench figure */ }
    const out = decide(payload, { data, evidenceRoot: EVIDENCE });
    if (!out) return;
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: out.reason },
    }));
}

if (require.main === module) run(main);

module.exports = { positionOf, benchPerDispatch, spentSoFar, decide };
