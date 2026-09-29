'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'title.js');
function fire(payload, cwd) {
    const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload), cwd, encoding: 'utf8',
        env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(cwd, 'config'), CLAUDE_CODE_SUBAGENT_MODEL: '' } });
    assert.equal(r.status, 0);
    return r.stdout ? JSON.parse(r.stdout) : null;
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
