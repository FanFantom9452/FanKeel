#!/usr/bin/env node
'use strict';

// Whether TODO.md is still an index.
//
// R5 asks for one convention and a way to tell when it has been broken, because
// an index pointing at things that no longer exist is worse than no index — it
// is read with confidence and it is wrong. The convention:
//
//   An entry is one bullet. It is short enough to scan, any detail behind it
//   lives in a file in this repository that the entry links to, and it sits
//   under the heading that says what it is still waiting for.
//
// Five things follow, and all five are checkable, which is the point. A link
// that no longer resolves is a dead entry: usually the plan it pointed at was
// rewritten into a decision record and deleted at `land`, and closing the entry
// was forgotten. A link that resolves to a document whose role records a moment
// rather than the present is the same failure one step earlier — the file is
// still there and has already stopped answering. An entry over the length cap
// is not an index entry at all; the detail got written here instead of where it
// belongs.
// An entry under no known heading is one nobody said the state of, and `init`
// then has to guess which entries can become a task today.
// A `## Waiting` entry with no date stamp is one nobody can age, and the section
// that grows fastest is exactly the one where that matters — see the block above
// `REREAD_DAYS`.
//
// Nothing else is judged, and the re-read list below is deliberately not a
// judgement. Whether the work is still worth doing is not a thing a script can
// know, and neither is whether the thing an entry waits for has happened. What
// is knowable is how long it has been since a person last said it had not, which
// is why that list is printed and does not fail the run.

const fs = require('node:fs');
const path = require('node:path');

const docs = require('../lib/docs.js');

// Long enough for a sentence and a link, short enough that a paragraph does not
// fit. Detail that will not compress to this belongs in the file being pointed
// at, which is the whole rule.
const MAX_ENTRY_CHARS = 200;

// The three buckets, in the order a reader wants them: what can be started now,
// what needs a person before anyone can start, what nobody can move yet. The
// heading carries the classification, so it costs one line of structure per group
// rather than a field on every bullet — and `entries()` was already recording it
// while nothing read it back.
//
// By decision state and not by topic, on purpose. Topic groups read well and
// answer the wrong question: what `init` needs to know is which entries can
// become a task today, and two bullets about one file are as often one that is
// ready and one that is still an argument.
const SECTIONS = ['Ready', 'Needs a decision', 'Waiting'];

// The roles `docs.json` declares for documents that record a moment rather than
// the present: a decision record says why something was decided then, a plan
// says what was about to be done, a report is a dated snapshot, and an archive
// is retired. All four are correct documents doing their job. All four are the
// wrong home for the detail behind an open entry, because none of them is
// written to answer a question that is still open — which leaves `reference`,
// and code, which is in no bucket at all.
//
// Not "nobody maintains them", which is the reading this said first and which
// this repository's own tree falsifies: `docs/decisions/fankeel-shell.md`
// carries `status: current` and a `last_verified` date, and is still reported
// here. That is the check working. A decision record kept scrupulously current
// is a scrupulously current account of a decision, and an entry whose detail
// lives in one is pointing at history, however fresh the history is.
//
// This is the check, and it is deliberately not the one that was asked for.
// Three entries drifted on 2026-08-31 and two of them cited `## What is still a
// guess` in a decision record — the heading was still there, so verifying that a
// cited section exists would have caught neither. What had changed was the
// section's subject, narrowed to `survey` while the entries went on pointing at
// it, and no script can read a section and rule on its subject. The role can:
// it is the standing declaration that the page is an account of a decision and
// not a place an open question is tracked.
const STALE_ROLES = ['decision', 'plan', 'report', 'archive'];

// Seven days, and it is a re-read interval rather than an age.
//
// `## Waiting` has shrunk four times in this repository's history — c50a5d5,
// a62863e, 811219c, 3fadc08 — and all four were somebody re-reading the section
// and finding an entry misfiled. Not one entry has ever left because the
// external thing it named actually happened. The section is drained by being
// read, so the interval to measure is the one between readings.
//
// Seven and not the fortnight the documentation sweep runs on, because the
// fortnight caught nothing: on 2026-09-01 the four oldest entries had sat
// eleven days untouched and a fourteen-day window would have reported none of
// them. A window that misses the backlog it was written for is the wrong
// window. Seven reports those four and the one behind them, which is the set
// that prompted this.
const REREAD_DAYS = 7;

