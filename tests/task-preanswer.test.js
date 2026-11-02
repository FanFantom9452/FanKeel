'use strict';

// docs/03-decisions/2026-11-03-preanswered-gate.md: `task.js preanswer`
// writes this task's own answers for its later gates, and a new task or a
// stand-down clears them. The profile never holds one.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const TASK = path.join(ROOT, 'scripts', 'task.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';

function task(dir, args) {
    const cfg = path.join(dir, 'cfg');
    return execFileSync(process.execPath, [TASK, ...args, '--root', dir, '--claude-dir', cfg],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
}
const entry = (dir) => JSON.parse(fs.readFileSync(path.join(dir, '.fankeel', 'sessions', MINE + '.json'), 'utf8'));
const refused = (fn, re) => assert.throws(fn, (e) => re.test(String(e.stdout)));

test('preanswer writes the answers, the four stops and the time on this task', () => {
    const dir = tmp('fankeel-preanswer-');
    task(dir, ['start', '--session', MINE, '--task', 'x']);
    const out = task(dir, ['preanswer', 'verify=Land', 'land=收工', '--session', MINE]);
    assert.match(out, /^fankeel — preanswer: verify=Land land=收工$/m);
    assert.match(out, /^hard stops while set: push, delete, merge, launch$/m);
    const pre = entry(dir).preanswer;
    assert.deepEqual(pre.answers, { verify: 'Land', land: '收工' });
    assert.deepEqual(pre.stops, ['push', 'delete', 'merge', 'launch']);
    assert.ok(Number.isFinite(pre.at));
    const profile = path.join(dir, '.fankeel', 'profile.json');
    assert.ok(!fs.existsSync(profile) || !fs.readFileSync(profile, 'utf8').includes('preanswer'), 'never a profile key');
});

test('a stage off the route, or a word with no =, is refused and writes nothing', () => {
    const dir = tmp('fankeel-preanswer-');
    task(dir, ['start', '--session', MINE, '--task', 'x', '--route', 'survey,build,verify']);
    refused(() => task(dir, ['preanswer', 'land=收工', '--session', MINE]), /not on this task's route/);
    refused(() => task(dir, ['preanswer', 'verify', '--session', MINE]), /<stage>=<label>/);
    refused(() => task(dir, ['preanswer', '--session', MINE]), /verify=Land land=收工/);
    assert.equal(entry(dir).preanswer, undefined);
});

test('task clears preanswer and preanswered; down clears preanswer', () => {
    const dir = tmp('fankeel-preanswer-');
    task(dir, ['start', '--session', MINE, '--task', 'x']);
    task(dir, ['preanswer', 'verify=Land', '--session', MINE]);
    const file = path.join(dir, '.fankeel', 'sessions', MINE + '.json');
    fs.writeFileSync(file, JSON.stringify(Object.assign(entry(dir), { preanswered: { verify: { label: 'Go to Land', at: 1 } } })) + '\n');
    task(dir, ['task', 'y', '--session', MINE]);
    assert.equal(entry(dir).preanswer, undefined);
    assert.equal(entry(dir).preanswered, undefined);
    task(dir, ['preanswer', 'verify=Land', '--session', MINE]);
    task(dir, ['down', '--session', MINE]);
    assert.equal(entry(dir).preanswer, undefined);
    assert.equal(entry(dir).active, false);
});

test('preanswerOf reads a well-formed record and nothing else', () => {
    const { preanswerOf } = require('../lib/registry.js');
    assert.equal(preanswerOf({}), null);
    assert.equal(preanswerOf({ preanswer: { answers: 'x' } }), null);
    assert.deepEqual(preanswerOf({ preanswer: { answers: { verify: 'Land' }, stops: [], at: 1 } }).answers, { verify: 'Land' });
});
