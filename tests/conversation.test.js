'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const conversation = require('../lib/conversation.js');
const tmp = require('./tmp.js');

const T = (m) => '2026-10-01T10:' + String(m).padStart(2, '0') + ':00.000Z';
const user = (content, m, extra) => Object.assign({ type: 'user', timestamp: T(m), message: { role: 'user', content } }, extra || {});
const claude = (id, blocks, m, extra) => Object.assign({ type: 'assistant', timestamp: T(m), message: { id, model: 'claude-opus-5-5', content: blocks } }, extra || {});
const text = (t) => ({ type: 'text', text: t });
const queued = (mode, prompt, m) => ({ type: 'attachment', timestamp: T(m), attachment: { type: 'queued_command', commandMode: mode, prompt } });

// One session in the shapes Claude Code writes, compacted once at 10:10: a
// reply split across lines by content block, a tool call and its result, a
// skill's system text, a background task's notification, hook output, a
// prompt typed while Claude was busy, a subagent's hand-back, /compact, the
// summary and the local-command lines around it, an interruption, a reply
// line written twice, a synthetic reply and a subagent's own line.
const ENTRIES = [
    user('第一個問題', 1),
    claude('msg_1', [{ type: 'thinking', thinking: '', signature: 'x' }], 2),
    claude('msg_1', [text('第一個回答')], 2),
    claude('msg_1', [{ type: 'tool_use', id: 'tu_1', name: 'Read', input: { file_path: 'a.js' } }], 2),
    user([{ type: 'tool_result', tool_use_id: 'tu_1', content: 'file body' }], 3),
    claude('msg_2', [text('讀完了。')], 4),
    user('Base directory for this skill: skills/x', 5, { isMeta: true }),
    user('<task-notification>\n<tool-use-id>tu_9</tool-use-id>\n</task-notification>', 6),
    user('background job finished', 6, { origin: { kind: 'task-notification' } }),
    { type: 'attachment', timestamp: T(7), attachment: { type: 'hook_additional_context', content: ['hook text'] } },
    queued('prompt', '順便看一下測試', 7),
    queued('prompt', '<agent-message from="a1">\n[Subagent hand-back] report', 8),
    queued('task-notification', '<task-notification>x</task-notification>', 8),
    user('<command-name>/compact</command-name>\n            <command-message>compact</command-message>\n            <command-args></command-args>', 9),
    { type: 'system', subtype: 'compact_boundary', timestamp: T(10), compactMetadata: { trigger: 'manual', preTokens: 349064 } },
    user('This session is being continued from a previous conversation. Summary: 前情', 10, { isCompactSummary: true }),
    user('<local-command-caveat>The command below was run directly</local-command-caveat>', 10, { isMeta: true }),
    user('<local-command-stdout>Compacted</local-command-stdout>', 10),
    user([text('[Request interrupted by user]')], 11),
    user('壓縮後的問題', 12),
    claude('msg_3', [text('壓縮後的回答')], 13),
    claude('msg_3', [text('壓縮後的回答')], 13),
    { type: 'assistant', timestamp: T(14), message: { id: 'msg_4', model: '<synthetic>', content: [text('No response requested.')] } },
    claude('msg_s', [text('子代理的話')], 15, { isSidechain: true }),
];

test('turnsOf keeps what the user typed and what Claude wrote, and marks the compaction', () => {
    const { turns, skipped } = conversation.turnsOf(ENTRIES);
    assert.deepEqual(turns.map((t) => [t.kind, t.text]), [
        ['user', '第一個問題'],
        ['claude', '第一個回答'],
        ['claude', '讀完了。'],
        ['user', '順便看一下測試'],
        ['user', '/compact'],
        ['compact', ''],
        ['summary', 'This session is being continued from a previous conversation. Summary: 前情'],
        ['interrupt', '[Request interrupted by user]'],
        ['user', '壓縮後的問題'],
        ['claude', '壓縮後的回答'],
    ]);
    const c = turns.find((t) => t.kind === 'compact');
    assert.equal(c.at, T(10));
    assert.equal(c.trigger, 'manual');
    assert.equal(c.preTokens, 349064);
    assert.equal(turns[0].at, T(1));
    assert.deepEqual(skipped, { meta: 2, tool: 1, notification: 3, agent: 1, local: 1, synthetic: 1, sidechain: 1 });
});

test('one reply split across lines is one turn, and a slash command keeps its arguments', () => {
    const { turns } = conversation.turnsOf([
        user('<command-message>fankeel:fankeel</command-message>\n<command-name>/fankeel:fankeel</command-name>\n<command-args>plan</command-args>', 1),
        claude('msg_1', [text('第一段')], 2),
        claude('msg_1', [{ type: 'tool_use', id: 'tu_1', name: 'Bash', input: {} }], 2),
        claude('msg_1', [text('第二段')], 2),
    ]);
    assert.deepEqual(turns.map((t) => [t.kind, t.text]), [
        ['user', '/fankeel:fankeel plan'],
        ['claude', '第一段\n\n第二段'],
    ]);
});