// `MM-DD` at the end of the entry, which is what twelve of the sixteen entries
// already carried before anything read them back. No year: it is written by
// hand, and a year is noise 364 days out of 365.
const STAMP = /(?:^|\s)(\d{2})-(\d{2})\.?$/;

// The most recent `MM-DD` that is not in the future. Read on 5 January, a
// `12-15` is three weeks back and not eleven months forward, and that rollover
// is the only case where a missing year can be got wrong.
function stampAt(text, now) {
    const m = STAMP.exec(text.replace(/\s+/g, ' ').trim());
    if (!m) return null;
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const year = new Date(now).getFullYear();
    for (const y of [year, year - 1]) {
        const at = new Date(y, month - 1, day);
        // A month that rolled over is not a date in *this* year, which is not
        // the same as not being a date. `02-29` is both: invalid in 2025 and
        // the right answer in 2024, so the next candidate still has to be
        // tried. Returning here read a valid leap-day stamp as no stamp at all
        // and failed the run on it.
        if (at.getMonth() !== month - 1 || at.getDate() !== day) continue;
        if (at.getTime() <= now) return at.getTime();
    }
    return null;
}

const LINK = /\[[^\]]*\]\(([^)]+)\)/g;
// A scheme, or a bare in-page anchor. Neither is a file in this repository, so
// neither is something this can check.
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i;

// Top-level bullets only. An indented bullet is a continuation of the entry
// above it and is measured as part of it, not as an entry of its own.
function entries(text) {
    const lines = text.split(/\r?\n/);
    const out = [];
    let section = '';
    let current = null;
    const close = () => {
        if (current) out.push(current);
        current = null;
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^#{1,6}\s/.test(line)) {
            close();
            section = line.replace(/^#+\s*/, '').trim();
            continue;
        }
        if (/^[-*]\s+\S/.test(line)) {
            close();
            current = { line: i + 1, section, text: line.replace(/^[-*]\s+/, '') };
            continue;
        }
        if (current && /^\s+\S/.test(line)) {
            current.text += ' ' + line.trim();
            continue;
        }
        if (!line.trim()) continue;
        close();
    }
    close();
    return out;
}

function linksIn(text) {
    const out = [];
    LINK.lastIndex = 0;
    let m;
    while ((m = LINK.exec(text)) !== null) {
        const target = m[1].trim().split(/\s+/)[0].replace(/^<|>$/g, '');
        if (!target || EXTERNAL.test(target)) continue;
        out.push(target.split('#')[0]);
    }
    return out;
}

function check(file, now) {
    const at = now === undefined ? Date.now() : now;
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return { file, missing: true, problems: [], overdue: [] };
    }
    const base = path.dirname(file);
    // No `docs.json` is not a failure. `read` hands back a null tree, `roleOf`
    // answers null for everything under it, and the role check reports nothing —
    // this degrades to the three checks it had before rather than refusing to
    // run in a repository that never declared a tree.
    const { tree } = docs.read(base);
    const problems = [];
    const overdue = [];
    const found = entries(text);
    for (const entry of found) {
        // The stamp is asked for under `Waiting` and nowhere else. `Ready` and
        // `Needs a decision` are read every time `/fankeel` offers a menu, so
        // they are looked at whether or not anyone meant to; `Waiting` is the
        // one that is skipped by design and therefore the one that needs a date
        // to say when it last was not.
        if (entry.section === 'Waiting') {
            const stamped = stampAt(entry.text, at);
            if (stamped === null) {
                problems.push({
                    line: entry.line,
                    kind: 'undated',
                    detail: 'no MM-DD stamp. End the entry with the date somebody last read it and'
                        + ' confirmed it is still waiting — without one it cannot be told from an entry'
                        + ' nobody has looked at since it was filed.',
                });
            } else {
                const days = Math.floor((at - stamped) / 86400000);
                if (days >= REREAD_DAYS) overdue.push({ line: entry.line, days, text: entry.text });
            }
        }
        if (!SECTIONS.includes(entry.section)) {
            problems.push({
                line: entry.line,
                kind: 'unclassified',
                detail: (entry.section ? 'under "' + entry.section + '"' : 'under no heading')
                    + '. Every entry sits under one of ' + SECTIONS.map((s) => '## ' + s).join(' · ')
                    + ', which is what says whether it can be started today.',
            });
        }
        const len = entry.text.replace(/\s+/g, ' ').trim().length;
        if (len > MAX_ENTRY_CHARS) {
            problems.push({
                line: entry.line,
                kind: 'too long',
                detail: len + ' characters, cap is ' + MAX_ENTRY_CHARS + '. Move the detail into the file this points at.',
            });
        }
        for (const target of linksIn(entry.text)) {
            const full = path.resolve(base, target);
            if (!fs.existsSync(full)) {
                problems.push({
                    line: entry.line,
                    kind: 'dead link',
                    detail: target + ' does not exist. Either the entry is finished and should be removed, or the detail moved.',
                });
                continue;
            }
            const role = docs.roleOf(tree, path.relative(base, full));
            if (STALE_ROLES.includes(role)) {
                problems.push({
                    line: entry.line,
                    kind: 'stale citation',
                    detail: target + ' is filed as ' + role + ', a role that records a moment rather than the present. Point at the code this is about, or at a reference page.',
                });
            }
        }
    }
    const counts = {};
    for (const name of SECTIONS) counts[name] = found.filter((e) => e.section === name).length;
    overdue.sort((a, b) => b.days - a.days);
    return { file, missing: false, count: found.length, counts, problems, overdue };
}

