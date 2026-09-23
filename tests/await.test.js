'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { awaitState, awaitHandoff } = require('../lib/handoff.js');
const awaitCli = require('../scripts/await.js');
const tmp = require('./tmp.js');

// A fixed clock: every mtime below is set against it rather than read off the
// machine, so the two-minute idle threshold is crossed without waiting for it.
const T = 1800000000000;
function at(file, ms, body) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body || 'x\n');
    fs.utimesSync(file, ms / 1000, ms / 1000);
    return file;
}

test('awaitState: a pending commit first, then a report newer than since, else null', () => {
    const dir = tmp('fankeel-await-');
    const handoff = path.join(dir, 'build.md');
    const commit = path.join(dir, 'build-commit.md');
    const base = { handoff, commit, since: T, activity: [], idleMs: 120000, started: T, now: T + 1000 };
    assert.equal(awaitState(base), null, 'neither file');
    at(handoff, T - 5000);
    assert.equal(awaitState(base), null, 'a report older than since is the one already answered');
    at(handoff, T + 500);
    assert.equal(awaitState(base), 'handoff');
    at(commit, T + 600);
    assert.equal(awaitState(base), 'commit', 'a pending commit comes before the report');
    assert.equal(awaitState({ ...base, since: T + 600 }), null, 'a commit file no newer than since is the one that just failed');
    assert.equal(awaitState({ ...base, since: 0 }), 'commit');
});

test('awaitState: lost only when every activity file and the start are idleMs old', () => {
    const dir = tmp('fankeel-await-');
    const own = at(path.join(dir, 'subagents', 'agent-a1.jsonl'), T - 200000);
    const child = at(path.join(dir, 'subagents', 'agent-b2.jsonl'), T - 200000);
    const base = { handoff: path.join(dir, 'build.md'), commit: path.join(dir, 'build-commit.md'), since: 0, activity: [own, child], idleMs: 120000, started: T - 200000, now: T };
    assert.equal(awaitState(base), 'lost');
    assert.equal(awaitState({ ...base, started: T - 1000 }), null, 'the wait itself only just began');
    assert.equal(awaitState({ ...base, activity: [] }), null, 'an agent nobody can see is never lost');
    at(child, T - 1000);
    assert.equal(awaitState(base), null, 'a child the agent dispatched is still writing');
    at(path.join(dir, 'build.md'), T - 100000);
    assert.equal(awaitState({ ...base, activity: [own] }), 'handoff', 'a report on disk wins over an idle transcript');
});

test('awaitHandoff wakes on a report written after it started, and on a commit file', async () => {
    const dir = tmp('fankeel-await-');
    const o = { handoff: path.join(dir, 'task', 'build.md'), commit: path.join(dir, 'task', 'build-commit.md'), since: 0, idleMs: 120000, timeoutMs: 5000 };
    const first = awaitHandoff(o);
    setTimeout(() => fs.writeFileSync(o.handoff, 'report\n'), 50);
    assert.equal(await first, 'handoff');
    const since = fs.statSync(o.handoff).mtimeMs;
    const second = awaitHandoff({ ...o, since });
    setTimeout(() => fs.writeFileSync(o.commit, 'a.txt\n\nfeat: x\n'), 50);
    assert.equal(await second, 'commit');
});

test('awaitHandoff answers at once when the file is already there, says lost after idleMs, and times out', async () => {
    const dir = tmp('fankeel-await-');
    const handoff = at(path.join(dir, 'task', 'build.md'), Date.now());
    assert.equal(await awaitHandoff({ handoff, commit: path.join(dir, 'task', 'build-commit.md'), since: 0, idleMs: 120000, timeoutMs: 5000 }), 'handoff');
    const quiet = { handoff: path.join(dir, 'task2', 'build.md'), commit: path.join(dir, 'task2', 'build-commit.md'), since: 0, timeoutMs: 5000 };
    const own = at(path.join(dir, 'subagents', 'agent-a1.jsonl'), Date.now() - 60000);
    const t0 = Date.now();
    assert.equal(await awaitHandoff({ ...quiet, idleMs: 200, activity: () => [own] }), 'lost');
    assert.ok(Date.now() - t0 >= 150, 'lost is judged from when the wait began, not from the old transcript');
    assert.equal(await awaitHandoff({ ...quiet, idleMs: 120000, timeoutMs: 100 }), 'timeout');
});

