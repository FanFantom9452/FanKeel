'use strict';

// docs/03-decisions/2026-11-03-preanswered-gate.md: the stage that asks the
// pre-answer is told so on entry, and a pre-answered stage is told how its
// gate passes and what still stops. Said once by task.js, never in `rules`,
// which sit at the 2400 cap.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const { preanswerRule } = require('../lib/stages.js');

const ROOT = path.join(__dirname, '..');
const TASK = path.join(ROOT, 'scripts', 'task.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const FULL = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];

test('plan asks, naming the later gates, the command and the session', () => {
    const rule = preanswerRule({ stage: 'plan', route: FULL }, '/p/scripts/task.js', MINE);
    assert.match(rule, /^After the user approves this gate/);
    assert.ok(rule.includes('build、verify、audit、land'));
    assert.ok(rule.includes('node /p/scripts/task.js preanswer <stage>=<label>... --session ' + MINE));
    assert.ok(rule.includes('(Recommended)'));
});

test('design asks only on a route with no plan', () => {
    assert.match(preanswerRule({ stage: 'design', route: ['survey', 'design', 'build', 'verify', 'land'] }, 't', MINE), /^After the user approves/);
    assert.equal(preanswerRule({ stage: 'design', route: FULL }, 't', MINE), null);
    assert.equal(preanswerRule({ stage: 'survey', route: FULL }, 't', MINE), null);
});

test('a pre-answered stage is told its label and the stops; others say nothing', () => {
    const data = (stage) => ({ stage, route: FULL, preanswer: { answers: { verify: 'Land' }, stops: [], at: 1 } });
    const hold = preanswerRule(data('verify'), 't', MINE);
    assert.match(hold, /^Pre-answered: this gate takes `Land`/);
    assert.match(hold, /git push/);
    assert.match(hold, /AskUserQuestion/);
    assert.equal(preanswerRule(data('build'), 't', MINE), null);
    assert.equal(preanswerRule(data('plan'), 't', MINE), null, 'already answered');
});

function task(dir, args) {
    const cfg = path.join(dir, 'cfg');
    return execFileSync(process.execPath, [TASK, ...args, '--root', dir, '--claude-dir', cfg],
        { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
}

test('task.js stage prints the preanswer line on entering plan and a pre-answered verify', () => {
    const dir = tmp('fankeel-stages-preanswer-');
    task(dir, ['start', '--session', MINE, '--task', 'x']);
    assert.match(task(dir, ['stage', 'plan', '--session', MINE]), /^preanswer: After the user approves this gate/m);
    task(dir, ['preanswer', 'verify=Land', '--session', MINE]);
    assert.doesNotMatch(task(dir, ['stage', 'build', '--session', MINE]), /^preanswer:/m);
    assert.match(task(dir, ['stage', 'verify', '--session', MINE]), /^preanswer: Pre-answered: this gate takes `Land`/m);
});
