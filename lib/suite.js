'use strict';
// lib/suite.js: a suite run's result, recorded where `task.js land` can
// refuse on it. Until 2026-10-09 "red stops everything" was a sentence in
// skills/fankeel-land/SKILL.md and nothing checked it: the 10-08 land commit
// carried a red tests/source.test.js. The record is one JSON file beside the
// task's handoffs, `.fankeel/build/task-<started>/suite.json`:
//   { sha, at, command, pass, fail, failed, ok, ms, runs } plus `tree` under suite.js --tree
// plus fast: true where suite.js --fast ran package.json's test:fast, which land refuses.
// `sha` is HEAD when it ran (null outside a repository); `pass` and `fail`
// are node --test's TAP totals, null for another runner; `failed` is the leaf names of the
// `not ok` lines, null for another runner; `ok` is exit 0.
// `ms` is the whole milliseconds the command took.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { dirFor } = require('./handoff.js');
const { worktreeOf } = require('./guard.js');

const NODE_TEST = /\bnode\s+--test\b/;

// `failed` is the name on every `not ok` line that is a leaf: node prints a
// parent's result after its children's, so a test point whose previous test
// point sat deeper is a parent. A `# TODO` or `# SKIP` does not fail the run.
function parseTap(text) {
    const pass = /^# pass (\d+)/m.exec(text);
    const fail = /^# fail (\d+)/m.exec(text);
    const failed = [];
    let prev = -1;
    for (const line of String(text).split(/\r?\n/)) {
        const point = /^(\s*)(not )?ok \d+ - (.+)$/.exec(line);
        if (!point) continue;
        const indent = point[1].length;
        if (point[2] && indent >= prev && !/\s#\s*(TODO|SKIP)\b/i.test(point[3])) failed.push(point[3]);
        prev = indent;
    }
    return { pass: pass ? Number(pass[1]) : null, fail: fail ? Number(fail[1]) : null, failed };
}

function headOf(dir) {
    const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
}

// Two directories are checkouts of one repository when git names the same common dir for both.
function sameRepo(a, b) {
    const common = (dir) => {
        const r = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: dir, encoding: 'utf8' });
        return r.status === 0 ? path.resolve(r.stdout.trim()) : null;
    };
    const x = common(a);
    return x !== null && x === common(b);
}

// Where the suite runs and is judged: the entry's own worktree when it has
// one, as scripts/land.js resolves it, else the project root.
function treeFor(root, data, projectRoot) {
    const wt = worktreeOf(data);
    return wt ? path.resolve(root, wt.path) : projectRoot;
}

// package.json's script `name` — `test` unless asked for `test:fast`; null
// where there is none to run; { error } where package.json exists but does
// not parse, which is not the same as no script.
function testCommand(projectRoot, name = 'test') {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
        const t = pkg.scripts && pkg.scripts[name];
        return typeof t === 'string' && t.trim() ? t.trim() : null;
    } catch (e) {
        return e.code === 'ENOENT' ? null : { error: 'package.json does not parse' };
    }
}

// node --test runs with the tap reporter so the totals read the same whether
// or not stdout is a terminal; any other command is run as given. extraEnv
// goes to the command — suite.js passes FANKEEL_SUITE_HELD there; lock, { file, pid, at }, is the suite lock this process holds.
function runSuite(projectRoot, command, extraEnv = {}, { lock = null } = {}) {
    const isNode = NODE_TEST.test(command);
    const cmd = isNode ? command.replace(NODE_TEST, 'node --test --test-reporter=tap') : command;
    // A parent node --test sets NODE_TEST_CONTEXT, which turns a child's reporter into a subtest stream with no totals.
    const env = { ...process.env, ...extraEnv };
    delete env.NODE_TEST_CONTEXT;
    const opts = { cwd: projectRoot, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 };
    const started = Date.now();
    // Holding the lock, the command runs under the relay below, which sees its
    // output as it comes and keeps the lock's `out` fresh; spawnSync alone blocks
    // this process until the command exits.
    const r = lock
        ? spawnSync(process.execPath, [__filename, '--relay'], { ...opts, env: { ...env, FANKEEL_RELAY_CMD: cmd, FANKEEL_RELAY_LOCK: JSON.stringify(lock) } })
        : spawnSync(cmd, { ...opts, env, shell: true });
    const ms = Date.now() - started;
    const totals = isNode ? parseTap(String(r.stdout || '')) : { pass: null, fail: null, failed: null };
    return { sha: headOf(projectRoot), at: new Date().toISOString(), command, pass: totals.pass, fail: totals.fail, failed: totals.failed, ok: r.status === 0, ms };
}

function recordPath(root, data) {
    const dir = dirFor(root, data);
    return dir ? dir + '/suite.json' : null;
}

// The top level stays the last run — the fields `blocker` reads — and `runs`
// keeps every run of this task in order, each without a `runs` of its own, the
// last RUNS_KEPT of them. Until 2026-10-10 a green run overwrote the red one
// before it, and the names of the tests that had failed went with it.
const RUNS_KEPT = 20;

