'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'leave.js');
const SID = 'aaaaaaaa-1111-4111-8111-111111111111';

function run(payload, claudeDir) {
    return execFileSync(process.execPath, [HOOK], {
        input: JSON.stringify(payload),
        env: { ...process.env, CLAUDE_CONFIG_DIR: claudeDir },
        encoding: 'utf8',
    });
}

function fixture() {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-leave-'));
    const cfg = path.join(base, 'cfg');
    const root = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(root);
    registry.writeSession(root, SID, { task: 'the ramp', stage: 'build', route: ['survey', 'build'], active: true,
        claims: ['a.js'], started: new Date().toISOString(), updated: new Date().toISOString(), configDir: cfg });
    const transcript = path.join(base, 't.jsonl');
    const a = (requestId, model, usage) => JSON.stringify({ type: 'assistant', requestId, message: { model, usage } }) + '\n';
    fs.writeFileSync(transcript, [
        a('r1', 'claude-sonnet-5', { input_tokens: 10, output_tokens: 20 }),
        a('r1', 'claude-sonnet-5', { input_tokens: 10, output_tokens: 20 }),
        a('r2', 'claude-sonnet-5', { input_tokens: 1, output_tokens: 2 }),
    ].join(''));
    const agentDir = path.join(base, 't', 'subagents');
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, 'agent-dddd.jsonl'), JSON.stringify({
        type: 'assistant', isSidechain: true, requestId: 'd1', timestamp: '2026-09-04T02:00:00.000Z',
        message: { model: 'claude-sonnet-5', usage: { input_tokens: 4, output_tokens: 8 } },
    }) + '\n');
    return { cfg, root, transcript };
}

test('records ended, model and usage on its own entry; active stays true; the page is regenerated; stdout is empty', () => {
    const f = fixture();
    const out = run({ session_id: SID, transcript_path: f.transcript, cwd: f.root, reason: 'clear', hook_event_name: 'SessionEnd' }, f.cfg);
    assert.equal(out, '');
    const d = registry.readSession(f.root, SID);
    assert.equal(d.active, true);
    assert.deepEqual(d.claims, ['a.js']);
    assert.equal(d.ended.reason, 'clear');
    assert.match(d.ended.at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(d.model, 'claude-sonnet-5');
    assert.deepEqual(d.usage.models, { 'claude-sonnet-5': { input: 11, output: 22, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } });
    assert.equal(d.usage.requests, 2);
    assert.deepEqual(d.usage.subagents, { agents: 1, requests: 1, wallMs: 0,
        models: { 'claude-sonnet-5': { input: 4, output: 8, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } } });
    assert.ok(fs.readFileSync(path.join(f.cfg, 'fankeel', 'station.html'), 'utf8').includes('the ramp'));
});

test('a session with no entry still regenerates the page, and an unreadable transcript leaves usage absent', () => {
    const f = fixture();
    const other = 'bbbbbbbb-2222-4222-8222-222222222222';
    assert.equal(run({ session_id: other, transcript_path: path.join(f.root, 'missing.jsonl'), cwd: f.root, reason: 'other' }, f.cfg), '');
    assert.equal(registry.readSession(f.root, other), null);
    assert.ok(fs.existsSync(path.join(f.cfg, 'fankeel', 'station.html')));
    assert.equal(run({ session_id: SID, transcript_path: path.join(f.root, 'missing.jsonl'), cwd: f.root, reason: 'logout' }, f.cfg), '');
    const d = registry.readSession(f.root, SID);
    assert.equal(d.ended.reason, 'logout');
    assert.equal('usage' in d, false);
});

test('garbage on stdin exits 0 and writes nothing', () => {
    const f = fixture();
    assert.equal(execFileSync(process.execPath, [HOOK], { input: 'not json', env: { ...process.env, CLAUDE_CONFIG_DIR: f.cfg }, encoding: 'utf8' }), '');
    assert.equal(fs.existsSync(path.join(f.cfg, 'fankeel')), false);
});
