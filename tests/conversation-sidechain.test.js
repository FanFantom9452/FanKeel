'use strict';
// audit-5: a bundle's subagents/ part is one agent's own transcript, and
// every line of it is isSidechain — so conversation.js read it as 0 turns and
// a retro could not see inside a brain. It is read as sidechain now; the main
// part still leaves sidechain lines out unless --sidechain says otherwise.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const bundle = require('../lib/bundle.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'conversation.js');
const A = 'bbbbbbbb-1111-4222-8333-444444444444';
const PART = A + '/subagents/agent-x1.jsonl';
const MAIN = [
    { type: 'user', timestamp: '2026-10-25T01:00:00Z', message: { role: 'user', content: 'go' } },
    { type: 'assistant', timestamp: '2026-10-25T01:00:01Z', message: { id: 'm1', role: 'assistant', content: [{ type: 'text', text: 'sent one agent' }] } },
    { type: 'assistant', isSidechain: true, timestamp: '2026-10-25T01:00:02Z', message: { id: 'm2', role: 'assistant', content: [{ type: 'text', text: 'from inside' }] } },
];
const SIDE = [
    { type: 'user', isSidechain: true, timestamp: '2026-10-25T01:00:03Z', message: { role: 'user', content: 'run gate-check' } },
    { type: 'assistant', isSidechain: true, timestamp: '2026-10-25T01:00:04Z', message: { id: 's1', role: 'assistant',
        content: [{ type: 'text', text: 'checking' }, { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'node scripts/gate-check.js' } }] } },
    { type: 'user', isSidechain: true, timestamp: '2026-10-25T01:00:05Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'gate ok' }] } },
];

function seed() {
    const cfg = tmp('fankeel-convside-');
    const dir = path.join(cfg, 'projects', 'p');
    fs.mkdirSync(path.join(dir, A, 'subagents'), { recursive: true });
    const lines = (list) => list.map((e) => JSON.stringify(e)).join('\n') + '\n';
    fs.writeFileSync(path.join(dir, A + '.jsonl'), lines(MAIN));
    fs.writeFileSync(path.join(dir, A, 'subagents', 'agent-x1.jsonl'), lines(SIDE));
    const file = path.join(cfg, 'b.jsonl.gz');
    fs.writeFileSync(file, bundle.pack([A], bundle.filesOf(cfg, A), [], {}));
    return file;
}
const run = (args) => execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
const turns = (out) => out.trim().split('\n').map((l) => JSON.parse(l));

test('a subagents/ part reads as the agent\'s own turns and tool calls', () => {
    const got = turns(run(['--bundle', seed(), '--part', PART, '--tools', '--format', 'jsonl']));
    assert.deepEqual(got.map((t) => t.kind), ['user', 'claude', 'tool', 'result']);
    assert.equal(got[0].text, 'run gate-check');
    assert.equal(got[2].name, 'Bash');
    assert.equal(got[3].text, 'gate ok');
});

test('the markdown of a subagents/ part leaves no sidechain line out', () => {
    const out = run(['--bundle', seed(), '--part', PART]);
    assert.match(out, /user turns: 1 · Claude turns: 1/);
    assert.match(out, /, sidechain 0,/);
});

test('the main part still leaves its sidechain lines out, and --sidechain reads them', () => {
    const file = seed();
    const plain = run(['--bundle', file]);
    assert.match(plain, /Claude turns: 1\n/);
    assert.match(plain, /, sidechain 1,/);
    const side = run(['--bundle', file, '--sidechain']);
    assert.match(side, /Claude turns: 2\n/);
    assert.match(side, /, sidechain 0,/);
});

test('--help names --sidechain', () => {
    const help = run(['--help']);
    assert.match(help, /--sidechain/);
    assert.match(help, /subagent lines are read in a subagents\//);
    assert.equal(help.split('--bundle reads a bundle').length, 2, 'the --bundle line is there once');
});