// The script end to end, on a registry fixture: the record names the stage,
// `started` names the task directory, and `inflight` names the agent whose
// transcript sits under CLAUDE_CONFIG_DIR's projects/<slug>/<session>/subagents/.
const SID = 'aaaaaaaa-0000-4000-8000-000000000001';
function fixture(record) {
    const root = tmp('fankeel-await-root-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SID + '.json'), JSON.stringify(Object.assign({ active: true, stage: 'build', started: '2026-09-23T10:00:00.000Z', moves: [['build', 1]] }, record)));
    const config = tmp('fankeel-await-config-');
    const task = path.join(root, '.fankeel', 'build', 'task-20260923T100000').replace(/\\/g, '/');
    return { root, config, task, env: { CLAUDE_CONFIG_DIR: config } };
}

test('await.js prints the line for each state, reading paths and the agent off the record', async () => {
    const f = fixture({});
    at(path.join(f.task, 'build.md'), Date.now());
    const handoff = await awaitCli.main(['--session', SID, '--root', f.root], f.env);
    assert.equal(handoff.code, undefined);
    assert.match(handoff.text, new RegExp('^handoff ' + f.task + '/build\\.md — print this path and ask its gate'));

    at(path.join(f.task, 'build-commit.md'), Date.now());
    const commit = await awaitCli.main(['--session', SID, '--root', f.root], f.env);
    assert.match(commit.text, new RegExp('^commit ' + f.task + '/build-commit\\.md — run `node .*/scripts/commit\\.js "'));
    assert.match(commit.text, /run await again with `--since "[^"]+build-commit\.md"` added\.$/);
    const since = await awaitCli.main(['--session', SID, '--root', f.root, '--since', path.join(f.task, 'build-commit.md'), '--timeout', '0.2'], f.env);
    assert.match(since.text, /^timeout — /, 'the commit file named by --since is not news, and neither is the older report');

    const g = fixture({ inflight: { stage: 'build', at: 1, agentId: 'a3f9c2' } });
    at(path.join(g.config, 'projects', 'F--x', SID + '.jsonl'), Date.now());
    at(path.join(g.config, 'projects', 'F--x', SID, 'subagents', 'agent-a3f9c2.jsonl'), Date.now() - 600000);
    const lost = await awaitCli.main(['--session', SID, '--root', g.root, '--idle', '0.2'], g.env);
    assert.equal(lost.text, 'lost a3f9c2 — the stage agent stopped with neither file written: dispatch a fresh one with the same line.');
});

// 2026-09-23: the build stage's own brain wrote every commit file to the
// plan-stem ledger directory (`.fankeel/build/<plan file>/`, the directory
// `lib/ledger.js`'s `ledgerPath` uses for `progress.md`) instead of the exact
// path its brief named (`commitPath()`'s task-stamp directory). Three real
// commits landed there in a row and `commit` never fired once, only `handoff`
// at the very end. docs/reports/2026-09-23-brain-wakeup.md.
test('await.js finds a commit file the stage agent wrote to the ledger directory instead of commitPath()', async () => {
    const f = fixture({});
    at(path.join(f.root, 'docs', 'plans', '2026-09-23-controller-await.md'), Date.parse('2026-09-23T10:05:00.000Z'));
    const ledgerCommit = path.join(f.root, '.fankeel', 'build', '2026-09-23-controller-await', 'build-commit.md').split(path.sep).join('/');
    at(ledgerCommit, Date.now());
    const commit = await awaitCli.main(['--session', SID, '--root', f.root, '--timeout', '0.5'], f.env);
    assert.ok(commit.text.startsWith('commit ' + ledgerCommit + ' — run'), commit.text);
});

test('await.js refuses a missing session and bad arguments, from the command line too', async () => {
    const f = fixture({});
    const none = await awaitCli.main(['--session', 'bbbbbbbb-0000-4000-8000-000000000002', '--root', f.root], f.env);
    assert.equal(none.code, 1);
    assert.match(none.text, /^await\.js: no session /);
    for (const argv of [[], ['--session'], ['--root', f.root], ['--session', SID, '--idle', '0'], ['--session', SID, '--bogus', 'x']]) {
        assert.equal((await awaitCli.main(argv, f.env)).code, 2, argv.join(' '));
    }
    const cli = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'await.js')], { encoding: 'utf8' });
    assert.equal(cli.status, 2);
    assert.match(cli.stdout, /^await\.js: usage: /);
});
