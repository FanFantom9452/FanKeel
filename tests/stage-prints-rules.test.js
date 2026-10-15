'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { rulesFor, templateFor } = require('../lib/stages.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'task.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const GO = '進到這一站後在同一回合開工，不要先收回合。';

function run(dir, args) {
    const cfg = path.join(dir, 'cfg');
    try {
        return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', dir, '--claude-dir', cfg],
            { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) }), code: 0 };
    } catch (e) {
        return { out: String(e.stdout || ''), code: e.status };
    }
}

// The answer that approved the gate was injected while the old stage was
// current, so this output is the only thing on screen naming the new one.
test('task.js stage prints the new stage\'s rules and output shape, and says to start it this turn', () => {
    const dir = tmp('fankeel-stage-rules-');
    run(dir, ['start', '--session', A, '--task', 'a fixture task', '--class', 'architectural']);
    run(dir, ['stage', 'design', '--session', A]);
    const { out, code } = run(dir, ['stage', 'plan', '--session', A]);
    assert.equal(code, 0, out);
    assert.ok(out.includes('stage rules:\n  - ' + rulesFor('plan', { next: 'build' })[0]), out);
    assert.ok(out.includes('output shape:\n  ' + templateFor('plan').split('\n')[0]), out);
    assert.ok(out.trimEnd().endsWith(GO), out);
});

// `start` and `task` print in a turn with no injection behind it either, so
// the first stage opens with its rules on screen as every later one does.
test('task.js start prints the first stage\'s rules and output shape, and says to start it this turn', () => {
    const dir = tmp('fankeel-start-rules-');
    const { out, code } = run(dir, ['start', '--session', A, '--task', 'a fixture task', '--route', 'plan,build']);
    assert.equal(code, 0, out);
    assert.ok(out.includes('stage rules:\n  - ' + rulesFor('plan', { next: 'build' })[0]), out);
    assert.ok(out.includes('output shape:\n  ' + templateFor('plan').split('\n')[0]), out);
    assert.doesNotMatch(out, /Now plan: decompose/);
    assert.ok(out.trimEnd().endsWith(GO), out);
});

test('task.js task prints the new task\'s first stage rules and says to start it this turn', () => {
    const dir = tmp('fankeel-task-rules-');
    run(dir, ['start', '--session', A, '--task', 'first', '--route', 'plan,build']);
    const { out, code } = run(dir, ['task', 'second', '--session', A]);
    assert.equal(code, 0, out);
    assert.ok(out.includes('stage rules:'), out);
    assert.ok(out.trimEnd().endsWith(GO), out);
});
