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
// Six things follow, and all six are checkable, which is the point. A link
// that no longer resolves is a dead entry: usually the plan it pointed at was
// rewritten into a decision record and archived at `land`, and closing the entry
// was forgotten. A link that resolves to a document whose role records a moment
// rather than the present is the same failure one step earlier — the file is
// still there and has already stopped answering. An entry over the length cap
// is not an index entry at all; the detail got written here instead of where it
// belongs.
// An entry under no known heading is one nobody said the state of, and `init`
// then has to guess which entries can become a task today.
// Under `## Waiting` entries sit beneath a `###` timing — what they wait for —
// and the timing carries what each entry used to: a line naming the event with
// `lifts when:`, ending in a date stamp. A timing with no stamp is one nobody
// can age, and one with no event is one nobody is waiting for: the stamp says
// when somebody last looked, and a person can always refresh that honestly, so
// it cannot say whether there is anything left to look for — on 2026-09-06
// twelve of thirteen entries named no event at all.
//
// Nothing else is judged, and the re-read list below is deliberately not a
// judgement. Whether the work is still worth doing is not a thing a script can
// know, and neither is whether the thing an entry waits for has happened. What
// is knowable is how long it has been since a person last said it had not, which
// is why that list is printed and does not fail the run.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');

const docs = require('../lib/docs.js');
const { resolveRoot } = require('../lib/registry.js');
const { blameTimes } = require('../lib/blame.js');

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
// `## Waiting` has shrunk five times in this repository's history — c50a5d5,
// a62863e, 811219c, 3fadc08 and 0004ad5. Four were somebody re-reading the
// section and finding an entry misfiled, and one a question Claude Code's docs
// answered first; none of the five was the thing it named actually happening.
// On 2026-09-18 two did leave that way (cdb240e), and both were found by
// somebody reading the section. It is drained by being read, so the interval
// to measure is the one between readings.
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

// The event that would lift the entry, named rather than left to the reader.
// `## Waiting` already declares what it waits on — real use, upstream, or
// another entry landing — and this is that declaration written down per entry
// instead of per heading. It sits before the stamp because `STAMP` is anchored
// at the end, and it is read by stripping that stamp back off the tail.
// What this cannot do, and it is the limit of the rule rather than of the
// regex: it checks that a clause is there, not that the clause names anything.
// `lifts when: it seems worth revisiting.` passes, and an entry carrying that
// is exactly as unfinishable as the twelve that named nothing at all. Of the
// five events left on 2026-09-06 a script could have checked two — a count of
// `docs/archive/`, a language in `skipped.noPattern` — and not the other three,
// so this asks a person for the sentence rather than trying to grade it.
const LIFTS = /\blifts when:\s*(.+)$/i;

function liftsAt(text) {
    const m = LIFTS.exec(text.replace(/\s+/g, ' ').trim());
    if (!m) return null;
    const event = m[1].replace(STAMP, '').trim().replace(/\.$/, '').trim();
    return event || null;
}

// A timing's title, in terminal columns rather than characters. A CJK or
// full-width character takes two, so a cap in characters would let a Chinese
// title run twice as wide as an English one. 28 is fourteen Chinese characters
// or twenty-eight letters — the arithmetic AskUserQuestion's header already
// uses, twelve characters or six in CJK.
const MAX_TITLE_WIDTH = 28;
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

