#!/usr/bin/env node
'use strict';
// One fresh `claude -p` per stage of a fankeel task. The stage's brief is the
// one a stage agent gets; its gate goes to the station as a pending file; the
// answer moves the stage through task.js, or runs the stage again with the
// answer, or stops. Three caps — rounds, dollars, wall-clock — and a handoff
// with no `status` stop it, each with its own reason on one JSON line.
//
//   node scripts/drive.js --session <id> [--root <dir>] [--max-rounds 12]
//        [--max-usd 20] [--timeout 3600] [--gate-wait 86400]

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const handoff = require('../lib/handoff.js');
const profileLib = require('../lib/profile.js');
const { renderBrief } = require('../lib/render.js');
const { spawnClaudeAsync } = require('./eval.js');
const { within } = require('../lib/tracked.js');

const PLUGIN = path.join(__dirname, '..');
const STATUSES = ['done', 'partial', 'blocked'];
const STATUS_RULE = 'Your handoff\'s `json gate` block must carry a top-level "status": "done", "partial" or "blocked".';
// The same line scripts/bench.js stops at: under this much left, a call
// cannot do a stage's work.
const USD_FLOOR = 0.5;

function parse(argv) {
    const { values } = parseArgv({
        args: argv,
        options: {
            session: { type: 'string' },
            root: { type: 'string' },
            'max-rounds': { type: 'string', default: '12' },
            'max-usd': { type: 'string', default: '20' },
            timeout: { type: 'string', default: '3600' },
            'gate-wait': { type: 'string', default: '86400' },
        },
    });
    return {
        session: values.session,
        root: values.root,
        maxRounds: Number(values['max-rounds']),
        maxUsd: Number(values['max-usd']),
        timeoutMs: Number(values.timeout) * 1000,
        gateWaitMs: Number(values['gate-wait']) * 1000,
    };
}

function capReason(state, caps, now, deadline) {
    if (state.rounds >= caps.maxRounds) return 'rounds';
    if (caps.maxUsd - state.usd < USD_FLOOR) return 'usd';
    if (now >= deadline) return 'timeout';
    return null;
}

// Where the first question's answer sends the driver: its own option one
// moves on (or stands down at the route's end), a pause pauses, and anything
// else is an answer the stage has to read.
function afterAnswer(gate, answers, route, stage) {
    const q = gate.questions[0];
    const got = String(answers[q.question] || '');
    const first = q.options[0].label;
    if (got === first) {
        const to = route[route.indexOf(stage) + 1];
        return !to || /^(down|收工)/i.test(first) ? { kind: 'down' } : { kind: 'advance', to };
    }
    if (/暫停|pause/i.test(got)) return { kind: 'pause' };
    return { kind: 'relay' };
}

function lastJson(text) {
    const lines = String(text || '').trim().split(/\r?\n/).reverse();
    for (const line of lines) {
        try {
            const got = JSON.parse(line);
            if (got && typeof got === 'object' && !Array.isArray(got)) return got;
        } catch (e) { /* not this line */ }
    }
    return null;
}

const insidePlugin = (root, plugin) => within(plugin, root);

function argsFor(usdLeft, pluginDir = PLUGIN) {
    return ['-p', '--plugin-dir', pluginDir, '--permission-mode', 'acceptEdits', '--allowedTools', 'Bash(node:*),Bash(git:*)', '--output-format', 'json', '--max-budget-usd', usdLeft.toFixed(2)];
}

const mtime = (file) => { try { return fs.statSync(file).mtimeMs; } catch (e) { return 0; } };

// The brain brief for this stage, with `stage.agents` forced to it so
// renderBrief takes the brain branch whatever the project's profile says.
function briefFor(root, session, data) {
    const profile = profileLib.profileFor(root, data);
    const values = Object.assign({}, profile && profile.values, { 'stage.agents': [data.stage] });
    return renderBrief({ mine: { sessionId: session, data }, agentType: 'fankeel:fankeel-brain', root, profile: Object.assign({}, profile, { values }), transcriptPath: null, group: null });
}

// Posts the gate as the station's pending file and waits for its answer, or
// for `until`; the pending file goes either way.
async function waitAnswer(root, data, gate, opts, deps) {
    const pending = handoff.pendingPath(root, data, data.stage);
    const answer = handoff.answerPath(root, data, data.stage);
    const since = Date.now();
    handoff.writeAnswer(pending, JSON.stringify({ questions: gate.questions, at: since, until: since + opts.gateWaitMs }) + '\n');
    try {
        while (Date.now() - since < opts.gateWaitMs) {
            await deps.sleep(deps.pollMs);
            const got = handoff.answersSince(answer, since);
            if (got) return { answers: got, file: answer, waited: Date.now() - since };
        }
        return { answers: null, waited: Date.now() - since };
    } finally {
        try { fs.unlinkSync(pending); } catch (e) { /* already gone */ }
    }
}

