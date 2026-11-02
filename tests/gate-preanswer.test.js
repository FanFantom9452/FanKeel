'use strict';

// docs/03-decisions/2026-11-03-preanswered-gate.md: a gate this task
// pre-answered goes out carrying its answer and is marked `preanswered`;
// without a pre-answer, or when the stage's own option one disagrees with
// it, the gate is asked as before. The guard half is
// tests/guard-preanswer.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(ROOT, 'hooks', 'gate.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const TICKS = '`'.repeat(3);

const gateQ = (first, two) => [{ question: 'Verify -> Land | fankeel : t　驗過了，進 land？', header: 'Verify→Land', multiSelect: false, options: [
    { label: first, description: 'a' }, { label: two, description: 'b' }, { label: '暫停', description: 'c' }] }];
const LAND = gateQ('Go to Land (Recommended)', 'Stay in Verify');

function seed(over) {
    const root = tmp('fankeel-gate-preanswer-');
    const dir = path.join(root, '.fankeel', 'sessions');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, MINE + '.json'), JSON.stringify(Object.assign({
        task: 't', stage: 'verify', route: ['plan', 'build', 'verify', 'land'], active: true,
        started: '2026-09-19T09:30:12.345Z', updated: new Date().toISOString(), configDir: tmp('fankeel-cfg-'),
    }, over)) + '\n');
    fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'survey' }));
    return root;
}

function report(root, questions) {
    const file = path.join(root, '.fankeel', 'build', 'task-20260919T093012', 'verify.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '# verify\n\n' + TICKS + 'json gate\n' + JSON.stringify({ questions, next: 'n' }) + '\n' + TICKS + '\n');
}

function ask(root, questions) {
    const out = execFileSync(process.execPath, [GATE], {
        input: JSON.stringify({ session_id: MINE, cwd: root, tool_name: 'AskUserQuestion', tool_input: { questions } }),
        encoding: 'utf8',
        env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
    }).trim();
    return out ? JSON.parse(out) : {};
}
const entry = (root) => JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), 'utf8'));
const PRE = { preanswer: { answers: { verify: 'Land' }, stops: ['push', 'delete', 'merge', 'launch'], at: 1 } };

test('a pre-answered verify gate goes out answered and is marked preanswered', () => {
    const root = seed(PRE);
    report(root, LAND);
    const out = ask(root, LAND).hookSpecificOutput;
    assert.equal(out.permissionDecision, 'allow');
    assert.match(out.permissionDecisionReason, /pre-answered for this task/);
    assert.deepEqual(out.updatedInput.answers, { [LAND[0].question]: 'Go to Land (Recommended)' });
    assert.deepEqual(out.updatedInput.questions, LAND);
    assert.equal(entry(root).preanswered.verify.label, 'Go to Land (Recommended)');
    assert.ok(Number.isFinite(entry(root).gateAt), 'the gate still opens, so the wait is timed');
});

test('with no pre-answer the verify gate is asked as before', () => {
    const root = seed({});
    report(root, LAND);
    assert.equal(ask(root, LAND).hookSpecificOutput, undefined);
    assert.equal(entry(root).preanswered, undefined);
});

test('a gate whose option one is not the pre-answer is asked: the stage disagrees with it', () => {
    const root = seed(PRE);
    const back = gateQ('Back to Build (Recommended)', 'Stay in Verify');
    report(root, back);
    assert.equal(ask(root, back).hookSpecificOutput, undefined);
    assert.equal(entry(root).preanswered, undefined);
});

test('a pre-answer naming the pause option passes: stopping is always safe', () => {
    const root = seed({ preanswer: { answers: { verify: '暫停' }, stops: [], at: 1 } });
    report(root, LAND);
    assert.deepEqual(ask(root, LAND).hookSpecificOutput.updatedInput.answers, { [LAND[0].question]: '暫停' });
});

test('a two-question gate is asked even with a pre-answer stored', () => {
    const root = seed(PRE);
    const two = LAND.concat(LAND);
    report(root, two);
    assert.equal(ask(root, two).hookSpecificOutput, undefined);
    assert.equal(entry(root).preanswered, undefined);
});

test('a pre-answered gate goes out answered for an away user instead of held', () => {
    const root = seed(Object.assign({ leavingAt: Date.now() - 1000 }, PRE));
    report(root, LAND);
    const out = ask(root, LAND).hookSpecificOutput;
    assert.equal(out.permissionDecision, 'allow');
    assert.equal(entry(root).awayAt, undefined);
});
