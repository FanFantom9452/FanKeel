#!/usr/bin/env node
'use strict';

// The ledger, from the command line. Four verbs, because four is what the build
// loop actually does to it: open it, say a task is done, and — after a compaction
// — ask what it already knows, and ask which of a plan's tasks may go out together.
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
const plantasks = require('../lib/plantasks.js');

function fail(message) {
    process.stdout.write(message + '\n');
    process.exit(1);
}

// Every string flag, and the key it lands on. A table rather than a list because
// `splitAtVerb` reads it too, and two lists of the same flags drift.
const STRING_FLAGS = { root: 'root', plan: 'plan', range: 'range' };

// The verbs, in the order the refusal at the bottom lists them. A set rather
// than four literals for the same reason the flags are a table: `splitAtVerb`
// reads it too, so that no flag spends one, and two lists of the same verbs
// drift.
const VERBS = new Set(['init', 'complete', 'ruling', 'show', 'groups', 'ranges']);

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

// Why a plan that grouped into nothing but singletons grouped that way, in the
// words the reader can act on. `groups` compares a task only against the open
// group, so when every group closed at one task each consecutive pair is exactly
// a comparison that closed one — asking `conflict` about those pairs re-runs the
// comparisons that produced the result rather than guessing at them. Counting
// the file the most tasks share would have been shorter and wrong: a plan
// serialised by `Consumes`/`Produces` edges has no shared file to count, and
// naming one anyway would send the reader to rewrite the wrong block.
function serialCause(tasks) {
    const shared = new Set();
    let edge = false;
    for (let i = 0; i + 1 < tasks.length; i++) {
        const [a, b] = [tasks[i], tasks[i + 1]];
        const reason = plantasks.conflict(a, b);
        if (reason === 'interface') edge = true;
        if (reason !== 'files') continue;
        const owned = [...b.modify, ...b.test];
        for (const p of [...a.modify, ...a.test]) if (owned.includes(p)) shared.add(p);
    }
    if (shared.size) return 'Shared by consecutive tasks: ' + [...shared].join(', ');
    // Only when no pair shared a file at all, so this never overwrites the more
    // actionable half of a mixed answer.
    if (edge) return 'A Consumes/Produces edge joins each pair, so'
        + '\nthe order is the dependency rather than a filename.';
    // Nothing left to add: the pairs conflicted on `undeclared`, which the line
    // above has already named by task number.
    return '';
}

// `init` and `groups` both reach for this exact sentence when a plan parses to
// zero tasks, because they are the same underlying failure seen from two call
// sites: `parseTasks` requires `^##\s+Task\s+(\d+):\s*`, and a heading
// punctuated with a dash instead of a colon — which every other heading in a
// plan is free to use — matches nothing, silently. A plan with six visible
// tasks then parses to zero without an error anywhere to point at, and `init`
// still builds a ledger that looks perfectly healthy on top of it. Sharing the
// literal string is what keeps a reader who meets this from one verb and later
// from the other recognising it as the same answer, not two different guesses.
const CONFORMING_HEADING = 'A conforming heading looks like `## Task 1: name` — note the colon after the number.';

