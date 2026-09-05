---
name: fankeel-audit
description: Audit documentation against the code it describes — dead references, pages that stopped being true, two pages describing one thing, plans whose work has landed, orphans. Use for /fankeel-audit, "check the docs", "what is out of date", "文件審查", before a release, or when two documents disagree.
argument-hint: "[--root <dir>] [--since <days>]"
version: 0.47.0
status: current
last_verified: 2026-09-05
source_of_truth: scripts/docs-check.js, scripts/docs-audit.js, scripts/residue.js
---

# fankeel-audit

The reading pass. `docs-check` asks whether every reference still resolves;
this asks the question underneath it — **which of these pages has quietly
stopped being true, and which two of them disagree.**

**Done when** the three scanners have been run and quoted, the adversary has read
the findings, and everything not being fixed here carries a `routed:` line naming
its `TODO.md` heading. Nothing found is a finding — say what you read and stop.
The condition is the same whichever way this page is read; only the gate under it
differs.

Why each rule is what it is, under the same headings: [rationale.md](rationale.md).

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

`residue.js` asks what is in this tree that nobody decided about. There is no
heuristic for "unused" and no list of suspicious filenames: every line is a fact
somebody could check by hand.

| | | fails the run |
|---|---|---|
| untracked and not ignored | somebody has to commit it, ignore it or delete it, and nobody has | yes |
| a worktree whose branch is merged | one that has been spent | yes |
| an environment nothing can rebuild or run | see below | yes |
| ignored paths, with their size | a 73 GB build directory is not a bug; not knowing about it is | no |
| directories with no files at any depth | git cannot record one, so "commit it" is not on the menu | no |

**Three of the five need git and two do not**, so run it outside a repository
too. That is where it finds the most: in one real workspace ten of eleven
projects had never been `git init`-ed, and every scanner that starts from what is
committed reported nothing at all about them.

### An environment nothing can rebuild or run

| | |
|---|---|
| **no Python manifest beside it** | no `pyproject.toml`, `requirements.txt`, `setup.py`, `setup.cfg`, `Pipfile` or `environment.yml` in the same directory. Nothing here can rebuild it, so whatever is inside is all there is |
| **interpreter gone** | the `home` line in `pyvenv.cfg` names a path that is not on this machine. This is what a tree copied from another computer looks like: it cannot be activated and it cannot be rebuilt |

## What the sweep reports

Four sections are defects and the run fails on them. The rest are places a
contradiction could live, which is not evidence that one does.

| Section | Defect | What it means |
|---|---|---|
| **fallen behind the code they describe** | yes | a reference page is older than a file it names. `verified` in the line means the page declared the date; `last touched` means it came from git, which is the weaker claim |
| **plans look landed** | yes | every file the plan named now exists and nobody has touched the plan for three days. It is a record, not a plan — offer to archive it |
| **index** | yes | declared but not written, or entries pointing at nothing, or documents missing from it |
| **diagrams behind their directory** | yes | a mermaid graph naming most of a directory is claiming to list it, so the files it does not name read as files that do not exist |
| **pairs describing the same code** | no | two reference pages both name the same file and neither defers. This is where single source of truth breaks |
| **linked from nowhere** | no | reported only when there is no index. Orphan, or the index is the real gap |
| **directories with no reference document** | no | code nobody wrote a page about — a gap, or deliberately internal. Say which |
| **unfiled** | no | markdown outside every bucket. Nothing above checked it; the fix is a bucket in `docs.json`, not an edit per file |
| **undeclared** | no | reference pages with no frontmatter contract, so their dates come from git rather than from anyone saying they read them |

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

So dispatch it: one reader per pair, **several in one response** so they run at
once, each told the file they share and asked which page the code supports. Four
in one response is the ceiling — the fankeel skill's *Dispatch by default, never
the filtering* says why, and pairs past that are one reader with a list. Pass
the model explicitly — `sonnet` is the floor — and compare what comes back
against itself before acting, because readers dispatched from one prompt make
correlated mistakes. Say how many are going and on which model as they go out:
a pair count nobody announced is spend the user is paying for and could not see
coming.

What you do **not** dispatch is this stage. A subagent receives the brief and
nothing else, so an `audit` run inside one has no gate, no output shape and none
of these rules. The pairs are dispatched; the judgement, the findings and the
question at the end stay here.

If `/ponytail-audit` is installed, it is the code half of the same fortnightly
pass — orphan files, over-engineering, abstractions nobody uses. Offer it
alongside. If it is not installed, say so plainly rather than quietly skipping
the code half.

**Where the host opens it, the chain is one workflow.** Pair readers then an
adversary is the same shape. The pairs come from `docs-audit.js` first, run
here — the Workflow tool pipelines over a list it is handed; it does not go
looking for one. Run the pairs through a `pipeline`: the reader for a pair
returns, under a `schema`, which page the code supports and the `file:line` it
stands on; the adversary for that pair reads the same two pages and returns
what it defeats. Every `agent` call carries `model`, and `sonnet` is the floor
there as it is here. What returns is the join, per pair. The ruling and the
`routed:` line stay here. The Agent form below is the fallback, for a session
where the user said not to dispatch, or declined the host's run dialog.

## The adversary

The adversary runs whether
`audit` is a stage on a route or `/fankeel-audit` standing alone; standing alone
it matters more rather than less, because there is no next stage and the findings
drive a cleanup that moves, merges and deletes files.

## Unused packages are somebody else's answer

```
knip --dependencies
PYTHONUTF8=1 deptry . --ignore DEP001,DEP003,DEP004 --no-ansi
```

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

node <plugin>/scripts/residue.js
<its output, quoted>

knip --dependencies · PYTHONUTF8=1 deptry . --ignore DEP001,DEP003,DEP004 --no-ansi
<quoted, or which is not installed>

node <plugin>/scripts/docs-audit.js
<its output, quoted>

- path:line — what is no longer true
- path:line × path:line — what they disagree about, and which one the code supports

adversary: <what it defeated, or none>
routed: <heading — the entry, or omit this line>
clean: <what you read and found nothing wrong in>
then AskUserQuestion
```

Worst first. Nothing found is a finding — say so, say what you read, and stop.

## The question at the end

One call, and the first option is the approval. **`/fankeel-audit` standing
alone has no route, so there is no next stage to offer and the cleanup is what
option one approves:**

| | |
|---|---|
| option 1 | do the cleanup, listing exactly what moves, merges or is deleted |
| option 2 | fix only the defects — dead references and the index — and leave the reading to a person |
| option 3 | report only. Nothing changes. |

**Run as a stage on a route, option one is the next stage** — the injected rule
names it — and the cleanup moves into that option's description, where it is
what accepting the stage accepts. The three above are not a second kind of gate;
they are what this one looks like when `nextStage` has nothing to return.

A deep pass that rewrites documentation is a large change to something people
navigate by memory, so the description on option one has to name the files, not
the intent.
