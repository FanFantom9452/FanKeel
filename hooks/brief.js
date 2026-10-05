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
// The agent type is passed through, and two types get lines of their own in
// lib/render.js: fankeel-judge, and fankeel-writer, which gets the profile's
// `prose.style` rules.

const fs = require('node:fs');
const path = require('node:path');
const { readObject } = require('../lib/json.js');
const registry = require('../lib/registry.js');
const { renderBrief } = require('../lib/render.js');
const profileLib = require('../lib/profile.js');
const { lapOf, caseOfPrompt } = require('../lib/handoff.js');
const { run, parse } = require('../lib/hook.js');
const { sessionDirOf } = require('../lib/usage.js');
const { baseAgent } = require('../lib/agentfile.js');
const { NAMES } = require('../lib/stages.js');

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
    const meta = readObject(metaFile);
    if (!meta) return false;
    if (typeof meta.spawnDepth === 'number') return meta.spawnDepth >= 2;
    if (typeof meta.parentAgentId === 'string' && meta.parentAgentId) return true;
    return false;
}

// Line 1 of a brain's own transcript is its dispatch prompt: that prompt as
// text, or null when it cannot be read — no path, no file yet (a fresh
// dispatch: Claude Code writes the transcript after this hook returns, as it
// does the meta file, docs/90-agent/reports/2026-09-28-spawndepth-timing.md),
// bad JSON.
function promptOfAgent(payload) {
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
        process.stderr.write('fankeel brief: transcript of ' + payload.agent_id + ' unreadable: ' + e.message + '\n');
        return null;
    }
    try {
        const content = JSON.parse(line).message.content;
        return typeof content === 'string' ? content : (Array.isArray(content) ? content.map((p) => (p && p.text) || '').join('\n') : '');
    } catch (e) {
        process.stderr.write('fankeel brief: line 1 of transcript of ' + payload.agent_id + ' is not readable JSON: ' + e.message + '\n');
        return null;
    }
}

// await-7: the stage a brain was sent for is its prompt's first word — the
// controller dispatches it with the stage's name (`controlRules` in
// lib/stages.js), `build group <n>` and `build close` included. SubagentStart
// fires again on every SendMessage to a running or resumed agent, so a brain
// that handed its report back can start again after the task has moved on:
// on 2026-10-02/03 a build brain woke at audit and was marked audit's agent.
// Null when the first word names no stage.
function stageOfPrompt(text) {
    const first = /^\s*([a-z]+)\b/i.exec(String(text || '').split(/\r?\n/, 1)[0]);
    const word = first ? first[1].toLowerCase() : '';
    return NAMES.includes(word) ? word : null;
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
    if (mine.stage && baseAgent(payload.agent_type) === 'fankeel-brain' && !nestedBrain(payload)) {
        const prompt = promptOfAgent(payload);
        // A brain sent for another stage is a late wake: no mark, and no brief,
        // since it already holds the one it started with.
        const sentFor = stageOfPrompt(prompt);
        if (sentFor && sentFor !== mine.stage) return;
        try {
            let sent = mine.stage === 'build' ? caseOfPrompt(prompt) : null;
            // build-4: a fresh brain's prompt is rarely on disk yet, so the case
            // hooks/guard.js noted off the controller's Agent call is taken
            // instead; a prompt that could be read takes its own note, and one
            // that names no case takes none (the oldest is another brain's).
            if (mine.stage === 'build' && (prompt == null || sent)) {
                const noted = registry.takeDispatch(root, payload.session_id, sent);
                if (!sent) sent = noted;
            }
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
