---
name: fankeel-build
description: The build stage — run a plan's tasks, or a design's file table where there is no plan, in a loop that does not stop to ask, keeping its place in a ledger and reviewing each task as it lands. Use for the build stage of a fankeel task, implementing an approved plan, resuming build work after a compaction, or when a task loop needs a ledger.
version: 0.111.76
status: current
last_verified: 2026-10-16
source_of_truth: lib/stages.js, lib/ledger.js, lib/plantasks.js, scripts/ledger.js, scripts/review-check.js
---

# fankeel-build

Produces the change.

**Done when** the denominator lists nothing open, each piece has had its review
as it landed, and the whole-branch review has run. **The denominator is the
ledger where there is a plan** — and `design`'s file table
where there is no plan, which is every `bounded` task. A `spike` has neither, and what it
counts against is the question it was asked: its gate gives the answer, never
an offer to do the work; lasting code first upgrades the route to `bounded` —
say so, then ask.

- **One path, never a search.** `<plugin>` is two directories up from this
  file; resolve every script this skill names against that root and nowhere
  else. One exception, and it is a different root rather than a search for
  one: where the registry root's own `package.json` names `fankeel`, the
  scripts to run are the working tree's, because the installed copy lags it
  by a release.
- **No fallback path.** Never the working directory, a home directory, a
  global skill root, or another copy found by name — that one path resolves,
  or none does.
- **A missing script stops the stage, named.** Say which path you resolved
  and that it is not in this plugin install — never a guess at where it
  moved, never a workaround.

## Not a defect

| Looks like a finding | Why it is not |
|---|---|
| Dead code left in the diff, not deleted | Only dead code this change created gets removed — `lib/stages.js:312` (`Remove what your own change orphaned`), so an orphan predating this task is correctly still there, just named. |
| A new ask from mid-build routed to a TODO entry instead of built | That is the routing rule working, not the ask dropped — `lib/stages.js:309` (`is one TODO entry at the detail`), not silence. |
| A ruling recorded instead of a fifth stopper firing | `lib/stages.js:311` names deciding as the normal outcome (`Decide`) — only irreversible, security-sensitive, out-of-workspace or every-path-a-guess actually stop the loop. |

Why each rule is what it is, under the same headings: [rationale.md](rationale.md).

**This stage does not stop at a question until it is done.** Its gate is the end
of the stage, not the end of a task: the loop runs everything the denominator
lists open, and then asks once. A `fankeel-brain` dispatched for one group (its prompt names a group, not `build close`) returns with no gate once its own tasks are done; only `build close` is the one that asks.

## Setup

### 1. An isolated workspace

Use a worktree where the project has one. Starting implementation on `main` or
`master` needs the user's explicit consent — ask once, then proceed with whichever
they chose, and do not ask again.

**Then the neighbours.** `node <plugin>/scripts/task.js intends <plan bucket>/<file>.md --session <id>`
— with no plan, the design file, whose file table it reads instead — records
this task's `intends` and prints `warn`, `note` or `none` against every live
neighbour. It blocks nothing. A `warn` names a session already at build or later
in these files: say it in the first dispatch announcement, before any
implementer goes out.

### 2. Open the ledger

```
node <plugin>/scripts/ledger.js --plan <plan bucket>/<file>.md show
node <plugin>/scripts/ledger.js --plan <plan bucket>/<file>.md --range <the sha before the plan was written>..<the sha init is run at, before Task 1's BASE> init
```

**Pass the plan stage's own range on `init`.** `--range` is optional and records
the commits that wrote the plan itself — `ranges` then lists that row beside
the tasks. A second `init --range` with the same range leaves the
ledger in place; a different range replaces it (it belongs to an earlier plan).

**`--plan` goes before the verb, always.** Everything after the verb is text, so
a completion note or a ruling keeps every word.

**And no flag takes a verb as its value.**

**Conversation memory does not survive compaction; this does.** A task the ledger
lists as complete is done — do not redo it. Resume at the first task without a
completion line. After a compaction, trust the ledger and `git log` over your own
recollection.

A ledger whose header names a different plan is another plan's progress. Leave it
where it is; `init` starts your own beside it.

The commit message shape is `land`'s `COMMIT` rule; step 4 carries its skeleton.

**With no plan file there is no ledger and nothing to `init`.** The rows of
`design`'s file table are the tasks instead: they are worked in the same loop
below, each gets its review, and a ruling or a completion line goes in the
response and then the commit message rather than through `ledger.js`.

