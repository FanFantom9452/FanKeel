'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { awaitState, awaitHandoff } = require('../lib/handoff.js');
const awaitCli = require('../scripts/await.js');
const registry = require('../lib/registry.js');
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

test('await.js with no answer file counts only a handoff newer than the in-flight mark as new', async () => {
    const f = fixture({ inflight: { stage: 'build', at: T, agentId: 'a1' } });
    const handoff = path.join(f.task, 'build.md').split(path.sep).join('/');
    at(handoff, T - 5000);
    const old = await awaitCli.main(['--session', SID, '--root', f.root, '--timeout', '0.5'], f.env);
    assert.match(old.text, /^timeout — /, 'a report that predates the dispatch is not the answer to it: ' + old.text);
    at(handoff, T + 5000);
    const fresh = await awaitCli.main(['--session', SID, '--root', f.root, '--timeout', '0.5'], f.env);
    assert.match(fresh.text, /^handoff /, fresh.text);
});

// 2026-09-23: the stage agent ran a foreground (not run_in_background) Bash
// tool call — `node --test tests/await.test.js tests/handoff.test.js` — that
// did not finish before the harness's own default foreground-Bash timeout
// (120000ms). The harness auto-backgrounds the call and the tool_result lands
// 121500ms after the tool_use, so the agent's own transcript file goes
// unwritten for that whole gap even though the agent was never idle. With the
// old 120s idle default that gap alone read as `lost`, 1500ms before the real
// tool_result would have landed. subagents/agent-a3e5d0d818fdea28f.jsonl lines
// 139-140; docs/reports/2026-09-23-brain-wakeup.md.
//
// awaitHandoff measures the idle gap off the real clock (`Date.now()` inside
// its own Promise executor), and its idle timer is a real `setTimeout`, so a
// CLI-level test cannot reach the idle branch inside a short `--timeout`
// without either waiting the real two (or three) minutes or controlling the
// clock the code itself reads. `node:test`'s built-in timer mock advances
// `Date` and `setTimeout` together, which lets this run the real default —
// no `--idle` flag — and land in well under a second of wall time.
test('await.js does not read one long foreground Bash call as a lost agent, at the real idle default', async () => {
    const t = test.mock.timers;
    t.enable({ apis: ['Date', 'setTimeout'] });
    try {
        const f = fixture({ inflight: { stage: 'build', at: 1, agentId: 'a3e5d0' } });
        at(path.join(f.config, 'projects', 'F--x', SID + '.jsonl'), Date.now());
        at(path.join(f.config, 'projects', 'F--x', SID, 'subagents', 'agent-a3e5d0.jsonl'), Date.now());
        const p = awaitCli.main(['--session', SID, '--root', f.root, '--timeout', '122'], f.env);
        t.tick(122000);
        const out = await p;
        assert.notEqual(out.text.split(' ')[0], 'lost', out.text);
        assert.match(out.text, /^timeout — /, out.text);
    } finally {
        t.reset();
    }
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

// 2026-09-24: three `lost` reports on a build whose stage agent was still
// running. `moves` gained a `build` entry after the dispatch, so await
// recomputed lap 3 and watched `build-3-commit.md` while the agent, briefed at
// lap 2, wrote `build-2-commit.md`. The in-flight mark carries the lap the
// brief used, whatever added the move.
test('await.js watches the lap the in-flight mark carries, not one recomputed from moves', async () => {
    const moves = [['build', 1], ['build', 2], ['build', 3]];
    const f = fixture({ moves, inflight: { stage: 'build', at: 1, lap: 2 } });
    const lap2 = path.join(f.task, 'build-2-commit.md').split(path.sep).join('/');
    at(lap2, Date.now());
    const out = await awaitCli.main(['--session', SID, '--root', f.root, '--timeout', '0.5'], f.env);
    assert.ok(out.text.startsWith('commit ' + lap2 + ' — run'), out.text);

    const g = fixture({ moves, inflight: { stage: 'verify', at: 1, lap: 2 } });
    const lap3 = path.join(g.task, 'build-3-commit.md').split(path.sep).join('/');
    at(lap3, Date.now());
    const other = await awaitCli.main(['--session', SID, '--root', g.root, '--timeout', '0.5'], g.env);
    assert.ok(other.text.startsWith('commit ' + lap3 + ' — run'), 'a mark for another stage is not this stage\'s lap: ' + other.text);
});

// docs/90-agent/plans/2026-09-28-agent-lifetime-design.md §1: build alone can
// run more than one brain at once, each with its own inflight mark and its
// own `-g<N>` handoff; `--agent` says which this call watches.
test('await.js watches one group-parallel brain at a time, chosen by --agent, and tags its line with its group', async () => {
    const marks = [{ stage: 'build', at: 1, agentId: 'a1', group: 1 }, { stage: 'build', at: 1, agentId: 'a2', group: 2 }];
    const f = fixture({ inflight: marks });
    const g2 = path.join(f.task, 'build-g2.md').split(path.sep).join('/');
    at(g2, Date.now());
    const out = await awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'a2', '--timeout', '0.5'], f.env);
    assert.equal(out.text, 'group 2, agent a2: handoff ' + g2 + ' — print this path and ask its gate as your rules say, unless you already asked it and the file has not changed since.');
});

