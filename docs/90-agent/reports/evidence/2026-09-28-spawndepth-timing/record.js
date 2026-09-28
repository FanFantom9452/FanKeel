#!/usr/bin/env node
'use strict';
// SubagentStart probe for hooks/brief.js's nestedBrain(): at the moment the hook
// fires, is subagents/agent-<id>.meta.json already on disk, and what does it say?
// `node record.js after` re-reads every recorded meta file once the run is over
// and prints, per agent, whether it exists now and its mtime against the hook's.
const fs = require('node:fs');
const path = require('node:path');
const { sessionDirOf } = require('../../../../../lib/usage.js');

const LOG = path.join(__dirname, 'hook-log.jsonl');

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
        return {
            agent_id: r.agent_id,
            agent_type: r.agent_type,
            atHook: r.atHook.exists,
            depthAtHook: r.atHook.exists && r.atHook.body && typeof r.atHook.body === 'object' ? r.atHook.body.spawnDepth : null,
            existsAfter: now.exists,
            depthAfter: now.exists && now.body && typeof now.body === 'object' ? now.body.spawnDepth : null,
            parentAfter: now.exists && now.body && typeof now.body === 'object' ? now.body.parentAgentId || null : null,
            mtimeMinusHookMs: now.exists ? Math.round(now.mtimeMs - r.hookAt) : null,
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
        const atHook = metaFile ? statOf(metaFile) : { exists: false };
        fs.appendFileSync(LOG, JSON.stringify({ hookAt, agent_id: payload.agent_id, agent_type: payload.agent_type, transcript_path: payload.transcript_path, metaFile, atHook }) + '\n');
    });
}