**The rows run in order, one at a time.** Nothing groups them: `groups` reads
only `## Task` headings, never a file table, and with no `**Interfaces:**` block
the shared-cause check has nothing to match.

### 3. Scan the plan before the first task

Write down what you check as you check it. **The output is a table, not a
verdict:**

| Rows | What each says |
|---|---|
| one per pair of tasks sharing a file or interface | what one produces against what the other consumes, and what you found |
| one per task | whether its own text agrees with itself — the tests it specifies against the code it specifies |

Write the table into the ledger, rule on anything it surfaces, and record each
ruling.

Then run it rather than remembering it:

```
node <plugin>/scripts/ledger.js --plan <plan bucket>/<file>.md groups
```

It computes the first row's predicates over the whole plan: tasks in one group
have disjoint `**Files:**` and neither consumes what another produces. A fix
round inherits its task's `**Files:**` for this purpose, so two fix rounds
that touch one file are sequenced rather than grouped.

Record it in the ledger beside the table:

```
node <plugin>/scripts/ledger.js --plan <plan bucket>/<file>.md scan
```

`scan` writes exactly what `groups` just printed — the thing two sessions on
2026-09-05 pasted in by hand — and finds its own previous table by heading and
replaces it, so running it again after nothing has changed appends no second
copy.

**With no plan there is nothing here to scan**, and no ledger to write it into.

`groups` now prints a surface beside each group, and it is the batch
shape the scan records; what goes out next is step 2's `ledger.js ready`:

    1: 1, 2, 3  — workflow
    2: 4        — agent

`agent` is one dispatch, `agents` two in one response, and `workflow` one
Workflow whose fan-out is that group, from three tasks up; each task is
implemented and then reviewed inside it as one pipeline item. When build runs
under a stage agent (`stage.agents` names build) `groups` prints `agents` for a
group of three or more, because that agent has no Workflow tool. It is the batch
shape only — a task whose `**Dispatch:**` line reads `in-session` or `user` is
not dispatched at all, whatever its group carries. Do not re-derive the surface
from the group size: a group of any size carrying a prose `Consumes:` or a task
with no `**Files:**` or `**Interfaces:**` block prints `agents`. A require-edge line under the table does not change
the row: the group stays `workflow`.

## The task loop

For each task the denominator does not list as complete:

