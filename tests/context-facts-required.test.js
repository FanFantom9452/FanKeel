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

test('task.js stage says nothing leaving a stage section 5 does not name', () => {
    const dir = tmp('fankeel-task-ctx-');
    run(dir, ['start', '--session', A, '--task', 'a fixture task']);
    run(dir, ['stage', 'design', '--session', A]);
    const { out } = run(dir, ['stage', 'plan', '--session', A]);
    assert.doesNotMatch(out, /context\.md has no facts/);
});
