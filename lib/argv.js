'use strict';

// The argv, for the commands whose positional is the user's own words.
//
// `node:util` reads any token with a leading dash as a flag however the shell
// quoted it, so a sentence that began with one never reached its command as
// text: it was filed under a flag named for the whole sentence. `task.js note`
// answered `Give the note.`, which at least said so. `ledger.js ruling` dropped
// one of four parts, still had the three it checks for, and recorded the rest as
// though nothing had gone missing.
//
// Only the commands taking arbitrary text need this. Everywhere else the
// positional is a value from a fixed set — a stage name, a guard word, a session
// id, a task number — where a stray dash is a typo and swallowing it as a value
// would be the worse answer.
//
// The caller passes the same table its own parser uses, so there is no second
// list of flags to keep in step, and a flag the table does not know stays text —
// which under these commands is exactly right: an unrecognised dash is the
// user's words.
function freeText(argv, name, stringFlags) {
    const at = argv.indexOf(name);
    // Every caller takes the name out of this same argv. Returning the whole of
    // it on a miss would hand back the caller's own flags as the user's sentence.
    if (at === -1) return [];

    const text = [];
    for (let i = at + 1; i < argv.length; i++) {
        const arg = argv[i];
        const eq = arg.indexOf('=');
        const flag = arg.startsWith('--') ? arg.slice(2, eq === -1 ? undefined : eq) : null;
        if (flag !== null && Object.hasOwn(stringFlags, flag)) {
            // `--session X` spends the next argument; `--session=X` does not.
            if (eq === -1) i++;
            continue;
        }
        text.push(arg);
    }
    return text;
}

// Where the flags stop and the user's words begin.
//
// `freeText` filters an argv the parser has already read, which is enough for a
// dash the table does not know. Against one it *does* know there is nothing left
// to filter: `parseArgs` consumed the token and acted on it before the filter
// ran, so `ledger.js complete 1 "--plan=elsewhere.md" "..."` wrote a whole new
// ledger under `elsewhere`, reported success, and dropped the word from the note.
// Both of that script's flags are paths, and a path has no shape to check a
// value against — so the fix is not a better check but an earlier split.
//
// Everything from the verb on is the user's words, including a word spelled
// exactly like a flag. The caller passes the same table its own parser uses, so
// there is no second list to keep in step.
function splitAtVerb(argv, stringFlags) {
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith('--')) return { head: argv.slice(0, i), verb: arg, text: argv.slice(i + 1) };

        const eq = arg.indexOf('=');
        const flag = arg.slice(2, eq === -1 ? undefined : eq);
        // `--root w` spends the next argument; `--root=w` does not. A flag the
        // table does not know spends nothing: no row says it takes a value, and
        // guessing that it does would swallow the verb.
        if (eq === -1 && Object.hasOwn(stringFlags, flag)) i++;
    }
    // No verb: the whole argv is flags. The caller still parses the head, which
    // is what names a flag left without its value.
    return { head: argv, verb: undefined, text: [] };
}

module.exports = { freeText, splitAtVerb };
