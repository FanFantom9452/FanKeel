'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const registry = require('../lib/registry.js');
const { contextPath } = require('../lib/handoff.js');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'task.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';

test('the reader\'s return contract sends a fact worth keeping to context.js add', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reader.md'), 'utf8');
    const ret = text.split('\n## Return\n')[1];
    assert.ok(ret, 'no ## Return section');
    assert.match(ret, /scripts\/context\.js add/);
    assert.match(ret, /--session/);
});

function run(dir, args) {
    const cfg = path.join(dir, 'cfg');
    try {
        return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', dir, '--claude-dir', cfg],
            { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) }), code: 0 };
    } catch (e) {
        return { out: String(e.stdout || ''), code: e.status };
    }
}

test('task.js stage warns leaving survey with no facts recorded, and does not block', () => {
    const dir = tmp('fankeel-task-ctx-');
    run(dir, ['start', '--session', A, '--task', 'a fixture task']);
    const { out, code } = run(dir, ['stage', 'design', '--session', A]);
    assert.equal(code, 0);
    assert.match(out, /context\.md has no facts/);
});

test('task.js stage says nothing about context once a fact is recorded', () => {
    const dir = tmp('fankeel-task-ctx-');
    run(dir, ['start', '--session', A, '--task', 'a fixture task']);
    const data = registry.readSession(dir, A);
    const file = contextPath(dir, data);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '- a fact — lib/x.js:1 @ abcdef1\n');
    const { out } = run(dir, ['stage', 'design', '--session', A]);
    assert.doesNotMatch(out, /context\.md has no facts/);
});

// docs/90-agent/plans/2026-10-10-workflow-gaps-design.md §6: a design → build
// move with no plan between them is told to put the file table on disk.
test('task.js stage build names a missing design.md on a route with no plan, and only there', () => {
    const { handoffPath } = require('../lib/handoff.js');
    const dir = tmp('fankeel-task-ctx-');
    run(dir, ['start', '--session', A, '--task', 'a fixture task', '--route', 'survey,design,build,verify']);
    run(dir, ['stage', 'design', '--session', A]);
    const file = handoffPath(dir, registry.readSession(dir, A), 'design');
    const rel = path.relative(dir, file).split(path.sep).join('/');
    assert.match(rel, /^\.fankeel\/build\/task-\d{8}T\d{6}\/design\.md$/);
    const missing = run(dir, ['stage', 'build', '--session', A]);
    assert.equal(missing.code, 0);
    assert.ok(missing.out.split('\n').includes('design.md is missing — Write the approved file table to ' + rel
        + ' before building; build reads its denominator there after a compaction.'), missing.out);

    run(dir, ['stage', 'verify', '--session', A]);
    assert.doesNotMatch(run(dir, ['stage', 'build', '--session', A]).out, /design\.md is missing/, 'verify to build is not this move');

    run(dir, ['stage', 'design', '--session', A]);
    const again = handoffPath(dir, registry.readSession(dir, A), 'design');
    fs.mkdirSync(path.dirname(again), { recursive: true });
    fs.writeFileSync(again, '| file | change | dispatch |\n');
    assert.doesNotMatch(run(dir, ['stage', 'build', '--session', A]).out, /design\.md is missing/, 'the file is there');
});

test('task.js stage verify after design says nothing about design.md, even with no plan on the route', () => {
    const dir = tmp('fankeel-task-ctx-');
    run(dir, ['start', '--session', A, '--task', 'a fixture task', '--route', 'survey,design,verify,land']);
    run(dir, ['stage', 'design', '--session', A]);
    assert.doesNotMatch(run(dir, ['stage', 'verify', '--session', A]).out, /design\.md is missing/);
});

test('task.js stage build says nothing about design.md on a route with plan', () => {
    const dir = tmp('fankeel-task-ctx-');
    run(dir, ['start', '--session', A, '--task', 'a fixture task', '--route', 'survey,design,plan,build']);
    run(dir, ['stage', 'design', '--session', A]);
    const { out, code } = run(dir, ['stage', 'build', '--session', A]);
    assert.equal(code, 0);
    assert.doesNotMatch(out, /design\.md is missing/);
});

test('task.js stage says nothing leaving a stage section 5 does not name', () => {
    const dir = tmp('fankeel-task-ctx-');
    run(dir, ['start', '--session', A, '--task', 'a fixture task']);
    run(dir, ['stage', 'design', '--session', A]);
    const { out } = run(dir, ['stage', 'plan', '--session', A]);
    assert.doesNotMatch(out, /context\.md has no facts/);
});

const NO_REOPEN = 'a `path:line` that context.md already lists';
const CARRIERS = ['plan', 'build', 'verify', 'audit', 'land'].map(s => path.join('skills', 'fankeel-' + s, 'SKILL.md'))
    .concat(['reader', 'reviewer', 'verifier', 'judge', 'brain'].map(a => path.join('agents', 'fankeel-' + a + '.md')));

test('every stage skill and checking agent records facts with context.js add and does not reopen listed ones', () => {
    for (const rel of CARRIERS) {
        const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        assert.match(text, /scripts\/context\.js add/, rel + ' lacks context.js add');
        assert.ok(text.includes(NO_REOPEN), rel + ' lacks the no-reopen sentence');
    }
});