**Where there is no plan there are no groups.** Everything below that names one —
the group in step 1's BASE rule, the tasks `ledger.js ready` sends in step 2, the
`groups` command itself — is the plan path. **The rest of step 2 is not**: a
`| file | change | dispatch |` row carries its `**Dispatch:**` line in the third
cell, in the same two forms, and the loop reads it there. The three things a
dispatch carries become the fit line with the row's place in the table; in place
of a brief file the row itself
verbatim — its `change` cell is the whole brief, so a cell that could not brief a
stranger is a design failure — with the design's `proves it done` line where
Global Constraints would be and the brief's footer rules said in the dispatch;
and a return contract in place of a report path: a status line — `done`,
`partial: <what>` or `blocked: <why>` — the paths written, one line on the tests
and one per new test naming the mutation that reddens it, with no report file. A
no-plan route keeps one file on disk and no more: the approved file table, at
`.fankeel/build/task-<started>/design.md`. Where build runs as a controlled
stage agent and design does not, design wrote it by rule before its gate
([docs/subagents.md](../../docs/90-agent/reference/subagents.md)'s `DESIGN_TO_BUILD`); on every other
move from design to build, `task.js stage build` prints
`design.md is missing` with the path, and the table is written there before
the first row is built. After a compaction, read the denominator back from
that file, never from the summary. The implementer
does not commit; step 4 stages the paths in the row's `file` cell, which may name
more than one, and step 5 reviews the range as it would a task's. A no-plan route
runs one row per pass, and every other step of the loop is unchanged.

**Before the first task, the hands** — on the plan path; a file table (no
plan) has no such row. `node <plugin>/scripts/ledger.js --plan
<plan bucket>/<file>.md hands` lists every task whose `**Dispatch:**` line reads
`user — <what the user does>`, and `none` when there is none. `task.js stage
build` already printed the same list to the session holding
`AskUserQuestion`, which asks the user then and there — after the other tasks
and before this stage's gate, in this session with them; they do it first and
say when; or skip, each becoming a TODO entry — and notes the answer with
`task.js note`, so it rides every prompt. A stage agent asks nothing and sends
none of them: `ready` never lists them, and its report names them on a line
`hands: <n>, <n>`. When the dispatched tasks are done, the session holding
`AskUserQuestion` runs them with the user — an edit the guard refuses it goes
to an implementer — commits and reviews each like any other task, and only
then asks this stage's gate.

1. Record `git rev-parse HEAD` as BASE — **immediately before this task's
   commit, not when its group went out.**
2. Do what the task's `**Dispatch:**` line says. `in-session` means implement it
   here; `implementer, <model>` means dispatch one as
   `subagent_type: fankeel:fankeel-implementer` — with `effort: "<the field>"`
   on the call when the line carries a third field,
   `implementer, sonnet, high` — **pass the model
   explicitly**, an omitted one inherits this session's, and say how many
   and on which model in the response that sends it. Either way: every
   changed line traces to the plan's task, follow the patterns already in this
   repository, do not improve adjacent code, comments or formatting on the way
   past, and remove what your own change orphaned — dead code you did not create
   gets mentioned, not deleted.

   A dispatch carries three things and nothing else, and **none of them is a
   decision**: one line on where the task fits, the path to the task's brief
   file, and the path it must write its report to. The brief is written by

   ```
   node <plugin>/scripts/ledger.js --plan <plan bucket>/<file>.md brief <n>
   ```

   and holds the plan's goal and spec line, the `## Global Constraints` block
   verbatim, the task's whole section, the `Produces:` entry of every task it
   consumes from, and a fixed footer of the rules an implementer cannot infer
   — the files it may read and the walk it may never make, no commits, its
   own test command only, and the return contract below. Never the session's
   history, and never a paste of the plan: the brief is a file, and the
   dispatch names it.

   Everything else the loop needs — BASE, the review range, the diff, the map
   path, the commit message, the ledger note — is a runtime fact, taken when it
   is needed and never carried in the plan.

   A dispatched implementer **does not commit. It returns a status line, the
   paths it wrote, the `ℹ pass` / `ℹ fail` line, and one line per new test:
   `<test name> — red when: <the mutation>`.** Never a diff: step 5 reads the
   change from git once the parent has committed. A new test with no line
   naming what reddens it is a finding before the reviewer reads anything.
   Save the return as it came, to `.fankeel/build/task-<started>/review-<n>.txt`
   where `<n>` is the task number, before the reviewer is sent: that is the
   file `review-check.js --returned` reads for table (b). And a brief whose task text names a file its Files block does not
   list comes back as `blocked: <the file> is named but not declared` in the
   implementer's first turn, never built around — that is a plan defect, ruled
   on here.

   **What goes out is what `ledger.js ready` lists**, on the plan path — with
   no plan the rows run one per pass, as above.
   `node <plugin>/scripts/ledger.js --plan <plan bucket>/<file>.md ready` prints,
   one number a line, every task the ledger does not list as complete whose
   earlier tasks it conflicts with all are, and `none` when there is nothing
   to send. Send every task it lists that is not already out, in one
   response, and say how many and on which model. Each time a task is
   recorded complete, run it again and send what it newly lists in that same
   response. `TODO.md` and `docs/README.md` do not count as a
   shared file there (`INDEX_FILES` in `lib/plantasks.js`). A task whose `**Dispatch:**` line reads `user` is
   never listed — the hands paragraph above step 1 has it.

   **A stage agent's implementers each build in a worktree.** A
   `fankeel-brain` asks `ledger.js --plan <f> ready --worktree` instead: there
   two tasks sharing a `Modify:` or `Test:` file go out together, and a
   `Read:` of a neighbour's file or a `Consumes`/`Produces` edge still holds
   one back. It sends every implementer with `isolation: "worktree"`; the commit
   file's first line is `into <path>`, the main tree the cherry-pick lands on, and each
   task's block opens with `worktree <path>`, the path that
   implementer's Agent result names. A reply `conflict <paths>`
   means that task is not in HEAD: send it once more, fresh, on the new HEAD,
   without asking; the same task conflicting a second time stops the build,
   and the handoff names the paths for the controller to ask about. Before
   dispatching, the brain runs `git rev-parse HEAD` itself and tells every
   worktree-isolated implementer, before its first edit, to run
   `git reset --hard <that sha>` in its own worktree.

   **Profile `dispatch.inflight` sets how many are in flight, eight by
   default**, and that number applies only with a plan — with no plan one row
   is out at a time: `ready` listing ten sends eight (at the default), then one more as each returns. With a plan, three or more listed at once
   with nothing else in flight may go as one Workflow, step 4's `workflow`
   case; anything else goes as Agents.
3. **`in-session` only** — test first where the task says so, and watch it
   fail. A dispatched implementer did this inside its own run.
4. Commit —

   **`agent` and `agents`**: unchanged. The parent commits each task as its
   implementer returns, and reviews the pinned `BASE..<sha>` range.

   **`workflow`**: the group is one Workflow of two stages, implement then
   review, and **nothing commits while it runs**, so

       git diff HEAD -- <the task's declared Modify and Test paths>

   is that task's change and nothing else — a range pinned by path where a
   committed one is pinned by sha.

   Every implementer in the run gets its brief file, and the brief's footer
   carries the three things it cannot infer — neighbours in the same tree so
   its own test command only, no commits and no touching the index, `HEAD` or
   branch state, and paths and a status back rather than a diff.

   When the run returns, the parent takes BASE and commits each task in the
   group's order, then records `--range BASE..<sha> complete <n>`. The reviews
   already happened, so what the parent adds is the commit and the ledger line.

   The message is the skeleton `land` uses: `type: what changed` under 60
   characters, one bullet per change with the module it landed in, and one
   paragraph only for what a bullet cannot hold.

   Keep BASE and that sha together — step 7 records them as the task's review
   range.

   Anything written outside those paths stays unstaged: read `git status` after
   the commit for a wrong `**Files:**` block.

   **Opening a `workflow` group.** The script is written, not authored, and
   only on the plan path — with no plan there is no group to write:
   `node <plugin>/scripts/ledger.js --plan <plan bucket>/<file>.md workflow
   --group <N>` writes every implementer's brief and the script to
   `.fankeel/build/<plan stem>/workflow-g<N>.js`, and prints that path. The
   session holding the Workflow tool opens it as
   `Workflow({ scriptPath: "<that path>" })`. Each task whose Dispatch line
   says `implementer` goes out as `fankeel:fankeel-implementer` on that
   line's model and effort, then as `fankeel:fankeel-reviewer` on the
   path-pinned diff above, and the run returns one
   `{ n, implementer, review }` per task: save each `implementer` to
   `review-<n>.txt`, as step 2 says, before committing; an entry whose
   `implementer` is null never ran, so it is sent again as one Agent rather
   than committed or recorded complete. A stage agent has no
   Workflow tool, so a build brain whose `groups` row has three or more runs
   the same command and writes its group report with a line
   `workflow: <path>`; `scripts/await.js` tells the controller to open it and
   SendMessage the brain `Workflow returned:` and the result, and the brain
   asks for each task's commit and records it from there.
5. One reviewer, on this template and no other, against the brief and the
   diff. **Pin the range at both ends** — `BASE..<the sha this task's commit
   produced>`. Every task has one, `in-session` included; there is no `HEAD`
   form.

   ```
   You are reviewing ONE task's change in <repo>. READ-ONLY: never mutate the
   working tree, the index, HEAD or branch state; inspect with git show, git
   diff and git log only.

   THE RANGE, pinned at both ends: <BASE>..<sha>
   THE BRIEF: <the task's brief file> — its Files block says what the task
   owns, its section says what it must do.
   THE COVERAGE ROWS naming this task, from the plan's ## Coverage table:
   <quoted, one per line>
   THE MAP: .fankeel/map.md
   THE IMPLEMENTER RETURNED: <its status, paths, test line and mutation lines>

   Part 1 — against the brief and the coverage rows, in this order:
     Missing: a promise or step the change does not implement, or claims
       without evidence.
     Extra: a change no line of the task asks for — adjacent code improved,
       a file outside the Files block touched.
     Misunderstood: the right thing built the wrong way.
   Part 2 — the tests, mechanically first: run
     `node <plugin>/scripts/review-check.js --sha <sha> --base <BASE> --returned <the file the implementer's return was saved to>`
     and paste its three tables into your return, as printed. Then judge
     only what they cannot. (a): a row's test counts only when it presses
     that selector through the listener's OWN event type and goes red when
     the branch is deleted (`if (false && ...)`); a hit that only renders
     the selector, or asserts that nothing happened and stays green on
     deletion, is a guard, not a hit, and the row is a finding. (b): pick
     one red-when line, apply its mutation to a scratch copy
     (`git show <sha>:<path> > <scratch>`), and confirm the named test
     reddens; a mutation that reddens every test in the file killed the
     harness and counts as dead, not red. (c): every row that is not `ok`
     is a finding as printed. A check the diff adds that is not a test (a
     script, a guard, a verify line) needs one input it must reject and
     proof it rejects it. Two mutations that redden exactly the same tests
     are a gap — one test that tells them apart is missing.
     A test of locking or ordering must wait on an explicit signal from the
     other side (a line the other process prints, a marker file), never on a
     delay, and must go red on every run of the mutation that removes the
     lock; one that waits a fixed time can pass without exercising the lock.
   Part 3 — every changed line traces to the task's text; the patterns
     already in the repository are followed. Then name the page this
     change makes false (a renamed export, a changed default, a removed
     flag) as `page:line`.
     Then, where the diff adds a data field or changes a value a person
     sees, three more, over the whole repository and not the changed
     file alone: (a) every surface that shows the record reads the new
     field — grep its name across lib/, scripts/, hooks/ and assets/ and
     name each page and CLI output that shows the record but never
     reads it; (b) every new string a person reads goes through the
     project's string table for translation, never written into a
     render as a literal; (c) list every place a page or a CLI prints
     the changed value, and for each mark the change adds there, the
     test that renders it through its caller and goes red when the mark
     is removed. A surface with no reader, a literal string, or a place
     with no such test is a finding. Where the diff rewrites text a page
     shows, grep `tests/` for the old wording and run the tests that assert
     it; one still asserting it is a finding.
   Part 4 — cuts, over the lines this diff added and no others, in the
     format of the `## Cuts` section of your agent file. A cut is a finding.

   RETURN, and nothing else: one line per finding, numbered `N. ` in one
   sequence across the whole return (agents/fankeel-reviewer.md `## Numbering`),
   as `N. path:line — <the problem>`, most serious first, then Part 4's cuts and their `net:` line —
   or the single word `clean` ONLY when Parts 1-3 found nothing, Part 4
   found nothing to cut, AND (where the diff changes a listener) every row
   of the selector table has a qualifying test; otherwise `clean` is never
   the whole return. Where the diff changes an event listener, the return
   also carries that listener's selector table (Part 2's table (a)),
   one row per selector, even beside `clean`, and only those selectors.
   A row with no qualifying test is also a finding line
   (`N. path:line — <the problem>`) and stays in the table marked NONE.
   Every line you return stays in a long-running parent context.
   ```

   Give it the brief path and the range — never a paste of the session's
   history. Dispatch it as `subagent_type: fankeel:fankeel-reviewer` — with the same `effort: "<the field>"` when the task's Dispatch line names one; the model
   comes from that agent file, not typed by hand here.

   Before dispatching, run `node <plugin>/scripts/lenses.js <BASE>..<sha>` and
   put what it printed in the brief: `none`, or the `## Silent failure` lens
   and the `## Comment` lens by name, whichever it named — the reviewer reads
   that lens over the same range. With no plan, the same command runs over
   the row's range; nothing else changes.
   Where the project's profile says `sensitive.review` is `true`
   (`task.js profile show`), the brief also asks for the `## Sensitive` lens
   over the same range.

   **A task that changes a page gets a second reviewer** in the same response:
   `subagent_type: fankeel:fankeel-render-reviewer`, whose file pins `sonnet`.
   Give it the brief path, the mockup path from the design's `spec:` line, and
   `.fankeel/render.json` where the project has one — a page path otherwise.
   Its first line is `disposition: recapture`, `fix` or `ship`; anything but
   `ship` goes back to the implementer like the first reviewer's findings.
   A page task runs it by default, every time. The exception is a task that is
   one request of the tuning loop below: the render reviewer is skipped for
   that request, and a `fankeel-reviewer` alone reviews it. The user may also
   say, this session, to skip it (or to run it) for any page task; that is a
   ruling, not a stopper, and a skip is written for each page task it covers.

   **The render verdict is what lets a page task complete.** Where
   `.fankeel/render.json` gives a page `src` globs, a range that changed a
   file under one is refused by
   `ledger.js --plan <file> --range <BASE>..<sha> --render <file> complete <n> "<what landed>"`
   — and by `fix` the same way — unless `--render` names the render
   reviewer's return, saved under `.fankeel/build/task-<started>/`, whose
   first line is `disposition: ship`, or the ledger holds a
   `Ruling: render skipped — <why>` written since the last task's line:
   `ledger.js --plan <file> ruling "render skipped" "<why>" "<cost if wrong>"`.
   In such a project a `complete` with no `--range` is refused outright — the
   range is what lets the check run — and `--render` alone does not clear it;
   only that skip ruling does.
   With no plan there is no ledger, so the same check runs when the task
   leaves build: `task.js stage <next> --session <id> --render <file>`, or
   `task.js note "Ruling: render skipped — <why>" --session <id>` first.

   **Where the task changed a page**, a tuning
   loop on the real page follows once it lands, served by the
   project's own server through
   `node <plugin>/scripts/tune.js serve --proxy <the server's url> --src <the
   files that draw it>` — add `--rebuild "<cmd>"` only where the server does
   not read those files on every request — and the url it prints goes to the
   user. A click reaches the page until the fankeel logo in its bottom-right
   corner asks for one, and 全部送出 sends its drafted items as one request.
   Loop until the user says the page is done:
   `node <plugin>/scripts/tune.js wait` prints the next request with its
   `sources` and `items`; dispatch one `subagent_type: fankeel:fankeel-mockup` per request —
   no model unless `design.mockup` names one other than opus — to
   change the source there and nothing else; then
   `node <plugin>/scripts/tune.js done <id>`, which puts back and refuses an
   edit that touched anything outside `--src`, and refuses a failed rebuild
   the same way. Verify comes after the loop, not during it.

   **When the user has said, this session, not to dispatch**, the reviewer runs
   here, in this session. That is a ruling, not a stopper. Record it once — at
   the top of the ledger, or in the response where a
   `bounded` task puts its rulings — not once per task; the plan's
   `**Dispatch:**` lines already read `in-session — the user said so this
   session` for the same reason. Only the user settles it: the Agent tool
   has no gate.

   **When the first round returns a finding, one more reviewer confirms it
   before any fix round starts.** Step 5's reviewer returning anything but
   `clean` — or, on a page task, the render reviewer returning anything but
   `ship` — is a first round. Dispatch one more `subagent_type:
   fankeel:fankeel-reviewer` with its agent file's `## Verify` mode, the
   brief path, the pinned range and the whole findings list in one dispatch,
   never one reviewer per finding. Only what it marks `CONFIRMED` or
   `PLAUSIBLE` goes into the fix round below; what it drops is treated as
   `clean` and never reaches the implementer.