test('markdownOf puts every turn under its own heading, the compaction between them', () => {
    const md = conversation.markdownOf(conversation.turnsOf(ENTRIES), { session: 'abc', file: 'x.jsonl' });
    assert.match(md, /^# Conversation · session abc$/m);
    assert.match(md, /^compactions: 1 · user turns: 4 · Claude turns: 3$/m);
    assert.match(md, /^left out: meta 2, tool 1, notification 3, agent 1, local 1, synthetic 1, sidechain 1$/m);
    const order = [
        '## User · 2026-10-01 10:01 UTC',
        '## Claude · 2026-10-01 10:02 UTC',
        '## Compaction 1 · 2026-10-01 10:10 UTC · manual, 349,064 tokens before',
        '<details><summary>Compaction summary</summary>',
        '*[Request interrupted by user]*',
        '## User · 2026-10-01 10:12 UTC',
        '壓縮後的回答',
    ];
    let from = 0;
    for (const h of order) {
        const i = md.indexOf(h, from);
        assert.ok(i >= 0, h + ' missing, or out of order');
        from = i + h.length;
    }
});

test('jsonlOf writes one turn a line', () => {
    const { turns } = conversation.turnsOf(ENTRIES);
    const lines = conversation.jsonlOf(turns).trimEnd().split('\n');
    assert.deepEqual(lines.map((l) => JSON.parse(l)), turns);
});

test('the CLI finds the session under projects, writes either format, and refuses what it cannot do', () => {
    const cfg = tmp('fankeel-conversation-');
    const dir = path.join(cfg, 'projects', 'F--proj');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 's1.jsonl'), ENTRIES.map((e) => JSON.stringify(e) + '\n').join(''));
    const cli = path.join(__dirname, '..', 'scripts', 'conversation.js');
    const run = (args) => spawnSync(process.execPath, [cli].concat(args), { encoding: 'utf8' });

    const md = run(['--session', 's1', '--config-dir', cfg]);
    assert.equal(md.status, 0, md.stderr);
    assert.match(md.stdout, /^# Conversation · session s1$/m);
    assert.match(md.stdout, /^## Compaction 1 · /m);
    assert.match(md.stdout, /^left out: .*unparsed 0$/m);

    const out = path.join(cfg, 'out.jsonl');
    const jl = run(['--session', 's1', '--config-dir', cfg, '--format', 'jsonl', '--out', out]);
    assert.equal(jl.status, 0, jl.stderr);
    assert.equal(fs.readFileSync(out, 'utf8').trimEnd().split('\n').length, 10);
    assert.match(jl.stdout, /^wrote 10 turns to /m);

    const none = run(['--session', 'nope', '--config-dir', cfg]);
    assert.equal(none.status, 1);
    assert.match(none.stderr, /no transcript for session nope/);

    const bad = run(['--session', 's1', '--config-dir', cfg, '--format', 'html']);
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /--format is md or jsonl/);
});

test('the CLI says so when a transcript it found cannot be read', () => {
    const cfg = tmp('fankeel-conversation-');
    const dir = path.join(cfg, 'projects', 'F--proj');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 's2.jsonl'), '{}\n');
    // A file that stats fine but fails to read (a lock, a permission) cannot be
    // made the same way on Windows and Linux, so the read is made to throw.
    const preload = path.join(cfg, 'unreadable.js');
    fs.writeFileSync(preload, "const fs = require('node:fs'); const read = fs.readFileSync;\n" +
        "fs.readFileSync = (f, ...a) => { if (String(f).endsWith('s2.jsonl')) throw new Error('EACCES'); return read(f, ...a); };\n");
    const cli = path.join(__dirname, '..', 'scripts', 'conversation.js');
    const run = spawnSync(process.execPath, ['--require', preload, cli, '--session', 's2', '--config-dir', cfg], { encoding: 'utf8' });
    assert.equal(run.status, 1, run.stderr);
    assert.match(run.stderr, /conversation: cannot read /);
    assert.equal(run.stdout, '');
});

test('the CLI counts transcript lines that do not parse on the left out line', () => {
    const cfg = tmp('fankeel-conversation-');
    const dir = path.join(cfg, 'projects', 'F--proj');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 's3.jsonl'), [JSON.stringify(user('hello', 1)), 'not json', JSON.stringify(claude('m1', [text('hi')], 2)), '{"type":"user"', ''].join('\n'));
    const cli = path.join(__dirname, '..', 'scripts', 'conversation.js');
    const run = spawnSync(process.execPath, [cli, '--session', 's3', '--config-dir', cfg], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^left out: .*unparsed 2$/m);
});
