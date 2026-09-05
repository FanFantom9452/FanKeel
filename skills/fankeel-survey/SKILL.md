---
name: fankeel-survey
description: The survey stage — read the project's own map before reading its code, classify the work, and report what is already here. Use for the survey stage of a fankeel task, "what is already here", starting work in an unfamiliar repository, or when a task needs classifying as spike, bounded or architectural.
version: 0.48.0
status: current
last_verified: 2026-09-05
source_of_truth: lib/stages.js, lib/map.js, scripts/map.js, scripts/survey.js, scripts/layout.js
---

# fankeel-survey

Produces a statement of what already exists, a classification, and the map.

**Done when** the map has been read, the scanner has been run and quoted, its
`skipped:` line has been answered rather than left as a number, and the class is
said out loud. That list runs out. Reading wider once it has is unfinished work,
which is the one thing option two may never be — so the gate is asked once.

## The six steps

### 0. It already said it started

Nothing to run. `hooks/inject.js` raises `[FANKEEL:INIT]` the moment a `/fankeel`
prompt is submitted, before there is any registry entry to read, and `task.js
start` — run at `/fankeel`, before this stage — replaces it with `survey`. So the
minutes this stage spends mapping and scanning are not minutes of a statusline
saying nothing, and the entry this stage reports into already exists.

It is there before you are. What it costs you is that the badge is now a promise:
a session showing `survey` that never reaches step 6 is one that stopped without
saying so.

### 1. Locate

Repository root, git state, and what else is under it.

```
node <plugin>/scripts/orient.js [--root <dir>]
```

It answers all three, which matters in a directory holding five projects: that
list is where `Which project?` gets its options, and the project is what routes
the docs lookup. Whether this is a worktree is not among them — `scripts/residue.js`
is the one that asks git that.

### 2. Read the map

```
node <plugin>/scripts/map.js [--root <dir>]
```

It writes `.fankeel/map.md` and prints a summary. **Read the file, not only the
summary.** What it holds that nothing else does: the signpost file's navigation
table, the filing declared in `docs.json`, what each directory is for, and every
page's declared status.

The directory tree is the one to read first. It is lifted from the project's own
README — the file among `CLAUDE.md`, `AGENTS.md` and `README.md` that draws one,
under the nearest heading above it — and it carries the thing nothing derives: a
person saying what `backend/` is. Where a project has none, the map says so and
names `scripts/layout.js`, which prints a skeleton for someone to fill in. Rows
with no responsibility yet are counted, so a half-finished tree says so.

If it says `filing: nothing declared`, the project has no `docs.json` and every
document is being read by guesswork. If it names a parse error, say so — a
broken `docs.json` looks exactly like an absent one everywhere else, so the
project reads as unfiled rather than as broken.

### 3. Take stock of the contracts

The section headed **planned, not built** is the one to read first. Those pages
are `status: design-intent`: they describe what the system is *meant* to become.
They are not drifting when the code does not match them — they are doing their
job, and designing against them as if they described the code is the failure
this stage exists to prevent.

**retired, do not follow** is the opposite error: a page that was true once and
is being read as though it still were.

**undeclared** pages are dated by git rather than by anyone having read them. A
whitespace fix updates a git date and verifies nothing.

### 4. Targeted scan

**Before you type the terms, look at the tree.** Step 1 already listed the
directories; `--tree` gives every one of them with its size:

```
node <plugin>/scripts/survey.js --tree
```

Sizes, not purposes — step 2's tree already said what the directories are for,
where the project has written one. Together they decide the scope: which
directories hold the answer, and therefore whether this is one scan here or three
readers with a lens each. Where step 2 found no tree, this is all there is.

**Scope and dispatch belong in the same response.** A scope announced in one
round and acted on in the next has spent a round on nothing, which is the waste
§4b was rewritten to remove. Say how many readers, and on which model, as they go
out: that is a report, not a request, and nothing waits on it.

```
node <plugin>/scripts/survey.js [--root <dir>] <term>...
```

Quote what came back. It reports declarations rather than filename matches for
the languages it knows; anything else falls back to filename alone, so say so
rather than reporting a clean sweep.

**"Nothing matched" is a finding.** Say which terms were tried — the next person
needs to know a synonym was already ruled out.

### 4b. When one pass did not cover it

The report is capped at 25 rows a section. When a section is cut, it says so in
its own output:

```
  ... and 34 more, not listed
```

and a walk that hit its ceiling prints `the walk stopped at its N ceiling`. A third
line, `skipped:`, counts what was in the tree and never opened at all.

**Three lines, three different fixes — and only the last one fans out, over half
of itself.**

**A capped section is a re-run.** `--all` lifts the per-section cap and returns
the rows it cut, for the cost of one command:

```
node <plugin>/scripts/survey.js --all <term>...      # every match, no cap
node <plugin>/scripts/survey.js --tree               # every directory, with sizes
```

A section overflowing by five filenames is not wide reading; dispatching there
delegates what a flag already removes.

**A truncated walk is narrowed with `--root`.** No flag lifts it. The ceiling is
a constant in the walker — a backstop against somebody's home directory, not a
cap anyone tunes — so `--all` does nothing for it, and the scanner's own message
says the same: *narrow it with `--root` before trusting this*. Re-running without
narrowing returns the same truncated tree; dispatching readers over it hands them
the same blind spot, four times over.

