'use strict';

// escape-1 step 4: hooks/gate.js sends back an AskUserQuestion whose text
// carries a character an escape slip lands on, once per exact text.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tmp = require('./tmp.js');
const { askSlip } = require('../lib/cjk.js');

const GATE = path.join(__dirname, '..', 'hooks', 'gate.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const SLIP = String.fromCodePoint(0x95C9);   // 闉, written for 閉
const ago = (ms) => new Date(Date.now() - ms).toISOString();

function project() {
    const root = tmp('fankeel-gate-cjk-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), JSON.stringify({
        task: 't', stage: 'design', active: true, started: ago(7200e3), updated: ago(3600e3),
    }));
    return root;
}

const input = (q) => ({ questions: [{ header: '下一站', question: q, options: ['plan (Recommended)', '沒有', '暫停'].map((label) => ({ label, description: 'd' })) }] });

function ask(root, q) {
    return execFileSync(process.execPath, [GATE], {
        input: JSON.stringify({ session_id: MINE, cwd: root, hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: input(q) }),
        encoding: 'utf8',
        env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
    });
}

test('a question carrying a slipped character is refused, naming it and its code point', () => {
    const root = project();
    const out = JSON.parse(ask(root, '按 X 關' + SLIP + '時怎麼收尾？'));
    assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
    assert.ok(out.hookSpecificOutput.permissionDecisionReason.includes(SLIP + ' (U+95C9)'), out.hookSpecificOutput.permissionDecisionReason);
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /ask again unchanged and it goes out/);
});

test('the same text asked again goes out', () => {
    const root = project();
    ask(root, '按 X 關' + SLIP + '時怎麼收尾？');
    assert.equal(ask(root, '按 X 關' + SLIP + '時怎麼收尾？').includes('U+95C9'), false);
});

test('common characters, bopomofo, and a session not in the mode', () => {
    const root = project();
    assert.equal(ask(root, '按 X 關閉時怎麼收尾？').includes('U+'), false);
    assert.ok(ask(root, '要不要ㄅ').includes('U+3105'));
    const none = tmp('fankeel-gate-cjk-none-');
    assert.equal(ask(none, '按 X 關' + SLIP), '');
});

test('askSlip: null for clean text or an unsafe session id; the state keeps hashes only', () => {
    const root = project();
    assert.equal(askSlip(root, MINE, input('按 X 關閉')), null);
    assert.equal(askSlip(root, '../x', input('關' + SLIP)), null);
    assert.ok(askSlip(root, MINE, input('關' + SLIP)));
    const state = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'build', 'cjk-' + MINE + '.json'), 'utf8'));
    assert.equal(state.refused.length, 1);
    assert.match(state.refused[0], /^[0-9a-f]{16}$/);
});
