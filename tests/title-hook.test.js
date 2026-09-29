'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tmp = require('./tmp.js');
const { parseModel } = require('../lib/title.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'title.js');
function fire(payload, cwd, subagentModel) {
    const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload), cwd, encoding: 'utf8',
        env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(cwd, 'config'), CLAUDE_CODE_SUBAGENT_MODEL: subagentModel || '' } });
    assert.equal(r.status, 0);
    return r.stdout ? JSON.parse(r.stdout) : null;
}
function agentFile(dir, name, model) {
    const file = path.join(dir, '.claude', 'agents', name + '.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '---\nname: ' + name + '\ndescription: probe\n' + (model ? 'model: ' + model + '\n' : '') + '---\nbody\n');
}
function fixture() {
    const dir = tmp('title-hook-');
    const transcript = path.join(dir, 'projects', 'p', 'main.jsonl');
    fs.mkdirSync(path.dirname(transcript), { recursive: true });
    fs.writeFileSync(transcript, JSON.stringify({ type: 'assistant', message: { model: 'claude-opus-5-5', content: [] } }) + '\n');
    return { dir, transcript };
}

test('an Agent call gets its description prefixed through updatedInput, with no permission decision', () => {
    const f = fixture();
    const out = fire({ tool_name: 'Agent', cwd: f.dir, transcript_path: f.transcript,
        tool_input: { subagent_type: 'fankeel:fankeel-reader', description: 'sonnet 5 · medium: read the map', prompt: 'p' } }, f.dir);
    const h = out.hookSpecificOutput;
    assert.equal(h.hookEventName, 'PreToolUse');
    assert.equal(h.permissionDecision, undefined);
    assert.equal(h.updatedInput.prompt, 'p');
    assert.equal(h.updatedInput.description, 'sonnet · medium: read the map');
});

test('a general-purpose call inherits the main transcript model', () => {
    const f = fixture();
    const out = fire({ tool_name: 'Task', cwd: f.dir, transcript_path: f.transcript,
        tool_input: { subagent_type: 'general-purpose', description: 'look', prompt: 'p' } }, f.dir);
    assert.equal(out.hookSpecificOutput.updatedInput.description, 'opus 5.5 · inherit: look');
});

test('any other tool, or bad input, writes nothing', () => {
    const f = fixture();
    assert.equal(fire({ tool_name: 'Bash', tool_input: { command: 'ls' } }, f.dir), null);
    const r = spawnSync(process.execPath, [HOOK], { input: 'not json', cwd: f.dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
});

test('the manifest runs hooks/title.js on Agent|Task', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude-plugin', 'plugin.json'), 'utf8'));
    const entries = manifest.hooks.PreToolUse.filter((e) => e.matcher === 'Agent|Task');
    assert.ok(entries.some((e) => e.hooks.some((h) => /hooks\/title\.js/.test(h.command))));
});

test('a foreign plugin agent type writes nothing and leaves the description', () => {
    const f = fixture();
    const out = fire({ tool_name: 'Agent', cwd: f.dir, transcript_path: f.transcript,
        tool_input: { subagent_type: 'other-plugin:reviewer', description: 'look', prompt: 'p' } }, f.dir);
    assert.equal(out, null);
});

test('CLAUDE_CODE_SUBAGENT_MODEL alone names the model: it ranks above the session model', () => {
    const f = fixture();
    agentFile(f.dir, 'plain');
    const haiku = parseModel('claude-haiku-4-5');
    assert.ok(haiku, 'parseModel must know claude-haiku-4-5');
    const out = fire({ tool_name: 'Agent', cwd: f.dir, transcript_path: f.transcript,
        tool_input: { subagent_type: 'plain', description: 'look', prompt: 'p' } }, f.dir, 'claude-haiku-4-5');
    assert.equal(out.hookSpecificOutput.updatedInput.description, haiku.alias + ' ' + haiku.version + ' · inherit: look');
});

test('the agent file model: ranks above CLAUDE_CODE_SUBAGENT_MODEL', () => {
    const f = fixture();
    agentFile(f.dir, 'pinned', 'claude-sonnet-4-5');
    const sonnet = parseModel('claude-sonnet-4-5');
    assert.ok(sonnet, 'parseModel must know claude-sonnet-4-5');
    const out = fire({ tool_name: 'Agent', cwd: f.dir, transcript_path: f.transcript,
        tool_input: { subagent_type: 'pinned', description: 'look', prompt: 'p' } }, f.dir, 'claude-haiku-4-5');
    assert.equal(out.hookSpecificOutput.updatedInput.description, sonnet.alias + ' ' + sonnet.version + ' · inherit: look');
});
