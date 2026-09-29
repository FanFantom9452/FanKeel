#!/usr/bin/env node
'use strict';

// SubagentStart. Fires when a subagent is spawned, background ones included,
// and hands it the part of the parent's situation it has no way to work out for
// itself.
//
// A subagent starts with its own context and none of the parent's. The
// `UserPromptSubmit` injection never reaches it — that one rides on the user's
// prompt, and a subagent does not have one. So without this it does not know
// which task it belongs to, which files are spoken for, or that its own output
// is about to be pasted into somebody else's context forever.
//
// Same two rules as the other hooks: exit 0 on every path, and cost nothing for
// a session that is not in the mode.
//
// A subagent started with an isolated context does not receive this, and that is
// Claude Code's decision rather than something to work around.
//
// The agent type is passed through, and one type — fankeel-judge — gets a
// line of its own in lib/render.js.

const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const { renderBrief } = require('../lib/render.js');
const profileLib = require('../lib/profile.js');
const { lapOf } = require('../lib/handoff.js');
const { run, parse } = require('../lib/hook.js');
const { sessionDirOf } = require('../lib/usage.js');

// A `fankeel-brain` dispatching a nested `fankeel-brain` of its own — build's
// fixer-round resume does this — fires this same SubagentStart for the inner
// one, and Claude Code's SubagentStart payload carries no depth of its own to
// tell the two apart. The depth is on `agent-<id>.meta.json` instead, the same
// file and fields lib/usage.js already reads for this (`spawnDepth`,
// `parentAgentId` — lib/usage.js:603, docs/90-agent/reference/subagents.md's
// `spawnDepth` 2 convention). Anything that keeps that file from answering —
// no transcript path, no file yet, bad JSON, no field — reads as depth 1:
// a missed nested mark only costs a spurious `group` (today's behaviour), a
// missed real mark breaks the controller, so unknown must not skip the mark.
// Measured: the file is not there while this hook runs, even waiting 500 ms — docs/90-agent/reports/2026-09-28-spawndepth-timing.md.
function nestedBrain(payload) {
    const dir = sessionDirOf(payload.transcript_path);
    if (!dir) return false;
    const metaFile = path.join(dir, 'subagents', 'agent-' + payload.agent_id + '.meta.json');
    let meta;
    try {
        meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    } catch (e) {
        return false;
    }
    if (typeof meta.spawnDepth === 'number') return meta.spawnDepth >= 2;
    if (typeof meta.parentAgentId === 'string' && meta.parentAgentId) return true;
    return false;
}

// What a build brain was sent for: line 1 of its own transcript is the
// dispatch prompt, which names `build group <n>` or `build close`. Unreadable
// — no path, no file yet, bad JSON, neither phrase — is null, and the mark is
// then made the way it always was.
function caseOf(payload) {
    const dir = sessionDirOf(payload.transcript_path);
    if (!dir || !payload.agent_id) return null;
    let line;
    try {
        const fd = fs.openSync(path.join(dir, 'subagents', 'agent-' + payload.agent_id + '.jsonl'), 'r');
        try {
            const buf = Buffer.alloc(65536);
            const n = fs.readSync(fd, buf, 0, buf.length, 0);
            line = buf.toString('utf8', 0, n).split(/\r?\n/, 1)[0];
        } finally {
            fs.closeSync(fd);
        }
    } catch (e) {
        return null;
    }
    let text = '';
    try {
        const content = JSON.parse(line).message.content;
        text = typeof content === 'string' ? content : (Array.isArray(content) ? content.map((p) => (p && p.text) || '').join('\n') : '');
    } catch (e) {
        return null;
    }
    const m = /\bbuild (?:close|group (\d+))\b/.exec(text);
    if (!m) return null;
    return m[1] ? { kind: 'group', group: Number(m[1]) } : { kind: 'close' };
}

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;

    // The subagent inherits its parent's session, so the parent's entry is the
    // one to read. `agent_id` identifies the subagent and is deliberately not
    // used as a registry key: a subagent is not a session, it does not own a
    // task, and giving it an entry would put a second claimant on the parent's
    // own files.
    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;

    // A stage agent starting is the in-flight mark the controller's block
    // reads (`controlFor` in lib/stages.js), so an interjection mid-stage is
    // told to SendMessage it rather than start a second one. The parent's
    // record, not an entry for the subagent: `agent_id` is a value here.
    // `lap` is the one `renderBrief` below builds the brief's paths with, and
    // `group` is the one it names in a build's brief: `markInflight` assigns
    // it, so this is the one place both the mark and the brief agree on it.
    let group = null;
    if (mine.stage && String(payload.agent_type || '').replace(/^fankeel:/, '') === 'fankeel-brain' && !nestedBrain(payload)) {
        try {
            const sent = mine.stage === 'build' ? caseOf(payload) : null;
            group = registry.markInflight(root, payload.session_id, mine.stage, payload.agent_id, lapOf(mine, mine.stage), sent && sent.group, sent && sent.kind);
        } catch (e) { /* housekeeping */ }
    }

    // The project's standing answers, read exactly the way hooks/resume.js
    // does: a read failure costs one line, never the brief. Without this,
    // `renderBrief` cannot tell whether `stage.agents` is on, and the brain
    // branch it gates would have to guess.
    let profile;
    try {
        profile = profileLib.profileFor(root, mine);
    } catch (e) { /* housekeeping */ }

    const text = renderBrief({ mine: { sessionId: payload.session_id, data: mine }, agentType: payload.agent_type, root, profile, transcriptPath: payload.transcript_path, group });
    if (!text) return;

    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'SubagentStart',
            additionalContext: text,
        },
    }));
}

// Deliberately silent. A subagent that starts without the brief is worse
// informed; a subagent that fails to start is worse than that.
run(main);
