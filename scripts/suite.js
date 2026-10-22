#!/usr/bin/env node
'use strict';
// scripts/suite.js: run the suite once — the whole of it, or with --fast the set
// without the tests named @slow — and record it for `task.js land`.
//
//   node scripts/suite.js --session <id> [--command "<test command>"] [--root <dir>] [--tree <dir>] [--check] [--fast]
//
// Prints one line — `suite: <pass> pass, <fail> fail @ <sha8>`, or `suite: ok @ <sha8>`
// / `suite: red @ <sha8>` for a runner that is not node --test — writes
// .fankeel/build/task-<started>/suite.json, and exits 0 for a green suite, 1 for
// a red one, no active entry, a worktree that is gone or a usage error. The
// suite runs in --tree when given — a worktree the entry does not record, whose
// path then goes into suite.json as `tree` — else the entry's worktree when it
// has one, else the project root; the sha is that tree's HEAD.
// A node --test run red in exactly one test file is run again on that file
// alone (lib/suite.js retryOnce); if that passes, the record is green, carries
// `retried`, and the line says `— retried <file> alone, passed: <names>`.
// Two or more red files still fail.
// The command is --command, else that tree's package.json test script.
// --check runs no test and writes nothing: it asks lib/suite.js's blocker whether
// the record already made still stands, and prints `suite: record stands @ <sha8>`
// or `suite: no suite to run` with exit 0, `suite: <why not>` with exit 1.
// --fast runs package.json's test:fast — the suite without the tests named
// @slow — and records fast: true, which land refuses; with no test:fast it
// runs test and says so. The run waits on lib/suitelock.js's machine-wide
// lock while another suite.js holds it, keeps that lock's `out` fresh while its
// suite prints, and gives its command
// FANKEEL_SUITE_HELD so a suite.js inside that run takes no lock.
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const registry = require('../lib/registry.js');
const docs = require('../lib/docs.js');
const suite = require('../lib/suite.js');
const lock = require('../lib/suitelock.js');
const { worktreeOf } = require('../lib/guard.js');

// The one line a waiting run prints: who holds the lock, where, since when and
// how long ago its suite last printed — or, stuck, that the lock is dead and
// could not be removed.
function waitLine(h, file, stuck, now = Date.now()) {
    if (stuck) return 'suite: waiting — lock ' + file + ' is stale and could not be removed; delete it by hand';
    if (h.unreadable) return 'suite: waiting — lock ' + file + ' is being written';
    const at = new Date(h.at);
    const since = String(at.getHours()).padStart(2, '0') + ':' + String(at.getMinutes()).padStart(2, '0');
    const printed = Number.isFinite(h.out) ? '; last output ' + Math.floor((now - h.out) / 60000) + ' min ago' : '; no output recorded yet';
    return 'suite: waiting — pid ' + h.pid + (h.session ? ' (session ' + h.session + ')' : '') + ' has run the suite in ' + (h.tree || '?') + ' since ' + since + printed + '; lock ' + file;
}

function main(argv) {
    const { values } = parseArgs({
        args: argv, strict: false,
        options: { session: { type: 'string' }, command: { type: 'string' }, root: { type: 'string' }, tree: { type: 'string' }, check: { type: 'boolean' }, fast: { type: 'boolean' } },
    });
    if (!values.session) return { text: 'suite: --session <id> is required.', ok: false };
    if (values.tree !== undefined && typeof values.tree !== 'string') return { text: 'suite: --tree needs a directory.', ok: false };
    const root = registry.resolveRoot(values.root || undefined);
    const data = registry.readSession(root, values.session);
    if (!data || data.active !== true) return { text: 'suite: no active entry for ' + values.session + ' under ' + root, ok: false };
    const projectRoot = docs.projectRootsFor(root, data.project ? [data.project] : [])[0] || root;
    if (values.check) {
        const why = suite.blocker(root, data, projectRoot);
        if (why) return { text: 'suite: ' + why, ok: false };
        const rec = suite.readRecord(root, data);
        return { text: rec ? 'suite: record stands @ ' + (rec.sha ? rec.sha.slice(0, 8) : 'no repo') : 'suite: no suite to run', ok: true };
    }
    const wt = worktreeOf(data);
    const given = values.tree ? path.resolve(values.tree) : null;
    if (given && !fs.existsSync(given)) return { text: 'suite: --tree ' + values.tree + ' does not exist', ok: false };
    if (given && wt) return { text: 'suite: this entry has its own worktree, ' + wt.path + ' — --tree is for a tree the entry does not record', ok: false };
    if (given && !suite.sameRepo(given, projectRoot)) return { text: 'suite: --tree ' + values.tree + ' is not a checkout of ' + projectRoot, ok: false };
    const tree = given || suite.treeFor(root, data, projectRoot);
    if (!given && wt && !fs.existsSync(tree)) return { text: 'suite: ' + wt.path + ' is not a worktree any more', ok: false };
    const fastCmd = values.fast && !values.command ? suite.testCommand(tree, 'test:fast') : null;
    if (fastCmd && fastCmd.error) return { text: 'suite: ' + fastCmd.error + ' — fix it or pass --command "<cmd>".', ok: false };
    const fast = typeof fastCmd === 'string';
    const found = values.command || fast ? null : suite.testCommand(tree);
    if (found && found.error) return { text: 'suite: ' + found.error + ' — fix it or pass --command "<cmd>".', ok: false };
    const command = values.command || fastCmd || found;
    if (!command) return { text: 'suite: no test command — package.json has no scripts.test; pass --command "<cmd>".', ok: false };
    const lockAt = lock.lockFile();
    const held = process.env.FANKEEL_SUITE_HELD === lockAt ? null
        : lock.acquire({ file: lockAt, owner: { session: values.session, tree, command }, onWait: (h, stuck) => process.stdout.write(waitLine(h, lockAt, stuck) + '\n') });
    let result;
    try {
        const env = { FANKEEL_SUITE_HELD: lockAt };
        const opts = { lock: held ? { file: lockAt, pid: held.pid, at: held.at } : null };
        result = suite.retryOnce(tree, suite.runSuite(tree, command, env, opts), env, opts);
    } finally {
        // A lock left behind is cleared once this pid is gone; losing the record of a
        // suite that already ran is worse, so a failed release is said and not thrown.
        try { if (held) held.release(); } catch (e) { process.stderr.write('suite: could not remove the lock ' + lockAt + ' (' + e.code + ')\n'); }
    }
    if (fast) result.fast = true;
    if (given) result.tree = given;
    const file = suite.record(root, data, result);
    const sha = result.sha ? result.sha.slice(0, 8) : 'no repo';
    const line = result.pass != null
        ? 'suite: ' + result.pass + ' pass, ' + result.fail + ' fail @ ' + sha
        : 'suite: ' + (result.ok ? 'ok' : 'red') + ' @ ' + sha;
    const retried = result.retried ? ' — retried ' + result.retriedFile + ' alone, passed: ' + result.retried.join('; ') : '';
    const noFast =values.fast && !values.command && !fast ? ' (no test:fast script — ran the whole suite)' : '';
    const tap = file && !result.ok && fs.existsSync(suite.tapPath(file)) ? ' — TAP: ' + suite.tapPath(file) : '';
    return { text: line + retried + noFast + tap + (file ? '' : ' (not recorded: the entry has no started stamp)'), ok: result.ok };
}

if (require.main === module) {
    const r = main(process.argv.slice(2));
    process.stdout.write(r.text + '\n');
    process.exit(r.ok ? 0 : 1);
}

module.exports = { main, waitLine };
