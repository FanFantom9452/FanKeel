---
status: design-intent
last_verified: 2026-08-30
source_of_truth: lib/tracked.js
---

# The thirty spawns the walk makes one at a time

**Goal:** cut the cost of `trackedFiles` on a multi-project root without moving
its interface, which six callers and roughly thirty test call sites read
synchronously.

## What was measured

On `F:/ymlab` — 30 nested repositories, 31,690 files — instrumented inside the
module itself, and with `MAX_WALK_FILES` temporarily raised so the run was not
truncated:

| | |
|---|---|
| `trackedFiles`, whole call | 1968ms |
| of which, 30 serial `git ls-files` | 1237ms (63%) |
| of which, the `readdirSync` walk | 731ms — this part does not move |

The spawns alone, median of three runs, over the same 30 repositories:

| width | 1 (serial) | 2 | 4 | 6 | 8 | 12 | 16 | 24 | 30 |
|---|---|---|---|---|---|---|---|---|---|
| ms | 1279 | 634 | 376 | 306 | 293 | 283 | 283 | 282 | 288 |

The curve plateaus at six to eight. Nothing above eight is worth having, and
running all thirty at once is neither better nor meaningfully worse — an earlier
single run that showed 30-wide as slower was noise, not a finding.

A single-repository root never reaches this code at all: it takes the direct
path at `lib/tracked.js:254`, one spawn, 46ms. **This change is worth nothing on
the common root shape**, and everything on the multi-project root that
`lib/tracked.js:234` describes as the one a cross-project task opens at.

## The approach

`walk()` stops spawning as it goes. It records each nested repository and its
position in the file list, finishes the tree, and then makes **one**
`execFileSync` onto a helper script that runs the whole set through a bounded
pool of eight and returns their output as JSON. The parent process never
awaits anything.

The interface does not change. `trackedFiles` stays synchronous, keeps returning
`null` for nothing readable, and keeps its depth-first alphabetical order. No
caller changes how it calls, and no entry point changes at all.

What shipped kept that, with two edits this paragraph originally denied outright
and which both came out of review rather than out of the design. `scripts/survey.js`
has one changed string — the note a truncated walk prints, which said "files"
where the walk had come to count parts — and `tests/survey.test.js` gained the
test that pins the new wording. Five of the six callers are byte-identical to
`main`.

### Why not make it async

Making `trackedFiles` return a promise reaches 1024ms against this design's
1140ms — 116ms better on a call that runs once per command. It costs an async
cascade through six scripts, and three of the six entry points fail *silently*
when missed rather than loudly:

| | |
|---|---|
| `scripts/layout.js` | `process.exit(main(...))` returns before the promise settles |
| `scripts/orient.js`, `scripts/survey.js` | `main(argv) + '\n'` prints `[object Promise]` |
| `scripts/docs-check.js:272` | `if (!result)` never fires; a promise is always truthy |

It also blinds `tests/survey.test.js:739` and `:812`, which mock
`cp.execFileSync` to observe the spawn — and `:752` asserts that **zero** spawns
happen, an assertion that goes on passing once the mock stops observing
anything. The synchronous design keeps 88% of the time saved (828ms of 944ms)
and none of that.

### Ordering, and the ceiling

Order is preserved by recording positions during the walk and splicing each
repository's files back into its own slot, so two runs over one tree still list
the same files in the same order.

`MAX_WALK_FILES` changes meaning slightly, and for the better. Today the ceiling
is consulted as the walk goes, so *which* repositories get read depends on the
order they were reached and how many files the earlier ones held: on this
workspace it read 23 of 30 and stopped, and nothing said which 7 were missing.
Under this design the tree is walked whole and the ceiling is applied when the
lists are spliced, so truncation is a function of the file order alone.
`truncated: true` still means the same thing to every caller.

**And `skippedExt` grows on a truncating root.** Found in verification by
comparing the two versions' whole output rather than their counts: on a
workspace of thirty repositories every field matched byte for byte except that
one, which went from 9504 to 20352. Walking the whole tree means meeting every
archive and image in it, including in the subtrees whose files the ceiling then
cuts, and `skippedExt` counts what the walk met. Both numbers are honest about
the walk that produced them; this one is honest about a bigger walk. It reaches
the reader through `survey`'s `skipped:` line, so on a root that truncates that
line now reports the tree rather than the part of it that survived the cut —
which is what the line says it is for, and is the more useful of the two, but it
is a changed number and no page said so before this paragraph.

### The threshold

A node process costs 59ms to start on this machine, so the helper is a loss on a
tree with few repositories. Below **four**, `walk()` spawns serially exactly as
it does today. Four is where the pooled path first clears the startup tax by a
margin worth having, not a measured optimum.

### One parser, not two

`gitFiles` splits into the spawn and the parse. `gitList` keeps the
`--stage`-then-retry handling for old git; a new pure `parseStaged(records)`
takes the raw output and returns `{files, known}`. The synchronous path and the
helper both call `parseStaged`, so there is one answer to what a staged record
means — the property `lib/tracked.js`'s own header comment exists to protect.

It goes in `scripts/`, not `lib/`. `README.md:225` says `lib/` is pure logic
tested directly, and a file whose job is to read stdin and write stdout is not
that. `scripts/fanout.js` follows the shape every script in that directory
already has: the work exported as a function, and an `if (require.main ===
module)` block that is the only part touching stdio — so it is spawnable and
still testable without spawning it.

## Files

| file | change |
|---|---|
| `lib/tracked.js` | `gitFiles` splits into `gitList` + `parseStaged`; `walk()` records repos instead of spawning; new splice pass; threshold at 4 |
| `scripts/fanout.js` | new. Reads `{root, repos}` on stdin, pool of 8, writes JSON |
| `tests/tracked.test.js` | new. Order, the threshold both sides, the ceiling, a repo git declines |
| `tests/survey.test.js` | the two spawn mocks keep working; add one asserting the pooled path is taken above the threshold |

## Proves it done

A test that builds a fixture root of six nested repositories and asserts
`trackedFiles` returns the identical `files` array — same contents, same order —
whether the pooled path or the serial path produced it, with the threshold
forced either way. It fails now because there is no pooled path, and because
`tests/` has no test of `MAX_WALK_FILES` or of walk ordering at all.

Alongside it, `npm test` stays at 860 passing plus the new ones, and
`node scripts/docs-check.js` stays clean.

## Against the map

No conflict. `.fankeel/map.md` lists two pages as planned-but-not-built and both
are in `docs/archive/` — the directory-tree work, retired intent. No current
reference page describes `lib/tracked.js` at all; three archive pages mention it,
and archives are checked only for whether anything current still points at them.

## Unverified

That `walk()` can be made to record positions without changing what it counts
toward the ceiling in the sub-four-repository case. The serial path has to keep
today's exact behaviour there, and that is the one place the two paths could
diverge without a test noticing.

Also unmeasured: every number here comes from one Windows machine with warm
filesystem cache. The 59ms node startup that sets the threshold is the figure
most likely to differ elsewhere, and it is the one the threshold rests on.
