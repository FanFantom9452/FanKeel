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
// This file reads a plan and nothing else. It does not know about git, the
// ledger, or how a dispatch is made.

const TASK = /^##\s+Task\s+(\d+):\s*(.*)$/;
const BLOCK = /^\*\*(Files|Interfaces):\*\*\s*$/;
const ENTRY = /^-\s*(Modify|Test|Consumes|Produces):\s*(.*)$/;

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

function parseTasks(text) {
    const tasks = [];
    let task = null;
    let block = null;
    // A fenced code block is an example of the format, not the format itself —
    // the `**Files:**` block a task's own Steps show to document the block's
    // shape must not thereby declare files. Markdown nests fences by opening
    // the outer one with more backticks than any fence inside it, so a shorter
    // run is content: only a line with at least as many backticks as the one
    // that opened the fence can close it.
    let fenceLen = 0;
    for (const raw of String(text || '').split(/\r?\n/)) {
        const line = raw.trim();
        const f = /^`{3,}/.exec(line);
        if (f) {
            if (fenceLen === 0) { fenceLen = f[0].length; continue; }
            if (f[0].length >= fenceLen) { fenceLen = 0; continue; }
        }
        if (fenceLen) continue;
        const t = TASK.exec(line);
        if (t) {
            task = { n: Number(t[1]), name: t[2].trim(), modify: [], test: [], consumes: [], produces: [], consumesText: [], interfaces: false };
            tasks.push(task);
            block = null;
            continue;
        }
        if (!task) continue;
        // A blank line closes the block. Without this, a `- Modify:` line in the
        // prose below the block reads as another declared file.
        if (!line) { block = null; continue; }
        const b = BLOCK.exec(line);
        if (b) { block = b[1].toLowerCase(); if (block === 'interfaces') task.interfaces = true; continue; }
        const e = ENTRY.exec(line);
        if (!e || !block) continue;
        const key = e[1].toLowerCase();
        const inFiles = block === 'files' && (key === 'modify' || key === 'test');
        const inInterfaces = block === 'interfaces' && (key === 'consumes' || key === 'produces');
        if (inFiles || inInterfaces) task[key].push(...ticked(e[2], inInterfaces));
        if (inInterfaces && key === 'consumes') task.consumesText.push(e[2].trim());
    }
    return tasks;
}

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

module.exports = { parseTasks, conflict, groups, proseConflicts, surfaces, missingInterfaces };
