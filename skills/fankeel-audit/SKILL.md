---
name: fankeel-audit
description: Audit documentation against the code it describes — dead references, pages that stopped being true, two pages describing one thing, plans whose work has landed, orphans. Use for /fankeel-audit, "check the docs", "what is out of date", "文件審查", before a release, or when two documents disagree.
argument-hint: "[--root <dir>] [--since <days>]"
version: 0.33.0
status: current
last_verified: 2026-08-27
source_of_truth: scripts/docs-check.js, scripts/docs-audit.js, scripts/residue.js
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

The last two are context. The first three fail, because a command that always
exits non-zero has an exit code that means nothing.

**Two of the five need git and three do not**, so run it outside a repository
too. That is where it finds the most: in one real workspace ten of eleven
projects had never been `git init`-ed, and every scanner that starts from what is
committed reported nothing at all about them.

### An environment nothing can rebuild or run

A Python environment is found by `pyvenv.cfg`, which Python writes into every one
of them, rather than by a list of directory names. One real directory holds
`.venv-docling`, `.venv-dots`, `.venv-inspector`, `.venv-mineru`, `.venv-ocr` and
`.venv-struct` side by side; another holds `.venv` beside `.venv-uv`. A name list
finds two of those eight and needs maintaining forever; the marker finds every one
for free.

Two ways to be an orphan, and both are checked rather than guessed:

| | |
|---|---|
| **no Python manifest beside it** | no `pyproject.toml`, `requirements.txt`, `setup.py`, `setup.cfg`, `Pipfile` or `environment.yml` in the same directory. Nothing here can rebuild it, so whatever is inside is all there is |
| **interpreter gone** | the `home` line in `pyvenv.cfg` names a path that is not on this machine. This is what a tree copied from another computer looks like: it cannot be activated and it cannot be rebuilt |

The walk stops at each one rather than reading through it, and so does the
empty-directory walk beside it. A vendored interpreter carries thousands of
directories belonging to whoever built it: a probe that also matched `__pycache__`
stopped at 165 directories on one workspace where the marker alone stops at 15,
and 151 of that difference sat under a single bundled Python. Stopping also keeps
`.venv/Include` — which Python creates empty itself — off the empty-directory
list, where it would be asking somebody to decide something Python decided.

**Conda environments carry no `pyvenv.cfg`**, so none of this sees them. That is
untested rather than designed: no conda was installed on the machine this was
built on, and a marker nobody could check against a real one would be a guess.

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

**This is the stage's dispatch case, and it is the clearest one in the pipeline.**
Reading two long pages against each other and against the code is wide reading
with a narrow answer — which page does the code support, and where. The reading
is thrown away; the answer is two lines.

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

## Unused packages are somebody else's answer

```
knip --dependencies
PYTHONUTF8=1 deptry . --ignore DEP001,DEP003,DEP004 --no-ansi
```

Both narrow to one question — which declared package is never used — and both
exit 0 clean, 1 with findings.

**Run the one whose manifest is there.** knip needs a `package.json`; deptry
needs a `pyproject.toml` with a `[project]` section or a `requirements.txt`. Run
on a project without its manifest, deptry does not report nothing — it exits 1
with a `DependencySpecificationNotFoundError` traceback, which reads exactly like
a run that found something. This repository is pure Node, so `deptry` here is
noise and only `knip` answers. A project with neither manifest has declared no
dependencies, and there is nothing for either to say.

Quote what the one you ran said, and say plainly when it is not installed rather
than skipping it quietly.

**Do not write this one.** The obvious forty lines — read the manifest, grep the
source for the name — was measured against these two on three real projects: it
produced eight findings, six of them false and both real ones missed. Every false
one was the same cause, a package whose name is not its module: `Pillow` imports
as `PIL`, `pycryptodome` as `Crypto`, `python-docx` as `docx`, `pyyaml` as
`yaml`. One real orphan escaped because an error message mentioned its own name
in a comment. What makes these tools correct is a name-to-module table somebody
maintains, and this plugin carries no such table.

Two flags are load-bearing. `--dependencies` keeps knip off files and exports,
where with no config it called every entry point of this repository unused;
`PYTHONUTF8=1` keeps deptry from dying on a `requirements.txt` holding a comment
in any non-ASCII script.

The line this draws is the same one `residue.js` draws: a fact this can check —
is the file beside it, does the path exist — it checks itself. A judgement
needing a maintained table it names an outside tool for.

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

routed: <heading — the entry, or omit this line>
clean: <what you read and found nothing wrong in>
then AskUserQuestion
```

Worst first. Nothing found is a finding — say so, say what you read, and stop.

`routed:` is the line that keeps a finding alive past this turn. Anything you
are not fixing here goes to `TODO.md` under `## Ready`, `## Needs a decision` or
`## Waiting`, and that line names which — a finding that exists only in this
report is one the next sweep finds again from scratch.

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
