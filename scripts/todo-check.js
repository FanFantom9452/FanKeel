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
// Under `## Blocked` and `## Watch` entries sit beneath a `###` timing — what
// they wait for — and the line after it carries a typed condition ending in a
// date stamp. Blocked takes `on: MM-DD`, `after: <work>` and `upstream: <thing>`:
// conditions a session can go and check. Watch takes `if: <event>`: an incident
// or a demand only whoever meets it will know of. A timing with no stamp is one
// nobody can age, one with no condition is one nobody is waiting for, and a
// condition under the other heading is misfiled — on 2026-09-27 a patrol found
// sixteen timings whose only question was "has it happened", which nobody could
// answer.
//
// Nothing else is judged, and the re-read list below is deliberately not a
// judgement. Whether the work is still worth doing is not a thing a script can
// know, and neither is whether the thing an entry waits for has happened. What
// is knowable is how long it has been since a person last said it had not, which
// is why that list is printed and does not fail the run.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { execFileSync } = require('node:child_process');

const docs = require('../lib/docs.js');
const { resolveRoot } = require('../lib/registry.js');
const { blameTimes, fileTime } = require('../lib/blame.js');
// A line cited past the end of its file is a citation that moved. The pattern
// and the count are docs-check's, so the two scripts agree on what `path:12-30`
// means and on how a trailing newline counts.
const { PATHISH, lineCount } = require('./docs-check.js');

// The text readers and the constants they share live in `lib/todo.js`, where
// the station reaches them too; this file keeps the rules.
const {
    MAX_ENTRY_CHARS, SECTIONS, TIMED, RETIRED, STALE_DAYS, REREAD_DAYS, MAX_TITLE_WIDTH, COMPLETIONS_PAGE,
    DATE, conditionAt, mmdd, linksIn, entries, timings, STATES, ID, ISO, folderOf, load,
} = require('../lib/todo.js');

const CONDITIONS = { Blocked: ['on', 'after', 'upstream'], Watch: ['if'] };

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

const { width } = require('../lib/handoff.js');

// Whether an `on:` names a day the calendar has. 2000 is a leap year, so
// `02-29` is accepted here and left to `dateAt` to place in a year that has it.
function validOn(event) {
    const m = event === null ? null : DATE.exec(event);
    if (!m) return false;
    const month = Number(m[1]);
    const day = Number(m[2]);
    const at = new Date(2000, month - 1, day);
    return at.getMonth() === month - 1 && at.getDate() === day;
}

const COMPLETION_ORIGINAL = /^- original:\s*(.*)$/gm;

// The text of every `- original: <...>` record on the completions page,
// whitespace-normalized the same way `entries()`'s own text is compared. No
// page, or no record on it yet, is an empty set — not an error, since a
// repository that never closed anything has nothing to record.
function completionTexts(base) {
    let text;
    try {
        text = fs.readFileSync(path.join(base, COMPLETIONS_PAGE), 'utf8');
    } catch (e) {
        return new Set();
    }
    const out = new Set();
    COMPLETION_ORIGINAL.lastIndex = 0;
    let m;
    while ((m = COMPLETION_ORIGINAL.exec(text)) !== null) {
        out.add(m[1].replace(/\s+/g, ' ').trim());
    }
    return out;
}

