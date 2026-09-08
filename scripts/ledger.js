#!/usr/bin/env node
'use strict';

// The ledger, from the command line. Ten verbs, because ten is what the build
// loop actually does to it: open it, say a task is done, and — after a compaction
// — ask what it already knows, and ask which of a plan's tasks may go out together.
// `lint`, `brief` and `fix` came with the 2026-09-07 plan-quality change: check a
// plan against its design, write one task's brief file, and record a reviewed fix.
// `scan` came the same day: it writes the `groups` report into the ledger, so the
// build stage's step-3 scan table has one producer instead of a session pasting
// it in by hand.
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
const { execFileSync } = require('node:child_process');
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
const VERBS = new Set(['init', 'complete', 'ruling', 'show', 'groups', 'scan', 'ranges', 'lint', 'brief', 'fix']);

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
        if (reason === 'files') {
            const owned = [...b.modify, ...b.test];
            for (const p of [...a.modify, ...a.test]) if (owned.includes(p)) shared.add(p);
        }
        if (reason === 'read') {
            for (const p of a.read || []) if ([...b.modify, ...b.test].includes(p)) shared.add(p);
            for (const p of b.read || []) if ([...a.modify, ...a.test].includes(p)) shared.add(p);
        }
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

// What a dispatched implementer cannot infer and the brief must therefore
// carry: it receives this file and nothing else. Fixed text, so that every
// brief says it the same way and a reviewer can hold the return to it.
const FOOTER = [
    '## Rules you cannot infer',
    '',
    '- The files you may read are named above, under Files (Modify, Test, Read) and Interfaces. Never walk `/`, a home directory or a Temp directory. A file you need that is not named here is returned as `blocked: <the file>`, in your first turn.',
    '- A file the task text names that the Files block does not list is returned as `blocked: <the file> is named but not declared`, before anything is built.',
    '- Neighbours are editing other files in this working tree. Run only your own test command, never the full suite.',
    '- Do not commit, and do not touch the index, HEAD or branch state.',
    '- Write the failing tests first and watch them fail. Every new test must be shown red once: name the mutation that reddens it.',
    '- Return, and nothing else: a status line (`done`, `partial: <what>` or `blocked: <why>`), the paths you wrote, the `ℹ pass` and `ℹ fail` line, and one line per new test as `<test name> — red when: <the mutation>`. Never a diff, never a summary of the code: every line you return stays in a long-running parent context for the rest of the session.',
].join('\n');

// The paragraph opening with `**Label:**`, to the next blank line: a Goal wraps.
function paragraph(header, label) {
    const lines = String(header || '').split(/\r?\n/);
    const at = lines.findIndex((l) => l.trim().startsWith('**' + label + ':**'));
    if (at === -1) return '';
    const out = [];
    for (let i = at; i < lines.length && lines[i].trim(); i++) out.push(lines[i]);
    return out.join('\n');
}