6. Fix rounds are bounded at **five**. A finding you overrule is a ruling, not a
   silence.

   Before a third round, write down the premise the first two rounds shared —
   `ledger.js ruling` — and test that premise before fixing again.

   **A finding that would defeat a verify row is fixed in this task, now.**
   When a reviewer's finding — or one the parent sees in its return — names
   something verify will test this task against (a mark missing from a
   display, a test that stays green when its branch is removed, a citation
   off by a line), it goes into this task's next fix round. It is never
   written up as a note for the gate, a ruling, or a later task while
   rounds remain.

   When the fifth round ends with findings still open, record what remains as
   rulings with their cost — `ledger.js ruling` — and mark the task complete
   with them named.

   A finding that is a reference-page correction or a one-line fix with no
   test cycle of its own does not need a fix round at all: dispatch
   `subagent_type: fankeel:fankeel-fixer` instead of resuming the task's implementer,
   never more than two files at once, and re-run whatever check the finding
   named yourself once it returns. A fix that needs its own red-then-green
   cycle still resumes the implementer — `fankeel-fixer` cannot run a test.

   **A fix round lands the same way the task did**: the resumed implementer
   returns paths and does not commit, and the parent stages that task's
   declared paths and commits them. Re-review
   `<the task's previous sha>..<the new one>`. Record it too:
   `node <plugin>/scripts/ledger.js --plan <file> --range <the task's previous sha>..<the new one> --task <n> fix "<what>"`,
   so `ranges` lists every reviewed commit on the branch and not only the
   tasks.
