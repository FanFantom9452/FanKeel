#!/usr/bin/env node
'use strict';
// scripts/suite.js: run the full suite once and record it for `task.js land`.
//
//   node scripts/suite.js --session <id> [--command "<test command>"] [--root <dir>]
//
// Prints one line — `suite: <pass> pass, <fail> fail @ <sha8>`, or `suite: ok @ <sha8>`
// / `suite: red @ <sha8>` for a runner that is not node --test — writes
// .fankeel/build/task-<started>/suite.json, and exits 0 for a green suite, 1 for
// a red one, no active entry, a worktree that is gone or a usage error. The
// suite runs in the entry's worktree when it has one, else the project root;
// the sha is that tree's HEAD.
// The command is --command, else that tree's package.json test script.
const fs = require('node:fs');
const { parseArgs } = require('node:util');
const registry = require('../lib/registry.js');
const docs = require('../lib/docs.js');
const suite = require('../lib/suite.js');
const { worktreeOf } = require('../lib/guard.js');

function main(argv) {
    const { values } = parseArgs({
        args: argv, strict: false,
        options: { session: { type: 'string' }, command: { type: 'string' }, root: { type: 'string' } },
    });
    if (!values.session) return { text: 'suite: --session <id> is required.', ok: false };
    const root = registry.resolveRoot(values.root || undefined);
    const data = registry.readSession(root, values.session);
    if (!data || data.active !== true) return { text: 'suite: no active entry for ' + values.session + ' under ' + root, ok: false };
    const projectRoot = docs.projectRootsFor(root, data.project ? [data.project] : [])[0] || root;
    const tree = suite.treeFor(root, data, projectRoot);
    const wt = worktreeOf(data);
    if (wt && !fs.existsSync(tree)) return { text: 'suite: ' + wt.path + ' is not a worktree any more', ok: false };
    const found = values.command ? null : suite.testCommand(tree);
    if (found && found.error) return { text: 'suite: ' + found.error + ' — fix it or pass --command "<cmd>".', ok: false };
    const command = values.command || found;
    if (!command) return { text: 'suite: no test command — package.json has no scripts.test; pass --command "<cmd>".', ok: false };
    const result = suite.runSuite(tree, command);
    const file = suite.record(root, data, result);
    const sha = result.sha ? result.sha.slice(0, 8) : 'no repo';
    const line = result.pass != null
        ? 'suite: ' + result.pass + ' pass, ' + result.fail + ' fail @ ' + sha
        : 'suite: ' + (result.ok ? 'ok' : 'red') + ' @ ' + sha;
    return { text: line + (file ? '' : ' (not recorded: the entry has no started stamp)'), ok: result.ok };
}

if (require.main === module) {
    const r = main(process.argv.slice(2));
    process.stdout.write(r.text + '\n');
    process.exit(r.ok ? 0 : 1);
}

module.exports = { main };
