#!/usr/bin/env node
'use strict';

// Waits, in the background, on the stage agent a controller has just
// dispatched or messaged, and prints one line saying what to do next. The
// controller runs it with Bash `run_in_background` after every dispatch and
// every SendMessage and ends its turn: this script exiting is what hands the
// turn back, so a hand-back that never arrives — twice on 2026-09-23 — no
// longer strands the stage. docs/plans/2026-09-23-controller-await-design.md §1.
//
//   node await.js --session <id> [--root <dir>] [--since <file>] [--idle <s>] [--timeout <s>]
//
// Everything else is read off the session's record: the stage, its handoff and
// commit files, and the stage agent's id (`inflight`, written by
// hooks/brief.js). A handoff or commit file counts only when it is newer than
// `--since`, which defaults to the stage's answer file, so a report the user
// has already answered is not news.

const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const { handoffPath, commitPath, ledgerCommitPath, answerPath, awaitHandoff, newestCommit, caseOfPrompt, promptOf } = require('../lib/handoff.js');
const { newestPlan } = require('../lib/render.js');
const { transcriptOf } = require('../lib/detail.js');
const { sessionDirOf, agentFiles } = require('../lib/usage.js');
const { configDirOf } = require('../lib/profile.js');

const USAGE = 'await.js: usage: await.js --session <id> [--root <dir>] [--since <file>] [--idle <seconds>] [--timeout <seconds>] [--agent <id>]';
const COMMIT_SCRIPT = path.join(__dirname, 'commit.js').replace(/\\/g, '/');

// Flag and value pairs only. Null for anything else, which prints the usage line.
function parseArgs(argv) {
    // idle was 120 (two minutes) until 2026-09-23, the same number as the
    // Claude Code harness's own default foreground-Bash timeout — so one
    // ordinary foreground Bash call from the stage agent itself (not a child
    // it dispatched) that ran close to that ceiling was fatally coincident
    // with this threshold: the harness's tool_result can land ~121-125 wall-
    // clock seconds after the tool_use, past await.js's old 120s idle mark,
    // so the idle check fired and read `lost` before the real result arrived.
    // 180 (three minutes) clears the observed 121.5s gap with 58+ seconds of
    // margin. docs/reports/2026-09-23-brain-wakeup.md.
    const opts = { idle: 180, timeout: 1800 };
    for (let i = 0; i < argv.length; i += 2) {
        const key = argv[i];
        const value = argv[i + 1];
        if (value === undefined) return null;
        if (key === '--session') opts.session = value;
        else if (key === '--root') opts.root = value;
        else if (key === '--since') opts.since = value;
        else if (key === '--agent') opts.agent = value;
        else if (key === '--idle' || key === '--timeout') {
            const n = Number(value);
            if (!(n > 0)) return null;
            opts[key.slice(2)] = n;
        } else return null;
    }
    return opts.session ? opts : null;
}

// The commit file candidates: `commitPath()`, the exact path a stage agent's
// brief names, and — on `build` only — the plan-stem ledger directory
// `lib/ledger.js` already uses for `progress.md` and every task brief, which is
// where a stage agent writes out of habit when it does not follow the exact
// path. Both are watched; whichever lands first is the commit found.
// docs/reports/2026-09-23-brain-wakeup.md.
function commitCandidates(root, data, lap, group) {
    const candidates = [commitPath(root, data, data.stage, lap, group)];
    if (data.stage === 'build') {
        const plan = newestPlan(root, data.started);
        const ledger = ledgerCommitPath(root, plan, data.stage);
        if (ledger) candidates.push(ledger);
    }
    return candidates.filter(Boolean);
}

