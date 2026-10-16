'use strict';

// .fankeel/build/agents-<session>.json: when each of a session's subagents
// last stopped, keyed by agent id, for the Pane's agent tree
// (hooks/pane-agents.ts). hooks/agent-end.js writes a stop on SubagentStop
// and takes it away on SubagentStart, since a SendMessage starts a stopped
// agent again. This is not the registry's `inflight`: nothing here decides
// whether a stage agent is out.

const fs = require('node:fs');
const path = require('node:path');
const { readObject } = require('./json.js');
const { writeAtomic } = require('./registry.js');

// The most stops one file keeps; the oldest goes first.
const KEEP = 200;

const endsPath = (root, sessionId) => path.join(root, '.fankeel', 'build', 'agents-' + sessionId + '.json');

function readEnds(root, sessionId) {
    const got = readObject(endsPath(root, sessionId));
    const ended = got && got.ended && typeof got.ended === 'object' ? got.ended : {};
    const out = {};
    for (const [id, at] of Object.entries(ended)) if (typeof at === 'number' && Number.isFinite(at)) out[id] = at;
    return out;
}

function write(root, sessionId, ended) {
    const file = endsPath(root, sessionId);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const kept = Object.entries(ended).sort((a, b) => b[1] - a[1]).slice(0, KEEP);
    writeAtomic(file, JSON.stringify({ ended: Object.fromEntries(kept) }) + '\n');
}

function markEnded(root, sessionId, agentId, at) {
    const ended = readEnds(root, sessionId);
    ended[agentId] = at;
    write(root, sessionId, ended);
}

function clearEnded(root, sessionId, agentId) {
    const ended = readEnds(root, sessionId);
    if (!Object.hasOwn(ended, agentId)) return;
    delete ended[agentId];
    write(root, sessionId, ended);
}

module.exports = { readEnds, markEnded, clearEnded };
