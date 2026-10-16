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
const { acquire } = require('./suitelock.js');

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

// Parallel subagents stop within a few ms of each other, and an unlocked
// read-change-write would drop all but the last one's stop. The lock is the
// suite's: a holder that died or is older than LOCK_MS is cleared.
const LOCK_MS = 3000;
function locked(root, sessionId, change) {
    const lock = acquire({ file: endsPath(root, sessionId) + '.lock', pollMs: 10, maxAgeMs: LOCK_MS });
    try {
        const ended = readEnds(root, sessionId);
        if (change(ended)) write(root, sessionId, ended);
    } finally {
        lock.release();
    }
}

function markEnded(root, sessionId, agentId, at) {
    locked(root, sessionId, (ended) => { ended[agentId] = at; return true; });
}

function clearEnded(root, sessionId, agentId) {
    locked(root, sessionId, (ended) => Object.hasOwn(ended, agentId) && delete ended[agentId]);
}

module.exports = { readEnds, markEnded, clearEnded };
