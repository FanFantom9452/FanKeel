'use strict';

// station-6: the override files `task.js profile set agent.<name>.*` writes.
// A plugin agent is dispatched as `fankeel:<name>` and pins its own model and
// effort; a file of the same name under a project's `.claude/agents/` (or the
// config directory's `agents/`) answers only the bare `<name>` — spike
// 2026-09-29 in docs/90-agent/todo/station-6.md. So the override is the
// plugin's own file with two lines changed, marked `generated_by` so nothing
// here ever overwrites or deletes a file somebody wrote by hand.

const fs = require('node:fs');
const path = require('node:path');
const { readObject } = require('./json.js');

const PLUGIN_ROOT = path.join(__dirname, '..');
const AGENT_KEY = /^agent\.([a-z][a-z0-9-]*)\.(model|effort)$/;
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

function agentKey(key) {
    const m = AGENT_KEY.exec(String(key || ''));
    return m ? { name: m[1], field: m[2] } : null;
}

function agentNames(pluginRoot) {
    try {
        return fs.readdirSync(path.join(pluginRoot, 'agents'))
            .filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).sort();
    } catch (e) {
        return [];
    }
}

function readText(file) {
    try { return fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
}

function readJson(file) {
    return readObject(file) || {};
}

// The version after `generated_by: fankeel`, or null for a file with no mark.
function generatedVersion(text) {
    const m = FRONT.exec(String(text || ''));
    const g = m && /^generated_by:\s*fankeel\s+(\S+)\s*$/m.exec(m[1]);
    return g ? g[1] : null;
}

// The plugin's file with `model:` and `effort:` replaced where given, and the mark added.
function render(source, { model, effort, version }) {
    const m = FRONT.exec(source);
    if (!m) return null;
    const head = m[1].split(/\r?\n/).filter((l) => !/^generated_by:/.test(l));
    const put = (key, value) => {
        if (!value) return;
        const i = head.findIndex((l) => l.startsWith(key + ':'));
        if (i === -1) head.push(key + ': ' + value);
        else head[i] = key + ': ' + value;
    };
    put('model', model);
    put('effort', effort);
    head.push('generated_by: fankeel ' + version);
    return '---\n' + head.join('\n') + '\n---\n' + source.slice(m[0].length);
}

// Brings one agent's override in line with one profile file: written while
// either key is set, removed once neither is, and a file with no mark left alone.
function syncAgent({ pluginRoot, profileFile, agentsDir, name, version }) {
    const values = readJson(profileFile);
    const model = values['agent.' + name + '.model'];
    const effort = values['agent.' + name + '.effort'];
    const file = path.join(agentsDir, name + '.md');
    const existing = readText(file);
    if (existing !== null && generatedVersion(existing) === null) return { state: 'unmarked', file };
    if (!model && !effort) {
        if (existing === null) return { state: 'absent', file };
        fs.unlinkSync(file);
        return { state: 'removed', file };
    }
    const source = readText(path.join(pluginRoot, 'agents', name + '.md'));
    const text = source === null ? null : render(source, { model, effort, version });
    if (text === null) return { state: 'no-source', file };
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(file, text);
    return { state: 'written', file };
}

function syncLine(result) {
    const f = result.file;
    if (result.state === 'written') return 'agent file: written → ' + f;
    if (result.state === 'removed') return 'agent file: removed → ' + f;
    if (result.state === 'unmarked') return 'agent file: left alone — ' + f + ' has no generated_by line, so it is somebody\'s own';
    if (result.state === 'no-source') return 'agent file: not written — the plugin has no agents/' + path.basename(f);
    return 'agent file: none to remove';
}

// Every marked override a profile file still names, rewritten when its mark is
// another plugin version. Returns the files rewritten.
function refresh({ pluginRoot, version, targets }) {
    const out = [];
    if (!version) return out;
    for (const t of targets || []) {
        if (!t || !t.profileFile || !t.agentsDir) continue;
        const names = new Set(Object.keys(readJson(t.profileFile)).map(agentKey).filter(Boolean).map((k) => k.name));
        for (const name of names) {
            const file = path.join(t.agentsDir, name + '.md');
            const v = generatedVersion(readText(file));
            if (v === null || v === version) continue;
            if (syncAgent({ pluginRoot, profileFile: t.profileFile, agentsDir: t.agentsDir, name, version }).state === 'written') out.push(file);
        }
    }
    return out;
}

// A per-dispatch effort variant: the plugin's agent file under
// `<name>-<effort>`, its `name:` and `effort:` lines changed. Shipped by
// scripts/variants.js, not generated at dispatch: a plugin agent loads at
// startup, and a file written mid-session was never measured to resolve
// (docs/90-agent/todo/station-6.md wrote every override before the session).
// `medium` is the base file itself.
const VARIANT_EFFORTS = ['high', 'xhigh'];

function renderVariant(source, effort) {
    const m = FRONT.exec(String(source || ''));
    if (!m || !VARIANT_EFFORTS.includes(effort)) return null;
    const head = m[1].split(/\r?\n/).map((l) => (/^name:/.test(l) ? l.trimEnd() + '-' + effort : l));
    const at = head.findIndex((l) => /^effort:/.test(l));
    if (at === -1) head.push('effort: ' + effort);
    else head[at] = 'effort: ' + effort;
    return '---\n' + head.join('\n') + '\n---\n' + source.slice(m[0].length);
}

// Every check that compares an agent type reads a variant as its base: a
// `fankeel-reviewer-high` is as read-only as the reviewer, a
// `fankeel-brain-xhigh` gets the brain's brief and guards.
function baseAgent(type) {
    return String(type || '').replace(/^fankeel:/, '').replace(/-(high|xhigh)$/, '');
}

module.exports = { PLUGIN_ROOT, EFFORTS, VARIANT_EFFORTS, agentKey, agentNames, generatedVersion, syncAgent, syncLine, refresh, renderVariant, baseAgent };
