'use strict';

// station-6: with a generated override on disk, `fankeel:<name>` is sent out
// as `<name>`, the only spelling Claude Code resolves to that file, and the
// title is read from the override. A same-name file with no mark is not ours.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tmp = require('./tmp.js');
const { overrideFor } = require('../lib/title.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'title.js');
const MARKED = '---\nname: fankeel-reader\nmodel: haiku\neffort: medium\ngenerated_by: fankeel 0.84.0\n---\nbody\n';
const HAND = '---\nname: fankeel-reader\nmodel: haiku\neffort: medium\n---\nbody\n';

function fire(payload, cwd) {
    const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload), cwd, encoding: 'utf8',
        env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(cwd, 'config'), CLAUDE_CODE_SUBAGENT_MODEL: '' } });
    assert.equal(r.status, 0);
    return r.stdout ? JSON.parse(r.stdout) : null;
}

function fixture(agentText) {
    const dir = tmp('title-override-');
    const transcript = path.join(dir, 'projects', 'p', 'main.jsonl');
    fs.mkdirSync(path.dirname(transcript), { recursive: true });
    fs.writeFileSync(transcript, JSON.stringify({ type: 'assistant', message: { model: 'claude-opus-5-5', content: [] } }) + '\n');
    if (agentText) {
        const file = path.join(dir, '.claude', 'agents', 'fankeel-reader.md');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, agentText);
    }
    return { dir, transcript };
}

const dispatch = (f, description) => ({ tool_name: 'Agent', cwd: f.dir, transcript_path: f.transcript,
    tool_input: { subagent_type: 'fankeel:fankeel-reader', description, prompt: 'p' } });

test('with a generated override, fankeel:fankeel-reader goes out as fankeel-reader, titled from the override', () => {
    const f = fixture(MARKED);
    const h = fire(dispatch(f, 'read the map'), f.dir).hookSpecificOutput;
    assert.equal(h.permissionDecision, undefined);
    assert.equal(h.updatedInput.subagent_type, 'fankeel-reader');
    assert.equal(h.updatedInput.description, 'haiku · medium: read the map');
    assert.equal(h.updatedInput.prompt, 'p');
});

test('the rewrite goes out even when the description already carries the right prefix', () => {
    const f = fixture(MARKED);
    assert.equal(fire(dispatch(f, 'haiku · medium: read the map'), f.dir).hookSpecificOutput.updatedInput.subagent_type, 'fankeel-reader');
});

test('with no override the name is left alone and the plugin file titles it', () => {
    const f = fixture(null);
    const h = fire(dispatch(f, 'read the map'), f.dir).hookSpecificOutput;
    assert.equal(h.updatedInput.subagent_type, 'fankeel:fankeel-reader');
    assert.equal(h.updatedInput.description, 'sonnet · medium: read the map');
});

test('a same-name file with no generated_by line is not taken over', () => {
    const f = fixture(HAND);
    const h = fire(dispatch(f, 'read the map'), f.dir).hookSpecificOutput;
    assert.equal(h.updatedInput.subagent_type, 'fankeel:fankeel-reader');
    assert.equal(h.updatedInput.description, 'sonnet · medium: read the map');
});

test('a user-level generated override counts when the project has none', () => {
    const f = fixture(null);
    const file = path.join(f.dir, 'config', 'agents', 'fankeel-reader.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, MARKED);
    assert.equal(fire(dispatch(f, 'x'), f.dir).hookSpecificOutput.updatedInput.subagent_type, 'fankeel-reader');
});

test('overrideFor answers the bare name only for fankeel:<name> with a marked file', () => {
    const f = fixture(MARKED);
    assert.equal(overrideFor('fankeel:fankeel-reader', f.dir, null), 'fankeel-reader');
    assert.equal(overrideFor('fankeel-reader', f.dir, null), null);
    assert.equal(overrideFor('abcdefghfankeel-reader', f.dir, null), null);
    assert.equal(overrideFor('other:fankeel-reader', f.dir, null), null);
    assert.equal(overrideFor('fankeel:fankeel-reviewer', f.dir, null), null);
});

test('overrideFor answers null, not a throw, for a name that still carries a colon', () => {
    const f = fixture(MARKED);
    assert.equal(overrideFor('fankeel:fankeel:x', f.dir, null), null);
    assert.equal(overrideFor('fankeel:other:x', f.dir, null), null);
});