// A `## <heading>` section of the header, heading included, to the next `## `.
function section(header, heading) {
    const lines = String(header || '').split(/\r?\n/);
    const at = lines.findIndex((l) => l.trim() === '## ' + heading);
    if (at === -1) return '';
    const out = [lines[at]];
    for (let i = at + 1; i < lines.length && !/^##\s/.test(lines[i]); i++) out.push(lines[i]);
    return out.join('\n').replace(/\s+$/, '');
}

// The design a plan argues from, off its `**Spec:**` line: a bare path, or a
// markdown link, either one relative to the plan's own directory.
function specPath(planFile, header) {
    const line = paragraph(header, 'Spec');
    if (!line) return null;
    const value = line.replace(/^\s*\*\*Spec:\*\*\s*/, '').trim();
    const link = /\]\(([^)]+)\)/.exec(value);
    const rel = (link ? link[1] : value).replace(/`/g, '').trim();
    return path.resolve(path.dirname(planFile), rel);
}

function readPlan(root, plan) {
    const file = path.resolve(root, plan);
    try {
        return { file, text: fs.readFileSync(file, 'utf8') };
    } catch (e) {
        return fail('No plan at ' + file);
    }
}

// The whole `groups` report, as one string. `groups` prints it and `scan`
// writes it into the ledger, and both read it from here so the two can never
// drift into two different tables for the same plan.
function groupsReport(root, planOpt) {
    const file = path.resolve(root, planOpt);
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
    const noInterfaces = plantasks.missingInterfaces(tasks);
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
        + (noInterfaces.length
            ? '\n\nNo Interfaces block, so never a workflow: ' + noInterfaces.join(', ')
            : '')
        // Whether this should be withheld per group rather than per report is
        // open: a clean group in a plan that carries one prose `Consumes:`
        // somewhere else loses an accurate claim about itself.
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

// `scan`'s heading, and the shape of every other line `progress.md` already
// holds. `scan` is the only verb that ever writes a `## ` line, so the next
// one of those — or the next line that matches an ordinary ledger entry
// appended after it by `complete`, `ruling` or `fix` — is where its block
// ends; nothing else in this file has a shape to confuse it with.
// Exact equality, not a pattern. `scan` owns the first line that is exactly
// this heading and rewrites the block under it; a second copy pasted under any
// other heading is invisible to it and survives untouched, which is what makes
// a hand-kept table beside a generated one safe.
const SCAN_HEADING = '## groups';
const LEDGER_LINE = /^(Task \d+: complete\b|Ruling: |Fix: |## )/;

// Replaces `scan`'s previous block in place, rather than appending a second
// copy below whatever was written after it. Not found is not a failure: the
// first `scan` on a plan has nothing to replace, and the block goes at the
// end like any other entry.
function withScan(existing, report) {
    const block = SCAN_HEADING + '\n\n' + String(report).trim() + '\n';
    const body = String(existing || '');
    const lines = body.replace(/\r\n/g, '\n').split('\n');
    const start = lines.findIndex((l) => l === SCAN_HEADING);
    if (start === -1) return body.replace(/\n*$/, '\n') + '\n' + block;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
        if (LEDGER_LINE.test(lines[i])) { end = i; break; }
    }
    const before = lines.slice(0, start).join('\n').replace(/\n*$/, '\n');
    const after = lines.slice(end).join('\n');
    return before + '\n' + block + after;
}

// The commit set a range covers, for the overlap check `ranges` prints below.
// `null` for a row with no range recorded — nothing to compare, and not the
// same as a range that covers zero commits — so it never reaches this
// function: `ranges` filters those rows out before building the list, the
// same way `(no range recorded)` already tells the reader not to trust this
// report for them. `undefined` is different: a range recorded but unreadable
// — a fixture sha that was never committed, or `root` not being a git
// repository at all, both of which the test suite exercises. Both cases are
// left out of the comparison rather than defaulted to "covers nothing," which
// is what would make "the rows do not overlap" a guess dressed up as a
// finding.
function commitsFor(root, range) {
    if (!range) return null;
    try {
        const out = execFileSync('git', ['rev-list', range], {
            cwd: root,
            encoding: 'utf8',
            maxBuffer: 32 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        return new Set(out.split(/\r?\n/).filter(Boolean));
    } catch (e) {
        return undefined;
    }
}

// Every element of `a` is also in `b`.
const subsetOf = (a, b) => [...a].every((sha) => b.has(sha));

// The paragraph `ranges` ends its report on, computed from the ranges it
// already printed rather than asserted regardless of them. A task's range
// covers every commit between its two ends, and a fix that landed inside
// that span gets its own row for the same commits — the two rows are not
// independent verifiers, and the sentence this replaces said they were,
// unconditionally, which is how seventeen range-slots on one branch read as
// fourteen unique commits' worth of work plus three more.
function overlapNote(root, entries) {
    const resolved = entries.map((e) => ({ label: e.label, commits: commitsFor(root, e.range) }));
    const unresolved = resolved.filter((e) => e.commits === undefined);
    const known = resolved.filter((e) => e.commits instanceof Set);
    // Three shapes, because one remedy does not fit all of them. Containment
    // has a row to drop; identical ranges are one row wearing two labels;
    // crossing has neither — the reviewer's own repro was a "contains" remedy
    // printed under a pair that crosses, telling the reader to do something
    // the sentence just called impossible.
    const contained = [];
    const identical = [];
    const crossing = [];
    for (let i = 0; i < known.length; i++) {
        for (let j = i + 1; j < known.length; j++) {
            const a = known[i];
            const b = known[j];
            if (![...a.commits].some((sha) => b.commits.has(sha))) continue;
            const aInB = subsetOf(a.commits, b.commits);
            const bInA = subsetOf(b.commits, a.commits);
            if (aInB && bInA) identical.push(a.label + ' and ' + b.label);
            else if (aInB) contained.push(b.label + ' fully contains ' + a.label);
            else if (bInA) contained.push(a.label + ' fully contains ' + b.label);
            else crossing.push(a.label + ' and ' + b.label);
        }
    }
    if (contained.length || identical.length || crossing.length) {
        const notes = [];
        if (contained.length) {
            notes.push(contained.join('; ') + ' — send the containing row and drop the row it contains');
        }
        if (identical.length) {
            notes.push(identical.join('; ') + ' record the same commits — send one, not both');
        }
        if (crossing.length) {
            // Neither row covers the other, and a linear `base..head` range
            // naming their union is not always there to give: two crossing
            // ranges can share only part of their history, and inventing an
            // endpoint that is not a real diff risks a range that drops
            // commits or names a comparison nobody made. Sending both is
            // always correct, just not free — the commits where they cross
            // get reviewed twice instead of zero times.
            notes.push(crossing.join('; ') + ' cross without either containing the other — no single '
                + 'range names their union, so send both; the shared commits are reviewed twice');
        }
        return 'These rows are not independent, so pinned-at-both-ends is not the same as\n'
            + 'disjoint: ' + notes.join('. ') + '.';
    }
    if (unresolved.length) {
        const plural = unresolved.length > 1;
        return 'One verifier per row, pinned at both ends. Whether ' + (plural ? 'they overlap' : 'it overlaps')
            + ' the rest could not be checked: git could not read ' + (plural ? 'these ranges' : 'this range')
            + ' — ' + unresolved.map((e) => e.label).join(', ') + ' — so treat ' + (plural ? 'them' : 'it')
            + ' as unverified rather than assume ' + (plural ? 'they are' : 'it is') + ' disjoint from the others.';
    }
    return 'One verifier per row, pinned at both ends. The rows do not overlap, so\nthey may go out in one response.';
}

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
        return groupsReport(root, opts.plan);
    }

    if (verb === 'scan') {
        // Same report `groups` prints, written into the ledger under a
        // stable heading rather than pasted in by hand — the exact thing
        // this verb exists to replace. `groupsReport` already refuses a
        // missing plan the same way `groups` does.
        const report = groupsReport(root, opts.plan);
        const file = ledger.init(root, opts.plan);
        const existing = fs.readFileSync(file, 'utf8');
        const written = withScan(existing, report);
        if (written !== existing) fs.writeFileSync(file, written);
        return 'fankeel ledger — scan recorded in ' + file;
    }

    if (verb === 'lint') {
        const { file, text: planText } = readPlan(root, opts.plan);
        const { header } = plantasks.parsePlan(planText);
        const design = specPath(file, header);
        if (!design) fail('lint wants a **Spec:** line in the plan header naming the design file.');
        let designText = '';
        try {
            designText = fs.readFileSync(design, 'utf8');
        } catch (e) {
            return fail('No design at ' + design + ', named by the plan\'s **Spec:** line.');
        }
        const lines = plantasks.lint(planText, designText);
        if (!lines.length) return 'fankeel ledger — lint: clean';
        // Exit 1, so a gate that chains it stops here. The lines are the
        // report; nothing is summarised on their behalf.
        return fail('fankeel ledger — lint: ' + lines.length + ' findings\n  ' + lines.join('\n  '));
    }

    if (verb === 'brief') {
        const n = Number(text[0]);
        if (!Number.isInteger(n) || n < 1) fail('brief <task number>');
        const { file, text: planText } = readPlan(root, opts.plan);
        const { header, tasks } = plantasks.parsePlan(planText);
        const task = tasks.find((t) => t.n === n);
        if (!task) fail('brief: no Task ' + n + ' in ' + file + '. ' + CONFORMING_HEADING);
        // For every name this task consumes, the entry that produces it — the
        // exact signature, from the task that owns it, rather than a memory.
        const produced = [];
        for (const name of task.consumes) {
            for (const t of tasks) {
                if (t.n === task.n) continue;
                for (const entry of t.producesText) {
                    if (entry.includes('`' + name + '`') && !produced.includes('- Task ' + t.n + ' produces: ' + entry)) {
                        produced.push('- Task ' + t.n + ' produces: ' + entry);
                    }
                }
            }
        }
        const out = [
            '# Task ' + n + ' — ' + task.name,
            '',
            opts.plan + ', Task ' + n + '. This file is your whole brief.',
            '',
            paragraph(header, 'Goal'),
            '',
            paragraph(header, 'Spec'),
            '',
            section(header, 'Global Constraints'),
            '',
            task.body,
            '',
            '## From the tasks this consumes',
            '',
            produced.length ? produced.join('\n') : 'Nothing consumed from an earlier task.',
            '',
            FOOTER,
            '',
        ].join('\n');
        const dir = path.dirname(ledger.ledgerPath(root, opts.plan));
        fs.mkdirSync(dir, { recursive: true });
        const briefFile = path.join(dir, 'task-' + n + '-brief.md');
        fs.writeFileSync(briefFile, out);
        return 'fankeel ledger — ' + briefFile;
    }

    if (verb === 'fix') {
        const what = text.join(' ');
        if (!what.trim()) fail('fix "<what the fix was>" — with --range <base>..<sha> before the verb.');
        // Required, not optional as it is on `complete`: a fix is the commit
        // that came back from verify, and a fix line with no range is the
        // unreviewed commit this verb exists to rule out.
        if (opts.range === undefined) fail('fix wants --range <base>..<sha>: a fix with no range is a commit nobody reviewed.');
        if (!ledger.isRange(opts.range)) {
            fail('--range wants two commit shas: <base>..<head>, 7 to 40 hex each. '
                + '"' + opts.range + '" would reach the file and read back as no range at all.');
        }
        ledger.append(root, opts.plan, ledger.fixLine(what, opts.range));
        return 'fankeel ledger — fix recorded.';
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
        const fixed = ledger.fixes(contents);
        if (!rows.length && !fixed.length) return 'fankeel ledger — nothing complete yet at ' + file;
        const lines = rows.map((r) => '  ' + r.n + ' ' + (r.range || '(no range recorded)'))
            .concat(fixed.map((r) => '  fix ' + (r.range || '(no range recorded)') + ' — ' + r.what));
        // A missing range is named rather than dropped. Silence here is a task
        // that landed and never got a verifier, which is the failure this verb
        // exists to prevent.
        const blind = rows.filter((r) => !r.range).length;
        // Only rows with a range are comparable at all — a blind row already
        // gets the paragraph above sending the reader to git log instead of
        // here, so it is left out rather than counted as overlapping nothing.
        const entries = rows.filter((r) => r.range).map((r) => ({ label: 'Task ' + r.n + ' (' + r.range + ')', range: r.range }))
            .concat(fixed.filter((r) => r.range).map((r) => ({ label: 'the fix (' + r.range + ')', range: r.range })));
        return 'fankeel ledger — ' + file + '\n\n' + lines.join('\n')
            + (blind ? '\n\nA row with no range was completed before this field existed, or without\n--range. Read it against git log rather than here.' : '')
            + '\n\n' + overlapNote(root, entries);
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

module.exports = { withScan, SCAN_HEADING };