function main(argv) {
    const { head, verb: named, text } = splitAtVerb(argv, STRING_FLAGS, VERBS);
    const opts = parseArgs(head);
    const root = path.resolve(opts.root || process.cwd());
    if (!opts.plan) fail('--plan <path to the plan file> is required.');
    const verb = String(named || 'show').toLowerCase();

    if (verb === 'init') {
        // `lib/ledger.js`'s own `init()` only opens the progress file; it never
        // reads the plan, so a plan whose headings do not match `parseTasks`
        // opens a ledger that looks perfectly healthy and stays silent about
        // holding zero tasks until `groups` is run, if it is run at all — a
        // whole build can pass with no denominator. `lib/ledger.js` is off
        // limits to fix that: its return value is `append()`'s own path
        // argument and `tests/ledger.test.js` asserts on it. So the count is
        // taken here, where the plan path this verb was given is already at
        // hand and `plantasks` is already required.
        const ledgerFile = ledger.init(root, opts.plan);
        const planFile = path.resolve(root, opts.plan);
        let planText = null;
        try {
            planText = fs.readFileSync(planFile, 'utf8');
        } catch (e) {
            // Not a refusal: a `bounded` or `spike` route reaches the build
            // stage with no plan file at all, and opening a ledger anyway is
            // this verb's whole job for that route. Refusing here would break
            // the one route that legitimately has nothing to be wrong about.
        }
        if (planText === null) {
            return 'fankeel ledger — ' + ledgerFile
                + '\n\nNo file at ' + planFile + '. The ledger is open regardless.';
        }
        const tasks = plantasks.parseTasks(planText);
        if (!tasks.length) {
            return 'fankeel ledger — ' + ledgerFile
                + '\n\nNo task headings found in ' + planFile + '. ' + CONFORMING_HEADING;
        }
        return 'fankeel ledger — ' + ledgerFile
            + '\n\n' + tasks.length + ' tasks in ' + planFile;
    }

    if (verb === 'complete') {
        const n = Number(text[0]);
        if (!Number.isInteger(n) || n < 1) fail('complete <task number> "<what landed>"');
        const note = text.slice(1).join(' ');
        // A completion line with no note is a tick nobody can check, and this
        // file exists to be read by someone who does not remember writing it.
        if (!note.trim()) fail('Say what landed. A completion line with no note is a tick nobody can check.');
        // Refused on the way in rather than dropped on the way out. A range the
        // parser cannot read back still reaches the file, and `ranges` then
        // reports the row as a task that recorded none — naming two causes,
        // neither of which happened. The shape is `lib/ledger.js`'s own, so this
        // refuses exactly what that parser would have skipped.
        if (opts.range !== undefined && !ledger.isRange(opts.range)) {
            fail('--range wants two commit shas: <base>..<head>, 7 to 40 hex each. '
                + '"' + opts.range + '" would reach the file and read back as no range at all.');
        }
        ledger.append(root, opts.plan, ledger.completionLine(n, note, opts.range));
        return 'fankeel ledger — Task ' + n + ' complete.';
    }

    if (verb === 'ruling') {
        const parts = text;
        if (parts.length < 3) fail('ruling "<what you decided>" "<why>" "<what it costs if wrong>"');
        ledger.append(root, opts.plan, ledger.rulingLine(parts[0], parts[1], parts.slice(2).join(' ')));
        return 'fankeel ledger — ruling recorded.';
    }

    if (verb === 'groups') {
        const file = path.resolve(root, opts.plan);
        let text = '';
        try {
            text = fs.readFileSync(file, 'utf8');
        } catch (e) {
            return fail('No plan at ' + file);
        }
        const tasks = plantasks.parseTasks(text);
        const rows = plantasks.groups(tasks);
        const surfaced = plantasks.surfaces(tasks);
        if (!tasks.length) {
            // "no tasks in <file>" alone reads as "this plan is empty," and the
            // far more likely cause is a heading `parseTasks` could not match —
            // the same failure `init` now names, in the same words, so a reader
            // who meets this from `groups` after already seeing it from `init`
            // recognises it rather than treating it as a second problem.
            return 'fankeel ledger — no tasks in ' + file
                + ' — more likely a heading did not match than an empty plan.'
                + '\n' + CONFORMING_HEADING;
        }
        // A task that declared no files conflicts with everything, so it lands
        // alone and the grouping looks merely unlucky rather than incomplete.
        // Naming it is what makes a missing `**Files:**` block visible at the
        // moment it costs something, rather than a plan rule nobody re-read.
        const undeclared = tasks.filter((t) => !t.modify.length).map((t) => t.n);
        // Every group a singleton means nothing ever runs beside anything, and
        // the disjointness sentence below is then a claim about a pair that does
        // not exist. A plan whose tasks all appended to one index file read as an
        // ordinary grouping and built serially with nothing saying so, because
        // the numbers said it and the prose underneath said the opposite. So the
        // prose goes when it stops being true, and the warning gets a paragraph
        // of its own — the first line is already the ratio, and what was missing
        // was something that contradicted rather than merely failed to mention.
        const serial = tasks.length > 1 && rows.length === tasks.length;
        const cause = serial ? serialCause(tasks) : '';
        const prose = plantasks.proseConflicts(tasks, rows).map((p) =>
            'Task ' + p.n + ' names Task ' + p.other + ' in its Consumes text, and both land in group '
            + p.group + ': "' + p.text + '"');
        return 'fankeel ledger — ' + rows.length + ' groups over ' + tasks.length + ' tasks\n\n'
            + surfaced.map((g, i) => '  ' + (i + 1) + ': ' + g.tasks.join(', ') + '  — ' + g.surface).join('\n')
            + (undeclared.length
                ? '\n\nNo Files block, so serialised against everything: ' + undeclared.join(', ')
                : '')
            + (prose.length
                ? '\n\nConsumes text names a task already in its own group, worth a look:\n  '
                    + prose.join('\n  ')
                : '')
            + (serial
                ? '\n\nEvery group is one task, so nothing runs beside anything and this'
                    + '\nplan builds serially.' + (cause ? ' ' + cause : '')
                : '')
            + '\n\nOne group is one surface: one dispatch, two Agents in one response, or one Workflow.'
            // Still true of what the tasks declared even when `prose.length`,
            // but true is not the bar: printed three lines under a finding
            // that says "worth a look," it reads as the answer to that
            // finding rather than a claim about a different thing (declared
            // identifiers, not prose), and the reader leaves concluding the
            // warning was noise. Withheld, not reworded — the sentence itself
            // did not become false.
            + (serial || prose.length ? '' : ' Their files are disjoint and neither'
                + '\nconsumes what the other produces.')
            + ' Commit them one at a time as they'
            + '\nreturn, in the order listed.';
    }

    if (verb === 'ranges') {
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
        const rows = ledger.completions(contents);
        if (!rows.length) return 'fankeel ledger — nothing complete yet at ' + file;
        const lines = rows.map((r) => '  ' + r.n + ' ' + (r.range || '(no range recorded)'));
        // A missing range is named rather than dropped. Silence here is a task
        // that landed and never got a verifier, which is the failure this verb
        // exists to prevent.
        const blind = rows.filter((r) => !r.range).length;
        return 'fankeel ledger — ' + file + '\n\n' + lines.join('\n')
            + (blind ? '\n\nA row with no range was completed before this field existed, or without\n--range. Read it against git log rather than here.' : '')
            + '\n\nOne verifier per row, pinned at both ends. The rows do not overlap, so\nthey may go out in one response.';
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