// lib/render.js's renderBrainBrief only names a `-g<n>` handoff on the
// `build` stage's brief; every other stage's brain writes the plain handoff,
// group or not, so a mark carrying `group` outside `build` must not steer
// await.js onto the `-g<n>` path.
test('a non-build brain carrying a group waits on the plain handoff, the path its brief names', async () => {
    const mark = { stage: 'survey', at: 1, agentId: 'a1', group: 1 };
    const f = fixture({ stage: 'survey', inflight: mark });
    const plain = path.join(f.task, 'survey.md').split(path.sep).join('/');
    at(plain, Date.now());
    const out = await awaitCli.main(['--session', SID, '--root', f.root, '--timeout', '0.5'], f.env);
    assert.ok(out.text.endsWith(plain + ' — print this path and ask its gate as your rules say, unless you already asked it and the file has not changed since.'), out.text);
    assert.doesNotMatch(out.text, /-g1/);
});

test('await.js without --agent watches the newest brain by its mark, and refuses an --agent naming none of them', async () => {
    const marks = [{ stage: 'build', at: 1, agentId: 'a1', group: 1 }, { stage: 'build', at: 2, agentId: 'a2', group: 2 }];
    const f = fixture({ inflight: marks });
    const g2 = path.join(f.task, 'build-g2.md').split(path.sep).join('/');
    at(g2, Date.now());
    const newest = await awaitCli.main(['--session', SID, '--root', f.root, '--timeout', '0.5'], f.env);
    assert.equal(newest.code, undefined, newest.text);
    assert.ok(newest.text.startsWith('group 2, agent a2: handoff ' + g2), newest.text);
    const bad = await awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'zz', '--timeout', '0.5'], f.env);
    assert.equal(bad.code, 1);
    assert.match(bad.text, /^await\.js: no in-flight mark for agent zz at stage build/);
});

// A brain judged lost leaves no in-flight mark for itself, but a sibling
// brain's mark — a different agentId in the same group-parallel build — is
// untouched: `registry.clearInflight` is called with that one agentId, not
// with none, so it does not wipe every mark on the record.
test('await.js clears only the lost agent\'s own in-flight mark, leaving a sibling\'s standing', async () => {
    const marks = [{ stage: 'build', at: 1, agentId: 'a1', group: 1 }, { stage: 'build', at: 1, agentId: 'a2', group: 2 }];
    const f = fixture({ inflight: marks });
    at(path.join(f.config, 'projects', 'F--x', SID + '.jsonl'), Date.now());
    at(path.join(f.config, 'projects', 'F--x', SID, 'subagents', 'agent-a1.jsonl'), Date.now() - 600000);
    const out = await awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'a1', '--idle', '0.2'], f.env);
    assert.equal(out.text, 'group 1, agent a1: lost a1 — the stage agent stopped with neither file written: dispatch a fresh one with the same line.');
    const after = registry.inflights(registry.readSession(f.root, SID));
    assert.deepEqual(after.map((m) => m.agentId), ['a2'], 'a1\'s mark is gone, a2\'s sibling mark survives');
});

