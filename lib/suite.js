'use strict';
// lib/suite.js: the full suite's result, recorded where `task.js land` can
// refuse on it. Until 2026-10-09 "red stops everything" was a sentence in
// skills/fankeel-land/SKILL.md and nothing checked it: the 10-08 land commit
// carried a red tests/source.test.js. The record is one JSON file beside the
// task's handoffs, `.fankeel/build/task-<started>/suite.json`:
//   { sha, at, command, pass, fail, failed, ok }
// `sha` is HEAD when it ran (null outside a repository); `pass` and `fail`
// are node --test's TAP totals, null for another runner; `failed` is the leaf names of the
// `not ok` lines, null for another runner; `ok` is exit 0.
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

// Where the suite runs and is judged: the entry's own worktree when it has
// one, as scripts/land.js resolves it, else the project root.
function treeFor(root, data, projectRoot) {
    const wt = worktreeOf(data);
    return wt ? path.resolve(root, wt.path) : projectRoot;
}

// package.json's test script; null where there is none to run; { error } where
// package.json exists but does not parse, which is not the same as no script.
function testCommand(projectRoot) {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
        const t = pkg.scripts && pkg.scripts.test;
        return typeof t === 'string' && t.trim() ? t.trim() : null;
    } catch (e) {
        return e.code === 'ENOENT' ? null : { error: 'package.json does not parse' };
    }
}

// node --test runs with the tap reporter so the totals read the same whether
// or not stdout is a terminal; any other command is run as given.
function runSuite(projectRoot, command) {
    const isNode = NODE_TEST.test(command);
    const cmd = isNode ? command.replace(NODE_TEST, 'node --test --test-reporter=tap') : command;
    // A parent node --test sets NODE_TEST_CONTEXT, which turns a child's reporter into a subtest stream with no totals.
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(cmd, { cwd: projectRoot, env, shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const totals = isNode ? parseTap(String(r.stdout || '')) : { pass: null, fail: null, failed: null };
    return { sha: headOf(projectRoot), at: new Date().toISOString(), command, pass: totals.pass, fail: totals.fail, failed: totals.failed, ok: r.status === 0 };
}

function recordPath(root, data) {
    const dir = dirFor(root, data);
    return dir ? dir + '/suite.json' : null;
}

function record(root, data, result) {
    const file = recordPath(root, data);
    if (!file) return null;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
    return file;
}

function readRecord(root, data) {
    const file = recordPath(root, data);
    if (!file) return null;
    if (!fs.existsSync(file)) return null;
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { unreadable: file }; }
}

// Why `task.js land` must not go on, or null. Refusals, in the order made: a
// worktree that is gone; a package.json that does not parse (it cannot be read
// as "no suite to run"); no record where a suite is runnable; a record that
// does not parse; a red record; git unable to read HEAD, or to diff since the
// record's sha; a code change since the record — any changed file that is not
// .md, which lets land's own document edits through.
function blocker(root, data, projectRoot) {
    const tree = treeFor(root, data, projectRoot);
    const wt = worktreeOf(data);
    if (wt && !fs.existsSync(tree)) return wt.path + ' is not a worktree any more — land stops';
    const rec = readRecord(root, data);
    if (!rec) {
        const cmd = testCommand(tree);
        if (cmd && cmd.error) return cmd.error + ' — fix it, then run suite.js';
        return cmd ? 'no suite record — run `node scripts/suite.js --session <id>` first' : null;
    }
    if (rec.unreadable) return 'suite record at ' + rec.unreadable + ' does not parse — run suite.js again';
    if (rec.ok !== true) {
        return 'suite is red at ' + String(rec.sha || '?').slice(0, 8) + (rec.fail != null ? ' (' + rec.fail + ' fail)' : '') + ' — land stops';
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

module.exports = { parseTap, treeFor, testCommand, runSuite, recordPath, record, readRecord, blocker };
