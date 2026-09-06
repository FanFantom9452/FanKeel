'use strict';

// Which of a plan's tasks may be implemented at the same time.
//
// Two objections stood against parallel implementers and only one of them is
// about filenames. `docs/plans/2026-08-26-dispatch-design.md` records both:
// they collide in the same files, and — the half a filename cannot see — "the
// interference test is not file overlap. It is shared resources and shared
// causes." A producer/consumer edge is a shared cause, it is already written in
// every task's `**Interfaces:**` block, and it is text rather than judgement.
// So there are two predicates here, not one.
//
// This file reads a plan, and a design where `lint` is asked to, and nothing
// else. It does not know about git, the ledger, or how a dispatch is made.

const TASK = /^##\s+Task\s+(\d+):\s*(.*)$/;
const HEADING = /^##\s/;
const BLOCK = /^\*\*(Files|Interfaces):\*\*\s*$/;
const ENTRY = /^-\s*(Modify|Test|Read|Consumes|Produces):\s*(.*)$/;

// A fence whose info string is one of these holds a command or its output,
// not code that lands in a file, so it names no file. Everything else — `js`,
// `json`, `md`, a language nobody here has used yet — is code and must say
// where it goes.
const EXEMPT = new Set(['', 'sh', 'bash', 'shell', 'console', 'text']);