async function drive(opts, deps = {}) {
    const root = opts.root ? registry.resolveRoot(opts.root) : (registry.findStateRoot(process.cwd()) || process.cwd());
    const plugin = deps.plugin || PLUGIN;
    if (!insidePlugin(root, plugin)) return run(opts, deps, root, plugin);
    // A loaded plugin's own files are sensitive to Claude Code, so a stage could
    // not write its handoff into the tree it was loaded from; drive from a
    // detached copy of HEAD. docs/90-agent/reports/evidence/2026-10-15-drive-allow/result.tsv
    const git = deps.git || ((args) => execFileSync('git', args, { windowsHide: true, encoding: 'utf8', stdio: 'pipe' }));
    const copy = path.join(os.tmpdir(), 'fankeel-drive-plugin-' + process.pid + '-' + Date.now());
    try {
        // A run killed before its finally leaves a registration behind.
        git(['-C', plugin, 'worktree', 'prune']);
        git(['-C', plugin, 'worktree', 'add', '--detach', copy, 'HEAD']);
    } catch (e) {
        const data = registry.readSession(root, opts.session);
        return { stopped: 'error', rounds: 0, usd: 0, stage: data ? data.stage : null, detail: 'git worktree add failed: ' + e.message };
    }
    try {
        return await run(opts, deps, root, copy);
    } finally {
        try {
            git(['-C', plugin, 'worktree', 'remove', '--force', copy]);
        } catch (e) {
            process.stderr.write('drive: could not remove the plugin copy ' + copy + ': ' + e.message + '\n');
            // Best effort: the stop line is already decided, and a failed prune only leaves the registration for the next run's prune.
            try { git(['-C', plugin, 'worktree', 'prune']); } catch (e2) { /* see above */ }
        }
    }
}

// No Claude Code process holds the driven session, so task.js would refuse its
// id while any other session runs (2026-10-15: the rerun's answer could not move
// build to verify). This process names itself as that session's shell, the shape
// live.envSession accepts: its pid is running and no sessions/<pid>.json says otherwise.
function taskEnv(env, id, pid) {
    return Object.assign({}, env, { CLAUDE_CODE_SESSION_ID: id, CLAUDE_PID: String(pid) });
}

async function run(opts, deps, root, pluginDir) {
    const d = {
        spawn: deps.spawn,
        pollMs: deps.pollMs || 1000,
        sleep: deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms))),
        task: deps.task || ((args) => (deps.execFile || execFileSync)(process.execPath, [path.join(__dirname, 'task.js'), ...args, '--session', opts.session, '--root', root], { encoding: 'utf8', windowsHide: true, env: taskEnv(opts.env || process.env, opts.session, process.pid) })),
    };
    const state = { rounds: 0, usd: 0, waited: 0, start: Date.now() };
    const stop = (stopped, extra) => {
        const data = registry.readSession(root, opts.session);
        return Object.assign({ stopped, rounds: state.rounds, usd: Math.round(state.usd * 100) / 100, stage: data ? data.stage : null }, extra);
    };
    let relay = null;
    for (;;) {
        try {
            const data = registry.readSession(root, opts.session);
            if (!data || data.active !== true) return stop('error', { detail: 'no active session ' + opts.session });
            const stage = data.stage;
            const deadline = state.start + opts.timeoutMs + state.waited;
            const cap = capReason(state, opts, Date.now(), deadline);
            if (cap) return stop(cap);
            const brief = briefFor(root, opts.session, data);
            if (!brief) return stop('error', { detail: 'no brief for ' + stage });
            const file = handoff.handoffPath(root, data, stage, handoff.lapOf(data, stage));
            const before = mtime(file);
            const prompt = brief + '\n\n' + STATUS_RULE + (relay ? '\nThe user\'s answer is in ' + relay + '.' : '');
            const r = await spawnClaudeAsync(argsFor(opts.maxUsd - state.usd, pluginDir), { cwd: root, env: opts.env, input: prompt, timeout: Math.max(1, deadline - Date.now()) }, d.spawn);
            state.rounds++;
            const out = lastJson(r.stdout);
            const cost = out && out.total_cost_usd;
            if (Number.isFinite(cost)) state.usd += cost;
            if (r.error && r.error.code === 'ETIMEDOUT') return stop('timeout');
            if (r.error) return stop('error', { detail: r.error.message });
            // A round that reports no cost would leave --max-usd unable to trip.
            if (!Number.isFinite(cost)) return stop('error', { detail: 'the round reported no total_cost_usd' });
            const nextStage = data.route[data.route.indexOf(stage) + 1] || null;
            const gate = mtime(file) > before ? handoff.readGate(file, nextStage, data.route) : null;
            if (!gate || gate.invalid || !STATUSES.includes(gate.status)) return stop('status', { handoff: file });
            const got = await waitAnswer(root, data, gate, opts, d);
            state.waited += got.waited;
            if (!got.answers) return stop('gate', { handoff: file });
            const next = afterAnswer(gate, got.answers, data.route, stage);
            if (next.kind === 'advance') {
                d.task(['stage', next.to]);
                relay = null;
            } else if (next.kind === 'down') {
                d.task(['down']);
                return stop('down');
            } else if (next.kind === 'pause') {
                d.task(['next', gate.next || 'paused at ' + stage]);
                return stop('pause');
            } else {
                relay = got.file;
            }
        } catch (e) {
            return stop('error', { detail: e.message });
        }
    }
}

if (require.main === module) {
    const opts = parse(process.argv.slice(2));
    if (!opts.session) {
        process.stderr.write('drive: --session <id> is required\n');
        process.exit(2);
    }
    drive(opts).then((out) => {
        process.stdout.write(JSON.stringify(out) + '\n');
        process.exit(out.stopped === 'down' || out.stopped === 'pause' ? 0 : 1);
    }).catch((e) => {
        process.stdout.write(JSON.stringify({ stopped: 'error', detail: e.message }) + '\n');
        process.exit(1);
    });
}

module.exports = { parse, capReason, afterAnswer, lastJson, argsFor, insidePlugin, taskEnv, drive };
