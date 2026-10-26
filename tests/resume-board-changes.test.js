'use strict';
// hooks/resume.js carries the board changes made on the station during a
// gate into the answer (design §3), whichever surface answered it, once.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const E = require('../lib/board-edit.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'resume.js');
const SID = 'aaaaaaaa-0000-4000-8000-000000000001';
const STARTED = '2026-10-27T01:02:03.000Z';

function seed() {
    const root = tmp('fankeel-resume-board-');
    const sdir = path.join(root, '.fankeel', 'sessions');
    fs.mkdirSync(sdir, { recursive: true });
    fs.writeFileSync(path.join(sdir, SID + '.json'), JSON.stringify({ task: 't', stage: 'design', route: ['design', 'plan'], active: true, started: STARTED, updated: STARTED }) + '\n');
    const dir = path.join(root, '.fankeel', 'build', 'task-20261027T010203');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'arch.board');
    fs.writeFileSync(file, '{"chartroom":1,"root":"v"}\n{"view":"v"}\n{"node":"a","in":"v"}\n');
    return { root, dir, file };
}

const run = (root) => execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'AskUserQuestion', session_id: SID, cwd: root, tool_input: { questions: [] }, tool_response: { answers: {} } }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') }),
});

test('an unsent mark reaches the context once and is then marked sent', () => {
    const { root, dir, file } = seed();
    E.markBoard(file, 'a', '拆成兩個？');
    const out = run(root);
    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
    assert.match(ctx, /arch: 標記 a：拆成兩個？/);
    assert.deepEqual(E.pendingChanges(dir), []);
    const again = run(root);
    assert.doesNotMatch(again ? JSON.parse(again).hookSpecificOutput.additionalContext : '', /標記 a/);
});

test('no changes: the context carries no board line', () => {
    const { root } = seed();
    const out = run(root);
    assert.doesNotMatch(out ? JSON.parse(out).hookSpecificOutput.additionalContext : '', /board changes/);
});
