'use strict';

// The prefix every Agent/Task description opens with — `<alias>[ <version>] ·
// <effort>` — computed here so the model never writes it. The version is read
// off a real `message.model` id, never a table: session 7a23b26a's titles said
// "sonnet 5" on 2026-09-29, the day the `sonnet` alias moved to
// claude-sonnet-5-5 (design docs/90-agent/plans/2026-09-29-agent-title-design.md).

const fs = require('node:fs');
const path = require('node:path');
const { frontmatter } = require('./docs.js');
const { readTail } = require('./context.js');

const MODEL_ID = /claude-([a-z]+)-(\d{1,2})(?:-(\d{1,2}))?(?!\d)/;
const PREFIX = /^[a-z]+(?: \d+(?:\.\d+)?)? · [a-z]+: /;
const TAIL = 256 * 1024;
// At most this many subagent transcripts are opened, newest first: the hook
// runs under a 5 s timeout and one project holds thousands of them.
const SCAN_CAP = 50;

function parseModel(id) {
    const m = MODEL_ID.exec(String(id || ''));
    return m ? { alias: m[1], version: m[2] + (m[3] ? '.' + m[3] : '') } : null;
}

// The newest assistant `message.model` in a transcript's tail that parses, of
// family `alias` when one is given.
function lastModel(file, alias) {
    const text = readTail(file, TAIL);
    if (!text) return null;
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].trim()) continue;
        let e;
        try {
            e = JSON.parse(lines[i]);
        } catch (err) {
            continue;
        }
        const parsed = e && e.type === 'assistant' && e.message ? parseModel(e.message.model) : null;
        if (parsed && (!alias || parsed.alias === alias)) return parsed;
    }
    return null;
}

// Every `<session>/subagents/agent-*.jsonl` under the project's transcript
// directory, newest first.
function subagentFiles(projectsDir) {
    const out = [];
    let sessions;
    try {
        sessions = fs.readdirSync(projectsDir);
    } catch (e) {
        return out;
    }
    for (const s of sessions) {
        const sub = path.join(projectsDir, s, 'subagents');
        let names;
        try {
            names = fs.readdirSync(sub);
        } catch (e) {
            continue;
        }
        for (const n of names) {
            if (!/^agent-[0-9a-f]+\.jsonl$/.test(n)) continue;
            const file = path.join(sub, n);
            try {
                out.push({ file, at: fs.statSync(file).mtimeMs });
            } catch (e) { /* gone between the listing and the stat */ }
        }
    }
    return out.sort((a, b) => b.at - a.at).map((f) => f.file);
}

function versionFor(alias, transcriptPath) {
    if (typeof transcriptPath !== 'string' || !transcriptPath) return null;
    for (const file of subagentFiles(path.dirname(transcriptPath)).slice(0, SCAN_CAP)) {
        const hit = lastModel(file, alias);
        if (hit) return hit.version;
    }
    return null;
}

// `fankeel:<name>` is this plugin's own file; another plugin's is not ours to
// find; a bare name is the project's `.claude/agents/`, then the user's.
function agentFileOf(type, pluginRoot, projectDir, configDir) {
    const t = String(type || '');
    if (!t) return null;
    if (t.startsWith('fankeel:')) return path.join(pluginRoot, 'agents', t.slice('fankeel:'.length) + '.md');
    if (t.includes(':')) return null;
    for (const dir of [projectDir && path.join(projectDir, '.claude', 'agents'), configDir && path.join(configDir, 'agents')]) {
        if (!dir) continue;
        const file = path.join(dir, t + '.md');
        if (fs.existsSync(file)) return file;
    }
    return null;
}

function readAgent(file) {
    if (!file) return {};
    try {
        return frontmatter(fs.readFileSync(file, 'utf8')) || {};
    } catch (e) {
        return {};
    }
}

function prefixFor({ toolInput, pluginRoot, projectDir, configDir, transcriptPath, env }) {
    const input = toolInput || {};
    const fm = readAgent(agentFileOf(input.subagent_type, pluginRoot, projectDir, configDir));
    const effort = fm.effort || 'inherit';
    const named = [input.model, fm.model, env && env.CLAUDE_CODE_SUBAGENT_MODEL]
        .find((m) => typeof m === 'string' && m && m !== 'inherit');
    if (!named) {
        const main = typeof transcriptPath === 'string' ? lastModel(transcriptPath, null) : null;
        return (main ? main.alias + ' ' + main.version : 'inherit') + ' · ' + effort;
    }
    const full = parseModel(named);
    if (full) return full.alias + ' ' + full.version + ' · ' + effort;
    const version = versionFor(named, transcriptPath);
    return named + (version ? ' ' + version : '') + ' · ' + effort;
}

function retitle(description, prefix) {
    return prefix + ': ' + String(description || '').replace(PREFIX, '');
}

module.exports = { parseModel, prefixFor, retitle };
