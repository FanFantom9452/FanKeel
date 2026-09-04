---
status: current
last_verified: 2026-09-04
source_of_truth: lib/plantasks.js, scripts/ledger.js, skills/fankeel-build/SKILL.md
---

# Stage division of labour

Three asks, one change: what each stage does at its start, what `build` decides
that `plan` should have settled, and when a group of independent tasks becomes a
Workflow rather than a fan-out of Agents.

## The constraint that shapes all three

Measured 2026-09-04, `node --test tests/render.test.js`:

| stage | chars | spare to 2400 |
|---|---|---|
| survey | 2399 | 1 |
| build | 2393 | 7 |
| design | 2387 | 13 |
| land | 2387 | 13 |
| plan | 2379 | 21 |
| verify | 2360 | 40 |
| audit | 2360 | 40 |

135 characters across seven stages. **No new injected rule fits.** A Workflow
threshold is 90–140 characters; it does not go in `survey` (1), `build` (7),
`design` or `land` (13). Raising the cap is refused — the cap has been raised
three times and `tests/render.test.js:511` says the third should be the last.

So the design principle is forced, and it is the right one anyway: **nothing new
enters `lib/stages.js`. A rule goes into the command a stage already runs, or
into the skill it already reads.** A number a script computes cannot go stale;
a number a rule remembers already has, twice in this file's own comments.

## 1. Workflow by group size

`lib/plantasks.js:115` `groups()` already returns which tasks may go out in one
response — it greedily packs tasks until one conflicts, per `conflict()`. Nothing
turns that number into a dispatch decision.

It gains one field per group:

| group size | surface |
|---|---|
| 1 | `agent` — one dispatch |
| 2 | `agents` — two dispatches in one response |
| 3+ | `workflow` — one Workflow, the group is its fan-out |

**The surface is the batch shape, not the implementer decision.** A task's own
`**Dispatch:**` line still says `implementer, <model>` or `in-session`, and an
`in-session` task is not dispatched at all. `surface` answers the other
question: for the tasks in this group that do go out, do they go as one
dispatch, as two in one response, or as one Workflow. Calling a lone group
`in-session` conflated the two, and the first real plan caught it — a task
reading `implementer, sonnet` landed in a group the rule then called
`in-session`.

**A group carrying a diagnostic never reaches `workflow`; it degrades to
`agents`.** `conflict()` fails open by design — `lib/plantasks.js` reads only a
backticked identifier out of `Consumes:`/`Produces:`, and its comment says why:
failing closed "would refuse to parallelise the first task of every plan, which
is the whole feature". A prose `Consumes:` therefore reads as no interface at
all.

Today the cost of that false negative is two Agents running in parallel while
the human reads `ledger.js`'s own warning. Under this change the same false
negative becomes a pre-authorised Workflow that does not return to the parent
between its steps, so the cost goes up and the safeguard has to go with it.

`scripts/ledger.js` already computes both diagnostics per group — `:127` names
the task whose `Consumes` text points at another task in its own group, and
`:227`/`:242` name tasks with no `Files` block. The surface reads them: a group
touched by either is `agents`, whatever its size.

This also answers the design's original `unverified` line, which asked whether
`conflict()` could be trusted with a Workflow. It can be trusted with `agents`
unconditionally, and with `workflow` only when it had identifiers to work from.

`scripts/ledger.js`'s `groups` verb prints it beside each group. `build` reads
the printed surface instead of recalling a threshold.

This is a **size** rule. The existing Workflow rule at
`skills/fankeel/SKILL.md:906-913` is a **shape** rule — a fan-out whose output
feeds another fan-out. Both stand; they answer different questions, and the size
one is the one nothing currently states.

## 2. What `build` stops deciding

`build` reads or decides 18 things per task. Six come from the plan's template.
Of the twelve that do not, **nine cannot move to a plan** — BASE sha, review
range, the diff, the map path, the report path, the plan path, the commit
message, the ledger note, the fix-round bound. They are runtime facts or
constants; a plan written yesterday cannot hold today's sha.

So the fix is not to move them. It is to stop calling them decisions. The
dispatch brief becomes **one fixed recipe** in `skills/fankeel-build/SKILL.md`:

