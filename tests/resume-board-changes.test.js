'use strict';
// hooks/resume.js carries the board changes made on the station during a
// gate into the answer (design §3), whichever surface answered it, once.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const tmp = require('./tmp.js');
const E = require('../lib/board-edit.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'resume.js');
const SID = 'aaaaaaaa-0000-4000-8000-000000000001';
const STARTED = '2026-10-27T01:02:03.000Z';

function seed() {
    const root = tmp('fankeel-resume-board-');
    const sdir = path.join(root, '.fankeel', 'sessions');
    fs.mkdirSync(sdir, { recursive: true });
    fs.writeFileSync(path.join(sdir, SID + '.json'), JSON.stringify({ task: 't', stage: 'survey', route: ['survey', 'design'], active: true, started: STARTED, updated: STARTED }) + '\n');
    const dir = path.join(root, '.fankeel', 'build', 'task-20261027T010203');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'arch.board');
    fs.writeFileSync(file, '{"chartroom":1,"root":"v"}\n{"view":"v"}\n{"node":"a","in":"v"}\n');
    return { root, dir, file };
}

const GATE = [{ question: '可以進 design 嗎？', header: 'survey', multiSelect: false, options: [{ label: '進 design', description: 'a' }, { label: '暫停', description: 'b' }] }];

// The survey handoff the controller files its answer beside; `block` false
// leaves a handoff with no gate block, which takes the unchecked path.
function handoff(root, dir, block) {
    fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'true' }));
    const ticks = '`'.repeat(3);
    fs.writeFileSync(path.join(dir, 'survey.md'), '# report\n' + (block ? '\n' + ticks + 'json gate\n' + JSON.stringify({ questions: GATE, next: 'n' }) + '\n' + ticks + '\n' : ''));
}

const spawn = (root, questions = []) => spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'AskUserQuestion', session_id: SID, cwd: root, tool_input: { questions }, tool_response: { answers: { 'q?': '暫停' } } }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') }),
});

const run = (root, questions) => execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'AskUserQuestion', session_id: SID, cwd: root, tool_input: { questions: questions || [] }, tool_response: { answers: {} } }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') }),
});

test('an unsent mark reaches the context once and is then marked sent', () => {
    const { root, dir, file } = seed();
    E.markBoard(file, 'a', '拆成兩個？');
    const out = run(root);
    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
    assert.match(ctx, /arch: 標記 a：拆成兩個？/);
    assert.match(ctx, /edits are already in the \.board files; marks are notes only/);
    assert.deepEqual(E.pendingChanges(dir), []);
    const again = run(root);
    assert.doesNotMatch(again ? JSON.parse(again).hookSpecificOutput.additionalContext : '', /標記 a/);
});

test('no changes: the context carries no board line', () => {
    const { root } = seed();
    const out = run(root);
    assert.doesNotMatch(out ? JSON.parse(out).hookSpecificOutput.additionalContext : '', /board changes/);
});

test('a changes log that cannot be read says so on stderr and the hook still exits 0', () => {
    const { root, file } = seed();
    fs.mkdirSync(E.changesFile(file));
    const r = spawn(root);
    assert.equal(r.status, 0);
    assert.match(r.stderr, /fankeel resume: board changes not read: /);
});

test('a markSent that fails still delivers the notes and says so on stderr', () => {
    const { root, file } = seed();
    E.markBoard(file, 'a', '拆成兩個？');
    fs.chmodSync(E.changesFile(file), 0o444);
    try {
        const r = spawn(root);
        assert.equal(r.status, 0);
        assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /arch: 標記 a：拆成兩個？/);
        assert.match(r.stderr, /fankeel resume: board changes not marked sent: /);
    } finally {
        fs.chmodSync(E.changesFile(file), 0o644);
    }
});

test('a matched gate files the answer ending with the board note', () => {
    const { root, dir, file } = seed();
    handoff(root, dir, true);
    E.markBoard(file, 'a', '拆成兩個？');
    spawn(root, JSON.parse(JSON.stringify(GATE)));
    assert.equal(fs.existsSync(path.join(dir, 'survey-answer.miss.json')), false);
    const written = fs.readFileSync(path.join(dir, 'survey-answer.md'), 'utf8');
    assert.ok(written.trimEnd().endsWith('- arch: 標記 a：拆成兩個？'), written);
});

test('an unchecked gate files the answer ending with the board note', () => {
    const { root, dir, file } = seed();
    handoff(root, dir, false);
    E.markBoard(file, 'a', '拆成兩個？');
    spawn(root, JSON.parse(JSON.stringify(GATE)));
    assert.match(JSON.parse(fs.readFileSync(path.join(dir, 'survey-answer.miss.json'), 'utf8')).reason, /no readable/);
    const written = fs.readFileSync(path.join(dir, 'survey-answer.md'), 'utf8');
    assert.ok(written.trimEnd().endsWith('- arch: 標記 a：拆成兩個？'), written);
});
