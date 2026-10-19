'use strict';

// brain-1: the agents a subagent dispatched that have not come back. A stage
// agent handed back on 2026-10-19 while its adversary and render review were
// still out, though agents/fankeel-brain.md told it to wait; hooks/budget.js
// now refuses that hand-back with what is here.
//
// Two records already on disk answer it: hooks/mod.ts writes
// .fankeel/build/spawn/<id>.json at every Agent call, naming the parent's
// agent id, and hooks/agent-end.js writes a stop per agent on SubagentStop
// into .fankeel/build/agents-<session>.json, taking it away when a
// SendMessage starts the agent again. No mod, no spawn records: nothing is
// outstanding, and nothing is held.

const fs = require('node:fs');
const path = require('node:path');
const { readObject } = require('./json.js');
const { readEnds } = require('./agentends.js');
const { sessionDirOf } = require('./usage.js');

// A child that has written nothing for this long is taken as gone rather than
// left holding its parent forever: the eleven minutes `BUSY_MS` in
// lib/handoff.js gives a stopped agent's last unanswered tool call.
const GONE_MS = 11 * 60 * 1000;
const NAME = /^[\w.-]+$/;

function outstanding(root, sessionId, agentId, transcriptPath, now) {
    if (typeof agentId !== 'string' || !NAME.test(agentId)) return [];
    const t = Number.isFinite(now) ? now : Date.now();
    const dir = path.join(root, '.fankeel', 'build', 'spawn');
    let names;
    try { names = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch (e) { return []; }
    const ended = readEnds(root, sessionId);
    const sessionDir = sessionDirOf(transcriptPath);
    const out = [];
    for (const name of names) {
        const child = name.slice(0, -'.json'.length);
        if (Object.hasOwn(ended, child)) continue;
        const rec = readObject(path.join(dir, name));
        if (!rec || rec.parentAgentId !== agentId) continue;
        const at = Date.parse(rec.at);
        let last = Number.isFinite(at) ? at : 0;
        if (sessionDir) {
            try { last = Math.max(last, fs.statSync(path.join(sessionDir, 'subagents', 'agent-' + child + '.jsonl')).mtimeMs); } catch (e) { /* no transcript yet */ }
        }
        if (t - last >= GONE_MS) continue;
        out.push({ agentId: child, subagentType: typeof rec.subagentType === 'string' ? rec.subagentType : '', at: String(rec.at || '') });
    }
    return out;
}

// The refusal, worded as the wait agents/fankeel-brain.md already describes:
// end the turn with `waiting`, and the harness wakes the agent per child.
function heldReason(list) {
    const one = list.length === 1;
    const named = list.map((c) => '`' + c.agentId + '`' + (c.subagentType ? ' (' + c.subagentType + ')' : '')).join(', ');
    return 'fankeel: not yet — ' + list.length + (one ? ' agent' : ' agents') + ' you dispatched ' + (one ? 'has' : 'have')
        + ' not returned: ' + named + '. End your turn with the single word `waiting`; the harness wakes you when each returns.'
        + ' Hand back once every one has, its result in your report.';
}

module.exports = { outstanding, heldReason };