7. `ledger.js --plan <file> --range <BASE>..<the sha> complete <n> "<what landed>"`.
   The flag precedes the verb; everything after `complete` is the note. A task
   completed with no `--range` is recorded and reported as such by `ranges`,
   and gets no verifier.
   Where `.fankeel/render.json` gives a page `src`, it is not recorded at all:
   it is refused unless a `Ruling: render skipped — <why>` covers the task.

**A fix that came back from `verify` is a row of this loop.** `verify` commits
nothing; a defeated row is routed here at its gate, and here it gets what a
task gets: BASE taken immediately before its commit, the implementer resumed
or the fix made in-session, the parent's commit, one reviewer on the template
above over `BASE..<sha>`, and then

```
node <plugin>/scripts/ledger.js --plan <file> --range <BASE>..<sha> --task <n> fix "<what>"
```

which writes a `Fix:` line `ranges` lists beside the task rows. `--task <n>`
names the task the defeated row cites, and is left off for a row no task owns;
the station's gate tab counts each task's fix rounds from it. `--range` is
required on `fix`.

**The close runs three things at once.** When the last task is done, send them
in one response: the fast suite in the background —
`node <plugin>/scripts/suite.js --session <id> --fast` with `run_in_background`,
which skips the tests named `@slow`; land runs them — and the one whole-branch
review, and run docs-check below yourself while both are out; `suite.json`
carries each run's `ms`. Take
the three returns together before changing anything. docs-check only reads, but
its tier 1 rewrite and tier 2 round start once the suite has returned, so no page
changes under a running suite. A red suite is this stage's own — the failing
test names are in `suite.json`'s `failed` — and so are the review's findings:
both go into one `fankeel:fankeel-fixer` round with tier 2's. When that round
changes anything but `.md`, run `suite.js --fast` once more; a green suite and a round that touched only `.md`
need no second run.

