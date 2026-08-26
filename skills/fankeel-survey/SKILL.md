---
name: fankeel-survey
description: The survey stage — read the project's own map before reading its code, classify the work, and report what is already here. Use for the survey stage of a fankeel task, "what is already here", starting work in an unfamiliar repository, or when a task needs classifying as spike, bounded or architectural.
version: 0.31.0
status: current
last_verified: 2026-08-24
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

### 4b. When part of it is not enough

The report is capped at 25 rows a section, and on a large repository the tail it
cuts is where the answer usually is. Two flags move it:

```
node <plugin>/scripts/survey.js --all <term>...      # every match, no cap
node <plugin>/scripts/survey.js --tree               # every directory, with sizes
```

`--tree` answers the question search terms cannot: what is this project shaped
like. It is the one section costing a stat per file, so it runs only when asked.

**This is the fourth option at the gate, and it belongs to this stage alone.**
`AskUserQuestion` accepts four options, so `read wider` sits between "next stage"
and "stay": re-run with `--all --tree`, read what it names, and come back to the
same question with more on screen. The stage does not change, the route does not
change, and the class does not change.

Reading wide for a narrow answer is what a subagent is for — that is exactly the
trade `fankeel`'s own guidance names, and the case where delegating saves rather
than costs. What comes back should be the findings, not the files.

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
