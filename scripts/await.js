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
const { handoffPath, commitPath, answerPath, awaitHandoff } = require('../lib/handoff.js');
const { transcriptOf } = require('../lib/detail.js');
const { sessionDirOf, agentFiles } = require('../lib/usage.js');
const { configDirOf } = require('../lib/profile.js');

const USAGE = 'await.js: usage: await.js --session <id> [--root <dir>] [--since <file>] [--idle <seconds>] [--timeout <seconds>]';
const COMMIT_SCRIPT = path.join(__dirname, 'commit.js').replace(/\\/g, '/');

// Flag and value pairs only. Null for anything else, which prints the usage line.
function parseArgs(argv) {
    const opts = { idle: 120, timeout: 1800 };
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

// What `awaitHandoff` is given, from the record. The agent counts as lost only
// when its own transcript exists: an agent nobody can find is never judged.
function waitFor(opts, env) {
    const root = opts.root ? registry.resolveRoot(opts.root) : registry.rootFor({ cwd: process.cwd() });
    const data = registry.readSession(root, opts.session);
    if (!data) return { error: 'no session ' + opts.session + ' under ' + root };
    const handoff = handoffPath(root, data, data.stage);
    if (!handoff) return { error: 'session ' + opts.session + ' has no stage or no started time, so no handoff path' };
    let since = 0;
    try {
        since = fs.statSync(opts.since || answerPath(root, data, data.stage)).mtimeMs;
    } catch (e) { /* nothing answered yet: any report counts */ }
    const mark = data.inflight;
    const agentId = mark && mark.stage === data.stage && typeof mark.agentId === 'string' && mark.agentId ? mark.agentId : null;
    let activity = () => [];
    const dir = agentId ? sessionDirOf(transcriptOf(data.configDir || configDirOf(env), opts.session)) : null;
    if (dir) {
        const own = path.join(dir, 'subagents', 'agent-' + agentId + '.jsonl');
        activity = () => (fs.existsSync(own) ? agentFiles(dir) : []);
    }
    return { handoff, commit: commitPath(root, data, data.stage), since, agentId, activity, idleMs: opts.idle * 1000, timeoutMs: opts.timeout * 1000 };
}

// The word first, so the controller's rule can name it; then what to do, so
// the rule does not have to carry every case under the injection's cap.
function lineFor(state, o) {
    if (state === 'handoff') return 'handoff ' + o.handoff + ' — print this path and ask its gate as your rules say, unless you already asked it and the file has not changed since.';
    if (state === 'commit') return 'commit ' + o.commit + ' — run `node ' + COMMIT_SCRIPT + ' "' + o.commit + '"` and SendMessage the agent what it printed, exactly. After a `commit.js:` line, run await again with `--since "' + o.commit + '"` added.';
    if (state === 'lost') return 'lost ' + o.agentId + ' — the stage agent stopped with neither file written: dispatch a fresh one with the same line.';
    return 'timeout — nothing moved in ' + Math.round(o.timeoutMs / 60000) + ' minutes: run await again.';
}

function main(argv, env) {
    const opts = parseArgs(argv);
    if (!opts) return Promise.resolve({ text: USAGE, code: 2 });
    const o = waitFor(opts, env || process.env);
    if (o.error) return Promise.resolve({ text: 'await.js: ' + o.error, code: 1 });
    return awaitHandoff(o).then((state) => ({ text: lineFor(state, o) }));
}

if (require.main === module) {
    main(process.argv.slice(2)).then(({ text, code }) => {
        process.stdout.write(text + '\n');
        if (code) process.exitCode = code;
    });
}

module.exports = { main };
