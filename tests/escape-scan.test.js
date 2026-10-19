'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const tmp = require('./tmp.js');
const { common, rareChars, hasCjk } = require('../lib/cjk.js');
const { scan, main } = require('../scripts/escape-scan.js');

const cp = (n) => String.fromCodePoint(n);
const SLIP = cp(0x95C9);   // 闉, written for 閉
const TAKE = cp(0x64C8);   // 擈, written for 撈
const DROP = cp(0x639F);   // 掟, written for 掉
const NAME = cp(0x744B);   // 瑋, a name the user typed

test('the common set is the three level-one sets, and rare is what lies outside it', () => {
    assert.ok(common().size > 7000, 'common set is ' + common().size);
    assert.deepEqual(rareChars('按 X 關閉時怎麼收尾？'), []);
    assert.deepEqual(rareChars('按 X 關' + SLIP + '時，關' + SLIP), [SLIP]);
    assert.deepEqual(rareChars('ㄅㄆ'), ['ㄅ', 'ㄆ']);
    assert.deepEqual(rareChars('a' + cp(0xFFFD) + cp(0x3400) + cp(0x20000) + cp(0xE000)), [cp(0xFFFD), cp(0x3400), cp(0x20000), cp(0xE000)]);
    assert.deepEqual(rareChars('한국어 plain ASCII, 123'), []);
    assert.deepEqual(rareChars(null), []);
    assert.equal(hasCjk('plain'), false);
    assert.equal(hasCjk('關'), true);
});

const NEW = '2026-10-19T10:00:00.000Z';
const OLD = '2026-01-01T10:00:00.000Z';
const use = (name, input, ts) => JSON.stringify({ type: 'assistant', timestamp: ts || NEW, message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name, input }] } });
const said = (text) => JSON.stringify({ type: 'user', timestamp: NEW, message: { role: 'user', content: text } });
const ask = (q) => ({ questions: [{ header: 'h', question: q, options: [{ label: 'a', description: 'd' }] }] });

function config() {
    const dir = tmp('fankeel-escape-scan-');
    const project = path.join(dir, 'projects', 'F--x');
    fs.mkdirSync(path.join(project, 's1', 'subagents'), { recursive: true });
    fs.writeFileSync(path.join(project, 's1.jsonl'), [
        use('AskUserQuestion', ask('按 X 關' + SLIP + '時怎麼收尾？')),
        use('AskUserQuestion', ask('按 X 關閉時怎麼收尾？')),
        use('AskUserQuestion', ask('從 git ' + TAKE + '回來'), OLD),
        use('mcp__ccd_turn__wrap_up', { recap: '收' + DROP + '這個任務' }),
        use('TodoWrite', { todos: [{ content: 'fix tests' }] }),
        said('我是' + NAME),
        use('StructuredOutput', { __unparsedToolInput: { raw: '{"a": ' } }),
        'not json',
    ].join('\n') + '\n');
    fs.writeFileSync(path.join(project, 's1', 'subagents', 'agent-a1.jsonl'), use('Write', { file_path: 'a.md', content: '撈回來' }) + '\n');
    return dir;
}

test('scan counts calls, CJK calls and flagged calls per tool, subagents included', () => {
    const got = scan(config(), {});
    assert.equal(got.files, 2);
    assert.deepEqual([got.rows.AskUserQuestion.calls, got.rows.AskUserQuestion.cjk, got.rows.AskUserQuestion.flagged], [3, 3, 2]);
    assert.deepEqual(got.rows.AskUserQuestion.chars, { [SLIP]: 1, [TAKE]: 1 });
    assert.deepEqual([got.rows.wrap_up.calls, got.rows.wrap_up.flagged], [1, 1]);
    assert.deepEqual([got.rows.TodoWrite.calls, got.rows.TodoWrite.cjk], [1, 0]);
    assert.deepEqual([got.rows.Write.calls, got.rows.Write.cjk, got.rows.Write.flagged], [1, 1, 0]);
    assert.deepEqual([got.rows.user.calls, got.rows.user.flagged], [1, 1]);
    assert.deepEqual(got.unparsed, { StructuredOutput: 1 });
});

test('the report prints a row per tool, the flagged characters and the unparsed calls; --since drops older lines', () => {
    const dir = config();
    const all = main(['--config-dir', dir]);
    assert.equal(all.code, 0);
    assert.match(all.text, /^ {2}AskUserQuestion\s+3\s+3\s+2\s+66\.67%$/m);
    assert.match(all.text, /^ {2}update_plan\s+0\s+0\s+0\s+-$/m);
    assert.match(all.text, /^ {2}user prompt\s+1\s+1\s+1\s+100\.00%$/m);
    assert.ok(all.text.includes('flagged in AskUserQuestion: ' + SLIP + ' 1, ' + TAKE + ' 1'), all.text);
    assert.match(all.text, /^__unparsedToolInput: 1 \(StructuredOutput 1\)$/m);
    const recent = main(['--config-dir', dir, '--since', '2026-10-01']);
    assert.match(recent.text, /^ {2}AskUserQuestion\s+2\s+2\s+1\s+50\.00%$/m);
    assert.match(recent.text, /, since 2026-10-01$/m);
    assert.equal(main(['--since', 'last week']).code, 2);
    assert.equal(main(['--bogus']).code, 2);
});

test('--since takes an ISO time with a zone and cuts inside one day; a time with no zone is refused', () => {
    const dir = config();
    const later = main(['--config-dir', dir, '--since', '2026-10-19T09:00Z']);
    assert.equal(later.code, 0);
    assert.match(later.text, /^ {2}AskUserQuestion\s+2\s+2\s+1\s+50\.00%$/m);
    assert.match(later.text, /, since 2026-10-19T09:00Z$/m);
    const after = main(['--config-dir', dir, '--since', '2026-10-19T19:00+08:00']);
    assert.match(after.text, /^ {2}AskUserQuestion\s+0\s+0\s+0\s+-$/m);
    const none = main(['--config-dir', dir, '--since', '2026-10-19T11:00Z']);
    assert.match(none.text, /^ {2}AskUserQuestion\s+0\s+0\s+0\s+-$/m);
    assert.equal(main(['--config-dir', dir, '--since', '2026-10-19T09:00']).code, 2);
    assert.equal(main(['--config-dir', dir, '--since', '2026-13-45T09:00Z']).code, 2);
});
