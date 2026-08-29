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
//
// Nothing calls this now. `scripts/task.js` was the last one and moved to
// `splitAroundVerb` below, which closes the half a filter cannot reach. The
// export and its cases stay until somebody rules on them; TODO.md carries it.
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
//
// `verbs` is the other half of that table, and it stops the split from running
// one token early. A flag whose value has no shape takes whatever follows it, so
// `ledger.js --plan init complete 1 note` filed the verb `init` as the plan and
// wrote a ledger at `.fankeel/build/init/` — reporting success, with the build
// loop told a task was complete that its own ledger would never list. That is
// the same silent redirect the split was written to close, reached from the
// other side.
//
// A verb is never a value. Leaving it unspent drops the flag into the head with
// nothing after it, where the caller's own `needs a value` refusal already
// waits — one branch, reached from one more direction, rather than a second
// message saying the same thing. `--plan=init` still means it, because the `=`
// form never spends a token. Omit `verbs` and every flag spends its next token
// exactly as before.
const isVerb = (arg, verbs) => Boolean(verbs) && arg !== undefined && verbs.has(String(arg).toLowerCase());

function splitAtVerb(argv, stringFlags, verbs) {
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith('--')) return { head: argv.slice(0, i), verb: arg, text: argv.slice(i + 1) };

        const eq = arg.indexOf('=');
        const flag = arg.slice(2, eq === -1 ? undefined : eq);
        // `--root w` spends the next argument; `--root=w` does not. A flag the
        // table does not know spends nothing: no row says it takes a value, and
        // guessing that it does would swallow the verb. Nor does one spend a verb.
        if (eq === -1 && Object.hasOwn(stringFlags, flag) && !isVerb(argv[i + 1], verbs)) i++;
    }
    // No verb: the whole argv is flags. The caller still parses the head, which
    // is what names a flag left without its value.
    return { head: argv, verb: undefined, text: [] };
}

// Flags on both sides, which is the shape `scripts/task.js` actually has.
//
// `splitAtVerb` cuts once, from the left, because `ledger.js` puts its flags
// before the verb and every documented call already did. `task.js` is the
// mirror: `note "..." --session <id>`, `stage build --session <id>`, `clear <id>
// --force --session <id>` — the flags come last, in the skill, in its own usage
// text, in both commands `lib/guard.js` and `lib/render.js` print for a person
// to copy, and in 103 test calls. Taking everything after the verb as text would
// file `--session` as the note.
//
// So the words are not what follows the verb; they are what sits between the
// flags at either end. Peel the trailing group from the right, hand the rest to
// `splitAtVerb`, and the middle is never offered to the parser at all — which is
// what keeps a word spelled `--root=x` a word.
//
// The trailing flags go in front of the head, and that order is load-bearing.
// `node:util` gives a string flag whatever token follows it, `--session`
// included, so `['--root', '--session', 'S']` reads as `root: "--session"` with
// `S` left over as the command name. A flag left without a value has to stay
// last for the caller's own `needs a value` refusal to reach it. Nothing else
// reads `head`; it exists to be parsed.
function splitAroundVerb(argv, stringFlags, verbs) {
    // Where the user's words begin: the token after the verb. It is the one
    // place an unrecognised dash cannot be a flag, and the two shipped commands
    // that settle it are the same argv shape apart from that. `note --force`
    // records `--force` as the note; `clear <id> --force --session <id>` is
    // printed by `lib/guard.js` for a person to copy and means the flag. Nothing
    // about the token tells them apart — only where it sits.
    const firstWord = splitAtVerb(argv, stringFlags, verbs).head.length + 1;

    // Flags reached with nothing after them, kept apart from the rest so they can
    // be put last. Order in the argv is not enough: `start --task --session <id>`
    // peels `--session <id>` as a pair and leaves `--task` in the middle, where
    // `node:util` hands it `--session` as its value and the refusal never fires —
    // which is what the whole-argv parser did before this split existed, so it is
    // an old hole rather than a new one. Two of them in one argv still cannot
    // both be last; the earlier one wins, exactly as it did before.
    const dangling = new Set();

    let end = argv.length;
    while (end > 0) {
        const last = argv[end - 1];
        const eq = last.indexOf('=');

        if (last.startsWith('--')) {
            // A flag the table knows spends no second token in the `=` form, and
            // in the bare form has been left without its value — `start
            // --session <id> --root <dir> --task`. Peel it either way: the
            // parser is where `--task needs a value.` comes from, and stopping
            // in front of it hands every earlier flag to the text instead.
            if (Object.hasOwn(stringFlags, last.slice(2, eq === -1 ? undefined : eq))) {
                // Reaching one in the bare form means nothing followed it: the
                // pair branch below takes `--root <dir>` from the value's side.
                if (eq === -1) dangling.add(end - 1);
                end -= 1;
                continue;
            }
            // Unknown, so it spends nothing — a boolean, or a word. Which one is
            // the position above, and only that.
            if (end - 1 === firstWord) break;
            end -= 1;
            continue;
        }

        // A verb is never a value here either. `--root down` reaching the right
        // peel would take the verb off the end and leave an argv that looks like
        // flags all the way down, which is the same swallow from the far side.
        const before = end >= 2 ? argv[end - 2] : undefined;
        const spends = before !== undefined && before.startsWith('--')
            && before.indexOf('=') === -1 && Object.hasOwn(stringFlags, before.slice(2))
            && !isVerb(last, verbs);
        if (!spends) break;
        end -= 2;
    }

    const trailing = [];
    const withoutValue = [];
    for (let i = end; i < argv.length; i++) (dangling.has(i) ? withoutValue : trailing).push(argv[i]);

    // The leading flags sit between the two, because a verb the left split
    // refused to spend leaves its own flag dangling at the end of that half —
    // `--root down` — and with nothing here to follow it that one is already last.
    const { head, verb, text } = splitAtVerb(argv.slice(0, end), stringFlags, verbs);
    return { head: trailing.concat(head, withoutValue), verb, text };
}

module.exports = { freeText, splitAtVerb, splitAroundVerb };
