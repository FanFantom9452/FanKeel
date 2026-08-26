---
name: fankeel-survey
description: The survey stage — read the project's own map before reading its code, classify the work, and report what is already here. Use for the survey stage of a fankeel task, "what is already here", starting work in an unfamiliar repository, or when a task needs classifying as spike, bounded or architectural.
version: 0.31.0
status: current
last_verified: 2026-08-26
source_of_truth: lib/stages.js, scripts/map.js, scripts/survey.js
---

# fankeel-survey

Produces a statement of what already exists, a classification, and the map.

## The six steps

### 0. It already said it started

Nothing to run. `hooks/inject.js` raises `[FANKEEL:INIT]` the moment a `/fankeel`
prompt is submitted, before there is any registry entry to read — so the minutes
this stage spends orienting, mapping and scanning are not minutes of a statusline
saying nothing. `task.js start` in step 6 replaces it with `survey`.

It is there before you are. What it costs you is that the badge is now a promise:
a session showing `init` that never reaches step 6 is one that stopped without
saying so.

### 1. Locate

Repository root, git state, whether this is a worktree.

```
node <plugin>/scripts/orient.js [--root <dir>]
```

It answers all three and says what else is under the root, which matters in a
directory holding five projects: that list is where `Which project?` gets its
options, and the project is what routes the docs lookup.

### 2. Read the map

```
node <plugin>/scripts/map.js [--root <dir>]
```

It writes `.fankeel/map.md` and prints a summary. **Read the file, not only the
summary.** What it holds that nothing else does: the signpost file's navigation
table, the filing declared in `docs.json`, and every page's declared status.

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

and a walk that hit its ceiling prints `the walk stopped at N files`. A third
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
the scanner had no way to parse. The header's file count is the tree, not the
coverage; when the two disagree, the terms were checked against less than the
report appears to say. The last two counts are subtrees rather than files, so a
`1` there can hide any amount.

So this line is the one that fans out — over the half of it a reader can act on.
**Files with no pattern, over the cap or dropped by extension, and a nested
repository, are one reader with the list.** The fankeel skill's test settles it:
*if two readers would return the same shape of answer about different files, they
are one reader with a list* — give it the terms and the list, not one reader per
file.

**The other half is reported, not dispatched and not left silent.** Nothing opens
an unreadable file — the shipped test's case is a file no longer on disk — and a
subagent sent at an unlistable directory hits the same `EACCES`. Say what the
survey could not cover and why, next to the number, and move on. That is what
keeps the coverage claim honest; leaving the line unanswered is the confident
wrong answer, said with a number next to it.

**Dispatch when the reading is wide, or when nothing matched at all.** Wide means
the answer is a judgement over several subsystems rather than a longer list — the
one case a subagent pays for. A **zero-match scan** is the other: there is no list
to widen, the terms were wrong or the thing is named something else, and reading
wider is the only move left. Never ask permission for either. The user's answer to
"shall I read further?" is foreordained — they asked the question the reading
answers — so the round buys nothing and costs a turn of their attention.

- **Several in one response.** That is what makes them run at once; one dispatch
  per response runs them in sequence. **Four is the ceiling** — the fankeel
  skill's *Delegate the reading, never the filtering* says why, and lenses past
  that are one reader with a list.
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

```
node <plugin>/scripts/task.js start --session <id> --task "..." [--project <dir>] --class <class>
```

`--class` picks the route. Never pass both `--class` and `--route` — it is
refused rather than ranked, because whichever one lost would be a decision the
user made and cannot see.

Nothing declares a file list. `--project` names the repository whose docs tree
applies, ask for it only when the root holds more than one, and leave it off
otherwise — the files this task touches are recorded as the edits land.

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
class: <class> — <why>
then AskUserQuestion
```

Under 120 words of your own. Option one on the question is the approval: say what
accepting the classification accepts, not just which stage comes next.