**A `skipped:` line is answered by reading what can be read.** Files with no
declaration pattern for their extension, files over the size cap, files that
could not be read, documents and binaries a walk drops by extension, nested
repositories git never descended into and directories that could not be listed
are counted there and never opened. **No flag reaches any of them**: `--all`
lifts a per-section cap and `--root` narrows a walk, and neither one opens a file
the scanner had no way to parse. The header counts the files that reached the
scan, which is neither the tree nor the coverage: three of those kinds sit inside
that number and three never entered it, so subtracting the skips from it is wrong
in both directions. The two subtree counts are the ones to distrust most — a `1`
there can hide any amount.

The report splits the line for you, and the half a reader can act on is **named,
not counted**, under `skipped, and openable by hand:` — the files with no pattern
and the nested repositories, capped like every other section and saying `... and
N more, not listed` when the cap bites. That list is the fan-out: **one reader,
given the terms and the paths.** The fankeel skill's test settles the shape: *if
two readers would return the same shape of answer about different files, they are
one reader with a list* — not one reader per file. A nested repository is the one
entry that is a root of its own: `--root` at it rather than a lens over it.

**The rest stays a count, and is reported rather than dispatched.** Nothing opens
an unreadable file — the shipped test's case is a file no longer on disk — and a
subagent sent at an unlistable directory hits the same `EACCES`. Over the size
cap and dropped by extension are the same call made cheaply: a path there tells a
reader nothing the count did not. Say what the survey could not cover and why,
next to the number, and move on. That is what keeps the coverage claim honest;
leaving the line unanswered is the confident wrong answer, said with a number
next to it.

**Dispatch when the reading is wide, or when nothing matched at all.** Wide means
the answer is a judgement over several subsystems rather than a longer list — the
one case a subagent buys anything, and what it buys is a smaller context rather
than a cheaper or a quicker one. A **zero-match scan** is the other: there is no list
to widen, the terms were wrong or the thing is named something else, and reading
wider is the only move left. Never ask permission for either. The user's answer to
"shall I read further?" is foreordained — they asked the question the reading
answers — so the round buys nothing and costs a turn of their attention.

- **One workflow, not several dispatches.** The readers are its first stage and
  the `path:line` check is its second, so what returns is the join rather than
  every reader's whole reading. **Four is the ceiling for dispatches** — the
  fankeel skill's *Dispatch by default, never the filtering* says why — and a
  script is the exception the ceiling names, because it holds the list rather
  than guessing at the split.
- **One lens each**, taken from what the scan named — a subsystem apiece, or a
  term-cluster apiece. Not a fixed list.
- **Tell each one what is already known**, so it returns only what is new.
- **`sonnet` is the floor.** Pass the model explicitly; an omitted one inherits
  this session's.
- **Compare the returns against each other**, not just one by one. Agents
  dispatched from one prompt style make correlated mistakes.

Reading wide for a narrow answer is what a subagent is for. This stage used to
say that and then offer a manual re-run at the gate; the gate below is now the
ordinary three options, and the survey in front of it is complete.

The fan-out is two stages in one run, not four returns into this session:

    read    one reader per lens, each returning findings as path:line pairs
    check   every path:line opened and confirmed to say what the finding
            claims, and anything not bearing on the task dropped

Only what survives reaches the session. The check is not optional politeness:
a reader that cites a `path:line` has not necessarily opened it, and a finding
nobody opened is a confident wrong answer with a line number next to it.

### 5. Classify, out loud

| Class | Route | What it means |
|---|---|---|
| `spike` | `survey,build` | a feasibility question whose output is an answer. Anything built is labelled throwaway |
| `bounded` | `survey,design,build,verify,land` | a scoped change to a flow already in this repository. Design happens in chat: no spec file, no plan file |
| `architectural` | all seven | a new subsystem, or a change to an interface something else depends on |

**Bounded measures the repository, not your familiarity.** Understanding the kind
of application is not enough — bounded means the flow being changed is already
here to read. A new project has no existing flow, so it is architectural.

**When in doubt take the heavier one.** Reaching for a lighter label in order to
skip work is itself the doubt.

Say the classification before acting on it, so it can be overridden. A
classification made silently is one nobody can disagree with.

### 6. Write it down

The entry already exists: `task.js start` ran at `/fankeel`, with the class said
there — or all seven stages when none was — and `start` refuses an active entry
(`scripts/task.js:476`). What this step writes is the class step 5 arrived at,
when it differs:

```
node <plugin>/scripts/task.js route "survey,design,build,verify,land" --session <id>
```

`route` takes the stages and derives the class from them (`scripts/task.js:929`);
the stage the task is in has to be on the new route. Quote its output on the
`route:` line of the report, or write `unchanged`. Up is always allowed. Down is
allowed only from the seven-stage default nobody said — a class someone said at
`start` is the ratchet's floor.

Nothing declares a file list: the files this task touches are recorded as the
edits land.

## The ratchet

One-way. Hidden complexity found mid-task upgrades the route — stop, say so, and
re-route with `task.js route`. Nothing downgrades mid-task.

## Output

```
<the map summary, quoted>
<the scanner block, quoted>

- path:line — what is there
- path:line — what is there

planned, not built: <the pages, or "none">
not found: <terms that matched nothing>
skipped: <what, and why — not N>
class: <class> — <why>
route: <unchanged, or the task.js route line>
then AskUserQuestion
```

Under 120 words of your own. Option one on the question is the approval: say what
accepting the classification accepts, not just which stage comes next.