// The immediately preceding git-tracked version of a file, or null when there
// is none to compare against: no repository, no history yet, or a file git
// has never seen. Mirrors `blame.js`'s own `git()` — stderr quoted back here
// would read as a finding about a repository that simply has no history.
function previousVersion(base, name) {
    try {
        return execFileSync('git', ['show', 'HEAD:' + name], {
            cwd: base, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch (e) {
        return null;
    }
}

// The words of an entry's text, for telling "gone" from "reworded". Not a
// fuzzy-match algorithm — a word-overlap ratio, which is enough to spare a
// bullet that kept its subject and changed its wording without also sparing
// one whose subject actually left.
function wordsOf(text) {
    return new Set((text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []));
}
const REWORD_THRESHOLD = 0.6;
function reworded(oldText, newTexts) {
    const before = wordsOf(oldText);
    if (!before.size) return false;
    for (const t of newTexts) {
        const after = wordsOf(t);
        if (!after.size) continue;
        let common = 0;
        for (const w of before) if (after.has(w)) common++;
        if (common / Math.max(before.size, after.size) >= REWORD_THRESHOLD) return true;
    }
    return false;
}

// `path:N` or `path:N-M` at the end of a link target. Split off before the
// existence check, which would otherwise look for a file named `a.js:12`.
const LINE_SUFFIX = /:(\d+)(?:[-–](\d+))?$/;

// Every line citation an entry makes, from a backticked span or a link target:
// `{ target, from, to }`. `#L12` is not read — docs-check does not read it either.
function citationsIn(text) {
    const out = [];
    for (const m of text.matchAll(/`([^`]+)`/g)) {
        const c = PATHISH.exec(m[1].trim());
        if (c && c[2]) out.push({ target: c[1], from: +c[2], to: c[3] ? +c[3] : +c[2] });
    }
    for (const raw of linksIn(text)) {
        const at = LINE_SUFFIX.exec(raw);
        if (at) out.push({ target: raw.slice(0, at.index), from: +at[1], to: at[2] ? +at[2] : +at[1] });
    }
    return out;
}

// Folder mode's own rules, one `{ line: 1, file }` problem per entry file
// except the index's, which is TODO.md's. The index is generated, so any
// difference from what `render` writes is a hand edit; an entry file is never
// deleted, so one that was committed and is gone lost its record.
const TIMED_STATES = ['blocked', 'watch'];
const SHA = /^[0-9a-f]{7,40}$/;

// Not a repository, no commit yet, or no git at all: nothing is tracked, so [].
// Any other failure throws, since [] would skip the "deleted entry" rule.
const NOTHING_TRACKED = /not a git repository|not a valid object name|unknown revision|bad revision|ambiguous argument 'HEAD'/i;

function trackedIn(base, folder) {
    try {
        return execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', '--', folder], {
            cwd: base, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
            env: Object.assign({}, process.env, { LC_ALL: 'C' }),
        }).split('\n').filter((l) => l.endsWith('.md'));
    } catch (e) {
        if (e && e.code === 'ENOENT') return [];
        const said = String((e && e.stderr) || '');
        if (NOTHING_TRACKED.test(said)) return [];
        throw new Error('git ls-tree failed: ' + (said.trim() || (e && e.message) || 'unknown'));
    }
}

function folderProblems(base, folder, loaded, disk) {
    const out = [];
    const on = (file, kind, detail) => out.push({ line: 1, file, kind, detail });
    if (disk === null || disk.replace(/\r\n/g, '\n') !== loaded.text) {
        out.push({ line: 1, kind: 'stale index', detail: 'TODO.md is not what `todo.js index` writes from ' + folder
            + '/. It is generated: run `todo.js index`, and change entries through `todo.js new` and `todo.js done`.' });
    }
    for (const e of loaded.all) {
        if (!ID.test(e.id)) on(e.file, 'bad id', '"' + e.id + '" is not a lowercase kebab slug.');
        if (!STATES.includes(e.state)) on(e.file, 'bad state', '"' + e.state + '" — state is one of ' + STATES.join(', ') + '.');
        if (!e.title) on(e.file, 'no title', 'every entry carries a title, at most ' + MAX_TITLE_WIDTH + ' columns.');
        else if (width(e.title) > MAX_TITLE_WIDTH) {
            on(e.file, 'long title', width(e.title) + ' columns, cap is ' + MAX_TITLE_WIDTH + ' — a CJK character counts two.');
        }
        if (!e.description) on(e.file, 'no description', 'the description is the line TODO.md prints.');
        if (TIMED_STATES.includes(e.state) && !ISO.test(e.stamp)) {
            on(e.file, 'undated', 'a ' + e.state + ' entry carries stamp: YYYY-MM-DD, the day somebody last agreed its timing holds.');
        }
        if (e.state === 'done' && !(e.done && SHA.test(e.done.sha))) {
            on(e.file, 'bad done', 'a done entry carries done: with at, sha — the commit that closed it — and disposition.');
        }
    }
    let tracked = [];
    try {
        tracked = trackedIn(base, folder);
    } catch (e) {
        on(folder, 'unchecked', 'could not ask git which entry files were committed, so "deleted entry" was not checked: ' + e.message);
    }
    for (const rel of tracked) {
        if (!fs.existsSync(path.join(base, rel))) {
            on(rel, 'deleted entry', 'was committed and is gone. An entry file is never deleted: close it with `todo.js done <id> --sha <sha>`.');
        }
    }
    return out;
}

function check(file, now) {
    const at = now === undefined ? Date.now() : now;
    const base = path.dirname(file);
    // Folder mode: the entries are the files under the project's `todo`
    // bucket and TODO.md is what `todo.js index` writes from them, so the
    // rules below read the index as it should be, and the file on disk is
    // compared with it rather than read.
    const folder = folderOf(base);
    let disk = null;
    try {
        disk = fs.readFileSync(file, 'utf8');
    } catch (e) {
        if (!folder) return { file, missing: true, problems: [], overdue: [], stale: [] };
    }
    let loaded = null;
    if (folder) {
        try {
            loaded = load(base, at);
        } catch (e) {
            return { file, problems: [{ line: 1, file: folder, kind: 'unreadable folder', detail: e.message }], overdue: [], stale: [] };
        }
    }
    const text = loaded ? loaded.text : disk;
    // No `docs.json` is not a failure. `read` hands back a null tree, `roleOf`
    // answers null for everything under it, and the role check reports nothing —
    // this degrades to the three checks it had before rather than refusing to
    // run in a repository that never declared a tree.
    const { tree } = docs.read(base);
    let problems = [];
    const overdue = [];
    const stale = [];
    const found = loaded ? loaded.entries : entries(text);
    for (const entry of found) {
        // The stamp is asked for under `Blocked` and `Watch` and nowhere else.
        // `Ready` and `Needs a decision`'s newest few are read every time
        // `/fankeel` offers a menu, so those are looked at whether or not anyone
        // meant to; the two timed sections are the ones that are skipped by
        // design and therefore the ones that need a date to say when they last
        // were not.
        if (TIMED.includes(entry.section) && entry.timing === null) {
            const line = entry.section === 'Watch' ? 'if: <the event>' : 'on: MM-DD, after: <what> or upstream: <what>';
            problems.push({
                line: entry.line,
                kind: 'untimed',
                detail: 'under ## ' + entry.section + ' but under no ### timing. Put it beneath the ### naming what it'
                    + ' waits for, or open one: a title, then a "' + line + '. MM-DD." line.',
            });
        }
        if (!SECTIONS.includes(entry.section)) {
            problems.push({
                line: entry.line,
                kind: 'unclassified',
                detail: (entry.section ? 'under "' + entry.section + '"' : 'under no heading')
                    + '. Every entry sits under one of ' + SECTIONS.map((s) => '## ' + s).join(' · ')
                    + ', which is what says whether it can be started today.'
                    + (entry.section === RETIRED
                        ? ' ## Waiting was split on 2026-09-27: ## Blocked takes on:, after: and upstream:; ## Watch takes if:.'
                        : ''),
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
        for (const raw of linksIn(entry.text)) {
            const at = LINE_SUFFIX.exec(raw);
            const target = at ? raw.slice(0, at.index) : raw;
            const full = path.resolve(base, target);
            if (!fs.existsSync(full)) {
                problems.push({
                    line: entry.line,
                    kind: 'dead link',
                    detail: target + ' does not exist. Either the entry is finished and should be closed (todo.js done) or removed, or the detail moved.',
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
        // A file that is missing was already reported as a dead link above, or,
        // for a backticked span, is docs-check's to report; only the line is new.
        for (const c of citationsIn(entry.text)) {
            const n = lineCount(base, c.target);
            if (n === null || c.to <= n) continue;
            const cited = c.target + ':' + c.from + (c.to !== c.from ? '-' + c.to : '');
            problems.push({
                line: entry.line,
                kind: 'past end',
                detail: cited + ' is past the end — ' + c.target + ' has ' + n + ' lines. The code moved; cite where it is now.',
            });
        }
    }

    // A bullet in the previous commit's TODO.md that is not, in any form close
    // to its own wording, in the working file is one somebody removed. Unless
    // a completion record names it, that removal left no result — done,
    // measured-and-no-change or abandoned is a fact only the person who
    // closed it knows, and the file is the only place it survives being
    // asked.
    if (loaded) problems.push(...folderProblems(base, folder, loaded, disk));
    const prevText = loaded ? null : previousVersion(base, path.basename(file));
    if (prevText !== null) {
        const curNorm = found.map((e) => e.text.replace(/\s+/g, ' ').trim());
        const completions = completionTexts(base);
        for (const old of entries(prevText)) {
            const norm = old.text.replace(/\s+/g, ' ').trim();
            if (curNorm.includes(norm)) continue;
            if (completions.has(norm)) continue;
            if (reworded(norm, curNorm)) continue;
            problems.push({
                line: 1,
                kind: 'undocumented deletion',
                detail: '"' + norm + '" was in TODO.md at the previous commit and is gone from the working'
                    + ' file, with no matching record in ' + COMPLETIONS_PAGE + '. Add a record there'
                    + ' (the original text, a disposition — done, measured-no-change or abandoned — and'
                    + ' the commit sha that closed it) before removing the entry.',
            });
        }
    }

    // The stamp and the condition live on the timing, one line for every entry
    // beneath it, so what used to be asked of each entry is asked here.
    for (const t of timings(text, at)) {
        if (t.stamp === null) {
            problems.push({
                line: t.line,
                kind: 'undated',
                detail: 'no MM-DD stamp on its condition line. End that line with the date somebody last read'
                    + ' this timing and confirmed it still holds — without one it cannot be told from'
                    + ' one nobody has looked at since it was filed.',
            });
        }
        if (t.kind === null || (t.event === null && t.kind !== 'on')) {
            problems.push({
                line: t.line,
                kind: 'unconditioned',
                detail: 'no condition on the line after it. Under ## Blocked write "on: MM-DD", "after: <what>"'
                    + ' or "upstream: <what>"; under ## Watch, "if: <the event>". A timing that cannot'
                    + ' name one is not waiting for anything.',
            });
        } else if (!CONDITIONS[t.section].includes(t.kind)) {
            problems.push({
                line: t.line,
                kind: 'wrong section',
                detail: '"' + t.kind + ':" belongs under ' + (t.kind === 'if' ? '## Watch' : '## Blocked')
                    + ', not ## ' + t.section + '. Blocked takes on:, after: and upstream: — something a session'
                    + ' can check; Watch takes if: — an event only whoever meets it knows.',
            });
        } else if (t.kind === 'on' && !validOn(t.event)) {
            problems.push({
                line: t.line,
                kind: 'bad date',
                detail: '"on:" is not followed by an MM-DD. It is the day the date is compared against;'
                    + ' a wait with no day is an "after:".',
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
                    + ' The title names the timing; the condition goes on the line after it.',
            });
        }
        if (t.due) overdue.push({ line: t.line, days: t.days, title: t.title, kind: t.kind, event: t.event, date: t.date, count: t.items.length });
        if (t.stale) stale.push({ line: t.line, days: t.days, title: t.title, event: t.event, count: t.items.length });
    }
    problems.sort((a, b) => a.line - b.line);
    // In folder mode a problem on an entry's bullet is that entry file's.
    if (loaded) {
        const fileAt = new Map(loaded.entries.map((e) => [e.line, e.file]));
        for (const p of problems) {
            if (p.file || !fileAt.has(p.line)) continue;
            p.file = fileAt.get(p.line);
            p.line = 1;
        }
    }

    // N26: the same "how long since anyone touched this" question
    // `## Waiting`'s stamp already answers, asked of `## Needs a decision`
    // instead — off git blame, because nobody writes a stamp on those
    // bullets. Shares `REREAD_DAYS`: one number for "too long to go
    // unread", asked two ways.
    const needsDecisionDue = [];
    if (loaded) {
        for (const entry of found) {
            if (entry.section !== 'Needs a decision') continue;
            const t = fileTime(base, entry.file);
            if (t === null || t === Infinity) continue;
            const days = Math.floor((at - t) / 86400000);
            if (days >= REREAD_DAYS) needsDecisionDue.push({ line: entry.line, days, text: entry.text });
        }
        needsDecisionDue.sort((a, b) => b.days - a.days);
    }
    const blame = loaded ? null : blameTimes(base, path.basename(file));
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
        && !found.some((e) => e.section === RETIRED)
        ? [...new Set(found.map((e) => e.section))]
        : null;
    if (vocabulary) problems = problems.filter((p) => p.kind !== 'unclassified');
    const counts = {};
    for (const name of SECTIONS) counts[name] = found.filter((e) => e.section === name).length;
    overdue.sort((a, b) => b.days - a.days);
    stale.sort((a, b) => b.days - a.days);
    return { file, missing: false, count: found.length, counts, problems, overdue, stale, needsDecisionDue, vocabulary };
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
        lines.push('This TODO.md does not use the four headings ' + SECTIONS.map((s) => '## ' + s).join(' · ')
            + ' — it uses ' + result.vocabulary.map((s) => '## ' + s).join(' · ')
            + '. Nothing here says which entries can be started today, which is what those four are for.');
    }
    if (!result.problems.length) {
        lines.push('fankeel todo-check: ' + result.count + ' entries — ' + split
            + '. All links resolve, no stale citations, none over the cap.');
    } else {
        lines.push('fankeel todo-check: ' + result.problems.length + ' problem'
            + (result.problems.length === 1 ? '' : 's') + ' in ' + result.file, '');
        for (const p of result.problems) {
            lines.push('  ' + (p.file || result.file) + ':' + p.line + '  ' + p.kind + ' — ' + p.detail);
        }
    }
    // Below the verdict and outside it. These are not defects — a timing can
    // sit correctly filed for a month — so the run stays green and the list is
    // the prompt to go and look.
    if (result.overdue && result.overdue.length) {
        lines.push('', '  due for a re-read — the date has come, or nobody has checked the condition in '
            + REREAD_DAYS + ' days or more:');
        for (const o of result.overdue) {
            const when = o.date !== null ? mmdd(o.date) + '   ' : String(o.days).padStart(3) + ' days';
            const short = (o.title + ' (' + o.count + ') — ' + (o.kind ? o.kind + ': ' : '') + (o.event || '')).replace(/\s+/g, ' ').trim();
            lines.push('    ' + result.file + ':' + o.line + '  ' + when + '  '
                + (short.length > 72 ? short.slice(0, 71) + '…' : short));
        }
    }
    // Watch is never due. What a stale one asks is whether to keep watching —
    // keep it and restamp, or drop it — not whether its event happened.
    if (result.stale && result.stale.length) {
        lines.push('', '  ## Watch timings not re-read in ' + STALE_DAYS + ' days or more — keep and restamp, or drop:');
        for (const o of result.stale) {
            const short = (o.title + ' (' + o.count + ') — if: ' + (o.event || '')).replace(/\s+/g, ' ').trim();
            lines.push('    ' + result.file + ':' + o.line + '  ' + String(o.days).padStart(3) + ' days  '
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

// `--migrate`: the one move off the retired `## Waiting`. A `###` timing whose
// condition line is typed moves whole — heading, condition line and entries —
// to the end of the section that takes that condition; anything a script
// cannot place stays where it is, for a person. Sections split at `#` and `##`
// only: under `## Waiting` a `###` is a timing, the same reading `entries()`
// gives it. The file keeps the line ending its first line break uses.
function migrate(text) {
    const eol = /\r\n/.test(text) ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    const trailing = lines.length > 1 && lines[lines.length - 1] === '';
    if (trailing) lines.pop();
    const sections = [{ head: null, body: [] }];
    for (const line of lines) {
        if (/^#{1,2}\s/.test(line)) sections.push({ head: line, body: [] });
        else sections[sections.length - 1].body.push(line);
    }
    const nameOf = (s) => (s.head === null ? null : s.head.replace(/^#+\s*/, '').trim());
    const find = (name) => sections.findIndex((s) => nameOf(s) === name);
    const waiting = sections[find(RETIRED)];
    if (!waiting) return { text, blocked: 0, watch: 0 };

    // What precedes the first `###` stays; each `###` runs to the next.
    const keep = [];
    const chunks = [];
    for (const line of waiting.body) {
        if (/^#{3,6}\s/.test(line)) chunks.push([line]);
        else if (chunks.length) chunks[chunks.length - 1].push(line);
        else keep.push(line);
    }
    const moves = { Blocked: [], Watch: [] };
    for (const chunk of chunks) {
        const next = chunk.slice(1).find((l) => l.trim());
        const cond = next && !/^[-*]\s/.test(next) ? conditionAt(next) : null;
        if (!cond) keep.push(...chunk);
        else moves[cond.kind === 'if' ? 'Watch' : 'Blocked'].push(chunk);
    }

    const trim = (body) => {
        while (body.length && !body[body.length - 1].trim()) body.pop();
        return body;
    };
    const touched = new Set();
    for (const [name, after] of [['Blocked', ['Needs a decision', 'Ready']], ['Watch', ['Blocked', 'Needs a decision', 'Ready']]]) {
        if (!moves[name].length) continue;
        let at = find(name);
        if (at === -1) {
            const anchor = after.map(find).find((i) => i !== -1);
            at = anchor === undefined ? sections.length : anchor + 1;
            sections.splice(at, 0, { head: '## ' + name, body: [] });
        }
        const s = sections[at];
        trim(s.body);
        for (const chunk of moves[name]) s.body.push('', ...trim(chunk.slice()));
        touched.add(s);
    }
    waiting.body = keep;
    if (keep.every((l) => !l.trim())) sections.splice(sections.indexOf(waiting), 1);
    else touched.add(waiting);
    // A section this wrote to ends in one blank line before the next heading,
    // and in none at the end of the file.
    for (const s of touched) {
        trim(s.body);
        if (sections.indexOf(s) !== sections.length - 1) s.body.push('');
    }
    const out = [];
    for (const s of sections) {
        if (s.head !== null) out.push(s.head);
        out.push(...s.body);
    }
    return { text: out.join(eol) + (trailing ? eol : ''), blocked: moves.Blocked.length, watch: moves.Watch.length };
}

// What is still under `## Waiting` once a migration has run, for a person to
// file: every `###` timing there, and every entry under none. `{ line, title }`,
// in file order.
function leftovers(text) {
    const lines = text.split(/\r?\n/);
    const out = [];
    let section = '';
    for (let i = 0; i < lines.length; i++) {
        const h = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
        if (!h) continue;
        if (h[1].length >= 3 && section === RETIRED) {
            out.push({ line: i + 1, title: h[2].trim() });
            continue;
        }
        if (h[1].length >= 3 && TIMED.includes(section)) continue;
        section = h[2].trim();
    }
    for (const e of entries(text)) {
        if (e.section === RETIRED && e.timing === null) out.push({ line: e.line, title: e.text.replace(/\s+/g, ' ').trim() });
    }
    return out.sort((a, b) => a.line - b.line);
}

// `--root <dir>` the way every other script here takes it. Before this, the
// first argument not beginning with `--` was taken as the file — so `--root .`
// handed `.` to `check`, reading a directory threw EISDIR, `check` reported it
// missing, and missing is success. The form a person reaches for, and the form a
// gate gets written with, passed while examining nothing.
function main(argv, now) {
    const { values, positionals } = parseArgs({
        args: argv, strict: false, allowPositionals: true, options: { root: { type: 'string' }, migrate: { type: 'boolean' } },
    });
    // `--root` with nothing after it comes back `true`, not a string — the old
    // loop read that case as `''` (`argv[++i] || ''`) rather than failing, and
    // this keeps that same silent fallback rather than adopting `parseArgs`'s
    // own "needs a value" refusal.
    const root = typeof values.root === 'string' ? values.root : '';
    // A positional argument is still a path to a file. A flag's value is not one.
    const at = positionals[0] || path.join(resolveRoot(root || undefined), 'TODO.md');
    const file = path.resolve(at);
    // `--migrate` writes first and then checks what it wrote, so what it could
    // not place still fails the run.
    const head = [];
    if (values.migrate === true) {
        let before = null;
        try {
            before = fs.readFileSync(file, 'utf8');
        } catch (e) { /* no file: the check below says so */ }
        if (before !== null) {
            const moved = migrate(before);
            if (moved.text !== before) fs.writeFileSync(file, moved.text);
            const left = leftovers(moved.text);
            head.push('fankeel todo-check --migrate: ' + moved.blocked + (moved.blocked === 1 ? ' timing' : ' timings')
                + ' to ## Blocked, ' + moved.watch + ' to ## Watch, ' + left.length + ' left under ## Waiting'
                + (left.length ? ' — no typed condition, for a person to file:' : '.'));
            for (const l of left) head.push('  ' + file + ':' + l.line + '  ' + l.title);
            head.push('');
        }
    }
    const result = check(file, now);
    return { text: head.concat(report(result)).join('\n'), ok: result.missing || !result.problems.length };
}

if (require.main === module) {
    const { text, ok } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    process.exit(ok ? 0 : 1);
}

module.exports = { trackedIn, MAX_ENTRY_CHARS, REREAD_DAYS, STALE_DAYS, SECTIONS, linksIn, entries, timings, width, mmdd, check, report, main };
