'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { MAX_SENTENCE_WIDTH, DONE_HEADING, longSentences, bareCodes, proseProblem, proseFindings, todoIds } = require('../lib/plain.js');

test('a sentence is cut at 。！？；| and at . ! ? ; before a space, and a CJK character counts two', () => {
    assert.equal(MAX_SENTENCE_WIDTH, 160);
    assert.deepEqual(longSentences('這'.repeat(80) + '。' + '那'.repeat(10)), []);
    assert.deepEqual(longSentences('短句。' + '這'.repeat(81)).map((s) => [s.line, s.width]), [[1, 162]]);
    assert.deepEqual(longSentences('a'.repeat(100) + '. ' + 'b'.repeat(100)), []);
    assert.deepEqual(longSentences('這'.repeat(80) + '；' + '那'.repeat(80)), []);
});

test('code spans and link targets are not prose', () => {
    assert.deepEqual(longSentences('`' + 'x'.repeat(300) + '`'), []);
    assert.deepEqual(bareCodes('see [the page](docs/a1b2c3d4e5.md) and `8df7853d`', []), []);
});

test('a hex id is bare unless session or commit names it', () => {
    assert.deepEqual(bareCodes('landed in 8df7853d', []).map((b) => b.code), ['8df7853d']);
    assert.deepEqual(bareCodes('landed in commit 8df7853d, asked in session 7dd8cae1', []), []);
    assert.deepEqual(bareCodes('2026100 and deadbeef and abc12', []), []);
});

test('Task N and a known TODO id are bare; a longer id-shaped word is not', () => {
    assert.deepEqual(bareCodes('Task 3 failed', []).map((b) => b.code), ['Task 3']);
    assert.deepEqual(bareCodes('做 cleanup-2 與 utf-8', ['cleanup-2']).map((b) => b.code), ['cleanup-2']);
    assert.deepEqual(bareCodes('cleanup-20 is another', ['cleanup-2']), []);
});

test('proseProblem names the first gate field that breaks a rule', () => {
    const gate = { questions: [{ question: '要做嗎？', options: [{ label: 'build (Recommended)', description: '好' }, { label: '做 cleanup-2', description: 'd' }] }], next: '暫停' };
    assert.equal(proseProblem(gate, ['cleanup-2']).at, 'questions[0].options[1].label');
    assert.match(proseProblem(gate, ['cleanup-2']).detail, /"cleanup-2" stands where its name should be/);
    assert.equal(proseProblem(gate, []), null);
    const long = { questions: [{ question: '這'.repeat(81), options: [] }], next: 'n' };
    assert.match(proseProblem(long, []).detail, /^a sentence is 162 columns wide, 160 at most/);
});

test('proseFindings reads a human reference page, and a todo entry only under its record heading', () => {
    const long = '這'.repeat(81);
    const page = '---\nstatus: current\n---\n\n' + long + '\n\n```\n' + long + '\n```\n';
    assert.deepEqual(proseFindings('docs/01-guide/a.md', page, 'reference', 'human').map((f) => [f.tag, f.line]), [['long-sentence', 5]]);
    assert.deepEqual(proseFindings('docs/90-agent/reference/a.md', page, 'reference', 'agent'), []);
    const entry = '---\nstate: done\n---\n\n' + long + '\n\n' + DONE_HEADING + '\n\n刪了 8df7853d 的函式。\n';
    assert.deepEqual(proseFindings('docs/90-agent/todo/a-1.md', entry, 'todo', 'agent').map((f) => [f.tag, f.line]), [['bare-code', 9]]);
    assert.deepEqual(proseFindings('docs/90-agent/plans/a.md', page, 'plan', 'human'), []);
    assert.deepEqual(proseFindings('docs/90-agent/todo/a-2.md', '---\nstate: ready\n---\n\n' + long + '\n', 'todo', 'agent'), []);
});

test('todoIds is empty, with no warning, for a directory with no todo bucket', () => {
    assert.deepEqual(todoIds(require('node:os').tmpdir() + '/fankeel-no-such-root'), { ids: [], warning: null });
});

// plain-1: a TODO that could not be read used to come back as no ids at all,
// and the gate then let every bare TODO id through without a word.
test('todoIds names the failure when the TODO cannot be read', () => {
    const root = require('./tmp.js')('fankeel-plain-todo-');
    require('node:fs').mkdirSync(require('node:path').join(root, 'TODO.md'));
    const out = todoIds(root);
    assert.deepEqual(out.ids, []);
    assert.match(out.warning, /^the TODO entries could not be read \(.+\), so a bare TODO id is not checked$/);
});
