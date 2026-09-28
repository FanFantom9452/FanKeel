#!/usr/bin/env node
'use strict';
// SubagentStart probe, second run: the hook itself waits for
// subagents/agent-<id>.meta.json, re-reading every STEP_MS for at most WAIT_MS,
// so the question is whether Claude Code writes the file while a hook is still
// running. `node record.js after` re-reads every file once the run is over.
const fs = require('node:fs');
const path = require('node:path');
const { sessionDirOf } = require('../../../../../lib/usage.js');

const LOG = path.join(__dirname, 'hook-log.jsonl');
const STEP_MS = 20;
const WAIT_MS = 500;

function metaFileOf(payload) {
    const dir = sessionDirOf(payload.transcript_path);
    return dir ? path.join(dir, 'subagents', 'agent-' + payload.agent_id + '.meta.json') : null;
}

function statOf(file) {
    try {
        const s = fs.statSync(file);
        let body = null;
        try { body = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { body = 'unparsed'; }
        return { exists: true, mtimeMs: s.mtimeMs, body };
    } catch (e) {
        return { exists: false };
    }
}

if (process.argv[2] === 'after') {
    const rows = fs.readFileSync(LOG, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
    const out = rows.map((r) => {
        const now = r.metaFile ? statOf(r.metaFile) : { exists: false };
        const body = now.exists && now.body && typeof now.body === 'object' ? now.body : null;
        return {
            agent_id: r.agent_id,
            agent_type: r.agent_type,
            firstSeenMs: r.firstSeenMs,
            depthAtFirstSeen: r.depthAtFirstSeen,
            polls: r.polls,
            waitedMs: r.returnedAt - r.hookAt,
            existsAfter: now.exists,
            depthAfter: body ? body.spawnDepth : null,
            parentAfter: body ? body.parentAgentId || null : null,
            mtimeMinusHookMs: now.exists ? Math.round(now.mtimeMs - r.hookAt) : null,
            mtimeMinusReturnMs: now.exists ? Math.round(now.mtimeMs - r.returnedAt) : null,
        };
    });
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
} else {
    let raw = '';
    process.stdin.on('data', (c) => { raw += c; });
    process.stdin.on('end', () => {
        const hookAt = Date.now();
        let payload = {};
        try { payload = JSON.parse(raw); } catch (e) { payload = {}; }
        const metaFile = metaFileOf(payload);
        const nap = new Int32Array(new SharedArrayBuffer(4));
        let firstSeenMs = null;
        let depthAtFirstSeen = null;
        let polls = 0;
        for (;;) {
            polls += 1;
            const s = metaFile ? statOf(metaFile) : { exists: false };
            if (s.exists && s.body && typeof s.body === 'object' && typeof s.body.spawnDepth === 'number') {
                firstSeenMs = Date.now() - hookAt;
                depthAtFirstSeen = s.body.spawnDepth;
                break;
            }
            if (Date.now() - hookAt >= WAIT_MS) break;
            Atomics.wait(nap, 0, 0, STEP_MS);
        }
        const returnedAt = Date.now();
        fs.appendFileSync(LOG, JSON.stringify({ hookAt, returnedAt, agent_id: payload.agent_id, agent_type: payload.agent_type, transcript_path: payload.transcript_path, metaFile, firstSeenMs, depthAtFirstSeen, polls }) + '\n');
    });
}
