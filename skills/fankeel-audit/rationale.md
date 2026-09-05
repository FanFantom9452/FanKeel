---
status: current
last_verified: 2026-09-05
source_of_truth: scripts/docs-check.js, scripts/docs-audit.js, scripts/residue.js, skills/fankeel-audit/SKILL.md
---

# fankeel-audit — why

The reasons behind the rules in [SKILL.md](SKILL.md), under the same headings.
Read the skill for what to do; read this when a rule looks wrong and you want
to know what it cost to learn it.

The scripts gather. You judge. Nothing mechanical can decide that two documents
contradict each other, and nothing here pretends to: what the sweep does is turn
"read all forty documents looking for disagreements" into "these two describe
the same source file, and one has not been touched since before it changed".
That is a shortlist someone can finish.

## Run all three

That fortnight is the **drift** window, and drift's alone — it measures how long
a page has been wrong while the code it names moved on. The landed-plan check
asks something else, whether anyone has come back to the plan, and it settles
after **three days**. One number for both meant the landed check could not fire
on a repository younger than a fortnight. Passing `--since` explicitly still
sets both, so `--since 0` remains the way to see everything either window is
holding back.

### The one that is not about documents

The last two are context. The first three fail, because a command that always
exits non-zero has an exit code that means nothing.

### An environment nothing can rebuild or run

A Python environment is found by `pyvenv.cfg`, which Python writes into every one
of them, rather than by a list of directory names. One real directory holds
`.venv-docling`, `.venv-dots`, `.venv-inspector`, `.venv-mineru`, `.venv-ocr` and
`.venv-struct` side by side; another holds `.venv` beside `.venv-uv`. A name list
finds two of those eight and needs maintaining forever; the marker finds every one
for free.

Two ways to be an orphan, and both are checked rather than guessed:

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

The last two are the ones to act on first when they appear, because every check
above gets sharper once they are gone. A page that declares
`status: design-intent` stops being reported as drifting; one that declares
`last_verified` is dated by when somebody read it rather than by when somebody
touched it; a pair where one page declares the other as its `source_of_truth`
stops being a pair. The shape of that contract is in
[docs/documents.md](../../docs/documents.md).

## The part only reading finds

**This is the stage's dispatch case, and it is a narrower one than it looks.**
Reading two long pages against each other and against the code is wide reading
with a narrow answer — which page does the code support, and where. The reading
is thrown away; the answer is two lines. But `docs-audit.js` has already named
the pair, so nothing here has to be *found*, and finding is where most of the
payoff turned out to be: measured 2026-09-03, a fan-out over files already named
bought 1.52× the residue rather than 9.23×, at 1.59× the money. This stage's
question does still join two pages against each other and against the code, and
a named question that joins measured 2.55×, at 2.12× the money — so the payoff
here is real and middling rather than absent.

## The adversary

**Before the question, one read-only adversary over the findings.** The pairs
above are dispatched to produce findings; this one is dispatched to defeat them.

It asks what the same adversary asks at `verify`, with the findings list in place
of the evidence table, and under the same contract. The questions and the
contract are written once, in the `fankeel-verify` skill; the short form rides
every prompt in this stage's own injected rules. This section carries only what
is particular to `audit`, because a second copy is the pair this stage exists to
find.

Two things are particular to this stage. A finding built on something nobody ran
is the failure it exists for — one reached a TODO entry under `## Ready`, a
section of a design and a paragraph of a plan arguing about whether to bundle the
fix, all before anyone ran the two commands side by side.

## Unused packages are somebody else's answer

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

## Output

`routed:` is the line that keeps a finding alive past this turn. Anything you
are not fixing here goes to `TODO.md` under `## Ready`, `## Needs a decision` or
`## Waiting`, and that line names which — a finding that exists only in this
report is one the next sweep finds again from scratch. One routed to `## Waiting`
ends with a `MM-DD` stamp, or `todo-check.js` refuses it.
