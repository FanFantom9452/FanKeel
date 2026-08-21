---
name: fankeel-audit
description: Audit documentation against the code it describes — dead references, pages that stopped being true, two pages describing one thing, plans whose work has landed, orphans. Use for /fankeel-audit, "check the docs", "what is out of date", "文件審查", before a release, or when two documents disagree.
argument-hint: "[--root <dir>] [--since <days>]"
version: 0.20.0
---

# fankeel-audit

The reading pass. `docs-check` asks whether every reference still resolves;
this asks the question underneath it — **which of these pages has quietly
stopped being true, and which two of them disagree.**

The scripts gather. You judge. Nothing mechanical can decide that two documents
contradict each other, and nothing here pretends to: what the sweep does is turn
"read all forty documents looking for disagreements" into "these two both
describe `lib/badge.js`, and one has not been touched since before it changed".
That is a shortlist someone can finish.

## Run both

```
node <plugin>/scripts/docs-check.js [--root <dir>]
node <plugin>/scripts/docs-audit.js [--root <dir>] [--since <days>]
```

`--root` picks one project out of a workspace holding several. `--since`
defaults to 14 days, which is the cadence this is built for: not on a typo fix,
not skipped for a quarter.

Quote what came back. A description of what a scanner said is not what it said.

## What the sweep reports

The first three are defects. The last three are places a contradiction could
live, which is not evidence that one does.

| Section | What it means | What to do |
|---|---|---|
| **fallen behind the code they describe** | a reference page is older than a file it names, by more than the window | read it; the claim it makes about that file is the one to check first |
| **plans look landed** | every file the plan named now exists and nobody has touched the plan | it is a record, not a plan — offer to archive it |
| **index** | declared but not written, or entries pointing at nothing, or documents missing from it | a page nothing links to is a page nobody will find |
| **pairs describing the same code** | two reference pages both name the same file | read them against each other — this is where single source of truth breaks |
| **linked from nowhere** | reported only when there is no index | orphan, or the index is the real gap |
| **directories with no reference document** | code nobody wrote a page about | a gap, or deliberately internal — say which |

## The part only reading finds

Three failures the scanners cannot see, and the reason this skill exists:

- **Two pages that agree in words and disagree in fact.** A pair sharing a file
  is the shortlist. Open both, find the claim each makes about that file, and say
  which one the code supports. Name the file and the line.
- **A page that describes a thing that no longer exists** under a name that still
  does. Every reference resolves and the page is still wrong.
- **Single source of truth.** When two pages both explain one mechanism, one of
  them is the source and the other links to it. Say which should be which and
  why — usually the one closest to the code wins.

If `/ponytail-audit` is installed, it is the code half of the same fortnightly
pass — orphan files, over-engineering, abstractions nobody uses. Offer it
alongside. If it is not installed, say so plainly rather than quietly skipping
the code half.

## Never move a document unasked

Not archiving a landed plan, not deleting an orphan, not merging a pair. Every
one of those is a link somebody else may be holding. Report, then ask, then act
on what was picked.

`TODO.md` entries point at plans. Moving a plan changes an address, so run
`node <plugin>/scripts/todo-check.js` after anything moves.

## Output

```
node <plugin>/scripts/docs-check.js
<its output, quoted>

node <plugin>/scripts/docs-audit.js
<its output, quoted>

- path:line — what is no longer true
- path:line × path:line — what they disagree about, and which one the code supports

clean: <what you read and found nothing wrong in>
then AskUserQuestion
```

Worst first. Nothing found is a finding — say so, say what you read, and stop.

## The question at the end

One call, and the first option is the approval:

| | |
|---|---|
| option 1 | do the cleanup, listing exactly what moves, merges or is deleted |
| option 2 | fix only the defects — dead references and the index — and leave the reading to a person |
| option 3 | report only. Nothing changes. |

A deep pass that rewrites documentation is a large change to something people
navigate by memory, so the description on option one has to name the files, not
the intent.
