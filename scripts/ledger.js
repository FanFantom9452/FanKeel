#!/usr/bin/env node
'use strict';

// The ledger, from the command line. Three verbs, because three is what the build
// loop actually does to it: open it, say a task is done, and — after a compaction
// — ask what it already knows.
//
// **Flags precede the verb.** Everything after it is the user's words, down to a
// word spelled exactly like a flag. `--plan` and `--root` are both paths, and a
// path has no shape to validate a value against, so a note beginning `--plan=`
// would otherwise redirect the write to a ledger nobody asked for and say the
// task was complete. Every documented call already puts the flags first; this
// makes that the rule rather than the habit.
//
// The same shapelessness ran the other way too: `--plan init complete 1 note`
// handed the verb to the flag and wrote `.fankeel/build/init/`. No flag spends a
// verb now, so that lands on the refusal below with nothing after it.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');

const ledger = require('../lib/ledger.js');
const { splitAtVerb } = require('../lib/argv.js');

function fail(message) {
    process.stdout.write(message + '\n');
    process.exit(1);
}

// Every string flag, and the key it lands on. A table rather than a list because
// `splitAtVerb` reads it too, and two lists of the same flags drift.
const STRING_FLAGS = { root: 'root', plan: 'plan' };

// The verbs, in the order the refusal at the bottom lists them. A set rather
// than four literals for the same reason the flags are a table: `splitAtVerb`
// reads it too, so that no flag spends one, and two lists of the same verbs
// drift.
const VERBS = new Set(['init', 'complete', 'ruling', 'show']);

// `strict: false` keeps an unknown flag silent. A declared flag given no value
// comes back `true` rather than a string, and that is the refusal below: a flag
// typed with nothing after it is a mistake worth naming, not a default worth
// guessing at.
//
// It is given the head alone, never the whole argv — which is what stops a note
// from being read as a flag.
function parseArgs(argv) {
    const options = {};
    for (const flag of Object.keys(STRING_FLAGS)) options[flag] = { type: 'string' };

    const { values } = parseArgv({ args: argv, strict: false, allowPositionals: true, options });
    const opts = {};
    for (const [flag, key] of Object.entries(STRING_FLAGS)) {
        if (values[flag] === undefined) continue;
        if (typeof values[flag] !== 'string') fail('--' + flag + ' needs a value.');
        opts[key] = values[flag];
    }
    return opts;
}

function main(argv) {
    const { head, verb: named, text } = splitAtVerb(argv, STRING_FLAGS, VERBS);
    const opts = parseArgs(head);
    const root = path.resolve(opts.root || process.cwd());
    if (!opts.plan) fail('--plan <path to the plan file> is required.');
    const verb = String(named || 'show').toLowerCase();

    if (verb === 'init') {
        return 'fankeel ledger — ' + ledger.init(root, opts.plan);
    }

    if (verb === 'complete') {
        const n = Number(text[0]);
        if (!Number.isInteger(n) || n < 1) fail('complete <task number> "<what landed>"');
        const note = text.slice(1).join(' ');
        // A completion line with no note is a tick nobody can check, and this
        // file exists to be read by someone who does not remember writing it.
        if (!note.trim()) fail('Say what landed. A completion line with no note is a tick nobody can check.');
        ledger.append(root, opts.plan, ledger.completionLine(n, note));
        return 'fankeel ledger — Task ' + n + ' complete.';
    }

    if (verb === 'ruling') {
        const parts = text;
        if (parts.length < 3) fail('ruling "<what you decided>" "<why>" "<what it costs if wrong>"');
        ledger.append(root, opts.plan, ledger.rulingLine(parts[0], parts[1], parts.slice(2).join(' ')));
        return 'fankeel ledger — ruling recorded.';
    }

    if (verb === 'show') {
        const file = ledger.ledgerPath(root, opts.plan);
        let contents = '';
        try {
            contents = fs.readFileSync(file, 'utf8');
        } catch (e) {
            return 'fankeel ledger — none yet at ' + file + '\nRun `init` before the first task.';
        }
        if (!ledger.owns(contents, opts.plan)) {
            return 'fankeel ledger — ' + file + ' belongs to another plan. Leave it; `init` starts your own.';
        }
        const done = ledger.completed(contents);
        return 'fankeel ledger — ' + file
            + '\n\n  complete: ' + (done.length ? done.join(', ') : 'nothing yet')
            + '\n\nResume at the first task not listed. Trust this and git log over what you remember.';
    }

    return fail('Verbs: ' + [...VERBS].join(', ') + '.');
}

if (require.main === module) {
    process.stdout.write(main(process.argv.slice(2)) + '\n');
}