// docs/90-agent/plans/2026-09-28-agent-lifetime-design.md §1 and TODO 〔await〕:
// the mark carries which case the brain was sent for, so a close brain that
// started first no longer watches build-g1.md, and a group brain's mark
// clears when its own handoff arrives. The 39522eef version of the clear
// was reverted (5e2e621d) because a close mark also carried a group number.
test('await.js watches build.md for a close mark and build-g3.md for a group mark, and clears only the group mark on handoff', async () => {
    const f = fixture({});
    const transcript = path.join(f.root, 'sess.jsonl');
    for (const [id, prompt] of [['c1', 'build close.'], ['g3', 'build group 3.']]) {
        at(path.join(f.root, 'sess', 'subagents', 'agent-' + id + '.jsonl'), Date.now(), JSON.stringify({ message: { role: 'user', content: prompt } }) + '\n');
        const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'hooks', 'brief.js')], {
            input: JSON.stringify({ session_id: SID, cwd: f.root, hook_event_name: 'SubagentStart', agent_id: id, agent_type: 'fankeel:fankeel-brain', transcript_path: transcript }),
            encoding: 'utf8',
            env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: f.root, CLAUDE_CONFIG_DIR: f.config }),
        });
        assert.equal(r.status, 0, r.stderr);
    }
    const plain = path.join(f.task, 'build.md').split(path.sep).join('/');
    const g3 = path.join(f.task, 'build-g3.md').split(path.sep).join('/');
    at(plain, Date.now());
    at(g3, Date.now());
    const close = await awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'c1', '--timeout', '0.5'], f.env);
    assert.ok(close.text.startsWith('handoff ' + plain), close.text);
    assert.deepEqual(registry.inflights(registry.readSession(f.root, SID)).map((m) => m.agentId).sort(), ['c1', 'g3'], 'a close mark is left for hooks/gate.js');
    const group = await awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'g3', '--timeout', '0.5'], f.env);
    assert.equal(group.text.startsWith('group 3, agent g3: handoff ' + g3), true, group.text);
    assert.deepEqual(registry.inflights(registry.readSession(f.root, SID)).map((m) => m.agentId), ['c1'], 'the group mark clears once its own handoff arrives');
});

// A close mark stays standing for hooks/gate.js whatever group number it
// carries. Any other group-numbered mark clears on its own handoff, kind or
// not: hooks/brief.js's caseOf returns null when the brain's transcript is
// unreadable at SubagentStart, and that mark has a group and no kind.
test('await.js clears a group brain whose caseOf failed on handoff, and still leaves a close mark', async () => {
    const marks = [
        { stage: 'build', at: 1, agentId: 'c1', group: 1, kind: 'close' },
        { stage: 'build', at: 1, agentId: 'k2', group: 2 },
        { stage: 'build', at: 1, agentId: 'g3', group: 3, kind: 'group' },
    ];
    const f = fixture({ inflight: marks });
    for (const n of ['build.md', 'build-g2.md', 'build-g3.md']) at(path.join(f.task, n), Date.now());
    for (const id of ['c1', 'k2', 'g3']) {
        const out = await awaitCli.main(['--session', SID, '--root', f.root, '--agent', id, '--timeout', '0.5'], f.env);
        assert.match(out.text, /handoff /, out.text);
    }
    assert.deepEqual(registry.inflights(registry.readSession(f.root, SID)).map((m) => m.agentId), ['c1'], 'the close mark stays; both group marks clear');
});

