#!/usr/bin/env node
'use strict';

// The ledger, from the command line. Three verbs, because three is what the build
// loop actually does to it: open it, say a task is done, and — after a compaction
// — ask what it already knows.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');

const ledger = require('../lib/ledger.js');
const { freeText } = require('../lib/argv.js');

function fail(message) {
    process.stdout.write(message + '\n');
    process.exit(1);
}

// Every string flag, and the key it lands on. A table rather than a list because
// `freeText` reads it too, and two lists of the same flags drift.
const STRING_FLAGS = { root: 'root', plan: 'plan' };

// `strict: false` keeps an unknown flag silent. A declared flag given no value
// comes back `true` rather than a string, and that is the refusal below: a flag
// typed with nothing after it is a mistake worth naming, not a default worth
// guessing at.
function parseArgs(argv) {
    const options = {};
    for (const flag of Object.keys(STRING_FLAGS)) options[flag] = { type: 'string' };

    const { values, positionals } = parseArgv({ args: argv, strict: false, allowPositionals: true, options });
    const opts = { positional: positionals };
    for (const [flag, key] of Object.entries(STRING_FLAGS)) {
        if (values[flag] === undefined) continue;
        if (typeof values[flag] !== 'string') fail('--' + flag + ' needs a value.');
        opts[key] = values[flag];
    }
    return opts;
}

function main(argv) {
    const opts = parseArgs(argv);
    const root = path.resolve(opts.root || process.cwd());
    if (!opts.plan) fail('--plan <path to the plan file> is required.');
    const named = String(opts.positional[0] || 'show');
    const verb = named.toLowerCase();

    // What follows the verb, for the two whose positional is the user's own
    // words. The parser cannot give it back: `node:util` reads any token with a
    // leading dash as a flag however the shell quoted it, so a part beginning
    // `--` was filed under a flag named for the whole sentence and never arrived.
    // Taken from `named` rather than `verb` because the verb is matched
    // case-insensitively and the argv holds whatever was typed.
    const text = freeText(argv, named, STRING_FLAGS);

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