**Then docs-check, at close.** Run
`node <plugin>/scripts/docs-check.js` — the check verify runs — beside the suite
and the review, and treat what it finds as this stage's own, in three tiers, each
run once and never looped:

1. A `moved` finding that names one new line (`— it is at :N`) is rewritten
   by `node <plugin>/scripts/docs-moved.js`, with no agent; it prints `fixed`
   or `left` for each.
2. Every other `gone`, `moved`, `past-end` or `orphan` finding goes to one
   `fankeel:fankeel-fixer` round; docs-check then runs once more, and what is
   still there goes into the report for the user, never to a second round.
3. A finding docs-check gets wrong — a symbol matched to the wrong file — and
   a historical citation in a write-once page (a decision, an archive, a
   report) is recorded as a ruling with `ledger.js ruling`, never edited to
   turn the check green.

A finding the report would call older than this build — not this build's
to fix — is checked on the build's first BASE before it is called that:
open the citing page and its target with `git show <BASE>:<path>` at the
cited line, and only a citation broken there too may be reported as
earlier. One that held at BASE is this build's, and goes to the tiers
above.

The `docs-check:` line of the output says what came of it.

## Rulings, not stalls

A running plan does not wait on a person. Conflicts, ambiguities, plan defects —
decide them, and record the decision:

