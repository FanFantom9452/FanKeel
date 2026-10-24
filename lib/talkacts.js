'use strict';
// lib/talkacts.js — what Claude did between its words, for the station's
// 對話 tab: each tool call as a name and a one-line brief, and each Agent
// dispatch with what it was, which file holds its transcript and whether it
// is still running. `turnsOf(entries, { acts: true })` in lib/conversation.js
// collects them; the talk route links each dispatch to its file
// (`linkAgents`) and serves one subagent's own transcript (`agentView`).
//
// A dispatch is tied to its transcript the two ways lib/usage.js
// `dispatchesOf` ties them: the tool result's `toolUseResult.agentId`, or —
// while a foreground agent is still running and has no result yet — the
// `toolUseId` in `subagents/agent-<id>.meta.json`. A background agent's tool
// result is only its launch (`status: 'async_launched'`); it is finished when
// the task-notification naming its tool_use arrives.
const fs = require('node:fs');
const path = require('node:path');
const { readObject } = require('./json.js');
const { stepOf } = require('./phone.js');

const AGENT_TOOLS = new Set(['Agent', 'Task']);
const BRIEF_MAX = 80;
const RESULT_CAP = 2000;
const META_FILE = /^agent-([0-9a-f]+)\.meta\.json$/;
const NOTE_ID = /<task-notification>[\s\S]*?<tool-use-id>([^<]+)<\/tool-use-id>/;

function oneLine(s) {
    const line = String(s == null ? '' : s).split(/\r?\n/).map((x) => x.trim()).find(Boolean) || '';
    return line.length > BRIEF_MAX ? line.slice(0, BRIEF_MAX - 1) + '…' : line;
}

// The phone's label for a call (lib/phone.js `stepOf`); where that is only
// the tool's own name, the call's first string field instead, or nothing.
function briefOf(name, input) {
    const o = input && typeof input === 'object' ? input : {};
    const label = stepOf(name, o, null).label;
    if (label && label !== String(name || '')) return oneLine(label);
    for (const k of Object.keys(o)) if (typeof o[k] === 'string' && o[k].trim()) return oneLine(o[k]);
    return '';
}

function agentOf(block) {
    const input = block && block.input && typeof block.input === 'object' ? block.input : {};
    return {
        id: block && typeof block.id === 'string' ? block.id : null,
        description: typeof input.description === 'string' ? input.description : '',
        agentType: typeof input.subagent_type === 'string' ? input.subagent_type : null,
        model: typeof input.model === 'string' ? input.model : null,
        background: input.run_in_background === true,
        state: 'running',
        agentId: null,
    };
}

function noteIdOf(text) {
    const m = NOTE_ID.exec(String(text == null ? '' : text));
    return m ? m[1].trim() : null;
}

// Each dispatch's state from what came back: an error result is `failed`, a
// foreground result `finished`, a background launch `finished` once its
// notification is in `notes`; anything else is still `running`.
function settle(turns, results, notes) {
    for (const t of turns) {
        if (t.kind !== 'act') continue;
        for (const a of t.agents) {
            const r = a.id ? results.get(a.id) : null;
            const meta = r && r.meta ? r.meta : {};
            if (typeof meta.agentId === 'string' && meta.agentId) a.agentId = meta.agentId;
            const later = meta.status === 'async_launched' || meta.isAsync === true;
            if (later) a.background = true;
            if (r && r.error) a.state = 'failed';
            else if (r && !later) a.state = 'finished';
            else if (later && notes.has(a.id)) a.state = 'finished';
        }
    }
    return turns;
}

function metaIds(sessionDir) {
    const out = new Map();
    const sub = path.join(sessionDir, 'subagents');
    let names;
    try {
        names = fs.readdirSync(sub);
    } catch (e) {
        return out;
    }
    for (const name of names) {
        const m = META_FILE.exec(name);
        if (!m) continue;
        const meta = readObject(path.join(sub, name));
        if (meta && typeof meta.toolUseId === 'string') out.set(meta.toolUseId, m[1]);
    }
    return out;
}

// Ties each dispatch with no agentId yet to its file through meta.json, and
// ends a linked `running` dispatch that `running` (lib/usage.js
// `runningAgents`) no longer lists: it answered, or went quiet past
// AGENT_QUIET_MS with its session.
function linkAgents(turns, sessionDir, running) {
    const all = (turns || []).filter((t) => t.kind === 'act').flatMap((t) => t.agents);
    if (!all.length || typeof sessionDir !== 'string' || !sessionDir) return turns;
    const ids = all.some((a) => !a.agentId) ? metaIds(sessionDir) : new Map();
    const now = new Set((running || []).map((r) => r.id));
    for (const a of all) {
        if (!a.agentId && a.id && ids.has(a.id)) a.agentId = ids.get(a.id);
        if (a.state === 'running' && a.agentId && !now.has(a.agentId)) a.state = 'finished';
    }
    return turns;
}

// One subagent's transcript for the station: `read` is
// `turnsOf(entries, { tools: true, sidechain: true })`.
function agentView(read, info) {
    const i = info || {};
    const turns = (read && read.turns ? read.turns : []).map((t) => {
        if (t.kind === 'tool') {
            let input = {};
            try { input = JSON.parse(t.text); } catch (e) { /* kept as {} */ }
            return { kind: 'tool', at: t.at, id: t.id, name: t.name, brief: briefOf(t.name, input) };
        }
        if (t.kind === 'result' && t.text.length > RESULT_CAP) return Object.assign({}, t, { text: t.text.slice(0, RESULT_CAP), cut: true });
        return t;
    });
    const said = turns.filter((t) => t.kind === 'claude');
    const state = i.running ? 'running' : 'finished';
    return {
        id: i.id || null,
        agentType: typeof i.agentType === 'string' ? i.agentType : null,
        description: typeof i.description === 'string' ? i.description : '',
        model: typeof i.model === 'string' ? i.model : null,
        state,
        turns,
        report: state === 'finished' && said.length ? said[said.length - 1].text : null,
    };
}

module.exports = { briefOf, agentOf, noteIdOf, settle, linkAgents, agentView, AGENT_TOOLS, RESULT_CAP };
