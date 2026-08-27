#!/usr/bin/env node
'use strict';

// The ledger, from the command line. Three verbs, because three is what the build
// loop actually does to it: open it, say a task is done, and — after a compaction
// — ask what it already knows.

const fs = require('node:fs');
const path = require('node:path');

const ledger = require('../lib/ledger.js');

function fail(message) {
    process.stdout.write(message + '\n');
    process.exit(1);
}

function parseArgs(argv) {
    const opts = { positional: [] };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--root' || argv[i] === '--plan') {
            if (argv[i + 1] === undefined) fail(argv[i] + ' needs a value.');
            opts[argv[i].slice(2)] = argv[++i];
            continue;
        }
        if (argv[i].startsWith('--')) continue;
        opts.positional.push(argv[i]);
    }
    return opts;
}

function main(argv) {
    const opts = parseArgs(argv);
    const root = path.resolve(opts.root || process.cwd());
    if (!opts.plan) fail('--plan <path to the plan file> is required.');
    const verb = String(opts.positional[0] || 'show').toLowerCase();

    if (verb === 'init') {
        return 'fankeel ledger — ' + ledger.init(root, opts.plan);
    }

    if (verb === 'complete') {
        const n = Number(opts.positional[1]);
        if (!Number.isInteger(n) || n < 1) fail('complete <task number> "<what landed>"');
        const note = opts.positional.slice(2).join(' ');
        // A completion line with no note is a tick nobody can check, and this
        // file exists to be read by someone who does not remember writing it.
        if (!note.trim()) fail('Say what landed. A completion line with no note is a tick nobody can check.');
        ledger.append(root, opts.plan, ledger.completionLine(n, note));
        return 'fankeel ledger — Task ' + n + ' complete.';
    }

    if (verb === 'ruling') {
        const parts = opts.positional.slice(1);
        if (parts.length < 3) fail('ruling "<what you decided>" "<why>" "<what it costs if wrong>"');
        ledger.append(root, opts.plan, ledger.rulingLine(parts[0], parts[1], parts.slice(2).join(' ')));
        return 'fankeel ledger — ruling recorded.';
    }

    if (verb === 'show') {
        const file = ledger.ledgerPath(root, opts.plan);
        let text = '';
        try {
            text = fs.readFileSync(file, 'utf8');
        } catch (e) {
            return 'fankeel ledger — none yet at ' + file + '\nRun `init` before the first task.';
        }
        if (!ledger.owns(text, opts.plan)) {
            return 'fankeel ledger — ' + file + ' belongs to another plan. Leave it; `init` starts your own.';
        }
        const done = ledger.completed(text);
        return 'fankeel ledger — ' + file
            + '\n\n  complete: ' + (done.length ? done.join(', ') : 'nothing yet')
            + '\n\nResume at the first task not listed. Trust this and git log over what you remember.';
    }

    return fail('Verbs: init, complete, ruling, show.');
}

if (require.main === module) {
    process.stdout.write(main(process.argv.slice(2)) + '\n');
}