```
node <plugin>/scripts/ledger.js --plan <file> ruling "<what>" "<why>" "<cost if wrong>"
```

**With no plan the ruling goes in the response and then the commit message**, by
the branch in setup step 2 that sends the completion line to the same two places.
Nothing else in this section changes.

The spec is the binding authority, the plan is its argument, and your judgement
settles what neither answers.

**Four things stop the loop, and only these:**

1. an irreversible or destructive operation
2. a security-sensitive action
3. a side effect outside this workspace that norms say you ask about first — a
   merge, a push to a shared branch, a publish
4. a plan, or a file table, so broken that every path forward is a guess

## A cost claim is measured, not assumed

Where a task's whole justification is that a change is cheaper, faster or
lighter, its steps name the script that measures the claim and record what it
printed before the change. Run
that same script again once the change lands, before treating the task as
done.

A number that has not improved is not a task to patch: revert the change,
record the ruling and the number with `ledger.js ruling`, and leave the task
un-kept rather than defending it through a fix round it was never about. A
cost claim `verify` finds still unproven when it re-runs the same script over
the merged tree is routed back here exactly as any other finding is, and this
is the ruling it lands on.

## A new ask is not a fifth stopper

A request the user raises mid-build is routed **in the turn it arrives**, one of
three ways:

1. **It neither blocks this task nor belongs to it** — one TODO entry (`todo.js new --body` in folder mode; a `TODO.md` line in hand-written mode) under
   the heading that says what it is still short of, pointing at the detail. Do
   not start it.
2. **It blocks this task, or belongs here** — do it now, as part of this task.
3. **Genuinely either** — it could plausibly belong to this task or to a later
   one, and nobody said when it was wanted. **Ask, in that same turn.**

Say which of the three it fell into, and why.

Two requests arriving together are routed one at a time. Route the clear one and
ask about the other.

## What delegation costs

**Hand artefacts over as files.** A reviewer gets
paths; it does not get the conversation. A dispatch describes one task, not the
session's history.