// Paths and names are written inside backticks everywhere in `docs/plans`, but
// a `Files:` entry and an `Interfaces:` entry do not share a shape. A `Files:`
// entry is one path and then the author explaining it, and that explanation can
// hold backticked words of its own — reading those as paths is how a task ends
// up owning a sentence, so only the first one on the line counts. An
// `Interfaces:` entry has no explanation. It is a list of names, comma
// separated, and stopping at the first one there drops every name after it: a
// later task consuming the second never matches, and `conflict()` lets the pair
// run in parallel over a dependency that is written down. `all` is which of the
// two the caller means.
function ticked(text, all) {
    const s = String(text || '');
    if (all) return Array.from(s.matchAll(/`([^`]+)`/g), (m) => m[1].trim());
    const m = /`([^`]+)`/.exec(s);
    return m ? [m[1].trim()] : [];
}

// The whole plan, not only its declarations. `header` is everything before the
// first task heading — the goal, the spec line, the constraints block — and a
// task's `body` is its section from its own heading to the next `## ` heading,
// fences included: `brief` writes both out for an implementer, and an
// implementer given a slice needs the slice whole. `line` is the heading's
// 1-based line in the plan, so a report can point at the file.
function parsePlan(text) {
    const tasks = [];
    const headerLines = [];
    let task = null;
    let block = null;
    // A fenced code block is an example of the format, not the format itself —
    // the `**Files:**` block a task's own Steps show to document the block's
    // shape must not thereby declare files. Markdown nests fences by opening
    // the outer one with more backticks than any fence inside it, so a shorter
    // run is content: only a line with at least as many backticks as the one
    // that opened the fence can close it.
    let fenceLen = 0;
    let n = 0;
    for (const raw of String(text || '').split(/\r?\n/)) {
        n += 1;
        const line = raw.trim();
        const t = fenceLen ? null : TASK.exec(line);
        if (t) {
            task = { n: Number(t[1]), name: t[2].trim(), line: n, modify: [], test: [], read: [], consumes: [], produces: [], consumesText: [], producesText: [], interfaces: false, lines: [] };
            tasks.push(task);
            block = null;
        } else if (!fenceLen && task && HEADING.test(line)) {
            // `## Self-review`, `## Coverage`: the tasks are over, and what
            // follows belongs to no task. It is not header either — the header
            // is what comes before the first task, because that is what a
            // brief needs to carry.
            task = null;
            block = null;
        }
        if (task) task.lines.push(raw);
        else if (!tasks.length) headerLines.push(raw);
        if (t) continue;
        const f = /^`{3,}/.exec(line);
        if (f) {
            if (fenceLen === 0) { fenceLen = f[0].length; continue; }
            if (f[0].length >= fenceLen) { fenceLen = 0; continue; }
        }
        if (fenceLen) continue;
        if (!task) continue;
        // A blank line closes the block. Without this, a `- Modify:` line in the
        // prose below the block reads as another declared file.
        if (!line) { block = null; continue; }
        const b = BLOCK.exec(line);
        if (b) { block = b[1].toLowerCase(); if (block === 'interfaces') task.interfaces = true; continue; }
        const e = ENTRY.exec(line);
        if (!e || !block) continue;
        const key = e[1].toLowerCase();
        const inFiles = block === 'files' && (key === 'modify' || key === 'test' || key === 'read');
        const inInterfaces = block === 'interfaces' && (key === 'consumes' || key === 'produces');
        if (inFiles || inInterfaces) task[key].push(...ticked(e[2], inInterfaces));
        if (inInterfaces) task[key + 'Text'].push(e[2].trim());
    }
    for (const t of tasks) {
        t.body = t.lines.join('\n').replace(/\s+$/, '');
        delete t.lines;
    }
    return { header: headerLines.join('\n').replace(/\s+$/, ''), tasks };
}

// The declarations alone, which is what every caller before `brief` wanted.
const parseTasks = (text) => parsePlan(text).tasks;

const shares = (a, b) => a.some((x) => b.includes(x));

// null when the pair may run at once; otherwise the predicate that refused it.
function conflict(a, b) {
    // Fail closed. A task that declared no files has no ownership to compare,
    // and reading "nothing declared" as "nothing shared" is how the one task
    // nobody checked runs beside the task it overwrites.
    if (!a.modify.length || !b.modify.length) return 'undeclared';
    const files = [
        [a.modify, b.modify], [a.modify, b.test],
        [a.test, b.modify], [a.test, b.test],
    ];
    if (files.some(([x, y]) => shares(x, y))) return 'files';
    // A file being edited is not a file to read. A `Read:` of a neighbour's
    // `Modify:` or `Test:` waits for that neighbour's commit; two readers of
    // one file do not conflict, because nothing moves under either of them.
    const owned = (t) => [...t.modify, ...t.test];
    if (shares(a.read || [], owned(b)) || shares(b.read || [], owned(a))) return 'read';
    // And fail open here, which is not the block above being inconsistent. An
    // empty `Files:` is a malformed task — every task modifies something — so
    // nothing declared there is a declaration nobody wrote. An empty
    // `Interfaces:` is a real answer, and a common one — the plans under
    // docs/plans and docs/archive phrase it a dozen ways, from `nothing.` to
    // `nothing later tasks depend on.`, and `ticked` reads every one of them as
    // empty because none of them names an identifier. Failing closed here would
    // refuse to parallelise the first task of every plan with anything, which
    // is the whole feature.
    if (shares(a.consumes, b.produces) || shares(b.consumes, a.produces)) return 'interface';
    return null;
}

// Greedy and in order. A task joins the open group when it conflicts with
// nothing already in it, and otherwise closes that group and opens the next.
// Only the open group is compared against: an earlier group's commits are
// already in HEAD by the time this one starts, so a dependency on one is
// satisfied rather than violated. Keeping the plan's order is what lets the
// parent commit one task at a time and still pin every review range.
// Takes the plan's text, or the tasks already parsed out of it. A caller that
// needs the tasks for anything else — how many there are, which of them declared
// nothing — would otherwise parse the same file twice to ask two questions.
function groups(input) {
    const out = [];
    let open = [];
    for (const task of (typeof input === 'string' ? parseTasks(input) : input)) {
        if (open.length && open.some((t) => conflict(t, task))) {
            out.push(open);
            open = [];
        }
        open.push(task);
    }
    if (open.length) out.push(open);
    return out.map((g) => g.map((t) => t.n));
}

// `conflict()` matches a backticked identifier between one task's `Consumes`
// and another's `Produces`; a dependency written as prose instead —
// `Consumes: Task 2's --no-mdns flag name` — declares no identifier for the
// other side's `Produces` to match, so nothing conflicts and the pair is
// grouped as if either could go first. Row 1 kept `consumesText`, the raw text
// of each `Consumes:` entry, for exactly this: it is the one place left to
// look for a dependency `conflict()` cannot see. The only piece of that text
// that is machine-readable is a literal `Task <n>`, and it is worth a person's
// eye only when `<n>` is a task in this one's own group — that is the one
// case where the group's claim (these may run at once) and the sentence's
// claim (this one waits on that one) actually disagree. A `Task <n>` naming a
// task in an earlier, already-committed group is not a contradiction: that
// task's commit is already in HEAD by the time this one runs.
function proseConflicts(tasks, rows) {
    const known = new Set(tasks.map((t) => t.n));
    const groupOf = new Map();
    rows.forEach((g, i) => g.forEach((n) => groupOf.set(n, i)));
    const out = [];
    for (const t of tasks) {
        for (const line of t.consumesText) {
            for (const m of line.matchAll(/\bTask (\d+)\b/g)) {
                const other = Number(m[1]);
                if (other === t.n || !known.has(other)) continue;
                if (groupOf.get(other) !== groupOf.get(t.n)) continue;
                // The sentence this used to build is now the CLI's, because
                // `surfaces` needs the task numbers and reading them back out
                // of a formatted string is how a formatter becomes a parser.
                out.push({ n: t.n, other, group: groupOf.get(t.n) + 1, text: line });
            }
        }
    }
    return out;
}

// Group size picks the dispatch surface. Three or more independent tasks are
// one Workflow rather than three dispatches: the intermediates stay inside the
// script and only the join comes back. Two is a pair of Agents in one response,
// and one is a single dispatch.
//
// This is the batch shape, not the implementer decision: a task's own
// `**Dispatch:**` line still says whether it goes out at all, and an
// `in-session` task is not dispatched whatever surface its group carries.
//
// A group carrying either diagnostic never reaches `workflow`. `conflict()`
// fails open on purpose — it reads only a backticked identifier, so a prose
// `Consumes:` and a missing `**Files:**` block both look like independence —
// and the cost of being wrong is not the same at both surfaces. Two Agents put
// their returns in front of the parent, which is where a wrong grouping gets
// caught. A Workflow is authorised once and does not come back between its
// steps, so it wants a group that was actually shown to be disjoint rather than
// one that merely was not refuted.
// The block is required even when it says `none`. A task that omits it has
// declared nothing, and `conflict()` reads nothing as independence.
function missingInterfaces(tasks) {
    return tasks.filter((t) => !t.interfaces).map((t) => t.n);
}

function surfaces(input) {
    const tasks = typeof input === 'string' ? parseTasks(input) : input;
    const rows = groups(tasks);
    const unsure = new Set();
    for (const t of tasks) if (!t.modify.length) unsure.add(t.n);
    for (const p of proseConflicts(tasks, rows)) {
        unsure.add(p.n);
        unsure.add(p.other);
    }
    for (const n of missingInterfaces(tasks)) unsure.add(n);
    return rows.map((g) => ({
        tasks: g,
        surface: g.length === 1 ? 'agent'
            : g.length === 2 || g.some((n) => unsure.has(n)) ? 'agents'
                : 'workflow',
    }));
}

// Every fence opener in a task's section, with the files the lines above it
// name. Only the opener carries an info string, and markdown nests fences by
// length, so the closer is the next line with at least as many backticks.
// `named` is every backticked token in the three non-blank lines above, with a
// trailing `:12` or `:12-40` dropped, because a plan may point into a file and
// the Files block names the file alone.
function fences(task) {
    const out = [];
    const lines = String(task.body || '').split(/\r?\n/);
    let fenceLen = 0;
    for (let i = 0; i < lines.length; i++) {
        const f = /^(`{3,})(.*)$/.exec(lines[i].trim());
        if (!f) continue;
        if (fenceLen) { if (f[1].length >= fenceLen) fenceLen = 0; continue; }
        fenceLen = f[1].length;
        const info = f[2].trim().toLowerCase();
        if (EXEMPT.has(info)) continue;
        const above = [];
        for (let j = i - 1; j >= 0 && above.length < 3; j--) if (lines[j].trim()) above.push(lines[j]);
        const named = above.flatMap((l) => ticked(l, true)).map((p) => p.replace(/:\d+(-\d+)?$/, ''));
        out.push({ line: (task.line || 1) + i, info, named });
    }
    return out;
}

// Words only, lower-cased. Backticks, asterisks, dashes and every other mark
// become spaces, so a bullet quoted into a table cell with different emphasis
// still matches, and `<f>` reads as `f` on both sides.
const normalise = (s) => String(s || '').toLowerCase()
    .replace(/[`*]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const keyOf = (s) => normalise(s).split(' ').slice(0, 8).join(' ');

// The design's promises: every first-level bullet under a numbered `## N.`
// heading, and every body row of `## What proves it done`. A bullet under an
// unnumbered heading is context, and a nested bullet is detail of the one
// above it. Only the first line of a wrapped bullet is taken — eight words
// of it are the key, and a first line holds more than eight.
function promises(designText) {
    const out = [];
    let numbered = false;
    let proves = false;
    let fenceLen = 0;
    for (const raw of String(designText || '').split(/\r?\n/)) {
        const line = raw.trim();
        const f = /^`{3,}/.exec(line);
        if (f) {
            if (fenceLen === 0) fenceLen = f[0].length;
            else if (f[0].length >= fenceLen) fenceLen = 0;
            continue;
        }
        if (fenceLen) continue;
        if (HEADING.test(line)) {
            numbered = /^##\s+\d+\./.test(line);
            proves = /^##\s+what proves it done/i.test(line);
            continue;
        }
        if (numbered && /^-\s/.test(raw)) out.push(line.replace(/^-\s*/, ''));
        if (proves && line.startsWith('|') && !/^\|\s*-{2,}/.test(line) && !/^\|\s*test\s*\|/i.test(line)) {
            out.push(line.split('|')[1].trim());
        }
    }
    return out;
}

// Every backticked path in the first cell of a `| file | ... |` table.
function filedPaths(designText) {
    const out = [];
    let inTable = false;
    for (const raw of String(designText || '').split(/\r?\n/)) {
        const line = raw.trim();
        if (/^\|\s*file\s*\|/i.test(line)) { inTable = true; continue; }
        if (!line.startsWith('|')) { inTable = false; continue; }
        if (!inTable || /^\|\s*-{2,}/.test(line)) continue;
        out.push(...ticked(line.split('|')[1], true));
    }
    return out;
}

// A path, for the second report only, is directory-qualified: a slash inside
// it, no whitespace, and not a leading slash. `module.exports` is a member,
// `POST /clear-stale` and `/clear` are routes, `roots.json` is a file the
// program writes rather than one the task edits, and `source_of_truth:
// lib/a.js` is a frontmatter line — each was read as a path by a looser test.
const looksLikePath = (p) => /^[^/\s][^\s]*\/[^\s]+$/.test(p);

// What a plan got wrong against its design, one line each; empty is clean.
// Three checks, all text: a promise the plan never quotes, a path the design's
// file table names that no task modifies or tests, and a code fence with no
// file named above it — or one naming a file its task does not own. On the
// 2026-09-06 station plan this names the `waited` column, `data-state`, the
// cleared count and Task 7's `render()` fence, which is the incident this
// exists for.
function lint(planText, designText) {
    const { tasks } = parsePlan(planText);
    const out = [];
    const plan = normalise(planText);
    for (const p of promises(designText)) {
        const key = keyOf(p);
        if (key && !plan.includes(key)) out.push('promise with no task: ' + p.slice(0, 80));
    }
    const declared = new Set(tasks.flatMap((t) => [...t.modify, ...t.test]));
    for (const p of filedPaths(designText)) {
        if (!declared.has(p)) out.push('design file table names ' + p + ', which no task modifies or tests');
    }
    for (const t of tasks) {
        const files = [...t.modify, ...t.test, ...t.read];
        for (const f of fences(t)) {
            // A fence naming a file the task does not own gets the specific
            // line and not the general one: it did name a file.
            const owned = f.named.some((p) => files.includes(p));
            const foreign = f.named.filter((p) => !files.includes(p) && looksLikePath(p));
            if (!owned && !foreign.length) {
                out.push('Task ' + t.n + ' line ' + f.line + ': a `' + f.info + '` fence names no file from its Files block');
            }
            for (const p of foreign) out.push('Task ' + t.n + ' line ' + f.line + ': `' + p + '` is named but not in its Files block');
        }
    }
    return out;
}

module.exports = { parsePlan, parseTasks, conflict, groups, proseConflicts, surfaces, missingInterfaces, fences, lint };