```
the plan's ## Global Constraints, verbatim
the task block, verbatim
the report path
```

Nothing per-task is chosen. The three that remain genuine — dispatch surface,
model, and whether a failing test comes first — are already the plan's
`**Dispatch:**` and `Test:` fields; `build` follows them rather than re-reading
the task to re-decide.

`## Global Constraints` is plan-level and the task template never points at it,
which is why `build` had to remember to include it. The recipe pins it.

## 3. The anchor, not the heading

An earlier draft of this section proposed numbered step headings for the three
skills that lack them. That was cosmetic and it addressed the wrong failure.

The real one, measured 2026-09-04 across all seven stages: **a skill is read once
on entering a stage; the injected block is re-sent on every prompt. A procedure
that lives only in the skill is competing with everything since, and gets
skipped.** Twenty-one probes for a skill's own procedure against its stage's
injected rules returned twenty `no`:

```
survey  orient=no  class=YES  task.js start=no
design  spec=no    design-intent=no  self-review=no
plan    Interfaces=no  Consumes=no  ## Task=no
build   worktree=no    Commit:=no   five=no
verify  ranges=no      ledger=no    red-green|revert=no
audit   pair=no        reader=no    todo-check=no
land    suite=no       test=no      version=no
```

The single `YES` is the output template's bare `class:` field — which is the
point. **The output template is the anchor that works**, because it is re-sent
every turn and it enumerates what must be on screen. A procedure with no slot in
its template is a procedure nothing reports, and a procedure nothing reports is
one nobody notices was skipped. This session skipped `design` steps 1 and 7 and
nothing caught it.

`skills/fankeel-build/SKILL.md:195-199` already says this out loud for one case:
*"`land` gets it injected; this stage's injection has no room for it, so this
paragraph is where `build` reads it."* The trade was made deliberately once and
then happened by accident six more times.

### What this change does

**`land` gains a suite anchor.** It is the worst of the twenty: `land`'s own
`Done when` makes a green suite its first condition, and no injected rule for
`land` contains `suite`, `test` or anything like it. The arithmetic, measured:

