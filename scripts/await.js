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
const { handoffPath, commitPath, ledgerCommitPath, answerPath, awaitHandoff, newestCommit } = require('../lib/handoff.js');
const { newestPlan } = require('../lib/render.js');
const { transcriptOf } = require('../lib/detail.js');
const { sessionDirOf, agentFiles } = require('../lib/usage.js');
const { configDirOf } = require('../lib/profile.js');

const USAGE = 'await.js: usage: await.js --session <id> [--root <dir>] [--since <file>] [--idle <seconds>] [--timeout <seconds>]';
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
function commitCandidates(root, data, lap) {
    const candidates = [commitPath(root, data, data.stage, lap)];
    if (data.stage === 'build') {
        const plan = newestPlan(root, data.started);
        const ledger = ledgerCommitPath(root, plan, data.stage);
        if (ledger) candidates.push(ledger);
    }
    return candidates.filter(Boolean);
}

// What `awaitHandoff` is given, from the record. The agent counts as lost only
// when its own transcript exists: an agent nobody can find is never judged.
function waitFor(opts, env) {
    const root = opts.root ? registry.resolveRoot(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const data = registry.readSession(root, opts.session);
    if (!data) return { error: 'no session ' + opts.session + ' under ' + root };
    // The lap the running stage agent was briefed with, off its in-flight mark
    // (hooks/brief.js). A `moves` entry added after the dispatch — three false
    // `lost` reports on 2026-09-24 — would otherwise move the watch to a lap the
    // agent never writes. No mark for this stage: the lap from `moves`, as before.
    const mark = data.inflight && data.inflight.stage === data.stage ? data.inflight : null;
    const lap = mark && Number.isInteger(mark.lap) && mark.lap > 0 ? mark.lap : undefined;
    const handoff = handoffPath(root, data, data.stage, lap);
    if (!handoff) return { error: 'session ' + opts.session + ' has no stage or no started time, so no handoff path' };
    let since = 0;
    try {
        since = fs.statSync(opts.since || answerPath(root, data, data.stage, lap)).mtimeMs;
    } catch (e) { /* nothing answered yet: any report counts */ }
    const agentId = mark && typeof mark.agentId === 'string' && mark.agentId ? mark.agentId : null;
    let activity = () => [];
    const dir = agentId ? sessionDirOf(transcriptOf(data.configDir || configDirOf(env), opts.session)) : null;
    if (dir) {
        const own = path.join(dir, 'subagents', 'agent-' + agentId + '.jsonl');
        activity = () => (fs.existsSync(own) ? agentFiles(dir) : []);
    }
    return { handoff, commit: commitCandidates(root, data, lap), since, agentId, activity, idleMs: opts.idle * 1000, timeoutMs: opts.timeout * 1000 };
}

// The word first, so the controller's rule can name it; then what to do, so
// the rule does not have to carry every case under the injection's cap.
// `commitFile` is the candidate that actually matched — `o.commit` may be
// several paths, and only one of them was written.
function lineFor(state, o, commitFile) {
    if (state === 'handoff') return 'handoff ' + o.handoff + ' — print this path and ask its gate as your rules say, unless you already asked it and the file has not changed since.';
    if (state === 'commit') return 'commit ' + commitFile + ' — run `node ' + COMMIT_SCRIPT + ' "' + commitFile + '"` and SendMessage the agent what it printed, exactly. After a `commit.js:` line, run await again with `--since "' + commitFile + '"` added.';
    if (state === 'lost') return 'lost ' + o.agentId + ' — the stage agent stopped with neither file written: dispatch a fresh one with the same line.';
    return 'timeout — nothing moved in ' + Math.round(o.timeoutMs / 60000) + ' minutes: run await again.';
}

function main(argv, env) {
    const opts = parseArgs(argv);
    if (!opts) return Promise.resolve({ text: USAGE, code: 2 });
    const o = waitFor(opts, env || process.env);
    if (o.error) return Promise.resolve({ text: 'await.js: ' + o.error, code: 1 });
    return awaitHandoff(o).then((state) => ({ text: lineFor(state, o, state === 'commit' ? newestCommit(o.commit, o.since) : null) }));
}

if (require.main === module) {
    main(process.argv.slice(2)).then(({ text, code }) => {
        process.stdout.write(text + '\n');
        if (code) process.exitCode = code;
    });
}

module.exports = { main };
