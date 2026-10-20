'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const bundle = require('../lib/bundle.js');
const { turnsOf } = require('../lib/conversation.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'conversation.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const ENTRIES = [
    { type: 'user', timestamp: '2026-10-20T01:00:00Z', message: { role: 'user', content: 'list it' } },
    { type: 'assistant', timestamp: '2026-10-20T01:00:01Z', message: { id: 'm1', role: 'assistant', content: [{ type: 'text', text: 'ok' }, { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } }] } },
    { type: 'user', timestamp: '2026-10-20T01:00:02Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'a.txt' }] } },
];

function seedBundle() {
    const cfg = tmp('fankeel-convb-');
    const dir = path.join(cfg, 'projects', 'p');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, A + '.jsonl'), ENTRIES.map((e) => JSON.stringify(e)).join('\n') + '\n');
    const file = path.join(cfg, 'b.jsonl.gz');
    fs.writeFileSync(file, bundle.pack([A], bundle.filesOf(cfg, A), [], {}));
    return file;
}

test('turnsOf keeps tool calls and results only when asked', () => {
    assert.deepEqual(turnsOf(ENTRIES).turns.map((t) => t.kind), ['user', 'claude']);
    const kinds = turnsOf(ENTRIES, { tools: true }).turns.map((t) => t.kind);
    assert.deepEqual(kinds, ['user', 'claude', 'tool', 'result']);
    const tool = turnsOf(ENTRIES, { tools: true }).turns[2];
    assert.equal(tool.name, 'Bash');
    assert.equal(tool.text, '{"command":"ls"}');
});

test('--bundle --tools gives as many tool turns as the source has tool_use blocks', () => {
    const out = execFileSync(process.execPath, [SCRIPT, '--bundle', seedBundle(), '--tools', '--format', 'jsonl'], { encoding: 'utf8' });
    const turns = out.trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(turns.filter((t) => t.kind === 'tool').length, 1);
    assert.equal(turns.filter((t) => t.kind === 'result')[0].text, 'a.txt');
});

test('--bundle --list names each part', () => {
    const out = execFileSync(process.execPath, [SCRIPT, '--bundle', seedBundle(), '--list'], { encoding: 'utf8' });
    assert.match(out, new RegExp('^' + A + '\\.jsonl  3 lines$', 'm'));
});

test('markdown shows a tool call and its result', () => {
    const out = execFileSync(process.execPath, [SCRIPT, '--bundle', seedBundle(), '--tools'], { encoding: 'utf8' });
    assert.match(out, /### Tool · Bash/);
    assert.match(out, /<details><summary>Result<\/summary>/);
});
