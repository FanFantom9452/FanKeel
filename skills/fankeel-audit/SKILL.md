---
name: fankeel-audit
description: Audit documentation against the code it describes — dead references, pages that stopped being true, two pages describing one thing, plans whose work has landed, orphans. Use for /fankeel-audit, "check the docs", "what is out of date", "文件審查", before a release, or when two documents disagree.
argument-hint: "[--root <dir>] [--since <days>]"
version: 0.27.0
status: current
last_verified: 2026-08-22
source_of_truth: scripts/docs-check.js, scripts/docs-audit.js
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

## Run all three

```
node <plugin>/scripts/docs-check.js [--root <dir>]
node <plugin>/scripts/residue.js [--root <dir>]
node <plugin>/scripts/docs-audit.js [--root <dir>] [--since <days>]
```

`--root` picks one project out of a workspace holding several. `--since`
defaults to 14 days, which is the cadence this is built for: not on a typo fix,
not skipped for a quarter.

Quote what came back. A description of what a scanner said is not what it said.

### The one that is not about documents

`residue.js` asks what is in this tree that nobody decided about. Everything it
knows comes from git, so there is no heuristic for "unused" and no list of
suspicious filenames.

| | | fails the run |
|---|---|---|
| untracked and not ignored | somebody has to commit it, ignore it or delete it, and nobody has | yes |
| a worktree whose branch is merged | one that has been spent | yes |
| ignored paths, with their size | a 73 GB build directory is not a bug; not knowing about it is | no |
| directories with no files at any depth | git cannot record one, so "commit it" is not on the menu | no |

The last two are context. Only the first two fail, because a command that always
exits non-zero has an exit code that means nothing.

It never deletes. Name the paths at the gate and let the user choose — the same
contract every scanner here has, and the same one that governs documents.

## What the sweep reports

Four sections are defects and the run fails on them. The rest are places a
contradiction could live, which is not evidence that one does.

| Section | Defect | What it means |
|---|---|---|
| **fallen behind the code they describe** | yes | a reference page is older than a file it names. `verified` in the line means the page declared the date; `last touched` means it came from git, which is the weaker claim |
| **plans look landed** | yes | every file the plan named now exists and nobody has touched the plan. It is a record, not a plan — offer to archive it |
| **index** | yes | declared but not written, or entries pointing at nothing, or documents missing from it |
| **diagrams behind their directory** | yes | a mermaid graph naming most of a directory is claiming to list it, so the files it does not name read as files that do not exist |
| **pairs describing the same code** | no | two reference pages both name the same file and neither defers. This is where single source of truth breaks |
| **linked from nowhere** | no | reported only when there is no index. Orphan, or the index is the real gap |
| **directories with no reference document** | no | code nobody wrote a page about — a gap, or deliberately internal. Say which |
| **unfiled** | no | markdown outside every bucket. Nothing above checked it; the fix is a bucket in `docs.json`, not an edit per file |
| **undeclared** | no | reference pages with no frontmatter contract, so their dates come from git rather than from anyone saying they read them |

The last two are the ones to act on first when they appear, because every check
above gets sharper once they are gone. A page that declares
`status: design-intent` stops being reported as drifting; one that declares
`last_verified` is dated by when somebody read it rather than by when somebody
touched it; a pair where one page declares the other as its `source_of_truth`
stops being a pair. The shape of that contract is in
[docs/documents.md](../../docs/documents.md).

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