| | chars |
|---|---|
| `land` today | 2387 |
| `Output:` rule reworded to name the suite's green line | −6 |
| template gains `suite: <green>` (14 + newline + render's 2-space indent) | +17 |
| **after** | **2398** |

Two characters of margin. That is thin enough to say out loud: the next edit to
`land` breaks it, and whoever makes that edit should reclaim from the 126-char
`shipped:` rule, which explains a template slot the template already states.

**`plan` gains the heading contract, for +8 characters.** `lib/plantasks.js`'s
`parseTasks` depends on the exact `## Task N: <name>` heading, and nothing
re-sent every turn states it — not a rule, not the output template. A plan
written with any other heading parses to zero tasks, `groups()` returns nothing,
and no part of the system says so. The existing rule changes from

> Every task carries `**Files:**` and a `**Dispatch:**` line

to

> Every `` `## Task N:` `` carries `**Files:**` and a `**Dispatch:**` line

`task` (4 chars) becomes `` `## Task N:` `` (12), so `plan` goes 2379 → 2387 and
keeps 13 characters spare. This is the cheapest anchor found anywhere in the
seven, and it closes the only silent failure among them.

**`land`'s two-option contradiction is fixed.**
`skills/fankeel-land/SKILL.md:123-124` says a detached HEAD should "offer only
the PR and keep-as-is options" — two — while `ALWAYS[0]` says "three at least,
never dropping the pause". Injected beats skill, so the skill is wrong today.
The skill changes, not the rule. No injection cost.

### build, verify and audit: it fits, but the wording is not settled here

Measured 2026-09-05 by a two-phase workflow — one reader per stage to find the
unanchored procedures, one to design a mutually compatible anchor set and cost
it. The join rejects a set whose targets repeat, whose per-edit deltas do not sum
to the joint delta, or whose result reaches 2400, so what came back is
arithmetically sound:

| stage | edits | joint delta | lands at | headroom |
|---|---|---|---|---|
| `build` | 2 | +6 | 2399 | 1 |
| `verify` | 4 | +39 | 2399 | 1 |
| `audit` | 3 | +36 | 2396 | 4 |
| `land` | 2 | **−1** | 2386 | 14 |

`land` is the only net-negative set: its two anchors leave the block a character
smaller than they found it. It was costed against a 2387 baseline and does not
know about the suite anchor above, so the two must be checked for a shared
target before both are applied — 2386 + 11 = 2397 if they are disjoint.

**Read the headroom column as the real result.** Three of the four land within
four characters of the cap. After this change the injection is full everywhere,
not just in `survey` and `build`, and the next rule added anywhere in
`lib/stages.js` has to displace one. That is the state this design leaves behind
and the reason it puts nothing else there.

**Sound arithmetic is not settled wording, and the difference bit.** The proposed
`build` edit teaches `` `--range complete <n>` ``, which the CLI cannot accept:
`scripts/ledger.js:34` declares `range` a value-taking string flag and `:136`
splits at the verb, so `--range` swallows `complete`. The tool's own usage line
is `complete <task number> "<what landed>"` — which is what the rule already
said. The same edit also deleted *"After a compaction it beats memory."* to buy
room: the sentence `tests/render.test.js:526` names as content that *had* to
exist, being the reason the ledger is there at all.

Two constraints came out of that, and every string below obeys them:

- No anchor may delete a rule's stated reason to pay for itself. Reasons are what
  stop a later reader undoing the rule.
- No anchor may name a command form the CLI does not accept. An injected rule is
  re-read every turn, so a wrong command is taught every turn.

### The settled strings

Measured 2026-09-05 against the raw strings in `STAGES`, not the rendered ones —
`rulesFor` substitutes `{{LEDGER}}` and friends, so a candidate carrying a token
compared against a rendered rule gives a wrong delta. It gave one, first time.

| stage | edits | rule delta | template | base → after | headroom |
|---|---|---|---|---|---|
| `plan` | 1 | +8 | | 2379 → 2387 | 13 |
| `build` | 1 | +5 | | 2393 → **2398** | 2 |
| `verify` | 1 | +26 | | 2360 → 2386 | 14 |
| `audit` | 2 | +35 | | 2360 → 2395 | 5 |
| `land` | 2 | −16 | +11 | 2387 → **2382** | 18 |
| `survey` | 1 | −9 | | 2399 → **2390** | 10 |

`design` is not touched. `land` and `survey` end up *smaller* than they started
while gaining anchors.

**Two rows were amended after the build, and the reason is on the record.**
`build` was drafted at 2389 with the parenthetical reading `skill: scan, groups,
BASE, range` — which removed the only place build's block named its own skill,
and broke `tests/stages.test.js:481`, a test whose comment says it wants the
instruction and not the mention. The ruling in the ledger reverts it: the
parenthetical is `the fankeel-build skill has loop and scan`, keeping the
pointer and one keyword at 2398. `survey` was not in this table at all when it
was written; it became a task of its own after the question was asked out loud,
and its row is the measured result.

**`plan`** — `Every task carries` becomes ``Every `## Task N:` carries``.

**`build`** — only the parenthetical moves. Everything else, the correct
`complete` form and the compaction sentence included, stays exactly as it is:

> From a plan (the fankeel-build skill has loop and scan): `node {{LEDGER}} --plan <f> show` first; never redo a task it lists complete. One reviewer per task, then `complete <n> "<what landed>"`. After a compaction it beats memory.

**`verify`** — one edit carrying three keywords:

> Read the fankeel-verify skill on entry: ledger ranges, red-green, line by line.

**`audit`** — two:

> Run `node {{RESIDUE}}` and quote it, non-git too.

> Every fortnight /fankeel-audit adds the deep pass: `node {{DOCS_AUDIT}}`, one reader per pair, and offers the cleanup. {{PONYTAIL}}

**`land`** — the pointer and the stand-down rule, plus the suite anchor above:

> Read the fankeel-land skill on entry: worktree, base, release.

> Option one stands the task down; route the notes first. `/clear` after, never before: a cleared session gets a new id and the entry is left active, unread.

### The pointer is the cheapest carrier

The finding that made the budget work. `verify` first came to +58 as two edits
each carrying one keyword; as **one** edit on the `Read the fankeel-verify skill`
pointer carrying three, it is +26. The words after the colon cost only
themselves, where a clause spliced into a working rule has to be grammatical with
what surrounds it and usually pays for the join.

So the pointer line is not the dead weight it looked like when this design began
by proposing to reword all six of them. It is the one place in each stage where a
keyword costs its own length and nothing more.

### What this change still does not do

`design`'s spec file and self-review, `plan`'s `**Interfaces:**` block, `build`'s
five dropped procedures and `verify`'s one go to `TODO.md` under
`## Needs a decision`, one line each. `land` has 2 characters after its suite
anchor and can hold nothing further.

### What the two runs cost

Every figure below, and the twenty-one-probe table in §3, is sourced in
[docs/reports/2026-09-05-stage-division-measurements.md](../reports/2026-09-05-stage-division-measurements.md).
Two of the four come from workflow run records under the session directory,
which is per-machine and not version controlled — checkable today on the machine
that ran them and nowhere else. The report says which.

1,169,842 subagent tokens over two runs and about 37 minutes, to establish that
anchors fit in four stages. The first run was unusable — it returned eleven
alternative rewrites of one parenthetical, each costed as though it were the only
change — and the fix was a contract, not a bigger fan-out: one compatible set per
stage, every target named once, carrying its complete final text.

**What the workflow bought was the join, not the fan-out.** Four separate readers
would have returned the same eleven alternatives and nothing would have caught
that they were alternatives. The check that rejects them is four lines of plain
code in the script. That is the shape worth reaching for again; the fan-out on
its own was the expensive half and a single reader had already found the same
procedures for an eighth of the tokens.

## Interfaces

`groups()` keeps its signature; a new `surfaces()` returns each group as
`{ tasks: number[], surface: 'agent' | 'agents' | 'workflow' }`. Today it returns lists of task numbers, so every
caller changes with it; `scripts/ledger.js:212` is the only one.

## Proves it done

`tests/plantasks.test.js` — a plan whose three tasks share no files returns one
group with `surface: 'workflow'`; a two-task independent plan returns `'agents'`;
a one-task plan returns `'in-session'`. Fails now: the field does not exist.

`tests/render.test.js` — `land`'s output template carries a `suite:` slot, and
every stage's injected block is still under 2400 with it there. Fails now: the
slot does not exist. This is the assertion that catches the change being made by
raising the cap instead of by displacing a rule.

`tests/render.test.js` — the per-stage cap test stays green and the seven sizes
are unchanged. That is the no-regression half, and it is the one that catches a
rule sneaking into `lib/stages.js`.

## Against the map

`.fankeel/map.md` lists 0 pages as design-intent, so nothing here is described as
existing when it is not. `docs/pipeline.md` is a reference page and its
`## Inside each stage` section runs `build` from :434 to :522 describing a stage
that decides; that becomes false the moment §2 lands, so it changes in the same
work. `docs/subagents.md` is reference and states the shape threshold at :132-137;
the size threshold goes beside it.

No page marked current is contradicted.

## Unverified

Read now: `conflict()` fails open on a prose `Consumes:`, deliberately, and the
degrade rule above is what that buys.

What replaces it: **the two diagnostics live in the wrong layer for this.**
`groups()` is `lib/plantasks.js`; `serialCause`, the prose-`Consumes` scan and
the no-`Files` list are all in `scripts/ledger.js` (:69-127, :227-260), which is
the CLI above it. A `surface` computed inside `groups()` cannot see them.

So one of two things has to happen, and I have grepped `scripts/ledger.js` but
not read it, so I cannot yet say which is cheaper:

- move the diagnostic computation down into `lib/plantasks.js`, and let the CLI
  print what the library returns; or
- compute `surface` in `scripts/ledger.js`, leaving `groups()` returning task
  numbers as it does today.

The second keeps `lib/plantasks.js` untouched and is probably right, but it puts
the rule in a CLI rather than in the library any other caller would use. `plan`
is the stage that settles this, and it is the first thing its task 1 decides.
