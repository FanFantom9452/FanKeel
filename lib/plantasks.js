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

// Paths and names are written inside backticks everywhere in `docs/plans`. The
// prose around them is the author explaining the entry, and reading that as a
// path is how a task ends up owning a sentence. Only the first backtick on the
// line is the declared path or name — everything after it, including any
// backticks inside an em-dash explanation, is that prose.
function ticked(text) {
    const m = /`([^`]+)`/.exec(String(text || ''));
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
            task = { n: Number(t[1]), name: t[2].trim(), modify: [], test: [], consumes: [], produces: [] };
            tasks.push(task);
            block = null;
            continue;
        }
        if (!task) continue;
        // A blank line closes the block. Without this, a `- Modify:` line in the
        // prose below the block reads as another declared file.
        if (!line) { block = null; continue; }
        const b = BLOCK.exec(line);
        if (b) { block = b[1].toLowerCase(); continue; }
        const e = ENTRY.exec(line);
        if (!e || !block) continue;
        const key = e[1].toLowerCase();
        const inFiles = block === 'files' && (key === 'modify' || key === 'test');
        const inInterfaces = block === 'interfaces' && (key === 'consumes' || key === 'produces');
        if (inFiles || inInterfaces) task[key].push(...ticked(e[2]));
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
    // `Interfaces:` is a real answer, and the two the fixture in
    // tests/plantasks.test.js writes are the two a plan actually contains:
    // `Consumes: nothing from an earlier task.` is what the first task of every
    // plan says, and `Produces: nothing.` is what the last one says. Failing
    // closed here would refuse to parallelise Task 1 with anything, in every
    // plan there will ever be, which is the whole feature.
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

module.exports = { parseTasks, conflict, groups };