// What `awaitHandoff` is given, from the record. The agent counts as lost
// only when its own transcript exists: an agent nobody can find is never
// judged. `inflights(data)` may hold more than one mark once a build runs
// several brains at once (docs/90-agent/plans/2026-09-28-agent-lifetime-design.md
// §1); `--agent` says which one this call watches, and without it the newest
// mark by `at` is the one watched (the later entry on a tie): the controller
// that just dispatched a brain is waiting on that one.
function waitFor(opts, env) {
    const root = opts.root ? registry.resolveRoot(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const data = registry.readSession(root, opts.session);
    if (!data) return { error: 'no session ' + opts.session + ' under ' + root };
    const running = registry.inflights(data).filter((m) => m.stage === data.stage);
    if (opts.agent && !running.some((m) => m.agentId === opts.agent)) return { error: 'no in-flight mark for agent ' + opts.agent + ' at stage ' + data.stage };
    const newest = running.reduce((best, m) => (!best || (Number.isFinite(m.at) ? m.at : 0) >= (Number.isFinite(best.at) ? best.at : 0) ? m : best), null);
    const mark = opts.agent ? running.find((m) => m.agentId === opts.agent) : newest;
    const lap = mark && Number.isInteger(mark.lap) && mark.lap > 0 ? mark.lap : undefined;
    const agentId = mark && typeof mark.agentId === 'string' && mark.agentId ? mark.agentId : null;
    const dir = agentId ? sessionDirOf(transcriptOf(data.configDir || configDirOf(env), opts.session)) : null;
    const own = dir ? path.join(dir, 'subagents', 'agent-' + agentId + '.jsonl') : null;
    // Only build's brief names a `-g<n>` handoff (lib/render.js, renderBrainBrief),
    // and only for a group brain: a `close` mark watches the plain one whatever
    // number `markInflight` gave it, so the mark's `kind` decides, not its `group`.
    let kind = mark && (mark.kind === 'group' || mark.kind === 'close') ? mark.kind : undefined;
    // A build mark with no `kind` is one hooks/brief.js could not read the case
    // for: on 09-30 a live `build close` brain's mark carried `group: 6` and no
    // `kind` (TODO 〔await〕). By the time anyone awaits it, its transcript is
    // there, so the case is read off line 1 here. A group brain keeps the mark's
    // number: that is the one its brief named, whatever its prompt says.
    if (data.stage === 'build' && mark && !kind && own) {
        const sent = caseOfPrompt(promptOf(own));
        if (sent) kind = sent.kind;
    }
    const group = data.stage === 'build' && mark && kind !== 'close' && Number.isInteger(mark.group) ? mark.group : undefined;
    const handoff = handoffPath(root, data, data.stage, lap, group);
    if (!handoff) return { error: 'session ' + opts.session + ' has no stage or no started time, so no handoff path' };
    let since = 0;
    try {
        since = fs.statSync(opts.since || answerPath(root, data, data.stage, lap)).mtimeMs;
    } catch (e) {
        // Nothing answered yet — or the answer file was never written, which
        // hooks/resume.js now says with `<stage>-answer.miss.json`. Either way a
        // report older than the dispatch is not the reply to it.
        if (mark && Number.isFinite(mark.at)) since = mark.at;
    }
    const activity = own ? () => (fs.existsSync(own) ? agentFiles(dir) : []) : () => [];
    return { root, handoff, commit: commitCandidates(root, data, lap, group), since, agentId, group, kind, activity, idleMs: opts.idle * 1000, timeoutMs: opts.timeout * 1000 };
}

// The word first, so the controller's rule can name it; then what to do, so
// the rule does not have to carry every case under the injection's cap.
// `commitFile` is the candidate that actually matched — `o.commit` may be
// several paths, and only one of them was written. `o.group` tags the line
// with which brain it is about once a build runs more than one at a time;
// a call with nothing to tag (every other stage, and build with just one
// running) prints exactly the line it always did.
function lineFor(state, o, commitFile) {
    const tag = Number.isInteger(o.group) ? 'group ' + o.group + ', agent ' + (o.agentId || '?') + ': ' : '';
    if (state === 'handoff') return tag + 'handoff ' + o.handoff + ' — print this path and ask its gate as your rules say, unless you already asked it and the file has not changed since.';
    if (state === 'commit') return tag + 'commit ' + commitFile + ' — run `node ' + COMMIT_SCRIPT + ' "' + commitFile + '"` and SendMessage the agent what it printed, exactly. After a `commit.js:` line, run await again with `--since "' + commitFile + '"` added.';
    if (state === 'lost') return tag + 'lost ' + o.agentId + ' — the stage agent stopped with neither file written: dispatch a fresh one with the same line.';
    return tag + 'timeout — nothing moved in ' + Math.round(o.timeoutMs / 60000) + ' minutes: run await again.';
}

// controller-1: one waiter per in-flight mark. A controller that ran await
// again before the last one returned stacked two, and the old ones kept
// printing after the stage was over. The first waiter writes
// `<handoff>.await` with its pid; a second one that finds a live pid there
// prints one line and exits 0. A marker whose pid is gone counts as none.
function alive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return e.code === 'EPERM';
    }
}

// await-5: a marker held by a live waiter for another agent is no waiter for
// this one. On 2026-10-01 a stopped brain's waiter outlived its brain, and every
// await for the brain sent after it read `already awaiting <the old agent>`.
// Either side with no agentId reads as it always did.
function holder(file, agentId) {
    try {
        const m = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!m || !alive(m.pid)) return null;
        return m.agentId && agentId && m.agentId !== agentId ? null : m;
    } catch (e) {
        return null;
    }
}

function main(argv, env) {
    const opts = parseArgs(argv);
    if (!opts) return Promise.resolve({ text: USAGE, code: 2 });
    const o = waitFor(opts, env || process.env);
    if (o.error) return Promise.resolve({ text: 'await.js: ' + o.error, code: 1 });
    const marker = o.handoff + '.await';
    const live = holder(marker, o.agentId);
    if (live) return Promise.resolve({ text: 'already awaiting ' + (live.agentId || o.agentId || '?') + ' — another await is waiting on this agent already: end your turn; its line will come.' });
    try {
        fs.mkdirSync(path.dirname(marker), { recursive: true });
        fs.writeFileSync(marker, JSON.stringify({ pid: process.pid, agentId: o.agentId }));
    } catch (e) { /* unmarked: this wait still runs, only unguarded */ }
    const release = () => {
        try {
            if (JSON.parse(fs.readFileSync(marker, 'utf8')).pid === process.pid) fs.unlinkSync(marker);
        } catch (e) { /* gone already */ }
    };
    return awaitHandoff(o).then((state) => {
        release();
        // A group brain returns with no gate, so hooks/gate.js never clears its
        // mark; its own handoff arriving is the only signal there is. A close mark
        // is left standing for hooks/gate.js, once the gate is confirmed.
        if (state === 'lost' || (state === 'handoff' && o.kind !== 'close' && Number.isInteger(o.group)))registry.clearInflight(o.root, opts.session, o.agentId);
        return { text: lineFor(state, o, state === 'commit' ? newestCommit(o.commit, o.since) : null) };
    }, (e) => {
        release();
        throw e;
    });
}

if (require.main === module) {
    main(process.argv.slice(2)).then(({ text, code }) => {
        process.stdout.write(text + '\n');
        if (code) process.exitCode = code;
    });
}

module.exports = { main };