function report(result) {
    if (result.missing) {
        return 'fankeel todo-check: no ' + result.file + '. Nothing to check.';
    }
    // The split is the reason to run this on a clean file: a backlog of thirty is
    // unreadable as one list, and "18 ready" is the number that decides whether
    // there is a task to start this morning.
    const split = SECTIONS.map((s) => (result.counts[s] || 0) + ' ' + s.toLowerCase()).join(', ');
    const lines = [];
    if (!result.problems.length) {
        lines.push('fankeel todo-check: ' + result.count + ' entries — ' + split
            + '. All links resolve, no stale citations, none over the cap.');
    } else {
        lines.push('fankeel todo-check: ' + result.problems.length + ' problem'
            + (result.problems.length === 1 ? '' : 's') + ' in ' + result.file, '');
        for (const p of result.problems) {
            lines.push('  ' + result.file + ':' + p.line + '  ' + p.kind + ' — ' + p.detail);
        }
    }
    // Below the verdict and outside it. These are not defects — an entry can sit
    // under `Waiting` for a month and be filed correctly the whole time — so the
    // run stays green and the list is the prompt to go and look.
    if (result.overdue && result.overdue.length) {
        lines.push('', '  due for a re-read — nobody has confirmed these are still waiting in '
            + REREAD_DAYS + ' days or more:');
        for (const o of result.overdue) {
            const short = o.text.replace(/\s+/g, ' ').trim();
            lines.push('    ' + result.file + ':' + o.line + '  ' + String(o.days).padStart(3)
                + ' days  ' + (short.length > 72 ? short.slice(0, 71) + '…' : short));
        }
    }
    return lines.join('\n');
}

// `--root <dir>` the way every other script here takes it. Before this, the
// first argument not beginning with `--` was taken as the file — so `--root .`
// handed `.` to `check`, reading a directory threw EISDIR, `check` reported it
// missing, and missing is success. The form a person reaches for, and the form a
// gate gets written with, passed while examining nothing.
function main(argv, now) {
    let root = '';
    const loose = [];
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--root') {
            root = argv[++i] || '';
            continue;
        }
        if (arg.startsWith('--root=')) {
            root = arg.slice('--root='.length);
            continue;
        }
        if (arg.startsWith('--')) continue;
        loose.push(arg);
    }
    // A positional argument is still a path to a file. A flag's value is not one.
    const at = loose[0] || path.join(root || process.cwd(), 'TODO.md');
    const result = check(path.resolve(at), now);
    return { text: report(result), ok: result.missing || !result.problems.length };
}

if (require.main === module) {
    const { text, ok } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    process.exit(ok ? 0 : 1);
}

module.exports = { MAX_ENTRY_CHARS, REREAD_DAYS, SECTIONS, linksIn, check, main };