function width(s) {
    let n = 0;
    for (const c of String(s).replace(/`/g, '')) n += WIDE.test(c) ? 2 : 1;
    return n;
}

function mmdd(t) {
    const d = new Date(t);
    return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// An event that opens with `MM-DD` is a date, and its timing is due from that
// day rather than a week after its stamp — the one kind of event a script can
// judge. The day is the first one on or after the stamp: a `01-05` stamped
// `12-20` is next January.
const DATE = /^(\d{2})-(\d{2})(?!\d)/;

function dateAt(event, stamped) {
    const m = event === null ? null : DATE.exec(event);
    if (!m || stamped === null) return null;
    const month = Number(m[1]);
    const day = Number(m[2]);
    const year = new Date(stamped).getFullYear();
    for (const y of [year, year + 1]) {
        const at = new Date(y, month - 1, day);
        if (at.getMonth() !== month - 1 || at.getDate() !== day) continue;
        if (at.getTime() >= stamped) return at.getTime();
    }
    return null;
}

// Whether the day arithmetic slips a day across a DST transition is untested.
// It matches `docs-audit.js`'s `daysBetween`, and every machine this has run on
// keeps one offset all year, so there has been nothing to observe rather than
// something observed and dismissed.
//
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
//
// `end` is the last line actually folded into the entry — its own bullet line
// until a continuation line extends it — not the line before whatever comes
// next in the file. A caller wanting "this entry's lines, however many it
// wraps over" needs that distinction: the gap between one entry and the next
// can hold a blank line, or the heading that opens the following section, and
// neither belongs to the entry that happens to sit above it.
function entries(text) {
    const lines = text.split(/\r?\n/);
    const out = [];
    let section = '';
    let current = null;
    const close = () => {
        if (current) out.push(current);
        current = null;
    };
    let timing = null;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^#{1,6}\s/.test(line)) {
            close();
            // Under `## Waiting` a `###` is a timing, not a section: the entries
            // below it wait for the same thing and lift together. Anywhere else
            // it is a heading like any other, and still unclassified.
            if (/^#{3,6}\s/.test(line) && section === 'Waiting') {
                timing = i + 1;
                continue;
            }
            section = line.replace(/^#+\s*/, '').trim();
            timing = null;
            continue;
        }
        if (/^[-*]\s+\S/.test(line)) {
            close();
            current = { line: i + 1, end: i + 1, section, timing, text: line.replace(/^[-*]\s+/, '') };
            continue;
        }
        if (current && /^\s+\S/.test(line)) {
            current.text += ' ' + line.trim();
            current.end = i + 1;
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

// Every `###` under `## Waiting`, with the line after it read as its lifts line:
// the event it waits for and the day somebody last agreed it still does. The
// first non-blank line is taken whatever it says, so a line with a stamp and no
// `lifts when:` is `unlifted` rather than `undated` too.
function timings(text, now) {
    const at = now === undefined ? Date.now() : now;
    const lines = text.split(/\r?\n/);
    const found = entries(text);
    const out = [];
    let section = '';
    for (let i = 0; i < lines.length; i++) {
        const h = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
        if (!h) continue;
        if (h[1].length >= 3 && section === 'Waiting') {
            let j = i + 1;
            while (j < lines.length && !lines[j].trim()) j++;
            const next = j < lines.length && !/^#{1,6}\s|^[-*]\s/.test(lines[j]) ? lines[j] : '';
            const event = next ? liftsAt(next) : null;
            const stamp = next ? stampAt(next, at) : null;
            const date = dateAt(event, stamp);
            const days = stamp === null ? null : Math.floor((at - stamp) / 86400000);
            const due = date !== null ? at >= date : days !== null && days >= REREAD_DAYS;
            out.push({ line: i + 1, title: h[2].trim(), event, stamp, date, days, due,
                items: found.filter((e) => e.timing === i + 1) });
            continue;
        }
        section = h[2].trim();
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
    let problems = [];
    const overdue = [];
    const found = entries(text);
    for (const entry of found) {
        // The stamp is asked for under `Waiting` and nowhere else. `Ready` and
        // `Needs a decision`'s newest few are read every time `/fankeel` offers
        // a menu, so those are looked at whether or not anyone meant to;
        // `Waiting` is the one that is skipped by design and therefore the one
        // that needs a date to say when it last was not.
        if (entry.section === 'Waiting' && entry.timing === null) {
            problems.push({
                line: entry.line,
                kind: 'untimed',
                detail: 'under ## Waiting but under no ### timing. Put it beneath the ### naming what it'
                    + ' waits for, or open one: a title, then a "lifts when: <the event>. MM-DD." line.',
            });
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

    // The stamp and the event live on the timing now, one line for every entry
    // beneath it, so what used to be asked of each Waiting entry is asked here.
    for (const t of timings(text, at)) {
        if (t.stamp === null) {
            problems.push({
                line: t.line,
                kind: 'undated',
                detail: 'no MM-DD stamp on its lifts line. End that line with the date somebody last read'
                    + ' this timing and confirmed it is still waiting — without one it cannot be told from'
                    + ' one nobody has looked at since it was filed.',
            });
        }
        if (t.event === null) {
            problems.push({
                line: t.line,
                kind: 'unlifted',
                detail: 'no "lifts when:" on the line after it. Name the event that would make its entries'
                    + ' actionable — real use, upstream, or another entry landing. A timing that cannot'
                    + ' name one is not waiting for anything.',
            });
        }
        if (!t.items.length) {
            problems.push({
                line: t.line,
                kind: 'empty timing',
                detail: 'no entries under it. A timing lifts the entries beneath it; with none it is'
                    + ' waiting for nothing — remove it.',
            });
        }
        const w = width(t.title);
        if (w > MAX_TITLE_WIDTH) {
            problems.push({
                line: t.line,
                kind: 'long title',
                detail: w + ' columns, cap is ' + MAX_TITLE_WIDTH + ' — a CJK character counts two.'
                    + ' The title names the timing; the event goes on its lifts line.',
            });
        }
        if (t.due) overdue.push({ line: t.line, days: t.days, title: t.title, lifts: t.event, date: t.date, count: t.items.length });
    }
    problems.sort((a, b) => a.line - b.line);

    // N26: the same "how long since anyone touched this" question
    // `## Waiting`'s stamp already answers, asked of `## Needs a decision`
    // instead — off git blame, because nobody writes a stamp on those
    // bullets. Shares `REREAD_DAYS`: one number for "too long to go
    // unread", asked two ways.
    const needsDecisionDue = [];
    const blame = blameTimes(base, path.basename(file));
    if (blame) {
        for (const entry of found) {
            if (entry.section !== 'Needs a decision') continue;
            let latest = -Infinity;
            for (let ln = entry.line; ln <= entry.end; ln++) {
                const t = blame[ln - 1];
                if (t !== undefined && t > latest) latest = t;
            }
            if (latest === -Infinity) continue;
            const days = Math.floor((at - latest) / 86400000);
            if (days >= REREAD_DAYS) needsDecisionDue.push({ line: entry.line, days, text: entry.text });
        }
        needsDecisionDue.sort((a, b) => b.days - a.days);
    }

    // Every entry off-convention is one fact about the repository, not N
    // defects in it. A repository using its own vocabulary has said nothing
    // wrong; one that uses the convention and has a stray heading has, and that
    // stays a defect because the stray is the entry nobody classified.
    const off = problems.filter((p) => p.kind === 'unclassified');
    // Under a heading of its own, not under none. An entry with no heading
    // above it is not another vocabulary — it is an entry nobody filed, and it
    // stays a defect however many there are. Without this guard `named` is
    // empty, `vocabulary` becomes `[]`, and `[]` is truthy, so a repository
    // whose entries sit under no heading at all would have its one real defect
    // deleted by the branch meant to spare a different repository entirely.
    const named = found.filter((e) => e.section);
    const vocabulary = found.length > 0
        && named.length === found.length
        && off.length === found.length
        ? [...new Set(found.map((e) => e.section))]
        : null;
    if (vocabulary) problems = problems.filter((p) => p.kind !== 'unclassified');
    const counts = {};
    for (const name of SECTIONS) counts[name] = found.filter((e) => e.section === name).length;
    overdue.sort((a, b) => b.days - a.days);
    return { file, missing: false, count: found.length, counts, problems, overdue, needsDecisionDue, vocabulary };
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
    if (result.vocabulary) {
        lines.push('This TODO.md does not use the three headings ' + SECTIONS.map((s) => '## ' + s).join(' · ')
            + ' — it uses ' + result.vocabulary.map((s) => '## ' + s).join(' · ')
            + '. Nothing here says which entries can be started today, which is what those three are for.');
    }
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
        lines.push('', '  due for a re-read — the date has come, or nobody has checked the event in '
            + REREAD_DAYS + ' days or more:');
        for (const o of result.overdue) {
            // The event, not the entries. What a reader can act on is whether the
            // thing has happened; the entries are what they skip until it has.
            const when = o.date !== null ? mmdd(o.date) + '   ' : String(o.days).padStart(3) + ' days';
            const short = (o.title + ' (' + o.count + ') — ' + (o.lifts || '')).replace(/\s+/g, ' ').trim();
            lines.push('    ' + result.file + ':' + o.line + '  ' + when + '  '
                + (short.length > 72 ? short.slice(0, 71) + '…' : short));
        }
    }
    if (result.needsDecisionDue && result.needsDecisionDue.length) {
        lines.push('', '  ## Needs a decision entries not edited in '
            + REREAD_DAYS + ' days or more:');
        for (const o of result.needsDecisionDue) {
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
    const { values, positionals } = parseArgs({
        args: argv, strict: false, allowPositionals: true, options: { root: { type: 'string' } },
    });
    // `--root` with nothing after it comes back `true`, not a string — the old
    // loop read that case as `''` (`argv[++i] || ''`) rather than failing, and
    // this keeps that same silent fallback rather than adopting `parseArgs`'s
    // own "needs a value" refusal.
    const root = typeof values.root === 'string' ? values.root : '';
    // A positional argument is still a path to a file. A flag's value is not one.
    const at = positionals[0] || path.join(resolveRoot(root || undefined), 'TODO.md');
    const result = check(path.resolve(at), now);
    return { text: report(result), ok: result.missing || !result.problems.length };
}

if (require.main === module) {
    const { text, ok } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    process.exit(ok ? 0 : 1);
}

module.exports = { MAX_ENTRY_CHARS, REREAD_DAYS, SECTIONS, linksIn, entries, timings, width, mmdd, check, report, main };