// TODO 〔await〕: on 09-30 a live `build close` brain's mark carried `group: 6`
// and no `kind`, so await watched build-g6.md. By the time await runs the
// brain's own transcript exists, so await reads the case off its line 1; a
// group brain keeps the mark's number, the one its brief named.
test('await.js reads the case off a build brain\'s own transcript when its mark has none', async () => {
    const f = fixture({ inflight: [
        { stage: 'build', at: 1, agentId: 'c6', group: 6 },
        { stage: 'build', at: 1, agentId: 'g7', group: 7 },
    ] });
    const dir = path.join(f.config, 'projects', 'F--x', SID);
    at(path.join(f.config, 'projects', 'F--x', SID + '.jsonl'), Date.now());
    at(path.join(dir, 'subagents', 'agent-c6.jsonl'), Date.now(), JSON.stringify({ message: { role: 'user', content: 'build close for this plan.' } }) + '\n');
    at(path.join(dir, 'subagents', 'agent-g7.jsonl'), Date.now(), JSON.stringify({ message: { role: 'user', content: 'build group 2: tasks 3, 4.' } }) + '\n');
    const plain = path.join(f.task, 'build.md').split(path.sep).join('/');
    const g7 = path.join(f.task, 'build-g7.md').split(path.sep).join('/');
    at(plain, Date.now());
    at(g7, Date.now());
    const close = await awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'c6', '--timeout', '0.1'], f.env);
    assert.ok(close.text.startsWith('handoff ' + plain), close.text);
    const group = await awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'g7', '--timeout', '0.1'], f.env);
    assert.ok(group.text.startsWith('group 7, agent g7: handoff ' + g7), group.text);
    assert.deepEqual(registry.inflights(registry.readSession(f.root, SID)).map((m) => m.agentId), ['c6'], 'the close mark stays for hooks/gate.js; the group mark clears');
});

test('markInflight never hands out a group number a finished brain used', () => {
    const f = fixture({});
    assert.equal(registry.markInflight(f.root, SID, 'build', 'a1', undefined, undefined, 'group'), 1);
    assert.equal(registry.markInflight(f.root, SID, 'build', 'a2', undefined, undefined, 'group'), 2);
    assert.equal(registry.markInflight(f.root, SID, 'build', 'a3', undefined, undefined, 'group'), 3);
    registry.clearInflight(f.root, SID, 'a1');
    registry.clearInflight(f.root, SID, 'a2');
    assert.equal(registry.markInflight(f.root, SID, 'build', 'a4', undefined, undefined, 'group'), 4, 'group 3 is still running, so the next is 4, not the freed 1');
    registry.clearInflight(f.root, SID, 'a3');
    registry.clearInflight(f.root, SID, 'a4');
    assert.equal(registry.markInflight(f.root, SID, 'build', 'a5', undefined, undefined, 'group'), 1, 'with nothing in use the count starts again at 1');
});

test('a stage agent starting stamps the lap its brief named on the in-flight mark', () => {
    const f = fixture({ moves: [['build', 1], ['build', 2]] });
    const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'hooks', 'brief.js')], {
        input: JSON.stringify({ session_id: SID, cwd: f.root, hook_event_name: 'SubagentStart', agent_id: 'a3f9c2', agent_type: 'fankeel:fankeel-brain' }),
        encoding: 'utf8',
        env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: f.root, CLAUDE_CONFIG_DIR: f.config }),
    });
    assert.equal(r.status, 0, r.stderr);
    const mark = JSON.parse(fs.readFileSync(path.join(f.root, '.fankeel', 'sessions', SID + '.json'), 'utf8')).inflight;
    assert.deepEqual([mark.stage, mark.agentId, mark.lap], ['build', 'a3f9c2', 2]);
});