Say what you want back, and why it costs.

The same asymmetry runs the other way. What you send is read once in a context
that is thrown away; what comes back is read on every later turn. So spend words
on the dispatch and buy them back on the return — a brief that names the exact
files, the exact anchors and the exact wording costs nothing that lasts, and it
is the difference between one round and three.

A fix round **resumes** that implementer rather than starting a new one. When a round stops shrinking the
findings, the next one is a fresh dispatch one tier up; the five-round bound in
step 6 stays as the backstop.

One fix dispatch carries the **whole** findings list.

The reviewer in step 5 is **read-only**: it never mutates the working tree, the
index, `HEAD` or branch state — `git show`, `git diff` and `git log` are how it
inspects, and a separate worktree is how it checks out another revision if it
truly must. It flags a departure from the plan **as a departure, for
confirmation**, not as a defect, and says so plainly if the plan is what looks
wrong.

**Whose findings you may fix depends on who implemented the task.** For a
**dispatched** implementer, never patch its work here: resume that implementer
with the findings. For an
**`in-session`** task there is no implementer to resume — its findings are fixed
in place, by you, and the fix goes back to the reviewer like any other round.

## When the plan is wrong

A plan defect found mid-loop is a ruling, not a stop — unless every path forward
is a guess. Record what the plan said, what you did instead, and what it costs if
that was wrong. If a task turns out not to carry its own test cycle, say so: that
is a defect in the plan's task boundaries, and the fix is to merge it with its
neighbour rather than to commit something red.

**A file table is wrong the same way and ruled on the same way**, except that
the task-boundary half has nothing to say there: a row that turns out to need
two is split where you are.

## The patrol

A task started by picking the patrol — `TODO 全表盤點` — at `/fankeel` arrives on
`--route "survey,plan,build,verify,land"`; the entries survey marked `do now`
are the plan's tasks and are built here as ordinary tasks, each
closing its own TODO entry (`todo.js done` in folder mode, removing the `TODO.md` line in legacy mode).

`survey` has already checked every `## Blocked` timing and put the stale
`## Watch` timings to the user, so there is no gate left to ask here, only the
moves those answers decide. A Blocked timing whose condition checked
out has its whole entry moved, together, to `## Ready` or `## Needs a decision`,
whichever survey sent it to, dropping its `###` heading and its `on:`, `after:`
or `upstream:` line. One that did not check out gets today's date as its stamp;
an `on:` whose day came while the work is still not possible gets a later
`on:` date instead. A Watch timing the user kept gets today's date as its stamp;
one the user dropped is deleted — heading, `if:` line and entries. All of a
batch's changes land in one commit — the stamps, the lifts and the drops
together.

A Watch entry also leaves by another door, not through this stage: a session
that meets the event an `if:` names moves the entry to `## Ready` or
`## Needs a decision` itself, dropping the `###` and the `if:` line.

## Common rationalizations

| excuse | what happened |
|---|---|
| "I will poll until it returns" | 2026-09-23: a build agent spent 261 of 295 Bash calls on `sleep`/`echo` loops, each re-sending its whole context (`agents/fankeel-brain.md`, `## Return`). |
| "A stash will set the neighbours aside" | 2026-09-25: a `git stash push -u` then drop cleared an uncommitted `stage.agents` override, and the verify station dispatched a brain it should not have (`docs/90-agent/reports/patrols/2026-09-25-todo-line-and-multiplier.md`). |
| "I will find the definition on disk" | 2026-09-06: a reviewer not told where `tokens` lived ran `find /` and sat 38 minutes (`skills/fankeel-plan/SKILL.md`, `Read:`). |

Record what this stage verified that a later stage will need again, one fact a
line: `node <plugin>/scripts/context.js add "<fact>" --at <path:line> --session <id>`.
Do not reopen a `path:line` that context.md already lists; its content is
inlined in your prompt.

## Output

```
- path +12/-3 — what changed
- path (new) — what it is

done: <n> of <m> — ledger or file table
docs-check: clean, or <n> fixed and <n> left
deferred: <heading> — <TODO entry, or omit this line>
then AskUserQuestion
```

Under 80 words. The diff is the output; prose is for what a diff cannot show.

`done:` is copied from the `done <n> of <m>` line that `node <plugin>/scripts/ledger.js --plan <plan> show` prints, `<m>` being the plan's own task count — never a count of `progress.md` made by hand. With no plan there is no ledger, and the rows of the file table are the count.
