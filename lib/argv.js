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

module.exports = { freeText };