function record(root, data, result) {
    const file = recordPath(root, data);
    if (!file) return null;
    const prev = readRecord(root, data);
    const run = { ...result };
    delete run.runs;
    const runs = (prev && Array.isArray(prev.runs) ? prev.runs : []).concat([run]).slice(-RUNS_KEPT);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ ...run, runs }, null, 2) + '\n');
    return file;
}

function readRecord(root, data) {
    const file = recordPath(root, data);
    if (!file) return null;
    if (!fs.existsSync(file)) return null;
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { unreadable: file }; }
}

// Every run before the last that was not green, as { run, sha, failed } with
// `run` counted from 1 in `runs`. A record with no `runs` has none to name.
function redBefore(rec) {
    const runs = rec && Array.isArray(rec.runs) ? rec.runs : [];
    const out = [];
    runs.slice(0, -1).forEach((r, i) => {
        if (r.ok !== true) out.push({ run: i + 1, sha: r.sha == null ? null : r.sha, failed: r.failed == null ? null : r.failed });
    });
    return out;
}

// Why `task.js land` must not go on, or null. Refusals, in the order made: a
// worktree that is gone; a package.json that does not parse (it cannot be read
// as "no suite to run"); no record where a suite is runnable; a record that
// does not parse; a red record; a fast record — suite.js --fast skipped the
// tests named @slow, and land runs everything; git unable to read HEAD, or to diff since the
// record's sha; a code change since the record — any changed file that is not
// .md, which lets land's own document edits through. A record that names its own
// tree — suite.js --tree — is checked against that tree while it exists, is a checkout of this project, and the entry has no worktree of its own.
function blocker(root, data, projectRoot) {
    const rec = readRecord(root, data);
    const wt = worktreeOf(data);
    const own = !wt && rec && typeof rec.tree === 'string' && fs.existsSync(rec.tree) && sameRepo(rec.tree, projectRoot) ? rec.tree : null;
    const tree = own || treeFor(root, data, projectRoot);
    if (wt && !fs.existsSync(tree)) return wt.path + ' is not a worktree any more — land stops';
    if (!rec) {
        const cmd = testCommand(tree);
        if (cmd && cmd.error) return cmd.error + ' — fix it, then run suite.js';
        return cmd ? 'no suite record — run `node scripts/suite.js --session <id>` first' : null;
    }
    if (rec.unreadable) return 'suite record at ' + rec.unreadable + ' does not parse — run suite.js again';
    if (rec.ok !== true) {
        return 'suite is red at ' + String(rec.sha || '?').slice(0, 8) + (rec.fail != null ? ' (' + rec.fail + ' fail)' : '') + ' — land stops';
    }
    if (rec.fast === true) {
        return 'suite ran the fast set at ' + String(rec.sha || 'no repo').slice(0, 8) + ' — land runs everything: node scripts/suite.js --session <id>';
    }
    const head = headOf(tree);
    if (rec.sha && !head) return 'suite ran at ' + rec.sha.slice(0, 8) + ' and git cannot read HEAD in ' + tree + ' — run suite.js again';
    if (rec.sha && rec.sha !== head) {
        const r = spawnSync('git', ['diff', '--name-only', rec.sha, head], { cwd: tree, encoding: 'utf8' });
        if (r.status !== 0) return 'suite ran at ' + rec.sha.slice(0, 8) + ' and git cannot say what changed since — run suite.js again';
        const code = r.stdout.split(/\r?\n/).filter((f) => f && !/\.md$/i.test(f));
        if (code.length) {
            return 'suite ran at ' + rec.sha.slice(0, 8) + ', and ' + code[0] + (code.length > 1 ? ' and ' + (code.length - 1) + ' more' : '') + ' changed since — run suite.js again';
        }
    }
    return null;
}

module.exports = { parseTap, treeFor, sameRepo, testCommand, runSuite, recordPath, record, readRecord, redBefore, blocker };

// runSuite's relay: the command's stdout and stderr pass through byte for byte,
// so the caller's captured stdout and exit status are the command's own, and
// every chunk is a sign of life the lock is touched with, at most once per
// REFRESH_MS (lib/suitelock.js).
function relay(env = process.env) {
    const { spawn } = require('node:child_process');
    const { refresher } = require('./suitelock.js');
    const mine = JSON.parse(env.FANKEEL_RELAY_LOCK);
    const childEnv = { ...env };
    delete childEnv.FANKEEL_RELAY_CMD;
    delete childEnv.FANKEEL_RELAY_LOCK;
    const seen = refresher(mine.file, mine);
    const child = spawn(env.FANKEEL_RELAY_CMD, { cwd: process.cwd(), env: childEnv, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (b) => { process.stdout.write(b); seen(); });
    child.stderr.on('data', (b) => { process.stderr.write(b); seen(); });
    child.on('error', () => { process.exitCode = 1; });
    child.on('close', (code) => { process.exitCode = code === null ? 1 : code; });
}

if (require.main === module && process.argv[2] === '--relay') relay();
